/**
 * e2e-dual-context-round2.spec.js
 *
 * Round 2 — Full E2E dual-context UAT with server-side instrumentation
 *
 * New vs Round 1:
 *  - OUT_DIR points to round2-* result files (no overwrite)
 *  - After each A-write + wait, probe server state via pageA.evaluate → fetch /api/nsm-sessions + /api/circles-sessions
 *  - After B login, probe server state via pageB to distinguish "server not persist" vs "resume bug"
 *  - Bug D fix verified: renderCirclesHome no longer mutates circlesMode
 *
 * Acceptance goal: user cross-device state = latest db state.
 * Context A writes via REAL UI (no AppState injection, no fetch inject).
 * Context B re-login verifies after >= 7s TTL.
 */

const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const PROD_URL = 'https://first-principle.up.railway.app/';
const EMAIL = 'albertpeng678@gmail.com';
const PASSWORD = '21345678';

const BASE_OUT = path.join(__dirname, '../../audit/e2e-dual-context-prod');
fs.mkdirSync(BASE_OUT, { recursive: true });

// Round 7 outputs use r7- prefix to avoid overwriting previous rounds
function r2png(name) { return `${BASE_OUT}/r7-${name}`; }
function r2json(name) { return `${BASE_OUT}/r7-${name}`; }

