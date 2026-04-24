// ── 常數 ─────────────────────────────────────────
var _adjustNsmKeyboardFn = null; // module-level to prevent listener leak
var _nsmScrollFn = null;         // module-level NSM scroll listener ref
var _nsmScrollParent = null;     // module-level NSM scroll parent ref (for cleanup)

const SUPABASE_URL = 'https://klvlizxmvzfpvfgswmfk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtsdmxpenhtdnpmcHZmZ3N3bWZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2NjcyNDIsImV4cCI6MjA5MjI0MzI0Mn0.KOF72gPKbllpYq7t3ny21HBEScUlj2diSl47oNyhJTY';

// ── AppState ──────────────────────────────────────
const AppState = {
  mode: 'loading',
  accessToken: null,
  guestId: null,
  user: null,
  currentSession: null,
  isStreaming: false,
  theme: localStorage.getItem('theme') || 'light',
  view: 'home',
  essenceDraft: '',
  activeReportTab: 'overview',
  homeTab: 'pm',
  recentSessions: [],
  nsmStep: 1,
  nsmSession: null,
  nsmSelectedQuestion: null,
  nsmNsmDraft: '',
  nsmBreakdownDraft: {},
  nsmVanityWarning: null,
  nsmReportTab: 'overview',
  nsmOpenNode: null,
  // CIRCLES
  circlesMode: 'drill',            // 'drill' | 'simulation'
  circlesSelectedType: 'design',   // 'design' | 'improve' | 'strategy'
  circlesDrillStep: 'C1',          // which step to drill
  circlesSelectedQuestion: null,   // { id, company, ... }
  circlesSession: null,            // { id, mode, drill_step, framework_draft, gate_result, conversation, ... }
  circlesPhase: 1,                 // 1 | 1.5 | 2 | 3 (score) | 4 (report)
  circlesFrameworkDraft: {},       // { fieldName: value }
  circlesGateResult: null,         // { items, canProceed, overallStatus }
  circlesConversation: [],         // [{ userMessage, interviewee, coaching, hint }]
  circlesGateLoading: false,
  circlesScoreResult: null,        // current step score from evaluator
  circlesCoachOpen: false,
  circlesSimStep: 0,               // for simulation: which of 7 steps is active (0-6)
  nsmContext: null,
  nsmContextLoading: false,
  nsmContextQuestionId: null,
  nsmHints: null,
  nsmHintsLoading: false,
};

