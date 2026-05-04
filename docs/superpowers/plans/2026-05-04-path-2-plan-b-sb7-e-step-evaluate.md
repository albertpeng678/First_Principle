# Plan B SB7 · CIRCLES E 步 — 評估取捨（per-solution × 4-field nested）

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development（opus dispatch sonnet implementer，opus 獨立 cold review，不信 sonnet self-report）

---

## §0.0 PROJECT 鐵則（每個 task 開工前必讀 / 違反一條 = 整 SB 不收）

### 0.0.1 User 嚴苛 standing rules（CLAUDE.md / PATH-2-HANDOFF §3 / MEMORY 提煉 — 一條都不能漏）

1. **品質第一無妥協** — user 2026-05-04 明令：「品質第一 沒有任何妥協餘地 有問題就修」
2. **時刻自我審查** — 每 task 完成後必跑「殺手鐧 3 問」自抽（見 §0.0.4），任一答不出 → 該 task 重做
3. **時刻看 mockup vs production 細節吻合** — 每 task 後 director Read 至少 3 PNG（mobile/tablet/desktop）對 mockup line range 逐 detail 比對；不只看大樣，「細節」吻合才算過
4. **後端 / API / DB / OpenAI prompts / jest 100% 不動** — Path 2 鐵則
5. **17 mockups CONTRACT-LOCKED 視覺契約** — implementer 必對 mockup line range；auditor pixel-diff threshold 0.5%
6. **全 zh-TW** — 對話、commit message、code comment、UI 文案全繁體中文
7. **無 emoji** — 任何 UI / mockup / code / comment / commit message 都不准用 emoji（icons 一律 Phosphor `ph-*`）
8. **字型 system-ui stack** — grade letter A/B/C/D 例外保留 Instrument Serif italic
9. **無紫色** `#5b21b6` — Path 2 用 navy `#1B2D5C`
10. **無黃色 toast / banner** `#FFF8E7` — 警示用 navy 或 warn `#B85C00`
11. **Mockup-as-Spec 嚴格遵守**（spec §5.2）— mockup 偏離 = bundle 不過
12. **LOCKED components 不准重定義** — SB1+ 起既有 BEM class 後續整段 copy 不准 drift
13. **設計前必驗現有產品** — 開工前必 Read production code + Playwright 截 production PNG + 抓 constants/labels；缺一不能動筆
14. **Mockup 產出後必須 Playwright 截圖 + Read PNG 自驗** — Chrome 開給 user 看是 user 評閱不是自驗
15. **驗收必開 port 讓 user 親跑** — plan/bundle 完工等 signoff 必啟 dev server + URL + SOP，不只貼截圖
16. **CLAUDE.md 即時更新**（每次重大事件 Edit）
17. **直推 main 不走 PR branch** — solo workflow，hook 擋 push 時請 user 手動跑/改 settings
18. **Pitch-ready standard** — 1px 對齊嚴格 / 4-grid 間距 / 無 magic 數值
19. **iOS Safari 15-item static checklist** — 任何 mobile UX 改動必走（spec §0.2）
20. **完工前必跑全 SIT/UAT/UI-UX × 全 8 viewport** — director 簽收前必 jest + 全 Playwright project 全綠
21. **每張 PNG ≥ 1 句評論** — Director eyeball walk Layer 6（spec §0.5）
22. **§0.7.1 card-based block pattern** — 多 section 分析用 white bg + 1px rule + trap warn 4% bg；禁紅底 / 禁 12px uppercase eyebrow
23. **5 random questions display** — CIRCLES home + NSM step 1 顯 5 隨機題；reshuffle 重抽 5 不導航（不影響 SB7 但需保持 regression）
24. **Phase 1.5 Gate red item 一律擋路** — drill+sim 一致；無 simulation override（SB7 不直接相關但 E 步提交後流向 1.5 gate 需保持原則）

### 0.0.2 Bundle 完工 4 樣強制產出（缺一 = bundle 不過 / spec §6.2）

1. **jest log** — 不 regression（baseline 157/157）
2. **Playwright log × 8 viewport** — 含 chromium + webkit；至少 Mobile-360 / iPhone-SE / iPhone-14 / iPhone-15-Pro / iPad / Desktop-1280 / Desktop-1440 / Desktop-2560
3. **`tests/visual/diffs/sb7-pixel-diff-report.md`** — Layer 2 mechanical pixel-diff 對 L 步 mockup B baseline（threshold 0.5%；本 SB 因 mockup 不重畫 E 步，故對齊 L pattern + content state diff 預期 3-15%）
4. **`audit/eyeball-plan-b-sb7.md`** — Layer 6 Director eyeball walk doc，每張 PNG ≥ 1 句評論

### 0.0.3 8 層視覺對齊測試 stack（spec §0.5 — 缺一 bundle 不過）

| Layer | 內容 | 本 SB 對應產出 |
|---|---|---|
| 1 | Mockup-as-Spec baseline 凍結 | mockup 03 Section B line 1230-1467（E 沿用 L）|
| 1.1 | Baseline 截圖規範（凍 animation / 等 fonts.ready） | 自動跑於 capture script |
| 2 | Production ↔ Mockup pixel-diff 0.5% | `audit/sb7-pixel-diff-report.md` |
| 3 | Layout invariant assertion 5-10 條 boundingBox | spec test 內加 5 條 invariant |
| 4 | WebKit + Chromium 雙引擎 | 8 viewport project 含 webkit 自動跑 |
| 5 | State matrix 覆蓋率 | 2-sol / 3-sol / desktop with rail / drill (no-op) / sim 各 viewport |
| 6 | Director eyeball walk + 每張 PNG ≥ 1 句評論 | `audit/eyeball-plan-b-sb7.md` |
| 7 | User 真機抽驗 | 完工後等 user 親跑 |
| 8 | Pre-commit + CI gate | 既有 hook + Playwright project 自動跑 |

### 0.0.4 殺手鐧 3 問（user 隨時可打 — 任一答不出 = SB7 重做）

