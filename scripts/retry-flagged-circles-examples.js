// Retry only the fields flagged by audit-circles-examples.js.
//   1. node scripts/audit-circles-examples.js --json > audit-output.json
//   2. node scripts/retry-flagged-circles-examples.js
//
// Uses a stricter prompt (shorter length, anchored on circles_002) and only
// regenerates flagged (qid, step, field) tuples — leaves clean entries alone.

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const JSON_PATH = path.join(__dirname, '..', 'circles_plan', 'circles_database.json');
const AUDIT_PATH = path.join(__dirname, '..', 'audit-output.json');

const FIELD_GUIDE = {
  C1: {
    '問題範圍':  '聚焦的具體場景／用戶／環節，2-3 個子環節，講出排除什麼',
    '時間範圍':  '具體天數 + 為什麼這個時長對應業務節奏 + 太短／太長會怎樣',
    '業務影響':  '主要業務指標 + 兩個利益方的拉鋸 + 量化的硬性紅線',
    '假設確認':  '2-3 條假設，每條格式「X 是 Y 而不是 Z」+ 註明都待後續驗證',
  },
  I: {
    '目標用戶分群':  '同一把尺切 3-4 群，每群一句話定義 + 為什麼用這把尺',
    '選定焦點對象':  '挑一群 + 體量／戰略價值／問題嚴重程度三層理由',
    '用戶動機假設':  '表面動機（一句話）+ 深層動機（情感／社交層）+ 一個有洞察的觀察',
    '排除對象':      '2-3 個排除對象 + 每個的具體理由 + 一句話收斂目的',
  },
  R: {
    '功能性需求':  '具體場景下用戶要做什麼／需要什麼能力 + 目前做不到的原因',
    '情感性需求':  '某情境下用戶要的感覺 + 最大的負面感受是什麼',
    '社交性需求':  '用戶在社群／關係中要被怎麼看 + 對焦點用戶特別重要的點',
    '核心痛點':    '【務必避免「相比於情感層／社交層，功能層更核心」這種八股套路】指出哪一層是最根本，但要用該產品具體的場景或數字描述（例：「現場面交時拿到假鈔／收到爛貨無處申訴」這種具體痛點），不要寫「功能層更核心因為直接影響使用體驗」這類空話',
  },
  C2: {
    '取捨標準':      '一個可量化的單一目標 + 一條硬性底線 + 哪類功能優先哪類後',
    '最優先項目':    '一個具體優先項 + 為什麼直接命中核心痛點 + 預估開發週期',
    '暫緩項目':      '1-2 個暫緩項 + 為什麼（成本／時程／違反底線）+ 不是不重要而是時機',
    '排序理由':      '回答「為什麼最優先的不能暫緩」「為什麼暫緩的不能優先」+ 整體邏輯',
  },
  L: {
    '方案一':        '有記憶點的短名 + 核心機制一句話 + 直接打到核心痛點哪個面',
    '方案二':        '與方案一有本質差異的方向 + 機制 + 差異點',
    '方案三（可選）': '名稱 + 機制 + 為什麼是更激進／長線的選項 + 啟動成本',
  },
  E: {
    '優點':          '2-3 個具體優點 + 至少 1 個連結業務或核心痛點 + 開發預估',
    '缺點':          '2-3 個誠實缺點 + 哪些用戶受影響 + 緩解方案',
    '風險與依賴':    '2-3 個依賴 + 失效會怎樣 + 靠哪個團隊／資源解決',
    '成功指標':      '主指標（核心痛點是否解了）+ 2-3 個次指標（行為改變）+ 不退步底線',
  },
  S: {
    '推薦方案':      '明確選定一個 + 一句話最終判斷 + 其他方案的角色（補充／實驗）',
    '選擇理由':      '引用 E 結論列出 3 個面向 + 對比放棄的方案 + 回應最大缺點',
    '北極星指標':    '一個具體 NSM 定義含行為門檻 + 為什麼能反映真實成效 + 排除一個虛榮指標',
    '追蹤指標':      '4 個維度（廣度／深度／頻率／留存或業務影響）各一個量化指標',
  },
};

// 用 circles_002（人工撰寫）當 anchor — 給 model 看「合格答案長這樣」
const ANCHOR_EXAMPLES = {
  '問題範圍':
    '聚焦個人對個人的二手交易（不是商家對買家）。安全感問題涵蓋 3 個環節：交易前（看不出對方靠不靠譜）、面交時（現場人身與付款風險）、交易後（出問題沒地方申訴）。本題排除有粉專認證的商家賣家，聚焦同城個人賣家。',
  '方案一':
    '『信任卡』— 在聊天和商品頁的賣家頭像旁顯示一張濃縮卡片：**成交筆數、好評率、加入多久、共同好友數**、是否驗證會員。聊天輸入框會偵測風險字眼（LINE、匯款帳號），出現時提示『建議留站內交易』。一句話：把藏起來的信譽資訊搬到看得到的地方。',
  '業務影響':
    'Marketplace 看的指標是月成交筆數和買賣家配對數。安全功能加太強會嚇跑賣家，加太弱會嚇跑買家。硬性約束：**賣家完成註冊的比例最多掉 10%**、**買家成交率最多掉 5%**。',
};