// ── NSM 題庫（100 題 database + 3 計畫獨有）────────
const NSM_QUESTIONS = [
  { id:'q1',  company:'Netflix',   industry:'內容訂閱制',   scenario:'影音串流平台競爭激烈，必須確保用戶持續感受到內容價值以維持自動扣款。',  coach_nsm:'訂閱用戶每月活躍觀看時長', anti_patterns:['App下載數','註冊數'] },
  { id:'q2',  company:'蝦皮購物',   industry:'雙邊電商平台', scenario:'已過補貼獲客期，現需提升買賣雙方黏著度，確保平台真實交易流通。',  coach_nsm:'每月成功完成無退貨訂單數', anti_patterns:['DAU','總流量','商品上架數'] },
  { id:'q3',  company:'Slack',     industry:'B2B SaaS',    scenario:'企業付費是為了效率，若只註冊未發言將導致高退訂率。', coach_nsm:'每週發送訊息的活躍工作區數', anti_patterns:['建立頻道數','註冊企業數'] },
  { id:'q4',  company:'Uber',      industry:'O2O 共享出行', scenario:'必須同時平衡乘客叫車效率與司機賺錢效率。', coach_nsm:'每週成功完成無客訴行程趟數', anti_patterns:['司機上線時間','App打開次數'] },
  { id:'q5',  company:'Tinder',    industry:'交友軟體',     scenario:'核心是建立真實連結，如果用戶一直滑卻沒有互動，很快就會流失。', coach_nsm:'每日雙向配對後成功啟動對話數', anti_patterns:['右滑次數','在線時長'] },
  { id:'q6',  company:'ChatGPT',   industry:'AI 工具',     scenario:'運算成本極高，必須確保用戶是真的在解決問題，而非隨便玩玩。', coach_nsm:'每週完成多輪對話解決問題的活躍用戶數', anti_patterns:['單次提問數','網站造訪量'] },
  { id:'q7',  company:'Strava',    industry:'運動社交',     scenario:'用戶需要社群認同。只記錄不互動，無法撐起平台護城河。', coach_nsm:'每月上傳運動紀錄且有社群互動的用戶數', anti_patterns:['App開啟次數','GPS定位次數'] },
  { id:'q8',  company:'GitHub',    industry:'開發者工具',   scenario:'平台真正的價值在於協助團隊交付程式碼與開源協作。', coach_nsm:'每月合併 PR 的活躍協作者數', anti_patterns:['建立 Repo 數','Star 數量'] },
  { id:'q9',  company:'Duolingo',  industry:'教育科技',     scenario:'語言學習最難的是堅持。需衡量用戶是否將學習變成每日習慣。', coach_nsm:'每週完成 3 堂以上課程的活躍學習者數', anti_patterns:['測驗分數','學習總時數'] },
  { id:'q10', company:'Gogoro',    industry:'硬體與能源',   scenario:'車主付電池月租費，平台必須確保能源交換體驗順暢。', coach_nsm:'每月活躍換電用戶數 × 平均換電次數', anti_patterns:['電池預約次數','App首頁瀏覽量'] },
  { id:'q11', company:'Binance',   industry:'加密貨幣交易所', scenario:'交易所靠手續費盈利，必須確保用戶資金有實際交易流動。', coach_nsm:'每月完成現貨或合約交易的活躍交易者數', anti_patterns:['錢包餘額','登入次數','KYC通過數'] },
  { id:'q12', company:'Notion',    industry:'企業知識庫',   scenario:'團隊共同編寫的知識庫轉移成本高，個人筆記則容易被取代。', coach_nsm:'每週有協作行為的工作區數', anti_patterns:['創建 Page 數','個人登入次數'] },
  { id:'q13', company:'foodpanda', industry:'O2O 外賣平台', scenario:'外賣平台同時服務消費者、餐廳與外送員，三方體驗必須同步優化，才能讓訂單真正送達並帶來回購。', coach_nsm:'每月成功準時送達並有回購的訂單數', anti_patterns:['App下載量','餐廳入駐數','外送員註冊數'] },
  { id:'q14', company:'Airbnb',    industry:'OTA 短租平台', scenario:'平台價值在於撮合旅客完成真實住宿體驗，空有瀏覽不成交將導致房東流失。', coach_nsm:'每月成功完成入住的訂單數（無取消）', anti_patterns:['搜尋次數','頁面瀏覽量','願望清單收藏數'] },
  { id:'q15', company:'TikTok',    industry:'短影音平台',   scenario:'演算法驅動的短影音平台需確保創作者與觀看者雙邊生態健康，才能維持廣告收益。', coach_nsm:'每週完整觀看且有分享行為的活躍用戶數', anti_patterns:['影片上傳總數','曝光次數','帳號粉絲數'] },
  { id:'q16', company:'Shopify',   industry:'電商 SaaS',   scenario:'Shopify 以商家成功為核心，若商家開店後沒有真實銷售，最終會停止付費。', coach_nsm:'每月 GMV 持續成長的活躍商家數', anti_patterns:['開店數量','主題安裝次數','App商店瀏覽數'] },
  { id:'q17', company:'Zoom',      industry:'視訊會議 SaaS', scenario:'遠端工作普及後，Zoom 需確保企業用戶真的在平台上進行有效溝通，而非只是安裝備用。', coach_nsm:'每週完成會議的活躍主辦人數', anti_patterns:['下載次數','帳號註冊數','會議室建立數'] },
  { id:'q18', company:'Spotify',   industry:'音樂串流訂閱', scenario:'訂閱制平台靠續費維生，用戶若停止主動聆聽將在下次付款前取消。', coach_nsm:'付費用戶每月完整播放曲目的收聽時長', anti_patterns:['歌曲收藏數','免費帳號數','搜尋次數'] },
  { id:'q19', company:'Coursera',  industry:'線上教育平台', scenario:'許多用戶衝動報名後就消失，平台需確保學員真正完成課程才能支撐企業與大學合作模式。', coach_nsm:'每月完成課程並取得證書的學習者數', anti_patterns:['課程報名數','影片播放次數','用戶總數'] },
  { id:'q20', company:'Stripe',    industry:'支付基礎設施', scenario:'Stripe 對開發者免費提供 SDK，靠每筆成功交易抽手續費，必須確保整合者真正完成上線收款。', coach_nsm:'商家 Live 模式首筆收款後的月 GMV 成長率', anti_patterns:['API Key 申請數','Sandbox 測試次數','文件頁瀏覽數'] },
  { id:'q21', company:'Figma',     industry:'設計協作工具', scenario:'Figma 的核心價值在跨職能即時協作，若只有設計師單人使用，轉移成本低容易被取代。', coach_nsm:'每月有 2 人以上協作的活躍設計檔案數', anti_patterns:['檔案創建數','個人帳號登入次數','元件庫瀏覽量'] },
  { id:'q22', company:'Grab',      industry:'東南亞超級 App', scenario:'Grab 擁有叫車、外賣、支付多個垂直業務，必須確保用戶跨服務使用才能發揮超級 App 的規模效益。', coach_nsm:'每月同時使用 2 種以上服務並完成交易的活躍用戶數', anti_patterns:['App MAU','單一服務下載量','優惠券領取數'] },
  { id:'q23', company:'Canva',     industry:'設計工具 SaaS', scenario:'Canva 定位為人人可用的設計工具，商業價值在於用戶真正產出並分享或下載成品。', coach_nsm:'每月發布或分享設計的活躍用戶數', anti_patterns:['範本瀏覽數','帳號創建數','拖拉元素操作次數'] },
  { id:'q24', company:'LinkedIn',  industry:'職業社群平台', scenario:'LinkedIn 的核心是職業人脈連結與機會媒合，若用戶只是被動瀏覽而不建立關係，廣告與招聘產品都會失效。', coach_nsm:'每月成功媒合後啟動對話的活躍用戶數', anti_patterns:['個人頁瀏覽量','文章按讚數','關注公司頁數'] },
  { id:'q25', company:'Square',    industry:'POS 支付系統', scenario:'Square 鎖定中小型實體商家，平台收益來自每筆刷卡手續費，必須讓商家真正持續收款。', coach_nsm:'商家每月 GMV 成長且持續活躍收款天數', anti_patterns:['讀卡機出貨量','帳號申請數','後台登入次數'] },
  { id:'q26', company:'Booking.com', industry:'線上旅遊 OTA', scenario:'OTA 平台靠成功預訂抽佣，搜尋高轉換低代表演算法或定價出問題，整體健康度以成交衡量。', coach_nsm:'每月成功完成入住並回頭預訂的用戶數', anti_patterns:['搜尋量','比價點擊數','頁面停留時間'] },
  { id:'q27', company:'Calm',      industry:'心理健康訂閱', scenario:'冥想 App 用戶在壓力高峰期付費，但若未形成習慣很快就取消，平台需確保用戶持續練習。', coach_nsm:'每週完成冥想練習的付費訂閱留存用戶數', anti_patterns:['App下載數','通知點擊率','課程收藏數'] },
  { id:'q28', company:'Robinhood', industry:'零佣金股票交易', scenario:'平台靠訂單流量向做市商套利，必須確保用戶真正執行交易而非只是看行情。', coach_nsm:'每月完成真實交易的活躍用戶數', anti_patterns:['帳號開設數','行情頁瀏覽量','自選股關注數'] },
  { id:'q29', company:'WeWork',    industry:'共享辦公空間', scenario:'WeWork 賺的是空間租金差價，入住率與續租率直接決定現金流，必須確保辦公桌被真正使用。', coach_nsm:'辦公桌月入住率 × 月租續簽率', anti_patterns:['會員卡申辦數','參觀預約數','網站瀏覽量'] },
  { id:'q30', company:'Peloton',   industry:'健身硬體+訂閱', scenario:'高價健身器材搭配訂閱課程，若設備閒置超過兩週用戶極可能退訂，使用頻率是核心指標。', coach_nsm:'付費用戶每週騎乘並完成課程的次數', anti_patterns:['器材出貨量','App安裝數','課程瀏覽次數'] },
  { id:'q31', company:'Miro',      industry:'白板協作 SaaS', scenario:'Miro 主打遠端團隊視覺協作，唯有多人即時共同編輯才能體現平台價值，單人使用無法留住企業客戶。', coach_nsm:'每週有 2 人以上參與的活躍協作白板 session 數', anti_patterns:['Board 創建總數','貼紙使用次數','帳號邀請發送數'] },
  { id:'q32', company:'Twilio',    industry:'通訊 API 平台', scenario:'Twilio 按使用量計費，開發者整合後若沒有真實訊息發送就不產生收益，需確保 API 真正被投入生產。', coach_nsm:'月成功訊息發送量與進入 Live 環境的開發者比例', anti_patterns:['試用帳號數','文件頁瀏覽量','Sandbox 訊息測試數'] },
  { id:'q33', company:'Klarna',    industry:'先買後付 BNPL', scenario:'Klarna 靠商家手續費與用戶分期利息獲利，必須確保用戶真正完成分期消費並按時還款。', coach_nsm:'每月成功分期並準時還款的交易數', anti_patterns:['帳號申請數','購物車加入次數','信用額度核准數'] },
  { id:'q34', company:'Wolt',      industry:'北歐外賣平台', scenario:'Wolt 在北歐市場靠高客單價維持，必須確保每筆訂單真正配送完成且用戶滿意，以驅動自然口碑。', coach_nsm:'每月訂單成功送達且有回購的用戶數', anti_patterns:['外送員招募數','App安裝量','餐廳上架數'] },
  { id:'q35', company:'Typeform',  industry:'問卷表單 SaaS', scenario:'Typeform 靠企業付費方案盈利，唯有用戶真正創建並收集到有效回應，才代表平台提供了價值。', coach_nsm:'每月收集有效回應超過 10 份的活躍表單比例', anti_patterns:['表單創建數','帳號登入次數','模板瀏覽量'] },
  { id:'q36', company:'Zendesk',   industry:'客服 SaaS',    scenario:'企業採用 Zendesk 是為了提升客服效率，平台需確保客服人員真正解決工單，而非只是開啟帳號。', coach_nsm:'工單成功結案率 × 首次回應時間達標率', anti_patterns:['帳號建立數','工單創建數','知識庫文章數'] },
  { id:'q37', company:'Datadog',   industry:'DevOps 監控 SaaS', scenario:'Datadog 按主機數與 Log 量計費，企業只有在真正部署監控並接收到有效警報時，才能感受到平台價值。', coach_nsm:'活躍監控主機數與警報成功處理率', anti_patterns:['Agent 安裝次數','API Key 生成數','試用天數消耗量'] },
  { id:'q38', company:'Intercom',  industry:'客戶溝通平台', scenario:'Intercom 結合行銷與客服，企業付費是為了與用戶建立有效對話，若訊息發出後無人回應則轉換率為零。', coach_nsm:'對話轉換為成交的活躍會話數', anti_patterns:['訊息發送總數','Widget 安裝次數','聯絡人匯入數'] },
  { id:'q39', company:'Brex',      industry:'新創企業信用卡', scenario:'Brex 靠刷卡手續費與金融服務獲利，必須確保企業客戶真正使用企業卡進行支出，而非只是申辦備用。', coach_nsm:'月活躍刷卡企業的平均每張卡消費額', anti_patterns:['企業申請卡片數','帳號登入次數','財務報告下載量'] },
  { id:'q40', company:'DocuSign',  industry:'電子簽名 SaaS', scenario:'電子簽名的商業價值在於合約真正完成簽署，若文件發出後超時未簽，代表流程有斷點。', coach_nsm:'每月合約完簽率 × 平均簽署時間縮短比例', anti_patterns:['文件上傳數','帳號啟用數','簽名欄位建立數'] },
  { id:'q41', company:'Airtable',  industry:'低代碼資料庫工具', scenario:'Airtable 定位企業營運核心資料庫，唯有多部門協作使用才能累積高轉移成本並支撐企業付費。', coach_nsm:'多部門共同協作的活躍 Base 數', anti_patterns:['Base 創建數','個人帳號登入次數','模板複製數'] },
  { id:'q42', company:'Monday.com', industry:'專案管理 SaaS', scenario:'專案管理工具需成為團隊日常工作核心，若只有 PM 使用而開發或設計未跟進，付費合理性就會被質疑。', coach_nsm:'跨職能成員每週活躍協作並完成任務的比例', anti_patterns:['工作板創建數','邀請發送數','視圖切換次數'] },
  { id:'q43', company:'HubSpot',   industry:'行銷銷售 CRM',  scenario:'HubSpot 靠企業升級 Hub 方案獲利，必須確保業務真正在平台追蹤客戶，讓 Pipeline 數據真實可信。', coach_nsm:'業務每週推進 Deal 至下一階段的活躍用戶比例', anti_patterns:['聯絡人匯入總數','Email 發送量','帳號登入次數'] },
  { id:'q44', company:'Rippling',  industry:'HR + IT SaaS',  scenario:'Rippling 整合人資、薪資與 IT 管理，企業若只用單一模組則轉移成本低，跨模組整合才是護城河。', coach_nsm:'跨模組同時啟用且月薪資發放成功的企業比例', anti_patterns:['員工帳號創建數','文件上傳數','App 登入次數'] },
  { id:'q45', company:'Loom',      industry:'非同步視訊溝通', scenario:'Loom 解決遠端團隊開太多會議的問題，平台價值在於影片真正被觀看並取代一次同步會議。', coach_nsm:'影片完整觀看率 × 觀看後有互動反應的比例', anti_patterns:['影片錄製總數','帳號創建數','分享連結點擊數'] },
  { id:'q46', company:'PagerDuty', industry:'事件應變 SaaS', scenario:'PagerDuty 在系統故障時扮演關鍵角色，企業付費是為了確保 On-call 工程師能在 SLA 內響應事件。', coach_nsm:'事件在 SLA 內確認並解決的比例', anti_patterns:['警報發送數','帳號邀請數','整合服務連接數'] },
  { id:'q47', company:'Webflow',   industry:'無代碼網站建構', scenario:'Webflow 讓非工程師也能建站，商業價值在於網站真正上線並帶來流量，而非停留在草稿。', coach_nsm:'發布網站並有真實訪客的活躍用戶比例', anti_patterns:['專案創建數','元件拖拉操作次數','範本瀏覽量'] },
  { id:'q48', company:'Mixpanel',  industry:'產品分析 SaaS',  scenario:'Mixpanel 幫助 PM 和工程師做數據決策，若報表建好卻無人查看，平台就不會被視為核心工具。', coach_nsm:'每週主動查詢報表並分享 Insight 的活躍用戶數', anti_patterns:['事件追蹤數','SDK 安裝次數','帳號邀請數'] },
  { id:'q49', company:'Plaid',     industry:'金融資料 API',   scenario:'Plaid 靠金融機構 API 連結次數計費，唯有用戶真正授權並連結銀行帳戶才產生收益。', coach_nsm:'成功連結銀行帳戶後 7 天內實際數據調用率', anti_patterns:['SDK 下載數','連結嘗試次數','Demo 環境測試數'] },
  { id:'q50', company:'Amplitude', industry:'用戶行為分析',   scenario:'Amplitude 競爭激烈，企業數據分析工具若無法讓團隊養成數據驅動習慣，很快會被替代。', coach_nsm:'每週主動查詢漏斗與留存的企業授權活躍席位比例', anti_patterns:['事件總數','Dashboard 數量','帳號邀請數'] },
  { id:'q51', company:'Rappi',     industry:'拉美超級外賣 App', scenario:'Rappi 在拉丁美洲競爭激烈，補貼燒錢期已過，需確保用戶養成真實點餐習慣並維持每月回購。', coach_nsm:'每月無補貼自然回購的活躍下單用戶數', anti_patterns:['App安裝量','優惠券使用次數','餐廳合作數'] },
  { id:'q52', company:'Garmin',    industry:'穿戴裝置+健康平台', scenario:'Garmin 靠硬體賣出後，平台要以 Connect 生態系建立用戶黏著，確保裝置真正被日常佩戴與追蹤。', coach_nsm:'每日步數同步的活躍用戶數 × 健康挑戰完成比例', anti_patterns:['裝置出貨量','App下載數','帳號創建數'] },
  { id:'q53', company:'Revolut',   industry:'數位銀行',       scenario:'Revolut 從免費帳戶升級到 Premium/Metal 靠功能差異化，需確保用戶真正將 Revolut 作為主要帳戶使用。', coach_nsm:'月薪資入帳用戶的海外消費刷卡筆數', anti_patterns:['帳號開立數','KYC 通過數','App打開次數'] },
  { id:'q54', company:'Brainly',   industry:'學生問答社群',   scenario:'Brainly 靠 P2P 問答讓學生得到學習幫助，需確保提問者真正得到解答且回答者持續貢獻知識。', coach_nsm:'問題獲得滿意答案率 × 回答者月活躍比例', anti_patterns:['問題發文數','用戶註冊數','頁面瀏覽量'] },
  { id:'q55', company:'ClassPass', industry:'健身訂閱平台',   scenario:'ClassPass 讓用戶以單一訂閱跨館上課，若信用點數未消耗完就表示用戶感受不到價值，續約率會下滑。', coach_nsm:'每月信用點數使用率 × 預約並完成課程數', anti_patterns:['用戶訂閱數','課程瀏覽次數','健身房合作數'] },
  { id:'q56', company:'Faire',     industry:'B2B 批發電商',   scenario:'Faire 連結獨立品牌與零售商，平台靠成功批發交易抽傭，零售商下單但不轉賣等於白費。', coach_nsm:'零售商首筆訂單後 60 天內復購率', anti_patterns:['品牌申請數','產品瀏覽次數','零售商帳號數'] },
  { id:'q57', company:'Clearbit',  industry:'B2B 數據情報',   scenario:'Clearbit 提供企業 Enrichment API，若 API 整合後沒有真正呼叫即代表未融入工作流程，付費難以維持。', coach_nsm:'月 API 呼叫量 × CRM 整合後活躍使用企業數', anti_patterns:['API Key 申請數','試用帳號數','文件頁瀏覽量'] },
  { id:'q58', company:'Notion Calendar', industry:'行事曆 SaaS', scenario:'Notion Calendar 要整合工作文件與時間管理，唯有用戶真正在 Calendar 中調度並連結 Notion 文件，才能建立轉移障礙。', coach_nsm:'每週主動建立且連結 Notion Page 的事件數', anti_patterns:['帳號綁定 Google 數','App安裝數','事件創建總數'] },
  { id:'q59', company:'ElevenLabs', industry:'AI 語音合成',   scenario:'ElevenLabs 按字元或使用量計費，若用戶只試玩未整合到產品中，短期試用後會離開。', coach_nsm:'API 整合並進入生產環境的月生成語音字元數', anti_patterns:['試用生成次數','帳號創建數','音色收藏數'] },
  { id:'q60', company:'Midjourney', industry:'AI 圖像生成',   scenario:'Midjourney 基本靠訂閱制，用戶若每月未消耗足夠 GPU 時數，感受不到差異化就不會續費。', coach_nsm:'月 GPU 時數消耗率 × 圖像下載或分享比例', anti_patterns:['Discord 伺服器加入數','Prompt 輸入次數','帳號創建數'] },
  { id:'q61', company:'Vercel',    industry:'前端部署平台',   scenario:'Vercel 靠成功部署的前端流量計費，唯有開發者真正將專案部署並獲得真實訪客，才代表平台提供了生產價值。', coach_nsm:'生產環境月活躍部署專案數 × 真實訪客量', anti_patterns:['GitHub 連結數','Preview Deploy 次數','帳號創建數'] },
  { id:'q62', company:'Segment',   industry:'CDP 客戶數據平台', scenario:'Segment 整合各類數據源，若數據孤島未打通，企業無法實現跨管道個人化，付費合理性就受質疑。', coach_nsm:'成功整合並啟用的 Source 數 × 跨目的地數據流量成長率', anti_patterns:['Source 連接申請數','事件追蹤定義數','帳號登入次數'] },
  { id:'q63', company:'Substack',  industry:'電子報訂閱平台', scenario:'Substack 創作者的商業模式靠付費讀者，平台需確保讀者真正開信閱讀並持續訂閱，而非只是加入後沉默。', coach_nsm:'付費訂閱者數 × 電子報開信率', anti_patterns:['免費訂閱者總數','電子報發布數','創作者帳號數'] },
  { id:'q64', company:'Carta',     industry:'股權管理 SaaS',  scenario:'Carta 管理新創股權帽表，企業付費是為了確保股權分配合規，唯有資本輪完成並更新帽表才體現核心價值。', coach_nsm:'完成融資輪後帽表更新率 × 電子簽署股權文件比例', anti_patterns:['帽表創建數','帳號邀請數','股權計劃模板瀏覽量'] },
  { id:'q65', company:'Honey',     industry:'瀏覽器購物外掛', scenario:'Honey 靠聯盟行銷抽傭，需確保外掛在結帳頁面真正觸發並幫用戶省錢，才能讓商家持續付費接入。', coach_nsm:'結帳頁觸發並成功省錢的月活躍用戶交易比例', anti_patterns:['外掛安裝數','商店加入清單數','通知點擊率'] },
  { id:'q66', company:'AngelList', industry:'新創融資平台',   scenario:'AngelList 媒合天使投資人與新創，唯有雙邊真正完成投資交易，平台抽傭模式才能持續。', coach_nsm:'每月成功完成投資交易且有 Lead Investor 的融資輪數', anti_patterns:['新創申請數','投資人帳號數','Profile 瀏覽量'] },
  { id:'q67', company:'Whatnot',   industry:'直播購物平台',   scenario:'Whatnot 結合直播與收藏品拍賣，唯有觀眾真正出價並完成購買，GMV 才能支撐賣家持續直播。', coach_nsm:'直播中成功出價成交比例 × 買家月回購率', anti_patterns:['直播觀看人次','帳號關注數','商品清單數'] },
  { id:'q68', company:'Toast',     industry:'餐廳 POS SaaS',  scenario:'Toast 專攻餐廳，靠每筆刷卡手續費與月費獲利，餐廳停業或切換 POS 是最大風險。', coach_nsm:'每日活躍收款天數 × 月 GMV 成長率', anti_patterns:['硬體出貨量','後台登入次數','菜單上架數'] },
  { id:'q69', company:'Gong',      industry:'Revenue Intelligence SaaS', scenario:'Gong 錄製業務通話並分析，企業付費期待直接提升成交率，若業務不上傳通話或不看 Coaching，工具淪為擺設。', coach_nsm:'業務通話錄製率 × Manager 每週 Coaching 行為率', anti_patterns:['通話錄製總數','帳號授權數','平台登入次數'] },
  { id:'q70', company:'Fiverr',    industry:'自由工作者平台', scenario:'Fiverr 撮合買賣雙方，靠成功交易抽傭，若買家瀏覽後不下單或賣家接單後遲遲未交付，平台口碑受損。', coach_nsm:'買家回購率 × 賣家準時交付訂單比例', anti_patterns:['Gig 上架數','賣家帳號數','搜尋量'] },
  { id:'q71', company:'Pollen',    industry:'活動旅遊平台',   scenario:'Pollen 策劃音樂節旅遊套裝，平台需確保旅客真正出行並到達活動現場，才算完成完整體驗交付。', coach_nsm:'成功出發且到場完成活動的旅客比例', anti_patterns:['活動頁瀏覽量','願望清單加入數','社群追蹤數'] },
  { id:'q72', company:'Notion AI', industry:'AI 寫作助理 SaaS', scenario:'Notion AI 以月費附加形式存在，用戶需真正將 AI 功能嵌入日常寫作與整理流程，才會感受到 $10/月 的價值。', coach_nsm:'每週 AI 生成後保留內容的比例 × AI 附加方案留存率', anti_patterns:['AI Block 觸發次數','帳號功能啟用數','試用天數'] },
  { id:'q73', company:'Betterment', industry:'機器人理財平台', scenario:'Betterment 靠 AUM 比例收費，用戶的投資組合必須持續增長且不輕易提領，才能維持平台收益。', coach_nsm:'長期持有 90 天以上的月資金淨流入量', anti_patterns:['帳號開設數','理財目標設定數','App登入次數'] },
  { id:'q74', company:'Superhuman', industry:'高端電子郵件客戶端', scenario:'Superhuman 每月收費 $30，對準高生產力用戶，需確保用戶真正透過快捷鍵與 AI 提升收件箱效率，否則溢價難以維持。', coach_nsm:'達到 Inbox Zero 的天數 × 30 天付費留存率', anti_patterns:['電子郵件回覆數','帳號綁定信箱數','平台登入次數'] },
  { id:'q75', company:'Faire Wholesale', industry:'獨立零售 B2B 平台', scenario:'Faire 提供退貨保障吸引零售商，但平台收益來自轉賣成功，需確保零售商購入的商品真正流通到消費者手中。', coach_nsm:'首次訂單後 60 天內第二筆訂單率 × 未退貨完成交易比例', anti_patterns:['商品收藏數','零售商帳號數','品牌頁瀏覽量'] },
  { id:'q76', company:'Procore',   industry:'工程建設 SaaS',  scenario:'Procore 服務建設工地，靠工程團隊協作管理文件、圖紙與工程進度，若現場人員不用等於工具失效。', coach_nsm:'現場人員每日 App 活躍比例 × 工程缺失單完成閉環率', anti_patterns:['帳號邀請數','文件上傳數','平台登入次數'] },
  { id:'q77', company:'Deel',      industry:'全球薪資 HR 平台', scenario:'Deel 幫企業跨境僱用與發薪，每成功聘用一位員工並每月發薪即產生收益，需確保僱用完成且月薪正常運作。', coach_nsm:'跨國合約月薪資準時發放率 × 無糾紛完成比例', anti_patterns:['企業帳號數','合約草稿數','國家市場開設數'] },
  { id:'q78', company:'Runway ML', industry:'AI 影片生成工具', scenario:'創作者採用 AI 影片工具是為了加速產出，平台需確保用戶真正匯出成品並在社群使用，而非只是試玩特效。', coach_nsm:'影片成功匯出後公開發布的月活躍用戶數', anti_patterns:['試用功能點擊數','帳號創建數','特效預覽次數'] },
  { id:'q79', company:'Razorpay',  industry:'印度支付基礎設施', scenario:'Razorpay 服務印度新創與 SME，靠每筆支付手續費獲利，必須確保商家整合後真正上線收款。', coach_nsm:'商家 Live 模式首筆收款後月 GMV 成長率 × 支付成功率', anti_patterns:['商家申請數','Sandbox 測試次數','API Key 申請數'] },
  { id:'q80', company:'Teachable', industry:'線上課程建站平台', scenario:'Teachable 讓知識創業者開課，平台靠課程銷售分潤，若創作者發布課程卻沒有學員購買，雙方都沒有收益。', coach_nsm:'課程發布後首週銷售數 × 學員完課率', anti_patterns:['課程草稿數','帳號創建數','課程頁瀏覽量'] },
  { id:'q81', company:'Pipe',      industry:'ARR 融資平台',   scenario:'Pipe 讓 SaaS 公司以年費收入提前融資，唯有企業真正完成融資並使用資金，平台才能確認交易健康度。', coach_nsm:'成功融資交易完成後 90 天留存率 × 企業月收入成長再融資率', anti_patterns:['企業申請數','帳號連結會計工具數','資產評估完成數'] },
  { id:'q82', company:'Ironclad',  industry:'合約管理 SaaS',  scenario:'Ironclad 幫法律團隊自動化合約流程，若合約不能在平台完成協商並簽署，工具就沒有取代人工的價值。', coach_nsm:'合約在平台內完全完成比例 × 從草稿到簽署時間縮短率', anti_patterns:['合約模板數','合約上傳數','帳號邀請數'] },
  { id:'q83', company:'Brex Empower', industry:'企業支出管理', scenario:'企業支出管理平台要深入公司財務流程，唯有財務與員工都在平台審批並報帳，才算真正替代舊流程。', coach_nsm:'月費用報告提交率 × 平台覆蓋支出佔總支出比例', anti_patterns:['帳號創建數','政策設定數','App安裝數'] },
  { id:'q84', company:'Gusto',     industry:'美國 SMB 薪資平台', scenario:'Gusto 服務美國小企業，月薪資發放是核心功能，若企業跳過平台用手工或其他工具發薪，留存率急跌。', coach_nsm:'月薪資準時跑完比例 × 福利方案加購率', anti_patterns:['員工帳號數','薪資計算器使用次數','文件下載量'] },
  { id:'q85', company:'Gem',       industry:'招聘 CRM SaaS',  scenario:'Gem 讓招聘人員系統化追蹤候選人管道，若獵頭不在平台更新進度，數據就失去預測效力，付費難以維持。', coach_nsm:'候選人管道每週更新率 × 成功聘用並在 Gem 記錄的比例', anti_patterns:['候選人資料匯入數','帳號登入次數','郵件模板創建數'] },
  { id:'q86', company:'Lattice',   industry:'績效管理 SaaS',  scenario:'Lattice 協助企業做 OKR 與績效評估，若員工與主管不真正完成評估週期，平台只是行政負擔。', coach_nsm:'績效評估週期完成率 × OKR 定期更新比例', anti_patterns:['帳號創建數','目標設定數','文件上傳數'] },
  { id:'q87', company:'Retool',    industry:'低代碼內部工具', scenario:'Retool 讓工程師快速建構內部操作後台，唯有業務人員真正日常使用這些工具，平台才能被視為核心基礎設施。', coach_nsm:'內部工具月活躍使用者數 × 企業方案席位活躍率', anti_patterns:['App創建數','元件拖拉次數','工程師帳號數'] },
  { id:'q88', company:'Pave',      industry:'薪酬基準 SaaS',  scenario:'Pave 提供薪酬市場數據，HR 在調薪季時才會高度使用，需確保平台數據真正被採納進入薪酬決策，而非只是查閱備用。', coach_nsm:'薪酬審核周期中數據匯出後對應提薪決策比例', anti_patterns:['帳號登入次數','職位薪資搜尋數','報告下載量'] },
  { id:'q89', company:'Contentful', industry:'Headless CMS',  scenario:'Contentful 服務企業跨管道內容發布，若內容編輯不在平台維護並發布，工程師整合就沒有意義。', coach_nsm:'編輯人員週活躍比例 × 月跨渠道內容發布次數', anti_patterns:['Content Type 定義數','API Key 申請數','媒體庫上傳數'] },
  { id:'q90', company:'Descript',  industry:'AI 影音剪輯工具', scenario:'Descript 讓 Podcast 與影片創作者以文字剪輯音視頻，唯有成品真正匯出發布才代表工具真正被採用。', coach_nsm:'每月完成剪輯並成功匯出發布的專案數', anti_patterns:['專案創建數','文字紀錄生成次數','帳號創建數'] },
  { id:'q91', company:'DoorDash',  industry:'美國外賣平台',   scenario:'DoorDash 已從補貼期進入盈利優化期，必須確保每筆訂單真正配送完成且消費者體驗好，才能維持高口碑與 DashPass 訂閱。', coach_nsm:'訂單成功送達率 × DashPass 訂閱月留存率', anti_patterns:['外送員數量','餐廳合作家數','App安裝數'] },
  { id:'q92', company:'Benchling', industry:'生命科學研發 SaaS', scenario:'Benchling 管理生技實驗數據，若實驗員不在平台記錄與分析結果，就無法建立數據護城河讓企業續費。', coach_nsm:'實驗記錄週活躍創建率 × 跨部門數據共享次數', anti_patterns:['帳號邀請數','實驗專案創建數','App登入次數'] },
  { id:'q93', company:'Wix',       industry:'雲端建站平台',   scenario:'Wix 免費吸引用戶建站，靠升級付費域名與電商方案獲利，若網站沒有真實訪客用戶就不會感受到升級必要性。', coach_nsm:'發布網站的月訪客數 × 付費方案升級率', anti_patterns:['網站草稿創建數','範本瀏覽量','免費帳號數'] },
  { id:'q94', company:'Postmates', industry:'本地即時配送',   scenario:'Postmates 覆蓋餐廳以外的本地商品配送，平台需確保非餐廳類別的訂單也能真正成功配送，才能多元化 GMV 來源。', coach_nsm:'非餐廳訂單成功配送率 × 新類別用戶月回購率', anti_patterns:['商家上架數','商品瀏覽次數','App安裝數'] },
  { id:'q95', company:'Klaviyo',   industry:'電商行銷自動化', scenario:'Klaviyo 幫電商品牌自動發 Email 與 SMS，平台靠聯絡人數量計費，需確保行銷活動真正帶動銷售轉換。', coach_nsm:'行銷流程觸發後的訂單轉換率 × 月活躍自動化流程數', anti_patterns:['郵件發送總數','聯絡人匯入數','模板瀏覽次數'] },
  { id:'q96', company:'Attentive', industry:'SMS 行銷 SaaS',  scenario:'Attentive 讓品牌透過 SMS 行銷推動購買，靠訊息量計費，唯有簡訊真正帶來點擊與購買，品牌才會加量採購。', coach_nsm:'SMS 點擊後購買轉換率 × 訂閱者留存率', anti_patterns:['訂閱者收集數','簡訊發送量','品牌帳號申請數'] },
  { id:'q97', company:'Pendo',     industry:'產品體驗分析 SaaS', scenario:'Pendo 幫 SaaS 公司追蹤功能使用並引導新用戶，若 In-App Guide 觸發後沒有提升功能採用率，平台價值就難以說服。', coach_nsm:'In-App Guide 完成後功能採用率提升比例', anti_patterns:['Guide 創建數','追蹤事件定義數','帳號邀請數'] },
  { id:'q98', company:'Samsara',   industry:'車隊 IoT 管理 SaaS', scenario:'Samsara 靠 GPS 感測器與 SaaS 費用獲利，車隊需真正安裝並日常使用數據來優化派車與安全，才能續簽年費。', coach_nsm:'裝置每日活躍傳輸率 × 安全警報處理完成比例', anti_patterns:['裝置出貨量','帳號登入次數','地圖頁瀏覽量'] },
  { id:'q99', company:'Brainware（虛構）', industry:'企業合規訓練 SaaS', scenario:'企業必須定期讓員工完成法規合規訓練，若員工只開啟影片卻不真正完成測驗，企業面臨罰款風險。', coach_nsm:'員工測驗通過率 × 合規週期準時完成比例', anti_patterns:['影片播放次數','課程章節開啟數','帳號登入次數'] },
  { id:'q100', company:'Fieldwire', industry:'工地管理 SaaS', scenario:'Fieldwire 讓工地現場人員以手機閱覽圖紙並回報工程問題，若現場只有 PM 用而施工員不用，數位化沒有真正落地。', coach_nsm:'現場人員每日 App 活躍比例 × 工程問題回報後閉環完成率', anti_patterns:['帳號邀請數','圖紙上傳數','後台登入次數'] },
  // 計畫獨有（未在 database）
  { id:'discord', company:'Discord',industry:'遊戲社群', scenario:'Discord 依賴社群黏著帶動 Nitro 訂閱，活躍發言的伺服器才有付費意願。', coach_nsm:'每週有活躍文字或語音發言的獨立伺服器數', anti_patterns:['總伺服器數','語音連線次數','帳號數','訊息總數'] },
  { id:'klook',   company:'Klook',  industry:'旅遊體驗預訂', scenario:'Klook 的口碑和留存依賴旅客真正完成體驗，而非只是瀏覽或加入心願清單。', coach_nsm:'每月成功完成體驗訂單並提交評分的用戶數', anti_patterns:['搜尋次數','心願清單數','頁面瀏覽','app下載'] },
  { id:'waze',    company:'Waze',   industry:'社群導航', scenario:'Waze 的護城河在於社群回報路況數據，沒有活躍回報的用戶等同只是普通地圖軟體。', coach_nsm:'每月主動回報路況且完成導航的活躍用戶數', anti_patterns:['導航啟動次數','app下載','帳號數','總導航里程'] },
];

