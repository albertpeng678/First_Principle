'use strict';
// Pilot backfill: regenerate Step 2 (3 fields) + Step 3 (4 dims) examples
// for 3 trial questions covering type variety:
//   q1  Netflix   — attention type
//   q3  Slack     — saas type
//   q9  Duolingo  — creator type
//
// Run: node -r dotenv/config scripts/backfill-nsm-pilot-3.js
// Cost estimate: 21 cells × ~150 tokens/cell ≈ $0.10-0.20

require('dotenv').config();
const fs   = require('fs');
const path = require('path');
const vm   = require('vm');
const OpenAI = require('openai');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const NSM_DB_PATH  = path.join(__dirname, '..', 'public', 'nsm-db.js');
const PILOT_IDS    = ['q1', 'q3', 'q9'];
const STEP2_FIELDS = ['nsm', 'explanation', 'businessLink'];
const STEP3_DIMS   = ['reach', 'depth', 'frequency', 'impact'];

// ── nsmGuessProductType ────────────────────────────────────────────────────────
function guessType(q) {
  const text = [q.company, q.industry, q.scenario].filter(Boolean).join(' ').toLowerCase();
  if (/電商|marketplace|外賣|美食|叫車|打車|共享|租車|預訂|配送|撮合|airbnb|uber|grab|foodpanda|wolt|booking/.test(text)) return 'transaction';
  if (/saas|企業|b2b|crm|協作|辦公|工具|管理|自動化|zendesk|slack|notion|figma|datadog|zoom|intercom|twilio|stripe|shopify/.test(text)) return 'saas';
  if (/教育|學習|課程|語言|創作|ugc|知識|部落|newsletter|podcast|直播|duolingo|coursera|creator/.test(text)) return 'creator';
  return 'attention';
}

// ── Step 2 FIELD_GUIDE ─────────────────────────────────────────────────────────
const STEP2_FIELD_GUIDE = {
  nsm: [
    '① 行為動詞：具體到可在資料倉儲直接 query 的行為（不是「使用」「打開」，要到「完成訂單」「播放 ≥ 5 分鐘」「上傳作品」）',
    '② 量化門檻：次數/頻率/時間，必須 instrumentable；說明觀測窗口（日/週/月）',
    '③ 排除子句：具體點名 1 個最常見的虛榮指標（如 App 打開次數、DAU、註冊數），並說明為何不算真實價值',
    '④ 為什麼此門檻代表「用戶已真正體驗核心價值」而非偶然造訪',
  ].join('\n'),
  explanation: [
    '① 具體量化定義：numerator 是什麼行為 / denominator 是哪個母群 / 計算窗口多長',
    '② 行為閾值的選定理由：為什麼是這個數字——參照業界基準、cohort 分析或用戶研究',
    '③ 為什麼跨越此門檻代表「真正獲得價值」：指出用戶的 aha moment 或習慣形成的信號',
    '④ 排除一個干擾變數（促銷暴增 / 新用戶蜜月期 / 季節性）避免指標失真',
  ].join('\n'),
  businessLink: [
    '① NSM ↑ → 具體商業指標（留存率/NDR/GMV/付費轉化率）↑ 的因果鏈；必須命名具體指標，不准泛稱「滿意度」或「用戶更開心」',
    '② 中間機制：NSM 提升後，哪個用戶行為改變驅動了商業指標（例如「習慣形成 → 月活提高 → 廣告收益 ↑」）',
    '③ 量化估算或量級感：NSM +X% → 商業指標 +Y pp；可引用同類競品公開數據或歷史 cohort',
    '④ 邊界條件：點出一個情況，說明 NSM 在哪種情況下可能無法代理商業健康（讓範例顯得嚴謹）',
  ].join('\n'),
};

