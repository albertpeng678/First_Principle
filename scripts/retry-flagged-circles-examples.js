// Retry only the fields flagged by audit-circles-examples.js.
//   1. node scripts/audit-circles-examples.js --json > audit-output.json
//   2. node scripts/retry-flagged-circles-examples.js
//
// Uses the same bullet-format prompt as scripts/generate-circles-examples.js
// (Spec 1 § 3-5) but only regenerates flagged (qid, step, field) tuples —
// leaves clean entries alone.

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const JSON_PATH = path.join(__dirname, '..', 'circles_plan', 'circles_database.json');
const AUDIT_PATH = path.join(__dirname, '..', 'audit-output.json');

const STEP_FIELDS = {
  C1: ['問題範圍', '時間範圍', '業務影響', '假設確認'],
  I:  ['目標用戶分群', '選定焦點對象', '用戶動機假設', '排除對象'],
  R:  ['功能性需求', '情感性需求', '社交性需求', '核心痛點'],
  C2: ['取捨標準', '最優先項目', '暫緩項目', '排序理由'],
  L:  ['方案一', '方案二', '方案三（可選）'],
  E:  ['優點', '缺點', '風險與依賴', '成功指標'],
  S:  ['推薦方案', '選擇理由', '北極星指標', '追蹤指標'],
};

