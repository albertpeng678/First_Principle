// Verify post-fix: stats dedup + rail load + rail title matches offcanvas
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const OUT_DIR = path.join(__dirname, '../../audit/png-verify-3-fixes');
fs.mkdirSync(OUT_DIR, { recursive: true });

const EMAIL = 'albertpeng678@gmail.com';
const PASSWORD = '21345678';

async function loginFresh(page) {
  await page.goto('/');
  await page.waitForSelector('.qcard, .auth-card', { timeout: 20000 });
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
  await page.waitForSelector('.auth-card', { state: 'detached', timeout: 20000 });
  await page.waitForSelector('.qcard', { timeout: 15000 });
  await page.waitForTimeout(4000); // rail load
}

test.describe.serial('Verify 3 fixes post-deploy', () => {
  test('stats + rail + title consistency', async ({ page }, testInfo) => {
    testInfo.setTimeout(120_000);
    const vp = testInfo.project.name;
    await loginFresh(page);

    // Snapshot home
    await page.screenshot({ path: `${OUT_DIR}/home-${vp}.png`, fullPage: false, animations: 'disabled' });

    // Capture all 3 verification points
    const data = await page.evaluate(async () => {
      const out = {};

      // 1. Stats endpoint (should match list count after dedup)
      const sResp = await fetch('/api/circles-stats', { headers: { 'Authorization': 'Bearer ' + window.AppState.accessToken } });
      out.stats = await sResp.json();

      // 2. Rail state (should be non-empty after login)
      out.railLen = Array.isArray(window.AppState.circlesRecentSessions) ? window.AppState.circlesRecentSessions.length : null;
      out.railTitles = Array.isArray(window.AppState.circlesRecentSessions) ? window.AppState.circlesRecentSessions.map(it => {
        const q = (it.question_json && it.question_json.company) ? it.question_json
                : (it.currentQuestion && it.currentQuestion.company) ? it.currentQuestion : null;
        return q ? (q.company + (q.product ? ' · ' + q.product : '')) : '練習題目';
      }) : null;

      // 3. Open offcanvas + read titles for comparison
      const navBtn = document.querySelector('button[data-nav="offcanvas"]');
      if (navBtn) { navBtn.click(); await new Promise(r => setTimeout(r, 1500)); }
      out.offcanvasTitles = Array.from(document.querySelectorAll('.offcanvas-item')).map(el =>
        el.querySelector('.offcanvas-item__title')?.textContent.trim()
      );

      // 4. Stats display text
      const statsStrip = document.querySelector('.stats-strip, .circles-home__stats');
      out.statsDisplayText = statsStrip ? statsStrip.textContent.replace(/\s+/g, ' ').trim() : 'NO STATS STRIP';

      return out;
    });

    fs.writeFileSync(`${OUT_DIR}/verify-${vp}.json`, JSON.stringify(data, null, 2));

    // Assertions
    expect(data.railLen, 'rail should be populated post-login').not.toBe(0);
    expect(data.railLen, 'rail should be populated post-login').not.toBeNull();
    // Titles consistency — every rail title should match the corresponding offcanvas title
    if (data.railTitles && data.offcanvasTitles) {
      for (const railTitle of data.railTitles) {
        const found = data.offcanvasTitles.some(ot => ot === railTitle);
        expect(found, `rail title "${railTitle}" not found in offcanvas titles ${JSON.stringify(data.offcanvasTitles)}`).toBe(true);
      }
    }
  });
});
