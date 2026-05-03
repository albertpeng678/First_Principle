# PM Drill — 專案狀態看板

> 即時狀態 single source of truth。重大事件即時 Edit。不放歷史（git log 有）。
> **Last updated:** 2026-05-03（**Bundle 0 補洞完成** — 16 mockup 全收尾 + readiness review 27 punch / spec §1.5.1 §2.14 §0.5 Layer 1.1 §4 補丁 / mockup 15 §A4-6 字典擴張 / 新增 16 flow-transitions-edge / 下一步：writing-plans）

---

## 當前主路線：Path 2 — Frontend Rewrite

**範圍：** 後端 / API / DB / OpenAI prompts / 商業邏輯 / jest 100% 不動。前端 CSS + render 結構從 0 重寫。
**標竿：** iOS Safari 滑順度 ≥ aistockmap.com（手機 web）
**Master Spec：** `docs/superpowers/specs/2026-05-02-frontend-rewrite-master-spec.md`

### 進度狀態

| 階段 | 狀態 |
|---|---|
| 全盤掃描（122 項 UI / 47% baseline）| ✅ 完成 — `path-2-ui-coverage-audit.md` |
| Master Spec 凍結 | ✅ 完成 |
| SP3 backend 並行 | ✅ Merged 到 main（13 commits / jest 142 綠 / 兩階段 review × 2 round 全綠）|
| SP4 backend 並行 | ✅ Merged 到 main（jest 142 → 157 / 103 題 NSM context 預生成 idempotent 雙跑驗證）|
| Mockup（共 17 張）| ✅ **17/17 全放行**（00-15 + 16 flow-transitions / cross-audit 22 + readiness 27 條收尾） |
| Bundle 0 spec patches | ✅ §1.5.1 multi-tab+401 / §2.14 state↔class map / §0.5 Layer 1.1 baseline 規範 / §4 renderHistory legacy |
| writing-plans → CSS rewrite plan | ⏳ 解鎖待啟動 |
| subagent-driven-development | ⏳ 待 plan |
| 14-box gate → merge main | ⏳ 待全綠 |

---

## Mockup Index（視覺契約 — CONTRACT-LOCKED 完整路徑）

