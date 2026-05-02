# PM Drill 前端重寫 — Master Spec（總規格凍結書）

> **Goal:** 後端 / API / DB / OpenAI prompt / 商業邏輯 / jest 測試 100% 不動。前端 CSS + render 結構從 0 重寫，達到 https://aistockmap.com 在 iOS Safari 手機上的滑順度。
>
> **Authority:** 本文件是「重寫的對齊基準」。實作完成後逐條打勾驗收，未對齊 = 未完成。
>
> **Source:** 由三個並行 Explore agent 對 `public/` `routes/` `prompts/` `circles_plan/` `nsm_plan/` `db/` 全盤掃描合成。每條規格都有 `file:line` 引用，重寫時遇到模糊一律查原檔。

---

## 0. NFR — 非功能性硬要求（決定能不能 ship）

### 0.1 滑順度標竿
目標：iPhone Safari 上的滑順度 ≥ https://aistockmap.com（user 已親身體驗、認為是業界手機 web 標竿）。

### 0.2 iOS Safari 必驗 checklist（每次 ship 前必走）
1. **100vh 不跳** — 全用 `100dvh`（已有），不留 `100vh`；地址列出現 / 收起時 layout 不跳
2. **safe-area-inset 全處理** — sticky 底部 bar 用 `padding-bottom: max(N, env(safe-area-inset-bottom))`；notch 區不被擋
3. **input 16px 防 zoom** — 所有 `<input>` `<textarea>` font-size ≥ 16px on mobile（防 focus 自動放大）
4. **Tap highlight 透明** — `* { -webkit-tap-highlight-color: transparent }`（已有，保留）
5. **動畫 GPU-accelerated** — 用 `transform` / `opacity`，禁用 `top/left/width/height` 做動畫；offcanvas slide 用 `translate3d`
6. **Sticky 行為穩定** — 所有 `position: sticky` 元素必驗：滾動時不抖、不消失、不蓋住內容
7. **Momentum scroll** — 滾動容器用 `overflow-y: auto`（不用 `scroll`，iOS 預設已是 momentum）
8. **鍵盤彈出 layout 不亂跳** — `interactive-widget=resizes-visual` viewport meta（已有）；input focus 後 sticky bar 不被鍵盤吃掉
9. **Modal / Offcanvas focus trap** — 開啟時鎖 body scroll、Esc 關、overlay 點擊關
10. **無 FOUC** — initial render 不出現 unstyled flash（CSS load order 注意）
11. **Touch target ≥ 44px** — 所有可點擊元素（含 close button）touch box ≥ 44×44
12. **Long content 不爆版** — 中文 / 英文長字串都不溢出（`word-break: break-word; overflow-wrap: anywhere`）
13. **`backdrop-filter` 雙前綴** — 每處 `backdrop-filter` 都加 `-webkit-backdrop-filter`
14. **滾動性能** — 60fps（用 Safari Devtools Performance tab 驗證主要互動：滾動、offcanvas 開關、phase 切換、chat 串流）
15. **無 layout thrashing** — 重 render 不觸發整頁重排；用 will-change / transform 隔離

### 0.3 視覺品質硬要求（pitch-ready standard）
- 1px 對齊嚴格：所有 ruler / border 落在像素邊界
- 間距用 4 / 8 / 12 / 16 / 24 倍數，不留 random magic number
- 同行元素 baseline 一致；多行 box 內 icon 垂直置中（用 `top: 50%; transform: translateY(-50%)` 不用 magic top）
- emoji 一律禁，icons 用 Phosphor (`ph-*`)
- 中文字型 stack：`system-ui, -apple-system, BlinkMacSystemFont, 'PingFang TC', 'Microsoft JhengHei', 'Heiti TC', 'Noto Sans TC', sans-serif`
- Instrument Serif 例外：grade letter A/B/C/D 才用，其餘 system-ui

### 0.4 Mockup 規範
- **每張 mockup 三裝置並排**：mobile 360 / tablet 768 / desktop 1280，內容一致不縮減
- 每張 mockup 必須 `<link rel="stylesheet" href="../../../public/style.css">` 跑真產品 CSS
- HTML class 用真產品類名，不自創，方便 1:1 對映實作
- 每張 mockup 需 user 「放行」才往下做

### 0.5 視覺對齊測試 Stack（過去 SP2 失敗模式針對性補強）

**過去失敗 root causes（按頻率）：**
1. DOM 通過但視覺錯（`count() > 0` 綠不代表排版對）
2. Chromium 通過 Safari 錯（過去只跑 chromium）
3. 我自宣稱「看起來好」其實沒用 Read tool 看 PNG
4. Mockup 通過 production 失敗（兩邊沒 pixel diff）
5. 1px 偏移 visual diff threshold 抓不到
6. Hover / focus / disabled / empty / error / loading / overflow / 長短文 各狀態漏覆蓋
7. Bundle 改 A 動到 B、cross-screen 一致性沒鎖

