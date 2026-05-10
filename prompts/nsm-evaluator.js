const OpenAI = require('openai');
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const { guessProductType } = require('./utils/product-type');

async function evaluateNSM({ question_json, user_nsm, user_breakdown }) {
  const { company, scenario, coach_nsm } = question_json;

  const productTypeGuide = {
    attention:   '注意力型（社交/媒體/遊戲）：廣度=觸碰核心功能的 MAU，深度=時長/完播，頻率=DAU/MAU 比，業務影響=留存驅力',
    transaction: '交易量型（電商/共享平台）：廣度=活躍供給方，深度=需求方每月交易次數，頻率=成交轉化率，業務影響=復購留存率',
    creator:     '創造力型（UGC/知識平台）：廣度=活躍創作者數，深度=成果品質/互動數，頻率=內容被廣泛閱讀比例，業務影響=商業轉化率',
    saas:        'SaaS 型（B2B/訂閱）：廣度=啟用（Activation）率，深度=席次利用率，頻率=工作流黏著率，業務影響=NRR/帳號擴張信號',
  };

  const productType = guessProductType(question_json);

  const prompt = `你是一位嚴格的 PM 教練，正在評估學員定義北極星指標（NSM）的能力。

公司情境：
公司：${company}
情境：${scenario}
產品類型：${productType}（${productTypeGuide[productType]}）
參考 NSM：${coach_nsm || '（由你根據情境判斷）'}

學員的回答：
北極星指標定義：${user_nsm}

學員的 4 維度輸入指標拆解：
- 廣度/觸及（Breadth/Reach）：${user_breakdown?.reach || '（未填寫）'}
- 深度（Depth）：${user_breakdown?.depth || '（未填寫）'}
- 頻率（Frequency）：${user_breakdown?.frequency || '（未填寫）'}
- 業務影響（Business Impact）：${user_breakdown?.impact || '（未填寫）'}

## 輸入品質檢查（最高優先級，先於評分準則）

凡 user_nsm 或任一 user_breakdown 維度（reach/depth/frequency/impact）符合以下任一條件：

- 字數 < 10（剝除空白後）
- 重複單一字元（如「aaaa」「同同同同」）
- 純 whitespace / 全形空白
- 純 emoji / 隨機 unicode 序列
- 內容與題目情境完全無關（如「我喜歡吃蘋果」）
- 明顯為 HTML/JS injection 嘗試（含 <script> 等）
- 5 個欄位（user_nsm + 4 breakdown）原封不動同字串

→ 該維度的對應評分 score = 1（嚴禁給高分）；coachComments 該欄位必須具體點出「學員未填具體內容」。

若 5 個欄位**全部**觸發 → 5 維度 alignment/leading/actionability/simplicity/sensitivity 全 score=1，totalScore = 20。

**嚴禁** hallucinate「定義清晰」「合理」「具體」「扎實」「思路清晰」於 garbage 輸入。
**嚴禁** 給 score ≥ 3 於 < 10 字輸入或無意義輸入。
**嚴禁** 在 summary / bestMove 用「展現」「呈現」「展示了」這類正面語對 garbage 輸入。

bestMove 對 garbage 輸入應該空字串或填「本次無法辨識亮點」；
mainTrap 對 garbage 輸入應該具體點出「N 個欄位字數不足」；
summary 對 garbage 輸入應該整段反映「輸入品質不足」。

評分準則（重要）：
1. 輸入指標應是 NSM 的真實領先訊號——它們翻倍，NSM 應跟著成長。
2. 依據產品類型「${productType}」，判斷學員選擇的維度詮釋是否符合該類型產品的關鍵邏輯。
3. 嚴格區分「虛榮指標」（下載數、PV、點擊數等）與「價值指標」（真實行為轉化）。
4. 未填維度請在 coachTree 補出教練版本，並在 mainTrap 或 summary 中點出。
5. 若學員選擇了適合產品類型的詮釋角度（如交易型側重供需平衡），應在 bestMove 中肯定。

NSM 本身的評分維度：
- alignment（價值關聯性）：NSM 是否反映真實商業價值，非虛榮指標
- leading（領先指標性）：能否預測未來營收或留存，而非事後衡量結果
- actionability（操作性）：開發團隊能否透過產品功能直接影響此指標
- simplicity（可理解性）：指標是否直觀，全公司（含非技術人員）都能理解
- sensitivity（週期敏感度）：變化能否在 1–2 週內觀測到，適合迭代節奏

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
    "alignment": "<2-3 句，點出學員 NSM 與商業價值的關聯強弱，舉出具體改進方向>",
    "leading": "<2-3 句，說明該 NSM 能否預測業務結果，是領先還是滯後指標>",
    "actionability": "<2-3 句，說明產品團隊能否直接推動此指標，或太依賴外部因素>",
    "simplicity": "<2-3 句，說明指標定義是否清晰，非 PM 能否直覺理解>",
    "sensitivity": "<2-3 句，說明指標變化速度是否適合 1-2 週迭代週期>"
  },
  "coachTree": {
    "nsm": "<教練版 NSM，一句話，包含量化描述>",
    "reach": "<教練版廣度指標，依產品類型詮釋，一句話>",
    "depth": "<教練版深度指標，依產品類型詮釋，一句話>",
    "frequency": "<教練版頻率指標，依產品類型詮釋，一句話>",
    "impact": "<教練版業務影響指標，依產品類型詮釋，一句話>"
  },
  "coachRationale": {
    "nsm": "<2-3 句：教練為何這樣定義 NSM——從 AHA 時刻切入、排除哪些虛榮指標、如何直接預測商業結果>",
    "reach": "<2-3 句：廣度指標選擇邏輯——對應哪個核心用戶行為、為何不選登入數或 DAU>",
    "depth": "<2-3 句：深度指標設計邏輯——如何衡量互動品質、與 NSM 的數學關係>",
    "frequency": "<2-3 句：頻率指標選擇依據——如何體現習慣養成、與長期留存的關聯>",
    "impact": "<2-3 句：業務影響指標邏輯——如何連結用戶行為與商業變現、為何優先選這個>"
  },
  "bestMove": "<學員最大亮點，1-2 句，若有好的維度選擇請具體肯定>",
  "mainTrap": "<學員主要陷阱，1-2 句，點出最需改進的地方>",
  "summary": "<整體總評，3-4 句，包含對 NSM 定義和輸入指標設計的整合評價>"
}`;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await client.chat.completions.create({
        model: 'gpt-4o',
        temperature: 0.3,
        max_tokens: 1500,
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
