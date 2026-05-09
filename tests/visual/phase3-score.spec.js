// tests/visual/phase3-score.spec.js
// Plan B Phase 3 — Phase 3 步驟分數 (mockup 11) visual + functional specs
// TDD: write failing specs first, then implement renderer + CSS

const { test, expect } = require('@playwright/test');

const SAMPLE_SCORE_HIGH = {
  totalScore: 78,
  dimensions: [
    { name: '清晰度', score: 4, comment: '用戶分群清楚切出付費 / 免費兩個 segment。', coachVersion: { name: '清晰度', score: 5, text: '把目標用戶切成「30 天內註冊但未養成日常收聽習慣的免費用戶」，並用一句話標明選這群的原因。' }, suggestion: '在分群名稱後加上規模量化（例：~ 850 萬人 / 月）。' },
    { name: '邏輯性', score: 3, comment: '分群與場景之間的因果鏈不夠緊。', coachVersion: { name: '邏輯性', score: 4, text: '先列「假設這群人留存差是因為缺乏 daily habit anchor」，再用 1 句話說明 podcast 為何適合當錨點。' }, suggestion: '把你的假設寫成可驗證的「If X, then Y」格式。' },
    { name: '完整度', score: 3, comment: '少了「次要分群」的對照。', coachVersion: { name: '完整度', score: 4, text: '補一個「對照分群：已養成日常 podcast 習慣的付費用戶」並指出他們的 30 日留存比例。' }, suggestion: '為每個分群提供 1 個量化指標。' },
    { name: '洞察力', score: 4, comment: '「免費用戶聽 podcast 比例 < 12%」是個有 power 的觀察。', coachVersion: { name: '洞察力', score: 5, text: '繼續挖：那 12% 的人在用什麼 podcast 類型？這會直接影響你後面的方案設計。' }, suggestion: '把這個觀察與後續方案的 hypothesis 串起來。' },
  ],
  coachVersion: {
    context: '用戶分析（Identify users）是 CIRCLES 的第二步，目的是把問題從「全部用戶」收斂到「具體分群」。本步驟看的是分群清晰度 + 選擇邏輯。',
    perField: [
      { label: '列出候選分群', text: '付費用戶（~ 1.2 億）/ 免費用戶（~ 4 億）/ 新註冊未養成習慣（~ 850 萬 / 月）/ 既有但流失中（~ 1500 萬 / 季）。' },
      { label: '選定焦點分群', text: '焦點：「新註冊但 30 天內未養成日常收聽習慣」的免費用戶（~ 850 萬 / 月）。' },
      { label: '選擇理由', text: '商業重要：30 天留存是付費轉換最強的領先指標。可解性：podcast 比音樂更易養成 daily habit。' },
      { label: '用戶動機假設', text: '假設：「新用戶想要每日通勤時段的背景音」，可被訪談 / 數據驗證。' },
    ],
    reasoning: '分群必須附量化規模 + 商業重要性，否則只是描述不是論述。選定理由用「商業重要 × 可解性」二維度，比單一理由更有說服力。',
  },
  strengths: '明確區分付費 / 免費用戶兩個分群，並指出付費用戶聽 Podcast 比例不到 12%，是清楚的目標焦點。',
  improvements: '用戶動機假設「用戶喜歡 podcast」缺乏可檢驗性，建議補上具體訪談或數據佐證。',
};

