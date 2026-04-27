const OpenAI = require('openai');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Detect product archetype to calibrate the insight and traps fields.
function guessProductType(company, scenario) {
  const text = (company + ' ' + (scenario || '')).toLowerCase();
  if (/電商|marketplace|外賣|美食|叫車|打車|共享|租車|配送|撮合|airbnb|uber|grab|foodpanda|wolt|booking/.test(text))
    return 'transaction';
  if (/saas|企業|b2b|crm|協作|辦公|工具|管理|zendesk|slack|notion|figma|datadog|zoom|intercom|twilio|stripe|shopify/.test(text))
    return 'saas';
  if (/教育|學習|課程|語言|創作|ugc|知識|podcast|直播|duolingo|coursera|creator/.test(text))
    return 'creator';
  return 'attention';
}

const PRODUCT_TYPE_LENS = {
  attention: {
    label: '注意力型（媒體/社交/訂閱制）',
    trap_angle: '這類產品最常見的陷阱是把「出現」當「投入」——DAU、App 打開次數只代表用戶來了，不代表他們真正消費了有價值的內容',
    nsm_angle: 'NSM 應捕捉深度參與行為，而非表面流量。關鍵問題：用戶完成了什麼「核心任務」才算真正獲得了這個產品的價值？',
  },
  transaction: {
    label: '交易量型（電商/共享/O2O）',
    trap_angle: '這類雙邊市場最常見的陷阱是把「意圖」當「成交」——瀏覽量、加入購物車數、搜尋次數都是成交前行為，無法反映真實平台健康度',
    nsm_angle: 'NSM 應聚焦於「真正完成的交易」，而且要排除取消和退貨。關鍵問題：何種類型的完成訂單才代表買賣雙方都獲得了價值？',
  },
  creator: {
    label: '創造力型（UGC/教育/知識平台）',
    trap_angle: '這類平台最常見的陷阱是把「被動消費」當「主動完成」——影片觀看數、頁面瀏覽都是中間行為，用戶學到了什麼/創作了什麼才是核心',
    nsm_angle: 'NSM 應捕捉「成果」而非「過程」——完成課程、發布作品、習慣養成（連續學習N天）。關鍵問題：何種行為代表用戶真正受益？',
  },
  saas: {
    label: 'SaaS 型（B2B/訂閱工具）',
    trap_angle: '這類產品最常見的陷阱是把「開通帳號」當「真正使用」——帳號數、登入次數只代表可能性，唯有核心功能被日常工作流整合才有留存價值',
    nsm_angle: 'NSM 應反映「核心功能被真正使用」——不是開帳號，而是完成了讓用戶「再也回不去」的關鍵動作。問：用戶用這個工具完成了什麼工作流任務？',
  },
};

async function generateNSMContext({ question_json }) {
  const { company, industry, scenario, coach_nsm } = question_json;
  const productType = guessProductType(company, scenario);
  const lens = PRODUCT_TYPE_LENS[productType];

  const systemPrompt = `你是 PM 教練，為學員提供「北極星指標（NSM）訓練」的破題導讀卡。

你的目標是幫助學員自己想到正確方向——不是給出答案，而是給出鑰匙。

產品類型判定：${lens.label}
陷阱方向參考：${lens.trap_angle}
NSM 思考方向：${lens.nsm_angle}

教練參考 NSM（幫助你理解這個產品的核心價值所在，但絕對不能直接揭露）：
${coach_nsm || '（請自行根據公司情境和產品類型推斷）'}

輸出規格：
• 回傳合法 JSON，不加 markdown wrapper
• 每個欄位繁體中文，語言精準，1-2 句
• traps 必須點名 1-2 個「${company}」最具體的虛榮指標名稱（不是泛泛說「避免虛榮指標」）
• insight 是最有價值的欄位——要大膽、具體、針對「${company}」的商業模式，讓學員看完後「恍然大悟」，而不是「當然如此」`;

  const userMsg = `公司：${company}
產業：${industry}
情境：${scenario}

請提供以下 4 個欄位的導讀：

1. model（商業模式）
   這家公司靠什麼賺錢？核心商業機制是什麼？讓一個完全不熟悉這家公司的人也能一眼看懂。
   格式：直述句，說清楚賺錢方式 + 核心服務，1-2 句。

2. users（使用者）
   主要用戶群是誰？他們為什麼使用這個產品、用它來完成什麼生活或工作中的任務？
   格式：先定義用戶，再說明使用動機/情境，1-2 句。

3. traps（常見陷阱）
   針對「${company}」，PM 學員定義 NSM 時最容易落入的 1-2 個虛榮指標陷阱。
   必須：點名具體指標名稱（如「下載數」「DAU」），並用一句話解釋為何它無法反映真實用戶價值。
   格式參考：「把『X』或『Y』當 NSM——[具體說明為何這個指標欺騙性地看起來合理，但實際上無法反映用戶真正獲得了什麼價值]」

4. insight（破題切入）
   給學員最關鍵的一個思考角度，讓他們能自己推導出正確的 NSM 方向。
   不是答案，而是讓學員「恍然大悟」的核心洞察——針對「${company}」的具體商業模式和用戶行為，1-2 句。
   格式：先說出核心洞察，再說明這個洞察如何直接指向 NSM 的設計方向。

回傳 JSON：
{
  "model": "...",
  "users": "...",
  "traps": "...",
  "insight": "..."
}`;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const resp = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMsg },
        ],
        temperature: 0.3,
        max_tokens: 700,
        response_format: { type: 'json_object' },
      });
      return JSON.parse(resp.choices[0].message.content);
    } catch (e) {
      if (attempt === 2) throw new Error('NSM 情境分析暫時失敗，請重試');
      await new Promise(r => setTimeout(r, 800 * (attempt + 1)));
    }
  }
}

module.exports = { generateNSMContext };
