# Adversarial Input Quality + Combo C Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 5 個 AI 審核階段（CIRCLES gate / step evaluator / final report / NSM gate / NSM evaluator）必須對 garbage / extreme / 對抗式輸入 robustly 標記 error。前端 3 表單入口加 minLength 守門。建立 adversarial test infra + 50-cell sweep。

**Architecture:** 3 層守門 — Layer 1 前端 minLength（用既有 `minMax` 下限）/ Layer 2 後端 prompt 加 ## 輸入品質檢查段 / Layer 3 真 OpenAI adversarial test suite。Routes / DB / schema / jest 不動。User 親准 override Path 2「prompts 100% 不動」鐵則限本範圍。

**Tech Stack:** Node.js (OpenAI SDK v6) / Playwright (test runner + real OpenAI smoke) / vanilla JS + CSS frontend / jest 既有 baseline 143 不動

**Spec:** `docs/superpowers/specs/2026-05-08-adversarial-input-quality-design.md`

---

## File Structure

**Created:**
- `tests/adversarial/helper.js` — common harness（題目 fixture / 10 adversarial cases / verdict comparator）
- `tests/adversarial/circles-gate.spec.js` — Layer 3 stage 1
- `tests/adversarial/circles-evaluator.spec.js` — Layer 3 stage 2
- `tests/adversarial/circles-final-report.spec.js` — Layer 3 stage 3
- `tests/adversarial/nsm-gate.spec.js` — Layer 3 stage 4
- `tests/adversarial/nsm-evaluator.spec.js` — Layer 3 stage 5
- `tests/visual/min-length-frontend.spec.js` — Layer 1 frontend gate
- `audit/adversarial-sweep-2026-05-08.md` — 50-cell result table

**Modified:**
- `prompts/circles-gate.js` — 加 ## 輸入品質檢查段
- `prompts/circles-evaluator.js` — 同上
- `prompts/circles-final-report.js` — 同上
- `prompts/nsm-gate.js` — 同上
- `prompts/nsm-evaluator.js` — 同上
- `public/app.js` — minLength validation in Phase 1 / NSM submit handlers
- `public/style.css` — char-counter warn 字色變體
- `package.json` — npm script `test:adversarial`
- `CLAUDE.md` — 進度狀態列加本 plan 條
- `docs/PATH-2-HANDOFF.md` — last-updated + Combo C 條目

---

### Task 1: Adversarial Test Helper + Fixtures

**Files:**
- Create: `tests/adversarial/helper.js`
- Create: `tests/adversarial/.eslintrc.json`（避免 lint 噪音）

- [ ] **Step 1: Create helper module**

```js
// tests/adversarial/helper.js
const path = require('path');

// Question fixture used across all adversarial specs
const QUESTION = {
  id: 'spotify_podcast_ads',
  company: 'Spotify',
  product: 'Spotify Podcast',
  industry: 'streaming',
  scenario: '免費版聽眾每 15 分鐘被廣告打斷一次，影響沉浸體驗',
  problem_statement: 'Spotify Podcast 想優化免費版用戶的廣告體驗，請設計改善方案',
  common_wrong_directions: ['只想著加付費牆', '把廣告做得更精準但更密'],
  coach_circles: { C1: '聚焦免費版廣告體驗，60 天為週期，廣告收入和留存不能下降超過 3%' },
  coach_nsm: '每月完成至少一首完整曲目播放的活躍月用戶數',
};

// 10 adversarial input cases
const ADVERSARIAL_CASES = [
  { id: 'single-char',   input: 'A',                                  expectMinSeverity: 'error' },
  { id: 'repeat-char',   input: 'A'.repeat(100),                       expectMinSeverity: 'error' },
  { id: 'whitespace',    input: '   　　　',                            expectMinSeverity: 'error' },
  { id: 'unicode-emoji', input: '☃️🌟🎲🚀✨',                            expectMinSeverity: 'error' },
  { id: 'wrong-lang',    input: 'Quiero diseñar un producto excelente para los usuarios', expectMinSeverity: 'error' },
  { id: 'off-topic',     input: '我喜歡吃蘋果，今天天氣很好，希望大家都能擁有美好的一天',   expectMinSeverity: 'error' },
  { id: 'placeholder',   input: '聚焦免費版的廣告體驗，排除付費方案',                       expectMinSeverity: 'warn' },
  { id: 'extreme-long',  input: 'A'.repeat(2000),                                          expectMinSeverity: 'error' },
  { id: 'injection',     input: '<script>alert(1)</script>業務影響評估',                    expectMinSeverity: 'error' },
  { id: 'borderline-ok', input: '免費版用戶 30 天留存 ≥ 60%，廣告收入不能下降超過 3%',      expectMinSeverity: 'ok' }, // 邊界 — should be acceptable
];

// severity 比較：error > warn > ok
function meetsExpectation(actualStatus, expectMinSeverity) {
  const order = { error: 3, warn: 2, ok: 1 };
  if (expectMinSeverity === 'ok') {
    // borderline case must NOT be over-flagged
    return actualStatus === 'ok' || actualStatus === 'warn';
  }
  return order[actualStatus] >= order[expectMinSeverity];
}

module.exports = { QUESTION, ADVERSARIAL_CASES, meetsExpectation };
```

