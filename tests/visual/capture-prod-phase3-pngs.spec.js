// tests/visual/capture-prod-phase3-pngs.spec.js
// Capture 12 production PNGs: sections A/B/C/D × mobile/tablet/desktop
// Output: audit/png-prod-mockup-11/section-{A,B,C,D}-{mobile,tablet,desktop}.png

const { test } = require('@playwright/test');
const path = require('path');

const OUT_DIR = path.join(__dirname, '../../audit/png-prod-mockup-11');

const SAMPLE_SCORE_HIGH = {
  totalScore: 78,
  dimensions: [
    { name: '清晰度', score: 4, comment: '用戶分群清楚切出付費 / 免費兩個 segment，命名與選擇邏輯都直接，讀者一看就知道你關注誰。', coachVersion: { name: '清晰度', score: 5, text: '把目標用戶切成「30 天內註冊但未養成日常收聽習慣的免費用戶」，並用一句話標明選這群的原因（市場規模 + 留存槓桿）。' }, suggestion: '在分群名稱後加上規模量化（例：~ 850 萬人 / 月），會更具體。' },
    { name: '邏輯性', score: 3, comment: '分群與場景之間的因果鏈不夠緊：你跳過「為什麼這群人留存差」就直接給 podcast 解法，中間需要一個檢驗假設的步驟。', coachVersion: { name: '邏輯性', score: 4, text: '先列「假設這群人留存差是因為缺乏 daily habit anchor」，再用 1 句話說明 podcast 為何適合當錨點（時長、被動消費、無需專注）。' }, suggestion: '把你的假設寫成可驗證的「If X, then Y」格式。' },
    { name: '完整度', score: 3, comment: '少了「次要分群」的對照（例如：付費但不聽 podcast 的人）— 沒有對照組會讓焦點分群的論述少一個強度。', coachVersion: { name: '完整度', score: 4, text: '補一個「對照分群：已養成日常 podcast 習慣的付費用戶」並指出他們的 30 日留存比例（例：92%）做為 anchor 來反證問題。' }, suggestion: '為每個分群提供 1 個量化指標。' },
    { name: '洞察力', score: 4, comment: '「免費用戶聽 podcast 比例 < 12%」是個有 power 的觀察 — 你抓到了一個量化、不顯而易見的洞察。', coachVersion: { name: '洞察力', score: 5, text: '繼續挖：那 12% 的人在用什麼 podcast 類型？是音樂類 / 知識類 / 娛樂類？這會直接影響你後面的方案設計。' }, suggestion: '把這個觀察與後續方案的 hypothesis 串起來。' },
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
  strengths: '明確區分付費 / 免費用戶兩個分群，並指出付費用戶聽 Podcast 比例不到 12%，是清楚的目標焦點。',
  improvements: '用戶動機假設「用戶喜歡 podcast」缺乏可檢驗性，建議補上具體訪談或數據佐證。',
};

const SAMPLE_SCORE_LOW = {
  totalScore: 52,
  dimensions: [
    { name: '清晰度', score: 3, comment: '分群命名直接（30 歲女性）— 但缺少業務脈絡的解釋。', coachVersion: { name: '清晰度', score: 4, text: '「30 歲女性中，每月使用 podcast 少於 2 小時的免費訂戶」— 加 1 個量化條件就把「形容詞」轉成「行為」。' }, suggestion: '每個分群附 1 個行為量化標準。' },
    { name: '邏輯性', score: 1, comment: '分群選擇沒有理由：直接寫「目標用戶 = 30 歲女性」沒有解釋為什麼這群人是焦點，也沒有對應的留存或營收數據佐證。', coachVersion: { name: '邏輯性', score: 4, text: '先列出 3-5 個候選分群（每群附量化指標 + 1 句業務影響），再從中選 1 群為焦點，並用「商業重要 × 可解性」做選擇依據。' }, suggestion: '補一句「我選這群是因為 ___（量化原因）」。' },
    { name: '完整度', score: 3, comment: '只列了一個分群，缺少對照組讓論述沒有錨點。', coachVersion: { name: '完整度', score: 4, text: '至少列 3 個候選分群並寫對照（例：付費 vs 免費的留存差異 ~ 30%）。' }, suggestion: '補對照分群增加論述厚度。' },
    { name: '洞察力', score: 3, comment: '沒有量化的「不顯而易見」觀察 — 純 demographic 描述。', coachVersion: { name: '洞察力', score: 4, text: '提一個「業內人才知道」的觀察，例：30 歲女性 podcast 收聽集中在通勤前 15 分鐘 + 睡前 30 分鐘兩個 window。' }, suggestion: '用行為時序資料找 non-trivial pattern。' },
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

async function setupPhase3(page, scoreResult, errorState, noScore) {
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
      circlesPhase3LoadingStep: 1,
      circlesPhase3DimExpanded: {},
      circlesPhase3CoachDemoOpen: false,
    });
    window.render();
  }, { scoreResult, errorState, noScore });
  await page.waitForTimeout(200);
}

const VIEWPORTS = [
  { name: 'Mobile-360',    width: 360,  height: 900  },
  { name: 'iPhone-SE',     width: 375,  height: 900  },
  { name: 'iPhone-14',     width: 390,  height: 900  },
  { name: 'iPhone-15-Pro', width: 430,  height: 900  },
  { name: 'iPad',          width: 768,  height: 1100 },
  { name: 'Desktop-1280',  width: 1280, height: 1100 },
  { name: 'Desktop-1440',  width: 1440, height: 1100 },
  { name: 'Desktop-2560',  width: 2560, height: 1100 },
];

test.describe.serial('Capture Phase 3 production PNGs', () => {
  for (const vp of VIEWPORTS) {
    test(`Section A — ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await setupPhase3(page, SAMPLE_SCORE_HIGH, null, false);
      await page.screenshot({ path: `${OUT_DIR}/section-A-${vp.name}.png`, fullPage: true });
    });

    test(`Section B — ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await setupPhase3(page, SAMPLE_SCORE_LOW, null, false);
      await page.screenshot({ path: `${OUT_DIR}/section-B-${vp.name}.png`, fullPage: true });
    });

    test(`Section C — ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await setupPhase3(page, null, null, true);
      await page.screenshot({ path: `${OUT_DIR}/section-C-${vp.name}.png`, fullPage: true });
    });

    test(`Section D — ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await setupPhase3(page, null, { code: 'EVAL_TIMEOUT', message: 'timeout' }, false);
      await page.screenshot({ path: `${OUT_DIR}/section-D-${vp.name}.png`, fullPage: true });
    });
  }
});