1. **「Read 過 PNG 沒？」** → 須能立刻引出至少 6 PNG 路徑（3 viewport × 2 state — 2-sol + 3-sol）+ 每張 ≥ 1 句評論
2. **「5 條 boundingBox invariant 數字」** → 須立刻列出（sol-card 寬 / 4 fields 等寬 / rail 220px / submit-bar 黏底 1px / phase-body padding 對齊 mockup）
3. **「mockup ↔ production diff 結果？」** → 須引 `audit/sb7-pixel-diff-report.md` 路徑 + 3 viewport diff% 數字

### 0.0.5 Anti-patterns（自動扣分 — 違反一條 SB 重做）

- ❌ subagent 自己寫 spec 自己過（必 director cold review）
- ❌ 用「看起來對齊 / 大致一致」當判斷（必 PNG 機械 diff）
- ❌ test fixture 與 production schema 不符
- ❌ 把 `[object Object]` 漏到 production
- ❌ 自動把 push origin main 改成 PR branch
- ❌ 跳 brainstorming → writing-plans → subagent → verification 鏈條
- ❌ commit 前不跑 jest / Playwright / Read PNG 三件套
- ❌ 主動 `git reset --hard` / `git push --force` 沒問
- ❌ 寫 plan 沒對 mockup line range 整段引

### 0.0.6 開工前 sanity（task 1 啟動前 director 必驗）

- [ ] git status 乾淨 + 在 main branch
- [ ] 開 dev server `PORT=4000 node server.js` 確認 200
- [ ] Read mockup 03 line 785 + line 1466 確認 E 沿用 L 規則
- [ ] Read mockup 03 line 1230-1467 完整 L 步結構（mobile / tablet / desktop）
- [ ] Read app.js renderCirclesPhase1Lstep（line 619-737）+ renderSolCard（line 575-623）
- [ ] Read app.js renderCirclesPhase1Estep 現況 placeholder（line 774-850）
- [ ] Read CIRCLES_STEP_CONFIG.E 現況（line 419-433）
- [ ] Read MEMORY.md 全 standing rules
- [ ] Capture production CIRCLES Phase 1 L 步 + E 步 placeholder 3 viewport 6 PNG（before-state baseline）
- [ ] 確認 SB1-6 LOCKED chunks 名單（§1）

---

**Goal:** 把 `renderCirclesPhase1Estep` placeholder 改成完整的 E 步渲染 — per-solution × 4 evaluation rt-field nested。

**Architecture:**
- E 步「沿用 L 結構」(per mockup 03 line 1466)：每個 sol-card 內 1 個 rt-field 改為 4 個 rt-field
- 4 fields per sol-card：**優點 / 缺點 / 風險與依賴 / 成功指標**（per spec line 509）
- Solutions 數量繼承 L 步 `AppState.circlesPhase1Solutions.length`（2 或 3）— E 步**不能新增方案**，只 evaluate L 步已寫的方案
- Sol name 在 E 步 **唯讀展示**（不再 input — name 已在 L 步定）
- AppState 新增 `circlesPhase1Evaluate: [{advantages, disadvantages, risks, metrics}, ...]` 長度 = solutions.length

**Tech Stack:** vanilla JS render，CSS 整段沿用 L 步 sol-card / 既有 rt-field / phase-head / qchip / progress / submit-bar — **無新 CSS 元件**。

---

## §0. Mockup-as-Spec 鐵則（implementer 必讀）

**Source of truth：** mockup 03 Section B（L 步）line 1230-1467 — E 步沿用此結構。
**作者明示規則：** mockup 03 line 785（總註）+ line 1466（B 區 anno）：
> E 沿用 L 結構（per-solution × 4 fields nested）— 本 mockup 不重畫，但 implementer 必對照 L pattern 並列。

**E 步與 L 步唯一差異：**
| 元件 | L 步 | E 步 |
|---|---|---|
| sol-card__num | 方案一 / 方案二 / 方案三（選擇性）| 同 L（label 隨 idx） |
| sol-card__name-input | input editable + placeholder「方案名稱（10 字內）」 | **唯讀展示** sol.name from L step；無 input；無 remove |
| sol-card 內 field 數量 | 1 個（核心機制 with rt-field）| **4 個**（優點 / 缺點 / 風險與依賴 / 成功指標）|
| sol-add 加方案三 button | 顯示 if solutions.length < 3 | **不渲染**（E 步不可改方案數）|
| sol-card__remove | 顯示 on idx=2 | **不渲染**（E 步不可移除方案）|
| 其他元件 | navbar / progress / phase-head / qchip / submit-bar | 全 LOCKED 沿用 |

---

## §1. LOCKED chunks（implementer 不准重定義）

**從 SB1-6 已 merge / LOCKED 的 CSS / HTML 結構：**
- `.navbar` / `.navbar__icon-btn` / `.navbar__brand` / `.navbar__tabs` / `.navbar__icon-btn--auth-only`（Plan B SB1 + drift fix `84640b6`）
- `.progress` / `.progress__step` / `.step-letter`（Plan A SB2 / SB3 ck'd by SB3）
- `.phase-head` / `.phase-head__num` / `.phase-head__main` / `.phase-head__eyebrow` / `.phase-head__title` / `.phase-head__meta` / `.phase-head__meta-sep` / `.phase-head__meta-extra` / `.save-indicator--saved`（SB3）
- `.qchip` / `.qchip__icon` / `.qchip__main` / `.qchip__company` / `.qchip__title` / `.qchip__caret` / `.qchip-expand` / `.qchip-ana__block` / `.qchip-collapse-btn`（SB3 + SB6 + cold-review fix `914ca02`）
- `.sol-card` / `.sol-card__num` / `.sol-card__name-row` / `.sol-card__name-input` / `.sol-card__optional` / `.sol-card__remove`（SB4，integral 對齊 mockup line 543-607）
- `.field` / `.field__label-row` / `.field__label` / `.field__hint-row` / `.field__hint-link` / `.field-example-toggle` / `.toggle-caret` / `.example-expand`（SB3）
- `.rt-field` / `.rt-field__toolbar` / `.rt-tbtn` / `.rt-textarea`（SB3）
- `.phase-body` / `.phase-body--with-rail` / `.rail` / `.rail__title`（SB4）
- `.submit-bar` / `.submit-bar__left` / `.submit-bar__right` / `.submit-bar__back` / `.btn--ghost` / `.btn--primary`（SB3 + SB4）

