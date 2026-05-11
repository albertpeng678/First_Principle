// Suite D-H — exhaustive coverage of remaining surfaces.
// D: NSM Step 1 fresh visit (no submit)
// E: NSM Step 4 all 4 tabs (Zoom) — 總覽 / 對比 (covered earlier) / 亮點 / 完成
// F: CIRCLES Spotify restore — what user lands on
// G: CIRCLES Netflix draft restore
// H: Stats-card visual ditto (final consistency)
const { test } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const OUT_DIR = path.join(__dirname, '../../audit/png-uat-suite-D-H');
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
  await page.waitForSelector('.auth-card', { state: 'detached', timeout: 25000 });
  await page.waitForSelector('.qcard', { timeout: 15000 });
  await page.waitForTimeout(2500);
}

function snap(page, vp, label) {
  return page.screenshot({ path: `${OUT_DIR}/${label}-${vp}.png`, fullPage: false, animations: 'disabled' });
}

test.describe.serial('UAT Suite D-H — total acceptance', () => {
  test('walk all remaining surfaces', async ({ page }, testInfo) => {
    testInfo.setTimeout(300_000);
    const vp = testInfo.project.name;

    await loginFresh(page);

    // ─── Suite D: NSM Step 1 fresh visit (no submit) ────────────────────────
    // Click 北極星指標 tab (desktop) OR navigate via offcanvas (mobile)
    const navHasNsmTab = await page.locator('[data-nav="nsm"]').first().isVisible().catch(() => false);
    if (navHasNsmTab) {
      await page.locator('[data-nav="nsm"]').first().click();
    } else {
      // Mobile path — open offcanvas, click any NSM-mode link or use AppState direct nav
      await page.evaluate(() => {
        window.AppState.view = 'nsm';
        window.AppState.nsmStep = 1;
        window.AppState.nsmSession = null;
        window.AppState.nsmSelectedQuestion = null;
        window.render();
      });
    }
    await page.waitForTimeout(2500);
    await snap(page, vp, 'D-nsm-step1-fresh');

    const step1Data = await page.evaluate(() => {
      return {
        view: window.AppState.view,
        nsmStep: window.AppState.nsmStep,
        qCardCount: document.querySelectorAll('.qcard, .nsm-qcard, [data-nsm-qcard]').length,
        reshuffleBtnExists: !!document.querySelector('[data-nsm="reshuffle"], [data-circles="reshuffle"], .reshuffle'),
        firstQuestionTitle: document.querySelector('.qcard__title, .nsm-qcard__title')?.textContent?.trim(),
      };
    });
    fs.writeFileSync(`${OUT_DIR}/D-step1-data-${vp}.json`, JSON.stringify(step1Data, null, 2));

    // Reshuffle test
    if (step1Data.reshuffleBtnExists) {
      const beforeReshuffle = await page.evaluate(() =>
        Array.from(document.querySelectorAll('.qcard, .nsm-qcard')).map(c => c.querySelector('.qcard__title, .nsm-qcard__title')?.textContent?.trim() || '')
      );
      await page.locator('[data-nsm="reshuffle"], [data-circles="reshuffle"], .reshuffle').first().click().catch(() => {});
      await page.waitForTimeout(500);
      const afterReshuffle = await page.evaluate(() =>
        Array.from(document.querySelectorAll('.qcard, .nsm-qcard')).map(c => c.querySelector('.qcard__title, .nsm-qcard__title')?.textContent?.trim() || '')
      );
      await snap(page, vp, 'D-reshuffled');
      fs.writeFileSync(`${OUT_DIR}/D-reshuffle-${vp}.json`, JSON.stringify({ before: beforeReshuffle, after: afterReshuffle, changed: JSON.stringify(beforeReshuffle) !== JSON.stringify(afterReshuffle) }, null, 2));
    }

    // ─── Suite E: NSM Step 4 — Zoom restore + walk all 4 tabs ───────────────
    // Restore Zoom via offcanvas
    await page.locator('button[data-nav="offcanvas"]').first().click().catch(() => {});
    await page.waitForSelector('.offcanvas-drawer', { timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(1500);
    const items = await page.evaluate(() =>
      Array.from(document.querySelectorAll('.offcanvas-item')).map(el => ({
        title: el.querySelector('.offcanvas-item__title')?.textContent?.trim() || '',
        meta:  el.querySelector('.offcanvas-item__meta')?.textContent?.trim() || '',
      }))
    );
    const zoomIdx = items.findIndex(it => /Zoom/.test(it.title));
    if (zoomIdx !== -1) {
      await page.locator('.offcanvas-item').nth(zoomIdx).click();
      await page.waitForTimeout(2200);
      await snap(page, vp, 'E-nsm-step4-overview');

      for (const tab of ['comparison', 'highlights', 'complete']) {
        await page.evaluate((t) => { window.AppState.nsmReportTab = t; window.render(); }, tab);
        await page.waitForTimeout(700);
        await snap(page, vp, `E-nsm-step4-${tab}`);
      }
    }

    // ─── Suite F: CIRCLES restore Spotify ───────────────────────────────────
    await page.locator('button[data-nav="offcanvas"]').first().click().catch(() => {});
    await page.waitForSelector('.offcanvas-drawer', { timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(1500);
    const items2 = await page.evaluate(() =>
      Array.from(document.querySelectorAll('.offcanvas-item')).map(el => ({
        title: el.querySelector('.offcanvas-item__title')?.textContent?.trim() || '',
        meta:  el.querySelector('.offcanvas-item__meta')?.textContent?.trim() || '',
      }))
    );
    const spotifyIdx = items2.findIndex(it => /Spotify/.test(it.title));
    if (spotifyIdx !== -1) {
      await page.locator('.offcanvas-item').nth(spotifyIdx).click();
      await page.waitForTimeout(3000);
      await snap(page, vp, 'F-spotify-restored');
      const cState = await page.evaluate(() => ({
        view: window.AppState.view,
        circlesPhase: window.AppState.circlesPhase,
        circlesDrillStep: window.AppState.circlesDrillStep,
        circlesMode: window.AppState.circlesMode,
        sessionId: window.AppState.circlesSession?.id,
        selectedQuestion: window.AppState.circlesSelectedQuestion ? {
          id: window.AppState.circlesSelectedQuestion.id,
          company: window.AppState.circlesSelectedQuestion.company,
          product: window.AppState.circlesSelectedQuestion.product,
        } : null,
        loading: window.AppState.circlesSessionLoading,
      }));
      fs.writeFileSync(`${OUT_DIR}/F-spotify-state-${vp}.json`, JSON.stringify(cState, null, 2));
    }

    // ─── Suite G: CIRCLES restore Netflix draft ─────────────────────────────
    await page.locator('button[data-nav="offcanvas"]').first().click().catch(() => {});
    await page.waitForSelector('.offcanvas-drawer', { timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(1500);
    const items3 = await page.evaluate(() =>
      Array.from(document.querySelectorAll('.offcanvas-item')).map(el => ({
        title: el.querySelector('.offcanvas-item__title')?.textContent?.trim() || '',
      }))
    );
    const netflixIdx = items3.findIndex(it => /Netflix/.test(it.title));
    if (netflixIdx !== -1) {
      await page.locator('.offcanvas-item').nth(netflixIdx).click();
      await page.waitForTimeout(3000);
      await snap(page, vp, 'G-netflix-restored');
      const nState = await page.evaluate(() => ({
        view: window.AppState.view,
        circlesPhase: window.AppState.circlesPhase,
        circlesDrillStep: window.AppState.circlesDrillStep,
        sessionId: window.AppState.circlesSession?.id,
        selectedQuestion: window.AppState.circlesSelectedQuestion ? {
          id: window.AppState.circlesSelectedQuestion.id,
          company: window.AppState.circlesSelectedQuestion.company,
          product: window.AppState.circlesSelectedQuestion.product,
        } : null,
      }));
      fs.writeFileSync(`${OUT_DIR}/G-netflix-state-${vp}.json`, JSON.stringify(nState, null, 2));
    }

    // ─── Suite H: Final home stats consistency snapshot ─────────────────────
    await page.evaluate(() => {
      window.AppState.view = 'circles';
      window.AppState.offcanvasOpen = false;
      window.AppState.circlesPhase = 1;
      window.AppState.circlesSelectedQuestion = null;
      window.AppState.circlesSession = null;
      window.render();
    });
    await page.waitForTimeout(1500);
    await snap(page, vp, 'H-home-final');
  });
});
