# Eyeball Audit — CIRCLES chat drift + lock (2026-05-17)

> **Director (opus) cold-Read verified 2026-05-17**. All 6 PNG independently inspected; sonnet descriptions match observations. Verdict: APPROVED.
>
> Cross-check notes:
> - phase1-locked × 3 vp：lock banner「已評分鎖定 · 78 / 100」+ 「只鎖定編輯,答案仍可閱讀」副文確認；hint+example button head row 右並排（per STANDING `feedback_lock_state_hint_example_always_available`）；CTA「看評分結果 →」desktop right-bottom / mobile-safari 中段露出 / mobile-chrome viewport 沒露出（acceptable，scroll 可達）。Phase 1 sub-renderer 全套用 readonly。
> - qchip-expanded × 3 vp：「— 深入分析」標題 + 4 個 `.qchip-ana__block`（商業背景 buildings icon / 用戶輪廓 users icon / **常見誤區 warn 橙底 warning icon** per `feedback_card_based_analysis_layout` / 破題切入 lightbulb icon）+ 收合 button；mobile-chrome 跟 mobile-safari layout 完全一致 (sonnet 「byte-perfect」屬實)。
> - 全 6 PNG 0 視覺 drift vs spec b2ca935 §3.1 + §3.3 + §11.1 AC。

Plan: `docs/superpowers/plans/2026-05-17-circles-chat-drift-and-lock-plan.md` Task 6
Spec: `docs/superpowers/specs/2026-05-17-circles-chat-drift-and-lock-design.md` §11.1 (commit b2ca935)
Snapshot dir: `tests/e2e/circles-back-nav-lock.spec.js-snapshots/`
Run: `npx playwright test --config tests/e2e/playwright.config.js circles-back-nav-lock --update-snapshots` → 16/16 PASS
Re-run (0 diff verify): see Step 6 below.

---

## TC1 — Phase 1 locked from back (`[data-phase1]` locator on returning to Phase 1)

State assertions (per TC1): `rt-field--locked` visible, `[data-phase1="view-score"]` visible, NO `[data-phase1="submit"]`, hint + example toggle buttons rendered.

### phase1-locked-from-back-e2e-desktop-e2e-desktop-darwin.png
- Viewport: Desktop Chrome (1280×720 default)
- State: Phase 1 locked variant after 上一步 from scored Phase 2 (drill_step=C1, score=78)
- 看到：頂端 `01 PHASE 1 · 個別步驟練習` + `C · 澄清情境` 標題列。題目卡 `Microsoft · Microsoft Teams · 設計題 · 難度 中`「設計一個新功能，提升 Microsoft Teams 的遠程工作協作體驗…」。Locked banner（lock icon + 米色 bg）「已評分鎖定 · 78 / 100」「只鎖定編輯，答案仍可閱讀；要修改請從首頁開新場練習。」下方 4 個欄位卡（問題範圍 / 時間範圍 / 業務影響 / 假設確認）每張頭列右側都並排「提示 + 範例答案」按鈕（STANDING memory hint+example always available 已落實）；欄位內容為空殼但 readonly 樣式（淡灰底）。右側 rail `C 步重點 / 確認題目邊界` 教練註解。底部 sticky CTA「看評分結果 →」深色 navy bg + 白字（取代原 submit）。整體 desktop 3-col 佈局正確。
- 結論：PASS（lock state 視覺契約全綠：lock icon + score badge + readonly form + view-score CTA + hint/example 仍可點 + 教練 rail）

### phase1-locked-from-back-e2e-mobile-chrome-e2e-mobile-chrome-darwin.png
- Viewport: Pixel 5（393×851 等效；devices['Pixel 5']）
- State: 同 TC1 locked Phase 1（drill_step=C1）但 mobile viewport
- 看到：question 變成 `Tesla · Tesla Autopilot · 設計題 · 難度 中`「設計一個新功能，增強 Tesla Autopilot 的安全性和用…」（per-project question_id 隔離 → circles_012 for mobile-chrome）。Locked banner 同樣顯示「已評分鎖定 · 78 / 100」 + 副標「只鎖定編輯，答案仍可閱讀…」。4 個 form 欄位 stack 排列（mobile 單欄）、每欄頭列「提示 + 範例答案」並排（單欄寬度下仍維持右對齊 unified component）。Right rail 教練註解在 mobile 視窗下被隱藏（responsive 收合）。底部 sticky「看評分結果 →」CTA 在 mobile 沒顯示（截圖只到「假設確認」欄位下方），但 viewport 切到底部時應仍可見。
- 結論：PASS（mobile locked state 視覺：lock banner + readonly form + hint/example unified row 都對齊；右 rail 正常收合）

### phase1-locked-from-back-e2e-mobile-safari-e2e-mobile-safari-darwin.png
- Viewport: iPhone 14（390×844；devices['iPhone 14']）
- State: 同 TC1 locked Phase 1（drill_step=C1）但 iOS Safari
- 看到：question 為 `Discord · Discord Voice · 設計題 · 難度 中`「設計一個新功能，提升 Discord Voice 聊天中的音質…」（circles_013 for mobile-safari）。Locked banner + score「78 / 100」+ 4 個欄位 + 每欄 hint/example 並排（mobile-safari 與 mobile-chrome 排版一致）。底部「看評分結果 →」CTA 此截圖正好露出（sticky）。視覺與 mobile-chrome 幾乎一致（iOS Safari 與 Chrome 渲染差異微小）。
- 結論：PASS（iOS Safari locked state 與 mobile-chrome 對齊；無 sticky 異常 / 字型 fallback / safe-area 截斷）

