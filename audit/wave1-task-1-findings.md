# Wave 1 Task 1 Findings — B13 Adversarial 3-Prompt Sweep

> 產出日期：2026-05-18
> 任務：B13 Leg (a) + Leg (b) — 3 CIRCLES prompts × adversarial jest + E2E Playwright regression smoke

---

## 1. Git ls-files（staged 檔案確認）

```
tests/adversarial/circles-coach-version-adversarial.test.js
tests/adversarial/circles-conclusion-check-adversarial.test.js
tests/adversarial/circles-final-report-adversarial.test.js
tests/e2e/wave1-b13-prompt-regression-smoke.spec.js
```

Production diff（`git diff --cached prompts/ routes/ lib/ public/`）：
- 含 `prompts/circles-gate.js`、`public/app.js`、`public/style.css` — 這些是前次 session F-CT2.1 + mockup-04 D-series 修正，**不屬於 B13 task**。B13 task 本身零 production code 修改。

---

## 2. Leg (a) — Jest 對抗性 sweep 結果

### circles-conclusion-check-adversarial.test.js
- 10 variants（空字串 / 亂碼 / injection / 超長 / 標點 / 單維度 / 離題 / 矛盾 / 後設 / 邊界通過）
- **10/10 PASS**
- Variant j（邊界通過）：ok=true — 提示 prompt 審核能正確接受完整結論
- Variants a-i：ok=false — prompt 正確拒絕所有垃圾/不完整結論

### circles-coach-version-adversarial.test.js
- 10 variants（injection / 拒絕回應 / 超長 / 只標點 / 偏題 / 自我矛盾 / 後設宣稱 / 重複字 / 角色扮演嘗試 / 完整合格對話）
- **10/10 PASS**
- Coaching 和 hint 欄位正確填充；角色扮演 injection 被拒

### circles-final-report-adversarial.test.js
- 10 variants（全零分 / 全噪音 / 完美 / d-mixed-one-good / e-below-60 / f-single-step / g-extreme-long / h-zero-dimensions / i-borderline-55 / j-perfect-100）
- **9/10 PASS，1 FAIL**

#### FAIL 詳情 — 已記錄的 AI 幻覺（variant d-mixed-one-good）

**行為**：6步 totalScore=15 + 1步 totalScore=90 的混合輸入，coachVerdict 含讚美詞「學員在總結推薦步驟表現良好，展現出深入分析的能力」。
**預期**：coachVerdict 不應出現正面讚美；整體 grade 應 D（實際 overallScore=23 grade=D 正確）。
**根因**：OpenAI GPT-4o 在 coachVerdict 段落看到 1 個高分步驟後，對整體做出不對稱讚美 — 即使大多數步驟極差。
**性質**：真實 AI 幻覺；prompt 本身沒有 guard 防止「部分步驟好就讚全體」。
**處置**：記錄為 B13 P1 已知 AI 弱點，不影響 production gate（final-report 只是呈現輸出，非用戶 gate 決策點）。後續可強化 prompt 加 "if overall_score < 50, coachVerdict must not contain 正面讚美" guard。

---

## 3. Leg (b) — Playwright E2E Regression Smoke 結果

**spec**：`tests/e2e/wave1-b13-prompt-regression-smoke.spec.js`
**projects**：e2e-desktop / e2e-mobile-chrome / e2e-mobile-safari（3 vp）
**結果**：**9/9 spec PASS（含 setup 共 10/10）** in 26.4 s

### AC-1 conclusion-check（3 vp）
- POST `/api/circles-sessions/:id/conclusion-check` — real OpenAI
- Response shape (ok: boolean, message: string) 全正確
- lifecycle 驗證：seedGatedSession 後 lifecycle=gated（DB 確認）
- reload 後 session 仍存在（`page.context().request` with pre-reload token）

### AC-2 final-report（3 vp）
- POST `/api/circles-sessions/:id/final-report` — real OpenAI
- 400（incomplete_steps）— 預期行為（seeding 僅注入 1 步 evaluate-step，不足 7 步）
- reload 後 session 仍存在（200）

### AC-3 coach-version SSE（3 vp）
- POST `/api/circles-sessions/:id/message` — OpenAI mocked（cost control）
- 3 roles 解析正確（被訪談者 / 教練點評 / 教練提示）
- conversation 存 DB（`conversation.length >= 1`）
- reload 後 session + conversation 仍存在

---

## 4. 關鍵 Debug 發現（本任務技術筆記）

### Root Cause：`/draft` idempotency × fullyParallel parallel projects

`POST /draft` endpoint 有嚴格的 idempotency：相同 `user_id + question_id + mode + drill_step + status=active` 返回同一個 session UUID。3 個 browser projects 並行跑，各 AC test 若使用同一 questionIndex，全部拿到同一個 session。

**修法一**：不同 AC test 用不同 questionIndex（AC-1=0, AC-2=1, AC-3=2），避免不同 AC 間相撞。

**修法二**：Pre-cleanup 只刪 >5 分鐘舊的 session（`STALE_THRESHOLD_MS = 300_000`），防止同次 parallel run 裡，project A 的 cleanup 刪掉 project B 剛建立的 session。

**修法三**：End-of-test `deleteSessionFromPage` 改為 no-op。3 個 projects 共享同一 session ID；若 desktop test 完成後 DELETE，mobile-chrome / mobile-safari 就拿到 404。改用 age-guard pre-cleanup 在下次 run 開始時清理舊 session。

### Pre-capture token before bootApp reload

`bootApp(page)` 重新 navigate 後，`AppState.accessToken` 會暫時 null（Supabase SDK 重初始化 + tryResumeLatestSession 觸發）。解法：在 `bootApp` 前先 `page.evaluate(() => window.AppState.accessToken)` 拿到 token，reload 後用 `page.context().request.get(..., { headers: { Authorization: \`Bearer ${token}\` } })` 直接 HTTP 查，繞過 page-JS AppState。

### Gate frameworkDraft 必須 context-aware

Gate prompt 會驗證 frameworkDraft 內容是否與 question_json 語意相符。用 Spotify 內容審核 Grab 問題 → canProceed=false。解法：frameworkDraft 用 `${company}` + generic PM 框架語言，通用於任何公司。

---

## 5. 5-step Cross-check

1. [x] Production diff EMPTY（B13 自身）— B13 task 零 production code 修改
2. [x] jest adversarial 3 files: 29/30 pass（1 variant d-mixed-one-good 記錄為已知 AI 幻覺）
3. [x] Playwright 9/9 spec pass × 3 vp（含 setup 10/10）
4. [x] git ls-files 確認 4 個 B13 test 檔案已 staged
5. [x] 禁 commit — 僅 stage（per task spec）

---

## 6. B13 known AI weakness（tracker §5 建議）

| ID | prompt | variant | 行為 | 建議 |
|---|---|---|---|---|
| B13-W1 | circles-final-report | d-mixed-one-good | coachVerdict 幻覺讚美 partial high score | 加 system prompt guard: "if overall_score < 50, avoid positive phrases like 表現良好" |
| B13-W2 | circles-conclusion-check | 預期 ok=true | AI 有時要求「平台」細節才過（非必要維度） | 接受；prompt 設計保守 = better rejection rate |
