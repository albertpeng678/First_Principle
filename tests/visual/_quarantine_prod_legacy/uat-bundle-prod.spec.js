// UAT spec — Director runs against production https://first-principle.up.railway.app/
// Verifies all 8 bug fixes from 2026-05-12 NSM fix bundle.
// Output: audit/png-uat-bundle-prod/ × 3 vp + state JSON dumps for assertion.

const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const OUT_DIR = path.join(__dirname, '../../audit/png-uat-bundle-prod');
fs.mkdirSync(OUT_DIR, { recursive: true });

const EMAIL = 'albertpeng678@gmail.com';
const PASSWORD = '21345678';

async function loginAndLand(page) {
  await page.goto('/');
  await page.waitForSelector('.qcard, .auth-card', { timeout: 20000 });
  const authCardVisible = await page.locator('.auth-card').count();
  if (!authCardVisible) {
    await page.evaluate(() => {
      window.AppState.accessToken = null;
      window.AppState.userEmail = null;
      window.AppState.view = 'auth';
      window.AppState.authTab = 'login';
      window.AppState.authLoading = false;
      window.AppState.authError = null;
      window.render();
    });
    await page.waitForSelector('.auth-card', { timeout: 5000 });
  }
  await page.locator('#auth-email').fill(EMAIL);
  await page.locator('#auth-pw').fill(PASSWORD);
  await page.locator('#auth-submit').click();
  await page.waitForSelector('.auth-card', { state: 'detached', timeout: 20000 });
  await page.waitForSelector('.qcard', { timeout: 15000 });
  await page.waitForTimeout(2500); // SSE + session list cache + rehydrate
}

async function openOffcanvas(page) {
  await page.locator('button[data-nav="offcanvas"]').first().click();
  await page.waitForSelector('.offcanvas-drawer', { timeout: 5000 });
  await page.waitForTimeout(1500); // let sessions list + cache settle
}

function snap(page, vp, label) {
  return page.screenshot({ path: `${OUT_DIR}/${label}-${vp}.png`, fullPage: false, animations: 'disabled' });
}

