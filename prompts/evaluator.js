const OpenAI = require('openai');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM = `
你是嚴格的 PM 評審。輸出純 JSON，不要任何其他文字。

評分維度（各 20 分）：
- roleClarity：角色定位是否具體
- taskBreakpoint：任務卡點是否描述出行為斷點
- workaround：是否挖出用戶的替代行為
- lossQuantification：損失是否有具體維度或量級感
- definitionQuality：最終問題定義是否中性、不預設解法

輸出格式：
{
  "scores": {
    "roleClarity":        { "score": 0-20, "did": "...", "missed": "...", "tip": "..." },
    "taskBreakpoint":     { "score": 0-20, "did": "...", "missed": "...", "tip": "..." },
    "workaround":         { "score": 0-20, "did": "...", "missed": "...", "tip": "..." },
    "lossQuantification": { "score": 0-20, "did": "...", "missed": "...", "tip": "..." },
    "definitionQuality":  { "score": 0-20, "did": "...", "missed": "...", "tip": "..." }
  },
  "totalScore": 0-100,
  "highlights": {
    "bestMove": "這次練習最亮的一個動作（具體）",
    "mainTrap": "最容易掉進的陷阱（具體）",
    "summary": "一句話：這次練習讓問題從 X 變成了 Y"
  },
  "turnAnalysis": [
    { "turn": 1, "idealFocus": "這輪應該聚焦挖掘的面向（一句話）" }
  ]
}
`;

function buildPrompt(session) {
  const { issue_json: issue, conversation, final_definition: finalDef } = session;
  return `
原始 issue：
${issue.issueText}

issue 的真正本質（評分參考）：
${issue.hiddenTruth}

學員的追問記錄：
${conversation.map((t, i) => `
第 ${i + 1} 輪
學員：${t.userMessage}
被訪談者：${t.coachReply?.interviewee || ''}
`).join('\n')}

學員最終提交的問題定義：
${finalDef}
`.trim();
}

async function evaluate(session) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: buildPrompt(session) }
        ],
        temperature: 0.3,
        max_tokens: 1500,
      });
      return JSON.parse(response.choices[0].message.content);
    } catch (e) {
      if (attempt === 2) throw new Error('評分暫時失敗，請重試');
    }
  }
}

module.exports = { evaluate };