| # | 狀態 | 完整路徑 | 內容 |
|---|---|---|---|
| 00 | ✅ 放行 | `docs/superpowers/specs/mockups/2026-05-02-frontend-rewrite/00-design-system.html` | Design system 21 sections |
| 01 | ✅ 放行 v5 | `docs/superpowers/specs/mockups/2026-05-02-frontend-rewrite/01-circles-home.html` | CIRCLES Home A-G 7 sections + **v5 對齊缺口補**：NSM cross-promo card 底部（mobile 直式 / tablet+desktop 橫式）+ 「什麼是 CIRCLES 實戰訓練？」accordion（精簡 prose 2-line 不用 card-block）+ wording 對齊 production（個別步驟 → 步驟加練 / 設計題 → 產品設計 ×40 / 改善題 → 產品改進 ×35 / 策略題 → 產品策略 ×25）+ q-card title 全改公司·產品/feature 格式（Spotify · Spotify Podcast / Notion · 工作協作 / Airbnb · Marketplace 擴展，drill 保留「— 練 C 步驟」suffix）+ mode-tag 統一 navy（去除 success 綠）|
| 02 | ✅ 放行 | `docs/superpowers/specs/mockups/2026-05-02-frontend-rewrite/02-auth-flow.html` | 登入登出 A-E 5 sections |
| 03 | ✅ 放行 | `docs/superpowers/specs/mockups/2026-05-02-frontend-rewrite/03-phase-1-form.html` | Phase 1 表單 A-G 7 sections |
| 04 | ✅ 放行 | `docs/superpowers/specs/mockups/2026-05-02-frontend-rewrite/04-phase-1-5-gate.html` | Phase 1.5 Gate 三態 ok/warn/error（紅 = 必擋，drill+sim 一致）+ loading |
| 05 | ✅ 放行 | `docs/superpowers/specs/mockups/2026-05-02-frontend-rewrite/05-phase-2-chat.html` | Phase 2 對話三角色 bubble + 4 種底部狀態（input / submit-row / streaming / conclusion / locked）|
| 06 | ✅ 放行 | `docs/superpowers/specs/mockups/2026-05-02-frontend-rewrite/06-nsm-step-1.html` | NSM Step 1 — 5 卡 + 4-欄 context + 桌面 3-col rail（200px filter / 1fr cards / 220px 近期練習）；4-step nsm-progress（情境/指標/拆解/總結）；4 type pills 全 navy/success/warn/primary（**全棧無紫色**）|
| 07 | ✅ 放行 | `docs/superpowers/specs/mockups/2026-05-02-frontend-rewrite/07-nsm-step-2.html` | NSM 步驟 2/3 — Screen 8 內容 sub-tabs：步驟 2 定義 NSM（context-card + 3 步定義法 guide + 3 fields 北極星指標 / 定義說明 / 業務連結 + 查看範例 toggle）+ 步驟 3 拆解 4-dim card（label / desc / coachQ / 教練提示 + rt-toolbar textarea）；**4-dim 動態 label 隨 product type 切換** — attention（觸及廣度 / 互動深度 / 習慣頻率 / 留存驅力）vs saas（啟用廣度 / 席次深度 / 黏著頻率 / 擴張信號）；submit「上一步」統一語彙；component CSS 整段 LOCKED copy 自 06 |
| 08 | ✅ 放行 | `docs/superpowers/specs/mockups/2026-05-02-frontend-rewrite/08-nsm-step-3-gate.html` | NSM 審核 Gate — 5 維度檢核（價值關聯 / 領先指標 / 操作性 / 可理解 / 週期敏感）三態 + Loading；A 通過 5 綠 / B 通過附提醒 4 綠+1 黃 / C 需修正方向含紅（**唯一動作「上一步修改」**，無「帶風險繼續」、無 simulation override）/ D Loading spinner + 4-step checklist；component CSS LOCKED copy 04（gate-transition / gate-item / gate-loading）+ 07（sub-tabs）+ 03（navbar / phase-head / submit-bar / btn）|
| 09 | ✅ 放行 | `docs/superpowers/specs/mockups/2026-05-02-frontend-rewrite/09-offcanvas-history.html` | Offcanvas 練習記錄 — drawer 280px from left + backdrop dim · 4 狀態（list / empty / loading / error）× 3 viewport · **單一 navy score badge 配色**（完成才有，其他 greyscale）· 每筆 3 行（title 允許 line-clamp-2 不截斷 + meta + date）· **區分 drill 單步「C 澄清 / L 方案 / I 用戶 ...」vs simulation「完整 7 步」vs「NSM · 4 步」** · hover 顯示 trash icon · component CSS 整段 LOCKED copy 自 03 / 04 / 06 / 07 / 08 |
| 10 | ✅ 放行 | `docs/superpowers/specs/mockups/2026-05-02-frontend-rewrite/10-onboarding.html` | Onboarding — Welcome card（hand-waving + 開始引導 / 直接自己選題）+ **4-step coachmark tour**（練習模式 / 選擇題型 / 挑一道題目 / 開始練習）· 5 sections × 3 viewports = 15 frames · spotlight = `.onb-targeted` 直接掛在目標元素（auto-sized 永遠對齊，無雙重 dim）· dual ring（2px 白 inner halo + 6px navy outer + 9999px 全頁 dim outer）對任何 target 顏色都對比清楚 · **mobile 採 desktop 同 pattern**（全頁 dim + 浮動 tooltip near target，非 sticky-bottom）· Step 4 spotlight 圍**整張 expanded q-card**（含描述+button），讓 user 讀完題目說明再決定 |
| 11 | ✅ 放行 | `docs/superpowers/specs/mockups/2026-05-02-frontend-rewrite/11-phase-3-score.html` | Phase 3 步驟分數 — 4 sections × 3 viewports = 12 frames：A 預設 78 分（mobile/tablet 4 dim 折疊 / desktop 2-col 全展開）/ B 低分 52 + 邏輯性 1/5 warn 自動展開 + 教練示範 3 sections 全展開（情境前置 / 逐欄位示範 4 fields / reasoning）/ C Loading 56px navy spinner + 4-step checklist / D Error 紅圓 cloud-warning + EVAL_TIMEOUT + 重新評分/返回修改。Desktop 用 flex + display:contents + order 規則：左欄（380px）score+highlights+coach 自然 stack、右欄 dim-list — 避免 grid-row span 撐高 col-1 issue。**移除 circles-nav 重複的灰色 home button**（navbar 右上 home 唯一） |
| 12 | ✅ 放行 | `docs/superpowers/specs/mockups/2026-05-02-frontend-rewrite/12-phase-3-error-loading.html` | Phase 3 Error 變體 + Loading 慢回應 — 補 11 未涵蓋的：A Loading 慢回應（60s+ inline warn 文字「比預期慢一些…AI 深度分析中，偶而會需要比較久時間，請再等等。」內部 timeout 300s 不告知 user）/ B Error EVAL_API_ERROR 評分服務暫時不可用 / C Error EVAL_PARSE_ERROR 教練回應格式異常。3 sections × 3 viewports = 9 frames。component CSS LOCKED copy 自 11；新增 loading-sub--slow 變體 inline 文字（不用 toast 框）|
| 13 | ✅ 放行 | `docs/superpowers/specs/mockups/2026-05-02-frontend-rewrite/13-phase-4-final.html` | Phase 4 模擬面試總結報告 — 3 sections × 3 viewports = 9 frames：A 預設 77 分（**無 grade letter A/B/C/D**，分數已足夠）+ 7-axis radar navy polygon（去紫）+ step-rows 7 行**每步補一行 commentary**（C 78 時間框架 / I 82 最強亮點 / R 75 補競品對比 / C2 70 缺 RICE/ICE / L 85 紮實 / E 68 本次最弱量化不足 / S 80 tracking 完整）+ **S 總結 row 內嵌 NSM 4 dim mini cards**（dashed border 視覺從屬，明確表達 4 dim 是 S 步驟拆解內容、非獨立 top-level；4 dim 全部統一中性樣式 + Italic 1/2/3/4 編號區分，**不用顏色**避免雜亂；mobile/tablet/desktop 一律 1-col 直式）+ strengths（success 綠）+ improvements（warn 橘）+ verdict（navy）+ nextsteps + submit-bar sticky（**再練一題**換題、不重做同題；匯出 PNG / home icon）/ B Loading spinner + 4-step checklist（彙整七步 → 計算總分 → 生成雷達 → 整理建議）/ C Error REPORT_API_ERROR + 重試 / 回首頁。Desktop top-grid 2-col（左 radar 右 step-rows，S 總結 nested 4 dim 也 narrow column 直式）|
| 14 | ✅ 放行 | `docs/superpowers/specs/mockups/2026-05-02-frontend-rewrite/14-nsm-step-4.html` | NSM Step 4 報告 — 4 tabs（總覽 / 對比 / 亮點 / 完成）+ 教練思路展開 = **5 sections × 3 viewports = 15 frames**：A 總覽（5-axis pentagon radar navy + 5 score rows 含 comment / desktop 2-col 380px radar + 1fr score-rows）/ B 對比預設（mobile 5 dim block 直堆「你的+教練」/ tablet+desktop 2-col grid「你的拆解·教練版本」+ 5 列 NSM+4 dim）/ **B' 點擊教練思路展開**（**navy 中性配色，無黃色** — mobile bottom-sheet drawer with handle / tablet+desktop inline panel below row；教練思路 + 為什麼這樣拆解 兩段）/ C 亮點（mobile 1-col 4 cards / tablet 2-col 前 2 並排 + 下一步建議+總評跨 2 / desktop 3-col + 總評跨 3；新增「下一步建議」card border-left success）/ D 完成（done-panel 取代 production 空白頁：ph-check-circle 64×64 success 圓 + 標題 + 鼓勵文 + 主按鈕「再練一題」+ desktop ghost「回首頁」+ 下方 done-secondary tip card）。**Path 2 配色**：radar navy（去原 5 色）/ score bar 全 navy uniform / score 字色 grade-based。**用顯式 modifier class 控制 layout**（不用 @media，因 mockup viewport frame 並排於 1920px viewport，@media 所有 frame 都觸發 desktop 規則導致 bug）|
| 15 | ✅ 放行 | `docs/superpowers/specs/mockups/2026-05-02-frontend-rewrite/15-error-empty-collation.html` | Error / Empty / Loading 全集對齊 + cross-mockup audit 22 條 drift 收尾 — **§A 規約字典 6 表**（A1 Copy / A2 Timeout / A3 Iconography / **A4 Class Naming 規約** / **A5 Button → AppState 跳轉** / **A6 Copy 常數規則**）+ **§B Loading 全集** + **§C Error & Banner 全集** + **§D Empty / Toast / Modal**。Bundle 0c 擴張 A4-6 — implementer 開工必查 |
| 16 | ✅ 放行 | `docs/superpowers/specs/mockups/2026-05-02-frontend-rewrite/16-flow-transitions-edge.html` | Flow transitions + edge cases（Bundle 0b 補洞 — 5 sections × 3 viewports = 15 frames）— **§A** Drill「再練一題」跳轉（Phase 3 score → home with new question auto-selected）/ **§B** Simulation 7 步間 transition（progress bar 推進、qchip 持續、done step 可回看）/ **§C** Phase 2 SSE 中斷 + reconnect（warn-lt bubble + 「繼續」ghost 重發 → resume from last delta，3 次失敗進 EVAL_API_ERROR）/ **§D** Phase 3 loading 中切到別頁回來（in-flight 不 abort，circlesEvaluating 持續，A 還沒回 / B 已完成 / C 失敗 三種 render）/ **§E** Migration flow（guest 註冊後 POST /api/migrate-guest 搬 X 筆，A 確認 / B 進度 bar / C 失敗 retry）|

