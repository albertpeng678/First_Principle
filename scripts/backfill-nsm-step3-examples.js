'use strict';
// Backfill NSM Step 3 field_examples for every question in public/nsm-db.js.
// Run:  node -r dotenv/config scripts/backfill-nsm-step3-examples.js
//
// • Skips questions that already have a complete step3 block (idempotent).
// • Checkpoint-saves after each question.
// • Generates 4 dims per question in parallel.

require('dotenv').config();
const fs   = require('fs');
const path = require('path');
const vm   = require('vm');
const OpenAI = require('openai');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const NSM_DB_PATH  = path.join(__dirname, '..', 'public', 'nsm-db.js');
const STEP3_DIMS   = ['reach', 'depth', 'frequency', 'impact'];

// 每維度「主項建議」— bullet 結構提示（multi-clause，mirror CIRCLES quality bar）
const FIELD_GUIDE = {
  reach: [
    '① 母群體定義：numerator 母群是誰（月活訂閱用戶 vs 曾登入用戶 vs 新用戶）+ 觀測窗口',
    '② 達標行為：具體到可 query 的行為（不是「使用」，要到「點擊播放並觀看 ≥ X 秒」「完成 ≥ 1 筆交易」）',
    '③ 排除誤觸：具體點名 1-2 個表面上看起來像觸及但不算的情況（例如：僅瀏覽首頁但未點擊、自動播放預覽）',
    '④ 為什麼用這個分母——不選 MAU 或 DAU 而選此母群的理由',
  ].join('\n'),
  depth: [
    '① 深度行為定義：具體的互動深度信號（觀看時長/收聽比例/操作步驟數/功能使用次數）',
    '② 質量門檻：為什麼是這個閾值而非更高或更低——有沒有 cohort 或 survey 支撐',
    '③ 為什麼這個信號代表「真投入」而非「形式性使用」：指出一個能區分真假投入的關鍵行為差異',
    '④ 排除一個看起來像深度但實際不算的行為（例如重複觀看同一內容、自動播放產生的時長）',
  ].join('\n'),
  frequency: [
    '① 週期定義：用日/週/月哪個窗口觀測，理由是什麼（產品的自然使用節奏是什麼）',
    '② 頻率閾值：幾次才算「養成習慣」——引用行為心理學或 cohort 分析來說明這個數字',
    '③ 為什麼這個週期適合本產品：日常消費品（每日）vs 工具軟體（每工作日）vs 電商（每週）的邏輯不同',
    '④ 排除一個干擾頻率判斷的情況（例如假期暴增 / 促銷推播驅動的被動回訪）',
  ].join('\n'),
  impact: [
    '① 留存或商業留痕：具體商業指標（續訂率/NDR/GMV/付費轉化率），不能只說「留存提升」',
    '② 量化轉換：reach/depth/frequency 提升 X% → impact 指標 +Y pp 的量級感（可估算或引用同類）',
    '③ 排除短期偽信號：促銷期間 impact 可能虛高；說明如何識別真實的因果效應（例如 holdout 實驗 / 控制變數）',
    '④ 時間滯後：impact 指標一般比 NSM 滯後多久才能觀察到，這決定了監測頻率',
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

// few-shot anchor：q1 Netflix step3.reach 欄位合格答案示範
const ANCHOR_FEW_SHOT = {
  field:   'step3.reach',
  context: '題目：訂閱用戶每月活躍觀看時長拆解 / 公司：Netflix / 維度：reach（觸及廣度）',
  output: `- 母群體定義：**月活躍訂閱用戶**（過去 30 天登入過 ≥ 1 次）
- 達標行為：點擊任一內容播放 ≥ 5 秒
- 排除：因 OTP 簡訊登入但未點擊內容的場景`,
};

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

async function generate(field, q, retries = 3) {
  const guide = FIELD_GUIDE[field] || '一個切題的具體範例';
  const systemPrompt = `你是 PM 教練，為學員生成 NSM 拆解維度的「合格答案範例」 — 示範一個合格答案大概長什麼樣子。

${STYLE_GUIDE}

內容要求：
• 必須切題針對「${q.company}」這道題情境（不是泛泛通用）
• 不是給出唯一正解，而是示範「合格答案大概長什麼樣」的示範
• 此維度的好答案應符合：${guide}

few-shot 參考錨點（這是另一道題「${ANCHOR_FEW_SHOT.field}」的合格答案，請學它的【bullet 結構／縮排／長度／bold 用法】，不要抄內容）：
${ANCHOR_FEW_SHOT.context}
輸出：
${ANCHOR_FEW_SHOT.output}`;

  const userMsg = `公司：${q.company}
產業：${q.industry}
情境：${q.scenario}
當前維度：step3.${field}

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
      let text = resp.choices[0].message.content.trim();
      // 去掉常見的 prefix 描述句
      text = text.replace(/^(例[：:]|範例[：:]|以下是[^\n]*|這是[^\n]*|我會[^\n]*|我的答案是[^\n]*|首先[，,]?)[^\n]*\n+/u, '');
      // tab 縮排 → 2 空白
      text = text.replace(/\t/g, '  ');
      // 把以 * 或 • 開頭的行轉成 -
      text = text.replace(/^([ ]*)[*•]\s+/gm, '$1- ');
      // 3 空白以上縮排正規化為 2 空白
      text = text.replace(/^( {3,})- /gm, (m, sp) => (sp.length >= 2 ? '  - ' : '- '));
      // 去 trailing whitespace
      text = text.split('\n').map(l => l.replace(/\s+$/, '')).join('\n').trim();
      // 整段不能超過 320 字
      if (text.length > 320) {
        if (i < retries - 1) { console.warn(`  ↻ ${q.id}/${field} too long (${text.length}), retrying`); continue; }
      }
      // 必須至少有兩個頂層 bullet
      const topCount = (text.match(/^- /gm) || []).length;
      if (topCount < 2) {
        if (i < retries - 1) { console.warn(`  ↻ ${q.id}/${field} only ${topCount} top bullet(s), retrying`); continue; }
      }
      return text;
    } catch (e) {
      lastErr = e;
      await new Promise(r => setTimeout(r, 1500 * (i + 1)));
    }
  }
  throw lastErr;
}

function questionStep3Filled(q) {
  if (!q.field_examples || !q.field_examples.step3) return false;
  return STEP3_DIMS.every(d => q.field_examples.step3[d]);
}

async function main() {
  const all   = loadQuestions();
  const total = all.length;
  let generated = 0, skipped = 0;
  const startTime = Date.now();

  for (let qIdx = 0; qIdx < total; qIdx++) {
    const q   = all[qIdx];
    const tag = `[${qIdx + 1}/${total}] ${q.id} (${q.company})`;

    if (questionStep3Filled(q)) {
      console.log(`${tag} — already complete, skipping`);
      skipped++;
      continue;
    }

    if (!q.field_examples)       q.field_examples       = {};
    if (!q.field_examples.step3) q.field_examples.step3 = {};

    console.log(`${tag} — generating Step 3 (4 dims)…`);

    const tasks = STEP3_DIMS
      .filter(d => !q.field_examples.step3[d])
      .map(d =>
        generate(d, q)
          .then(text => { q.field_examples.step3[d] = text; generated++; })
          .catch(e  => { console.warn(`  ✗ ${d}: ${e.message}`); })
      );

    await Promise.all(tasks);
    saveQuestions(all);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
    console.log(`  ✓ saved (${generated} dims generated · ${elapsed}s elapsed)`);
  }

  const elapsedMin = ((Date.now() - startTime) / 60000).toFixed(1);
  console.log(`\nDone. Generated ${generated} Step 3 dims across ${total - skipped} questions in ${elapsedMin} min.`);
}

main().catch(e => { console.error(e); process.exit(1); });
