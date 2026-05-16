// Deep-dive on 3 user-reported NSM bugs (post 4-bug-fix bundle):
// B-A: hint button shows context-aware content (should show DEFAULT hint when context empty)
// B-B: example answer button non-clickable
// B-C: user-typed content disappears after restore
//
// Run as real user (albertpeng678@gmail.com). 8 vp coverage. Cold-Read every PNG manually.

const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const OUT_DIR = path.join(__dirname, '../../audit/png-nsm-bug-deep-dive');
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
  await page.waitForTimeout(2000); // SSE + sessions list cache
}

function snap(page, vpName, label) {
  return page.screenshot({ path: `${OUT_DIR}/${label}-${vpName}.png`, fullPage: false, animations: 'disabled' });
}

test.describe.serial('NSM bug deep-dive (real user)', () => {
  test('login + restore Zoom + test hint/example buttons + form populate', async ({ page }, testInfo) => {
    testInfo.setTimeout(180_000);
    const vpName = testInfo.project.name;

    await loginAndLand(page);
    await snap(page, vpName, '01-after-login');

    // Open offcanvas via navbar button (the only way that triggers session list render)
    await page.locator('button[data-nav="offcanvas"]').first().click();
    await page.waitForSelector('.offcanvas-drawer', { timeout: 5000 });
    await page.waitForTimeout(1000);
    await snap(page, vpName, '02-offcanvas');

    // Click first NSM record in offcanvas (Zoom)
    const offcanvasInfo = await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('.offcanvas-item'));
      return items.map(el => ({
        title: el.querySelector('.offcanvas-item__title')?.textContent?.trim() || '',
        meta: el.querySelector('.offcanvas-item__meta')?.textContent?.trim() || '',
      }));
    });
    const nsmIdx = offcanvasInfo.findIndex(it => it.meta.includes('NSM'));
    if (nsmIdx === -1) throw new Error('No NSM item in offcanvas — offcanvas had: ' + JSON.stringify(offcanvasInfo));
    await page.locator('.offcanvas-item').nth(nsmIdx).click();
    await page.waitForTimeout(1500);

    // ============ Bug 1 verification: should land on Step 4 ============
    const landing = await page.evaluate(() => ({
      view: window.AppState && window.AppState.view,
      nsmStep: window.AppState && window.AppState.nsmStep,
      nsmDefinition: window.AppState && window.AppState.nsmDefinition,
      nsmBreakdown: window.AppState && window.AppState.nsmBreakdown,
    }));
    fs.writeFileSync(`${OUT_DIR}/03-landing-${vpName}.json`, JSON.stringify(landing, null, 2));
    await snap(page, vpName, '03-step4-landing');

    // ============ Bug B-C: Step 3 form should be populated from user_breakdown ============
    await page.evaluate(() => {
      window.AppState.nsmStep = 3;
      window.render();
    });
    await page.waitForTimeout(800);
    await snap(page, vpName, '04-step3');

    const step3Form = await page.evaluate(() => {
      const out = { textareas: [], breakdown: window.AppState && window.AppState.nsmBreakdown };
      document.querySelectorAll('textarea').forEach(t => {
        out.textareas.push({
          name: t.name || t.getAttribute('data-nsm-dim-input') || t.getAttribute('data-dim') || t.id,
          value: t.value,
          length: t.value.length,
        });
      });
      return out;
    });
    fs.writeFileSync(`${OUT_DIR}/04-step3-form-${vpName}.json`, JSON.stringify(step3Form, null, 2));

    // ============ Bug B-B: Click Step 3 example buttons ============
    const exampleStates = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('[data-nsm-dim-example-toggle]')).map(b => ({
        dim: b.getAttribute('data-nsm-dim-example-toggle'),
        disabled: b.disabled,
        title: b.getAttribute('title') || '',
        text: b.textContent.trim().slice(0, 50),
      }));
    });
    fs.writeFileSync(`${OUT_DIR}/05-step3-example-states-${vpName}.json`, JSON.stringify(exampleStates, null, 2));

    // Click first non-disabled example
    const firstEnabledEx = page.locator('[data-nsm-dim-example-toggle]:not([disabled])').first();
    if (await firstEnabledEx.count() > 0) {
      await firstEnabledEx.click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(600);
      await snap(page, vpName, '05-step3-example-clicked');
    } else {
      await snap(page, vpName, '05-step3-example-all-disabled');
    }

    // ============ Bug B-A: Step 3 hint with EMPTY context ============
    // First clear textareas + state, then click hint
    await page.evaluate(() => {
      document.querySelectorAll('textarea').forEach(t => { t.value = ''; });
      if (window.AppState) {
        window.AppState.nsmBreakdown = { reach: '', depth: '', frequency: '', impact: '' };
      }
    });
    const firstHintBtn = page.locator('[data-nsm-step3-hint]').first();
    if (await firstHintBtn.count() > 0) {
      await firstHintBtn.click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(3000); // wait for hint API response
      await snap(page, vpName, '06-step3-hint-empty-ctx');
      const modalText = await page.evaluate(() => {
        const m = document.querySelector('.modal__body, [class*="hint-modal"] .modal__body, .nsm-hint-modal__body, .hint-modal__body, .modal-content');
        return m ? m.textContent.trim().slice(0, 600) : null;
      });
      fs.writeFileSync(`${OUT_DIR}/06-step3-hint-empty-text-${vpName}.txt`, modalText || 'NO MODAL FOUND');
      // close modal
      await page.locator('[data-hint-action="close"]').first().click({ timeout: 2000 }).catch(() => {});
      await page.waitForTimeout(300);
    }

    // ============ Step 2 — same checks ============
    await page.evaluate(() => { window.AppState.nsmStep = 2; window.render(); });
    await page.waitForTimeout(800);
    await snap(page, vpName, '07-step2');

    const step2Form = await page.evaluate(() => {
      const out = { textareas: [], inputs: [], definition: window.AppState && window.AppState.nsmDefinition };
      document.querySelectorAll('textarea').forEach(t => out.textareas.push({
        name: t.name || t.getAttribute('data-nsm-input') || t.id,
        value: t.value, length: t.value.length,
      }));
      document.querySelectorAll('input[type="text"]').forEach(t => out.inputs.push({
        name: t.name || t.id, value: t.value,
      }));
      return out;
    });
    fs.writeFileSync(`${OUT_DIR}/07-step2-form-${vpName}.json`, JSON.stringify(step2Form, null, 2));

    const step2ExStates = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('[data-nsm-example-toggle]')).map(b => ({
        fieldId: b.getAttribute('data-nsm-example-toggle'),
        disabled: b.disabled,
        title: b.getAttribute('title') || '',
        text: b.textContent.trim().slice(0, 50),
      }));
    });
    fs.writeFileSync(`${OUT_DIR}/08-step2-example-states-${vpName}.json`, JSON.stringify(step2ExStates, null, 2));
    const firstStep2Ex = page.locator('[data-nsm-example-toggle]:not([disabled])').first();
    if (await firstStep2Ex.count() > 0) {
      await firstStep2Ex.click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(600);
      await snap(page, vpName, '08-step2-example-clicked');
    } else {
      await snap(page, vpName, '08-step2-example-all-disabled');
    }

    // Hint empty context
    await page.evaluate(() => {
      document.querySelectorAll('textarea').forEach(t => { t.value = ''; });
      if (window.AppState) window.AppState.nsmDefinition = { nsm: '', explanation: '', businessLink: '' };
    });
    const step2HintBtn = page.locator('[data-nsm-hint]').first();
    if (await step2HintBtn.count() > 0) {
      await step2HintBtn.click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(3000);
      await snap(page, vpName, '09-step2-hint-empty-ctx');
      const modalText = await page.evaluate(() => {
        const m = document.querySelector('.modal__body, [class*="hint-modal"] .modal__body, .nsm-hint-modal__body, .hint-modal__body, .modal-content');
        return m ? m.textContent.trim().slice(0, 600) : null;
      });
      fs.writeFileSync(`${OUT_DIR}/09-step2-hint-empty-text-${vpName}.txt`, modalText || 'NO MODAL FOUND');
    }
  });
});
