// tests/visual/phase4-final.spec.js
// Plan B Phase 4 — Phase 4 模擬面試總結報告 (mockup 13) visual + functional specs
// TDD: write failing specs first, then implement renderer + CSS

const { test, expect } = require('@playwright/test');

const SAMPLE_STEP_SCORES = {
  C1: { totalScore: 78, highlight: '邊界與成功指標清晰', improvement: '加強時間框架具體性' },
  I:  { totalScore: 82, highlight: '分群清楚並佐以行為數據', improvement: '強化行為數據量化' },
  R:  { totalScore: 75, highlight: '痛點到位', improvement: '補競品對比' },
  C2: { totalScore: 70, highlight: '具體優先序', improvement: '缺 RICE/ICE 框架' },
  L:  { totalScore: 85, highlight: '3 方案結構紮實', improvement: '可加 flow 圖' },
  E:  { totalScore: 68, highlight: '定性分析 OK', improvement: '量化開發成本與收益' },
  S:  { totalScore: 80, highlight: '北極星指標明確', improvement: '4 dim 追蹤可更具體' },
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

async function mockApis(page, { slowFinalReport = false } = {}) {
  await page.route('**/api/circles-stats', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"completed":0,"active":0,"thisWeek":0}' }));
  await page.route('**/api/guest-circles-stats', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"completed":0,"active":0,"thisWeek":0}' }));
  await page.route('**/api/circles-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/guest-circles-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/nsm-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/guest-nsm-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  // final-report endpoint — slow (pending) when testing loading state, success otherwise
  if (slowFinalReport) {
    // Never respond — keeps loading state active
    await page.route('**/*circles-sessions/*/final-report', () => { /* intentionally hang */ });
  } else {
    await page.route('**/*circles-sessions/*/final-report', r => r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(SAMPLE_FINAL_REPORT),
    }));
  }
}

async function setupPhase4(page, { finalReport, errorState, noReport, stepScores } = {}) {
  // Use slow final-report mock when testing loading state (noReport=true)
  await mockApis(page, { slowFinalReport: !!noReport });
  await page.goto('/');
  await page.waitForSelector('.navbar');
  await page.evaluate(({ finalReport, errorState, noReport, stepScores, SAMPLE_FINAL_REPORT, SAMPLE_STEP_SCORES }) => {
    Object.assign(window.AppState, {
      view: 'circles',
      circlesPhase: 4,
      circlesMode: 'simulation',
      circlesSession: { id: 'sess-1' },
      circlesSelectedQuestion: { id: 'q1', company: 'Spotify', product: 'Spotify Podcast', question_type: 'design' },
      circlesFinalReport: noReport ? null : (finalReport !== undefined ? finalReport : SAMPLE_FINAL_REPORT),
      circlesPhase4Error: errorState || null,
      circlesPhase4LoadingStep: 0,
      circlesStepScores: stepScores || SAMPLE_STEP_SCORES,
      // Prevent auto-fire from triggering in tests (already set report)
      _phase4FinalReportFired: !noReport && !errorState,
    });
    window.AppState._phase4FinalReportFired = !noReport && !errorState;
    window.render();
  }, { finalReport, errorState, noReport, stepScores, SAMPLE_FINAL_REPORT, SAMPLE_STEP_SCORES });
}

// ── P4-1: Router scaffolding ──────────────────────────────────────────────

test('P4-1: Phase 4 router — phase=4 + session → data-phase="4" not stub', async ({ page }) => {
  await setupPhase4(page);
  await expect(page.locator('[data-view="circles"][data-phase="4"]')).toBeVisible();
  await expect(page.locator('text=待 Plan B 實作')).toHaveCount(0);
});

test('P4-1: Phase 4 router — phase=3 still routes to phase 3 (no regression)', async ({ page }) => {
  await mockApis(page);
  await page.goto('/');
  await page.waitForSelector('.navbar');
  await page.evaluate(() => {
    Object.assign(window.AppState, {
      view: 'circles',
      circlesPhase: 3,
      circlesMode: 'drill',
      circlesDrillStep: 'C1',
      circlesSession: { id: 'sess-1' },
      circlesSelectedQuestion: { id: 'q1', company: 'Spotify', product: 'Spotify Podcast' },
      circlesPhase3Error: null,
      circlesPhase3LoadingStep: 1,
      circlesScoreResult: null,
    });
    window.render();
  });
  await expect(page.locator('[data-view="circles"][data-phase="3"]')).toBeVisible();
});

// ── P4-2: Section B Loading ───────────────────────────────────────────────

