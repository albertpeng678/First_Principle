const OpenAI = require('openai');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const STEP_META = {
  C1: { name: '澄清情境', fields: ['問題範圍', '時間範圍', '業務影響', '假設確認'] },
  I:  { name: '定義用戶', fields: ['目標用戶分群', '選定焦點', '用戶動機假設', '排除對象'] },
  R:  { name: '發掘需求', fields: ['功能性需求', '情感性需求', '社交性需求', '核心痛點'] },
  C2: { name: '優先排序', fields: ['取捨標準', '最優先項目', '暫緩項目', '排序理由'] },
  L:  { name: '提出方案', fields: ['方案一', '方案二', '方案三（可選）', '各方案特性'] },
  E:  { name: '評估取捨', fields: ['方案優點', '方案缺點', '風險與依賴', '成功指標'] },
  S:  { name: '總結推薦', fields: ['推薦方案', '選擇理由', '北極星指標', '追蹤指標'] },
};

async function reviewFramework({ step, frameworkDraft, questionJson, mode }) {
  const meta = STEP_META[step];
  const wrongDirs = (questionJson.common_wrong_directions || []).join('\n- ');
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
}

module.exports = { reviewFramework };