**Stack（每層都必須執行，缺一 bundle 不過）：**

#### Layer 1 — Mockup-as-Spec（基準凍結）
- 每張 mockup HTML 含 per-state 矩陣（default / hover / focus / disabled / empty / error / loading / long-text / short-text）
- 真 CSS link + 真 class names
- Playwright 對 mockup file 截圖 → 存 `tests/visual/baselines/{viewport}/{screen}/{state}.png`
- **user 放行的當下凍結，後續所有 bundle 對這份 PNG diff**

#### Layer 2 — Production ↔ Mockup pixel diff
- 同 viewport / 同 state，跑 production route screenshot
- vs Layer 1 baseline 用 `pixelmatch` diff，threshold 0.5%
- 差異 > threshold → BLOCK（CI / pre-commit hook 雙重）

#### Layer 3 — Layout invariant assertion（數字級對齊）
- 每張畫面 5-10 條 `boundingBox()` 規則
- 範例：
  ```js
  expect(banner.x).toBe(navbar.x);                                     // 左 edge 對齊
  expect(banner.x + banner.width).toBe(navbar.x + navbar.width);       // 右 edge 對齊
  expect(Math.abs(card.y - (navbar.y + navbar.height))).toBeLessThan(1);  // 緊鄰
  ```
- 這層抓 visual diff 抓不到的「對齊偏 1px」case

#### Layer 4 — WebKit + Chromium 雙引擎
- Playwright project list 必含 `chromium` + `webkit`
- WebKit on Mac ≠ 真 iPhone Safari，但比沒驗好 100×

#### Layer 5 — State matrix 覆蓋率檢查
- spec 列舉每 widget 所有 state
- mockup 提供對應 fixture
- baseline PNG 必含全部
- 自動 audit：spec list ⊆ fixture list ⊆ baseline PNG list；任何缺漏 → BLOCK

#### Layer 6 — Director eyeball walk（紀律強制）
- 14-box gate Box 4 必須附 **Read tool 證據 + 每張 PNG ≥ 1 句評論**
- 產物：`audit/eyeball-bundle-N.md`，無此檔 = bundle 不過
- 抓我跳步驟唯一辦法

#### Layer 7 — User 真機抽驗
- 每 batch（不是每 bundle）user 從 iPhone Safari 真機看
- ngrok 開 dev server
- 找 stack 全漏的東西
- **不該靠 user 做日常 review — 是最後守門**

#### Layer 8 — Pre-commit hook + CI gate
- pre-commit：跑 Layer 2 + 3 對「本 bundle 改動畫面」
- CI：跑 Layer 1-5 × 8 viewport
- 缺一綠燈 → PR 不能 merge
- **連 user 不能 bypass**

### 0.6 子系統 — `tests/visual/`
```
tests/visual/
  baselines/                # mockup 階段凍結的 PNG（per state × viewport）
    {viewport}/{screen}/{state}.png
  diffs/                    # CI 跑出差異 PNG（debug 用，gitignore）
  invariants/               # Layer 3 規則
    {screen}.invariants.spec.js
  matrix/                   # Layer 5 覆蓋率 audit
    state-matrix.audit.js
  fixtures/                 # mockup HTML（per state）
    {screen}-{state}.html
```
未來 SP3 / SP4 / 任何 feature 都走同一套。

### 0.7 老實的限制
1. 沒銀彈：Layer 1-5 自動化抓客觀對齊 95%+，**美學判斷**（typography + spacing 好不好看）只能 user 看
2. WebKit on Mac ≠ iPhone Safari：真機觸控 / 鍵盤彈出 / safe-area 仍要 Layer 7
3. Threshold trade-off：太嚴 anti-aliasing 抓 false positive，太鬆漏 1px 偏移；用 `0.5% pixel diff + 數字級 invariant` 雙保險
4. 我的紀律問題工具不能完全解決 — Layer 6 寫死流程，但執行看我；user 保留隨時抽問權

---

## 1. Backend Contract（CONTRACT-LOCKED — 一個字都不能改）

### 1.1 API endpoints（authed + guest 雙軌）

