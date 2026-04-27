const OpenAI = require('openai');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const CRITERIA = [
  'NSM定義清晰度',
  '與業務目標的連結',
  '可測量性',
  '非虛榮指標',
];

async function reviewNSMGate({ question, nsm, rationale }) {
  const systemPrompt = `你是 PM 面試教練，正在審核學員提出的 North Star Metric（NSM）定義，判斷是否可以進入下一步。

題目背景：
公司：${question.company || '（未提供）'}
產業：${question.industry || '（未提供）'}
情境：${question.scenario || question.problem_statement || '（未提供）'}

你的任務：
1. 針對以下 4 個標準逐一評估學員的 NSM
2. 回傳嚴格的 JSON，不加任何 markdown 或說明

4 個評估標準：
1. NSM定義清晰度：NSM 用一句話清楚定義，含量化描述（例如「每月完成 3 堂以上課程的學習者數」），而不是模糊的「用戶滿意度」
2. 與業務目標的連結：學員說明此 NSM 如何反映公司商業模式的核心價值，邏輯連貫
3. 可測量性：此指標可用現有或常見數據追蹤，非不可觀測的抽象概念
4. 非虛榮指標：不是 DAU、下載數、頁面瀏覽量、註冊數等無法反映真實用戶價值的指標

JSON 格式：
{
  "items": [
    {
      "criterion": "標準名稱（從上方 4 個標準取）",
      "status": "ok" | "warn" | "error",
      "feedback": "一句話回饋（zh-TW，20字內）"
    }
  ],
  "canProceed": true | false,
  "overallStatus": "ok" | "warn" | "error"
}

規則：
- "error"：此標準明顯不達標，會影響後續步驟的品質
- "warn"：不完整但不致命，可在後續補強
- "ok"：通過此標準
- canProceed = false 只有當 items 中有任何一項 status 為 "error"
- 所有 4 個標準都必須出現在 items 陣列中`;

  const userMsg = `學員的 NSM：${nsm || '（未填）'}

學員的理由（NSM 與業務目標的連結說明）：${rationale || '（未填）'}`;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const resp = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMsg },
        ],
        temperature: 0.3,
        max_tokens: 600,
        response_format: { type: 'json_object' },
      });

      return JSON.parse(resp.choices[0].message.content);
    } catch (e) {
      if (attempt === 2) throw new Error('NSM 審核暫時失敗，請重試');
    }
  }
}

module.exports = { reviewNSMGate };
