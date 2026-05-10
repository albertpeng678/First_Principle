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

// 每欄位「主項建議」— bullet 結構提示（multi-clause，mirror CIRCLES quality bar）
const FIELD_GUIDE = {
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

// few-shot anchor：q1 Netflix nsm 欄位合格答案示範（示範多子項、推理鏈、排除子句）
const ANCHOR_FEW_SHOT = {
  field:   'nsm',
  context: '題目：訂閱用戶每月活躍觀看時長 NSM 定義 / 公司：Netflix / 情境：訂閱制',
  output: `- 行為動詞：**完整觀看** ≥ 1 部內容（連續播放 10 分鐘以上，中途換片重算）
  - 排除「純打開 App」「< 5 分鐘預覽」——僅有曝光而非內容消費
- 量化門檻：**月內 ≥ 2 次達標**（28 天滾動窗口）
  - 單次觀看可能是偶然；兩次代表主動選擇回訪，是習慣形成的起點
- 排除虛榮指標：DAU 或登入次數不計——Netflix 競爭對手（Disney+、HBO）均有「打開不看」的習慣性登入問題
- 為何此門檻代表真實價值：觀看 ≥ 2 次的 cohort 30 天留存率比僅看 1 次高 ~22pp（業界估算）`,
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
