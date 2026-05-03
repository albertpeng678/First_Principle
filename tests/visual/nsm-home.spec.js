// Path 2 · Plan C SB1 — NSM Step 1 visual spec (mockup 06)
// Asserts 5 cards, card click → context + enabled CTA, shuffle, submit barrier.
// Note: both nsm-body (mobile/tablet) and nsm-desktop-shell (desktop) are in the DOM;
//       CSS toggles visibility. All locators filter to visible elements only.
const { test, expect } = require('@playwright/test');

async function gotoNSM(page) {
  await page.goto('/');
  await page.waitForSelector('.navbar');
  await page.locator('[data-nav="nsm"]').first().click();
  await page.waitForSelector('[data-nsm-step="1"]');
}

test.describe('C1 NSM Step 1 — 選擇情境', () => {

  test('renders 5 question cards and disabled CTA on first load', async ({ page }) => {
    await gotoNSM(page);
    // 4-step progress bar, step 1 active
    await expect(page.locator('.nsm-progress__step.is-active')).toHaveCount(1);
    await expect(page.locator('.nsm-progress__step.is-active .nsm-progress__label')).toHaveText('情境');
    // 5 visible q-cards rendered (mobile: 5 in nsm-body; desktop: 5 in nsm-center)
    const visibleCards = page.locator('.nsm-q-card').filter({ visible: true });
    await expect(visibleCards).toHaveCount(5);
    // submit CTA disabled
    await expect(page.locator('[data-nsm="start"]')).toBeDisabled();
    // hint text present
    await expect(page.locator('.submit-bar__left')).toContainText('請先選擇一個情境');
  });

  test('clicking a card expands context and enables CTA', async ({ page }) => {
    await gotoNSM(page);
    // click first VISIBLE card
    await page.locator('.nsm-q-card').filter({ visible: true }).first().click();
    // exactly 1 visible selected card
    await expect(page.locator('.nsm-q-card.is-selected').filter({ visible: true })).toHaveCount(1);
    // context block appears (pregenerated or loading) inside selected card
    await expect(page.locator('.nsm-q-card.is-selected .nsm-context').filter({ visible: true })).toBeVisible();
    // type pill visible on selected card
    await expect(page.locator('.nsm-q-card.is-selected .nsm-q-card__type').filter({ visible: true })).toBeVisible();
    // submit CTA enabled
    await expect(page.locator('[data-nsm="start"]')).not.toBeDisabled();
    // hint text gone from submit-bar
    const hintText = await page.locator('.submit-bar__left').textContent();
    expect(hintText.trim()).toBe('');
    // list-head shows "已選 1" (visible instance)
    const labelText = await page.locator('.nsm-list-head__label').filter({ visible: true }).first().textContent();
    expect(labelText).toContain('已選 1');
  });

  test('shuffle button re-picks 5 cards and clears selection', async ({ page }) => {
    await gotoNSM(page);
    // select a card first
    await page.locator('.nsm-q-card').filter({ visible: true }).first().click();
    await expect(page.locator('.nsm-q-card.is-selected').filter({ visible: true })).toHaveCount(1);
    // click shuffle (first VISIBLE instance)
    await page.locator('[data-nsm="shuffle"]').filter({ visible: true }).first().click();
    // selection cleared
    await expect(page.locator('.nsm-q-card.is-selected').filter({ visible: true })).toHaveCount(0);
    // still 5 visible cards
    await expect(page.locator('.nsm-q-card').filter({ visible: true })).toHaveCount(5);
    // CTA disabled again
    await expect(page.locator('[data-nsm="start"]')).toBeDisabled();
  });

  test('submit advances to nsmStep 2 (stub)', async ({ page }) => {
    await gotoNSM(page);
    // select any visible card
    await page.locator('.nsm-q-card').filter({ visible: true }).first().click();
    await expect(page.locator('[data-nsm="start"]')).not.toBeDisabled();
    await page.locator('[data-nsm="start"]').click();
    // step 1 is gone, stub renders
    await expect(page.locator('[data-nsm-step="1"]')).toHaveCount(0);
    await expect(page.locator('[data-view="nsm"]')).toBeVisible();
  });

});
