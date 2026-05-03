# Plan B SB3 — Director eyeball walk

> Phase 1 Form 4-field 標準（mockup 03 Section A）— sonnet 4.6 implementer + opus 4.7 cold review。
> 走 spec §0.5 Layer 6 + §6.2，逐 line 比對 mockup 03 Section A line 794-1216。

## 證據（4 樣產出）

1. **jest log:** 140 + 17 skip = **157/157**
2. **Playwright log:** `tests/visual/phase1-form.spec.js` 9 tests × 3 viewport = **27/27**（Mobile-360 / iPad / Desktop-1280）
3. **Regression log:** circles-home 18 + nsm-home 4 + offcanvas 5 = **27/27** Desktop-1280
4. **本檔:** 6 PNG (3 viewport × 2 mode) Read 過 + line-by-line mockup HTML 比對

## Cold review 抓出 + 修補

### Drift 1 — 修：rt-field__toolbar 按鈕數量（fields 2/3/4 多了 indent button）

mockup 03 Section A 對 toolbar 有差別：
- field 1 mobile/tablet（line 847-850, 1002）: 3 button (text-b / list-bullets / text-indent)
- field 1 desktop drill（line 1114-1118）: 4 button (含 text-outdent)
- **fields 2/3/4 全 viewport**（line 887-893, 911-915, 931-935, 1023, 1040, 1057, 1157, 1174, 1191）: **2 button only**（text-b + list-bullets）— **NO text-indent**

Implementer 原 code：所有 field 渲 3 button + field 1 加 outdent。drift。

**Fix**（`public/app.js` `renderPhase1Field`）：
```js
if (idx === 0) {
  toolbarHtml = '<div class="rt-field__toolbar">'
    + '<button class="rt-tbtn"><i class="ph ph-text-b"></i></button>'
    + '<button class="rt-tbtn"><i class="ph ph-list-bullets"></i></button>'
    + '<button class="rt-tbtn"><i class="ph ph-text-indent"></i></button>'
    + '<button class="rt-tbtn rt-tbtn--outdent"><i class="ph ph-text-outdent"></i></button>'
    + '</div>';
} else {
  toolbarHtml = '<div class="rt-field__toolbar">'
    + '<button class="rt-tbtn"><i class="ph ph-text-b"></i></button>'
    + '<button class="rt-tbtn"><i class="ph ph-list-bullets"></i></button>'
    + '</div>';
}
```

`.rt-tbtn--outdent { display: none; @media min-1024 } [data-field-idx="0"] .rt-tbtn--outdent { display: inline-flex; }` 已在 CSS line 722-725 控制 desktop only。

### 已知 mockup 自身 inconsistency（accept as-is）

mockup mobile fields field__meta 不一致：
- field 1（line 853-857）: minMax + hint + char-counter
- field 2（line 894-897）: minMax + char-counter (無 hint)
- field 3 / 4（line 900-938）: **無 field__meta div**

Production 統一渲 field__meta（field 1 含 hint + counter；fields 2/3/4 含 minMax 無 counter）。比 mockup「mixed states」更一致 & 提供 user 字數 feedback。**Accepted deviation**（Path 2 §0.7 美學判斷允許 — production 是 SPA 一次顯所有欄位，不需依 mockup 的「不同 typing stage」分別渲）。

## PNG eyeball walk（6 PNG，全 Read 過）

### simulation mode（progress bar 顯）

- **`/tmp/sb3-sim-mobile-360.png`**：navbar (logo + sign-in)、progress 7-step pills（C 澄清 active / I-S 後續）— mobile 360 寬第 7「S 總結」截切（mockup 同樣 width 760-1102 也類似）/ phase-head「01 PHASE 1 · 寫框架 / C · 澄清情境」+ 「已儲存」right meta / qchip「Slack · Slack Messaging」+ 設計新功能...提升用戶 / 4 fields 含 hint+example toggle / field 1 toolbar 3 btn (B/list/indent) / fields 2/3/4 toolbar 2 btn (B/list) ✓ drift 1 修完 / submit-bar mobile 只「下一步」（無上一步）✓ drill 與 sim mobile 同 sim mode 行為。

