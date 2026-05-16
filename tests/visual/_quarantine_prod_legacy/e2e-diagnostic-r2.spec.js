/**
 * e2e-diagnostic-r2.spec.js
 *
 * Targeted diagnostic: does B (fresh context) actually receive A's sessions from server?
 * Uses window.apiFetch directly (bypasses token probe bug).
 * Answers: is this a server persistence issue or a client resume issue?
 */

const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const PROD_URL = 'https://first-principle.up.railway.app/';
const EMAIL = 'albertpeng678@gmail.com';
const PASSWORD = '21345678';

const OUT_DIR = path.join(__dirname, '../../audit/e2e-dual-context-prod');
fs.mkdirSync(OUT_DIR, { recursive: true });

function diag(name) { return `${OUT_DIR}/diag-${name}`; }

async function loginUI(page, label) {
  await page.goto(PROD_URL, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForSelector('.navbar', { timeout: 40000 });
  await page.waitForTimeout(2000);

  // Check if already authenticated from localStorage restore
  const alreadyAuthed = await page.evaluate(() => !!(window.AppState && window.AppState.accessToken));
  if (alreadyAuthed) {
    console.log('[loginUI] Already authenticated via restored session');
    await page.waitForTimeout(10000);
    if (label) await page.screenshot({ path: diag(`${label}.png`), fullPage: false });
    return;
  }

  // App shows guest mode home by default — need to click sign-in button
  const authCard = await page.locator('.auth-card').count();
  if (authCard === 0) {
    const signInBtn = page.locator('[data-nav="auth"]');
    if (await signInBtn.count() > 0) {
      await signInBtn.first().click();
      await page.waitForSelector('.auth-card', { timeout: 10000 });
    }
  }

  await page.locator('#auth-email').fill(EMAIL);
  await page.locator('#auth-pw').fill(PASSWORD);
  await page.locator('#auth-submit').click();
  await page.waitForSelector('.auth-card', { state: 'detached', timeout: 40000 });

  await page.waitForTimeout(15000); // let tryResumeLatestSession complete
  if (label) await page.screenshot({ path: diag(`${label}.png`), fullPage: false });
}

test('Diagnostic: B auth state + server fetch test', async ({ browser }) => {
  test.setTimeout(600000);

  const ctxA = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const ctxB = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const pageA = await ctxA.newPage();
  const pageB = await ctxB.newPage();

  // ── Step 1: Login A, create an NSM session ─────────────────────────────────
  console.log('\n── Step 1: Login A ───────────────────────────────────────────────────');
  await loginUI(pageA, 'diag-step1-A-login');

  // Navigate to NSM tab
  const nsm_nav = await pageA.locator('[data-nav="nsm"]').count();
  console.log(`[D1] nsm nav count: ${nsm_nav}`);
  if (nsm_nav > 0) {
    await pageA.locator('[data-nav="nsm"]').first().click();
    await pageA.waitForTimeout(2000);
  }

  // Click first visible NSM card
  const cards = await pageA.evaluate(() => {
    return Array.from(document.querySelectorAll('.nsm-q-card[data-qid]')).map(c => ({
      qid: c.dataset.qid,
      visible: c.getBoundingClientRect().width > 0 && window.getComputedStyle(c).display !== 'none',
    }));
  });
  const firstCard = cards.find(c => c.visible) || cards[0];
  console.log(`[D1] First card: ${JSON.stringify(firstCard)}`);

  if (firstCard) {
    await pageA.evaluate((qid) => {
      var cards = Array.from(document.querySelectorAll('.nsm-q-card[data-qid="' + qid + '"]'));
      for (var i = 0; i < cards.length; i++) {
        if (cards[i].getBoundingClientRect().width > 0) { cards[i].click(); return; }
      }
      if (cards[0]) cards[0].click();
    }, firstCard.qid);
    await pageA.waitForTimeout(2000);

    const startBtn = pageA.locator('[data-nsm="start"]').first();
    if (await pageA.locator('[data-nsm="start"]').count() > 0 && !await startBtn.isDisabled()) {
      await startBtn.click();
      await pageA.waitForTimeout(5000);
    }
  }

  // ── Step 2: Probe A's auth state and server sessions via apiFetch ─────────
  console.log('\n── Step 2: Probe A auth + server state ───────────────────────────────');
  const probeA = await pageA.evaluate(async () => {
    var s = window.AppState || {};
    var accessToken = s.accessToken;
    var guestId = s.guestId;
    var nsmSession = s.nsmSession;
    var nsmStep = s.nsmStep;
    var view = s.view;

    // Direct fetch using apiFetch
    var nsmResult = null;
    var circlesResult = null;
    var nsmError = null;
    var circlesError = null;

    try {
      var nsmResp = await window.apiFetch('/api/nsm-sessions');
      nsmResult = nsmResp.ok ? await nsmResp.json() : { error: nsmResp.status, statusText: nsmResp.statusText };
    } catch(e) {
      nsmError = e.message;
    }

    try {
      var circlesResp = await window.apiFetch('/api/circles-sessions');
      circlesResult = circlesResp.ok ? await circlesResp.json() : { error: circlesResp.status, statusText: circlesResp.statusText };
    } catch(e) {
      circlesError = e.message;
    }

    return {
      accessToken: accessToken ? 'SET (len=' + accessToken.length + ')' : 'NULL',
      guestId: guestId ? 'SET' : 'NULL',
      nsmStep: nsmStep,
      view: view,
      nsmSession: nsmSession ? nsmSession.id : null,
      nsmSessionsFromServer: nsmResult,
      circlesSessionsFromServer: circlesResult,
      nsmError: nsmError,
      circlesError: circlesError,
    };
  });

  console.log(`[D2-A] accessToken=${probeA.accessToken} guestId=${probeA.guestId}`);
  console.log(`[D2-A] view=${probeA.view} nsmStep=${probeA.nsmStep} nsmSession=${probeA.nsmSession}`);
  console.log(`[D2-A] nsmSessions from server: ${JSON.stringify(probeA.nsmSessionsFromServer || probeA.nsmError).slice(0, 300)}`);
  console.log(`[D2-A] circlesSessions from server: ${JSON.stringify(probeA.circlesSessionsFromServer || probeA.circlesError).slice(0, 300)}`);

  await pageA.screenshot({ path: diag('diag-step2-A-state.png') });
  fs.writeFileSync(diag('diag-probe-A.json'), JSON.stringify(probeA, null, 2));

  console.log('[D2] Waiting 15s for A session to persist on server...');
  await pageA.waitForTimeout(15000);

  // Re-probe A after wait
  const probeA2 = await pageA.evaluate(async () => {
    var nsmResp = await window.apiFetch('/api/nsm-sessions');
    var nsm = nsmResp.ok ? await nsmResp.json() : { error: nsmResp.status };
    return {
      nsmSessions: Array.isArray(nsm) ? nsm.filter(s => s.status === 'active').map(s => ({
        id: s.id, updated_at: s.updated_at, created_at: s.created_at
      })) : nsm,
    };
  });
  console.log(`[D2-A-re] Active NSM sessions: ${JSON.stringify(probeA2)}`);
  fs.writeFileSync(diag('diag-probe-A2.json'), JSON.stringify(probeA2, null, 2));

  // ── Step 3: Login B in fresh context ──────────────────────────────────────
  console.log('\n── Step 3: Login B (fresh context) ─────────────────────────────────');
  await loginUI(pageB, 'diag-step3-B-login');

  // ── Step 4: Probe B's auth state and server sessions ─────────────────────
  console.log('\n── Step 4: Probe B auth + server state ───────────────────────────────');
  const probeB = await pageB.evaluate(async () => {
    var s = window.AppState || {};
    var accessToken = s.accessToken;
    var guestId = s.guestId;
    var nsmSession = s.nsmSession;
    var nsmStep = s.nsmStep;
    var view = s.view;
    var circlesMode = s.circlesMode;
    var circlesSession = s.circlesSession;

    var nsmResult = null;
    var circlesResult = null;
    var nsmError = null;
    var circlesError = null;

    try {
      var nsmResp = await window.apiFetch('/api/nsm-sessions');
      nsmResult = nsmResp.ok ? await nsmResp.json() : { error: nsmResp.status, statusText: nsmResp.statusText };
    } catch(e) {
      nsmError = e.message;
    }

    try {
      var circlesResp = await window.apiFetch('/api/circles-sessions');
      circlesResult = circlesResp.ok ? await circlesResp.json() : { error: circlesResp.status, statusText: circlesResp.statusText };
    } catch(e) {
      circlesError = e.message;
    }

    // Also check what tryResumeLatestSession would see
    var canResume = AppState.view === 'circles' && !AppState.nsmSession && !AppState.circlesSession && AppState.nsmStep <= 1 && AppState.circlesPhase <= 1;
    // Manually trigger tryResumeLatestSession to test it
    var resumeResult = null;
    if (window._tryResumeLatestSession) {
      try {
        await window._tryResumeLatestSession();
        await new Promise(r => setTimeout(r, 5000));
        resumeResult = {
          view: AppState.view,
          nsmSession: AppState.nsmSession ? AppState.nsmSession.id : null,
          circlesSession: AppState.circlesSession ? AppState.circlesSession.id : null,
          nsmStep: AppState.nsmStep,
          circlesMode: AppState.circlesMode,
        };
      } catch(e) {
        resumeResult = { error: e.message };
      }
    }

    return {
      accessToken: accessToken ? 'SET (len=' + accessToken.length + ')' : 'NULL',
      guestId: guestId ? 'SET' : 'NULL',
      nsmStep: nsmStep,
      view: view,
      circlesMode: circlesMode,
      nsmSession: nsmSession ? nsmSession.id : null,
      circlesSession: circlesSession ? circlesSession.id : null,
      canResume: canResume,
      resumeResult: resumeResult,
      nsmSessionsFromServer: nsmResult,
      circlesSessionsFromServer: circlesResult,
      nsmError: nsmError,
      circlesError: circlesError,
    };
  });

  console.log(`[D4-B] accessToken=${probeB.accessToken} guestId=${probeB.guestId}`);
  console.log(`[D4-B] view=${probeB.view} nsmStep=${probeB.nsmStep} circlesMode=${probeB.circlesMode}`);
  console.log(`[D4-B] nsmSession=${probeB.nsmSession} circlesSession=${probeB.circlesSession}`);
  console.log(`[D4-B] canResume=${probeB.canResume}`);
  console.log(`[D4-B] nsmSessions from server: ${JSON.stringify(probeB.nsmSessionsFromServer || probeB.nsmError).slice(0, 500)}`);
  console.log(`[D4-B] circlesSessions from server: ${JSON.stringify(probeB.circlesSessionsFromServer || probeB.circlesError).slice(0, 500)}`);
  console.log(`[D4-B] resumeResult: ${JSON.stringify(probeB.resumeResult)}`);

  await pageB.screenshot({ path: diag('diag-step4-B-state.png') });
  fs.writeFileSync(diag('diag-probe-B.json'), JSON.stringify(probeB, null, 2));

  // ── Step 5: Check if B's AppState changed after manual resume trigger ──────
  const finalStateB = await pageB.evaluate(() => {
    var s = window.AppState || {};
    return {
      view: s.view,
      nsmSession: s.nsmSession ? s.nsmSession.id : null,
      circlesSession: s.circlesSession ? s.circlesSession.id : null,
      nsmStep: s.nsmStep,
      circlesMode: s.circlesMode,
      circlesPhase: s.circlesPhase,
    };
  });
  console.log(`\n── Final B state: ${JSON.stringify(finalStateB)}`);
  await pageB.screenshot({ path: diag('diag-step5-B-final.png') });

  fs.writeFileSync(diag('diag-summary.json'), JSON.stringify({
    probeA: probeA,
    probeA2: probeA2,
    probeB: probeB,
    finalStateB: finalStateB,
    ts: new Date().toISOString(),
  }, null, 2));

  await ctxA.close();
  await ctxB.close();

  expect(true).toBe(true); // always pass, this is diagnostic only
});
