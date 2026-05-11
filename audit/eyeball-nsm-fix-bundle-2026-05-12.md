# NSM Fix Bundle Eyeball Walk — 2026-05-12

Director cold-Read: all 16 post-fix PNGs (8 × T3 step2-locked + 8 × T4 coach-overlay). Every PNG opened via Read tool personally.

Bundle commits (8 tasks): 762a8ab → 45867f7 → 8f4c1fa → 914adb5 → ccec6dc → 462678f → 4e408fb → eeb3fec → d668c26

---

## Director cold-Read findings

### T3 X-LockedStep2 — Scored Step 2 read-only view × 8 vp

Source: `audit/png-step2-locked-prod/`

| VP | Verdict |
|---|---|
| Mobile-360 | PASS — 已評分完成 banner 顯示，lock 圖示正確；北極星指標 (NSM) / 定義說明 / 與業務目標連結三欄均顯示 99 範例答案 + 提示按鈕；底部 submit-bar--locked 單一「查看評分結果」button，無「回首頁」；content 有 Zoom 實際輸入值 |
| iPhone-SE | PASS — 版面與 Mobile-360 一致；3-step 定義法全展示；submit-bar--locked 固定底部，「查看評分結果」CTA 清楚可見；提示/範例按鈕均在場 |
| iPhone-14 | PASS — 與 iPhone-SE 相同結構；3 步驟定義法全部展開；submit-bar--locked 含「已評分完成」左側 meta + 「查看評分結果」右側 CTA；field content 正確渲染 |
| iPhone-15-Pro | PASS — 較寬螢幕讓定義法三步驟同一卡片完整呈現；submit-bar 固定底部 safe-area-aware；北極星指標欄位內 user 輸入內容可見；hint + 範例答案 button row 正確 |
| iPad | PASS — 全寬 tablet layout，查看評分結果 CTA 固定右側；3 欄 field 各有獨立 提示/範例 row；context card 含深入了解問題 expand link；layout 乾淨無溢位 |
| Desktop-1280 | PASS — 中欄 centered layout (max-width 約 840px)；submit-bar--locked 横跨 bottom with left meta + right CTA；3 NSM field 均在 locked textarea 狀態；定義説明 / 與業務目標連結欄位顯示 user content |
| Desktop-1440 | PASS — 與 1280 相同 layout；北極星指標欄位 content 在 textarea 中但邊框已淡化 (locked state 樣式)；submit-bar--locked 正確貼底 |
| Desktop-2560 | PASS — 超寬螢幕 centered column 保持正確；提示 + 99 範例答案 button 兩側並排對齊；查看評分結果 CTA 全寬貼底右側；font 與 spacing 無異常 |

**T3 總結：** 8/8 PASS。已評分完成 banner、rt-field--locked 渲染、submit-bar--locked 單 CTA、提示/範例 buttons 可用、safe-area 正確，全 viewport 一致。

---

### T4 X-Overlay — Mobile coach bottom-sheet × 4 mobile vp

Source: `audit/png-coach-overlay-prod/`

| VP | Verdict |
|---|---|
| Mobile-360 | PASS — bottom-sheet 從底部升起，handle pill (36px × 4px 灰色橫線) 可見於頂部；16px 上圓角；backdrop dim 讓後方 NSM report 內容半透明；sheet 含「觸及廣度·教練思路」標題 + 教練思路文字 + 為什麼這樣拆解引用區塊 + 全寬「了解了」CTA button |
| iPhone-SE | PASS — handle pill 同樣在頂端；sheet 佔畫面約 70% 高度；了解了 button 全寬 44px+ 高度；close × 在右上；教練思路內容完整可讀 |
| iPhone-14 | PASS — bottom-sheet 滑出動畫後靜態截圖呈現：handle pill + 教練思路標題 + 內容 + 了解了 footer；後方 NSM report 可見 Spotify 評分 80/100 + 對比 tab；backdrop 灰化層正確 |
| iPhone-15-Pro | PASS — 較高螢幕讓 sheet 完整顯示：handle / 頭部路徑 breadcrumb / 教練思路 body / 為什麼這樣拆解 blockquote / 了解了 footer；safe-area-inset-bottom 正確讓 button 不被 home bar 截切 |

**T4 總結：** 4/4 PASS。handle pill、16px border-radius、backdrop dim、教練思路內容、全寬了解了 CTA，全 4 mobile vp 一致。