test('P4-2: Section B Loading — spinner + title + sub visible', async ({ page }) => {
  await setupPhase4(page, { noReport: true });
  const view = page.locator('[data-view="circles"][data-phase="4"]');
  await expect(view).toBeVisible();
  await expect(view.locator('.loading-spinner')).toBeVisible();
  await expect(view.locator('.loading-title')).toContainText('生成總結報告中');
  await expect(view.locator('.loading-sub')).toContainText('30-60');
});

test('P4-2: Section B Loading — 4-step checklist present', async ({ page }) => {
  await setupPhase4(page, { noReport: true });
  const view = page.locator('[data-view="circles"][data-phase="4"]');
  const checklist = view.locator('.loading-checklist');
  await expect(checklist).toBeVisible();
  const steps = checklist.locator('.loading-step');
  await expect(steps).toHaveCount(4);
  await expect(steps.nth(0)).toContainText('彙整七步驟資料');
  await expect(steps.nth(1)).toContainText('計算總分與評等');
  await expect(steps.nth(2)).toContainText('生成 7-axis 雷達圖');
  await expect(steps.nth(3)).toContainText('整理改進建議');
});

test('P4-2: Section B Loading — checklist step advances with loadingStep AppState', async ({ page }) => {
  await setupPhase4(page, { noReport: true });
  // Advance to step 2 programmatically
  await page.evaluate(() => {
    window.AppState.circlesPhase4LoadingStep = 2;
    window._phase4FinalReportFired = true; // prevent re-fire
    window.render();
  });
  const checklist = page.locator('.loading-checklist');
  const steps = checklist.locator('.loading-step');
  await expect(steps.nth(0)).toHaveClass(/is-done/);
  await expect(steps.nth(1)).toHaveClass(/is-done/);
  await expect(steps.nth(2)).toHaveClass(/is-active/);
  await expect(steps.nth(3)).toHaveClass(/is-pending/);
});

test('P4-2: Section B Loading — 60s timeout fires REPORT_TIMEOUT error', async ({ page }) => {
  await page.clock.install();
  await setupPhase4(page, { noReport: true });
  await expect(page.locator('.loading-spinner')).toBeVisible();
  // Fast-forward 61 seconds
  await page.clock.fastForward(61000);
  await expect(page.locator('.error-wrap__title')).toContainText('報告生成失敗');
  await expect(page.locator('.error-wrap__code')).toContainText('REPORT_TIMEOUT');
});

test('P4-2: Section B Loading — auto-fire calls final-report endpoint', async ({ page }) => {
  let endpointCalled = false;
  // Set up the spy route BEFORE other routes (covers both auth + guest endpoints)
  await page.route('**/*circles-sessions/*/final-report', async (route) => {
    endpointCalled = true;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(SAMPLE_FINAL_REPORT) });
  });
  // Set up other API mocks (these won't override the one above for final-report)
  await page.route('**/api/circles-stats', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"completed":0,"active":0,"thisWeek":0}' }));
  await page.route('**/api/guest-circles-stats', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"completed":0,"active":0,"thisWeek":0}' }));
  await page.route('**/api/circles-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/guest-circles-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/nsm-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/guest-nsm-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.goto('/');
  await page.waitForSelector('.navbar');
  await page.evaluate(({ SAMPLE_STEP_SCORES }) => {
    Object.assign(window.AppState, {
      view: 'circles',
      circlesPhase: 4,
      circlesMode: 'simulation',
      circlesSession: { id: 'sess-1' },
      circlesSelectedQuestion: { id: 'q1', company: 'Spotify', product: 'Spotify Podcast' },
      circlesFinalReport: null,
      circlesPhase4Error: null,
      circlesPhase4LoadingStep: 0,
      circlesStepScores: SAMPLE_STEP_SCORES,
    });
    window.AppState._phase4FinalReportFired = false;
    window.render();
  }, { SAMPLE_STEP_SCORES });
  // Wait for the async auto-fire to complete
  await page.waitForTimeout(800);
  expect(endpointCalled).toBe(true);
});

// ── P4-3: Section A Success — score-summary + radar + step-rows ──────────

test('P4-3: Section A — grade-card with overall score visible', async ({ page }) => {
  await setupPhase4(page);
  const view = page.locator('[data-view="circles"][data-phase="4"]');
  await expect(view.locator('.grade-card')).toBeVisible();
  await expect(view.locator('.grade-card__score-num')).toContainText('77');
  await expect(view.locator('.grade-card__score-unit')).toContainText('分');
  await expect(view.locator('.grade-card__headline')).toContainText('七步框架');
});