**implementer 不能：**
- 新增 sol-card-* class（因為 E 步沿用 L 沒有自己的 BEM 元件）
- 新增 .rt-field-* 子變體（4 fields 各用獨立 .field + .rt-field 同 L）
- 改 phase-body padding / sol-card border / 任何已 LOCKED 的 styles

**implementer 可以：**
- 加極少量新 CSS **僅用於 E 步特殊需求**（例：sol-card 內 4 fields 之間的 spacing — 但若用 `.field` 既有 margin-bottom 就好則不加）
- 新增 `data-circles-e-step-field-idx` 等識別 attribute 給 testbinding

---

## §2. AppState additions

```js
// app.js line ~50（after circlesPhase1Solutions）— 新加：
circlesPhase1Evaluate: [
  { advantages: '', disadvantages: '', risks: '', metrics: '' },
  { advantages: '', disadvantages: '', risks: '', metrics: '' },
],
```

**Init 規則：** 與 `circlesPhase1Solutions` 配對 — 長度始終 = solutions.length。
- 新增方案三（L 步加方案）→ 同步 push 1 entry 到 evaluate
- 移除方案三（L 步點 X）→ 同步 pop 1 entry from evaluate

PERSISTED_KEYS 暫不加（E 步階段 saved indicator 為 SB10 範圍）。

---

## §3. CIRCLES_STEP_CONFIG.E 改寫

**現況（line 419-433）：**
```js
E: {
  ...
  isEplaceholder: true,
  fields: [],
}
```

**新版：**
```js
E: {
  // mockup 03 line 1466 規則 — 沿用 L 結構，per-solution × 4 nested fields
  eyebrow: { sim: 'Phase 1 · 寫框架', drill: 'Phase 1 · 個別步驟練習' },
  title: 'E · 評估取捨',
  titleSimDesktopSuffix: '（每個方案的優缺點 / 風險 / 成功指標）',
  progressLabel: '取捨',
  stepLetter: 'E',
  stepNum: '06',
  isEstep: true,  // 從 isEplaceholder 改名
  railTitle: 'E 步重點',
  railIntro: '誠實寫每個方案的優缺點、風險、成功指標',
  railBody: '不要只挑優點 — 寫缺點和風險才能看出對 trade-off 的理解。風險與依賴要具體（不是「可能會失敗」這種空話）；成功指標必須量化可測。',
  railTitle2: '為何要評估每個方案',
  railBody2: '面試官不是在看你選哪個 — 是看你怎麼判斷取捨。寫得越誠實，越能展現產品 sense。',
  // 4 sub-fields nested per sol-card
  perSolFields: [
    { key: 'advantages',    label: '優點',         placeholder: '本方案最強的 1-2 個優勢，能解決什麼用戶痛點',                 minMax: '40-150', max: 150, rows: 3 },
    { key: 'disadvantages', label: '缺點',         placeholder: '本方案的限制或副作用 — 哪些用戶體驗會變差，哪些情況不適用', minMax: '40-150', max: 150, rows: 3 },
    { key: 'risks',         label: '風險與依賴',   placeholder: '技術 / 人力 / 時程 / 第三方依賴 — 具體列出，不要寫「可能會失敗」', minMax: '40-150', max: 150, rows: 3 },
    { key: 'metrics',       label: '成功指標',     placeholder: '如何驗證方案有效 — 定量指標 + 觀察期（如：30 天內 +5pp 留存）', minMax: '30-100', max: 100, rows: 2 },
  ],
}
```

`renderCirclesPhase1` 既有 `if (stepCfg.isEplaceholder)` line 1062 改成 `if (stepCfg.isEstep)`.

---

## §4. File Structure

**Files to modify:**
- `public/app.js` — line 419-433 改寫 CIRCLES_STEP_CONFIG.E + line 774-850 改寫 renderCirclesPhase1Estep + line 1062 isEplaceholder→isEstep + line 50 AppState additions

**Files to create:**
- `tests/visual/phase1-e-step.spec.js` — TDD spec（紅燈先驗，再 implement，後綠燈）

**Files NOT modified:**
- `public/style.css` — 完全不動（無新 CSS 需求）
- `public/index.html` — 無變動

---

## §5. Tasks

### Task 1: AppState + CIRCLES_STEP_CONFIG.E 改寫

**Files:**
- Modify: `public/app.js:50` (AppState `circlesPhase1Evaluate`)
- Modify: `public/app.js:419-433` (CIRCLES_STEP_CONFIG.E)
- Modify: `public/app.js:1062` (`isEplaceholder` → `isEstep`)

- [ ] **Step 1.1: AppState `circlesPhase1Evaluate` 加入**

```js
// after line 49 (circlesPhase1Solutions array close):
circlesPhase1Evaluate: [
  { advantages: '', disadvantages: '', risks: '', metrics: '' },
  { advantages: '', disadvantages: '', risks: '', metrics: '' },
],
```

- [ ] **Step 1.2: CIRCLES_STEP_CONFIG.E 改寫**（替換 line 419-433 整段）

```js
E: {
  eyebrow: { sim: 'Phase 1 · 寫框架', drill: 'Phase 1 · 個別步驟練習' },
  title: 'E · 評估取捨',
  titleSimDesktopSuffix: '（每個方案的優缺點 / 風險 / 成功指標）',
  progressLabel: '取捨',
  stepLetter: 'E',
  stepNum: '06',
  isEstep: true,
  railTitle: 'E 步重點',
  railIntro: '誠實寫每個方案的優缺點、風險、成功指標',
  railBody: '不要只挑優點 — 寫缺點和風險才能看出對 trade-off 的理解。風險與依賴要具體（不是「可能會失敗」這種空話）；成功指標必須量化可測。',
  railTitle2: '為何要評估每個方案',
  railBody2: '面試官不是在看你選哪個 — 是看你怎麼判斷取捨。寫得越誠實，越能展現產品 sense。',
  perSolFields: [
    { key: 'advantages',    label: '優點',         placeholder: '本方案最強的 1-2 個優勢，能解決什麼用戶痛點',                 minMax: '40-150', max: 150, rows: 3 },
    { key: 'disadvantages', label: '缺點',         placeholder: '本方案的限制或副作用 — 哪些用戶體驗會變差，哪些情況不適用', minMax: '40-150', max: 150, rows: 3 },
    { key: 'risks',         label: '風險與依賴',   placeholder: '技術 / 人力 / 時程 / 第三方依賴 — 具體列出，不要寫「可能會失敗」', minMax: '40-150', max: 150, rows: 3 },
    { key: 'metrics',       label: '成功指標',     placeholder: '如何驗證方案有效 — 定量指標 + 觀察期（如：30 天內 +5pp 留存）', minMax: '30-100', max: 100, rows: 2 },
  ],
  fields: [],  // legacy compat — renderCirclesPhase1 base 路徑不會走到這
},
```

