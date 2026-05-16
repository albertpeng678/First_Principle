// Director-personal exhaustive walkthrough — verify CIRCLES parenthesis removal + 3 NSM bugs
// Login as real user. Cold-Read every PNG after run. No subagent delegation.

const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const OUT_DIR = path.join(__dirname, '../../audit/png-exhaustive-nsm');
fs.mkdirSync(OUT_DIR, { recursive: true });

async function ensureLoggedIn(page) {
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

  await page.locator('#auth-email').fill('albertpeng678@gmail.com');
  await page.locator('#auth-pw').fill('21345678');
  await page.locator('#auth-submit').click();

  await page.waitForSelector('.auth-card', { state: 'detached', timeout: 20000 });
  await page.waitForSelector('.qcard', { timeout: 10000 });
  await page.waitForTimeout(1500);
}

function snap(page, vpName, label) {
  return page.screenshot({ path: `${OUT_DIR}/${label}-${vpName}.png`, fullPage: false, animations: 'disabled' });
}

test.describe.serial('Exhaustive NSM walkthrough + CIRCLES parenthesis verify', () => {
  test('vp coverage and bug investigation', async ({ page }, testInfo) => {
    testInfo.setTimeout(180_000);

    const vp = { name: testInfo.project.name };
    // Use the playwright project's own viewport (already set by config)
    await ensureLoggedIn(page);

    // ============== CIRCLES parenthesis verify across 7 drill steps ==============
    const drillSteps = ['C1', 'I', 'R', 'C2', 'L', 'E', 'S'];
    for (const step of drillSteps) {
      await page.evaluate((s) => {
        Object.assign(window.AppState, {
          view: 'circles',
          circlesMode: 'drill',
          circlesDrillStep: s,
          circlesPhase: 1,
          circlesSelectedQuestion: { id: 'q-test', company: 'Spotify', product: 'Spotify Podcast', question_type: 'design' },
          circlesAnswers: {},
          circlesSession: { id: 's-test' },
        });
        window.render();
      }, step);
      await page.waitForTimeout(300);
      await snap(page, vp.name, `circles-drill-${step}-no-paren-check`);

      // Extract phase-head title text
      const title = await page.evaluate(() => {
        const el = document.querySelector('.phase-head__title, [class*="phase-head"] h1, [class*="phase-head"] h2');
        return el ? el.textContent.trim() : null;
      });
      fs.writeFileSync(`${OUT_DIR}/circles-drill-${step}-title-${vp.name}.txt`, title || 'null');
    }

    // ============== NSM bug investigation — login + restore Zoom session ==============
    // Open offcanvas and find Zoom NSM record
    await page.evaluate(() => {
      window.AppState.view = 'circles';
      window.AppState.offcanvasOpen = true;
      window.render();
    });
    await page.waitForTimeout(500);
    await snap(page, vp.name, 'offcanvas-open');

    // Click Zoom
    try {
      await page.locator('text=Zoom').first().click({ timeout: 3000 });
      await page.waitForTimeout(1200);
    } catch (e) {
      fs.writeFileSync(`${OUT_DIR}/zoom-click-error-${vp.name}.txt`, String(e));
    }

    const postClick = await page.evaluate(() => ({
      view: window.AppState && window.AppState.view,
      nsmStep: window.AppState && window.AppState.nsmStep,
      nsmDefinition: window.AppState && window.AppState.nsmDefinition,
      nsmBreakdown: window.AppState && window.AppState.nsmBreakdown,
      nsmSessionId: window.AppState && window.AppState.nsmSession && window.AppState.nsmSession.id,
    }));
    fs.writeFileSync(`${OUT_DIR}/post-click-state-${vp.name}.json`, JSON.stringify(postClick, null, 2));
    await snap(page, vp.name, 'after-zoom-click');

    // Force navigate to Step 2 — check user_nsm visible (Bug B-C)
    await page.evaluate(() => { window.AppState.nsmStep = 2; window.render(); });
    await page.waitForTimeout(700);
    await snap(page, vp.name, 'step2-restored');

    const step2Form = await page.evaluate(() => {
      const out = { textareas: [], inputs: [] };
      document.querySelectorAll('textarea').forEach(t => {
        out.textareas.push({
          name: t.name || t.getAttribute('data-nsm-input') || t.id || t.placeholder,
          value: t.value,
          dataField: t.getAttribute('data-nsm-input'),
        });
      });
      document.querySelectorAll('input[type="text"]').forEach(t => {
        out.inputs.push({ name: t.name || t.id, value: t.value });
      });
      return out;
    });
    fs.writeFileSync(`${OUT_DIR}/step2-form-${vp.name}.json`, JSON.stringify(step2Form, null, 2));

    // Bug B-B: example button states on Step 2
    const step2Examples = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('[data-nsm-example-toggle]')).map(b => ({
        fieldId: b.getAttribute('data-nsm-example-toggle'),
        disabled: b.disabled,
        ariaExpanded: b.getAttribute('aria-expanded'),
        title: b.getAttribute('title'),
        text: b.textContent.trim(),
      }));
    });
    fs.writeFileSync(`${OUT_DIR}/step2-example-buttons-${vp.name}.json`, JSON.stringify(step2Examples, null, 2));

    // Try clicking first non-disabled example button
    const step2EnabledEx = await page.locator('[data-nsm-example-toggle]:not([disabled])').first();
    if (await step2EnabledEx.count() > 0) {
      await step2EnabledEx.click().catch(() => {});
      await page.waitForTimeout(700);
      await snap(page, vp.name, 'step2-example-clicked');
    } else {
      await snap(page, vp.name, 'step2-example-all-disabled');
    }

    // Bug B-A: hint button on empty context
    await page.evaluate(() => {
      document.querySelectorAll('textarea').forEach(t => { t.value = ''; });
      if (window.AppState && window.AppState.nsmDefinition) {
        window.AppState.nsmDefinition = { nsm: '', explanation: '', businessLink: '' };
      }
    });
    const step2HintBtn = page.locator('[data-nsm-hint]').first();
    if (await step2HintBtn.count() > 0) {
      await step2HintBtn.click().catch(() => {});
      await page.waitForTimeout(2000);
      await snap(page, vp.name, 'step2-hint-empty-context');
      // dump modal content
      const modalText = await page.evaluate(() => {
        const m = document.querySelector('.modal__body, .nsm-hint-modal__body, [class*="hint-modal"] .modal__body');
        return m ? m.textContent.trim().slice(0, 500) : null;
      });
      fs.writeFileSync(`${OUT_DIR}/step2-hint-modal-text-${vp.name}.txt`, modalText || 'no modal');
      await page.locator('[data-hint-action="close"]').first().click().catch(() => {});
      await page.waitForTimeout(300);
    }

    // ============== Step 3 ==============
    await page.evaluate(() => { window.AppState.nsmStep = 3; window.render(); });
    await page.waitForTimeout(700);
    await snap(page, vp.name, 'step3-restored');

    const step3Form = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('textarea')).map(t => ({
        dim: t.getAttribute('data-nsm-dim-input') || t.getAttribute('data-dim') || t.name,
        value: t.value,
      }));
    });
    fs.writeFileSync(`${OUT_DIR}/step3-form-${vp.name}.json`, JSON.stringify(step3Form, null, 2));

    const step3Examples = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('[data-nsm-dim-example-toggle]')).map(b => ({
        dimId: b.getAttribute('data-nsm-dim-example-toggle'),
        disabled: b.disabled,
        ariaExpanded: b.getAttribute('aria-expanded'),
        title: b.getAttribute('title'),
      }));
    });
    fs.writeFileSync(`${OUT_DIR}/step3-example-buttons-${vp.name}.json`, JSON.stringify(step3Examples, null, 2));

    const step3HintBtns = await page.locator('[data-nsm-step3-hint]').all();
    if (step3HintBtns.length > 0) {
      await page.evaluate(() => {
        document.querySelectorAll('textarea').forEach(t => { t.value = ''; });
        if (window.AppState && window.AppState.nsmBreakdown) {
          window.AppState.nsmBreakdown = { reach: '', depth: '', frequency: '', impact: '' };
        }
      });
      await step3HintBtns[0].click().catch(() => {});
      await page.waitForTimeout(2000);
      await snap(page, vp.name, 'step3-hint-empty-context');
      const modalText = await page.evaluate(() => {
        const m = document.querySelector('.modal__body, .nsm-hint-modal__body, [class*="hint-modal"] .modal__body');
        return m ? m.textContent.trim().slice(0, 500) : null;
      });
      fs.writeFileSync(`${OUT_DIR}/step3-hint-modal-text-${vp.name}.txt`, modalText || 'no modal');
      await page.locator('[data-hint-action="close"]').first().click().catch(() => {});
      await page.waitForTimeout(300);
    }
  });
});