test('P4-3: Section A — radar SVG polygon rendered with 7 vertices', async ({ page }) => {
  await setupPhase4(page);
  const radar = page.locator('.radar-svg');
  await expect(radar).toBeVisible();
  // polygon.poly should have 7 points (7 comma-separated pairs)
  const polyPoints = await radar.locator('.poly').getAttribute('points');
  expect(polyPoints).toBeTruthy();
  const pairs = (polyPoints || '').trim().split(/\s+/);
  expect(pairs.length).toBe(7);
});

test('P4-3: Section A — 7 step-rows rendered (one per CIRCLES step)', async ({ page }) => {
  await setupPhase4(page);
  const rows = page.locator('.step-rows__row');
  await expect(rows).toHaveCount(7);
});

test('P4-3: Section A — step-rows contain correct step letters and titles', async ({ page }) => {
  await setupPhase4(page);
  const view = page.locator('[data-view="circles"][data-phase="4"]');
  await expect(view.locator('.step-rows__name-key').nth(0)).toContainText('C');
  await expect(view.locator('.step-rows__name-key').nth(1)).toContainText('I');
  await expect(view.locator('.step-rows__name-key').nth(4)).toContainText('L');
  await expect(view.locator('.step-rows__name-key').nth(6)).toContainText('S');
});

test('P4-3: Section A — step-rows scores show correct values', async ({ page }) => {
  await setupPhase4(page);
  const view = page.locator('[data-view="circles"][data-phase="4"]');
  const scores = view.locator('.step-rows__score');
  await expect(scores.nth(0)).toContainText('78'); // C1
  await expect(scores.nth(1)).toContainText('82'); // I
  await expect(scores.nth(4)).toContainText('85'); // L
  await expect(scores.nth(5)).toContainText('68'); // E (low)
});

test('P4-3: Section A — score--high for ≥80, score--low for ≤69', async ({ page }) => {
  await setupPhase4(page);
  const view = page.locator('[data-view="circles"][data-phase="4"]');
  const scores = view.locator('.step-rows__score');
  // I = 82 → high
  await expect(scores.nth(1)).toHaveClass(/step-rows__score--high/);
  // L = 85 → high
  await expect(scores.nth(4)).toHaveClass(/step-rows__score--high/);
  // E = 68 → low
  await expect(scores.nth(5)).toHaveClass(/step-rows__score--low/);
  // C1 = 78 → mid (not high, not low)
  await expect(scores.nth(0)).toHaveClass(/step-rows__score--mid/);
});

test('P4-3: Section A — highlight text from stepScores shown in step-rows', async ({ page }) => {
  await setupPhase4(page);
  const view = page.locator('[data-view="circles"][data-phase="4"]');
  // C1 highlight: '邊界與成功指標清晰'
  await expect(view.locator('.step-rows__note').nth(0)).toContainText('邊界與成功指標清晰');
  // I highlight: '分群清楚並佐以行為數據'
  await expect(view.locator('.step-rows__note').nth(1)).toContainText('分群清楚並佐以行為數據');
});

test('P4-3: Section A — circles-nav shows 模擬面試總結報告 + company', async ({ page }) => {
  await setupPhase4(page);
  const nav = page.locator('.circles-nav');
  await expect(nav).toBeVisible();
  await expect(nav.locator('.circles-nav__title')).toContainText('模擬面試總結報告');
  await expect(nav.locator('.circles-nav__sub')).toContainText('Spotify');
});

// ── P4-4: Section A bottom + submit-bar + Section C Error + retry ─────────

test('P4-4: Section A — strengths section visible with 3 items', async ({ page }) => {
  await setupPhase4(page);
  const view = page.locator('[data-view="circles"][data-phase="4"]');
  const strengths = view.locator('.feedback-card--strengths');
  await expect(strengths).toBeVisible();
  await expect(strengths.locator('li')).toHaveCount(3);
  await expect(strengths.locator('li').nth(0)).toContainText('C 釐清');
});

test('P4-4: Section A — improvements section visible with 3 items', async ({ page }) => {
  await setupPhase4(page);
  const view = page.locator('[data-view="circles"][data-phase="4"]');
  const improvements = view.locator('.feedback-card--improvements');
  await expect(improvements).toBeVisible();
  await expect(improvements.locator('li')).toHaveCount(3);
  await expect(improvements.locator('li').nth(0)).toContainText('E 取捨');
});

test('P4-4: Section A — verdict card with coachVerdict text', async ({ page }) => {
  await setupPhase4(page);
  const view = page.locator('[data-view="circles"][data-phase="4"]');
  const verdict = view.locator('.feedback-card--verdict');
  await expect(verdict).toBeVisible();
  await expect(verdict.locator('.feedback-card__text')).toContainText('整體論述邏輯通順');
});