// CIRCLES Method — 7 steps
var CIRCLES_STEPS = [
  { key: 'C1', label: '澄清情境',   short: 'C', fields: ['問題範圍', '時間範圍', '業務影響', '假設確認'] },
  { key: 'I',  label: '定義用戶',   short: 'I', fields: ['目標用戶分群', '選定焦點對象', '用戶動機假設', '排除對象'] },
  { key: 'R',  label: '發掘需求',   short: 'R', fields: ['功能性需求', '情感性需求', '社交性需求', '核心痛點'] },
  { key: 'C2', label: '優先排序',   short: 'C', fields: ['取捨標準', '最優先項目', '暫緩項目', '排序理由'] },
  { key: 'L',  label: '提出方案',   short: 'L', fields: ['方案一', '方案二', '方案三（可選）', '各方案特性'] },
  { key: 'E',  label: '評估取捨',   short: 'E', fields: ['方案優點', '方案缺點', '風險與依賴', '成功指標'] },
  { key: 'S',  label: '總結推薦',   short: 'S', fields: ['推薦方案', '選擇理由', '北極星指標', '追蹤指標'] },
];

var CIRCLES_STEP_HINTS = {
  C1: ['平台 / 地區 / 功能範圍', '過去 7 天 / 30 天 / 90 天', '直接影響哪個業務指標', '已排除哪些干擾因素'],
  I:  ['功能型用戶 / 習慣型用戶 / 新用戶', '最有代表性且體量最大的群體', '他們想完成什麼「任務」', '不服務哪類用戶及原因'],
  R:  ['需要做到什麼功能', '使用這個產品時的感受期待', '在社群中想達到的目標', '最讓用戶沮喪的一件事'],
  C2: ['以影響力 × 可行性 × 緊迫性排序', '選定最優先的一個需求', '哪些需求先放後期', '說明取捨的核心邏輯'],
  L:  ['漸進式改進方案', '重新設計方案', '生態系整合方案', '各方案的核心差異'],
  E:  ['用戶價值提升點', '實作難度 / 時間成本', '技術或商業依賴', '用什麼指標衡量成功'],
  S:  ['選擇哪個方案並推薦', '因為它在 X 情況下最優', '北極星指標是...', '追蹤：每週 / 每月 X 指標'],
};

// ── NSM 輔助函式 ─────────────────────────────────
function isVanityMetric(input, antiPatterns) {
  if (!input || !antiPatterns) return false;
  const lower = input.toLowerCase();
  return antiPatterns.some(p => lower.includes(p.toLowerCase()));
}

function nsmRoute(path) {
  const base = AppState.accessToken ? '/api/nsm-sessions' : '/api/guest/nsm-sessions';
  return base + (path ? '/' + path : '');
}


function detectProductType(question) {
  const text = ((question.industry || '') + ' ' + (question.scenario || '') + ' ' + (question.company || '')).toLowerCase();
  if (/電商|marketplace|外賣|美食|租車|共享|打車|滴滴|uber|airbnb|預訂|booking|到家|配送|供需|撮合|叫車|跑腿/.test(text)) return 'transaction';
  if (/saas|企業|b2b|crm|erp|協作|辦公|工具|管理系統|自動化|workflow|slack|notion|figma|jira/.test(text)) return 'saas';
  if (/創作|creator|ugc|知識|課程|部落|newsletter|寫作|podcast|內容平台|直播|substack|medium|youtube|twitch|blogger/.test(text)) return 'creator';
  return 'attention';
}

const NSM_TYPE_META = {
  attention:   { label: '注意力型', color: '#8b5cf6', icon: 'ph-play-circle',    desc: '核心價值在於讓用戶在產品上花有意義的時間（社交、媒體、遊戲）' },
  transaction: { label: '交易量型', color: '#10b981', icon: 'ph-shopping-cart',  desc: '核心價值在於撮合供需、促成高品質交易（電商、共享平台、O2O）' },
  creator:     { label: '創造力型', color: '#f59e0b', icon: 'ph-pencil-simple',  desc: '核心價值在於讓用戶產出高品質成果並被廣泛消費（UGC、知識平台）' },
  saas:        { label: 'SaaS 型',  color: '#3b82f6', icon: 'ph-buildings',      desc: '核心價值在於解決企業工作流程問題、讓團隊不可或缺地依賴產品（B2B）' },
};

const NSM_DIMENSION_CONFIGS = {
  attention: [
    { key: 'reach',     label: '觸及廣度', subtitle: '有多少用戶真正觸碰到核心功能（非僅登入）',  color: '#3b82f6', coachQ: 'AHA 時刻是什麼動作？做到這個動作的人有多少？', placeholder: '例：每月至少播放 1 首歌的月活用戶數（不是登入數）' },
    { key: 'depth',     label: '互動深度', subtitle: '每位用戶每次使用的品質與投入程度',          color: '#8b5cf6', coachQ: '用戶停得夠深嗎？時長、完播率、互動次數哪個更能反映價值？', placeholder: '例：每個 session 平均聆聽時長（分鐘）' },
    { key: 'frequency', label: '習慣頻率', subtitle: '用戶是否形成定期回訪的使用習慣',            color: '#10b981', coachQ: '每週/每月回來幾次？DAU/MAU 比越高代表黏性越強', placeholder: '例：每週平均使用天數 ≥ 3 的用戶佔比' },
    { key: 'impact',    label: '留存驅力', subtitle: '什麼讓用戶持續回訪而非逐漸流失',            color: '#f59e0b', coachQ: '社交關係？個人化推薦？收藏習慣？找出最強的留存槓桿', placeholder: '例：擁有 ≥5 首收藏歌曲的用戶 30 日留存率' },
  ],
  transaction: [
    { key: 'reach',     label: '供給廣度', subtitle: '供給端（賣家/司機/商家）的活躍參與度',       color: '#3b82f6', coachQ: '沒有供給，需求無法被滿足——有多少活躍供給方存在？', placeholder: '例：過去 7 天完成過交易的活躍商家數' },
    { key: 'depth',     label: '需求深度', subtitle: '需求端用戶的活躍程度與使用品質',             color: '#8b5cf6', coachQ: '需求方有多活躍？每人每月下幾單？平均客單價？', placeholder: '例：每位活躍買家每月平均交易次數' },
    { key: 'frequency', label: '匹配效率', subtitle: '供需成功撮合的漏斗轉化率',                   color: '#10b981', coachQ: '搜尋→瀏覽→下單的漏斗在哪裡漏最多？轉化率多高？', placeholder: '例：從搜尋到成交的整體轉化率' },
    { key: 'impact',    label: '復購留存', subtitle: '用戶第二次以後繼續回來交易的比例',            color: '#f59e0b', coachQ: '獲取新用戶很貴——他有回來嗎？90 天復購率如何？', placeholder: '例：首單後 90 天內完成第二筆交易的用戶比例' },
  ],
  creator: [
    { key: 'reach',     label: '創造廣度', subtitle: '每月有多少用戶在主動產出內容/成果',          color: '#3b82f6', coachQ: '創造者才是平台核心——每月有多少活躍創作者？', placeholder: '例：每月至少發布 1 篇內容的活躍創作者數' },
    { key: 'depth',     label: '成果品質', subtitle: '創造物的品質、完整度與被消費程度',           color: '#8b5cf6', coachQ: '創造的東西被消費了嗎？閱讀完整度、互動次數？', placeholder: '例：每篇貼文平均獲得有效互動數（留言+收藏+分享）' },
    { key: 'frequency', label: '採用廣度', subtitle: '創造物被消費者發現和深度閱讀的比例',         color: '#10b981', coachQ: '沒人看的創作平台沒有飛輪——有多少內容被廣泛閱讀？', placeholder: '例：被至少 3 人讀完的內容佔全部已發布內容比例' },
    { key: 'impact',    label: '商業轉化', subtitle: '創造行為轉化為實際商業收益的效率',            color: '#f59e0b', coachQ: '創作者留下來的動力——他們能賺到錢或獲得真實影響力嗎？', placeholder: '例：創作者帳號的付費訂閱轉化率' },
  ],
  saas: [
    { key: 'reach',     label: '啟用廣度', subtitle: '新客戶中有多少真正完成啟用（Activation）',  color: '#3b82f6', coachQ: '注意是 activation，不是 signup——誰真正跑完了核心工作流？', placeholder: '例：完成首次核心任務的新帳號比例' },
    { key: 'depth',     label: '席次深度', subtitle: '每個帳號內有多少人在真正使用核心功能',       color: '#8b5cf6', coachQ: '企業付費，但有幾個人實際在用？席次利用率多高？', placeholder: '例：每個帳號每月平均活躍使用者數（席次利用率）' },
    { key: 'frequency', label: '黏著頻率', subtitle: '使用頻率是否顯示產品已嵌入日常工作流',       color: '#10b981', coachQ: '每天都用 vs 偶爾用——是剛需工具嗎？DAU/MAU 比多高？', placeholder: '例：每週使用核心功能 ≥ 3 次的帳號佔比' },
    { key: 'impact',    label: '擴張信號', subtitle: '現有客戶是否在增加使用（NRR 指標）',          color: '#f59e0b', coachQ: 'NRR > 100% 代表客戶在擴張——多少比例帳號在 90 天內擴展？', placeholder: '例：90 天內增加席次或升級方案的帳號比例' },
  ],
};

// ── Supabase ──────────────────────────────────────
let supabase;

async function initSupabase() {
  const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  supabase.auth.onAuthStateChange((event, session) => {
    if (session) {
      AppState.mode = 'auth';
      AppState.accessToken = session.access_token;
      AppState.user = session.user;
      if (event === 'SIGNED_IN') migrateGuestSessions();
    } else {
      AppState.mode = 'guest';
      AppState.accessToken = null;
      AppState.user = null;
    }
    render();
  });
}

// ── API helpers ───────────────────────────────────
function apiHeaders() {
  if (AppState.mode === 'auth') {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${AppState.accessToken}`,
    };
  }
  return {
    'Content-Type': 'application/json',
    'X-Guest-ID': AppState.guestId,
  };
}

function sessionRoute(path = '') {
  return (AppState.mode === 'auth' ? '/api/sessions' : '/api/guest/sessions') + path;
}

async function migrateGuestSessions() {
  const guestId = localStorage.getItem('guestId');
  const lastSessionId = localStorage.getItem('lastSessionId');
  if (!guestId || !lastSessionId) return;

  try {
    const { data: session } = await supabase.auth.getSession();
    await fetch('/api/migrate-guest', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.session.access_token}`,
        'X-Guest-ID': guestId,
      },
      body: JSON.stringify({ guestSessionIds: [lastSessionId] }),
    });
    localStorage.removeItem('guestId');
  } catch (_) {}
}

// ── Theme ─────────────────────────────────────────
function applyTheme(theme) {
  AppState.theme = theme;
  document.documentElement.dataset.theme = theme;
  localStorage.setItem('theme', theme);
}

// ── Render ────────────────────────────────────────
function render() {
  document.body.dataset.view = AppState.view;
  renderNavbar();
  const main = document.getElementById('main');
  switch (AppState.view) {
    case 'home':     main.innerHTML = renderHome(); bindHome(); break;
    case 'login':    main.innerHTML = renderLogin(); bindLogin(); break;
    case 'register': main.innerHTML = renderRegister(); bindRegister(); break;
    case 'practice': main.innerHTML = renderPractice(); bindPractice(); break;
    case 'report':   main.innerHTML = renderReport(); bindReport(); break;
    case 'history':  main.innerHTML = renderHistory(); bindHistory(); break;
    case 'nsm':      main.innerHTML = renderNSM(); bindNSM(); break;
    case 'circles':
      if (!AppState.circlesSelectedQuestion) {
        main.innerHTML = renderCirclesHome(); bindCirclesHome();
      } else if (AppState.circlesPhase === 1) {
        main.innerHTML = renderCirclesPhase1(); bindCirclesPhase1();
      } else if (AppState.circlesPhase === 1.5) {
        main.innerHTML = renderCirclesGate(); bindCirclesGate();
      } else if (AppState.circlesPhase === 2) {
        main.innerHTML = renderCirclesPhase2(); bindCirclesPhase2();
      } else if (AppState.circlesPhase === 3) {
        main.innerHTML = renderCirclesStepScore(); bindCirclesStepScore();
      }
      break;
  }
}

async function navigate(view) {
  closeOffcanvas();
  if (view === 'circles' && !AppState.circlesSession) {
    AppState.circlesPhase = 1;
    AppState.circlesSelectedQuestion = null;
    AppState.circlesFrameworkDraft = {};
    AppState.circlesGateResult = null;
    AppState.circlesConversation = [];
    AppState.circlesScoreResult = null;
    AppState.circlesSimStep = 0;
  }
  AppState.view = view;
  document.body.dataset.view = view;
  if (view === 'home') {
    render();
    await loadRecentSessions();
    if (AppState.view === 'home') render();
  } else {
    render();
  }
}

function renderNavbar() {
  const el = document.getElementById('navbar-actions');
  const themeIcon = AppState.theme === 'dark'
    ? '<i class="ph ph-sun"></i>'
    : '<i class="ph ph-moon"></i>';
  const homeBtn = AppState.view === 'report'
    ? `<button class="btn-icon" title="返回首頁" onclick="navigate('home')"><i class="ph ph-house"></i></button>`
    : '';

  if (AppState.mode === 'auth') {
    el.innerHTML = `
      ${homeBtn}
      <span class="navbar-email" title="${AppState.user?.email || ''}">${AppState.user?.email || ''}</span>
      <button class="btn-icon" id="btn-logout" aria-label="登出" title="登出"><i class="ph ph-sign-out"></i></button>
      <button class="btn-icon" title="切換主題" onclick="applyTheme(AppState.theme==='dark'?'light':'dark')">${themeIcon}</button>
    `;
    document.getElementById('btn-logout')?.addEventListener('click', () => supabase.auth.signOut());
  } else if (AppState.mode === 'guest') {
    el.innerHTML = `
      ${homeBtn}
      <button class="btn btn-ghost" onclick="navigate('login')">登入</button>
      <button class="btn-icon" title="切換主題" onclick="applyTheme(AppState.theme==='dark'?'light':'dark')">${themeIcon}</button>
    `;
  } else {
    el.innerHTML = '';
  }

  const hamburger = document.getElementById('btn-hamburger');
  if (hamburger) hamburger.onclick = openOffcanvas;
}

