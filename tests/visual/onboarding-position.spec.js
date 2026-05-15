// Onboarding tooltip position fix — visual verification spec (Bug 4)
// Captures 4 steps × 3 viewports = 12 PNG screenshots
// Asserts tooltip is on the correct SIDE of the target (not covering it from the wrong side).
const { test, expect } = require('@playwright/test');
const fs = require('fs');

const OUT_DIR = 'audit/png-onboarding-position';
fs.mkdirSync(OUT_DIR, { recursive: true });

async function setupRoutes(page) {
  await page.route('**/api/circles-stats**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await page.route('**/api/guest-circles-stats**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await page.route('**/api/guest-circles-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/circles-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/guest/nsm-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/nsm-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
}

async function clearOnboardingFlag(page) {
  await page.addInitScript(() => {
    try { localStorage.removeItem('circles_onboarding_done'); } catch (_) {}
  });
}

// Use page.evaluate to get bounding box synchronously — avoids Playwright's implicit
// locator waiting which can block up to actionTimeout when element doesn't exist.
async function getBboxOf(page, selector) {
  return page.evaluate(function(sel) {
    var el = document.querySelector(sel);
    if (!el) return null;
    var r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return null;
    return { x: r.left, y: r.top, width: r.width, height: r.height };
  }, selector);
}

// Per mockup 10 §B-E (round 2 fix): all steps use vertical placement (no right-side).
// "below" = tooltip does not overlap the target vertically (either above or below it).
// Steps 1, 2, 4: always below target (arrow-top), possible above flip on overflow.
// Step 3: above q-list (arrow-bottom), clamped so tooltip never enters mode-section.
//         Falls back to below q-list when gap is too small.
// All placements satisfy the non-overlap invariant checked in the 'below' branch.
function expectedPlacement(/* step, vw */) {
  return 'below'; // all steps: non-overlap vertical placement
}

const TARGET_SELECTORS = {
  1: '.mode-section',
  2: '.type-tabs',
  3: '.q-list',
  4: '.qcard', // first visible qcard (may be expanded or collapsed)
};

for (const step of [1, 2, 3, 4]) {
  test(`step${step}`, async ({ page }, testInfo) => {
    await clearOnboardingFlag(page);
    await setupRoutes(page);
    await page.goto('/');
    await page.waitForSelector('.qcard', { timeout: 15000 });
    await page.waitForSelector('.onb-welcome', { timeout: 8000 });

    // Advance to desired step
    await page.locator('[data-onb-action="start"]').click();
    for (let n = 1; n < step; n++) {
      await page.locator('[data-onb-action="next"]').click();
      await page.waitForTimeout(200);
    }
    await page.waitForSelector('.onb-tooltip', { timeout: 5000 });
    await page.waitForTimeout(400); // let positionOnboardingTooltip settle

    // Screenshot
    const vpName = testInfo.project.name;
    const pngPath = `${OUT_DIR}/step${step}-${vpName}.png`;
    await page.screenshot({ path: pngPath, fullPage: false });

    // Get current viewport width for placement check
    const vw = await page.evaluate(() => window.innerWidth);

    // Bounding box — use evaluate() to avoid implicit Playwright wait
    const tooltipBox = await getBboxOf(page, '.onb-tooltip');
    const targetBox  = await getBboxOf(page, TARGET_SELECTORS[step]);

    expect(tooltipBox, `step${step} @ ${vpName}: .onb-tooltip not found in DOM`).toBeTruthy();
    expect(targetBox,  `step${step} @ ${vpName}: target (${TARGET_SELECTORS[step]}) not found`).toBeTruthy();

    if (tooltipBox && targetBox) {
      if (step === 3) {
        // Step 3 special case: q-list spans most of the viewport height so the tooltip
        // will always be within the q-list's vertical range. The correct invariant is:
        //   1. Tooltip must NOT overlap mode-section (the container above q-list).
        //   2. Tooltip must be within the visible viewport.
        const modeSectionBottom = await page.evaluate(() => {
          var el = document.querySelector('.mode-section');
          return el ? el.getBoundingClientRect().bottom : 0;
        });
        const noModeSectionOverlap = tooltipBox.y >= modeSectionBottom - 5;
        expect(noModeSectionOverlap,
          `step3 @ ${vpName}: tooltip overlaps mode-section\n  tooltip.top=${tooltipBox.y.toFixed(0)}, mode-section.bottom=${modeSectionBottom.toFixed(0)}`
        ).toBe(true);
      } else {
        // Steps 1, 2, 4: tooltip must be placed vertically adjacent to target (below or above).
        // Key invariant: tooltip must NOT overlap the target vertically.
        // "Below" = tooltip.top >= target.bottom - 10 (allow 10px for arrow overlap)
        // "Above" = tooltip.bottom <= target.top + 10
        const belowOk = tooltipBox.y >= (targetBox.y + targetBox.height) - 10;
        const aboveOk = (tooltipBox.y + tooltipBox.height) <= targetBox.y + 10;
        const placementOk = belowOk || aboveOk;
        expect(placementOk,
          `step${step} @ ${vpName} [below/above]: tooltip overlaps target vertically\n  tooltip: y=${tooltipBox.y.toFixed(0)}, bottom=${(tooltipBox.y+tooltipBox.height).toFixed(0)}\n  target:  y=${targetBox.y.toFixed(0)}, bottom=${(targetBox.y+targetBox.height).toFixed(0)}`
        ).toBe(true);
      }

      // Universal: tooltip must be within viewport vertically (not hidden behind navbar or below screen)
      const navH = await page.evaluate(() => {
        var n = document.querySelector('.navbar');
        return n ? n.getBoundingClientRect().height : 56;
      });
      const viewportH = await page.evaluate(() => window.innerHeight);
      expect(tooltipBox.y >= navH - 5,
        `step${step} @ ${vpName}: tooltip.top (${tooltipBox.y.toFixed(0)}) is behind navbar (h=${navH})`
      ).toBe(true);
      expect(tooltipBox.y + tooltipBox.height <= viewportH + 5,
        `step${step} @ ${vpName}: tooltip overflows viewport bottom`
      ).toBe(true);
    }
  });
}
