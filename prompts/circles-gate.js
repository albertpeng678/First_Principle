const OpenAI = require('openai');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const STEP_META = {
  // fields are for documentation only, not used in code
  C1: { name: '澄清情境' },
  I:  { name: '定義用戶' },
  R:  { name: '發掘需求' },
  C2: { name: '優先排序' },
  L:  { name: '提出方案' },
  E:  { name: '評估取捨' },
  S:  { name: '總結推薦' },
};

async function reviewFramework({ step, frameworkDraft, questionJson, mode }) {
  const meta = STEP_META[step];
  if (!meta) throw new Error(`Unknown CIRCLES step: "${step}"`);
  const wrongDirs = (questionJson.common_wrong_directions || []).join('\n- ') || '（無特別注意事項）';
  const isSimulation = mode === 'simulation';

  const systemPrompt = `你是 PM 面試教練，正在審核學員在「${meta.name}」步驟填寫的框架定向。

題目：${questionJson.problem_statement}
公司：${questionJson.company}

常見錯誤方向：
- ${wrongDirs}

你的任務：
1. 審核學員填寫的 4 個欄位，找出方向性問題
2. 回傳嚴格的 JSON，不加任何 markdown 或說明

JSON 格式：
{
  "items": [
    {
      "field": "欄位名稱",
      "status": "error" | "warn" | "ok",
      "title": "一句話標題（8字內）",
      "reason": "說明原因（20字內）",
      "suggestion": "修正建議（30字內，status=ok 時為 null）"
    }
  ],
  "canProceed": true | false,
  "overallStatus": "error" | "warn" | "ok"
}

規則：
- "error"：方向性錯誤，會誤導整個後續分析
- "warn"：不完整但不致命，可在對話中補充
- "ok"：方向正確
- canProceed = false 只有當有任何 error 且 mode = "drill" 時${isSimulation ? '\n- 這是 simulation 模式：即使有 error 也設 canProceed = true，但 overallStatus 仍標記正確狀態' : ''}
- 每個欄位都必須出現在 items 陣列中`;

  const userMsg = Object.entries(frameworkDraft)
    .map(([k, v]) => `${k}：${v || '（未填）'}`)
    .join('\n');

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const resp = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMsg },
        ],
        temperature: 0.3,
        max_tokens: 800,
        response_format: { type: 'json_object' },
      });

      return JSON.parse(resp.choices[0].message.content);
    } catch (e) {
      if (attempt === 2) throw new Error('框架審核暫時失敗，請重試');
    }
  }
}

module.exports = { reviewFramework };
