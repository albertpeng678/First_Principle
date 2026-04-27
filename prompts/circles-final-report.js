const OpenAI = require('openai');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const STEP_ORDER = ['C1', 'I', 'R', 'C2', 'L', 'E', 'S'];
const STEP_LABELS = {
  C1: '澄清情境',
  I:  '定義用戶',
  R:  '發掘需求',
  C2: '優先排序',
  L:  '提出方案',
  E:  '評估取捨',
  S:  '總結推薦',
};

async function generateFinalReport({ stepScores, questionJson }) {
  const completedSteps = STEP_ORDER.filter(k => stepScores[k]);

  const stepSummaries = completedSteps.map(k => {
    const s = stepScores[k];
    return `${STEP_LABELS[k]}（${k}）: ${Math.round(s.totalScore || 0)}分
  最強：${s.highlight || '—'}
  最需改進：${s.improvement || '—'}`;
  }).join('\n\n');

  const avgScore = Math.round(
    completedSteps.reduce((sum, k) => sum + (stepScores[k].totalScore || 0), 0)
    / Math.max(completedSteps.length, 1)
  );

  const systemPrompt = `你是 PM 面試教練，正在為學員生成「完整模擬面試」的總結報告。學員剛走完 CIRCLES 7 個步驟，每步都有 AI 評分。你的任務是給出整體評估與下一步建議。

格式要求：
• 回傳合法 JSON（不加 markdown wrapper）
• 全部繁體中文
• 各欄位字數限制要嚴格遵守
• 報告必須具體針對這道題的分析過程，不要寫空泛廢話

評分等級：
• A：85 分以上 — 框架完整、邏輯嚴密、有獨到洞察
• B：70-84 分 — 整體合格，個別環節有提升空間
• C：55-69 分 — 框架走完了，但深度不足或邏輯有跳躍
• D：54 分以下 — 多個環節未到位，需要重新練習基礎

回傳 JSON 結構：
{
  "overallScore": <整數，已預先計算為各步驟平均分>,
  "grade": "A" | "B" | "C" | "D",
  "headline": "<10字內，一句話定調這次表現，例如「框架完整，洞察突出」「思路清楚，深度待強化」>",
  "strengths": [
    "<強項1，20字內，必須具體指出哪個步驟的什麼表現好>",
    "<強項2>",
    "<強項3>"
  ],
  "improvements": [
    "<改進點1，25字內，必須具體指出哪個步驟的什麼缺陷與如何改>",
    "<改進點2>",
    "<改進點3>"
  ],
  "nextSteps": "<下一步練習建議，40字內，要具體：例如「先用 drill 模式單練 R 步驟 3 次，重點是把痛點分到三個層次」>",
  "coachVerdict": "<教練總評，60-80字，必須具體針對這道題的分析過程，包含：一個讚賞的關鍵亮點 + 一個直接的批判 + 一句鼓勵>"
}

禁止寫的廢話：
• 「整體表現不錯」「分析還可以」「繼續加油」（沒有資訊量）
• 「需要更深入思考」（不具體）
• 「邏輯需要更嚴謹」（沒指出哪裡）`;

  const userMsg = `題目：${questionJson.problem_statement}
公司：${questionJson.company}

學員 7 個步驟的評分：
${stepSummaries}

平均分數：${avgScore}（請填入 overallScore 欄位）

依據以上資訊，生成完整總結報告。`;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const resp = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMsg },
        ],
        temperature: 0.4,
        max_tokens: 900,
        response_format: { type: 'json_object' },
      });
      const result = JSON.parse(resp.choices[0].message.content);
      // Always trust our computed avgScore over what the LLM returns.
      result.overallScore = avgScore;
      return result;
    } catch (e) {
      if (attempt === 2) throw new Error('總結報告生成暫時失敗，請重試');
      await new Promise(r => setTimeout(r, 800 * (attempt + 1)));
    }
  }
}

module.exports = { generateFinalReport };