function openOffcanvas() {
  const offcanvas = document.getElementById('offcanvas');
  const overlay = document.getElementById('offcanvas-overlay');
  // Set will-change before triggering animation
  offcanvas.style.willChange = 'transform';
  overlay.style.willChange = 'opacity';
  offcanvas.classList.add('open');
  overlay.classList.add('open');
  // Reset will-change after transition completes
  offcanvas.addEventListener('transitionend', () => { offcanvas.style.willChange = 'auto'; }, { once: true });
  overlay.addEventListener('transitionend', () => { overlay.style.willChange = 'auto'; }, { once: true });
  document.body.style.overflow = 'hidden';
  loadOffcanvasSessions();
  const closeBtn = document.getElementById('btn-offcanvas-close');
  if (closeBtn) closeBtn.onclick = closeOffcanvas;
  overlay.addEventListener('click', closeOffcanvas, { once: true });
}

function closeOffcanvas() {
  const offcanvas = document.getElementById('offcanvas');
  const overlay = document.getElementById('offcanvas-overlay');
  // Set will-change before triggering animation
  offcanvas.style.willChange = 'transform';
  overlay.style.willChange = 'opacity';
  offcanvas.classList.remove('open');
  overlay.classList.remove('open');
  // Reset will-change after transition completes
  offcanvas.addEventListener('transitionend', () => { offcanvas.style.willChange = 'auto'; }, { once: true });
  overlay.addEventListener('transitionend', () => { overlay.style.willChange = 'auto'; }, { once: true });
  document.body.style.overflow = '';
}

function attachOffcanvasDeleteListeners(listEl) {
  listEl.querySelectorAll('.offcanvas-delete-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const id = btn.dataset.id;
      const item = btn.closest('.offcanvas-item');
      const originalHTML = item.innerHTML;

      item.innerHTML = `
        <span style="font-size:0.85rem">確定刪除嗎？</span>
        <div style="display:flex;gap:6px;margin-top:6px">
          <button class="btn btn-ghost offcanvas-cancel-delete" style="font-size:0.8rem;padding:4px 10px">取消</button>
          <button class="btn-danger offcanvas-confirm-delete" style="font-size:0.8rem">刪除</button>
        </div>
      `;

      item.querySelector('.offcanvas-cancel-delete').addEventListener('click', () => {
        item.innerHTML = originalHTML;
        attachOffcanvasDeleteListeners(item);
      });

      item.querySelector('.offcanvas-confirm-delete').addEventListener('click', async (e) => {
        e.stopPropagation();
        try {
          const res = await fetch(sessionRoute(`/${id}`), { method: 'DELETE', headers: apiHeaders() });
          if (!res.ok) {
            item.innerHTML = originalHTML;
            attachOffcanvasDeleteListeners(item);
            return;
          }
          if (localStorage.getItem('lastSessionId') === id) {
            localStorage.removeItem('lastSessionId');
          }
          if (AppState.currentSession?.id === id) {
            AppState.currentSession = null;
            navigate('home');
          } else {
            item.remove();
          }
        } catch (_) {
          item.innerHTML = originalHTML;
          attachOffcanvasDeleteListeners(item);
        }
      });
    });
  });
}

async function loadOffcanvasSessions() {
  const listEl = document.getElementById('offcanvas-list');
  if (!listEl) return;
  listEl.innerHTML = '<div style="padding:16px;color:var(--text-secondary);font-size:14px">載入中…</div>';
  try {
    const headers = AppState.accessToken
      ? { 'Authorization': `Bearer ${AppState.accessToken}` }
      : { 'X-Guest-ID': AppState.guestId };
    const pmUrl = AppState.accessToken ? '/api/sessions' : '/api/guest/sessions';
    const nsmUrl = AppState.accessToken ? '/api/nsm-sessions' : '/api/guest/nsm-sessions';

    const [pmRes, nsmRes] = await Promise.all([
      fetch(pmUrl, { headers }),
      fetch(nsmUrl, { headers })
    ]);
    const pmSessions = pmRes.ok ? await pmRes.json() : [];
    const nsmSessions = nsmRes.ok ? await nsmRes.json() : [];

    const all = [
      ...pmSessions.map(s => ({ ...s, _type: 'pm' })),
      ...nsmSessions.map(s => ({ ...s, _type: 'nsm' }))
    ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    AppState.recentSessions = all.slice(0, 3).map(s => ({ ...s, type: s._type }));

    if (!all.length) {
      listEl.innerHTML = '<div style="padding:16px;color:var(--text-secondary);font-size:14px">尚無練習記錄</div>';
      return;
    }
    listEl.innerHTML = all.map(s => {
      const isNSM = s._type === 'nsm';
      const label = isNSM ? `NSM · ${s.question_json?.company || ''}` : `${s.difficulty || ''}`;
      const date = new Date(s.created_at).toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      const badge = s.status === 'completed'
        ? (s.scores_json ? Math.round(s.scores_json.totalScore ?? s.scores_json.total ?? 0) + ' 分' : '完成')
        : '進行中';
      const badgeClass = s.status === 'completed' ? (isNSM ? 'badge-nsm' : 'badge-green') : 'badge-blue';
      return `<div class="offcanvas-item" data-id="${s.id}" data-status="${s.status}" data-type="${s._type}" style="position:relative">
        <div style="display:flex;align-items:center;gap:6px;padding-right:28px">
          <span class="badge ${badgeClass}">${badge}</span>
          <span style="font-size:0.8rem;color:var(--text-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(label)}</span>
        </div>
        <div style="font-size:0.75rem;color:var(--text-secondary);margin-top:4px">${date}</div>
        <button class="btn-icon offcanvas-delete-btn" title="刪除" style="position:absolute;top:6px;right:4px;font-size:1rem;padding:2px 6px" data-id="${s.id}" data-type="${s._type}">
          <i class="ph ph-trash"></i>
        </button>
      </div>`;
    }).join('');

    listEl.querySelectorAll('.offcanvas-item').forEach(item => {
      item.addEventListener('click', async () => {
        closeOffcanvas();
        const id = item.dataset.id;
        const status = item.dataset.status;
        const type = item.dataset.type;
        if (type === 'nsm') {
          AppState.nsmSession = { id };
          AppState.nsmStep = 4;
          navigate('nsm');
          return;
        }
        if (AppState.currentSession?.id === id) {
          navigate(status === 'completed' ? 'report' : 'practice');
          return;
        }
        const r = await fetch(sessionRoute(`/${id}`), { headers: apiHeaders() });
        if (!r.ok) return;
        const session = await r.json();
        AppState.currentSession = session;
        navigate(status === 'completed' ? 'report' : 'practice');
      });
    });
    attachOffcanvasDeleteListeners(listEl);
  } catch (_) {
    listEl.innerHTML = '<div style="padding:16px;color:var(--text-secondary)">載入失敗</div>';
  }
}

// ── Init ──────────────────────────────────────────
async function init() {
  applyTheme(AppState.theme);

  if (!localStorage.getItem('guestId')) {
    localStorage.setItem('guestId', crypto.randomUUID());
  }
  AppState.guestId = localStorage.getItem('guestId');
  document.body.dataset.view = AppState.view;

  await initSupabase();

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    AppState.mode = 'guest';

    const lastId = localStorage.getItem('lastSessionId');
    if (lastId) {
      const res = await fetch(sessionRoute(`/${lastId}`), { headers: apiHeaders() });
      if (res.ok) {
        const s = await res.json();
        if (s.status === 'in_progress') {
          if (confirm('繼續上次的練習？')) {
            AppState.currentSession = s;
            AppState.view = 'practice';
          }
        }
      }
    }
    await loadRecentSessions();
    render();
  }
  // auth mode 由 onAuthStateChange 觸發 render()
}

init();

// 暴露至全域，讓 HTML inline onclick 可使用
window.navigate = navigate;
window.applyTheme = applyTheme;
window.AppState = AppState;
window.submitDefinition = submitDefinition;
window.openOffcanvas = openOffcanvas;
window.closeOffcanvas = closeOffcanvas;
window.showHintCard = showHintCard;

// ── View stubs（後續 Task 填入）────────────────────
// CIRCLES stubs — replaced by Tasks 14-18
function renderCirclesHome() { return '<div class="circles-home-title">CIRCLES 載入中…</div>'; }
function bindCirclesHome() {}
function renderCirclesPhase1() { return '<div>Phase 1</div>'; }
function bindCirclesPhase1() {}
function renderCirclesGate() { return '<div>Gate</div>'; }
function bindCirclesGate() {}
function renderCirclesPhase2() { return '<div class="circles-input-bar"><button class="circles-send-btn"></button><input id="circles-msg-input"/></div>'; }
function bindCirclesPhase2() {}
function renderCirclesStepScore() { return '<div>Score</div>'; }
function bindCirclesStepScore() {}

// ── Home View ────────────────────────────────────
function renderHome() {
  const activeTab = AppState.homeTab || 'pm';
  const recentSessions = AppState.recentSessions || [];

  const pmTab = activeTab === 'pm' ? `
    <div class="section-label" style="font-size:11px;font-weight:600;color:var(--text-secondary);letter-spacing:0.8px;text-transform:uppercase;margin-bottom:10px">選擇難度</div>
    <div class="diff-list">
      <div class="diff-item" data-difficulty="入門">
        <div class="diff-item-icon" style="background:#d1fae5"><i class="ph ph-leaf" style="color:#059669"></i></div>
        <div class="diff-item-info"><h4>入門</h4><p>單一角色，問題明顯</p></div>
        <i class="ph ph-caret-right diff-arrow"></i>
      </div>
      <div class="diff-item" data-difficulty="進階">
        <div class="diff-item-icon" style="background:#ffedd5"><i class="ph ph-flame" style="color:#ea580c"></i></div>
        <div class="diff-item-info"><h4>進階</h4><p>多角色交錯，需多層追問</p></div>
        <i class="ph ph-caret-right diff-arrow"></i>
      </div>
      <div class="diff-item" data-difficulty="困難">
        <div class="diff-item-icon" style="background:#fee2e2"><i class="ph ph-lightning" style="color:#dc2626"></i></div>
        <div class="diff-item-info"><h4>困難</h4><p>表象與本質落差大</p></div>
        <i class="ph ph-caret-right diff-arrow"></i>
      </div>
    </div>
  ` : '';

  const nsmTab = activeTab === 'nsm' ? `
    <div class="nsm-intro-card">
      <p style="font-size:13px;color:var(--accent);line-height:1.6">
        <strong>北極星指標工作坊</strong> — 選一個真實企業情境，定義 NSM、拆解 4 個維度，獲得 AI 教練點評。
      </p>
    </div>
    <div class="nsm-stats-row">
      <div class="nsm-stat"><div class="num">${NSM_QUESTIONS.length}</div><div class="lbl">題庫</div></div>
      <div class="nsm-stat"><div class="num">5</div><div class="lbl">評分維度</div></div>
      <div class="nsm-stat"><div class="num">4</div><div class="lbl">步驟</div></div>
    </div>
    <button class="btn btn-primary" id="btn-nsm-start" style="width:100%;margin-bottom:12px;min-height:44px">
      <i class="ph ph-shuffle"></i> 隨機抽題開始
    </button>
  ` : '';

  const circlesTab = activeTab === 'circles' ? `
    <div class="nsm-intro-card">
      <p style="font-size:13px;color:var(--accent);line-height:1.6">
        <strong>CIRCLES 訓練系統</strong> — 完整 7 步 PM 面試框架練習。Step Drill 針對弱項，Full Simulation 模擬真實面試壓力。
      </p>
    </div>
    <div class="nsm-stats-row">
      <div class="nsm-stat"><div class="num">100</div><div class="lbl">題庫</div></div>
      <div class="nsm-stat"><div class="num">7</div><div class="lbl">步驟</div></div>
      <div class="nsm-stat"><div class="num">2</div><div class="lbl">模式</div></div>
    </div>
    <button class="btn btn-primary" id="btn-circles-start" style="width:100%;margin-bottom:12px;min-height:44px">
      <i class="ph ph-play"></i> 開始練習
    </button>
  ` : '';

  const recentHtml = recentSessions.length > 0 ? `
    <div class="home-recent-label">最近練習</div>
    ${recentSessions.slice(0, 3).map(s => {
      const isNSM = s.type === 'nsm';
      const badgeClass = s.status === 'completed'
        ? (isNSM ? 'badge-nsm' : 'badge-score')
        : 'badge-progress';
      const badgeText = s.status === 'completed'
        ? (s.scores_json ? Math.round(s.scores_json.totalScore ?? s.scores_json.total ?? 0) + ' 分' : '完成')
        : '進行中';
      const title = isNSM
        ? (s.question_json?.company || 'NSM 練習')
        : `${s.difficulty} · ${s.issue_json?.issueText?.slice(0, 18) || ''}…`;
      return `<div class="home-session-item" data-session-id="${s.id}" data-session-type="${isNSM ? 'nsm' : 'pm'}">
        <span class="session-badge ${badgeClass}">${badgeText}</span>
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(title)}</div>
        </div>
        <i class="ph ph-caret-right" style="color:var(--text-tertiary,var(--text-secondary))"></i>
      </div>`;
    }).join('')}
  ` : '';

  return `
    <div style="text-align:center;padding:32px 0 20px">
      <h1 style="font-size:1.6rem;font-weight:800;margin-bottom:6px">PM 思維訓練</h1>
      <p style="color:var(--text-secondary);font-size:14px">訪談拆解 · 北極星指標 · AI 教練點評</p>
    </div>
    <div class="home-tab-toggle">
      <button class="home-tab-btn ${activeTab === 'pm' ? 'active' : ''}" data-tab="pm">
        <i class="ph ph-microphone"></i> PM 訪談
      </button>
      <button class="home-tab-btn ${activeTab === 'nsm' ? 'active' : ''}" data-tab="nsm">
        <i class="ph ph-star"></i> 北極星指標
      </button>
      <button class="home-tab-btn ${activeTab === 'circles' ? 'active' : ''}" data-tab="circles">
        <i class="ph ph-circle-dashed"></i> CIRCLES
      </button>
    </div>
    ${pmTab}
    ${nsmTab}
    ${circlesTab}
    ${recentHtml}
  `;
}

function bindHome() {
  document.querySelectorAll('.home-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      AppState.homeTab = btn.dataset.tab;
      render();
    });
  });

  document.querySelectorAll('.diff-item[data-difficulty]').forEach(card => {
    card.addEventListener('click', async () => {
      const difficulty = card.dataset.difficulty;
      const allCards = document.querySelectorAll('.diff-item[data-difficulty]');

      // Lock all cards immediately — prevents duplicate session creation
      allCards.forEach(c => {
        c.style.pointerEvents = 'none';
        if (c !== card) c.style.opacity = '0.45';
      });

      card.style.position = 'relative';
      card.insertAdjacentHTML('beforeend', '<div class="card-overlay"><i class="ph ph-circle-notch" style="font-size:24px;animation:spin 0.7s linear infinite"></i></div>');

      try {
        const res = await fetch(sessionRoute(), {
          method: 'POST',
          headers: apiHeaders(),
          body: JSON.stringify({ difficulty }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        AppState.currentSession = { id: data.sessionId, issue_json: { issueText: data.issueText, source: data.source }, conversation: [], turn_count: 0, current_phase: 'reframe' };
        localStorage.setItem('lastSessionId', data.sessionId);
        navigate('practice');
      } catch (e) {
        // Restore all cards on failure
        allCards.forEach(c => {
          c.style.pointerEvents = '';
          c.style.opacity = '';
        });
        card.querySelector('.card-overlay')?.remove();
        alert('出題失敗：' + e.message);
      }
    });
  });

  const btnNsmStart = document.getElementById('btn-nsm-start');
  if (btnNsmStart) {
    btnNsmStart.addEventListener('click', () => {
      AppState.nsmStep = 1;
      AppState.nsmSession = null;
      AppState.nsmSelectedQuestion = null;
      AppState.nsmNsmDraft = '';
      AppState.nsmBreakdownDraft = {};
      AppState.nsmVanityWarning = null;
      navigate('nsm');
    });
  }

  document.getElementById('btn-circles-start')?.addEventListener('click', function() {
    AppState.circlesSession = null;
    AppState.circlesSelectedQuestion = null;
    navigate('circles');
  });

  document.querySelectorAll('.home-session-item[data-session-id]').forEach(item => {
    item.addEventListener('click', () => {
      const id = item.dataset.sessionId;
      const type = item.dataset.sessionType;
      if (type === 'nsm') {
        AppState.nsmStep = 4;
        AppState.nsmSession = { id };
        navigate('nsm');
      } else {
        AppState.currentSession = { id };
        navigate('practice');
      }
    });
  });
}

async function loadRecentSessions() {
  try {
    const headers = AppState.accessToken ? { 'Authorization': `Bearer ${AppState.accessToken}` } : { 'X-Guest-ID': AppState.guestId };
    const pmUrl = AppState.accessToken ? '/api/sessions' : '/api/guest/sessions';
    const nsmUrl = AppState.accessToken ? '/api/nsm-sessions' : '/api/guest/nsm-sessions';
    const [pmRes, nsmRes] = await Promise.all([
      fetch(pmUrl, { headers }),
      fetch(nsmUrl, { headers })
    ]);
    const pmSessions = pmRes.ok ? await pmRes.json() : [];
    const nsmSessions = nsmRes.ok ? await nsmRes.json() : [];
    const mixed = [
      ...pmSessions.map(s => ({ ...s, type: 'pm' })),
      ...nsmSessions.map(s => ({ ...s, type: 'nsm' }))
    ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    AppState.recentSessions = mixed;
  } catch { AppState.recentSessions = []; }
}

// ── Task 16: Login / Register View ─────────────────
function renderAuth(isLogin) {
  return `
    <div style="max-width:400px;margin:60px auto">
      <div class="card">
        <div style="display:flex;gap:8px;margin-bottom:24px">
          <button class="btn ${isLogin?'btn-primary':'btn-ghost'}" onclick="navigate('login')">登入</button>
          <button class="btn ${!isLogin?'btn-primary':'btn-ghost'}" onclick="navigate('register')">註冊</button>
        </div>
        <form id="auth-form">
          <div style="margin-bottom:12px">
            <label style="font-size:0.85rem;color:var(--text-secondary)">Email</label>
            <input id="email" type="email" required class="chat-input" style="width:100%;margin-top:4px" />
          </div>
          <div style="margin-bottom:20px">
            <label style="font-size:0.85rem;color:var(--text-secondary)">密碼</label>
            <input id="password" type="password" required class="chat-input" style="width:100%;margin-top:4px" />
          </div>
          <p id="auth-error" style="color:var(--danger);font-size:0.85rem;margin-bottom:12px;display:none"></p>
          <button type="submit" class="btn btn-primary" style="width:100%">${isLogin?'登入':'建立帳號'}</button>
        </form>
        <p style="margin-top:16px;text-align:center">
          <a href="#" style="color:var(--accent)" onclick="navigate('home')">← 返回首頁</a>
        </p>
      </div>
    </div>
  `;
}

function renderLogin() { return renderAuth(true); }
function renderRegister() { return renderAuth(false); }

function bindAuthForm(isLogin) {
  document.getElementById('auth-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const errEl = document.getElementById('auth-error');
    errEl.style.display = 'none';

    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        errEl.textContent = error.message;
        errEl.style.display = 'block';
      }
      // 成功時 onAuthStateChange 觸發 render()
    } else {
      // 後端建立已確認使用者，再自動登入
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        errEl.textContent = data.error || '註冊失敗';
        errEl.style.display = 'block';
        return;
      }
      // 註冊成功，自動登入
      const { error: loginErr } = await supabase.auth.signInWithPassword({ email, password });
      if (loginErr) {
        errEl.textContent = loginErr.message;
        errEl.style.display = 'block';
      }
      // 成功時 onAuthStateChange 觸發 render()
    }
  });
}

