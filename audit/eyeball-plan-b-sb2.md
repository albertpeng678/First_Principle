# Plan B SB2 — Director eyeball walk

> CIRCLES Home 收尾（mockup 01 完整契約）— sonnet 4.6 implementer + opus 4.7 cold review。
> 走 spec §0.5 Layer 6 + §6.2 4 樣產出。

## 證據

1. **jest log**：140 + 17 skip = **157/157**（不 regression）
2. **Playwright log**：`tests/visual/circles-home.spec.js` 18 tests × 3 viewport = **54/54**（Mobile-360 / iPad / Desktop-1280）
3. **Regression log**：`tests/visual/nsm-home.spec.js` 4/4 + `tests/visual/offcanvas.spec.js` 5/5 = **9/9** Desktop-1280
4. **本檔**：9 PNG（3 viewport × 3 state） Read + ≥ 1 句評論

## Cold review 抓出 2 個 layout bug

### Bug 1：drill-pill-row 在 desktop 沒隱藏（雙 drill-rail 顯示）

Implementer `renderDrillPillRow()` outer wrapper 是 mockup-verbatim `<div style="margin-bottom:var(--s-4);">` 無 class，但 hide CSS rule 用 `.drill-pill-row` selector → 不 match → desktop 同時顯示 drill-rail aside（左 200px）+ drill-pill-row（中央橫排）。

**Fix**（`public/app.js`）：outer wrapper 加 `.drill-pill-row` class（保留 inline style，純加 CSS hook）：
```js
return '<div class="drill-pill-row" style="margin-bottom:var(--s-4);">'
```

### Bug 2：drill-rail aside 在 mobile/tablet 沒隱藏（雙 drill-rail 顯示）

`.drill-rail` aside 是 desktop grid 專屬（`.home--desktop` 啟用 `200px 1fr 220px`），但 mobile/tablet 的 `.home` 是 block layout，`.drill-rail` 仍當 normal block 顯出 → mobile/tablet drill mode 同時顯 drill-rail aside + drill-pill-row。同樣 recent-rail 在 mobile/tablet 也應該隱（per scope: mobile/tablet history 走 offcanvas）。

**Fix**（`public/style.css`）：
```css
@media (max-width: 1023px) { .drill-rail { display: none; } }
@media (max-width: 1023px) { .recent-rail { display: none; } }
```

## PNG eyeball walk（9 張全 Read）

### Default state（simulation mode）

- **`/tmp/sb2-default-mobile-360.png`**：navbar tabs 隱（@480px）/ stats 12·3·5 / qa-row 開 / mode-card body 短版「7 步循序練習」「單練 C / I / R」(mockup line 833 / 837) / search / type-tabs / 5 qcard / reshuffle / nsm-promo — recent-rail 已隱 ✓
- **`/tmp/sb2-default-tablet-768.png`**：navbar 含 tabs / stats 帶 hint「已完成 12 / 100 題」/ mode-card 仍短版（768px < 1024 desktop breakpoint）/ recent-rail 已隱 ✓
- **`/tmp/sb2-default-desktop-1280.png`**：home grid 啟用 / mode-card body **長版**「7 步循序（C → I → R → C → L → E → S）。可隨時上一步 / 下一步調整。最完整的訓練。」+「單練 C / I / R 三步任一。專注練好其中一步。該步結束即整 session 完成。」(mockup line 1020 / 1024) ✓ / recent-rail 顯「最近練習 / 看全部 →」+「尚無近期練習」placeholder ✓

### Drill mode

- **`/tmp/sb2-drill-mobile-360.png`**：drill-pill-row 顯「練習步驟 / C 澄清 / I 用戶 / R 需求」(mockup line 1148-1158) + drill-rail__lock「C2 / L / E / S 需在完整模擬中練習」/ drill-rail aside 已隱 ✓
- **`/tmp/sb2-drill-tablet-768.png`**：同 mobile，pill row 中央顯，drill-rail aside 已隱 ✓
- **`/tmp/sb2-drill-desktop-1280.png`**：drill-rail aside（左 200px）「練習步驟 / C 澄清情境 (active) / I 定義用戶 / R 發掘需求 + ph-lock-simple lock」(mockup line 1293-1304) ✓ / drill-pill-row 已隱 / mode-tag「步驟練」drill variant 在 5 qcard ✓

### qcard expanded（mockup line 1801-1836）

- **`/tmp/sb2-expanded-mobile-360.png`**：qcard 01 Uber · Uber Rides is-expanded（navy 邊）+ 完整題目 section-label + qcard__full-statement / 深入分析 即將顯（在折線下需 scroll）
- **`/tmp/sb2-expanded-tablet-768.png`**：Spotify · Spotify Wrapped is-expanded / 完整題目 + qcard__full-statement「設計一個新的活動或功能，讓 Spotify Wrapped 更具互動性和分享性。」/ 深入分析 + 商業背景 ana-block 顯（ph-buildings + 600 weight head）/ ✓ 對齊 mockup line 1801-1836
- **`/tmp/sb2-expanded-desktop-1280.png`**：Shopee · Shopee Live is-expanded + 完整題目 + 深入分析 section-labels（navy 24px bar prefix）✓

## iOS Safari 15-item 靜檢

| # | 結果 |
|---|---|
| 1 100dvh | N/A 不動 dvh |
| 2 safe-area | N/A 無 sticky 底部 bar |
| 3 input 16px | ✓ search-wrap input 全域 `font-size: 16px` |
| 4 tap-highlight | ✓ |
| 5 GPU 動畫 | N/A 無新動畫 |
| 6 Sticky | N/A |
| 7 Momentum | ✓ |
| 8 鍵盤 | search-wrap focus 不破 layout |
| 9 Modal/focus trap | N/A home 不開 modal（offcanvas 是 Plan D） |
| 10 FOUC | ✓ render() innerHTML 一次切 |
| 11 Touch target ≥ 44px | drill-pill / qcard__btn / mode-card / type-tab 全 ≥ 44px |
| 12 Long content | qcard__full-statement `max-width: 64ch` 不爆版 / ana-block__body `word-break: break-word` |
| 13 backdrop-filter | N/A |
| 14 60fps | qcard expand toggle 重 render 整頁、5 卡量小 |
| 15 layout thrashing | render() innerHTML 一次切，無漸進 reflow |

## 結論

Plan B SB2 cold review 通過。2 bug 修完後 9 PNG 全對齊 mockup 01 contract。可進 main agent merge + push。

## Carry-forward（無）

SB2 收尾完整，B SB1 留下的 4 條 carry-forward 全部 close。Plan B 後續 SB3+ 進 Phase 1 Form（mockup 03）等。