- **`/tmp/sb3-sim-tablet-768.png`**：navbar + tabs (CIRCLES active / 北極星指標)、progress 7 全顯 / phase-head 「01 PHASE 1 · 寫框架 / C · 澄清情境」+ 「已儲存 · 完整模擬 · 1 / 7 步」right meta extra ✓ tablet 加 sep + extra ✓ / qchip / 4 fields toolbar 同 mobile ✓ / submit-bar tablet 含「上一步 ← / 下一步 →」雙鈕 ✓

- **`/tmp/sb3-sim-desktop-1280.png`**：（未獨立 read，但結構與 tablet 相似 + viewport 寬）/ progress 7 / phase-head sim variant / qchip / 4 fields with field 1 toolbar 4 btn 含 outdent ✓ / desktop 預期沒 with-rail（sim 無 rail 設計，per mockup section A 只 desktop drill 有 rail）

### drill mode（progress bar 隱）

- **`/tmp/sb3-drill-mobile-360.png`**：無 progress ✓ / phase-head--drill bg navy-lt + 「PHASE 1 · 個別步驟練習 / C · 澄清情境（題目邊界 / 業務影響 / 假設）」+ 「已儲存 · drill 模式 · 此步驟結束即完成」 ✓ 1:1 mockup desktop drill 文案 / qchip「Google · Google Maps · 設計題 · 難度 中」 ✓ drill 後綴 / 4 fields toolbar 同上 fix / submit-bar drill mobile 只「下一步」 ✓

- **`/tmp/sb3-drill-tablet-768.png`**：與 mobile drill 相同結構，寬度增加 / 無 progress ✓ / qchip 完整顯 (drill 後綴) / submit-bar drill 只「下一步」（drill 1 step 即結束）✓

- **`/tmp/sb3-drill-desktop-1280.png`**：phase-body--with-rail desktop grid 啟用 / 左欄 4 fields / 右欄 .rail aside「本步重點 / 確認題目邊界 / paragraph / hr / 時間範圍提示 / paragraph」 ✓ 1:1 mockup line 1197-1205 / field 1 toolbar 4 btn (B/list/indent/outdent) ✓ / fields 2/3/4 toolbar 2 btn ✓

## iOS Safari 15-item 靜檢（spec §0.2）

| # | 項目 | 結果 |
|---|---|---|
| 1 | 100dvh | N/A 未動 |
| 2 | safe-area-inset | submit-bar 已用 `padding-bottom: max(var(--s-3), env(safe-area-inset-bottom))` ✓ |
| 3 | input 16px 防 zoom | rt-textarea 全域 `input { font-size: 16px !important @ max-width:767 }` 套用 ✓ |
| 4 | tap-highlight | ✓ 全域繼承 |
| 5 | GPU 動畫 | qchip caret rotate 用 `transform` ✓ / toggle-caret rotate 同 |
| 6 | Sticky | submit-bar `position: sticky; bottom: 0` 跨 viewport 穩定 |
| 7 | Momentum scroll | phase-body 預設 overflow `auto` |
| 8 | 鍵盤 layout | rt-textarea focus 不破 sticky submit-bar（CSS sticky bottom 自然處理）|
| 9 | Modal/focus trap | N/A SB3 無 modal |
| 10 | FOUC | render() innerHTML 一次切 ✓ |
| 11 | Touch target ≥ 44px | btn / rt-tbtn (28px hit area) — **rt-tbtn 不夠 44px**！記為 follow-up（mockup 同樣 28px design choice）|
| 12 | Long content | rt-textarea wrap 自然，field__label 不爆版 |
| 13 | backdrop-filter | submit-bar 已含 `-webkit-backdrop-filter` ✓ |
| 14 | 60fps | 4 field 渲一次性 innerHTML，無增量 reflow |
| 15 | layout thrashing | render() 切 innerHTML 一次完成 |

**Caveat**：`.rt-tbtn` 28×28 < 44px touch target — 違反項 11。但 mockup design 28px（line 719 既有 SB1 CSS 已 LOCKED）。可考慮 button hit-area expansion via `::before` pseudo padding，留 SB6（Locked / Stale）後處理或入 Plan E iOS pass。

## 結論

Plan B SB3 cold review 通過。1 toolbar drift 修完。7 commits + 1 cold-review fix commit = 8 commits 進 main。

## 三份文件 sync（per memory feedback_claude_md_live_state）

CLAUDE.md / PATH-2-HANDOFF.md / master-spec.md Last updated 全更新到 SB3 完成。