function bindLogin() { bindAuthForm(true); }
function bindRegister() { bindAuthForm(false); }

// ── Task 17: Practice View ────────────────────────
const PHASE_STEPS = [
  { key: 'reframe', label: '重構問題' },
  { key: 'drill',   label: '深度追問' },
  { key: 'submit',  label: '提交定義' },
  { key: 'done',    label: '完成'     },
];

function renderSteps(currentPhase) {
  const phases = ['reframe','drill','submit','done'];
  const idx = phases.indexOf(currentPhase);
  return `<div class="steps">
    ${PHASE_STEPS.map((s, i) => `
      <div class="step ${i < idx ? 'done' : i === idx ? 'active' : ''}">
        <div class="step-dot">${i < idx ? '<i class="ph ph-check"></i>' : i + 1}</div>
        <span>${s.label}</span>
      </div>
    `).join('')}
  </div>`;
}

function renderPractice() {
  const s = AppState.currentSession;
  if (!s) return '<p style="padding:16px">沒有進行中的練習</p>';
  if (s.current_phase === 'done') {
    setTimeout(() => navigate('report'), 0);
    return '';
  }

  const turnCount = s.turn_count || 0;
  const showSubmit = turnCount >= 3;

  const emptyState = s.turn_count === 0
    ? `<div class="chat-empty-state">
         <i class="ph ph-chat-teardrop-text"></i>
         <p>向被訪談者提問吧！<br>試著先了解他的角色與情況。</p>
       </div>`
    : '';

  const bubbles = s.conversation.map(t => `
    <div class="bubble bubble-user">${escHtml(t.userMessage)}</div>
    <div class="bubble bubble-ai">${formatCoachReply(t.coachReply)}</div>
  `).join('');

  const issueSummary = escHtml((s.issue_json?.issueText || '').slice(0, 55)) + '…';

  return `
    <div class="issue-banner" id="issue-banner">
      <div class="issue-banner-header" id="issue-banner-header">
        <h4><span class="badge badge-blue" style="margin-right:6px">${escHtml(s.issue_json?.source || '')}</span>抱怨內容</h4>
        <div style="display:flex;align-items:center;gap:8px;min-width:0;overflow:hidden">
          <span class="issue-banner-summary">${issueSummary}</span>
          <i class="ph ph-caret-up issue-banner-caret" id="issue-caret"></i>
        </div>
      </div>
      <div class="issue-banner-body">${escHtml(s.issue_json?.issueText || '')}</div>
    </div>
    <div class="chat-scroll" id="chat-area">${emptyState}${bubbles}</div>
    <div class="practice-bottom-bar">
      <div class="bottom-toolbar">
        <button class="btn-tool" id="btn-hint"><i class="ph ph-lightbulb"></i> 本輪提示</button>
        <button class="btn-tool" id="btn-update-def">
          <i class="ph ph-note-pencil"></i> 更新定義${showSubmit ? ' <i class="ph ph-caret-up" id="def-caret" style="font-size:0.7rem;margin-left:2px"></i>' : ''}
        </button>
      </div>
      <div id="def-hint" class="essence-label" style="display:none;">完成 3 輪對話後即可編輯定義</div>
      ${showSubmit ? `
      <div class="def-panel-wrapper" id="def-panel-wrapper">
        <div class="def-panel">
          <div style="flex:1;display:flex;flex-direction:column;gap:4px">
            <div class="def-panel-header">
              <label class="essence-label" style="font-weight:600">問題本質定義</label>
              <button class="btn-icon" id="btn-close-def" aria-label="關閉定義面板" style="min-width:32px;min-height:32px;padding:4px"><i class="ph ph-x"></i></button>
            </div>
            <textarea id="final-def" class="essence-textarea" rows="2"
              placeholder="用中性問句描述問題本質…&#10;例：如何讓 [角色] 在 [情境] 下更有效率達成 [目標]？"></textarea>
          </div>
          <button class="btn btn-primary" id="btn-submit" style="flex-shrink:0;align-self:flex-end;min-height:44px">提交定義</button>
        </div>
      </div>` : ''}
      <div class="chat-send-row">
        <textarea id="chat-input" class="chat-input" style="flex:1" rows="2"
          placeholder="輸入你的問題或觀察…"
          ${AppState.isStreaming ? 'disabled' : ''}></textarea>
        <button class="btn btn-primary" id="btn-send" ${AppState.isStreaming ? 'disabled' : ''}>送出</button>
      </div>
    </div>
  `;
}

function bindPractice() {
  const finalDefEl = document.getElementById('final-def');
  if (finalDefEl) {
    finalDefEl.value = AppState.essenceDraft;
    finalDefEl.addEventListener('input', e => { AppState.essenceDraft = e.target.value; });
  }

  document.getElementById('btn-send')?.addEventListener('click', sendChat);
  const chatInput = document.getElementById('chat-input');
  chatInput?.addEventListener('input', () => {
    chatInput.style.height = 'auto';
    chatInput.style.height = Math.min(chatInput.scrollHeight, 160) + 'px';
  });
  document.getElementById('btn-submit')?.addEventListener('click', submitDefinition);

  document.getElementById('issue-banner-header')?.addEventListener('click', () => {
    const banner = document.getElementById('issue-banner');
    const caret = document.getElementById('issue-caret');
    const collapsed = banner.classList.toggle('collapsed');
    caret.className = collapsed ? 'ph ph-caret-down issue-banner-caret' : 'ph ph-caret-up issue-banner-caret';
  });

  document.getElementById('btn-hint')?.addEventListener('click', showHintCard);
  document.getElementById('btn-update-def')?.addEventListener('click', () => {
    const wrapper = document.getElementById('def-panel-wrapper');
    if (!wrapper) {
      const hint = document.getElementById('def-hint');
      if (hint) {
        hint.style.display = 'block';
        setTimeout(() => { hint.style.display = 'none'; }, 2500);
      }
      return;
    }
    const isOpen = wrapper.classList.toggle('open');
    const caret = document.getElementById('def-caret');
    const btn = document.getElementById('btn-update-def');
    if (caret) caret.className = isOpen ? 'ph ph-caret-down' : 'ph ph-caret-up';
    if (btn) btn.classList.toggle('active', isOpen);
    if (isOpen) document.getElementById('final-def')?.focus();
  });

  // Close def panel button
  document.getElementById('btn-close-def')?.addEventListener('click', () => {
    const defPanelWrapper = document.getElementById('def-panel-wrapper');
    if (defPanelWrapper) {
      defPanelWrapper.classList.remove('open');
      document.getElementById('btn-update-def')?.classList.remove('active');
    }
  });

  // Set initial chat-area padding for fixed bottom bar
  requestAnimationFrame(() => {
    const bar = document.querySelector('.practice-bottom-bar');
    const chatArea = document.getElementById('chat-area');
    if (bar && chatArea) chatArea.style.paddingBottom = bar.offsetHeight + 'px';
    // will-change active for the duration of practice (keyboard transforms)
    if (bar) bar.style.willChange = 'transform';
  });

  // visualViewport keyboard adjustment — transform only, no layout-triggering bottom changes
  let _practiceKbRaf = null;
  function adjustForKeyboard() {
    if (!window.visualViewport) return;
    if (_practiceKbRaf) return;
    _practiceKbRaf = requestAnimationFrame(() => {
      _practiceKbRaf = null;
      const bar = document.querySelector('.practice-bottom-bar');
      const chatArea = document.getElementById('chat-area');
      if (!bar) return;
      const keyboardHeight = Math.max(0, window.innerHeight - window.visualViewport.offsetTop - window.visualViewport.height);
      bar.style.transform = `translateY(-${keyboardHeight}px)`;
      if (chatArea) chatArea.style.paddingBottom = (bar.offsetHeight + keyboardHeight) + 'px';
      if (keyboardHeight > 100) scrollChatToBottom();
    });
  }
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', adjustForKeyboard);
    window.visualViewport.addEventListener('scroll', adjustForKeyboard);
    adjustForKeyboard();
  }

  scrollChatToBottom();
}

function showHintCard() {
  const conv = AppState.currentSession?.conversation || [];
  const lastHint = conv[conv.length - 1]?.coachReply?.hint;
  const hint = lastHint || '請先進行至少一輪對話，再查看本輪提示。';

  const chatArea = document.getElementById('chat-area');
  if (!chatArea) return;
  chatArea.querySelector('.hint-card')?.remove();

  const card = document.createElement('div');
  card.className = 'hint-card';
  card.innerHTML = `<i class="ph ph-lightbulb" style="margin-top:2px;flex-shrink:0;color:#f0a04b"></i><span>${escHtml(hint)}</span>`;
  chatArea.appendChild(card);
  card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function formatCoachReply(coachReply) {
  if (!coachReply) return '';
  // hint rendered separately via showHintCard (added in Task 6)
  return `<strong>【被訪談者】</strong><br>${escHtml(coachReply.interviewee)}<hr><strong>【教練點評】</strong><br>${escHtml(coachReply.coaching)}`;
}

function escHtml(str) {
  return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');
}

function scrollChatToBottom() {
  const area = document.getElementById('chat-area');
  if (area) area.scrollTop = area.scrollHeight;
}

async function sendChat() {
  const input = document.getElementById('chat-input');
  const message = input?.value?.trim();
  if (!message || AppState.isStreaming) return;
  input.value = '';
  input.style.height = '';

  AppState.isStreaming = true;
  const defEl = document.getElementById('final-def');
  if (defEl && !defEl.disabled) AppState.essenceDraft = defEl.value;
  AppState.currentSession.conversation.push({ userMessage: message, coachReply: null });
  render();

  const coachEl = document.querySelector('#chat-area .bubble-ai:last-child') || (() => {
    const el = document.createElement('div');
    el.className = 'bubble bubble-ai typing';
    document.getElementById('chat-area').appendChild(el);
    return el;
  })();
  coachEl.className = 'bubble bubble-ai typing';

  try {
    const res = await fetch(sessionRoute(`/${AppState.currentSession.id}/chat`), {
      method: 'POST',
      headers: apiHeaders(),
      body: JSON.stringify({ message }),
    });

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullText = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6);
        if (data === '[DONE]') break;
        try {
          const { text } = JSON.parse(data);
          fullText += text;
          coachEl.className = 'bubble bubble-ai';
          coachEl.innerHTML = formatCoachReply(parseCoachReply(fullText));
        } catch (_) {}
      }
    }

    const parsed = parseCoachReply(fullText);
    AppState.currentSession.conversation[AppState.currentSession.conversation.length - 1].coachReply = parsed;
    AppState.currentSession.turn_count++;
    if (AppState.currentSession.current_phase === 'reframe') AppState.currentSession.current_phase = 'drill';

  } catch (e) {
    coachEl.className = 'bubble bubble-ai bubble-error';
    coachEl.innerHTML = '<i class="ph ph-warning-circle"></i> 連線中斷 <button class="btn-retry" onclick="sendChat()">重試</button>';
  }

  AppState.isStreaming = false;
  render();
  scrollChatToBottom();
}

function parseCoachReply(fullText) {
  const intervieweeMatch = fullText.match(/【被訪談者】\s*([\s\S]*?)(?=【教練點評】|$)/);
  const coachingMatch = fullText.match(/【教練點評】\s*([\s\S]*?)(?=【教練提示】|$)/);
  const hintMatch = fullText.match(/【教練提示】\s*([\s\S]*?)$/);
  return {
    interviewee: intervieweeMatch?.[1]?.trim() || fullText,
    coaching: coachingMatch?.[1]?.trim() || '',
    hint: hintMatch?.[1]?.trim() || '',
  };
}

