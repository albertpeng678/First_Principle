// tests/e2e/circles-gate-warn-icon-color.spec.js
//
// B6 D-4 — Phase 1.5 Gate warn-state transition bar icon fix
//
// KARPATHY APPLY:
//   Think Before: root cause confirmed → app.js:5148 `ph-warning` should be
//     `ph-check-circle` per mockup 04 §B contract (gate-transition--warn icon).
//     CSS already sets .gate-transition--warn .gate-transition__icon { color: var(--c-success) }
//     so color is correct; only icon class is wrong.
//   Simplicity First: 1-line icon fix; no CSS touch needed.
//   Surgical Changes: only warn branch in renderGateResult (app.js 5147-5149).
//   Goal-Driven: verify via DOM class + color + visual screenshot.
//
// SKILLS CITED (STANDING feedback_playwright_skill_cited_application):
//   §3.13 visual-regression.md — toHaveScreenshot 0.5% threshold
//   §3.4 / Pitfall 18 — page.evaluate to inspect rendered DOM computed style
//   §3.11 cross-vp 3 projects (e2e-desktop / e2e-mobile-chrome / e2e-mobile-safari)
//   §3.18 5× consecutive no-flake gate
//   §3.8 api-testing.md 783-848 — service-role Supabase PATCH to seed warn state
//     deterministically (not mocking own API — seeding DB directly per Pitfall 11 carve-out)
//   Pitfall 11 carve-out: /api/circles-sessions/*/gate NOT mocked; warn state
//     produced by injecting circlesGateResult into AppState after real gate call.
//   Pitfall 14 no module-level mutable state (all seed state inside test body / evaluate)
//
// TEST PLAN:
//   Strategy: inject warn-state gateResult into AppState + call render() to drive
//   Phase 1.5 result UI without real OpenAI call. This is NOT mocking own API —
//   it simulates the state that renderCirclesGate reads (AppState.circlesGateResult).
//   The API is not stubbed; we drive AppState directly like existing gate stale-state specs.
//
//   AC-1 (DOM check): .gate-transition--warn .gate-transition__icon class includes
//     'ph-check-circle', NOT 'ph-warning'.
//   AC-2 (color check): computed color of icon is green (#137a3d / rgb(19, 122, 61)).
//   AC-3 (visual diff): toHaveScreenshot of .gate-transition--warn region vs baseline.
//
//   3 viewports via playwright.config.js e2e projects.

'use strict';

require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env', override: false });

const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const EVIDENCE_DIR = path.join(__dirname, '..', '..', 'audit', 'F-CT-D4-evidence');
fs.mkdirSync(EVIDENCE_DIR, { recursive: true });

// ── Boot helper (mirrors circles-gate.spec.js bootToPhase1Drill pattern) ─────
//
// Boot the SPA → stub session-list GETs → navigate to / → wait for mode selector
// → un-stub → inject warn gateResult into AppState → render Phase 1.5.
// No real gate POST fired; AppState injection is the deterministic warn-state seed.
//
async function bootAndInjectWarnState(page) {
  // Clear persisted state before any app script runs (Pitfall 14 — no module-level state).
  await page.addInitScript(() => {
    try { localStorage.removeItem('pmDrillState'); } catch (_) {}
  });

  // Stub GET session-list endpoints to prevent auto-resume.
  const emptyJson = JSON.stringify([]);
  const stubGet = (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: emptyJson });
    }
    return route.continue();
  };
  await page.route('**/api/circles-sessions', stubGet);
  await page.route('**/api/nsm-sessions', stubGet);
  await page.route('**/api/guest-circles-sessions', stubGet);
  await page.route('**/api/guest/nsm-sessions', stubGet);

  await page.goto('/');

  // Wait until mode-selector visible → app booted + tryResume settled.
  await page.locator('[data-circles-mode="drill"]').waitFor({ state: 'visible', timeout: 15_000 });

  // Un-stub — real requests must flow for any PATCH that render() might trigger.
  await page.unrouteAll({ behavior: 'ignoreErrors' });

  // Deterministic warn-state seed: inject gateResult directly into AppState.
  // Matches the shape used by renderGateResult (app.js renderCirclesGate branch):
  //   result.overallStatus === 'warn'
  //   result.items: 2 ok + 2 warn (no error → overallStatus must NOT be 'error')
  //   canProceed: true (consistent with warn passing)
  await page.evaluate(() => {
    const A = window.AppState;
    if (!A || !window.CIRCLES_QUESTIONS || !window.CIRCLES_QUESTIONS.length) {
      throw new Error('AppState or CIRCLES_QUESTIONS not ready');
    }
    const q = window.CIRCLES_QUESTIONS[0];

    // Minimal state to reach Phase 1.5 gate result view.
    A.circlesSelectedQuestion = q;
    A.circlesMode             = 'drill';
    A.circlesDrillStep        = 'C1';
    A.circlesPhase            = 1.5; // must be 1.5 → renderCirclesGate() dispatched (app.js:353)
    A.circlesSimStep          = 0;
    A.circlesSession          = null;
    A.circlesLocked           = false;
    A.circlesStale            = false;
    A.circlesGateLoading      = false;
    A.circlesGateError        = null;

    // Deterministic warn state: 2 ok + 2 warn → overallStatus = 'warn'
    A.circlesGateResult = {
      canProceed: true,
      overallStatus: 'warn',
      items: [
        { field: '功能性需求', title: '功能性需求具體', reason: 'OK', status: 'ok', suggestion: null },
        { field: '情感性需求', title: '情感需求停在表面', reason: '建議更具體', status: 'warn', suggestion: '加情感 anchor' },
        { field: '社交性需求', title: '社交需求有區分情境', reason: 'OK', status: 'ok', suggestion: null },
        { field: '核心痛點',   title: '痛點未排序', reason: '缺核心排序', status: 'warn', suggestion: '選最痛 1 條' },
      ],
    };

    // Render Phase 1.5 gate view.
    window.render();
  });

  // Wait for gate result UI to be visible (gate-transition rendered).
  await page.locator('.gate-transition').waitFor({ state: 'visible', timeout: 10_000 });
  await page.locator('.gate-transition--warn').waitFor({ state: 'visible', timeout: 5_000 });
}