// ── Step 3 FIELD_GUIDE (per type × dim) ───────────────────────────────────────
const STEP3_FIELD_GUIDE = {
  'attention.reach': [
    '① 母群體定義：numerator/denominator 清楚說明（如「過去 30 日完成 ≥ 1 次核心互動的 MAU / 全月訂閱 MAU」）',
    '② 達標行為：具體到可 query 的行為（不是「使用」，要到「點擊播放並觀看 ≥ X 分鐘」）',
    '③ 排除誤觸：明確排除「僅打開 App / 僅瀏覽首頁但未觸及核心功能」的場景',
    '④ 為何用此母群而非 MAU 或 DAU——點出打開與真實觸及之間的差距',
  ].join('\n'),
  'attention.depth': [
    '① 深度信號：具體的互動深度指標（時長 / 完播率 / 互動次數），量化門檻可 query',
    '② 閾值選定理由：為什麼是這個數字（cohort 分析 / survey / 業界基準）',
    '③ 為何代表真投入：舉 1 個能區分真假投入的關鍵行為差異',
    '④ 排除假深度：具名 1 個看似深度但不算的行為（如重複觀看同一集 / 自動播放被動時長）',
  ].join('\n'),
  'attention.frequency': [
    '① 週期選擇：用週還是月觀測，理由是產品的自然使用節奏',
    '② 頻率閾值：幾次才算「養成習慣」——引用行為心理學或 cohort 分析的拐點',
    '③ 量化目標：DAU/MAU 比例目標 or「每週 ≥ N 天活躍的用戶佔比 ≥ X%」',
    '④ 排除干擾：指出 1 個讓頻率指標失真的情況（推播驅動的被動回訪 / 節假日爆量）',
  ].join('\n'),
  'attention.impact': [
    '① 具體商業指標：30d 留存率 / 廣告 eCPM / 付費轉化率，禁止只說「留存提升」',
    '② 因果鏈：NSM ↑ → 哪個行為 → 商業指標 ↑（習慣形成 → 月活提高 → 廣告收益 ↑）',
    '③ 量化估算：NSM +10% → 商業指標 +Y pp（可引用同類競品公開數據）',
    '④ 邊界條件：NSM 在哪種情況下可能無法代理商業健康（讓範例顯得嚴謹）',
  ].join('\n'),

  'saas.reach': [
    '① Activation 定義：分子是「完成核心工作流的人數」，分母是「新開帳號數」，邊界必須清楚',
    '② 具體 activation 行為：不是 signup，要到「完成第一個 project / 發送第一條訊息 / 成功跑完核心 workflow」',
    '③ 排除表面 activation：具體點名「僅登入查看 demo workspace / 僅完成 onboarding wizard 但未實際使用」',
    '④ 為何此定義能反映真實啟用而非試用行為',
  ].join('\n'),
  'saas.depth': [
    '① 席次利用率定義：分子（30 天內完成核心動作的席次數）/ 分母（已開通席次數），排除 admin / IT / 純 viewer',
    '② 量化閾值：如「席次利用率 ≥ 60% 代表健康；< 40% 代表續約風險」',
    '③ 「核心動作」的具體定義：可 query 的行為，不能只說「使用核心功能」',
    '④ 為何席次深度比 DAU 更能反映企業客戶的真實 ROI 感受',
  ].join('\n'),
  'saas.frequency': [
    '① 工作日觀測：SaaS 工具節奏是工作日非週末，說明為何用工作日而非自然日',
    '② 頻率閾值：例如「每工作日至少 1 次完成核心動作的席次比例 ≥ X%」',
    '③ DAU/MAU 比 benchmark：SaaS 工具 DAU/MAU ≥ 25% 算強黏著（可引用 Amplitude / Mixpanel 公開研究）',
    '④ 排除干擾：季度末批量使用 / 管理員定期生成報告導致的頻率虛高',
  ].join('\n'),
  'saas.impact': [
    '① NRR 定義：例如「90 天內發生 upsell / seat 擴張的帳號比例」，連結可操作的擴張動作',
    '② 量化目標：NRR > 100% = 健康；NRR < 90% = 流失警報（引用業界基準）',
    '③ 因果鏈：depth / frequency 提升 → 用戶感受到 ROI → upsell 意願提高 → NRR 上升',
    '④ 時間滯後：NRR 比 NSM 滯後 30-90 天，說明為何監測頻率設為月度或季度',
  ].join('\n'),

  'creator.reach': [
    '① 活躍創作者定義：分子（30 天內發布 ≥ 1 件作品的創作者數）/ 分母（全體已開通帳號創作者數）',
    '② Segment scope：區分新創作者 vs 回流創作者 / 不同內容品類',
    '③ 排除虛榮數量：「已開帳號但 0 發布量的創作者」「僅轉發他人內容」',
    '④ 為何活躍創作者覆蓋率能反映平台生態健康而非單純 DAU',
  ].join('\n'),
  'creator.depth': [
    '① 品質信號：每件作品平均互動量 / 完播率 / 讚藏分享比，量化門檻可 query',
    '② 閾值選定理由：A/B 測試 / 演算法推薦閾值 / 平台基準支撐這個數字',
    '③ 為何代表高質量內容：區分「演算法驅動偶發爆量」vs「真實用戶持續投入」',
    '④ 排除假深度：標題黨高點擊低完播 / 刷量行為',
  ].join('\n'),
  'creator.frequency': [
    '① 發布頻率觀測窗口：週還是月，對應平台的內容更新節奏',
    '② 頻率閾值：幾次 / 月才算活躍創作者——引用 cohort 說明此數字與留存的相關性',
    '③ 量化目標：「月均發布 ≥ 4 次的創作者佔全體創作者 ≥ X%」',
    '④ 排除干擾：熱門話題爆發驅動的一次性大量發布後沉寂',
  ].join('\n'),
  'creator.impact': [
    '① 具體商業指標：廣告收入 / 創作者收益 / 付費讀者訂閱數，禁止只說「商業轉化」',
    '② 因果鏈：創作者活躍 → 內容豐富度 ↑ → 消費端用戶留存 ↑ → 廣告 / 訂閱收入 ↑',
    '③ 量化估算：創作者活躍率 +10% → 廣告收益 / 付費訂閱 +Y pp',
    '④ 邊界條件：top 1% 創作者佔收益 80% 時，整體 NSM 上升可能掩蓋長尾生態惡化',
  ].join('\n'),
};

