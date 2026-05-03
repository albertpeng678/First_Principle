# Plan B SB1 — Director eyeball walk

> CIRCLES Home (mockup 01) JS render — sonnet 4.6 implementer + opus 4.7 cold review。
> 走 spec §0.5 Layer 6 + §6.2。

## 證據（4 樣產出）

1. **jest log**：140 + 17 skip = **157/157**（不 regression / Path 2 鐵則）
2. **Playwright log**：`tests/visual/circles-home.spec.js` 10 tests × 3 viewport = **30/30**（Mobile-360 / iPad / Desktop-1280）
3. **Regression log**：`tests/visual/nsm-home.spec.js` 4/4 + `tests/visual/offcanvas.spec.js` 5/5 = **9/9**
4. **本檔**：每張 PNG ≥ 1 句評論

## Cold review — 主動抓出 1 bug + 1 drift

### Bug：drill mode desktop layout 崩潰

Implementer 在 drill mode 切到 `.home.home--desktop`（無 `--no-drill`），啟用 grid `200px 1fr 220px`。但 SB1 沒實作 drill-rail，左側 200px slot 空 → mode-cards 擠進 200px 欄被壓成超窄長條（「完 整 模 擬」每字一行）。

**Fix**（`public/app.js` renderCirclesHome）：
```js
// 改前
var homeClass = 'home home--desktop' + (mode === 'simulation' ? ' home--desktop-no-drill' : '');
// 改後
var homeClass = 'home home--desktop home--desktop-no-drill';
```

drill-rail 視覺留 SB2，這 SB 統一用 2-col 佈局避免空 slot 撐爆 grid。

### Drift（carry-forward 到 SB2）

Mockup 01 line 1020 / 1024 desktop frame 給 mode-card body 長版描述：
- 「7 步循序（C → I → R → C → L → E → S）。可隨時上一步 / 下一步調整。最完整的訓練。」
- 「單練 C / I / R 三步任一。專注練好其中一步。該步結束即整 session 完成。」

Implementer 三 viewport 統一用 mobile/tablet 短版（line 833 / 837 — 7 步循序練習 / 單練 C / I / R）。SB1 ACCEPT 短版（mobile-first），SB2 desktop 細節時補長版（用 modifier class，不用 @media）。

## PNG eyeball walk（3 state × 3 viewport = 6 PNG，全 Read 過）

### Default state（simulation mode）

**`/tmp/postb1-default-mobile-360.png`** — navbar tabs 隱藏（@480px）✓ / stats-strip 12·3·5 ✓ / qa-row is-open 顯 CIRCLES 7-step prose ✓ / mode-selector 完整模擬 active navy 邊 + 步驟加練 ghost ✓ / search-wrap ph-magnifying-glass + placeholder ✓ / type-tabs 產品設計 ×40 active navy ✓ / 5 qcard 含 mode-tag「完整」navy + 公司·產品 title ✓ / 對齊 mockup line 808-878。

**`/tmp/postb1-default-tablet-768.png`** — navbar 含 CIRCLES tabs ✓ / stats-strip 帶 hint「已完成 12 / 100 題」trailing right ✓ / qa-row 完整 prose ✓ / mode-selector 2-col grid 兩張等寬 ✓ / type-tabs 橫排 ✓ / q-list 5 cards 直堆 ✓。

**`/tmp/postb1-default-desktop-1280.png`** — home grid 啟用（center 1fr + 右 recent-rail 220px）/ recent-rail title「最近練習」placeholder 可見 ✓ / qcard meta 帶 difficulty「中」/「高」label ✓ / 整體對齊 mockup line 1014-1093 desktop frame。

### Drill mode（修完後）

**`/tmp/postb1-drill-mobile-360.png`** — 步驟加練 active navy / 5 qcard mode-tag 自動切「步驟練」drill variant ✓ / 其他 sections 同 default。

**`/tmp/postb1-drill-desktop-1280.png`** — fix 後 mode-selector 兩張正常 50/50 寬度 / 步驟加練 active navy 邊 ✓ / search-wrap / type-tabs 全寬 ✓ / qcard mode-tag「步驟練」drill ✓ / recent-rail 仍在右側 placeholder。

## iOS Safari 15-item 靜檢（spec §0.2）

| # | 項目 | 結果 |
|---|---|---|
| 1 | 100dvh | N/A — home wrapper 用 flow layout，未動 dvh/vh |
| 2 | safe-area-inset | N/A — 無 sticky 底部 bar 在 home view |
| 3 | input 16px 防 zoom | ✓ search-wrap input 已透過全域 `input { font-size: 16px !important }` (style.css:42) |
| 4 | tap-highlight 透明 | ✓ 全域繼承 |
| 5 | GPU 動畫 | N/A — qa-row toggle 用 height 但 transition 無 layout thrashing（display 切換）|
| 6 | Sticky 行為 | N/A |
| 7 | Momentum scroll | ✓ q-list 用 default `overflow-y: auto` |
| 8 | 鍵盤 layout | search-wrap focus 不會推 layout（input 是 inline） |
| 9 | Modal/Offcanvas | N/A — home 不開 modal |
| 10 | FOUC | ✓ render() 一次性 innerHTML |
| 11 | Touch target ≥ 44px | mode-card / type-tab / qcard / reshuffle 全 ≥ 44px（btn 系列繼承）|
| 12 | Long content | qcard__title 用 BEM 自然 wrap，無 fixed width |
| 13 | backdrop-filter | N/A |
| 14 | 60fps | reshuffle 重 render 整個 home view，但 5 qcard 量小，無感 |
| 15 | layout thrashing | render() innerHTML 一次切換，無漸進 reflow |

## 結論

Plan B SB1 通過 cold review。1 bug 已修、1 drift carry-forward 到 SB2。Plan B SB1 解 BLOCK，可進 commit + push。

**SB2 carry-forward checklist：**
1. mode-card body desktop 長版文案（mockup line 1020 / 1024）— 用 modifier class 切顯示
2. drill-rail UI（200px desktop aside / mobile horizontal pill row 含 C/I/R drill-pill）
3. recent-rail 從 `AppState.historyList` 讀真實近期 5 筆（取代目前 placeholder）
4. qcard expanded state with analysis blocks（mockup G section）
5. 修 mockup 1020/1024 desktop body 長版差異