const FIELD_GUIDE = {
  C1: {
    '問題範圍':  '建議主項：聚焦 / 關鍵環節 / 排除（每個頂層為一個 bullet；關鍵環節下可有 2-3 個子 bullet）',
    '時間範圍':  '建議主項：觀察期長度 / 對應業務節奏 / 太短或太長的影響',
    '業務影響':  '建議主項：主要指標 / 兩個利益方拉鋸 / 量化紅線',
    '假設確認':  '建議主項：2-3 條假設（每條為頂層 bullet）/ 都待後續驗證',
  },
  I: {
    '目標用戶分群':  '建議主項：分群維度 / 3-4 群定義（可作子 bullet）/ 為什麼用這把尺',
    '選定焦點對象':  '建議主項：選誰 / 體量理由 / 戰略理由',
    '用戶動機假設':  '建議主項：表面動機 / 深層動機 / 一個有洞察的觀察',
    '排除對象':      '建議主項：2-3 個排除（每個為頂層含理由）/ 收斂目的',
  },
  R: {
    '功能性需求':  '建議主項：場景 / 需要做到什麼 / 目前卡點',
    '情感性需求':  '建議主項：想感受到什麼 / 怕失去什麼 / 觸發場景',
    '社交性需求':  '建議主項：想被怎麼看 / 對焦點用戶為何重要',
    '核心痛點':    '建議主項：哪一層最根本 / 具體場景描繪 / 為什麼比其他層核心',
  },
  C2: {
    '取捨標準':      '建議主項：量化目標 / 硬性底線 / 哪類優先哪類後',
    '最優先項目':    '建議主項：優先項 / 命中哪個痛點 / 開發週期',
    '暫緩項目':      '建議主項：1-2 個暫緩 / 各自理由 / 不是不重要而是時機',
    '排序理由':      '建議主項：為什麼最優先不能暫緩 / 為什麼暫緩不能優先 / 整體邏輯',
  },
  L: {
    '方案一':        '建議主項：名稱 / 核心機制 / 打到哪個痛點',
    '方案二':        '建議主項:名稱 / 機制 / 與方案一的本質差異',
    '方案三（可選）': '建議主項：名稱 / 機制 / 為什麼是更激進或長線 / 啟動成本',
  },
  E: {
    '優點':          '建議主項：2-3 個優點（每個為頂層）/ 至少 1 連結業務或痛點',
    '缺點':          '建議主項：2-3 個缺點（每個為頂層）/ 影響哪些用戶 / 緩解',
    '風險與依賴':    '建議主項：2-3 個依賴 / 失效會怎樣 / 誰能解',
    '成功指標':      '建議主項：主指標 / 次指標 / 不退步底線',
  },
  S: {
    '推薦方案':      '建議主項：選定方案 / 一句話最終判斷 / 其他方案的角色',
    '選擇理由':      '建議主項：引用 E 結論的 3 個面向 / 對比放棄方案 / 回應最大缺點',
    '北極星指標':    '建議主項：NSM 定義含行為門檻 / 為什麼能反映成效 / 排除虛榮指標',
    '追蹤指標':      '建議主項：廣度 / 深度 / 頻率 / 留存或業務影響 — 4 個維度（每個為頂層）',
  },
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
  ✅ 該 bold：① 具體範圍／場景（**東南亞市場**、**Airbnb 預訂流程**）② 量化指標／時程（**8-10 週**、**+5pp**、**MAU 100 萬**）③ 方案／指標名稱（**信任卡**、**月成功完成 ≥ 1 筆交易**）
  ❌ 禁止 bold 結構性 label（**問題範圍**、**核心痛點**、**目標用戶**、**主指標**、**業務影響**、**功能性需求** 這類字面 label）
• 不要 emoji、不要編號（「①②③」「1.」「2.」都不要，主項就用「- 」）
• 不要任何描述性開頭：「例：」「範例：」「我會...」「我的答案是...」「方案名稱：」「方案一是...」「核心機制是...」直接從第一個 bullet 開始
• 句尾標點完整（「。」「」」「）」等）；最後一個 bullet 不一定要句號
• 整段繁體中文`;

const ANCHOR_FEW_SHOT = {
  field: 'C1.問題範圍',
  context: '題目：設計一個功能，增加 Facebook Marketplace 的用戶安全感，尤其是在二手交易過程中。公司：Meta',
  output: `- 聚焦：個人對個人的二手交易（不是商家對買家）
- 3 個關鍵環節：
  - 交易前：看不出對方靠不靠譜
  - 面交時：現場人身與付款風險
  - 交易後：出問題沒地方申訴
- 排除：粉專認證商家，聚焦**同城個人賣家**`,
};

async function generate(step, field, q, retries = 3) {
  const guide = (FIELD_GUIDE[step] || {})[field] || '一個切題的具體範例';
  const systemPrompt = `你是 PM 面試教練，為學員提供 CIRCLES 框架某一欄位的「合格答案範例」— 示範一個合格答案大概長什麼樣子。

${STYLE_GUIDE}

內容要求：
• 必須切題針對「${q.company}」的「${q.product || ''}」這道題情境（不是泛泛通用）
• 不是唯一正解，而是「合格答案大概長什麼樣」的示範
• 這個欄位的好答案應該包含：${guide}

few-shot 參考錨點（這是另一道題「${ANCHOR_FEW_SHOT.field}」的合格答案，請學它的【bullet 結構／縮排／長度／bold 用法】，不要抄內容）：
${ANCHOR_FEW_SHOT.context}
輸出：
${ANCHOR_FEW_SHOT.output}`;

  const userMsg = `題目：${q.problem_statement}
公司：${q.company}
產品：${q.product || ''}
（隱藏脈絡僅供參考：${q.hidden_context || ''}）
當前步驟：${step}
當前欄位：${field}

請以「巢狀列點」格式生成此欄位的合格答案範例（直接從第一個「- 」開始寫，不加任何前綴文字）：`;

  let lastErr;
  for (let i = 0; i < retries; i++) {
    try {
      const resp = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMsg },
        ],
        temperature: 0.5,
        max_tokens: 480,
      });
      let text = resp.choices[0].message.content.trim();
      // 去掉常見的 prefix 描述句（不應該出現在 bullet 開頭之前）
      text = text.replace(/^(例[：:]|範例[：:]|以下是[^\n]*|這是[^\n]*|我會[^\n]*|我的答案是[^\n]*|首先[，,]?)[^\n]*\n+/u, '');
      text = text.replace(/^方案名稱[:：是][^\n]*\n+/u, '');
      // tab → 2 空白
      text = text.replace(/\t/g, '  ');
      // 把以 * 或 • 開頭的行轉成 -（兼容 LLM 偶爾失誤）
      text = text.replace(/^([ ]*)[*•]\s+/gm, '$1- ');
      // 把 3 空白以上縮排正規化為 2 空白
      text = text.replace(/^( {3,})- /gm, (m, sp) => (sp.length >= 2 ? '  - ' : '- '));
      // 去 trailing whitespace
      text = text.split('\n').map(l => l.replace(/\s+$/, '')).join('\n').trim();
      // 整段不能超過 320 字
      if (text.length > 320) {
        if (i < retries - 1) { console.warn(`  ↻ ${q.id}/${step}.${field} too long (${text.length}), retrying`); continue; }
      }
      // 必須至少有兩個頂層 bullet
      const topCount = (text.match(/^- /gm) || []).length;
      if (topCount < 2) {
        if (i < retries - 1) { console.warn(`  ↻ ${q.id}/${step}.${field} only ${topCount} top bullet(s), retrying`); continue; }
      }
      return text;
    } catch (e) {
      lastErr = e;
      await new Promise(r => setTimeout(r, 1500 * (i + 1)));
    }
  }
  throw lastErr;
}

async function runWithConcurrency(items, n, fn) {
  let idx = 0;
  let done = 0;
  const total = items.length;
  async function worker() {
    while (true) {
      const i = idx++;
      if (i >= items.length) return;
      try { await fn(items[i]); }
      catch (e) { console.warn(`  ✗ ${items[i].id}/${items[i].step}.${items[i].field}: ${e.message}`); }
      done++;
      if (done % 25 === 0) console.log(`  progress: ${done}/${total}`);
    }
  }
  await Promise.all(Array.from({ length: n }, worker));
}

async function main() {
  const audit = JSON.parse(fs.readFileSync(AUDIT_PATH, 'utf8'));
  const all = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
  const byId = Object.fromEntries(all.map(q => [q.id, q]));

  const flagged = audit.flags.map(f => ({ id: f.id, step: f.step, field: f.field }));
  console.log(`Retrying ${flagged.length} flagged fields across ${new Set(flagged.map(f => f.id)).size} questions…`);

  let saved = 0;
  const startTime = Date.now();
  let lastSaveCount = 0;

  await runWithConcurrency(flagged, 8, async (item) => {
    const q = byId[item.id];
    if (!q) return;
    const text = await generate(item.step, item.field, q);
    if (!q.field_examples) q.field_examples = {};
    if (!q.field_examples[item.step]) q.field_examples[item.step] = {};
    q.field_examples[item.step][item.field] = text;
    saved++;
    if (saved - lastSaveCount >= 30) {
      fs.writeFileSync(JSON_PATH, JSON.stringify(all, null, 2), 'utf8');
      lastSaveCount = saved;
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
      console.log(`  💾 checkpoint @ ${saved} (${elapsed}s)`);
    }
  });

  fs.writeFileSync(JSON_PATH, JSON.stringify(all, null, 2), 'utf8');
  const elapsedMin = ((Date.now() - startTime) / 60000).toFixed(1);
  console.log(`\nDone. Regenerated ${saved} fields in ${elapsedMin} min.`);
}

main().catch(e => { console.error(e); process.exit(1); });
