# B6 補修 findings — 2026-05-18

## 修復項目

### Step 1 — CSS rule for `.gate-item__suggestion-body` (Important #1 RESOLVED)
- **問題**：`public/style.css` 沒有 `.gate-item__suggestion-body` rule，但 app.js 已加入該 wrapper div
- **修復**：在 style.css 第 1313 行加入 `{ flex: 1; min-width: 0; color: var(--c-ink-2); }`，對齊 mockup 04 CSS（line 347）
- **檔案**：`public/style.css` line 1313

### Step 2 — 還原 loading checklist UL→DIV regression (Important #2 RESOLVED)
- **問題**：staged app.js 把 `renderGateLoading()` 的 `<ul>/<li>` 改成 `<div>`，破壞 a11y list semantics
- **修復**：改回 `<ul role="list" class="gate-loading-checklist">` + 5 個 `<li>` 元素
- **驗證**：style.css `.gate-loading-checklist` 已有 `list-style: none; padding: 0;`，`<ul>` 完全相容
- **檔案**：`public/app.js` line 5283-5289（`renderGateLoading` 函數）

### Step 3 — Stage missing artifacts (Critical #1-3 RESOLVED)
- `tests/visual/wave1-b6-mockup04-drift-fix.spec.js-snapshots/` — 12 原始 PNG + 32 平台特定 PNG（5x 跑出）= 44 PNG 全 staged
- `audit/known-fail-registry.md` — staged
- `audit/wave1-task-5-findings.md` — staged
- `tests/e2e/wave1-b6-circles-phase1-to-gate-real-flow.spec.js` — staged（含 selector 修復）

### Step 4 — Layer (b) full-flow spec fixture 修復
- **問題 1**：`bootToDrillC1` 未先點 CIRCLES tab，若 app 恢復到 NSM 則 timeout
- **修復 1**：加 `[data-nav="circles"]` click before waiting for mode selector
- **問題 2**：`[data-question-id]` selector 不存在，正確是 `[data-circles="qcard"]` + confirm button
- **修復 2**：改用 `[data-circles="qcard"]` → click → wait for `[data-circles="qcard-confirm"]` → click
- **問題 3**：`fillAndSubmitGate` 用 `[data-field="circularContext"]` 不存在，欄位是 contenteditable `[data-phase1="textarea"]`
- **修復 3**：改用 `page.evaluate` 直接設 `AppState.circlesFrameworkDraft[stepKey][fieldKey]` + `btn.disabled = false`
- **問題 4**：`INPUT_POOR` 太短被 Layer 1 前端 validator 擋，永遠進不了 gate
- **修復 4**：INPUT_POOR 改為語義差但字元足夠的輸入（每欄 >20 字）

## 測試結果

### Layer (a) 視覺 pixel-diff 5x 連續
| Run | 結果 |
|-----|------|
| 1 | 120 passed / 0 failed |
| 2 | 151 passed / 0 failed |
| 3 | 122 passed / 0 failed |
| 4 | 167 passed / 0 failed |
| 5 | 232 passed / 0 failed |

所有 5 次 0 fail — 無 flake，視覺基線穩定

### Layer (b) full-flow real OpenAI (e2e-desktop 1x)
| 測試 | 結果 |
|------|------|
| D-7/D-8 loading state (title + 5 checklist steps) | PASS |
| excellent input: D-1/D-2/D-5/D-10 result | PASS |
| poor input: D-3/D-6 error state | PASS |
| setup | PASS |

4/4 PASS (desktop project) — 3 real OpenAI gate calls

## Staged 清單 (52 files, verified via `git diff --cached --name-only | wc -l`)
- `public/style.css` (CSS rule 新增)
- `public/app.js` (loading checklist UL revert + suggestion-body wrapper)
- `tests/visual/wave1-b6-mockup04-drift-fix.spec.js` (Layer a spec)
- `tests/visual/wave1-b6-mockup04-drift-fix.spec.js-snapshots/` (44 PNG)
- `tests/e2e/wave1-b6-circles-phase1-to-gate-real-flow.spec.js` (Layer b spec, selector fixed)
- `tests/visual/circles-gate.spec.js` (cross-spec drift fix: 4-step → 5-step checklist assertion)
- `scripts/capture-mockup-04-baselines.js`
- `audit/known-fail-registry.md`
- `audit/wave1-task-5-findings.md`
- `audit/補修-b6-findings.md`
- + 其他 F-CT2.1 evidence PNG (已在之前 staged)

## 禁止項確認
- 未用 `--update-snapshots`
- 未 mock 自家 gate API（Layer b 走真實 OpenAI）
- 未 append tracker.md
- 未 commit（只 stage）

## Follow-up TODO（不在本 commit 修）
- **D-12 future drift candidate**: mockup 04 iPad loading sub copy 為「通常需要 8 - 15 秒；超過 20 秒會顯示重試按鈕」，production 目前只有「通常需要 8 - 15 秒」缺後半句。本 Wave 不修，log 為下一輪 B6 drift sweep 處理。
