const OpenAI = require('openai');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Per-field shape: what a good example answer for NSM Step 2 should look like.
// Mirror CIRCLES FIELD_SHAPES quality: multi-clause guidance that communicates
// "what good looks like" — not just structure hints but reasoning anchors.
const FIELD_SHAPES = {
  nsm: [
    '行為動詞（具體 verb，避免「使用」「打開」等抽象說法，要到「完成訂單」「上傳作品」「播放 ≥ 5 分鐘」這層）',
    '量化門檻（次數/頻率/時間，必須是 instrumentable 且可在資料倉儲直接查到）',
    '排除子句（具體點名 1 個最常見的虛榮指標——例如「App 打開次數」「DAU」——並說明為什麼它不算真實價值）',
    '一句話說明此門檻為何代表「用戶已真正體驗到核心價值」而非偶然造訪',
  ].join(' + '),
  explanation: [
    '具體量化定義（numerator/denominator 各是什麼，計算窗口多長）',
    '行為閾值的選定理由（為什麼是這個數字而非更高或更低——參照業界基準或 cohort 分析）',
    '為什麼跨越此門檻代表「真正獲得價值」——點出一個用戶的 aha moment 或習慣形成的信號',
    '排除一個會干擾解讀的干擾變數（例如促銷期間暴增 / 新用戶蜜月期）',
  ].join(' + '),
  businessLink: [
    'NSM ↑ → 具體商業指標（留存率/NDR/GMV/付費轉化率）↑ 的因果鏈——必須命名具體指標，不准泛稱「滿意度」',
    '中間機制（NSM 提升後，哪個用戶行為改變驅動了商業指標）',
    '量化估算（例如 NSM +10% → 30d 留存 +3pp，或引用同類競品公開數據）',
    '點出一個反例或邊界條件，說明 NSM 在哪種情況下無法代理商業健康',
  ].join(' + '),
};

async function generateNSMStep2Example({ questionJson, field }) {
  const shape = FIELD_SHAPES[field] || FIELD_SHAPES.nsm;
  const { company, scenario } = questionJson || {};

  const systemPrompt = `你是 PM 面試教練，為學員提供一個欄位的「填寫範例」——示範一個合格答案大概長什麼樣子。

格式硬規定（嚴格遵守）：
• 總長 50-90 字（含標點）。超過會破版。
• 1-2 句話，直接寫範例答案內容
• 不要加「例：」「範例：」「我會...」「以下是...」這類前綴——直接從答案本身開始
• 不要 markdown、不要列點符號、不要編號、不要 emoji
• 整段繁體中文

內容要求：
• 必須具體針對「${company || '此公司'}」與這道題的情境（不是泛泛通用範例）
• 不是給出唯一正解，而是示範「合格答案大概長什麼樣」
• 此欄位的好答案應符合：${shape}

評量標準（生成前自問）：
• 看完這個範例，學員能不能立刻知道「好答案長什麼樣」？
• 有沒有具體數字 / 行為 / 排除對象？
• 有沒有「為什麼」的推理鏈，而不只是列出指標？`;

  const userMsg = `公司：${company || ''}
情境：${scenario || ''}
欄位：${field}

請生成此欄位的填寫範例（50-90 字，直接寫答案，不加前綴）：`;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const resp = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMsg },
        ],
        temperature: 0.5,
        max_tokens: 200,
      });
      let text = resp.choices[0].message.content.trim();
      // Strip filler prefixes if model ignores instructions
      text = text.replace(/^(例[：:]|範例[：:]|以下是[^\n]*|這是[^\n]*|我會[^\n]*)[^\n]*[\n：]?/, '');
      text = text.replace(/^[\-•·*]\s+/gm, '').replace(/^\d+[.、)]\s+/gm, '');
      text = text.replace(/\n{2,}/g, '\n').trim();
      // Hard cap at 130 chars (UI sized for ~90)
      if (text.length > 130) text = text.slice(0, 128) + '…';
      return text;
    } catch (e) {
      if (attempt === 2) throw new Error('範例生成暫時失敗，請重試');
      await new Promise(r => setTimeout(r, 800 * (attempt + 1)));
    }
  }
}

module.exports = { generateNSMStep2Example };
