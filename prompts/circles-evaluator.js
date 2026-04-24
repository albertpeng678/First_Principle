const OpenAI = require('openai');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const STEP_RUBRICS = {
  C1: {
    name: '澄清情境',
    dimensions: ['問題邊界清晰度', '業務影響連結', '時間範圍合理性', '假設排除完整性'],
  },
  I: {
    name: '定義用戶',
    dimensions: ['分群邏輯', '焦點選定理由', 'JTBD 動機深度', '排除對象說明'],
  },
  R: {
    name: '發掘需求',
    dimensions: ['功能需求', '情感/社交需求', '痛點層次', '需求優先說明'],
  },
  C2: {
    name: '優先排序',
    dimensions: ['取捨標準顯性化', '最優先項理由', '暫緩項邏輯', '整體排序一致性'],
  },
  L: {
    name: '提出方案',
    dimensions: ['方案數量與多樣性', '各方案差異清晰', '方案可行性', '創意與務實平衡'],
  },
  E: {
    name: '評估取捨',
    dimensions: ['優缺點平衡', '風險識別', '依賴條件', '成功指標選擇'],
  },
  S: {
    name: '總結推薦',
    dimensions: ['推薦清晰度', '選擇理由', '指標領先性', '可操作性'],
  },
};

async function evaluateCirclesStep({ step, frameworkDraft, conversation, questionJson, mode }) {
  const rubric = STEP_RUBRICS[step];
  if (!rubric) throw new Error('Unknown step: ' + step);

  const coachAnswer = (questionJson.coach_circles || {})[step] || '';
  const isSimulation = mode === 'simulation';

  const convText = (conversation || [])
    .map(t => `學員：${t.userMessage}\n教練：${t.interviewee}`)
    .join('\n\n');

  const systemPrompt = `你是 PM 面試評審，正在評分學員在「${rubric.name}」步驟的表現。

題目：${questionJson.problem_statement}
公司：${questionJson.company}

教練示範（標準答案）：
${coachAnswer}

評分維度：${rubric.dimensions.join('、')}

回傳嚴格 JSON，不加 markdown：
{
  "dimensions": [
    {
      "name": "維度名稱",
      "score": 1-5,
      "comment": "一句話點評（20字內）"
    }
  ],
  "totalScore": 數字（dimensions scores 加總 × 4，最高 100 分的比例換算 = sum * 100 / (${rubric.dimensions.length} * 5)）,
  "highlight": "最強的表現（20字內）",
  "improvement": "最需改進的點（25字內）",
  "coachVersion": "${isSimulation ? '完整示範答案（展示給學員）' : '簡短提示（不完全給答案）'}"
}`;

  const userMsg = `框架填寫：\n${Object.entries(frameworkDraft).map(([k,v])=>`${k}: ${v||'未填'}`).join('\n')}\n\n對話記錄：\n${convText}`;

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

module.exports = { evaluateCirclesStep, STEP_RUBRICS };