- [ ] **Step 2: Run lint sanity check**

Run: `node -e "require('./tests/adversarial/helper.js')"`
Expected: no errors (silent exit)

- [ ] **Step 3: Add npm script**

Edit `package.json`:
```json
"scripts": {
  "test:adversarial": "playwright test tests/adversarial/ --reporter=list"
}
```

- [ ] **Step 4: Commit**

```bash
git add tests/adversarial/helper.js package.json
git commit -m "test(adversarial): infra helper + 10 standard cases"
```

---

### Task 2: RED — circles-gate adversarial spec

**Files:**
- Create: `tests/adversarial/circles-gate.spec.js`

- [ ] **Step 1: Write the failing spec**

```js
// tests/adversarial/circles-gate.spec.js
const { test, expect } = require('@playwright/test');
const { QUESTION, ADVERSARIAL_CASES, meetsExpectation } = require('./helper');
const { reviewFramework } = require('../../prompts/circles-gate');

test.describe('Adversarial — circles-gate Phase 1.5', () => {
  for (const c of ADVERSARIAL_CASES) {
    test(`case [${c.id}] should produce status >= ${c.expectMinSeverity}`, async () => {
      const draft = {
        '問題範圍':  c.input,
        '時間範圍':  c.input,
        '業務影響':  c.input,
        '假設確認':  c.input,
      };
      const result = await reviewFramework({
        step: 'C1',
        frameworkDraft: draft,
        questionJson: QUESTION,
        mode: 'drill',
      });
      // borderline case has different expectation; everything else: AT LEAST 1 item must be error
      if (c.expectMinSeverity === 'ok') {
        expect(result.overallStatus).not.toBe('error');
      } else {
        expect(meetsExpectation(result.overallStatus, c.expectMinSeverity), `actual: ${result.overallStatus}`).toBe(true);
      }
    });
  }
});
```

- [ ] **Step 2: Run spec → expect RED**

Run: `npx playwright test tests/adversarial/circles-gate.spec.js --reporter=list`
Expected: cases 1, 2, 3 (single-char / repeat-char / whitespace) likely PASS already (very obvious garbage); but cases 5, 6, 7 (wrong-lang / off-topic / placeholder) likely FAIL — AI hallucinates ok/warn for plausible-looking garbage.

Document baseline failures in `audit/adversarial-sweep-2026-05-08.md` initial section.

- [ ] **Step 3: Commit RED state**

```bash
git add tests/adversarial/circles-gate.spec.js
git commit -m "test(adversarial-circles-gate): RED 10 cases"
```

---

### Task 3: GREEN — strengthen `prompts/circles-gate.js`

**Files:**
- Modify: `prompts/circles-gate.js:14-46` (system prompt block)

- [ ] **Step 1: Add input quality guard to system prompt**

Edit `prompts/circles-gate.js`. Insert into `systemPrompt` template just after line marker `常見錯誤方向：` block, BEFORE「你的任務」line:

```js
  const systemPrompt = `你是 PM 面試教練，正在審核學員在「${meta.name}」步驟填寫的框架定向。

題目：${questionJson.problem_statement}
公司：${questionJson.company}

