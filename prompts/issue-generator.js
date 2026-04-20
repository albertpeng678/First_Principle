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
