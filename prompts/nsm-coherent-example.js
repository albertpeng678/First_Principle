'use strict';
// nsm-coherent-example.js  v3.1
// Single-function coherent NSM example generator.
//
// Problem this solves: Previous approach called OpenAI independently for each
// field (nsm / explanation / businessLink / reach / depth / frequency / impact).
// Result: each example referenced a DIFFERENT NSM concept → no coherence.
//
// v3 changes (2026-05-10):
// - Removed ALL structural label hints (行為動詞 / 量化門檻 / 排除)
// - Each field is ONE converged statement + 0-1 indented sub-bullet for reasoning
// - Format: "- <top statement>\n  - <brief why/exclusion>" (markdown sub-bullet)
// - Anti-pattern explicitly blocked in system prompt
// - Temperature lowered to 0.4 for format adherence
// - Few-shot example added to anchor format
//
// v3.1 changes (2026-05-10):
// - Each field now requires 2-3 縮排 sub-bullets (was 0-1) to show full reasoning chain
// - Added anti-jargon rules: pp / NRR / DAU / MAU / LTV / churn must be explained inline
// - Updated Toast few-shot to show richer 縮排 reasoning
// - Raised max_tokens: Step 2 600→1200, Step 3 400→900
// - Char caps raised: step2 fields 150→300, step3 fields 120→260
//
// Architecture: 2-call sequential (Step 2 → Step 3 uses Step 2 nsm as anchor)
// Step 2 call: choose anchor_nsm + generate 3 step2 fields
// Step 3 call: receive anchor_nsm from Step 2 + generate 4 step3 dims
//
// Returns:
//   {
//     anchor_nsm: string,
//     step2: { nsm, explanation, businessLink },
//     step3: { reach, depth, frequency, impact }
//   }

const OpenAI = require('openai');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Guess product type from question metadata (mirrors backfill-nsm-pilot-3.js logic)
function guessProductType(questionJson) {
  const text = [questionJson.company, questionJson.industry, questionJson.scenario]
    .filter(Boolean).join(' ').toLowerCase();
  if (/電商|marketplace|外賣|美食|叫車|打車|共享|租車|預訂|配送|撮合|airbnb|uber|grab|foodpanda|wolt|booking/.test(text)) return 'transaction';
  if (/saas|企業|b2b|crm|協作|辦公|工具|管理|自動化|zendesk|slack|notion|figma|datadog|zoom|intercom|twilio|stripe|shopify/.test(text)) return 'saas';
  if (/教育|學習|課程|語言|創作|ugc|知識|部落|newsletter|podcast|直播|duolingo|coursera|creator/.test(text)) return 'creator';
  return 'attention';
}

// Step 3 dimension labels per product type (same as pilot-3)
const DIM_LABELS = {
  attention:   { reach: '觸及廣度', depth: '互動深度', frequency: '習慣頻率', impact: '留存驅力' },
  saas:        { reach: '啟用廣度', depth: '席次深度', frequency: '黏著頻率', impact: '擴張信號' },
  creator:     { reach: '創造廣度', depth: '成果品質', frequency: '採用廣度', impact: '商業轉化' },
  transaction: { reach: '供給廣度', depth: '需求深度', frequency: '匹配效率', impact: '復購留存' },
};