- [ ] **Step 1.3: line 1062 `isEplaceholder` 改 `isEstep`**

```js
if (stepCfg && stepCfg.isEstep) {
  return renderCirclesPhase1Estep(q, stepKey, stepCfg, currentStepNum);
}
```

- [ ] **Step 1.4: Commit**

```bash
git add public/app.js
git commit -m "feat(plan-b-sb7): AppState circlesPhase1Evaluate + CIRCLES_STEP_CONFIG.E schema

per spec line 509 + mockup 03 line 1466:
E 步 per-solution × 4 fields nested — 優點 / 缺點 / 風險與依賴 / 成功指標.
isEplaceholder rename → isEstep.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 1.5: Task 1 自審 gate（缺一不過）**

- [ ] AppState 新欄位 key 命名與 perSolFields key 一致（advantages / disadvantages / risks / metrics — 全 lowercase 英文）
- [ ] 4 fields 全 zh-TW label，無 emoji，無紫色，無黃色
- [ ] CIRCLES_STEP_CONFIG.E 與既有 C1/I/R/C2/L/S 命名 convention 一致
- [ ] line 1062 `isEplaceholder` → `isEstep` 替換確認 grep 全 codebase 無殘留
- [ ] commit message zh-TW 主標題 + bullet + Co-Authored-By
- [ ] git log 看 commit 在 main / 一 commit 一 task

---

### Task 2: TDD red — write phase1-e-step.spec.js

**Files:**
- Create: `tests/visual/phase1-e-step.spec.js`

- [ ] **Step 2.1: 寫 4 紅燈 spec**

```js
// tests/visual/phase1-e-step.spec.js
// SB7 — CIRCLES E step (per-solution × 4-field nested)
// Mockup: 03 line 1466 規則 — 沿用 L 結構
const { test, expect } = require('@playwright/test');

