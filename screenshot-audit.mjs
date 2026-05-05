import { chromium } from 'playwright';
import path from 'path';

const BASE = 'http://localhost:4000';
const OUT = '/tmp/audit-fix';

async function stubRoutes(page) {
  await page.route('**/api/circles-stats**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"completed":0,"active":0,"weeklyCompleted":0}' }));
  await page.route('**/api/circles-sessions**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/guest-circles-sessions**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/nsm-sessions**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/guest/nsm-sessions**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
}

const VIEWPORTS = [
  { label: 'mobile-360', width: 360, height: 800 },
  { label: 'tablet-768', width: 768, height: 1024 },
  { label: 'desktop-1280', width: 1280, height: 900 },
];

async function main() {
  const browser = await chromium.launch({ headless: true });

  // ── HOME screenshots ──
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await ctx.newPage();
    await stubRoutes(page);
    await page.goto(BASE);
    await page.waitForSelector('.qcard', { timeout: 10000 });
    const file = `${OUT}/home-${vp.label}.png`;
    await page.screenshot({ path: file, fullPage: false });
    const signInVisible = await page.locator('.navbar__icon-btn[data-nav="auth"]').isVisible();
    console.log(`HOME ${vp.label}: ${file} — sign-in visible: ${signInVisible}`);
    await ctx.close();
  }

  // ── DRILL C1 screenshots ──
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await ctx.newPage();
    await stubRoutes(page);
    await page.goto(BASE);
    await page.waitForSelector('.mode-card', { timeout: 10000 });
    await page.locator('.mode-card').nth(1).click();
    await page.locator('.drill-pill:visible').first().click();
    await page.locator('.qcard').first().click();
    await page.locator('.qcard__btn--primary').click();
    await page.waitForSelector('.phase-head', { timeout: 8000 });
    // Scroll to top to ensure phase-head is visible in screenshot
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);
    const file = `${OUT}/drill-${vp.label}.png`;
    await page.screenshot({ path: file, fullPage: false });
    const metaExtraVisible = await page.locator('.phase-head__meta-extra').first().isVisible();
    console.log(`DRILL ${vp.label}: ${file} — meta-extra visible: ${metaExtraVisible}`);
    await ctx.close();
  }

  await browser.close();
  console.log('Done — all 6 PNGs saved to /tmp/audit-fix/');
}

main().catch(e => { console.error(e); process.exit(1); });
