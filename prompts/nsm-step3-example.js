const OpenAI = require('openai');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Per-type, per-dim guidance for what a good NSM Step 3 example should contain.
// Format: '<productType>.<dimId>' — 4 types × 4 dims = 16 entries.
// Transaction and Creator types use structurally identical dim keys (reach/depth/
// frequency/impact) but the semantics differ (e.g. reach = supply breadth for
// transaction, creative output breadth for creator). Fallback keys cover any
// future types that are not explicitly defined here.
const FIELD_SHAPES = {
  // ── Attention 型（媒體 / 社交 / 遊戲）──────────────────────────────────────
  'attention.reach':
    'numerator/denominator 清楚定義（如「過去 30 日內完成 ≥ 1 次核心互動的 MAU / 全月訂閱 MAU」）'
    + ' + segment scope（指定哪個 user segment 被包含，例如「App 用戶」「免費用戶」「特定地區」）'
    + ' + 1 排除項（明確排除「純打開 App / 僅看首頁但未點擊核心內容」）'
    + ' + 為何此 reach 反映真實觸及而非虛榮曝光（點出「打開」與「真正體驗核心」之間的差距）',

  'attention.depth':
    '具體的深度信號（觀看時長 / 完播率 / 互動次數 / 內容消費量），量化門檻必須可 query'
    + ' + 閾值選定理由（為什麼是這個數字而非更高或更低——cohort 分析 / survey / 業界基準）'
    + ' + 為何此信號代表「真投入」而非「形式性使用」（舉 1 個能區分真假投入的關鍵行為差異）'
    + ' + 排除 1 個看起來像深度但不算的行為（如重複觀看同一內容、自動播放產生的被動時長）',

  'attention.frequency':
    '觀測週期選擇（日 / 週 / 月）+ 理由（對應此產品的自然使用節奏，例如串流是週，社交是日）'
    + ' + 頻率閾值（幾次才算「養成習慣」——引用行為心理學或 cohort 分析說明此數字）'
    + ' + 排除 1 個干擾頻率的情況（如節假日暴增 / 行銷推播驅動的被動回訪）'
    + ' + 量化目標（例如 DAU/MAU ≥ 30% 或「≥ 3 天 / 週的用戶比例 ≥ X%」）',

  'attention.impact':
    '具體留存或商業指標（30d 留存率 / 付費轉化率 / 廣告收益 / NDR），禁止只說「留存提升」'
    + ' + 因果鏈（NSM 上升後哪個用戶行為改變驅動了這個商業指標，例如「習慣形成 → 月活提高 → 廣告 eCPM ↑」）'
    + ' + 量化估算（NSM +10% → 商業指標 +Y pp，可引用同類競品公開數據或 cohort 估算）'
    + ' + 邊界條件（說明 NSM 在哪種情況下可能無法代理商業健康，讓範例顯得嚴謹）',

  // ── SaaS 型（B2B / 訂閱服務）────────────────────────────────────────────────
  'saas.reach':
    'Activation 定義（分子是「完成核心工作流的人數」，分母是「新開帳號數」，邊界必須清楚）'
    + ' + 具體的 activation 行為（不是 signup，要到「完成第一個 project / 發送第一條訊息 / 成功跑完核心 workflow」這層）'
    + ' + 排除 1 個表面看起來像 activation 但不算的情況（例如「僅登入查看 demo workspace」「僅完成 onboarding wizard 但未實際使用」）'
    + ' + 為何此定義能反映真實啟用而非試用行為',

  'saas.depth':
    '席次利用率定義（分子：30 天內完成核心動作的席次數 / 分母：已開通席次數），排除 admin / IT / 純 viewer'
    + ' + 量化閾值（例如「席次利用率 ≥ 60%」代表健康；< 40% 代表續約風險）'
    + ' + 「核心動作」的具體定義（可 query 的行為，不能只說「使用核心功能」）'
    + ' + 為何席次深度比 DAU 更能反映企業客戶的真實 ROI 感受',

  'saas.frequency':
    '工作日 vs 週觀測週期的選擇理由（SaaS 工具的自然節奏是工作日，非週末）'
    + ' + 頻率閾值（例如「每工作日至少 1 次登入並完成核心動作的席次比例 ≥ X%」）'
    + ' + DAU/MAU 比 benchmark（SaaS 工具 DAU/MAU ≥ 25% 算強黏著，可引用 Amplitude / Mixpanel 公開研究）'
    + ' + 排除 1 個干擾黏著度的情況（如季度末批量使用 / 管理員定期報告生成）',

  'saas.impact':
    'NRR 或擴張信號定義（例如「90 天內發生 upsell / seat 擴張的帳號比例」）'
    + ' + 量化目標（NRR > 100% = 健康；NRR < 90% = 流失警報，可引用業界基準）'
    + ' + 因果鏈（depth / frequency 提升 → 用戶感受到 ROI → upsell 意願提高 → NRR 上升）'
    + ' + 時間滯後（NRR 指標通常比 NSM 滯後 30-90 天，說明監測頻率設為月度或季度）',

  // ── Transaction 型（電商 / 共享平台 / O2O）──────────────────────────────────
  'transaction.reach':
    '供給端或需求端的覆蓋率定義（分子：完成 ≥ 1 筆成交的供給方 / 需求方數 / 分母：平台上全部啟用的供給 / 需求方）'
    + ' + segment scope（指定哪個地區 / 品類 / 用戶群）'
    + ' + 排除 1 個虛榮供給指標（如「已上架但無成交的商品數 / 司機數」）'
    + ' + 為何此 reach 能反映供需雙邊健康而非單邊覆蓋',

  'transaction.depth':
    '單筆訂單深度信號（GMV / 訂單複雜度 / 服務完成率），量化門檻'
    + ' + 為何此信號代表「高質量成交」而非低客單偶發訂單'
    + ' + 閾值選定理由（業界基準 / cohort 分析 / 用戶研究支撐）'
    + ' + 排除 1 個看起來像深度但實際虛高的情況（如促銷期間刷量 / coupon 驅動的低品質成交）',

  'transaction.frequency':
    '復購週期選擇（外賣是週，電商是月，O2O 服務視品類）+ 理由'
    + ' + 頻率閾值（幾次 / 多久才算「養成購買習慣」——引用 cohort 留存曲線說明拐點）'
    + ' + 排除 1 個干擾頻率的情況（如雙 11 / 節慶促銷期爆量后的均值回歸）'
    + ' + 量化目標（如「30 天內復購率 ≥ X%」或「季度活躍買家中 ≥ Y% 有 2 次以上成交」）',

  'transaction.impact':
    '具體商業指標（GMV / 平台佣金收入 / 買賣雙方留存率 / 平均客單價），禁止只說「商業健康」'
    + ' + 因果鏈（NSM 提升後哪個雙邊行為改變驅動了商業指標）'
    + ' + 量化估算（NSM +10% → GMV / 留存 +Y pp，可引用同類平台數據）'
    + ' + 邊界條件（說明何時 NSM 可能虛高但商業未改善，例如補貼期間成交量失真）',

  // ── Creator 型（UGC / 知識 / 內容平台）──────────────────────────────────────
  'creator.reach':
    '活躍創作者定義（分子：過去 30 天內發布 ≥ 1 件作品的創作者數 / 分母：全體已開通帳號創作者數）'
    + ' + segment scope（區分新創作者 vs 回流創作者 / 不同內容品類）'
    + ' + 排除 1 個虛榮數量（如「已開帳號但 0 發布量的創作者」「僅轉發他人內容」）'
    + ' + 為何活躍創作者覆蓋率能反映平台生態健康而非單純 DAU',

  'creator.depth':
    '作品品質信號（每件作品平均互動量 / 完播率 / 讚藏分享比），量化門檻'
    + ' + 閾值選定理由（為何是這個數字——A/B 測試 / 演算法推薦閾值 / 平台基準）'
    + ' + 為何此信號代表「高質量內容」而非演算法驅動的偶發爆量'
    + ' + 排除 1 個假深度信號（如因標題黨引發的高點擊但低完播 / 刷量行為）',

  'creator.frequency':
    '創作者發布頻率（週 / 月）觀測窗口選擇 + 理由（對應平台的內容更新節奏）'
    + ' + 頻率閾值（幾次 / 月才算「活躍創作者」——引用平台歷史 cohort 說明此數字與留存的相關性）'
    + ' + 排除 1 個干擾頻率的情況（如熱門話題爆發驅動的一次性大量發布後沉寂）'
    + ' + 量化目標（例如「月均發布 ≥ 4 次的創作者佔全體創作者 ≥ X%」）',

  'creator.impact':
    '具體商業指標（廣告收入 / 創作者收益 / 平台 GMV / 付費讀者訂閱數），禁止只說「商業轉化」'
    + ' + 因果鏈（創作者活躍 → 內容豐富度 ↑ → 消費端用戶留存 ↑ → 廣告 / 訂閱收入 ↑）'
    + ' + 量化估算（創作者活躍率 +10% → 廣告收益 / 付費訂閱 +Y pp）'
    + ' + 邊界條件（說明 NSM 在哪種情況下可能無法代理商業健康，如 top 1% 創作者佔收益 80% 的長尾失衡問題）',

  // ── Fallback（未知 type，或新 type）─────────────────────────────────────────
  reach:
    'numerator/denominator 清楚定義 + segment scope（指定 user segment）'
    + ' + 排除 1 個虛榮觸及指標（說明為何此指標不算真實觸及）'
    + ' + 為何此 reach 能反映真實 activation / 真正接觸到核心價值',

  depth:
    '具體深度信號 + 量化門檻（可 query 的閾值）'
    + ' + 閾值選定理由（cohort / 業界基準 / 用戶研究）'
    + ' + 排除 1 個假深度信號（區分真投入 vs 偶發 / 自動行為）',

  frequency:
    '觀測週期（日 / 週 / 月）+ 選擇理由（對應產品的自然使用節奏）'
    + ' + 頻率閾值 + 行為心理學或 cohort 支撐'
    + ' + 排除 1 個干擾頻率判斷的情況（促銷 / 節假日 / 推播爆量）',

  impact:
    '具體商業 / 留存指標（NDR / 留存率 / GMV / 付費轉化），禁止泛稱「滿意度」'
    + ' + 因果鏈（NSM ↑ → 哪個用戶行為 → 商業指標 ↑）'
    + ' + 量化估算 + 邊界條件（NSM 在哪種情況下無法代理商業健康）',
};

