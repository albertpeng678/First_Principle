const OpenAI = require('openai');
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function generateNSMContext({ question_json }) {
  const { company, industry, scenario, coach_nsm } = question_json;

  const prompt = `你是一位 PM 教練，正在為學員提供情境導讀，幫助不熟悉此產品的學員快速理解如何切入北極星指標。

公司：${company}
行業：${industry}
情境：${scenario}
（教練參考 NSM：${coach_nsm}）—— 請勿直接揭露此答案，僅作為你理解此產品核心價值的參考依據。

請提供以下 4 個欄位，用繁體中文幫助學員破題：

1. 商業模式（model）：這家公司如何賺錢？核心服務是什麼？1-2 句話，讓完全不熟悉的人也能理解。
2. 使用者（users）：主要用戶群是誰？他們用這個產品做什麼事？1-2 句話。
3. 常見陷阱（traps）：這家公司在定義 NSM 時最容易被誤導的虛榮指標是什麼？舉具體例子說明為何它反映不了真實價值。1-2 句話。
4. 破題切入（insight）：給學員最關鍵的一個思考角度——不是答案，而是讓他們能自己找到正確 NSM 的核心洞察。這是最有價值的欄位，要大膽、具體、可行動。1-2 句話。

回傳 JSON（繁體中文，不要加 markdown wrapper）：
{
  "model": "<商業模式：如何賺錢、核心服務>",
  "users": "<主要用戶群：誰在用、用來做什麼>",
  "traps": "<常見陷阱：具體虛榮指標 + 為何無效>",
  "insight": "<破題切入：最關鍵的思考角度，大膽且可行動>"
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