#### CIRCLES sessions
| Method | Path | 用途 | Auth | 來源 |
|---|---|---|---|---|
| POST | `/api/circles-sessions` | 建立 session | Bearer | routes/circles-sessions.js:20 |
| POST | `/api/circles-sessions/draft` | 懶建（已存在則回原 session）| Bearer | routes/circles-sessions.js:39 |
| GET | `/api/circles-sessions` | 列表（含 `currentQuestion` 補強欄位）| Bearer | routes/circles-sessions.js:101 |
| GET | `/api/circles-sessions/:id` | 單筆 | Bearer | routes/circles-sessions.js:116 |
| DELETE | `/api/circles-sessions/:id` | 刪除 | Bearer | routes/circles-sessions.js:129 |
| POST | `/api/circles-sessions/:id/gate` | Phase 1.5 框架審核 | Bearer | routes/circles-sessions.js:143 |
| POST | `/api/circles-sessions/:id/message` | Phase 2 對話（**SSE streaming**）| Bearer | routes/circles-sessions.js:166 |
| POST | `/api/circles-sessions/:id/evaluate-step` | Phase 3 評分 | Bearer | routes/circles-sessions.js:217 |
| POST | `/api/circles-sessions/:id/conclusion-check` | 結論驗證 | Bearer | routes/circles-sessions.js:249 |
| PATCH | `/api/circles-sessions/:id/progress` | 部分儲存（shallow merge）| Bearer | routes/circles-sessions.js:267 |
| POST | `/api/circles-sessions/:id/final-report` | Phase 4 全報告 | Bearer | routes/circles-sessions.js:308 |
| POST | `/api/circles-sessions/:id/hint` | 欄位 hint | Bearer | routes/circles-sessions.js:344 |
| POST | `/api/circles-sessions/:id/example` | curated example | Bearer | routes/circles-sessions.js:363 |

Guest 平行對應：`/api/guest-circles-sessions/*`（headers 用 `X-Guest-ID` UUIDv4，routes/guest-circles-sessions.js 全套）

#### NSM sessions
- POST/GET/DELETE `/api/nsm-sessions`、`/api/nsm-sessions/:id`
- POST `/api/nsm-sessions/:id/{evaluate,gate,context,hints}`
- PATCH `/api/nsm-sessions/:id/progress`
- Guest 對應：`/api/guest/nsm-sessions/*`
- Stateless：POST `/api/nsm-context`

#### Stats / Public / Auth / Migration
- GET `/api/circles-stats` → `{ completed, active, weeklyCompleted }`
- POST `/api/circles-public/{hint,example}`、GET `/api/circles-public/all-examples`
- POST `/api/auth/register` → `{ ok, userId }`
- POST `/api/migrate-guest`（authed + guest header 雙驗證）

### 1.2 SSE 訊息格式（Phase 2 對話 — CONTRACT-LOCKED）
```
data: {"delta":"chunk text"}
data: {"done":true,"turn":{userMessage, interviewee, coaching, hint}}
data: {"error":"code","raw":"first 500 chars"}
```
**三角色解析 regex：**
- `/【被訪談者】[ \t]*\r?\n([\s\S]*?)(?=【教練點評】|$)/`
- `/【教練點評】[ \t]*\r?\n([\s\S]*?)(?=【教練提示】|$)/`
- `/【教練提示】[ \t]*\r?\n([\s\S]*?)$/`

### 1.3 DB tables（schema 不動）
- `circles_sessions`：id / user_id / guest_id / question_id / question_json / mode / drill_step / sim_step_index / current_phase / status / step_scores / step_drafts / framework_draft / gate_result / conversation / created_at / updated_at
- `nsm_sessions`：id / user_id / guest_id / question_id / question_json / status / user_nsm / user_breakdown / scores_json / coach_tree_json / progress_json
- 唯一鍵：`(owner, question_id, mode, COALESCE(drill_step,''))` where `status='active'` — drill 同題同步驟只能有一個 active session
- `practice_sessions` / `guest_sessions`：legacy，保留（migrate 用）

### 1.4 LLM 整合（model: `gpt-4o`，全鎖死）
| Function | Endpoint | 模式 | 溫度 | max_tok |
|---|---|---|---|---|
| streamCirclesReply | /message | streaming | 0.7 | 600 |
| evaluateCirclesStep ⚠ | /evaluate-step | JSON 一次回 | 0.3 | 800 |
| reviewFramework | /gate | JSON + 3 retry | 0.3 | 800 |
| generateFinalReport | /final-report | JSON | - | - |
| generateCirclesHint / Example | /hint /example | JSON | - | - |
| evaluateNSM / reviewNSMGate / generateNSMContext / generateNSMHints | NSM endpoints | JSON | - | - |

> **⚠ SP3 backend bundle 待 merge — 本表將在 SP3 完成後更新：**
> - `evaluateCirclesStep` 的 response schema：`coachVersion` 從 `string` 改為 `{ context: string, perField: [{key, example}], reasoning: string }`
> - `/evaluate-step` route 加 `EVAL_TIMEOUT` / `EVAL_API_ERROR` / `EVAL_PARSE_ERROR` / `EVAL_AUTH_ERROR` 四種 error code
> - `/evaluate-step` 加 30s AbortController timeout
> - SP3 backend merge 前：**Phase 3 / Phase 4 / Phase 3 error / loading mockup 不准開畫**（rendering 結構直接吃此 schema）
> - SP3 backend merge 後：本表 + §2.9 同步更新並把此提示框移除

### 1.5 Auth 機制
- Supabase JWT in `Authorization: Bearer <token>` header（無 cookie）
- Guest：`X-Guest-ID` header（UUIDv4 regex 嚴驗）
- 註冊：email + password + `email_confirm=true`（無驗證信）
- **無 magic link / OAuth**

### 1.6 ENV 變數
- `OPENAI_API_KEY` / `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` / `PORT`

