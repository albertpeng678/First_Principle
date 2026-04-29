// ── 常數 ─────────────────────────────────────────
var _adjustNsmKeyboardFn = null; // module-level to prevent listener leak
var _adjustCirclesKbFn = null; // module-level to prevent listener leak (used by bindCirclesPhase2)

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
  view: 'circles',
  essenceDraft: '',
  activeReportTab: 'overview',
  homeTab: 'pm',
  recentSessions: [],
  nsmStep: 1,
  nsmSession: null,
  nsmSelectedQuestion: null,
  nsmNsmDraft: '',
  nsmDefinitionDraft: '',     // 定義說明 (Step 2 field 2)
  nsmBusinessLinkDraft: '',   // 與業務目標的連結 (Step 2 field 3)
  nsmBreakdownDraft: {},
  nsmVanityWarning: null,
  nsmReportTab: 'overview',
  nsmOpenNode: null,
  nsmSubTab: 'nsm-step2',     // 'nsm-step2' | 'nsm-gate' | 'nsm-step3' — sub-tab nav for Screen 8
  nsmGateResult: null,        // { items: [...], canProceed, overallStatus }
  nsmGateLoading: false,
  // CIRCLES
  circlesMode: localStorage.getItem('circlesMode') || 'simulation', // 'drill' | 'simulation'
  circlesSelectedType: 'design',   // 'design' | 'improve' | 'strategy'
  circlesDrillStep: 'C1',          // which step to drill
  circlesSelectedQuestion: null,   // { id, company, ... }
  circlesSession: null,            // { id, mode, drill_step } — other fields live in top-level AppState keys
  circlesPhase: 1,                 // 1 | 1.5 | 2 | 3 (score) | 4 (report)
  circlesFrameworkDraft: {},       // { fieldName: value } — current step's framework draft
  circlesStepDrafts: {},           // { stepKey: draftObj } — per-step persistent drafts saved on Phase 1 submit
                                   // L: { sol1, sol2, sol3 } — solution names
                                   // C1/I/R/C2: { fieldName: value, conclusion?: string } — Phase 1/2 values
                                   // E: { perSolution: { sol1: {...4 fields}, sol2: {...}, sol3: {...} }, conclusion?: string }
                                   // S: { fieldName: value, tracking: { reach, depth, frequency, impact } }
  circlesGateResult: null,         // { items, canProceed, overallStatus }
  circlesConversation: [],         // [{ userMessage, interviewee, coaching, hint }]
  circlesGateLoading: false,
  circlesScoreResult: null,        // current step score from evaluator
  circlesCoachOpen: false,
  circlesSubmitState: null,        // null | 'collapsed' | 'expanded'
  circlesConclusionText: '',       // user's conclusion textarea value
  circlesStepConclusions: {},      // { stepKey: 'conclusion text' } accumulated across steps
  circlesStepScores: {},           // { stepKey: scoreData } accumulated across steps
  circlesFinalReport: null,        // final report from /final-report endpoint
  circlesSimStep: 0,               // for simulation: which of 7 steps is active (0-6)
  circlesRecentSessions: [],       // [{ id, question_json, mode, drill_step, current_phase, sim_step_index, updated_at }]
  circlesExamplesCache: {},        // { 'sessionId|step|field': aiGeneratedExample } — lazy-cached per click
  circlesRecentLoading: false,
  circlesDisplayedQuestions: [],   // up to 5 randomly picked questions for current type tab
  nsmContext: null,
  nsmContextLoading: false,
  nsmContextQuestionId: null,
  nsmDisplayedQuestions: [],   // 5 random NSM_QUESTIONS shown on Step 1
  nsmHints: null,
  nsmHintsLoading: false,
  offcanvasCache: null,  // cached offcanvas session list for instant render

  // ── Phase 2 Spec 2: CIRCLES progress auto-save ──
  circlesSaveStatus: 'idle',         // 'idle' | 'saving' | 'saved' | 'error'
  circlesLastSavedAt: null,          // ms timestamp
  circlesSavingDebounce: null,       // setTimeout handle
  circlesSavingInFlight: false,
  circlesSavingPending: false,       // queued change while inflight
  circlesActiveDraft: null,          // for homepage resume banner
};

// Expose for tests + debugging.
window.AppState = AppState;

// ── isDesktop helper + cross-breakpoint re-render (Phase 0 Task 0.7) ──
function isDesktop() { return window.innerWidth >= 1024; }
AppState._lastIsDesktop = isDesktop();
function debounce(fn, ms) {
  let t;
  return function(...args) { clearTimeout(t); t = setTimeout(() => fn.apply(this, args), ms); };
}
window.addEventListener('resize', debounce(() => {
  const now = isDesktop();
  if (now !== AppState._lastIsDesktop) {
    AppState._lastIsDesktop = now;
    if (typeof render === 'function') render();
  }
  if (AppState.onboardingActive && typeof showCoachmark === 'function') {
    showCoachmark(AppState.onboardingStep);
  }
}, 100));

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

// (CIRCLES_STEP_HINTS removed — fallback was never read; examples now load from
// /api/circles-public/example which is curated per question.)

// ──────────────────────────────────────────────────
// CIRCLES_STEP_CONFIG — full per-step content for Phase 1 form + Phase 2 conclusion
//   Drives renderCirclesPhase1() and renderCirclesPhase2() — defines fields,
//   placeholders, hint overlay text, icebreaker text, and conclusion-box copy.
// ──────────────────────────────────────────────────
var CIRCLES_STEP_CONFIG = {
  C1: {
    label: 'C — 澄清情境',
    progressLabel: 'C · 澄清情境 · 1/7',
    fields: [
      { key: '問題範圍', placeholder: '說明討論的問題範圍與問題類型…', rows: 2,
        hintOverlay: '先把題目的問題本身定義清楚——它的具體類型是什麼（行為層／情感層／系統層）？涵蓋哪些功能或場景？哪些明確排除？沒釐清這層，後面的分析會在錯的邊界上展開。' },
      { key: '時間範圍', placeholder: '設定時間範圍並說明理由…', rows: 2,
        hintOverlay: '設定一個合理的觀察期，並說明為什麼這個時長對應這題的業務節奏。太短看不出趨勢、太長缺乏執行感。「X 天，因為這個業務以 Y 為週期」比丟個數字更有說服力。' },
      { key: '業務影響', placeholder: '說明業務影響與核心約束…', rows: 2,
        hintOverlay: '列出這題的核心業務指標和兩個關鍵利益方（通常是用戶端 vs. 商業端）。說清楚哪條紅線不能踩——什麼指標下滑多少就破局？沒有量化邊界，後面的取捨會發散。' },
      { key: '假設確認', placeholder: '列出你的關鍵假設，並標註哪些待確認…', rows: 2,
        hintOverlay: '列出 2-3 條後續分析會依賴的假設，最好寫成「X 是 A 而不是 B」的形式，並標明哪些先接受、哪些待驗證。把假設攤開，整個分析的根基才透明。' },
    ],
    icebreaker: '先與被訪談者澄清題目本身的邊界——具體在問什麼問題、涵蓋哪些功能或場景、有哪些業務限制不能突破。',
    conclusionSub: '說明問題範圍、時間框架、業務約束，以及你確認或待確認的假設',
    conclusionPlaceholder: '針對這題，整理你澄清的問題範圍、時間框架、業務約束，以及假設確認…',
    conclusionExample: 'Spotify 問題範圍：聚焦免費版廣告體驗，排除付費方案和播客廣告。時間範圍：60 天。業務約束：廣告收入和免費→付費轉換率都不能下降。假設：用戶廣告負感主要來自廣告在情感高潮段落出現，而非廣告本身。',
  },
  I: {
    label: 'I — 定義用戶',
    progressLabel: 'I · 定義用戶 · 2/7',
    fields: [
      { key: '目標用戶分群', placeholder: '說明你如何劃分用戶群…', rows: 2,
        hintOverlay: '用「同一把尺」切 2-4 群（依行為、使用頻率、或場景）。不要混用兩種維度，例如「新手 vs. 老手」和「付費 vs. 免費」要選一個。分群越具體，後面選焦點時越有理由。' },
      { key: '選定焦點對象', placeholder: '選定要服務的焦點群體並說明理由…', rows: 2,
        hintOverlay: '從分群中挑一個焦點。選擇理由不是「人最多」，而是「體量、戰略價值、問題嚴重程度」三者中至少一個強。說清楚為什麼是它，而不是另外幾個——這會決定後面整條分析的方向。' },
      { key: '用戶動機假設', placeholder: '用 JTBD 框架描述用戶的深層動機…', rows: 2,
        hintOverlay: '用 JTBD（Jobs to Be Done）思考焦點用戶「真正在意的事」。表面動機（功能性任務）+ 深層動機（情感／社交層）—用戶為什麼真的會回來？深層越具體，需求分析才會有洞察。' },
      { key: '排除對象', placeholder: '說明哪些用戶群體不在服務範圍及理由…', rows: 2,
        hintOverlay: '明確說哪些用戶這次不討論，以及為什麼——可能是體量太小、需求差太遠、或資源不足以同時覆蓋。排除是邊界意識的展現，你的設計不需要取悅所有人。' },
    ],
    icebreaker: '先與被訪談者確認用戶分群的可能維度——哪些行為模式可以分群？選定的焦點對象有什麼具體特徵？',
    conclusionSub: '用 1-2 句話說明：鎖定的用戶群、JTBD 動機、排除對象',
    conclusionPlaceholder: '針對這題，整理你確認的用戶分群、焦點對象的 JTBD 動機與排除對象…',
    conclusionExample: '聚焦 Spotify 免費版每日活躍用戶，他們使用 App 的 JTBD 是「用音樂管理情緒狀態」，不是隨機發現新音樂。排除付費用戶（已無廣告痛點）和偶爾用戶（資料不足）。',
  },
  R: {
    label: 'R — 發掘需求',
    progressLabel: 'R · 發掘需求 · 3/7',
    fields: [
      { key: '功能性需求', placeholder: '描述用戶要完成的具體任務與功能需求…', rows: 2,
        hintOverlay: '想清楚焦點用戶在具體場景下要「做到什麼」——他要完成什麼任務？目前產品做不到的卡點在哪裡？場景越具體，需求越好分析。避免「更好的體驗」這種空話。' },
      { key: '情感性需求', placeholder: '描述用戶想要或想避免的感受…', rows: 2,
        hintOverlay: '情感需求是「感受層」不是功能。用戶在過程中想感受到什麼（掌控感、安全感、成就感、連結感）？害怕失去什麼？哪一刻會沮喪或焦慮？工具型產品也有情感需求，不要跳過這層。' },
      { key: '社交性需求', placeholder: '描述用戶在人際關係中的需求…', rows: 2,
        hintOverlay: '用戶在社群／關係中想被怎麼看？想透過產品建立什麼樣的人際連結？即便是 B2B 工具也有——例如「讓主管看到我的進度」「與團隊共享成果」。如果真的不適用，要說明原因。' },
      { key: '核心痛點', placeholder: '挑選一個最核心的痛點並說明為什麼優先…', rows: 2,
        hintOverlay: '從三層需求中挑一個最根本的，並說明為什麼是它（嚴重程度、頻率、影響範圍）。這欄要有立場——這個判斷會直接決定後面 C2 的取捨方向，不只是列舉。' },
    ],
    icebreaker: '先與被訪談者深入焦點用戶的真實使用場景——他想完成什麼任務？真實的感受是什麼？這是發掘需求的起點。',
    conclusionSub: '用 1-2 句話說明：三層需求各一句，並說明哪個是核心痛點',
    conclusionPlaceholder: '針對這題，整理三層需求（功能 / 情感 / 社交）以及最核心的痛點…',
    conclusionExample: 'Spotify 免費用戶的功能需求是「快速找到符合當下心情的音樂」；情感需求是「用音樂管理情緒狀態的掌控感」；社交需求是「分享歌單維持社交話題」。核心痛點：情感層的掌控感缺失最嚴重，直接影響留存。',
  },
  C2: {
    label: 'C — 優先排序',
    progressLabel: 'C · 優先排序 · 4/7',
    fields: [
      { key: '取捨標準', placeholder: '建立可操作的取捨判斷框架…', rows: 2,
        hintOverlay: '取捨標準是「排序方案」的可操作框架，不是「什麼比較重要」的口號。最好寫成「以 A 為硬性約束，在此前提下最大化 B」這種可比較形式。沒顯性標準，後面排序就站不住腳。' },
      { key: '最優先項目', placeholder: '說明最優先處理的項目與選擇理由…', rows: 2,
        hintOverlay: '從 R 的需求中挑最該優先做的一個。理由要對應取捨標準——不能只說「最重要」。最優先必須能和暫緩形成明確對比，才看得出取捨邏輯。' },
      { key: '暫緩項目', placeholder: '說明哪些項目暫緩處理及理由…', rows: 2,
        hintOverlay: '暫緩不等於不重要——說清楚「為什麼現在不做」。資源限制？依賴未到？業務時機不對？理由越具體，越能展現你對整個業務系統的理解。' },
      { key: '排序理由', placeholder: '說明整體排序的核心邏輯…', rows: 2,
        hintOverlay: '把前三欄串起來：為什麼最優先的不能暫緩？為什麼暫緩的不能優先？這欄考的是判斷力，不是再列一次清單。最好能回應一個潛在反對意見。' },
    ],
    icebreaker: '先與被訪談者確認這題的業務硬約束——什麼指標不能掉、什麼承諾不能違背。約束邊界先定下來，取捨標準才能立得住。',
    conclusionSub: '說明取捨標準、最優先項目、暫緩項目以及排序理由',
    conclusionPlaceholder: '針對這題，整理你確認的取捨標準、最優先項目與暫緩理由…',
    conclusionExample: 'Spotify 取捨標準：不影響付費轉換率為硬性約束，優先改善廣告後的回聽體驗。最優先：廣告後自動播放相關歌曲（不影響收入且可提升留存）。暫緩：廣告頻率自訂（影響廣告主收入預期）。排序理由：自動播放是正和，頻率控制是零和；正和優先。',
  },
  L: {
    label: 'L — 提出方案',
    progressLabel: 'L · 提出方案 · 5/7',
    fields: [
      { key: '方案一', placeholder: '說明方案一的核心機制…', rows: 2, kind: 'solution', solKey: 'sol1',
        nameKey: 'sol1', namePlaceholder: '方案名稱（10 字內）',
        hintOverlay: '方案一通常最直接打到核心痛點。給它一個有記憶點的短名（不是「方案 A」）+ 核心機制一句話。讓面試官一聽就懂你在提什麼。' },
      { key: '方案二', placeholder: '說明方案二的核心機制（與方案一方向不同）…', rows: 2, kind: 'solution', solKey: 'sol2',
        nameKey: 'sol2', namePlaceholder: '方案名稱（10 字內）',
        hintOverlay: '方案二要和方案一在「方向」上有本質差異——不是更多，而是不同。例如方案一是系統主動，方案二可以是用戶主動；或方案一是短期戰術，方案二是長期重設計。多樣性是評分重點。' },
      { key: '方案三（可選）', placeholder: '說明方案三的核心機制（可選）…', rows: 2, kind: 'solution', solKey: 'sol3', optional: true,
        nameKey: 'sol3', namePlaceholder: '方案名稱（10 字內）',
        hintOverlay: '方案三是加分項。如果有第三個真正不同的思路（更激進、更長線、或從另一個維度切入），能展示思維廣度。湊數寧可不填——說明「前兩個已涵蓋主要可能性」也是有效回答。' },
    ],
    icebreaker: '先與被訪談者確認對方有沒有討論過的方案方向——不是評估哪個最好，而是「考慮過哪幾種做法」，幫你檢查是否有遺漏。',
    conclusionSub: '用 1-2 句話說明：2-3 個方案各一句，並說明各方案核心差異',
    conclusionPlaceholder: '針對這題，整理你提出的 2-3 個解法方向及各自的核心特性…',
    conclusionExample: 'Spotify 免費版廣告體驗：方案一：廣告後自動播放相關歌曲（系統主動，見效快）。方案二：用戶選擇「廣告換無廣告時段」兌換（用戶主動）。差異：系統 vs. 用戶主動兩個維度。',
  },
  E: {
    label: 'E — 評估取捨',
    progressLabel: 'E · 評估取捨 · 6/7',
    kind: 'per-solution',
    showPrevStepCard: true,
    perSolutionFields: [
      { key: '優點', placeholder: '這個方案的核心優勢是什麼？',
        hintOverlay: '優點要具體——不是「用戶喜歡」，而是「直接解決核心痛點 X、且見效快」。最好能說出「相對其他方案在 Y 維度上更強」，比孤立列點有說服力。' },
      { key: '缺點', placeholder: '最大的劣勢或限制？',
        hintOverlay: '誠實列出方案的局限——隱藏缺點只會讓面試官不信任你。每個缺點標清楚影響程度（嚴重／中等／輕微）和觸發條件（什麼情況下會被放大）。' },
      { key: '風險與依賴', placeholder: '實施這個方案需要什麼前提條件？',
        hintOverlay: '列出方案要成功的前提條件——技術依賴、組織依賴、市場條件。若這些不具備，最壞情況是什麼？哪些可以提前緩解？這欄考的是系統思考。' },
      { key: '成功指標', placeholder: '如何衡量這個方案是否成功？',
        hintOverlay: '成功指標要和 R 的核心痛點掛鉤——指標一動，就代表痛點解了。最好同時有領先指標（2-6 週可看）+ 滯後指標（3-6 月才確定的核心目標）+ 量化門檻。' },
    ],
    icebreaker: '先與被訪談者問「這幾個方案最擔心的風險是什麼」——不是問哪個最好，而是問顧慮，幫你檢查風險識別有沒有遺漏關鍵業務約束。',
    conclusionSub: '用 2-3 句話說明：各方案最關鍵的優缺點，以及你認為哪個方向最值得推薦',
    conclusionPlaceholder: '整理各方案的優缺點與風險，說明哪個方案最值得推薦及理由…',
    conclusionExample: 'Spotify 免費版廣告體驗三個方案評估：廣告後推薦（優：系統主動，缺：可能推錯）；時段兌換（優：用戶主動，缺：採用率低）；分層訂閱（優：商業模式清晰，缺：開發週期長）。推薦廣告後推薦，短期可行且用戶無感。',
  },
  S: {
    label: 'S — 總結推薦',
    progressLabel: 'S · 總結推薦 · 7/7',
    showPrevStepCard: true,
    showNsmAnnotation: true,
    fields: [
      { key: '推薦方案', placeholder: '清楚點名一個推薦方案…', rows: 2,
        hintOverlay: 'S 的核心是做決策，不是羅列。「方案一二都可以」會被視為缺乏決斷。直接說「我推薦 X，因為……」——一句話、一個方案、一個最核心的理由。' },
      { key: '選擇理由', placeholder: '引用 E 步驟結論說明選擇理由…', rows: 2,
        hintOverlay: '最強的選擇理由來自前幾步的分析，不是重新發明邏輯。引用 E 步驟的評估結論 + 對照其他方案落選的具體理由 + 回應自己選定方案最大的缺點。展現分析的連貫性。' },
      { key: '北極星指標', placeholder: '定義能反映核心價值的成果指標…', rows: 2,
        hintOverlay: '北極星指標反映「用戶真正獲得核心價值」，不是營收／訂閱（業務結果）也不是 DAU／下載量（活動指標）。好 NSM 能分辨用戶有沒有真的在用——例如「每月完整使用核心功能 ≥ N 次的用戶數」這種行為指標。' },
      { key: '追蹤指標', kind: 'tracking',
        hintOverlay: '4 個維度檢查 NSM 的驅動因素：觸及廣度（多少人看到）、互動深度（看到後是否行動）、習慣頻率（是否持續回來）、留存驅力（什麼讓他們留下）。每個指標盡量加量化門檻。' },
    ],
    icebreaker: '最後階段：把推薦方案、選擇邏輯、北極星與追蹤指標整理成一個完整的決策論述。能用一句話講完，是檢驗清晰度的標準。',
    conclusionSub: '說明選定的推薦方案、北極星指標的精確定義、追蹤指標的優先序',
    conclusionPlaceholder: '整理你的最終推薦結論…',
    conclusionExample: '推薦「連續學習獎勵」方案，在第 7 天連續學習時觸發 Super 試用。NSM 定為每月完成 ≥5 堂課的學習用戶數。追蹤指標優先序：① 試用啟動率（觸及廣度）② 試用期課程完成率（互動深度）③ 試用到期後 30 日訂閱率（留存驅力）。',
  },
};

// Tracking dimensions for S step (NSM dimensions)
var CIRCLES_TRACKING_DIMS = [
  { key: 'reach',     label: '觸及廣度', desc: '有多少用戶真正接觸到推薦方案的核心功能',
    placeholder: '例：情境式升級提示曝光人數 / 月活用戶', dotColor: '#3b82f6', textColor: '#1d4ed8' },
  { key: 'depth',     label: '互動深度', desc: '用戶與核心功能的互動品質',
    placeholder: '例：看到提示後點擊進入試用頁的轉化率', dotColor: '#8b5cf6', textColor: '#6d28d9' },
  { key: 'frequency', label: '習慣頻率', desc: '用戶回訪與重複觸發的頻率',
    placeholder: '例：試用期內每週啟動 Premium 功能的平均天數', dotColor: 'var(--c-success)', textColor: '#065f46' },
  { key: 'impact',    label: '留存驅力', desc: '推動用戶留下來的核心機制',
    placeholder: '例：試用到期後 30 日內完成訂閱的轉換率', dotColor: '#f59e0b', textColor: '#92400e' },
];

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

// Pick up to 5 random items from an array (Fisher-Yates shuffle, returns shallow copy).
function pickRandom5(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return [];
  var copy = arr.slice();
  for (var i = copy.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var tmp = copy[i]; copy[i] = copy[j]; copy[j] = tmp;
  }
  return copy.slice(0, Math.min(5, copy.length));
}