const SAMPLE_SCORE_LOW = {
  totalScore: 52,
  dimensions: [
    { name: '清晰度', score: 3, comment: '分群命名直接但缺少業務脈絡。', coachVersion: { name: '清晰度', score: 4, text: '「30 歲女性中，每月使用 podcast 少於 2 小時的免費訂戶」— 加 1 個量化條件就把「形容詞」轉成「行為」。' }, suggestion: '每個分群附 1 個行為量化標準。' },
    { name: '邏輯性', score: 1, comment: '分群選擇沒有理由：直接寫「目標用戶 = 30 歲女性」。', coachVersion: { name: '邏輯性', score: 4, text: '先列出 3-5 個候選分群（每群附量化指標 + 1 句業務影響），再從中選 1 群為焦點。' }, suggestion: '補一句「我選這群是因為 ___（量化原因）」。' },
    { name: '完整度', score: 3, comment: '只列了一個分群，缺少對照組讓論述沒有錨點。', coachVersion: { name: '完整度', score: 4, text: '至少列 3 個候選分群並寫對照。' }, suggestion: '補對照分群增加論述厚度。' },
    { name: '洞察力', score: 3, comment: '沒有量化的「不顯而易見」觀察 — 純 demographic 描述。', coachVersion: { name: '洞察力', score: 4, text: '提一個「業內人才知道」的觀察。' }, suggestion: '用行為時序資料找 non-trivial pattern。' },
  ],
  coachVersion: {
    context: '用戶分析（Identify users）是 CIRCLES 的第二步，目的是把問題從「全部用戶」收斂到「具體分群」。沒有清楚的目標用戶，後面的需求 / 方案會散開、無法 prioritise。本步驟看的是分群清晰度 + 選擇邏輯。',
    perField: [
      { label: '列出候選分群', text: '付費用戶（~ 1.2 億）/ 免費用戶（~ 4 億）/ 新註冊未養成習慣（~ 850 萬 / 月）/ 既有但流失中（~ 1500 萬 / 季）。' },
      { label: '選定焦點分群', text: '焦點：「新註冊但 30 天內未養成日常收聽習慣」的免費用戶（~ 850 萬 / 月）。' },
      { label: '選擇理由', text: '商業重要：30 天留存是付費轉換最強的領先指標。可解性：podcast 比音樂更易養成 daily habit（時長足夠、被動消費）。' },
      { label: '用戶動機假設', text: '假設：「新用戶想要每日通勤時段的背景音」，可被訪談 / 數據驗證（用 commute window 收聽行為）。' },
    ],
    reasoning: '分群必須附量化規模 + 商業重要性，否則只是描述不是論述。選定理由用「商業重要 × 可解性」二維度，比單一理由更有說服力。動機假設用「If X, then Y」格式才能被驗證，避免陷入「我覺得用戶喜歡 podcast」的主觀宣告陷阱。',
  },
  strengths: '識別了「30 歲女性」這個明確分群，命名清楚不模糊。',
  improvements: '缺少「為什麼選這群」的論述邏輯與量化依據，這是邏輯性低分主因。',
};

