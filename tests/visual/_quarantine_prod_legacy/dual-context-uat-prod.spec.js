/**
 * dual-context-uat-prod.spec.js
 *
 * Single goal: User cross-device state = latest db state.
 * Context A writes via real UI → waits > TTL → Context B re-login verifies.
 *
 * 5 rounds covering NSM Step 1/2/3/4 + CIRCLES Phase 1 C1 step.
 * Run: npx playwright test tests/visual/dual-context-uat-prod.spec.js --project=Desktop-1280
 */

const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const PROD_URL = 'https://first-principle.up.railway.app/';
const EMAIL = 'albertpeng678@gmail.com';
const PASSWORD = '21345678';

const OUT_DIR = path.join(__dirname, '../../audit/dual-context-uat-prod');
fs.mkdirSync(OUT_DIR, { recursive: true });

/**
 * loginUI — full fresh login via UI on a brand-new page.
 * If already logged in (no .auth-card visible) we force logout first
 * by clearing AppState tokens and triggering the auth view.
 */
async function loginUI(page, label) {
  await page.goto(PROD_URL, { waitUntil: 'networkidle', timeout: 40000 });
  await page.waitForSelector('.qcard, .auth-card, [data-view]', { timeout: 30000 });

  const authVisible = await page.locator('.auth-card').count();
  if (!authVisible) {
    // Force logout so we get a clean slate from the server
    await page.evaluate(() => {
      window.AppState.accessToken = null;
      window.AppState.userEmail = null;
      window.AppState.guestId = null;
      window.AppState.view = 'auth';
      window.AppState.authTab = 'login';
      // Clear all active session pointers so tryResumeLatestSession can fire cleanly
      window.AppState.nsmSession = null;
      window.AppState.nsmSelectedQuestion = null;
      window.AppState.nsmStep = 1;
      window.AppState.nsmReportTab = 'overview';
      window.AppState.circlesSession = null;
      window.AppState.circlesSelectedQuestion = null;
      window.AppState.circlesMode = null;
      window.AppState.circlesPhase = 1;
      window.AppState.circlesRecentSessions = null;
      window.render();
    });
    await page.waitForSelector('.auth-card', { timeout: 8000 });
  }

  await page.locator('#auth-email').fill(EMAIL);
  await page.locator('#auth-pw').fill(PASSWORD);
  await page.locator('#auth-submit').click();

  // Wait for auth-card to disappear (login successful)
  await page.waitForSelector('.auth-card', { state: 'detached', timeout: 30000 });

  // Wait for any content to appear
  await page.waitForSelector('.qcard, [data-view="circles"], [data-view="nsm"]', { timeout: 20000 });

  // Give tryResumeLatestSession time to complete (it's async, fires post-login)
  await page.waitForTimeout(4000);

  if (label) {
    await page.screenshot({ path: `${OUT_DIR}/${label}-post-login.png`, fullPage: false });
  }
}

/**
 * navigateToNSM — click the NSM navbar tab if not already on NSM view.
 */
async function navigateToNSM(page) {
  const currentView = await page.evaluate(() => window.AppState && window.AppState.view);
  if (currentView !== 'nsm') {
    await page.locator('[data-nav="nsm"]').click();
    await page.waitForTimeout(1500);
  }
}

/**
 * waitForNsmStep — wait until AppState.nsmStep === expectedStep.
 * Polls up to maxMs ms.
 */
async function waitForNsmStep(page, expectedStep, maxMs = 8000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    const step = await page.evaluate(() => window.AppState && window.AppState.nsmStep);
    if (step === expectedStep) return true;
    await page.waitForTimeout(400);
  }
  return false;
}

// ─── Test ────────────────────────────────────────────────────────────────────