test.describe.serial('UAT against production — bundle 2026-05-12', () => {
  test('login + walk 8 bugs', async ({ page }, testInfo) => {
    testInfo.setTimeout(300_000);
    const vp = testInfo.project.name;

    // ============ Step 0: Login ============
    await loginAndLand(page);
    await snap(page, vp, '00-after-login');

    // ============ Bug X-DupSession + X-SlowList: offcanvas ============
    const t0 = Date.now();
    await openOffcanvas(page);
    const t1 = Date.now();
    await snap(page, vp, '01-offcanvas-1st-open');

    const offcanvasList = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('.offcanvas-item')).map(el => ({
        id: el.getAttribute('data-id'),
        title: el.querySelector('.offcanvas-item__title')?.textContent?.trim() || '',
        meta: el.querySelector('.offcanvas-item__meta')?.textContent?.trim() || '',
        date: el.querySelector('.offcanvas-item__date')?.textContent?.trim() || '',
      }));
    });
    fs.writeFileSync(`${OUT_DIR}/01-offcanvas-${vp}.json`, JSON.stringify({ items: offcanvasList, openMs: t1 - t0 }, null, 2));

    // Close offcanvas, re-open to test cache speed
    await page.evaluate(() => { window.AppState.offcanvasOpen = false; window.render(); });
    await page.waitForTimeout(300);
    const t2 = Date.now();
    await openOffcanvas(page);
    const t3 = Date.now();
    fs.writeFileSync(`${OUT_DIR}/01b-offcanvas-2nd-open-${vp}.json`, JSON.stringify({ openMs: t3 - t2 }, null, 2));
    await snap(page, vp, '01b-offcanvas-2nd-open');

    // ============ Bug X-Compare + X-Back + X-LockedStep2 + X-FE + X-Ctx: Click Zoom (NSM 80分) ============
    const nsmIdx = offcanvasList.findIndex(it => it.meta.includes('NSM') && /Zoom/.test(it.title));
    if (nsmIdx === -1) {
      fs.writeFileSync(`${OUT_DIR}/error-no-zoom-${vp}.txt`, 'Zoom NSM not in offcanvas. List: ' + JSON.stringify(offcanvasList));
      throw new Error('Zoom not found in offcanvas');
    }
    await page.locator('.offcanvas-item').nth(nsmIdx).click();
    await page.waitForTimeout(2000);
    await snap(page, vp, '02-after-click-zoom');

    const landing = await page.evaluate(() => ({
      view: window.AppState && window.AppState.view,
      nsmStep: window.AppState && window.AppState.nsmStep,
      nsmDefinition: window.AppState && window.AppState.nsmDefinition,
      nsmBreakdown: window.AppState && window.AppState.nsmBreakdown,
      nsmEvalResult: window.AppState && window.AppState.nsmEvalResult ? { totalScore: window.AppState.nsmEvalResult.totalScore } : null,
    }));
    fs.writeFileSync(`${OUT_DIR}/02-landing-${vp}.json`, JSON.stringify(landing, null, 2));

    // ============ Bug X-Compare: Step 4 對比 tab ============
    await page.evaluate(() => { window.AppState.nsmReportTab = 'comparison'; window.render(); });
    await page.waitForTimeout(500);
    await snap(page, vp, '03-step4-compare-tab');

    const compareData = await page.evaluate(() => {
      const blocks = Array.from(document.querySelectorAll('.nsm-compare-block, .nsm-compare-grid__row'));
      return blocks.map(b => {
        const yourCell = b.querySelector('.nsm-compare-card--yours .nsm-compare-card__text, .nsm-compare-grid__cell--yours');
        const coachCell = b.querySelector('.nsm-compare-card--coach .nsm-compare-card__text, .nsm-compare-grid__cell--coach');
        const label = b.querySelector('.nsm-compare-block__title, .nsm-compare-grid__cell--label')?.textContent?.trim() || '';
        return { label, yourText: yourCell?.textContent?.trim() || '', coachText: coachCell?.textContent?.trim() || '' };
      });
    });
    fs.writeFileSync(`${OUT_DIR}/03-compare-data-${vp}.json`, JSON.stringify(compareData, null, 2));

    // ============ Bug X-Overlay: click 教練版 (mobile only) ============
    if (vp.includes('Mobile') || vp.includes('iPhone')) {
      await page.evaluate(() => { window.AppState.nsmActiveCompareNode = 'nsm'; window.render(); });
      await page.waitForTimeout(500);
      await snap(page, vp, '04-coach-overlay-active');
      const overlayInfo = await page.evaluate(() => {
        const sheet = document.querySelector('.nsm-coach-bottom-sheet');
        const handle = document.querySelector('.nsm-coach-bottom-sheet__handle');
        const backdrop = document.querySelector('.nsm-coach-overlay__backdrop');
        return {
          sheetExists: !!sheet,
          handleExists: !!handle,
          backdropExists: !!backdrop,
          sheetRadius: sheet ? getComputedStyle(sheet).borderRadius : null,
        };
      });
      fs.writeFileSync(`${OUT_DIR}/04-overlay-info-${vp}.json`, JSON.stringify(overlayInfo, null, 2));
      // Close overlay
      await page.evaluate(() => { window.AppState.nsmActiveCompareNode = null; window.render(); });
      await page.waitForTimeout(300);
    }

    // ============ Bug X-LockedStep2: Step 2 locked view ============
    await page.evaluate(() => { window.AppState.nsmStep = 2; window.render(); });
    await page.waitForTimeout(700);
    await snap(page, vp, '05-step2-locked');

    const step2State = await page.evaluate(() => {
      const fields = Array.from(document.querySelectorAll('.rt-field--locked, .nsm-field'));
      const fieldsInfo = fields.map(f => ({
        hasLockedClass: f.classList.contains('rt-field--locked'),
        label: f.querySelector('.field__label')?.textContent?.trim() || '',
        value: f.querySelector('textarea[disabled], input[disabled]')?.value || '',
      }));
      const submitBar = document.querySelector('.submit-bar--locked');
      // Manual text search for 回首頁
      const allBtns = Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim());
      return {
        fields: fieldsInfo,
        hasLockedSubmitBar: !!submitBar,
        submitBarPrimary: submitBar?.querySelector('.btn--primary')?.textContent?.trim() || '',
        anyHomeBtnInAnyForm: allBtns.some(t => t.includes('回首頁')),
      };
    });
    fs.writeFileSync(`${OUT_DIR}/05-step2-state-${vp}.json`, JSON.stringify(step2State, null, 2));

    // ============ Bug X-FE: click 範例答案 + verify content ============
    const exampleBtns = await page.locator('[data-nsm-example-toggle]:not([disabled])').count();
    fs.writeFileSync(`${OUT_DIR}/06-step2-example-btn-enabled-count-${vp}.txt`, String(exampleBtns));
    if (exampleBtns > 0) {
      await page.locator('[data-nsm-example-toggle]:not([disabled])').first().click();
      await page.waitForTimeout(800);
      await snap(page, vp, '06-step2-example-clicked');
      const exampleText = await page.evaluate(() => {
        const expand = document.querySelector('.example-expand');
        return expand ? expand.textContent.trim().slice(0, 400) : null;
      });
      fs.writeFileSync(`${OUT_DIR}/06-step2-example-content-${vp}.txt`, exampleText || 'NO EXPAND VISIBLE');
    } else {
      fs.writeFileSync(`${OUT_DIR}/06-step2-example-content-${vp}.txt`, 'ALL example buttons disabled');
    }

    // ============ Bug X-Ctx: 深入了解問題 expand ============
    await page.evaluate(() => { window.AppState.nsmContextExpanded = true; window.render(); });
    await page.waitForTimeout(500);
    await snap(page, vp, '07-step2-context-expanded');

    const contextBlocks = await page.evaluate(() => {
      const blocks = Array.from(document.querySelectorAll('.nsm-context-card__ana-block'));
      return blocks.map(b => ({
        head: b.querySelector('.nsm-context-card__ana-head')?.textContent?.trim() || '',
        body: b.querySelector('.nsm-context-card__ana-body')?.textContent?.trim() || '',
      }));
    });
    fs.writeFileSync(`${OUT_DIR}/07-context-blocks-${vp}.json`, JSON.stringify(contextBlocks, null, 2));

    // ============ Hint button still clickable in locked Step 2 ============
    const hintBtns = await page.locator('[data-nsm-hint]:not([disabled])').count();
    fs.writeFileSync(`${OUT_DIR}/08-step2-hint-btn-enabled-count-${vp}.txt`, String(hintBtns));

    // ============ Bug X-Back: navbar NSM tab click on scored session ============
    await page.locator('[data-nav="nsm"]').first().click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(800);
    const afterTabClick = await page.evaluate(() => ({
      view: window.AppState.view,
      nsmStep: window.AppState.nsmStep,
    }));
    fs.writeFileSync(`${OUT_DIR}/09-after-nsm-tab-click-${vp}.json`, JSON.stringify(afterTabClick, null, 2));
    await snap(page, vp, '09-after-nsm-tab-click');

    // ============ Backend API coverage: dump session list + detail + stats ============
    const apiDumps = await page.evaluate(async () => {
      const token = window.AppState && window.AppState.accessToken;
      if (!token) return { error: 'no token' };
      const hdr = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
      const out = {};
      try {
        const [nsm, cir, stats] = await Promise.all([
          fetch('/api/nsm-sessions', { headers: hdr }).then(r => r.json()).catch(e => ({ error: String(e) })),
          fetch('/api/circles-sessions', { headers: hdr }).then(r => r.json()).catch(e => ({ error: String(e) })),
          fetch('/api/circles-stats', { headers: hdr }).then(r => r.json()).catch(e => ({ error: String(e) })),
        ]);
        out.nsm = { count: Array.isArray(nsm.sessions) ? nsm.sessions.length : (Array.isArray(nsm) ? nsm.length : null), raw: nsm };
        out.circles = { count: Array.isArray(cir.sessions) ? cir.sessions.length : (Array.isArray(cir) ? cir.length : null), raw: cir };
        out.stats = stats;
      } catch (e) {
        out.fatal = String(e);
      }
      return out;
    });
    fs.writeFileSync(`${OUT_DIR}/10-api-dumps-${vp}.json`, JSON.stringify(apiDumps, null, 2));

    // ============ Home stats card check ============
    await page.evaluate(() => {
      window.AppState.view = 'circles';
      window.AppState.offcanvasOpen = false;
      window.render();
    });
    await page.waitForTimeout(1200);
    await snap(page, vp, '11-home-circles');
    const statsCard = await page.evaluate(() => {
      const el = document.querySelector('.stats-strip, .circles-home__stats, .stats-card');
      return {
        present: !!el,
        text: el ? el.textContent.replace(/\s+/g, ' ').trim().slice(0, 300) : null,
      };
    });
    fs.writeFileSync(`${OUT_DIR}/11-home-stats-${vp}.json`, JSON.stringify(statsCard, null, 2));

    // ============ CIRCLES restore — Spotify completed C step ============
    await openOffcanvas(page);
    const offcanvasItems2 = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('.offcanvas-item')).map(el => ({
        id: el.getAttribute('data-id'),
        title: el.querySelector('.offcanvas-item__title')?.textContent?.trim() || '',
        meta: el.querySelector('.offcanvas-item__meta')?.textContent?.trim() || '',
      }));
    });
    const spotifyIdx = offcanvasItems2.findIndex(it => it.meta.includes('CIRCLES') && /Spotify/.test(it.title));
    if (spotifyIdx !== -1) {
      await page.locator('.offcanvas-item').nth(spotifyIdx).click();
      await page.waitForTimeout(2200);
      await snap(page, vp, '12-circles-spotify-restored');
      const circlesState = await page.evaluate(() => ({
        view: window.AppState.view,
        currentPhase: window.AppState.currentPhase,
        drillStep: window.AppState.drillStep,
        questionId: window.AppState.currentQuestion && window.AppState.currentQuestion.id,
        company: window.AppState.currentQuestion && window.AppState.currentQuestion.company,
        product: window.AppState.currentQuestion && window.AppState.currentQuestion.product,
      }));
      fs.writeFileSync(`${OUT_DIR}/12-circles-state-${vp}.json`, JSON.stringify(circlesState, null, 2));
    } else {
      fs.writeFileSync(`${OUT_DIR}/12-circles-state-${vp}.json`, JSON.stringify({ error: 'spotify not found', items: offcanvasItems2 }, null, 2));
    }
  });
});