---

## 3 大不准漏稽核 surface 驗證

| Surface | Verified | Evidence |
|---|---|---|
| 問題說明 (context — 深入了解問題) | 確認 | T3 PNG iPad/Desktop 可見「深入了解問題」chevron；T6 backfill 為 100 NSM 題加上 context + field_examples；T5 BE rehydrate 在 list+detail 讀出時 merge 到 question_json |
| 提示 (hint button clickable in locked Step 2) | 確認 | nsm-step2-locked.spec.js test #3「提示 + 範例答案 buttons stay clickable in locked state」× 8 vp 全 PASS；T3 PNG 可見 hint button 在每個 NSM field 的 row 裡 |
| 範例答案 (clickable + has content) | 確認 | T3 PNG 顯示「99 範例答案」chevron button 在所有 locked field 右側；T6 nsm_database.json backfill 100 題；T5 rehydrate route 確保 field_examples 不為 null |

---

## iOS Safari 15-item 靜態審核

走查 T3 (submit-bar--locked) + T4 (nsm-coach-bottom-sheet) 兩個新 mobile UX surface。

| # | 項目 | 結論 | 證據 |
|---|---|---|---|
| 1 | 100vh — 避免 Safari viewport 截切 (用 dvh 或 max-height:85vh) | PASS | bottom-sheet 用 `max-height: 85vh` 而非 `100vh`，無截切風險 |
| 2 | safe-area-inset-bottom — 底部安全區域 | PASS | `.submit-bar--locked` padding: `max(var(--s-4), env(safe-area-inset-bottom))`；`.nsm-coach-bottom-sheet` padding: `max(var(--s-4), env(safe-area-inset-bottom))` |
| 3 | input zoom — font-size ≥ 16px | PASS | NSM textarea 繼承 var(--t-body) ≥ 16px；locked field 為 readonly 不觸發 zoom |
| 4 | touch target ≥ 44px | PASS | `.nsm-coach-bottom-sheet__close-btn { min-height: 44px }`；submit-bar--locked 按鈕高度 ≥ 44px |
| 5 | momentum scroll (-webkit-overflow-scrolling: touch) | PASS | `.nsm-coach-bottom-sheet { -webkit-overflow-scrolling: touch }` 已加 (style.css:3625) |
| 6 | no :hover reliance | PASS | bottom-sheet 互動僅用 data-nsm4-action click handlers，無 hover state 必要 |
| 7 | -webkit-tap-highlight-color | PASS | style.css:38 全站 `* { -webkit-tap-highlight-color: transparent }` |
| 8 | smooth-scroll behavior | PASS | 底部 sheet 用 CSS transform animation，非 scrollTo，不受此項影響 |
| 9 | sticky position fallback | PASS | submit-bar 用 `position: fixed` 而非 sticky，iOS 相容無疑慮 |
| 10 | overscroll-behavior | PASS | bottom-sheet overflow-y:auto 內部，不觸發外部 scroll bounce |
| 11 | overflow:auto 需 -webkit-overflow-scrolling | PASS | 已加 (item 5 同 ref) |
| 12 | accent-color browser quirks | PASS | 本 bundle 無新 checkbox/radio，無相關風險 |
| 13 | scrollbar-width on iOS | PASS | iOS 無 scrollbar，不影響 layout |
| 14 | font-display swap | PASS | 無新增 web font；系統字型不受此項影響 |
| 15 | line-clamp -webkit- | PASS | bottom-sheet 教練思路段落無 clamp；此項不適用 |

**iOS 15-item：15/15 PASS**

---

## Playwright 結果

```
64 passed / 8 skipped (48.8s)
```

- X-Compare: 8/8 PASS (全 vp)
- X-Back T1/T2/T3: 8/8 × 3 PASS (全 vp)
- X-LockedStep2: 8/8 × 3 states PASS (全 vp)
- X-Overlay: 4/4 PASS (mobile only) + 4/4 skip (iPad/Desktop — 正確，此 surface mobile-only)

## jest 結果

```
214 passed / 17 skipped / 1 pre-existing fail
```

Baseline 不破。232 total tests。

---

## Director 簽核

所有 T3 + T4 PNG 逐一親 Read 完畢。iOS 15/15 PASS。Playwright 64 pass / 8 skip (正確略過 tablet+desktop X-Overlay)。jest baseline 維持。

Bundle 通過 director 稽核。