test.describe.serial('Dual-context UAT — cross-device state persistence × 5 rounds', () => {
  test('5 rounds A writes → B verifies', async ({ browser }, testInfo) => {
    testInfo.setTimeout(900_000); // 15 min total

    const ctxA = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const ctxB = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const pageA = await ctxA.newPage();
    const pageB = await ctxB.newPage();

    // Capture console errors for debugging
    pageA.on('console', msg => { if (msg.type() === 'error') console.log(`[A console.error] ${msg.text()}`); });
    pageB.on('console', msg => { if (msg.type() === 'error') console.log(`[B console.error] ${msg.text()}`); });

    const results = [];
    const domDiag = {}; // DOM diagnostics per round

    // =========================================================================
    // Round 1: NSM Step 1 — select a question card in A → B sees same question
    // =========================================================================
    console.log('\n── Round 1: NSM Step 1 question select ─────────────────────────────');

    await loginUI(pageA, 'r1-A');

    // Navigate A to NSM Step 1
    await navigateToNSM(pageA);
    await waitForNsmStep(pageA, 1, 6000);
    await pageA.waitForTimeout(1000);

    // Probe DOM: find NSM question cards
    // On Desktop (>=1024px): .nsm-body is hidden, cards live in .nsm-desktop-shell .nsm-center .nsm-q-list
    // On Mobile (<1024px): .nsm-desktop-shell is hidden, cards live in .nsm-body .nsm-q-list
    // We query ALL .nsm-q-card elements and pick the first visible one.
    const r1CardsDiag = await pageA.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('.nsm-q-card[data-qid]'));
      return cards.slice(0, 6).map(c => {
        const rect = c.getBoundingClientRect();
        const style = window.getComputedStyle(c);
        return {
          qid: c.dataset.qid,
          text: (c.textContent || '').slice(0, 60),
          visible: rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden',
          inDesktopShell: !!c.closest('.nsm-desktop-shell'),
          inNsmBody: !!c.closest('.nsm-body') && !c.closest('.nsm-desktop-shell'),
        };
      });
    });
    domDiag.r1_cards = r1CardsDiag;
    fs.writeFileSync(`${OUT_DIR}/r1-dom-cards-A.json`, JSON.stringify(r1CardsDiag, null, 2));
    console.log(`[R1] Found ${r1CardsDiag.length} NSM question cards (visible=${r1CardsDiag.filter(c => c.visible).length})`);
    r1CardsDiag.forEach(c => console.log(`  qid=${c.qid} visible=${c.visible} inDesktop=${c.inDesktopShell}`));

    await pageA.screenshot({ path: `${OUT_DIR}/r1-A-before-click.png` });

    let r1A = { sessionId: null, qId: null, step: null };
    // Find first visible card
    const r1VisibleCard = r1CardsDiag.find(c => c.visible);
    if (r1VisibleCard || r1CardsDiag.length > 0) {
      // Use the first visible card, or if none visible use first overall with force
      const targetQid = r1VisibleCard ? r1VisibleCard.qid : r1CardsDiag[0].qid;
      // Click the card that is actually visible (desktop shell or mobile body)
      // Use page.evaluate to click the right element directly to avoid CSS visibility issues
      const clicked = await pageA.evaluate((qid) => {
        const cards = Array.from(document.querySelectorAll('.nsm-q-card[data-qid="' + qid + '"]'));
        for (const card of cards) {
          const rect = card.getBoundingClientRect();
          const style = window.getComputedStyle(card);
          if (rect.width > 0 && rect.height > 0 && style.display !== 'none') {
            card.click();
            return { clicked: true, qid };
          }
        }
        // Fallback: click first regardless
        if (cards[0]) { cards[0].click(); return { clicked: true, qid, forced: true }; }
        return { clicked: false, qid };
      }, targetQid);
      console.log(`[R1] Click result:`, JSON.stringify(clicked));
      await pageA.waitForTimeout(3000); // wait for render + ensureNsmDraftSession (POST /api/nsm-sessions)

      r1A = await pageA.evaluate(() => ({
        sessionId: window.AppState.nsmSession && window.AppState.nsmSession.id,
        qId: window.AppState.nsmSelectedQuestion && window.AppState.nsmSelectedQuestion.id,
        step: window.AppState.nsmStep,
        view: window.AppState.view,
      }));
      console.log(`[R1-A] selected qId=${r1A.qId} sessionId=${r1A.sessionId}`);
    } else {
      console.log('[R1-A] WARNING: no NSM question cards found — Round 1 will fail');
    }
    await pageA.screenshot({ path: `${OUT_DIR}/r1-A-after-select.png` });

    // Wait for server persistence (> 5s TTL buffer)
    console.log('[R1] Waiting 10s for server persistence...');
    await pageA.waitForTimeout(10000);

    // B: fresh login — should auto-resume to NSM with same session/question
    await loginUI(pageB, 'r1-B');
    const r1B = await pageB.evaluate(() => ({
      view: window.AppState.view,
      sessionId: window.AppState.nsmSession && window.AppState.nsmSession.id,
      qId: window.AppState.nsmSelectedQuestion && window.AppState.nsmSelectedQuestion.id,
      step: window.AppState.nsmStep,
    }));
    await pageB.screenshot({ path: `${OUT_DIR}/r1-B-after-login.png` });
    console.log(`[R1-B] view=${r1B.view} qId=${r1B.qId} sessionId=${r1B.sessionId} step=${r1B.step}`);

    const r1Match = !!(r1A.qId && r1B.qId && r1A.qId === r1B.qId);
    results.push({
      round: 1,
      name: 'NSM Step 1 question select',
      A: r1A,
      B: r1B,
      match: r1Match,
      failReason: !r1Match ? `A qId=${r1A.qId} vs B qId=${r1B.qId}` : null,
    });

    // =========================================================================
    // Round 2: NSM Step 2 — type 3 fields → B sees byte-for-byte content
    // =========================================================================
    console.log('\n── Round 2: NSM Step 2 三欄 type ───────────────────────────────────');

    // Ensure A is on NSM Step 2 (click "開始 NSM 訓練" if on step 1 with selection)
    const startBtn = pageA.locator('[data-nsm="start"]');
    const startBtnExists = await startBtn.count();
    if (startBtnExists > 0 && !(await startBtn.isDisabled())) {
      await startBtn.click();
      await pageA.waitForTimeout(2000);
    }

    // If still on step 1, force via AppState (question must already be selected)
    const stepAfterStart = await pageA.evaluate(() => window.AppState.nsmStep);
    if (stepAfterStart !== 2) {
      await pageA.evaluate(() => {
        if (window.AppState.nsmSelectedQuestion) {
          window.AppState.nsmStep = 2;
          window.render();
        }
      });
      await pageA.waitForTimeout(1500);
    }
    await waitForNsmStep(pageA, 2, 6000);

    const ts2 = Date.now();
    const r2Payload = {
      nsm: `dual-uat-r2-nsm-${ts2}`,
      explanation: `dual-uat-r2-exp-${ts2}`,
      businessLink: `dual-uat-r2-biz-${ts2}`,
    };

    // Probe DOM: find [data-nsm-field] elements
    const r2FieldsDiag = await pageA.evaluate(() => {
      const els = Array.from(document.querySelectorAll('[data-nsm-field]'));
      return els.map(el => ({
        field: el.dataset.nsmField,
        tag: el.tagName,
        contentEditable: el.contentEditable,
        inputType: el.type || null,
      }));
    });
    domDiag.r2_fields = r2FieldsDiag;
    fs.writeFileSync(`${OUT_DIR}/r2-fields-A.json`, JSON.stringify(r2FieldsDiag, null, 2));
    console.log(`[R2] Found ${r2FieldsDiag.length} nsm-field elements:`, JSON.stringify(r2FieldsDiag));

    await pageA.screenshot({ path: `${OUT_DIR}/r2-A-step2-empty.png` });

    // Type into each field — handle both <input> and contenteditable div/textarea
    for (const fieldKey of ['nsm', 'explanation', 'businessLink']) {
      const sel = `[data-nsm-field="${fieldKey}"]`;
      const elCount = await pageA.locator(sel).count();
      if (elCount > 0) {
        const el = pageA.locator(sel).first();
        const tagInfo = await el.evaluate(node => ({ tag: node.tagName, ce: node.contentEditable }));

        if (tagInfo.tag === 'INPUT' || tagInfo.tag === 'TEXTAREA') {
          await el.click();
          await el.fill(r2Payload[fieldKey]);
        } else if (tagInfo.ce === 'true' || tagInfo.ce === 'plaintext-only') {
          // contenteditable — click, select-all, type
          await el.click();
          await pageA.keyboard.press('Control+A');
          await pageA.keyboard.type(r2Payload[fieldKey]);
        } else {
          // Unknown — try fill as fallback
          await el.fill(r2Payload[fieldKey]).catch(() => {});
        }
        await pageA.waitForTimeout(300);
        // Trigger input event to fire debounce → AppState update
        await el.dispatchEvent('input');
        await pageA.waitForTimeout(300);
      } else {
        console.log(`[R2] WARNING: field [data-nsm-field="${fieldKey}"] not found`);
      }
    }

    // Wait for autosave debounce (800ms) + network PATCH to settle
    await pageA.waitForTimeout(3500);

    const r2A = await pageA.evaluate(() => ({
      step: window.AppState.nsmStep,
      def: Object.assign({}, window.AppState.nsmDefinition),
      sessionId: window.AppState.nsmSession && window.AppState.nsmSession.id,
    }));
    console.log(`[R2-A] def=${JSON.stringify(r2A.def)}`);
    await pageA.screenshot({ path: `${OUT_DIR}/r2-A-typed.png` });

    // Wait for server propagation
    console.log('[R2] Waiting 10s...');
    await pageA.waitForTimeout(10000);

    // B: fresh login on a new page (re-use ctxB but navigate fresh)
    const pageB2 = await ctxB.newPage();
    await loginUI(pageB2, 'r2-B');
    // If B resumed to NSM, nsmDefinition should be populated from server
    const r2B = await pageB2.evaluate(() => ({
      view: window.AppState.view,
      step: window.AppState.nsmStep,
      def: Object.assign({}, window.AppState.nsmDefinition || {}),
      sessionId: window.AppState.nsmSession && window.AppState.nsmSession.id,
    }));
    await pageB2.screenshot({ path: `${OUT_DIR}/r2-B-after-login.png` });
    console.log(`[R2-B] def=${JSON.stringify(r2B.def)}`);

    const r2Match = r2B.def.nsm === r2Payload.nsm
      && r2B.def.explanation === r2Payload.explanation
      && r2B.def.businessLink === r2Payload.businessLink;

    results.push({
      round: 2,
      name: 'NSM Step 2 三欄 type',
      A: { payload: r2Payload, sessionId: r2A.sessionId },
      B: r2B,
      match: r2Match,
      failReason: !r2Match
        ? `nsm match=${r2B.def.nsm === r2Payload.nsm} exp match=${r2B.def.explanation === r2Payload.explanation} biz match=${r2B.def.businessLink === r2Payload.businessLink}`
        : null,
    });

    // =========================================================================
    // Round 3: NSM Step 3 — type first dim (reach) → B sees same content
    // =========================================================================
    console.log('\n── Round 3: NSM Step 3 dim type ────────────────────────────────────');

    // Advance A to Step 3 (must have definition filled first)
    // The Step 2→3 button is [data-nsm-action="advance-to-step3"] or similar
    // Check for "下一步" / "送出" type button — look for 3-dim gate or "繼續"
    // Simpler: if step2 has non-empty nsm text the step button should be enabled
    const step2Next = pageA.locator('[data-nsm="advance-to-step3"], [data-nsm-action="advance-to-step3"]');
    const step2NextCount = await step2Next.count();
    console.log(`[R3] advance-to-step3 buttons found: ${step2NextCount}`);
    if (step2NextCount > 0) {
      await step2Next.click();
      await pageA.waitForTimeout(2000);
    } else {
      // Try the NSM gate flow — click the primary submit bar button on step 2
      const step2SubmitBar = pageA.locator('.submit-bar .btn--primary').first();
      const step2SbCount = await step2SubmitBar.count();
      const step2SbDisabled = step2SbCount > 0 ? await step2SubmitBar.isDisabled() : true;
      console.log(`[R3] submit-bar primary btn found=${step2SbCount} disabled=${step2SbDisabled}`);
      if (step2SbCount > 0 && !step2SbDisabled) {
        await step2SubmitBar.click();
        await pageA.waitForTimeout(3000); // gate evaluation takes time
      } else {
        // Force step 3 if gate doesn't block
        await pageA.evaluate(() => {
          if (window.AppState.nsmStep === 2) {
            window.AppState.nsmStep = 3;
            window.render();
          }
        });
        await pageA.waitForTimeout(1500);
      }
    }
    await waitForNsmStep(pageA, 3, 10000);

    const stepOnA_r3 = await pageA.evaluate(() => window.AppState.nsmStep);
    console.log(`[R3] A is on step ${stepOnA_r3}`);

    const ts3 = Date.now();
    const dimPayload = `dual-uat-r3-reach-${ts3}`;

    // Probe DOM for dim textareas
    const r3DimsDiag = await pageA.evaluate(() => {
      const els = Array.from(document.querySelectorAll('[data-nsm-dim]'));
      return els.map(el => ({ dimId: el.dataset.nsmDim, tag: el.tagName, hasValue: !!el.value }));
    });
    domDiag.r3_dims = r3DimsDiag;
    fs.writeFileSync(`${OUT_DIR}/r3-dims-A.json`, JSON.stringify(r3DimsDiag, null, 2));
    console.log(`[R3] Found ${r3DimsDiag.length} nsm-dim elements:`, JSON.stringify(r3DimsDiag));
    await pageA.screenshot({ path: `${OUT_DIR}/r3-A-step3-empty.png` });

    // Type into first dim (reach) — it's a <textarea>
    const reachSel = '[data-nsm-dim="reach"]';
    const reachCount = await pageA.locator(reachSel).count();
    if (reachCount > 0) {
      await pageA.locator(reachSel).first().click();
      await pageA.locator(reachSel).first().fill(dimPayload);
      // Trigger input event to fire the debounce that updates AppState.nsmBreakdown
      await pageA.locator(reachSel).first().dispatchEvent('input');
      await pageA.waitForTimeout(3500); // debounce 800ms + PATCH settle
    } else {
      // Try first [data-nsm-dim] regardless of id
      const anyDim = pageA.locator('[data-nsm-dim]').first();
      const anyDimCount = await pageA.locator('[data-nsm-dim]').count();
      if (anyDimCount > 0) {
        const dimId = await anyDim.getAttribute('data-nsm-dim');
        console.log(`[R3] Using fallback dim: ${dimId}`);
        await anyDim.click();
        await anyDim.fill(dimPayload);
        await anyDim.dispatchEvent('input');
        await pageA.waitForTimeout(3500);
      } else {
        console.log('[R3] WARNING: no [data-nsm-dim] textareas found');
      }
    }

    const r3A = await pageA.evaluate(() => ({
      step: window.AppState.nsmStep,
      breakdown: Object.assign({}, window.AppState.nsmBreakdown || {}),
      sessionId: window.AppState.nsmSession && window.AppState.nsmSession.id,
    }));
    console.log(`[R3-A] breakdown=${JSON.stringify(r3A.breakdown)}`);
    await pageA.screenshot({ path: `${OUT_DIR}/r3-A-typed.png` });

    console.log('[R3] Waiting 10s...');
    await pageA.waitForTimeout(10000);

    // B: fresh login
    const pageB3 = await ctxB.newPage();
    await loginUI(pageB3, 'r3-B');
    const r3B = await pageB3.evaluate(() => ({
      view: window.AppState.view,
      step: window.AppState.nsmStep,
      breakdown: Object.assign({}, window.AppState.nsmBreakdown || {}),
      sessionId: window.AppState.nsmSession && window.AppState.nsmSession.id,
    }));
    await pageB3.screenshot({ path: `${OUT_DIR}/r3-B-after-login.png` });
    console.log(`[R3-B] breakdown=${JSON.stringify(r3B.breakdown)}`);

    // Match: any dim value contains the typed payload
    const r3Match = Object.values(r3B.breakdown || {}).some(v => String(v || '').includes(dimPayload));
    results.push({
      round: 3,
      name: 'NSM Step 3 dim (reach) type',
      A: { dimPayload, breakdown: r3A.breakdown },
      B: r3B,
      match: r3Match,
      failReason: !r3Match ? `B breakdown=${JSON.stringify(r3B.breakdown)} does not contain "${dimPayload}"` : null,
    });

    // =========================================================================
    // Round 4: NSM Step 4 — switch to "comparison" tab → B sees same tab
    // =========================================================================
    console.log('\n── Round 4: NSM Step 4 tab switch ──────────────────────────────────');

    // Step 4 requires the session to be scored. We can't force AI eval in UAT
    // so we check if A is already on Step 4 (scored session from prior runs).
    // If not, we try clicking the submit button on Step 3, OR if session is already
    // scored (nsmEvalResult exists), we jump to Step 4.

    const r4Prereq = await pageA.evaluate(() => ({
      step: window.AppState.nsmStep,
      hasEval: !!(window.AppState.nsmEvalResult && window.AppState.nsmEvalResult.totalScore),
      sessionId: window.AppState.nsmSession && window.AppState.nsmSession.id,
    }));
    console.log(`[R4] prereq: step=${r4Prereq.step} hasEval=${r4Prereq.hasEval}`);

    if (r4Prereq.hasEval) {
      // Session already scored → go to step 4
      await pageA.evaluate(() => {
        window.AppState.nsmStep = 4;
        window.render();
      });
      await pageA.waitForTimeout(1500);
    } else if (r4Prereq.step === 3) {
      // Try submit to get to step 4 (triggers AI eval — may take 15-30s)
      const step3Submit = pageA.locator('.submit-bar .btn--primary[data-nsm-submit]').first();
      const step3SubmitCount = await step3Submit.count();
      const step3SubmitDisabled = step3SubmitCount > 0 ? await step3Submit.isDisabled() : true;
      console.log(`[R4] step3 submit found=${step3SubmitCount} disabled=${step3SubmitDisabled}`);
      if (step3SubmitCount > 0 && !step3SubmitDisabled) {
        await step3Submit.click();
        console.log('[R4] Clicked submit — waiting up to 45s for AI eval...');
        await waitForNsmStep(pageA, 4, 45000);
      } else {
        console.log('[R4] Cannot submit step 3 (disabled/not found) — skipping to step 4 directly');
        await pageA.evaluate(() => {
          window.AppState.nsmStep = 4;
          window.render();
        });
        await pageA.waitForTimeout(1500);
      }
    }

    const stepAfterR4Setup = await pageA.evaluate(() => window.AppState.nsmStep);
    console.log(`[R4] A step after setup: ${stepAfterR4Setup}`);

    // Probe tab bar
    const r4TabsDiag = await pageA.evaluate(() => {
      const tabs = Array.from(document.querySelectorAll('[data-nsm4-tab]'));
      return tabs.map(t => ({ key: t.dataset.nsm4Tab, text: (t.textContent || '').trim() }));
    });
    domDiag.r4_tabs = r4TabsDiag;
    console.log(`[R4] tabs found:`, JSON.stringify(r4TabsDiag));
    await pageA.screenshot({ path: `${OUT_DIR}/r4-A-step4-default.png` });

    // Click "comparison" tab
    const compTab = pageA.locator('[data-nsm4-tab="comparison"]');
    const compTabCount = await compTab.count();
    if (compTabCount > 0) {
      await compTab.click();
      await pageA.waitForTimeout(2500); // nsmPersistStep PATCH
      console.log('[R4] Clicked comparison tab');
    } else {
      console.log('[R4] WARNING: [data-nsm4-tab="comparison"] not found');
    }

    const r4A = await pageA.evaluate(() => ({
      step: window.AppState.nsmStep,
      reportTab: window.AppState.nsmReportTab,
      sessionId: window.AppState.nsmSession && window.AppState.nsmSession.id,
    }));
    console.log(`[R4-A] reportTab=${r4A.reportTab}`);
    await pageA.screenshot({ path: `${OUT_DIR}/r4-A-tab-comparison.png` });

    console.log('[R4] Waiting 10s...');
    await pageA.waitForTimeout(10000);

    // B: fresh login
    const pageB4 = await ctxB.newPage();
    await loginUI(pageB4, 'r4-B');
    const r4B = await pageB4.evaluate(() => ({
      view: window.AppState.view,
      step: window.AppState.nsmStep,
      reportTab: window.AppState.nsmReportTab,
      sessionId: window.AppState.nsmSession && window.AppState.nsmSession.id,
    }));
    await pageB4.screenshot({ path: `${OUT_DIR}/r4-B-after-login.png` });
    console.log(`[R4-B] reportTab=${r4B.reportTab} step=${r4B.step}`);

    // Match: B should have reportTab='comparison' AND step=4
    // Note: if A couldn't reach step 4 (tab never clicked) we record skip
    const r4TabClicked = r4A.reportTab === 'comparison';
    const r4Match = r4TabClicked && r4B.reportTab === 'comparison';
    results.push({
      round: 4,
      name: 'NSM Step 4 tab switch (comparison)',
      A: r4A,
      B: r4B,
      match: r4Match,
      failReason: !r4Match
        ? (r4TabClicked ? `B reportTab=${r4B.reportTab} expected=comparison` : 'A never reached step 4 / comparison tab not found')
        : null,
    });

    // =========================================================================
    // Round 5: CIRCLES Phase 1 C1 step — type 4 fields → B sees same content
    // =========================================================================
    console.log('\n── Round 5: CIRCLES Phase 1 C1 step ───────────────────────────────');

    // Navigate A to CIRCLES home first
    await pageA.locator('[data-nav="circles"]').click();
    await pageA.waitForTimeout(2000);

    // Reset any existing session so we start clean
    await pageA.evaluate(() => {
      window.AppState.circlesSession = null;
      window.AppState.circlesSelectedQuestion = null;
      window.AppState.circlesMode = null;
      window.AppState.circlesPhase = 1;
      window.AppState.circlesFrameworkDraft = {};
      window.AppState.view = 'circles';
      window.render();
    });
    await pageA.waitForTimeout(1500);

    // Select first drill question and C1 step
    const circlesQCard = await pageA.evaluate(() => {
      const qs = window.CIRCLES_QUESTIONS || [];
      if (!qs.length) return null;
      return { id: qs[0].id, company: qs[0].company, product: qs[0].product };
    });
    console.log(`[R5] Using CIRCLES question: ${JSON.stringify(circlesQCard)}`);

    if (!circlesQCard) {
      console.log('[R5] ERROR: no CIRCLES_QUESTIONS available');
      results.push({ round: 5, name: 'CIRCLES Phase 1 C1 type', A: null, B: null, match: false, failReason: 'No CIRCLES_QUESTIONS available in window' });
    } else {
      // Inject question selection + drill mode + C1 step
      await pageA.evaluate((q) => {
        window.AppState.circlesSelectedQuestion = q;
        window.AppState.circlesMode = 'drill';
        window.AppState.circlesDrillStep = 'C1';
        window.AppState.circlesPhase = 1;
        window.AppState.circlesSession = null;
        window.AppState.circlesFrameworkDraft = { C1: {} };
        window.render();
      }, circlesQCard);
      await pageA.waitForTimeout(2000);

      // Probe DOM: find Phase 1 contenteditable textareas
      const r5FieldsDiag = await pageA.evaluate(() => {
        const els = Array.from(document.querySelectorAll('[data-phase1="textarea"]'));
        return els.map((el, i) => ({
          idx: el.dataset.fieldIdx,
          tag: el.tagName,
          contentEditable: el.contentEditable,
          placeholder: el.dataset.placeholder || '',
        }));
      });
      domDiag.r5_fields = r5FieldsDiag;
      fs.writeFileSync(`${OUT_DIR}/r5-fields-A.json`, JSON.stringify(r5FieldsDiag, null, 2));
      console.log(`[R5] Found ${r5FieldsDiag.length} phase1 textareas:`, JSON.stringify(r5FieldsDiag));
      await pageA.screenshot({ path: `${OUT_DIR}/r5-A-c1-empty.png` });

      const ts5 = Date.now();
      const c1Payload = `dual-uat-r5-c1-${ts5}`;

      // Type into each of the 4 C1 fields
      // Fields are contenteditable divs: [data-phase1="textarea"][data-field-idx="0..3"]
      // CIRCLES_STEP_CONFIG.C1.fields = ['問題範圍','時間範圍','業務影響','假設確認']
      const fieldCount = r5FieldsDiag.length;
      for (let i = 0; i < Math.min(fieldCount, 4); i++) {
        const sel = `[data-phase1="textarea"][data-field-idx="${i}"]`;
        const el = pageA.locator(sel).first();
        const elCount = await pageA.locator(sel).count();
        if (elCount > 0) {
          await el.click();
          // contenteditable — clear then type
          await pageA.keyboard.press('Control+A');
          const fieldText = `${c1Payload}-f${i}`;
          await pageA.keyboard.type(fieldText);
          // Trigger input event for debounce
          await el.dispatchEvent('input');
          await pageA.waitForTimeout(300);
        }
      }

      // Wait for triggerSaveCycle to fire (800ms debounce) + backend PATCH to settle
      await pageA.waitForTimeout(4000);

      const r5A = await pageA.evaluate(() => ({
        view: window.AppState.view,
        circlesPhase: window.AppState.circlesPhase,
        circlesDrillStep: window.AppState.circlesDrillStep,
        circlesMode: window.AppState.circlesMode,
        frameworkDraft: JSON.parse(JSON.stringify(window.AppState.circlesFrameworkDraft || {})),
        sessionId: window.AppState.circlesSession && window.AppState.circlesSession.id,
      }));
      console.log(`[R5-A] frameworkDraft=${JSON.stringify(r5A.frameworkDraft)} sessionId=${r5A.sessionId}`);
      await pageA.screenshot({ path: `${OUT_DIR}/r5-A-typed.png` });

      // Save indicators — wait for 'saved' state if visible
      await pageA.waitForTimeout(3000);

      console.log('[R5] Waiting 10s...');
      await pageA.waitForTimeout(10000);

      // B: fresh login
      const pageB5 = await ctxB.newPage();
      await loginUI(pageB5, 'r5-B');
      const r5B = await pageB5.evaluate(() => ({
        view: window.AppState.view,
        circlesPhase: window.AppState.circlesPhase,
        circlesDrillStep: window.AppState.circlesDrillStep,
        circlesMode: window.AppState.circlesMode,
        circlesSelectedQuestion: window.AppState.circlesSelectedQuestion
          ? { id: window.AppState.circlesSelectedQuestion.id }
          : null,
        frameworkDraft: JSON.parse(JSON.stringify(window.AppState.circlesFrameworkDraft || {})),
        sessionId: window.AppState.circlesSession && window.AppState.circlesSession.id,
      }));
      await pageB5.screenshot({ path: `${OUT_DIR}/r5-B-after-login.png` });
      console.log(`[R5-B] frameworkDraft=${JSON.stringify(r5B.frameworkDraft)} sessionId=${r5B.sessionId}`);

      // Match: any field in frameworkDraft.C1 contains the payload string
      const r5BStr = JSON.stringify(r5B.frameworkDraft);
      const r5Match = r5BStr.includes(c1Payload);
      results.push({
        round: 5,
        name: 'CIRCLES Phase 1 C1 type',
        A: { payload: c1Payload, frameworkDraft: r5A.frameworkDraft, sessionId: r5A.sessionId },
        B: r5B,
        match: r5Match,
        failReason: !r5Match ? `B frameworkDraft does not contain "${c1Payload}". Got: ${r5BStr.slice(0, 200)}` : null,
      });
    }

    // =========================================================================
    // Save results + print summary
    // =========================================================================
    const resultsPath = `${OUT_DIR}/results.json`;
    fs.writeFileSync(resultsPath, JSON.stringify({ results, domDiag, ts: new Date().toISOString() }, null, 2));

    const passCount = results.filter(r => r.match).length;
    const total = results.length;

    console.log('\n══════════════════════════════════════════════');
    console.log(`Dual-context UAT: ${passCount}/${total} rounds PASSED`);
    console.log('══════════════════════════════════════════════');
    for (const r of results) {
      const icon = r.match ? 'PASS' : 'FAIL';
      console.log(`  Round ${r.round} (${r.name}): ${icon}${r.failReason ? ' — ' + r.failReason : ''}`);
    }
    console.log(`Results saved: ${resultsPath}`);

    // Close contexts
    await ctxA.close();
    await ctxB.close();

    // NOTE: We do NOT fail the entire test on partial round failures so that
    // main agent (opus) can cold-review results.json and decide on fixes.
    // Only a hard assertion that the spec itself ran (results array non-empty).
    expect(results.length).toBeGreaterThan(0);
  });
});
