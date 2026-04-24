const OpenAI = require('openai');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const STEP_FOCUS = {
  C1: '澄清問題邊界、業務影響、時間範圍、假設確認',
  I:  '用戶分群方式、選定焦點對象的理由、JTBD 動機',
  R:  '功能/情感/社交三層需求、核心痛點層次',
  C2: '取捨標準說明、優先級理由、暫緩項目的邏輯',
  L:  '方案多樣性、各方案的核心差異與適用情境',
  E:  '各方案的風險、依賴條件、成功指標的選擇',
  S:  '推薦的清晰度、指標的領先性與可操作性',
};

function buildSystemPrompt(session) {
  const step = session.drill_step || 'C1';
  const mode = session.mode;

  if (mode !== 'drill' && mode !== 'simulation') {
    throw new Error('Invalid mode: ' + mode);
  }

  const q = session.question_json;
  const isSimulation = mode === 'simulation';
  const focus = STEP_FOCUS[step] || '';
  const turnCount = (session.conversation || []).length;
  const hiddenCtx = q.hidden_context || '';

  return `你在這個對話中同時扮演三個角色，每次回覆格式固定如下：

【被訪談者】
（你的回答）

【教練點評】
（你的點評）

【教練提示】
（你的提示）

---

題目：${q.problem_statement}
公司：${q.company}
步驟：${step}（${focus}）

角色 A（被訪談者）：
- 你是 ${q.company} 的產品負責人，被學員訪談
- 隱藏資訊（被訪談者知道但不主動說）：${hiddenCtx}
- 學員問得模糊 → 你給模糊答案
- 學員預設解法 → 你說「我說不清楚怎麼解，只知道遇到什麼問題」
- 回答口語、2-4 句

角色 B（教練點評）：
- 點評這輪對話在「${focus}」上的探索品質
- 指出探索到了哪個層次、還缺什麼
- 最多 2 句${isSimulation ? '\n- Simulation 模式：只標方向錯誤，不給正確答案' : '\n- Drill 模式：可給具體引導'}

角色 C（教練提示）：
- 一句話，引導下一輪探索方向
- 不直接給答案${isSimulation ? '\n- Simulation 模式：提示可以更模糊一些' : ''}

${turnCount >= 3 ? '已進行多輪，如果探索足夠充分，可以暗示學員可以提交這個步驟了。' : ''}`.trim();
}

function buildMessages(session, newMessage) {
  const history = (session.conversation || []).slice(-8);
  return [
    ...history.flatMap(t => [
      { role: 'user', content: t.userMessage },
      { role: 'assistant', content: `【被訪談者】\n${t.interviewee || ''}\n\n【教練點評】\n${t.coaching || ''}\n\n【教練提示】\n${t.hint || ''}` },
    ]),
    { role: 'user', content: newMessage },
  ];
}

async function* streamCirclesReply(session, userMessage) {
  let stream;
  try {
    stream = await openai.chat.completions.create({
      model: 'gpt-4o',
      stream: true,
      messages: [
        { role: 'system', content: buildSystemPrompt(session) },
        ...buildMessages(session, userMessage),
      ],
      temperature: 0.7,
      max_tokens: 600,
    });
  } catch (e) {
    throw new Error('AI 回覆串流失敗，請重試');
  }

  for await (const chunk of stream) {
    const text = chunk.choices[0]?.delta?.content || '';
    if (text) yield text;
  }
}

module.exports = { streamCirclesReply, buildSystemPrompt, buildMessages };