const STYLE_GUIDE = `style guide（嚴格遵守，違反會破版）：
• 用「巢狀列點」格式，不要寫成一段：
  - 頂層列點以「- 」開頭（dash + 一個空白）
  - 子項以「  - 」開頭（2 個空白縮排 + dash + 空白）
  - 用 \\n 換行（不要把整段擠成一行）
• 頂層 2-4 項；子項可選，每個頂層下 0-5 個
• 每行（含「- 」前綴）≤ 60 字；整段總長 ≤ 320 字
• 每個頂層 bullet 至少 12 字，子項至少 8 字（不要太精簡到失去資訊量）
• 保留 **bold** 標記 1-3 個 load-bearing 關鍵字：
  ✅ 該 bold：① 具體範圍／場景 ② 量化指標／時程 ③ 方案／指標名稱
  ❌ 禁止 bold 結構性 label
• 不要 emoji、不要編號（「①②③」「1.」都不要，主項就用「- 」）
• 不要任何描述性開頭：「例：」「範例：」「我會...」「我的答案是...」直接從第一個 bullet 開始
• 句尾標點完整；最後一個 bullet 不一定要句號
• 整段繁體中文`;

// few-shot anchor for Step 2
const STEP2_ANCHOR = {
  field:   'nsm',
  context: '題目：訂閱用戶每月活躍觀看時長 NSM 定義 / 公司：Netflix / 情境：訂閱制',
  output: `- 行為動詞：**完整觀看** ≥ 1 部內容（連續播放 10 分鐘以上，中途換片重算）
  - 排除「純打開 App」「< 5 分鐘預覽」——僅有曝光而非內容消費
- 量化門檻：**月內 ≥ 2 次達標**（28 天滾動窗口）
  - 單次觀看可能是偶然；兩次代表主動選擇回訪，是習慣形成的起點
- 排除虛榮指標：DAU 或登入次數不計——Netflix 競爭對手均有「打開不看」的習慣性登入問題
- 為何代表真實價值：觀看 ≥ 2 次的 cohort 30 天留存率比僅看 1 次高 ~22pp（業界估算）`,
};

// few-shot anchor for Step 3
const STEP3_ANCHOR = {
  field:   'step3.reach',
  context: '題目：訂閱用戶每月活躍觀看時長拆解 / 公司：Netflix / 維度：reach（觸及廣度）/ attention 型',
  output: `- 母群體定義：**月活躍訂閱用戶**（過去 30 天登入過 ≥ 1 次）
  - 分母選「訂閱用戶」而非「全用戶」，確保衡量付費族群的真實觸及
- 達標行為：點擊任一內容播放 ≥ **5 分鐘**（排除 < 2 分鐘的預覽跳出）
- 排除：僅因 email 提醒打開首頁但未點擊播放的流量，這類曝光不代表內容價值消費`,
};

// ── Load / Save DB ─────────────────────────────────────────────────────────────
function loadQuestions() {
  const src = fs.readFileSync(NSM_DB_PATH, 'utf8');
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  return sandbox.window.NSM_QUESTIONS;
}

function saveQuestions(questions) {
  const header = '// Auto-generated — do not edit manually\n// Run: node -r dotenv/config scripts/backfill-nsm-context.js to regenerate context fields\n';
  const body   = 'window.NSM_QUESTIONS = ' + JSON.stringify(questions, null, 2) + ';\n';
  fs.writeFileSync(NSM_DB_PATH, header + body, 'utf8');
}