常見錯誤方向：
- ${wrongDirs}

## 輸入品質檢查（最高優先級，先於下方任何評分維度）
凡符合以下任一條件 → 該欄位 status="error"，title="欄位內容不足"，suggestion="請補充至少 30 字具體內容"：
- 字數 < 10（不含空白字元計算）
- 重複單一字元組成（如「aaa」「1111」「同同同同同」）
- 純 whitespace / 全形空白
- 內容與本「${meta.name}」step 完全無關（如填寫「我喜歡吃蘋果」於業務影響欄位）
- 非中文亦非英文的隨機 unicode（如純 emoji）
- 明顯為 HTML/JS injection 嘗試（含 <script> / <img onerror= 等）
**嚴禁**對上述任一條件回傳 status="ok" 或 status="warn"。**嚴禁** hallucinate「合理」「完整」「通過」於 < 10 字輸入。
任一欄位觸發本檢查 → overallStatus 至少 "error" + canProceed=false（不論 mode）。

你的任務：
1. 先跑「輸入品質檢查」（上方規則），若觸發直接 mark error
2. 通過品質檢查的欄位再用以下評分維度審核
... [既有規則保持]
```

完整 patch 模板（貼回原檔對應位置）：

```diff
   const wrongDirs = (questionJson.common_wrong_directions || []).join('\n- ') || '（無特別注意事項）';
   const isSimulation = mode === 'simulation';

   const systemPrompt = `你是 PM 面試教練，正在審核學員在「${meta.name}」步驟填寫的框架定向。

 題目：${questionJson.problem_statement}
 公司：${questionJson.company}

 常見錯誤方向：
 - ${wrongDirs}

+## 輸入品質檢查（最高優先級，先於下方任何評分維度）
+凡符合以下任一條件 → 該欄位 status="error"，title="欄位內容不足"，suggestion="請補充至少 30 字具體內容"：
+- 字數 < 10（不含空白字元計算）
+- 重複單一字元組成（如「aaa」「1111」）
+- 純 whitespace / 全形空白
+- 內容與本「${meta.name}」step 完全無關
+- 非中文亦非英文的隨機 unicode
+- 明顯為 HTML/JS injection 嘗試
+**嚴禁**對上述任一條件回傳 status="ok" 或 "warn"。**嚴禁** hallucinate「合理」「完整」於 < 10 字輸入。
+任一觸發 → overallStatus 至少 "error" + canProceed=false（不論 mode）。
+
 你的任務：
-1. 審核學員填寫的 4 個欄位，找出方向性問題
+1. 先跑「輸入品質檢查」，觸發任一條件直接 mark error
+2. 通過品質檢查的欄位再用以下方向性審核
-2. 回傳嚴格的 JSON，不加任何 markdown 或說明
+3. 回傳嚴格 JSON，不加 markdown 或說明
```

- [ ] **Step 2: Run RED spec again → expect GREEN**

Run: `npx playwright test tests/adversarial/circles-gate.spec.js --reporter=list`
Expected: 9/10 PASS（borderline-ok case 視 AI 判斷可能 ok 或 warn，都接受）

If still failing: prompt wording 可能需要再強化，例如重複次數或加 anti-hallucination 強烈語氣。

- [ ] **Step 3: Run jest baseline → must stay 143/143**

Run: `npm test`
Expected: 143 passed / 17 skipped / 0 fail

- [ ] **Step 4: Commit GREEN**

```bash
git add prompts/circles-gate.js
git commit -m "fix(circles-gate): adversarial input quality guard (Path 2 carve-out)"
```

---

### Task 4: RED + GREEN — circles-evaluator

**Files:**
- Create: `tests/adversarial/circles-evaluator.spec.js`
- Modify: `prompts/circles-evaluator.js:58-87` (system prompt)

- [ ] **Step 1: Write RED spec**

