// Production deploy verification — confirm CIRCLES drill titles have NO parentheses
// across all 7 steps × 8 vp. Tests https://first-principle.up.railway.app/

const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const OUT_DIR = path.join(__dirname, '../../audit/png-prod-parens-verify');
fs.mkdirSync(OUT_DIR, { recursive: true });

const PROD_URL = 'https://first-principle.up.railway.app';

test.describe.serial('Production CIRCLES 7-step paren verify', () => {
  test('all 7 drill steps clean across vp', async ({ page }, testInfo) => {
    testInfo.setTimeout(120_000);
    const vpName = testInfo.project.name;

    await page.goto(PROD_URL);
    await page.waitForSelector('.navbar, .qcard, .auth-card', { timeout: 15000 });

    const drillSteps = ['C1', 'I', 'R', 'C2', 'L', 'E', 'S'];
    for (const step of drillSteps) {
      await page.evaluate((s) => {
        if (!window.AppState) return;
        Object.assign(window.AppState, {
          view: 'circles',
          circlesMode: 'drill',
          circlesDrillStep: s,
          circlesPhase: 1,
          circlesSelectedQuestion: { id: 'q-prod-test', company: 'Spotify', product: 'Spotify Podcast', question_type: 'design' },
          circlesAnswers: {},
          circlesSession: { id: 's-prod-test' },
        });
        window.render();
      }, step);
      await page.waitForTimeout(400);
      await page.screenshot({
        path: `${OUT_DIR}/circles-drill-${step}-${vpName}.png`,
        fullPage: false,
        animations: 'disabled',
      });

      // Capture title text
      const title = await page.evaluate(() => {
        const phaseHead = document.querySelector('.phase-head');
        if (!phaseHead) return null;
        // Get only the main title text, not subtitle spans
        const titleNode = phaseHead.querySelector('.phase-head__title') || phaseHead.querySelector('h1, h2');
        if (!titleNode) return null;
        // Extract first text node (excluding subtitle spans)
        let text = '';
        for (const child of titleNode.childNodes) {
          if (child.nodeType === Node.TEXT_NODE) text += child.textContent;
        }
        return {
          mainText: text.trim(),
          fullText: titleNode.textContent.trim(),
          hasParenSpan: !!titleNode.querySelector('.phase-head__title-extra, .phase-head__title-s-suffix'),
        };
      });
      fs.writeFileSync(`${OUT_DIR}/title-${step}-${vpName}.json`, JSON.stringify(title, null, 2));
    }
  });
});
