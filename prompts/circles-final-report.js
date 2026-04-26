const OpenAI = require('openai');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const STEP_ORDER = ['C1', 'I', 'R', 'C2', 'L', 'E', 'S'];
const STEP_LABELS = { C1: '澄清情境', I: '定義用戶', R: '發掘需求', C2: '優先排序', L: '提出方案', E: '評估取捨', S: '總結推薦' };

async function generateFinalReport({ stepScores, questionJson }) {
  const completedSteps = STEP_ORDER.filter(function(k) { return stepScores[k]; });

  const stepSummaries = completedSteps.map(function(k) {
    var s = stepScores[k];
    return STEP_LABELS[k] + '（' + k + '）: ' + Math.round(s.totalScore || 0) + '分 — 最強：' + (s.highlight || '—') + ' / 最需改進：' + (s.improvement || '—');
  }).join('\n');

  var avgScore = Math.round(
    completedSteps.reduce(function(sum, k) { return sum + (stepScores[k].totalScore || 0); }, 0) /
    Math.max(completedSteps.length, 1)
  );

  var prompt = '你是 PM 面試教練，正在幫學員生成一份完整模擬面試的總結報告。\n\n' +
    '題目：' + questionJson.problem_statement + '\n' +
    '公司：' + questionJson.company + '\n\n' +
    '各步驟評分摘要：\n' + stepSummaries + '\n\n' +
    '平均分數：' + avgScore + '\n\n' +
    '請生成總結報告，回傳嚴格 JSON（不加 markdown）：\n' +
    '{\n' +
    '  "overallScore": ' + avgScore + ',\n' +
    '  "grade": "A 或 B 或 C 或 D",\n' +
    '  "headline": "10字以內的整體評語",\n' +
    '  "strengths": ["強項1（20字內）", "強項2", "強項3"],\n' +
    '  "improvements": ["改進點1（25字內）", "改進點2", "改進點3"],\n' +
    '  "nextSteps": "建議下一步練習方向（40字內）",\n' +
    '  "coachVerdict": "教練總評（60-80字，具體針對這道題）"\n' +
    '}\n\n' +
    '評分標準：A=85+分, B=70-84分, C=55-69分, D=54分（含）以下';

  var resp = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.4,
    max_tokens: 800,
    response_format: { type: 'json_object' },
  });

  return JSON.parse(resp.choices[0].message.content);
}

module.exports = { generateFinalReport };