// Phase 2 Spec 2 § 6.1: relative-time formatter for "edited N min ago".
// <5min → 剛剛; <60min → N 分鐘前; else absolute month-day-time.
function formatRelativeEdit(ts) {
  if (!ts) return '—';
  const ms = Date.now() - new Date(ts).getTime();
  if (Number.isNaN(ms)) return '—';
  if (ms < 5 * 60 * 1000)  return '剛剛編輯';
  if (ms < 60 * 60 * 1000) return Math.round(ms / 60000) + ' 分鐘前編輯';
  return new Date(ts).toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
window.formatRelativeEdit = formatRelativeEdit;

function circlesRoute(id) {
  const base = AppState.accessToken ? '/api/circles-sessions' : '/api/guest-circles-sessions';
  return id ? base + '/' + id : base;
}

function getCirclesHeaders() {
  return AppState.accessToken
    ? { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + AppState.accessToken }
    : { 'Content-Type': 'application/json', 'X-Guest-ID': AppState.guestId };
}

// ── Phase 2 Spec 2: triggerCirclesAutoSave ──────────────────────────────────
// Called from Phase 1 textarea / sol-name input listeners. Debounces 1.5s,
// lazy-creates session on first save, then PATCH /progress with all drafts.
// In-flight queue ensures we never lose a change between requests.
function triggerCirclesAutoSave() {
  if (AppState.circlesSavingInFlight) {
    AppState.circlesSavingPending = true;
    return;
  }
  clearTimeout(AppState.circlesSavingDebounce);
  AppState.circlesSavingDebounce = setTimeout(async function () {
    AppState.circlesSavingInFlight = true;
    AppState.circlesSaveStatus = 'saving';
    updateSaveIndicator();
    try {
      // Lazy-create on first save
      if (!AppState.circlesSession || !AppState.circlesSession.id) {
        const q = AppState.circlesSelectedQuestion;
        if (!q || !q.id) throw new Error('no_selected_question');
        const route = AppState.accessToken ? '/api/circles-sessions/draft' : '/api/guest-circles-sessions/draft';
        const r = await fetch(route, {
          method: 'POST',
          headers: getCirclesHeaders(),
          body: JSON.stringify({
            question_id: q.id,
            mode: AppState.circlesMode,
            drill_step: AppState.circlesDrillStep || null,
            sim_step_index: AppState.circlesSimStep || 0,
          }),
        });
        if (!r.ok) throw new Error('draft_create_failed_' + r.status);
        const data = await r.json();
        AppState.circlesSession = { id: data.id, mode: data.mode, drill_step: data.drill_step };
      }
      // PATCH /progress merges into existing row
      const pr = await fetch(circlesRoute(AppState.circlesSession.id) + '/progress', {
        method: 'PATCH',
        headers: getCirclesHeaders(),
        body: JSON.stringify({
          stepDrafts:     AppState.circlesStepDrafts,
          frameworkDraft: AppState.circlesFrameworkDraft,
        }),
      });
      if (!pr.ok) throw new Error('progress_patch_failed_' + pr.status);
      AppState.circlesSaveStatus = 'saved';
      AppState.circlesLastSavedAt = Date.now();
    } catch (e) {
      console.warn('[circles auto-save] failed:', e && e.message);
      AppState.circlesSaveStatus = 'error';
    } finally {
      AppState.circlesSavingInFlight = false;
      updateSaveIndicator();
      if (AppState.circlesSavingPending) {
        AppState.circlesSavingPending = false;
        triggerCirclesAutoSave();
      }
    }
  }, 1500);
}

// Expose for tests/manual retry button.
window.triggerCirclesAutoSave = triggerCirclesAutoSave;

function updateSaveIndicator() {
  const el = document.querySelector('.save-indicator');
  if (!el) return;
  const status = AppState.circlesSaveStatus;
  if (status === 'idle') { el.style.display = 'none'; return; }
  el.style.display = 'inline-flex';
  el.className = 'save-indicator save-' + status;
  let text = '';
  if (status === 'saving') {
    text = '<span class="dot"></span>儲存中…';
  } else if (status === 'saved') {
    const ago = Date.now() - (AppState.circlesLastSavedAt || Date.now());
    if (ago < 5000) {
      text = '<span class="dot"></span>已儲存';
    } else if (ago < 60000) {
      text = '<span class="dot"></span>已儲存 · 剛剛';
    } else {
      text = '<span class="dot"></span>已儲存 · ' + Math.round(ago / 60000) + ' 分鐘前';
    }
  } else if (status === 'error') {
    text = '<span class="dot"></span>儲存失敗，重試';
  }
  el.innerHTML = text;
}

window.updateSaveIndicator = updateSaveIndicator;

// Periodic re-render so "已儲存 · 剛剛 / N 分鐘前" stays current.
setInterval(function () {
  if (AppState.circlesSaveStatus === 'saved') updateSaveIndicator();
}, 30000);

function saveCirclesProgress(patch) {
  var session = AppState.circlesSession;
  if (!session || !session.id) return;
  var headers = AppState.accessToken
    ? { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + AppState.accessToken }
    : { 'Content-Type': 'application/json', 'X-Guest-ID': AppState.guestId };
  fetch(circlesRoute(session.id) + '/progress', {
    method: 'PATCH',
    headers: headers,
    body: JSON.stringify(patch),
  }).catch(function() {}); // fire-and-forget — UI never waits on this
}

async function loadCirclesSession(sessionId) {
  var headers = AppState.accessToken
    ? { 'Authorization': 'Bearer ' + AppState.accessToken }
    : { 'X-Guest-ID': AppState.guestId };
  try {
    var res = await fetch(circlesRoute(sessionId), { headers: headers });
    if (!res.ok) return false;
    var s = await res.json();

    // Restore question from local bank (fast), fallback to stored question_json
    var q = (typeof CIRCLES_QUESTIONS !== 'undefined' ? CIRCLES_QUESTIONS : [])
              .find(function(x) { return x.id === s.question_id; }) || s.question_json;

    AppState.circlesSelectedQuestion  = q;
    AppState.circlesSession           = { id: s.id, mode: s.mode, drill_step: s.drill_step };
    AppState.circlesMode              = s.mode;
    AppState.circlesDrillStep         = s.drill_step || 'C1';
    AppState.circlesPhase             = s.current_phase || 1;
    AppState.circlesSimStep           = s.sim_step_index || 0;
    AppState.circlesFrameworkDraft    = s.framework_draft || {};
    AppState.circlesStepDrafts        = s.step_drafts || {};
    AppState.circlesGateResult        = s.gate_result || null;
    AppState.circlesConversation      = s.conversation || [];
    AppState.circlesStepScores        = s.step_scores || {};
    // If resuming at phase 3 (step score), restore the displayed score from
    // the per-step cache. Otherwise the page is stuck on "評分結果載入中".
    var stepKey = s.mode === 'simulation'
      ? CIRCLES_STEPS[s.sim_step_index || 0].key
      : s.drill_step;
    AppState.circlesScoreResult = (AppState.circlesPhase === 3 && AppState.circlesStepScores[stepKey])
      ? AppState.circlesStepScores[stepKey]
      : null;
    // Defensive: if phase says 3 but we have no cached score, downgrade to phase 2
    // so the user lands on the conclusion box rather than a perpetual loading screen.
    if (AppState.circlesPhase === 3 && !AppState.circlesScoreResult) {
      AppState.circlesPhase = 2;
    }
    AppState.circlesFinalReport       = null;
    return true;
  } catch (e) { return false; }
}

async function fetchCirclesRecentSessions() {
  if (AppState.circlesRecentLoading) return;
  AppState.circlesRecentLoading = true;
  var headers = AppState.accessToken
    ? { 'Authorization': 'Bearer ' + AppState.accessToken }
    : { 'X-Guest-ID': AppState.guestId };
  try {
    var res = await fetch(circlesRoute() + '?status=active&limit=3', { headers: headers });
    if (res.ok) {
      var data = await res.json();
      AppState.circlesRecentSessions = data || [];
    }
  } catch (e) {}
  AppState.circlesRecentLoading = false;
  // SIT-1 #5: mark sessions-fetch-complete so welcome card render gate can pass.
  AppState.circlesSessionsFetched = true;
  // J7: signal CSS that onboarding decision is settled — un-hides .onboarding-welcome
  try { document.body.dataset.onboardingChecked = '1'; } catch (_) {}
  // Don't trigger a full render — that would wipe out any UI state the user has
  // already interacted with (expanded question cards, dropdowns, etc.).
  // Only update the recent-sessions slot in place.
  if (AppState.view === 'circles' && !AppState.circlesSelectedQuestion) {
    updateRecentSessionsSlot();
  }
}

// Update only the recent-sessions slot in the home page, without re-rendering
// the entire view. Preserves any in-progress UI state (accordion expansion etc.).
function updateRecentSessionsSlot() {
  var slot = document.getElementById('circles-recent-slot');
  // SIT-1 #5: keep the welcome card and the resume/recent slot in sync.
  //   - If sessions exist (or the card should otherwise be hidden),
  //     remove .onboarding-welcome (race between first paint + async fetch).
  //   - If no sessions and the card should now be shown but is missing
  //     (was suppressed during initial paint due to SessionsFetched=false),
  //     insert it now so the user sees the onboarding hand-waving card.
  try {
    var welcomeEl = document.getElementById('onboarding-welcome');
    var shouldShow = (typeof shouldShowOnboardingWelcome === 'function') && shouldShowOnboardingWelcome();
    if (!shouldShow && welcomeEl && welcomeEl.parentNode) {
      welcomeEl.parentNode.removeChild(welcomeEl);
    } else if (shouldShow && !welcomeEl && typeof renderOnboardingWelcomeHtml === 'function') {
      var wrap = document.querySelector('[data-view="circles"] .circles-home-wrap');
      if (wrap) wrap.insertAdjacentHTML('afterbegin', renderOnboardingWelcomeHtml());
      if (typeof bindOnboardingWelcome === 'function') bindOnboardingWelcome();
    }
  } catch (_) {}
  if (!slot) return; // home not rendered (defensive)
  if (AppState.circlesRecentSessions.length === 0) {
    slot.innerHTML = '';
    return;
  }
  var PHASE_LABELS = { 1: '填寫框架', 1.5: '等待審核', 2: '對話進行中', 3: '查看評分' };
  var STEP_MAP = {};
  CIRCLES_STEPS.forEach(function(s) { STEP_MAP[s.key] = s.label; });
  var resumeCards = AppState.circlesRecentSessions.map(function(s) {
    var stepLabel = s.mode === 'simulation'
      ? 'Step ' + (s.sim_step_index + 1) + '/7'
      : (STEP_MAP[s.drill_step] || s.drill_step);
    var phaseLabel = PHASE_LABELS[s.current_phase] || 'Phase ' + s.current_phase;
    var company = (s.question_json || {}).company || '—';
    var modeLabel = s.mode === 'drill' ? '步驟加練' : '完整模擬';
    return '<div class="circles-resume-card" data-resume-id="' + s.id + '">' +
      '<div style="display:flex;align-items:center;justify-content:space-between">' +
        '<div>' +
          '<div class="circles-q-card-company">' + escHtml(company) + ' — ' + modeLabel + '</div>' +
          '<div style="font-size:12px;color:var(--c-text-2,#5a5a5a);margin-top:2px;font-family:DM Sans,sans-serif">' + stepLabel + ' · ' + phaseLabel + '</div>' +
        '</div>' +
        '<div style="font-size:12px;font-weight:600;color:var(--c-primary,var(--c-primary));font-family:DM Sans,sans-serif;white-space:nowrap">繼續練習 →</div>' +
      '</div>' +
    '</div>';
  }).join('');
  slot.innerHTML = '<div class="circles-step-select-label">繼續上次練習</div>' + resumeCards;
  // Re-bind click listeners on the new resume cards
  slot.querySelectorAll('.circles-resume-card').forEach(function(el) {
    el.addEventListener('click', async function() {
      var id = el.dataset.resumeId;
      el.style.opacity = '0.6';
      el.style.pointerEvents = 'none';
      var ok = await loadCirclesSession(id);
      if (ok) {
        AppState.circlesRecentSessions = [];
        AppState.view = 'circles';
        document.body.dataset.view = 'circles';
        render();
      } else {
        el.style.opacity = '';
        el.style.pointerEvents = '';
      }
    });
  });
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
  transaction: { label: '交易量型', color: 'var(--c-success)', icon: 'ph-shopping-cart',  desc: '核心價值在於撮合供需、促成高品質交易（電商、共享平台、O2O）' },
  creator:     { label: '創造力型', color: '#f59e0b', icon: 'ph-pencil-simple',  desc: '核心價值在於讓用戶產出高品質成果並被廣泛消費（UGC、知識平台）' },
  saas:        { label: 'SaaS 型',  color: '#3b82f6', icon: 'ph-buildings',      desc: '核心價值在於解決企業工作流程問題、讓團隊不可或缺地依賴產品（B2B）' },
};

const NSM_DIMENSION_CONFIGS = {
  attention: [
    { key: 'reach',     label: '觸及廣度', subtitle: '有多少用戶真正觸碰到核心功能（非僅登入）',  color: '#3b82f6', coachQ: 'AHA 時刻是什麼動作？做到這個動作的人有多少？', placeholder: '例：每月至少播放 1 首歌的月活用戶數（不是登入數）' },
    { key: 'depth',     label: '互動深度', subtitle: '每位用戶每次使用的品質與投入程度',          color: '#8b5cf6', coachQ: '用戶停得夠深嗎？時長、完播率、互動次數哪個更能反映價值？', placeholder: '例：每個 session 平均聆聽時長（分鐘）' },
    { key: 'frequency', label: '習慣頻率', subtitle: '用戶是否形成定期回訪的使用習慣',            color: 'var(--c-success)', coachQ: '每週/每月回來幾次？DAU/MAU 比越高代表黏性越強', placeholder: '例：每週平均使用天數 ≥ 3 的用戶佔比' },
    { key: 'impact',    label: '留存驅力', subtitle: '什麼讓用戶持續回訪而非逐漸流失',            color: '#f59e0b', coachQ: '社交關係？個人化推薦？收藏習慣？找出最強的留存槓桿', placeholder: '例：擁有 ≥5 首收藏歌曲的用戶 30 日留存率' },
  ],
  transaction: [
    { key: 'reach',     label: '供給廣度', subtitle: '供給端（賣家/司機/商家）的活躍參與度',       color: '#3b82f6', coachQ: '沒有供給，需求無法被滿足——有多少活躍供給方存在？', placeholder: '例：過去 7 天完成過交易的活躍商家數' },
    { key: 'depth',     label: '需求深度', subtitle: '需求端用戶的活躍程度與使用品質',             color: '#8b5cf6', coachQ: '需求方有多活躍？每人每月下幾單？平均客單價？', placeholder: '例：每位活躍買家每月平均交易次數' },
    { key: 'frequency', label: '匹配效率', subtitle: '供需成功撮合的漏斗轉化率',                   color: 'var(--c-success)', coachQ: '搜尋→瀏覽→下單的漏斗在哪裡漏最多？轉化率多高？', placeholder: '例：從搜尋到成交的整體轉化率' },
    { key: 'impact',    label: '復購留存', subtitle: '用戶第二次以後繼續回來交易的比例',            color: '#f59e0b', coachQ: '獲取新用戶很貴——他有回來嗎？90 天復購率如何？', placeholder: '例：首單後 90 天內完成第二筆交易的用戶比例' },
  ],
  creator: [
    { key: 'reach',     label: '創造廣度', subtitle: '每月有多少用戶在主動產出內容/成果',          color: '#3b82f6', coachQ: '創造者才是平台核心——每月有多少活躍創作者？', placeholder: '例：每月至少發布 1 篇內容的活躍創作者數' },
    { key: 'depth',     label: '成果品質', subtitle: '創造物的品質、完整度與被消費程度',           color: '#8b5cf6', coachQ: '創造的東西被消費了嗎？閱讀完整度、互動次數？', placeholder: '例：每篇貼文平均獲得有效互動數（留言+收藏+分享）' },
    { key: 'frequency', label: '採用廣度', subtitle: '創造物被消費者發現和深度閱讀的比例',         color: 'var(--c-success)', coachQ: '沒人看的創作平台沒有飛輪——有多少內容被廣泛閱讀？', placeholder: '例：被至少 3 人讀完的內容佔全部已發布內容比例' },
    { key: 'impact',    label: '商業轉化', subtitle: '創造行為轉化為實際商業收益的效率',            color: '#f59e0b', coachQ: '創作者留下來的動力——他們能賺到錢或獲得真實影響力嗎？', placeholder: '例：創作者帳號的付費訂閱轉化率' },
  ],
  saas: [
    { key: 'reach',     label: '啟用廣度', subtitle: '新客戶中有多少真正完成啟用（Activation）',  color: '#3b82f6', coachQ: '注意是 activation，不是 signup——誰真正跑完了核心工作流？', placeholder: '例：完成首次核心任務的新帳號比例' },
    { key: 'depth',     label: '席次深度', subtitle: '每個帳號內有多少人在真正使用核心功能',       color: '#8b5cf6', coachQ: '企業付費，但有幾個人實際在用？席次利用率多高？', placeholder: '例：每個帳號每月平均活躍使用者數（席次利用率）' },
    { key: 'frequency', label: '黏著頻率', subtitle: '使用頻率是否顯示產品已嵌入日常工作流',       color: 'var(--c-success)', coachQ: '每天都用 vs 偶爾用——是剛需工具嗎？DAU/MAU 比多高？', placeholder: '例：每週使用核心功能 ≥ 3 次的帳號佔比' },
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
  return '/api/sessions' + path;
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
  if (!main) return;
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
      } else if (AppState.circlesPhase === 4) {
        main.innerHTML = renderCirclesFinalReport(); bindCirclesFinalReport();
      }
      break;
  }
  syncNavbarTab();
}

