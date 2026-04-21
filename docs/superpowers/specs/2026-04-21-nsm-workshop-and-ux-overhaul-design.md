# PM Drill — NSM Workshop + UX Overhaul 設計文件

**日期：** 2026-04-21
**版本：** v1.0
**狀態：** 待實作

---

## 背景與目標

本次改版包含兩條主線：

1. **新功能：北極星指標 (NSM) 拆解工作坊** — 訓練 PM 定義與拆解 North Star Metric，以真實企業情境出題，含 AI 教練點評與雷達圖評分
2. **UX 全面修正** — 解決 UI/UX 稽查員找出的 4 CRITICAL + 10 HIGH 問題，重點在手機使用體驗、鍵盤遮擋、觸控目標尺寸

---

## 技術棧決策

| 項目 | 決定 | 理由 |
|------|------|------|
| Framework | **保留 vanilla JS**，不遷移 React | 現有 render 架構完整，改動最小，手機 RWD 問題用 CSS + visualViewport API 解決 |
| NSM 架構 | **Wizard 單一 View**（`view: 'nsm'`） | 手機體驗最佳；與現有 practice view 模式一致 |
| 樹狀圖 | **CSS + SVG 靜態對比**，tap 展開節點說明 | 4 個節點不需要 reactflow；手機上互動式拖拉體驗差 |
| DB | **現有 Supabase 專案**，新增 `nsm_sessions` table | 不開新專案；保留完整 session 歷史 |
| Icons | **Phosphor Icons（已有 CDN）**，全面移除 emoji | 一致性、可控性、深淺主題皆支援 |

---

## 全域 UX 修正

### CRITICAL 修正（必須）

#### C1 — 手機鍵盤遮擋 Practice View（重構底欄）

**問題：** 虛擬鍵盤出現時壓縮視口，底欄被推走，chat 區域幾乎看不見。

**解法：**
```css
/* 底欄改為 fixed，不隨鍵盤移動 */
.practice-bottom-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding-bottom: max(12px, env(safe-area-inset-bottom));
  z-index: 100;
}

/* 聊天區加動態 padding，不被底欄遮住 */
.chat-area {
  overflow-y: auto;
  /* padding-bottom 由 JS 動態設定 = 底欄高度 */
}
```

```javascript
// visualViewport API：監聽鍵盤開啟
if (window.visualViewport) {
  visualViewport.addEventListener('resize', () => {
    const keyboardHeight = window.innerHeight - visualViewport.height;
    const bar = document.querySelector('.practice-bottom-bar');
    if (bar) bar.style.bottom = keyboardHeight + 'px';
    // 鍵盤開啟時自動捲到最新訊息
    if (keyboardHeight > 100) scrollChatToBottom();
  });
}
```

**同樣機制套用於 NSM Step 3（拆解表單）的底部送出按鈕。**

#### C2 — iOS Safari 網址列跳動

```css
/* 全頁 view 改用 dvh */
body[data-view="practice"] { height: 100dvh; }
body[data-view="nsm"]      { height: 100dvh; }

/* 禁止 main container 高度因網址列重算而跳動 */
#app { min-height: 100dvh; }
```

#### C3 — 所有按鈕觸控目標 ≥ 44px

```css
.btn-icon  { min-width: 44px; min-height: 44px; padding: 10px; }
.btn-tool  { min-height: 44px; padding: 10px 14px; }
.send-btn  { width: 44px; height: 44px; }
/* 所有 tab-btn */
.tab-btn   { min-height: 44px; }
```

#### C4 — 定義面板加關閉按鈕 + max-height 限制

```html
<!-- 定義面板 header 加 X 按鈕 -->
<div class="def-panel-header">
  <label>問題本質定義</label>
  <button class="btn-icon" id="btn-close-def" aria-label="關閉定義面板">
    <i class="ph ph-x"></i>
  </button>
</div>
```

```css
.def-panel {
  max-height: 120px; /* 不超過 2 行 textarea */
  overflow: hidden;
}
```

#### C5 — API 呼叫 Loading 狀態

- 選難度：卡片加 spinner overlay，`pointer-events: none`
- 送出對話（`sendChat`）：送出按鈕替換為 spinner，輸入框 disabled
- 提交定義（`submitDefinition`）：按鈕 loading 狀態 + 全域進度條

### HIGH 修正

