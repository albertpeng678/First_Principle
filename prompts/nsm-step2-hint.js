const OpenAI = require('openai');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Per-field guidance for NSM Step 2's 3 fields:
// nsm (北極星指標) / explanation (定義說明) / businessLink (業務連結)
const FIELD_GUIDANCE = {
  nsm: {
    purpose: '幫學員想出能反映用戶真實價值的單一指標',
    key_question: '什麼用戶行為真正代表他們從產品得到價值？',
    must_include: ['行為動詞 + 量化門檻', '排除虛榮指標（如點擊數、頁面瀏覽）'],
    good_answer_shape: '不選 [虛榮指標，如 DAU / App 開啟數] 因為 [原因]。改用「[行為動詞] + [量化門檻（次數/時長/深度）]的用戶數」，因為 [這個門檻反映用戶真正消費了核心價值]。',
  },
  explanation: {
    purpose: '量化定義 NSM — 行為門檻、頻率、時間窗',
    key_question: '為什麼這個門檻代表「真正獲得價值」而非「來過就算」？',
    must_include: ['具體量化（次數/頻率/時間窗）', '為什麼選這個門檻而非更高或更低'],
    good_answer_shape: '[具體數值門檻] 代表用戶真正獲得價值，因為 [原因A]。低於此門檻代表 [未完成核心任務的用戶]；選更高門檻會 [排除太多有效用戶] 因為 [業務節奏/行為模式]。',
  },
  businessLink: {
    purpose: '說明 NSM 與商業指標（留存/變現）的因果鏈',
    key_question: 'NSM 上升如何導致留存率或營收提升？',
    must_include: ['NSM ↑ → 商業指標 ↑ 的因果鏈', '具體連結（不是泛泛「更好的體驗」）'],
    good_answer_shape: 'NSM ↑ → [具體中間行為，如完成核心工作流的用戶數] ↑ → [留存率 / NRR / 復購率] ↑。不是「體驗更好」，而是 [可量化的行為變化] 導致 [具體商業結果]。',
  },
};

async function generateNSMStep2Hint({ questionJson, field }) {
  const guidance = FIELD_GUIDANCE[field] || FIELD_GUIDANCE.nsm;
  const { company, scenario, industry } = questionJson || {};

  const systemPrompt = `你是 PM 教練，為學員提供 NSM 定義的提示。

## 提示格式要求
針對「${company || '此公司'}」這道題，給學員 1 個啟發性問題 + 1-2 個思考方向。

欄位目的：${guidance.purpose}
核心問題：${guidance.key_question}
必含要素：${guidance.must_include.join(' / ')}
合格答案結構（校準參考，不要直接輸出此句型）：${guidance.good_answer_shape}

輸出格式（嚴格遵守）：
- 巢狀 markdown bullets（頂層用「- 」，子項用「  - 」）
- 整段 ≤ 220 chars（含標點）
- 頂層 2 項，每項可帶 1 子項
- 1-3 個 **bold** 關鍵字
- 純繁體中文，不用 emoji，不加「例：」「我會」等前綴`;

  const userMsg = `公司：${company || ''}
產業：${industry || ''}
情境：${scenario || ''}

請給出針對此欄位（${field}）的提示。`;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const resp = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMsg },
        ],
        temperature: 0.3,
        max_tokens: 400,
      });
      let text = resp.choices[0].message.content.trim();
      // Strip filler prefixes if model ignores instructions
      text = text.replace(/^(例[：:]|範例[：:]|以下是[^\n]*|這是[^\n]*|我會[^\n]*)[^\n]*\n+/u, '');
      // Hard cap (220 chars — tighter cap improves hint density)
      if (text.length > 220) text = text.slice(0, 218) + '…';
      return text;
    } catch (e) {
      if (attempt === 2) throw new Error('提示生成暫時失敗，請重試');
      await new Promise(r => setTimeout(r, 800 * (attempt + 1)));
    }
  }
}

module.exports = { generateNSMStep2Hint };
