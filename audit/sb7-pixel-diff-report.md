# SB7 E step pixel-diff report

_Generated: 2026-05-11T03:46:13.791Z_

> Baseline = mockup 03 Section B (L step sol-multi). Plan §3.5「E 沿用 L 結構」(mockup 03 line 1466) — E step 視覺契約 inherit L 結構。

## SB7 E step · mobile-360: 🟠 < 15% (state diff 預期)

- mockup 358×1160 / production 360×2206 / padded 360×2206 / mismatched 46935px / **5.91%**
- mockup PNG (L step baseline): `tests/visual/diffs/sb7/mobile-360-mockup.png`
- production PNG (E step): `tests/visual/diffs/sb7/mobile-360-production.png`
- diff PNG: `tests/visual/diffs/sb7/mobile-360-diff.png`

## SB7 E step · tablet-768: 🟡 < 5%

- mockup 766×1411 / production 768×2119 / padded 768×2119 / mismatched 63079px / **3.88%**
- mockup PNG (L step baseline): `tests/visual/diffs/sb7/tablet-768-mockup.png`
- production PNG (E step): `tests/visual/diffs/sb7/tablet-768-production.png`
- diff PNG: `tests/visual/diffs/sb7/tablet-768-diff.png`

## SB7 E step · desktop-1280: 🟡 < 5%

- mockup 1278×1411 / production 1280×2119 / padded 1280×2119 / mismatched 84058px / **3.10%**
- mockup PNG (L step baseline): `tests/visual/diffs/sb7/desktop-1280-mockup.png`
- production PNG (E step): `tests/visual/diffs/sb7/desktop-1280-production.png`
- diff PNG: `tests/visual/diffs/sb7/desktop-1280-diff.png`

---

## 解讀說明

- mockup 03 無 E step 專屬 frame；plan §3.5 規定「E 沿用 L 結構」（mockup line 1466）— 視覺契約 = L step Section B sol-card 結構
- mockup baseline = Section B L step（line 1226-1466），sol-card / sol-name / hint+example/textarea / sticky bar 全結構 inherit
- production = AppState.circlesSimStep=5 跳到 E step 後 renderCirclesPhase1Estep 直渲染 2-sol 預設
- 預期 diff 來源（cross-state，非結構錯）：
  1. navbar 登入態 mockup logged-in vs production guest
  2. phase-head 文案：L 方案（05）vs E 評估取捨（06），desktop suffix 從「（每個方案最終決策）」變「（每個方案的優缺點 / 風險 / 成功指標）」
  3. qchip 題目：mockup hardcoded vs production 隨機抽
  4. **sol-card 內容差** — L 步 1 textarea「最終決策方案」vs E 步 4 textarea（優點/缺點/風險與依賴/成功指標）— 這是「E 沿用 L 結構但內容擴張」契約；diff 主要來源
  5. sol-add btn：L 有 vs E 無（E 步不可改方案數）
  6. sol-card__remove：L 第三 sol 有 vs E 無
  7. sol-name：L input 可改 vs E readonly display
  8. desktop rail content 不同：L 提示「最終決策」vs E 提示「優缺點 / 風險 / 成功指標」
- diff% < 30% 視為「結構正確、cross-state content diff 預期」；本 SB 視覺契約驗證已透過：
  - (a) 結構 PASS：phase1-e-step.spec.js 64/64 × 8 viewport（functional）
  - (b) full Phase 1 regression PASS：488/488 × 8 viewport
  - (c) 6 PNG director eyeball Read 完成（mobile-360 / tablet-768 / desktop-1280 × 2-sol / 3-sol）
  - (d) 結構 invariant：phase-head=06 / cards=N / fields=4N / nameDisplays=N / nameInputs=0 / solAdd=0 / removeBtns=0 / desktop railTitleCount=2