async function submitDefinition() {
  const def = document.getElementById('final-def')?.value?.trim();
  if (!def) return;
  document.getElementById('btn-submit').disabled = true;
  document.getElementById('btn-submit').textContent = '評分中…';
  try {
    const res = await fetch(sessionRoute(`/${AppState.currentSession.id}/submit`), {
      method: 'POST',
      headers: apiHeaders(),
      body: JSON.stringify({ finalDefinition: def }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    AppState.currentSession.scores_json = data.scores;
    AppState.currentSession.coach_demo_json = data.coachDemo || null;
    AppState.currentSession.final_definition = def;
    AppState.currentSession.current_phase = 'done';
    localStorage.removeItem('lastSessionId');
    AppState.activeReportTab = 'overview';
    navigate('report');
  } catch (e) {
    alert('評分失敗：' + e.message);
    document.getElementById('btn-submit').disabled = false;
    document.getElementById('btn-submit').textContent = '提交定義';
  }
}

// ── Task 18: Report View (雷達圖 + 練習回顧表) ────
const DIM_STATIC = {
  roleClarity:        '釐清抱怨者的實際角色、負責範圍與在流程中的位置',
  taskBreakpoint:     '找出具體的行為斷點——他在哪個步驟卡住、無法繼續',
  workaround:         '挖掘用戶現在怎麼繞過這個問題（暗示真正的痛點）',
  lossQuantification: '了解損失的維度與量級（時間、金錢、頻率、影響範圍）',
  definitionQuality:  '最終問句是否中性、不預設解法、聚焦在本質問題',
};

const DIM_LABELS = {
  roleClarity: '角色定位',
  taskBreakpoint: '任務卡點',
  workaround: '替代行為',
  lossQuantification: '損失量化',
  definitionQuality: '定義品質',
};

function renderRadar(scores) {
  const dims = Object.keys(DIM_LABELS);
  const size = 260;
  const cx = size / 2, cy = size / 2, r = 80;
  const n = dims.length;
  const toXY = (i, val) => {
    const angle = (Math.PI * 2 * i / n) - Math.PI / 2;
    const rv = (val / 20) * r;
    return [cx + rv * Math.cos(angle), cy + rv * Math.sin(angle)];
  };
  const labelXY = (i) => {
    const angle = (Math.PI * 2 * i / n) - Math.PI / 2;
    return [cx + (r + 32) * Math.cos(angle), cy + (r + 32) * Math.sin(angle)];
  };

  const circles = [0.25, 0.5, 0.75, 1].map(f =>
    `<circle cx="${cx}" cy="${cy}" r="${r*f}" fill="none" stroke="var(--border)" stroke-width="1"/>`
  ).join('');

  const axes = dims.map((_, i) => {
    const [x, y] = toXY(i, 20);
    return `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="var(--border)" stroke-width="1"/>`;
  }).join('');

  const points = dims.map((d, i) => toXY(i, scores[d]?.score || 0).join(',')).join(' ');
  const polygon = `<polygon points="${points}" fill="var(--accent)" fill-opacity="0.25" stroke="var(--accent)" stroke-width="2"/>`;

  const labels = dims.map((d, i) => {
    const [x, y] = labelXY(i);
    return `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="middle" font-size="10" fill="var(--text-secondary)">${DIM_LABELS[d]}</text>`;
  }).join('');

  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${circles}${axes}${polygon}${labels}</svg>`;
}

const NSM_DIM_LABELS = {
  alignment:     '價值關聯',
  leading:       '領先指標',
  actionability: '操作性',
  simplicity:    '可理解性',
  sensitivity:   '週期敏感',
};

function renderNSMRadar(scores) {
  const dims = Object.keys(NSM_DIM_LABELS);
  const size = 260;
  const cx = size / 2, cy = size / 2, r = 80;
  const n = dims.length;
  const toXY = (i, val) => {
    const angle = (Math.PI * 2 * i / n) - Math.PI / 2;
    const rv = (val / 5) * r;
    return [cx + rv * Math.cos(angle), cy + rv * Math.sin(angle)];
  };
  const labelXY = (i) => {
    const angle = (Math.PI * 2 * i / n) - Math.PI / 2;
    return [cx + (r + 32) * Math.cos(angle), cy + (r + 32) * Math.sin(angle)];
  };
  const circles = [0.25, 0.5, 0.75, 1].map(f =>
    `<circle cx="${cx}" cy="${cy}" r="${r*f}" fill="none" stroke="var(--border)" stroke-width="1"/>`
  ).join('');
  const axes = dims.map((_, i) => {
    const [x, y] = toXY(i, 5);
    return `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="var(--border)" stroke-width="1"/>`;
  }).join('');
  const points = dims.map((d, i) => toXY(i, scores[d] || 0).join(',')).join(' ');
  const polygon = `<polygon points="${points}" fill="var(--accent)" fill-opacity="0.25" stroke="var(--accent)" stroke-width="2"/>`;
  const labels = dims.map((d, i) => {
    const [x, y] = labelXY(i);
    return `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="middle" font-size="10" fill="var(--text-secondary)">${NSM_DIM_LABELS[d]}</text>`;
  }).join('');
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${circles}${axes}${polygon}${labels}</svg>`;
}

function renderReport() {
  const s = AppState.currentSession;
  const scores = s?.scores_json;
  if (!scores) return '<p style="padding:16px">沒有評分資料</p>';
  if (!scores.scores) return '<p style="padding:16px">評分資料不完整</p>';

  const coach = s.coach_demo_json;
  const dims = Object.keys(DIM_LABELS);
  const totalScore = scores.totalScore || 0;
  const turnCount = s.conversation?.length || s.turn_count || 0;
  const source = s.issue_json?.source || '';

  // ── Overview tab ──
  const scoreBars = dims.map(d => {
    const sc = scores.scores[d]?.score || 0;
    return `<div class="score-bar-row">
      <div class="score-bar-label">
        <span>${DIM_LABELS[d]}</span>
        <span style="color:${sc >= 14 ? 'var(--success)' : 'var(--warning)'}">${sc}/20</span>
      </div>
      <div class="score-bar-track"><div class="score-bar-fill" style="transform:scaleX(${sc / 20})"></div></div>
    </div>`;
  }).join('');

  const scoreDetails = dims.map(d => {
    const dim = scores.scores[d] || {};
    const exQ = dim.exampleQuestion ? `
      <div class="score-detail-row" style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border)">
        <i class="ph ph-chat-circle-dots" style="color:var(--accent)"></i>
        <span><strong style="color:var(--accent)">示範問句：</strong>${escHtml(dim.exampleQuestion)}</span>
      </div>` : '';
    return `
    <div class="score-detail-card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
        <span style="font-weight:700;font-size:0.9rem;color:var(--accent)">${DIM_LABELS[d]}</span>
        <span style="font-size:0.75rem;color:var(--text-secondary)">${DIM_STATIC[d]}</span>
      </div>
      <div class="score-detail-row"><i class="ph ph-check-circle" style="color:var(--success)"></i><span>${escHtml(dim.did || '')}</span></div>
      <div class="score-detail-row"><i class="ph ph-x-circle" style="color:var(--danger)"></i><span>${escHtml(dim.missed || '')}</span></div>
      <div class="score-detail-row"><i class="ph ph-lightbulb" style="color:var(--accent)"></i><span>${escHtml(dim.tip || '')}</span></div>
      ${exQ}
    </div>`;
  }).join('');

  // ── Review tab ──
  const studentRounds = (s.conversation || []).map((t, i) => `
    <div class="review-card">
      <div class="review-card-round">第 ${i + 1} 輪</div>
      <div class="review-card-section"><div class="review-card-section-label">學員提問</div>${escHtml(t.userMessage)}</div>
      <div class="review-card-section"><div class="review-card-section-label">被訪談者</div>${escHtml(t.coachReply?.interviewee || '')}</div>
      <div class="review-card-section"><div class="review-card-section-label">教練點評</div>${escHtml(t.coachReply?.coaching || '')}</div>
    </div>`).join('');

  const coachRounds = coach ? coach.conversation.map((c, i) => `
    <div class="coach-round">
      <div class="coach-round-label">第 ${i + 1} 輪</div>
      <div class="coach-question">${escHtml(c.coachQuestion)}</div>
      <div class="coach-reply">${escHtml(c.intervieweeReply)}</div>
    </div>`).join('') : '';

  const reviewContent = `
    <div class="review-two-col">
      <div>
        <div class="review-col-header">學員練習</div>
        ${studentRounds}
      </div>
      <div>
        <div class="review-col-header coach">教練示範</div>
        ${coach ? coachRounds : '<p style="color:var(--text-secondary);font-size:0.875rem">（無示範資料）</p>'}
      </div>
    </div>`;

  // ── Highlights tab ──
  const highlights = scores.highlights || {};

  // ── Essence tab ──
  const essenceTab = `
    <div class="essence-section">
      <div class="essence-section-label">你的定義</div>
      <div class="essence-text">${escHtml(s.final_definition || '（未提交）')}</div>
    </div>
    <div class="essence-section">
      <div class="essence-section-label">優質格式範例</div>
      <div class="essence-format">如何讓 [具體角色] 在 [情境 / 流程節點] 降低 [可量化損失]？</div>
      ${scores.essenceExample ? `<div class="essence-text" style="margin-top:12px">${escHtml(scores.essenceExample)}</div>` : ''}
    </div>
    ${coach ? `
    <div class="essence-section" style="border-left:3px solid var(--accent)">
      <div class="essence-section-label" style="color:var(--accent)">教練的定義</div>
      <div class="essence-text essence-coach-text">${escHtml(coach.coachEssence || '')}</div>
      <div class="essence-reasoning">${escHtml(coach.coachReasoning || '')}</div>
    </div>` : ''}`;

  const tab = AppState.activeReportTab;
  const tabs = [
    { id: 'overview',   label: '評分總覽', short: '總覽' },
    { id: 'review',     label: '練習回顧', short: '回顧' },
    { id: 'highlights', label: '亮點摘要', short: '亮點' },
    { id: 'essence',    label: '問題本質', short: '本質' },
    { id: 'export',     label: '匯出',     short: '匯出' },
  ];

  return `
    <div class="score-summary-bar">
      <div>
        <div class="score-big">${totalScore}</div>
        <div class="score-meta">${escHtml(source)} · ${turnCount} 輪</div>
      </div>
      <div class="score-progress">
        <div class="score-progress-fill" style="width:${Math.min(100, totalScore)}%"></div>
      </div>
    </div>
    <div class="tab-bar">
      ${tabs.map(t => `
        <button class="tab-btn ${tab === t.id ? 'active' : ''}" data-tab="${t.id}">
          <span class="tab-label-full">${t.label}</span>
          <span class="tab-label-short">${t.short}</span>
        </button>`).join('')}
    </div>
    <div class="tab-content" id="report-content">
      <div class="tab-pane ${tab === 'overview' ? 'active' : ''}" id="tab-overview">
        <div class="radar-container">${renderRadar(scores.scores)}</div>
        ${scoreBars}
        ${scoreDetails}
      </div>
      <div class="tab-pane ${tab === 'review' ? 'active' : ''}" id="tab-review">
        ${reviewContent}
      </div>
      <div class="tab-pane ${tab === 'highlights' ? 'active' : ''}" id="tab-highlights">
        <div class="highlight-card">
          <i class="ph ph-trophy highlight-icon trophy"></i>
          <div><div style="font-weight:700;margin-bottom:4px">最佳亮點</div>${escHtml(highlights.bestMove || '')}</div>
        </div>
        <div class="highlight-card">
          <i class="ph ph-warning highlight-icon warning-icon"></i>
          <div><div style="font-weight:700;margin-bottom:4px">主要陷阱</div>${escHtml(highlights.mainTrap || '')}</div>
        </div>
        <div class="highlight-summary">${escHtml(highlights.summary || '')}</div>
      </div>
      <div class="tab-pane ${tab === 'essence' ? 'active' : ''}" id="tab-essence">
        ${essenceTab}
      </div>
      <div class="tab-pane ${tab === 'export' ? 'active' : ''}" id="tab-export">
        <div class="export-tab-actions">
          <button class="btn btn-ghost" id="btn-export-pdf"><i class="ph ph-file-pdf"></i> 匯出 PDF</button>
          <button class="btn btn-ghost" id="btn-export-png"><i class="ph ph-image"></i> 匯出 PNG</button>
          <p class="export-hint">PDF 使用瀏覽器列印；PNG 截取報告畫面</p>
          <button class="btn btn-primary" id="btn-practice-again">再練一次</button>
        </div>
      </div>
    </div>
  `;
}

function bindReport() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      AppState.activeReportTab = btn.dataset.tab;
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`tab-${btn.dataset.tab}`)?.classList.add('active');
    });
  });
  document.getElementById('btn-export-pdf')?.addEventListener('click', exportPDF);
  document.getElementById('btn-export-png')?.addEventListener('click', exportPNG);
  document.getElementById('btn-practice-again')?.addEventListener('click', () => navigate('home'));
}

function exportPDF() {
  window.print();
}

async function exportPNG() {
  const btn = document.getElementById('btn-export-png');
  if (!btn) return;
  btn.disabled = true;
  btn.textContent = '截圖中…';
  try {
    const { default: html2canvas } = await import('https://esm.sh/html2canvas@1.4.1');
    const el = document.getElementById('report-content');
    document.querySelectorAll('.tab-pane').forEach(p => { p.style.display = 'block'; });
    const canvas = await html2canvas(el, { backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--bg-primary').trim() });
    document.querySelectorAll('.tab-pane').forEach(p => { p.style.display = ''; });
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `pm-drill-report-${Date.now()}.png`;
    a.click();
  } catch (e) {
    document.querySelectorAll('.tab-pane').forEach(p => { p.style.display = ''; });
    alert('截圖失敗，改用 PDF 列印');
    window.print();
  }
  btn.disabled = false;
  btn.innerHTML = '<i class="ph ph-image"></i> 匯出 PNG';
}

// ── Task 19: History View (登入用戶) ──────────────
function renderHistory() {
  return `
    <div style="margin-bottom:24px;display:flex;justify-content:space-between;align-items:center">
      <h2 style="font-weight:700">練習歷史</h2>
      <button class="btn btn-ghost" onclick="navigate('home')">← 返回</button>
    </div>
    <div id="history-chart" style="margin-bottom:24px">載入中…</div>
    <div id="history-list" class="history-list">載入中…</div>
  `;
}

function bindHistory() {
  loadHistory();
}

async function loadHistory() {
  if (AppState.mode !== 'auth') return;
  try {
    const res = await fetch('/api/sessions', { headers: apiHeaders() });
    const sessions = await res.json();
    renderHistoryChart(sessions);
    renderHistoryList(sessions);
  } catch (_) {
    document.getElementById('history-list').textContent = '載入失敗';
  }
}

function renderHistoryChart(sessions) {
  const completed = sessions.filter(s => s.status === 'completed' && s.scores_json?.totalScore != null)
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    .slice(-10);

  if (completed.length < 2) {
    document.getElementById('history-chart').innerHTML = '<p style="color:var(--text-secondary)">完成至少 2 次練習後顯示進步曲線</p>';
    return;
  }

  const w = 600, h = 160, padL = 40, padB = 30, padT = 10, padR = 20;
  const scores = completed.map(s => s.scores_json.totalScore);
  const minS = Math.min(...scores) - 5;
  const maxS = Math.max(...scores) + 5;
  const toX = i => padL + (i / (completed.length - 1)) * (w - padL - padR);
  const toY = v => padT + (1 - (v - minS) / (maxS - minS)) * (h - padT - padB);

  const points = completed.map((_, i) => `${toX(i)},${toY(scores[i])}`).join(' ');
  const dots = completed.map((_, i) => `
    <circle cx="${toX(i)}" cy="${toY(scores[i])}" r="4" fill="var(--accent)"/>
    <text x="${toX(i)}" y="${toY(scores[i]) - 8}" text-anchor="middle" font-size="10" fill="var(--text-primary)">${scores[i]}</text>
  `).join('');

  document.getElementById('history-chart').innerHTML = `
    <div class="card">
      <p style="font-weight:700;margin-bottom:12px">總分趨勢</p>
      <svg width="100%" viewBox="0 0 ${w} ${h}">
        <polyline points="${points}" fill="none" stroke="var(--accent)" stroke-width="2"/>
        ${dots}
        <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${h - padB}" stroke="var(--border)" stroke-width="1"/>
        <line x1="${padL}" y1="${h - padB}" x2="${w - padR}" y2="${h - padB}" stroke="var(--border)" stroke-width="1"/>
      </svg>
    </div>
  `;
}

function attachHistoryDeleteListeners(el) {
  el.querySelectorAll('.history-delete-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const id = btn.dataset.id;
      const item = btn.closest('.history-item');
      const originalHTML = item.innerHTML;

      item.innerHTML = `
        <span style="font-size:0.85rem">確定刪除嗎？</span>
        <div style="display:flex;gap:6px;margin-top:6px">
          <button class="btn btn-ghost history-cancel-delete" style="font-size:0.8rem;padding:4px 10px">取消</button>
          <button class="btn-danger history-confirm-delete" style="font-size:0.8rem">刪除</button>
        </div>
      `;

      item.querySelector('.history-cancel-delete').addEventListener('click', () => {
        item.innerHTML = originalHTML;
        attachHistoryDeleteListeners(item);
      });

      item.querySelector('.history-confirm-delete').addEventListener('click', async (e) => {
        e.stopPropagation();
        try {
          const res = await fetch(`/api/sessions/${id}`, { method: 'DELETE', headers: apiHeaders() });
          if (!res.ok) {
            item.innerHTML = originalHTML;
            attachHistoryDeleteListeners(item);
            return;
          }
          if (localStorage.getItem('lastSessionId') === id) {
            localStorage.removeItem('lastSessionId');
          }
          if (AppState.currentSession?.id === id) {
            AppState.currentSession = null;
            navigate('home');
          } else {
            item.remove();
          }
        } catch (_) {
          item.innerHTML = originalHTML;
          attachHistoryDeleteListeners(item);
        }
      });
    });
  });
}

function renderHistoryList(sessions) {
  const el = document.getElementById('history-list');
  if (!sessions.length) { el.textContent = '還沒有練習記錄'; return; }

  el.innerHTML = sessions.map(s => `
    <div class="history-item" data-id="${s.id}" style="position:relative">
      <div style="display:flex;justify-content:space-between;padding-right:28px">
        <span>${escHtml(s.difficulty)} · ${s.status === 'completed' ? '已完成' : '進行中'}</span>
        <span style="color:${s.scores_json?.totalScore >= 70 ? 'var(--success)' : 'var(--warning)'}">
          ${s.scores_json?.totalScore != null ? s.scores_json.totalScore + ' 分' : '—'}
        </span>
      </div>
      <div style="color:var(--text-secondary);font-size:0.8rem;margin-top:4px">
        ${new Date(s.created_at).toLocaleString('zh-TW')}
      </div>
      <button class="btn-icon history-delete-btn" title="刪除" style="position:absolute;top:8px;right:8px;font-size:1rem;padding:2px 6px" data-id="${s.id}">
        <i class="ph ph-trash"></i>
      </button>
    </div>
  `).join('');

  el.querySelectorAll('.history-item').forEach(item => {
    item.addEventListener('click', async () => {
      const res = await fetch(`/api/sessions/${item.dataset.id}`, { headers: apiHeaders() });
      const session = await res.json();
      AppState.currentSession = session;
      navigate(session.status === 'completed' ? 'report' : 'practice');
    });
  });

  attachHistoryDeleteListeners(el);
}

// ══════════════════════════════════════════════════
// NSM Wizard — renderNSM, renderNSMStep1-4, bindNSM
// ══════════════════════════════════════════════════

function renderNSM() {
  switch (AppState.nsmStep) {
    case 1: return renderNSMStep1();
    case 2: return renderNSMStep2();
    case 3: return renderNSMStep3();
    case 4: return renderNSMStep4();
    default: return renderNSMStep1();
  }
}

// Virtual scroll helper — builds the innerHTML for a single NSM question card.
function createNSMQuestionCardHtml(q) {
  var isSelected = AppState.nsmSelectedQuestion && AppState.nsmSelectedQuestion.id === q.id;
  var productType = detectProductType(q);
  var typeMeta = NSM_TYPE_META[productType];

  var contextHtml = '';
  if (isSelected) {
    if (AppState.nsmContextLoading) {
      contextHtml = `
        <div class="nsm-context-preview loading">
          <i class="ph ph-circle-notch" style="animation:spin 0.8s linear infinite"></i>
          <span>分析情境中…</span>
        </div>`;
    } else if (AppState.nsmContext && AppState.nsmContextQuestionId === q.id) {
      var ctx = AppState.nsmContext;
      contextHtml = `
        <div class="nsm-context-preview">
          <div class="nsm-ctx-row"><span class="nsm-ctx-label"><i class="ph ph-buildings"></i> 商業模式</span><span class="nsm-ctx-val">${escHtml(ctx.businessModel)}</span></div>
          <div class="nsm-ctx-row"><span class="nsm-ctx-label"><i class="ph ph-users"></i> 使用者</span><span class="nsm-ctx-val">${escHtml(ctx.userTypes)}</span></div>
          <div class="nsm-ctx-row nsm-ctx-trap"><span class="nsm-ctx-label"><i class="ph ph-warning"></i> 常見陷阱</span><span class="nsm-ctx-val">${escHtml(ctx.commonTrap)}</span></div>
          <div class="nsm-ctx-row nsm-ctx-angle"><span class="nsm-ctx-label"><i class="ph ph-lightbulb"></i> 破題切入</span><span class="nsm-ctx-val">${escHtml(ctx.thinkingAngle)}</span></div>
        </div>`;
    }
  }

  return `
  <div class="nsm-question-card ${isSelected ? 'selected' : ''}" data-qid="${escHtml(q.id)}" role="button" tabindex="0" aria-pressed="${isSelected ? 'true' : 'false'}">
    <div class="nsm-q-header">
      <span class="nsm-company-badge">${escHtml(q.company)}</span>
      <span class="nsm-industry">${escHtml(q.industry)}</span>
      ${isSelected ? `<span class="nsm-type-badge" style="background:${typeMeta.color}18;color:${typeMeta.color};border:1px solid ${typeMeta.color}38"><i class="ph ${typeMeta.icon}"></i> ${typeMeta.label}</span>` : ''}
    </div>
    <p class="nsm-scenario">${escHtml(q.scenario)}</p>
    ${contextHtml}
  </div>`;
}