// ─── Step 2: Choose anchor NSM + generate 3 coherent fields ─────────────────
async function generateStep2Coherent(questionJson, productType, retries = 3) {
  const { company, industry, scenario } = questionJson;

  const systemPrompt = `你是 PM 面試教練。你的任務是為一道 NSM 題目生成「三個欄位連貫的填寫範例」。

【最重要：連貫規則】
所有三個欄位必須描述同一個 NSM 指標——不能各自描述不同指標。
- step2.nsm：定義 anchor NSM（一個收斂後的 sample answer，不是拆解分析）
- step2.explanation：深入解釋 SAME anchor NSM 的定義細節與行為閾值理由
- step2.businessLink：說明 SAME anchor NSM ↑ 如何驅動具體商業指標 ↑

【縮排 reasoning 是必須（v3.1 最重要規則）】
每個 top-bullet 必須有 2-3 個縮排 sub-bullets，內容依序是：
  1. 為什麼選這個門檻／數字（說出選擇理由）
  2. 排除了什麼 + 為什麼（說清楚邊界）
  3. 真正體現價值的點或具體例子（讓學員能具象理解）
縮排 sub-bullet 每條一句話，≤ 30 字。
這是必須，不是可選。

【禁術語 / 必解釋（v3.1 反術語規則）】
禁止在 top-bullet 裡出現這些英文縮寫而不解釋：
  pp、NRR、DAU、MAU、LTV、churn
若必須用，必須在同欄位的縮排 sub-bullet 立刻加解釋：
  - 錯：「留存 +4-6pp」
  - 對：「留存率提升 4-6 個百分點（如原本 60%，提升到 64-66%）」
  - 錯：「+10% 活躍」
  - 對：「活躍用戶數增加約 10%（每 100 人 → 110 人）」
  - 若使用 NRR，必須接縮排：「NRR = 淨收入留存率，>100% 表示老客戶帶來的收入比流失多」

【絕對禁止的格式（anti-pattern）】
- 禁止使用標籤前綴，例如「行為動詞:」「量化門檻:」「排除:」「定義:」「指標:」
- 禁止在同一欄位列出多個並列指標（例如：月交易量 / 活躍用戶數 / 流失率）
- 禁止結構化分點拆解——每個欄位應該讀起來像一個完整的回答，不是分析模板

【格式規定（嚴格遵守）】
每個欄位必須是：
  第一行：「- 」開頭 + 一個完整的收斂陳述（20-50 字）
  第二至四行：「  - 」開頭 + 2-3 個縮排 sub-bullets（每條 ≤ 30 字）

【費時範例（Toast 餐廳 SaaS）】
{
  "anchor_nsm": "月活躍餐廳數",
  "step2": {
    "nsm": "- 月活躍餐廳數：月內至少透過 Toast POS 完成 1 筆交易的餐廳\n  - 為何選 1 筆：跨過 1 筆代表餐廳已將 Toast 納入日常營運\n  - 排除：僅試用未付費帳號（這些不算真實使用）",
    "explanation": "- 1 筆交易門檻聚焦在「真實上線」而非「下載即算」\n  - 連 1 筆都沒完成 = 還在試用階段，不算成功獲客\n  - 達 1 筆代表餐廳信任 Toast 處理真金白銀，是上線里程碑",
    "businessLink": "- 月活躍餐廳數 ↑ → 訂閱續訂率 ↑ → 公司營收成長\n  - 預估每多 10% 活躍餐廳，訂閱續訂率上升 3-5 個百分點\n  - 例：原本 100 家活躍 → 110 家，續訂從 70% → 73-75%"
  }
}

【JSON schema 嚴格輸出格式】
{
  "anchor_nsm": "<一句話核心指標名稱，10-30 字>",
  "step2": {
    "nsm": "<格式：- 一行完整收斂定義\\n  - 縮排理由1\\n  - 縮排理由2（必須 2-3 個縮排）>",
    "explanation": "<格式：- 一行說明為何此門檻代表真實行為\\n  - 縮排理由1\\n  - 縮排理由2（必須 2-3 個縮排）>",
    "businessLink": "<格式：- anchor NSM ↑ → 具體商業指標 ↑\\n  - 量化估算（百分點，非 pp）\\n  - 具體例子（X → X+n）>"
  }
}

回傳純 JSON（不含任何額外文字或 markdown code block）。

評量（生成前自問）：
- 三個欄位都有「- 」開頭的單一陳述嗎？
- 每個欄位都有 2-3 個縮排 sub-bullets 嗎？（只有 0-1 個 = 重來）
- 有沒有用到「行為動詞:」「量化門檻:」「排除:」這些禁用標籤？（有 = 重來）
- explanation 的主詞是 anchor NSM，而不是另一個指標？
- businessLink 有沒有未解釋的縮寫（pp / NRR / DAU）？（有 = 重來）`;

  const userMsg = `公司：${company}
產業：${industry}
情境：${scenario}
產品類型：${productType}

請以 JSON 格式輸出（直接 {，不加任何前綴或 markdown）：`;

  let lastErr;
  for (let i = 0; i < retries; i++) {
    try {
      const resp = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: userMsg },
        ],
        temperature: 0.4,
        max_tokens: 1200,
        response_format: { type: 'json_object' },
      });
      const raw = resp.choices[0].message.content.trim();
      const parsed = JSON.parse(raw);

      // Validate shape
      if (!parsed.anchor_nsm || !parsed.step2 ||
          !parsed.step2.nsm || !parsed.step2.explanation || !parsed.step2.businessLink) {
        if (i < retries - 1) { console.warn(`  ↻ step2 missing keys, retrying`); continue; }
        throw new Error('Step 2 response missing required keys');
      }

      // Anti-pattern guard: reject if any structural labels appear
      const forbidden = ['行為動詞', '量化門檻', '排除:', '定義:', '指標:'];
      const allText = Object.values(parsed.step2).join(' ');
      const found = forbidden.filter(f => allText.includes(f));
      if (found.length > 0) {
        if (i < retries - 1) {
          console.warn(`  ↻ step2 contains forbidden labels (${found.join(', ')}), retrying`);
          continue;
        }
        throw new Error(`Step 2 contains forbidden structural labels: ${found.join(', ')}`);
      }

      // Cap each field at 300 chars (v3.1 — 2-3 縮排 sub-bullets expected)
      for (const k of ['nsm', 'explanation', 'businessLink']) {
        if (parsed.step2[k].length > 300) {
          parsed.step2[k] = parsed.step2[k].slice(0, 298) + '…';
        }
      }

      return parsed;
    } catch (e) {
      lastErr = e;
      if (i < retries - 1) await new Promise(r => setTimeout(r, 1200 * (i + 1)));
    }
  }
  throw lastErr || new Error('Step 2 coherent generation failed');
}