### Mockup-as-Spec 嚴格規則
- **Implementer：** 開工前必先打開對應 mockup；mockup 是 source of truth；偏離 = bundle 不過
- **Auditor：** PNG pixel-diff（threshold 0.5%）對 mockup baseline 跑；**禁止自然語言判斷**；diff > threshold = BLOCK
- **完整規則：** Master Spec §5.2

---

## Active Branches / Worktrees

| 路徑 | branch | 狀態 |
|---|---|---|
| `/Users/albertpeng/Desktop/claude_project/First_Principle` | main | 主 repo（SP3 + SP4 backend 已 merge / jest 157）|
| `/Users/albertpeng/Desktop/claude_project/first-principle-sp2` | feat/sp2-drill | 暫不 merge — JS 改動可 cherry-pick，CSS 廢棄 |
| `/Users/albertpeng/Desktop/claude_project/first-principle-sp3-backend` | feat/sp3-backend | 已 merge 進 main，可 cleanup |
| 主 repo | revise/sp3-alignment | 4 commits — Path 2 結束再評估 |

---

## Pending Workstreams（Path 2 之後）

### SP3 frontend tasks（Path 2 期間 mockup 11/12 處理）
- Phase 3 三狀態 renderer / collapsible / coach demo / loading checklist
- Spec：`docs/superpowers/specs/2026-05-02-sp3-score-coach-end-design.md`