### 1.7 Static assets 路徑（不能改）
- `/index.html` `/app.js` `/style.css` `/favicon.svg` `/circles-db.js`
- `circles-db.js` 載 `CIRCLES_QUESTIONS` 全域陣列（1.8MB，不入 bundle）

### 1.8 Question schema（CONTRACT-LOCKED 欄位）
```
id / company / product / question_type / difficulty / problem_statement / hidden_context
coach_circles: { C1, I, R, C2, L, E, S }   // 教練示範答案
common_wrong_directions: [...]               // gate 用
anti_patterns: [...]
field_examples: { C1: { 問題範圍, 業務影響, ... }, I: {...}, ... }
analysis: { traps, business, users, insight }
```

---

## 2. Frontend Surface — 全畫面 / 全 state / 全互動清單

### 2.1 AppState 結構
**Auth modes** — `loading` | `auth` | `guest`（app.js:9, 885, 893）
**View routes** — `home` | `login` | `register` | `practice` | `report` | `history` | `circles` | `nsm`（app.js:954-961）
**CIRCLES** — `circlesMode` (`drill`|`simulation`)、`circlesPhase` (1, 1.5, 2, 3, 4)、`circlesDrillStep` (**C1 / I / R only — 見 §2.1.1**)、`circlesSimStep` (0..6)、`circlesStale`
**NSM** — `nsmStep` (1..4)

### 2.1.1 兩種練習模式（CONTRACT-LOCKED）

| 規格 | 完整練習 simulation | 個別步驟 drill |
|---|---|---|
| 步驟範圍 | 7 步（C1→I→R→C2→L→E→S）| 僅 C1 / I / R 三選一 |
| State key | `circlesSimStep: 0..6` | `circlesDrillStep: 'C1'\|'I'\|'R'` |
| 步驟間導航 | **可來回上一步 / 下一步**（done 步驟可回看；active 可前進到下一步）| **無步驟間導航 — 該步結束即整 session 結束** |
| 進度顯示 | 7 步 progress bar（chrome 區滿寬）| 無 progress bar（單步 session 不需）|
| Phase 流 | Phase 1 → 1.5 → 2 → 3 →（下一步）→ Phase 1（next step）| Phase 1 → 1.5 → 2 → 3 → END |
| 完成條件 | 7 步全評分後 → Phase 4 final report | Phase 3 評分完即 status='completed' |
| 鎖定理由 | — | C2/L/E/S 依賴前步輸出（取捨需有方案、評估需有取捨等），無法獨立練習 |
| 來源鎖 | app.js:2275-2279 | app.js:2287 lock note |

### 2.1.2 表單提示 / Hint 系統（三層 — CONTRACT-LOCKED）
每個 framework field 都有 3 層輔助：
1. **靜態 `hintOverlay` 文案** — `CIRCLES_STEP_CONFIG` 內 hardcoded 80-100 字 zh-TW（app.js:317-624）；點 field 旁的 `ph-info` 或 `ph-lightbulb` icon 觸發
2. **AI hint button**（`POST /api/circles-(public|sessions)/:id/hint`）— 動態 LLM 生成、針對該題該欄位給「破題提示」；觸發後打開 `.hint-overlay` modal（style.css:3548）
3. **AI example button**（`POST /api/circles-(public|sessions)/:id/example`）— 動態 LLM 生成或讀題目 `field_examples` curated；同樣 modal 呈現

**Modal 行為：**
- backdrop 點擊關 + Esc 關 + close button 關
- loading skeleton（spinner + 「教練思考中…」）
- error retry
- focus trap

**Tooltip 行為（step pill / icon）：**
- hover 顯示 80-200ms delay
- mobile click toggle
- 自動 reposition 不超出 viewport

### 2.2 全畫面清單（必出 mockup × 3 viewport）
| # | Screen | 入口 | DOM root class | 來源 |
|---|---|---|---|---|
| A | Home（landing）| `/` | `.home-wrap` | renderHome() app.js:4819 |
| B | Login / Register | guest 點登入 | `.auth-form` | renderAuth() app.js:5029 |
| C | CIRCLES Home（題目列表 + drill rail）| navbar CIRCLES | mobile `.circles-home-wrap` / desktop `.circles-home-desktop` | renderCirclesHome() app.js:2251, 2404 |
| D | CIRCLES Phase 1 表單 | 選題 → 進入 | `.circles-phase1-wrap` / `.phase1-desktop` | renderCirclesPhase1() app.js:2989 |
| E | CIRCLES Phase 1.5 Gate | Phase 1 提交 | `.circles-gate-wrap` | renderCirclesGate() app.js:3651 |
| F | CIRCLES Phase 2 對話 | gate 通過 | `.circles-chat-wrap` / `.circles-chat-desktop` | renderCirclesPhase2() app.js:3788 |
| G | CIRCLES Phase 3 步驟分數 | Phase 2 提交 | `.circles-step-score-wrap` | renderCirclesStepScore() app.js:4328 |
| H | CIRCLES Phase 4 總報告 | 7 步全完成 | `.circles-report-wrap` | renderCirclesFinalReport() app.js:4637 |
| I | NSM Step 1 選題 | navbar 北極星 | `.nsm-view` | NSM render |
| J | NSM Step 2 表單 | 選題 → 進入 | `.nsm-step2-desktop` | NSM render |
| K | NSM Step 3 Gate | Step 2 提交 | （reuse gate 樣式） | NSM render |
| L | NSM Step 4 報告 | gate 通過 + 評分 | `.nsm-view` 報告區 | NSM render |
| M | History Offcanvas | 漢堡按鈕 | `#offcanvas` + `.offcanvas-list` | renderOffcanvasList() app.js:1172 |
| N | Onboarding modal | 首次訪 | `.onb-overlay` 等 | 動態建構 app.js:2103+ |

