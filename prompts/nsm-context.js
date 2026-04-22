const OpenAI = require('openai');
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function generateNSMContext({ question_json }) {
  const { company, industry, scenario } = question_json;

  const prompt = `你是一位 PM 教練，正在為學員提供情境導讀，幫助不熟悉此產品的學員快速理解如何切入北極星指標。

公司：${company}
行業：${industry}
情境：${scenario}

請提供以下內容，幫助學員破題：

1. 一句話說明這家公司的核心商業模式（讓完全不熟悉的人也能理解）
2. 指出這家公司的主要「使用者類型」（誰在用、用來做什麼）
3. 點出這類產品在定義 NSM 時最常犯的 1 個陷阱
4. 給出 1 個思考切入點（不是答案，是方向）

回傳 JSON（繁體中文）：
{
  "businessModel": "<一句話：這家公司如何賺錢、核心服務是什麼>",
  "userTypes": "<主要用戶群是誰，用來做什麼事>",
  "commonTrap": "<這類產品最常見的虛榮指標陷阱>",
  "thinkingAngle": "<給學員的破題切入角度，一句話方向性指引>"
}`;

  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.3,
    response_format: { type: 'json_object' },
    messages: [{ role: 'user', content: prompt }]
  });
  return JSON.parse(response.choices[0].message.content);
}

module.exports = { generateNSMContext };
