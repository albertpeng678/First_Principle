# F-CT2.1 補修 findings — Reviewer #2 Critical #2

**日期：** 2026-05-18
**狀態：** DONE — 全部 3 change 實作完成，5/5 × 3 vp GREEN

---

## 三項變更摘要

### 1. import 改用 auto-cleanup.fixture
- 舊：`const { test, expect } = require('@playwright/test');`
- 新：`const { expect } = require('@playwright/test'); const { test } = require('../fixtures/auto-cleanup.fixture');`
- fixture export 確認：`module.exports = { test, runAfterEachCleanup, validateTrackArgs }` → 正確取 `test`

### 2. testStartTimestamp 加在 test 開頭
- `const testStartTimestamp = new Date().toISOString();` — 在 resolveTestUserId 之前
- 作用：時間視窗過濾，只計算本 test run 起點之後建立的 rows

### 3. Step D / Step I DB invariant 恢復（per-project actualQid 視窗化）
- 關鍵發現：QID_BY_PROJECT 固定 `q3/q4/q5`，但 NSM 每次隨機顯示 5 題；若指定 qid 不在畫面中，`clickNsmCard` 會 fallback 點第一張可見卡，實際 `question_id` 與固定 qid 不符
- 解法：Step C 之後讀 `AppState.nsmSelectedQuestion.id` → `actualQid`；Step D + Step I 的 DB query 均改用 `actualQid`
- Step D：`expect.poll count toBe(0)` — 卡片點選後確認無 silent DB write
- Step I：`expect.poll count toBe(1)` — Step 2 送出後確認恰好 1 row（exact，不是 >= initialCount+1）

---

## 5x consecutive 數字

| Run | vp | 結果 | actualQid (desktop) |
|---|---|---|---|
| 1 | 3 × desktop/mobile-chrome/mobile-safari | 4 passed | q69 |
| 2 | 3 | 4 passed | q67 |
| 3 | 3 | 4 passed | q15 |
| 4 | 3 | 4 passed | q44 |
| 5 | 3 | 4 passed | q5 |

總計：**20/20 passed，0 failed，0 flake**

---

## 禁止事項遵守確認

- 無 hard sleep（全用 expect.poll）
- 無 mock 自家 backend success
- 無 tracker.md append（本 findings 獨立）
- 無 self-approve（含 git ls-files 確認：tests/e2e/nsm-step1-card-click-no-session.spec.js 已 tracked）
- 無 commit（只 stage）
