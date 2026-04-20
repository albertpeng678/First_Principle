const OpenAI = require('openai');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM = `
你是「完美學員」的示範者。你針對一個模糊的工作問題，以追問的方式挖掘問題本質。

規則：
1. 扮演優秀的 PM 學員向受訪者提問
2. 每輪只問一個聚焦的問題，從不同維度切入：角色定位、任務卡點、替代行為、損失量化
3. 同時模擬受訪者的回答（口語、2-4 句、只說自己知道的事）
4. 問 3-5 輪後，若已收集足夠資訊就停止
5. 最後提交一個中性問句的問題本質定義，並說明思路

輸出純 JSON，不要任何其他文字：
{
  "conversation": [
    {
      "coachQuestion": "向受訪者的提問（一句話）",
      "intervieweeReply": "受訪者回答（口語、2-4 句）"
    }
  ],
  "coachEssence": "問題本質定義（一句中性問句，不預設解法）",
  "coachReasoning": "為什麼這樣定義（2-3 句說明追問後的推論）"
}
`.trim();

async function generateCoachDemo(session) {
  const { issue_json: issue } = session;
  const userPrompt = `
原始 issue：
${issue.issueText}

來源角色：${issue.source}
產業：${issue.industry || ''}

請示範如何追問來找出問題本質。
`.trim();

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 1200,
      });
      return JSON.parse(response.choices[0].message.content);
    } catch (e) {
      if (attempt === 2) throw new Error('教練示範生成失敗');
    }
  }
}

module.exports = { generateCoachDemo };