async function navigate(view) {
  closeOffcanvas();
  if (view === 'circles' && !AppState.circlesSession) {
    AppState.circlesPhase = 1;
    AppState.circlesSelectedQuestion = null;
    AppState.circlesFrameworkDraft = {};
    AppState.circlesStepDrafts = {};
    AppState.circlesGateResult = null;
    AppState.circlesConversation = [];
    AppState.circlesScoreResult = null;
    AppState.circlesSimStep = 0;
    AppState.circlesRecentSessions = [];
    AppState.circlesRecentLoading = false;
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

// Sync active tab indicator with current AppState.view (Phase 0 Task 0.5).
function syncNavbarTab() {
  const view = AppState.view;
  document.querySelectorAll('.navbar-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.nav === view);
  });
}

// Attach navbar tab click handlers exactly once at boot.
function bindNavbarTabs() {
  document.querySelectorAll('.navbar-tab').forEach(t => {
    t.addEventListener('click', () => {
      document.querySelectorAll('.navbar-tab').forEach(x => x.classList.remove('active'));
      t.classList.add('active');
      navigate(t.dataset.nav);
    });
  });
}

function renderNavbar() {
  const el = document.getElementById('navbar-actions');
  if (!el) return;
  const nsmLink = `<button class="btn btn-ghost" onclick="navigate('nsm')" style="font-size:13px;font-weight:500">北極星指標</button>`;

  if (AppState.mode === 'auth') {
    el.innerHTML = `
      ${nsmLink}
      <span class="navbar-email" title="${AppState.user?.email || ''}">${AppState.user?.email || ''}</span>
      <button class="btn-icon" id="btn-logout" aria-label="登出" title="登出"><i class="ph ph-sign-out"></i></button>
    `;
    document.getElementById('btn-logout')?.addEventListener('click', () => supabase.auth.signOut());
  } else if (AppState.mode === 'guest') {
    el.innerHTML = `
      ${nsmLink}
      <button class="btn btn-ghost" onclick="navigate('login')">登入</button>
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
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      // J10 — confirm before destructive delete (matches history-delete-btn UX)
      if (!confirm('確定刪除這次練習？此操作無法復原。')) return;
      const id = btn.dataset.id;
      const type = btn.dataset.type;

      // Optimistic: remove from cache and UI immediately
      const itemEl = btn.closest('.offcanvas-item');
      const prevCache = AppState.offcanvasCache ? [...AppState.offcanvasCache] : null;
      if (AppState.offcanvasCache) {
        AppState.offcanvasCache = AppState.offcanvasCache.filter(s => s.id !== id);
      }
      itemEl?.remove();
      if (listEl.children.length === 0) {
        listEl.innerHTML = '<div style="padding:16px;color:var(--text-secondary);font-size:14px">尚無練習記錄</div>';
      }

      if (localStorage.getItem('lastSessionId') === id) {
        localStorage.removeItem('lastSessionId');
      }

      // Background DELETE
      try {
        const headers = AppState.accessToken
          ? { 'Authorization': `Bearer ${AppState.accessToken}`, 'Content-Type': 'application/json' }
          : { 'X-Guest-ID': AppState.guestId, 'Content-Type': 'application/json' };
        let deleteUrl;
        if (type === 'nsm') deleteUrl = (AppState.accessToken ? '/api/nsm-sessions/' : '/api/guest/nsm-sessions/') + id;
        else if (type === 'circles') deleteUrl = (AppState.accessToken ? '/api/circles-sessions/' : '/api/guest-circles-sessions/') + id;
        if (!deleteUrl) return;
        const res = await fetch(deleteUrl, { method: 'DELETE', headers });
        if (!res.ok) throw new Error('delete failed');
      } catch (_) {
        // Restore on failure
        if (prevCache) AppState.offcanvasCache = prevCache;
        loadOffcanvasSessions();
      }
    });
  });
}

function renderOffcanvasList(listEl, sessions) {
  listEl.innerHTML = sessions.map(s => {
    const isNSM = s._type === 'nsm';
    const isCircles = s._type === 'circles';
    const label = isNSM
      ? `NSM · ${s.question_json?.company || ''}`
      : isCircles
        ? `CIRCLES · ${s.question_json?.company || ''}`
        : `${s.difficulty || ''}`;
    // Phase 2 Spec 2: prefer updated_at as the "edit recency" timestamp.
    const _ts = s.updated_at || s.created_at;
    // Active CIRCLES session with drafts → relative time; everything else keeps absolute date.
    const hasCirclesDrafts = isCircles && s.status === 'active'
      && s.step_drafts && Object.keys(s.step_drafts).length > 0;
    const date = _ts
      ? (hasCirclesDrafts ? formatRelativeEdit(_ts) : new Date(_ts).toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }))
      : '—';
    let badge, badgeClass;
    if (s.status === 'completed') {
      badge = s.scores_json ? Math.round(s.scores_json.totalScore ?? s.scores_json.total ?? 0) + ' 分' : '完成';
      badgeClass = isCircles ? 'badge-circles' : 'badge-nsm';
    } else if (hasCirclesDrafts) {
      // Phase 2 Spec 2 § 6.1: yellow "進行中" badge for active CIRCLES with drafts.
      badge = '進行中';
      badgeClass = 'badge-warn';
    } else {
      badge = '進行中';
      badgeClass = 'badge-blue';
    }
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
      const id = item.dataset.id;
      const type = item.dataset.type;
      if (type === 'circles') {
        closeOffcanvas();
        // Use cached session data only for active sessions (instant navigation).
        // Completed sessions need full fetch — list select doesn't include
        // final_report / conversation, so we'd land on a perpetual loading screen.
        const cached = AppState.offcanvasCache?.find(s => s.id === id);
        if (cached && cached.status !== 'completed') {
          AppState.circlesSelectedQuestion = cached.question_json;
          AppState.circlesSession = { id: cached.id, mode: cached.mode, drill_step: cached.drill_step };
          AppState.circlesMode = cached.mode || 'simulation';
          AppState.circlesDrillStep = cached.drill_step || 'C1';
          AppState.circlesPhase = cached.current_phase || 1;
          AppState.circlesSimStep = cached.sim_step_index || 0;
          AppState.circlesFrameworkDraft = {};
          AppState.circlesGateResult = null;
          AppState.circlesConversation = [];
          var cachedSteps = cached.circles_step_scores || cached.step_scores || {};
          AppState.circlesStepScores = cachedSteps;
          var cachedKey = (cached.mode === 'simulation')
            ? (CIRCLES_STEPS[cached.sim_step_index || 0] || {}).key
            : cached.drill_step;
          AppState.circlesScoreResult = (AppState.circlesPhase === 3 && cachedKey && cachedSteps[cachedKey])
            ? cachedSteps[cachedKey]
            : null;
          if (AppState.circlesPhase === 3 && !AppState.circlesScoreResult) {
            AppState.circlesPhase = 2;
          }
          AppState.circlesFinalReport = null;
          navigate('circles');
        } else {
          await loadCirclesSession(id);
          navigate('circles');
        }
        return;
      }
      if (type === 'nsm') {
        closeOffcanvas();
        AppState.nsmSession = { id };
        AppState.nsmStep = 4;
        navigate('nsm');
        return;
      }
    });
  });
  attachOffcanvasDeleteListeners(listEl);
}

async function loadOffcanvasSessions() {
  const listEl = document.getElementById('offcanvas-list');
  if (!listEl) return;

  // Show cached data instantly if available (no spinner)
  if (AppState.offcanvasCache && AppState.offcanvasCache.length) {
    renderOffcanvasList(listEl, AppState.offcanvasCache);
  } else {
    listEl.innerHTML = '<div class="offcanvas-skeleton">' +
      ['80%','60%','70%'].map(w =>
        `<div style="height:48px;width:${w};background:var(--bg-surface-2);border-radius:8px;margin-bottom:8px;opacity:0.6;animation:pulse 1.2s ease-in-out infinite"></div>`
      ).join('') +
    '</div>';
  }

  // Background fetch — silently update
  try {
    const headers = AppState.accessToken
      ? { 'Authorization': `Bearer ${AppState.accessToken}` }
      : { 'X-Guest-ID': AppState.guestId };
    const nsmUrl = AppState.accessToken ? '/api/nsm-sessions' : '/api/guest/nsm-sessions';
    const circlesUrl = AppState.accessToken ? '/api/circles-sessions' : '/api/guest-circles-sessions';

    const [nsmRes, circlesRes] = await Promise.all([
      fetch(nsmUrl, { headers }),
      fetch(circlesUrl, { headers })
    ]);
    const nsmSessions = nsmRes.ok ? await nsmRes.json() : [];
    const circlesSessions = circlesRes.ok ? await circlesRes.json() : [];

    const all = [
      ...nsmSessions.map(s => ({ ...s, _type: 'nsm' })),
      ...circlesSessions.map(s => ({ ...s, _type: 'circles' }))
    ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    AppState.offcanvasCache = all;

    // Only re-render if list is still open
    if (!document.getElementById('offcanvas-list')) return;
    if (!all.length) {
      listEl.innerHTML = '<div style="padding:16px;color:var(--text-secondary);font-size:14px">尚無練習記錄</div>';
      return;
    }
    renderOffcanvasList(listEl, all);
  } catch (_) {
    if (!AppState.offcanvasCache) {
      listEl.innerHTML = '<div style="padding:16px;color:var(--text-secondary)">載入失敗</div>';
    }
  }
}

// ── Init ──────────────────────────────────────────
async function init() {
  applyTheme(AppState.theme);

  if (!localStorage.getItem('guestId')) {
    localStorage.setItem('guestId', crypto.randomUUID());
  }
  AppState.guestId = localStorage.getItem('guestId');

  // J11 — honor ?view=<viewName> URL param for direct deep-links
  try {
    var _viewParam = new URLSearchParams(location.search).get('view');
    var _knownViews = ['circles', 'nsm', 'practice', 'report', 'login', 'register', 'home'];
    if (_viewParam && _knownViews.indexOf(_viewParam) >= 0) {
      AppState.view = _viewParam;
    }
  } catch (_) {}

  document.body.dataset.view = AppState.view;

  bindNavbarTabs();

  await initSupabase();

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    AppState.mode = 'guest';

    const lastId = localStorage.getItem('lastSessionId');
    if (lastId && AppState.mode === 'auth') {
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

// ── Rich-text toolbar (Phase 3 Spec 4) ──────────────────────────────
// Class-based opt-in: textareas with `.rt-textarea` get bold/bullet/indent
// keyboard shortcuts + auto-bullet on Enter + IME-safe handlers.
// Toolbar (.rt-toolbar) is rendered inline above each textarea by buildRtField.
// On mobile (<1024px), inline toolbar is hidden via CSS; a single shared
// sticky-bottom toolbar (#rt-toolbar-mobile) follows focused textarea.
(function rtInit() {
  let _activeRt = null;

  function getActive() {
    if (_activeRt && document.contains(_activeRt)) return _activeRt;
    if (document.activeElement && document.activeElement.classList?.contains('rt-textarea')) {
      return document.activeElement;
    }
    return null;
  }

  function fire(ta) { ta.dispatchEvent(new Event('input', { bubbles: true })); }

  function applyBold(ta) {
    const s = ta.selectionStart, e = ta.selectionEnd;
    const text = ta.value;
    const selected = text.slice(s, e);
    if (s === e) {
      ta.value = text.slice(0, s) + '****' + text.slice(e);
      ta.selectionStart = ta.selectionEnd = s + 2;
    } else if (selected.startsWith('**') && selected.endsWith('**') && selected.length >= 4) {
      ta.value = text.slice(0, s) + selected.slice(2, -2) + text.slice(e);
      ta.selectionStart = s; ta.selectionEnd = e - 4;
    } else {
      ta.value = text.slice(0, s) + '**' + selected + '**' + text.slice(e);
      ta.selectionStart = s + 2; ta.selectionEnd = e + 2;
    }
    fire(ta);
  }

  function applyBullet(ta) {
    const s = ta.selectionStart;
    const text = ta.value;
    const lineStart = text.lastIndexOf('\n', s - 1) + 1;
    let lineEnd = text.indexOf('\n', s); if (lineEnd < 0) lineEnd = text.length;
    const line = text.slice(lineStart, lineEnd);
    let newLine;
    const m = line.match(/^( {0,2})- (.*)$/);
    if (m) {
      newLine = m[1] + m[2];
    } else {
      newLine = '- ' + line;
    }
    ta.value = text.slice(0, lineStart) + newLine + text.slice(lineEnd);
    const diff = newLine.length - line.length;
    ta.selectionStart = ta.selectionEnd = Math.max(lineStart, s + diff);
    fire(ta);
  }

  function applyIndentDelta(ta, delta) {
    const s = ta.selectionStart;
    const text = ta.value;
    const lineStart = text.lastIndexOf('\n', s - 1) + 1;
    let lineEnd = text.indexOf('\n', s); if (lineEnd < 0) lineEnd = text.length;
    const line = text.slice(lineStart, lineEnd);
    const m = line.match(/^( *)- /);
    if (!m) return;
    const currentIndent = m[1].length;
    let newIndent;
    if (delta > 0) newIndent = Math.min(currentIndent + 2, 4);
    else newIndent = Math.max(currentIndent - 2, 0);
    if (newIndent === currentIndent) return;
    const newLine = ' '.repeat(newIndent) + line.replace(/^ */, '');
    ta.value = text.slice(0, lineStart) + newLine + text.slice(lineEnd);
    ta.selectionStart = ta.selectionEnd = s + (newIndent - currentIndent);
    fire(ta);
  }

  function applyIndent(ta) { applyIndentDelta(ta, +2); }
  function applyOutdent(ta) { applyIndentDelta(ta, -2); }

  // ── Active state: B button highlighted when caret inside **...** ──
  function isPositionInsideBold(text, pos) {
    // scan ** runs in order; toggle a flag
    const re = /\*\*/g;
    let m, runs = [];
    while ((m = re.exec(text)) !== null) runs.push(m.index);
    // pair them up
    for (let i = 0; i + 1 < runs.length; i += 2) {
      const open = runs[i] + 2;
      const close = runs[i + 1];
      if (pos >= open && pos <= close) return true;
    }
    return false;
  }

  function updateToolbarState() {
    const ta = getActive();
    document.querySelectorAll('.rt-tbtn[data-rt-action="bold"], .rt-mtbtn[data-rt-action="bold"]').forEach(btn => {
      btn.classList.remove('active');
    });
    if (!ta) return;
    const inBold = isPositionInsideBold(ta.value, ta.selectionStart);
    if (!inBold) return;
    // Activate the toolbar button(s) corresponding to active textarea's container
    const field = ta.closest('.rt-field');
    if (field) {
      const b = field.querySelector('.rt-tbtn[data-rt-action="bold"]');
      if (b) b.classList.add('active');
    }
    if (window.innerWidth < 1024) {
      const mb = document.querySelector('#rt-toolbar-mobile .rt-mtbtn[data-rt-action="bold"]');
      if (mb) mb.classList.add('active');
    }
  }

  // ── keydown: shortcuts + IME guard + auto-bullet on Enter ──
  function handleKeydown(e) {
    const ta = e.currentTarget;
    if (ta._rtComposing) return;  // IME suppression
    // Browsers usually set isComposing on the event during composition
    if (e.isComposing) return;

    // Ctrl/Cmd+B
    if ((e.ctrlKey || e.metaKey) && (e.key === 'b' || e.key === 'B')) {
      e.preventDefault();
      applyBold(ta);
      return;
    }
    // Ctrl/Cmd+L
    if ((e.ctrlKey || e.metaKey) && (e.key === 'l' || e.key === 'L')) {
      e.preventDefault();
      applyBullet(ta);
      return;
    }
    // Tab / Shift+Tab on bullet lines
    if (e.key === 'Tab') {
      const s = ta.selectionStart;
      const text = ta.value;
      const lineStart = text.lastIndexOf('\n', s - 1) + 1;
      let lineEnd = text.indexOf('\n', s); if (lineEnd < 0) lineEnd = text.length;
      const line = text.slice(lineStart, lineEnd);
      if (!/^ *- /.test(line)) return;
      e.preventDefault();
      applyIndentDelta(ta, e.shiftKey ? -2 : +2);
      return;
    }
    // Enter — auto-bullet continuation / empty exit
    if (e.key === 'Enter' && !e.shiftKey) {
      const s = ta.selectionStart;
      const text = ta.value;
      const lineStart = text.lastIndexOf('\n', s - 1) + 1;
      const linePrefix = text.slice(lineStart, s);
      const m = linePrefix.match(/^( *)- /);
      if (!m) return;
      // empty bullet ("- " or "  - ") — remove the bullet, keep caret at line start
      if (linePrefix.replace(/ /g, '') === '-') {
        e.preventDefault();
        ta.value = text.slice(0, lineStart) + text.slice(s);
        ta.selectionStart = ta.selectionEnd = lineStart;
        fire(ta);
        return;
      }
      e.preventDefault();
      const insert = '\n' + m[1] + '- ';
      ta.value = text.slice(0, s) + insert + text.slice(s);
      ta.selectionStart = ta.selectionEnd = s + insert.length;
      fire(ta);
    }
  }

  function initRichTextarea(ta) {
    if (ta._rtInited) return;
    ta._rtInited = true;
    ta.addEventListener('compositionstart', () => { ta._rtComposing = true; });
    ta.addEventListener('compositionend', () => { ta._rtComposing = false; });
    ta.addEventListener('keydown', handleKeydown);
    ta.addEventListener('input', updateToolbarState);
    ta.addEventListener('keyup', updateToolbarState);
    ta.addEventListener('click', updateToolbarState);
    ta.addEventListener('focus', () => { _activeRt = ta; updateToolbarState(); });
  }

  // Toolbar click delegation (covers both inline desktop + mobile sticky)
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-rt-action]');
    if (!btn) return;
    const action = btn.dataset.rtAction;
    let ta = null;
    if (btn.classList.contains('rt-tbtn')) {
      const field = btn.closest('.rt-field');
      if (field) ta = field.querySelector('textarea.rt-textarea');
    } else if (btn.classList.contains('rt-mtbtn')) {
      ta = getActive();
    }
    if (!ta) return;
    e.preventDefault();
    // Prevent blur stealing focus from textarea on mobile button mousedown
    ta.focus();
    if (action === 'bold') applyBold(ta);
    else if (action === 'bullet') applyBullet(ta);
    else if (action === 'indent') applyIndent(ta);
    else if (action === 'outdent') applyOutdent(ta);
    updateToolbarState();
  });

  // Prevent mobile toolbar mousedown from stealing focus
  document.addEventListener('mousedown', (e) => {
    if (e.target.closest('#rt-toolbar-mobile')) {
      e.preventDefault();
    }
  });

  // ── Mobile sticky toolbar focus/blur + visualViewport ──
  function attachMobile() {
    const mobileToolbar = document.getElementById('rt-toolbar-mobile');
    if (!mobileToolbar) return;
    document.addEventListener('focusin', (e) => {
      if (!e.target?.classList?.contains?.('rt-textarea')) return;
      _activeRt = e.target;
      initRichTextarea(e.target);
      if (window.innerWidth >= 1024) return;
      mobileToolbar.style.display = 'flex';
    });
    document.addEventListener('focusout', (e) => {
      if (!e.target?.classList?.contains?.('rt-textarea')) return;
      setTimeout(() => {
        if (document.activeElement === e.target) return;
        if (mobileToolbar.contains(document.activeElement)) return;
        mobileToolbar.style.display = 'none';
        _activeRt = null;
      }, 200);
    });
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', () => {
        if (mobileToolbar.style.display === 'flex') {
          const offset = Math.max(0, window.innerHeight - window.visualViewport.height);
          mobileToolbar.style.bottom = offset + 'px';
        }
      });
    }
    window.__rtMobileBound = true;
  }

  function bindAllRichTextareas() {
    document.querySelectorAll('textarea.rt-textarea').forEach(initRichTextarea);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { attachMobile(); bindAllRichTextareas(); });
  } else {
    attachMobile();
    bindAllRichTextareas();
  }

  // Re-bind after every render() call (handles dynamic CIRCLES/NSM rerenders)
  const origRender = window.render;
  // render is reassigned later via `window.render = render` — use MutationObserver
  // on #main as a robust hook so newly-rendered textareas are bound.
  const main = document.getElementById('main');
  if (main) {
    const mo = new MutationObserver(() => bindAllRichTextareas());
    mo.observe(main, { childList: true, subtree: true });
  }

  // Expose for buildRtField / external callers
  window.buildRtField = function buildRtField(opts) {
    opts = opts || {};
    const key = opts.key != null ? opts.key : '';
    const rows = opts.rows || 2;
    const placeholder = opts.placeholder || '';
    const value = opts.value || '';
    const extraClass = opts.extraClass || '';
    const dataAttrs = opts.dataAttrs || '';
    const esc = (s) => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    return (
      '<div class="rt-field">' +
        '<div class="rt-toolbar">' +
          '<button type="button" class="rt-tbtn" data-rt-action="bold" title="粗體 (Ctrl+B)" aria-label="粗體"><strong>B</strong></button>' +
          '<button type="button" class="rt-tbtn" data-rt-action="bullet" title="列點 (Ctrl+L)" aria-label="列點"><i class="ph ph-list-bullets"></i></button>' +
          '<button type="button" class="rt-tbtn" data-rt-action="indent" title="縮排 (Tab)" aria-label="增加縮排"><i class="ph ph-text-indent"></i></button>' +
          '<button type="button" class="rt-tbtn" data-rt-action="outdent" title="退縮 (Shift+Tab)" aria-label="減少縮排"><i class="ph ph-text-outdent"></i></button>' +
        '</div>' +
        '<textarea class="rt-textarea ' + extraClass + '" data-field="' + esc(key) + '" rows="' + rows + '" placeholder="' + esc(placeholder) + '" ' + dataAttrs + '>' + esc(value) + '</textarea>' +
      '</div>'
    );
  };

  // Expose helpers for tests
  window.__rtActions = { applyBold, applyBullet, applyIndent, applyOutdent, isPositionInsideBold };
})();

// 暴露至全域，讓 HTML inline onclick 可使用
window.navigate = navigate;
window.render = render;
window.applyTheme = applyTheme;
window.AppState = AppState;
window.submitDefinition = submitDefinition;
window.openOffcanvas = openOffcanvas;
window.closeOffcanvas = closeOffcanvas;
window.showHintCard = showHintCard;

// ── CIRCLES helper functions ──────────────────────
// pickRandom5 is defined once near top of file and reused here.

function toggleInfoCard(btn) {
  var body = document.getElementById('info-card-body');
  var icon = document.getElementById('info-card-icon');
  if (!body) return;
  var open = body.style.display !== 'none';
  body.style.display = open ? 'none' : 'block';
  if (icon) icon.className = open ? 'ph ph-caret-right' : 'ph ph-caret-down';
}
window.toggleInfoCard = toggleInfoCard;

// ── View stubs（後續 Task 填入）────────────────────
// CIRCLES stubs — replaced by Tasks 14-18
function renderQCardHtml(q) {
  var shortStmt = q.problem_statement.length > 60
    ? q.problem_statement.slice(0, 60) + '…'
    : q.problem_statement;
  var drillPracticeHtml = (AppState.circlesMode === 'drill')
    ? '<div style="font-size:11px;color:var(--c-primary);font-weight:600;margin-top:6px;font-family:DM Sans,sans-serif">練習步驟：' + (AppState.circlesDrillStep || 'C1') + '</div>'
    : '';
  return '<div class="circles-q-card" data-qid="' + q.id + '">' +
    '<div class="circles-q-card-company">' + escHtml(q.company) + (q.product ? ' — ' + escHtml(q.product) : '') + '</div>' +
    '<div class="circles-q-card-stmt" data-full="' + escHtml(q.problem_statement) + '" data-short="' + escHtml(shortStmt) + '">' + escHtml(shortStmt) + '</div>' +
    '<div class="circles-q-card-more-wrap">' +
      (q.problem_statement.length > 60 ? '<span class="circles-q-card-more">看更多 ▾</span>' : '') +
    '</div>' +
    '<div class="circles-q-card-expand-area" style="display:none">' +
      '<div class="circles-q-card-expanded">' + escHtml(q.problem_statement) + '</div>' +
      drillPracticeHtml +
      '<div style="display:flex;align-items:center;gap:8px;margin-top:10px">' +
        '<button class="circles-q-confirm-btn">確認，開始練習</button>' +
        '<button class="circles-q-cancel-btn">取消</button>' +
      '</div>' +
    '</div>' +
  '</div>';
}

function expandQCard(card) {
  var stmt = card.querySelector('.circles-q-card-stmt');
  if (stmt) stmt.textContent = stmt.dataset.full;
  var moreWrap = card.querySelector('.circles-q-card-more-wrap');
  if (moreWrap) moreWrap.style.display = 'none';
  var expandArea = card.querySelector('.circles-q-card-expand-area');
  if (expandArea) expandArea.style.display = 'block';
  card.style.borderColor = 'var(--c-primary)';
}

function collapseQCard(card) {
  var stmt = card.querySelector('.circles-q-card-stmt');
  if (stmt) stmt.textContent = stmt.dataset.short;
  var moreWrap = card.querySelector('.circles-q-card-more-wrap');
  if (moreWrap) moreWrap.style.display = 'block';
  var expandArea = card.querySelector('.circles-q-card-expand-area');
  if (expandArea) expandArea.style.display = 'none';
  card.style.borderColor = '';
}

// Phase 2 Spec 2 § 6.2: fetch most-recent active CIRCLES draft for the home
// resume banner. Populates AppState.circlesActiveDraft (null if none).
async function fetchActiveDraft() {
  try {
    const headers = AppState.accessToken
      ? { 'Authorization': 'Bearer ' + AppState.accessToken }
      : { 'X-Guest-ID': AppState.guestId };
    const route = (AppState.accessToken ? '/api/circles-sessions' : '/api/guest-circles-sessions') + '?status=active&limit=5';
    const r = await fetch(route, { headers });
    if (!r.ok) { AppState.circlesActiveDraft = null; return; }
    const list = await r.json();
    // Most recent active session that actually has draft content (skip empties).
    const found = (list || []).find(function (s) {
      return s.step_drafts && Object.keys(s.step_drafts).length > 0;
    }) || null;
    AppState.circlesActiveDraft = found;
  } catch (_e) {
    AppState.circlesActiveDraft = null;
  }
}
window.fetchActiveDraft = fetchActiveDraft;

function renderResumeBanner() {
  const d = AppState.circlesActiveDraft;
  if (!d) return '';
  if (localStorage.getItem('dismiss-resume-' + d.id)) return '';
  const q = d.question_json || {};
  const company = q.company || '練習';
  const product = q.product || q.problem_statement || '';
  return '<div class="resume-banner" data-resume-id="' + escHtml(d.id) + '">' +
    '<span><strong>未完成練習</strong> · ' + escHtml(company) + (product ? ' · ' + escHtml(product) : '') + ' · ' + escHtml(formatRelativeEdit(d.updated_at)) + '</span>' +
    '<span><a class="resume-go" data-id="' + escHtml(d.id) + '">繼續 →</a><i class="ph ph-x dismiss" data-id="' + escHtml(d.id) + '" role="button" aria-label="關閉"></i></span>' +
  '</div>';
}
window.renderResumeBanner = renderResumeBanner;

function bindResumeBanner() {
  document.querySelectorAll('.resume-banner .resume-go').forEach(function (el) {
    el.addEventListener('click', async function () {
      const id = el.dataset.id;
      if (!id) return;
      await loadCirclesSession(id);
      navigate('circles');
    });
  });
  document.querySelectorAll('.resume-banner .dismiss').forEach(function (el) {
    el.addEventListener('click', function (ev) {
      ev.stopPropagation();
      const id = el.dataset.id;
      if (id) localStorage.setItem('dismiss-resume-' + id, '1');
      const banner = el.closest('.resume-banner');
      if (banner) banner.remove();
    });
  });
}
window.bindResumeBanner = bindResumeBanner;

// ── Onboarding welcome card (Phase 5 Task 5.1) ───────────────────────
// Spec: docs/superpowers/specs/2026-04-28-desktop-rwd-direction-c-design.md §4.1
//
// Trigger conditions for welcome card (State 1):
//   - localStorage 'circles_onboarding_done' !== '1'
//   - AND AppState.circlesRecentSessions.length === 0
//   - AND no `?onboarding=0` query
// Dev hook: `?onboarding=1` query forces display even with flag set.
function getOnboardingQuery() {
  try { return new URLSearchParams(window.location.search).get('onboarding'); }
  catch (e) { return null; }
}

function shouldShowOnboardingWelcome() {
  var q = getOnboardingQuery();
  if (q === '1') return true;             // dev force-show
  if (q === '0') return false;            // dev force-hide
  try {
    if (localStorage.getItem('circles_onboarding_done') === '1') return false;
  } catch (e) {}
  if (AppState.circlesRecentSessions && AppState.circlesRecentSessions.length > 0) return false;
  // SIT-1 #5 (flash polish): gate first render until first sessions fetch
  // resolves. If we have an active draft already, skip the welcome card.
  if (AppState.circlesActiveDraft) return false;
  if (!AppState.circlesSessionsFetched) return false;
  return true;
}

function renderOnboardingWelcomeHtml() {
  return '<div class="onboarding-welcome" id="onboarding-welcome">' +
    '<div class="onboarding-welcome-icon"><i class="ph ph-hand-waving"></i></div>' +
    '<h2>歡迎來到 PM Drill</h2>' +
    '<p>CIRCLES 是 PM 面試常用的七步框架。第一次使用？建議跟著引導跑一輪，5 分鐘內了解整個流程。</p>' +
    '<div class="onboarding-welcome-actions">' +
      '<button class="btn-primary" id="onb-start">開始引導 →</button>' +
      '<button class="btn-ghost" id="onb-skip">直接自己選題</button>' +
    '</div>' +
  '</div>';
}

function markOnboardingDone() {
  try { localStorage.setItem('circles_onboarding_done', '1'); } catch (e) {}
  var card = document.getElementById('onboarding-welcome');
  if (card && card.parentNode) card.parentNode.removeChild(card);
}

// ── Coachmark tour engine (Phase 5 Task 5.2) ─────────────────────────
// Spec: docs/superpowers/specs/2026-04-28-desktop-rwd-direction-c-design.md §4.2-4.4
//
// Targets per spec §4.3 are `.mode-section / .type-section / .q-list /
// .q-row.expanded .btn-primary` — selectors introduced by Phase 4.1's
// desktop CIRCLES-home renderer. After the Phase 4.1 desktop layout merge,
// each step's selector matches BOTH the legacy mobile renderer (.circles-*)
// AND the desktop renderer (.mode-section/.type-section) via comma list.
// Steps 3-4 selectors already work on both layouts (verified by SIT-4).
var ONBOARDING_TARGETS = [
  '.circles-mode-row, .mode-section',           // step 1: 練習模式
  '.circles-type-tabs, .type-section',          // step 2: 題型
  '.circles-q-list',                            // step 3: 題目列表
  '.circles-q-card.onb-expanded .circles-q-confirm-btn', // step 4: 展開卡內主按鈕
];

var ONBOARDING_STEPS = [
  { title: '選擇練習模式', desc: '建議首次選「完整模擬」走完整流程，熟悉後再用「步驟加練」針對弱點刻意練習。', arrow: 'left',  pos: 'right'  },
  { title: '選擇題型',     desc: '三種題型對應不同 PM 能力。新手建議從「產品設計」開始，題目較具體、容易上手。',         arrow: 'left',  pos: 'right'  },
  { title: '挑一道題目',   desc: '每題標難度（Easy / Medium / Hard）。新手建議先挑 Easy。點題目會展開完整描述與「開始練習」。', arrow: 'top',   pos: 'bottom' },
  { title: '開始練習',     desc: '點此進入 Phase 1 — 填寫框架。每個欄位都有「提示」與「查看範例」幫你思考。完成後會自動進入訪談階段。', arrow: 'left',  pos: 'right'  },
];
// Mobile-only override for step 4 (spec §4.5): on mobile the q-row
// "expanded" state is a route change rather than an inline accordion, so
// instead of pointing at .btn-primary, highlight the last q-card in the
// list and explain "點任一題會展開".
var ONBOARDING_STEPS_MOBILE_STEP4 = {
  target: '.circles-q-list .circles-q-card:last-child',
  title: '挑一道題目', desc: '點任一題會展開完整描述。展開後可看到難度、產品背景與「確認，開始練習」按鈕。',
  arrow: 'top', pos: 'top',
};

function startOnboardingTour() {
  // Hide welcome card immediately (we mark localStorage done at tour end).
  var card = document.getElementById('onboarding-welcome');
  if (card && card.parentNode) card.parentNode.removeChild(card);

  AppState.onboardingStep = 1;

  // Inject overlay + spotlight + tooltip per spec §4.2.
  var overlay   = document.createElement('div'); overlay.className   = 'onboarding-overlay';   overlay.id   = 'onb-overlay';
  var spotlight = document.createElement('div'); spotlight.className = 'onboarding-spotlight'; spotlight.id = 'onb-spotlight';
  var tooltip   = document.createElement('div'); tooltip.className   = 'onboarding-tooltip';   tooltip.id   = 'onb-tooltip';
  document.body.appendChild(overlay);
  document.body.appendChild(spotlight);
  document.body.appendChild(tooltip);

  // Resize listener — reposition while a tour step is active (spec §4.4).
  if (!AppState._onboardingResizeBound) {
    window.addEventListener('resize', function() {
      if (AppState.onboardingStep) showCoachmark(AppState.onboardingStep);
    });
    AppState._onboardingResizeBound = true;
  }

  showCoachmark(1);
}

function endOnboardingTour() {
  AppState.onboardingStep = null;
  ['onb-overlay','onb-spotlight','onb-tooltip'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el && el.parentNode) el.parentNode.removeChild(el);
  });
  // Collapse any q-row we auto-expanded for step 4.
  var auto = document.querySelector('.circles-q-card.onb-expanded');
  if (auto) {
    auto.classList.remove('onb-expanded');
    if (typeof collapseQCard === 'function') {
      try { collapseQCard(auto); } catch (e) {}
    }
  }
  markOnboardingDone();
}

function showCoachmark(step) {
  var isMobile = window.innerWidth <= 1023;
  var cfg = ONBOARDING_STEPS[step - 1];
  var targetSel = ONBOARDING_TARGETS[step - 1];

  // Step 4 special handling
  if (step === 4) {
    if (isMobile) {
      // Mobile: q-row expansion is a route change (spec §4.5). Highlight
      // the last item of the list and explain "點任一題會展開" instead.
      cfg = Object.assign({}, ONBOARDING_STEPS_MOBILE_STEP4);
      targetSel = ONBOARDING_STEPS_MOBILE_STEP4.target;
    } else {
      // Desktop: target is the expanded q-row's primary button. Auto-expand
      // the first q-card if no row is currently open so the button exists.
      var alreadyExpanded = document.querySelector('.circles-q-card.onb-expanded');
      if (!alreadyExpanded) {
        var firstCard = document.querySelector('.circles-q-list .circles-q-card');
        if (firstCard && typeof expandQCard === 'function') {
          expandQCard(firstCard);
          firstCard.classList.add('onb-expanded');
        }
      }
    }
  }

  var el = document.querySelector(targetSel);
  var spotlight = document.getElementById('onb-spotlight');
  var tooltip   = document.getElementById('onb-tooltip');
  if (!spotlight || !tooltip) return;

  if (!el) {
    // Selector missing — render tooltip without spotlight (fail-soft).
    spotlight.style.display = 'none';
  } else {
    spotlight.style.display = '';
    var rect = el.getBoundingClientRect();
    spotlight.style.left   = (rect.left - 4) + 'px';
    spotlight.style.top    = (rect.top  - 4) + 'px';
    spotlight.style.width  = (rect.width  + 8) + 'px';
    spotlight.style.height = (rect.height + 8) + 'px';
  }

  // Tooltip body
  var totalSteps = ONBOARDING_STEPS.length;
  tooltip.setAttribute('data-arrow', cfg.arrow);
  tooltip.innerHTML =
    '<div class="onb-step">第 ' + step + ' 步 / 共 ' + totalSteps + '</div>' +
    '<h4>' + cfg.title + '</h4>' +
    '<p>' + cfg.desc + '</p>' +
    '<div class="onb-actions">' +
      '<span class="onb-skip" id="onb-skip-tour">略過引導</span>' +
      '<button class="onb-next" id="onb-next">' + (step === totalSteps ? '完成' : '下一步 →') + '</button>' +
    '</div>' +
    '<div class="onb-arrow"></div>';

  // Position tooltip. On desktop we pin it to the target side; on mobile
  // (≤1023px, spec §4.5) the CSS pins it sticky-bottom and we clear inline
  // coords so the @media rule wins.
  if (!isMobile && el) {
    var TOOLTIP_W = 300;
    var GAP = 16;
    // Force layout to read tooltip height, then position by `pos`.
    tooltip.style.left = '0px'; tooltip.style.top = '0px';
    var th = tooltip.offsetHeight || 140;
    var rect2 = el.getBoundingClientRect();
    var x, y;
    if (cfg.pos === 'right') {
      x = rect2.right + GAP;
      y = rect2.top + Math.max(0, (rect2.height - th) / 2);
    } else if (cfg.pos === 'bottom') {
      x = rect2.left + Math.max(0, (rect2.width - TOOLTIP_W) / 2);
      y = rect2.bottom + GAP;
    } else if (cfg.pos === 'top') {
      x = rect2.left + Math.max(0, (rect2.width - TOOLTIP_W) / 2);
      y = rect2.top - th - GAP;
    } else { // left
      x = rect2.left - TOOLTIP_W - GAP;
      y = rect2.top + Math.max(0, (rect2.height - th) / 2);
    }
    // Clamp into viewport
    x = Math.max(8, Math.min(x, window.innerWidth - TOOLTIP_W - 8));
    y = Math.max(8, Math.min(y, window.innerHeight - th - 8));
    tooltip.style.left = x + 'px';
    tooltip.style.top  = y + 'px';
  } else {
    // Mobile: clear inline coords so the @media (max-width: 1023px) rule
    // (left/right/bottom: 16px, top: auto) takes effect.
    tooltip.style.left = '';
    tooltip.style.top  = '';
  }

  // Wire buttons
  var nextBtn = document.getElementById('onb-next');
  var skipBtn = document.getElementById('onb-skip-tour');
  if (nextBtn) nextBtn.onclick = function() {
    if (step >= totalSteps) {
      endOnboardingTour();
    } else {
      AppState.onboardingStep = step + 1;
      showCoachmark(step + 1);
    }
  };
  if (skipBtn) skipBtn.onclick = function() { endOnboardingTour(); };
}

function bindOnboardingWelcome() {
  var startBtn = document.getElementById('onb-start');
  var skipBtn  = document.getElementById('onb-skip');
  if (startBtn) startBtn.addEventListener('click', function() { startOnboardingTour(); });
  if (skipBtn)  skipBtn.addEventListener('click',  function() { markOnboardingDone(); });
}

function renderCirclesHome() {
  if (typeof isDesktop === 'function' && isDesktop()) return renderCirclesHomeDesktop();
  return renderCirclesHomeMobile();
}

function renderCirclesHomeMobile() {
  var mode = AppState.circlesMode;
  var type = AppState.circlesSelectedType;
  var drillStep = AppState.circlesDrillStep;
  var allQs = (typeof CIRCLES_QUESTIONS !== 'undefined' ? CIRCLES_QUESTIONS : []);
  var filteredQs = allQs.filter(function(q) { return q.question_type === type; });

  // Pick 5 random questions if not yet picked (or if re-entry)
  if (!AppState.circlesDisplayedQuestions || AppState.circlesDisplayedQuestions.length === 0 ||
      (AppState.circlesDisplayedQuestions[0] && AppState.circlesDisplayedQuestions[0].question_type !== type)) {
    AppState.circlesDisplayedQuestions = pickRandom5(filteredQs);
  }

  var displayedQs = AppState.circlesDisplayedQuestions;
  var designCount = allQs.filter(function(q) { return q.question_type === 'design'; }).length;
  var improveCount = allQs.filter(function(q) { return q.question_type === 'improve'; }).length;
  var strategyCount = allQs.filter(function(q) { return q.question_type === 'strategy'; }).length;

  // Drill step pills — only C1, I, R
  var drillSteps = [
    { key: 'C1', label: 'C 澄清情境', tip: '確認題目邊界與假設，練習用精準問題縮小解題範圍。' },
    { key: 'I',  label: 'I 定義用戶', tip: '識別核心用戶群，練習描述用戶特徵、使用情境與動機。' },
    { key: 'R',  label: 'R 發掘需求', tip: '挖掘用戶真正的痛點，練習區分表面訴求與根本需求。' },
  ];
  var drillPillsHtml = mode === 'drill'
    ? '<div class="circles-step-select-label">練習步驟</div>' +
      '<div class="circles-step-pills" id="circles-drill-pills">' +
        drillSteps.map(function(s) {
          return '<button class="circles-step-pill ' + (drillStep === s.key ? 'active' : '') + '" data-step="' + s.key + '" data-tip="' + escHtml(s.tip) + '">' + s.label + '</button>';
        }).join('') +
      '</div>' +
      '<div class="circles-drill-sim-note"><i class="ph ph-lock-simple"></i> C2、L、E、S 需在完整模擬中練習</div>'
    : '';

  // Recent sessions
  var recentHtml = '';
  if (AppState.circlesRecentSessions.length > 0) {
    var PHASE_LABELS = { 1: '填寫框架', 1.5: '等待審核', 2: '對話進行中', 3: '查看評分' };
    var STEP_MAP = {};
    CIRCLES_STEPS.forEach(function(s) { STEP_MAP[s.key] = s.label; });
    var resumeCards = AppState.circlesRecentSessions.map(function(s) {
      var stepLabel = s.mode === 'simulation'
        ? 'Step ' + (s.sim_step_index + 1) + '/7'
        : (STEP_MAP[s.drill_step] || s.drill_step);
      var phaseLabel = PHASE_LABELS[s.current_phase] || 'Phase ' + s.current_phase;
      var company = (s.question_json || {}).company || '—';
      var modeLabel = s.mode === 'drill' ? '步驟加練' : '完整模擬';
      return '<div class="circles-resume-card" data-resume-id="' + s.id + '">' +
        '<div style="display:flex;align-items:center;justify-content:space-between">' +
          '<div>' +
            '<div class="circles-q-card-company">' + escHtml(company) + ' — ' + modeLabel + '</div>' +
            '<div style="font-size:12px;color:var(--c-text-2,#5a5a5a);margin-top:2px;font-family:DM Sans,sans-serif">' + stepLabel + ' · ' + phaseLabel + '</div>' +
          '</div>' +
          '<div style="font-size:12px;font-weight:600;color:var(--c-primary,var(--c-primary));font-family:DM Sans,sans-serif;white-space:nowrap">繼續練習 →</div>' +
        '</div>' +
      '</div>';
    }).join('');
    recentHtml = '<div id="circles-recent-slot" style="margin-bottom:20px">' +
      '<div class="circles-step-select-label">繼續上次練習</div>' +
      resumeCards +
    '</div>';
  } else {
    // Render an empty slot so updateRecentSessionsSlot can fill it later without re-rendering the page.
    recentHtml = '<div id="circles-recent-slot" style="margin-bottom:0"></div>';
  }

  var qCardsHtml = displayedQs.length > 0
    ? displayedQs.map(function(q) { return renderQCardHtml(q); }).join('')
    : '<div style="color:var(--c-text-3);font-size:13px;text-align:center;padding:24px 0">暫無題目，請先執行題庫生成腳本</div>';

  // ── Onboarding welcome card (Phase 5 Task 5.1) ───────────────────────
  // Show if: (a) flag not set, AND (b) no recent sessions, AND (c) not ?onboarding=0
  // Or force-show if ?onboarding=1 (dev hook).
  var welcomeHtml = shouldShowOnboardingWelcome() ? renderOnboardingWelcomeHtml() : '';

  return '<div data-view="circles">' +
    '<div class="circles-home-wrap">' +
      welcomeHtml +
      renderResumeBanner() +
      recentHtml +
      '<div class="circles-home-title">CIRCLES 訓練</div>' +
      '<div class="circles-home-sub">選題，按步驟填寫框架、訪談、拿到評分</div>' +

      // Info card — collapsed by default
      '<div class="circles-info-card" style="padding:0;overflow:hidden;margin-bottom:20px">' +
        '<button onclick="toggleInfoCard(this)" style="width:100%;display:flex;align-items:center;justify-content:space-between;background:none;border:none;cursor:pointer;padding:12px 14px;text-align:left">' +
          '<div class="circles-info-card-title" style="margin:0;font-size:13px">什麼是 CIRCLES 實戰訓練？</div>' +
          '<i class="ph ph-caret-right" id="info-card-icon" style="font-size:13px;color:var(--c-text-3);flex-shrink:0"></i>' +
        '</button>' +
        '<div id="info-card-body" style="display:none;padding:0 14px 14px">' +
          '<div class="circles-info-card-sub">用結構化框架拆解 PM 設計面試題，模擬真實利害關係人訪談，並在每個步驟收到 AI 教練評分與回饋。</div>' +
          '<div class="circles-info-steps">' +
            '<span class="circles-info-step">C 澄清情境</span>' +
            '<span class="circles-info-step">I 定義用戶</span>' +
            '<span class="circles-info-step">R 發掘需求</span>' +
            '<span class="circles-info-step">C 優先排序</span>' +
            '<span class="circles-info-step">L 提出方案</span>' +
            '<span class="circles-info-step">E 評估取捨</span>' +
            '<span class="circles-info-step">S 總結推薦</span>' +
          '</div>' +
        '</div>' +
      '</div>' +

      // Mode selector
      '<div class="circles-step-select-label">練習模式</div>' +
      '<div class="circles-mode-row">' +
        '<div class="circles-mode-card ' + (mode === 'simulation' ? 'selected' : '') + '" data-mode="simulation" role="button" tabindex="0" aria-label="完整模擬">' +
          '<div class="circles-mode-card-title"><i class="ph ph-video-camera"></i> 完整模擬</div>' +
          '<div class="circles-mode-card-desc">25-35 分鐘 · 全 7 步 · 無提示</div>' +
        '</div>' +
        '<div class="circles-mode-card ' + (mode === 'drill' ? 'selected' : '') + '" data-mode="drill" role="button" tabindex="0" aria-label="步驟加練">' +
          '<div class="circles-mode-card-title"><i class="ph ph-target"></i> 步驟加練</div>' +
          '<div class="circles-mode-card-desc">5-10 分鐘 · 單一步驟 · 全引導</div>' +
        '</div>' +
      '</div>' +

      // Step pills (drill mode only)
      drillPillsHtml +

      // Type tabs
      '<div class="circles-type-tabs">' +
        '<button class="circles-type-tab ' + (type === 'design' ? 'active' : '') + '" data-type="design">產品設計 ×' + designCount + '</button>' +
        '<button class="circles-type-tab ' + (type === 'improve' ? 'active' : '') + '" data-type="improve">產品改進 ×' + improveCount + '</button>' +
        '<button class="circles-type-tab ' + (type === 'strategy' ? 'active' : '') + '" data-type="strategy">產品策略 ×' + strategyCount + '</button>' +
      '</div>' +

      // Question list header
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">' +
        '<div style="font-size:11px;font-weight:600;color:var(--c-text-2);font-family:DM Sans,sans-serif">選擇題目</div>' +
        '<button id="circles-random-btn" style="font-size:11px;color:var(--c-primary);background:none;border:none;cursor:pointer;font-family:DM Sans,sans-serif;padding:0">隨機選題</button>' +
      '</div>' +

      '<div class="circles-q-list" id="circles-q-list">' + qCardsHtml + '</div>' +

      // NSM Banner
      '<div class="nsm-banner">' +
        '<div>' +
          '<div class="nsm-banner-label">S 步驟含北極星指標練習</div>' +
          '<div class="nsm-banner-sub">想做最完整的 NSM 定義訓練？</div>' +
        '</div>' +
        '<button class="nsm-banner-btn" id="circles-nsm-banner-btn">前往 NSM →</button>' +
      '</div>' +
    '</div>' +

    // Tooltip for step pills
    '<div class="circles-pill-tooltip" id="circles-pill-tooltip"></div>' +
  '</div>';
}

// Phase 4.1 — desktop 3-col layout
function renderCirclesHomeDesktop() {
  var mode = AppState.circlesMode;
  var type = AppState.circlesSelectedType;
  var drillStep = AppState.circlesDrillStep;
  var allQs = (typeof CIRCLES_QUESTIONS !== 'undefined' ? CIRCLES_QUESTIONS : []);
  var filteredQs = allQs.filter(function(q) { return q.question_type === type; });
  if (!AppState.circlesDisplayedQuestions || AppState.circlesDisplayedQuestions.length === 0 ||
      (AppState.circlesDisplayedQuestions[0] && AppState.circlesDisplayedQuestions[0].question_type !== type)) {
    AppState.circlesDisplayedQuestions = pickRandom5(filteredQs);
  }
  var displayedQs = AppState.circlesDisplayedQuestions;
  var designCount = allQs.filter(function(q) { return q.question_type === 'design'; }).length;
  var improveCount = allQs.filter(function(q) { return q.question_type === 'improve'; }).length;
  var strategyCount = allQs.filter(function(q) { return q.question_type === 'strategy'; }).length;

  var modeCardsHtml =
    '<div class="circles-mode-card ' + (mode === 'simulation' ? 'selected' : '') + '" data-mode="simulation" role="button" tabindex="0" aria-label="完整模擬">' +
      '<div class="circles-mode-card-title"><i class="ph ph-video-camera"></i> 完整模擬</div>' +
      '<div class="circles-mode-card-desc">25-35 分鐘 · 全 7 步</div>' +
    '</div>' +
    '<div class="circles-mode-card ' + (mode === 'drill' ? 'selected' : '') + '" data-mode="drill" role="button" tabindex="0" aria-label="步驟加練">' +
      '<div class="circles-mode-card-title"><i class="ph ph-target"></i> 步驟加練</div>' +
      '<div class="circles-mode-card-desc">5-10 分鐘 · 單一步驟</div>' +
    '</div>';

  var typeListHtml =
    '<button class="circles-type-tab ' + (type === 'design' ? 'active' : '') + '" data-type="design"><span>產品設計</span><span>×' + designCount + '</span></button>' +
    '<button class="circles-type-tab ' + (type === 'improve' ? 'active' : '') + '" data-type="improve"><span>產品改進</span><span>×' + improveCount + '</span></button>' +
    '<button class="circles-type-tab ' + (type === 'strategy' ? 'active' : '') + '" data-type="strategy"><span>產品策略</span><span>×' + strategyCount + '</span></button>';

  var qCardsHtml = displayedQs.length > 0
    ? displayedQs.map(function(q) { return renderQCardHtml(q); }).join('')
    : '<div style="color:var(--c-text-3);font-size:13px;text-align:center;padding:24px 0">暫無題目</div>';

  // recent rail (right)
  var recentItemsHtml = '';
  if (AppState.circlesRecentSessions && AppState.circlesRecentSessions.length > 0) {
    var STEP_MAP = {};
    CIRCLES_STEPS.forEach(function(s) { STEP_MAP[s.key] = s.label; });
    recentItemsHtml = AppState.circlesRecentSessions.slice(0, 3).map(function(s) {
      var company = (s.question_json || {}).company || '—';
      var modeLabel = s.mode === 'drill' ? '步驟加練' : '完整模擬';
      var stepLabel = s.mode === 'simulation'
        ? 'Step ' + (s.sim_step_index + 1) + '/7'
        : (STEP_MAP[s.drill_step] || s.drill_step);
      return '<div class="circles-resume-card" data-resume-id="' + s.id + '" style="margin-bottom:6px">' +
        '<div class="circles-q-card-company" style="font-size:12px">' + escHtml(company) + ' · ' + modeLabel + '</div>' +
        '<div style="font-size:11px;color:var(--c-text-2);margin-top:2px">' + stepLabel + '</div>' +
      '</div>';
    }).join('');
  } else {
    recentItemsHtml = '<div style="color:var(--c-text-3);font-size:11.5px">尚無紀錄</div>';
  }

  // Phase 2 + 5 banner/welcome slots: render in the center column above the
  // question list (spec 2 §7, spec 3 §4.1). The wrapper class circles-home-wrap
  // is also kept so the bindCirclesHome post-render fetchActiveDraft re-render
  // pass works identically on desktop + mobile.
  var welcomeHtmlD = (typeof shouldShowOnboardingWelcome === 'function' && shouldShowOnboardingWelcome())
    ? renderOnboardingWelcomeHtml() : '';
  var bannerHtmlD = (typeof renderResumeBanner === 'function') ? renderResumeBanner() : '';

  return '<div data-view="circles" class="circles-home-desktop">' +
    '<div class="circles-home-wrap">' +
    '<div class="ch-header">' +
      '<div>' +
        '<h1>CIRCLES 訓練</h1>' +
        '<div class="ch-sub">選題，按步驟填寫框架、訪談、拿到評分</div>' +
      '</div>' +
      '<div class="ch-meta">100 題 · 7 步驟框架</div>' +
    '</div>' +
    welcomeHtmlD +
    bannerHtmlD +
    '<div class="ch-grid">' +
      // Left rail
      '<div class="left-rail">' +
        '<div class="mode-section">' +
          '<div class="rail-label">練習模式</div>' +
          '<div class="mode-list">' + modeCardsHtml + '</div>' +
        '</div>' +
        '<div class="type-section">' +
          '<div class="rail-label">題型</div>' +
          '<div class="type-list">' + typeListHtml + '</div>' +
        '</div>' +
      '</div>' +
      // Center
      '<div class="center-col">' +
        '<div style="display:flex;align-items:center;justify-content:space-between">' +
          '<div class="rail-label">選擇題目</div>' +
          '<button id="circles-random-btn" style="font-size:11px;color:var(--c-primary);background:none;border:none;cursor:pointer;padding:0">隨機選題</button>' +
        '</div>' +
        '<div class="circles-q-list ch-q-list" id="circles-q-list">' + qCardsHtml + '</div>' +
        '<div class="nsm-banner">' +
          '<div>' +
            '<div class="nsm-banner-label">S 步驟含北極星指標練習</div>' +
            '<div class="nsm-banner-sub">想做最完整的 NSM 定義訓練？</div>' +
          '</div>' +
          '<button class="nsm-banner-btn" id="circles-nsm-banner-btn">前往 NSM →</button>' +
        '</div>' +
      '</div>' +
      // Right rail
      '<div class="right-rail">' +
        '<div class="recent-section" id="circles-recent-slot">' +
          '<div class="rail-label">近期練習</div>' +
          recentItemsHtml +
        '</div>' +
      '</div>' +
    '</div>' +
    '<div class="circles-pill-tooltip" id="circles-pill-tooltip"></div>' +
    '</div>' + // close .circles-home-wrap
  '</div>';
}

function renderQList() {
  var type = AppState.circlesSelectedType;
  var allQs = (typeof CIRCLES_QUESTIONS !== 'undefined' ? CIRCLES_QUESTIONS : []);
  var filteredQs = allQs.filter(function(q) { return q.question_type === type; });
  AppState.circlesDisplayedQuestions = pickRandom5(filteredQs);
  var qListEl = document.getElementById('circles-q-list');
  if (!qListEl) return;
  var html = AppState.circlesDisplayedQuestions.length > 0
    ? AppState.circlesDisplayedQuestions.map(function(q) { return renderQCardHtml(q); }).join('')
    : '<div style="color:var(--c-text-3);font-size:13px;text-align:center;padding:24px 0">暫無題目</div>';
  qListEl.innerHTML = html;
}

function bindCirclesHome() {
  if (AppState.circlesRecentSessions.length === 0 && !AppState.circlesRecentLoading) {
    fetchCirclesRecentSessions();
  }

  // Phase 2 Spec 2 § 6.2: bind resume banner controls + fetch fresh active draft.
  // First call: render whatever's currently in AppState (instant if cached);
  // then fetch and re-render the slot only if the result changes.
  bindResumeBanner();
  fetchActiveDraft().then(function () {
    const wrap = document.querySelector('[data-view="circles"] .circles-home-wrap');
    if (!wrap) return;
    // SIT-1 #5: if active draft exists, suppress welcome card to avoid
    // simultaneous display of welcome card + resume banner.
    if (AppState.circlesActiveDraft) {
      const _w = wrap.querySelector('.onboarding-welcome');
      if (_w) _w.remove();
    }
    const existing = wrap.querySelector('.resume-banner');
    const newHtml = renderResumeBanner();
    if (existing && !newHtml) { existing.remove(); return; }
    if (!existing && newHtml) {
      // Insert after the welcome card if present, else at top.
      const welcome = wrap.querySelector('.onboarding-welcome');
      if (welcome) welcome.insertAdjacentHTML('afterend', newHtml);
      else wrap.insertAdjacentHTML('afterbegin', newHtml);
      bindResumeBanner();
      return;
    }
    if (existing && newHtml) {
      existing.outerHTML = newHtml;
      bindResumeBanner();
    }
  });

  // Onboarding welcome card (Phase 5 Task 5.1)
  bindOnboardingWelcome();

  document.getElementById('circles-nsm-banner-btn')?.addEventListener('click', function() { navigate('nsm'); });

  document.querySelectorAll('.circles-resume-card').forEach(function(el) {
    el.addEventListener('click', async function() {
      var id = el.dataset.resumeId;
      el.style.opacity = '0.6';
      el.style.pointerEvents = 'none';
      var ok = await loadCirclesSession(id);
      if (ok) {
        AppState.circlesRecentSessions = [];
        AppState.view = 'circles';
        document.body.dataset.view = 'circles';
        render();
      } else {
        el.style.opacity = '';
        el.style.pointerEvents = '';
      }
    });
  });

  // Mode selector (J5: keyboard reachable via role=button + Enter/Space)
  document.querySelectorAll('.circles-mode-card').forEach(function(el) {
    function activate() {
      AppState.circlesMode = el.dataset.mode;
      localStorage.setItem('circlesMode', AppState.circlesMode);
      render();
    }
    el.addEventListener('click', activate);
    el.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(); }
    });
  });

  // Type tabs — re-pick 5 questions, only re-render the list
  document.querySelectorAll('.circles-type-tab').forEach(function(el) {
    el.addEventListener('click', function() {
      if (AppState.circlesSelectedType === el.dataset.type) return;
      AppState.circlesSelectedType = el.dataset.type;
      AppState.circlesDisplayedQuestions = [];
      // Update active tab visually
      document.querySelectorAll('.circles-type-tab').forEach(function(t) {
        t.classList.toggle('active', t.dataset.type === AppState.circlesSelectedType);
      });
      renderQList();
    });
  });

  // Drill step pills — update active, no full re-render
  document.querySelectorAll('.circles-step-pill').forEach(function(el) {
    el.addEventListener('click', function() {
      AppState.circlesDrillStep = el.dataset.step;
      document.querySelectorAll('.circles-step-pill').forEach(function(p) {
        p.classList.toggle('active', p.dataset.step === AppState.circlesDrillStep);
      });
    });
  });

  // Question card accordion (event delegation)
  var qListEl = document.getElementById('circles-q-list');
  if (qListEl) {
    qListEl.addEventListener('click', function(e) {
      var card = e.target.closest('.circles-q-card');
      if (!card) return;

      // Cancel button
      if (e.target.closest('.circles-q-cancel-btn')) {
        collapseQCard(card);
        return;
      }

      // Confirm button
      if (e.target.closest('.circles-q-confirm-btn')) {
        var qid = card.dataset.qid;
        var question = (typeof CIRCLES_QUESTIONS !== 'undefined' ? CIRCLES_QUESTIONS : []).find(function(q) { return q.id === qid; });
        if (!question) return;
        AppState.circlesSelectedQuestion = question;
        AppState.circlesSession = null;
        AppState.circlesPhase = 1;
        AppState.circlesFrameworkDraft = {};
        AppState.circlesGateResult = null;
        AppState.circlesConversation = [];
        AppState.circlesScoreResult = null;
        AppState.circlesSimStep = 0;
        render();
        return;
      }

      // Card body click — accordion expand
      var allCards = document.querySelectorAll('.circles-q-card');
      allCards.forEach(function(c) { if (c !== card) collapseQCard(c); });
      var expandArea = card.querySelector('.circles-q-card-expand-area');
      if (expandArea && expandArea.style.display !== 'none') {
        collapseQCard(card);
      } else {
        expandQCard(card);
      }
    });
  }

  // Random question — re-pick 5, re-render list only
  document.getElementById('circles-random-btn')?.addEventListener('click', function() {
    AppState.circlesDisplayedQuestions = [];
    renderQList();
  });

  // Step pill tooltip
  var pillTooltip = document.getElementById('circles-pill-tooltip');
  var pillTipTimer = null;
  if (pillTooltip) {
    document.addEventListener('mouseover', function(e) {
      var pill = e.target.closest('.circles-step-pill[data-tip]');
      if (!pill) return;
      clearTimeout(pillTipTimer);
      pillTooltip.textContent = pill.getAttribute('data-tip');
      var rect = pill.getBoundingClientRect();
      var tipW = 200;
      var left = Math.max(8, Math.min(rect.left + rect.width / 2 - tipW / 2, window.innerWidth - tipW - 8));
      pillTooltip.style.cssText = 'left:' + left + 'px;top:' + rect.top + 'px;width:' + tipW + 'px;transform:translateY(-100%) translateY(-8px)';
      pillTooltip.classList.add('visible');
    });
    document.addEventListener('mouseout', function(e) {
      if (!e.target.closest('.circles-step-pill[data-tip]')) return;
      pillTipTimer = setTimeout(function() { pillTooltip.classList.remove('visible'); }, 80);
    });
  }
}
// ──────────────────────────────────────────────────
// Helper: build prev-step-card HTML for E and S steps
//   Reads AppState.circlesStepDrafts; falls back to '—' when missing.
// ──────────────────────────────────────────────────
function buildPrevStepCardHtml(stepKey) {
  var sd = AppState.circlesStepDrafts || {};
  var rows;
  if (stepKey === 'E') {
    var c1 = (sd.C1 && sd.C1['業務影響']) || '—';
    var rConc = (sd.R && sd.R.conclusion) || (sd.R && sd.R['核心痛點']) || '—';
    var lDraft = sd.L || {};
    var lParts = [];
    if (lDraft.sol1) lParts.push('① ' + lDraft.sol1);
    if (lDraft.sol2) lParts.push('② ' + lDraft.sol2);
    if (lDraft.sol3) lParts.push('③ ' + lDraft.sol3);
    var lText = lParts.length ? lParts.join(' ') : '—';
    rows = [
      { label: 'C1 業務約束', val: escHtml(c1) },
      { label: 'R 核心痛點', val: escHtml(rConc) },
      { label: 'L 方案',     val: escHtml(lText) },
    ];
  } else if (stepKey === 'S') {
    var eConc = (sd.E && sd.E.conclusion) || '—';
    var rConcS = (sd.R && sd.R.conclusion) || (sd.R && sd.R['核心痛點']) || '—';
    var lDraftS = sd.L || {};
    var lPartsS = [];
    if (lDraftS.sol1) lPartsS.push('① ' + lDraftS.sol1);
    if (lDraftS.sol2) lPartsS.push('② ' + lDraftS.sol2);
    if (lDraftS.sol3) lPartsS.push('③ ' + lDraftS.sol3);
    var lTextS = lPartsS.length ? lPartsS.join(' ') : '—';
    rows = [
      { label: 'E 評估',     val: escHtml(eConc) },
      { label: 'L 方案',     val: escHtml(lTextS) },
      { label: 'R 核心痛點', val: escHtml(rConcS) },
    ];
  } else {
    return '';
  }
  return '<div class="prev-step-card">' +
    '<button class="prev-step-toggle" type="button" data-prev-toggle="1">' +
      '<span class="prev-step-toggle-title"><i class="ph ph-clock-counter-clockwise"></i> 前步驟重點參考</span>' +
      '<i class="ph ph-caret-down toggle-caret"></i>' +
    '</button>' +
    '<div class="prev-step-body">' +
      rows.map(function(r) {
        return '<div class="prev-step-row">' +
          '<span class="prev-step-label">' + r.label + '</span>' +
          '<span class="prev-step-val">' + r.val + '</span>' +
        '</div>';
      }).join('') +
    '</div>' +
  '</div>';
}

