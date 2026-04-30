// audit/journey-runner.spec.js
// Deterministic 10-step user journey across all 8 audit viewports.
// Each step: screenshot + tolerate failure + record console errors.
// Outputs: audit/screenshots/<project>/<NN-step>.png  + audit/console/<project>.json
//
// This is the EXECUTION layer. The 5 persona agents read the artefacts
// and write their subjective u<n>-log.md from the persona's perspective.
//
// Robustness rule: any step may fail (no backend, AI quota, etc.) — we
// screenshot the failure state and CONTINUE. The whole point is to gather
// observable evidence, not to assert correctness here.

const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const SAMPLE_ANSWERS = {
  C: '我認為這個題目主要是要解決使用者「找不到自己想看內容」的痛點。Netflix 雖然有上千部影片，但用戶常滑了五分鐘還是不知道要看什麼，最後乾脆關掉 App。',
  I: '主要鎖定 25-40 歲都市上班族，平日下班想放鬆、週末想看電影。痛點：選擇困難、推薦不準、續看歷史不見了。',
  R: '使用者：希望快速找到適合心情的內容。商業：希望提高觀看時長與留存。技術：推薦系統需有資料才能個人化。',
  CUT: '優先處理「初次登入後 30 秒內找到要看的內容」這個情境，因為這直接影響到次日留存。',
  L: '方案 A：心情選擇器 — 用戶選心情、時間、語言，系統 narrow down 推薦。\n方案 B：5 秒預覽輪播 — 自動播放前 5 秒讓用戶快速感受。\n方案 C：朋友共看清單 — 顯示朋友最近看的，社交背書降低決策成本。',
  E: '方案 A 影響大、實作中等。方案 B 體驗好但耗流量。方案 C 需先有社交圖譜。建議先 A 後 C。',
  S: '推薦先做心情選擇器，預期 30 秒內選片成功率提升 25%，追蹤指標：選片時長、棄看率、次日留存。',
};

const NSM_ANSWERS = {
  step1: '訂閱用戶每月活躍觀看時長',
  step2_a: '影片是訂閱制核心價值的代理變數',
  step2_b: '時長代表真正使用而非只是訂閱備用',
  step2_c: '純註冊數會被假帳號膨脹',
  step3: '價值傳遞 + 使用深度 + 經濟價值對齊',
  step4: '設計新手前 7 天觀看引導，目標把月活時長從 4hr 提到 6hr',
};

async function safeScreenshot(page, projDir, name) {
  try {
    await page.screenshot({
      path: path.join('audit/screenshots', projDir, `${name}.png`),
      fullPage: true,
    });
  } catch (e) {
    // If screenshot fails (closed page, etc.), record but don't crash.
    console.error(`[screenshot fail] ${name}: ${e.message}`);
  }
}

async function softClick(page, locator, timeout = 4000) {
  try {
    await locator.first().click({ timeout });
    await page.waitForTimeout(400);
    return true;
  } catch {
    return false;
  }
}

async function fillFirstTextarea(page, text) {
  try {
    const ta = page.locator('textarea, [contenteditable="true"]').first();
    await ta.waitFor({ state: 'visible', timeout: 3000 });
    await ta.click();
    await page.waitForTimeout(150);
    await ta.fill?.(text).catch(async () => {
      // contenteditable: type instead
      await page.keyboard.type(text, { delay: 5 });
    });
    return true;
  } catch {
    return false;
  }
}

test.describe.configure({ mode: 'serial' });