async function mockApis(page) {
  await page.route('**/api/circles-stats', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"completed":0,"active":0,"thisWeek":0}' }));
  await page.route('**/api/guest-circles-stats', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"completed":0,"active":0,"thisWeek":0}' }));
  await page.route('**/api/circles-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/guest-circles-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/nsm-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/guest-nsm-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
}

async function setupPhase3(page, { scoreResult, errorState, noScore } = {}) {
  await mockApis(page);
  await page.goto('/');
  await page.waitForSelector('.navbar');
  await page.evaluate(({ scoreResult, errorState, noScore }) => {
    Object.assign(window.AppState, {
      view: 'circles',
      circlesPhase: 3,
      circlesMode: 'drill',
      circlesDrillStep: 'I',
      circlesSession: { id: 'sess-1' },
      circlesSelectedQuestion: { id: 'q1', company: 'Spotify', product: 'Spotify Podcast', question_type: 'design' },
      circlesScoreResult: noScore ? null : (scoreResult || null),
      circlesPhase3Error: errorState || null,
      circlesPhase3LoadingStep: 1, // start at 1: 解析框架 already done (per mockup 11)
      circlesPhase3DimExpanded: {},
      circlesPhase3CoachDemoOpen: false,
    });
    window.render();
  }, { scoreResult, errorState, noScore });
}

// ── P3-1: Router scaffolding ──────────────────────────────────────────────────
test.describe('P3-1 Router', () => {
  test('Phase 3 router: circlesPhase=3 + session + scoreResult → renderCirclesPhase3 not stub', async ({ page }) => {
    await setupPhase3(page, { scoreResult: SAMPLE_SCORE_HIGH });
    await expect(page.locator('[data-view="circles"][data-phase="3"]')).toBeVisible();
    await expect(page.locator('text=待 Plan B 實作')).toHaveCount(0);
  });

  test('Phase 3 router: circlesPhase=3 + session + no score → Section C Loading', async ({ page }) => {
    await setupPhase3(page, { noScore: true });
    await expect(page.locator('[data-view="circles"][data-phase="3"]')).toBeVisible();
    await expect(page.locator('.loading-wrap')).toBeVisible();
  });

  test('Phase 3 router: circlesPhase=3 + error state → Section D Error', async ({ page }) => {
    await setupPhase3(page, { errorState: { code: 'EVAL_TIMEOUT', message: 'timeout' } });
    await expect(page.locator('[data-view="circles"][data-phase="3"]')).toBeVisible();
    await expect(page.locator('.error-wrap')).toBeVisible();
  });
});

// ── P3-2: Section A default state ─────────────────────────────────────────────
test.describe('P3-2 Section A (high score)', () => {
  test('Section A: score-total displays 78', async ({ page }) => {
    await setupPhase3(page, { scoreResult: SAMPLE_SCORE_HIGH });
    await expect(page.locator('.score-total__num')).toContainText('78');
  });

  test('Section A: 4 dim-rows visible', async ({ page }) => {
    await setupPhase3(page, { scoreResult: SAMPLE_SCORE_HIGH });
    const dimRows = page.locator('.dim-row');
    await expect(dimRows).toHaveCount(4);
  });

  test('Section A: highlight-card--good and highlight-card--improve visible', async ({ page }) => {
    await setupPhase3(page, { scoreResult: SAMPLE_SCORE_HIGH });
    await expect(page.locator('.highlight-card--good')).toBeVisible();
    await expect(page.locator('.highlight-card--improve')).toBeVisible();
  });

  test('Section A: coach-demo collapsed by default (no low score dim)', async ({ page }) => {
    await setupPhase3(page, { scoreResult: SAMPLE_SCORE_HIGH });
    const coachDemo = page.locator('.coach-demo');
    await expect(coachDemo).toBeVisible();
    // Should NOT have is-open class since all dims >= 3
    await expect(coachDemo).not.toHaveClass(/is-open/);
  });

  test('Section A: submit-bar with 回首頁 + 再練一題 buttons', async ({ page }) => {
    await setupPhase3(page, { scoreResult: SAMPLE_SCORE_HIGH });
    await expect(page.locator('.submit-bar')).toBeVisible();
    await expect(page.locator('[data-phase3="go-home"]')).toBeVisible();
    await expect(page.locator('[data-phase3="retry-question"]')).toBeVisible();
  });

  test('Section A desktop: dim-rows auto-expanded showing body content', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await setupPhase3(page, { scoreResult: SAMPLE_SCORE_HIGH });
    // On desktop (≥1024px), dims should be open
    const dimBodies = page.locator('.dim-row__body');
    // All 4 should be visible on desktop
    await expect(dimBodies.first()).toBeVisible();
  });

  test('Section A mobile: dim-rows collapsed (body hidden)', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await setupPhase3(page, { scoreResult: SAMPLE_SCORE_HIGH });
    // On mobile, dims should be collapsed unless is-low score
    const firstDimBody = page.locator('.dim-row').first().locator('.dim-row__body');
    await expect(firstDimBody).toBeHidden();
  });

  test('Section A: circles-nav back button visible', async ({ page }) => {
    await setupPhase3(page, { scoreResult: SAMPLE_SCORE_HIGH });
    await expect(page.locator('.circles-nav')).toBeVisible();
    await expect(page.locator('.circles-nav__back')).toBeVisible();
  });

  test('Section A: circles-progress bar shows 7 steps', async ({ page }) => {
    await setupPhase3(page, { scoreResult: SAMPLE_SCORE_HIGH });
    await expect(page.locator('.circles-progress')).toBeVisible();
    const steps = page.locator('.circles-progress__step');
    await expect(steps).toHaveCount(7);
  });
});