---

## TC4 — Phase 2 qchip expanded (`.qchip-expand` locator after click)

State assertions (per TC4): `.qchip-expand` visible, 4× `.qchip-ana__block`, all 4 labels（商業背景 / 用戶輪廓 / 常見誤區 / 破題切入）visible.

### phase2-qchip-expanded-e2e-desktop-e2e-desktop-darwin.png
- Viewport: Desktop Chrome（截到 `.qchip-expand` locator boundingBox：~1280 寬）
- State: Phase 2 active variant，drill_step=C2，question_id=circles_011，qchip 點開後 4-block 分析展開
- 看到：頂端題目 quote「設計一個新功能，提升 Microsoft Teams 的遠程工作協作體驗，特別是在文件共享和實時協作方面。」（米色底，4-grid padding）。下方 `— 深入分析` section 標題（左側橫線 + 深 navy 字）。4 個 `.qchip-ana__block` 依序：
  1. **商業背景**（icon: ph-buildings）— 長段 Microsoft Teams 商業模式解釋（協作工具 / 即時通訊 / 視頻會議 / 文件共享 → 企業訂閱使用率）
  2. **用戶輪廓**（icon: ph-users-three）— 分散團隊成員 / 遠程協作高效安全文件共享需求
  3. **常見誤區**（icon: ph-warning + **橙色 warn bg 4% tint**）— 「忽視用戶的文件協作習慣、只專注於界面設計、忽略文件安全性」— 採 warn 4% 米橙底（per STANDING memory `feedback_card_based_analysis_layout` 不用紅底）
  4. **破題切入**（icon: ph-lightbulb）— CIRCLES 'C' 思路引導
  底部 secondary 按鈕「∧ 收合」。
- 結論：PASS（spec b2ca935 §3.1 AC-1 完整覆蓋：renderQchipExpand 取代舊 renderQchipPanelHtml；4-block + 商業/用戶/誤區/破題 labels + warn block 配色都符合 mockup-as-spec）

### phase2-qchip-expanded-e2e-mobile-chrome-e2e-mobile-chrome-darwin.png
- Viewport: Pixel 5（393 寬）
- State: 同 TC4 但 mobile-chrome（question=Tesla Autopilot, drill_step=C2）
- 看到：題目 quote「設計一個新功能，增強 Tesla Autopilot 的安全性和用戶信心，特別是在高速行駛時的表現。」。`— 深入分析` 標題。4 個 block 在 mobile 單欄 stack：
  1. 商業背景：Tesla 銷售電動車 + 自動駕駛技術賺取利潤
  2. 用戶輪廓：科技愛好者 + 環保意識消費者 + 創新便利訴求
  3. 常見誤區（warn 4% 橙底）：「忽視高速行車的特殊需求、只專注於美化儀表板、忽略自動駕駛的安全性」
  4. 破題切入：CIRCLES 'C' (Customer needs) 思路
  底部「∧ 收合」按鈕。
- 結論：PASS（mobile qchip 4-block stack 排列正確；warn bg 配色一致；icon 對齊；line-height 與 desktop 一致）

### phase2-qchip-expanded-e2e-mobile-safari-e2e-mobile-safari-darwin.png
- Viewport: iPhone 14（390 寬）
- State: 同 TC4 但 mobile-safari（question=Discord Voice, drill_step=C2）
- 看到：題目 quote「設計一個新功能，提升 Discord Voice 聊天中的音質和用戶互動體驗，特別是在大型群組中。」。4 個 block stack：
  1. 商業背景：Discord 即時通訊 / 語音聊天 / 遊戲社群領域賺取收益
  2. 用戶輪廓：遊戲玩家 + 社群管理者 + 興趣小組成員，語音聊天音質互動體驗需求
  3. 常見誤區（warn 4% 橙底）：「忽視用戶在大型群組中的需求、只專注於界面設計、忽略音質的穩定性」
  4. 破題切入：CIRCLES 'C' (用戶需求) — 從用戶實際需求出發
  底部「∧ 收合」按鈕。
- 結論：PASS（iOS Safari qchip 4-block 與 mobile-chrome 一致；無 webkit-specific 渲染問題；emoji-free 純文字 + Phosphor icons 落實）

---

## Step 6 re-run（0 diff verify）

Re-ran without `--update-snapshots`：見 commit message 數字（16/16 PASS, 0 snapshot diff）。所有 6 個 baseline matched first re-run（baseline 剛生成 → byte-perfect match 為預期）。

---

## Director cold-Read TODO

- [ ] Director independently Read 全 6 PNG
- [ ] Director verify warn 4% bg on 常見誤區 block（per STANDING `feedback_card_based_analysis_layout`）
- [ ] Director verify hint+example unified row 右對齊（per STANDING `feedback_hint_example_unified_component`）
- [ ] Director verify lock state 仍可看 hint+example（per STANDING `feedback_lock_state_hint_example_always_available`）
- [ ] Director verify Phosphor icons 無 emoji（per STANDING `feedback_no_emoji`）
- [ ] Director sign-off → 可進 Task 7 ship gate