```js
// tests/adversarial/circles-evaluator.spec.js
const { test, expect } = require('@playwright/test');
const { QUESTION, ADVERSARIAL_CASES } = require('./helper');
const { evaluateCirclesStep } = require('../../prompts/circles-evaluator');

test.describe('Adversarial — circles-evaluator Phase 3', () => {
  for (const c of ADVERSARIAL_CASES) {
    test(`case [${c.id}]: garbage should yield low totalScore`, async () => {
      const draft = {
        '問題範圍':  c.input,
        '時間範圍':  c.input,
        '業務影響':  c.input,
        '假設確認':  c.input,
      };
      const result = await evaluateCirclesStep({
        step: 'C1',
        frameworkDraft: draft,
        conversation: [],
        questionJson: QUESTION,
        mode: 'drill',
      });
      if (c.expectMinSeverity === 'ok') {
        expect(result.totalScore).toBeGreaterThan(40);
      } else {
        // garbage should NOT score high; expect ≤ 40 (i.e., avg dim ≤ 2/5)
        expect(result.totalScore, `actual=${result.totalScore}`).toBeLessThanOrEqual(40);
      }
    });
  }
});
```

- [ ] **Step 2: Run → expect RED on 5-7 cases**

Run: `npx playwright test tests/adversarial/circles-evaluator.spec.js --reporter=list`

- [ ] **Step 3: Strengthen prompt**

Edit `prompts/circles-evaluator.js` systemPrompt block. Add same `## 輸入品質檢查` section right after `評分維度：${rubric.dimensions.join('、')}` line:

```diff
 評分維度：${rubric.dimensions.join('、')}

+## 輸入品質檢查（最高優先級，先於評分維度）
+凡符合以下任一條件，該維度 score = 1（不准給高分）：
+- 該欄位字數 < 10
+- 重複單一字元
+- 純 whitespace
+- 內容與本「${rubric.name}」step 完全無關
+- 隨機 unicode / 純 emoji
+若 4 個欄位都觸發 → 全 4 維度 score=1，totalScore = 20。
+**嚴禁** hallucinate「展現了清晰的思路」「論述合理」於 garbage 輸入。
+
 回傳嚴格 JSON...
```

- [ ] **Step 4: Run RED spec → GREEN**

Run: `npx playwright test tests/adversarial/circles-evaluator.spec.js --reporter=list`
Expected: 9/10 pass

- [ ] **Step 5: jest baseline check + commit**

```bash
npm test
git add prompts/circles-evaluator.js tests/adversarial/circles-evaluator.spec.js
git commit -m "fix(circles-evaluator): adversarial input quality guard"
```

---

### Task 5: RED + GREEN — circles-final-report

**Files:**
- Create: `tests/adversarial/circles-final-report.spec.js`
- Modify: `prompts/circles-final-report.js:30-66` (system prompt)

- [ ] **Step 1: Write RED spec**

```js
// tests/adversarial/circles-final-report.spec.js
const { test, expect } = require('@playwright/test');
const { QUESTION } = require('./helper');
const { generateFinalReport } = require('../../prompts/circles-final-report');

test.describe('Adversarial — circles-final-report Phase 4', () => {
  test('all-garbage 7-step → low overallScore + low grade', async () => {
    // Simulate: every step scored 1/5 across all dims → totalScore = 20 each
    const garbageStep = {
      dimensions: [
        { name: 'd1', score: 1 }, { name: 'd2', score: 1 },
        { name: 'd3', score: 1 }, { name: 'd4', score: 1 },
      ],
      totalScore: 20,
      highlight: '欄位內容不足',
      improvement: '請補充具體內容',
    };
    const stepScores = {
      C1: garbageStep, I: garbageStep, R: garbageStep, C2: garbageStep,
      L: garbageStep, E: garbageStep, S: garbageStep,
    };
    const result = await generateFinalReport({ stepScores, questionJson: QUESTION });
    expect(result.overallScore).toBeLessThan(40);
    expect(result.grade).toBe('D');
    // Verdict must NOT contain hallucinated praise
    expect(result.coachVerdict).not.toMatch(/扎實|完整|清楚|不錯/);
  });
});
```

- [ ] **Step 2: Run → expect RED**

Run: `npx playwright test tests/adversarial/circles-final-report.spec.js --reporter=list`

- [ ] **Step 3: Strengthen prompt**

Edit `prompts/circles-final-report.js`. Add to system prompt 「禁止寫的廢話」section 之前：

