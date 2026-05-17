const OpenAI = require('openai');
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function generateNSMHints({ question_json, product_type }) {
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

請為學員提供 3 個維度的引導提示。每個維度需要：
1. 針對「${company}」這個具體公司的情境
2. 以一個啟發性問題開頭（讓學員主動思考）
3. 接著給出 1 個具體的參考方向（不是答案，是思考方向）

每個維度的輸出格式（嚴格遵守）：
- 巢狀 markdown bullets（頂層用「- 」，子項用「  - 」）
- 頂層 2 項，每項可帶 1 子項
- 1-3 個 **bold** 關鍵字
- 整段 ≤ 160 chars，純繁體中文，不用 emoji

回傳 JSON：
{
  "reach":     "<以 markdown bullets 格式 (- 開頭) 描述針對 ${company} 的廣度維度提示>",
  "depth":     "<以 markdown bullets 格式 (- 開頭) 描述針對 ${company} 的深度維度提示>",
  "frequency": "<以 markdown bullets 格式 (- 開頭) 描述針對 ${company} 的頻率維度提示>"
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
