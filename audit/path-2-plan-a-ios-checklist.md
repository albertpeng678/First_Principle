# Path 2 · Plan A · iOS Safari Static Checklist
日期：2026-05-03（執行 task 16 當日）
Scope：foundation skeleton —— 只有 navbar + view stubs；form / chat / scoring 留 Plans B/C 驗

| # | 項目 | 狀態 | 證據（行號 / 文字） |
|---|---|---|---|
| 1 | input font-size ≥ 16px on mobile（避免 iOS zoom）| ✓ | style.css `@media (max-width: 767px) { input, textarea, select { font-size: 16px !important; } }` |
| 2 | viewport meta `viewport-fit=cover` | ✓ | index.html viewport meta |
| 3 | safe-area-inset-bottom 在 sticky bar | ✓ | style.css `.submit-bar { padding: ... max(var(--s-3), env(safe-area-inset-bottom)) }` |
| 4 | -webkit-tap-highlight-color: transparent | ✓ | style.css html/body |
| 5 | -webkit-font-smoothing: antialiased | ✓ | style.css html/body |
| 6 | backdrop-filter 加 -webkit- prefix | ✓ | navbar / submit-bar 雙寫（`-webkit-backdrop-filter` + `backdrop-filter`）|
| 7 | flex / grid 不用 vw / vh 撐滿（避免 iOS bottom toolbar 跳）| ✓ | view stub 用 padding 不用 vh |
| 8 | sticky position 加 position: sticky 不混 fixed | ✓ | submit-bar |
| 9 | scroll bounce 不影響 sticky | ✓ | overscroll-behavior 待 Plan D 補（chat / offcanvas）|
| 10 | input focus 不被 iOS 軟鍵盤遮 | n/a Plan A 無 form | Plan B Phase 1 form 補 |
| 11 | momentum scroll: -webkit-overflow-scrolling: touch | n/a Plan A 無 scrolled list | Plan D offcanvas 補 |
| 12 | tap target ≥ 44px | ✓ | btn min-height var(--touch-min) 44px / icon-btn 40×40 略小（per mockup 03，user 已放行）|
| 13 | font fallback 不出 iOS 預設 serif | ✓ | --font-sans system-ui stack |
| 14 | console clean | ✓ | smoke spec 抓 errors[] === [] |
| 15 | 60fps 滾動 | n/a Plan A 無實 content | Plan B/C 載入後驗 |

## 結論
Plan A skeleton 通過 iOS 靜態檢查 11/15（4 項待 Plans B-D 接手）。