// ──────────────────────────────────────────────────
// Helper: build a standard textarea field group
// ──────────────────────────────────────────────────
// Collapsible field example: button + body. Default state collapsed (per spec line 3682).
// Body content is lazily fetched from AI on first expand (question-specific), with the
// static fallback shown immediately as a placeholder while AI loads.
// stepKey and field are stamped on the toggle so the click handler can fetch the right content.
function buildFieldExampleHtml(stepKey, field, fallbackHint) {
  // Suppress entirely when there's no fallback hint AND no step (defensive)
  if (!stepKey || !field) return '';
  return '<button class="field-example-toggle" type="button" aria-expanded="false" data-example-step="' + stepKey + '" data-example-field="' + escHtml(field) + '">' +
      '<i class="ph ph-caret-right"></i> 查看範例' +
    '</button>' +
    '<div class="field-example-body" data-fallback="' + escHtml(fallbackHint || '') + '"></div>';
}

function buildFieldGroupHtml(stepKey, field, draft, isSimulation, fieldIdx) {
  var rows = field.rows || 2;
  var key = field.key;
  var val = draft[key] != null ? draft[key] : '';
  return '<div class="circles-field-group">' +
    '<div class="circles-field-label-row">' +
      '<div class="circles-field-label">' + escHtml(key) + '</div>' +
      '<button class="circles-hint-trigger" type="button" data-hint-step="' + stepKey + '" data-hint-field="' + escHtml(key) + '">' +
        '<i class="ph ph-lightbulb"></i> 提示' +
      '</button>' +
    '</div>' +
    buildFieldExampleHtml(stepKey, key, '') +
    '<div class="rt-field">' +
      '<div class="rt-toolbar">' +
        '<button type="button" class="rt-tbtn" data-rt-action="bold" title="粗體 (Ctrl+B)" aria-label="粗體"><strong>B</strong></button>' +
        '<button type="button" class="rt-tbtn" data-rt-action="bullet" title="列點 (Ctrl+L)" aria-label="列點"><i class="ph ph-list-bullets"></i></button>' +
        '<button type="button" class="rt-tbtn" data-rt-action="indent" title="縮排 (Tab)" aria-label="增加縮排"><i class="ph ph-text-indent"></i></button>' +
        '<button type="button" class="rt-tbtn" data-rt-action="outdent" title="退縮 (Shift+Tab)" aria-label="減少縮排"><i class="ph ph-text-outdent"></i></button>' +
      '</div>' +
      '<textarea class="circles-field-input rt-textarea" data-field="' + escHtml(key) + '" rows="' + rows + '" enterkeyhint="enter" placeholder="' + escHtml(field.placeholder || '填寫你的分析…') + '">' + escTextarea(val) + '</textarea>' +
    '</div>' +
  '</div>';
}

// ──────────────────────────────────────────────────
// Helper: build the L-step solution field group (with name input)
// ──────────────────────────────────────────────────
function buildSolutionFieldHtml(stepKey, field, draft, lDraft, isSimulation, fieldIdx) {
  var key = field.key;
  var solKey = field.solKey;
  var nameVal = lDraft[solKey] != null ? lDraft[solKey] : '';
  var bodyVal = draft[key] != null ? draft[key] : '';
  var optional = !!field.optional;
  var groupId = optional ? ' id="l-sol3-group" style="display:' + (nameVal || bodyVal ? 'block' : 'none') + '"' : '';
  return '<div class="circles-field-group"' + groupId + '>' +
    '<div class="circles-field-label-row">' +
      '<div class="circles-field-label">' + escHtml(key) + '</div>' +
      '<button class="circles-hint-trigger" type="button" data-hint-step="' + stepKey + '" data-hint-field="' + escHtml(key) + '">' +
        '<i class="ph ph-lightbulb"></i> 提示' +
      '</button>' +
    '</div>' +
    '<div class="sol-name-row">' +
      '<i class="ph ph-tag"></i>' +
      '<input class="sol-name-input" type="text" maxlength="10" data-sol-name="' + solKey + '" placeholder="' + escHtml(field.namePlaceholder || '方案名稱（10 字內）') + '" value="' + escHtml(nameVal) + '">' +
    '</div>' +
    buildFieldExampleHtml(stepKey, key, '') +
    '<div class="rt-field">' +
      '<div class="rt-toolbar">' +
        '<button type="button" class="rt-tbtn" data-rt-action="bold" title="粗體 (Ctrl+B)" aria-label="粗體"><strong>B</strong></button>' +
        '<button type="button" class="rt-tbtn" data-rt-action="bullet" title="列點 (Ctrl+L)" aria-label="列點"><i class="ph ph-list-bullets"></i></button>' +
        '<button type="button" class="rt-tbtn" data-rt-action="indent" title="縮排 (Tab)" aria-label="增加縮排"><i class="ph ph-text-indent"></i></button>' +
        '<button type="button" class="rt-tbtn" data-rt-action="outdent" title="退縮 (Shift+Tab)" aria-label="減少縮排"><i class="ph ph-text-outdent"></i></button>' +
      '</div>' +
      '<textarea class="circles-field-input rt-textarea" data-field="' + escHtml(key) + '" rows="' + (field.rows || 2) + '" enterkeyhint="enter" placeholder="' + escHtml(field.placeholder || '') + '">' + escTextarea(bodyVal) + '</textarea>' +
    '</div>' +
  '</div>';
}

// ──────────────────────────────────────────────────
// Helper: build the S step's tracking-block (4 NSM dimensions)
// ──────────────────────────────────────────────────
function buildTrackingBlockHtml(tracking) {
  tracking = tracking || {};
  var dimsHtml = CIRCLES_TRACKING_DIMS.map(function(dim) {
    var v = tracking[dim.key] != null ? tracking[dim.key] : '';
    return '<div class="tracking-dim">' +
      '<div class="tracking-dim-label">' +
        '<span class="tracking-dim-dot" style="background:' + dim.dotColor + '"></span>' +
        '<span style="color:' + dim.textColor + '">' + escHtml(dim.label) + '</span>' +
      '</div>' +
      '<div class="tracking-dim-desc">' + escHtml(dim.desc) + '</div>' +
      '<div class="rt-field">' +
        '<div class="rt-toolbar">' +
          '<button type="button" class="rt-tbtn" data-rt-action="bold" title="粗體 (Ctrl+B)" aria-label="粗體"><strong>B</strong></button>' +
          '<button type="button" class="rt-tbtn" data-rt-action="bullet" title="列點 (Ctrl+L)" aria-label="列點"><i class="ph ph-list-bullets"></i></button>' +
          '<button type="button" class="rt-tbtn" data-rt-action="indent" title="縮排 (Tab)" aria-label="增加縮排"><i class="ph ph-text-indent"></i></button>' +
          '<button type="button" class="rt-tbtn" data-rt-action="outdent" title="退縮 (Shift+Tab)" aria-label="減少縮排"><i class="ph ph-text-outdent"></i></button>' +
        '</div>' +
        '<textarea class="tracking-dim-input rt-textarea' + (v ? ' filled' : '') + '" data-tracking-dim="' + dim.key + '" rows="1" enterkeyhint="enter" placeholder="' + escHtml(dim.placeholder) + '">' + escTextarea(v) + '</textarea>' +
      '</div>' +
    '</div>';
  }).join('');
  return '<div class="tracking-block">' +
    '<div class="tracking-block-header">' +
      '<div class="tracking-block-label">追蹤指標</div>' +
      '<button class="circles-hint-trigger" type="button" data-hint-step="S" data-hint-field="追蹤指標">' +
        '<i class="ph ph-lightbulb"></i> 提示' +
      '</button>' +
    '</div>' +
    '<div class="tracking-block-sub">對應 NSM 4 個拆解維度，定義驗證方案成效的具體指標</div>' +
    dimsHtml +
  '</div>';
}

// ──────────────────────────────────────────────────
// Helper: build a single E-step solution block (with 4 sub-fields)
// ──────────────────────────────────────────────────
function buildESolutionBlockHtml(solKey, solIdx, solName, perSolDraft, eFieldsConfig, isOptional) {
  perSolDraft = perSolDraft || {};
  var labels = ['方案一', '方案二', '方案三'];
  var solLabel = labels[solIdx] || ('方案' + (solIdx + 1));
  var dimmedStyle = isOptional ? 'background:rgba(0,0,0,0.05);color:var(--c-text-3)' : '';
  var nameStyle = isOptional ? 'color:var(--c-text-3)' : '';
  var displayName = solName || '（未命名）';
  var fieldsHtml = eFieldsConfig.map(function(f, i) {
    var v = perSolDraft[f.key] != null ? perSolDraft[f.key] : '';
    var hint = '';
    return '<div class="circles-field-group">' +
      '<div class="circles-field-label-row">' +
        '<div class="circles-field-label">' + escHtml(f.key) + '</div>' +
        '<button class="circles-hint-trigger" type="button" data-hint-step="E" data-hint-field="' + escHtml(f.key) + '">' +
          '<i class="ph ph-lightbulb"></i> 提示' +
        '</button>' +
      '</div>' +
      (solIdx === 0 ? buildFieldExampleHtml('E', f.key, hint) : '') +
      '<div class="rt-field">' +
        '<div class="rt-toolbar">' +
          '<button type="button" class="rt-tbtn" data-rt-action="bold" title="粗體 (Ctrl+B)" aria-label="粗體"><strong>B</strong></button>' +
          '<button type="button" class="rt-tbtn" data-rt-action="bullet" title="列點 (Ctrl+L)" aria-label="列點"><i class="ph ph-list-bullets"></i></button>' +
          '<button type="button" class="rt-tbtn" data-rt-action="indent" title="縮排 (Tab)" aria-label="增加縮排"><i class="ph ph-text-indent"></i></button>' +
          '<button type="button" class="rt-tbtn" data-rt-action="outdent" title="退縮 (Shift+Tab)" aria-label="減少縮排"><i class="ph ph-text-outdent"></i></button>' +
        '</div>' +
        '<textarea class="e-sol-input rt-textarea" data-sol="' + solKey + '" data-field="' + escHtml(f.key) + '" rows="2" enterkeyhint="enter" placeholder="' + escHtml(f.placeholder) + '">' + escTextarea(v) + '</textarea>' +
      '</div>' +
    '</div>';
  }).join('');
  var blockId = solKey === 'sol3' ? ' id="e-sol3-block"' : '';
  var displayStyle = solKey === 'sol3' && isOptional ? 'display:none' : '';
  return '<div class="e-solution-block"' + blockId + (displayStyle ? ' style="' + displayStyle + '"' : '') + '>' +
    '<div class="e-sol-header">' +
      '<span class="e-sol-badge"' + (dimmedStyle ? ' style="' + dimmedStyle + '"' : '') + '>' + solLabel + '</span>' +
      '<span class="e-sol-name"' + (nameStyle ? ' style="' + nameStyle + '"' : '') + '>' + escHtml(displayName) + '</span>' +
    '</div>' +
    '<div class="e-sol-fields">' + fieldsHtml + '</div>' +
  '</div>';
}

