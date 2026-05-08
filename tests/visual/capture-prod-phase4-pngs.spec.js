// tests/visual/capture-prod-phase4-pngs.spec.js
// Capture 9 production PNGs: sections A/B/C × mobile/tablet/desktop
// Output: audit/png-prod-mockup-13/section-{A,B,C}-{mobile,tablet,desktop}.png

const { test } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const OUT_DIR = path.join(__dirname, '../../audit/png-prod-mockup-13');

const SAMPLE_STEP_SCORES = {
  C1: { totalScore: 78, highlight: '邊界與成功指標清晰，可再強化「時間框架」具體性（例：30 / 60 / 90 天 milestone）', improvement: '加強時間框架具體性' },
  I:  { totalScore: 82, highlight: '分群清楚並佐以行為數據，是本次最強亮點；持續強化此能力', improvement: '強化行為數據量化' },
  R:  { totalScore: 75, highlight: '痛點到位，建議補上競品對比（Apple Podcast / YouTube Music）佐證需求合理性', improvement: '補競品對比' },
  C2: { totalScore: 70, highlight: '缺明確優先級框架（建議套 RICE / ICE 等量化模型佐證排序邏輯）', improvement: '缺 RICE/ICE 框架' },
  L:  { totalScore: 85, highlight: '3 方案各對應不同分群，結構紮實；可進一步加入線框圖或互動 flow 強化', improvement: '可加 flow 圖' },
  E:  { totalScore: 68, highlight: '本次最弱。每方案的開發成本（人月）與預期收益（ARPU / 留存）需具體量化', improvement: '量化開發成本與收益' },
  S:  { totalScore: 80, highlight: '北極星指標明確，4 dim 追蹤指標具體可操作', improvement: '4 dim 追蹤可更具體' },
};

const SAMPLE_FINAL_REPORT = {
  overallScore: 77,
  grade: 'B',
  headline: '七步框架掌握扎實，整體論述清晰；最強在 I 用戶與 L 方案，下一步建議補強 E 取捨的量化能力',
  strengths: [
    '在 C 釐清與 L 方案兩步提出明確的成功指標與量化目標',
    'I 用戶分析具體區分付費 / 免費分群並佐以行為數據',
    'L 方案規劃條理清楚，3 個方案各自對應不同分群痛點',
  ],
  improvements: [
    'E 取捨需要更具體量化每個方案的開發成本與預期收益',
    'C2 排序的優先順序缺乏明確的優先級框架說明',
    'R 需求步驟可加入競品對比強化論述',
  ],
  coachVerdict: '整體論述邏輯通順、結構完整。最強的部分是用戶分析與方案規劃；下一步建議鎖定 E 取捨的量化能力，建議透過更多商業案例練習。',
  nextSteps: '建議再加練 1 次取捨型題目（產品策略 ×25 中任選），重點放在量化開發成本與預期收益。',
};

async function mockApis(page) {
  await page.route('**/api/circles-stats', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"completed":0,"active":0,"thisWeek":0}' }));
  await page.route('**/api/guest-circles-stats', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"completed":0,"active":0,"thisWeek":0}' }));
  await page.route('**/api/circles-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/guest-circles-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/nsm-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/guest-nsm-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
}

const VIEWPORTS = [
  { name: 'mobile',   width: 360,  height: 1100 },
  { name: 'tablet',   width: 768,  height: 1100 },
  { name: 'desktop',  width: 1280, height: 1100 },
];

test.describe('capture-prod-phase4 — 9 production PNGs', () => {
  test.setTimeout(120000);

  test('Section A — success report (77 分) × 3 viewports', async ({ page }) => {
    await mockApis(page);
    if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/');
      await page.waitForSelector('.navbar');
      await page.evaluate(({ SAMPLE_FINAL_REPORT, SAMPLE_STEP_SCORES }) => {
        Object.assign(window.AppState, {
          view: 'circles',
          circlesPhase: 4,
          circlesMode: 'simulation',
          circlesSession: { id: 'sess-1' },
          circlesSelectedQuestion: { id: 'q1', company: 'Spotify', product: 'Spotify Podcast', question_type: 'design' },
          circlesFinalReport: SAMPLE_FINAL_REPORT,
          circlesPhase4Error: null,
          circlesPhase4LoadingStep: 0,
          circlesStepScores: SAMPLE_STEP_SCORES,
          _phase4FinalReportFired: true,
        });
        window.AppState._phase4FinalReportFired = true;
        window.render();
      }, { SAMPLE_FINAL_REPORT, SAMPLE_STEP_SCORES });
      await page.waitForSelector('.grade-card');
      const out = path.join(OUT_DIR, 'section-A-' + vp.name + '.png');
      await page.screenshot({ path: out, fullPage: true });
    }
  });

  test('Section B — loading × 3 viewports', async ({ page }) => {
    await mockApis(page);
    // Never respond to final-report — keep loading state
    await page.route('**/*circles-sessions/*/final-report', () => { /* intentionally hang */ });
    if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/');
      await page.waitForSelector('.navbar');
      await page.evaluate(({ SAMPLE_STEP_SCORES }) => {
        Object.assign(window.AppState, {
          view: 'circles',
          circlesPhase: 4,
          circlesMode: 'simulation',
          circlesSession: { id: 'sess-1' },
          circlesSelectedQuestion: { id: 'q1', company: 'Spotify', product: 'Spotify Podcast', question_type: 'design' },
          circlesFinalReport: null,
          circlesPhase4Error: null,
          circlesPhase4LoadingStep: 1, // show 彙整七步驟資料 done + 計算總分 active
          circlesStepScores: SAMPLE_STEP_SCORES,
        });
        window.AppState._phase4FinalReportFired = true; // prevent auto-fire
        window.render();
      }, { SAMPLE_STEP_SCORES });
      await page.waitForSelector('.loading-spinner');
      const out = path.join(OUT_DIR, 'section-B-' + vp.name + '.png');
      await page.screenshot({ path: out, fullPage: true });
    }
  });

  test('Section C — error REPORT_API_ERROR × 3 viewports', async ({ page }) => {
    await mockApis(page);
    if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/');
      await page.waitForSelector('.navbar');
      await page.evaluate(({ SAMPLE_STEP_SCORES }) => {
        Object.assign(window.AppState, {
          view: 'circles',
          circlesPhase: 4,
          circlesMode: 'simulation',
          circlesSession: { id: 'sess-1' },
          circlesSelectedQuestion: { id: 'q1', company: 'Spotify', product: 'Spotify Podcast', question_type: 'design' },
          circlesFinalReport: null,
          circlesPhase4Error: { code: 'REPORT_API_ERROR', message: '總結報告 API 暫時不可用' },
          circlesPhase4LoadingStep: 0,
          circlesStepScores: SAMPLE_STEP_SCORES,
          _phase4FinalReportFired: true,
        });
        window.AppState._phase4FinalReportFired = true;
        window.render();
      }, { SAMPLE_STEP_SCORES });
      await page.waitForSelector('.error-wrap');
      const out = path.join(OUT_DIR, 'section-C-' + vp.name + '.png');
      await page.screenshot({ path: out, fullPage: true });
    }
  });
});