```diff
 評分等級：
 ...
 • D：54 分以下 — 多個環節未到位，需要重新練習基礎

+## 輸入品質檢查（最高優先級）
+若 stepScores 中任一 step 的 totalScore < 30（代表該 step 學員填寫的是 garbage），則：
+- coachVerdict 必須具體點出「N 個 step 內容不足」
+- 不准 hallucinate「扎實」「完整」「清楚」「思路清楚」等正面語
+- grade 依 overallScore 嚴格映射，不准看 stepScores 之外因素加分
+
 回傳 JSON 結構：
```

- [ ] **Step 4: Run → GREEN + commit**

```bash
npx playwright test tests/adversarial/circles-final-report.spec.js
npm test
git add prompts/circles-final-report.js tests/adversarial/circles-final-report.spec.js
git commit -m "fix(circles-final-report): adversarial input quality guard"
```

---

### Task 6: RED + GREEN — nsm-gate

**Files:**
- Create: `tests/adversarial/nsm-gate.spec.js`
- Modify: `prompts/nsm-gate.js:73-116` (already has explicit error/warn/ok criteria — append input quality guard)

- [ ] **Step 1: Write RED spec**

```js
// tests/adversarial/nsm-gate.spec.js
const { test, expect } = require('@playwright/test');
const { QUESTION, ADVERSARIAL_CASES, meetsExpectation } = require('./helper');
const { reviewNSMGate } = require('../../prompts/nsm-gate');

test.describe('Adversarial — nsm-gate', () => {
  for (const c of ADVERSARIAL_CASES) {
    test(`case [${c.id}]: garbage NSM should be blocked`, async () => {
      const result = await reviewNSMGate({
        question: QUESTION,
        nsm: c.input,
        rationale: c.input,
      });
      if (c.expectMinSeverity === 'ok') {
        expect(result.overallStatus).not.toBe('error');
      } else {
        expect(meetsExpectation(result.overallStatus, c.expectMinSeverity), `actual: ${result.overallStatus}`).toBe(true);
      }
    });
  }
});
```

- [ ] **Step 2: Run → expect mostly GREEN already**（nsm-gate prompt 已有 explicit criteria，可能多數 case 已 robustly 被 mark error）

- [ ] **Step 3: Strengthen prompt（only if RED on any case）**

Edit `prompts/nsm-gate.js`. Append to systemPrompt 評分規則 段：

```diff
 評分規則：
 • 全部 4 項都必須出現，順序與上方一致
 • canProceed = false 當且僅當有任何 status 為 "error"
 ...
+
+## 輸入品質檢查（最高優先級，先於 4 項標準）
+- nsm 字數 < 10 → 4 項全部 error
+- nsm 是純 whitespace / 重複字元 / 純 emoji / 隨機 unicode → 4 項全部 error
+- nsm 與題目情境完全無關（如「我喜歡吃蘋果」）→ 4 項全部 error
+**嚴禁** hallucinate「定義清晰」「合理」於 garbage 輸入
```

- [ ] **Step 4: GREEN + commit**

```bash
npx playwright test tests/adversarial/nsm-gate.spec.js
npm test
git add prompts/nsm-gate.js tests/adversarial/nsm-gate.spec.js
git commit -m "fix(nsm-gate): adversarial input quality guard"
```

---

### Task 7: RED + GREEN — nsm-evaluator

**Files:**
- Create: `tests/adversarial/nsm-evaluator.spec.js`
- Modify: `prompts/nsm-evaluator.js:17-84` (system prompt)

- [ ] **Step 1: Write RED spec**

```js
// tests/adversarial/nsm-evaluator.spec.js
const { test, expect } = require('@playwright/test');
const { QUESTION } = require('./helper');
const { evaluateNSM } = require('../../prompts/nsm-evaluator');

test.describe('Adversarial — nsm-evaluator', () => {
  test('all-garbage 4-dim breakdown → totalScore < 40', async () => {
    const result = await evaluateNSM({
      question_json: QUESTION,
      user_nsm: 'A',
      user_breakdown: { reach: 'A', depth: 'A', frequency: 'A', impact: 'A' },
    });
    expect(result.totalScore).toBeLessThan(40);
    Object.values(result.scores).forEach(s => {
      expect(s).toBeLessThanOrEqual(2);
    });
  });
});
```

