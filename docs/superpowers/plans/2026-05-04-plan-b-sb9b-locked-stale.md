# Plan B SB9b — Locked / Stale / Save-error 變體

> Mockup: `docs/superpowers/specs/mockups/2026-05-02-frontend-rewrite/03-phase-1-form.html` Section E line 1953-2106
> Backend: 後端不動 — 純前端 state-driven render（AppState.circlesLocked / circlesStale / circlesPhase1SaveState）

## Goal

Phase 1 form 三種狀態變體 visual 對齊 mockup Section E：
- **Locked（已評分鎖定）** — banner--locked navy + lock-key icon + 「已評分鎖定·76/100」+ rt-field 全 disabled + 「看評分結果」CTA
- **Stale（題庫已更新）** — banner--stale red + warning-octagon icon + 「題庫已更新」+ rt-field disabled + 「用最新題目重練」CTA
- **Save error（離線）** — banner--save-error danger + cloud-warning icon + 「離線中·已存於本機」+ rt-field NOT disabled（user 仍可改草稿）+ 「下一步（請先恢復連線）」disabled CTA

## Architecture

`applyPhase1StateOverlay(html)` post-render transform：
- 讀 AppState.circlesLocked / circlesStale / circlesPhase1SaveState='error'
- inject banner before phase-body / submit-bar
- locked + stale: `class="rt-field"` → `+ rt-field--locked` / `contenteditable="true"` → `false` / sol-card name input + S tracking input → readonly
- submit-bar primary CTA 字串替換對應狀態
- 4 個 phase-1 renderer return 都 wrap：base / Lstep / Estep / Sstep

避免污染 4 個 renderer 內部 — 用 string transform 一次解決。

## Files

- Modify `public/style.css`: 加 `.banner--save-error` + `.rt-field--locked` rules
- Modify `public/app.js`:
  - `renderLockedBanner(score)` / `renderStaleBanner()` / `renderSaveErrorBanner()` helpers
  - `applyPhase1StateOverlay(html)` post-process
  - 4 renderer return 加 wrap
- Test: `tests/visual/phase1-locked-stale.spec.js` 10 specs

## Tasks

- [x] T1: TDD spec red (8/10 fail before impl)
- [x] T2: CSS banner--save-error + rt-field--locked
- [x] T3: applyPhase1StateOverlay + 4 renderer wrap
- [x] T4: 9 PNG audit + commit + 3 docs