async function generateNSMStep3Example({ questionJson, dimId, dimType }) {
  const key = dimType ? `${dimType}.${dimId}` : dimId;
  const shape = FIELD_SHAPES[key] || FIELD_SHAPES[dimId] || FIELD_SHAPES.reach;
  const { company, scenario, industry } = questionJson || {};

  const systemPrompt = `你是 PM 面試教練，為學員提供一個維度的「填寫範例」——示範一個合格答案大概長什麼樣子。

格式硬規定（嚴格遵守）：
• 總長 50-90 字（含標點）。超過會破版。
• 1-2 句話，直接寫範例答案內容
• 不要加「例：」「範例：」「我會...」「以下是...」這類前綴——直接從答案本身開始
• 不要 markdown、不要列點符號、不要編號、不要 emoji
• 整段繁體中文

內容要求：
• 必須具體針對「${company || '此公司'}」與這道題的情境（不是泛泛通用範例）
• 不是給出唯一正解，而是示範「合格答案大概長什麼樣」
• 此維度（${dimId} / ${dimType || 'attention'} 型）的好答案應符合：${shape}

評量標準（生成前自問）：
• 看完這個範例，學員能不能立刻知道「好答案長什麼樣」？
• 有沒有具體數字 / 行為 / 排除對象？
• 有沒有「為什麼」的推理鏈，而不只是列出指標？`;

  const userMsg = `公司：${company || ''}
產業：${industry || ''}
情境：${scenario || ''}
維度：${dimId}（${dimType || 'attention'} 型）

請生成此維度的填寫範例（50-90 字，直接寫答案，不加前綴）：`;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const resp = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMsg },
        ],
        temperature: 0.5,
        max_tokens: 200,
      });
      let text = resp.choices[0].message.content.trim();
      // Strip filler prefixes if model ignores instructions
      text = text.replace(/^(例[：:]|範例[：:]|以下是[^\n]*|這是[^\n]*|我會[^\n]*)[^\n]*[\n：]?/, '');
      text = text.replace(/^[\-•·*]\s+/gm, '').replace(/^\d+[.、)]\s+/gm, '');
      text = text.replace(/\n{2,}/g, '\n').trim();
      // Hard cap at 130 chars (UI sized for ~90)
      if (text.length > 130) text = text.slice(0, 128) + '…';
      return text;
    } catch (e) {
      if (attempt === 2) throw new Error('範例生成暫時失敗，請重試');
      await new Promise(r => setTimeout(r, 800 * (attempt + 1)));
    }
  }
}

module.exports = { generateNSMStep3Example };
