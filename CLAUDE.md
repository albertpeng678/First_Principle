# PM Drill — 專案狀態看板

> 即時狀態 single source of truth。重大事件即時 Edit。不放歷史（git log 有）。
> **Last updated:** 2026-05-05（**Plan E ✅ READY + 4 post-ship hotfix** — (1) `6708705` mobile home sign-in + drill phase-head；(2) `2607720` offcanvas drafts visibility（lazy-create `POST /draft` + PATCH `/progress` 串接後端）；(3) NSM Step 1 mobile card 當筆 in-place expand drift fix（CSS viewport-conditional：mobile 1-col `order:0` 當筆展開 / tablet+ 2-col `order:999` 推末位避免 grid 破洞，preserve `becce460` desktop fix）— TDD 紅→綠 6 specs × 8 viewport = 48/48 全綠 + superpowers:code-reviewer 結論 ship-ready）
>
> **🔴 接手 Handoff：** `docs/PATH-2-HANDOFF.md` — 下個 session / 帳號接手必先讀

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
| writing-plans → CSS rewrite plan | ✅ 5 plans 寫好（A 完整 / B-E stub）|
| subagent-driven-development → Plan A | ✅ **18 commits / SB1-5 全完成 / 5x 加速版策略** |
| 14-box gate → merge main | 🟡 13/14 ✓（待 user director eyeball walk）|
| Plan D SB1（Offcanvas mockup 09）| ✅ DONE — `7e44422` + fix `1575eaf`（cold-review 3 bug + 4 mockup drift / TDD 紅綠 / jest 157 / PW 40/40）|
| Plan C SB1（NSM Step 1 mockup 06）| ✅ DONE — `9fc366a` jest 157 / PW 12/12 |
| Plan B SB1（CIRCLES Home mockup 01 minimum）| ✅ DONE — merge `aba5dd0` (sonnet implement + opus cold review fix `c1f4c07`) / jest 157 / PW 30/30 |
| Plan B SB2（CIRCLES Home 收尾 — drill-rail + recent-rail + qcard expanded + mode-card body 3-tier + mode-tag short/long + qcard product/難度 viewport-conditional）| ✅ DONE — sonnet 7 commits + opus cold-review fix `83e6667` + 第二輪 drift fix `f517d63`（8 條 viewport-conditional 文案 line-by-line 對照 mockup 01）/ jest 157 / PW 54/54 |
| Plan B SB3（Phase 1 Form 4-field 標準 mockup 03 Section A — C1/I/R/C2 sim+drill 雙變體）| ✅ DONE — sonnet 5 commits + opus cold-review fix `ccd849d`（rt-field toolbar 按鈕數量 viewport+field-idx-conditional / line-by-line vs mockup line 794-1216）/ jest 157 / PW 27/27 |
| Plan B SB4（L 步 solution-multi mockup 03 Section B — sim-only 2-3 sol-cards / sol-add / sol-card__remove / desktop rail）| ✅ DONE — sonnet `b022ae7` + opus cold-review fix `aa0683a`（8 條 sol-card CSS drift 對齊 mockup line 543-607 / hint-row 顯示修正 / `phase-head__title-extra` desktop sim 後綴 / qchip 設計題·難度 desktop suffix）/ jest 157 / PW 99/99 |
| Plan B SB5（S 步 3+4 tracking mockup 03 Section C — 3 main rt-fields + tracking-section + 4 tracking-card 動態 dim labels per product type / CTA「完成 Phase 1」/ desktop suffix「（含 NSM 與 4 追蹤維度）」/ desktop rail 動態 type substitution）| ✅ DONE — sonnet `bdbdf4a` + opus cold-review fix `b81f8a1`（mobile rt-toolbar 改 1 button 對齊 mockup line 1493）/ jest 157 / PW 123/123 |
| Plan B SB6（qchip 題目展開 mockup 03 Section G — `renderQchipExpand(q)` panel: statement on surface + 「深入分析」navy 24px bar + 4 qchip-ana__block (商業背景/用戶輪廓/常見誤區 trap warn 橘/破題切入) + 收合 btn / qchip is-expanded class + caret 反轉 ph-caret-down ↔ ph-caret-up / 4 處 renderer 同步：renderCirclesPhase1 + Lstep + Estep + Sstep）| ✅ DONE — sonnet `51fd4a0` + opus cold-review fix `914ca02`（DRIFT 2: renderCirclesPhase1 desktop sim base C 加 isDesktop 判定，qchip__company 加「· 設計題 · 難度 中」對齊 mockup B/C/G + Lstep line 666 pattern；TDD 紅綠 / jest 157 / PW 392/392 × 8 viewport / pixel-diff 3.47-7.13% / 12 PNG director Read 含 fix 後 diff / eyeball walk doc 含 4 條 drift 誠實列表 + honest dishonesty disclosure）|
| Plan B SB7（E 步 per-sol × 4-field nested mockup 03 line 1466「E 沿用 L 結構」— 2-3 sol-cards / 每張 4 nested rt-field 優點/缺點/風險與依賴/成功指標 / sol-name readonly / 不可改方案數 / desktop rail 「E 步要點」+「為何要評估每個方案」/ AppState.circlesPhase1Evaluate auto-sync）| ✅ DONE — sonnet `f09ec0c`+`2e71083` / opus cold review 4 樣產出齊：jest 157 / PW E-step 64/64 + Phase 1 regression 488/488 / pixel-diff vs L baseline mobile 5.43% tablet 3.67% desktop 2.99%（cross-state 預期，結構 PASS） / 6 PNG director eyeball Read 全 review (mobile-360/tablet-768/desktop-1280 × 2-sol/3-sol) / 5 boundingBox invariants 全對齊 / eyeball walk + pixel-diff 2 docs |
| Plan B SB8（全 7 步 hint modal Tier-1 hardcoded + example expand inline lazy populate — mockup 03 Section D / HINT_OVERLAY_TEXT 27 cells / getFieldExampleKey DB alias / markdownBulletsToHtml / renderHintModal + openHintModal + closeHintModal / renderExampleExpand / 4 關閉路徑 ESC+backdrop+close+了解了 / E/L/S step renderers + binder 全改寫）| ✅ DONE — sonnet `6b595ab` / jest 157 / PW hint-modal 11/11 + example-expand 10/10 + Phase 1 regression 496/496 × 8 viewport / 6 PNG director eyeball Read |
| Plan B SB8 post-ship hardening — user 親要求 5 commits | ✅ DONE：(1) hint Tier-1 hardcoded → AI 串接 `POST /api/circles-public/hint` + 3-state modal + AbortController；(2) toolbar contenteditable 真 WYSIWYG + 統一 2-button HTML；(3) sol-card--l/--e modifier class 隔離 CSS scope；(4) rail 統一「X 步重點」單格（commit `addae74`）；(5) S 步 4 tracking-card per-dim 範例 filter（commit `5de530b`）；(6) L sol-card「核心機制」label drift fix `dd45e6d` — 21 PNG audit vs mockup 03 |
| Plan B SB9a（save-indicator 4 狀態 visual cycle — mockup 03 Section F line 2109-2186 + line 294-306 CSS — `renderSaveIndicator` helper / 9 處 hardcoded → dynamic / `triggerSaveCycle` debounce 800ms→saving→200ms→saved→2000ms→idle / localStorage 草稿 `pmdrill:circles:draft:{qid}` / error retry document delegation / 5 input listeners 串接）| ✅ DONE — TDD red→green / 5 specs Desktop-1280 全綠 / 12 PNG state×viewport audit / `audit/eyeball-plan-b-sb9a.md` |
| Plan B SB9b（locked / stale / save-error 三變體 — mockup 03 Section E line 1953-2106 — banner--locked + banner--stale + banner--save-error + rt-field--locked + submit-bar 變體 / `applyPhase1StateOverlay` post-render transform / 4 phase-1 renderer return 全 wrap）| ✅ DONE — TDD red→green / 10 specs Desktop-1280 全綠 / 9 PNG state×viewport audit / `audit/eyeball-plan-b-sb9b.md` / Phase 1 全 spec 3 vp regression 210/210 |
| Plan E Final Ship Readiness Audit | ✅ READY — E1 chromium 8 viewport（進行中）/ E2 webkit iOS Safari 4 device 48/48 / E4 30 PNG 親 Read 全對齊 mockup 0 drift / iOS 15-item 14/15 PASS + 1 mockup-faithful constraint / 14-box gate 全綠 / `audit/eyeball-plan-e-final-ship.md` |
| Post-ship hotfix（user 親要求 `6708705`）| ✅ DONE — (1) mobile/tablet/desktop home navbar 統一顯示 sign-in icon（user override mockup 01 line 803「mobile guest = nothing」規格，mockup 已同步更新）；(2) drill mode mobile phase-head 右側 meta「drill 模式·此步驟結束即完成」squeeze title 破版修正（加 `phase-head__meta-extra` class + @media max-width:767px 自動隱藏，tablet/desktop 完整顯示）— sonnet 執行 + opus cold review 6 PNG 親 Read：mobile/tablet/desktop × home + drill phase-head 全對齊；jest 157/157 + Playwright Desktop-1280/Mobile-360/iPad 102/102 critical specs 全綠；移除 `signInBtnHomeOnly` + `--auth-only` modifier class（已無人用）|
| Post-ship hotfix（user 親要求 — NSM mobile in-place expand drift fix）| ✅ DONE — user 截圖 IMG_0957/0958：mobile NSM Step 1 點第 1 筆 (Booking.com) → expanded panel 跑到 list 最後一筆位置（Descript 之後），user 沒翻到底看不到，違反 mockup 06 §B mobile frame in-place expand 規格。Root cause：`public/style.css:255` `.nsm-q-card.is-selected { order: 999 }` 把 selected 推 grid 末尾。**綜合考慮 commit `becce460` history**（2026-05-04 user 親要求修 desktop 5 卡 + 1 expanded 變 4 row 破洞）：不能無腦刪 order，改用 viewport-conditional CSS。修復：`@media (min-width: 768px)` 把 `order:999` 限縮 tablet+；mobile（< 768px）為 `order:0` (default) 當筆 in-place expand。TDD 紅→綠：新 spec `tests/visual/nsm-card-inplace-expand.spec.js` 6 specs × 8 viewport = 48/48 全綠（mobile/iPhone-SE in-place 驗 + tablet/desktop order:999 驗 + 5 卡 3-row no-hole invariant）；jest 157/157；9 PNG opus 親 Read（mobile/iPhone-SE/tablet/desktop/2560 × card1/card3/no-sel）；superpowers:code-reviewer 結論 ship-ready（5 條 🟡 建議全採納或註記，0 紅）|
| Post-ship hotfix（user 親要求 — offcanvas drafts visibility）| ✅ DONE — user 截圖 `PM Drill — 第一性原理訓練器 2.png`：mobile guest 在 Phase 1 form 打字後（已暫存 visible）打開 offcanvas → 看到「尚無練習記錄」違反 mockup 09 line 304 規格（「list 必含 4 種 badge：CIRCLES 完成 navy / NSM 完成綠 / drafts 進行中黃 / 一般進行中藍」）。Root cause：SB9a `triggerSaveCycle()` 只寫 localStorage 不呼叫後端 → sessions 表沒 row → list 永遠空。修復（user 親准呼叫既有後端）：(1) 新 `ensureCirclesDraftSession()` async helper：first-input fire `POST /api/(guest-)circles-sessions/draft` body `{question_id, mode, drill_step?}` 後端 idempotent lazy-create；(2) `triggerSaveCycle()` 加 fire-and-forget PATCH `/:id/progress` body `{stepDrafts, frameworkDraft}` 同步 step_drafts shallow merge；(3) localStorage 仍寫作 instant cache + offline fallback；(4) `renderOffcanvasItem()` 加 active 變體：drill「· 草稿」/ sim「· 完整 7 步 · 進行中」/ NSM「· 4 步 · 進行中」+ 相對時間 helper（< 60s 剛剛 / < 60min N 分鐘前 / < 24h N 小時前 / < 7d N 天前 / ≥7d 絕對 M/D），active 不顯示分數；(5) empty copy 改「進行中與已完成的 CIRCLES、NSM 練習都會出現在這裡」對齊 mockup；(6) score badge 加「分」字 drift fix（mockup 09 line 341/348/367「86 分」「92 分」「78 分」— Plan D SB1 carry-forward drift 順手修）。**後端不動鐵則保留**（沒改 routes/* 任一檔，純呼叫既有 endpoint）。TDD 紅→綠 5 specs Desktop-1280 全綠 + 3 PNG opus 親 Read（mobile/tablet/desktop offcanvas list 含 active draft + completed score）|

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
| 16 | ✅ 放行 | `docs/superpowers/specs/mockups/2026-05-02-frontend-rewrite/16-flow-transitions-edge.html` | Flow transitions + edge cases（Bundle 0b 補洞 — **4** sections × 3 viewports = **12** frames）— **§A** Drill「再練一題」跳轉 / **§B** Simulation 7 步間 transition / **§C** Phase 2 SSE 中斷 + **重新發送**（後端無 resume，partial 覆蓋；對齊「後端不動」鐵則）/ **§D** Phase 3 loading 中切到別頁回來。**原 §E Migration 刪除**（production silent fetch 無 UI 可 mockup）|

### Mockup-as-Spec 嚴格規則
- **Implementer：** 開工前必先打開對應 mockup；mockup 是 source of truth；偏離 = bundle 不過
- **Auditor：** PNG pixel-diff（threshold 0.5%）對 mockup baseline 跑；**禁止自然語言判斷**；diff > threshold = BLOCK
- **完整規則：** Master Spec §5.2

---

## Active Branches / Worktrees

| 路徑 | branch | 狀態 |
|---|---|---|
| `/Users/albertpeng/Desktop/claude_project/First_Principle` | main | 主 repo（**Plan A merged 55f7051** / jest 157=133+24skip）|
| `/Users/albertpeng/Desktop/claude_project/first-principle-path2-b-circles` | feat/path-2-circles-core | **Plan B 平行 worktree** — mockups 01/03/04/05/11/12/13 |
| `/Users/albertpeng/Desktop/claude_project/first-principle-path2-c-nsm` | feat/path-2-nsm | **Plan C 平行 worktree** — mockups 06/07/08/14 |
| `/Users/albertpeng/Desktop/claude_project/first-principle-path2-d-cross` | feat/path-2-cross-cutting | **Plan D 平行 worktree** — mockups 09/10/15 |
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