### 2.3 全 render 函式（共 ~30 個）
列舉重點：`render` (947) / `renderHome` (4819) / `renderAuth` (5029) / `renderCirclesHomeMobile` (2256) / `renderCirclesHomeDesktop` (2404) / `renderCirclesPhase1` (2989) / `renderCirclesGate` (3651) / `renderCirclesPhase2` (3788) / `renderCirclesStepScore` (4328) / `renderCirclesFinalReport` (4637) / `renderCirclesRadarSvg` (4574) / `renderCirclesTrackingBlock` (4616) / `renderQCardHtml` (1786) / `renderQList` (2541) / `renderQuestionAnalysisBlock` (1757) / `renderPersistentQuestionChip` (1916) / `renderChipCollapsedHtml` (1924) / `renderChipPanelHtml` (1933) / `renderStatsStripHtml` (1987) / `renderOnboardingWelcomeHtml` (2045) / `renderNSM` / `renderNSMRadar` (5564) / `renderNavbar` (1036) / `renderOffcanvasList` (1172) / `renderHistory` (5792) / `renderHistoryList` (5903) / `renderHistoryChart` (5819) / `renderPractice` (5155 — legacy) / `renderReport` (5594 — legacy) / `renderRadar` (5521) / `renderSteps` (5142) / `renderLockedBanner` (135) / `renderStaleBanner` (146) / `renderStaleLockedBar` (102)

### 2.4 Stale / Locked / Gate 三種鎖狀態
1. **Stale mode** — `computeStaleFlag()` 比對 question snapshot 是否與 DB 同步（app.js:93-99）。觸發 `.stale-mode` wrapper / `.stale-banner` / 全表單唯讀。解鎖只能「回首頁」清掉。
2. **Locked step** — 該 step 已評分（`stepScores[stepKey]` 存在）。觸發 `.locked-banner`。Phase 2 chat readonly。無解鎖路徑（需重新 session）。
3. **Phase 1.5 Gate 阻擋** — drill mode 若有 error 不能進 Phase 2；simulation mode 強制可進但保留 status。

### 2.5 表單輸入（rt-field 結構 — CONTRACT-LOCKED 視覺契約）
每個 input block：
```
.rt-field
  ├ .rt-toolbar (desktop)        // bold / bullet / indent / outdent
  ├ .rt-textarea (textarea)       // 主輸入
  └ .rt-toolbar-mobile (sticky)   // mobile focus 時浮現
```
七步欄位數：C1=4 / I=4 / R=4 / C2=4 / L=2-3 solutions × {sol, name} / E=per-solution × 4 fields / S=3 + 4 tracking

S 步特殊：4 個 tracking dimensions（reach / depth / frequency / impact），UI 隨題目類型動態改 label：
- supply-demand → 供給廣度 / 需求深度 / 匹配效率 / 復購留存
- creator/content → 創造廣度 / 成果品質 / 採用廣度 / 商業轉化
- B2B SaaS → 啟用廣度 / 席次深度 / 黏著頻率 / 擴張信號

### 2.6 互動模式
- chip 單選（`.circles-type-tab` design/improve/strategy；`.circles-step-pill` **drill 模式僅 C1/I/R 三選一**；progress bar 7 步顯示僅 simulation 用）
- card hover / active / disabled
- rich-text toolbar：`bold` `bullet` `indent` `outdent`（execCommand）
- 鍵盤：Enter 送出 chat、Esc 關 offcanvas
- 5 random reshuffle：CIRCLES home + NSM Step 1 各自獨立按鈕，重抽 5 題不導航

### 2.7 視覺 / 進度
- `.circles-progress` 7-step dot 進度（active / done）
- Radar SVG：5 軸（practice / NSM）、7 軸（CIRCLES final），viewBox `0 0 240 220`，polygon fill opacity 0.25 + stroke 2px
- Grade letter A/B/C/D（Instrument Serif 例外）