// ─── Step 3: Generate 4 dims all anchored to the same NSM ───────────────────
async function generateStep3Coherent(questionJson, productType, anchorNsm, retries = 3) {
  const { company, industry, scenario } = questionJson;
  const dimLabels = DIM_LABELS[productType] || DIM_LABELS.attention;

  const systemPrompt = `你是 PM 面試教練。你的任務是為一個 NSM 指標生成「四個拆解維度連貫的填寫範例」。

【給定的 anchor NSM】（這是上一步已確定的 NSM，所有四個維度必須拆解這同一個 NSM，不得另立指標）
Anchor NSM：{{ANCHOR_NSM}}

【連貫規則（最重要）】
- reach：衡量多少用戶「觸及」anchor NSM（分子/分母定義）
- depth：衡量用戶在 anchor NSM 上的「深度」（具體深度信號 + 量化門檻）
- frequency：衡量 anchor NSM 的「頻率」（週期選擇 + 頻率閾值）
- impact：anchor NSM ↑ 驅動的「商業影響」（具體指標名稱 + 量化估算）

所有四個維度都是 anchor NSM 的不同測量角度，不是平行的其他指標。

【縮排 reasoning 是必須（v3.1 最重要規則）】
每個 top-bullet 必須有 2-3 個縮排 sub-bullets，內容依序是：
  1. 為什麼選這個門檻／數字（說出選擇理由）
  2. 排除了什麼或界定了什麼（說清楚邊界）
  3. 具體例子或真實意義（讓學員能具象理解）
縮排 sub-bullet 每條一句話，≤ 30 字。
這是必須，不是可選。

【禁術語 / 必解釋（v3.1 反術語規則）】
禁止在 top-bullet 裡出現這些英文縮寫而不解釋：
  pp、NRR、DAU、MAU、LTV、churn
若必須用，必須在同欄位的縮排 sub-bullet 立刻加解釋：
  - 錯：「NRR > 100%」
  - 對：「NRR（淨收入留存率）> 100%，表示老客戶帶來收入比流失多」
  - 錯：「留存 +4-6pp」
  - 對：「留存率提升 4-6 個百分點（如原本 60%，提升到 64-66%）」

【絕對禁止的格式（anti-pattern）】
- 禁止使用標籤前綴，例如「行為動詞:」「量化門檻:」「排除:」「母群體定義:」「影響範圍:」
- 禁止在同一維度列出多個並列指標
- 每個維度讀起來應該像一個完整的收斂回答，不是分析模板

【格式規定（嚴格遵守）】
每個維度必須是：
  第一行：「- 」開頭 + 一個完整的收斂陳述（20-50 字）
  第二至四行：「  - 」開頭 + 2-3 個縮排 sub-bullets（每條 ≤ 30 字）

【費時範例（Toast 餐廳 SaaS）】
{
  "step3": {
    "reach": "- 分母為已開通帳號的全部餐廳，分子為當月達 1 筆交易者\n  - 為何用此分母：開通 = 潛在使用者，但只有達 1 筆才算真實使用\n  - 排除：試用帳號和已停用帳號不計入分母",
    "depth": "- 月內 ≥ 30 筆交易視為深度使用（每天約 1 筆）\n  - 30 筆代表餐廳已將 Toast 用於核心交易流程，非偶爾測試\n  - 低於 30 筆 = 僅用於偶發收款，不算黏著",
    "frequency": "- 每週至少 4 天有交易記錄\n  - 4 天確保「上班日有用」，避免假日偽活躍\n  - 低於 4 天可能是週末型餐廳，需另外分群分析",
    "impact": "- 月活躍餐廳數 ↑ 帶動訂閱續訂率提升，進而驅動年度營收成長\n  - 每多 10% 活躍餐廳，訂閱續訂率約上升 3-5 個百分點\n  - 例：原本 100 家活躍 → 110 家，續訂從 70% → 73-75%"
  }
}

【JSON schema 嚴格輸出格式】
{
  "step3": {
    "reach":     "<格式：- 一行收斂的 reach 測量（含分子/分母）\\n  - 縮排理由1\\n  - 縮排理由2（必須 2-3 個縮排）>",
    "depth":     "<格式：- 一行收斂的 depth 測量（含量化門檻）\\n  - 縮排理由1\\n  - 縮排理由2（必須 2-3 個縮排）>",
    "frequency": "<格式：- 一行收斂的 frequency 測量（含週期與閾值）\\n  - 縮排理由1\\n  - 縮排理由2（必須 2-3 個縮排）>",
    "impact":    "<格式：- anchor NSM ↑ 帶動的具體商業指標（含量化估算）\\n  - 量化估算（百分點，非 pp）\\n  - 具體例子（X → X+n）>"
  }
}

回傳純 JSON（不含任何額外文字或 markdown code block）。

評量（生成前自問）：
- 每個維度都有 2-3 個縮排 sub-bullets 嗎？（只有 0-1 個 = 重來）
- 有沒有未解釋的英文縮寫（pp / NRR / DAU / MAU）？（有 = 重來）`.replace('{{ANCHOR_NSM}}', anchorNsm);

  const userMsg = `公司：${company}
產業：${industry}
情境：${scenario}
產品類型：${productType}（${Object.values(dimLabels).join(' / ')}）
Anchor NSM：${anchorNsm}

請以 JSON 格式輸出（直接 {，不加任何前綴或 markdown）：`;

  let lastErr;
  for (let i = 0; i < retries; i++) {
    try {
      const resp = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: userMsg },
        ],
        temperature: 0.4,
        max_tokens: 900,
        response_format: { type: 'json_object' },
      });
      const raw = resp.choices[0].message.content.trim();
      const parsed = JSON.parse(raw);

      // Validate shape
      if (!parsed.step3 ||
          !parsed.step3.reach || !parsed.step3.depth ||
          !parsed.step3.frequency || !parsed.step3.impact) {
        if (i < retries - 1) { console.warn(`  ↻ step3 missing keys, retrying`); continue; }
        throw new Error('Step 3 response missing required keys');
      }

      // Anti-pattern guard
      const forbidden = ['行為動詞', '量化門檻', '排除:', '母群體定義', '影響範圍'];
      const allText = Object.values(parsed.step3).join(' ');
      const found = forbidden.filter(f => allText.includes(f));
      if (found.length > 0) {
        if (i < retries - 1) {
          console.warn(`  ↻ step3 contains forbidden labels (${found.join(', ')}), retrying`);
          continue;
        }
        throw new Error(`Step 3 contains forbidden structural labels: ${found.join(', ')}`);
      }

      // Cap each dim at 260 chars (v3.1 — 2-3 縮排 sub-bullets expected)
      for (const k of ['reach', 'depth', 'frequency', 'impact']) {
        if (parsed.step3[k].length > 260) {
          parsed.step3[k] = parsed.step3[k].slice(0, 258) + '…';
        }
      }

      return parsed;
    } catch (e) {
      lastErr = e;
      if (i < retries - 1) await new Promise(r => setTimeout(r, 1200 * (i + 1)));
    }
  }
  throw lastErr || new Error('Step 3 coherent generation failed');
}

