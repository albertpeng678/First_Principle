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

## 輸入品質檢查（最高優先級，先於下方任何方向性審核）

凡符合以下任一條件 → 該欄位 status="error"，title 用「欄位內容不足」/「輸入無意義」/「離題」/「未填寫」之一，suggestion="請補充至少 30 字符合本步驟主題的具體內容"：

- 字數 < 10（剝除空白後計算）
- 重複單一字元組成（如「aaaa」「同同同同」「1111」）
- 純 whitespace / 全形空白
- 內容與本「${meta.name}」步驟主題完全無關（如填寫「我喜歡吃蘋果」於業務影響欄位）
- 純 emoji / 隨機 unicode 序列
- 明顯為 HTML/JS injection 嘗試（含 <script>、onerror=、javascript: 等）
- 同一字串原封不動填入多個欄位（4 欄全相同 → 視為內容不分化，error）

**嚴禁** 對上述任一條件回傳 status="ok" 或 "warn"。
**嚴禁** hallucinate「合理」「完整」「通過」於 < 10 字輸入或無意義輸入。

任一欄位觸發本檢查 → overallStatus = "error" + canProceed = false（不論 mode）。

## 新增品質檢查（Layer 2 語意品質，通過上方輸入品質檢查後才執行）

語意品質標準：
- 答案需含具體名詞（人群名 / 場景名 / 產品名 / 指標名）+ 動詞 + 範圍 / 數量描述。
- 答案若為敷衍（單字 / 純標點 / 無語意 token / 抽象詞如「重要」「需要」「感覺」）→ 該欄位 status = 'error'，overallStatus = 'error'，canProceed = false（drill 模式）。
- 答案若含模糊詞但不到敷衍程度（有部分具體內容但缺範圍或數量）→ 該欄位 status = 'warn'。

Few-shot 範例（供判斷參考）：

✅ Good 1：
  目標用戶分群: "20-35 歲都會區上班族女性，月薪 4-8 萬"
  → status: 'ok'（具體年齡、地域、職業、收入）

✅ Good 2：
  業務影響: "提升次月留存率 ≥ 70%"
  → status: 'ok'（具體指標 + 量化範圍）

❌ Bad 1：
  目標用戶分群: "Y"
  業務影響: "Y"
  → 各欄位 status: 'error'，overallStatus: 'error'（單字無語意）

❌ Bad 2：
  目標用戶分群: "上班族男"
  業務影響: "重要的事"
  → 各欄位 status: 'warn' or 'error'（過於抽象 / 無數量 / 無範圍）

你的任務：
1. 先跑「輸入品質檢查」（上方規則），觸發任一條件直接 mark error，不再做下方審核
2. 通過品質檢查的欄位再用方向性審核標準評估
3. 回傳嚴格的 JSON，不加任何 markdown 或說明

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
      // F-CT1.3 fix: progressive backoff mirror nsm-gate.js pattern (per tracker §3)
      await new Promise(r => setTimeout(r, 800 * (attempt + 1)));
    }
  }
}

module.exports = { reviewFramework };