### 2.8 RWD breakpoints
- `< 480px` mobile-360 — 單欄、`.navbar-email` 隱藏
- `481-767px` 寬手機/小平板 — 單欄
- `768-1023px` tablet — 單欄（**禁止 2 col 題目格 grid**）
- `>= 1024px` desktop — `.left-rail` + `.right-rail` 啟動、`.phase1-desktop`、`.circles-chat-desktop` 雙欄
- `>= 1280px` / `>= 1440px` / `>= 1920px` — 容器寬度 step-up（home 最大 1880px / 94vw）
- `@media (hover: hover) and (pointer: fine)` — hover 狀態
- `@media (prefers-reduced-motion: reduce)` — 動畫關閉

### 2.9 Error / Empty / Loading（必出 mockup）
- Offcanvas loading spinner / error retry / empty list
- Chat empty state（"向被訪談者提問吧！"）
- Step score loading
- Form validation error card
- Save indicator：`離線中 · 已存於本機，點擊重試`
- Auth form error
- 載入失敗（API 錯）— 不可顯示誤導 fallback

### 2.10 Navbar（CONTRACT-LOCKED 結構）
```
.navbar
  ├ .navbar-left
  │  ├ btn-hamburger (ph-list)        // 開 offcanvas
  │  ├ .navbar-home-btn                // logo + "PM Drill"
  │  └ .navbar-tabs                    // CIRCLES | 北極星指標
  └ .navbar-actions
     └ guest: 登入鈕 / authed: email + 登出
```
**guest mode 與 loading mode 都必須顯示登入按鈕**（先前 loading mode 漏顯造成 bug）

### 2.11 Offcanvas（History）
```
#offcanvas-overlay (backdrop, 點擊關)
#offcanvas (drawer)
  ├ header: "練習記錄" + 關閉鈕 (ph-x)
  └ #offcanvas-list
     └ .offcanvas-item × N
        ├ row1: badge (badge-circles / badge-nsm) + mode-tag + date
        ├ row2: CIRCLES · 公司 · 產品
        └ trash button (絕對定位、垂直置中：top: 50%; transform: translateY(-50%))
```
- Esc 關 / overlay 點擊關 / focus trap
- 刪除 → DELETE API + 即時從 list 移除 + 失效 `AppState.offcanvasCache`

### 2.12 Design tokens（CSS variables — 全保留 / 重新整理）
**色票：** `--c-primary` `--c-primary-lt` `--c-primary-mid` `--c-nsm` `--c-bg` `--c-bg-alt` `--c-card` `--c-surface` `--c-text` `--c-text-2/3/4` `--c-border` `--c-border-mid` `--c-border-strong` `--c-success/warn/danger` (含 -lt -fg) `--c-error` `--c-warn-bold` `--c-ok-bold` `--c-dim-{reach,depth,frequency,retention}`
**字型：** `--c-font-sans`（system-ui stack）
**Spacing：** `--btn-touch-min: 44px` `--btn-pad-x/y` `--btn-radius` `--btn-font` `--pad-block` `--pad-block-tablet` `--pad-block-desktop` `--r-input` `--r-pill` `--r-card` `--circles-stickybar-pad`

### 2.13 圖示（Phosphor，CDN @phosphor-icons/web@2.1.1）
常用：`ph-circles-three` / `ph-list` / `ph-x` / `ph-list-bullets` / `ph-text-indent` / `ph-text-outdent` / `ph-check` / `ph-lightbulb` / `ph-note-pencil` / `ph-caret-up` / `ph-lock-key` / `ph-warning-octagon` / `ph-houses`

---

## 3. Domain Logic — 不能改的業務規則

### 3.1 CIRCLES 七步完整規格（每步：short / full label / 欄位 / placeholder / icebreaker / conclusion / rubric / 範例）

| 步 | label | 欄位數 | rubric dimensions（evaluator） |
|---|---|---|---|
| C1 | C · 澄清情境 | 4：問題範圍 / 時間範圍 / 業務影響 / 假設確認 | 問題邊界清晰度 / 業務影響連結 / 時間範圍合理性 / 假設排除完整性 |
| I | I · 定義用戶 | 4：目標用戶分群 / 選定焦點對象 / 用戶動機假設(JTBD) / 排除對象 | 分群邏輯 / 焦點選定理由 / JTBD 動機深度 / 排除對象說明 |
| R | R · 發掘需求 | 4：功能性 / 情感性 / 社交性 / 核心痛點 | 功能需求 / 情感+社交需求 / 痛點層次 / 需求優先說明 |
| C2 | C · 優先排序 | 4：取捨標準 / 最優先 / 暫緩 / 排序理由 | 取捨標準顯性化 / 最優先理由 / 暫緩邏輯 / 整體一致性 |
| L | L · 提出方案 | 2-3 solutions × {名稱, 內容}（sol3 optional）| 方案數量與多樣性 / 各方案差異 / 可行性 / 創意+務實平衡 |
| E | E · 評估取捨 | per-solution × 4：優點 / 缺點 / 風險與依賴 / 成功指標 | 優缺點平衡 / 風險識別 / 依賴條件 / 成功指標選擇 |
| S | S · 總結推薦 | 3 主欄位 + 4 tracking dim：推薦方案 / 選擇理由 / 北極星指標 / {reach, depth, frequency, impact} | 推薦清晰度 / 選擇理由 / 指標領先性 / 可操作性 |

