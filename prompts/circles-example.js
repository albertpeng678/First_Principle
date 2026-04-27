const OpenAI = require('openai');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Per-step, per-field guidance for what a good filled-in example should contain.
// This is reused from circles-hint.js's FIELD_GUIDANCE but stripped to the
// "good_answer_shape" — what an example sentence should look like.
const FIELD_SHAPES = {
  C1: {
    '問題範圍':  '一句話說明問題類型（頻率/相關性/格式/其他）+ 一句話說明範圍（哪個版位/功能）+ 排除項',
    '時間範圍':  '具體天數 + 對應的業務節奏（季度/月/週）+ 一句話說明為什麼這個時長',
    '業務影響':  '說出至少 1 個具體不能突破的業務邊界（量化）+ 兩個利益相關方的訴求',
    '假設確認':  '列出 2-3 條格式為「[現象] 是 [原因A] 而非 [原因B]」的具體假設',
  },
  I: {
    '目標用戶分群':  '用同一個維度切出 2-4 群，每群一句話定義特徵',
    '選定焦點':      '選定一群 + 商業/戰略價值的具體理由',
    '用戶動機假設':  '表面動機（功能性）+ 深層動機（情感/社交）的 JTBD 分析',
    '排除對象':      '列出 1-2 個排除對象 + 每個的具體理由',
  },
  R: {
    '功能性需求':  '在具體場景下，用戶需要做到什麼任務、目前做不到的原因',
    '情感性需求':  '當某情境發生時，用戶需要感受到什麼、目前什麼情況讓這個感受落空',
    '社交性需求':  '用戶希望透過此產品在社群中達到什麼影響/被看見/連結效果',
    '核心痛點':    '指出最核心的痛點 + 嚴重程度 + 受影響的用戶',
  },
  C2: {
    '取捨標準':      '2-3 個針對這題的具體標準（不是萬年通用的 RICE）',
    '最優先項目':    '一個具體的優先項 + 對應取捨標準的理由',
    '暫緩項目':      '1-2 個暫緩項 + 具體理由（資源/時機/依賴）',
    '排序理由':      '整體排序邏輯 + 取捨換取了什麼 + 回應潛在反對意見',
  },
  L: {
    '方案一':        '有記憶點的短名稱 + 核心機制一句話 + 適用前提',
    '方案二':        '與方案一有本質差異的另一個方向 + 機制 + 差異點',
    '方案三（可選）': '若有第三個方向：名稱 + 機制 + 與前兩方案的差異；若無：說明理由',
  },
  E: {
    '方案優點':      '2-3 個具體優點 + 條件 + 至少 1 個連結業務目標',
    '方案缺點':      '2-3 個誠實缺點 + 嚴重程度 + 失效情境',
    '風險與依賴':    '2-3 個依賴 + 可控程度 + 最壞情境',
    '成功指標':      '1-2 個領先指標（短期可觀察）+ 1 個滯後指標（核心目標）+ 量化門檻',
  },
  S: {
    '推薦方案':      '明確選定的方案名稱 + 一句話最終判斷',
    '選擇理由':      '引用 E 步驟結論 + 對比放棄的方案 + 面對最大缺點的回應',
    '北極星指標':    '具體 NSM 定義（含量化或行為門檻）+ 為何能反映真實成效 + 排除一個虛榮指標',
    '追蹤指標':      '4 個維度（廣度/深度/頻率/業務影響）的具體指標',
  },
};

async function generateCirclesExample({ step, field, questionJson }) {
  const shapes = FIELD_SHAPES[step] || {};
  const shape = shapes[field] || '一個切題的具體範例';

  const systemPrompt = `你是 PM 面試教練，為學員提供一個欄位的「填寫範例」——示範一個合格答案大概長什麼樣子。

格式硬規定（嚴格遵守）：
• 總長 50-90 字（含標點）。超過會破版。
• 1-2 句話，直接寫範例答案內容
• 不要加「例：」「範例：」「我會...」「我的答案是...」這類前綴——直接從答案本身開始
• 不要 markdown、不要列點符號、不要編號、不要 emoji
• 整段繁體中文

內容要求：
• 必須具體針對「${questionJson.company}」與這道題的情境（不是泛泛通用範例）
• 不是給出唯一正解，而是示範「合格答案大概長什麼樣」
• 此欄位的好答案應符合：${shape}`;

  const userMsg = `題目：${questionJson.problem_statement || '（未提供完整題目）'}
公司：${questionJson.company}
產品：${questionJson.product || ''}
當前步驟：${step}
當前欄位：${field}

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
      text = text.replace(/^(例：|範例：|以下是|這是|我會|我的答案是|首先，?)[^\n]*[\n：]?/, '');
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

module.exports = { generateCirclesExample };