test.describe('B SB7 E step — per-sol 4-field nested', () => {

  async function gotoEStep(page) {
    await page.route('**/api/circles-stats**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"completed":0,"active":0,"weeklyCompleted":0}' }));
    await page.route('**/api/circles-sessions**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('**/api/guest-circles-sessions**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('**/api/nsm-sessions**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('**/api/guest/nsm-sessions**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.goto('/');
    await page.waitForSelector('.qcard');
    await page.locator('.mode-card').nth(0).click();  // sim
    await page.locator('.qcard').first().click();
    await page.locator('.qcard__btn--primary').click();
    await page.waitForSelector('.phase-head');
    // jump straight to E step
    await page.evaluate(() => {
      window.AppState.circlesSimStep = 5;  // E step idx = 5
      window.renderApp();
    });
    await page.waitForSelector('.sol-card');
  }

  test('E step renders 2 sol-cards by default (matches L step solutions count)', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await gotoEStep(page);
    await expect(page.locator('.sol-card')).toHaveCount(2);
    await expect(page.locator('.sol-card__num').nth(0)).toContainText('方案一');
    await expect(page.locator('.sol-card__num').nth(1)).toContainText('方案二');
  });

  test('E step phase-head__num is 06 and progress E is active', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await gotoEStep(page);
    await expect(page.locator('.phase-head__num')).toHaveText('06');
    await expect(page.locator('.progress__step.is-active .step-letter')).toHaveText('E');
  });

  test('Each sol-card contains exactly 4 rt-fields (優點/缺點/風險與依賴/成功指標)', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await gotoEStep(page);
    const firstCard = page.locator('.sol-card').nth(0);
    await expect(firstCard.locator('.rt-field')).toHaveCount(4);
    await expect(firstCard.locator('.field__label').nth(0)).toHaveText('優點');
    await expect(firstCard.locator('.field__label').nth(1)).toHaveText('缺點');
    await expect(firstCard.locator('.field__label').nth(2)).toHaveText('風險與依賴');
    await expect(firstCard.locator('.field__label').nth(3)).toHaveText('成功指標');
  });

  test('E step does not render sol-add or sol-card__remove (cannot edit solution count)', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await gotoEStep(page);
    await expect(page.locator('.sol-add')).toHaveCount(0);
    await expect(page.locator('.sol-card__remove')).toHaveCount(0);
  });

  test('E step sol-card name is read-only (no input element)', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await gotoEStep(page);
    // L step had .sol-card__name-input, E step doesn't
    await expect(page.locator('.sol-card__name-input')).toHaveCount(0);
    // E step shows name as text (new class .sol-card__name-display) OR within sol-card__num
    // implementer choose pattern; either way no <input>
  });

  test('desktop renders rail with E 步重點', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 1100 });
    await gotoEStep(page);
    await expect(page.locator('.rail')).toBeVisible();
    await expect(page.locator('.rail__title').first()).toHaveText('E 步重點');
  });

  test('desktop sim base E step qchip__company shows 設計題 · 難度 suffix', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 1100 });
    await gotoEStep(page);
    const company = await page.locator('.qchip__company').textContent();
    expect(company).toContain('設計題');
  });

  test('typing in E step textarea persists to AppState.circlesPhase1Evaluate', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await gotoEStep(page);
    await page.locator('.sol-card').nth(0).locator('.rt-textarea').nth(0).fill('提升用戶留存');
    await page.waitForTimeout(200);
    const state = await page.evaluate(() => window.AppState.circlesPhase1Evaluate[0].advantages);
    expect(state).toBe('提升用戶留存');
  });
});
```

- [ ] **Step 2.2: Run red — verify all fail**

```bash
npx playwright test tests/visual/phase1-e-step.spec.js --config=tests/visual/playwright.config.js --project=Mobile-360
```
Expected: 8 fail（因 renderCirclesPhase1Estep 還是 placeholder）

- [ ] **Step 2.3: Task 2 自審 gate（缺一不過）**

- [ ] 8 spec 全 zh-TW 描述 + 引 mockup line range 註解
- [ ] 紅燈 reason message 須包含「expected」字眼或精確錯誤點 — 不是「testTimeout」這類含糊
- [ ] 每 spec 用 `data-circles-e-*` attribute 找元素，**不**用 nth-child 或 visual-index
- [ ] regression：跑 phase1-l-step.spec.js + phase1-s-step.spec.js + circles-home.spec.js 確認既有 spec 不破

---

### Task 3: 改寫 renderCirclesPhase1Estep — full implementation

**Files:**
- Modify: `public/app.js:774-850` (替換 placeholder render 為完整版)

- [ ] **Step 3.1: 替換 renderCirclesPhase1Estep**

```js
// ── renderCirclesPhase1Estep: E step (Plan B SB7 — mockup 03 Section B 沿用 / line 1466) ──
function renderCirclesPhase1Estep(q, stepKey, stepCfg, currentStepNum) {
  var mode = AppState.circlesMode || 'simulation';
  var isDrill = mode === 'drill';  // E step 不 drill but keep guard
  var isDesktop = window.innerWidth >= 1024;

  var progressHtml = isDrill ? '' : renderProgressBar(stepKey);

  // phase-head — sim mobile = save only / tablet+ = save + 完整模擬 N/7
  var eyebrow = isDrill ? stepCfg.eyebrow.drill : stepCfg.eyebrow.sim;
  var titleHtml = stepCfg.title;
  if (isDesktop && !isDrill && stepCfg.titleSimDesktopSuffix) {
    titleHtml = stepCfg.title + '<span class="phase-head__title-extra">' + escHtml(stepCfg.titleSimDesktopSuffix) + '</span>';
  }
  var metaHtml;
  if (isDrill) {
    metaHtml = '<span class="phase-head__meta">'
      + '<span class="save-indicator save-indicator--saved"><i class="ph ph-check"></i>已儲存</span>'
      + '</span>';
  } else {
    metaHtml = '<span class="phase-head__meta">'
      + '<span class="save-indicator save-indicator--saved"><i class="ph ph-check"></i>已儲存</span>'
      + '<span class="phase-head__meta-sep phase-head__meta-extra">·</span>'
      + '<span class="phase-head__meta-extra">完整模擬 · ' + currentStepNum + ' / 7 步</span>'
      + '</span>';
  }
  var phaseHeadHtml = '<div class="phase-head">'
    + '<span class="phase-head__num">' + escHtml(stepCfg.stepNum) + '</span>'
    + '<div class="phase-head__main">'
    + '<div class="phase-head__eyebrow">' + escHtml(eyebrow) + '</div>'
    + '<div class="phase-head__title">' + titleHtml + '</div>'
    + '</div>'
    + metaHtml
    + '</div>';

  // qchip — desktop sim adds suffix（match L step / DRIFT 2 pattern）
  var company = (q && q.company) ? q.company : '';
  var product = (q && q.product) ? q.product : '';
  var companyBaseHtml = escHtml(company) + (product ? ' · ' + escHtml(product) : '');
  var diff = (q && q.difficulty) === 'high' ? '高' : (q && q.difficulty) === 'low' ? '低' : '中';
  var qType = (q && q.question_type) === 'improve' ? '改善題' : (q && q.question_type) === 'strategy' ? '策略題' : '設計題';
  var companyDisplayHtml = (isDesktop || isDrill)
    ? companyBaseHtml + ' · ' + escHtml(qType) + ' · 難度 ' + escHtml(diff)
    : companyBaseHtml;
  var qTitle = (q && q.problem_statement) ? q.problem_statement : '';
  var chipExpanded = AppState.circlesChipExpanded === true;
  var qchipClass = 'qchip' + (chipExpanded ? ' is-expanded' : '');
  var caretIcon = chipExpanded ? 'ph-caret-up' : 'ph-caret-down';
  var qchipHtml = '<div class="' + qchipClass + '" data-phase1="qchip-toggle">'
    + '<span class="qchip__icon"><i class="ph ph-info"></i></span>'
    + '<div class="qchip__main">'
    + '<div class="qchip__company">' + companyDisplayHtml + '</div>'
    + '<div class="qchip__title">' + escHtml(qTitle) + '</div>'
    + '</div>'
    + '<i class="ph ' + caretIcon + ' qchip__caret"></i>'
    + '</div>'
    + (chipExpanded ? renderQchipExpand(q) : '');

  // sol-cards — 數量 = circlesPhase1Solutions.length
  var solutions = AppState.circlesPhase1Solutions || [];
  // ensure circlesPhase1Evaluate length matches
  if (!Array.isArray(AppState.circlesPhase1Evaluate)) AppState.circlesPhase1Evaluate = [];
  while (AppState.circlesPhase1Evaluate.length < solutions.length) {
    AppState.circlesPhase1Evaluate.push({ advantages: '', disadvantages: '', risks: '', metrics: '' });
  }
  while (AppState.circlesPhase1Evaluate.length > solutions.length) {
    AppState.circlesPhase1Evaluate.pop();
  }

  var solCardsHtml = solutions.map(function (sol, solIdx) {
    return renderEsolCard(solIdx, sol, stepCfg.perSolFields);
  }).join('');

  // phase-body — desktop sim uses --with-rail
  var useRail = !isDrill && isDesktop;
  var phaseBodyClass = 'phase-body' + (useRail ? ' phase-body--with-rail' : '');
  var phaseBodyHtml;
  if (useRail) {
    phaseBodyHtml = '<div class="' + phaseBodyClass + '">'
      + '<div>' + solCardsHtml + '</div>'
      + renderRail(stepCfg)
      + '</div>';
  } else {
    phaseBodyHtml = '<div class="' + phaseBodyClass + '">' + solCardsHtml + '</div>';
  }

  // submit-bar
  var ghostHtml = '';
  if (!isDrill) {
    ghostHtml = '<button class="btn btn--ghost submit-bar__back" data-phase1="back">'
      + '<i class="ph ph-arrow-left"></i>上一步'
      + '</button>';
  }
  var submitBarHtml = '<div class="submit-bar">'
    + '<div class="submit-bar__left">' + ghostHtml + '</div>'
    + '<div class="submit-bar__right">'
    + '<button class="btn btn--primary" data-phase1="submit">下一步<i class="ph ph-arrow-right"></i></button>'
    + '</div>'
    + '</div>';

  return '<div data-view="circles" data-circles-phase="1" data-circles-e-step="true">'
    + progressHtml
    + phaseHeadHtml
    + qchipHtml
    + phaseBodyHtml
    + submitBarHtml
    + '</div>';
}

