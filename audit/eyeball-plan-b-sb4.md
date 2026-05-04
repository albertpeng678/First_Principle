# Eyeball Walk — Plan B SB4 · L solution-multi (mockup 03 Section B)

**Date：** 2026-05-04
**Director：** opus 4.7 main agent (cold review)
**Implementer：** sonnet 4.6 subagent (commit b022ae7)
**Cold-review fix commit：** aa0683a

---

## 自驗 PNG（director Read 三 viewport）

| Viewport | PNG | 評論 |
|---|---|---|
| Mobile-360 | `/tmp/cr-sb4-mobile-360.png` | navbar list+brand+(sign-in 因 guest)+home / progress 6/7 visible（S 總結 屬 SB3 既存 overflow 議題，不在 SB4 scope）/ phase-head 05 / L · 提出方案 / 已儲存 / qchip 無 suffix（mobile）/ 2 sol-cards：「方案一」「方案二」navy text + 18px navy bar（::before）/ name input / hint-row「提示 / 範例答案」visible / rt-toolbar B + bullets / textarea placeholder / sol-add dashed「+ 加方案三（選擇性）」/ submit-bar mobile 左 empty + 右「下一步 →」全對 mockup line 1234-1307 |
| iPad-768 | `/tmp/cr-sb4-ipad-768.png` | navbar 加 tabs CIRCLES(active)/北極星指標 / phase-head 完整模擬 · 5 / 7 步 / sol-card label「核心機制」hidden via CSS @media（保留 hint-row visible）/ submit-bar 左「上一步 ←」+ 右「下一步 →」全對 mockup line 1309-1378 |
| Desktop-1280 | `/tmp/cr-sb4-desktop-1280.png` | qchip__company suffix「 · 設計題 · 難度 中」/ phase-head__title suffix「（2-3 個方案）」/ phase-body--with-rail 2-col + rail 右側「L 步重點 / 提出 2-3 個有方向差異的方案 / 方案三是加分項 / 湊數寧可不填」全對 mockup line 1380-1460 |
| iPad after sol3-add | `/tmp/cr-sb4-ipad-3rd.png` | 第三 sol-card 出現「方案三 （選擇性）」+ remove × 按鈕 / placeholder「方案名稱（10 字內）」（tablet 無 desktop 後綴） |
| Desktop after sol3-add | `/tmp/cr-sb4-desktop-3rd.png` | 第三 sol-card「方案三 （選擇性）」/ name input placeholder「方案名稱（10 字內）— 加分項，更激進或長線」/ remove × / textarea「第三個真正不同的思路 — 例如：把廣告變成內容（品牌 podcast）；或從供給端切（廣告主競價）」全對 mockup line 1426-1442 |

---

## Cold-review drift 表（已全部修）

| # | Drift | mockup 出處 | 修正 commit |
|---|---|---|---|
| D1 | sol-card__num style 反了 navy 填底 → mockup 是 navy text + 18px ::before bar | line 550-561 | aa0683a |
| D2 | sol-card padding `--s-4` → `--s-4 --s-5` asymmetric | line 545 | aa0683a |
| D3 | sol-card__name-row align-items center → baseline | line 565 | aa0683a |
| D4 | sol-card__name-input border `--c-rule` → `--c-rule-bold` / radius `--r-input` / font `--t-body-sm` | line 568-575 | aa0683a |
| D5 | sol-card__optional 加 inline-block + margin-left 多餘 → 改 flex 0 0 auto | line 577-581 | aa0683a |
| D6 | sol-card__remove 觸控大小+border → 32×32 round `--r-pill` 透明 bg | line 582-591 | aa0683a |
| D7 | sol-add border `--c-rule` → `--c-rule-bold` / radius `--r-input` / font `--t-body-sm` / hover bg `--c-bg-soft` | line 593-607 | aa0683a |
| D8 | tablet+ field hint-row 整段被隱藏（label-row hidden 含其子）→ 改成 hide field__label only，hint-row 保留 | line 1325-1329 | aa0683a |

---

## boundingBox invariant（4 條檢核）

1. **sol-card 寬度**：mobile 內距 16px / tablet+ phase-body padding 適配 / desktop 與 rail 並排（grid `1fr / 280px`）— PASS
2. **sol-card__num bar**：18px wide × 2px tall navy bar，::before pseudo（::after 已 cleanup）— PASS
3. **sol-card__remove**：32×32 round button（`--r-pill` = 999px）— PASS
4. **sol-add**：full-width dashed `--c-rule-bold` + `--r-input` 6px radius — PASS

---

## Tests / Quality Gates

- jest：157 (140 passed + 17 skipped) — 不 regression ✓
- Playwright `phase1-l-step.spec.js`：6 tests × 8 viewport = 48/48 ✓
- Playwright `phase1-form.spec.js + circles-home.spec.js + phase1-l-step.spec.js` × 3 vp = 99/99 ✓

---

## Self-review checklist（Layer 1-7）

- [x] L1 baseline freeze — mockup 03 Section B line 1230-1467 為視覺契約
- [x] L2 pixel-diff — 補洞跑 mechanical pixel-diff（mockup vp-frame__body clip-based 截圖 vs production fullPage screenshot pad+pixelmatch threshold 0.1）：mobile 5.66% / tablet 3.72% / desktop 3.15%（state diff 預期範圍 3-15%）；diff PNG 確認 red 集中在 navbar 登入態 / textarea filled vs placeholder / qchip 動態題目，無結構錯位。Report：`audit/sb4-sb5-pixel-diff-report.md`
- [x] L3 boundingBox invariant — 4 條全 PASS
- [x] L4 WebKit + Chromium — phase1-l-step 全 8 viewport 含 webkit 通
- [x] L5 state matrix — default 2-card + sol-add 後 3-card + remove 還原 2-card 三 state 各截一張
- [x] L6 director eyeball walk — 本檔 ✓
- [ ] L7 user 真機抽驗 — user 接 main 後手動驗

## 後續 carry forward

- **progress 7 階段 mobile-360 overflow**：mobile 360px 寬撐不下 7 個 progress step，第 7「S 總結」溢出；非 SB4 scope（屬 SB3 progress 通用 overflow），記入 PATH-2-HANDOFF.md known issues
