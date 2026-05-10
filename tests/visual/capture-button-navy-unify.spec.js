const { test } = require('@playwright/test');
const path = require('path');

const mockups = [
  { name: 'mockup-03', file: 'docs/superpowers/specs/mockups/2026-05-02-frontend-rewrite/03-phase-1-form.html' },
  { name: 'mockup-07', file: 'docs/superpowers/specs/mockups/2026-05-02-frontend-rewrite/07-nsm-step-2.html' },
];
const viewports = [
  { name: 'mobile', width: 360, height: 1200 },
  { name: 'tablet', width: 768, height: 1200 },
  { name: 'desktop', width: 1280, height: 1200 },
];

for (const m of mockups) {
  for (const vp of viewports) {
    test(`${m.name}-${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('file://' + path.resolve(m.file));
      await page.waitForLoadState('networkidle');
      await page.screenshot({ path: `audit/png-button-navy-unify/${m.name}-${vp.name}.png`, fullPage: true });
    });
  }
}
