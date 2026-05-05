# Path 2 — Frontend Rewrite · 接手 Handoff

> 下個 session / 帳號接手用。**先讀本檔再讀 CLAUDE.md**。
> **Last updated:** 2026-05-05（**Plan E ✅ READY + 4 post-ship hotfix（A/B/C 已 merge / D 進行中等 user 決策）**）
>
> 🔴 **接手第一件事：下面「Hotfix D 進行中」是當前最重要的事，必讀。**
>
> ---
>
> **🚨 Hotfix D — offcanvas item click + Phase 1 草稿 restore（2026-05-05，working tree 未 commit，待 user 決策）:**
>
> **User 親報 bug**（2026-05-05 對話 + screenshot IMG #1 — Spotify · Spotify Podcast / 個別 C1 / Phase 1 · 進行中 / 4/25 那張）:
> 1. 「目前練習紀錄雖會顯示（offcanvas），但無法點擊跳轉至測驗頁（三種裝置皆是如此）」
> 2. 「目前點擊已儲存的問答紀錄，無法回覆到此前進行的進度（會被清空），導致儘管進入測驗，仍無以填寫的內容需從0開始」
>
> **設計契約（mockup 09 line 296）**:
> > 「Item click：CIRCLES → 載入 session、NSM → 跳 step 4 報告」
>
> **Root cause（opus 已 trace 完）:**
> - **Bug 1**: `public/app.js:3005` `bindOffcanvas()` 的 `[data-offcanvas]` click handler 只有 `close / retry / delete` 三分支，**完全缺 `action === 'item'` 分支**。`renderOffcanvasItem` (line 2966) 設了 `data-offcanvas="item"` 但無人接 → click 完全 no-op。
> - **Bug 2**: 缺 reverse transform。`triggerSaveCycle` (line 737-770) 寫後端 PATCH `/progress` body `{stepDrafts: {P1, P1S, P1L, P1E, framework, ts}, frameworkDraft}` 後端 shallow merge 進 `step_drafts` JSONB column。GET endpoint 雖回 row，**前端缺把 `session.step_drafts.P1` → `circlesPhase1`、`P1S` → `circlesPhase1S`、`P1L` → `circlesPhase1Solutions`、`P1E` → `circlesPhase1Evaluate`、`framework_draft` → `circlesFrameworkDraft` 的反向 mapping**。
>
> **Round 1 + Round 2 已修（working tree 內，未 commit）:**
>
> 1. 新 helper `restoreCirclesPhase1FromSession(item)` (`public/app.js:3082-3131`)
>    - mapping: `item.question_json/currentQuestion → circlesSelectedQuestion`
>    - `item.mode === 'simulation' ? 'sim' : 'drill' → circlesMode`
>    - `item.drill_step || 'C1' → circlesDrillStep`
>    - `item.current_phase || 1 → circlesPhase`（**警告：見下面「剩餘 Critical-1」**）
>    - `item.sim_step_index || 0 → circlesSimStep`
>    - `item.step_drafts.P1/P1S/P1L/P1E → circlesPhase1/circlesPhase1S/circlesPhase1Solutions/circlesPhase1Evaluate`
>    - `item.framework_draft → circlesFrameworkDraft`
>    - localStorage `pmdrill:circles:draft:{qid}` ts > server ts → 用 local 蓋過（merge 邏輯）
>    - **Round 2 加**: `circlesConversation = item.conversation || [] + circlesStepScores = item.step_scores || {} + phase>1 但 conversation=[] → 退回 phase 1`（safety fallback + console.log trace）
>
> 2. 新 helper `loadCirclesSessionFromHistory(item)` (`public/app.js:3134-3147`)
>    - NSM (`!mode && !drill_step`) → `nsmStep=4 + nsmSession=item + view='nsm'` + close offcanvas + render
>    - CIRCLES → call `restoreCirclesPhase1FromSession(item) + render()`
>
> 3. `bindOffcanvas` 加 `action === 'item'` 分支 (`public/app.js:3092` 附近)
>    - `e.target.closest('[data-offcanvas="delete"]')` early-return 防 trash 冒泡
>    - 從 `el.dataset.id` 找 `historyList` 對應 item
>    - 呼叫 `loadCirclesSessionFromHistory(item)`
>
> 4. `bindCirclesPhase1` 內加 `populateTextareasFromDraft` IIFE (`public/app.js:2528-2611`) — render 後把 contenteditable innerHTML 寫回 DOM:
>    - C/I/R/C2: `[data-phase1="textarea"]` ← `circlesFrameworkDraft[stepKey][fieldKey]`
>    - L step textarea: `.rt-textarea[data-sol-idx]` ← `circlesPhase1Solutions[idx].mechanism`
>    - L sol-card name: `input.sol-card__name-input[data-sol-idx]` ← `circlesPhase1Solutions[idx].name`（用 `.value =` 不 `.innerHTML`）
>    - E nested: `.rt-textarea[data-circles-e-sol-idx][data-circles-e-field-key]` ← `circlesPhase1Evaluate[solIdx][fieldKey]`（4 keys: advantages/disadvantages/risks/metrics）
>    - S textarea: `.rt-textarea[data-s-textarea]` ← `circlesPhase1S[key]`（key map: 推薦方案→recommendation / 選擇理由→reasoning / 北極星指標→nsm）
>    - **Round 2 加 `syncCharCounter(ta)`**: 寫完 innerHTML 後就地計算 `textContent.length`，找 `.field` parent 內 `.char-counter`，從 `dataset.max`（fallback 200）寫 `counter.textContent = N + ' / ' + max`。**不 dispatch input event**（避免觸發 saveCycle 連環 PATCH）。
>
> 5. `bindCirclesHome` recent-rail item click handler 重構為 reuse `loadCirclesSessionFromHistory(item)`（B5 — home rail 同樣 bug 同樣修）
>
> 6. `window.AppState` 已在 `app.js:92` expose（spec 用 evaluate 讀）
>
> 7. 新 spec `tests/visual/offcanvas-item-click-restore.spec.js`（10 specs / 218 行）— TDD 紅→綠完整 cycle:
>    - Desktop/Mobile click → phase-head visible（cover Bug 1）
>    - 4 textarea 從 framework_draft.C1 restore（cover Bug 2）
>    - AppState.circlesSession.id / circlesFrameworkDraft / drillStep + mode 還原
>    - char-counter 顯示真實長度而非「0」
>    - NSM session click → nsmStep=4 + view=nsm
>    - step_drafts null/{} 不 throw
>    - L step P1L solutions restore (mechanism + name)
>
> **驗證已過**:
> - jest 157/157
> - Playwright 全 8 viewport × 10 specs = **80/80 全綠**
> - 3 PNG opus 親 Read（mobile-360 / tablet-768 / desktop-1280）：char-counter「18 / 120」+ 4 textarea 全 restore（針對 Spotify Podcast / 6 個月 / NSM 收聽時長 / 通勤族日常）+ phase-head + drill 模式 meta 完整
> - superpowers:code-reviewer **2 輪 cold review**（spec compliance 角度檢查）
>
> **🔴 superpowers:code-reviewer Round 2 仍找到 2 條剩餘問題（user 決策後派 sonnet round 3 收尾）:**
>
> ### Critical-1 (R3 治標不治本) — 需 user 決策走後端 or 前端 path
> `restoreCirclesPhase1FromSession` 加了 `circlesConversation = item.conversation || []` 但 **`routes/circles-sessions.js:104` + `routes/guest-circles-sessions.js:24` list endpoint `select(...)` 沒包含 `conversation` 欄位**。`loadHistory` 拉到的 list item 永遠 `conversation === undefined`。offcanvas item click 直接用 list 拿到的 `item` 做 restore，**不會 refetch GET /:id**（GET /:id 用 `select('*')` 才會回 conversation）。
>
> 結果：**任何 phase>1 session（Phase 2 對話中 / Phase 3 評分後 / Phase 4 報告後）restore 一定觸發 silent fallback，使用者看不到對話歷史與分數**。當前 spec 不會 catch 因為 stub 都是 `current_phase: 1`。
>
> 兩條修法擇一（user 必決策）:
> - **Option A（後端動）**: `routes/circles-sessions.js:104` + `routes/guest-circles-sessions.js:24` `select(...)` 加 `conversation, scores_json, conclusion, gate_result` 欄位（payload 變大）。**違反 Path 2「後端不動」鐵則需 user 親准**。
> - **Option B（前端動，符合鐵則）**: `loadCirclesSessionFromHistory` 改 `await fetch /api/(guest-)circles-sessions/:id` 拿全資料再 restore（多一次 round-trip，但 GET /:id 既有 endpoint）。
>
> **opus 推薦 Option B**（保留鐵則）。
>
> ### Important-2 (R1 漏網) — S 步 tracking 4 個 input 漏 restore
> `populateTextareasFromDraft` 補了 L textarea / L name / E nested / S 3-textarea 共 4 個 forEach，**但漏了 S 步 4 個 tracking inputs**（render line 1538、binder line 2851，state path `AppState.circlesPhase1S.tracking[dimKey]`，DOM `[data-s-tracking]`）。S 步進到 tracking section 填 4 維度後 close session、再 restore，4 input 會空白。
>
> **修法**: `populateTextareasFromDraft` 補第 5 個 forEach 對 `[data-s-tracking]` input 用 `.value =` 從 `AppState.circlesPhase1S.tracking[dimKey]` 讀。純前端，無需 user 親准。
>
> ### Suggestion-3（nice-to-have）— 補 localStorage prefer spec
> Round 2 報告聲稱補了 localStorage prefer spec 但 file 找不到 — 補一條：先 `page.evaluate(() => localStorage.setItem(...))` 寫個 newer ts，再 click item，assert AppState 是 local 版本。
>
> **接手 SOP（下個 agent 看這段）:**
> 1. `cd /Users/albertpeng/Desktop/claude_project/First_Principle && git status` — 確認 working tree 仍是 hotfix D round 2（5 files changed: public/app.js, tests/visual/offcanvas-item-click-restore.spec.js, + 3 baseline PNG 既有 modified）
> 2. `git log --oneline -5` — 確認最後 commit 是 `a9b1447 fix(nsm): mobile card 當筆 in-place expand drift fix`（hotfix C 已 push）
> 3. **問 user**：「Critical-1 走 Option A（後端 select 加欄位）還是 Option B（前端 await GET /:id）？」— 不要擅自走 A
> 4. user 答後 → 派 sonnet round 3:
>    - 修 Critical-1（按 user 選擇）
>    - 修 Important-2（S 步 tracking）
>    - 補 localStorage prefer spec
>    - TDD 紅 → 綠（紅燈先驗 phase=2 + conversation=[1 turn] 的 stub click 後 `circlesPhase===2 && circlesConversation.length===1`）
>    - 全 8 viewport regression（offcanvas-item-click-restore + offcanvas-draft + offcanvas + nsm-card-inplace-expand 全跑）
> 5. 派 superpowers:code-reviewer round 3 final cold review
> 6. opus 親 Read 9 PNG（mobile/tablet/desktop × Phase 1 form / S 步 tracking 含內容 / Phase 2 對話 restore）
> 7. **3 docs sync** 後再 commit / push:
>    - `CLAUDE.md` last-updated + 進度狀態列加「Hotfix D — offcanvas item click + draft restore」
>    - 本檔 — 把這整段「Hotfix D 進行中」改成「Hotfix D ✅ DONE」並列 commit hash + 實際採用的 option
>    - `master-spec § 2.11` — 加「Item click 行為 + draft restore 規約」
>
> **驗收 SOP（user 親跑前必確認）:**
> 1. 開 `npm start`（dev server port 4000）
> 2. mobile-360 開瀏覽器
> 3. 任意題目進 Phase 1 → 4 textarea 各打不同字 → 等「已暫存」出現
> 4. 點 navbar hamburger 開 offcanvas → 確認 list 出現該 session（含「· 草稿」suffix + 相對時間）
> 5. **點該 item** → 應自動 close offcanvas + 跳進 Phase 1 form
> 6. 確認 4 textarea 內容仍在（不該空白）
> 7. 確認 char-counter 顯示真實字數（不該 0/120）
> 8. 換 tablet-768 / desktop-1280 重複 step 1-7
> 9. 換 simulation mode（完整 7 步）測 phase 2 進對話幾輪後 close → offcanvas 再點 → 應 restore 對話 list（**這條依賴 Critical-1 修好**）
> 10. NSM session 點 item → 跳 step 4 報告（先確認 mockup 14 NSM step 4 是否 ship）
>
> ---
>
> **Post-ship hotfix C — NSM mobile in-place expand drift fix (2026-05-05 — user 親要求):**
> - Bug: mobile NSM Step 1 點第 1 筆(IMG_0957) → expanded panel 跑到 list 末尾(IMG_0958)，違反 mockup 06 §B in-place 規格
> - Root cause: `public/style.css:255` `.nsm-q-card.is-selected { order: 999 }` 把 selected 推 grid 末尾。`order:999` 是 commit `becce460`(2026-05-04 user 親要求)修 desktop 2-col 5 卡 + 1 expanded 變 4 row 破洞的 fix，不能無腦刪
> - 修復: viewport-conditional CSS — `@media (min-width: 768px) { .nsm-q-card.is-selected { order: 999 } }` 把推末位限縮 tablet+；mobile(< 768px)為 default order:0 當筆 in-place expand
> - 驗證: TDD 紅→綠 / 新 spec 6 × 8 viewport = 48/48 全綠 + jest 157/157 + 9 PNG opus 親 Read + superpowers:code-reviewer ship-ready
>
> **Post-ship hotfix B — offcanvas drafts visibility (2026-05-04 — user 親要求 + user 親准呼叫既有後端):**
> - Bug: mobile guest 打字後 offcanvas 看到「尚無練習記錄」(`PM Drill — 第一性原理訓練器 2.png`) — 違反 mockup 09 line 304 規格 (drafts/進行中也要顯示)
> - Root cause: SB9a `triggerSaveCycle` 只寫 localStorage 沒呼叫後端 → sessions 表沒 row → list 空
> - 修復(後端 routes/* 零動，純前端呼叫既有 endpoint):
>   - 新 `ensureCirclesDraftSession()` async helper: `POST /api/(guest-)circles-sessions/draft` body `{question_id, mode, drill_step?}`(後端 idempotent lazy-create)
>   - `triggerSaveCycle` 加 fire-and-forget `PATCH /:id/progress` body `{stepDrafts, frameworkDraft}`(後端 shallow merge step_drafts)
>   - localStorage 仍寫作 instant cache + offline fallback
>   - `renderOffcanvasItem` 加 active 變體: drill 後綴「· 草稿」/ sim「· 完整 7 步 · 進行中」/ NSM「· 4 步 · 進行中」+ 相對時間 helper (< 60min N 分鐘前 / < 24h N 小時前 / < 7d N 天前 / ≥7d 絕對 M/D); active 不顯示分數
>   - empty copy「進行中與已完成的 CIRCLES、NSM 練習都會出現在這裡」對齊 mockup
>   - score badge「N 分」drift fix(mockup 09 line 341 — Plan D SB1 carry-forward 順手修)
> - 驗證: TDD 紅→綠 5 specs / Desktop+Mobile+iPad regression / 3 PNG opus 親 Read 對齊 mockup 09
>
> **Post-ship hotfix A（2026-05-04 commit `6708705`）— user 親要求 2 bug:**
> - **Bug 1 — mobile home sign-in icon visible（all viewports）**：user override mockup 01 line 803「mobile guest = nothing」規格 → mobile/tablet/desktop home 統一顯示 sign-in icon。改動：
>   - `public/app.js`：`isCirclesHome` 路徑改用 `signInBtn`(無 `--auth-only` class)；移除 `signInBtnHomeOnly` 常數
>   - `public/style.css` line 471-477：移除 `@media max-width:480px { .navbar__icon-btn--auth-only { display:none } }` rule
>   - `mockup 01 line 803-806`：mobile frame 加 `navbar__actions` + sign-in `<button>`（mockup 已同步契約更新）
> - **Bug 2 — drill mobile phase-head 破版**（IMG_0953 user 截圖）：右側 meta「drill 模式·此步驟結束即完成」squeeze title 換行破版 → `app.js` line 1604-1607 drill metaHtml sep + text spans 加 `phase-head__meta-extra` class（@media max-width:767px 自動隱藏；mobile 只剩 save-indicator，tablet/desktop 完整顯示）。
> - 驗證：jest 157/157 + Playwright Desktop-1280/Mobile-360/iPad 102/102 critical specs 全綠 + opus 親 Read 6 PNG（mobile/tablet/desktop × home + drill phase-head）全對齊。
>
> **Post-ship hardening 重點（2026-05-04 user rapid-fire fix — 之前批次）:**
> - `routes/circles-public.js` 已存在 `POST /hint` 端點（後端 AI 已開好,前端只需呼叫）
> - rt-toolbar 全 `<div contenteditable="true">` + `document.execCommand('bold'/'insertUnorderedList')` 真 WYSIWYG
> - rail 統一「X 步重點」單格（railTitle2/railBody2 config 仍存,只是不 render — 留 future Tier-2 用）
> - S 步 tracking 4 dim 範例答案用 `filterTrackingExampleByDim(md, dimKey)` 切 DB 單一 entry
> - **L 步 sol-card label 三 viewport 都顯示**（之前 tablet+ 隱藏為自作主張,違反 mockup line 1260）

---

## 0. 30 秒進入狀態

User 是 PM Drill 專案 owner（zh-TW 母語、product/design sense 重、不寫程式但讀得懂）。當前在 **Path 2 — Frontend Rewrite**：把 production 前端 CSS + render 結構從 0 重寫，視覺對標 aistockmap.com（手機 web 滑順度）。**後端 / API / DB / OpenAI prompts / jest 100% 不動。**

進度：✅ Plan A merged to main（`55f7051`）。B/C/D 三 worktree 平行跑。

| Plan | Worktree | Branch | PORT | CSS | JS | SB1 狀態 |
|---|---|---|---|---|---|---|
| B (CIRCLES Home) | first-principle-path2-b-circles | feat/path-2-circles-core | 4001 | ✅ 5 commits | ❌ 未動 | ❌ 待實作 |
| C (NSM Step 1) | first-principle-path2-c-nsm | feat/path-2-nsm | 4002 | ✅ done | ✅ done | ✅ **`9fc366a`** jest 157 / PW 12/12 |
| D (Offcanvas) | first-principle-path2-d-cross | feat/path-2-cross-cutting | 4003 | ✅ done | ✅ done | ✅ **`7e44422`** PW 5/5 |

---

## 🔴 現在最優先：Plan B SB1 JS render（CIRCLES Home mockup 01）

Plan B 的 CSS 已有 5 commits（mobile navbar tabs hide / stats-strip / mode cards / q-list / qcard），JS render 函式完全未動。

### 接手步驟（Plan B SB1）

```bash
cd /Users/albertpeng/Desktop/claude_project/first-principle-path2-b-circles
PORT=4001 node server.js &
git log main..HEAD --oneline
```

1. 讀 mockup 01：`docs/superpowers/specs/mockups/2026-05-02-frontend-rewrite/01-circles-home.html`
2. 讀 plan B stub：`docs/superpowers/plans/2026-05-03-path-2-plan-b-circles-core.md`
3. 在 `public/app.js` 的 `renderCirclesStub()` 前插入完整 CIRCLES Home render 函式（`renderCirclesHome()` + `bindCirclesHome()`）
4. 接著繼續 Plan B 各 sub-bundle（Phase 1-4 等，參考 mockups 03/04/05/11/12/13）

**已知 mobile-360 navbar 問題（待 Plan B 修）：**
- `@media (max-width: 480px) { .navbar__tabs { display: none; } }` — 加在 style.css
- Plan B merge 前必讓 user 用 mobile-360 親跑確認

### Plan D SB1 已完成（不需再動）

`first-principle-path2-d-cross` / `7e44422` + fix `1575eaf`：offcanvas history drawer 全完成。

**Cold-review 補洞（2026-05-03）：** director Read PNG 抓出 3 真 bug（step_scores.S 取整個物件 / scores_json.final_score 應為 totalScore / NSM title 用了 schema 無的 industry 欄位）+ 4 mockup 09 drift（empty/error icon、empty CTA btn--primary 應 ghost、empty/error 副文）。走 TDD 紅綠補完，jest 157/157、Playwright 40/40 (5 tests × 8 viewport)、9 張 PNG Read 過全對齊 mockup 09。詳：`audit/eyeball-plan-d-sb1-fix.md`。

### Plan C SB1 已完成（2026-05-03）

`first-principle-path2-c-nsm` / `9fc366a`：NSM Step 1 全完成。
- `renderNSMStep1` + `bindNSMStep1` + `loadNSMContext` + 9 helpers
- CSS responsive toggle（nsm-body/nsm-desktop-shell）+ phase-head__meta visibility
- jest 140 pass + 17 skip = 157/157
- Playwright `tests/visual/nsm-home.spec.js` 4 tests × 3 viewports = 12/12 pass
- 截圖自驗：mobile/tablet/desktop 三 viewport 匹配 mockup 06

---

## ⚡ 加速策略（current — 5x faster than原估）

| 槓桿 | 作法 |
|---|---|
| Plan 平行 | A 序列；B/C/D 三 worktree **同時跑**（render 函式互不重疊）|
| Task 顆粒 | 4-8 task 一綑 sub-bundle 一次 dispatch（非 per-task）|
| Review | 機械 CSS 單階段；複雜 render 才雙階段 |
| Visual gate | 自動 pixel-diff CI；只 failure 才人工 |
| jest cadence | plan 起始 + 結束 + push（非 per-task）|
| iOS 真機 | 只 Plan E 結束驗一次 |

**新估時：** Plan A 1 天 / B+C+D 平行 4-5 天 / E 2-3 天 = **8-10 天總計**（vs 原 4-5 週）。

---

## 1. 你接手的當下要做什麼

```bash
cd /Users/albertpeng/Desktop/claude_project/First_Principle
git status              # 看當下 branch + working tree
git log --oneline -10   # 看最近 10 個 commit
cat CLAUDE.md           # 即時狀態看板
ls docs/superpowers/plans/2026-05-03-path-2-plan-*.md   # 5 個 plan
```

接手後**先做這三件事**：
1. 讀 `CLAUDE.md`（state board）+ 本檔
2. 讀 user 最近一則訊息（看當下要繼續哪個 plan / sub-bundle）
3. 用 Read 看實際工作中的檔案 1-2 個（不要憑記憶寫）

---

## 🚨 緊急接手（2026-05-03 token 危機節點）

**狀態：** Plan A merged + push to origin/main `aa6e748`。Cleanup 已 push（刪除 mobile-audit / rwd-audit / corrupted JSON / test-singleton.js / sp2/sp3-backend/pm-drill-ux-overhaul worktrees）。

**3 個背景 implementer subagent 跑中（你接手要 check 它們）：**

| Plan | Worktree | Branch | PORT | Agent ID | Output File |
|---|---|---|---|---|---|
| B SB1 (CIRCLES Home mockup 01) | first-principle-path2-b-circles | feat/path-2-circles-core | 4001 | adb4ae6fddaefce90 | `/private/tmp/claude-501/.../tasks/adb4ae6fddaefce90.output` |
| C SB1 (NSM Step 1 mockup 06) | first-principle-path2-c-nsm | feat/path-2-nsm | 4002 | abe78c26a752730d4 | `/private/tmp/claude-501/.../tasks/abe78c26a752730d4.output` |
| D SB1 (Offcanvas mockup 09) | first-principle-path2-d-cross | feat/path-2-cross-cutting | 4003 | a3a465a158b1323e3 | `/private/tmp/claude-501/.../tasks/a3a465a158b1323e3.output` |

(完整 path: `/private/tmp/claude-501/-Users-albertpeng-Desktop-claude-project-First-Principle/a50c5a9d-0e8f-4dad-9746-4f8e3347b74b/tasks/`)

**接手第一步：**
1. 對每個 worktree 跑 `git log main..HEAD --oneline` 看 commit 進度
2. 對每個 agent output file 用 `tail -100` 看最後狀態（新 session 沒 overflow 顧慮）
3. 三個 SB1 都 DONE 後逐一 review → 合併回 main → push → dispatch SB2

**Plan B/C 的 expansion subagent 已死（stall）**，不必重 dispatch。改用 inline scope-per-SB 模式 dispatch implementer（B SB1 / C SB1 / D SB1 prompt 都已內含 detailed scope）。

**SB1 dispatch prompts 範本** 在這條對話 history（如要 dispatch SB2 可用相似 pattern）。

### Agent 跑不完的 fallback playbook

不論哪個 SB agent 是 stall / BLOCKED / 部分完成 / 結果錯，**git commits 是 source of truth**。Worktree 內已 commit 的 task 是 ship-safe 的，沒 commit 的就當沒做過。

| 失敗模式 | 偵測 | 復原步驟 |
|---|---|---|
| **Stall（watchdog 600s 無回應）**| 通知有 `failed: stalled` | 1. `cd <worktree>`<br>2. `git log main..HEAD --oneline` 看跑到哪<br>3. 對該 plan 的 plan stub + mockup，從下一個 task 重新 dispatch implementer（prompt scope 縮小）|
| **BLOCKED**| Agent self-report `STATUS: BLOCKED` + 具體問題 | 1. 讀問題<br>2. 答問題加進新 prompt context<br>3. 重 dispatch from last commit |
| **部分完成（中途 crash）**| `git log` 顯示 N commits 但 self-report 缺 | 1. 看 worktree 是否有 uncommitted changes<br>2. `git status` 乾淨 → 從下一 task 接<br>3. 不乾淨 → 評估是否要保留：保留就 commit，不保留就 `git checkout .` 從 last commit 接 |
| **DONE 但測試失敗**| Self-report DONE / 但 visual diff > 0.5% 或 smoke fail | 1. dispatch fix subagent 給 specific failure（截圖 + console err + diff %）<br>2. 不要重做整個 SB |
| **DONE 但視覺亂**| 跑 `npm start` + Read PNG 看到問題 | 1. 截圖 +list 具體問題<br>2. dispatch fix subagent 解|
| **Worktree 整個壞**| 反正啥都不對 | 1. `git worktree remove --force <path>`<br>2. `git branch -D <branch>`<br>3. 從 main 重建 worktree<br>4. 重新 dispatch SB1（已知 mockup + spec，second try 快很多）|

### 各 worktree 健康檢查指令（30 秒）

```bash
for wt in first-principle-path2-b-circles first-principle-path2-c-nsm first-principle-path2-d-cross; do
  echo "=== $wt ==="
  cd /Users/albertpeng/Desktop/claude_project/$wt
  git log --oneline main..HEAD | head -5
  echo "lines: $(wc -l public/style.css public/app.js | tail -1)"
  git status -s | head -3
done
```

**判讀：**
- commit 數 > 5 = SB 進行中
- style.css / app.js 行數有增加 = 有實作
- `git status` 乾淨 = 安全狀態，可以接手
- `git status` 有 unstaged = 中途 crash，先處理

**已知 issue carry-forward：**
- mobile-360 navbar tabs 擠壓 — Plan B SB1 已含修法（`@media (max-width:480px) { .navbar__tabs { display: none; } }`）

**Memory 必讀：**
- `feedback_verify_with_live_port.md`（驗收必開 port）
- `project_path2_known_issues.md`（mobile navbar issue）

---

## 2. 現在 user 期待你做什麼

**進度：Plan A 全 5 sub-bundle 完成（18 commits）。** 等 user 做 director eyeball walk + signoff 後 merge → 開 B/C/D 三 worktree 平行跑。

接手第一步：
1. `cd /Users/albertpeng/Desktop/claude_project/first-principle-path2-foundation`
2. `git log --oneline main..HEAD` 確認 18 commits
3. 讀 `audit/path-2-plan-a-signoff.md`（14-box gate doc）
4. 跑 director eyeball walk（signoff doc §Director eyeball walk SOP）
5. user signoff → merge feat/path-2-foundation → main → 開 Plan B/C/D 三 worktree

### 14-box gate 狀態
- 13/14 ✓
- Box #11（director eyeball walk）= 待 user 跑

### Plan A 最終 SHA
```
3347c16 docs(plan-a): self-verify + user notify
fb0cba1 docs(plan-a): 14-box gate signoff prep
bf290a1 test(plan-a): jest 157 baseline regression
3d528f9 docs(plan-a): iOS Safari static checklist
502df3a test(plan-a): mark Playwright .skip
c655d6c feat(plan-a): renderNavbar + banners; smoke green
627fccf feat(plan-a): render dispatch + apiFetch 401
e84ba24 feat(plan-a): app.js skeleton AppState
a733a76 feat(plan-a): LOCKED · loading/error/form/panel
9b51d33 feat(plan-a): LOCKED · banner family
903ed3f feat(plan-a): LOCKED · circles-nav/qchip/submit-bar/phase-head
ae67a54 feat(plan-a): LOCKED · btn family
c41623f feat(plan-a): LOCKED · navbar
07bbae0 feat(plan-a): style.css tokens + base reset
ca806bb test(plan-a): smoke spec TDD red
c776159 feat(visual-test): 51 baseline PNGs
9d05a7b feat(visual-test): pixelmatch + screenshot helpers
602ef07 chore(plan-a): record baseline
```

### Sub-bundle 切分計畫（5 綑加速版）

| # | 範圍 | Tasks | 估時 | 狀態 |
|---|---|---|---|---|
| **SB1** | Setup + visual test infra + 51 baseline + smoke red | 1-4 | 30-60 min | ✅ DONE (4 commits) |
| **SB2** | style.css 全替換（tokens + 9 LOCKED chunks）| 5-10 | 45-60 min | ✅ DONE (6 commits, 4892→166 lines) |
| **SB3** | app.js skeleton（AppState + persistence + boot + listeners + render dispatch + renderNavbar + view stubs）| 11-13 | 60-90 min | ✅ DONE (3 commits, 7089→213 lines, smoke 3/3 綠) |
| **SB4** | jest + Playwright regression + iOS checklist | 14-16 | 30-45 min | ✅ DONE (3 commits, jest 133+24 skip = 157, iOS 11/15) |
| **SB5** | 14-box gate signoff doc + 自我檢查 | 17-18 | 15-30 min | ✅ DONE (2 commits) — **Plan A 整體完成** |

每 SB 結束後：spec compliance 自驗 → 進下一 SB。SB5 結束 → 等 user signoff merge。

---

## 3. Path 2 鐵則（違反就 BLOCK）

從 `CLAUDE.md` Standing Rules + memory 提煉：

1. **CLAUDE.md 即時更新** —— 每次重大事件即時 Edit，single source of truth
2. **後端 / API / DB / OpenAI prompts / jest 100% 不動** —— Path 2 範圍鎖死
3. **17 mockups 是 CONTRACT-LOCKED 視覺契約** —— implementer 開工必對 mockup；auditor PNG pixel-diff 0.5% threshold
4. **全 zh-TW，無 emoji，icons 用 Phosphor `ph-*`** —— mockup 15 §A3 凍結 icon 字典
5. **字型 system-ui stack**，grade letter 例外 Instrument Serif italic
6. **無紫色 `#5b21b6`** —— Path 2 用 navy `#1B2D5C`（mockup 15 audit 已掃過、5 既有檔已 patch）
7. **無黃色 toast / banner `#FFF8E7`** —— 警示用 navy 或 warn `#B85C00`
8. **mockup-as-Spec 嚴格遵守** —— mockup 偏離即 bundle 不過（spec §5.2）
9. **mockup 並排 frame 用 modifier class**（`.is-mobile/tablet/desktop`），**不用 @media**（mockup 14 揭示的 bug）
10. **每張 PNG ≥ 1 句評論** —— Director eyeball walk Layer 6（spec §0.5）

---

## 4. 5 plans 順序（不能跳）

| # | Plan | 狀態 | 路徑 |
|---|---|---|---|
| **A** | Foundation（tokens + LOCKED chunks + AppState + router）| ✅ **完整 18 tasks** | `docs/superpowers/plans/2026-05-03-path-2-plan-a-foundation.md` |
| B | CIRCLES Core（home / phase 1-4）| 📋 stub，待 A merge 後展開 | `..../path-2-plan-b-circles-core.md` |
| C | NSM（step 1-4）| 📋 stub，待 B merge 後展開 | `..../path-2-plan-c-nsm.md` |
| D | Cross-cutting（offcanvas / onboarding / toast / modal）| 📋 stub，待 C merge 後展開 | `..../path-2-plan-d-cross-cutting.md` |
| E | Edge & Transitions（drill 跳轉 / sim transition / SSE 重發 / 401 / 8 viewport regression）| 📋 stub，最後 plan | `..../path-2-plan-e-edge-transitions.md` |

每個 plan **獨立 worktree、獨立 14-box gate、獨立 merge**。Plans B-E 的 stub 寫好 scope/dependencies/sub-bundle 大綱；要展開為完整 ~50-70 task 版時，**對著 user 跑一輪 brainstorming → 再寫**。

**估計：250-300 tasks 總計 / 110-130 hr 真實工時 / 2-7 週日曆時間（取決於 user 投入頻率）**

---

## 5. 17 mockups 索引（CONTRACT-LOCKED）

`docs/superpowers/specs/mockups/2026-05-02-frontend-rewrite/`

| # | 檔案 | 內容 |
|---|---|---|
| 00 | design-system | 21 sections design tokens + LOCKED chunks |
| 01 | circles-home | A-G 7 sections + v5 對齊缺口 |
| 02 | auth-flow | 登入登出 |
| 03 | phase-1-form | 4-field form + hint overlay + 7 sections |
| 04 | phase-1-5-gate | 三態 gate + loading |
| 05 | phase-2-chat | 三角色 bubble + 4 底部 state |
| 06 | nsm-step-1 | 5 卡 + 4-欄 context + 3-col rail |
| 07 | nsm-step-2 | 步驟 2/3 sub-tabs + 4-dim 動態 label |
| 08 | nsm-step-3-gate | 5 維度檢核三態 + loading |
| 09 | offcanvas-history | drawer 280px + 4 狀態 |
| 10 | onboarding | welcome + 4-step coachmark tour |
| 11 | phase-3-score | 評分頁 4 sections + coach demo |
| 12 | phase-3-error-loading | error 變體 + slow loading |
| 13 | phase-4-final | grade + 7-axis radar + step-rows + nested NSM 4 dim |
| 14 | nsm-step-4 | 4 tabs + 教練思路展開 panel（5 sections）|
| 15 | error-empty-collation | §A 規約字典 6 表 + §B-D 全集 |
| 16 | flow-transitions-edge | drill 跳轉 / sim transition / SSE 重發 / Phase 3 切離（4 sections）|

---

## 6. 關鍵 spec 章節（implementer 開工前必讀）

`docs/superpowers/specs/2026-05-02-frontend-rewrite-master-spec.md`

| 章節 | 重點 |
|---|---|
| §0.2 | iOS Safari 15-item checklist |
| §0.5 | 8 層視覺對齊測試 stack（含 Layer 1.1 baseline 截圖規範）|
| §0.6 | tests/visual/ 子系統規範 |
| §1.1-1.8 | Backend contract（CONTRACT-LOCKED 不准改）|
| §1.5.1 | Multi-tab + 401 mid-action（已對齊：SSE **無 resume**，重發是新一輪）|
| §1.7 | Static asset paths LOCKED（`/index.html /app.js /style.css`）|
| §2.1 | AppState 結構 |
| §2.10 | Navbar CONTRACT-LOCKED 結構 |
| §2.12 | Design tokens |
| §2.14 | **State ↔ Mockup CSS class 映射表**（implementer 寫 render 必查）|
| §3.x | Domain logic（CIRCLES 7 步 / NSM / 評分公式 / magic numbers）|
| §4 | 清理候選（**`renderHistory` 已 deprecate**，全頁 history view 砍）|
| §5.1 | Mockup index 含完整每張 mockup spec 描述 |
| §5.2 | Mockup-as-Spec 嚴格遵守規則 |
| §6.2 | Bundle 完工 14-box gate 強制產出 |

---

## 7. User 工作模式（觀察累積）

- **語言：** 全 zh-TW，技術詞穿插英文 OK
- **節奏：** 一張 mockup 一張 mockup 過，習慣「go」開工 + 「通過」放行 + 具體修改意見
- **review 嚴格度：**
  - 喜歡親看 PNG（會直接貼圖回 issue）
  - 對「奇怪顏色 / 太多色」敏感（→ navy 中性原則）
  - 不喜歡虛構（mockup 16 §E migration 因為 production 沒功能就刪掉，不畫不存在的東西）
  - 「設計前必須驗證現有產品」的 standing rule（memory：`feedback_design_after_verifying_product.md`）
- **抽問 SOP（user 殺手鐧 3 問）：**
  1. 「你 Read 過 PNG 沒？」
  2. 「5 條 boundingBox invariant 數字」
  3. 「mockup ↔ production diff 結果？」
  任一答不出 = bundle 重來
- **commit message 風格：** zh-TW 主標題 + bullet 列表，含 Co-Authored-By

---

## 8. Memory 必讀（接手後立刻載入）

`/Users/albertpeng/.claude/projects/-Users-albertpeng-Desktop-claude-project-First-Principle/memory/`

`MEMORY.md` 內容會自動載入。重點 memory：
- `feedback_mockup_first.md` — Every plan must embed mockup; get 「放行」 first
- `feedback_design_after_verifying_product.md` — 開工前必驗 production
- `feedback_locked_components_reuse.md` — 03 起 LOCKED CSS 不准重定義
- `feedback_mockup_self_verify_playwright.md` — Chrome 給 user 看是 user 評閱不是自驗，要 Playwright 截圖 + Read PNG 自驗
- `project_circles_methodology.md` — CIRCLES 7 步完整 reference
- `feedback_full_sit_uat_uiux.md` — director 簽收前必跑全 8 viewport
- `feedback_discipline_enforcement.md` — 強制產出物 + CI gate + 殺手鐧抽問三件套

---

## 8.5 Plan A 已知問題（carry forward — user 同意 2026-05-03）

| # | 問題 | 必修 Plan | 詳細 memory |
|---|---|---|---|
| 1 | Mobile-360 navbar tabs 擠壓（CIRCLES 變直立橢圓 / 北極星指標直排）| Plan B | `project_path2_known_issues.md` |
| 2 | Mobile-360 progress 7 階段 overflow（第 7 步「S 總結」溢出）| Plan B 後續 | `audit/eyeball-plan-b-sb4.md` |

Plan B 開工前 implementer 必讀此節 + 對應 memory；Plan B merge 前必再開 port 給 user 親跑 mobile-360 確認修好。

---

## 9. Plan A SB1-4 完成（commit hashes）

`feat/path-2-foundation` 16 commits ahead of main：

| SB | Tasks | Commits |
|---|---|---|
| 1 | 1-4 setup + visual infra + 51 baselines + smoke red | 602ef07 / 9d05a7b / c776159 / ca806bb |
| 2 | 5-10 style.css tokens + 9 LOCKED chunks (4892→166) | 07bbae0 / c41623f / ae67a54 / 903ed3f / 9b51d33 / a733a76 |
| 3 | 11-13 app.js skeleton (7089→213) + smoke 3/3 綠 | e84ba24 / 627fccf / c655d6c |
| 4 | 14-16 jest 157 (133+24 skip) + Playwright .skip + iOS 11/15 | bf290a1 / 502df3a / 3d528f9 |

**Plan B/C 必須處理的 24 jest skip：**
- Plan B 接 4 檔（sp1.5-helpers / locked-banner / bugfix-helpers / bugfix-action-bar）
- Plan C 接 2 檔（sp4-nsm-context / sp4-nsm-db-extraction 1 test.skip）

詳：worktree 內 `.plan-a-baseline.md`

---

## 10. 最近重要決策（Bundle 0 補洞）

`commit f794a4c` Bundle 0 readiness：
- §1.5.1 multi-tab + 401 + SSE 重發（**無 resume**）+ Phase 3 loading 切離
- §0.5 Layer 1.1 baseline 截圖規範（凍 animation / wait fonts）
- §2.14 State ↔ Mockup CSS class 映射表（implementer 開工必查）
- §4 `renderHistory` 全頁 view 砍（offcanvas 取代）
- mockup 15 §A 擴張 6 表（A4 Class Naming / A5 Button → AppState / A6 Copy 常數規則）
- mockup 16 新建（drill 跳轉 / sim transition / SSE 重發 / Phase 3 切離 — **§E migration 已刪**）

`commit db9d105` 對齊 production：
- mockup 16 §C SSE：「繼續」→「重新發送」（後端無 resume）
- mockup 16 §E migration 整段刪（production silent fetch 無 UI 可 mockup）

---

## 11. 接手 checklist（你做這幾件就上手）

- [ ] 讀本檔（30 秒）
- [ ] 讀 `CLAUDE.md`（state board）
- [ ] 讀 `MEMORY.md` index
- [ ] `git log --oneline -20` 看最近 commit
- [ ] 看 user 最後一則訊息決定下一步
- [ ] 不確定的事先問 user，不要 fabricate
- [ ] 任何重大事件即時 update CLAUDE.md + 本檔
- [ ] 執行 plan 前先 `git status` 確認 branch + working tree
- [ ] 自驗 mockup：Playwright 截圖 + Read PNG，不只給 Chrome 看
- [ ] commit 用 HEREDOC + Co-Authored-By: Claude Opus 4.7 (1M context)

---

## 12. 隨時更新規則

當以下事件發生，立刻在本檔更新對應段落：
- 任何 plan merged → 更新 §4
- 任何 mockup 修改 → 更新 §5
- 任何 spec 章節修改 → 更新 §6
- 任何重大決策 → 寫入 §9（注意 commit hash）
- User 提出新 standing rule → 寫入 §3 + 新 memory file