// ── renderEsolCard: E 步 per-sol card with 4 nested fields ──
function renderEsolCard(solIdx, sol, perSolFields) {
  var isOptional = solIdx === 2;
  var numLabel = solIdx === 0 ? '方案一' : solIdx === 1 ? '方案二' : '方案三';
  var numHtml = isOptional
    ? numLabel + ' <span class="sol-card__optional">（選擇性）</span>'
    : numLabel;
  var solName = (sol && sol.name) ? sol.name : '';
  // E 步：name 唯讀 — 用 sol-card__num 之下另一行 div 顯示
  var nameDisplayHtml = solName
    ? '<div class="sol-card__name-display" style="font-size: var(--t-body); font-weight: 500; color: var(--c-ink); margin-bottom: var(--s-3);">' + escHtml(solName) + '</div>'
    : '<div class="sol-card__name-display" style="font-size: var(--t-meta); color: var(--c-ink-3); margin-bottom: var(--s-3); font-style: italic;">（未命名方案）</div>';

  // 4 nested fields
  var fieldsHtml = perSolFields.map(function (f, fIdx) {
    return ''
      + '<div class="field" style="margin-bottom: var(--s-4);">'
      +   '<div class="field__label-row">'
      +     '<label class="field__label">' + escHtml(f.label) + '</label>'
      +     '<div class="field__hint-row">'
      +       '<button class="field__hint-link"><i class="ph ph-lightbulb"></i>提示</button>'
      +       '<button class="field-example-toggle" aria-expanded="false"><i class="ph ph-quotes"></i>範例答案<i class="ph ph-caret-down toggle-caret"></i></button>'
      +     '</div>'
      +   '</div>'
      +   '<div class="rt-field">'
      +     '<div class="rt-field__toolbar">'
      +       '<button class="rt-tbtn"><i class="ph ph-text-b"></i></button>'
      +       '<button class="rt-tbtn"><i class="ph ph-list-bullets"></i></button>'
      +     '</div>'
      +     '<textarea class="rt-textarea" rows="' + f.rows + '" placeholder="' + escHtml(f.placeholder) + '" data-circles-e-sol-idx="' + solIdx + '" data-circles-e-field-key="' + f.key + '" data-max="' + f.max + '"></textarea>'
      +   '</div>'
      +   '<div class="field__meta" style="font-size: var(--t-cap); color: var(--c-ink-3); margin-top: 2px;">建議 ' + f.minMax + ' 字</div>'
      + '</div>';
  }).join('');

  return '<div class="sol-card">'
    + '<div class="sol-card__num">' + numHtml + '</div>'
    + nameDisplayHtml
    + fieldsHtml
    + '</div>';
}
```

- [ ] **Step 3.2: 加 textarea binding（input event → AppState.circlesPhase1Evaluate）**

在 `bindCirclesPhase1` 或對應 binder 加：
```js
// E step textarea binding — data-circles-e-sol-idx + data-circles-e-field-key
document.querySelectorAll('[data-circles-e-sol-idx]').forEach(function (el) {
  el.addEventListener('input', function () {
    var solIdx = parseInt(el.getAttribute('data-circles-e-sol-idx'), 10);
    var key = el.getAttribute('data-circles-e-field-key');
    if (!AppState.circlesPhase1Evaluate[solIdx]) {
      AppState.circlesPhase1Evaluate[solIdx] = { advantages: '', disadvantages: '', risks: '', metrics: '' };
    }
    AppState.circlesPhase1Evaluate[solIdx][key] = el.value;
  });
});
```

- [ ] **Step 3.3: Run green — verify all 8 spec pass**

```bash
npx playwright test tests/visual/phase1-e-step.spec.js --config=tests/visual/playwright.config.js --project=Mobile-360 --project=iPad --project=Desktop-1280
```
Expected: 24 / 24 pass（8 spec × 3 viewport）

- [ ] **Step 3.4: Commit**

```bash
git add public/app.js tests/visual/phase1-e-step.spec.js
git commit -m "feat(plan-b-sb7): renderCirclesPhase1Estep — per-sol × 4-field nested

mockup 03 line 1466 規則 — E 沿用 L 結構：
- 2-3 個 sol-card（數量 = AppState.circlesPhase1Solutions.length）
- 每張 sol-card 內 4 nested rt-field：優點 / 缺點 / 風險與依賴 / 成功指標
- sol name 唯讀展示（不再 input — name 在 L 步定）
- 不渲染 sol-add / sol-card__remove（E 步不可改方案數）
- desktop 顯 rail 含 E 步重點 + 為何要評估每個方案
- desktop sim base qchip__company 加「· 設計題 · 難度 中」對齊 SB6 cold-review fix
- AppState.circlesPhase1Evaluate auto-sync solutions length
- textarea input event → AppState binding

TDD red→green 8 spec × 3 viewport = 24/24 pass

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 3.5: Task 3 自審 gate（缺一不過 — sonnet 自審後 director 再 cold review）**

