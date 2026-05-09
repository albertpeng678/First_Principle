'use strict';
// Backfill NSM Step 2 field_examples for every question in public/nsm-db.js.
// Run:  node -r dotenv/config scripts/backfill-nsm-step2-examples.js
//
// • Skips questions that already have a complete step2 block (idempotent).
// • Checkpoint-saves after each question.
// • Generates 3 fields per question in parallel.

require('dotenv').config();
const fs   = require('fs');
const path = require('path');
const vm   = require('vm');
const OpenAI = require('openai');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const NSM_DB_PATH  = path.join(__dirname, '..', 'public', 'nsm-db.js');
const STEP2_FIELDS = ['nsm', 'explanation', 'businessLink'];

// 每欄位「主項建議」— bullet 結構提示
const FIELD_GUIDE = {
  nsm:          '建議主項：行為動詞 / 量化門檻 / 排除對象（避虛榮指標）',
  explanation:  '建議主項：量化定義 / 行為閾值 / 為什麼這數字代表價值',
  businessLink: '建議主項：NSM ↑ → 商業指標 ↑ 因果鏈 / 留存或變現的具體連結',
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

// few-shot anchor：q1 Netflix nsm 欄位合格答案示範
const ANCHOR_FEW_SHOT = {
  field:   'nsm',
  context: '題目：訂閱用戶每月活躍觀看時長 NSM 定義 / 公司：Netflix / 情境：訂閱制',
  output: `- 行為動詞：**完整觀看** ≥ 1 集劇集（5 分鐘以上）
- 量化門檻：**月活躍訂閱用戶**（月內至少 1 次達標）
- 排除：純打開 App 不播放、< 5 分鐘的試看`,
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
  const systemPrompt = `你是 PM 教練，為學員生成 NSM 框架某一欄位的「合格答案範例」 — 示範一個合格答案大概長什麼樣子。

${STYLE_GUIDE}

內容要求：
• 必須切題針對「${q.company}」這道題情境（不是泛泛通用）
• 不是給出唯一正解，而是示範「合格答案大概長什麼樣」的示範
• 此欄位的好答案應符合：${guide}

few-shot 參考錨點（這是另一道題「${ANCHOR_FEW_SHOT.field}」的合格答案，請學它的【bullet 結構／縮排／長度／bold 用法】，不要抄內容）：
${ANCHOR_FEW_SHOT.context}
輸出：
${ANCHOR_FEW_SHOT.output}`;

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

function questionStep2Filled(q) {
  if (!q.field_examples || !q.field_examples.step2) return false;
  return STEP2_FIELDS.every(f => q.field_examples.step2[f]);
}

async function main() {
  const all   = loadQuestions();
  const total = all.length;
  let generated = 0, skipped = 0;
  const startTime = Date.now();

  for (let qIdx = 0; qIdx < total; qIdx++) {
    const q   = all[qIdx];
    const tag = `[${qIdx + 1}/${total}] ${q.id} (${q.company})`;

    if (questionStep2Filled(q)) {
      console.log(`${tag} — already complete, skipping`);
      skipped++;
      continue;
    }

    if (!q.field_examples)       q.field_examples       = {};
    if (!q.field_examples.step2) q.field_examples.step2 = {};

    console.log(`${tag} — generating Step 2 (3 fields)…`);

    const tasks = STEP2_FIELDS
      .filter(f => !q.field_examples.step2[f])
      .map(f =>
        generate(f, q)
          .then(text => { q.field_examples.step2[f] = text; generated++; })
          .catch(e  => { console.warn(`  ✗ ${f}: ${e.message}`); })
      );

    await Promise.all(tasks);
    saveQuestions(all);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
    console.log(`  ✓ saved (${generated} fields generated · ${elapsed}s elapsed)`);
  }

  const elapsedMin = ((Date.now() - startTime) / 60000).toFixed(1);
  console.log(`\nDone. Generated ${generated} Step 2 fields across ${total - skipped} questions in ${elapsedMin} min.`);
}

main().catch(e => { console.error(e); process.exit(1); });