function renderNSMStep1() {
  var selected = AppState.nsmSelectedQuestion;

  var progressBar = `
    <div class="nsm-progress">
      <div class="nsm-progress-step active">1</div>
      <div class="nsm-progress-line"></div>
      <div class="nsm-progress-step">2</div>
      <div class="nsm-progress-line"></div>
      <div class="nsm-progress-step">3</div>
      <div class="nsm-progress-line"></div>
      <div class="nsm-progress-step">4</div>
    </div>`;

  // The question list is left empty here; virtual scrolling is set up
  // imperatively in bindNSM() after this HTML is inserted into the DOM.
  return `
    <div class="nsm-view">
      <div class="nsm-navbar">
        <button class="btn-icon" id="btn-nsm-back" aria-label="返回"><i class="ph ph-arrow-left"></i></button>
        <span class="nsm-title">選擇情境</span>
        <div class="nsm-navbar-spacer"></div>
      </div>
      ${progressBar}
      <div class="nsm-body">
        <p class="nsm-instruction">選擇一個企業情境，開始定義北極星指標</p>
        <div class="nsm-question-list"></div>
        <div style="height:80px"></div>
      </div>
      <div class="nsm-fixed-bottom">
        <div id="nsm-step1-error" class="nsm-inline-error" role="alert" style="display:none"></div>
        <button class="btn btn-primary nsm-next-btn" id="btn-nsm-step1-next" ${selected ? '' : 'disabled'}>
          確認，開始定義 <i class="ph ph-arrow-right"></i>
        </button>
      </div>
    </div>`;
}

// Sets up lightweight virtual scrolling on the Step 1 question list.
// Called from bindNSM() after the Step 1 HTML is in the DOM.
function initNSMStep1VirtualScroll() {
  var BUFFER = 5;
  var questions = NSM_QUESTIONS;

  var scrollParent = document.querySelector('.nsm-body');
  var containerEl = document.querySelector('.nsm-question-list');
  if (!scrollParent || !containerEl) return;

  // C2 (Method B): Measure actual card height from a dummy render.
  // Avoids hardcoding a value that drifts from CSS. Only measures the
  // unselected state; the selected/expanded card is acceptable as an outlier.
  var ITEM_HEIGHT = 80; // fallback
  var dummy = document.createElement('div');
  dummy.innerHTML = createNSMQuestionCardHtml(questions[0]);
  dummy.style.cssText = 'visibility:hidden;position:absolute;width:100%;pointer-events:none';
  containerEl.appendChild(dummy);
  var measured = dummy.firstElementChild ? dummy.firstElementChild.offsetHeight : 0;
  if (measured > 0) ITEM_HEIGHT = measured;
  containerEl.innerHTML = '';

  // Make the container occupy the full virtual height so scrollbar is correct.
  containerEl.style.position = 'relative';
  containerEl.style.height = (questions.length * ITEM_HEIGHT) + 'px';

  // I1: memoize last rendered range to skip redundant DOM rebuilds.
  var _lastStart = -1, _lastEnd = -1;

  function bindCardEvents(cardEl) {
    cardEl.addEventListener('click', async function() {
      var q = NSM_QUESTIONS.find(function(item) { return item.id === cardEl.dataset.qid; }) || null;
      AppState.nsmSelectedQuestion = q;

      if (q && AppState.nsmContextQuestionId !== q.id) {
        AppState.nsmContext = null;
        AppState.nsmContextQuestionId = null;
      }

      // Re-render the virtual scroll frame in place (avoids full page re-render).
      // Force re-render by resetting memo (selected state changed card height).
      _lastStart = -1; _lastEnd = -1;
      renderVisible(scrollParent.scrollTop, scrollParent.clientHeight);

      // Update next button state.
      var btn = document.getElementById('btn-nsm-step1-next');
      if (btn) btn.disabled = !AppState.nsmSelectedQuestion;

      if (q && !AppState.nsmContext && !AppState.nsmContextLoading) {
        AppState.nsmContextLoading = true;
        AppState.nsmContextQuestionId = q.id;
        _lastStart = -1; _lastEnd = -1;
        renderVisible(scrollParent.scrollTop, scrollParent.clientHeight);
        try {
          var res = await fetch('/api/nsm-context', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ questionJson: q })
          });
          if (res.ok) AppState.nsmContext = await res.json();
        } catch (_) {}
        AppState.nsmContextLoading = false;
        // C1 async guard: abort if the container is no longer in the DOM.
        if (!document.contains(containerEl)) return;
        if (AppState.nsmSelectedQuestion && AppState.nsmSelectedQuestion.id === q.id) {
          _lastStart = -1; _lastEnd = -1;
          renderVisible(scrollParent.scrollTop, scrollParent.clientHeight);
        }
      }
    });

    cardEl.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); cardEl.click(); }
    });
  }

  function renderVisible(scrollTop, containerHeight) {
    var start = Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT) - BUFFER);
    var end = Math.min(questions.length, Math.floor((scrollTop + containerHeight) / ITEM_HEIGHT) + 1 + BUFFER);

    // I1: skip rebuild when the visible range hasn't changed.
    if (start === _lastStart && end === _lastEnd) return;
    _lastStart = start; _lastEnd = end;

    // Build fragment: top spacer + visible cards + bottom spacer.
    var frag = document.createDocumentFragment();

    var topSpacer = document.createElement('div');
    topSpacer.style.height = (start * ITEM_HEIGHT) + 'px';
    frag.appendChild(topSpacer);

    for (var i = start; i < end; i++) {
      var q = questions[i];
      var wrapper = document.createElement('div');
      wrapper.innerHTML = createNSMQuestionCardHtml(q);
      var cardEl = wrapper.firstElementChild;
      bindCardEvents(cardEl);
      frag.appendChild(cardEl);
    }

    var bottomSpacer = document.createElement('div');
    bottomSpacer.style.height = ((questions.length - end) * ITEM_HEIGHT) + 'px';
    frag.appendChild(bottomSpacer);

    containerEl.innerHTML = '';
    containerEl.appendChild(frag);
  }

  // Initial render.
  renderVisible(scrollParent.scrollTop, scrollParent.clientHeight);

  // C1: remove any stale scroll listener before registering a new one.
  if (_nsmScrollFn && _nsmScrollParent) {
    _nsmScrollParent.removeEventListener('scroll', _nsmScrollFn);
    _nsmScrollFn = null;
    _nsmScrollParent = null;
  }
  var currentScrollParent = scrollParent; // capture for async closure safety
  _nsmScrollParent = scrollParent;        // store ref for future cleanup
  _nsmScrollFn = function() {
    // C1 guard: if scrollParent has been replaced by a full re-render, bail.
    if (!document.contains(currentScrollParent)) {
      _nsmScrollFn = null;
      _nsmScrollParent = null;
      return;
    }
    renderVisible(currentScrollParent.scrollTop, currentScrollParent.clientHeight);
  };
  scrollParent.addEventListener('scroll', _nsmScrollFn, { passive: true });
}

function renderNSMStep2() {
  const q = AppState.nsmSelectedQuestion;
  const draft = AppState.nsmNsmDraft || '';
  const warning = AppState.nsmVanityWarning || null;
  const productType = detectProductType(q);
  const typeMeta = NSM_TYPE_META[productType];

  const warningHtml = warning ? `
    <div class="nsm-vanity-warning">
      <div class="nsm-vanity-header">
        <i class="ph ph-warning nsm-warning-icon"></i>
        <strong>這可能是虛榮指標</strong>
      </div>
      <p class="nsm-vanity-body">虛榮指標特徵：數字好看，但翻倍後不代表公司賺更多錢或留住更多用戶。</p>
      <div class="nsm-coach-hint">
        <i class="ph ph-lightbulb" style="color:var(--accent)"></i>
        <span>${escHtml(warning.coachHint)}</span>
      </div>
      <div class="nsm-warning-actions">
        <button class="btn btn-primary" id="btn-nsm-redefine" style="min-height:44px">重新定義 NSM</button>
        <button class="nsm-btn-ghost" id="btn-nsm-proceed-anyway">我知道風險，繼續</button>
      </div>
    </div>` : '';

  return `
    <div class="nsm-view">
      <div class="nsm-navbar">
        <button class="btn-icon" id="btn-nsm-back" aria-label="返回上一步"><i class="ph ph-arrow-left"></i></button>
        <span class="nsm-title">定義 NSM</span>
        <div class="nsm-navbar-spacer"></div>
      </div>
      <div class="nsm-progress">
        <div class="nsm-progress-step done">1</div>
        <div class="nsm-progress-line" style="background:var(--accent)"></div>
        <div class="nsm-progress-step active">2</div>
        <div class="nsm-progress-line"></div>
        <div class="nsm-progress-step">3</div>
        <div class="nsm-progress-line"></div>
        <div class="nsm-progress-step">4</div>
      </div>
      <div class="nsm-body">
        <div class="nsm-context-card">
          <div class="nsm-context-top">
            <div class="nsm-context-company">${escHtml(q.company)}</div>
            <span class="nsm-type-badge" style="background:${typeMeta.color}18;color:${typeMeta.color};border:1px solid ${typeMeta.color}38">
              <i class="ph ${typeMeta.icon}"></i> ${typeMeta.label}
            </span>
          </div>
          <p class="nsm-context-scenario">${escHtml(q.scenario)}</p>
          <div class="nsm-type-hint"><i class="ph ph-info"></i> ${escHtml(typeMeta.desc)}</div>
        </div>
        <div class="nsm-guide-steps">
          <div class="nsm-guide-title"><i class="ph ph-path"></i> 3 步定義法</div>
          <div class="nsm-guide-step">
            <span class="nsm-guide-num">1</span>
            <div><strong>找 AHA 時刻</strong><br>
            <span class="nsm-guide-sub">用戶第一次真正感受到 ${escHtml(q.company)} 價值的那個動作是什麼？</span></div>
          </div>
          <div class="nsm-guide-step">
            <span class="nsm-guide-num">2</span>
            <div><strong>轉成可量化指標</strong><br>
            <span class="nsm-guide-sub">把那個動作表達成「誰 × 做了什麼行為 × 多少量/頻率」的具體數字</span></div>
          </div>
          <div class="nsm-guide-step">
            <span class="nsm-guide-num">3</span>
            <div><strong>做虛榮指標檢驗</strong><br>
            <span class="nsm-guide-sub">問自己：如果這個數字翻倍，${escHtml(q.company)} 的商業收益一定增加嗎？</span></div>
          </div>
        </div>
        <label class="nsm-field-label">你認為 ${escHtml(q.company)} 的北極星指標是？</label>
        <textarea id="nsm-nsm-input" class="nsm-textarea" placeholder="一句話描述核心指標，例如：每月付費用戶完整收聽時長（分鐘）" rows="4">${escHtml(draft)}</textarea>
        ${warningHtml}
        <div style="height:80px"></div>
      </div>
      <div class="nsm-fixed-bottom">
        <div id="nsm-step2-error" class="nsm-inline-error" role="alert" style="display:none"></div>
        <button class="btn btn-primary nsm-next-btn" id="btn-nsm-step2-next">
          確認，拆解輸入指標 <i class="ph ph-arrow-right"></i>
        </button>
      </div>
    </div>`;
}

function renderNSMStep3() {
  const breakdown = AppState.nsmBreakdownDraft || {};
  const q = AppState.nsmSelectedQuestion || {};
  const productType = detectProductType(q);
  const typeMeta = NSM_TYPE_META[productType];
  const dimensions = NSM_DIMENSION_CONFIGS[productType];

  const fields = dimensions.map(d => {
    const hint = (AppState.nsmHints || {})[d.key] || '';
    return `
    <div class="nsm-dim-section">
      <div class="nsm-dim-header" style="border-left-color:${d.color}">
        <div class="nsm-dim-label">${escHtml(d.label)}</div>
        <div class="nsm-dim-desc">${escHtml(d.subtitle)}</div>
      </div>
      <div class="nsm-coach-q"><i class="ph ph-chat-dots" style="color:${d.color}"></i> ${escHtml(d.coachQ)}</div>
      <button class="nsm-hint-btn" data-dim="${d.key}" type="button" aria-expanded="false" aria-controls="nsm-hint-${d.key}">
        <i class="ph ph-lightbulb"></i> 查看教練提示
      </button>
      <div class="nsm-hint-content" id="nsm-hint-${d.key}" style="display:none">
        ${hint ? `<div class="nsm-hint-revealed">${escHtml(hint)}</div>` : ''}
      </div>
      <textarea class="nsm-textarea nsm-dim-input" id="nsm-dim-${d.key}" placeholder="${escHtml(d.placeholder)}" rows="2">${escHtml(breakdown[d.key] || '')}</textarea>
    </div>`;
  }).join('');

  return `
    <div class="nsm-view">
      <div class="nsm-navbar">
        <button class="btn-icon" id="btn-nsm-back" aria-label="返回上一步"><i class="ph ph-arrow-left"></i></button>
        <span class="nsm-title">拆解輸入指標</span>
        <div class="nsm-navbar-spacer"></div>
      </div>
      <div class="nsm-progress">
        <div class="nsm-progress-step done">1</div>
        <div class="nsm-progress-line" style="background:var(--accent)"></div>
        <div class="nsm-progress-step done">2</div>
        <div class="nsm-progress-line" style="background:var(--accent)"></div>
        <div class="nsm-progress-step active">3</div>
        <div class="nsm-progress-line"></div>
        <div class="nsm-progress-step">4</div>
      </div>
      <div class="nsm-body">
        <div class="nsm-sticky-nsm">
          <span class="nsm-sticky-label">你的 NSM：</span>
          <span class="nsm-sticky-value">${escHtml(AppState.nsmNsmDraft || '')}</span>
        </div>
        <div class="nsm-step3-intro">
          <span class="nsm-type-badge" style="background:${typeMeta.color}18;color:${typeMeta.color};border:1px solid ${typeMeta.color}38">
            <i class="ph ${typeMeta.icon}"></i> ${typeMeta.label}
          </span>
          <p class="nsm-step3-tip">輸入指標是驅動 NSM 的<strong>領先訊號</strong>——這些指標翻倍，NSM 應該跟著成長。以下 4 個維度依 <strong>${typeMeta.label}</strong> 產品特性設計，你可根據情境調整詮釋角度。</p>
        </div>
        ${fields}
        <div style="height:80px"></div>
      </div>
      <div class="nsm-fixed-bottom">
        <div id="nsm-step3-error" class="nsm-inline-error" role="alert" style="display:none"></div>
        <button class="btn btn-primary nsm-next-btn" id="btn-nsm-step3-submit">
          <span id="nsm-submit-label">送出，取得 AI 評分</span> <i class="ph ph-arrow-right"></i>
        </button>
      </div>
    </div>`;
}

function renderNSMStep4() {
  const session = AppState.nsmSession || {};
  const scores = session.scores_json || {};
  const q = AppState.nsmSelectedQuestion || {};
  const total = scores.totalScore || 0;
  const activeTab = AppState.nsmReportTab || 'overview';

  if (!scores.scores) {
    return `<div class="nsm-view">
      <div class="nsm-navbar">
        <button class="btn-icon" id="btn-nsm-back" aria-label="回首頁"><i class="ph ph-house"></i></button>
        <span class="nsm-title">NSM 報告</span>
        <div class="nsm-navbar-spacer"></div>
      </div>
      <div class="nsm-loading-state">
        <i class="ph ph-circle-notch"></i>
        <p>載入報告中…</p>
      </div>
    </div>`;
  }

  const dims = [
    { key: 'alignment',     label: '價值關聯', color: '#6c63ff' },
    { key: 'leading',       label: '領先指標', color: '#3b82f6' },
    { key: 'actionability', label: '操作性',   color: '#10b981' },
    { key: 'simplicity',    label: '可理解性', color: '#f59e0b' },
    { key: 'sensitivity',   label: '週期敏感', color: '#ef4444' },
  ];

  const radarSvg = scores.scores ? renderNSMRadar(scores.scores) : '';

  const overviewTab = `
    <div class="nsm-report-overview">
      <div class="nsm-radar-wrap">${radarSvg}</div>
      ${dims.map(d => {
        const val = scores.scores[d.key] || 0;
        const pct = (val / 5) * 100;
        const comment = scores.coachComments ? scores.coachComments[d.key] : '';
        return `<div class="nsm-score-row">
          <div class="nsm-score-label">${d.label}</div>
          <div class="nsm-score-bar-wrap"><div class="nsm-score-bar-fill" style="width:${pct}%;background:${d.color}"></div></div>
          <div class="nsm-score-num">${val}/5</div>
        </div>
        ${comment ? '<div class="nsm-dim-comment">' + escHtml(comment) + '</div>' : ''}`;
      }).join('')}
    </div>`;

  const coachTree = scores.coachTree || {};
  const userNsm = session.user_nsm || AppState.nsmNsmDraft || '';
  const userBreakdown = session.user_breakdown || AppState.nsmBreakdownDraft || {};
  const cmpType = detectProductType(q);
  const cmpDims = NSM_DIMENSION_CONFIGS[cmpType];

  const comparisonTab = `
    <div class="nsm-comparison">
      <div class="nsm-tree-col">
        <div class="nsm-tree-title"><i class="ph ph-user"></i> 你的拆解</div>
        <div class="nsm-tree-node nsm-tree-root" data-node="user-nsm" data-label="NSM" role="button" tabindex="0">${escHtml(userNsm || '（未填寫）')}</div>
        ${cmpDims.map(d => `<div class="nsm-tree-node" data-node="user-${d.key}" data-label="${escHtml(d.label)}" role="button" tabindex="0">${escHtml(userBreakdown[d.key] || '（未填寫）')}</div>`).join('')}
      </div>
      <div class="nsm-tree-col">
        <div class="nsm-tree-title"><i class="ph ph-graduation-cap"></i> 教練版本 <span class="nsm-tree-hint-tip">點擊查看思路</span></div>
        <div class="nsm-tree-node nsm-tree-root nsm-tree-coach" data-node="coach-nsm" data-label="NSM" data-is-coach="1" role="button" tabindex="0">${escHtml(coachTree.nsm || '')}</div>
        ${cmpDims.map(d => `<div class="nsm-tree-node nsm-tree-coach" data-node="coach-${d.key}" data-label="${escHtml(d.label)}" data-is-coach="1" role="button" tabindex="0">${escHtml(coachTree[d.key] || '')}</div>`).join('')}
      </div>
    </div>
    <div class="nsm-node-detail" id="nsm-node-detail" style="display:none"></div>`;

  const highlightsTab = `
    <div class="nsm-highlights">
      <div class="nsm-highlight-card nsm-highlight-best">
        <div class="nsm-highlight-head"><i class="ph ph-trophy"></i> 最大亮點</div>
        <p>${escHtml(scores.bestMove || '—')}</p>
      </div>
      <div class="nsm-highlight-card nsm-highlight-trap">
        <div class="nsm-highlight-head"><i class="ph ph-warning-circle"></i> 主要陷阱</div>
        <p>${escHtml(scores.mainTrap || '—')}</p>
      </div>
      <div class="nsm-highlight-card">
        <div class="nsm-highlight-head"><i class="ph ph-chat-text"></i> 總評</div>
        <p>${escHtml(scores.summary || '—')}</p>
      </div>
    </div>`;

  const exportTab = `
    <div class="nsm-export">
      <button class="btn btn-primary" id="btn-nsm-again">
        <i class="ph ph-arrow-counter-clockwise"></i> 再練一次
      </button>
      <button class="nsm-btn-ghost" id="btn-nsm-home">
        <i class="ph ph-house"></i> 回首頁
      </button>
    </div>`;

  const tabContent = { overview: overviewTab, comparison: comparisonTab, highlights: highlightsTab, export: exportTab };

  return `
    <div class="nsm-view">
      <div class="nsm-navbar">
        <button class="btn-icon" id="btn-nsm-back" aria-label="回首頁"><i class="ph ph-house"></i></button>
        <span class="nsm-title">NSM 報告</span>
        <div class="nsm-navbar-spacer"></div>
      </div>
      <div class="nsm-score-summary">
        <div class="nsm-total-score">${total}</div>
        <div class="nsm-score-label-sm">/ 100</div>
        <div class="nsm-score-company">${escHtml(q.company || '')}</div>
      </div>
      <div class="tab-bar">
        <button class="tab-btn ${activeTab === 'overview' ? 'active' : ''}" data-nsm-tab="overview">總覽</button>
        <button class="tab-btn ${activeTab === 'comparison' ? 'active' : ''}" data-nsm-tab="comparison">對比</button>
        <button class="tab-btn ${activeTab === 'highlights' ? 'active' : ''}" data-nsm-tab="highlights">亮點</button>
        <button class="tab-btn ${activeTab === 'export' ? 'active' : ''}" data-nsm-tab="export">完成</button>
      </div>
      <div class="nsm-report-body">
        ${tabContent[activeTab] || overviewTab}
      </div>
    </div>`;
}