// ──────────────────────────────────────────────────
// renderCirclesPhase1 — Screen 2: Phase 1 Framework Form
// ──────────────────────────────────────────────────
function renderCirclesPhase1() {
  var q = AppState.circlesSelectedQuestion;
  var mode = AppState.circlesMode;
  var stepKey = mode === 'drill' ? AppState.circlesDrillStep : (CIRCLES_STEPS[AppState.circlesSimStep || 0] || CIRCLES_STEPS[0]).key;
  var stepIdx = CIRCLES_STEPS.findIndex(function(s) { return s.key === stepKey; });
  if (stepIdx < 0) stepIdx = 0;
  var step = CIRCLES_STEPS[stepIdx];
  var config = CIRCLES_STEP_CONFIG[stepKey] || CIRCLES_STEP_CONFIG.C1;
  var draft = AppState.circlesFrameworkDraft || {};
  var isSimulation = mode === 'simulation';

  // Progress segments (current step active, prior steps done)
  var progressSegs = CIRCLES_STEPS.map(function(s, i) {
    var cls = i < stepIdx ? 'done' : i === stepIdx ? 'active' : '';
    return '<div class="circles-progress-seg ' + cls + '"></div>';
  }).join('');

  // Step pills (only in drill mode for visual nav cue; click on pills NOT navigation per current Phase 1 requirement)
  var pillsHtml = '';
  if (mode === 'drill') {
    pillsHtml = '<div class="circles-step-pills" style="margin-bottom:14px">' +
      CIRCLES_STEPS.map(function(s, i) {
        var cls = (s.key === stepKey) ? 'active' : (i < stepIdx ? 'done' : '');
        return '<button class="circles-step-pill ' + cls + '" type="button" data-pill-step="' + s.key + '">' + s.short + ' ' + s.label + '</button>';
      }).join('') +
    '</div>';
  }

  // Build body content based on step kind
  var bodyHtml = '';

  // E step — per-solution matrix (no standard fields)
  if (config.kind === 'per-solution' && stepKey === 'E') {
    var sd = AppState.circlesStepDrafts || {};
    var lDraft = sd.L || {};
    var ePerSol = (sd.E && sd.E.perSolution) || (draft.perSolution) || {};
    // Save back to circlesFrameworkDraft so we have a single source for the gate POST
    if (!draft.perSolution) draft.perSolution = ePerSol;

    var hasSol3 = !!lDraft.sol3;
    bodyHtml += buildESolutionBlockHtml('sol1', 0, lDraft.sol1, ePerSol.sol1 || {}, config.perSolutionFields, false);
    bodyHtml += buildESolutionBlockHtml('sol2', 1, lDraft.sol2, ePerSol.sol2 || {}, config.perSolutionFields, false);
    bodyHtml += buildESolutionBlockHtml('sol3', 2, lDraft.sol3 || '', ePerSol.sol3 || {}, config.perSolutionFields, !hasSol3);
    if (!hasSol3) {
      bodyHtml += '<button class="e-sol3-add-btn" id="e-sol3-add-btn" type="button">' +
        '<i class="ph ph-plus-circle"></i> 新增方案三（可選）' +
      '</button>';
    }
  } else {
    // Standard fields (with possible solution kind for L step or tracking kind for S step)
    bodyHtml = config.fields.map(function(field, i) {
      if (field.kind === 'tracking') {
        var sdRoot = AppState.circlesStepDrafts || {};
        var trackingDraft = (sdRoot.S && sdRoot.S.tracking) || draft.tracking || {};
        if (!draft.tracking) draft.tracking = trackingDraft;
        return buildTrackingBlockHtml(trackingDraft);
      }
      if (field.kind === 'solution') {
        var sdL = AppState.circlesStepDrafts || {};
        var lDraftL = sdL.L || draft.solutionNames || {};
        if (!draft.solutionNames) draft.solutionNames = lDraftL;
        // For sol3 (optional), wrap in a hidden group + render add button later
        return buildSolutionFieldHtml(stepKey, field, draft, lDraftL, isSimulation, i);
      }
      return buildFieldGroupHtml(stepKey, field, draft, isSimulation, i);
    }).join('');

    // L step — append "+ 新增方案三" button after the fields if sol3 not yet revealed
    if (stepKey === 'L') {
      var lDraftBtn = (AppState.circlesStepDrafts && AppState.circlesStepDrafts.L) || draft.solutionNames || {};
      var sol3Has = !!(lDraftBtn.sol3 || draft['方案三（可選）']);
      bodyHtml += '<button class="add-solution-btn" id="l-sol3-add-btn" type="button" style="display:' + (sol3Has ? 'none' : 'flex') + '">' +
        '<i class="ph ph-plus-circle"></i> 新增方案三（可選）' +
      '</button>';
    }
  }

  // Submit bar (Simulation last step shows "查看完整報告 →" instead)
  var isLastStep = stepIdx === CIRCLES_STEPS.length - 1;
  var submitBarHtml = '<div class="circles-submit-bar">' +
    '<button class="circles-btn-secondary" id="circles-p1-back" type="button">返回選題</button>' +
    '<button class="circles-btn-primary" id="circles-p1-submit" type="button">' + (isSimulation && isLastStep ? '送出評分' : '送出評分') + '</button>' +
  '</div>';

  // Phase 4.2 — desktop wrapper class
  var _isDesktopP1 = (typeof isDesktop === 'function' && isDesktop());

  // Phase 4.2 — desktop sidebar rail (題目脈絡 + 上一步重點)
  var _railHtml = '';
  if (_isDesktopP1) {
    var _prevKey = stepIdx > 0 ? CIRCLES_STEPS[stepIdx - 1].key : null;
    var _prevDraft = _prevKey ? ((AppState.circlesStepDrafts && AppState.circlesStepDrafts[_prevKey]) || {}) : {};
    var _prevSummary = '';
    Object.keys(_prevDraft).slice(0, 3).forEach(function(k) {
      var v = _prevDraft[k];
      if (typeof v === 'string' && v.trim()) {
        _prevSummary += '<div style="margin-bottom:6px"><div style="font-size:10.5px;color:var(--c-text-3);font-weight:600">' + escHtml(k) + '</div><div style="font-size:11.5px;color:var(--c-text-2);line-height:1.5">' + escHtml(v.slice(0, 80)) + (v.length > 80 ? '…' : '') + '</div></div>';
      }
    });
    _railHtml = '<aside class="p1-rail">' +
      '<div><h4>題目脈絡</h4>' +
        '<div style="font-size:11.5px;color:var(--c-text-2);line-height:1.5">' + escHtml((q.company || '') + (q.product ? ' · ' + q.product : '')) + '</div>' +
      '</div>' +
      (_prevSummary ? '<div><h4>上一步重點</h4>' + _prevSummary + '</div>' : '') +
    '</aside>';
  }

  // Phase 4.2 — S step split into 2 sub-pages on desktop
  var _sStepTabs = '';
  if (_isDesktopP1 && stepKey === 'S') {
    var _sStep = AppState.circlesSStep || 1;
    _sStepTabs = '<div class="s-step-tabs">' +
      '<button class="s-step-tab ' + (_sStep === 1 ? 'active' : '') + '" data-s-step="1" type="button">S-1 摘要</button>' +
      '<button class="s-step-tab ' + (_sStep === 2 ? 'active' : '') + '" data-s-step="2" type="button">S-2 追蹤指標</button>' +
    '</div>';
  }

  if (_isDesktopP1) {
    return '<div data-view="circles" class="phase1-desktop">' +
      '<div class="circles-nav">' +
        '<button class="circles-nav-back" id="circles-p1-nav-back" type="button" aria-label="返回"><i class="ph ph-arrow-left"></i></button>' +
        '<div>' +
          '<div class="circles-nav-title">' + escHtml(config.label) + '</div>' +
          '<div class="circles-nav-sub">' + escHtml(q.company || '') + (q.product ? ' · ' + escHtml(q.product) : '') + '</div>' +
        '</div>' +
        '<button class="circles-nav-home" id="circles-p1-home" type="button">回首頁</button>' +
      '</div>' +
      '<div class="circles-progress">' + progressSegs + '<div class="circles-progress-label">' + escHtml(config.progressLabel) + '</div>' +
        '<span class="save-indicator" aria-live="polite"></span>' +
      '</div>' +
      '<div class="p1-grid">' +
        '<div class="p1-main circles-phase1-wrap">' +
          pillsHtml +
          _sStepTabs +
          '<div class="problem-card">' + escHtml(q.problem_statement || '') + '</div>' +
          (config.showPrevStepCard ? buildPrevStepCardHtml(stepKey) : '') +
          (config.showNsmAnnotation ? '<div class="nsm-annotation">' +
            '此步驟的北極星指標欄位是 NSM 訓練的濃縮版。想深入練習？' +
            '<button id="circles-s-nsm-link" type="button">前往 NSM 訓練 →</button>' +
          '</div>' : '') +
          bodyHtml +
        '</div>' +
        _railHtml +
      '</div>' +
      submitBarHtml +
    '</div>';
  }

  return '<div data-view="circles">' +
    '<div class="circles-nav">' +
      '<button class="circles-nav-back" id="circles-p1-nav-back" type="button" aria-label="返回"><i class="ph ph-arrow-left"></i></button>' +
      '<div>' +
        '<div class="circles-nav-title">' + escHtml(config.label) + '</div>' +
        '<div class="circles-nav-sub">' + escHtml(q.company || '') + (q.product ? ' · ' + escHtml(q.product) : '') + '</div>' +
      '</div>' +
      '<button class="circles-nav-home" id="circles-p1-home" type="button">回首頁</button>' +
    '</div>' +
    '<div class="circles-progress">' + progressSegs + '<div class="circles-progress-label">' + escHtml(config.progressLabel) + '</div>' +
      '<span class="save-indicator" aria-live="polite"></span>' +
    '</div>' +
    '<div class="circles-phase1-wrap">' +
      pillsHtml +
      '<div class="problem-card">' + escHtml(q.problem_statement || '') + '</div>' +
      (config.showPrevStepCard ? buildPrevStepCardHtml(stepKey) : '') +
      (config.showNsmAnnotation ? '<div class="nsm-annotation">' +
        '此步驟的北極星指標欄位是 NSM 訓練的濃縮版。想深入練習？' +
        '<button id="circles-s-nsm-link" type="button">前往 NSM 訓練 →</button>' +
      '</div>' : '') +
      bodyHtml +
    '</div>' +
    submitBarHtml +
  '</div>';
}

function bindCirclesPhase1() {
  // ── Navigation: back button (clear selection, return to home)
  function backToHome() {
    AppState.circlesSelectedQuestion = null;
    AppState.circlesPhase = 1;
    AppState.circlesFrameworkDraft = {};
    navigate('circles');
  }
  document.getElementById('circles-p1-nav-back')?.addEventListener('click', backToHome);
  document.getElementById('circles-p1-back')?.addEventListener('click', backToHome);
  document.getElementById('circles-p1-home')?.addEventListener('click', backToHome);

  // ── NSM annotation link (S step only)
  document.getElementById('circles-s-nsm-link')?.addEventListener('click', function() {
    navigate('nsm');
  });

  // ── Save standard textarea fields to circlesFrameworkDraft + step_drafts on every input
  // Spec 2 § 3 requires step_drafts as canonical source of "has drafts" — keyed
  // by step letter. framework_draft is kept as flat field map for gate/eval.
  // J4 — Tab key inserts 2 spaces in Phase-1 textareas (don't shift focus)
  function _circlesTabHandler(e) {
    if (e.key !== 'Tab' || e.shiftKey) return;
    if (e.defaultPrevented) return; // rt-textarea bullet handler already handled it
    e.preventDefault();
    var ta = e.target;
    var s = ta.selectionStart, en = ta.selectionEnd;
    ta.value = ta.value.slice(0, s) + '  ' + ta.value.slice(en);
    ta.selectionStart = ta.selectionEnd = s + 2;
    ta.dispatchEvent(new Event('input', { bubbles: true }));
  }
  document.querySelectorAll('.circles-field-input, .e-sol-input, .tracking-dim-input').forEach(function(el) {
    el.addEventListener('keydown', _circlesTabHandler);
  });

  document.querySelectorAll('.circles-field-input').forEach(function(el) {
    el.addEventListener('input', function() {
      AppState.circlesFrameworkDraft[el.dataset.field] = el.value;
      var stepKey = AppState.circlesMode === 'drill'
        ? AppState.circlesDrillStep
        : (CIRCLES_STEPS[AppState.circlesSimStep || 0] || CIRCLES_STEPS[0]).key;
      if (!AppState.circlesStepDrafts[stepKey]) AppState.circlesStepDrafts[stepKey] = {};
      AppState.circlesStepDrafts[stepKey][el.dataset.field] = el.value;
      // Phase 2 Spec 2: auto-save with lazy-create + debounce
      triggerCirclesAutoSave();
    });
  });

  // ── L step: solution name inputs save to circlesStepDrafts['L']
  document.querySelectorAll('.sol-name-input').forEach(function(el) {
    el.addEventListener('input', function() {
      var solKey = el.dataset.solName;
      if (!AppState.circlesStepDrafts.L) AppState.circlesStepDrafts.L = {};
      AppState.circlesStepDrafts.L[solKey] = el.value;
      // Mirror in framework draft for gate evaluation
      if (!AppState.circlesFrameworkDraft.solutionNames) AppState.circlesFrameworkDraft.solutionNames = {};
      AppState.circlesFrameworkDraft.solutionNames[solKey] = el.value;
      triggerCirclesAutoSave();
    });
  });

  // ── Save indicator: click on error → manual retry
  document.querySelectorAll('.save-indicator').forEach(function(el) {
    el.addEventListener('click', function() {
      if (AppState.circlesSaveStatus === 'error') triggerCirclesAutoSave();
    });
  });

  // ── L step: 新增方案三 button → reveal sol3 group
  document.getElementById('l-sol3-add-btn')?.addEventListener('click', function() {
    var grp = document.getElementById('l-sol3-group');
    if (grp) grp.style.display = 'block';
    this.style.display = 'none';
  });

  // ── E step: per-solution textarea inputs save to nested perSolution
  document.querySelectorAll('.e-sol-input').forEach(function(el) {
    el.addEventListener('input', function() {
      var sol = el.dataset.sol;
      var f = el.dataset.field;
      if (!AppState.circlesFrameworkDraft.perSolution) AppState.circlesFrameworkDraft.perSolution = {};
      if (!AppState.circlesFrameworkDraft.perSolution[sol]) AppState.circlesFrameworkDraft.perSolution[sol] = {};
      AppState.circlesFrameworkDraft.perSolution[sol][f] = el.value;
      saveCirclesProgress({ frameworkDraft: AppState.circlesFrameworkDraft });
    });
  });

  // ── E step: 新增方案三 button → reveal sol3 block
  document.getElementById('e-sol3-add-btn')?.addEventListener('click', function() {
    var blk = document.getElementById('e-sol3-block');
    if (blk) blk.style.display = 'block';
    this.style.display = 'none';
  });

  // ── S step: tracking-block dim inputs save to nested tracking object
  document.querySelectorAll('.tracking-dim-input').forEach(function(el) {
    el.addEventListener('input', function() {
      var dim = el.dataset.trackingDim;
      if (!AppState.circlesFrameworkDraft.tracking) AppState.circlesFrameworkDraft.tracking = {};
      AppState.circlesFrameworkDraft.tracking[dim] = el.value;
      // Toggle .filled class for visual feedback
      if (el.value) el.classList.add('filled'); else el.classList.remove('filled');
      saveCirclesProgress({ frameworkDraft: AppState.circlesFrameworkDraft });
    });
  });

  // ── Hint trigger (提示) buttons — call showCirclesHint
  document.querySelectorAll('.circles-hint-trigger').forEach(function(el) {
    el.addEventListener('click', function() {
      var step = el.dataset.hintStep;
      var field = el.dataset.hintField;
      if (typeof showCirclesHint === 'function') showCirclesHint(step, field);
    });
  });

  // ── Collapsible field example toggle: 查看範例 / 收起範例
  // Examples are curated per-question in circles_database.json.field_examples,
  // served by the session-less /api/circles-public/example endpoint.
  // First open: fetch + cache. Subsequent toggles: instant from cache.
  document.querySelectorAll('.field-example-toggle').forEach(function(btn) {
    btn.addEventListener('click', async function() {
      var body = btn.nextElementSibling;
      if (!body || !body.classList.contains('field-example-body')) return;
      var stepKey = btn.dataset.exampleStep;
      var fieldKey = btn.dataset.exampleField;
      var question = AppState.circlesSelectedQuestion;
      var isOpen = body.classList.toggle('open');
      btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      btn.innerHTML = isOpen
        ? '<i class="ph ph-caret-down"></i> 收起範例'
        : '<i class="ph ph-caret-right"></i> 查看範例';
      if (!isOpen) return; // closing — no fetch needed

      if (body.dataset.loaded === '1') return;

      if (!AppState.circlesExamplesCache) AppState.circlesExamplesCache = {};
      var qid = question && question.id ? question.id : '';
      var cacheKey = qid + '|' + stepKey + '|' + fieldKey;

      var cached = AppState.circlesExamplesCache[cacheKey];
      if (cached === '__not_curated__') {
        body.innerHTML = '<span style="color:var(--c-text-3);font-size:11px">此題目暫無範例</span>';
        body.dataset.loaded = '1';
        return;
      }
      if (cached) {
        body.innerHTML = renderBulletText(cached);
        body.dataset.loaded = '1';
        return;
      }

      if (!qid) {
        body.innerHTML = '<span style="color:var(--c-text-3);font-size:11px">題目資訊缺失，無法載入範例</span>';
        body.dataset.loaded = '1';
        return;
      }

      body.innerHTML = '<span style="color:var(--c-text-3);font-size:11px">'
        + '<i class="ph ph-circle-notch" style="display:inline-block;animation:spin 0.8s linear infinite;font-size:10px;margin-right:4px"></i>載入範例…</span>';

      try {
        var resp = await fetch('/api/circles-public/example', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ questionId: qid, step: stepKey, field: fieldKey }),
        });
        if (resp.status === 404) {
          AppState.circlesExamplesCache[cacheKey] = '__not_curated__';
          if (body.classList.contains('open')) {
            body.innerHTML = '<span style="color:var(--c-text-3);font-size:11px">此題目暫無範例</span>';
            body.dataset.loaded = '1';
          }
          return;
        }
        var data = await resp.json();
        if (!resp.ok || !data.example) throw new Error(data.error || 'failed');
        AppState.circlesExamplesCache[cacheKey] = data.example;
        if (body.classList.contains('open')) {
          body.innerHTML = renderBulletText(data.example);
          body.dataset.loaded = '1';
        }
      } catch (e) {
        if (body.classList.contains('open')) {
          body.innerHTML = '<span style="color:var(--c-text-3);font-size:11px">範例載入失敗，請重試</span>';
          body.dataset.loaded = '1';
        }
      }
    });
  });

  // ── Phase 4.2 — S-step desktop sub-page tab switch
  document.querySelectorAll('.s-step-tab').forEach(function(btn) {
    btn.addEventListener('click', function() {
      AppState.circlesSStep = parseInt(btn.dataset.sStep, 10) || 1;
      render();
    });
  });

  // ── Prev-step-card toggle (E and S steps only)
  document.querySelectorAll('[data-prev-toggle]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var body = btn.nextElementSibling;
      if (!body) return;
      var open = body.style.display !== 'none';
      body.style.display = open ? 'none' : 'block';
      var caret = btn.querySelector('.toggle-caret');
      if (caret) caret.className = open ? 'ph ph-caret-right toggle-caret' : 'ph ph-caret-down toggle-caret';
    });
  });

  // keyboard handler — same pattern as NSM
  if (_adjustCirclesKbFn && window.visualViewport) {
    window.visualViewport.removeEventListener('resize', _adjustCirclesKbFn);
    window.visualViewport.removeEventListener('scroll', _adjustCirclesKbFn);
  }
  _adjustCirclesKbFn = (function() {
    var _raf = null;
    return function() {
      if (!window.visualViewport) return;
      if (_raf) return;
      _raf = requestAnimationFrame(function() {
        _raf = null;
        var bar = document.querySelector('.circles-submit-bar');
        if (!bar) return;
        var kbH = Math.max(0, window.innerHeight - window.visualViewport.offsetTop - window.visualViewport.height);
        bar.style.transform = 'translateY(-' + kbH + 'px)';
      });
    };
  }());
  var bar = document.querySelector('.circles-submit-bar');
  if (bar) bar.style.willChange = 'transform';
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', _adjustCirclesKbFn);
    window.visualViewport.addEventListener('scroll', _adjustCirclesKbFn);
    _adjustCirclesKbFn(); // run once on bind
  }

  document.getElementById('circles-p1-submit')?.addEventListener('click', async function() {
    var btn = this;

    // J8 — client-side pre-flight: at least 2 non-empty fields before calling /gate.
    var _fieldEls = Array.prototype.slice.call(
      document.querySelectorAll('.circles-field-input, .e-sol-input, .tracking-dim-input, .sol-name-input')
    );
    var _filled = _fieldEls.filter(function(el) { return (el.value || '').trim().length > 0; });
    var _MIN = 2;
    if (_fieldEls.length > 0 && _filled.length < _MIN) {
      var existingErr = document.getElementById('circles-p1-preflight-err');
      if (existingErr) existingErr.remove();
      var errEl = document.createElement('div');
      errEl.id = 'circles-p1-preflight-err';
      errEl.setAttribute('role', 'alert');
      errEl.style.cssText = 'color:var(--c-error,#d33);font-size:12px;padding:8px 12px;margin-top:6px';
      errEl.textContent = '請至少填寫 ' + _MIN + ' 個欄位再送出評分。';
      btn.parentNode && btn.parentNode.insertBefore(errEl, btn);
      var firstEmpty = _fieldEls.find(function(el) { return !(el.value || '').trim(); });
      if (firstEmpty) firstEmpty.focus();
      return;
    }

    btn.disabled = true;
    btn.textContent = 'AI 審核中...';

    // ── Snapshot Phase 1 draft into circlesStepDrafts[stepKey] for cross-step reads
    var mode2 = AppState.circlesMode;
    var stepKey2 = mode2 === 'drill' ? AppState.circlesDrillStep : (CIRCLES_STEPS[AppState.circlesSimStep || 0] || CIRCLES_STEPS[0]).key;
    var snapshot = JSON.parse(JSON.stringify(AppState.circlesFrameworkDraft || {}));
    AppState.circlesStepDrafts[stepKey2] = Object.assign({}, AppState.circlesStepDrafts[stepKey2] || {}, snapshot);
    // For L step, persist solution names canonical structure
    if (stepKey2 === 'L' && snapshot.solutionNames) {
      AppState.circlesStepDrafts.L = Object.assign({}, AppState.circlesStepDrafts.L || {}, snapshot.solutionNames);
    }

    AppState.circlesGateLoading = true;
    AppState.circlesPhase = 1.5;
    render();

    var q = AppState.circlesSelectedQuestion;
    var route = AppState.accessToken ? '/api/circles-sessions' : '/api/guest-circles-sessions';
    var headers = AppState.accessToken
      ? { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + AppState.accessToken }
      : { 'Content-Type': 'application/json', 'X-Guest-ID': AppState.guestId };

    try {
      // Create session if not yet created
      if (!AppState.circlesSession) {
        var createRes = await fetch(route, {
          method: 'POST',
          headers: headers,
          body: JSON.stringify({
            questionId: q.id,
            questionJson: q,
            mode: AppState.circlesMode,
            drillStep: AppState.circlesMode === 'drill' ? AppState.circlesDrillStep : null,
          }),
        });
        if (!createRes.ok) throw new Error('create_failed_' + createRes.status);
        var createData = await createRes.json();
        AppState.circlesSession = { id: createData.sessionId };
        AppState.offcanvasCache = null; // force fresh fetch on next offcanvas open
      }

      var gateRoute = (AppState.accessToken ? '/api/circles-sessions/' : '/api/guest-circles-sessions/') + AppState.circlesSession.id + '/gate';
      var gateRes = await fetch(gateRoute, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({ frameworkDraft: AppState.circlesFrameworkDraft }),
      });
      if (!gateRes.ok) throw new Error('gate_failed_' + gateRes.status);
      var gateData = await gateRes.json();
      AppState.circlesGateResult = gateData;
      AppState.circlesGateLoading = false;
      // Persist stepDrafts after gate succeeds
      saveCirclesProgress({ stepDrafts: AppState.circlesStepDrafts });
      render();
    } catch (e) {
      if (AppState.circlesSession && !AppState.circlesSession.id) AppState.circlesSession = null;
      AppState.circlesGateLoading = false;
      AppState.circlesPhase = 1;
      render();
    }
  });
}

// ──────────────────────────────────────────────────
// showCirclesHint — Screen 3 hint overlay (modal)
//   Always fetches AI-generated, question-specific hint via the session-less
//   public endpoint (`/api/circles-public/hint`). No more static Meta-themed
//   fallback — if generation fails, ask the user to retry.
// ──────────────────────────────────────────────────
async function showCirclesHint(step, field) {
  var q = AppState.circlesSelectedQuestion;

  // Remove any existing overlay
  var existing = document.getElementById('circles-hint-overlay');
  if (existing) existing.remove();

  var overlay = document.createElement('div');
  overlay.className = 'hint-overlay visible';
  overlay.id = 'circles-hint-overlay';
  overlay.innerHTML = '<div class="hint-card">' +
    '<button class="hint-close" id="hint-close-btn" type="button">×</button>' +
    '<div class="hint-title"><i class="ph ph-lightbulb"></i> ' + escHtml(field) + ' — 分析思路</div>' +
    '<div class="hint-sub">' + escHtml((q && q.company) || '') + (q && q.product ? ' · ' + escHtml(q.product) : '') + ' · ' + escHtml(step) + '</div>' +
    '<div id="hint-body-area" class="hint-loading">' +
      '<div style="display:inline-block;width:16px;height:16px;border:2px solid #ccc;border-top-color:var(--c-primary);border-radius:50%;animation:spin 0.8s linear infinite;margin-right:6px;vertical-align:middle"></div>' +
      '生成中…' +
    '</div>' +
  '</div>';
  document.body.appendChild(overlay);

  function close() {
    overlay.remove();
    document.removeEventListener('keydown', _onEsc);
  }
  function _onEsc(e) {
    if (e.key === 'Escape') { e.preventDefault(); close(); }
  }
  document.addEventListener('keydown', _onEsc);
  document.getElementById('hint-close-btn')?.addEventListener('click', close);
  overlay.addEventListener('click', function(e) { if (e.target === overlay) close(); });

  function renderHintBody(text) {
    var body = document.getElementById('hint-body-area');
    if (!body) return;
    // Render **bold** markdown to <strong> after HTML-escaping the rest.
    var rendered = escHtml(text).replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>');
    body.outerHTML = '<div class="hint-body">' + rendered + '</div>' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px">' +
        '<button id="hint-collapse-btn" type="button" style="font-size:11px;color:var(--c-text-3);background:none;border:none;cursor:pointer;font-family:DM Sans,sans-serif">收起提示</button>' +
        '<div class="hint-footer" style="margin-top:0">閱讀後自行填寫</div>' +
      '</div>';
    document.getElementById('hint-collapse-btn')?.addEventListener('click', close);
  }

  if (!q || !q.id) {
    renderHintBody('題目資訊缺失，無法生成提示');
    return;
  }

  try {
    var res = await fetch('/api/circles-public/hint', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId: q.id, step: step, field: field }),
    });
    if (res.ok) {
      var data = await res.json();
      renderHintBody(data.hint || '提示生成失敗，請重試');
      return;
    }
  } catch (e) { /* fall through */ }
  renderHintBody('提示生成失敗，請重試');
}
window.showCirclesHint = showCirclesHint;
function renderCirclesGate() {
  var loading = AppState.circlesGateLoading;
  var result = AppState.circlesGateResult;
  var mode = AppState.circlesMode;
  var stepKey = mode === 'drill' ? AppState.circlesDrillStep : 'C1';
  var stepIdx = CIRCLES_STEPS.findIndex(function(s) { return s.key === stepKey; });
  var step = CIRCLES_STEPS[stepIdx];
  var q = AppState.circlesSelectedQuestion;

  var progressSegs = CIRCLES_STEPS.map(function(s, i) {
    var cls = i < stepIdx ? 'done' : i === stepIdx ? 'done' : '';
    return '<div class="circles-progress-seg ' + cls + '"></div>';
  }).join('');

  var homeBtn = '<button style="font-size:12px;color:var(--c-primary);border-bottom:1px solid var(--c-primary);background:none;border-top:none;border-left:none;border-right:none;padding:2px 0;cursor:pointer;font-family:DM Sans,sans-serif;white-space:nowrap;flex-shrink:0" id="circles-gate-home">回首頁</button>';

  if (loading || !result) {
    return '<div data-view="circles">' +
      '<div class="circles-nav">' +
        '<div><div class="circles-nav-title">框架審核中</div><div class="circles-nav-sub">' + (q ? q.company : '') + '</div></div>' +
        homeBtn +
      '</div>' +
      '<div class="circles-progress">' + progressSegs + '<div class="circles-progress-label">' + step.short + ' · ' + step.label + '</div></div>' +
      '<div class="circles-gate-loading" id="circles-gate-loading"><i class="ph ph-circle-notch" style="font-size:28px;animation:spin 0.8s linear infinite;display:block;margin-bottom:12px"></i>AI 正在審核你的框架...<div style="font-size:12px;color:var(--c-text-3);margin-top:8px">通常需要 8-15 秒</div><div id="circles-gate-slow" style="font-size:12px;color:var(--c-warn-bold,#a60);margin-top:10px;display:none">回應較慢，請稍候 ‧ <button type="button" id="circles-gate-retry" style="background:none;border:none;color:var(--c-primary);text-decoration:underline;cursor:pointer;font-size:12px">重試</button></div></div>' +
    '</div>';
  }

  // New schema render: gate-item with icon + title + reason + suggestion
  var STATUS_ICON = { ok: 'ph-check-circle', warn: 'ph-warning', error: 'ph-x-circle' };
  var STATUS_COLOR = { ok: 'var(--c-ok-bold)', warn: 'var(--c-warn-bold)', error: 'var(--c-error)' };
  var items = (result.items || []).map(function(item) {
    var safeStatus = (item.status || '').replace(/[^a-z]/g, '');
    var icon = STATUS_ICON[safeStatus] || 'ph-circle';
    var color = STATUS_COLOR[safeStatus] || '#8a8a8a';
    var showSuggestion = (safeStatus === 'error' || safeStatus === 'warn') && item.suggestion;
    return '<div class="gate-item status-' + safeStatus + '">' +
      '<div class="gate-item-icon" style="color:' + color + '"><i class="ph ' + icon + '"></i></div>' +
      '<div class="gate-item-content">' +
        '<div class="gate-item-field">' + escHtml(item.field || '') + '</div>' +
        '<div class="gate-item-title">' + escHtml(item.title || '') + '</div>' +
        '<div class="gate-item-reason">' + escHtml(item.reason || '') + '</div>' +
        (showSuggestion ? '<div class="gate-item-suggestion">建議：' + escHtml(item.suggestion) + '</div>' : '') +
      '</div>' +
    '</div>';
  }).join('');

  var hasError = result.overallStatus === 'error';
  var isSimulation = mode === 'simulation';

  // Drill mode + error → canProceed=false from server → only 返回修改
  // Simulation mode → always show 繼續 button (even with errors)
  // Pass state: green transition bar with check + 繼續 button inline
  // Fail state: red bar (no inline button) + bottom bar with 返回修改 (and 繼續 if simulation)
  var transitionBar;
  if (hasError) {
    transitionBar = '<div class="gate-transition-bar gate-fail">' +
      '<div class="gate-transition-icon"><i class="ph-fill ph-x-circle"></i></div>' +
      '<div class="gate-transition-text">需要修正方向</div>' +
    '</div>';
  } else {
    // No error → pass (warn-only is still pass per spec)
    transitionBar = '<div class="gate-transition-bar gate-pass">' +
      '<div class="gate-transition-icon"><i class="ph-fill ph-check-circle"></i></div>' +
      '<div class="gate-transition-text">可以進入 Phase 2</div>' +
      '<button class="gate-continue-btn" id="circles-gate-continue">繼續</button>' +
    '</div>';
  }

  // Bottom bar: only needed for fail state (or simulation with error to allow override)
  var bottomBar = '';
  if (hasError) {
    if (isSimulation) {
      // Simulation mode + error: still allow continue but with warning text + 返回修改
      bottomBar = '<div class="circles-submit-bar">' +
        '<button class="circles-btn-primary" id="circles-gate-continue">帶著風險繼續 →</button>' +
        '<button class="circles-btn-ghost" id="circles-gate-fix">返回修改</button>' +
      '</div>';
    } else {
      // Drill mode + error: only 返回修改
      bottomBar = '<div class="circles-submit-bar">' +
        '<button class="circles-btn-primary" id="circles-gate-fix">返回修改</button>' +
      '</div>';
    }
  }

  return '<div data-view="circles">' +
    '<div class="circles-nav">' +
      '<button class="circles-nav-back" id="circles-gate-back"><i class="ph ph-arrow-left"></i></button>' +
      '<div>' +
        '<div class="circles-nav-title">框架審核結果</div>' +
        '<div class="circles-nav-sub">' + step.label + ' · ' + (q ? q.company : '') + '</div>' +
      '</div>' +
      homeBtn +
    '</div>' +
    '<div class="circles-progress">' + progressSegs + '<div class="circles-progress-label">' + step.short + ' · ' + step.label + '</div></div>' +
    '<div class="circles-gate-wrap">' +
      transitionBar +
      items +
    '</div>' +
    bottomBar +
  '</div>';
}