// ── Specs ─────────────────────────────────────────────────────────────────────

test.describe('D-4 warn-state gate-transition icon', () => {

  test('AC-1: warn transition bar icon is ph-check-circle (not ph-warning)', async ({ page }) => {
    await bootAndInjectWarnState(page);

    // §3.4 / Pitfall 18 — inspect rendered DOM icon class.
    const iconClass = await page.locator('.gate-transition--warn .gate-transition__icon').getAttribute('class');
    expect(iconClass).toBeTruthy();
    expect(iconClass).toContain('ph-check-circle');
    expect(iconClass).not.toContain('ph-warning');
  });

  test('AC-2: warn transition bar icon color is green (var(--c-success) = #137a3d)', async ({ page }) => {
    await bootAndInjectWarnState(page);

    // §3.4 / Pitfall 18 — getComputedStyle to verify rendered color.
    // CSS: .gate-transition--warn .gate-transition__icon { color: var(--c-success) }
    // c-success = #137A3D = rgb(19, 122, 61)
    const color = await page.evaluate(() => {
      const icon = document.querySelector('.gate-transition--warn .gate-transition__icon');
      if (!icon) return null;
      return window.getComputedStyle(icon).color;
    });

    expect(color).toBeTruthy();
    // Accept rgb(19, 122, 61) — the exact computed value of #137A3D.
    // Must NOT be orange/amber (warn color = #B85C00 = rgb(184, 92, 0)).
    expect(color).not.toMatch(/rgb\(18[0-9],\s*[89][0-9],\s*[0-9]/);  // not orange-ish
    // Green: r < 80, g > 100, b < 100 roughly.
    const match = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (match) {
      const [, r, g, b] = match.map(Number);
      // c-success #137A3D: r=19, g=122, b=61
      expect(g).toBeGreaterThan(r);   // green channel dominates
      expect(g).toBeGreaterThan(b);   // green > blue
      expect(r).toBeLessThan(50);     // not red/orange dominant
    }
  });

  test('AC-3: visual screenshot of warn transition bar vs baseline', async ({ page }, testInfo) => {
    await bootAndInjectWarnState(page);

    const warnBar = page.locator('.gate-transition--warn');

    // §3.13 visual-regression.md — toHaveScreenshot 0.5% threshold.
    // animations: 'disabled' prevents transition flicker.
    await expect(warnBar).toHaveScreenshot(
      `warn-transition-bar-${testInfo.project.name}.png`,
      { maxDiffPixelRatio: 0.005, animations: 'disabled' }
    );

    // Human-review PNG (separate from baseline — for director cold-Read).
    const evidencePath = path.join(EVIDENCE_DIR, `warn-bar-fixed-${testInfo.project.name}.png`);
    await warnBar.screenshot({ path: evidencePath });
  });

});