| # | 問題 | 修法摘要 |
|---|------|---------|
| H1 | Report Tab Bar 手機擠壓 | `overflow-x: auto; -webkit-overflow-scrolling: touch`；每個 tab `min-width: 72px` |
| H2 | Offcanvas 關閉後 body overflow 未還原 | `navigate()` 開頭加 `closeOffcanvas()` 保護；`closeOffcanvas` 始終重置 overflow |
| H3 | Chat empty state 無引導 | 第一次進入時顯示引導卡：「向被訪談者提問吧！試著先了解他的角色。」 |
| H4 | Issue Banner 視覺互動提示弱 | 加 hover/active 態；banner 右側顯示「點擊展開/收合」文字（首次） |
| H5 | API 失敗訊息無視覺區分 | 錯誤 bubble 加 `border-left: 3px solid var(--danger)` + 重試按鈕 |
| H6 | Review Table 桌面版不完整 | 大螢幕（≥768px）顯示 table；小螢幕顯示 card，兩套 HTML 同時 render |
| H7 | Toolbar 按鈕 wrap 亂版 | `flex-wrap: nowrap`；文字在 320px 以下縮短為「提示」「定義」 |
| H8 | Placeholder 多行在手機亂 | 移除 `\n`，placeholder 改為單行：「用中性問句描述問題本質…」 |
| H9 | Offcanvas overlay 動畫 | 關閉時加 `opacity` 淡出 transition（0.2s） |
| H10 | Bubble 手機版 95% 太貼邊 | 改為 `max-width: 88%; margin: 0 4px` |

---

## 首頁重構

### 佈局變更

```
原：[難度卡片 Grid]

新：
[Navbar]
[Tab Toggle: PM 訪談 | 北極星指標]
  ── PM 訪談 tab ──
  [難度選擇 List（入門/進階/困難，帶場景說明）]
  [最近練習（PM + NSM 混合，最多 3 筆）]
  ── 北極星指標 tab ──
  [NSM 說明卡]
  [統計（題庫數/評分維度/步驟數）]
  [隨機盲抽按鈕]
  [手動選題（情境卡片 List）]
```

### 難度卡片改版

- Grid → **垂直 List**（手機觸控更準確）
- 每項高度 ≥ 56px（含圖示 + 標題 + 場景說明）
- 圖示：`ph-leaf`（入門）/ `ph-flame`（進階）/ `ph-lightning`（困難）

### 最近練習

- 從 Offcanvas 複製最近 3 筆到首頁（PM + NSM 均顯示）
- PM 練習：顯示難度 badge + 進度/分數
- NSM 練習：顯示公司名 + 分數，badge 使用紫色
- Offcanvas 保留完整歷史列表

---

## NSM 工作坊

### State 擴充

```javascript
// AppState 新增
nsmStep: 1,                // 1 | 2 | 3 | 4
nsmSession: null,          // { id, question, userNsm, userBreakdown, scores }
nsmSelectedQuestion: null, // 當前題目 JSON
```

### 路由

```javascript
case 'nsm': main.innerHTML = renderNSM(); bindNSM(); break;
```

`renderNSM()` 根據 `AppState.nsmStep` 渲染對應 sub-view。

### Step 1 — 情境選擇

- 從題庫（`NSM_QUESTIONS` array）隨機抽 3 題，或顯示「隨機盲抽」按鈕
- 每張卡片：公司 badge + 情境描述
- 選中後高亮 + `ph-check-circle`
- 確認後建立 `nsm_sessions` DB record，`status: 'in_progress'`，進入 Step 2

### Step 2 — 定義 NSM

**頂部固定情境卡（sticky）：** 公司名 + 情境摘要（不可關閉）

**主體：**
- 大型 textarea：「你認為 [公司] 的北極星指標是？」
- 送出後呼叫 AI 判斷（或前端比對 `anti_patterns`）

**虛榮指標軟警告：**
```
[ph-warning 警告色] 這可能是虛榮指標

[警告說明：這個指標如果翻倍，公司一定更賺錢嗎？]

[教練引導區（橘色背景）]
[ph-lightbulb] 教練引導
  一句話引導方向，不直接給答案

[重新定義（主要）] [我知道風險，繼續（次要）]
```

警告判斷邏輯（前端優先，避免多餘 API 呼叫）：
```javascript
function isVanityMetric(input, antiPatterns) {
  return antiPatterns.some(p =>
    input.toLowerCase().includes(p.toLowerCase())
  );
}
```

### Step 3 — 拆解維度

