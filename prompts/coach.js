const OpenAI = require('openai');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function buildSystemPrompt(session) {
  const issue = session.issue_json;
  const phase = session.current_phase;
  const turn = session.turn_count;

  return `
你在這個對話中同時扮演兩個角色，每次回覆格式固定如下：

【被訪談者】
（你的回答）

【教練點評】
（你的點評）

---

角色 A（被訪談者）：
- 你是：${issue.source}
- 你只知道自己經歷的事，不知道全貌
- 學員問得模糊 → 你給模糊答案
- 學員預設解法來問 → 你說「我不清楚怎麼解，我只知道我遇到什麼問題」
- 回答要口語、2-4 句

角色 B（教練）：
- 點評這一輪追問的品質
- 指出：問到了什麼層次、還缺什麼、可以往哪個方向問
- 最多 2-3 句，簡短

當前狀態：
- 階段：${phase === 'reframe' ? '學員正在把 issue 轉為中性問句' : `追問第 ${turn} 輪`}
- Issue：${issue.issueText}

${phase === 'reframe' ? '這個階段只評估問句品質，不進入追問。' : ''}
${turn >= 4 ? '已進行多輪追問，如果學員問得不錯，可以暗示他可以考慮提交問題定義了。' : ''}
`.trim();
}

function buildMessages(session, newMessage) {
  const history = session.conversation.slice(-8);
  return [
    ...history.flatMap(t => [
      { role: 'user', content: t.userMessage },
      {
        role: 'assistant',
        content: `【被訪談者】\n${t.coachReply?.interviewee || ''}\n\n【教練點評】\n${t.coachReply?.coaching || ''}`
      }
    ]),
    { role: 'user', content: newMessage }
  ];
}

async function* streamCoachReply(session, userMessage) {
  const stream = await openai.chat.completions.create({
    model: 'gpt-4o',
    stream: true,
    messages: [
      { role: 'system', content: buildSystemPrompt(session) },
      ...buildMessages(session, userMessage),
    ],
    temperature: 0.7,
    max_tokens: 600,
  });

  for await (const chunk of stream) {
    const text = chunk.choices[0]?.delta?.content || '';
    if (text) yield text;
  }
}

module.exports = { streamCoachReply };