- [ ] grep `isEplaceholder` 全 codebase 應只在 plan / commit message 出現，code 內 0 殘留
- [ ] grep `console.log` / `debugger` 確認無殘留
- [ ] grep emoji（用 `\\p{Emoji}` 或檢查 `🟢🟡🔴✅❌` 等）— code 內 0 殘留（commit message 也禁）
- [ ] grep 紫色 hex `#5b21b6`/`#a855f7`/`purple` — code 內 0 殘留
- [ ] grep 黃色 toast hex `#FFF8E7` — code 內 0 殘留
- [ ] 4 fields key/label/placeholder line-by-line 對 plan §3 表格
- [ ] sol name 唯讀邏輯（無 `<input>` element）grep 確認
- [ ] sol-add / sol-card__remove 在 E 步 render 內 0 出現
- [ ] desktop sim base qchip__company suffix 對齊 SB6 fix（grep `companyDisplayHtml = (isDesktop || isDrill)`）
- [ ] phase-head__title-extra desktop suffix 顯「（每個方案的優缺點 / 風險 / 成功指標）」
- [ ] textarea data-circles-e-sol-idx + data-circles-e-field-key 命名一致
- [ ] AppState binding：input event 後 console.log 確認 state 寫入

---

### Task 4: Full regression × 8 viewport + jest sanity

- [ ] **Step 4.1: Run jest**

```bash
npx jest --silent
```
Expected: 157/157（140 pass + 17 skip）

- [ ] **Step 4.2: Run full Playwright regression**

```bash
npx playwright test tests/visual/circles-home.spec.js tests/visual/phase1-form.spec.js tests/visual/phase1-l-step.spec.js tests/visual/phase1-s-step.spec.js tests/visual/phase1-e-step.spec.js tests/visual/phase1-qchip-expand.spec.js --config=tests/visual/playwright.config.js
```
Expected: ≥ 424 + (8 × 8) - existing partial coverage = 計算後填數字（director cold review 補）

- [ ] **Step 4.3: 啟動 dev server**

```bash
PORT=4000 node server.js &
```

- [ ] **Step 4.4: Task 4 自審 gate**

- [ ] jest 數字精確 = 157（不是「~」「大概」「全綠」這類含糊）
- [ ] Playwright 數字精確列出 total / 8 viewport 各 project 數
- [ ] 既有 SB1-6 spec 全綠（grep 跑 phase1-form / phase1-l-step / phase1-s-step / phase1-qchip-expand / circles-home）
- [ ] 跑 webkit project（不只 chromium）

---

### Task 5: Director cold review（opus 接手 — sonnet 不做 / 對標 user 嚴苛規則）

opus 會獨立跑（不信 sonnet self-report，每一條都重 verify）：

#### 5.1 「設計前必驗現有產品」delta — 對 SB7 後 production 重新 verify
- [ ] 開 `/` → 完整模擬 → 選題 → Phase 1 form → 強制跳 simStep=5（E step）
- [ ] Read production code `renderCirclesPhase1Estep` final 版本
- [ ] grep 確認 isEplaceholder 0 殘留 / sol-card__name-input 在 E 步 render 內 0 出現

#### 5.2 Layer 1.1 baseline 截圖 — 3 viewport × N state
- [ ] mobile-360 × 2-sol / mobile-360 × 3-sol / tablet-768 × 2-sol / tablet-768 × 3-sol / desktop-1280 × 2-sol / desktop-1280 × 3-sol = **6 PNG 最少**
- [ ] 每張 capture 前確認 fonts.ready / animations 凍 frame 0

#### 5.3 Layer 2 mechanical pixel-diff
- [ ] 寫 `tests/visual/sb7-section-pixel-diff.spec.js` 對 mockup 03 Section B line 1230-1467（L 步 baseline）
- [ ] 預期 diff% 高於 SB6（5-20% 因 4 fields × N sol 內容差），但結構必須對齊
- [ ] 報告寫 `audit/sb7-pixel-diff-report.md` 含 3 viewport 數字 + 解讀

#### 5.4 Layer 3 boundingBox invariant — 列 5-10 條
- [ ] sol-card 寬 = phase-body inner 寬（mobile/tablet）or `1fr` col 寬（desktop）
- [ ] sol-card 內 4 fields 等寬
- [ ] rail 桌面寬 220px
- [ ] submit-bar sticky bottom（`position: sticky; bottom: 0`）
- [ ] phase-body padding 對齊 mockup line 1251 / 1319 / 1390 各 viewport
- [ ] sol-card 之間 vertical gap ≥ var(--s-4)

#### 5.5 Layer 5 state matrix — 全狀態覆蓋
- [ ] 2-sol 預設
- [ ] 3-sol （L 步加方案三後）
- [ ] empty-fields 預設
- [ ] partial-filled
- [ ] desktop-with-rail
- [ ] mobile/tablet no-rail

#### 5.6 Layer 6 Director eyeball walk — 每張 PNG ≥ 1 句評論
- [ ] 每張 6+ PNG 在 `audit/eyeball-plan-b-sb7.md` Layer 6 表格寫 director 評論
- [ ] 評論必引 mockup line range（例：「對齊 mockup line 1320-1370 sol-card 結構，4 fields 順序正確」）
- [ ] 評論不可寫「看起來對齊 / 大致一致」這類含糊詞

#### 5.7 「時刻看 mockup vs production 細節吻合」逐項對照
director 必逐條 line-by-line 比對：
- [ ] navbar：mockup 03 line 1237 vs production
- [ ] progress：mockup line 1239 vs production（E 步 active）
- [ ] phase-head：mockup line 1240-1248 vs production（num=06 / title=E·評估取捨 / meta sim suffix）
- [ ] qchip：mockup line 1249 vs production（desktop 含 suffix）
- [ ] sol-card 結構：mockup line 1253-1297 vs production（每張 num + name display + 4 fields）
- [ ] field 結構：mockup line 1258-1273 vs production（label-row + hint-row + rt-field + meta）
- [ ] rail：mockup line 1445-1452 vs production（railTitle / railIntro / railBody / hr / railTitle2 / railBody2）
- [ ] submit-bar：mockup line 1455-1458 vs production

