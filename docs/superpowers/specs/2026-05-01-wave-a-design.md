# Wave A 修復設計 — Audit Cycle 2026-04-30

**Status:** 待使用者覆核
**Date:** 2026-05-01
**Cycle:** `audit/cycles/2026-04-30/issues-master.md`
**Director:** main thread

## 範圍

Wave A = 不需要 UI/UX 設計重做的功能修復。所有項目都要 **director 派 agent + agent 做全站掃描**，不能只改一處。

## 決策摘要

| Master | 視覺策略 | 全站掃描範圍 |
|---|---|---|
| M-001 | 純 handler bug | grep 同款 `nextElementSibling` pattern 全 app.js |
| M-006 | CSS overflow 收掉 | grep 所有 `width:.*vw`/`right:0` 但容器有 padding 的規則 |
| M-009 | 加底 padding token | 所有 phase-1 form + Phase-2 chat + NSM step form |
| **M-010** | **駁回，不動** | n/a — 維持現行設計 |
| M-011 | autosave fallback localStorage | grep 所有 `[circles auto-save]` / `[nsm auto-save]` call site |
| M-012 | 三鍵並列 (返回選題 / ← 上一步 / 下一步) | drill mode 三步 (C1/I/R) 全部統一邏輯 |
| **M-015** | **全站「回首頁」改 icon (ph-house)** | 9 處 CIRCLES TEXT + 5 處 NSM 已 icon + gate sub-tab 1 處 icon+text |
| M-019 | 等寬 (B 案) sub-tabs RWD | grep 其他 `_isDesktopP1` 隱藏 UI 的 gate |
| M-020 | PNG 主行動置右 (A 案) | Phase-4 only — 但要確認 jest/playwright 不退化 |
| M-021 | spinner + 「載入練習記錄中…」文字 | 所有 list render race 套同模式 |

## 全站掃描清單（agent 必跑）

### M-001: 查看範例 handler
- 全 `public/app.js` grep `nextElementSibling`，挑出查看範例那一處（line 2967 附近）。
- 改用 `btn.closest('.circles-field-group').querySelector('.field-example-body')`。
- 順手 grep 其他 `nextElementSibling` 看有無同樣 redesign 隱患（NSM 提示按鈕？）。

### M-006: Mobile-360 水平 9px 溢出
- 量到的 offenders：`.btn.btn-ghost`、`.offcanvas-overlay`、`.circles-submit-bar`。
- 全 `public/style.css` grep：
  - `width:\s*100vw`（容器 padding 會超）
  - `right:\s*-?\d+px`（負座標）
  - `min-width:\s*\d+px`（內容撐爆）
- 設定 `max-width: 100vw; box-sizing: border-box`。

### M-009: sticky bar 蓋字
- 加 token `--circles-stickybar-pad: 96px`（含 safe-area-inset-bottom）。
- 對象：
  - `.circles-step-form-wrap` (Phase 1)
  - `.circles-phase2-chat` (Phase 2)
  - `.nsm-step-form` (NSM 1/2/3)
- 桌面 sticky 高度比較矮，可在 `@media (min-width:1024px)` 縮小 token。

### M-011: autosave 失敗 fallback
- grep `circles auto-save` / `nsm auto-save` / `PATCH.*progress`。
- 失敗 catch 區塊：
  - `.save-indicator` 寫「⚠ 未連線，已存本機」。
  - `localStorage.setItem('circles_draft_${sessionId}_${stepKey}', JSON.stringify(draft))`。
  - 下次 `loadCirclesSession` 優先讀 `localStorage`，成功 PATCH 後清掉 key。
  - `console.warn`（不 swallow）。
- NSM 同模式（key prefix `nsm_draft_`）。

### M-012: drill mode 上一步
- drill mode 三步 (C1 / I / R)：
  - **C1**：first，無上一步（仍只有「返回選題」+「下一步」）。
  - **I**：中間，要補「← 上一步」（回 C1）。
  - **R**：last，已有「送出評分」，補「← 上一步」（回 I）。
- submit bar template 改成統一函式：判斷 `stepIdx` 決定渲染哪幾顆。
- 注意：simulation mode 已用 simStepIndex 自然有前後，照舊。

### M-015: 全站「回首頁」改 icon ⌂ (ph-house)
- 設計規範：
  - 統一 selector class：`.btn-home-icon`（沿用 NSM 現有的 `.btn-icon` pattern）。
  - HTML：`<button class="btn-home-icon" type="button" aria-label="回首頁" title="回首頁"><i class="ph ph-house"></i></button>`。
  - 尺寸：44×44 px（M-008 tap target token，這次先設 token，Wave B 全面套）。
  - 顏色：和 nav 其他 icon 一致。
