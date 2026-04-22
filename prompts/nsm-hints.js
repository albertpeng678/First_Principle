const OpenAI = require('openai');
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function generateNSMHints({ question_json, user_nsm, product_type }) {
  const { company, scenario } = question_json;

  const typeHints = {
    attention:   '注意力型（媒體/社交/遊戲）',
    transaction: '交易量型（電商/共享平台/O2O）',
    creator:     '創造力型（UGC/知識/內容平台）',
    saas:        'SaaS 型（B2B/訂閱服務）',
  };

  const prompt = `你是一位 PM 教練，正在引導學員拆解北極星指標的輸入指標。

公司：${company}
情境：${scenario}
產品類型：${typeHints[product_type] || '注意力型'}
學員定義的 NSM：${user_nsm || '（尚未定義）'}

請為學員提供 4 個維度的引導提示。每個提示需要：
1. 針對「${company}」這個具體公司的情境
2. 以一個啟發性問題開頭（讓學員主動思考）
3. 接著給出 1 個具體的參考方向（不是答案，是思考方向）

回傳 JSON（繁體中文）：
{
  "reach": "<針對${company}的廣度維度：啟發性問題 + 參考方向，2-3句>",
  "depth": "<針對${company}的深度維度：啟發性問題 + 參考方向，2-3句>",
  "frequency": "<針對${company}的頻率維度：啟發性問題 + 參考方向，2-3句>",
  "impact": "<針對${company}的業務影響維度：啟發性問題 + 參考方向，2-3句>"
}`;

  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.4,
    response_format: { type: 'json_object' },
    messages: [{ role: 'user', content: prompt }]
  });
  return JSON.parse(response.choices[0].message.content);
}

module.exports = { generateNSMHints };