function bindCirclesGate() {
  // J9 — show "slow" affordance after 20s while gate is still loading
  if (AppState.circlesGateLoading) {
    var _slowTimer = setTimeout(function() {
      var slowEl = document.getElementById('circles-gate-slow');
      if (slowEl && AppState.circlesGateLoading) slowEl.style.display = 'block';
    }, 20000);
    var _loadingEl = document.getElementById('circles-gate-loading');
    if (_loadingEl) _loadingEl._slowTimer = _slowTimer;
    document.getElementById('circles-gate-retry')?.addEventListener('click', function() {
      AppState.circlesGateLoading = false;
      AppState.circlesPhase = 1;
      render();
    });
  }
  document.getElementById('circles-gate-back')?.addEventListener('click', function() {
    AppState.circlesPhase = 1;
    render();
  });
  document.getElementById('circles-gate-home')?.addEventListener('click', function() {
    navigate('circles');
  });
  document.getElementById('circles-gate-fix')?.addEventListener('click', function() {
    AppState.circlesPhase = 1;
    render();
  });
  // Both inline (pass state) and bottom-bar (simulation override) use #circles-gate-continue
  document.getElementById('circles-gate-continue')?.addEventListener('click', function() {
    AppState.circlesPhase = 2;
    render();
  });
}
function renderCirclesPhase2() {
  var q = AppState.circlesSelectedQuestion;
  var mode = AppState.circlesMode;
  var stepKey = AppState.circlesDrillStep;
  var stepIdx = CIRCLES_STEPS.findIndex(function(s) { return s.key === stepKey; });
  var step = CIRCLES_STEPS[stepIdx];
  var conv = AppState.circlesConversation;
  var turnCount = conv.length;
  var submitState = AppState.circlesSubmitState; // null | 'collapsed' | 'expanded'
  var conclusionText = AppState.circlesConclusionText || '';
  var stepConfig = (CIRCLES_STEP_CONFIG && CIRCLES_STEP_CONFIG[stepKey]) || {};

  var progressSegs = CIRCLES_STEPS.map(function(s, i) {
    var cls = i < stepIdx ? 'done' : i === stepIdx ? 'active' : '';
    return '<div class="circles-progress-seg ' + cls + '"></div>';
  }).join('');

  // Icebreaker card (first element in chat body, all steps)
  var icebreakerHtml = stepConfig.icebreaker
    ? '<div class="circles-icebreaker">' +
        '<div class="circles-icebreaker-label"><i class="ph ph-compass"></i> 開始提問方向</div>' +
        '<div class="circles-icebreaker-text">' + escHtml(stepConfig.icebreaker) + '</div>' +
      '</div>'
    : '';

  // Chat turns: user bubble + 被訪談者 bubble + 教練點評 bubble (with collapsed 教練提示)
  var bubbles = conv.map(function(t) {
    var userBubble = '<div class="circles-bubble-user">' + escHtml(t.userMessage) + '</div>';
    var intervieweeBubble = t.interviewee
      ? '<div class="circles-bubble-ai"><div class="circles-bubble-section">被訪談者</div>' + t.interviewee + '</div>'
      : '';
    var coachingBubble = '';
    if (t.coaching || t.hint) {
      coachingBubble = '<div class="circles-bubble-ai" style="font-size:11px;padding:8px 10px">' +
        '<div class="circles-bubble-section">教練點評</div>' +
        (t.coaching || '');
      if (t.hint) {
        coachingBubble += '<div style="margin-top:6px">' +
          '<button onclick="toggleCoachHint(this)" style="background:none;border:none;font-size:11px;color:var(--c-text-3,#8a8a8a);cursor:pointer;padding:0;font-family:\'DM Sans\',sans-serif;display:flex;align-items:center;gap:3px">' +
            '<i class="ph ph-caret-right" style="font-size:10px"></i> 查看教練提示' +
          '</button>' +
          '<div style="display:none;margin-top:4px;padding:6px 8px;background:rgba(0,0,0,0.04);border-radius:6px;color:var(--c-text-2,#5a5a5a);font-size:11px;line-height:1.5">' +
            t.hint +
          '</div>' +
        '</div>';
      }
      coachingBubble += '</div>';
    }
    return userBubble + intervieweeBubble + coachingBubble;
  }).join('');

  // Pinned question card
  var pinnedCard = q ? (
    '<div class="circles-pinned-card" id="circles-pinned-card">' +
      '<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">' +
        '<span style="background:#EEF3FF;color:var(--c-primary);border-radius:4px;padding:1px 6px;font-size:9px;font-weight:700">' + escHtml(q.company) + '</span>' +
      '</div>' +
      '<div style="font-size:11px;color:#1a1a1a;font-weight:600;line-height:1.4" id="circles-pinned-stmt">' + escHtml(q.problem_statement.slice(0, 80)) + (q.problem_statement.length > 80 ? '…' : '') + '</div>' +
      (q.problem_statement.length > 80 ? '<div id="circles-pinned-toggle" style="font-size:10px;color:var(--c-primary);cursor:pointer;margin-top:2px">展開 ▾</div>' : '') +
    '</div>'
  ) : '';

  // Bottom section: input bar OR collapsed strip OR conclusion box
  var bottomSection;
  if (submitState === 'expanded') {
    // Conclusion box (states 4 & 5)
    var subText = stepConfig.conclusionSub || '說明本步驟的關鍵結論';
    var placeholder = stepConfig.conclusionPlaceholder || '針對這題，整理你確認的關鍵資訊…';
    var exampleText = stepConfig.conclusionExample || '';
    var detectionHtml = '<div id="circles-conclusion-hint" class="conclusion-hint"></div>';
    bottomSection = '<div class="circles-conclusion-box" id="circles-conclusion-box">' +
      '<div class="conclusion-title">整理你這個步驟確認了什麼</div>' +
      '<div class="conclusion-sub">' + escHtml(subText) + '</div>' +
      '<div class="conclusion-example-block" id="circles-example-block">' +
        '<div class="conclusion-example-header" id="circles-example-header">' +
          '<div class="conclusion-example-label">範例（不同題目）</div>' +
          '<div class="conclusion-example-toggle" id="circles-example-toggle-label">展開 ▾</div>' +
        '</div>' +
        '<div class="conclusion-example-content" id="circles-example-content" style="display:none">' + escHtml(exampleText) + '</div>' +
      '</div>' +
      '<div class="rt-field">' +
        '<div class="rt-toolbar">' +
          '<button type="button" class="rt-tbtn" data-rt-action="bold" title="粗體 (Ctrl+B)" aria-label="粗體"><strong>B</strong></button>' +
          '<button type="button" class="rt-tbtn" data-rt-action="bullet" title="列點 (Ctrl+L)" aria-label="列點"><i class="ph ph-list-bullets"></i></button>' +
          '<button type="button" class="rt-tbtn" data-rt-action="indent" title="縮排 (Tab)" aria-label="增加縮排"><i class="ph ph-text-indent"></i></button>' +
          '<button type="button" class="rt-tbtn" data-rt-action="outdent" title="退縮 (Shift+Tab)" aria-label="減少縮排"><i class="ph ph-text-outdent"></i></button>' +
        '</div>' +
        '<textarea id="circles-conclusion-input" class="conclusion-textarea rt-textarea" rows="5" placeholder="' + escHtml(placeholder) + '">' + escTextarea(conclusionText) + '</textarea>' +
      '</div>' +
      detectionHtml +
      '<div class="conclusion-actions">' +
        '<button id="circles-conclusion-back" class="conclusion-back-btn">← 繼續對話</button>' +
        '<button id="circles-conclusion-submit" class="conclusion-submit-btn disabled" disabled>確認提交</button>' +
      '</div>' +
    '</div>';
  } else if (submitState === 'collapsed') {
    // Collapsed strip (state 3)
    bottomSection = '<div class="circles-submit-strip" id="circles-submit-strip">' +
      '<div>' +
        '<div class="strip-label">整理結論</div>' +
        '<div class="strip-sub">翻閱完對話後，點右側展開填寫</div>' +
      '</div>' +
      '<button id="circles-strip-expand" class="strip-expand-btn">展開填寫 ▲</button>' +
    '</div>';
  } else {
    // Normal input bar (states 1 & 2). Submit row only shown when turns ≥ 3 (state 2)
    bottomSection = '<div class="circles-input-bar" id="circles-input-bar">' +
      '<textarea class="circles-input" id="circles-msg-input" placeholder="輸入你的問題..." rows="1"></textarea>' +
      '<button class="circles-send-btn" id="circles-send-btn"><i class="ph ph-paper-plane-tilt"></i></button>' +
    '</div>' +
    (turnCount >= 3
      ? '<div class="circles-submit-row" id="circles-submit-row">' +
          '<button id="circles-submit-step" class="circles-submit-step-btn">對話足夠了，提交這個步驟</button>' +
        '</div>'
      : '');
  }

  // Dim chat body when conclusion box is open
  var chatBodyAttrs = (submitState === 'expanded')
    ? ' style="opacity:0.45;pointer-events:none"'
    : '';

  // Phase 4.3 — desktop wrapper class (max-width 920 from CSS)
  var _phase2DesktopCls = (typeof isDesktop === 'function' && isDesktop()) ? ' phase2-desktop' : '';

  return '<div data-view="circles" class="circles-chat-wrap' + _phase2DesktopCls + '">' +
    '<div class="circles-nav">' +
      '<button class="circles-nav-back" id="circles-p2-back"><i class="ph ph-arrow-left"></i></button>' +
      '<div>' +
        '<div class="circles-nav-title">' + step.label + ' — 對話練習</div>' +
        '<div class="circles-nav-sub">' + (q ? escHtml(q.company) : '') + '</div>' +
      '</div>' +
      (turnCount > 0 && !submitState ? '<div class="circles-nav-right">' + turnCount + ' 輪</div>' : '') +
      '<button class="circles-nav-home-btn" id="circles-p2-home">回首頁</button>' +
    '</div>' +
    '<div class="circles-progress">' + progressSegs + '<div class="circles-progress-label">' + step.short + ' · ' + step.label + ' · ' + (stepIdx + 1) + '/7</div></div>' +
    pinnedCard +
    '<div class="circles-chat-body" id="circles-chat-body"' + chatBodyAttrs + '>' + icebreakerHtml + bubbles + '<div id="circles-streaming-bubble"></div></div>' +
    bottomSection +
  '</div>';
}

// Toggle coach hint visibility (used inline in render output)
function toggleCoachHint(btn) {
  if (!btn) return;
  var content = btn.nextElementSibling;
  if (!content) return;
  var isOpen = content.style.display !== 'none';
  content.style.display = isOpen ? 'none' : 'block';
  var icon = btn.querySelector('i');
  if (icon) icon.className = isOpen ? 'ph ph-caret-right' : 'ph ph-caret-down';
  btn.style.color = isOpen ? 'var(--c-text-3,#8a8a8a)' : 'var(--c-primary,var(--c-primary))';
}

function bindCirclesPhase2() {
  // Keyboard avoidance (unchanged)
  if (_adjustCirclesKbFn && window.visualViewport) {
    window.visualViewport.removeEventListener('resize', _adjustCirclesKbFn);
    window.visualViewport.removeEventListener('scroll', _adjustCirclesKbFn);
  }
  _adjustCirclesKbFn = (function() {
    var _raf = null;
    return function() {
      if (!window.visualViewport) return;
      if (_raf) return;
      _raf = requestAnimationFrame(function() {
        _raf = null;
        var bar = document.getElementById('circles-input-bar') || document.getElementById('circles-submit-strip') || document.getElementById('circles-conclusion-box');
        var body = document.getElementById('circles-chat-body');
        if (!bar) return;
        var kbH = Math.max(0, window.innerHeight - window.visualViewport.offsetTop - window.visualViewport.height);
        bar.style.transform = 'translateY(-' + kbH + 'px)';
        if (body) body.style.paddingBottom = (bar.offsetHeight + kbH) + 'px';
      });
    };
  }());
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', _adjustCirclesKbFn);
    window.visualViewport.addEventListener('scroll', _adjustCirclesKbFn);
    _adjustCirclesKbFn();
  }

  // Back button
  document.getElementById('circles-p2-back')?.addEventListener('click', function() {
    AppState.circlesPhase = 1.5;
    AppState.circlesSubmitState = null;
    render();
  });

  // 回首頁 button (returns to CIRCLES home, navigation rule)
  document.getElementById('circles-p2-home')?.addEventListener('click', function() {
    AppState.circlesSelectedQuestion = null;
    AppState.circlesSession = null;
    AppState.circlesPhase = 1;
    AppState.circlesSubmitState = null;
    AppState.circlesConclusionText = '';
    AppState.circlesConversation = [];
    AppState.circlesScoreResult = null;
    AppState.circlesFinalReport = null;
    AppState.circlesStepScores = {};
    navigate('circles');
  });

  // Auto-scroll chat
  var chatBody = document.getElementById('circles-chat-body');
  if (chatBody) chatBody.scrollTop = chatBody.scrollHeight;

  // Pinned card expand
  document.getElementById('circles-pinned-toggle')?.addEventListener('click', function() {
    var stmtEl = document.getElementById('circles-pinned-stmt');
    var q = AppState.circlesSelectedQuestion;
    if (!q) return;
    var expanded = this.dataset.expanded === 'true';
    if (expanded) {
      stmtEl.textContent = q.problem_statement.slice(0, 80) + '…';
      this.textContent = '展開 ▾';
      this.dataset.expanded = 'false';
    } else {
      stmtEl.textContent = q.problem_statement;
      this.textContent = '收起 ▴';
      this.dataset.expanded = 'true';
    }
  });

  // Submit step button (normal state → collapsed strip)
  document.getElementById('circles-submit-step')?.addEventListener('click', function() {
    AppState.circlesSubmitState = 'collapsed';
    render();
  });

  // Strip expand button (collapsed → expanded conclusion box)
  document.getElementById('circles-strip-expand')?.addEventListener('click', function() {
    AppState.circlesSubmitState = 'expanded';
    render();
  });

  // Back to chat (conclusion box → collapsed)
  document.getElementById('circles-conclusion-back')?.addEventListener('click', function() {
    AppState.circlesSubmitState = 'collapsed';
    render();
  });

  // Example block toggle
  document.getElementById('circles-example-header')?.addEventListener('click', function() {
    var content = document.getElementById('circles-example-content');
    var label = document.getElementById('circles-example-toggle-label');
    if (!content) return;
    var hidden = content.style.display === 'none';
    content.style.display = hidden ? 'block' : 'none';
    if (label) label.textContent = hidden ? '收起 ▴' : '展開 ▾';
  });

  // Conclusion textarea — 8 second debounce → AI detection (states 4 & 5)
  var _conclusionTimer = null;
  var _lastChecked = '';
  document.getElementById('circles-conclusion-input')?.addEventListener('input', function() {
    var text = this.value;
    AppState.circlesConclusionText = text;
    var hintEl = document.getElementById('circles-conclusion-hint');
    var submitBtn = document.getElementById('circles-conclusion-submit');
    if (hintEl) { hintEl.textContent = ''; hintEl.className = 'conclusion-hint'; }
    if (submitBtn) { submitBtn.disabled = true; submitBtn.classList.add('disabled'); }
    if (_conclusionTimer) clearTimeout(_conclusionTimer);
    if (!text.trim() || text.trim().length < 10) return;
    if (text === _lastChecked) return;
    _conclusionTimer = setTimeout(async function() {
      _lastChecked = text;
      var session = AppState.circlesSession;
      if (!session) return;
      if (hintEl) { hintEl.textContent = '分析中…'; hintEl.className = 'conclusion-hint'; }
      try {
        var headers = { 'Content-Type': 'application/json' };
        if (AppState.accessToken) headers['Authorization'] = 'Bearer ' + AppState.accessToken;
        else headers['X-Guest-ID'] = AppState.guestId;
        var baseUrl = (AppState.accessToken ? '/api/circles-sessions/' : '/api/guest-circles-sessions/') + session.id + '/conclusion-check';
        var res = await fetch(baseUrl, { method: 'POST', headers: headers, body: JSON.stringify({ conclusionText: text }) });
        var data = await res.json();
        if (!document.getElementById('circles-conclusion-hint')) return;
        var hintEl2 = document.getElementById('circles-conclusion-hint');
        var submitBtn2 = document.getElementById('circles-conclusion-submit');
        if (data.ok) {
          if (hintEl2) { hintEl2.innerHTML = '<i class="ph ph-check-circle"></i> ' + (data.message || '結論完整，可以提交'); hintEl2.className = 'conclusion-hint pass'; }
          if (submitBtn2) { submitBtn2.disabled = false; submitBtn2.classList.remove('disabled'); }
        } else {
          if (hintEl2) { hintEl2.innerHTML = '<i class="ph ph-warning"></i> ' + (data.message || '結論尚未涵蓋關鍵維度'); hintEl2.className = 'conclusion-hint warn'; }
        }
      } catch (_) {
        var hintEl3 = document.getElementById('circles-conclusion-hint');
        if (hintEl3) { hintEl3.textContent = ''; hintEl3.className = 'conclusion-hint'; }
      }
    }, 8000);
  });

  // Confirm submit — save conclusion, trigger evaluation
  document.getElementById('circles-conclusion-submit')?.addEventListener('click', async function() {
    var btn = this;
    btn.disabled = true;
    btn.textContent = '評分中...';
    btn.classList.add('disabled');

    var session = AppState.circlesSession;
    var conclusionText = AppState.circlesConclusionText;
    var stepKey = AppState.circlesDrillStep;
    if (!session || !session.id) { render(); return; }

    // Store conclusion locally for report page
    if (!AppState.circlesStepConclusions) AppState.circlesStepConclusions = {};
    AppState.circlesStepConclusions[stepKey] = conclusionText;
    if (!AppState.circlesStepScores) AppState.circlesStepScores = {};

    var headers = AppState.accessToken
      ? { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + AppState.accessToken }
      : { 'Content-Type': 'application/json', 'X-Guest-ID': AppState.guestId };

    var route = (AppState.accessToken ? '/api/circles-sessions/' : '/api/guest-circles-sessions/') + session.id + '/evaluate-step';
    try {
      var res = await fetch(route, { method: 'POST', headers: headers });
      var scoreData = await res.json();
      if (!res.ok) throw new Error(scoreData.error || res.status);
      AppState.circlesScoreResult = scoreData;
      if (!AppState.circlesStepScores) AppState.circlesStepScores = {};
      AppState.circlesStepScores[stepKey] = scoreData;
      AppState.circlesSubmitState = null;
      AppState.circlesConclusionText = '';
      AppState.circlesPhase = 3;
      render();
    } catch (e) {
      btn.disabled = false;
      btn.textContent = '確認提交';
      btn.classList.remove('disabled');
    }
  });

  // Normal send message
  document.getElementById('circles-send-btn')?.addEventListener('click', sendCirclesMessage);
  document.getElementById('circles-msg-input')?.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendCirclesMessage(); }
  });
}

async function sendCirclesMessage() {
  var input = document.getElementById('circles-msg-input');
  var sendBtn = document.getElementById('circles-send-btn');
  var submitBtn = document.getElementById('circles-submit-step');
  if (!input || AppState.isStreaming) return;
  var msg = input.value.trim();
  if (!msg) return;

  input.value = '';
  AppState.isStreaming = true;
  if (sendBtn) sendBtn.disabled = true;

  // Show user bubble immediately
  var chatBody = document.getElementById('circles-chat-body');
  var userBubble = document.createElement('div');
  userBubble.className = 'circles-bubble-user';
  userBubble.textContent = msg;
  var streamingBubble = document.getElementById('circles-streaming-bubble');
  if (chatBody) {
    chatBody.appendChild(userBubble);
    // Move streaming bubble after user bubble so AI response follows user message
    if (streamingBubble) chatBody.appendChild(streamingBubble);
    chatBody.scrollTop = chatBody.scrollHeight;
  }
  if (streamingBubble) {
    streamingBubble.innerHTML = '<div class="circles-bubble-ai"><i class="ph ph-circle-notch" style="animation:spin 0.8s linear infinite"></i> <span style="font-size:11px;color:var(--c-text-3)">通常需要 8-15 秒</span></div>';
  }
  // J9 — after 20s, show "回應較慢" with retry hint inside the streaming bubble
  var _chatSlowTimer = setTimeout(function() {
    if (!AppState.isStreaming) return;
    var sb = document.getElementById('circles-streaming-bubble');
    if (!sb) return;
    // Only show if no AI text has rendered yet (still spinner)
    if (sb.querySelector('.circles-bubble-section')) return;
    sb.innerHTML = '<div class="circles-bubble-ai"><i class="ph ph-circle-notch" style="animation:spin 0.8s linear infinite"></i> <span style="font-size:11px;color:var(--c-warn-bold,#a60)">回應較慢，請稍候…</span></div>';
  }, 20000);

  var session = AppState.circlesSession;
  if (!session || !session.id) { AppState.isStreaming = false; return; }

  var headers = AppState.accessToken
    ? { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + AppState.accessToken }
    : { 'Content-Type': 'application/json', 'X-Guest-ID': AppState.guestId };

  var route = (AppState.accessToken ? '/api/circles-sessions/' : '/api/guest-circles-sessions/') + session.id + '/message';

  try {
    var res = await fetch(route, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({ userMessage: msg }),
    });

    var reader = res.body.getReader();
    var decoder = new TextDecoder();
    var buffer = '';
    var fullText = '';

    while (true) {
      var readResult = await reader.read();
      if (readResult.done) break;
      buffer += decoder.decode(readResult.value, { stream: true });
      var lines = buffer.split('\n');
      buffer = lines.pop();
      for (var i = 0; i < lines.length; i++) {
        var line = lines[i];
        if (!line.startsWith('data: ')) continue;
        try {
          var parsed = JSON.parse(line.slice(6));
          if (parsed.delta) {
            fullText += parsed.delta;
            var interviewee = fullText.match(/【被訪談者】\n([\s\S]*?)(?=【教練點評】|$)/)?.[1]?.trim() || '';
            var coaching = fullText.match(/【教練點評】\n([\s\S]*?)(?=【教練提示】|$)/)?.[1]?.trim() || '';
            var hint = fullText.match(/【教練提示】\n([\s\S]*?)$/)?.[1]?.trim() || '';
            if (streamingBubble) {
              var coachingHtml = '';
              if (coaching || hint) {
                coachingHtml = '<div class="circles-bubble-ai" style="font-size:11px;padding:8px 10px"><div class="circles-bubble-section">教練點評</div>' + (coaching || '');
                if (hint) {
                  coachingHtml += '<div style="margin-top:6px">' +
                    '<button onclick="toggleCoachHint(this)" style="background:none;border:none;font-size:11px;color:var(--c-text-3,#8a8a8a);cursor:pointer;padding:0;font-family:\'DM Sans\',sans-serif;display:flex;align-items:center;gap:3px">' +
                      '<i class="ph ph-caret-right" style="font-size:10px"></i> 查看教練提示' +
                    '</button>' +
                    '<div style="display:none;margin-top:4px;padding:6px 8px;background:rgba(0,0,0,0.04);border-radius:6px;color:var(--c-text-2,#5a5a5a);font-size:11px;line-height:1.5">' + hint + '</div>' +
                  '</div>';
                }
                coachingHtml += '</div>';
              }
              streamingBubble.innerHTML =
                (interviewee ? '<div class="circles-bubble-ai"><div class="circles-bubble-section">被訪談者</div>' + interviewee + '</div>' : '') +
                coachingHtml;
              chatBody.scrollTop = chatBody.scrollHeight;
            }
          }
          if (parsed.done && parsed.turn) {
            AppState.circlesConversation.push(parsed.turn);
            render();
          }
        } catch (_) {}
      }
    }
  } catch (e) {
    if (streamingBubble) streamingBubble.innerHTML = '<div class="circles-bubble-ai">連線錯誤，請重試。</div>';
  }

  AppState.isStreaming = false;
  if (sendBtn) sendBtn.disabled = false;
  clearTimeout(_chatSlowTimer);
}
function renderCirclesStepScore() {
  var result = AppState.circlesScoreResult;
  var mode = AppState.circlesMode;
  var stepKey = AppState.circlesDrillStep;
  var stepIdx = CIRCLES_STEPS.findIndex(function(s) { return s.key === stepKey; });
  var step = CIRCLES_STEPS[stepIdx];
  var q = AppState.circlesSelectedQuestion;
  var stepScores = AppState.circlesStepScores || {};

  if (!result) {
    return '<div data-view="circles"><div style="text-align:center;padding:48px 16px;font-family:DM Sans,sans-serif">評分結果載入中...</div></div>';
  }

  var progressSegs = CIRCLES_STEPS.map(function(s, i) {
    var cls = i <= stepIdx ? 'done' : '';
    return '<div class="circles-progress-seg ' + cls + '"></div>';
  }).join('');

  // 4-dimension breakdown with visual bars (0-5 fill)
  var dims = (result.dimensions || []).map(function(d) {
    var score = Number(d.score) || 0;
    var pct = Math.max(0, Math.min(100, (score / 5) * 100));
    return '<div class="circles-dim-row">' +
      '<div class="circles-dim-row-main">' +
        '<div class="circles-dim-row-head">' +
          '<div class="circles-dim-name">' + escHtml(d.name) + '</div>' +
          '<div class="circles-dim-score">' + score + '<span>/5</span></div>' +
        '</div>' +
        '<div class="circles-dim-bar-wrap"><div class="circles-dim-bar-fill" style="width:' + pct + '%"></div></div>' +
        '<div class="circles-dim-comment">' + escHtml(d.comment || '') + '</div>' +
      '</div>' +
    '</div>';
  }).join('');

  var coachContent = escHtml(result.coachVersion || '');
  var coachOpen = !!AppState.circlesCoachOpen;
  var isLastStep = stepIdx === 6;

  // Score nav row (simulation mode only): ◀ {prev} | {current} | {next} ▶
  var scoreNavRow = '';
  if (mode === 'simulation') {
    var prevStep = stepIdx > 0 ? CIRCLES_STEPS[stepIdx - 1] : null;
    var nextStep = stepIdx < 6 ? CIRCLES_STEPS[stepIdx + 1] : null;
    var prevAvailable = prevStep && stepScores[prevStep.key];
    var nextAvailable = nextStep && stepScores[nextStep.key];
    scoreNavRow = '<div class="circles-score-nav-row">' +
      '<button class="circles-score-nav-arrow" id="circles-score-prev" ' + (prevAvailable ? '' : 'disabled') + '>' +
        '<i class="ph ph-caret-left"></i>' +
        '<span>' + (prevStep ? escHtml(prevStep.short + ' ' + prevStep.label) : '—') + '</span>' +
      '</button>' +
      '<div class="circles-score-nav-current">' + escHtml(step.short + ' ' + step.label) + '</div>' +
      '<button class="circles-score-nav-arrow right" id="circles-score-nav-next" ' + (nextAvailable ? '' : 'disabled') + '>' +
        '<span>' + (nextStep ? escHtml(nextStep.short + ' ' + nextStep.label) : '—') + '</span>' +
        '<i class="ph ph-caret-right"></i>' +
      '</button>' +
    '</div>';
  }

  // Bottom submit-bar variants
  var submitBar;
  if (mode === 'simulation' && isLastStep) {
    submitBar =
      '<button class="circles-btn-ghost" id="circles-score-home">回首頁</button>' +
      '<button class="circles-btn-primary" id="circles-score-final">看完整總結報告</button>';
  } else if (mode === 'simulation') {
    var nxt = CIRCLES_STEPS[stepIdx + 1];
    submitBar =
      '<button class="circles-btn-ghost" id="circles-score-home">回首頁</button>' +
      '<button class="circles-btn-primary" id="circles-score-next">繼續下一步：' + escHtml(nxt.label) + ' →</button>';
  } else {
    // drill mode (any step) — 再練一次
    submitBar =
      '<button class="circles-btn-ghost" id="circles-score-home">回首頁</button>' +
      '<button class="circles-btn-primary" id="circles-score-again">再練一次</button>';
  }

  // One-line summary subtext under big score
  var summaryLine = step.short + ' — ' + step.label + ' 步驟得分';

  // Phase 4.4 — desktop wrapper class
  var _phase3DesktopCls = (typeof isDesktop === 'function' && isDesktop()) ? ' phase3-desktop' : '';

  return '<div data-view="circles" class="' + _phase3DesktopCls.trim() + '">' +
    '<div class="circles-nav">' +
      '<button class="circles-nav-back" id="circles-score-back"><i class="ph ph-arrow-left"></i></button>' +
      '<div style="flex:1;min-width:0">' +
        '<div class="circles-nav-title">' + escHtml(step.label) + ' 評分結果</div>' +
        '<div class="circles-nav-sub">' + escHtml(q ? (q.company + (q.product ? ' · ' + q.product : '')) : '') + '</div>' +
      '</div>' +
      '<button class="circles-nav-home-btn" id="circles-score-home-btn">回首頁</button>' +
    '</div>' +
    scoreNavRow +
    '<div class="circles-progress">' + progressSegs + '<div class="circles-progress-label">' + step.short + ' · ' + step.label + ' · ' + (stepIdx + 1) + '/7</div></div>' +
    '<div class="circles-score-wrap">' +
      '<div class="circles-score-total">' +
        '<div class="circles-score-number">' + Math.round(result.totalScore || 0) + '</div>' +
        '<div class="circles-score-sub">' + escHtml(summaryLine) + '</div>' +
      '</div>' +
      '<div class="circles-score-breakdown">' + dims + '</div>' +
      '<div class="circles-highlight-card good"><div class="circles-highlight-card-label">最強表現</div><div class="circles-highlight-card-text">' + escHtml(result.highlight || '—') + '</div></div>' +
      '<div class="circles-highlight-card improve"><div class="circles-highlight-card-label">最需改進</div><div class="circles-highlight-card-text">' + escHtml(result.improvement || '—') + '</div></div>' +
      '<div class="circles-coach-toggle" id="circles-coach-toggle">' +
        '<div class="circles-coach-toggle-label">教練示範答案 <i class="ph ' + (coachOpen ? 'ph-caret-up' : 'ph-caret-down') + '" id="circles-coach-icon"></i></div>' +
        '<div class="circles-coach-content' + (coachOpen ? ' open' : '') + '" id="circles-coach-content">' + coachContent + '</div>' +
      '</div>' +
      '<div class="circles-submit-bar circles-submit-bar-row">' + submitBar + '</div>' +
    '</div>' +
  '</div>';
}

