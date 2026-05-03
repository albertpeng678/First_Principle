# Plan D SB1 fix — Director eyeball walk

> 範圍：Plan D SB1 在 PW spec 過綠後 director cold-review 發現 3 真 bug + 4 mockup drift。
> 走 TDD 紅綠補洞，本檔記錄修完後的 PNG eyeball walk（spec §0.5 Layer 6 + §6.2）。

## 修補項目

### Bugs（production 真 bug）

| # | 位置 | 錯 | 對 |
|---|---|---|---|
| 1 | `app.js:319` `renderOffcanvasItem` | `score = item.step_scores.S` 取整個 EvaluatorResponse 物件 | `item.step_scores.S.totalScore`（per spec §1.4） |
| 2 | `app.js:316-317` | `scores_json.final_score` 找錯 key | `scores_json.totalScore`（per `prompts/nsm-evaluator.js:48`） |
| 3 | `app.js:309` NSM 分支 title | 用 `question_json.industry`（schema 無此欄位） | 改走 `questionTitle()` helper：company + product fallback |

### Mockup 09 drift（Path 2 嚴格遵守 / spec §5.2）

| # | 位置 | 錯 | 對 mockup 09 line |
|---|---|---|---|
| 1 | `renderOffcanvasContent()` empty icon | `ph-notepad` | `ph-folder-open` (line 560) |
| 2 | empty 副文 | 「完成第一題後，記錄會出現在這裡」 | 「練習完成的 CIRCLES 題目與 NSM 訓練會出現在這裡。」(line 562) |
| 3 | empty CTA | `btn--primary`「開始練習」 | `btn--ghost offcanvas-empty__cta` + `ph-arrow-right`「開始第一題」(line 563) |
| 4 | error icon + 副文 + retry | `ph-wifi-slash` / 「請稍後再試」/ 無 icon retry | `ph-warning-circle` / 「請檢查網路連線後再試。」/ `ph-arrow-clockwise`「重試」(lines 782-785) |

## 證據

- TDD 紅綠：`tests/visual/offcanvas.spec.js` 強化 5 tests（empty/error 加 mockup contract assertions、list 改用 production-shape fixture）；先確認 RED 3 fail → 修 → GREEN 5/5 → 8 viewport `40/40 pass`
- jest 不 regression：`133 + 24 skip = 157/157`
- PNG eyeball walk（修完後 `/tmp/postfix-{empty,error,list}-{mobile-360,tablet-768,desktop-1280}.png` × 9 張，全 Read 過）

## Eyeball walk 評論（每張 PNG ≥ 1 句）

### Empty state（`ph-folder-open` + ghost CTA）
- **mobile-360**：drawer 280px 從左進入、backdrop dim 全頁；圓形 icon container（淺米底 + folder-open）置中、「尚無練習記錄」title、副文兩行（CIRCLES 題目與 NSM 訓練）、ghost border button「→ 開始第一題」對齊 mockup 09 line 559-563 ✓
- **tablet-768**：drawer 仍 280px 不放大 ✓，內容垂直置中、副文 line-break 自然、CTA ghost 樣式正確
- **desktop-1280**：drawer 仍 280px ✓ 不擴張，eyeball 一致；右側為 backdrop dim cover「CIRCLES view — 待 Plan B 實作」stub（合理）

### Error state（`ph-warning-circle` + ghost retry）
- **mobile-360**：紅圓 warning-circle、「載入失敗 / 請檢查網路連線後再試。」、ghost button「↻ 重試」對齊 mockup 09 line 781-785 ✓
- 三 viewport 表現一致

### List state（real production shape）
- **mobile-360**：「今天」section header → Spotify · Wrapped + navy badge **86** + 「CIRCLES · 完整 7 步」+ 5/3 ✓ / Discord · Voice + 「CIRCLES · C 澄清」（active 無 score 正確）✓ / Asana · 工作協作 + navy badge **92** + 「NSM · 4 步」+ 5/3 ✓
- 跨三 viewport：drawer 寬度恆 280px、全部 score badge 顯示**正整數值**（不再是 `[object Object]`）、title 無尾巴空白
- mode-tag mockup 09 「單一 navy filled score badge」只給完成 entries — 中間 active Discord 沒有 badge ✓

## 結論

3 真 bug 全 fix；4 mockup drift 全對齊。Plan D SB1 解除 BLOCK，可進 user signoff → merge。

---

**走過：** Path 2 Master Spec §0.5 Layer 6 / §6.2 Bundle 完工強制產出 4 樣（jest log ✓ / PW log ✓ / 本檔 ✓ / mockup-as-Spec strict pass ✓）