// ── P3-3: Section B auto-expand + coach-demo ──────────────────────────────────
test.describe('P3-3 Section B (low score)', () => {
  test('Section B: score-total displays 52', async ({ page }) => {
    await setupPhase3(page, { scoreResult: SAMPLE_SCORE_LOW });
    await expect(page.locator('.score-total__num')).toContainText('52');
  });

  test('Section B: low-score dim (邏輯性 score=1) has is-low and is-open on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await setupPhase3(page, { scoreResult: SAMPLE_SCORE_LOW });
    // The 邏輯性 dim (score=1) should have is-low is-open
    const dimRows = page.locator('.dim-row');
    const secondDim = dimRows.nth(1); // 邏輯性 is 2nd dim
    await expect(secondDim).toHaveClass(/is-low/);
    await expect(secondDim).toHaveClass(/is-open/);
  });

  test('Section B: low-score dim body visible (comment + coach-version + tip)', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await setupPhase3(page, { scoreResult: SAMPLE_SCORE_LOW });
    const secondDim = page.locator('.dim-row').nth(1);
    await expect(secondDim.locator('.dim-row__body')).toBeVisible();
    await expect(secondDim.locator('.dim-row__comment')).toBeVisible();
    await expect(secondDim.locator('.dim-row__coach-version')).toBeVisible();
    await expect(secondDim.locator('.dim-row__tip')).toBeVisible();
  });

  test('Section B: coach-demo auto-open when dim ≤ 2 exists', async ({ page }) => {
    await setupPhase3(page, { scoreResult: SAMPLE_SCORE_LOW });
    await expect(page.locator('.coach-demo')).toHaveClass(/is-open/);
  });

  test('Section B: coach-demo body has 3 sections', async ({ page }) => {
    await setupPhase3(page, { scoreResult: SAMPLE_SCORE_LOW });
    const sections = page.locator('.coach-section');
    expect(await sections.count()).toBeGreaterThanOrEqual(3);
  });

  test('Section B: coach-demo perField iterates 4 sub-blocks', async ({ page }) => {
    await setupPhase3(page, { scoreResult: SAMPLE_SCORE_LOW });
    const fields = page.locator('.coach-field');
    await expect(fields).toHaveCount(4);
  });

  test('Section B: dim ≤ 2 bar fill uses warn color class', async ({ page }) => {
    await setupPhase3(page, { scoreResult: SAMPLE_SCORE_LOW });
    const secondDim = page.locator('.dim-row').nth(1);
    await expect(secondDim).toHaveClass(/is-low/);
    // bar-fill should be warn colored via is-low modifier
    await expect(secondDim.locator('.dim-row__bar-fill')).toBeVisible();
  });
});

// ── P3-4: Section C Loading + Section D Error ─────────────────────────────────
test.describe('P3-4 Section C Loading', () => {
  test('Loading: spinner visible', async ({ page }) => {
    await setupPhase3(page, { noScore: true });
    await expect(page.locator('.loading-spinner')).toBeVisible();
  });

  test('Loading: title 正在生成評分 visible', async ({ page }) => {
    await setupPhase3(page, { noScore: true });
    await expect(page.locator('.loading-title')).toContainText('正在生成評分');
  });

  test('Loading: 4-step checklist items visible', async ({ page }) => {
    await setupPhase3(page, { noScore: true });
    const steps = page.locator('.loading-step');
    await expect(steps).toHaveCount(4);
  });

  test('Loading: step 0 is-done, step 1 is-active at start (loadingStep=1 default)', async ({ page }) => {
    // mockup 11 shows 解析框架 already done when entering loading state
    await setupPhase3(page, { noScore: true });
    // loadingStep defaults to 1: step 0 done, step 1 active
    await expect(page.locator('.loading-step.is-done')).toHaveCount(1);
    await expect(page.locator('.loading-step.is-active')).toHaveCount(1);
  });

  test('Loading: no submit-bar during loading', async ({ page }) => {
    await setupPhase3(page, { noScore: true });
    await expect(page.locator('.submit-bar')).toHaveCount(0);
  });

  test('Loading: advancing to step 3 when circlesPhase3LoadingStep=3', async ({ page }) => {
    await setupPhase3(page, { noScore: true });
    await page.evaluate(() => {
      window.AppState.circlesPhase3LoadingStep = 3;
      window.render();
    });
    await expect(page.locator('.loading-step.is-done')).toHaveCount(3);
    await expect(page.locator('.loading-step.is-active')).toHaveCount(1);
  });
});

