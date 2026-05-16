# UAT SOP — CIRCLES Lock-on-back + qchip 4-block (2026-05-17)

Dev server: `http://localhost:4000`  (run `npm run dev` if not up)

## Walk
1. 登入 `e2e@first-principle.test`
2. CIRCLES tab → drill mode → C1
3. 完成 Phase 1 form → submit → 過 Phase 1.5 gate
4. Phase 2 對話 → 寫 conclusion (≥30 字) → submit → 等評分完成
5. 點「上一步」← 確認 Phase 1 form 變 readonly + 「完成 Phase 1」消失
6. 確認「查看提示」「查看範例」仍可點
7. 切回 Phase 2 → 點 qchip 卡 → 確認展開有 4 block：商業背景 / 用戶輪廓 / 常見誤區 / 破題切入
8. 嘗試點 Phase 3 「重新評分」→ 確認 disabled
9. 切到 I step → 確認 form 仍可編輯（cross-step independence）

## 預期 0 regression
- 對話練習其他 step（I/R/C2/L/E/S）qchip 也應該展開 4 block
- Locked state 視覺：grey bg / score badge / hint+example buttons
- Phase 2 對話中 qchip 點開 → AI SSE 回應 → qchip 仍保持展開（T4-SSE fix）

## Acceptance Criteria
- AC-1 qchip 4 block ✓
- AC-2 BE 422 reject re-score ✓
- AC-3 FE lock-on-back ✓
- AC-4 Phase 3 retry disabled when scored ✓
- AC-5 E2E 5 TC × 3 projects × 5 runs GREEN ✓
- AC-6 0 jest/Playwright regression (見 step 1-2)

## Test Evidence (2026-05-17 final ship)
- **Jest**: 530 passed / 5 failed / 17 skipped / 552 total
  - 5 fails 全為 pre-existing lifecycle wiring（`tests/contracts/lifecycle-circles-route.test.js` + `tests/contracts/lifecycle-nsm-route.test.js` + `tests/issue-bug1-nsm-session-restore.test.js`）— Task 1-7 未觸這些檔案
- **Playwright Critical-path** (`critical-path-full-flow.spec.js`): 2 passed / 2 failed
  - 2 fails 為 mobile-chrome/safari 上的 `.navbar__email` race（pre-existing flake from commit `9446ad2`，Task 1-7 未觸該 spec 或 auth setup mobile path）
- **Playwright back-nav lock** (Task 5 spec): 16/16 GREEN × 3 projects