固定顯示 NSM 摘要（sticky，可捲動）

四個維度輸入區（垂直堆疊，手機友善）：

| 維度 | 顏色 | 說明文字 | Placeholder |
|------|------|---------|-------------|
| 觸及廣度 (Reach) | 藍 `#3b82f6` | 衡量你的 NSM 觸及多少獨立用戶 | 例：月啟動播放的 MAU 數量 |
| 使用深度 (Depth) | 紫 `#8b5cf6` | 衡量每次互動的品質 | 例：每次 session 平均收聽時長 |
| 使用頻率 (Frequency) | 綠 `#10b981` | 衡量使用習慣是否形成 | 例：每週收聽天數 |
| 轉換效率 (Efficiency) | 橘 `#f59e0b` | 衡量行為是否帶來商業價值 | 例：試用轉付費率 |

底部固定送出按鈕（`position: fixed`，同 C1 修法）

送出後：呼叫後端 `/api/nsm-sessions/:id/evaluate`，進入 Step 4

### Step 4 — 評分報告

**Navbar：** `ph-list`（左）+ `NSM 報告`（中）+ `ph-house`（右，回首頁）

**固定分數摘要列：** 總分 / 100 + 進度條 + 公司名

**Tab Bar（4 個，可橫向捲動）：**

| Tab | 內容 |
|-----|------|
| 總覽 | 雷達圖（現有 SVG 複用）+ 五維度橫向 bar |
| 對比 | 學員樹 vs 教練樹（CSS 雙欄），tap 節點彈出說明 |
| 亮點 | `ph-trophy` 最佳亮點 + `ph-warning` 主要陷阱 + summary |
| 匯出 | PDF / PNG 按鈕 + 「再練一次」按鈕 |

**對比樹節點狀態：**
- 綠邊框：方向正確
- 紅邊框（淡）：方向偏差
- 紫邊框：教練特有（學員未提到）

**Tap 節點 → Inline 說明卡展開（不用 modal）**

---

## 後端變更

### 新增 API

| Endpoint | Method | 說明 |
|----------|--------|------|
| `/api/nsm-sessions` | POST | 建立 NSM session（含 questionId） |
| `/api/nsm-sessions` | GET | 列出使用者的 NSM sessions |
| `/api/nsm-sessions/:id` | GET | 取得完整 session |
| `/api/nsm-sessions/:id/evaluate` | POST | 呼叫 AI 評分，回傳 scores + coach tree |
| `/api/nsm-sessions/:id` | DELETE | 刪除 |

Guest 模式：對應 `/api/guest/nsm-sessions`（同現有 PM Drill 模式）

### 新增 DB Table

```sql
CREATE TABLE nsm_sessions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES auth.users(id),
  guest_id    text,
  question_id text NOT NULL,
  question_json jsonb NOT NULL,       -- 完整題目快照
  status      text DEFAULT 'in_progress', -- in_progress | completed
  user_nsm    text,
  user_breakdown jsonb,               -- { reach, depth, frequency, efficiency }
  scores_json jsonb,                  -- { alignment, leading, actionability, simplicity, sensitivity, totalScore, coachComments }
  coach_tree_json jsonb,              -- 教練拆解樹
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);
```

### 新增 Prompt — `prompts/nsm-evaluator.js`

五大維度評分（各 1–5 分，總分 × 4 = 100 分）：

| 維度 | 說明 |
|------|------|
| 價值關聯性 (Alignment) | 指標是否反映商業價值 |
| 領先指標性 (Leading) | 能否預測未來營收 |
| 操作性 (Actionability) | 開發團隊能否透過功能影響此指標 |
| 可理解性 (Simplicity) | 指標是否直觀易懂 |
| 週期敏感度 (Sensitivity) | 變化能否即時觀測 |

回傳 JSON 格式：
```json
{
  "scores": {
    "alignment": 4,
    "leading": 3,
    "actionability": 4,
    "simplicity": 5,
    "sensitivity": 3
  },
  "totalScore": 76,
  "coachComments": {
    "alignment": "你的指標確實反映了用戶真實參與行為，但...",
    "leading": "...",
    "actionability": "...",
    "simplicity": "...",
    "sensitivity": "..."
  },
  "coachTree": {
    "nsm": "每月付費用戶深度收聽時長",
    "reach": "付費 MAU 數",
    "depth": "完整曲目完成率",
    "frequency": "連續 7 天收聽率",
    "efficiency": "Playlist 互動後轉付費率"
  },
  "bestMove": "...",
  "mainTrap": "...",
  "vanityWarningExplanation": "..."  // 若觸發虛榮指標，額外提供引導說明
}
```