test.describe('P3-4 Section D Error', () => {
  test('Error EVAL_TIMEOUT: error-wrap visible + correct sub copy', async ({ page }) => {
    await setupPhase3(page, { errorState: { code: 'EVAL_TIMEOUT', message: 'timeout' } });
    await expect(page.locator('.error-wrap')).toBeVisible();
    await expect(page.locator('.error-wrap__title')).toContainText('評分生成失敗');
    await expect(page.locator('.error-wrap__sub')).toContainText('AI 服務暫時無法回應');
  });

  test('Error EVAL_API_ERROR: correct title + sub copy (mockup 12 §B)', async ({ page }) => {
    await setupPhase3(page, { errorState: { code: 'EVAL_API_ERROR', message: 'api error' } });
    // title = 評分服務暫時不可用 (per mockup 12)
    await expect(page.locator('.error-wrap__title')).toContainText('評分服務暫時不可用');
    // sub = 伺服器忙線 (per mockup 12)
    await expect(page.locator('.error-wrap__sub')).toContainText('伺服器忙線中');
  });

  test('Error EVAL_PARSE_ERROR: correct title + sub copy (mockup 12 §C)', async ({ page }) => {
    await setupPhase3(page, { errorState: { code: 'EVAL_PARSE_ERROR', message: 'parse error' } });
    // title = 教練回應格式異常 (per mockup 12)
    await expect(page.locator('.error-wrap__title')).toContainText('教練回應格式異常');
    // sub = 無法正確解析 (per mockup 12)
    await expect(page.locator('.error-wrap__sub')).toContainText('無法正確解析');
  });

  test('Error: error-code badge visible with error code text', async ({ page }) => {
    await setupPhase3(page, { errorState: { code: 'EVAL_TIMEOUT', message: 'timeout' } });
    await expect(page.locator('.error-wrap__code')).toBeVisible();
    await expect(page.locator('.error-wrap__code')).toContainText('EVAL_TIMEOUT');
  });

  test('Error: 重新評分 and 返回修改答案 buttons visible', async ({ page }) => {
    await setupPhase3(page, { errorState: { code: 'EVAL_TIMEOUT', message: 'timeout' } });
    await expect(page.locator('[data-phase3="retry"]')).toBeVisible();
    await expect(page.locator('[data-phase3="back-to-phase1"]')).toBeVisible();
  });

  test('Error: retry button clears error state (transitions to loading or score)', async ({ page }) => {
    await mockApis(page);
    // Mock evaluate-step to return success
    await page.route('**/api/guest-circles-sessions/**/evaluate-step', r => r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(SAMPLE_SCORE_HIGH),
    }));
    await setupPhase3(page, { errorState: { code: 'EVAL_TIMEOUT', message: 'timeout' } });
    await expect(page.locator('[data-phase3="retry"]')).toBeVisible();
    await page.locator('[data-phase3="retry"]').click();
    // After retry: error cleared — may show loading briefly or go directly to score
    await expect(page.locator('.error-wrap')).toHaveCount(0);
    // Either loading or score visible (API may resolve synchronously)
    const isLoading = await page.locator('.loading-wrap').isVisible();
    const isScore = await page.locator('.score-total').isVisible();
    expect(isLoading || isScore).toBe(true);
  });

  test('Error: back-to-phase1 button navigates to Phase 1', async ({ page }) => {
    await setupPhase3(page, { errorState: { code: 'EVAL_TIMEOUT', message: 'timeout' } });
    await page.locator('[data-phase3="back-to-phase1"]').click();
    // Should navigate back to phase 1
    await expect(page.locator('[data-view="circles"][data-phase="3"]')).toHaveCount(0);
  });
});

// ── dim-row toggle interaction ────────────────────────────────────────────────
test.describe('dim-row toggle', () => {
  test('Clicking dim-row head on mobile toggles is-open', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await setupPhase3(page, { scoreResult: SAMPLE_SCORE_HIGH });
    // First dim should be closed (score 4 = not low, mobile = collapsed)
    const firstDim = page.locator('.dim-row').first();
    await expect(firstDim).not.toHaveClass(/is-open/);
    // Click the head
    await firstDim.locator('.dim-row__head').click();
    await expect(firstDim).toHaveClass(/is-open/);
  });
});

// ── coach-demo toggle interaction ─────────────────────────────────────────────
test.describe('coach-demo toggle', () => {
  test('Clicking coach-demo head toggles is-open', async ({ page }) => {
    await setupPhase3(page, { scoreResult: SAMPLE_SCORE_HIGH });
    const coachDemo = page.locator('.coach-demo');
    await expect(coachDemo).not.toHaveClass(/is-open/);
    await coachDemo.locator('.coach-demo__head').click();
    await expect(coachDemo).toHaveClass(/is-open/);
  });
});
