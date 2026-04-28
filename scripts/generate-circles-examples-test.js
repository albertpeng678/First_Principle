// Smoke test: generate examples for ONE question (circles_001) without saving.
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const STEP_FIELDS = {
  C1: ['問題範圍', '時間範圍', '業務影響', '假設確認'],
  L:  ['方案一', '方案二', '方案三（可選）'],
};

const FIELD_GUIDE = {
  C1: {
    '問題範圍':  '說明聚焦的具體場景／用戶／環節，列出 2-3 個子環節，講出排除什麼',
    '時間範圍':  '具體天數 + 為什麼這個時長對應業務節奏 + 太短／太長會怎樣',
    '業務影響':  '寫出主要業務指標 + 兩個利益方的拉鋸 + 量化的硬性紅線',
    '假設確認':  '列 2-3 條具體假設，每條格式「X 是 Y 而不是 Z」+ 註明都待後續驗證',
  },
  L: {
    '方案一':        '有記憶點的短名 + 核心機制一句話 + 直接打到核心痛點哪個面',
    '方案二':        '與方案一有本質差異的方向 + 機制 + 差異點',
    '方案三（可選）': '名稱 + 機制 + 為什麼是更激進／長線的選項 + 啟動成本',
  },
};

const STYLE_GUIDE = `style guide（嚴格遵守，違反會破版）：
• 100-160 字（含標點，繁體 1 字算 1）。寧可短不要超過，且最後一句務必寫完整、有句號收尾，不能寫到一半被截斷。
• 整段是一段連貫的話，不要分行、不要用「名稱：」「機制：」「核心：」這類欄位 label 來分段
• 白話中文，避免艱澀術語；junior PM 或剛入行的人也要看得懂
• 英文術語可用，但第一次出現要加快速 gloss，例如「KYC（實名認證）」「Trust & Safety（信任與安全）」「scale（規模化）」
• 可用 **粗體** 標記 1-3 個關鍵詞或方案名稱（例：**信任卡**、**8-10 週可上線**、**核心痛點**）。請只用雙星號 \`**X**\`，不要用 _底線_、其他 markdown 或 HTML
• 不要 emoji、不要列點符號（「-」「•」「*」）；可用「①②③」或「：、；」標點結構化
• 不要任何描述性開頭：「例：」「範例：」「我會...」「我的答案是...」「方案名稱：」「方案一是...」「核心機制是...」一律禁止，直接從答案內容開始
• 整段繁體中文`;

async function generate(step, field, q) {
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
  // soft cap only when really overshooting (200 chars). Otherwise leave intact.
  if (text.length > 200) text = text.slice(0, 198) + '…';
  return text;
}

(async () => {
  const all = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'circles_plan', 'circles_database.json'), 'utf8'));
  const q = all.find(x => x.id === 'circles_001');
  console.log('Test question:', q.id, '|', q.company, '·', q.product);
  console.log('Problem:', q.problem_statement);
  console.log();

  for (const step of Object.keys(STEP_FIELDS)) {
    for (const field of STEP_FIELDS[step]) {
      const text = await generate(step, field, q);
      console.log(`【${step} · ${field}】(${text.length}字)`);
      console.log(text);
      console.log();
    }
  }
})();