// ── Text post-processing ───────────────────────────────────────────────────────
function cleanBullets(text) {
  text = text.replace(/^(例[：:]|範例[：:]|以下是[^\n]*|這是[^\n]*|我會[^\n]*|我的答案是[^\n]*|首先[，,]?)[^\n]*\n+/u, '');
  text = text.replace(/\t/g, '  ');
  text = text.replace(/^([ ]*)[*•]\s+/gm, '$1- ');
  text = text.replace(/^( {3,})- /gm, (m, sp) => (sp.length >= 2 ? '  - ' : '- '));
  text = text.split('\n').map(l => l.replace(/\s+$/, '')).join('\n').trim();
  return text;
}

// ── Step 2 generator ──────────────────────────────────────────────────────────
async function generateStep2(field, q, retries = 3) {
  const guide = STEP2_FIELD_GUIDE[field] || STEP2_FIELD_GUIDE.nsm;
  const systemPrompt = `你是 PM 教練，為學員生成 NSM 框架某一欄位的「合格答案範例」 — 示範一個合格答案大概長什麼樣子。

${STYLE_GUIDE}

內容要求：
• 必須切題針對「${q.company}」這道題情境（不是泛泛通用）
• 不是給出唯一正解，而是示範「合格答案大概長什麼樣」的示範
• 此欄位的好答案應符合：\n${guide}

評量標準（生成前自問）：
• 看完這個範例，學員能不能立刻知道「好答案長什麼樣」？
• 有沒有具體數字 / 行為 / 排除對象？
• 有沒有「為什麼」的推理鏈，而不只是列出指標？

few-shot 參考錨點（這是另一道題「${STEP2_ANCHOR.field}」的合格答案，請學它的【bullet 結構／縮排／長度／bold 用法】，不要抄內容）：
${STEP2_ANCHOR.context}
輸出：
${STEP2_ANCHOR.output}`;

  const userMsg = `公司：${q.company}
產業：${q.industry}
情境：${q.scenario}
當前欄位：step2.${field}

請以「巢狀列點」格式生成此欄位的合格答案範例（直接從第一個「- 」開始寫，不加任何前綴文字）：`;

  let lastErr;
  for (let i = 0; i < retries; i++) {
    try {
      const resp = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: userMsg },
        ],
        temperature: 0.5,
        max_tokens: 480,
      });
      let text = cleanBullets(resp.choices[0].message.content.trim());
      if (text.length > 320) {
        if (i < retries - 1) { console.warn(`  ↻ ${q.id}/step2.${field} too long (${text.length}), retrying`); continue; }
      }
      const topCount = (text.match(/^- /gm) || []).length;
      if (topCount < 2) {
        if (i < retries - 1) { console.warn(`  ↻ ${q.id}/step2.${field} only ${topCount} top bullet(s), retrying`); continue; }
      }
      return text;
    } catch (e) {
      lastErr = e;
      await new Promise(r => setTimeout(r, 1500 * (i + 1)));
    }
  }
  throw lastErr;
}

