# Wave 1 Task #6 Findings — NEW-Test-Debt: nsm-step-2-3.spec.js 4→3 dim fix

**Date:** 2026-05-17
**Task:** tracker §3 NEW-Test-Debt — fix spec expecting 4 dim labels/descs after impact dim removed
**File changed:** `tests/visual/nsm-step-2-3.spec.js` (test-only, no production code touched)

---

## Step 2: Ground Truth from `NSM_DIMENSION_CONFIGS` (app.js line 6037-6078)

### attention type — 3 dims only (impact REMOVED)
| id | label | desc |
|---|---|---|
| reach | 觸及廣度 | 有多少用戶真正觸碰到核心功能（非僅登入）|
| depth | 互動深度 | 每位用戶每次使用的品質與投入程度 |
| frequency | 習慣頻率 | 用戶是否形成定期回訪的使用習慣 |

(REMOVED: impact / 留存驅力 / 什麼讓用戶持續回訪而非逐漸流失)

### saas type — 3 dims only (impact REMOVED)
| id | label | desc |
|---|---|---|
| reach | 啟用廣度 | 新客戶中有多少真正完成啟用 |
| depth | 席次深度 | 每個帳號內有多少人在真正使用核心功能 |
| frequency | 黏著頻率 | 使用頻率是否顯示產品已嵌入日常工作流 |

(REMOVED: impact / 擴張信號 / 現有客戶是否在增加使用)

---

## Step 2: Spec assertions needing update (4 → 3)

| Line(s) | Original (4 items) | Fixed (3 items) |
|---|---|---|
| 110 | `['觸及廣度','互動深度','習慣頻率','留存驅力']` | `['觸及廣度','互動深度','習慣頻率']` |
| 128 | `['啟用廣度','席次深度','黏著頻率','擴張信號']` | `['啟用廣度','席次深度','黏著頻率']` |
| 206-211 | 4 descs (attention) | 3 descs (drop '什麼讓用戶持續回訪而非逐漸流失') |
| 229-234 | 4 descs (saas) | 3 descs (drop '現有客戶是否在增加使用') |

Also fix test titles (lines 94, 113) to say 3 dim instead of 4.

---

## Step 3: Fix applied (before/after)

### Line 94 test title
- BEFORE: `'Step 3 attention type renders 4 dim labels: 觸及/互動/習慣/留存'`
- AFTER:  `'Step 3 attention type renders 3 dim labels: 觸及廣度/互動深度/習慣頻率 (post impact-removal, tracker §3 NEW-Test-Debt)'`

### Line 110 expect array (attention labels)
- BEFORE: `['觸及廣度', '互動深度', '習慣頻率', '留存驅力']`
- AFTER:  `['觸及廣度', '互動深度', '習慣頻率']`

### Line 113 test title
- BEFORE: `'Step 3 saas type renders 4 dim labels: 啟用/席次/黏著/擴張'`
- AFTER:  `'Step 3 saas type renders 3 dim labels: 啟用廣度/席次深度/黏著頻率 (post impact-removal, tracker §3 NEW-Test-Debt)'`

### Line 128 expect array (saas labels)
- BEFORE: `['啟用廣度', '席次深度', '黏著頻率', '擴張信號']`
- AFTER:  `['啟用廣度', '席次深度', '黏著頻率']`

### Lines 206-211 expect array (attention descs)
- BEFORE: 4 descs ending with '什麼讓用戶持續回訪而非逐漸流失'
- AFTER:  3 descs (impact desc removed)

### Lines 229-234 expect array (saas descs)
- BEFORE: 4 descs ending with '現有客戶是否在增加使用'
- AFTER:  3 descs (impact desc removed)

---

## 5x Consecutive Results (Step 5)

All 5 runs: 12/12 passed, 0 fail, 0 flake

| Run | Result |
|---|---|
| 1 | 12 passed (17.6s) |
| 2 | 12 passed (18.7s) |
| 3 | 12 passed (17.2s) |
| 4 | 12 passed (19.9s) |
| 5 | 12 passed (33.9s) |

---

## 5-Step Cross-Check (Step 6)

1. `find tests -name 'nsm-step-2-3.spec.js'` → found at `tests/visual/nsm-step-2-3.spec.js`
2. `grep NSM_DIMENSION_CONFIGS|tracker §3 NEW-Test-Debt` → 8 matching lines confirming comments injected at all 4 fix sites
3. `git ls-files --error-unmatch tests/visual/nsm-step-2-3.spec.js` → FILE IS TRACKED
4. `git diff --cached tests/visual/nsm-step-2-3.spec.js` → 12 insertions / 6 deletions (4 assertion changes + 4 comment blocks)
5. Final run: 12 passed

---

## Production Diff (Step 7)

- `git diff --cached public/` → EMPTY
- `git diff --cached routes/` → EMPTY
- `git diff --cached lib/` → EMPTY
- Staged files from this task only: `tests/visual/nsm-step-2-3.spec.js`
- Other staged files (`prompts/circles-gate.js`, `tests/circles-gate-backoff.test.js`) are from parallel agents — NOT from this task
- ABSOLUTE PROHIBITION #6 honored: test-only fix confirmed
