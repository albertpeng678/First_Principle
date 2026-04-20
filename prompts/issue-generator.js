const OpenAI = require('openai');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM = `
你是一個 PM 練習系統的出題員。生成一個模糊的工作 issue。

規則：
1. 聽起來像真實工作訊息（情緒化、資訊不完整）
2. 表象和本質有明顯落差
3. 有至少一個容易讓人跳去錯誤解法的誤導方向
4. 難度對應：
   - 入門：單一角色、問題明顯
   - 進階：多角色交錯、需多層追問
   - 困難：表象與本質落差大、含誤導細節

多樣性要求（每次必須不同）：
- 產業：從以下隨機選擇，並確保每次題目橫跨不同產業
  科技 SaaS、電商零售、製造業、醫療健康、金融保險、教育 EdTech、
  物流供應鏈、餐飲連鎖、房地產、媒體內容、人力資源、政府/公部門
- 來源角色：從以下隨機選擇（不要每次都用客服主管）
  業務主管、工廠廠長、財務長、HR 主管、行銷總監、合規長、
  董事長秘書、門市店長、倉管主任、醫院行政、學校校長、客服主管
- 情境類型：從以下隨機選擇
  流程卡住、KPI 異常、跨部門摩擦、用戶流失、成本暴增、
  系統故障、新功能沒人用、合規風險、員工離職問題、供應商問題
- 語氣風格：每次用不同語氣（抱怨型 / 焦慮型 / 困惑型 / 指責型 / 求助型）

輸出 JSON（只輸出 JSON，不要其他文字）：
{
  "issueText": "完整的 issue 訊息文字",
  "source": "來源角色（例：客服主管、業務、老闆）",
  "industry": "產業",
  "difficulty": "入門/進階/困難",
  "hiddenTruth": "這個問題的真正本質（不給學員看）",
  "trapDirection": "容易走錯的方向（不給學員看）"
}
`;

async function generateIssue(difficulty) {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: `難度：${difficulty}` }
    ],
    temperature: 0.9,
  });
  return JSON.parse(response.choices[0].message.content);
}

module.exports = { generateIssue };