test('full 10-step audit journey', async ({ page }, testInfo) => {
  const proj = testInfo.project.name;
  const projDir = proj;
  fs.mkdirSync(path.join('audit/screenshots', projDir), { recursive: true });
  fs.mkdirSync('audit/console', { recursive: true });

  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', m => {
    if (m.type() === 'error') consoleErrors.push({ text: m.text(), at: Date.now() });
  });
  page.on('pageerror', e => pageErrors.push({ message: String(e), at: Date.now() }));

  // ── Step 01: Land on / as guest ──────────────────────────────
  await page.goto('/', { waitUntil: 'networkidle' });
  await safeScreenshot(page, projDir, '01-landing-circles-home');

  // ── Step 02: Browse question list, click 看更多 on a card ────
  const moreBtn = page.locator('.circles-q-card-more').first();
  if (await moreBtn.isVisible().catch(() => false)) {
    await softClick(page, moreBtn);
    await safeScreenshot(page, projDir, '02-card-expanded');
  } else {
    await safeScreenshot(page, projDir, '02-no-more-button');
  }

  // ── Step 03: Pick a question → enter CIRCLES flow ────────────
  const firstCard = page.locator('.circles-q-card').first();
  await softClick(page, firstCard);
  // confirm button if onboarding-style
  const confirmBtn = page.locator('.circles-q-confirm-btn, button:has-text("開始練習"), button:has-text("確認")').first();
  if (await confirmBtn.isVisible().catch(() => false)) {
    await softClick(page, confirmBtn);
  }
  await page.waitForTimeout(800);
  await safeScreenshot(page, projDir, '03-circles-step-C');

  // ── Step 04-10 (CIRCLES 7 steps): fill + 下一步 ──────────────
  const stepKeys = ['C', 'I', 'R', 'CUT', 'L', 'E', 'S'];
  const stepFiles = ['04-circles-I', '05-circles-R', '06-circles-CUT', '07-circles-L', '08-circles-E', '09-circles-S', '10-circles-summary'];
  for (let i = 0; i < stepKeys.length; i++) {
    const text = SAMPLE_ANSWERS[stepKeys[i]];
    const filled = await fillFirstTextarea(page, text);
    const nextBtn = page.locator('button:has-text("下一步"), button:has-text("提交"), button:has-text("完成"), button:has-text("送出")').first();
    if (await nextBtn.isVisible().catch(() => false)) {
      await softClick(page, nextBtn, 6000);
      await page.waitForTimeout(filled ? 1200 : 400);
    }
    await safeScreenshot(page, projDir, stepFiles[i]);
  }

  // ── Step 11: Open offcanvas ───────────────────────────────────
  await page.goto('/');
  const hamburger = page.locator('#btn-hamburger');
  if (await hamburger.isVisible().catch(() => false)) {
    await softClick(page, hamburger);
    await safeScreenshot(page, projDir, '11-offcanvas-open');
    const closeOff = page.locator('#btn-offcanvas-close');
    if (await closeOff.isVisible().catch(() => false)) await softClick(page, closeOff);
  }

  // ── Step 12: Switch to NSM tab ────────────────────────────────
  const nsmTab = page.locator('.navbar-tab[data-nav="nsm"], button:has-text("北極星指標")').first();
  if (await nsmTab.isVisible().catch(() => false)) {
    await softClick(page, nsmTab);
    await page.waitForTimeout(600);
    await safeScreenshot(page, projDir, '12-nsm-home');
  } else {
    await safeScreenshot(page, projDir, '12-nsm-tab-not-found');
  }

  // ── Step 13-16: NSM 4 steps ───────────────────────────────────
  const nsmCard = page.locator('.circles-q-card, .nsm-q-card').first();
  if (await nsmCard.isVisible().catch(() => false)) {
    await softClick(page, nsmCard);
    const nsmConfirm = page.locator('button:has-text("開始"), button:has-text("確認")').first();
    if (await nsmConfirm.isVisible().catch(() => false)) await softClick(page, nsmConfirm);
    await page.waitForTimeout(600);
    await safeScreenshot(page, projDir, '13-nsm-step-1');

    // Step 1 → step 2
    await fillFirstTextarea(page, NSM_ANSWERS.step1);
    await softClick(page, page.locator('button:has-text("下一步"), button:has-text("提交")').first(), 6000);
    await page.waitForTimeout(800);
    await safeScreenshot(page, projDir, '14-nsm-step-2');

    // Step 2: 3 textareas if present
    const textareas = page.locator('textarea, [contenteditable="true"]');
    const taCount = await textareas.count().catch(() => 0);
    for (let i = 0; i < Math.min(taCount, 3); i++) {
      try {
        await textareas.nth(i).click();
        await page.keyboard.type([NSM_ANSWERS.step2_a, NSM_ANSWERS.step2_b, NSM_ANSWERS.step2_c][i] || '補充說明', { delay: 3 });
      } catch {}
    }
    await softClick(page, page.locator('button:has-text("下一步"), button:has-text("提交")').first(), 6000);
    await page.waitForTimeout(800);
    await safeScreenshot(page, projDir, '15-nsm-step-3');

    await fillFirstTextarea(page, NSM_ANSWERS.step3);
    await softClick(page, page.locator('button:has-text("下一步"), button:has-text("提交")').first(), 6000);
    await page.waitForTimeout(1500);
    await safeScreenshot(page, projDir, '16-nsm-step-4');
  } else {
    await safeScreenshot(page, projDir, '13-nsm-no-card');
  }

  // ── Step 17: review-examples ──────────────────────────────────
  await page.goto('/review-examples.html', { waitUntil: 'networkidle' });
  await safeScreenshot(page, projDir, '17-review-examples');

  // ── Step 18: login modal ──────────────────────────────────────
  await page.goto('/');
  const loginBtn = page.locator('button:has-text("登入"), a:has-text("登入")').first();
  if (await loginBtn.isVisible().catch(() => false)) {
    await softClick(page, loginBtn);
    await page.waitForTimeout(400);
    await safeScreenshot(page, projDir, '18-login-screen');
  } else {
    await safeScreenshot(page, projDir, '18-login-not-found');
  }

  // ── Persist console / pageerror logs ──────────────────────────
  fs.writeFileSync(
    path.join('audit/console', `${proj}.json`),
    JSON.stringify({ project: proj, consoleErrors, pageErrors }, null, 2)
  );

  // Soft assertion — fail the test if there were page-level errors,
  // but only as a signal; screenshots already captured.
  expect.soft(pageErrors.length, `page-level JS errors on ${proj}`).toBe(0);
});