function bindCirclesStepScore() {
  // Back arrow → return to Phase 2
  document.getElementById('circles-score-back')?.addEventListener('click', function() {
    AppState.circlesPhase = 2;
    render();
  });

  // Coach toggle → expand/collapse, flip icon, persist state in AppState
  document.getElementById('circles-coach-toggle')?.addEventListener('click', function() {
    var content = document.getElementById('circles-coach-content');
    var icon = document.getElementById('circles-coach-icon');
    if (!content) return;
    var open = !content.classList.contains('open');
    content.classList.toggle('open', open);
    if (icon) icon.className = open ? 'ph ph-caret-up' : 'ph ph-caret-down';
    AppState.circlesCoachOpen = open;
  });

  // 回首頁 (nav top-right + bottom submit bar) — same handler
  function goHome() {
    AppState.circlesSelectedQuestion = null;
    AppState.circlesSession = null;
    AppState.circlesPhase = 1;
    AppState.circlesScoreResult = null;
    AppState.circlesFinalReport = null;
    AppState.circlesStepScores = {};
    AppState.circlesSimStep = 0;
    AppState.circlesCoachOpen = false;
    navigate('circles');
  }
  document.getElementById('circles-score-home')?.addEventListener('click', goHome);
  document.getElementById('circles-score-home-btn')?.addEventListener('click', goHome);

  // 看完整總結報告 (simulation last step S)
  document.getElementById('circles-score-final')?.addEventListener('click', function() {
    AppState.circlesPhase = 4;
    AppState.circlesCoachOpen = false;
    render();
  });

  // 再練一次 (drill mode) → reset Phase to 1, clear framework, stay on same screen
  document.getElementById('circles-score-again')?.addEventListener('click', function() {
    AppState.circlesSession = null;
    AppState.circlesPhase = 1;
    AppState.circlesFrameworkDraft = {};
    AppState.circlesGateResult = null;
    AppState.circlesConversation = [];
    AppState.circlesScoreResult = null;
    AppState.circlesFinalReport = null;
    AppState.circlesStepScores = {};
    AppState.circlesCoachOpen = false;
    render();
  });

  // 繼續下一步 (simulation mid-step) → advance simStep, render Phase 1 of next step
  document.getElementById('circles-score-next')?.addEventListener('click', function() {
    var stepIdx = CIRCLES_STEPS.findIndex(function(s) { return s.key === AppState.circlesDrillStep; });
    if (stepIdx < 6) {
      var nextStep = CIRCLES_STEPS[stepIdx + 1];
      AppState.circlesDrillStep = nextStep.key;
      AppState.circlesPhase = 1;
      AppState.circlesFrameworkDraft = {};
      AppState.circlesGateResult = null;
      AppState.circlesConversation = [];
      AppState.circlesScoreResult = null;
      AppState.circlesSimStep = stepIdx + 1;
      AppState.circlesCoachOpen = false;
      saveCirclesProgress({ currentPhase: 1, simStepIndex: stepIdx + 1 });
      render();
    }
  });

  // Score nav ◀ (simulation only) → switch displayed score using cache, no re-fetch
  document.getElementById('circles-score-prev')?.addEventListener('click', function() {
    var idx = CIRCLES_STEPS.findIndex(function(s) { return s.key === AppState.circlesDrillStep; });
    if (idx <= 0) return;
    var prevKey = CIRCLES_STEPS[idx - 1].key;
    var cached = (AppState.circlesStepScores || {})[prevKey];
    if (!cached) return;
    AppState.circlesDrillStep = prevKey;
    AppState.circlesScoreResult = cached;
    AppState.circlesCoachOpen = false;
    render();
  });

  // Score nav ▶ (simulation only) → switch displayed score using cache, no re-fetch
  document.getElementById('circles-score-nav-next')?.addEventListener('click', function() {
    var idx = CIRCLES_STEPS.findIndex(function(s) { return s.key === AppState.circlesDrillStep; });
    if (idx >= 6) return;
    var nextKey = CIRCLES_STEPS[idx + 1].key;
    var cached = (AppState.circlesStepScores || {})[nextKey];
    if (!cached) return;
    AppState.circlesDrillStep = nextKey;
    AppState.circlesScoreResult = cached;
    AppState.circlesCoachOpen = false;
    render();
  });
}

function renderCirclesFinalReport() {
  var report = AppState.circlesFinalReport;
  var q = AppState.circlesSelectedQuestion;
  var stepScores = AppState.circlesStepScores || {};

  var navBar = '<div class="circles-nav">' +
    '<div><div class="circles-nav-title">模擬面試總結報告</div>' +
    '<div class="circles-nav-sub">' + (q ? escHtml(q.company) + ' · ' + escHtml(q.product || '') : '') + '</div></div>' +
    '</div>';

  if (!report) {
    return '<div data-view="circles">' + navBar +
      '<div style="text-align:center;padding:48px 16px;font-family:DM Sans,sans-serif">' +
        '<div style="font-size:32px;margin-bottom:12px">⏳</div>' +
        '<div style="color:#5a5a5a;font-size:14px">生成總結報告中…</div>' +
      '</div></div>';
  }

  if (report._error) {
    return '<div data-view="circles">' + navBar +
      '<div style="text-align:center;padding:48px 16px;font-family:DM Sans,sans-serif">' +
        '<i class="ph ph-warning-circle" style="font-size:32px;color:#D97706;display:block;margin-bottom:12px"></i>' +
        '<div style="color:var(--c-error);font-size:14px;margin-bottom:16px">報告生成失敗，請稍後重試</div>' +
        '<button class="circles-btn-ghost" id="circles-final-retry">重試</button>' +
      '</div></div>';
  }

  var gradeColor = ({ A: 'var(--c-ok-bold)', B: 'var(--c-primary)', C: 'var(--c-warn-bold)', D: 'var(--c-error)' })[report.grade] || '#1a1a1a';

  var stepLabels = { C1:'澄清', I:'用戶', R:'需求', C2:'排序', L:'方案', E:'取捨', S:'總結' };
  var stepRows = ['C1','I','R','C2','L','E','S'].filter(function(k) { return stepScores[k]; }).map(function(k) {
    var s = stepScores[k];
    var scoreNum = Math.round(s.totalScore || 0);
    var color = scoreNum >= 70 ? 'var(--c-ok-bold)' : scoreNum >= 50 ? 'var(--c-warn-bold)' : 'var(--c-error)';
    return '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #eee;font-family:DM Sans,sans-serif">' +
      '<span style="font-size:13px;color:#1a1a1a">' + escHtml(stepLabels[k] || k) + '</span>' +
      '<span style="font-size:13px;font-weight:600;color:' + color + '">' + scoreNum + '</span>' +
    '</div>';
  }).join('');

  var strengths = (report.strengths || []).map(function(s) {
    return '<li style="margin-bottom:6px;font-size:13px;font-family:DM Sans,sans-serif;color:#1a1a1a">' + escHtml(s) + '</li>';
  }).join('');

  var improvements = (report.improvements || []).map(function(s) {
    return '<li style="margin-bottom:6px;font-size:13px;font-family:DM Sans,sans-serif;color:#1a1a1a">' + escHtml(s) + '</li>';
  }).join('');

  return '<div data-view="circles">' +
    navBar +
    '<div style="padding:16px 0 80px">' +
      '<div style="background:#fff;border-radius:16px;padding:20px;text-align:center;margin-bottom:16px;border:1px solid rgba(0,0,0,0.08)">' +
        '<div style="font-size:56px;font-weight:800;color:' + gradeColor + ';font-family:Instrument Serif,serif;line-height:1">' + escHtml(report.grade || '') + '</div>' +
        '<div style="font-size:18px;color:#1a1a1a;margin:8px 0 4px;font-family:DM Sans,sans-serif;font-weight:600">' + Math.round(report.overallScore || 0) + ' 分</div>' +
        '<div style="font-size:14px;color:#5a5a5a;font-family:DM Sans,sans-serif">' + escHtml(report.headline || '') + '</div>' +
      '</div>' +
      '<div style="background:#fff;border-radius:16px;padding:16px;margin-bottom:16px;border:1px solid rgba(0,0,0,0.08)">' +
        '<div style="font-size:12px;font-weight:600;color:#8a8a8a;text-transform:uppercase;letter-spacing:.6px;margin-bottom:8px;font-family:DM Sans,sans-serif">各步驟分數</div>' +
        stepRows +
      '</div>' +
      '<div style="background:#F0FFF4;border-radius:16px;padding:16px;margin-bottom:12px;border:1px solid #BBF7D0">' +
        '<div style="font-size:12px;font-weight:600;color:#137A3D;margin-bottom:8px;font-family:DM Sans,sans-serif"><i class="ph ph-check-circle"></i> 表現優秀</div>' +
        '<ul style="padding-left:18px;margin:0">' + strengths + '</ul>' +
      '</div>' +
      '<div style="background:#FFF7ED;border-radius:16px;padding:16px;margin-bottom:12px;border:1px solid #FED7AA">' +
        '<div style="font-size:12px;font-weight:600;color:var(--c-warn-bold);margin-bottom:8px;font-family:DM Sans,sans-serif">△ 需要改進</div>' +
        '<ul style="padding-left:18px;margin:0">' + improvements + '</ul>' +
      '</div>' +
      '<div style="background:#EEF3FF;border-radius:16px;padding:16px;margin-bottom:12px;border:1px solid #C5D5FF">' +
        '<div style="font-size:12px;font-weight:600;color:var(--c-primary);margin-bottom:8px;font-family:DM Sans,sans-serif">教練總評</div>' +
        '<div style="font-size:13px;color:#1a1a1a;line-height:1.7;font-family:DM Sans,sans-serif">' + escHtml(report.coachVerdict || '') + '</div>' +
      '</div>' +
      (report.nextSteps ? '<div style="background:#fff;border-radius:12px;padding:14px;margin-bottom:16px;border:1px solid rgba(0,0,0,0.08);font-size:13px;color:#5a5a5a;font-family:DM Sans,sans-serif;line-height:1.6"><span style="font-weight:600;color:#1a1a1a">建議下一步：</span>' + escHtml(report.nextSteps) + '</div>' : '') +
      '<div class="circles-submit-bar">' +
        '<button class="circles-btn-primary" id="circles-final-again">重練這道題</button>' +
        '<button class="circles-btn-ghost" id="circles-final-home">回首頁</button>' +
      '</div>' +
    '</div>' +
  '</div>';
}

function bindCirclesFinalReport() {
  if (!AppState.circlesFinalReport) {
    var session = AppState.circlesSession;
    if (session && session.id) {
      var headers = AppState.accessToken
        ? { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + AppState.accessToken }
        : { 'Content-Type': 'application/json', 'X-Guest-ID': AppState.guestId };
      var route = (AppState.accessToken ? '/api/circles-sessions/' : '/api/guest-circles-sessions/') + session.id + '/final-report';
      fetch(route, { method: 'POST', headers: headers })
        .then(function(res) { return res.json(); })
        .then(function(data) {
          if (data && !data.error) {
            AppState.circlesFinalReport = data;
          } else {
            AppState.circlesFinalReport = { _error: true };
          }
          if (AppState.circlesPhase === 4) render();
        })
        .catch(function() {
          AppState.circlesFinalReport = { _error: true };
          if (AppState.circlesPhase === 4) render();
        });
    }
  }

  document.getElementById('circles-final-retry')?.addEventListener('click', function() {
    AppState.circlesFinalReport = null;
    render();
    setTimeout(bindCirclesFinalReport, 0);
  });

  document.getElementById('circles-final-again')?.addEventListener('click', function() {
    AppState.circlesSession = null;
    AppState.circlesPhase = 1;
    AppState.circlesFrameworkDraft = {};
    AppState.circlesGateResult = null;
    AppState.circlesConversation = [];
    AppState.circlesScoreResult = null;
    AppState.circlesFinalReport = null;
    AppState.circlesStepConclusions = {};
    AppState.circlesStepScores = {};
    AppState.circlesSimStep = 0;
    render();
  });

  document.getElementById('circles-final-home')?.addEventListener('click', function() {
    AppState.circlesSelectedQuestion = null;
    AppState.circlesSession = null;
    AppState.circlesPhase = 1;
    AppState.circlesScoreResult = null;
    AppState.circlesFinalReport = null;
    AppState.circlesStepConclusions = {};
    AppState.circlesStepScores = {};
    navigate('circles');
  });
}

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
    <div class="nsm-tab-panel">
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
    </div>
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
      AppState.nsmDefinitionDraft = '';
      AppState.nsmBusinessLinkDraft = '';
      AppState.nsmBreakdownDraft = {};
      AppState.nsmVanityWarning = null;
      AppState.nsmGateResult = null;
      AppState.nsmGateLoading = false;
      AppState.nsmSubTab = 'nsm-step2';
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
    const pmUrl = AppState.accessToken ? '/api/sessions' : null;
    const nsmUrl = AppState.accessToken ? '/api/nsm-sessions' : '/api/guest/nsm-sessions';
    const [pmRes, nsmRes] = await Promise.all([
      pmUrl ? fetch(pmUrl, { headers }) : Promise.resolve(null),
      fetch(nsmUrl, { headers })
    ]);
    const pmSessions = (pmRes && pmRes.ok) ? await pmRes.json() : [];
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
  // Phase 4.7 — desktop wrapper class
  var _loginDesktopCls = (typeof isDesktop === 'function' && isDesktop()) ? 'login-desktop' : '';
  return `
    <div class="${_loginDesktopCls}" style="max-width:400px;margin:60px auto">
      <div class="card login-card">
        <div style="display:flex;gap:8px;margin-bottom:24px">
          <button class="btn ${isLogin?'btn-primary':'btn-ghost'}" onclick="navigate('login')">登入</button>
          <button class="btn ${!isLogin?'btn-primary':'btn-ghost'}" onclick="navigate('register')">註冊</button>
        </div>
        <form id="auth-form">
          <div style="margin-bottom:12px">
            <label for="email" style="font-size:0.85rem;color:var(--text-secondary)">Email</label>
            <input id="email" type="email" name="email" autocomplete="email" required class="chat-input" style="width:100%;margin-top:4px" />
          </div>
          <div style="margin-bottom:20px">
            <label for="password" style="font-size:0.85rem;color:var(--text-secondary)">密碼</label>
            <input id="password" type="password" name="password" autocomplete="${isLogin?'current-password':'new-password'}" required class="chat-input" style="width:100%;margin-top:4px" />
          </div>
          <p id="auth-error" style="color:var(--danger);font-size:0.85rem;margin-bottom:12px;display:none"></p>
          <button type="submit" class="btn btn-primary" style="width:100%">${isLogin?'登入':'建立帳號'}</button>
        </form>
        <p style="margin-top:16px;text-align:center">
          <a href="#" style="color:var(--accent)" onclick="navigate('circles')">← 返回首頁</a>
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
  return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/\n/g,'<br>');
}

// SIT-1 #11: HTML-escape for <textarea> RCDATA content (and other contexts where
// literal newlines must survive as \n). Unlike escHtml(), does NOT replace \n with
// <br> — textareas don't parse HTML, so <br> would appear as literal text on resume.
function escTextarea(str) {
  return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Bullet text parser (spec 1 § 4.2) ───────────────────────────────────────
// Renders "markdown-ish" nested bullets into <ul class="rt-bullet-list">.
// Top bullets:  ^- text
// Sub bullets:  ^  - text  (2-space indent)
// Bold:         **x** → <strong>x</strong>
// Lines without "- " prefix fall back to top-level <li> (legacy prose tolerance).
function renderBulletInlineEsc(s) {
  // Escape HTML but preserve raw text (no \n → <br> conversion).
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
function renderBoldInline(s) {
  return renderBulletInlineEsc(s).replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>');
}
function renderBulletText(text) {
  if (!text) return '';
  const lines = String(text).split('\n').filter(function (l) { return l.trim(); });
  const tree = []; // [{ text, children: [] }]
  let lastTop = null;
  for (const line of lines) {
    const subM = line.match(/^  - (.*)$/);
    const topM = line.match(/^- (.*)$/);
    if (subM && lastTop) {
      lastTop.children.push(subM[1]);
    } else if (topM) {
      lastTop = { text: topM[1], children: [] };
      tree.push(lastTop);
    } else {
      // legacy fallback: treat as a top-level bullet
      lastTop = { text: line, children: [] };
      tree.push(lastTop);
    }
  }
  let html = '<ul class="rt-bullet-list">';
  for (const node of tree) {
    html += '<li>' + renderBoldInline(node.text);
    if (node.children.length) {
      html += '<ul class="rt-bullet-sub">';
      for (const c of node.children) html += '<li>' + renderBoldInline(c) + '</li>';
      html += '</ul>';
    }
    html += '</li>';
  }
  html += '</ul>';
  return html;
}
if (typeof window !== 'undefined') {
  window.renderBulletText = renderBulletText;
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
  document.getElementById('btn-practice-again')?.addEventListener('click', () => navigate('circles'));
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
      <button class="btn btn-ghost" onclick="navigate('circles')">← 返回</button>
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
            navigate('circles');
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
    case 2:
      // Screen 8 sub-tabs: nsm-step2 / nsm-gate / nsm-step3
      if (AppState.nsmSubTab === 'nsm-gate') return renderNSMGate();
      if (AppState.nsmSubTab === 'nsm-step3') return renderNSMStep3();
      return renderNSMStep2();
    case 3: return renderNSMStep3();
    case 4: return renderNSMStep4();
    default: return renderNSMStep1();
  }
}

// Builds the innerHTML for a single NSM question card.
function createNSMQuestionCardHtml(q) {
  var isSelected = AppState.nsmSelectedQuestion && AppState.nsmSelectedQuestion.id === q.id;
  var productType = detectProductType(q);
  var typeMeta = NSM_TYPE_META[productType];

  var contextHtml = '';
  if (isSelected) {
    if (AppState.nsmContextLoading && AppState.nsmContextQuestionId === q.id) {
      contextHtml = `
        <div class="nsm-context-preview loading">
          <i class="ph ph-circle-notch" style="animation:spin 0.8s linear infinite"></i>
          <span>分析情境中…</span>
        </div>`;
    } else if (AppState.nsmContext && AppState.nsmContextQuestionId === q.id) {
      var ctx = AppState.nsmContext;
      contextHtml = `
        <div class="nsm-context-preview">
          <div class="nsm-ctx-row"><span class="nsm-ctx-label"><i class="ph ph-buildings"></i> 商業模式</span><span class="nsm-ctx-val">${escHtml(ctx.model)}</span></div>
          <div class="nsm-ctx-row"><span class="nsm-ctx-label"><i class="ph ph-users"></i> 使用者</span><span class="nsm-ctx-val">${escHtml(ctx.users)}</span></div>
          <div class="nsm-ctx-row nsm-ctx-trap"><span class="nsm-ctx-label"><i class="ph ph-warning"></i> 常見陷阱</span><span class="nsm-ctx-val">${escHtml(ctx.traps)}</span></div>
          <div class="nsm-ctx-row nsm-ctx-angle"><span class="nsm-ctx-label"><i class="ph ph-lightbulb"></i> 破題切入</span><span class="nsm-ctx-val">${escHtml(ctx.insight)}</span></div>
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
  var contextLoaded = !!(AppState.nsmContext && selected && AppState.nsmContextQuestionId === selected.id);
  var ctaDisabled = !selected || !contextLoaded;

  // Initialise displayed questions on first render.
  if (!Array.isArray(AppState.nsmDisplayedQuestions) || AppState.nsmDisplayedQuestions.length === 0) {
    AppState.nsmDisplayedQuestions = pickRandom5(NSM_QUESTIONS);
  }

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

  var cardsHtml = AppState.nsmDisplayedQuestions.map(createNSMQuestionCardHtml).join('');

  // Phase 4.5 — desktop wrapper class
  var _nsmHomeDesktopCls = (typeof isDesktop === 'function' && isDesktop()) ? ' nsm-home-desktop' : '';

  return `
    <div class="nsm-view${_nsmHomeDesktopCls}">
      <div class="nsm-navbar">
        <button class="btn-icon" id="btn-nsm-back" aria-label="返回"><i class="ph ph-arrow-left"></i></button>
        <span class="nsm-title">選擇情境</span>
        <div class="nsm-navbar-spacer"></div>
      </div>
      ${progressBar}
      <div class="nsm-body">
        <p class="nsm-instruction">選擇一個企業情境，開始定義北極星指標</p>
        <div class="nsm-list-header">
          <div class="nsm-list-header-label">選擇題目</div>
          <button type="button" class="nsm-shuffle-btn" id="btn-nsm-shuffle">
            <i class="ph ph-shuffle"></i> 隨機選題
          </button>
        </div>
        <div class="nsm-question-list">${cardsHtml}</div>
        <div style="height:80px"></div>
      </div>
      <div class="nsm-fixed-bottom">
        <div id="nsm-step1-error" class="nsm-inline-error" role="alert" style="display:none"></div>
        <button class="btn btn-primary nsm-next-btn" id="btn-nsm-step1-next" ${ctaDisabled ? 'disabled' : ''}>
          開始 NSM 訓練 <i class="ph ph-arrow-right"></i>
        </button>
      </div>
    </div>`;
}

// Re-renders just the NSM Step 1 question list area (cards + CTA) in place,
// so that selecting a card / receiving context doesn't full-page re-render.
function refreshNSMStep1List() {
  var listEl = document.querySelector('.nsm-question-list');
  if (!listEl) return;
  listEl.innerHTML = AppState.nsmDisplayedQuestions.map(createNSMQuestionCardHtml).join('');
  bindNSMStep1Cards();

  var selected = AppState.nsmSelectedQuestion;
  var contextLoaded = !!(AppState.nsmContext && selected && AppState.nsmContextQuestionId === selected.id);
  var btn = document.getElementById('btn-nsm-step1-next');
  if (btn) btn.disabled = !selected || !contextLoaded;
}

// Wires click/keyboard handlers to every NSM question card currently in the DOM.
function bindNSMStep1Cards() {
  document.querySelectorAll('.nsm-question-card').forEach(function(cardEl) {
    cardEl.addEventListener('click', function() { handleNSMCardSelect(cardEl.dataset.qid); });
    cardEl.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); cardEl.click(); }
    });
  });
}

// Card selection: set selected, fetch context if not cached, refresh in place.
async function handleNSMCardSelect(qid) {
  var q = NSM_QUESTIONS.find(function(item) { return item.id === qid; }) || null;
  if (!q) return;

  // If clicking the same card that's already selected and context is loaded, no-op.
  var alreadySelected = AppState.nsmSelectedQuestion && AppState.nsmSelectedQuestion.id === q.id;
  AppState.nsmSelectedQuestion = q;

  // Drop any stale context when switching to a different question.
  if (!alreadySelected) {
    AppState.nsmContext = null;
  }

  // Fetch context if we don't have it for this question yet.
  // Note: nsmContextLoading guards against in-flight fetches *for this same q*; switching
  // to a different question implicitly invalidates the in-flight one (the async guard
  // below checks selectedQuestion at completion time and discards stale responses).
  var needFetch = !AppState.nsmContext || AppState.nsmContextQuestionId !== q.id;
  if (needFetch) {
    AppState.nsmContextLoading = true;
    AppState.nsmContextQuestionId = q.id;
    refreshNSMStep1List();
    var ctx = null;
    try {
      var res = await fetch('/api/nsm-context', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionJson: q }),
      });
      if (res.ok) ctx = await res.json();
    } catch (_) { /* swallow; ctx stays null */ }

    // Async guard: discard the response if user navigated away or selected a different
    // question while we were awaiting. Don't touch nsmContextLoading either, since a
    // newer in-flight fetch might own that flag now.
    if (!document.querySelector('.nsm-question-list')) return;
    if (!AppState.nsmSelectedQuestion || AppState.nsmSelectedQuestion.id !== q.id) return;
    if (AppState.nsmContextQuestionId !== q.id) return;

    AppState.nsmContextLoading = false;
    if (ctx) {
      AppState.nsmContext = ctx;
    } else {
      AppState.nsmContext = null;
      AppState.nsmContextQuestionId = null;
    }
    refreshNSMStep1List();
  } else {
    refreshNSMStep1List();
  }
}

// Sub-tabs for Screen 8 (NSM Step 2 / Gate / Step 3) — only step 2 enabled until gate run, gate enabled once a result exists, step 3 only after gate passed.
function renderNSMSubTabs() {
  const active = AppState.nsmSubTab || 'nsm-step2';
  const hasGate = !!AppState.nsmGateResult;
  const gatePassed = hasGate && AppState.nsmGateResult.canProceed !== false && AppState.nsmGateResult.overallStatus !== 'error';
  return `
    <div class="nsm-sub-tabs">
      <button class="nsm-sub-tab ${active === 'nsm-step2' ? 'active' : ''}" data-nsm-sub-tab="nsm-step2">步驟 2：定義 NSM</button>
      <button class="nsm-sub-tab ${active === 'nsm-gate' ? 'active' : ''}" data-nsm-sub-tab="nsm-gate" ${hasGate ? '' : 'disabled'}>NSM 審核</button>
      <button class="nsm-sub-tab ${active === 'nsm-step3' ? 'active' : ''}" data-nsm-sub-tab="nsm-step3" ${gatePassed ? '' : 'disabled'}>步驟 3：拆解指標</button>
    </div>`;
}

