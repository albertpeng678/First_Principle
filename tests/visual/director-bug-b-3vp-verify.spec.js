// Director cold-Read all-vp visual verify of Bug B fix landed in production
// (per RITUAL §6 + STANDING feedback_uiux_visual_only + Pitfall 11 carve-out for state seed)
//
// Skills applied:
//   §3.13 visual-regression.md — full-card capture for mockup 07 line 1355-1384 comparison
//   §3.11 mobile-and-responsive.md 49-71 — explicit 3 vp via test.use viewport
//   §3.4 / Pitfall 18 — page.evaluate to seed AppState for deterministic NSM Step 3 render
//   Pitfall 11 — service-role-like seed via direct AppState assignment, NOT mocking API
//   Pitfall 14 — test-local state, no module-level
//
// Captures NSM Step 3 dim cards × 3 vp into audit/ for Director cold-Read against mockup 07.

'use strict';

const { test, expect } = require('@playwright/test');
const path = require('path');

const PNG_DIR = path.join(__dirname, '..', '..', 'audit', 'Bug-B-director-verify');

const Q_ATTENTION = {
  id: 'q1',
  company: 'Netflix',
  product_context: '影音串流平台',
  problem_statement: '提升留存',
  nsm_type: 'attention',
  field_examples: { step3: { reach: '範例', depth: '範例', frequency: '範例', impact: '範例' } },
};

const VIEWPORTS = [
  { name: 'mobile-360', width: 360, height: 720 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'desktop-1280', width: 1280, height: 900 },
];

for (const vp of VIEWPORTS) {
  test(`Bug B production cross-vp verify — ${vp.name}`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });

    // Stub list endpoints to skip resume (Pitfall 11 carve-out for boot speed)
    const stub = (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    await page.route('**/api/circles-sessions', stub);
    await page.route('**/api/nsm-sessions', stub);
    await page.route('**/api/guest-circles-sessions', stub);
    await page.route('**/api/guest/nsm-sessions', stub);

    await page.goto('/');

    // Drive directly to NSM Step 3 with attention type (4 dims)
    await page.evaluate(({ q }) => {
      window.AppState.view = 'nsm';
      window.AppState.nsmStep = 3;
      window.AppState.nsmSubTab = 'nsm-step3';
      window.AppState.nsmSelectedQuestion = q;
      window.AppState.nsmDefinition = { nsm: 'X', explanation: 'Y', businessLink: 'Z' };
      window.AppState.nsmGateResult = { overall_status: 'ok' };
      window.render();
    }, { q: Q_ATTENTION });

    await page.waitForSelector('.nsm-dim');

    // Capture full NSM dim cards area
    await page.screenshot({
      path: path.join(PNG_DIR, `nsm-step3-dims-${vp.name}.png`),
      fullPage: false,
    });

    // Confirm DOM structural assertions per Bug B fix
    await expect(page.locator('.nsm-dim .field__label-row .field__hint-row').first()).toBeVisible();
    await expect(page.locator('.nsm-dim .nsm-dim__body .field__hint-row')).toHaveCount(0);

    // Also measure visual gap: spacing between label-row and desc
    const measurements = await page.evaluate(() => {
      const firstCard = document.querySelector('.nsm-dim');
      if (!firstCard) return null;
      const labelRow = firstCard.querySelector('.field__label-row');
      const desc = firstCard.querySelector('.nsm-dim__desc');
      const body = firstCard.querySelector('.nsm-dim__body');
      const cardRect = firstCard.getBoundingClientRect();
      const labelRect = labelRow ? labelRow.getBoundingClientRect() : null;
      const descRect = desc ? desc.getBoundingClientRect() : null;
      const bodyRect = body ? body.getBoundingClientRect() : null;
      const cardStyle = getComputedStyle(firstCard);
      const labelStyle = labelRow ? getComputedStyle(labelRow) : null;
      return {
        cardBorder: cardStyle.border,
        cardBg: cardStyle.backgroundColor,
        cardPadding: cardStyle.padding,
        cardHeight: cardRect.height,
        labelRowTop: labelRect && labelRect.top - cardRect.top,
        labelRowHeight: labelRect && labelRect.height,
        labelRowBg: labelStyle && labelStyle.backgroundColor,
        labelRowPadding: labelStyle && labelStyle.padding,
        descTop: descRect && descRect.top - cardRect.top,
        descHeight: descRect && descRect.height,
        bodyTop: bodyRect && bodyRect.top - cardRect.top,
        gapLabelToDesc: descRect && labelRect && (descRect.top - labelRect.bottom),
        gapDescToBody: bodyRect && descRect && (bodyRect.top - descRect.bottom),
      };
    });
    console.log(`\n[${vp.name}] dim card measurements:`, JSON.stringify(measurements, null, 2));
  });
}
