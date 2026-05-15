// tests/visual/repro-bug2-no-floor.spec.js
// 5× reproduction spec for Bug 2 — CIRCLES Phase 1 字數限制拿掉
// Verifies: all 4 C1 fields filled (any non-empty count) → 下一步 enabled
// Verifies: all 4 C1 fields empty → 下一步 disabled (sanity guard)
// Runs against production: https://first-principle.up.railway.app/
//
// Auth strategy: direct Supabase REST token (avoids headless SDK async init race).
// Same approach as repro-bug1-cross-device.spec.js.

const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, '../../audit/repro-bug2');
fs.mkdirSync(OUT_DIR, { recursive: true });

const PROD_URL  = 'https://first-principle.up.railway.app';
const SB_URL    = 'https://klvlizxmvzfpvfgswmfk.supabase.co';
const SB_ANON   = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtsdmxpenhtdnpmcHZmZ3N3bWZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2NjcyNDIsImV4cCI6MjA5MjI0MzI0Mn0.KOF72gPKbllpYq7t3ny21HBEScUlj2diSl47oNyhJTY';
const EMAIL     = 'albertpeng678@gmail.com';
const PASSWORD  = '21345678';

/** Get Supabase token via REST — reliable in headless mode */
async function getToken(page) {
  return page.evaluate(async ({ sbUrl, sbAnon, email, password }) => {
    const r = await fetch(`${sbUrl}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': sbAnon },
      body: JSON.stringify({ email, password }),
    });
    const data = await r.json();
    if (!r.ok || !data.access_token) throw new Error('Supabase auth failed: ' + JSON.stringify(data));
    return { accessToken: data.access_token, userEmail: data.user && data.user.email };
  }, { sbUrl: SB_URL, sbAnon: SB_ANON, email: EMAIL, password: PASSWORD });
}

async function login(page) {
  await page.goto(PROD_URL, { waitUntil: 'domcontentloaded' });
  // Wait for app to boot
  await page.waitForSelector('.qcard, .auth-card', { timeout: 30000 });

  // Obtain token via REST (bypasses UI login form)
  const { accessToken, userEmail } = await getToken(page);

  // Inject token into AppState and re-render
  await page.evaluate(({ tok, email }) => {
    window.AppState.accessToken = tok;
    window.AppState.userEmail = email;
    window.AppState.view = 'circles-home';
    window.AppState.circlesRecentSessions = null;
    window.render();
  }, { tok: accessToken, email: userEmail });

  // Wait for home view to render (qcard)
  await page.waitForSelector('.qcard', { timeout: 20000 });
  await page.waitForTimeout(1500);
}

async function setupPhase1C1Drill(page) {
  // Use AppState manipulation to land directly on Phase 1 C1 drill step
  // with an empty draft — no network calls needed
  await page.evaluate(() => {
    const q = (window.CIRCLES_QUESTIONS || [])[0];
    if (!q) throw new Error('CIRCLES_QUESTIONS empty — db not loaded');
    window.AppState.view = 'circles';
    window.AppState.circlesMode = 'drill';
    window.AppState.circlesDrillStep = 'C1';
    window.AppState.circlesPhase = 1;
    window.AppState.circlesSelectedQuestion = q;
    window.AppState.circlesSession = null;
    window.AppState.circlesFrameworkDraft = {
      C1: { '問題範圍': '', '時間範圍': '', '業務影響': '', '假設確認': '' }
    };
    window.AppState.circlesPhase1EmptyHint = false;
    window.render();
  });
  await page.waitForTimeout(1500);
  // Confirm phase1 submit bar is present
  await page.waitForSelector('[data-phase1="submit"]', { timeout: 8000 });
}

// ── 5 reproduction rounds (varying char counts per field) ─────────────────
const ROUNDS = [
  { round: 1, charCount: 1  },
  { round: 2, charCount: 5  },
  { round: 3, charCount: 10 },
  { round: 4, charCount: 49 },
  { round: 5, charCount: 50 },
];

test.describe.serial('Bug 2 — no min-length floor × 5 rounds', () => {

  test('5 rounds varying char counts; button always enabled when all fields filled', async ({ page }, testInfo) => {
    testInfo.setTimeout(240_000);
    const vp = testInfo.project.name;

    // ── Login & navigate ────────────────────────────────────────────────────
    await login(page);
    await setupPhase1C1Drill(page);

    // ── Sanity pre-check: all fields empty → button disabled ────────────────
    const emptyCheck = await page.evaluate(() => {
      const allBtns = Array.from(document.querySelectorAll('button'));
      const next = allBtns.find(b => b.textContent.trim() === '下一步');
      return {
        found: !!next,
        disabled: next ? next.disabled : null,
        draft: window.AppState.circlesFrameworkDraft && window.AppState.circlesFrameworkDraft.C1,
      };
    });
    fs.writeFileSync(
      path.join(OUT_DIR, `sanity-empty-${vp}.json`),
      JSON.stringify(emptyCheck, null, 2)
    );
    await page.screenshot({ path: path.join(OUT_DIR, `sanity-empty-${vp}.png`), fullPage: false });

    // Empty fields should have button disabled
    expect(emptyCheck.found, `[${vp}] sanity: 下一步 button not found in DOM`).toBeTruthy();
    expect(emptyCheck.disabled, `[${vp}] sanity: expected disabled=true when all fields empty`).toBeTruthy();

    // ── 5 reproduction rounds ───────────────────────────────────────────────
    const results = [];

    for (const { round, charCount } of ROUNDS) {
      // Fill all 4 C1 fields with exactly charCount chars each
      const text = 'A'.repeat(charCount); // ASCII to avoid char-boundary issues
      await page.evaluate(({ t }) => {
        window.AppState.circlesFrameworkDraft.C1 = {
          '問題範圍': t,
          '時間範圍': t,
          '業務影響': t,
          '假設確認': t,
        };
        window.render();
      }, { t: text });
      await page.waitForTimeout(800);

      // Read button state
      const state = await page.evaluate(() => {
        const allBtns = Array.from(document.querySelectorAll('button'));
        const next = allBtns.find(b => b.textContent.trim() === '下一步');
        const draft = window.AppState.circlesFrameworkDraft && window.AppState.circlesFrameworkDraft.C1;
        const fieldLengths = draft
          ? Object.entries(draft).map(([k, v]) => ({ field: k, len: (v || '').length }))
          : [];
        return {
          nextBtnFound: !!next,
          nextBtnDisabled: next ? next.disabled : null,
          fieldLengths,
        };
      });

      const pngPath = path.join(OUT_DIR, `round-${round}-${charCount}chars-${vp}.png`);
      await page.screenshot({ path: pngPath, fullPage: false });
      results.push({ round, charCount, ...state });

      console.log(`[${vp}] Round ${round} (${charCount} chars/field): disabled=${state.nextBtnDisabled}`);
    }

    // ── Sanity post-check: empty again → button disabled ────────────────────
    await page.evaluate(() => {
      window.AppState.circlesFrameworkDraft.C1 = {
        '問題範圍': '',
        '時間範圍': '',
        '業務影響': '',
        '假設確認': '',
      };
      window.render();
    });
    await page.waitForTimeout(600);

    const finalEmpty = await page.evaluate(() => {
      const allBtns = Array.from(document.querySelectorAll('button'));
      const next = allBtns.find(b => b.textContent.trim() === '下一步');
      return { found: !!next, disabled: next ? next.disabled : null };
    });
    await page.screenshot({ path: path.join(OUT_DIR, `sanity-final-empty-${vp}.png`), fullPage: false });

    // ── Persist results JSON ────────────────────────────────────────────────
    const report = { viewport: vp, rounds: results, finalEmpty };
    fs.writeFileSync(
      path.join(OUT_DIR, `results-${vp}.json`),
      JSON.stringify(report, null, 2)
    );

    // ── Assertions ──────────────────────────────────────────────────────────
    for (const r of results) {
      expect(
        r.nextBtnFound,
        `[${vp}] round ${r.round} (${r.charCount} chars): 下一步 button not found in DOM`
      ).toBeTruthy();
      expect(
        r.nextBtnDisabled,
        `[${vp}] round ${r.round} (${r.charCount} chars): expected button ENABLED (disabled=false), got disabled=${r.nextBtnDisabled}`
      ).toBeFalsy();
    }

    expect(
      finalEmpty.found,
      `[${vp}] final-empty: 下一步 button not found`
    ).toBeTruthy();
    expect(
      finalEmpty.disabled,
      `[${vp}] final-empty: expected button DISABLED when all fields empty, got disabled=${finalEmpty.disabled}`
    ).toBeTruthy();
  });
});