// ─── Main export: generateCoherentNSMExamples ────────────────────────────────
/**
 * Generate coherent NSM examples for one question.
 * All 7 examples reference the SAME anchor NSM.
 *
 * @param {object} opts
 * @param {object} opts.questionJson  — question object from nsm-db.js
 * @param {string} [opts.productType] — 'attention' | 'saas' | 'creator' | 'transaction'
 *                                      (auto-detected from questionJson if omitted)
 * @returns {Promise<{
 *   anchor_nsm: string,
 *   step2: { nsm: string, explanation: string, businessLink: string },
 *   step3: { reach: string, depth: string, frequency: string, impact: string }
 * }>}
 */
async function generateCoherentNSMExamples({ questionJson, productType }) {
  const pType = productType || guessProductType(questionJson);

  // Call 1: Step 2 — choose anchor + 3 coherent fields
  const step2Result = await generateStep2Coherent(questionJson, pType);

  // Call 2: Step 3 — 4 dims all anchored to step2's anchor NSM
  const step3Result = await generateStep3Coherent(questionJson, pType, step2Result.anchor_nsm);

  return {
    anchor_nsm: step2Result.anchor_nsm,
    step2: step2Result.step2,
    step3: step3Result.step3,
  };
}

module.exports = { generateCoherentNSMExamples, guessProductType };
