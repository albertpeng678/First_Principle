// One-shot script to AI-generate `field_examples` for every question in
// circles_database.json. Run once; result is canned (frozen) afterwards.
//
//   node scripts/generate-circles-examples.js
//
// • Skips questions that already have a complete `field_examples` block
//   (so circles_002 stays untouched).
// • Checkpoint-saves after each question.
// • Generates 27 fields per question in parallel.

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const JSON_PATH = path.join(__dirname, '..', 'circles_plan', 'circles_database.json');

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
    '問題範圍':  '說明聚焦的具體場景／用戶／環節，列出 2-3 個子環節，講出排除什麼',
    '時間範圍':  '具體天數 + 為什麼這個時長對應業務節奏 + 太短／太長會怎樣',
    '業務影響':  '寫出主要業務指標 + 兩個利益方的拉鋸 + 量化的硬性紅線',
    '假設確認':  '列 2-3 條具體假設，每條格式「X 是 Y 而不是 Z」+ 註明都待後續驗證',
  },
  I: {
    '目標用戶分群':  '用同一把尺切 3-4 群，每群一句話定義 + 為什麼用這把尺',
    '選定焦點對象':  '挑一群 + 體量／戰略價值／問題嚴重程度三層理由',
    '用戶動機假設':  '表面動機（一句話）+ 深層動機（情感／社交層）+ 一個有洞察的觀察',
    '排除對象':      '列 2-3 個排除對象 + 每個的具體理由 + 一句話收斂目的',
  },
  R: {
    '功能性需求':  '在具體場景下用戶要做什麼／需要什麼能力 + 目前做不到的原因',
    '情感性需求':  '某情境下用戶要的感覺 + 最大的負面感受是什麼',
    '社交性需求':  '用戶在社群／關係中要被怎麼看 + 對焦點用戶特別重要的點',
    '核心痛點':    '指出哪一層（功能／情感／社交）是最根本的 + 為什麼比其他層更核心',
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

const STYLE_GUIDE = `style guide（嚴格遵守，違反會破版）：
• 100-160 字（含標點，繁體 1 字算 1）。寧可短不要超過，且最後一句務必寫完整、有句號收尾，不能寫到一半被截斷。
• 整段是一段連貫的話，不要分行、不要用「名稱：」「機制：」「核心：」這類欄位 label 來分段
• 白話中文，避免艱澀術語；junior PM 或剛入行的人也要看得懂
• 英文術語可用，但第一次出現要加快速 gloss，例如「KYC（實名認證）」「Trust & Safety（信任與安全）」「scale（規模化）」
• 可用 **粗體** 標記 1-3 個「定錨關鍵點」(load-bearing 的關鍵字)，請用雙星號 \`**X**\`。只標：① 具體範圍／場景（例：**東南亞市場**、**Airbnb Experiences 的預訂流程**）② 量化指標／時程（例：**8-10 週可上線**、**+5 個百分點**、**MAU 100 萬**）③ 方案／指標名稱（例：**信任卡**、**月成功完成 ≥ 1 筆交易**）。**禁止**標結構性 label（**問題類型**、**用戶分群**、**目標用戶**、**假設**、**核心痛點**、**主指標**、**業務影響** 這類字面 label 一律不要 bold）。原則：bold 的是「換另一道題就會不一樣」的內容，不是「每道題都會出現」的字眼
• 不要 emoji、不要列點符號（「-」「•」「*」）；可用「①②③」或「：、；」標點結構化
• 不要任何描述性開頭：「例：」「範例：」「我會...」「我的答案是...」「方案名稱：」「方案一是...」「核心機制是...」一律禁止，直接從答案內容開始
• 整段繁體中文`;

async function generate(step, field, q, retries = 3) {
  const guide = (FIELD_GUIDE[step] || {})[field] || '一個切題的具體範例';
  const systemPrompt = `你是 PM 面試教練，為學員提供 CIRCLES 框架某一欄位的「合格答案範例」— 示範一個合格答案大概長什麼樣子。

${STYLE_GUIDE}

內容要求：
• 必須切題針對「${q.company}」的「${q.product || ''}」這道題情境（不是泛泛通用）
• 不是唯一正解，而是「合格答案大概長什麼樣」的示範
• 這個欄位的好答案應該包含：${guide}`;

  const userMsg = `題目：${q.problem_statement}
公司：${q.company}
產品：${q.product || ''}
（隱藏脈絡僅供參考：${q.hidden_context || ''}）
當前步驟：${step}
當前欄位：${field}

請生成此欄位的合格答案範例（110-180 字，直接寫答案，不加任何前綴）：`;

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
        max_tokens: 320,
      });
      let text = resp.choices[0].message.content.trim();
      text = text.replace(/^(例：|範例：|以下是|這是|我會|我的答案是|首先，?|方案名稱[:：是])[^\n]*[\n：]?/, '');
      text = text.replace(/^方案[一二三][是:：]\s*/, '');
      text = text.replace(/^核心機制[:：是]\s*/, '');
      text = text.replace(/^[\-•·]\s+/gm, '').replace(/^\d+[.、)]\s+/gm, '');
      text = text.replace(/\s*\n+\s*/g, ' ').trim();
      if (text.length > 220) text = text.slice(0, 218) + '…';
      return text;
    } catch (e) {
      lastErr = e;
      await new Promise(r => setTimeout(r, 1500 * (i + 1)));
    }
  }
  throw lastErr;
}

function questionFullyFilled(q) {
  if (!q.field_examples) return false;
  for (const [step, fields] of Object.entries(STEP_FIELDS)) {
    if (!q.field_examples[step]) return false;
    for (const f of fields) {
      if (!q.field_examples[step][f]) return false;
    }
  }
  return true;
}

async function main() {
  const all = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
  const total = all.length;
  let generatedFields = 0;
  let skippedQuestions = 0;
  const startTime = Date.now();

  for (let qIdx = 0; qIdx < total; qIdx++) {
    const q = all[qIdx];
    const tag = `[${qIdx + 1}/${total}] ${q.id} (${q.company} · ${q.product || '-'})`;

    if (questionFullyFilled(q)) {
      console.log(`${tag} — already complete, skipping`);
      skippedQuestions++;
      continue;
    }

    console.log(`${tag} — generating 27 fields…`);
    const fieldExamples = q.field_examples || {};
    const tasks = [];
    for (const [step, fields] of Object.entries(STEP_FIELDS)) {
      if (!fieldExamples[step]) fieldExamples[step] = {};
      for (const field of fields) {
        if (fieldExamples[step][field]) continue;
        tasks.push(
          generate(step, field, q)
            .then(text => { fieldExamples[step][field] = text; generatedFields++; })
            .catch(e => { console.warn(`  ✗ ${step}.${field}: ${e.message}`); })
        );
      }
    }
    await Promise.all(tasks);
    q.field_examples = fieldExamples;
    fs.writeFileSync(JSON_PATH, JSON.stringify(all, null, 2), 'utf8');

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
    console.log(`  ✓ saved (${generatedFields} fields generated so far · ${elapsed}s elapsed)`);
  }

  const elapsedMin = ((Date.now() - startTime) / 60000).toFixed(1);
  console.log(`\nDone. Generated ${generatedFields} fields across ${total - skippedQuestions} questions in ${elapsedMin} min.`);
}

main().catch(e => { console.error(e); process.exit(1); });
