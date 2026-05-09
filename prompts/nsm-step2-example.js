const OpenAI = require('openai');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Per-field shape: what a good example answer for NSM Step 2 should look like.
const FIELD_SHAPES = {
  nsm:         '行為動詞 + 量化門檻（次數/頻率/時間）+ 排除虛榮指標',
  explanation: '具體量化定義 + 為什麼這個門檻代表真正獲得價值',
  businessLink: 'NSM ↑ → 留存率/營收 ↑ 的具體因果鏈，避免泛泛「用戶更滿意」',
};

async function generateNSMStep2Example({ questionJson, field }) {
  const shape = FIELD_SHAPES[field] || FIELD_SHAPES.nsm;
  const { company, scenario } = questionJson || {};

  const systemPrompt = `你是 PM 面試教練，為學員提供一個欄位的「填寫範例」——示範合格答案大概長什麼樣子。

格式硬規定（嚴格遵守）：
• 總長 50-90 字（含標點）。超過會破版。
• 直接寫範例答案內容
• 不要加「例：」「範例：」「我會...」「以下是...」等前綴——直接從答案本身開始
• 不要 markdown、不要列點符號、不要編號、不要 emoji
• 整段繁體中文

內容要求：
• 必須具體針對「${company || '此公司'}」與這道題的情境（不是泛泛通用範例）
• 此欄位好答案應符合：${shape}`;

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
        temperature: 0.4,
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
