const OpenAI = require('openai');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const STEP_DIMENSIONS = {
  C1: ['問題範圍（地理/平台/功能）', '時間脈絡（何時開始）', '業務影響（量化）'],
  I:  ['目標用戶分群', '選定焦點對象的理由', '排除對象'],
  R:  ['功能性需求', '情感/社交需求', '核心痛點'],
  C2: ['取捨標準', '優先項目與理由', '暫緩項目'],
  L:  ['方案一', '方案二', '各方案核心差異'],
  E:  ['方案優缺點', '風險與依賴', '成功指標'],
  S:  ['推薦方案', '選擇理由', '北極星指標'],
};

async function checkConclusion(step, conclusionText, questionJson) {
  const dims = (STEP_DIMENSIONS[step] || []).join('、');
  const prompt = `你是 PM 面試教練，評估學員的步驟結論是否涵蓋關鍵維度。

題目：${questionJson.problem_statement}
步驟：${step}
應涵蓋維度：${dims}

學員結論：
${conclusionText}

請判斷結論是否已涵蓋主要維度。
- 若已涵蓋：只回覆一行 JSON：{"ok": true, "message": "範圍、時間脈絡、業務影響都涵蓋了。"}
- 若有缺漏：只回覆一行 JSON：{"ok": false, "message": "尚未提到[最重要的缺漏維度]——例如[一個具體例子]。"}
只輸出 JSON，不要其他文字。`;

  const res = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 100,
    temperature: 0.3,
  });
  try {
    return JSON.parse(res.choices[0].message.content.trim());
  } catch (_) {
    return { ok: true, message: '' };
  }
}

module.exports = { checkConclusion };