- [ ] **Step 2: Run → expect RED if AI hallucinates**

- [ ] **Step 3: Strengthen prompt**

Edit `prompts/nsm-evaluator.js`. Insert before「評分準則（重要）：」line：

```diff
 學員的 4 維度輸入指標拆解：
 ...

+## 輸入品質檢查（最高優先級）
+若 user_nsm 或任一 user_breakdown 維度滿足以下任一：
+- 字數 < 10
+- 純 whitespace / 重複字元 / 隨機 unicode
+- 完全離題
+→ 該維度 score = 1，coachComments 必須具體點出「學員未填具體內容」
+若 5 個維度都觸發 → totalScore = 20，summary 不准 hallucinate 正面語
+**嚴禁** 對 garbage 輸入回傳 score ≥ 3
+
 評分準則（重要）：
```

- [ ] **Step 4: GREEN + commit**

```bash
npx playwright test tests/adversarial/nsm-evaluator.spec.js
npm test
git add prompts/nsm-evaluator.js tests/adversarial/nsm-evaluator.spec.js
git commit -m "fix(nsm-evaluator): adversarial input quality guard"
```

---

### Task 8: Frontend minLength validation — Phase 1 form

**Files:**
- Modify: `public/app.js` — Phase 1 submit-bar primary disabled-state computation
- Modify: `public/style.css` — char-counter warn variant
- Create: `tests/visual/min-length-frontend.spec.js`

- [ ] **Step 1: Write failing Playwright spec**

```js
// tests/visual/min-length-frontend.spec.js
const { test, expect } = require('@playwright/test');

test.describe('Frontend minLength validation', () => {
  test('Phase 1 C1: submit disabled until all 4 fields meet floor', async ({ page }) => {
    await page.goto('/?seed=1');
    // ... navigate into C1 drill mode for Spotify Podcast question
    await page.click('[data-mode="drill"]');
    await page.click('[data-step="C1"]');
    await page.click('[data-q-id]:first-child [data-action="start"]');

    // Initial: all empty → submit disabled
    const submit = page.locator('[data-circles-submit]');
    await expect(submit).toBeDisabled();

    // Type 5 chars in first field → still disabled (floor is 50)
    await page.locator('[data-phase1="textarea"]').first().fill('AAAAA');
    await expect(submit).toBeDisabled();

    // Type 50 chars in all 4 fields → enabled
    const longText = '聚焦免費版的廣告體驗，排除付費方案，重點在通勤族每日通勤聽 podcast 的場景';
    for (const ta of await page.locator('[data-phase1="textarea"]').all()) {
      await ta.fill(longText);
    }
    await expect(submit).toBeEnabled();
  });

  test('char-counter shows warn color when below floor', async ({ page }) => {
    await page.goto('/?seed=1');
    // ... navigate into Phase 1
    const ta = page.locator('[data-phase1="textarea"]').first();
    await ta.fill('AAA');
    const counter = page.locator('.char-counter').first();
    const color = await counter.evaluate(el => getComputedStyle(el).color);
    // warn-orange ~rgb(184, 92, 0)
    expect(color).toMatch(/rgb\(18[0-9], 9[0-9], [0-9]+\)/);
  });
});
```

- [ ] **Step 2: Run → expect RED**

Run: `npx playwright test tests/visual/min-length-frontend.spec.js --project=Desktop-1280`

- [ ] **Step 3: Implement minLength compute**

Edit `public/app.js` — find `bindCirclesPhase1` submit-bar disable logic (~line 3094+). Add helper:

```js
  function computePhase1MinLengthBlocked() {
    var stepKey = AppState.circlesMode === 'drill' ? AppState.circlesDrillStep : SIM_STEP_ORDER[AppState.circlesSimStep];
    var stepCfg = CIRCLES_STEP_CONFIG[stepKey];
    if (!stepCfg || !stepCfg.fields) return false;
    var draft = AppState.circlesFrameworkDraft[stepKey] || {};
    return stepCfg.fields.some(function (f) {
      var floor = parseInt((f.minMax || '0-0').split('-')[0], 10);
      var value = (draft[f.key] || '').trim();
      // 重複字元偵測：strip whitespace, all chars same
      var stripped = value.replace(/\s/g, '');
      var isRepeated = stripped.length >= 3 && new Set(stripped.split('')).size === 1;
      return value.length < floor || isRepeated;
    });
  }
```