function bindNSM() {
  // Back button
  document.getElementById('btn-nsm-back')?.addEventListener('click', () => {
    if (AppState.nsmStep === 1 || AppState.nsmStep === 4) navigate('home');
    else { AppState.nsmStep--; render(); }
  });

  // Step 1: virtual scroll initialisation (card click/keyboard events are
  // attached inside initNSMStep1VirtualScroll's bindCardEvents helper).
  if (AppState.nsmStep === 1) {
    initNSMStep1VirtualScroll();
  }

  // Step 1: next
  var btnStep1Next = document.getElementById('btn-nsm-step1-next');
  if (btnStep1Next) {
    btnStep1Next.addEventListener('click', async function() {
      if (!AppState.nsmSelectedQuestion) return;
      btnStep1Next.classList.add('btn-loading');
      btnStep1Next.disabled = true;
      try {
        var q = AppState.nsmSelectedQuestion;
        var headers = { 'Content-Type': 'application/json' };
        if (AppState.accessToken) headers['Authorization'] = 'Bearer ' + AppState.accessToken;
        else headers['X-Guest-ID'] = AppState.guestId;
        var res = await fetch(nsmRoute(''), { method: 'POST', headers: headers, body: JSON.stringify({ questionId: q.id, questionJson: q }) });
        var data = await res.json();
        if (!res.ok) throw new Error(data.error);
        AppState.nsmSession = { id: data.sessionId };
        if (AppState.nsmSelectedQuestion) {
          var newEntry = {
            id: data.sessionId, type: 'nsm', status: 'in_progress',
            scores_json: null, question_json: AppState.nsmSelectedQuestion,
            created_at: new Date().toISOString()
          };
          AppState.recentSessions = [newEntry].concat(
            AppState.recentSessions.filter(function(s) { return s.id !== data.sessionId; })
          );
        }
        AppState.nsmStep = 2;
        AppState.nsmVanityWarning = null;
        render();
      } catch (e) {
        btnStep1Next.classList.remove('btn-loading');
        btnStep1Next.disabled = false;
        var errEl = document.getElementById('nsm-step1-error');
        if (errEl) { errEl.textContent = '無法建立練習，請重試（' + e.message + '）'; errEl.style.display = 'block'; }
      }
    });
  }

  // Step 2: NSM input
  var nsmInput = document.getElementById('nsm-nsm-input');
  if (nsmInput) nsmInput.addEventListener('input', function() { AppState.nsmNsmDraft = nsmInput.value; });

  // Step 2: next
  var btnStep2Next = document.getElementById('btn-nsm-step2-next');
  if (btnStep2Next) {
    btnStep2Next.addEventListener('click', function() {
      var val = (nsmInput ? nsmInput.value : AppState.nsmNsmDraft || '').trim();
      if (!val) {
        var step2Err = document.getElementById('nsm-step2-error');
        if (step2Err) { step2Err.textContent = '請先輸入你認為的北極星指標'; step2Err.style.display = 'block'; }
        if (nsmInput) nsmInput.focus();
        return;
      }
      AppState.nsmNsmDraft = val;
      var q = AppState.nsmSelectedQuestion;
      if (!AppState.nsmVanityWarning && isVanityMetric(val, q.anti_patterns)) {
        AppState.nsmVanityWarning = { coachHint: '試著思考：這個指標如果翻倍，' + q.company + ' 的核心商業價值會增加嗎？考慮從「用戶行為產生的業務影響」角度重新定義。' };
        render();
        return;
      }
      AppState.nsmVanityWarning = null;
      AppState.nsmHints = null;
      AppState.nsmHintsLoading = false;
      AppState.nsmStep = 3;
      render();
    });
  }

  document.getElementById('btn-nsm-redefine')?.addEventListener('click', function() {
    AppState.nsmVanityWarning = null;
    AppState.nsmNsmDraft = '';
    render();
  });
  document.getElementById('btn-nsm-proceed-anyway')?.addEventListener('click', function() {
    AppState.nsmVanityWarning = null;
    AppState.nsmStep = 3;
    render();
  });

  // Step 3: dimension inputs — driven by detected product type, not hardcoded
  var _step3Q = AppState.nsmSelectedQuestion || {};
  var _step3Dims = NSM_DIMENSION_CONFIGS[detectProductType(_step3Q)] || [];
  _step3Dims.forEach(function(d) {
    var inp = document.getElementById('nsm-dim-' + d.key);
    if (inp) inp.addEventListener('input', function() {
      if (!AppState.nsmBreakdownDraft) AppState.nsmBreakdownDraft = {};
      AppState.nsmBreakdownDraft[d.key] = inp.value;
    });
  });

  // Step 3: hint buttons — reveal on tap, AI-generated on first click
  document.querySelectorAll('.nsm-hint-btn[data-dim]').forEach(function(btn) {
    btn.addEventListener('click', async function() {
      var dim = btn.dataset.dim;
      var contentEl = document.getElementById('nsm-hint-' + dim);
      if (!contentEl) return;

      if (AppState.nsmHints) {
        var isVisible = contentEl.style.display !== 'none';
        if (!isVisible) {
          var hintText = AppState.nsmHints[dim] || '暫無此維度提示';
          contentEl.innerHTML = '<div class="nsm-hint-revealed">' + escHtml(hintText) + '</div>';
        }
        contentEl.style.display = isVisible ? 'none' : 'block';
        btn.setAttribute('aria-expanded', isVisible ? 'false' : 'true');
        btn.innerHTML = (isVisible ? '<i class="ph ph-lightbulb"></i> 查看教練提示' : '<i class="ph ph-caret-up"></i> 收起提示');
        return;
      }

      if (AppState.nsmHintsLoading) return;
      AppState.nsmHintsLoading = true;

      document.querySelectorAll('.nsm-hint-btn').forEach(function(b) {
        b.innerHTML = '<i class="ph ph-circle-notch" style="animation:spin 0.8s linear infinite"></i> 生成提示中…';
        b.disabled = true;
      });

      try {
        var sessionId = AppState.nsmSession ? AppState.nsmSession.id : '';
        var headers = { 'Content-Type': 'application/json' };
        if (AppState.accessToken) headers['Authorization'] = 'Bearer ' + AppState.accessToken;
        else headers['X-Guest-ID'] = AppState.guestId;
        var hintBase = AppState.accessToken ? '/api/nsm-sessions' : '/api/guest/nsm-sessions';
        var res = await fetch(hintBase + '/' + sessionId + '/hints', {
          method: 'POST',
          headers: headers,
          body: JSON.stringify({ userNsm: AppState.nsmNsmDraft || '' })
        });
        if (res.ok) AppState.nsmHints = await res.json();
      } catch (_) {}

      AppState.nsmHintsLoading = false;

      document.querySelectorAll('.nsm-hint-btn').forEach(function(b) {
        b.innerHTML = '<i class="ph ph-lightbulb"></i> 查看教練提示';
        b.disabled = false;
      });

      if (AppState.nsmHints && AppState.nsmHints[dim]) {
        contentEl.innerHTML = '<div class="nsm-hint-revealed">' + escHtml(AppState.nsmHints[dim]) + '</div>';
        contentEl.style.display = 'block';
        btn.setAttribute('aria-expanded', 'true');
        btn.innerHTML = '<i class="ph ph-caret-up"></i> 收起提示';
      }
    });
  });

  // Step 3: submit
  var btnStep3Submit = document.getElementById('btn-nsm-step3-submit');
  if (btnStep3Submit) {
    btnStep3Submit.addEventListener('click', async function() {
      var breakdown = AppState.nsmBreakdownDraft || {};
      var userNsm = AppState.nsmNsmDraft || '';
      if (!userNsm) {
        var step3ErrEl = document.getElementById('nsm-step3-error');
        if (step3ErrEl) { step3ErrEl.textContent = '請返回 Step 2 填寫 NSM 定義再送出'; step3ErrEl.style.display = 'block'; }
        return;
      }
      btnStep3Submit.classList.add('btn-loading');
      btnStep3Submit.disabled = true;
      var label = document.getElementById('nsm-submit-label');
      if (label) label.textContent = 'AI 評分中…';
      try {
        var sessionId = AppState.nsmSession ? AppState.nsmSession.id : '';
        var headers = { 'Content-Type': 'application/json' };
        if (AppState.accessToken) headers['Authorization'] = 'Bearer ' + AppState.accessToken;
        else headers['X-Guest-ID'] = AppState.guestId;
        var res = await fetch(nsmRoute(sessionId + '/evaluate'), { method: 'POST', headers: headers, body: JSON.stringify({ userNsm: userNsm, userBreakdown: breakdown }) });
        var data = await res.json();
        if (!res.ok) throw new Error(data.error);
        AppState.nsmSession = Object.assign({}, AppState.nsmSession, { scores_json: data, user_nsm: userNsm, user_breakdown: breakdown });
        var _sid = AppState.nsmSession ? AppState.nsmSession.id : null;
        if (_sid) {
          var _found = false;
          AppState.recentSessions = AppState.recentSessions.map(function(s) {
            if (s.id === _sid) { _found = true; return Object.assign({}, s, { status: 'completed', scores_json: data, type: 'nsm' }); }
            return s;
          });
          if (!_found && AppState.nsmSelectedQuestion) {
            AppState.recentSessions.unshift({
              id: _sid, type: 'nsm', status: 'completed',
              scores_json: data, question_json: AppState.nsmSelectedQuestion,
              created_at: new Date().toISOString()
            });
          }
        }
        AppState.nsmReportTab = 'overview';
        AppState.nsmStep = 4;
        render();
      } catch (e) {
        btnStep3Submit.classList.remove('btn-loading');
        btnStep3Submit.disabled = false;
        if (label) label.textContent = '送出，取得 AI 評分';
        var errEl = document.getElementById('nsm-step3-error');
        if (errEl) { errEl.textContent = '評分失敗，請重試（' + e.message + '）'; errEl.style.display = 'block'; }
      }
    });
  }

  // Step 4: tab switching
  document.querySelectorAll('[data-nsm-tab]').forEach(function(btn) {
    btn.addEventListener('click', function() { AppState.nsmReportTab = btn.dataset.nsmTab; render(); });
  });

  // Step 4: comparison tree tap
  document.querySelectorAll('.nsm-tree-node[data-node]').forEach(function(node) {
    node.addEventListener('click', function() {
      var detailEl = document.getElementById('nsm-node-detail');
      if (!detailEl) return;
      var key = node.dataset.node;
      var isCoach = node.dataset.isCoach === '1';
      var dim = key.replace('coach-','').replace('user-','');
      var dimLabel = node.dataset.label || dim;
      var sc = AppState.nsmSession ? (AppState.nsmSession.scores_json || {}) : {};
      var ctree = sc.coachTree || {};
      var rationale = sc.coachRationale || {};
      var bd = (AppState.nsmSession && AppState.nsmSession.user_breakdown) || AppState.nsmBreakdownDraft || {};

      var metricText = isCoach
        ? (ctree[dim] || '—')
        : (dim === 'nsm' ? (AppState.nsmNsmDraft || '（未填寫）') : (bd[dim] || '（未填寫）'));
      var prefix = isCoach ? '教練版 ' : '你的 ';
      var rationaleText = isCoach ? (rationale[dim] || '') : '';

      if (AppState.nsmOpenNode === key) {
        AppState.nsmOpenNode = null;
        detailEl.style.display = 'none';
        detailEl.innerHTML = '';
      } else {
        AppState.nsmOpenNode = key;
        detailEl.style.display = 'block';
        detailEl.innerHTML =
          '<div class="nsm-detail-metric">' +
            '<span class="nsm-detail-prefix">' + escHtml(prefix + dimLabel) + '</span>' +
            '<p class="nsm-detail-value">' + escHtml(metricText) + '</p>' +
          '</div>' +
          (rationaleText
            ? '<div class="nsm-rationale">' +
                '<div class="nsm-rationale-head"><i class="ph ph-lightbulb"></i> 教練設計思路</div>' +
                '<p class="nsm-rationale-body">' + escHtml(rationaleText) + '</p>' +
              '</div>'
            : '');
      }
    });
  });
  // Restore open node if any
  if (AppState.nsmOpenNode) {
    var openNode = document.querySelector('.nsm-tree-node[data-node="' + AppState.nsmOpenNode + '"]');
    if (openNode) openNode.click();
  }

  // Step 4: action buttons
  document.getElementById('btn-nsm-again')?.addEventListener('click', function() {
    AppState.nsmStep = 1;
    AppState.nsmSession = null;
    AppState.nsmSelectedQuestion = null;
    AppState.nsmNsmDraft = '';
    AppState.nsmBreakdownDraft = {};
    AppState.nsmVanityWarning = null;
    render();
  });
  document.getElementById('btn-nsm-home')?.addEventListener('click', function() { navigate('home'); });

  // visualViewport keyboard fix — use module-level ref to prevent listener accumulation
  if (_adjustNsmKeyboardFn && window.visualViewport) {
    window.visualViewport.removeEventListener('resize', _adjustNsmKeyboardFn);
    window.visualViewport.removeEventListener('scroll', _adjustNsmKeyboardFn);
  }
  _adjustNsmKeyboardFn = (function() {
    var _nsmKbRaf = null;
    return function() {
      if (!window.visualViewport) return;
      if (_nsmKbRaf) return;
      _nsmKbRaf = requestAnimationFrame(function() {
        _nsmKbRaf = null;
        var bar = document.querySelector('.nsm-fixed-bottom');
        var body = document.querySelector('.nsm-body');
        if (!bar) {
          if (body) body.style.paddingBottom = '';
          return;
        }
        var keyboardHeight = Math.max(0, window.innerHeight - window.visualViewport.offsetTop - window.visualViewport.height);
        bar.style.transform = 'translateY(-' + keyboardHeight + 'px)';
        if (body) body.style.paddingBottom = (bar.offsetHeight + keyboardHeight) + 'px';
      });
    };
  }());
  var nsmBar = document.querySelector('.nsm-fixed-bottom');
  if (nsmBar) nsmBar.style.willChange = 'transform';
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', _adjustNsmKeyboardFn);
    window.visualViewport.addEventListener('scroll', _adjustNsmKeyboardFn);
    _adjustNsmKeyboardFn();
  }

  // If step 4 but no scores yet, load from server
  if (AppState.nsmStep === 4 && AppState.nsmSession && AppState.nsmSession.id && !AppState.nsmSession.scores_json?.totalScore) {
    var headers = AppState.accessToken
      ? { 'Authorization': 'Bearer ' + AppState.accessToken }
      : { 'X-Guest-ID': AppState.guestId };
    fetch(nsmRoute(AppState.nsmSession.id), { headers: headers })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        AppState.nsmSession = data;
        AppState.nsmSelectedQuestion = NSM_QUESTIONS.find(function(q) { return q.id === data.question_id; }) || data.question_json;
        AppState.nsmNsmDraft = data.user_nsm || '';
        AppState.nsmBreakdownDraft = data.user_breakdown || {};
        if (!data.scores_json?.totalScore) AppState.nsmStep = 3;
        render();
      }).catch(function() {});
  }
}

window.sendChat = sendChat;