test('P4-4: Section A — nextsteps-card with nextSteps text', async ({ page }) => {
  await setupPhase4(page);
  const view = page.locator('[data-view="circles"][data-phase="4"]');
  const nextCard = view.locator('.nextsteps-card');
  await expect(nextCard).toBeVisible();
  await expect(nextCard).toContainText('建議下一步');
  await expect(nextCard).toContainText('取捨型題目');
});

test('P4-4: Section A — submit-bar with 匯出 PNG + 再練一題', async ({ page }) => {
  await setupPhase4(page);
  const bar = page.locator('.submit-bar');
  await expect(bar).toBeVisible();
  await expect(bar.locator('[data-phase4="export-png"]')).toContainText('匯出 PNG');
  await expect(bar.locator('[data-phase4="retry-question"]')).toContainText('再練一題');
});

test('P4-4: 再練一題 → goes to circles home (phase reset)', async ({ page }) => {
  await setupPhase4(page);
  await page.locator('[data-phase4="retry-question"]').click();
  await expect(page.locator('[data-view="circles"]')).toBeVisible();
  const phase = await page.evaluate(() => window.AppState.circlesPhase);
  expect(phase).toBe(1);
  const session = await page.evaluate(() => window.AppState.circlesSession);
  expect(session).toBeNull();
});

test('P4-4: Section C Error — REPORT_API_ERROR displays cloud-warning + error badge', async ({ page }) => {
  await setupPhase4(page, { errorState: { code: 'REPORT_API_ERROR', message: 'API down' } });
  const view = page.locator('[data-view="circles"][data-phase="4"]');
  await expect(view.locator('.error-wrap')).toBeVisible();
  await expect(view.locator('.error-wrap__icon i')).toHaveClass(/ph-cloud-warning/);
  await expect(view.locator('.error-wrap__title')).toContainText('報告生成失敗');
  await expect(view.locator('.error-wrap__code')).toContainText('REPORT_API_ERROR');
  await expect(view.locator('.error-wrap__sub')).toContainText('總結報告 API 暫時不可用');
});

test('P4-4: Section C Error — REPORT_TIMEOUT shows timeout sub copy', async ({ page }) => {
  await setupPhase4(page, { errorState: { code: 'REPORT_TIMEOUT', message: 'timeout' } });
  const view = page.locator('[data-view="circles"][data-phase="4"]');
  await expect(view.locator('.error-wrap__sub')).toContainText('超時');
  await expect(view.locator('.error-wrap__code')).toContainText('REPORT_TIMEOUT');
});

test('P4-4: Section C Error — REPORT_PARSE_ERROR shows parse sub copy', async ({ page }) => {
  await setupPhase4(page, { errorState: { code: 'REPORT_PARSE_ERROR', message: 'parse error' } });
  const view = page.locator('[data-view="circles"][data-phase="4"]');
  await expect(view.locator('.error-wrap__sub')).toContainText('格式異常');
  await expect(view.locator('.error-wrap__code')).toContainText('REPORT_PARSE_ERROR');
});

test('P4-4: Section C Error — 2 action buttons: 回首頁 (ghost) + 重試 (primary)', async ({ page }) => {
  await setupPhase4(page, { errorState: { code: 'REPORT_API_ERROR', message: 'API down' } });
  const view = page.locator('[data-view="circles"][data-phase="4"]');
  const actions = view.locator('.error-wrap__actions');
  await expect(actions.locator('[data-phase4="go-home"]')).toBeVisible();
  await expect(actions.locator('[data-phase4="retry"]')).toBeVisible();
});

test('P4-4: Retry click clears error + resets to loading state', async ({ page }) => {
  // Mock final-report to return success on retry (matches both auth + guest)
  await page.route('**/*circles-sessions/*/final-report', r => r.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify(SAMPLE_FINAL_REPORT),
  }));
  await setupPhase4(page, { errorState: { code: 'REPORT_API_ERROR', message: 'error' } });
  await expect(page.locator('[data-phase="4"] .error-wrap')).toBeVisible();
  await page.locator('[data-phase4="retry"]').click();
  // Should transition to loading (or success if API already fired)
  const view = page.locator('[data-view="circles"][data-phase="4"]');
  await expect(view).toBeVisible();
  // error should be gone
  await expect(view.locator('.error-wrap')).toHaveCount(0);
});

test('P4-4: 回首頁 in error state → goes home', async ({ page }) => {
  await setupPhase4(page, { errorState: { code: 'REPORT_API_ERROR', message: 'err' } });
  await page.locator('[data-phase4="go-home"]').first().click();
  const phase = await page.evaluate(() => window.AppState.circlesPhase);
  expect(phase).toBe(1);
  const session = await page.evaluate(() => window.AppState.circlesSession);
  expect(session).toBeNull();
});