Wire into existing submit-bar render: `disabled = circlesSubmitting || computePhase1MinLengthBlocked()`.

Add inline tip on disabled-button click:
```js
  document.querySelectorAll('[data-circles-submit][disabled]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var blocked = findFirstBlockedField();
      showInlineTip('請補滿『' + blocked.key + '』(至少 ' + blocked.floor + ' 字)');
    });
  });
```

- [ ] **Step 4: CSS char-counter warn variant**

Edit `public/style.css`. Add:

```css
.char-counter.is-below-floor {
  color: var(--c-warn);
  font-weight: 600;
}
```

Wire in `renderPhase1Field`:
```js
+    var floorN = minMax ? parseInt(minMax.split('-')[0], 10) : 0;
+    var currentLen = (value || '').trim().length;
+    var counterClass = (floorN > 0 && currentLen < floorN) ? 'char-counter is-below-floor' : 'char-counter';
+    var floorSuffix = (floorN > 0 && currentLen < floorN) ? ' (至少 ' + floorN + ' 字)' : '';
-    var counterSpan = idx === 0 ? '<span class="char-counter">0 / ' + max + '</span>' : '';
+    var counterSpan = idx === 0 ? '<span class="' + counterClass + '">' + currentLen + ' / ' + max + floorSuffix + '</span>' : '';
```

- [ ] **Step 5: Run spec → GREEN**

Run: `npx playwright test tests/visual/min-length-frontend.spec.js`

- [ ] **Step 6: Verify happy path not broken**

Run: `npx playwright test tests/visual/circles-phase1.spec.js --project=Desktop-1280` — must remain green

- [ ] **Step 7: Commit**

```bash
git add public/app.js public/style.css tests/visual/min-length-frontend.spec.js
git commit -m "feat(phase1): frontend minLength gate + char-counter warn"
```

---

### Task 9: Frontend minLength — NSM Step 2 + Step 3

**Files:**
- Modify: `public/app.js` — NSM submit-bar disabled logic (already has `canSubmit`)

- [ ] **Step 1: Strengthen NSM Step 2 canSubmit**

Edit `public/app.js:250` (renderNSMStep2):

```diff
   var def = AppState.nsmDefinition || { nsm: '', explanation: '', businessLink: '' };
-  var canSubmit = !!(def.nsm && def.nsm.trim() && def.businessLink && def.businessLink.trim());
+  var canSubmit = nsmFieldOk(def.nsm, 10) && nsmFieldOk(def.explanation, 30) && nsmFieldOk(def.businessLink, 30);
```

Add helper function (near top of NSM render block):

```js
  function nsmFieldOk(value, floor) {
    var v = (value || '').replace(/<[^>]*>/g, '').trim();
    if (v.length < floor) return false;
    var stripped = v.replace(/\s/g, '');
    if (stripped.length >= 3 && new Set(stripped.split('')).size === 1) return false;
    return true;
  }
```

- [ ] **Step 2: Strengthen NSM Step 3 canSubmit**

Edit `public/app.js:320`:

```diff
-  var canSubmit = typeCfg.dims.every(function (d) { return br[d.id] && String(br[d.id]).trim(); });
+  var canSubmit = typeCfg.dims.every(function (d) { return nsmFieldOk(br[d.id], 20); });
```

- [ ] **Step 3: Add Playwright spec for NSM minLength**

Append to `tests/visual/min-length-frontend.spec.js`:

```js
test('NSM Step 2: submit disabled until 3 fields meet floor', async ({ page }) => {
  await page.goto('/?seed=1');
  await page.click('[data-tab="nsm"]');
  await page.click('[data-q-id]:first-child');
  // type "A" in nsm → submit disabled
  await page.fill('[data-nsm-field="nsm"]', 'A');
  await expect(page.locator('[data-nsm-submit]')).toBeDisabled();
  // type long valid → still need other fields
  await page.fill('[data-nsm-field="nsm"]', '每月完成至少一首完整曲目播放的活躍月用戶數');
  await page.locator('[data-nsm-field="explanation"]').fill('用戶完成至少一首完整播放即視為產生核心價值的活躍用戶');
  await page.locator('[data-nsm-field="businessLink"]').fill('NSM 直接驅動廣告播放總時長與訂閱轉換率');
  await expect(page.locator('[data-nsm-submit]')).toBeEnabled();
});
```