### SP4 frontend tasks（Path 2 期間 mockup 06-08, 14 處理）
- Step 1 卡片 UI parity / Step 4 全 4 tab 重設計 / 統一 padding
- Spec：`docs/superpowers/specs/2026-05-02-sp4-nsm-upgrade-design.md`（Task A backend 已 merge）

---

## 視覺對齊測試 Stack（防 SP2 5 輪重做）

8 層防禦（完整 Master Spec §0.5）：
1. Mockup-as-Spec baseline 凍結 → 2. Pixel diff 0.5% → 3. boundingBox invariant → 4. WebKit+Chromium → 5. State matrix audit → 6. Director eyeball walk → 7. User 真機抽驗 → 8. Pre-commit+CI gate

**Bundle PR 必出 4 樣產出（缺一不過）：** jest log / Playwright log / `tests/visual/diffs/bundle-N-report.md` / `audit/eyeball-bundle-N.md`

**User 殺手鐧 3 問（隨時可打）：**
1. 「你 Read 過 PNG 沒？貼 viewport + 評論」
2. 「5 條 boundingBox invariant 數字」
3. 「mockup ↔ production diff 結果？引 report 路徑」

任一答不出 = 該 bundle 重來。

---

## Standing Rules（核心 7 條 — 完整版見 memory）

1. CLAUDE.md 即時更新（本檔）
2. Mockup 三裝置並排（mobile 360 / tablet 768 / desktop 1280）+ user 放行才實作
3. 全 zh-TW / 無 emoji / 字型 system-ui（grade letter A/B/C/D 例外 Instrument Serif）/ icons Phosphor ph-*
4. UI/UX 稽核必須親看 PNG（Playwright 截圖 + Read tool）
5. iOS Safari 15-item checklist（Master Spec §0.2）每次 ship 前必走
6. Pitch-ready standard：1px 對齊嚴格 / 4-grid 間距 / 無 magic 數值
7. Path 2 期間不動 backend / API / prompts / DB / jest

---

## Tests / Quality Gates

- jest 基線：157/157（main 含 SP3 + SP4 backend merge）
- Playwright：91/91 × 8 viewport（iPhone-SE / iPhone-14 / iPhone-15-Pro / iPad / Mobile-360 / Desktop-1280 / Desktop-1440 / Desktop-2560）

---

## 文件索引

- **Master Spec：** `docs/superpowers/specs/2026-05-02-frontend-rewrite-master-spec.md`
- **UI 覆蓋盤點：** `docs/superpowers/specs/path-2-ui-coverage-audit.md`
- **SP3 / SP4 specs：** `docs/superpowers/specs/2026-05-02-sp3-*.md` / `2026-05-02-sp4-*.md`
- **CIRCLES DB：** `circles_plan/circles_database.json`（103 題）
- **NSM 規格：** `nsm_plan/nsm_trainer_full_spec.md`
- **Plugins：** superpowers v5.0.7 / frontend-design / code-review / playwright / context7