完整 placeholder / icebreaker / hint overlay / conclusion example 文案 → app.js:309-624 + prompts/circles-evaluator.js:4-33

### 3.2 評分公式
`totalScore = (sum of 1-5 scores) × 100 / (#dim × 5)` （0-100）

### 3.3 三角色 chat（Phase 2）
System prompt 固定段落（prompts/circles-coach.js:14-66）：
- drill mode：可給具體引導
- simulation mode：只標方向錯誤、不給答案
- 訊息歷史 `.slice(-8)`（最近 8 輪）

### 3.4 NSM workshop
- 四步驟：選題 → 定義+拆解 → Gate → 評分視覺化
- 五評分維度（radar）：alignment / leading / actionability / simplicity / sensitivity
- 四 tracking dimensions（隨題目類型 mapping，見 §2.5）
- Anti-pattern gate 阻擋虛榮指標

### 3.5 Magic numbers（常數鎖死）
| 用途 | 值 |
|---|---|
| Desktop breakpoint | 1024px |
| Phase 1 auto-save debounce | 20000ms |
| NSM breakdown auto-save | 1500ms |
| Resize debounce | 100ms |
| 「剛剛編輯」threshold | 5min |
| History polling | 30000ms |
| Sticky bar 安全區 mobile | 96px |
| Sticky bar 安全區 desktop | 64px |
| Tooltip width | 300px |
| Chat history 上限 | 8 turns |
| Coaching max_tokens | 600 |
| Evaluator max_tokens | 800 |

### 3.6 Stale 偵測
`whitespace-normalized(snapshot.problem_statement) !== whitespace-normalized(current.problem_statement)` → `circlesStale = true`（app.js:93-99）

### 3.7 5 random reshuffle 邏輯
- CIRCLES home + NSM Step 1 各自獨立 5 題清單
- 「隨機盲抽」按鈕：原地重抽，不導航、不切 view、保留滾動位置

### 3.8 文案語言
全 zh-TW，hardcoded（無 i18n 系統）。Onboarding hint overlay 文案在 CIRCLES_STEP_CONFIG 內（app.js:317-323+）

---

## 4. 清理候選 / 已知 dead code（重寫時順手砍）

1. `CIRCLES_STEP_HINTS` — comment 已刪但檢查殘留 ref（app.js ~305）
2. `renderPractice` `renderReport` legacy（app.js:5155, 5594）— 'practice' 'report' view 路由已不導航
3. `circlesCoachOpen` AppState key — 無 toggle 觸發點
4. `activeReportTab` vs `reportTab` 雙變數冗餘（app.js:18, 29）
5. `nsmSubTab` — `'nsm-step2'`/`'nsm-gate'`/`'nsm-step3'` tab 可能未全 render
6. `.h-item { padding: 12px 0 }` — 已知造成 offcanvas flush-left bug，不留
7. SP1 / SP1.5 / SP1.5-bugfix / SP2 累積的 layered CSS overrides — 全 reset
8. `@media (min-width: 720px) and (max-width: 1023px) .circles-q-list { grid 2-col }` — 已 user 確認 tablet 一欄、不留

---

## 5. Mockup 出圖 checklist（frontend-design skill 用）

每張 mockup 必符合：
- [ ] 三裝置並排（mobile 360 / tablet 768 / desktop 1280）
- [ ] 內容三裝置一致（mobile 不縮減 copy / 不藏 feature）
- [ ] `<link rel="stylesheet" href="/path/to/public/style.css">` 跑真產品 CSS
- [ ] 真產品 HTML class names（不自創）
- [ ] 無 emoji，icons 用 `<i class="ph ph-*"></i>`
- [ ] 字型 `system-ui` stack（grade letter 例外 Instrument Serif）
- [ ] 全 zh-TW 文案
- [ ] 1px 對齊精準

**出圖順序（基於 122 項 UI 覆蓋盤點重訂 — 來源 `path-2-ui-coverage-audit.md`）：**

#### 批次 0 — Foundation Design System（21 sections in 1 file）
`00-design-system.html` — 既有 §1-§13（tokens / 字級 / 間距 / 色票 / breakpoint / wrapper / button / form / chip / card / banner / motion / tooltip / modal）**+ 補 §14-§21**：
- §14 範例答案 bullet 縮排 rendering（`.example-list` / `.example-sub` parser）
- §15 Save indicator state matrix（idle / saving / saved / error 4 態）
- §16 Toast / snackbar（info / success / warn / error × 桌面右上 / mobile 底部）
- §17 Overflow / long-content matrix（公司名 truncate / 題目 wrap / 中英混排）
- §18 Char counter / textarea length 反饋
- §19 Phase head / breadcrumb 元件（"Phase 1 · 澄清情境"）
- §20 Mode-tag pill（drill vs simulation 視覺區分）
- §21 Onboarding coachmark / spotlight cutout + 4-direction arrow