#### 5.8 殺手鐧 3 問自抽（必過）
- [ ] Q1「Read 過 PNG 沒？」 → 寫出 6 PNG 路徑 + 每張評論
- [ ] Q2「5 條 boundingBox invariant 數字」 → 寫出 5 條與實測數字
- [ ] Q3「mockup ↔ production diff 結果？」 → 引 sb7-pixel-diff-report 路徑 + 3 vp 數字

#### 5.9 4 樣強制產出（缺一不過）
- [ ] jest log
- [ ] Playwright log × 8 viewport
- [ ] `audit/sb7-pixel-diff-report.md`
- [ ] `audit/eyeball-plan-b-sb7.md`

---

## §6. 完工驗收

| # | 產出 | 路徑 |
|---|---|---|
| 1 | jest log | 157/157 不 regression |
| 2 | Playwright log | tests/visual/phase1-e-step.spec.js + 全 regression × 8 viewport |
| 3 | pixel-diff report | `audit/sb7-pixel-diff-report.md`（vs L step mockup B baseline）|
| 4 | eyeball walk doc | `audit/eyeball-plan-b-sb7.md` |
| 5 | dev server live | `PORT=4000 node server.js` 給 user 親跑 SOP |

## §7. 殺手鐧 3 問備答

1. **「Read 過 PNG 沒？」** → mobile-360 / tablet-768 / desktop-1280 × 2-sol + 3-sol = 6 PNG，全 director Read 評論於 Layer 6
2. **「5 條 boundingBox invariant」** → sol-card 寬 = phase-body inner / 4 fields 等寬 / rail 220px / submit-bar 黏底 / phase-body padding 對齊 mockup
3. **「mockup ↔ production diff 結果？」** → `audit/sb7-pixel-diff-report.md`，vs L step mockup B baseline 因 E 步沿用 L 結構（mockup 03 line 1466）

## §8. 自我審查 checklist（director 必過 — 缺一條 SB7 重做）

### 功能 / 結構吻合
- [ ] mockup 03 line 1466 引述：E 沿用 L 結構 verified
- [ ] sol-cards 數量 = solutions.length 隨 L 步動態
- [ ] 4 fields per sol-card 順序為 優點/缺點/風險與依賴/成功指標
- [ ] sol-card__name-input 不渲染（唯讀展示 name）
- [ ] sol-add / sol-card__remove 不渲染
- [ ] desktop sim base qchip__company 含「· 設計題 · 難度 中」（SB6 fix 對齊）
- [ ] desktop phase-head__title-extra 顯「（每個方案的優缺點 / 風險 / 成功指標）」
- [ ] desktop phase-body--with-rail + 雙段 rail（railTitle / railTitle2）
- [ ] mobile/tablet phase-body 直式無 rail
- [ ] tablet+desktop submit-bar 含上一步 ghost；mobile 無
- [ ] AppState.circlesPhase1Evaluate auto-sync solutions length
- [ ] textarea input → AppState binding (8 textareas × 2 sols = 16 bindings, 3 sols = 24)

### Standing rules 對齊（§0.0.1 24 條對表）
- [ ] 全 zh-TW（UI 文案 / commit / comment）
- [ ] 0 emoji
- [ ] 0 紫色 / 0 黃色 toast
- [ ] 字型 system-ui（無 Instrument Serif 例外於 SB7 範圍 — 因 E 步無 grade letter）
- [ ] 後端 / API / DB / prompts / jest 0 改動
- [ ] LOCKED 元件 0 重定義（grep 確認既有 BEM class 無 redefinition）
- [ ] 1px 對齊 / 4-grid 間距 / 無 magic 數值
- [ ] iOS Safari 15-item static checklist 走過（spec §0.2）
- [ ] CLAUDE.md / PATH-2-HANDOFF.md / master-spec.md 三份文件 sync 完成
- [ ] 直推 main（非 PR branch）

### 4 樣強制產出（§0.0.2）
- [ ] jest log（精確數字）
- [ ] Playwright log × 8 viewport（含 webkit）
- [ ] `audit/sb7-pixel-diff-report.md`（3 vp 數字）
- [ ] `audit/eyeball-plan-b-sb7.md`（每張 PNG ≥ 1 句評論 / 引 mockup line range）

### 8 層測試 stack（§0.0.3）
- [ ] L1 baseline freeze 對 mockup 03 Section B line 1230-1467
- [ ] L1.1 截圖規範（fonts.ready / animations 凍）
- [ ] L2 pixel-diff 0.5% threshold（state diff 預期 5-20%）
- [ ] L3 boundingBox invariant 5-10 條
- [ ] L4 webkit + chromium 雙引擎
- [ ] L5 state matrix 6+ 狀態
- [ ] L6 director eyeball walk（每張 PNG ≥ 1 句評論）
- [ ] L7 user 真機抽驗（pending user signoff）
- [ ] L8 pre-commit + CI gate（既有 hook 自動跑）

### 殺手鐧 3 問（§0.0.4）— 任一答不出 SB7 重做
- [ ] Q1 PNG 路徑 + 評論
- [ ] Q2 5 條 boundingBox 實測數字
- [ ] Q3 pixel-diff 報告路徑 + 數字

### 「時刻看 mockup vs production 細節吻合」逐 detail 對照
- [ ] navbar / progress / phase-head / qchip / sol-card / field / rail / submit-bar 8 大區塊全 line-by-line 比對 mockup line range（不只看大樣 — 細節吻合才算過）
- [ ] director Read 至少 6 PNG（3 vp × 2 state）+ 3 mockup capture PNG = 9 PNG 最少
- [ ] director eyeball walk doc 不可有「看起來對齊 / 大致一致」含糊詞

### Anti-patterns 檢查（§0.0.5）— 0 出現
- [ ] subagent self-report 不當 ground truth
- [ ] 0 含糊判斷詞
- [ ] test fixture 與 production schema 一致
- [ ] commit 前完整跑 jest + Playwright + Read PNG 三件套

### Honesty disclosure（如有偷工 / 跳步驟）
- [ ] 任何「我以為已驗 / 但其實沒驗」必寫進 eyeball walk doc 末段「Honest dishonesty disclosure」
- [ ] 任何 carry-forward drift 必列入 PATH-2-HANDOFF §8.5