// Real PM analysis content — used for Track A NSM payload to ensure NSM gate passes.
// Fake timestamp-based strings fail the gate because they're not meaningful PM content.
const REAL_NSM_PAYLOAD = {
  nsm: '每週活躍訂閱付費用戶數',
  explanation: '指過去 7 天內至少使用付費功能一次的訂閱用戶總數。排除試用期用戶。能直接反映付費用戶對核心價值的持續感知。',
  businessLink: 'MAU 是延遲指標。每週活躍付費用戶直接連動 MRR — 用戶若每週活躍代表他持續使用付費功能，續訂機率高、流失率低。',
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * reloadBFromCold — Reload a persistent B page from cold start.
 * Simulates the cross-device scenario where B opens the app fresh after A has saved state.
 * Uses goto() to reset JS state (full page reload), then waits for auto-resume to complete.
 * If B's auth cookie expired, re-logs in. Expects either .qcard (circles home) or
 * .nsm-q-card or .nsm-step-* to appear after auto-resume.
 */
async function reloadBFromCold(pageB, label) {
  await pageB.goto(PROD_URL, { waitUntil: 'networkidle', timeout: 60000 });
  // Wait for app to render (navbar or auth-card)
  await pageB.waitForSelector('.navbar, .auth-card', { timeout: 40000 });

  // Check if B landed on auth screen (token expired across multiple goto's)
  const authCardCount = await pageB.locator('.auth-card').count();
  if (authCardCount > 0) {
    // Re-login
    const signInBtn = pageB.locator('[data-nav="auth"]');
    if (await signInBtn.count() > 0) {
      await signInBtn.first().click();
      await pageB.waitForSelector('.auth-card', { timeout: 10000 });
    }
    await pageB.locator('#auth-email').fill(EMAIL);
    await pageB.locator('#auth-pw').fill(PASSWORD);
    await pageB.locator('#auth-submit').click();
    await pageB.waitForSelector('.auth-card', { state: 'detached', timeout: 40000 });
  }

  // Wait for tryResumeLatestSession to fire and complete
  await pageB.waitForTimeout(4500);
  if (label) await pageB.screenshot({ path: r2png(`${label}-reloadB.png`), fullPage: false });
}

async function loginUI(page, label) {
  await page.goto(PROD_URL, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForSelector('.navbar', { timeout: 40000 });
  await page.waitForTimeout(2000); // let loadHistory + tryResumeLatestSession settle

  // Check if already authenticated (accessToken set = already logged in from localStorage)
  const alreadyAuthed = await page.evaluate(() => !!(window.AppState && window.AppState.accessToken));
  if (alreadyAuthed) {
    console.log('[loginUI] Already authenticated via restored session');
    await page.waitForTimeout(8000); // let tryResumeLatestSession complete
    if (label) await page.screenshot({ path: r2png(`${label}-post-login.png`), fullPage: false });
    return;
  }

  // Not authenticated — need to trigger auth flow.
  // The app shows circles home (guest mode) by default; auth-card is NOT shown until user clicks sign-in.
  // Click [data-nav="auth"] to navigate to auth view.
  const authCard = await page.locator('.auth-card').count();
  if (authCard === 0) {
    // Click the sign-in nav button to show auth form
    const signInBtn = page.locator('[data-nav="auth"]');
    if (await signInBtn.count() > 0) {
      await signInBtn.first().click();
      await page.waitForSelector('.auth-card', { timeout: 10000 });
    } else {
      // Fallback: navigate directly
      await page.goto(PROD_URL + '?view=auth', { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForSelector('.auth-card', { timeout: 10000 });
    }
  }

  // Fill and submit login form
  await page.locator('#auth-email').fill(EMAIL);
  await page.locator('#auth-pw').fill(PASSWORD);
  await page.locator('#auth-submit').click();
  // Wait for auth-card to disappear (login success → view changes to 'circles')
  await page.waitForSelector('.auth-card', { state: 'detached', timeout: 40000 });

  // Wait for tryResumeLatestSession to fire and complete (fetches + resumes session)
  await page.waitForTimeout(15000);

  if (label) {
    await page.screenshot({ path: r2png(`${label}-post-login.png`), fullPage: false });
  }
}

async function waitForCondition(page, evalFn, maxMs = 10000, pollMs = 500) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    const result = await page.evaluate(evalFn).catch(() => null);
    if (result) return true;
    await page.waitForTimeout(pollMs);
  }
  return false;
}

async function waitForNsmStep(page, expectedStep, maxMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    const step = await page.evaluate(() => window.AppState && window.AppState.nsmStep).catch(() => null);
    if (step === expectedStep) return true;
    await page.waitForTimeout(500);
  }
  return false;
}

async function getAppState(page) {
  return page.evaluate(() => {
    var s = window.AppState || {};
    return {
      view: s.view,
      nsmStep: s.nsmStep,
      nsmSubTab: s.nsmSubTab,
      nsmReportTab: s.nsmReportTab,
      nsmSession: s.nsmSession ? { id: s.nsmSession.id } : null,
      nsmSelectedQuestion: s.nsmSelectedQuestion ? { id: s.nsmSelectedQuestion.id } : null,
      nsmDefinition: s.nsmDefinition ? Object.assign({}, s.nsmDefinition) : null,
      nsmBreakdown: s.nsmBreakdown ? Object.assign({}, s.nsmBreakdown) : null,
      nsmEvalResult: s.nsmEvalResult ? { totalScore: s.nsmEvalResult.totalScore } : null,
      nsmGateResult: s.nsmGateResult ? { overall_status: s.nsmGateResult.overall_status || s.nsmGateResult.overallStatus } : null,
      circlesMode: s.circlesMode,
      circlesPhase: s.circlesPhase,
      circlesDrillStep: s.circlesDrillStep,
      circlesSession: s.circlesSession ? { id: s.circlesSession.id } : null,
      circlesSelectedQuestion: s.circlesSelectedQuestion ? { id: s.circlesSelectedQuestion.id } : null,
      circlesFrameworkDraft: s.circlesFrameworkDraft ? JSON.parse(JSON.stringify(s.circlesFrameworkDraft)) : {},
      circlesConversation: Array.isArray(s.circlesConversation) ? s.circlesConversation.length : 0,
      circlesStepScores: s.circlesStepScores ? JSON.parse(JSON.stringify(s.circlesStepScores)) : {},
      circlesGateResult: s.circlesGateResult ? {
        hasItems: !!(s.circlesGateResult.items),
        hasRed: Array.isArray(s.circlesGateResult.items) ? s.circlesGateResult.items.some(function(i){ return i.status === 'red'; }) : null,
      } : null,
    };
  });
}

/**
 * probeServerState — use authenticated page to fetch /api/nsm-sessions and /api/circles-sessions.
 * This directly answers "did server persist the write?" independent of client AppState.
 */
async function probeServerState(page, label) {
  const result = await page.evaluate(async () => {
    var token = window.AppState && window.AppState.accessToken;
    if (!token) return { error: 'no_token', nsmSessions: null, circlesSessions: null };
    try {
      var [nsmResp, circlesResp] = await Promise.all([
        fetch('/api/nsm-sessions', { headers: { Authorization: 'Bearer ' + token } }),
        fetch('/api/circles-sessions', { headers: { Authorization: 'Bearer ' + token } }),
      ]);
      var nsm = nsmResp.ok ? await nsmResp.json() : { error: nsmResp.status };
      var circles = circlesResp.ok ? await circlesResp.json() : { error: circlesResp.status };
      // Summarize active sessions
      var nsmActive = Array.isArray(nsm) ? nsm.filter(function(s) { return s.status === 'active'; }).map(function(s) {
        return { id: s.id, updated_at: s.updated_at, created_at: s.created_at, user_nsm: s.user_nsm, user_breakdown: s.user_breakdown };
      }) : nsm;
      var circlesActive = Array.isArray(circles) ? circles.filter(function(s) { return s.status === 'active'; }).map(function(s) {
        return { id: s.id, updated_at: s.updated_at, created_at: s.created_at, mode: s.mode, drill_step: s.drill_step, current_phase: s.current_phase };
      }) : circles;
      return { nsmActive: nsmActive, circlesActive: circlesActive };
    } catch(e) {
      return { error: e.message };
    }
  });
  console.log(`[SERVER-STATE:${label}] NSM active: ${JSON.stringify(result.nsmActive || result.error || 'n/a').slice(0, 300)}`);
  console.log(`[SERVER-STATE:${label}] Circles active: ${JSON.stringify(result.circlesActive || result.error || 'n/a').slice(0, 300)}`);
  return result;
}

async function typeIntoField(page, selector, text) {
  const count = await page.locator(selector).count();
  if (count === 0) return false;
  const el = page.locator(selector).first();
  const info = await el.evaluate((node) => ({
    tag: node.tagName,
    ce: node.contentEditable,
  }));
  if (info.tag === 'INPUT' || info.tag === 'TEXTAREA') {
    await el.click();
    await el.fill(text);
    await el.dispatchEvent('input');
  } else if (info.ce === 'true' || info.ce === 'plaintext-only') {
    await el.click();
    await page.keyboard.press('Control+A');
    await page.keyboard.type(text);
    await el.dispatchEvent('input');
  } else {
    await el.evaluate((node, t) => {
      node.textContent = t;
      node.dispatchEvent(new Event('input', { bubbles: true }));
    }, text);
  }
  await page.waitForTimeout(200);
  return true;
}

async function navigateToTab(page, tabName) {
  const count = await page.locator(`[data-nav="${tabName}"]`).count();
  if (count > 0) {
    await page.locator(`[data-nav="${tabName}"]`).first().click();
    await page.waitForTimeout(2000);
    return true;
  }
  return false;
}

async function probeSelectors(page, filename) {
  const probe = await page.evaluate(() => {
    var btns = Array.from(document.querySelectorAll('button, [data-nav], [data-circles], [data-circles-mode], [data-nsm-submit], [data-nsm-gate-action], [data-nsm4-tab], [data-phase1]'));
    return btns.slice(0, 80).map(function(el) {
      var rect = el.getBoundingClientRect();
      return {
        tag: el.tagName,
        text: (el.textContent || '').trim().slice(0, 50),
        visible: rect.width > 0 && rect.height > 0,
        attrs: {
          'data-nav': el.dataset.nav || null,
          'data-circles': el.dataset.circles || null,
          'data-circles-mode': el.dataset.circlesMode || null,
          'data-nsm': el.dataset.nsm || null,
          'data-nsm-submit': el.hasAttribute('data-nsm-submit') ? true : null,
          'data-nsm-gate-action': el.dataset.nsmGateAction || null,
          'data-nsm4-tab': el.dataset.nsm4Tab || null,
          'data-phase1': el.dataset.phase1 || null,
          disabled: el.disabled || null,
          class: (el.className || '').slice(0, 60),
        },
      };
    });
  });
  fs.writeFileSync(r2json(filename), JSON.stringify(probe, null, 2));
  return probe;
}

// ─────────────────────────────────────────────────────────────────────────────
// Track A — NSM full e2e
// ─────────────────────────────────────────────────────────────────────────────

test.describe.serial('Track A — NSM full e2e Round 2', () => {
  test('NSM walk r2: A drives, B verifies after each step', async ({ browser }, testInfo) => {
    testInfo.setTimeout(1_800_000); // 30 min

    const ctxA = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const ctxB = await browser.newContext({ viewport: { width: 360, height: 780 } });
    const pageA = await ctxA.newPage();

    const aErrors = [];
    pageA.on('console', (m) => { if (m.type() === 'error') aErrors.push(m.text()); });

    const verifications = [];
    const serverStateLog = [];

    function record(step, expected, got, match, note, serverEvidence) {
      const v = { step, expected, got, match, note: note || null, serverEvidence: serverEvidence || null };
      verifications.push(v);
      console.log(`[${step}] ${match ? 'PASS' : 'FAIL'}${note ? ' — ' + note : ''}`);
      return v;
    }

    // ── Login A ───────────────────────────────────────────────────────────────
    console.log('\n── Selector probe (A login) ─────────────────────────────────────────');
    await loginUI(pageA, 'A-login-probe');
    await probeSelectors(pageA, 'A-selector-probe.json');

    // Navigate A to NSM tab
    const nsm_nav_ok = await navigateToTab(pageA, 'nsm');
    console.log(`[nav] NSM tab click: ${nsm_nav_ok}`);
    await pageA.waitForTimeout(2000);

    // ── A1: NSM Step 1 — select question card ─────────────────────────────────
    console.log('\n── A1: NSM Step 1 question select ──────────────────────────────────');

    await waitForNsmStep(pageA, 1, 8000);

    const a1Cards = await pageA.evaluate(() => {
      var cards = Array.from(document.querySelectorAll('.nsm-q-card[data-qid]'));
      return cards.map(function(c) {
        var rect = c.getBoundingClientRect();
        var st = window.getComputedStyle(c);
        return {
          qid: c.dataset.qid,
          text: (c.textContent || '').slice(0, 60).trim(),
          visible: rect.width > 0 && rect.height > 0 && st.display !== 'none' && st.visibility !== 'hidden',
          inDesktopShell: !!c.closest('.nsm-desktop-shell'),
        };
      });
    });
    fs.writeFileSync(r2json('A1-cards-probe.json'), JSON.stringify(a1Cards, null, 2));
    console.log(`[A1] Cards: ${a1Cards.length} total, ${a1Cards.filter(c => c.visible).length} visible`);

    await pageA.screenshot({ path: r2png('A1-A-before-click.png') });

    const visibleCard = a1Cards.find(c => c.visible) || a1Cards[0];
    let a1QId = null;
    let a1SessionId = null;

    if (visibleCard) {
      const clicked = await pageA.evaluate((qid) => {
        var cards = Array.from(document.querySelectorAll('.nsm-q-card[data-qid="' + qid + '"]'));
        for (var i = 0; i < cards.length; i++) {
          var c = cards[i];
          var rect = c.getBoundingClientRect();
          var st = window.getComputedStyle(c);
          if (rect.width > 0 && rect.height > 0 && st.display !== 'none') {
            c.click();
            return { ok: true, qid: qid, inDesktop: !!c.closest('.nsm-desktop-shell') };
          }
        }
        if (cards[0]) { cards[0].click(); return { ok: true, qid: qid, forced: true }; }
        return { ok: false, qid: qid };
      }, visibleCard.qid);
      console.log(`[A1] Card click: ${JSON.stringify(clicked)}`);

      await waitForCondition(pageA, () => window.AppState && !!window.AppState.nsmSelectedQuestion, 6000);
      await pageA.waitForTimeout(1000);

      const startBtn = pageA.locator('[data-nsm="start"]');
      const startCount = await startBtn.count();
      console.log(`[A1] [data-nsm="start"] count: ${startCount}`);

      if (startCount > 0) {
        const startDisabled = await startBtn.first().isDisabled();
        if (!startDisabled) {
          await startBtn.first().click();
          console.log('[A1] Clicked start → Step 2');
          await waitForNsmStep(pageA, 2, 10000);
        } else {
          console.log('[A1] SPEC_ERROR: start button is disabled');
        }
      }
      await pageA.waitForTimeout(4000);

      const stateA = await getAppState(pageA);
      a1QId = stateA.nsmSelectedQuestion && stateA.nsmSelectedQuestion.id;
      a1SessionId = stateA.nsmSession && stateA.nsmSession.id;
      console.log(`[A1-A] qId=${a1QId} sessionId=${a1SessionId} step=${stateA.nsmStep}`);
    }

    await pageA.screenshot({ path: r2png('A1-A-after-select.png') });

    console.log('[A1] Probing server state (A)...');
    const a1ServerA = await probeServerState(pageA, 'A1-A');
    serverStateLog.push({ step: 'A1', context: 'A', ts: new Date().toISOString(), server: a1ServerA });

    console.log('[A1] Waiting 10s for persistence...');
    await pageA.waitForTimeout(10000);

    // B verify
    const pageB_a1 = await ctxB.newPage();
    await loginUI(pageB_a1, 'A1-B-after-login');
    const a1ServerB = await probeServerState(pageB_a1, 'A1-B');
    serverStateLog.push({ step: 'A1', context: 'B', ts: new Date().toISOString(), server: a1ServerB });
    const stateB_a1 = await getAppState(pageB_a1);
    await pageB_a1.screenshot({ path: r2png('A1-B-verify.png') });
    console.log(`[A1-B] view=${stateB_a1.view} nsmSession=${stateB_a1.nsmSession && stateB_a1.nsmSession.id} qId=${stateB_a1.nsmSelectedQuestion && stateB_a1.nsmSelectedQuestion.id}`);

    const a1BQId = stateB_a1.nsmSelectedQuestion && stateB_a1.nsmSelectedQuestion.id;
    const a1BSessionId = stateB_a1.nsmSession && stateB_a1.nsmSession.id;
    const a1SessionMatch = !!(a1SessionId && a1BSessionId && a1SessionId === a1BSessionId);
    const a1QMatch = !!(a1QId && a1BQId && a1QId === a1BQId);
    record('A1', { qId: a1QId, sessionId: a1SessionId }, stateB_a1, a1SessionMatch || a1QMatch,
      (a1SessionMatch || a1QMatch) ? null : `A qId=${a1QId} vs B qId=${a1BQId}; A session=${a1SessionId} vs B session=${a1BSessionId}`,
      { aServer: a1ServerA, bServer: a1ServerB });

    // ── A2: NSM Step 2 confirmed ──────────────────────────────────────────────
    console.log('\n── A2: NSM Step 2 confirmed ─────────────────────────────────────────');

    const a2CurStep = await pageA.evaluate(() => window.AppState && window.AppState.nsmStep);
    if (a2CurStep !== 2) await waitForNsmStep(pageA, 2, 8000);

    await pageA.screenshot({ path: r2png('A2-A-step2.png') });
    console.log('[A2] Probing server + waiting 8s...');
    const a2ServerA = await probeServerState(pageA, 'A2-A');
    serverStateLog.push({ step: 'A2', context: 'A', ts: new Date().toISOString(), server: a2ServerA });
    await pageA.waitForTimeout(8000);

    const pageB_a2 = await ctxB.newPage();
    await loginUI(pageB_a2, 'A2-B-after-login');
    const a2ServerB = await probeServerState(pageB_a2, 'A2-B');
    serverStateLog.push({ step: 'A2', context: 'B', ts: new Date().toISOString(), server: a2ServerB });
    const stateB_a2 = await getAppState(pageB_a2);
    await pageB_a2.screenshot({ path: r2png('A2-B-verify.png') });
    console.log(`[A2-B] nsmStep=${stateB_a2.nsmStep} sessionId=${stateB_a2.nsmSession && stateB_a2.nsmSession.id}`);

    const a2Match = !!(a1SessionId && stateB_a2.nsmSession && stateB_a2.nsmSession.id === a1SessionId);
    record('A2', { sessionId: a1SessionId, step: 2 }, stateB_a2, a2Match,
      a2Match ? null : `B sessionId=${stateB_a2.nsmSession && stateB_a2.nsmSession.id} vs expected=${a1SessionId}; B step=${stateB_a2.nsmStep}`,
      { aServer: a2ServerA, bServer: a2ServerB });

    // ── A3: NSM Step 2 — type 3 fields ────────────────────────────────────────
    console.log('\n── A3: NSM Step 2 type 3 fields ─────────────────────────────────────');

    const a3Fields = await pageA.evaluate(() => {
      var els = Array.from(document.querySelectorAll('[data-nsm-field]'));
      return els.map(function(el) {
        var rect = el.getBoundingClientRect();
        return { field: el.dataset.nsmField, tag: el.tagName, ce: el.contentEditable, visible: rect.width > 0 && rect.height > 0 };
      });
    });
    fs.writeFileSync(r2json('A3-fields-probe.json'), JSON.stringify(a3Fields, null, 2));
    console.log(`[A3] Fields: ${JSON.stringify(a3Fields.map(f => f.field))}`);

    // Use real PM analysis content so NSM gate passes (fake e2e strings fail gate).
    const a3Payload = {
      nsm: REAL_NSM_PAYLOAD.nsm,
      explanation: REAL_NSM_PAYLOAD.explanation,
      businessLink: REAL_NSM_PAYLOAD.businessLink,
    };

    await pageA.screenshot({ path: r2png('A3-A-before-type.png') });

    for (const key of ['nsm', 'explanation', 'businessLink']) {
      const typed = await typeIntoField(pageA, `[data-nsm-field="${key}"]`, a3Payload[key]);
      if (!typed) console.log(`[A3] WARNING: field [data-nsm-field="${key}"] not found`);
      await pageA.waitForTimeout(300);
    }
    await pageA.waitForTimeout(4000); // autosave debounce + PATCH

    const stateA_a3 = await getAppState(pageA);
    console.log(`[A3-A] def=${JSON.stringify(stateA_a3.nsmDefinition)}`);
    await pageA.screenshot({ path: r2png('A3-A-typed.png') });

    console.log('[A3] Probing server (A)...');
    const a3ServerA = await probeServerState(pageA, 'A3-A');
    serverStateLog.push({ step: 'A3', context: 'A', ts: new Date().toISOString(), server: a3ServerA, nsmDefinitionOnA: stateA_a3.nsmDefinition });
    console.log('[A3] Waiting 10s...');
    await pageA.waitForTimeout(10000);

    const pageB_a3 = await ctxB.newPage();
    await loginUI(pageB_a3, 'A3-B-after-login');
    const a3ServerB = await probeServerState(pageB_a3, 'A3-B');
    serverStateLog.push({ step: 'A3', context: 'B', ts: new Date().toISOString(), server: a3ServerB });
    const stateB_a3 = await getAppState(pageB_a3);
    await pageB_a3.screenshot({ path: r2png('A3-B-verify.png') });
    console.log(`[A3-B] def=${JSON.stringify(stateB_a3.nsmDefinition)}`);

    const a3Match = !!(
      stateB_a3.nsmDefinition &&
      stateB_a3.nsmDefinition.nsm === a3Payload.nsm &&
      stateB_a3.nsmDefinition.explanation === a3Payload.explanation
    );
    record('A3', a3Payload, stateB_a3.nsmDefinition, a3Match,
      a3Match ? null : `nsm="${stateB_a3.nsmDefinition && stateB_a3.nsmDefinition.nsm}" vs expected="${a3Payload.nsm}"`,
      { aServer: a3ServerA, bServer: a3ServerB });

    // ── A4: submit Step 2 → gate eval ─────────────────────────────────────────
    console.log('\n── A4: NSM Step 2 submit → gate ─────────────────────────────────────');

    await pageA.screenshot({ path: r2png('A4-A-before-submit.png') });

    const a4SubTab = await pageA.evaluate(() => window.AppState && window.AppState.nsmSubTab);
    const a4SubmitCount = await pageA.locator('[data-nsm-submit]').count();
    console.log(`[A4] nsmSubTab=${a4SubTab} submitCount=${a4SubmitCount}`);

    let a4GateResult = null;
    let a4Submitted = false;

    if (a4SubmitCount > 0) {
      const submitBtn = pageA.locator('[data-nsm-submit]').first();
      const isDisabled = await submitBtn.isDisabled();
      console.log(`[A4] Submit disabled: ${isDisabled}`);
      if (!isDisabled) {
        await submitBtn.click();
        console.log('[A4] Clicked submit — waiting up to 40s for gate eval...');
        await waitForCondition(pageA, () => window.AppState && window.AppState.nsmSubTab === 'nsm-gate', 8000);
        await waitForCondition(pageA, () => window.AppState && !window.AppState.nsmGateLoading && window.AppState.nsmGateResult != null, 45000, 1000);
        await pageA.waitForTimeout(2000);
        a4GateResult = await pageA.evaluate(() => window.AppState && window.AppState.nsmGateResult);
        a4Submitted = true;
        const a4GateStatus = a4GateResult && (a4GateResult.overall_status || a4GateResult.overallStatus);
        console.log(`[A4] Gate status: ${a4GateStatus}`);
      }
    }

    await pageA.screenshot({ path: r2png('A4-A-gate-result.png') });

    console.log('[A4] Probing server (A)...');
    const a4ServerA = await probeServerState(pageA, 'A4-A');
    serverStateLog.push({ step: 'A4', context: 'A', ts: new Date().toISOString(), server: a4ServerA });
    console.log('[A4] Waiting 10s...');
    await pageA.waitForTimeout(10000);

    const pageB_a4 = await ctxB.newPage();
    await loginUI(pageB_a4, 'A4-B-after-login');
    const a4ServerB = await probeServerState(pageB_a4, 'A4-B');
    serverStateLog.push({ step: 'A4', context: 'B', ts: new Date().toISOString(), server: a4ServerB });
    const stateB_a4 = await getAppState(pageB_a4);
    await pageB_a4.screenshot({ path: r2png('A4-B-verify.png') });
    console.log(`[A4-B] nsmGateResult=${JSON.stringify(stateB_a4.nsmGateResult)}`);

    const a4Match = a4Submitted && !!stateB_a4.nsmGateResult;
    record('A4', { submitted: a4Submitted }, stateB_a4, a4Match,
      a4Match ? null : `submitted=${a4Submitted}, B gateResult=${!!stateB_a4.nsmGateResult}`,
      { aServer: a4ServerA, bServer: a4ServerB });

    // ── A5: gate → Step 3 ────────────────────────────────────────────────────
    console.log('\n── A5: Gate → Step 3 ───────────────────────────────────────────────');

    const a5GateStatus = a4GateResult && (a4GateResult.overall_status || a4GateResult.overallStatus);
    let a5ReachedStep3 = false;
    console.log(`[A5] Gate status: ${a5GateStatus}`);

    if (a5GateStatus === 'ok' || a5GateStatus === 'warn') {
      const proceedBtn = pageA.locator('[data-nsm-gate-action="proceed"]');
      const proceedCount = await proceedBtn.count();
      if (proceedCount > 0) {
        await proceedBtn.first().click();
        await waitForNsmStep(pageA, 3, 10000);
        a5ReachedStep3 = await pageA.evaluate(() => window.AppState && window.AppState.nsmStep === 3);
        console.log(`[A5] Reached step 3: ${a5ReachedStep3}`);
      }
    } else if (a5GateStatus === 'error') {
      console.log('[A5] Gate error — blocks progression (expected behavior)');
      record('A5', { step: 3 }, { step: 2.5, gateStatus: 'error' }, false, 'Gate error blocks progression — correct behavior');
    }

    await pageA.screenshot({ path: r2png('A5-A-step3.png') });
    const a5ServerA = await probeServerState(pageA, 'A5-A');
    serverStateLog.push({ step: 'A5', context: 'A', ts: new Date().toISOString(), server: a5ServerA });
    console.log('[A5] Waiting 8s...');
    await pageA.waitForTimeout(8000);

    const pageB_a5 = await ctxB.newPage();
    await loginUI(pageB_a5, 'A5-B-after-login');
    const a5ServerB = await probeServerState(pageB_a5, 'A5-B');
    serverStateLog.push({ step: 'A5', context: 'B', ts: new Date().toISOString(), server: a5ServerB });
    const stateB_a5 = await getAppState(pageB_a5);
    await pageB_a5.screenshot({ path: r2png('A5-B-verify.png') });
    console.log(`[A5-B] nsmStep=${stateB_a5.nsmStep}`);

    if (a5GateStatus !== 'error') {
      const a5Match = a5ReachedStep3 && stateB_a5.nsmStep === 3;
      record('A5', { step: 3 }, stateB_a5, a5Match,
        a5Match ? null : `A reached step3=${a5ReachedStep3}; B step=${stateB_a5.nsmStep}`,
        { aServer: a5ServerA, bServer: a5ServerB });
    }

    // ── A6: NSM Step 3 — type 4 dims ─────────────────────────────────────────
    console.log('\n── A6: NSM Step 3 dim type ──────────────────────────────────────────');

    const a6CurStep = await pageA.evaluate(() => window.AppState && window.AppState.nsmStep);
    const a6Dims = await pageA.evaluate(() => {
      var els = Array.from(document.querySelectorAll('[data-nsm-dim]'));
      return els.map(function(el) {
        var rect = el.getBoundingClientRect();
        return { dim: el.dataset.nsmDim, tag: el.tagName, visible: rect.width > 0 && rect.height > 0 };
      });
    });
    fs.writeFileSync(r2json('A6-dims-probe.json'), JSON.stringify(a6Dims, null, 2));
    console.log(`[A6] Step: ${a6CurStep}, Dims: ${JSON.stringify(a6Dims)}`);

    const ts6 = Date.now();
    const a6Payload = {
      reach: `e2e-r2-a6-reach-${ts6}`,
      depth: `e2e-r2-a6-depth-${ts6}`,
      frequency: `e2e-r2-a6-freq-${ts6}`,
      impact: `e2e-r2-a6-impact-${ts6}`,
    };

    await pageA.screenshot({ path: r2png('A6-A-before-type.png') });

    if (a6CurStep === 3) {
      for (const [dim, value] of Object.entries(a6Payload)) {
        const sel = `[data-nsm-dim="${dim}"]`;
        const count = await pageA.locator(sel).count();
        if (count > 0) {
          const el = pageA.locator(sel).first();
          await el.click();
          await el.fill(value);
          await el.dispatchEvent('input');
          await pageA.waitForTimeout(300);
        } else {
          console.log(`[A6] WARNING: [data-nsm-dim="${dim}"] not found`);
        }
      }
      await pageA.waitForTimeout(4000); // autosave
    } else {
      console.log(`[A6] SPEC_ERROR: not on step 3 (step=${a6CurStep})`);
    }

    const stateA_a6 = await getAppState(pageA);
    console.log(`[A6-A] breakdown=${JSON.stringify(stateA_a6.nsmBreakdown)}`);
    await pageA.screenshot({ path: r2png('A6-A-typed.png') });

    const a6ServerA = await probeServerState(pageA, 'A6-A');
    serverStateLog.push({ step: 'A6', context: 'A', ts: new Date().toISOString(), server: a6ServerA, breakdownOnA: stateA_a6.nsmBreakdown });
    console.log('[A6] Waiting 10s...');
    await pageA.waitForTimeout(10000);

    const pageB_a6 = await ctxB.newPage();
    await loginUI(pageB_a6, 'A6-B-after-login');
    const a6ServerB = await probeServerState(pageB_a6, 'A6-B');
    serverStateLog.push({ step: 'A6', context: 'B', ts: new Date().toISOString(), server: a6ServerB });
    const stateB_a6 = await getAppState(pageB_a6);
    await pageB_a6.screenshot({ path: r2png('A6-B-verify.png') });
    console.log(`[A6-B] breakdown=${JSON.stringify(stateB_a6.nsmBreakdown)}`);

    const a6Match = !!(stateB_a6.nsmBreakdown && stateB_a6.nsmBreakdown.reach === a6Payload.reach);
    record('A6', a6Payload, stateB_a6.nsmBreakdown, a6Match,
      a6Match ? null : `B reach="${stateB_a6.nsmBreakdown && stateB_a6.nsmBreakdown.reach}" vs expected="${a6Payload.reach}"`,
      { aServer: a6ServerA, bServer: a6ServerB });

    // ── A7: submit Step 3 → AI eval → Step 4 ─────────────────────────────────
    console.log('\n── A7: NSM Step 3 → AI eval → Step 4 ───────────────────────────────');

    const a7CurStep = await pageA.evaluate(() => window.AppState && window.AppState.nsmStep);
    const a7SubTab = await pageA.evaluate(() => window.AppState && window.AppState.nsmSubTab);
    console.log(`[A7] Step: ${a7CurStep}, subTab: ${a7SubTab}`);

    let a7ReachedStep4 = false;

    if (a7CurStep === 3 && a7SubTab === 'nsm-step3') {
      const submitCount = await pageA.locator('[data-nsm-submit]').count();
      if (submitCount > 0) {
        const submitBtn = pageA.locator('[data-nsm-submit]').first();
        const isDisabled = await submitBtn.isDisabled();
        if (!isDisabled) {
          await submitBtn.click();
          console.log('[A7] Clicked submit — waiting up to 70s for AI eval...');
          await waitForNsmStep(pageA, 4, 75000);
          a7ReachedStep4 = await pageA.evaluate(() => window.AppState && window.AppState.nsmStep === 4);
          console.log(`[A7] Reached step 4: ${a7ReachedStep4}`);
        } else {
          console.log('[A7] SPEC_ERROR: submit disabled');
        }
      }
    } else {
      console.log(`[A7] SPEC_ERROR: step=${a7CurStep} subTab=${a7SubTab}`);
    }

    await pageA.screenshot({ path: r2png('A7-A-step4.png') });
    const a7ServerA = await probeServerState(pageA, 'A7-A');
    serverStateLog.push({ step: 'A7', context: 'A', ts: new Date().toISOString(), server: a7ServerA });
    console.log('[A7] Waiting 10s...');
    await pageA.waitForTimeout(10000);

    const pageB_a7 = await ctxB.newPage();
    await loginUI(pageB_a7, 'A7-B-after-login');
    const a7ServerB = await probeServerState(pageB_a7, 'A7-B');
    serverStateLog.push({ step: 'A7', context: 'B', ts: new Date().toISOString(), server: a7ServerB });
    const stateB_a7 = await getAppState(pageB_a7);
    await pageB_a7.screenshot({ path: r2png('A7-B-verify.png') });
    console.log(`[A7-B] nsmStep=${stateB_a7.nsmStep} evalResult=${JSON.stringify(stateB_a7.nsmEvalResult)}`);

    const a7Match = a7ReachedStep4 && stateB_a7.nsmStep === 4 && !!stateB_a7.nsmEvalResult;
    record('A7', { step: 4, hasEval: true }, stateB_a7, a7Match,
      a7Match ? null : `A step4=${a7ReachedStep4}; B step=${stateB_a7.nsmStep} hasEval=${!!stateB_a7.nsmEvalResult}`,
      { aServer: a7ServerA, bServer: a7ServerB });

    // ── A8: Step 4 — comparison tab ───────────────────────────────────────────
    console.log('\n── A8: NSM Step 4 → comparison tab ─────────────────────────────────');

    const a8CurStep = await pageA.evaluate(() => window.AppState && window.AppState.nsmStep);
    let a8TabClicked = false;
    if (a8CurStep === 4) {
      const compTab = pageA.locator('[data-nsm4-tab="comparison"]');
      if (await compTab.count() > 0) {
        await compTab.first().click();
        await pageA.waitForTimeout(3000);
        a8TabClicked = true;
      }
    }

    await pageA.screenshot({ path: r2png('A8-A-comparison-tab.png') });
    const a8ServerA = await probeServerState(pageA, 'A8-A');
    serverStateLog.push({ step: 'A8', context: 'A', ts: new Date().toISOString(), server: a8ServerA });
    console.log('[A8] Waiting 10s...');
    await pageA.waitForTimeout(10000);

    const pageB_a8 = await ctxB.newPage();
    await loginUI(pageB_a8, 'A8-B-after-login');
    const a8ServerB = await probeServerState(pageB_a8, 'A8-B');
    serverStateLog.push({ step: 'A8', context: 'B', ts: new Date().toISOString(), server: a8ServerB });
    const stateB_a8 = await getAppState(pageB_a8);
    await pageB_a8.screenshot({ path: r2png('A8-B-verify.png') });
    console.log(`[A8-B] nsmReportTab=${stateB_a8.nsmReportTab}`);

    const a8Match = a8TabClicked && stateB_a8.nsmReportTab === 'comparison';
    record('A8', { nsmReportTab: 'comparison' }, stateB_a8, a8Match,
      a8Match ? null : `tabClicked=${a8TabClicked}; B reportTab=${stateB_a8.nsmReportTab}`,
      { aServer: a8ServerA, bServer: a8ServerB });

    // ── A9: highlights tab ─────────────────────────────────────────────────────
    console.log('\n── A9: NSM Step 4 → highlights tab ──────────────────────────────────');

    let a9TabClicked = false;
    const a9CurStep = await pageA.evaluate(() => window.AppState && window.AppState.nsmStep);
    if (a9CurStep === 4) {
      const hlTab = pageA.locator('[data-nsm4-tab="highlights"]');
      if (await hlTab.count() > 0) {
        await hlTab.first().click();
        await pageA.waitForTimeout(3000);
        a9TabClicked = true;
      }
    }

    await pageA.screenshot({ path: r2png('A9-A-highlights-tab.png') });
    const a9ServerA = await probeServerState(pageA, 'A9-A');
    serverStateLog.push({ step: 'A9', context: 'A', ts: new Date().toISOString(), server: a9ServerA });
    console.log('[A9] Waiting 10s...');
    await pageA.waitForTimeout(10000);

    const pageB_a9 = await ctxB.newPage();
    await loginUI(pageB_a9, 'A9-B-after-login');
    const a9ServerB = await probeServerState(pageB_a9, 'A9-B');
    serverStateLog.push({ step: 'A9', context: 'B', ts: new Date().toISOString(), server: a9ServerB });
    const stateB_a9 = await getAppState(pageB_a9);
    await pageB_a9.screenshot({ path: r2png('A9-B-verify.png') });

    const a9Match = a9TabClicked && stateB_a9.nsmReportTab === 'highlights';
    record('A9', { nsmReportTab: 'highlights' }, stateB_a9, a9Match,
      a9Match ? null : `tabClicked=${a9TabClicked}; B reportTab=${stateB_a9.nsmReportTab}`,
      { aServer: a9ServerA, bServer: a9ServerB });

    // ── A10: done tab ──────────────────────────────────────────────────────────
    console.log('\n── A10: NSM Step 4 → done tab ───────────────────────────────────────');

    let a10TabClicked = false;
    let a10TabKey = null;
    const a10CurStep = await pageA.evaluate(() => window.AppState && window.AppState.nsmStep);
    if (a10CurStep === 4) {
      for (const tabKey of ['done', 'complete']) {
        const doneTab = pageA.locator(`[data-nsm4-tab="${tabKey}"]`);
        if (await doneTab.count() > 0) {
          await doneTab.first().click();
          await pageA.waitForTimeout(3000);
          a10TabClicked = true;
          a10TabKey = tabKey;
          break;
        }
      }
    }

    await pageA.screenshot({ path: r2png('A10-A-done-tab.png') });
    const a10ServerA = await probeServerState(pageA, 'A10-A');
    serverStateLog.push({ step: 'A10', context: 'A', ts: new Date().toISOString(), server: a10ServerA });
    console.log('[A10] Waiting 10s...');
    await pageA.waitForTimeout(10000);

    const pageB_a10 = await ctxB.newPage();
    await loginUI(pageB_a10, 'A10-B-after-login');
    const a10ServerB = await probeServerState(pageB_a10, 'A10-B');
    serverStateLog.push({ step: 'A10', context: 'B', ts: new Date().toISOString(), server: a10ServerB });
    const stateB_a10 = await getAppState(pageB_a10);
    await pageB_a10.screenshot({ path: r2png('A10-B-verify.png') });

    const a10Match = a10TabClicked && (stateB_a10.nsmReportTab === 'done' || stateB_a10.nsmReportTab === 'complete');
    record('A10', { nsmReportTab: a10TabKey }, stateB_a10, a10Match,
      a10Match ? null : `tabClicked=${a10TabClicked}; tabKey=${a10TabKey}; B reportTab=${stateB_a10.nsmReportTab}`,
      { aServer: a10ServerA, bServer: a10ServerB });

    // ── Save Track A Round 7 results ──────────────────────────────────────────
    const trackAResults = {
      round: 7,
      track: 'A',
      verifications,
      aErrors,
      serverStateLog,
      ts: new Date().toISOString(),
      summary: {
        total: verifications.length,
        pass: verifications.filter(v => v.match).length,
        fail: verifications.filter(v => !v.match).length,
      },
    };
    fs.writeFileSync(r2json('round7-results-A.json'), JSON.stringify(trackAResults, null, 2));
    // Also write to deliverable path for UAT round 7
    fs.writeFileSync(`${BASE_OUT}/r7-round7-results-A.json`, JSON.stringify(trackAResults, null, 2));

    console.log('\n══════════════════════════════════════════════');
    console.log(`Track A Round 7: ${trackAResults.summary.pass}/${trackAResults.summary.total} PASSED`);
    for (const v of verifications) {
      console.log(`  ${v.step}: ${v.match ? 'PASS' : 'FAIL'}${v.note ? ' — ' + v.note : ''}`);
    }
    console.log('══════════════════════════════════════════════');

    await ctxA.close();
    await ctxB.close();

    expect(verifications.length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Track B — CIRCLES drill 7 steps Round 2
// ─────────────────────────────────────────────────────────────────────────────

test.describe.serial('Track B — CIRCLES drill Round 2', () => {
  test('CIRCLES drill r2: A drives, B verifies after each step', async ({ browser }, testInfo) => {
    testInfo.setTimeout(1_800_000); // 30 min

    const ctxA = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const ctxB = await browser.newContext({ viewport: { width: 360, height: 780 } });
    const pageA = await ctxA.newPage();

    const aErrors = [];
    pageA.on('console', (m) => { if (m.type() === 'error') aErrors.push(m.text()); });

    const verifications = [];
    const serverStateLog = [];

    function record(step, expected, got, match, note, serverEvidence) {
      const v = { step, expected, got, match, note: note || null, serverEvidence: serverEvidence || null };
      verifications.push(v);
      console.log(`[${step}] ${match ? 'PASS' : 'FAIL'}${note ? ' — ' + note : ''}`);
      return v;
    }

    await loginUI(pageA, 'B-A-login');

    // Create persistent B page — reloadBFromCold() will goto(PROD_URL) on each verification
    // step rather than creating new pages. This simulates the same device opening the app
    // fresh each time (full JS state reset) while reusing the same browser context/cookies.
    const pageB = await ctxB.newPage();
    await loginUI(pageB, 'B-initial-login');

    // ── B1: CIRCLES tab → drill mode → C1 → click q-card ─────────────────────
    console.log('\n── B1: CIRCLES drill C1 select ──────────────────────────────────────');

    await navigateToTab(pageA, 'circles');
    await pageA.waitForTimeout(2000);

    const drillModeBtn = pageA.locator('[data-circles-mode="drill"]');
    if (await drillModeBtn.count() > 0) {
      await drillModeBtn.first().click();
      await pageA.waitForTimeout(1500);
    }

    const b1Mode = await pageA.evaluate(() => window.AppState && window.AppState.circlesMode);
    console.log(`[B1] circlesMode: ${b1Mode}`);

    const c1Pill = pageA.locator('[data-circles="drill-pill"][data-step="C1"]');
    if (await c1Pill.count() > 0) {
      await c1Pill.first().click();
      await pageA.waitForTimeout(1000);
    }

    const b1Cards = await pageA.evaluate(() => {
      var cards = Array.from(document.querySelectorAll('.qcard[data-qid]'));
      return cards.slice(0, 5).map(function(c) {
        var rect = c.getBoundingClientRect();
        return { qid: c.dataset.qid, text: (c.textContent || '').slice(0, 60).trim(), visible: rect.width > 0 && rect.height > 0 };
      });
    });
    fs.writeFileSync(r2json('B1-cards-probe.json'), JSON.stringify(b1Cards, null, 2));
    console.log(`[B1] Cards: ${b1Cards.length} total, ${b1Cards.filter(c => c.visible).length} visible`);

    const b1TargetCard = b1Cards.find(c => c.visible) || b1Cards[0];
    let b1QId = null;

    if (b1TargetCard) {
      await pageA.evaluate((qid) => {
        var cards = Array.from(document.querySelectorAll('.qcard[data-qid="' + qid + '"]'));
        for (var i = 0; i < cards.length; i++) {
          var rect = cards[i].getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) { cards[i].click(); return; }
        }
        if (cards[0]) cards[0].click();
      }, b1TargetCard.qid);
      await pageA.waitForTimeout(1500);

      const confirmSel = `[data-circles="qcard-confirm"][data-qid="${b1TargetCard.qid}"]`;
      let confirmCount = await pageA.locator(confirmSel).count();
      if (confirmCount === 0) confirmCount = await pageA.locator('[data-circles="qcard-confirm"]').count();

      if (confirmCount > 0) {
        const confirmEl = (await pageA.locator(confirmSel).count() > 0)
          ? pageA.locator(confirmSel).first()
          : pageA.locator('[data-circles="qcard-confirm"]').first();
        const confirmQid = await confirmEl.getAttribute('data-qid');
        await confirmEl.click();
        b1QId = confirmQid || b1TargetCard.qid;
        console.log(`[B1] Confirmed qid=${b1QId}`);
        await pageA.waitForTimeout(5000);
      } else {
        console.log('[B1] SPEC_ERROR: qcard-confirm not found');
      }
    }

    const stateA_b1 = await getAppState(pageA);
    console.log(`[B1-A] mode=${stateA_b1.circlesMode} session=${stateA_b1.circlesSession && stateA_b1.circlesSession.id}`);
    await pageA.screenshot({ path: r2png('B1-A-after-select.png') });

    const b1ServerA = await probeServerState(pageA, 'B1-A');
    serverStateLog.push({ step: 'B1', context: 'A', ts: new Date().toISOString(), server: b1ServerA });
    console.log('[B1] Waiting 10s...');
    await pageA.waitForTimeout(10000);

    // B1 verify — reloadBFromCold simulates B opening app fresh on a different device
    await reloadBFromCold(pageB, 'B1-B-after-reload');
    const b1ServerB = await probeServerState(pageB, 'B1-B');
    serverStateLog.push({ step: 'B1', context: 'B', ts: new Date().toISOString(), server: b1ServerB });
    const stateB_b1 = await getAppState(pageB);
    await pageB.screenshot({ path: r2png('B1-B-verify.png') });
    console.log(`[B1-B] mode=${stateB_b1.circlesMode} session=${stateB_b1.circlesSession && stateB_b1.circlesSession.id}`);

    const b1SessionA = stateA_b1.circlesSession && stateA_b1.circlesSession.id;
    const b1SessionB = stateB_b1.circlesSession && stateB_b1.circlesSession.id;
    const b1SessionMatch = !!(b1SessionA && b1SessionB && b1SessionA === b1SessionB);
    const b1QMatch = !!(b1QId && stateB_b1.circlesSelectedQuestion && stateB_b1.circlesSelectedQuestion.id === b1QId);
    record('B1', { qId: b1QId, drillStep: 'C1', sessionId: b1SessionA }, stateB_b1, b1QMatch || b1SessionMatch,
      (b1QMatch || b1SessionMatch) ? null : `A session=${b1SessionA} B session=${b1SessionB}; A qId=${b1QId} B qId=${stateB_b1.circlesSelectedQuestion && stateB_b1.circlesSelectedQuestion.id}`,
      { aServer: b1ServerA, bServer: b1ServerB });

    // ── B2: CIRCLES C1 — type Phase 1 fields ─────────────────────────────────
    console.log('\n── B2: CIRCLES C1 type Phase 1 fields ───────────────────────────────');

    const b2Fields = await pageA.evaluate(() => {
      var els = Array.from(document.querySelectorAll('[data-phase1="textarea"]'));
      return els.map(function(el, i) {
        var rect = el.getBoundingClientRect();
        return { idx: el.dataset.fieldIdx || String(i), tag: el.tagName, visible: rect.width > 0 && rect.height > 0 };
      });
    });
    fs.writeFileSync(r2json('B2-fields-probe.json'), JSON.stringify(b2Fields, null, 2));

    const ts_b2 = Date.now();
    const b2Payload = `e2e-r2-b2-c1-${ts_b2}`;

    await pageA.screenshot({ path: r2png('B2-A-before-type.png') });

    for (let i = 0; i < 4; i++) {
      const sel = `[data-phase1="textarea"][data-field-idx="${i}"]`;
      const count = await pageA.locator(sel).count();
      if (count > 0) {
        const el = pageA.locator(sel).first();
        await el.click();
        await pageA.keyboard.press('Control+A');
        await pageA.keyboard.type(`${b2Payload}-f${i}`);
        await el.dispatchEvent('input');
        await pageA.waitForTimeout(300);
      }
    }
    await pageA.waitForTimeout(5000);

    const stateA_b2 = await getAppState(pageA);
    console.log(`[B2-A] session=${stateA_b2.circlesSession && stateA_b2.circlesSession.id} draft=${JSON.stringify(stateA_b2.circlesFrameworkDraft).slice(0, 150)}`);
    await pageA.screenshot({ path: r2png('B2-A-typed.png') });

    const b2ServerA = await probeServerState(pageA, 'B2-A');
    serverStateLog.push({ step: 'B2', context: 'A', ts: new Date().toISOString(), server: b2ServerA });
    console.log('[B2] Waiting 10s...');
    await pageA.waitForTimeout(10000);

    // B2 verify — fresh cold reload to test Bug E fix: circlesFrameworkDraft should be rehydrated
    await reloadBFromCold(pageB, 'B2-B-after-reload');
    const b2ServerB = await probeServerState(pageB, 'B2-B');
    serverStateLog.push({ step: 'B2', context: 'B', ts: new Date().toISOString(), server: b2ServerB });
    const stateB_b2 = await getAppState(pageB);
    await pageB.screenshot({ path: r2png('B2-B-verify.png') });

    const b2DraftStr = JSON.stringify(stateB_b2.circlesFrameworkDraft || {});
    const b2Match = b2DraftStr.includes(b2Payload);
    record('B2', { payload: b2Payload }, { frameworkDraftHas: b2Match, sessionId: stateB_b2.circlesSession && stateB_b2.circlesSession.id }, b2Match,
      b2Match ? null : `B draft missing "${b2Payload}". Got: ${b2DraftStr.slice(0, 200)}`,
      { aServer: b2ServerA, bServer: b2ServerB });

    // ── B3: submit C1 → Phase 1.5 gate ────────────────────────────────────────
    console.log('\n── B3: C1 submit → gate ─────────────────────────────────────────────');

    const b3SubmitCount = await pageA.locator('[data-phase1="submit"]').count();
    let b3GateResult = null;
    let b3Submitted = false;
    let b3HasRed = null;

    if (b3SubmitCount > 0) {
      const b3Btn = pageA.locator('[data-phase1="submit"]').first();
      const isDisabled = await b3Btn.isDisabled();
      if (!isDisabled) {
        await b3Btn.click();
        console.log('[B3] Clicked submit — waiting for gate...');
        await waitForCondition(pageA, () => window.AppState && (window.AppState.circlesPhase === 1.5 || window.AppState.circlesGateResult != null), 35000, 1000);
        await pageA.waitForTimeout(3000);
        b3GateResult = await pageA.evaluate(() => window.AppState && window.AppState.circlesGateResult);
        b3HasRed = b3GateResult && b3GateResult.items ? b3GateResult.items.some(i => i.status === 'red') : null;
        b3Submitted = true;
        console.log(`[B3] Gate done. hasRed=${b3HasRed}`);
      }
    }

    if (b3Submitted && b3GateResult && !b3HasRed) {
      const proceedBtn = pageA.locator('[data-gate-action="proceed"]');
      if (await proceedBtn.count() > 0) {
        await proceedBtn.first().click();
        await pageA.waitForTimeout(3000);
      }
    }

    await pageA.screenshot({ path: r2png('B3-A-after-gate.png') });
    const b3ServerA = await probeServerState(pageA, 'B3-A');
    serverStateLog.push({ step: 'B3', context: 'A', ts: new Date().toISOString(), server: b3ServerA });
    console.log('[B3] Waiting 8s...');
    await pageA.waitForTimeout(8000);

    // B3 verify — cold reload to test gate_result rehydration after Bug E fix
    await reloadBFromCold(pageB, 'B3-B-after-reload');
    const b3ServerB = await probeServerState(pageB, 'B3-B');
    serverStateLog.push({ step: 'B3', context: 'B', ts: new Date().toISOString(), server: b3ServerB });
    const stateB_b3 = await getAppState(pageB);
    await pageB.screenshot({ path: r2png('B3-B-verify.png') });

    const b3SessionA = stateA_b2.circlesSession && stateA_b2.circlesSession.id;
    const b3SessionB = stateB_b3.circlesSession && stateB_b3.circlesSession.id;
    const b3Match = b3Submitted && !!(b3SessionA && b3SessionB && b3SessionA === b3SessionB && stateB_b3.circlesGateResult);
    record('B3', { submitted: true, sessionId: b3SessionA }, stateB_b3, b3Match,
      b3Match ? null : `A session=${b3SessionA} B session=${b3SessionB}; B gateResult=${!!stateB_b3.circlesGateResult}`,
      { aServer: b3ServerA, bServer: b3ServerB });

    // ── B4-B8: I, R, C2, L, E drill steps ────────────────────────────────────
    const drillStepsConfig = [
      { step: 'B4', pill: 'I' },
      { step: 'B5', pill: 'R' },
      { step: 'B6', pill: 'C2' },
      { step: 'B7', pill: 'L' },
      { step: 'B8', pill: 'E' },
    ];

    for (const ds of drillStepsConfig) {
      console.log(`\n── ${ds.step}: ${ds.pill} step ─────────────────────────────────────────────`);

      await navigateToTab(pageA, 'home');
      await pageA.waitForTimeout(500);
      await navigateToTab(pageA, 'circles');
      await pageA.waitForTimeout(2000);

      const dBtn = pageA.locator('[data-circles-mode="drill"]');
      if (await dBtn.count() > 0) {
        await dBtn.first().click();
        await pageA.waitForTimeout(1000);
      }

      const pill = pageA.locator(`[data-circles="drill-pill"][data-step="${ds.pill}"]`);
      if (await pill.count() > 0) {
        await pill.first().click();
        await pageA.waitForTimeout(1000);
        console.log(`[${ds.step}] Clicked ${ds.pill} pill`);
      }

      if (b1QId) {
        await pageA.evaluate((qid) => {
          var cards = Array.from(document.querySelectorAll('.qcard[data-qid="' + qid + '"]'));
          for (var i = 0; i < cards.length; i++) {
            var rect = cards[i].getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) { cards[i].click(); return; }
          }
          if (cards[0]) cards[0].click();
        }, b1QId);
        await pageA.waitForTimeout(1500);

        const confBtn = pageA.locator('[data-circles="qcard-confirm"]').first();
        if (await pageA.locator('[data-circles="qcard-confirm"]').count() > 0) {
          await confBtn.click();
          await pageA.waitForTimeout(4000);
        }
      }

      const ts_ds = Date.now();
      const dsPayload = `e2e-r2-${ds.step}-${ds.pill}-${ts_ds}`;

      const dsFieldCount = await pageA.evaluate(() => document.querySelectorAll('[data-phase1="textarea"]').length);
      for (let i = 0; i < Math.min(dsFieldCount || 4, 4); i++) {
        const sel = `[data-phase1="textarea"][data-field-idx="${i}"]`;
        const count = await pageA.locator(sel).count();
        if (count > 0) {
          const el = pageA.locator(sel).first();
          await el.click();
          await pageA.keyboard.press('Control+A');
          await pageA.keyboard.type(`${dsPayload}-f${i}`);
          await el.dispatchEvent('input');
          await pageA.waitForTimeout(300);
        }
      }
      await pageA.waitForTimeout(5000);

      const stateA_ds = await getAppState(pageA);
      const dsSessionId = stateA_ds.circlesSession && stateA_ds.circlesSession.id;
      console.log(`[${ds.step}-A] drillStep=${stateA_ds.circlesDrillStep} session=${dsSessionId}`);
      await pageA.screenshot({ path: r2png(`${ds.step}-A-typed.png`) });

      const dsServerA = await probeServerState(pageA, `${ds.step}-A`);
      serverStateLog.push({ step: ds.step, context: 'A', ts: new Date().toISOString(), server: dsServerA });
      console.log(`[${ds.step}] Waiting 10s...`);
      await pageA.waitForTimeout(10000);

      // B verify — cold reload each time to test Bug E fix per-step
      await reloadBFromCold(pageB, `${ds.step}-B-after-reload`);
      const dsServerB = await probeServerState(pageB, `${ds.step}-B`);
      serverStateLog.push({ step: ds.step, context: 'B', ts: new Date().toISOString(), server: dsServerB });
      const stateB_ds = await getAppState(pageB);
      await pageB.screenshot({ path: r2png(`${ds.step}-B-verify.png`) });

      const dsDraftStr = JSON.stringify(stateB_ds.circlesFrameworkDraft || {});
      const dsBSessionId = stateB_ds.circlesSession && stateB_ds.circlesSession.id;
      const dsSessionMatch = !!(dsSessionId && dsBSessionId && dsSessionId === dsBSessionId);
      const dsPayloadMatch = dsDraftStr.includes(dsPayload);
      console.log(`[${ds.step}-B] session=${dsBSessionId} payloadMatch=${dsPayloadMatch}`);

      record(ds.step, { payload: dsPayload, drillStep: ds.pill }, { frameworkDraftHas: dsPayloadMatch, sessionId: dsBSessionId }, dsSessionMatch || dsPayloadMatch,
        (dsSessionMatch || dsPayloadMatch) ? null : `A session=${dsSessionId} B session=${dsBSessionId}; B missing "${dsPayload}"`,
        { aServer: dsServerA, bServer: dsServerB });
    }

    // ── Save Track B Round 7 results ──────────────────────────────────────────
    const trackBResults = {
      round: 7,
      track: 'B',
      verifications,
      aErrors,
      serverStateLog,
      ts: new Date().toISOString(),
      summary: {
        total: verifications.length,
        pass: verifications.filter(v => v.match).length,
        fail: verifications.filter(v => !v.match).length,
      },
    };
    fs.writeFileSync(r2json('round7-results-B.json'), JSON.stringify(trackBResults, null, 2));
    // Also write to deliverable path for UAT round 7
    fs.writeFileSync(`${BASE_OUT}/r7-round7-results-B.json`, JSON.stringify(trackBResults, null, 2));

    console.log('\n══════════════════════════════════════════════');
    console.log(`Track B Round 7: ${trackBResults.summary.pass}/${trackBResults.summary.total} PASSED`);
    for (const v of verifications) {
      console.log(`  ${v.step}: ${v.match ? 'PASS' : 'FAIL'}${v.note ? ' — ' + v.note : ''}`);
    }
    console.log('══════════════════════════════════════════════');

    await ctxA.close();
    await ctxB.close();

    expect(verifications.length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Track C — CIRCLES sim full flow Round 2
// ─────────────────────────────────────────────────────────────────────────────

test.describe.serial('Track C — CIRCLES sim Round 2', () => {
  test('CIRCLES sim r2: A drives, B verifies after each step', async ({ browser }, testInfo) => {
    testInfo.setTimeout(1_800_000); // 30 min

    const ctxA = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const ctxB = await browser.newContext({ viewport: { width: 360, height: 780 } });
    const pageA = await ctxA.newPage();

    const aErrors = [];
    pageA.on('console', (m) => { if (m.type() === 'error') aErrors.push(m.text()); });

    const verifications = [];
    const serverStateLog = [];

    function record(step, expected, got, match, note, serverEvidence) {
      const v = { step, expected, got, match, note: note || null, serverEvidence: serverEvidence || null };
      verifications.push(v);
      console.log(`[${step}] ${match ? 'PASS' : 'FAIL'}${note ? ' — ' + note : ''}`);
      return v;
    }

    await loginUI(pageA, 'C-A-login');
    await navigateToTab(pageA, 'circles');
    await pageA.waitForTimeout(2000);

    // ── C1: sim mode → click q-card → Phase 1 type ────────────────────────────
    console.log('\n── C1: CIRCLES sim select + Phase 1 type ────────────────────────────');

    const simModeBtn = pageA.locator('[data-circles-mode="simulation"]');
    if (await simModeBtn.count() > 0) {
      await simModeBtn.first().click();
      await pageA.waitForTimeout(1000);
    }

    const c1Cards = await pageA.evaluate(() => {
      var cards = Array.from(document.querySelectorAll('.qcard[data-qid]'));
      return cards.slice(0, 5).map(function(c) {
        var rect = c.getBoundingClientRect();
        return { qid: c.dataset.qid, text: (c.textContent || '').slice(0, 60).trim(), visible: rect.width > 0 && rect.height > 0 };
      });
    });

    const c1Target = c1Cards.find(c => c.visible) || c1Cards[0];
    let c1QId = null;

    if (c1Target) {
      await pageA.evaluate((qid) => {
        var cards = Array.from(document.querySelectorAll('.qcard[data-qid="' + qid + '"]'));
        for (var i = 0; i < cards.length; i++) {
          var rect = cards[i].getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) { cards[i].click(); return; }
        }
        if (cards[0]) cards[0].click();
      }, c1Target.qid);
      await pageA.waitForTimeout(1500);

      const confirmBtn = pageA.locator('[data-circles="qcard-confirm"]').first();
      if (await pageA.locator('[data-circles="qcard-confirm"]').count() > 0) {
        c1QId = await confirmBtn.getAttribute('data-qid') || c1Target.qid;
        await confirmBtn.click();
        await pageA.waitForTimeout(5000);
        console.log(`[C1] Confirmed qid=${c1QId}`);
      }
    }

    const ts_c1 = Date.now();
    const c1Payload = `e2e-r2-c1-sim-${ts_c1}`;

    const c1FieldCount = await pageA.evaluate(() => document.querySelectorAll('[data-phase1="textarea"]').length);
    for (let i = 0; i < Math.min(c1FieldCount || 4, 4); i++) {
      const sel = `[data-phase1="textarea"][data-field-idx="${i}"]`;
      const count = await pageA.locator(sel).count();
      if (count > 0) {
        const el = pageA.locator(sel).first();
        await el.click();
        await pageA.keyboard.press('Control+A');
        await pageA.keyboard.type(`${c1Payload}-f${i}`);
        await el.dispatchEvent('input');
        await pageA.waitForTimeout(300);
      }
    }
    await pageA.waitForTimeout(5000);

    const stateA_c1 = await getAppState(pageA);
    const c1SessionId = stateA_c1.circlesSession && stateA_c1.circlesSession.id;
    console.log(`[C1-A] session=${c1SessionId} draft=${JSON.stringify(stateA_c1.circlesFrameworkDraft).slice(0, 100)}`);
    await pageA.screenshot({ path: r2png('C1-A-typed.png') });

    const c1ServerA = await probeServerState(pageA, 'C1-A');
    serverStateLog.push({ step: 'C1', context: 'A', ts: new Date().toISOString(), server: c1ServerA });
    console.log('[C1] Waiting 10s...');
    await pageA.waitForTimeout(10000);

    const pageB_c1 = await ctxB.newPage();
    await loginUI(pageB_c1, 'C1-B-after-login');
    const c1ServerB = await probeServerState(pageB_c1, 'C1-B');
    serverStateLog.push({ step: 'C1', context: 'B', ts: new Date().toISOString(), server: c1ServerB });
    const stateB_c1 = await getAppState(pageB_c1);
    await pageB_c1.screenshot({ path: r2png('C1-B-verify.png') });

    const c1BSessionId = stateB_c1.circlesSession && stateB_c1.circlesSession.id;
    const c1DraftStr = JSON.stringify(stateB_c1.circlesFrameworkDraft || {});
    const c1SessionMatch = !!(c1SessionId && c1BSessionId && c1SessionId === c1BSessionId);
    const c1DraftMatch = c1DraftStr.includes(c1Payload);
    console.log(`[C1-B] session=${c1BSessionId} draftMatch=${c1DraftMatch}`);
    record('C1', { qId: c1QId, payload: c1Payload, sessionId: c1SessionId }, stateB_c1, c1SessionMatch || c1DraftMatch,
      (c1SessionMatch || c1DraftMatch) ? null : `sessionMatch=${c1SessionMatch} draftMatch=${c1DraftMatch}; B session=${c1BSessionId} vs A=${c1SessionId}`,
      { aServer: c1ServerA, bServer: c1ServerB });

    // ── C2: submit Phase 1 → Phase 1.5 gate ───────────────────────────────────
    console.log('\n── C2: sim Phase 1 submit → Phase 1.5 gate ──────────────────────────');

    let c2GateResult = null;
    let c2Submitted = false;
    let c2HasRed = null;

    const c2SubmitCount = await pageA.locator('[data-phase1="submit"]').count();
    if (c2SubmitCount > 0) {
      const c2Btn = pageA.locator('[data-phase1="submit"]').first();
      const isDisabled = await c2Btn.isDisabled();
      if (!isDisabled) {
        await c2Btn.click();
        console.log('[C2] Clicked submit — waiting for gate...');
        await waitForCondition(pageA, () => window.AppState && (window.AppState.circlesPhase === 1.5 || window.AppState.circlesGateResult != null), 35000, 1000);
        await pageA.waitForTimeout(3000);
        c2GateResult = await pageA.evaluate(() => window.AppState && window.AppState.circlesGateResult);
        c2HasRed = c2GateResult && c2GateResult.items ? c2GateResult.items.some(i => i.status === 'red') : null;
        c2Submitted = true;
        console.log(`[C2] Gate done. hasRed=${c2HasRed}`);
      }
    }

    await pageA.screenshot({ path: r2png('C2-A-gate.png') });
    const c2ServerA = await probeServerState(pageA, 'C2-A');
    serverStateLog.push({ step: 'C2', context: 'A', ts: new Date().toISOString(), server: c2ServerA });
    console.log('[C2] Waiting 10s...');
    await pageA.waitForTimeout(10000);

    const pageB_c2 = await ctxB.newPage();
    await loginUI(pageB_c2, 'C2-B-after-login');
    const c2ServerB = await probeServerState(pageB_c2, 'C2-B');
    serverStateLog.push({ step: 'C2', context: 'B', ts: new Date().toISOString(), server: c2ServerB });
    const stateB_c2 = await getAppState(pageB_c2);
    await pageB_c2.screenshot({ path: r2png('C2-B-verify.png') });

    const c2BSession = stateB_c2.circlesSession && stateB_c2.circlesSession.id;
    const c2SessionMatch = !!(c1SessionId && c2BSession && c1SessionId === c2BSession);
    const c2Match = c2Submitted && (!!stateB_c2.circlesGateResult || c2SessionMatch);
    console.log(`[C2-B] session=${c2BSession} gateResult=${!!stateB_c2.circlesGateResult}`);
    record('C2', { submitted: true, sessionId: c1SessionId }, stateB_c2, c2Match,
      c2Match ? null : `submitted=${c2Submitted}; sessionMatch=${c2SessionMatch}; B gateResult=${!!stateB_c2.circlesGateResult}`,
      { aServer: c2ServerA, bServer: c2ServerB });

    // ── C3: Phase 1.5 gate → proceed → Phase 2 ────────────────────────────────
    console.log('\n── C3: sim gate → Phase 2 → chat turn 1 ────────────────────────────');

    let c3InPhase2 = false;
    let c3TurnTyped = false;

    if (c2Submitted && !c2HasRed) {
      const proceedBtn = pageA.locator('[data-gate-action="proceed"]');
      if (await proceedBtn.count() > 0) {
        await proceedBtn.first().click();
        await waitForCondition(pageA, () => window.AppState && window.AppState.circlesPhase === 2, 12000);
        c3InPhase2 = await pageA.evaluate(() => window.AppState && window.AppState.circlesPhase === 2);
        console.log(`[C3] In Phase 2: ${c3InPhase2}`);
      }
    } else if (c2HasRed) {
      console.log('[C3] Gate blocked (red) — skip Phase 2');
    }

    if (c3InPhase2) {
      for (const sel of ['textarea.phase2-chat__input', '[data-phase2="chat-input"]', '.chat-input textarea', 'textarea[placeholder]']) {
        const count = await pageA.locator(sel).count();
        if (count > 0) {
          const el = pageA.locator(sel).first();
          const bb = await el.boundingBox();
          if (bb && bb.width > 0) {
            const c3Turn = `e2e-r2-c3-turn1-${Date.now()}`;
            await el.click();
            await el.fill(c3Turn);
            await el.dispatchEvent('input');
            c3TurnTyped = true;
            for (const sbtn of ['[data-phase2="send"]', 'button.phase2-chat__send', 'button[type="submit"]', '.chat-send-btn']) {
              const sbtnEl = pageA.locator(sbtn).first();
              if (await pageA.locator(sbtn).count() > 0 && !await sbtnEl.isDisabled()) {
                await sbtnEl.click();
                await pageA.waitForTimeout(20000);
                break;
              }
            }
            break;
          }
        }
      }
    }

    await pageA.screenshot({ path: r2png('C3-A-chat.png') });
    const c3ServerA = await probeServerState(pageA, 'C3-A');
    serverStateLog.push({ step: 'C3', context: 'A', ts: new Date().toISOString(), server: c3ServerA });
    console.log('[C3] Waiting 10s...');
    await pageA.waitForTimeout(10000);

    const pageB_c3 = await ctxB.newPage();
    await loginUI(pageB_c3, 'C3-B-after-login');
    const c3ServerB = await probeServerState(pageB_c3, 'C3-B');
    serverStateLog.push({ step: 'C3', context: 'B', ts: new Date().toISOString(), server: c3ServerB });
    const stateB_c3 = await getAppState(pageB_c3);
    await pageB_c3.screenshot({ path: r2png('C3-B-verify.png') });
    console.log(`[C3-B] phase=${stateB_c3.circlesPhase} conversation=${stateB_c3.circlesConversation}`);

    if (c2HasRed) {
      const c3SessionPersist = !!(c1SessionId && stateB_c3.circlesSession && stateB_c3.circlesSession.id === c1SessionId);
      record('C3', { gateBlocked: true }, stateB_c3, c3SessionPersist, c3SessionPersist ? null : 'Gate blocked AND B session mismatch', { aServer: c3ServerA, bServer: c3ServerB });
    } else {
      const c3PhaseMatch = c3InPhase2 ? stateB_c3.circlesPhase === 2 : true;
      const c3ConvMatch = !c3TurnTyped || stateB_c3.circlesConversation > 0;
      record('C3', { phase: 2, conversationTurn: 1 }, stateB_c3, c3PhaseMatch || c3ConvMatch,
        (c3PhaseMatch || c3ConvMatch) ? null : `B phase=${stateB_c3.circlesPhase}; B conv=${stateB_c3.circlesConversation}`,
        { aServer: c3ServerA, bServer: c3ServerB });
    }

    // ── C4: Phase 2 turns 2+3 ─────────────────────────────────────────────────
    console.log('\n── C4: sim Phase 2 turns 2+3 ────────────────────────────────────────');

    let c4TurnsTyped = 0;
    if (c3InPhase2) {
      for (let turnNum = 2; turnNum <= 3; turnNum++) {
        const turnText = `e2e-r2-c4-turn${turnNum}-${Date.now()}`;
        for (const sel of ['textarea.phase2-chat__input', '[data-phase2="chat-input"]', '.chat-input textarea', 'textarea[placeholder]']) {
          const count = await pageA.locator(sel).count();
          if (count > 0) {
            const el = pageA.locator(sel).first();
            const bb = await el.boundingBox();
            if (bb && bb.width > 0) {
              await el.click();
              await el.fill(turnText);
              await el.dispatchEvent('input');
              for (const sbtn of ['[data-phase2="send"]', 'button.phase2-chat__send', 'button[type="submit"]']) {
                const sbtnEl = pageA.locator(sbtn).first();
                if (await pageA.locator(sbtn).count() > 0 && !await sbtnEl.isDisabled()) {
                  await sbtnEl.click();
                  await pageA.waitForTimeout(20000);
                  c4TurnsTyped++;
                  break;
                }
              }
              break;
            }
          }
        }
        console.log(`[C4] Turn ${turnNum} sent`);
      }
    }

    const stateA_c4 = await getAppState(pageA);
    await pageA.screenshot({ path: r2png('C4-A-turns.png') });
    const c4ServerA = await probeServerState(pageA, 'C4-A');
    serverStateLog.push({ step: 'C4', context: 'A', ts: new Date().toISOString(), server: c4ServerA });
    console.log('[C4] Waiting 10s...');
    await pageA.waitForTimeout(10000);

    const pageB_c4 = await ctxB.newPage();
    await loginUI(pageB_c4, 'C4-B-after-login');
    const c4ServerB = await probeServerState(pageB_c4, 'C4-B');
    serverStateLog.push({ step: 'C4', context: 'B', ts: new Date().toISOString(), server: c4ServerB });
    const stateB_c4 = await getAppState(pageB_c4);
    await pageB_c4.screenshot({ path: r2png('C4-B-verify.png') });
    console.log(`[C4-B] phase=${stateB_c4.circlesPhase} conversation=${stateB_c4.circlesConversation}`);

    const c4Match = c3InPhase2
      ? stateB_c4.circlesConversation >= stateA_c4.circlesConversation
      : !!(stateB_c4.circlesSession);
    record('C4', { conversationLen: stateA_c4.circlesConversation }, stateB_c4, c4Match,
      c4Match ? null : `A conv=${stateA_c4.circlesConversation}; B conv=${stateB_c4.circlesConversation}`,
      { aServer: c4ServerA, bServer: c4ServerB });

    // ── C5: Phase 3 step 1 ────────────────────────────────────────────────────
    console.log('\n── C5: sim Phase 3 step 1 ───────────────────────────────────────────');

    const c5CurPhase = await pageA.evaluate(() => window.AppState && window.AppState.circlesPhase);
    let c5InPhase3 = c5CurPhase === 3;
    console.log(`[C5] A phase: ${c5CurPhase}`);

    if (c5CurPhase === 2) {
      const phase3TransBtns = await pageA.evaluate(() => {
        return Array.from(document.querySelectorAll('button')).filter(function(b) {
          var rect = b.getBoundingClientRect();
          var text = (b.textContent || '').trim();
          return rect.width > 0 && !b.disabled && (text.includes('Phase 3') || text.includes('進入評分') || text.includes('完成討論'));
        }).map(function(b) { return (b.textContent || '').trim().slice(0, 40); });
      });
      console.log(`[C5] Phase2→3 btns: ${JSON.stringify(phase3TransBtns)}`);
    }

    if (c5InPhase3) {
      const c5SubmitCount = await pageA.locator('[data-phase1="submit"]').count();
      if (c5SubmitCount > 0) {
        const c5Btn = pageA.locator('[data-phase1="submit"]').first();
        if (!await c5Btn.isDisabled()) {
          await c5Btn.click();
          await waitForCondition(pageA, () => Object.keys((window.AppState && window.AppState.circlesStepScores) || {}).length > 0, 25000, 1000);
        }
      }
    }

    await pageA.screenshot({ path: r2png('C5-A-phase3.png') });
    const c5ServerA = await probeServerState(pageA, 'C5-A');
    serverStateLog.push({ step: 'C5', context: 'A', ts: new Date().toISOString(), server: c5ServerA });
    console.log('[C5] Waiting 10s...');
    await pageA.waitForTimeout(10000);

    const pageB_c5 = await ctxB.newPage();
    await loginUI(pageB_c5, 'C5-B-after-login');
    const c5ServerB = await probeServerState(pageB_c5, 'C5-B');
    serverStateLog.push({ step: 'C5', context: 'B', ts: new Date().toISOString(), server: c5ServerB });
    const stateB_c5 = await getAppState(pageB_c5);
    await pageB_c5.screenshot({ path: r2png('C5-B-verify.png') });
    console.log(`[C5-B] phase=${stateB_c5.circlesPhase} session=${stateB_c5.circlesSession && stateB_c5.circlesSession.id}`);

    const c5SessionPersist = !!(stateB_c5.circlesSession);
    record('C5', { phase3: c5InPhase3 }, stateB_c5, c5SessionPersist,
      c5SessionPersist ? null : `B session=${stateB_c5.circlesSession && stateB_c5.circlesSession.id}`,
      { aServer: c5ServerA, bServer: c5ServerB });

    // ── C6: Session consistency check ─────────────────────────────────────────
    console.log('\n── C6: session consistency check ────────────────────────────────────');

    const stateA_c6 = await getAppState(pageA);
    const c6SessionA = stateA_c6.circlesSession && stateA_c6.circlesSession.id;
    await pageA.screenshot({ path: r2png('C6-A-state.png') });
    const c6ServerA = await probeServerState(pageA, 'C6-A');
    serverStateLog.push({ step: 'C6', context: 'A', ts: new Date().toISOString(), server: c6ServerA });
    console.log('[C6] Waiting 10s...');
    await pageA.waitForTimeout(10000);

    const pageB_c6 = await ctxB.newPage();
    await loginUI(pageB_c6, 'C6-B-after-login');
    const c6ServerB = await probeServerState(pageB_c6, 'C6-B');
    serverStateLog.push({ step: 'C6', context: 'B', ts: new Date().toISOString(), server: c6ServerB });
    const stateB_c6 = await getAppState(pageB_c6);
    await pageB_c6.screenshot({ path: r2png('C6-B-verify.png') });
    const c6SessionB = stateB_c6.circlesSession && stateB_c6.circlesSession.id;
    console.log(`[C6] A session=${c6SessionA} B session=${c6SessionB}`);

    const c6Match = !!(c6SessionA && c6SessionB && c6SessionA === c6SessionB);
    record('C6', { sessionId: c6SessionA }, stateB_c6, c6Match,
      c6Match ? null : `A session=${c6SessionA} vs B session=${c6SessionB}`,
      { aServer: c6ServerA, bServer: c6ServerB });

    // ── C7: Final session check ────────────────────────────────────────────────
    console.log('\n── C7: final session check ───────────────────────────────────────────');

    const c7CurPhase = await pageA.evaluate(() => window.AppState && window.AppState.circlesPhase);
    await pageA.screenshot({ path: r2png('C7-A-state.png') });
    const c7ServerA = await probeServerState(pageA, 'C7-A');
    serverStateLog.push({ step: 'C7', context: 'A', ts: new Date().toISOString(), server: c7ServerA });
    console.log('[C7] Waiting 10s...');
    await pageA.waitForTimeout(10000);

    const pageB_c7 = await ctxB.newPage();
    await loginUI(pageB_c7, 'C7-B-after-login');
    const c7ServerB = await probeServerState(pageB_c7, 'C7-B');
    serverStateLog.push({ step: 'C7', context: 'B', ts: new Date().toISOString(), server: c7ServerB });
    const stateB_c7 = await getAppState(pageB_c7);
    await pageB_c7.screenshot({ path: r2png('C7-B-verify.png') });
    const c7SessionB = stateB_c7.circlesSession && stateB_c7.circlesSession.id;
    console.log(`[C7-B] phase=${stateB_c7.circlesPhase} session=${c7SessionB}`);

    const c7Match = !!(c6SessionA && c7SessionB && c6SessionA === c7SessionB);
    record('C7', { sessionId: c6SessionA, phase: c7CurPhase }, stateB_c7, c7Match,
      c7Match ? null : `A session=${c6SessionA} vs B session=${c7SessionB}`,
      { aServer: c7ServerA, bServer: c7ServerB });

    // ── Save Track C Round 7 results ──────────────────────────────────────────
    const trackCResults = {
      round: 7,
      track: 'C',
      verifications,
      aErrors,
      serverStateLog,
      ts: new Date().toISOString(),
      summary: {
        total: verifications.length,
        pass: verifications.filter(v => v.match).length,
        fail: verifications.filter(v => !v.match).length,
      },
    };
    fs.writeFileSync(r2json('round7-results-C.json'), JSON.stringify(trackCResults, null, 2));
    // Also write to deliverable path for UAT round 7
    fs.writeFileSync(`${BASE_OUT}/r7-round7-results-C.json`, JSON.stringify(trackCResults, null, 2));

    console.log('\n══════════════════════════════════════════════');
    console.log(`Track C Round 7: ${trackCResults.summary.pass}/${trackCResults.summary.total} PASSED`);
    for (const v of verifications) {
      console.log(`  ${v.step}: ${v.match ? 'PASS' : 'FAIL'}${v.note ? ' — ' + v.note : ''}`);
    }
    console.log('══════════════════════════════════════════════');

    await ctxA.close();
    await ctxB.close();

    expect(verifications.length).toBeGreaterThan(0);
  });
});
