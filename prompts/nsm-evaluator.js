const OpenAI = require('openai');
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function evaluateNSM({ question_json, user_nsm, user_breakdown }) {
  const { company, scenario, coach_nsm } = question_json;

  const prompt = `你是一位嚴格的 PM 教練，正在評估學員定義北極星指標（NSM）的能力。

公司情境：
公司：${company}
情境：${scenario}
參考 NSM：${coach_nsm || '（由你根據情境判斷）'}

學員的回答：
北極星指標定義：${user_nsm}

學員的 4 維度拆解：
- 觸及廣度 (Reach)：${user_breakdown?.reach || '（未填寫）'}
- 使用深度 (Depth)：${user_breakdown?.depth || '（未填寫）'}
- 使用頻率 (Frequency)：${user_breakdown?.frequency || '（未填寫）'}
- 轉換效率 (Efficiency)：${user_breakdown?.efficiency || '（未填寫）'}

請評分（各維度 1–5 分）並給出具體教練點評。

評分維度說明：
- alignment（價值關聯性）：指標是否反映真實商業價值，而非虛榮指標
- leading（領先指標性）：能否預測未來營收或留存
- actionability（操作性）：開發團隊能否透過功能直接影響此指標
- simplicity（可理解性）：指標是否直觀，全公司都能理解
- sensitivity（週期敏感度）：變化能否在 1–2 週內觀測到

totalScore = (alignment + leading + actionability + simplicity + sensitivity) * 4（滿分 100）

請以繁體中文回覆，回傳合法 JSON，格式如下：
{
  "scores": {
    "alignment": <1-5>,
    "leading": <1-5>,
    "actionability": <1-5>,
    "simplicity": <1-5>,
    "sensitivity": <1-5>
  },
  "totalScore": <20-100>,
  "coachComments": {
    "alignment": "<具體評語，2-3 句>",
    "leading": "<具體評語>",
    "actionability": "<具體評語>",
    "simplicity": "<具體評語>",
    "sensitivity": "<具體評語>"
  },
  "coachTree": {
    "nsm": "<教練版 NSM>",
    "reach": "<教練版 Reach 指標>",
    "depth": "<教練版 Depth 指標>",
    "frequency": "<教練版 Frequency 指標>",
    "efficiency": "<教練版 Efficiency 指標>"
  },
  "bestMove": "<學員最大亮點，1-2 句>",
  "mainTrap": "<學員主要陷阱，1-2 句>",
  "summary": "<整體總評，3-4 句>"
}`;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await client.chat.completions.create({
        model: 'gpt-4o',
        temperature: 0.3,
        response_format: { type: 'json_object' },
        messages: [{ role: 'user', content: prompt }]
      });
      const result = JSON.parse(response.choices[0].message.content);
      if (!result.totalScore) {
        const s = result.scores;
        result.totalScore = (s.alignment + s.leading + s.actionability + s.simplicity + s.sensitivity) * 4;
      }
      return result;
    } catch (e) {
      if (attempt === 2) throw e;
      await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
}

module.exports = { evaluateNSM };