---

## NSM 題庫（共 24 題）

現有 12 題（Netflix / Shopee / Slack / Uber / Tinder / ChatGPT / Strava / GitHub / Duolingo / Gogoro / Binance / Notion）+ 新增 12 題：

| 公司 | 產業 | 商業情境重點 | NSM 關鍵字 | 虛榮指標陷阱 |
|------|------|------------|-----------|-------------|
| Spotify | 音樂串流 | 廣告+訂閱雙收入，需確保真實收聽 | 付費活躍收聽時長、完整播放率 | DAU、App 開啟次數 |
| Airbnb | 雙邊住宿平台 | 買賣雙方黏著，訂單才是核心 | 成功完成訂單數、無退訂率 | 房源上架數、搜尋次數 |
| LinkedIn | 職業社群 | 價值在媒合，而非滑動內容 | 成功媒合數、訊息回覆率 | 個人資料瀏覽量、連結數 |
| Figma | 設計協作工具 | 協作才是護城河，個人使用易被替代 | 多人協作檔案數、留存率 | 檔案建立數、登入次數 |
| Grab | O2O 超級 App | 東南亞市場擴張，關鍵在完成交易 | 成功完成行程+餐飲訂單數 | App 安裝數、騎手上線時數 |
| Miro | 視覺協作白板 | 遠距團隊工具，沉默用戶高流失率 | 每週多人協作 session 數 | 白板建立數、貼紙使用次數 |
| Canva | 設計民主化 | 免費轉付費是核心，創作才有留存 | 發布/分享設計數、Pro 轉換率 | 範本使用次數、總設計數 |
| Coursera | 線上學習 | 學習完課才有口碑，中途棄課是問題 | 課程完成率、證書取得數 | 課程報名數、影片播放數 |
| Shopify | 電商基礎設施 | 商家成功才是 Shopify 成功 | 商家 GMV 成長率、持續經營月數 | 商家開店數、App 安裝數 |
| Discord | 遊戲社群 | 社群黏著才有付費意願 | 活躍伺服器數、每週發言用戶率 | 總伺服器數、語音連線次數 |
| Klook | 旅遊體驗預訂 | 體驗完成才有口碑與留存 | 完成體驗訂單數、NPS | 搜尋次數、心願清單數 |
| Waze | 社群導航 | 路況回報是核心護城河 | 活躍回報用戶數、路況準確率 | 導航啟動次數、App 下載數 |

---

## 驗收標準

| 項目 | 驗收方式 |
|------|---------|
| 手機鍵盤不遮擋 | iPhone SE (375px) 開鍵盤後 chat 區域仍可捲動，底欄可見 |
| iOS 網址列不跳動 | Safari 捲動時 layout 穩定，無高度重算閃動 |
| 所有觸控目標 ≥ 44px | DevTools 量測所有互動元素 |
| NSM 完整流程 | 手機可完整走完 Step 1–4，不破版 |
| 虛榮指標警告 | 輸入「DAU」等陷阱詞，出現警告 + 教練引導 |
| 對比樹 tap 互動 | 點擊任一節點展開說明卡，再點收合 |
| NSM session 儲存 | 完成後歷史列表出現；重開 App 可看到記錄 |
| Offcanvas 顯示 NSM | NSM session 與 PM session 混合列出，標示區分 |
| Report Tab 手機捲動 | 4 個 Tab 超出寬度時可橫向捲動，不破版 |
| 無 emoji 殘留 | 全站搜尋 emoji Unicode，確認清零 |
| 深色主題完整 | 切換深色主題後 NSM 所有頁面對比度正常 |

---

## 實作優先序

1. **Phase 1（UX 修正）：** C1 鍵盤修正、C3 觸控目標、C4 定義面板關閉、C5 Loading 狀態、H1 Tab 捲動
2. **Phase 2（首頁重構）：** Tab Toggle、難度卡 List、最近練習整合
3. **Phase 3（NSM 後端）：** DB table、API routes、nsm-evaluator prompt、題庫 JSON
4. **Phase 4（NSM 前端）：** Wizard view Step 1–4、虛榮指標警告、對比樹
5. **Phase 5（整合）：** Offcanvas NSM sessions、首頁歷史混合、全站 emoji 清除