// ── Step 3 generator ──────────────────────────────────────────────────────────
async function generateStep3(dim, q, productType, retries = 3) {
  const typeKey = `${productType}.${dim}`;
  const guide = STEP3_FIELD_GUIDE[typeKey] || STEP3_FIELD_GUIDE[`attention.${dim}`] || '';
  const dimLabels = {
    attention:   { reach: '觸及廣度', depth: '互動深度', frequency: '習慣頻率', impact: '留存驅力' },
    saas:        { reach: '啟用廣度', depth: '席次深度', frequency: '黏著頻率', impact: '擴張信號' },
    creator:     { reach: '創造廣度', depth: '成果品質', frequency: '採用廣度', impact: '商業轉化' },
    transaction: { reach: '供給廣度', depth: '需求深度', frequency: '匹配效率', impact: '復購留存' },
  };
  const dimLabel = (dimLabels[productType] || dimLabels.attention)[dim] || dim;

  const systemPrompt = `你是 PM 教練，為學員生成 NSM 拆解維度的「合格答案範例」 — 示範一個合格答案大概長什麼樣子。

${STYLE_GUIDE}

內容要求：
• 必須切題針對「${q.company}」這道題情境（不是泛泛通用）
• 不是給出唯一正解，而是示範「合格答案大概長什麼樣」的示範
• 此維度（${dim} = ${dimLabel} / ${productType} 型）的好答案應符合：\n${guide}

評量標準（生成前自問）：
• 看完這個範例，學員能不能立刻知道「好答案長什麼樣」？
• 有沒有具體 numerator/denominator / 量化門檻 / 排除對象？
• 有沒有「為什麼選這個定義」的推理鏈？

few-shot 參考錨點（這是另一道題「${STEP3_ANCHOR.field}」的合格答案，請學它的【bullet 結構／縮排／長度／bold 用法】，不要抄內容）：
${STEP3_ANCHOR.context}
輸出：
${STEP3_ANCHOR.output}`;

  const userMsg = `公司：${q.company}
產業：${q.industry}
情境：${q.scenario}
產品類型：${productType}（${dimLabel}）
當前維度：step3.${dim}

請以「巢狀列點」格式生成此維度的合格答案範例（直接從第一個「- 」開始寫，不加任何前綴文字）：`;

  let lastErr;
  for (let i = 0; i < retries; i++) {
    try {
      const resp = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: userMsg },
        ],
        temperature: 0.5,
        max_tokens: 480,
      });
      let text = cleanBullets(resp.choices[0].message.content.trim());
      if (text.length > 320) {
        if (i < retries - 1) { console.warn(`  ↻ ${q.id}/step3.${dim} too long (${text.length}), retrying`); continue; }
      }
      const topCount = (text.match(/^- /gm) || []).length;
      if (topCount < 2) {
        if (i < retries - 1) { console.warn(`  ↻ ${q.id}/step3.${dim} only ${topCount} top bullet(s), retrying`); continue; }
      }
      return text;
    } catch (e) {
      lastErr = e;
      await new Promise(r => setTimeout(r, 1500 * (i + 1)));
    }
  }
  throw lastErr;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const all = loadQuestions();
  let generated = 0;
  const startTime = Date.now();

  // Track token usage via usage info
  let totalPromptTokens = 0;
  let totalCompletionTokens = 0;

  for (const qId of PILOT_IDS) {
    const q = all.find(x => x.id === qId);
    if (!q) { console.warn(`Question ${qId} not found, skipping`); continue; }

    const productType = guessType(q);
    console.log(`\n[${qId}] ${q.company} (${productType} type)`);

    if (!q.field_examples)       q.field_examples       = {};
    if (!q.field_examples.step2) q.field_examples.step2 = {};
    if (!q.field_examples.step3) q.field_examples.step3 = {};

    // Force regenerate all fields (pilot = quality check, not idempotent skip)
    console.log('  Generating Step 2 (3 fields)…');
    const step2Tasks = STEP2_FIELDS.map(field =>
      generateStep2(field, q)
        .then(text => { q.field_examples.step2[field] = text; generated++; console.log(`    ✓ step2.${field} (${text.length} chars)`); })
        .catch(e   => { console.warn(`    ✗ step2.${field}: ${e.message}`); })
    );
    await Promise.all(step2Tasks);

    console.log('  Generating Step 3 (4 dims)…');
    const step3Tasks = STEP3_DIMS.map(dim =>
      generateStep3(dim, q, productType)
        .then(text => { q.field_examples.step3[dim] = text; generated++; console.log(`    ✓ step3.${dim} (${text.length} chars)`); })
        .catch(e   => { console.warn(`    ✗ step3.${dim}: ${e.message}`); })
    );
    await Promise.all(step3Tasks);

    saveQuestions(all);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
    console.log(`  Saved (${generated} cells so far · ${elapsed}s elapsed)`);
  }

  const elapsedMin = ((Date.now() - startTime) / 60000).toFixed(1);
  console.log(`\nDone. Generated ${generated}/21 cells across ${PILOT_IDS.length} questions in ${elapsedMin} min.`);

  // Print summary for each question
  console.log('\n=== GENERATED EXAMPLES SUMMARY ===');
  for (const qId of PILOT_IDS) {
    const q = all.find(x => x.id === qId);
    const productType = guessType(q);
    console.log(`\n--- ${qId} ${q.company} (${productType}) ---`);
    ['nsm','explanation','businessLink'].forEach(f => {
      const v = q.field_examples.step2[f] || '(empty)';
      console.log(`\nstep2.${f}:\n${v}`);
    });
    ['reach','depth','frequency','impact'].forEach(d => {
      const v = q.field_examples.step3[d] || '(empty)';
      console.log(`\nstep3.${d}:\n${v}`);
    });
  }
}

main().catch(e => { console.error(e); process.exit(1); });