function renderNSMStep2() {
  const q = AppState.nsmSelectedQuestion;
  const draft = AppState.nsmNsmDraft || '';
  const definitionDraft = AppState.nsmDefinitionDraft || '';
  const businessLinkDraft = AppState.nsmBusinessLinkDraft || '';
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

  // Phase 4.5 — desktop wrapper class
  var _nsmStep2DesktopCls = (typeof isDesktop === 'function' && isDesktop()) ? ' nsm-step2-desktop' : '';

  return `
    <div class="nsm-view${_nsmStep2DesktopCls}">
      <div class="nsm-navbar">
        <button class="btn-icon" id="btn-nsm-back" aria-label="返回上一步"><i class="ph ph-arrow-left"></i></button>
        <span class="nsm-title">定義 NSM</span>
        <button class="btn-icon" id="btn-nsm-home-nav" aria-label="回首頁" title="回首頁"><i class="ph ph-house"></i></button>
      </div>
      ${renderNSMSubTabs()}
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

        <div class="nsm-field-group">
          <div class="nsm-field-label-sm">北極星指標 (NSM)</div>
          <button onclick="toggleFieldHint(this)" class="nsm-example-toggle" type="button"><i class="ph ph-caret-right"></i> 查看範例</button>
          <div class="nsm-example-body" style="display:none">
            <div class="nsm-example-text">例 (Spotify)：每月完成至少一首完整曲目播放的活躍月用戶數 — 反映真正的聆聽行為，非背景播放</div>
          </div>
          <input id="nsm-nsm-input" class="nsm-input" placeholder="用一句話定義你的 NSM，包含量化描述..." value="${escHtml(draft)}">
        </div>

        <div class="nsm-field-group">
          <div class="nsm-field-label-sm">定義說明</div>
          <button onclick="toggleFieldHint(this)" class="nsm-example-toggle" type="button"><i class="ph ph-caret-right"></i> 查看範例</button>
          <div class="nsm-example-body" style="display:none">
            <div class="nsm-example-text">例 (Spotify)：區分「被動背景播放」與「主動完整聆聽」，後者才代表用戶真正得到價值，避免被播放次數虛高誤導</div>
          </div>
          <div class="rt-field">
            <div class="rt-toolbar">
              <button type="button" class="rt-tbtn" data-rt-action="bold" title="粗體 (Ctrl+B)"><strong>B</strong></button>
              <button type="button" class="rt-tbtn" data-rt-action="bullet" title="列點 (Ctrl+L)"><i class="ph ph-list-bullets"></i></button>
              <button type="button" class="rt-tbtn" data-rt-action="indent" title="縮排 (Tab)"><i class="ph ph-text-indent"></i></button>
              <button type="button" class="rt-tbtn" data-rt-action="outdent" title="退縮 (Shift+Tab)"><i class="ph ph-text-outdent"></i></button>
            </div>
            <textarea id="nsm-definition-input" class="nsm-textarea-sm rt-textarea" placeholder="解釋為什麼要這樣定義，避免哪些虛榮陷阱..." rows="3">${escTextarea(definitionDraft)}</textarea>
          </div>
        </div>

        <div class="nsm-field-group">
          <div class="nsm-field-label-sm">與業務目標的連結</div>
          <button onclick="toggleFieldHint(this)" class="nsm-example-toggle" type="button"><i class="ph ph-caret-right"></i> 查看範例</button>
          <div class="nsm-example-body" style="display:none">
            <div class="nsm-example-text">例 (Spotify)：Spotify 的收入來自 Premium 訂閱與廣告，深度聆聽的用戶更容易感受到廣告干擾進而付費升級，且留存率較高代表獲客成本（CAC）被更多用戶週期攤薄。NSM 若能捕捉「真正在聽音樂」的行為，就能同時作為訂閱轉化與廣告效益的領先指標</div>
          </div>
          <div class="rt-field">
            <div class="rt-toolbar">
              <button type="button" class="rt-tbtn" data-rt-action="bold" title="粗體 (Ctrl+B)"><strong>B</strong></button>
              <button type="button" class="rt-tbtn" data-rt-action="bullet" title="列點 (Ctrl+L)"><i class="ph ph-list-bullets"></i></button>
              <button type="button" class="rt-tbtn" data-rt-action="indent" title="縮排 (Tab)"><i class="ph ph-text-indent"></i></button>
              <button type="button" class="rt-tbtn" data-rt-action="outdent" title="退縮 (Shift+Tab)"><i class="ph ph-text-outdent"></i></button>
            </div>
            <textarea id="nsm-business-link-input" class="nsm-textarea-sm rt-textarea" placeholder="這個 NSM 如何驅動營收/留存/獲利..." rows="3">${escTextarea(businessLinkDraft)}</textarea>
          </div>
        </div>

        ${warningHtml}
        <div style="height:80px"></div>
      </div>
      <div class="nsm-fixed-bottom">
        <div id="nsm-step2-error" class="nsm-inline-error" role="alert" style="display:none"></div>
        <button class="btn btn-primary nsm-next-btn" id="btn-nsm-step2-next">
          提交審核 <i class="ph ph-arrow-right"></i>
        </button>
      </div>
    </div>`;
}

// Switch between Screen 8 sub-tabs ("nsm-step2" / "nsm-gate" / "nsm-step3").
// Disabled tabs are gated: gate requires a result; step3 requires gate passed.
function switchNSMStep(stepKey) {
  if (stepKey === 'nsm-gate' && !AppState.nsmGateResult) return;
  if (stepKey === 'nsm-step3') {
    var r = AppState.nsmGateResult;
    var passed = r && r.canProceed !== false && r.overallStatus !== 'error';
    if (!passed) return;
  }
  AppState.nsmSubTab = stepKey;
  render();
}
window.switchNSMStep = switchNSMStep;

// Toggle collapsible "查看範例" content under each Step 2 field.
function toggleFieldHint(btn) {
  const body = btn.nextElementSibling;
  if (!body) return;
  const open = body.style.display !== 'none';
  body.style.display = open ? 'none' : 'block';
  const icon = btn.querySelector('i');
  if (icon) icon.className = open ? 'ph ph-caret-right' : 'ph ph-caret-down';
}
window.toggleFieldHint = toggleFieldHint;

// Screen 8 sub-tab "NSM 審核" — renders gate result returned from POST /gate.
// Loading state shown while gateLoading; pass/fail state once result lands.
function renderNSMGate() {
  const result = AppState.nsmGateResult;
  const loading = AppState.nsmGateLoading;
  const q = AppState.nsmSelectedQuestion || {};

  if (loading || !result) {
    return `
      <div class="nsm-view">
        <div class="nsm-navbar">
          <button class="btn-icon" id="btn-nsm-back" aria-label="返回上一步"><i class="ph ph-arrow-left"></i></button>
          <span class="nsm-title">NSM 品質審核</span>
          <button class="btn-icon" id="btn-nsm-home-nav" aria-label="回首頁" title="回首頁"><i class="ph ph-house"></i></button>
        </div>
        ${renderNSMSubTabs()}
        <div class="nsm-loading-state">
          <i class="ph ph-circle-notch"></i>
          <p>AI 正在審核你的 NSM 定義…</p>
        </div>
      </div>`;
  }

  const STATUS_LABEL = { error: '<i class="ph ph-x-circle"></i> 需修正', warn: '<i class="ph ph-warning-circle"></i> 建議補充', ok: '<i class="ph ph-check-circle"></i> 通過' };
  const items = (result.items || []).map(function(item) {
    const safeStatus = (item.status || '').replace(/[^a-z]/g, '');
    const criterion = item.criterion || item.field || '';
    const feedback = item.feedback || item.reason || '';
    const suggestion = item.suggestion || '';
    return `
      <div class="gate-item gate-${safeStatus}">
        <div class="gate-item-status">${STATUS_LABEL[safeStatus] || safeStatus}</div>
        <div class="gate-item-criterion">${escHtml(criterion)}</div>
        <div class="gate-item-feedback">${escHtml(feedback)}</div>
        ${suggestion && safeStatus !== 'ok' ? `<div class="gate-item-suggestion"><i class="ph ph-arrow-right"></i> 建議：${escHtml(suggestion)}</div>` : ''}
      </div>`;
  }).join('');

  const passed = result.canProceed !== false && result.overallStatus !== 'error';
  const headerHtml = passed
    ? `<div class="gate-transition-bar gate-pass"><i class="ph ph-check-circle"></i> NSM 定義通過審核，可以進入拆解指標</div>`
    : `<div class="gate-transition-bar gate-fail"><i class="ph ph-warning-circle"></i> NSM 定義有根本性問題，請修正後再提交</div>`;

  const bottomBtn = passed
    ? `<button class="btn btn-primary nsm-next-btn" id="btn-nsm-gate-proceed">繼續到 步驟3 <i class="ph ph-arrow-right"></i></button>`
    : `<button class="btn btn-primary nsm-next-btn" id="btn-nsm-gate-back">返回修改</button>`;

  return `
    <div class="nsm-view">
      <div class="nsm-navbar">
        <button class="btn-icon" id="btn-nsm-back" aria-label="返回上一步"><i class="ph ph-arrow-left"></i></button>
        <span class="nsm-title">NSM 品質審核</span>
        <button class="btn-icon" id="btn-nsm-home-nav" aria-label="回首頁" title="回首頁"><i class="ph ph-house"></i></button>
      </div>
      ${renderNSMSubTabs()}
      <div class="nsm-body">
        ${headerHtml}
        <div class="nsm-gate-summary">公司情境：<strong>${escHtml(q.company || '')}</strong>　|　你的 NSM：<span class="nsm-gate-nsm-text">${escHtml(AppState.nsmNsmDraft || '（未填寫）')}</span></div>
        <div class="nsm-gate-items">${items}</div>
        <div style="height:80px"></div>
      </div>
      <div class="nsm-fixed-bottom">
        ${bottomBtn}
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
      <div class="rt-field">
        <div class="rt-toolbar">
          <button type="button" class="rt-tbtn" data-rt-action="bold" title="粗體 (Ctrl+B)"><strong>B</strong></button>
          <button type="button" class="rt-tbtn" data-rt-action="bullet" title="列點 (Ctrl+L)"><i class="ph ph-list-bullets"></i></button>
          <button type="button" class="rt-tbtn" data-rt-action="indent" title="縮排 (Tab)"><i class="ph ph-text-indent"></i></button>
          <button type="button" class="rt-tbtn" data-rt-action="outdent" title="退縮 (Shift+Tab)"><i class="ph ph-text-outdent"></i></button>
        </div>
        <textarea class="nsm-textarea nsm-dim-input rt-textarea" id="nsm-dim-${d.key}" placeholder="${escHtml(d.placeholder)}" rows="2">${escTextarea(breakdown[d.key] || '')}</textarea>
      </div>
    </div>`;
  }).join('');

  // Phase 4.5 — desktop wrapper class
  var _nsmStep3DesktopCls = (typeof isDesktop === 'function' && isDesktop()) ? ' nsm-step3-desktop' : '';

  return `
    <div class="nsm-view${_nsmStep3DesktopCls}">
      <div class="nsm-navbar">
        <button class="btn-icon" id="btn-nsm-back" aria-label="返回上一步"><i class="ph ph-arrow-left"></i></button>
        <span class="nsm-title">拆解輸入指標</span>
        <button class="btn-icon" id="btn-nsm-home-nav" aria-label="回首頁" title="回首頁"><i class="ph ph-house"></i></button>
      </div>
      ${renderNSMSubTabs()}
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
        <div style="background:#EEF3FF;border-radius:10px;border:1px solid #C5D5FF;padding:12px 14px;margin-bottom:16px;font-size:13px;color:var(--accent)">
          <strong>你的 NSM：</strong>${escHtml(AppState.nsmNsmDraft || '（未填寫）')}
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
    { key: 'alignment',     label: '價值關聯', color: 'var(--c-primary)' },
    { key: 'leading',       label: '領先指標', color: '#3b82f6' },
    { key: 'actionability', label: '操作性',   color: 'var(--c-success)' },
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

  // Phase 6 — mobile vertical stack: 維度標題 + 你的卡 + 教練卡（直堆）
  // Cards remain `.nsm-tree-node` so the existing click handler / styles stay reused.
  const _isMobileCmp = !(typeof isDesktop === 'function' && isDesktop());
  const mobileCompareStack = `
    <div class="nsm-compare-mobile-stack">
      <div class="nsm-compare-dim-block">
        <div class="nsm-compare-dim-title">北極星指標 (NSM)</div>
        <div class="nsm-tree-node nsm-tree-root" data-node="user-nsm" data-label="NSM" role="button" tabindex="0">
          <span class="nsm-compare-card-tag">你的</span>${escHtml(userNsm || '（未填寫）')}
        </div>
        <div class="nsm-tree-node nsm-tree-root nsm-tree-coach" data-node="coach-nsm" data-label="NSM" data-is-coach="1" role="button" tabindex="0">
          <span class="nsm-compare-card-tag coach">教練版</span>${escHtml(coachTree.nsm || '')}
        </div>
      </div>
      ${cmpDims.map(d => `
      <div class="nsm-compare-dim-block">
        <div class="nsm-compare-dim-title">${escHtml(d.label)}</div>
        <div class="nsm-tree-node" data-node="user-${d.key}" data-label="${escHtml(d.label)}" role="button" tabindex="0">
          <span class="nsm-compare-card-tag">你的</span>${escHtml(userBreakdown[d.key] || '（未填寫）')}
        </div>
        <div class="nsm-tree-node nsm-tree-coach" data-node="coach-${d.key}" data-label="${escHtml(d.label)}" data-is-coach="1" role="button" tabindex="0">
          <span class="nsm-compare-card-tag coach">教練版</span>${escHtml(coachTree[d.key] || '')}
        </div>
      </div>`).join('')}
    </div>
    <div class="nsm-detail-sheet-backdrop" id="nsm-detail-sheet-backdrop"></div>
    <div class="nsm-detail-sheet" id="nsm-detail-sheet" role="dialog" aria-modal="true" aria-hidden="true">
      <div class="nsm-detail-sheet-handle" id="nsm-detail-sheet-handle" role="button" tabindex="0" aria-label="關閉"></div>
      <div class="nsm-detail-sheet-body" id="nsm-detail-sheet-body"></div>
    </div>`;

  const desktopCompare = `
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

  const comparisonTab = _isMobileCmp ? mobileCompareStack : desktopCompare;

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

  // Phase 4.6 — desktop wrapper class
  var _nsmStep4DesktopCls = (typeof isDesktop === 'function' && isDesktop()) ? ' nsm-step4-desktop' : '';

  return `
    <div class="nsm-view${_nsmStep4DesktopCls}">
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

// Reset NSM state and return to NSM home (Step 1) — used by 回首頁 buttons.
function nsmResetToHome() {
  AppState.nsmStep = 1;
  AppState.nsmSession = null;
  AppState.nsmSelectedQuestion = null;
  AppState.nsmNsmDraft = '';
  AppState.nsmDefinitionDraft = '';
  AppState.nsmBusinessLinkDraft = '';
  AppState.nsmBreakdownDraft = {};
  AppState.nsmVanityWarning = null;
  AppState.nsmGateResult = null;
  AppState.nsmGateLoading = false;
  AppState.nsmSubTab = 'nsm-step2';
  AppState.nsmHints = null;
  AppState.nsmHintsLoading = false;
  AppState.nsmContext = null;
  AppState.nsmContextLoading = false;
  AppState.nsmContextQuestionId = null;
  navigate('nsm');
}

function bindNSM() {
  // Back button — sub-tab aware on Step 2 (gate ↩ form, step3 ↩ gate, etc.)
  document.getElementById('btn-nsm-back')?.addEventListener('click', () => {
    // Clearing circlesSession is required before navigate('circles') to prevent
    // the "評分結果載入中" stuck state (T10 bug fix).
    if (AppState.nsmStep === 1) { AppState.circlesSession = null; navigate('circles'); return; }
    if (AppState.nsmStep === 4) { AppState.nsmStep = 1; AppState.nsmSession = null; AppState.nsmSelectedQuestion = null; navigate('nsm'); return; }
    if (AppState.nsmStep === 2) {
      // Sub-tab back navigation: step3 → gate → step2 → step1.
      if (AppState.nsmSubTab === 'nsm-step3') { AppState.nsmSubTab = 'nsm-gate'; render(); return; }
      if (AppState.nsmSubTab === 'nsm-gate')  { AppState.nsmSubTab = 'nsm-step2'; render(); return; }
      AppState.nsmStep = 1;
      render();
      return;
    }
    AppState.nsmStep--;
    render();
  });

  // 回首頁 button — appears on Step 2 / Gate / Step 3 (per spec)
  document.getElementById('btn-nsm-home-nav')?.addEventListener('click', nsmResetToHome);

  // Sub-tab nav: 步驟2 / NSM 審核 / 步驟3
  document.querySelectorAll('[data-nsm-sub-tab]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      if (btn.disabled) return;
      switchNSMStep(btn.dataset.nsmSubTab);
    });
  });

  // Step 1: bind card click/keyboard handlers + shuffle button.
  if (AppState.nsmStep === 1) {
    bindNSMStep1Cards();
    var shuffleBtn = document.getElementById('btn-nsm-shuffle');
    if (shuffleBtn) {
      shuffleBtn.addEventListener('click', function() {
        AppState.nsmDisplayedQuestions = pickRandom5(NSM_QUESTIONS);
        // Clear selection + context — the previously-selected card may no longer
        // be in the visible 5, so the context card no longer makes sense.
        AppState.nsmSelectedQuestion = null;
        AppState.nsmContext = null;
        AppState.nsmContextQuestionId = null;
        AppState.nsmContextLoading = false;
        refreshNSMStep1List();
      });
    }
  }

  // Step 1: next
  var btnStep1Next = document.getElementById('btn-nsm-step1-next');
  if (btnStep1Next) {
    btnStep1Next.addEventListener('click', async function() {
      if (!AppState.nsmSelectedQuestion) return;
      // Require context to be loaded — UI also enforces via disabled.
      var sel = AppState.nsmSelectedQuestion;
      if (!AppState.nsmContext || AppState.nsmContextQuestionId !== sel.id) return;
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
        AppState.offcanvasCache = null; // force fresh fetch on next offcanvas open
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
        AppState.nsmSubTab = 'nsm-step2';
        AppState.nsmGateResult = null;
        AppState.nsmGateLoading = false;
        AppState.nsmDefinitionDraft = '';
        AppState.nsmBusinessLinkDraft = '';
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

  // Step 2: form fields (3 fields per spec — NSM input, definition, business link)
  var nsmInput = document.getElementById('nsm-nsm-input');
  if (nsmInput) nsmInput.addEventListener('input', function() { AppState.nsmNsmDraft = nsmInput.value; });
  var nsmDefinitionInput = document.getElementById('nsm-definition-input');
  if (nsmDefinitionInput) nsmDefinitionInput.addEventListener('input', function() { AppState.nsmDefinitionDraft = nsmDefinitionInput.value; });
  var nsmBusinessLinkInput = document.getElementById('nsm-business-link-input');
  if (nsmBusinessLinkInput) nsmBusinessLinkInput.addEventListener('input', function() { AppState.nsmBusinessLinkDraft = nsmBusinessLinkInput.value; });

  // Step 2: 提交審核 → POST /gate, switch to NSM 審核 sub-tab.
  var btnStep2Next = document.getElementById('btn-nsm-step2-next');
  if (btnStep2Next) {
    btnStep2Next.addEventListener('click', async function() {
      var nsmVal = (nsmInput ? nsmInput.value : AppState.nsmNsmDraft || '').trim();
      var defVal = (nsmDefinitionInput ? nsmDefinitionInput.value : AppState.nsmDefinitionDraft || '').trim();
      var bizVal = (nsmBusinessLinkInput ? nsmBusinessLinkInput.value : AppState.nsmBusinessLinkDraft || '').trim();
      if (!nsmVal) {
        var step2Err = document.getElementById('nsm-step2-error');
        if (step2Err) { step2Err.textContent = '請先填寫北極星指標'; step2Err.style.display = 'block'; }
        if (nsmInput) nsmInput.focus();
        return;
      }
      AppState.nsmNsmDraft = nsmVal;
      AppState.nsmDefinitionDraft = defVal;
      AppState.nsmBusinessLinkDraft = bizVal;

      var sessionId = AppState.nsmSession ? AppState.nsmSession.id : '';
      if (!sessionId) {
        var step2Err2 = document.getElementById('nsm-step2-error');
        if (step2Err2) { step2Err2.textContent = '練習資料遺失，請重新從 Step 1 開始'; step2Err2.style.display = 'block'; }
        return;
      }

      // Combine "definition" + "business link" into single rationale string for /gate body.
      var rationale = [
        defVal ? '定義說明：' + defVal : '',
        bizVal ? '與業務目標的連結：' + bizVal : ''
      ].filter(Boolean).join('\n\n');

      AppState.nsmGateLoading = true;
      AppState.nsmGateResult = null;
      AppState.nsmSubTab = 'nsm-gate';
      render();

      try {
        var headers = { 'Content-Type': 'application/json' };
        if (AppState.accessToken) headers['Authorization'] = 'Bearer ' + AppState.accessToken;
        else headers['X-Guest-ID'] = AppState.guestId;
        var res = await fetch(nsmRoute(sessionId + '/gate'), {
          method: 'POST',
          headers: headers,
          body: JSON.stringify({ nsm: nsmVal, rationale: rationale })
        });
        var data = await res.json();
        if (!res.ok) throw new Error(data.error || ('HTTP ' + res.status));
        AppState.nsmGateResult = data;
      } catch (e) {
        AppState.nsmGateResult = {
          items: [{ criterion: '審核錯誤', status: 'error', feedback: '無法連線審核服務（' + e.message + '），請稍後再試。', suggestion: '檢查網路或稍後重試' }],
          canProceed: false,
          overallStatus: 'error'
        };
      }
      AppState.nsmGateLoading = false;
      render();
    });
  }

  // Gate sub-tab buttons
  document.getElementById('btn-nsm-gate-proceed')?.addEventListener('click', function() {
    AppState.nsmSubTab = 'nsm-step3';
    AppState.nsmHints = null;
    AppState.nsmHintsLoading = false;
    render();
  });
  document.getElementById('btn-nsm-gate-back')?.addEventListener('click', function() {
    AppState.nsmSubTab = 'nsm-step2';
    render();
  });

  // Vanity warning (legacy, only shown if state explicitly set elsewhere)
  document.getElementById('btn-nsm-redefine')?.addEventListener('click', function() {
    AppState.nsmVanityWarning = null;
    AppState.nsmNsmDraft = '';
    render();
  });
  document.getElementById('btn-nsm-proceed-anyway')?.addEventListener('click', function() {
    AppState.nsmVanityWarning = null;
    AppState.nsmSubTab = 'nsm-step3';
    render();
  });

  // Step 3: dimension inputs — driven by detected product type, not hardcoded
  var _step3Q = AppState.nsmSelectedQuestion || {};
  var _step3Dims = NSM_DIMENSION_CONFIGS[detectProductType(_step3Q)] || [];
  // SIT-1 #3: NSM lacks a PATCH /progress endpoint (only POST /, /evaluate,
  // /gate, /context, /hints exist in routes/nsm-sessions.js + guest variant).
  // Stopgap: persist the breakdown draft to localStorage, debounced 1.5s, so
  // tab close / navigation doesn't lose the user's dim text. On Step 3 mount
  // we hydrate AppState.nsmBreakdownDraft from localStorage if empty.
  var _nsmDimDebounce = null;
  function _nsmDimLocalSaveKey() {
    var sid = (AppState.nsmSession && AppState.nsmSession.id) || 'pending';
    return 'nsm-breakdown-draft-' + sid;
  }
  // Hydrate from localStorage on mount (only if AppState draft is empty —
  // server-loaded draft always wins).
  try {
    var _hadDraft = AppState.nsmBreakdownDraft && Object.keys(AppState.nsmBreakdownDraft).some(function (k) { return AppState.nsmBreakdownDraft[k]; });
    if (!_hadDraft) {
      var _stored = localStorage.getItem(_nsmDimLocalSaveKey());
      if (_stored) {
        var _parsed = JSON.parse(_stored);
        if (_parsed && typeof _parsed === 'object') {
          AppState.nsmBreakdownDraft = _parsed;
          // Reflect into DOM if inputs are empty.
          _step3Dims.forEach(function (d) {
            var el = document.getElementById('nsm-dim-' + d.key);
            if (el && !el.value && _parsed[d.key]) el.value = _parsed[d.key];
          });
        }
      }
    }
  } catch (_) {}
  _step3Dims.forEach(function(d) {
    var inp = document.getElementById('nsm-dim-' + d.key);
    if (inp) inp.addEventListener('input', function() {
      if (!AppState.nsmBreakdownDraft) AppState.nsmBreakdownDraft = {};
      AppState.nsmBreakdownDraft[d.key] = inp.value;
      // Debounced localStorage save (1.5s, matching CIRCLES auto-save cadence).
      clearTimeout(_nsmDimDebounce);
      _nsmDimDebounce = setTimeout(function () {
        try {
          localStorage.setItem(_nsmDimLocalSaveKey(), JSON.stringify(AppState.nsmBreakdownDraft || {}));
        } catch (_) {}
      }, 1500);
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

  // Step 4: comparison tree tap — desktop opens inline detail, mobile opens bottom sheet (Phase 6)
  var _nsmIsMobileCmp = !(typeof isDesktop === 'function' && isDesktop());
  var _nsmSheetEl = document.getElementById('nsm-detail-sheet');
  var _nsmSheetBody = document.getElementById('nsm-detail-sheet-body');
  var _nsmSheetBackdrop = document.getElementById('nsm-detail-sheet-backdrop');
  var _nsmSheetHandle = document.getElementById('nsm-detail-sheet-handle');

  function _nsmCloseSheet() {
    if (!_nsmSheetEl) return;
    _nsmSheetEl.classList.remove('open');
    _nsmSheetEl.setAttribute('aria-hidden', 'true');
    if (_nsmSheetBackdrop) _nsmSheetBackdrop.classList.remove('open');
    AppState.nsmOpenNode = null;
  }
  function _nsmBuildDetailHTML(dim, dimLabel, isCoach) {
    var sc = AppState.nsmSession ? (AppState.nsmSession.scores_json || {}) : {};
    var ctree = sc.coachTree || {};
    var rationale = sc.coachRationale || {};
    var bd = (AppState.nsmSession && AppState.nsmSession.user_breakdown) || AppState.nsmBreakdownDraft || {};
    var metricText = isCoach
      ? (ctree[dim] || '—')
      : (dim === 'nsm' ? (AppState.nsmNsmDraft || '（未填寫）') : (bd[dim] || '（未填寫）'));
    var prefix = isCoach ? '教練版 ' : '你的 ';
    var rationaleText = isCoach ? (rationale[dim] || '') : '';
    return '<div class="nsm-detail-metric">' +
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

  document.querySelectorAll('.nsm-tree-node[data-node]').forEach(function(node) {
    node.addEventListener('click', function() {
      var key = node.dataset.node;
      var isCoach = node.dataset.isCoach === '1';
      var dim = key.replace('coach-','').replace('user-','');
      var dimLabel = node.dataset.label || dim;
      var html = _nsmBuildDetailHTML(dim, dimLabel, isCoach);

      if (_nsmIsMobileCmp && _nsmSheetEl && _nsmSheetBody) {
        // Mobile: bottom sheet
        if (AppState.nsmOpenNode === key && _nsmSheetEl.classList.contains('open')) {
          _nsmCloseSheet();
        } else {
          AppState.nsmOpenNode = key;
          _nsmSheetBody.innerHTML = html;
          _nsmSheetEl.classList.add('open');
          _nsmSheetEl.setAttribute('aria-hidden', 'false');
          if (_nsmSheetBackdrop) _nsmSheetBackdrop.classList.add('open');
        }
        return;
      }

      // Desktop: inline detail panel
      var detailEl = document.getElementById('nsm-node-detail');
      if (!detailEl) return;
      if (AppState.nsmOpenNode === key) {
        AppState.nsmOpenNode = null;
        detailEl.style.display = 'none';
        detailEl.innerHTML = '';
      } else {
        AppState.nsmOpenNode = key;
        detailEl.style.display = 'block';
        detailEl.innerHTML = html;
      }
    });
  });

  // Mobile sheet close handlers (backdrop / handle / ESC)
  if (_nsmIsMobileCmp && _nsmSheetEl) {
    if (_nsmSheetBackdrop) _nsmSheetBackdrop.addEventListener('click', _nsmCloseSheet);
    if (_nsmSheetHandle) {
      _nsmSheetHandle.addEventListener('click', _nsmCloseSheet);
      _nsmSheetHandle.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); _nsmCloseSheet(); }
      });
    }
    document.addEventListener('keydown', function _nsmEscClose(e) {
      // J16 — Esc closes the detail sheet first; stopPropagation prevents
      // any outer listener (e.g. parent NSM panel) from also closing on the
      // same keystroke. User must press Esc a second time to close outer.
      if (e.key === 'Escape' && _nsmSheetEl.classList.contains('open')) {
        e.stopPropagation();
        _nsmCloseSheet();
      }
    }, true);
  }

  // Restore open node if any (desktop only — mobile sheet doesn't need restore on render)
  if (AppState.nsmOpenNode && !_nsmIsMobileCmp) {
    var openNode = document.querySelector('.nsm-tree-node[data-node="' + AppState.nsmOpenNode + '"]');
    if (openNode) openNode.click();
  }

  // Step 4: action buttons
  document.getElementById('btn-nsm-again')?.addEventListener('click', function() {
    AppState.nsmStep = 1;
    AppState.nsmSession = null;
    AppState.nsmSelectedQuestion = null;
    AppState.nsmNsmDraft = '';
    AppState.nsmDefinitionDraft = '';
    AppState.nsmBusinessLinkDraft = '';
    AppState.nsmBreakdownDraft = {};
    AppState.nsmVanityWarning = null;
    AppState.nsmGateResult = null;
    AppState.nsmSubTab = 'nsm-step2';
    render();
  });
  document.getElementById('btn-nsm-home')?.addEventListener('click', nsmResetToHome);

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