- **必改清單**（9 處 CIRCLES + 1 處 NSM gate 修文字並 +1 處 NSM step 4 修 id）：
  - `app.js:2799` `circles-nav-home #circles-p1-home` → icon
  - `app.js:2828` 同款重複定義 → icon
  - `app.js:3261` `circles-gate-home`（內嵌樣式 link 風）→ icon
  - `app.js:3512` `circles-nav-home-btn #circles-p2-home` → icon
  - `app.js:3913 / 3918 / 3923` `circles-score-home` (3 條件分支) → icon
  - `app.js:3940` `circles-score-home-btn` → icon
  - `app.js:4135` `circles-final-home` → icon
  - `app.js:5856` NSM step 4 `btn-nsm-back` 但實為 home → 改 id 為 `btn-nsm-home-nav`，並補一顆「← 返回上一步」（MASTER-015 原 spec：step 4 應同時有 back + home）。
  - `app.js:5969` NSM gate sub-tab icon+text → 改純 icon。
- **位移驗證**：每個 viewport（8 個）截圖 before/after 比對，bbox 差異 ≤ 2px 才算 OK。截圖落 `audit/cycles/2026-04-30/screenshots/m-015-verify/`。
- **互動驗證**：每處 click 後跑既有 home 流程（CIRCLES 清 session → 回 `/`；NSM 清 NSM state → 回 NSM step 1）。

### M-019: Phase-4 sub-tabs RWD（B 等寬案）
- 移除 `_isDesktopP1` 對 `s-step-tab` 的 gate（line 2783 附近）。
- mobile/iPad CSS：`.s-step-tab-row { display: grid; grid-template-columns: 1fr 1fr; }`，每個 tab `min-height: 44px`。
- desktop 維持 inline-flex（`grid-template-columns: auto auto` 或保留現行 layout）。
- **全站掃描**：grep `_isDesktopP1` 所有用法，看還有哪些 UI 在 mobile 被隱藏了 — 列出後 director 決定是否同波修。

### M-020: Phase-4 PNG export（A 主行動置右）
- 在 `renderCirclesFinalReport` submit bar 末位加：
  - `<button class="circles-btn-secondary" id="btn-export-png" type="button">⬇ 匯出 PNG</button>`
  - 排序：`再做一題` (ghost) ‖ `匯出 PNG` (secondary) `回首頁(icon)` (primary→icon)
- handler：dynamic-import `https://esm.sh/html2canvas@1.4.1`，capture `.circles-final-report`，`a.download` PNG。
- 失敗：`console.warn`，toast「PNG 匯出失敗，請截圖」。

### M-021: offcanvas spinner
- offcanvas open handler：先 render `<div class="offcanvas-loading"><div class="spinner"></div><p>載入練習記錄中…</p></div>`。
- await fetch；resolve 後 `replaceChildren(...)` render list 或 empty state。
- reject：「載入失敗，請稍後再試」+ retry button。
- **全站掃描**：grep `loadOffcanvasSessions` / `loadHistory` / 所有 list-render race 套同模式。
- 注意 jest mock 不要被打到（A4 之前在這條路上動了 `.maybeSingle`）。

## 測試決策（director 規定）

每個 fix agent 必須：
1. **TDD 紅燈先建** — spec 落 `tests/playwright/journeys/audit/master-NN-*.spec.js` 或 jest test。確認紅燈才能寫 fix。
2. **systematic-debugging** — 改前先 grep + 讀程式上下文 50 行，**寫一段 root cause 分析**到 PR description。
3. **全站掃描** — 上面清單裡的 grep 一定要跑，截結果貼回報告。
4. **verification-before-completion** — 跑：
   - 該項自己的 spec
   - `audit-master.spec.js` 全套（8 viewport）
   - `rwd-visual-gate.spec.js`（不可退化）
   - `npm test`（jest 104 baseline）
5. **commit message** 繁中，格式：`fix(scope): MASTER-NN <一句話> + 全站掃描說明`。
6. **回報** SHA + 各測試 pass/fail 數字 + 全站掃描結果摘要。

## 五個 fix agent 的工作分配（worktree 隔離）

| Agent | Scope | 主要檔案 |
|---|---|---|
| fix-A1 | M-001 | `app.js` (handler) |
| fix-A2 | M-006 + M-009 | `style.css` |
| fix-A3 | M-011 + M-012 | `app.js` (autosave + drill submit bar) |
| **fix-A4** | **M-015 全站 icon 化 + M-021 offcanvas spinner** | `app.js` + `style.css` |
| fix-A5 | M-019 + M-020 | `app.js` + `style.css` |

**M-010 不在任何 agent 工作範圍內**（駁回維持原設計）。

## 完工門檻
- audit-master 8 viewport 全綠
- rwd-visual-gate 不退化
- jest 104 全綠
- 每項修復都附 before/after 截圖至少 2 viewport (Mobile-360 + Desktop-1280)
- M-015 必須全 9+1+1 處改完，否則 PR 不收

## 後續

Wave A 全綠後進 Wave B（M-002 / M-003 / M-004 / M-005 / M-008 / M-013 / M-014），那批是 UI/UX 重設計，要再走一輪 brainstorming + 視覺伴侶。
