// Walk every one of the user's saved practice sessions. Login as real user,
// iterate offcanvas items, for each session: click → capture Step 4 (scored) or
// landing step → forced navigate through Step 2, Step 3, Step 4 → capture form
// values + example-button states + hint button state.
//
// 8 vp coverage. Director cold-Read every PNG after run.

const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const OUT_DIR = path.join(__dirname, '../../audit/png-walk-all-sessions');
fs.mkdirSync(OUT_DIR, { recursive: true });

const EMAIL = 'albertpeng678@gmail.com';
const PASSWORD = '21345678';

async function loginAndLand(page) {
  await page.goto('/');
  await page.waitForSelector('.qcard, .auth-card', { timeout: 15000 });
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
  await page.waitForSelector('.qcard', { timeout: 10000 });
  await page.waitForTimeout(2000);
}

async function openOffcanvas(page) {
  await page.locator('button[data-nav="offcanvas"]').first().click();
  await page.waitForSelector('.offcanvas-drawer', { timeout: 5000 });
  await page.waitForTimeout(1000);
}

function snap(page, vpName, label) {
  return page.screenshot({ path: `${OUT_DIR}/${label}-${vpName}.png`, fullPage: false, animations: 'disabled' });
}

test.describe.serial('Walk all user sessions', () => {
  test('iterate every offcanvas item', async ({ page }, testInfo) => {
    testInfo.setTimeout(360_000);
    const vpName = testInfo.project.name;

    await loginAndLand(page);
    await snap(page, vpName, '00-home-after-login');
    await openOffcanvas(page);
    await snap(page, vpName, '01-offcanvas');

    const items = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('.offcanvas-item')).map(el => ({
        id: el.getAttribute('data-id'),
        title: el.querySelector('.offcanvas-item__title')?.textContent?.trim() || '',
        meta: el.querySelector('.offcanvas-item__meta')?.textContent?.trim() || '',
        date: el.querySelector('.offcanvas-item__date')?.textContent?.trim() || '',
      }));
    });
    fs.writeFileSync(`${OUT_DIR}/offcanvas-list-${vpName}.json`, JSON.stringify(items, null, 2));

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const safe = `s${i}-${(item.meta.includes('NSM') ? 'nsm' : 'circles')}-${(item.title || '').replace(/[^\w一-鿿]/g, '_').slice(0, 20)}`;

      // Re-open offcanvas (each click closes it)
      const offCount = await page.locator('.offcanvas-drawer').count();
      if (offCount === 0) {
        await page.locator('button[data-nav="offcanvas"]').first().click();
        await page.waitForSelector('.offcanvas-drawer', { timeout: 5000 });
        await page.waitForTimeout(500);
      }

      await page.locator('.offcanvas-item').nth(i).click();
      await page.waitForTimeout(2000);
      await snap(page, vpName, `${safe}-01-after-click`);

      const landingState = await page.evaluate(() => ({
        view: window.AppState && window.AppState.view,
        circlesPhase: window.AppState && window.AppState.circlesPhase,
        circlesDrillStep: window.AppState && window.AppState.circlesDrillStep,
        nsmStep: window.AppState && window.AppState.nsmStep,
        sessionId: (window.AppState && (window.AppState.nsmSession || window.AppState.circlesSession) || {}).id,
        nsmDefinition: window.AppState && window.AppState.nsmDefinition,
        nsmBreakdown: window.AppState && window.AppState.nsmBreakdown,
        circlesAnswers: window.AppState && window.AppState.circlesAnswers,
      }));
      fs.writeFileSync(`${OUT_DIR}/${safe}-state.json`, JSON.stringify(landingState, null, 2));

      // For NSM sessions: walk Step 4 → 3 → 2, capture each + dump form/buttons
      if (item.meta.includes('NSM') && landingState.view === 'nsm') {
        // Step 4 if scored
        if (landingState.nsmStep === 4) {
          await snap(page, vpName, `${safe}-02-step4`);
        }
        // Navigate Step 3
        await page.evaluate(() => { if (window.AppState) { window.AppState.nsmStep = 3; window.render(); } });
        await page.waitForTimeout(700);
        await snap(page, vpName, `${safe}-03-step3`);
        const step3 = await page.evaluate(() => ({
          textareas: Array.from(document.querySelectorAll('textarea')).map(t => ({ dim: t.getAttribute('data-nsm-dim-input') || t.id, value: t.value })),
          exampleButtons: Array.from(document.querySelectorAll('[data-nsm-dim-example-toggle]')).map(b => ({
            dim: b.getAttribute('data-nsm-dim-example-toggle'), disabled: b.disabled, title: b.getAttribute('title') || '',
          })),
          hintButtons: Array.from(document.querySelectorAll('[data-nsm-step3-hint]')).map(b => ({
            dim: b.getAttribute('data-nsm-step3-hint'), disabled: b.disabled,
          })),
        }));
        fs.writeFileSync(`${OUT_DIR}/${safe}-step3.json`, JSON.stringify(step3, null, 2));

        // Step 2
        await page.evaluate(() => { if (window.AppState) { window.AppState.nsmStep = 2; window.render(); } });
        await page.waitForTimeout(700);
        await snap(page, vpName, `${safe}-04-step2`);
        const step2 = await page.evaluate(() => ({
          textareas: Array.from(document.querySelectorAll('textarea')).map(t => ({ name: t.name || t.getAttribute('data-nsm-input') || t.id, value: t.value })),
          inputs: Array.from(document.querySelectorAll('input[type="text"]')).map(t => ({ name: t.name || t.id, value: t.value })),
          exampleButtons: Array.from(document.querySelectorAll('[data-nsm-example-toggle]')).map(b => ({
            field: b.getAttribute('data-nsm-example-toggle'), disabled: b.disabled, title: b.getAttribute('title') || '',
          })),
          hintButtons: Array.from(document.querySelectorAll('[data-nsm-hint]')).map(b => ({
            field: b.getAttribute('data-nsm-hint'), disabled: b.disabled,
          })),
        }));
        fs.writeFileSync(`${OUT_DIR}/${safe}-step2.json`, JSON.stringify(step2, null, 2));
      }

      // For CIRCLES sessions: capture Phase 1 + each drill step form fields + example buttons
      if (item.meta.includes('CIRCLES') && landingState.view === 'circles') {
        await snap(page, vpName, `${safe}-02-circles-landing`);
        const circlesState = await page.evaluate(() => {
          // capture all textareas + example buttons + hint buttons
          return {
            phase: window.AppState && window.AppState.circlesPhase,
            drillStep: window.AppState && window.AppState.circlesDrillStep,
            mode: window.AppState && window.AppState.circlesMode,
            textareas: Array.from(document.querySelectorAll('textarea')).map(t => ({
              name: t.name || t.getAttribute('data-circles-field') || t.id,
              value: t.value,
              length: t.value.length,
            })),
            exampleButtons: Array.from(document.querySelectorAll('[data-phase1="example-toggle"]')).map(b => ({
              key: b.getAttribute('data-example-key'),
              disabled: b.disabled,
              title: b.getAttribute('title') || '',
            })),
            hintButtons: Array.from(document.querySelectorAll('[data-phase1="hint"]')).map(b => ({
              key: b.getAttribute('data-field-key'),
              disabled: b.disabled,
            })),
          };
        });
        fs.writeFileSync(`${OUT_DIR}/${safe}-circles.json`, JSON.stringify(circlesState, null, 2));
      }

      // Return to home for next iteration
      await page.evaluate(() => {
        if (window.AppState) {
          window.AppState.view = 'circles';
          window.AppState.circlesPhase = null;
          window.AppState.circlesMode = null;
          window.AppState.circlesDrillStep = null;
          window.AppState.nsmStep = 1;
          window.AppState.nsmSelectedQuestion = null;
          window.AppState.nsmSession = null;
          window.AppState.offcanvasOpen = false;
          window.render();
        }
      });
      await page.waitForTimeout(500);
    }
  });
});