- [ ] **Step 4: Run → GREEN + commit**

```bash
npx playwright test tests/visual/min-length-frontend.spec.js
git add public/app.js tests/visual/min-length-frontend.spec.js
git commit -m "feat(nsm): frontend minLength gate Step 2 + Step 3"
```

---

### Task 10: Full sweep + audit doc

**Files:**
- Create: `audit/adversarial-sweep-2026-05-08.md`

- [ ] **Step 1: Run full adversarial sweep**

Run: `npm run test:adversarial`
Expected: 50 cells, ~5-10 minutes total（10 cases × 5 stages × ~5-10s OpenAI each）

- [ ] **Step 2: Capture results into audit doc**

Create `audit/adversarial-sweep-2026-05-08.md` with table:

```md
# Adversarial Input Quality Sweep — 2026-05-08

**Goal:** verify 5 AI review stages all reject 10 adversarial input cases per spec.

## Result Matrix (50 cells)

| Case \\ Stage | circles-gate | circles-evaluator | circles-final-report | nsm-gate | nsm-evaluator |
|---|---|---|---|---|---|
| single-char    | ... | ... | ... | ... | ... |
| repeat-char    | ... | ... | ... | ... | ... |
| ...10 rows...  |     |     |     |     |     |

## Pass count: N / 50

## Failures (if any)
- [ ] case X stage Y: actual=ok, expected=error → action: tighten prompt section ABC

## Cost
- Total OpenAI calls: ~50
- Estimated cost: ~$0.50-2.50 (gpt-4o)
```

- [ ] **Step 3: Commit audit + run jest baseline**

```bash
npm test
git add audit/adversarial-sweep-2026-05-08.md
git commit -m "docs(audit): adversarial sweep 50-cell result"
```

---

### Task 11: CLAUDE.md + handoff sync

**Files:**
- Modify: `CLAUDE.md` — last-updated + 進度狀態列加 Combo C 條
- Modify: `docs/PATH-2-HANDOFF.md` — 加 Combo C completion note

- [ ] **Step 1: Update CLAUDE.md**

Edit `CLAUDE.md` 行首 last-updated + 找「進度狀態」表加一條：

```md
| Combo C — adversarial input quality + frontend minLength | ✅ DONE — 5 prompt 加 ## 輸入品質檢查段（user 親准 Path 2 carve-out）/ 前端 Phase 1 + NSM 2/3 minLength 守門 / `tests/adversarial/` 50-cell sweep 全綠 / `audit/adversarial-sweep-2026-05-08.md` |
```

- [ ] **Step 2: Update PATH-2-HANDOFF.md**

加段「Hotfix E — adversarial input quality (2026-05-08)」描述 root cause + 5 prompt fix + frontend gate + 50-cell sweep。

- [ ] **Step 3: Final commit + push**

```bash
git add CLAUDE.md docs/PATH-2-HANDOFF.md
git commit -m "docs(claude-md): mark Combo C adversarial input quality DONE"
git log --oneline -15
git push origin main
```

---

## Verification gates (whole plan)

- [ ] jest: 143 / 17 skip / 0 fail (no regression)
- [ ] Playwright critical specs: 8 viewport all green (no regression)
- [ ] `npm run test:adversarial`: 50/50 cells pass per expectation
- [ ] `audit/adversarial-sweep-2026-05-08.md` 50-cell table 完整
- [ ] User SOP 6 步親跑（spec §6）

## Rollback plan

If sweep fails after multiple prompt iterations:
1. `git revert` each prompt commit individually
2. Frontend minLength can stay (Layer 1 still beneficial alone)
3. Document failure modes in audit doc + open follow-up

## Cost guard

- adversarial spec uses OpenAI tokens
- npm script `test:adversarial` is opt-in (not in default CI)
- Single sweep: ~$0.50-2.50
- Run cadence: ship-time + when modifying any prompt
