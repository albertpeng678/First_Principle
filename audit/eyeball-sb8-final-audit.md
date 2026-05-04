# Plan B SB8 — Final Audit Eyeball Walk

**Date:** 2026-05-04
**Scope:** Phase 1 form 全 7 步（C1/I/R/C2/L/E/S）× 3 viewport（mobile-360 / tablet-768 / desktop-1280）= 21 PNG vs mockup 03 line-by-line audit
**Captures:** `/tmp/sb8-audit/{vp}-{step}.png`

## Drift 列表（修完）

### Drift 1 — L 步 sol-card 在 tablet+ 隱藏「核心機制」label
- **Mockup 規格:** 03-phase-1-form.html line 1260, 1283 明定 `<label class="field__label">核心機制</label>`
- **Production drift:** `style.css` line 880 `.sol-card--l .field__label { display: none }` tablet+ 隱藏
- **原因:** 我自作主張認為 sol-name input 上方 label 多餘
- **Fix:** 移除整段 `.sol-card--l` CSS rule，三 viewport 都顯示 label
- **驗證:** click-driven Playwright `.sol-card .field__label` count=2（每張 sol-card 1 個 label），texts=[核心機制|核心機制]

### 非 drift 觀察（mockup-by-design）
- **mobile-360 progress bar 第 7 個 pill「S 總結」需 scroll-x:** mockup line 226 `overflow-x: auto` 是 by design — scrollWidth 427 > viewport 360
- **mobile-360 S 步主 fields rt-toolbar 只 1 button（B）:** mockup line 1493 規格如此，CSS `.rt-field__toolbar--s .rt-tbtn:nth-child(2) { display: none }` mobile-only

## 7 步 × 3 viewport eyeball walk（Read PNG）

| Step | mobile-360 | tablet-768 | desktop-1280 |
|---|---|---|---|
| C1 | ✓ phase-head 01 / qchip / 4 fields / 上一步+下一步 | ✓ 7 progress pills / phase-head meta full | ✓ rail「C 步重點」單格 |
| I  | ✓ 4 fields（目標分群 / 焦點 / JTBD / 排除） | ✓ | ✓ rail「I 步重點」 |
| R  | ✓ 4 fields（功能性 / 情感性 / 社交性 / 核心痛點） | ✓ | ✓ rail「R 步重點」+ railIntro 三層需求框架 |
| C2 | ✓ 4 fields（取捨標準 / 最優先 / 暫緩 / 排序理由） | ✓ | ✓ rail「C 步重點」+ railIntro 顯性化取捨邏輯 |
| L  | ✓ 2 sol-cards 含 label「核心機制」 | ✓ fix 後 label visible | ✓ fix 後 label visible + rail「L 步重點」 |
| E  | ✓ 2 sol-cards × 4 nested labels（優點/缺點/風險/成功指標） | ✓ | ✓ rail「E 步重點」 |
| S  | ✓ 3 main fields + 4 tracking-cards 各自 hint+example | ✓ dynamic dim labels per product type | ✓ rail「S 步重點」+ phase-head 含 NSM 與 4 追蹤維度 suffix |

## boundingBox invariants

- `progress` overflow-x:auto on mobile-360（scrollWidth 427 > clientWidth 360）— mockup-faithful
- `.sol-card--l` modifier removed → labels show three-viewport
- `.rt-field__toolbar--s` mobile hide nth-child(2) → S step main field 1 button on mobile

## Tests / regression

- jest: 157/157（140 pass + 17 skip / no regression）
- Playwright Mobile-360 / iPad / Desktop-1280 phase1-form/l/e/s/hint-modal/example-expand: 165/165 全綠
