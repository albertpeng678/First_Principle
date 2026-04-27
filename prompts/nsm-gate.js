const OpenAI = require('openai');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Per-criterion guidance: what earns each status level.
// Shared with the AI so it applies the same standard every time.
const CRITERIA_GUIDE = [
  {
    name: 'NSM定義清晰度',
    focus: 'NSM 是否用一句話清楚描述具體用戶行為 + 量化門檻',
    error: [
      '定義極度模糊——例如「提升用戶滿意度」「增加用戶黏著度」「提高活躍度」，沒有任何具體行為或量化描述',
      'NSM 描述的是公司目標而非用戶行為——例如「提升 ARR」「增加 GMV」（結果指標，非行為指標）',
    ],
    warn: [
      '有量化元素但缺少行為門檻——例如「月活用戶數」未說明「完成何種核心行為才算活躍」',
      'NSM 定義太寬泛，涵蓋的行為過多，失去聚焦',
    ],
    ok: [
      'NSM 用一句話描述具體用戶行為 + 量化門檻——例如「每月完成 ≥3 堂課程的學習者數」「每月成功完成無退貨訂單的買家數」',
    ],
  },
  {
    name: '與業務目標的連結',
    focus: '學員是否說明此 NSM 如何驅動公司的核心商業結果（營收/留存/擴張）',
    error: [
      '完全沒有說明連結',
      '邏輯不成立——例如「用戶開心了就有收入」沒有說明機制',
      '連結的是間接結果，非直接商業驅動',
    ],
    warn: [
      '有嘗試說明但邏輯跳躍——點出了相關性但未說明因果機制（NSM 上升 → 如何具體帶動收入？）',
      '只提到「用戶留存率提升」而非說明對公司的財務影響',
    ],
    ok: [
      '清楚說明 NSM 如何驅動具體商業結果：訂閱續費率、廣告效益、交易佣金、NRR、擴張收入等',
    ],
  },
  {
    name: '可測量性',
    focus: '此指標能否用現有的產品埋點或分析工具直接追蹤，定義清晰無歧義',
    error: [
      '根本無法量化——例如「用戶開心程度」「品牌親近感」「用戶幸福感」',
      '定義模糊到不同人測出不同值，例如「用戶參與度」（何謂「參與」？）',
    ],
    warn: [
      '理論可測但需要特殊系統支援（如深度質性研究），一般公司難以常規追蹤',
      '指標定義需要進一步澄清才能建立量測方案',
    ],
    ok: [
      '指標可用產品埋點、分析工具（Amplitude/Mixpanel/GA/後台報表）直接追蹤',
      '定義清晰，不同人按同一定義測量會得出相同結果',
    ],
  },
  {
    name: '非虛榮指標',
    focus: '指標是否直接反映用戶完成核心任務（AHA 時刻）的行為，而非表面活躍數據',
    error: [
      '直接使用虛榮指標：DAU、MAU、App 打開次數、頁面瀏覽量、下載數、累計用戶數、註冊數、帳號創建數',
      '指標只反映用戶「出現了」但不反映用戶「真正獲得了價值」',
    ],
    warn: [
      '指標不是典型虛榮指標，但與用戶完成 AHA 時刻的連結薄弱——例如「登入次數」vs「完成任務次數」',
      '指標容易被表面行為污染——例如「發送訊息數」（包含空訊息、測試訊息）',
    ],
    ok: [
      '指標直接捕捉用戶完成 AHA 時刻的行為——例如「完成第一筆交易」「連續完成課程」「成功媒合並啟動對話」',
      '指標上升必然代表用戶真正獲取了產品的核心價值',
    ],
  },
];

async function reviewNSMGate({ question, nsm, rationale }) {
  const systemPrompt = `你是 PM 教練，正在審核學員提交的北極星指標（NSM）定義，判斷是否具備進入指標拆解訓練的基礎。

───────────────────────────────
題目背景
───────────────────────────────
公司：${question.company || '（未提供）'}
產業：${question.industry || '（未提供）'}
情境：${question.scenario || question.problem_statement || '（未提供）'}

───────────────────────────────
4 項評估標準與判斷依據
───────────────────────────────
${CRITERIA_GUIDE.map((c, i) => `
${i + 1}. ${c.name}
   聚焦：${c.focus}
   ✗ error 情況：
     ${c.error.map(e => '• ' + e).join('\n     ')}
   ⚠ warn 情況：
     ${c.warn.map(w => '• ' + w).join('\n     ')}
   ✓ ok 情況：
     ${c.ok.map(o => '• ' + o).join('\n     ')}`).join('\n')}

───────────────────────────────
回傳格式（嚴格 JSON，不加 markdown）
───────────────────────────────
{
  "items": [
    {
      "criterion": "標準名稱（從上方 4 個名稱完整取用，順序一致）",
      "status": "ok" | "warn" | "error",
      "feedback": "一句話評語，zh-TW，指出具體問題或優點，30字內",
      "suggestion": "修正建議（status=ok 時為 null；error/warn 時給出可立即執行的改法，20字內）"
    }
  ],
  "canProceed": true | false,
  "overallStatus": "ok" | "warn" | "error"
}

評分規則：
• 全部 4 項都必須出現，順序與上方一致
• canProceed = false 當且僅當有任何 status 為 "error"
• overallStatus = items 中最嚴重的 status（error > warn > ok）
• 嚴格評分——寧可多給 warn 也不要放水；只有真正符合 ok 條件才給 ok
• feedback 要具體指出「哪裡好」或「哪裡有問題」，不要說廢話如「定義不夠清晰」`;

  const userMsg = `學員的 NSM 定義：
${nsm || '（未填）'}

學員說明此 NSM 與業務目標的連結：
${rationale || '（未填）'}`;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const resp = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMsg },
        ],
        temperature: 0.2,
        max_tokens: 900,
        response_format: { type: 'json_object' },
      });
      return JSON.parse(resp.choices[0].message.content);
    } catch (e) {
      if (attempt === 2) throw new Error('NSM 審核暫時失敗，請重試');
      await new Promise(r => setTimeout(r, 800 * (attempt + 1)));
    }
  }
}

module.exports = { reviewNSMGate };