#### 批次 A — 不依賴 SP3 backend（11 張畫面 mockup，可與 SP3 backend 並行）
1. CIRCLES Home（含 stats strip / recent rail / search / type tabs / q-card list）
2. Drill Home（左 rail C1/I/R + lock note）
3. Phase 1 表單（qchip + form fields + hint icons + save indicator + sticky bar + char counter）
4. Phase 1.5 Gate（3 狀態：error / warn / ok 卡片）
5. Phase 2 對話（三角色 bubble × streaming / done / error 狀態）
6. NSM Step 1（4 欄分析 context block）
7. NSM Step 2（4-dim form + 動態 label per question type）
8. NSM Step 3 Gate
9. Offcanvas History
10. Onboarding 多步 spotlight
11. Login / Register（auth forms + 錯誤狀態）

#### 批次 B — 必須等 SP3 backend merge（3 張）
12. Phase 3 步驟分數（grade letter + 維度 collapsible + coach demo 三段：context / perField / reasoning）
13. Phase 3 error / loading（4 error code 視覺 + loading checklist 4 步進度）
14. Phase 4 總報告（overview / review tabs + tracking 4 維度 cards + 7-axis radar）

#### 批次 C — 收尾
15. NSM Step 4（4 tabs × 3 viewport = 12 個區塊，含「完成 tab」取代空白頁）
16. Migration flow + Error / Empty / Loading 全集對齊檢查

每張 mockup 要 **user 放行** 才往下做。一旦放行就鎖規格，實作不偏離。

**覆蓋盤點記錄：** `docs/superpowers/specs/path-2-ui-coverage-audit.md`（122 項 / baseline 47%）— 每完成一張 mockup 該文件對應項目標 ✅

---

## 6. 重寫流程 gate

### 6.1 並行階段（user 放行後啟動）
- **背景：** 開 worktree `feat/sp3-backend` → subagent 跑 SP3 plan Task 2-4（evaluator schema + routes timeout）→ jest 全綠 → merge main → 更新本 Master Spec §1.4 + §2.9（移除 §1.4 ⚠ 提示框）
- **前景：** `frontend-design` skill 啟動 → 出圖批次 A 共 11 張 → 每張 user 放行

### 6.2 解鎖階段（SP3 backend 已 merge）
- 出圖批次 B 共 3 張（Phase 3 / Phase 3 error/loading / Phase 4）→ 每張 user 放行
- 出圖批次 C 共 2 張（NSM Step 4 / Error 全集）→ 每張 user 放行

### 6.3 實作階段
- `writing-plans` → bite-sized CSS rewrite + render 結構調整 plan
- `using-git-worktrees` → 開隔離分支
- `subagent-driven-development` → bundle-by-bundle 執行
- 每 bundle 後：webkit + chromium × 8 viewport screenshot + Read PNG 親看
- `verification-before-completion` 自查
- `finishing-a-development-branch` 14-box gate（含 §0.2 iOS checklist 全綠）
- Merge to main

### 6.4 硬性順序鎖定（不准違反）
1. SP3 backend merge **必須早於** 批次 B 任何一張 mockup 開畫
2. 批次 A 的 11 張完全不依賴 SP3，可在 SP3 跑期間並行畫
3. 任何 SP3 bundle 失敗 → 暫停 mockup（避免畫了又改）
4. 批次 B 開畫前必須先驗 §1.4 ⚠ 提示框已移除（代表 schema 已更新）

### 6.5 Bundle 完工強制產出（缺一不過 — 對應 §0.5 Stack）
每 bundle PR 必含 **4 樣產出**，無此檔 = bundle 不過：
1. **jest output** — 全綠 log
2. **Playwright output** — `chromium` + `webkit` × 8 viewport 全綠 log
3. **`tests/visual/diffs/bundle-N-report.md`** — Layer 2 mockup ↔ production pixel diff 結果（每張 < 0.5%）+ Layer 3 invariant 全綠 log
4. **`audit/eyeball-bundle-N.md`** — Layer 6 director eyeball walk：每張 PNG path + Read tool 證據 + ≥ 1 句評論

**CI gate 寫死：**
- 任一 layer 失敗 → PR 不能 merge
- 缺任一產物檔 → PR 不能 merge
- 我不能 bypass、user 不能 bypass、--no-verify 不能 bypass

### 6.6 User 隨時抽問 SOP（紀律外部稽核）
User 保留三個「殺手鐧」問題隨時可打：
1. 「你 Read 過 PNG 沒？貼最後一張的 viewport 名 + 評論」
2. 「給我 5 條 boundingBox invariant 數字（這個 bundle 改動的畫面）」
3. 「mockup ↔ production pixel diff 結果是？引 diff report 路徑」

**任一答不出 = 我跳了步驟 = 該 bundle 重來**
