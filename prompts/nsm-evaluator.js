const OpenAI = require('openai');
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function evaluateNSM({ question_json, user_nsm, user_breakdown }) {
  const { company, scenario, coach_nsm } = question_json;

  const productTypeGuide = {
    attention:   '注意力型（社交/媒體/遊戲）：廣度=觸碰核心功能的 MAU，深度=時長/完播，頻率=DAU/MAU 比，業務影響=留存驅力',
    transaction: '交易量型（電商/共享平台）：廣度=活躍供給方，深度=需求方每月交易次數，頻率=成交轉化率，業務影響=復購留存率',
    creator:     '創造力型（UGC/知識平台）：廣度=活躍創作者數，深度=成果品質/互動數，頻率=內容被廣泛閱讀比例，業務影響=商業轉化率',
    saas:        'SaaS 型（B2B/訂閱）：廣度=啟用（Activation）率，深度=席次利用率，頻率=工作流黏著率，業務影響=NRR/帳號擴張信號',
  };

  function guessType(company, scenario) {
    const t = (company + ' ' + scenario).toLowerCase();
    if (/電商|marketplace|外賣|美食|租車|共享|打車|預訂|配送|撮合/.test(t)) return 'transaction';
    if (/saas|企業|b2b|crm|協作|辦公|工具|管理系統|自動化/.test(t)) return 'saas';
    if (/創作|creator|ugc|知識|課程|部落|newsletter|直播|podcast/.test(t)) return 'creator';
    return 'attention';
  }

  const productType = guessType(company, scenario);

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
  "bestMove": "<學員最大亮點，1-2 句，若有好的維度選擇請具體肯定>",
  "mainTrap": "<學員主要陷阱，1-2 句，點出最需改進的地方>",
  "summary": "<整體總評，3-4 句，包含對 NSM 定義和輸入指標設計的整合評價>"
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
