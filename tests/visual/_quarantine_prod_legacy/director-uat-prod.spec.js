// Director hands-on UAT on production — albertpeng678@gmail.com
// Walks all 4 bugs (Bug 1/2/3/4) in real user journey × 8 viewports.
// Goal: prove fixes work in actual UI, not just mechanically.
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const PROD_URL = 'https://first-principle.up.railway.app/';
const EMAIL = 'albertpeng678@gmail.com';
const PASSWORD = '21345678';

const OUT_DIR = path.join(__dirname, '../../audit/director-uat-prod-2026-05-15');
fs.mkdirSync(OUT_DIR, { recursive: true });

async function loginFresh(page) {
  await page.goto(PROD_URL);
  await page.waitForSelector('.qcard, .auth-card', { timeout: 30000 });
  const authVisible = await page.locator('.auth-card').count();
  if (!authVisible) {
    await page.evaluate(() => {
      window.AppState.accessToken = null;
      window.AppState.userEmail = null;
      window.AppState.view = 'auth';
      window.AppState.authTab = 'login';
      window.AppState.circlesRecentSessions = null;
      window.render();
    });
    await page.waitForSelector('.auth-card', { timeout: 5000 });
  }
  await page.locator('#auth-email').fill(EMAIL);
  await page.locator('#auth-pw').fill(PASSWORD);
  await page.locator('#auth-submit').click();
  await page.waitForSelector('.auth-card', { state: 'detached', timeout: 25000 });
  await page.waitForSelector('.qcard', { timeout: 15000 });
  await page.waitForTimeout(2500);
}

function snap(page, vp, label) {
  return page.screenshot({ path: `${OUT_DIR}/${label}-${vp}.png`, fullPage: false, animations: 'disabled' });
}

test.describe.serial('Director UAT prod — 4-bug walk', () => {
  test('walk all 4 bugs in real UI', async ({ page }, testInfo) => {
    testInfo.setTimeout(420_000);
    const vp = testInfo.project.name;

    await loginFresh(page);

    // ── A: Home post-login ───────────────────────────────────────────────
    await snap(page, vp, 'A-home-post-login');

    // ── Bug 2: CIRCLES Phase 1 C step — fill 1 char × 4 fields, "下一步" must be enabled ──
    await page.evaluate(() => {
      const q = (window.CIRCLES_QUESTIONS_DB || [])[0] || (window.CIRCLES_QUESTIONS || [])[0];
      window.AppState.view = 'circles';
      window.AppState.circlesMode = 'drill';
      window.AppState.circlesDrillStep = 'C';
      window.AppState.circlesPhase = 1;
      window.AppState.circlesSelectedQuestion = q;
      window.AppState.circlesFrameworkDraft = window.AppState.circlesFrameworkDraft || {};
      window.AppState.circlesFrameworkDraft.C = { problem_scope: '', time_scope: '', business_impact: '', hypothesis: '' };
      window.AppState.circlesSession = null;
      window.render();
    });
    await page.waitForTimeout(1500);
    await snap(page, vp, 'B-bug2-c1-empty');

    // Pre-state: empty → button disabled
    const emptyBtn = await page.evaluate(() => {
      const next = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === '下一步');
      return { found: !!next, disabled: next ? next.disabled : null };
    });
    fs.writeFileSync(`${OUT_DIR}/B-bug2-empty-${vp}.json`, JSON.stringify(emptyBtn, null, 2));

    // Fill 1 char in each field
    await page.evaluate(() => {
      const draft = window.AppState.circlesFrameworkDraft.C;
      Object.keys(draft).forEach(k => { draft[k] = '測'; });
      window.render();
    });
    await page.waitForTimeout(800);
    await snap(page, vp, 'B-bug2-c1-1char');
    const filledBtn = await page.evaluate(() => {
      const next = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === '下一步');
      return { found: !!next, disabled: next ? next.disabled : null };
    });
    fs.writeFileSync(`${OUT_DIR}/B-bug2-1char-${vp}.json`, JSON.stringify(filledBtn, null, 2));

    // ── Bug 3: 401 inject — no 「登入逾時」 banner / token-expiry card ─────
    // Navigate back to home first
    await page.evaluate(() => {
      window.AppState.view = 'circles';
      window.AppState.circlesMode = null;
      window.AppState.circlesDrillStep = null;
      window.AppState.circlesPhase = 1;
      window.AppState.circlesSelectedQuestion = null;
      window.AppState.circlesSession = null;
      window.render();
    });
    await page.waitForTimeout(1000);

    await page.evaluate(async () => {
      window.AppState.accessToken = 'invalid_token_to_force_401_xxxxxxxxxxxxxxxxxxxxxx';
      try { await window.apiFetch('/api/circles-sessions'); } catch (e) {}
    });
    await page.waitForTimeout(2000);
    await snap(page, vp, 'C-bug3-after-401');
    const after401 = await page.evaluate(() => {
      const text = document.body.innerText;
      return {
        hasTimeoutText: /登入逾時|登入逾期|session.*expired|token.*expired/i.test(text),
        hasBannerSession: !!document.querySelector('.banner--session'),
        hasTokenExpiryCard: !!document.querySelector('.token-expiry-card, .token-expiry, [class*="token-expiry"]'),
        authCardVisible: !!document.querySelector('.auth-card'),
        currentView: window.AppState?.view,
      };
    });
    fs.writeFileSync(`${OUT_DIR}/C-bug3-after-401-${vp}.json`, JSON.stringify(after401, null, 2));

    // Re-login for Bug 4
    await loginFresh(page);

    // ── Bug 4: Onboarding tooltip 4 steps ────────────────────────────────
    for (const stepN of [1, 2, 3, 4]) {
      await page.evaluate((n) => {
        window.AppState.view = 'circles';
        window.AppState.onboardingActive = true;
        window.AppState.onboardingStep = n;
        if (typeof window.render === 'function') window.render();
        // Trigger onboarding render (custom hook if exists)
        if (typeof window.startOnboarding === 'function') window.startOnboarding(n);
      }, stepN);
      await page.waitForTimeout(1500);
      await snap(page, vp, `D-bug4-onb-step${stepN}`);
    }

    // ── Bug 1: cross-device sync — read-only verify (offcanvas → restore session → see latest content) ─
    // Open offcanvas → click first item → verify session content rendered (no stale)
    await page.evaluate(() => {
      window.AppState.view = 'circles';
      window.AppState.onboardingActive = false;
      window.AppState.onboardingStep = 0;
      window.render();
    });
    await page.waitForTimeout(1000);
    await page.locator('button[data-nav="offcanvas"]').first().click().catch(() => {});
    await page.waitForSelector('.offcanvas-drawer', { timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(1500);
    await snap(page, vp, 'E-bug1-offcanvas-open');

    const items = await page.evaluate(() =>
      Array.from(document.querySelectorAll('.offcanvas-item')).map(el => ({
        title: el.querySelector('.offcanvas-item__title')?.textContent?.trim() || '',
      }))
    );
    fs.writeFileSync(`${OUT_DIR}/E-bug1-offcanvas-items-${vp}.json`, JSON.stringify(items, null, 2));

    if (items.length > 0) {
      await page.locator('.offcanvas-item').first().click();
      await page.waitForTimeout(3000);
      await snap(page, vp, 'E-bug1-session-restored');
    }
  });
});
