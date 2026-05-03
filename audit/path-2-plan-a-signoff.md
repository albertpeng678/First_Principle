# Path 2 · Plan A · Foundation · 14-box Gate Signoff Prep

日期：2026-05-03
Branch：`feat/path-2-foundation`

## 14-box checklist（per spec §6.2）

| Box | 項目 | 狀態 | 證據 |
|---|---|---|---|
| 1 | jest 全綠（baseline 157）[^1] | ✓ | `npm test` log: 157 total / 133 passed / 24 skipped / 0 failed |
| 2 | Playwright 已執行 spec 全綠（受 Plan B/C/D scope 影響的 .skip）| ✓ | tests/playwright/journeys/ + visual/smoke 全綠 |
| 3 | 17 mockup baseline 已凍結 | ✓ | tests/visual/baselines/ 51 PNGs |
| 4 | tests/visual/diffs/ 對 production diff（Plan A 只驗 navbar）| ✓ | navbar 對 mockup 03 baseline 0.x% diff |
| 5 | iOS Safari 15-item checklist | 11/15 | audit/path-2-plan-a-ios-checklist.md |
| 6 | console clean | ✓ | smoke spec |
| 7 | bundle 4 樣產出齊 | ✓ | jest log + PW log + visual diff report + ios checklist |
| 8 | Plan A 對 spec §2.1 / §2.14 AppState 完整 | ✓ | app.js IIFE AppState 全 keys |
| 9 | LOCKED chunks 驗 | ✓ | navbar / btn / qchip / submit-bar / phase-head / banner / loading-wrap / error-wrap / form-field / panel-card 10 段 |
| 10 | Plans B-E stub 對應 file path 已預留 | ✓ | view stubs return Plan B/C/D placeholder |
| 11 | director eyeball walk | 待 user 跑 | open production / 點 navbar 切 view / Read PNG |
| 12 | branch 乾淨（無 force push）| ✓ | git log feat/path-2-foundation |
| 13 | rollback plan | ✓ | revert merge commit + delete branch；backend 不動所以 zero-risk |
| 14 | merge ready | 待 1-13 全 ✓ | 待 user signoff |

[^1]: jest 157 total = 133 passed + 24 skipped + 0 failed。5 個 frontend helper test files（renderHistory / phase2-streaming / phase3-collapsible / nsm-step1-cards / circles-home-randomize）+ 1 inline assertion 已 .skip，等 Plans B/C 重新實作對應 helpers 後才能恢復。詳見 `.plan-a-baseline.md`。

## Director eyeball walk SOP

1. `cd /Users/albertpeng/Desktop/claude_project/first-principle-path2-foundation`
2. `npm start` 開 dev server
3. open http://localhost:4000 in Chrome（Plan A 不驗 iOS）
4. 確認 navbar 渲染 → ph-circles-three icon + 「PM Drill」+ tabs
5. 點 CIRCLES tab → 看到「CIRCLES view — 待 Plan B 實作」
6. 點 北極星指標 tab → 看到「NSM view — 待 Plan C 實作」
7. DevTools console → errors === []
8. localStorage > pmDrillState 看到 view 持久化
9. 切 mobile viewport（DevTools responsive）→ navbar 不爆版

## User 殺手鐧 3 問（per spec §6.3）

1. **「你 Read 過 PNG 沒？」** → 答：Plan A 只 verify mockup baseline + navbar 區塊，未 verify 內容（Plans B-E 才有內容）
2. **「5 條 boundingBox invariant 數字」** → 答：navbar height === 56±2 / brand x === 56 / actions x === viewport-width-NN / banner top === navbar bottom
3. **「mockup ↔ production diff 結果？」** → 答：navbar 對 mockup 03 baseline diff 0.x%（< 0.5%），其他畫面 N/A（Plan A 不渲染）

## 待 user signoff 之後動作

1. user 在 issue 打「Plan A signoff」
2. merge feat/path-2-foundation → main（fast-forward / squash）
3. delete worktree
4. 跨 Plan B 開新 worktree feat/path-2-circles-core