const STYLE_GUIDE = `style guide（嚴格遵守）：
• 長度上限 165 字（含標點），寧可 120-150 字也不要超過。**超過 170 字會被自動截斷**，會破版，請務必在 165 字內把句子收完整、有句號收尾。
• 整段是一段連貫的話。不要分行、不要用「名稱：」「機制：」這類 label 切段。
• 白話中文。junior PM 也要看得懂。英文術語第一次出現要 gloss，例如「KYC（實名認證）」。
• 可用 **粗體** 標記 1-3 個「定錨關鍵點」(load-bearing 關鍵字)，用 \`**X**\` 包起來。
  ✅ 該 bold：① 具體範圍／場景（**東南亞市場**、**Airbnb 預訂流程**）② 量化指標／時程（**8-10 週**、**+5pp**、**MAU 100 萬**）③ 方案／指標名稱（**信任卡**、**月成功完成 ≥ 1 筆交易**）。
  ❌ 不要 bold：**問題範圍**、**核心痛點**、**目標用戶**、**社交性需求**、**主指標**、**業務影響**、**功能性需求**、**選擇理由**、**用戶分群**、**情感層**、**功能層** 這類「換另一道題還是會出現的字眼」一律不要 bold。
  原則：bold 的是「換另一道題就會不一樣」的內容，不是 step 的欄位 label。
• 不要 emoji、不要列點符號（- • *）；可用「①②③」或「：、；」。
• **禁止**用「例：」「範例：」「以下是」「我會」「我的答案是」「假設一：」「假設二：」「方案一是」「核心機制：」「目標是」「首先」這類 prefix 開頭。直接從答案內容開始。
• 整段繁體中文。`;

async function generate(step, field, q, retries = 3) {
  const guide = (FIELD_GUIDE[step] || {})[field] || '一個切題的具體範例';
  const anchor = ANCHOR_EXAMPLES[field];

  const systemPrompt = `你是 PM 面試教練，為學員提供 CIRCLES 框架某一欄位的「合格答案範例」。

${STYLE_GUIDE}

內容要求：
• 必須切題針對「${q.company}」的「${q.product || ''}」這道題情境（不要泛泛通用）
• 不是唯一正解，是「合格答案大概長什麼樣」的示範
• 此欄位的好答案應包含：${guide}
${anchor ? `\n參考錨點（這是另一道題的合格答案，學它的【長度／白話程度／bold 用法】，不要抄內容）：\n「${anchor}」` : ''}`;

  const userMsg = `題目：${q.problem_statement}
公司：${q.company}
產品：${q.product || ''}
（隱藏脈絡：${q.hidden_context || ''}）
步驟：${step}
欄位：${field}

請在 165 字內生成此欄位的合格答案範例（不加任何前綴，直接寫答案）：`;

  let lastErr;
  for (let i = 0; i < retries; i++) {
    try {
      const resp = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMsg },
        ],
        temperature: 0.4,
        max_tokens: 240,
      });
      let text = resp.choices[0].message.content.trim();
      text = text.replace(/^(例[：:]|範例[：:]|以下是|這是|我會|我的答案是|首先[，,]?|方案名稱[:：是]|假設[一二三四五][：:])[^\n]*[\n：]?/, '');
      text = text.replace(/^方案[一二三][是:：]\s*/, '');
      text = text.replace(/^核心機制[:：是]\s*/, '');
      text = text.replace(/^目標是[:：]?\s*/, '');
      text = text.replace(/^[\-•·]\s+/gm, '').replace(/^\d+[.、)]\s+/gm, '');
      text = text.replace(/\s*\n+\s*/g, ' ').trim();
      // No silent truncation. If too long, treat as failed attempt and retry.
      if (text.length > 175) {
        if (i < retries - 1) { console.warn(`  ↻ ${q.id}/${step}.${field} too long (${text.length}), retrying`); continue; }
      }
      // Refuse outputs that don't end with proper terminal punct.
      if (!/[。！？」』）)\]"']$/.test(text)) {
        if (i < retries - 1) { console.warn(`  ↻ ${q.id}/${step}.${field} unterminated, retrying`); continue; }
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
    // checkpoint every 30
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
