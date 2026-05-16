# Stage 1A — Gate Cluster (B1 + B6) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix B1 (gate accepts garbage like `Y/Y/Y/Y`) + B6 (gate occasionally skipped) by adding a 2-layer defense (FE pre-guard + BE prompt strict) and a single-tab `gateInflight` mutex; ship behind 30+ TDD specs across 3 layers (unit / API contract / E2E) and an adversarial sweep.

**Architecture:** Layer 1 = FE `frameworkValidator` (pure functions, jest-tested). Layer 2 = `prompts/circles-gate.js` strict rules + 4 few-shot. Mutex = `AppState.gateInflight` (in-memory) at 3 entry points. E2E uses Stage 0 storageState + auto-cleanup fixture.

**Tech Stack:** Node.js + vanilla JS app + jest (unit) + Playwright (`request` for API contract / `page` for E2E) + existing `prompts/circles-gate.js` LLM prompt + existing `npm run test:adversarial`.

**Branch:** `main` (per memory `feedback_push_directly_to_main`)

**Spec reference:** `docs/superpowers/specs/2026-05-16-stage-1a-gate-cluster-design.md`

---

## File Structure

### New files

- `public/lib/frameworkValidator.js` — 4 pure functions
- `tests/unit/framework-validator.test.js` — ~15 jest specs
- `tests/setup/auth.setup.js` — UI-login → storageState
- `tests/factories/circles-phase1.factory.js` — 3 input pools
- `tests/page-objects/circles-phase1.page.js` — POM
- `tests/e2e/circles-gate.spec.js` — 5 E2E specs
- `tests/api/circles-gate-contract.spec.js` — 6 API contract specs
- `tests/e2e/playwright.config.js` — new Playwright config (E2E + API project + setup project)

### Modified files

- `public/app.js` — wire validator + add `gateInflight` mutex at 3 sites
- `prompts/circles-gate.js` — quality rules + 4 few-shot ⚠️ carve-out
- `.gitignore` — add `playwright/.auth/` if missing
- `package.json` — add `test:e2e:gate` script
- `CLAUDE.md` — state board update at end

---

## Execution Order

```
Phase 1 (sequential): Test infra (Tasks 1–4)
Phase 2 (sequential): FE validator + wire (Tasks 5–6)
Phase 3 (sequential): BE prompt strict + API contract verify (Tasks 7–9, ⚠️ carve-out)
Phase 4 (sequential): Mutex + E2E race spec (Tasks 10–11)
Phase 5 (sequential): E2E happy/sad path + visual baseline (Task 12)
Phase 6 (sequential): Cross-vp regression + iOS review + cold-Read + ship (Tasks 13–15)
```

All tasks sequential — each depends on the prior. No parallel lanes.

---

## Task 1: Setup project — auth.setup.js (UI-login → storageState)

**Files:**
- Create: `tests/setup/auth.setup.js`
- Verify: `.env.local` exists with `BASE_URL=http://localhost:3000` + `TEST_EMAIL=e2e@first-principle.test` + `TEST_PASSWORD=<16-char>`

**Why:** Login once via real UI, save `playwright/.auth/user.json`, reuse storageState across all gate-cluster specs (10–100× faster than per-test login).

- [ ] **Step 1: Verify `.env.local` has all 3 keys**

```bash
node -e "require('dotenv').config({path:'.env.local'}); console.log({BASE_URL:!!process.env.BASE_URL, TEST_EMAIL:!!process.env.TEST_EMAIL, TEST_PASSWORD:!!process.env.TEST_PASSWORD})"
```
Expected: `{ BASE_URL: true, TEST_EMAIL: true, TEST_PASSWORD: true }`

If any false, copy from `.env.test` first or report BLOCKED.

- [ ] **Step 2: Verify dev server can be started**

```bash
ls server.js && echo "server.js exists"
```
Expected: `server.js exists`. (Implementer must NOT start server here; just verify path. The setup project will start it via webServer config.)

- [ ] **Step 3: Create `tests/setup/auth.setup.js`**

```js
const { test: setup, expect } = require('@playwright/test');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env', override: false });
const path = require('path');
const { assertNotProdWithRealAccount } = require('../helpers/env-guard');

const AUTH_FILE = path.join(__dirname, '..', '..', 'playwright', '.auth', 'user.json');

setup('authenticate as e2e@first-principle.test', async ({ page }) => {
  // Defense-in-depth: refuse to run UI-login against prod with real account
  assertNotProdWithRealAccount({
    baseUrl: process.env.BASE_URL,
    email: process.env.TEST_EMAIL,
  });

  await page.goto('/');
  // Trigger login UI — adjust selectors to match real app
  await page.getByRole('button', { name: /登入|Login/ }).first().click();
  await page.getByLabel(/Email|電子郵件/).fill(process.env.TEST_EMAIL);
  await page.getByLabel(/密碼|Password/).fill(process.env.TEST_PASSWORD);
  await page.getByRole('button', { name: /登入|Login|送出/ }).click();
  // Wait for post-login state
  await expect(page.locator('[data-app-state="logged-in"], [data-user-email]')).toBeVisible({ timeout: 10_000 });

  await page.context().storageState({ path: AUTH_FILE });
});
```

NOTE: Selector strings (`getByRole({name:/登入|Login/})`) are best-guess. Implementer must adjust to actual app DOM after running the spec once and inspecting via `npx playwright codegen http://localhost:3000`.

- [ ] **Step 4: Add `playwright/.auth/` to `.gitignore` (if absent)**

```bash
grep -q "^playwright/.auth/" .gitignore || echo "playwright/.auth/" >> .gitignore
grep -q "^playwright-report/" .gitignore || echo "playwright-report/" >> .gitignore
grep -q "^test-results/" .gitignore || echo "test-results/" >> .gitignore
```

- [ ] **Step 5: Commit**

```bash
git add tests/setup/auth.setup.js .gitignore
git commit -m "feat(stage-1a): tests/setup/auth.setup.js — storageState foundation

UI-logs in e2e@first-principle.test (Stage 0 ship) once per worker, saves
to playwright/.auth/user.json. Downstream specs reuse via storageState =
10-100x faster than per-test login per playwright-skill core/authentication.md."
```

---

## Task 2: Factory — circles-phase1.factory.js (3 input pools)

**Files:**
- Create: `tests/factories/circles-phase1.factory.js`

**Why:** Centralize realistic zh-TW form inputs (per memory `feedback_e2e_real_data_only` — never stub timestamp strings). 3 pools mirror the spec's input classes: garbage / thin / quality.

- [ ] **Step 1: Create `tests/factories/circles-phase1.factory.js`**

```js
// 3 input pools for Phase 1 form (8 fields = I.×4 + C1.×4).
// All values are realistic zh-TW content drawn from rotation pools (no stub timestamps).

const I_FIELDS = ['排除對象', '目標用戶分群', '選定焦點對象', '用戶動機假設(JTBD)'];
const C1_FIELDS = ['假設確認', '問題範圍', '時間範圍', '業務影響'];

// Garbage: trips Layer 1 (FE pre-guard). Mix of all 3 fail modes.
const GARBAGE_POOL = ['Y', 'YYYY', 'asdf', '上班族', '....', '1111', 'aaaa', '   '];

// Thin: passes Layer 1 (≥ 4 chars + has Chinese), fails Layer 2 semantically (no specific noun/verb/range).
const THIN_POOL = [
  '上班族男',
  '需要的事',
  '重要問題',
  '感覺很好',
  '應該注意',
  '可能會有',
  '這個那個',
  '某些事情',
];

// Quality: passes both layers. Realistic CIRCLES Phase 1 answers.
const QUALITY_POOL = [
  '20-35 歲都會區上班族女性，月薪 4-8 萬',
  '通勤時段每日早上 7-9 點使用大眾運輸',
  '排除非智慧型手機用戶與 60 歲以上長者',
  '希望在通勤時利用零碎時間學習新技能',
  '近 6 個月活躍用戶留存率下降 12%',
  '產品上線首月 + 後續 3 個月觀察期',
  '業務目標：提升次月留存率 ≥ 70%',
  '假設：簡化 onboarding 流程可降低首日流失',
];

function pick(pool, n) {
  return pool.slice(0, n);
}

function makePayload(values8) {
  return {
    I: Object.fromEntries(I_FIELDS.map((k, i) => [k, values8[i] || ''])),
    C1: Object.fromEntries(C1_FIELDS.map((k, i) => [k, values8[i + 4] || ''])),
  };
}

function garbage() { return makePayload(pick(GARBAGE_POOL, 8)); }
function thin()    { return makePayload(pick(THIN_POOL, 8)); }
function quality() { return makePayload(pick(QUALITY_POOL, 8)); }

module.exports = { garbage, thin, quality, I_FIELDS, C1_FIELDS };
```

- [ ] **Step 2: Smoke test**

```bash
node -e "const f = require('./tests/factories/circles-phase1.factory'); console.log(JSON.stringify(f.quality(), null, 2))"
```
Expected: JSON with `I` (4 keys) and `C1` (4 keys), all string values.

- [ ] **Step 3: Commit**

```bash
git add tests/factories/circles-phase1.factory.js
git commit -m "feat(stage-1a): factory for Phase 1 form inputs — garbage/thin/quality pools

3 realistic zh-TW pools mirror spec §6 input classes. Per memory
feedback_e2e_real_data_only: no stub timestamps, all faker-style realistic content."
```

---

## Task 3: POM — circles-phase1.page.js

**Files:**
- Create: `tests/page-objects/circles-phase1.page.js`

**Why:** 5+ specs across 3+ files will use the Phase 1 form → past POM threshold (per `pom/page-object-model.md`).

- [ ] **Step 1: Create `tests/page-objects/circles-phase1.page.js`**

```js
const { I_FIELDS, C1_FIELDS } = require('../factories/circles-phase1.factory');

class CirclesPhase1Page {
  constructor(page) {
    this.page = page;
    this.submitButton = page.getByRole('button', { name: /送出評估|送出|submit/i }).first();
    this.gateLoading  = page.locator('[data-gate-loading]');
    this.gateResult   = page.locator('[data-gate-result]');
    this.gateStatus   = page.locator('[data-gate-overall-status]');
  }

  async goto(questionId = 'circles_001') {
    await this.page.goto(`/?circles=${questionId}`);
    // Adjust route to actual app URL pattern
  }

  // values: { I: { '排除對象': '...', ... }, C1: { ... } }
  async fillI(values) {
    for (const field of I_FIELDS) {
      const v = (values && values[field]) || '';
      await this.page.getByLabel(new RegExp(field)).first().fill(v);
    }
  }
  async fillC1(values) {
    for (const field of C1_FIELDS) {
      const v = (values && values[field]) || '';
      await this.page.getByLabel(new RegExp(field)).first().fill(v);
    }
  }
  async fillAll(payload) {
    if (payload.I)  await this.fillI(payload.I);
    if (payload.C1) await this.fillC1(payload.C1);
  }

  async submitGate() {
    await this.submitButton.click();
  }

  async submitGateRapidDouble() {
    await this.submitButton.dblclick();
  }

  // Returns 'ok' | 'warn' | 'error' | null
  async getGateStatus() {
    const txt = await this.gateStatus.textContent({ timeout: 10_000 }).catch(() => null);
    if (!txt) return null;
    if (/error|錯誤|不通過/i.test(txt)) return 'error';
    if (/warn|警告/i.test(txt)) return 'warn';
    if (/ok|pass|通過/i.test(txt)) return 'ok';
    return null;
  }
}

module.exports = { CirclesPhase1Page };
```

NOTE: Selectors are best-guess. Implementer adjusts after `playwright codegen` walk-through. **Zero assertions inside POM** (per `pom/page-object-model.md`) — getter returns raw status; spec asserts.

- [ ] **Step 2: Commit**

```bash
git add tests/page-objects/circles-phase1.page.js
git commit -m "feat(stage-1a): POM for CIRCLES Phase 1 form

Constructor takes Page; locators readonly; methods fillI/fillC1/submitGate/
getGateStatus. Zero assertions inside per pom/page-object-model.md."
```

---

## Task 4: Playwright config — `tests/e2e/playwright.config.js`

**Files:**
- Create: `tests/e2e/playwright.config.js`
- Modify: `package.json` — add `test:e2e:gate` script

**Why:** Isolated config for new e2e + api projects with setup dependency + storageState reuse + CI knobs.

- [ ] **Step 1: Create `tests/e2e/playwright.config.js`**

```js
const { defineConfig, devices } = require('@playwright/test');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const AUTH_FILE = path.join(__dirname, '..', '..', 'playwright', '.auth', 'user.json');

module.exports = defineConfig({
  testDir: '.',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['blob']] : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  webServer: {
    command: 'PORT=3000 node server.js',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },

  projects: [
    // 1. Setup project — UI-login once, save storageState
    {
      name: 'setup',
      testMatch: /tests\/setup\/auth\.setup\.js/,
      use: { ...devices['Desktop Chrome'] },
    },

    // 2. API contract project — no browser, fastest layer
    {
      name: 'api-contract',
      testMatch: /circles-gate-contract\.spec\.js/,
      // No storageState — API specs build their own auth via fetch
    },

    // 3. E2E project — desktop chrome
    {
      name: 'e2e-desktop',
      testMatch: /circles-gate\.spec\.js/,
      use: { ...devices['Desktop Chrome'], storageState: AUTH_FILE },
      dependencies: ['setup'],
    },

    // 4. E2E project — mobile chrome (for race + reflow)
    {
      name: 'e2e-mobile-chrome',
      testMatch: /circles-gate\.spec\.js/,
      use: { ...devices['Pixel 5'], storageState: AUTH_FILE },
      dependencies: ['setup'],
    },

    // 5. E2E project — mobile WebKit (per memory feedback_ios_review_before_ship)
    {
      name: 'e2e-mobile-safari',
      testMatch: /circles-gate\.spec\.js/,
      use: { ...devices['iPhone 14'], storageState: AUTH_FILE },
      dependencies: ['setup'],
    },
  ],
});
```

- [ ] **Step 2: Add `test:e2e:gate` script to `package.json`**

Read current `package.json` scripts block, append:
```json
"test:e2e:gate": "playwright test --config tests/e2e/playwright.config.js",
"test:e2e:gate:ui": "playwright test --config tests/e2e/playwright.config.js --ui"
```

- [ ] **Step 3: Verify config parses (no specs yet → expects 0 tests)**

```bash
npx playwright test --config tests/e2e/playwright.config.js --list 2>&1 | tail -10
```
Expected: lists 0 tests (no spec files yet) or auth.setup.js only — no parse errors.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/playwright.config.js package.json
git commit -m "feat(stage-1a): Playwright config with setup/api/e2e × 3-vp projects

CI knobs: forbidOnly + retries + reporter via process.env.CI.
storageState reused from auth.setup.js across 3 e2e projects (desktop /
mobile-chrome / iPhone-14 WebKit). webServer auto-starts node server.js."
```

---

## Task 5: FE validator — frameworkValidator.js + 15 jest specs (IL-3 cycle)

**Files:**
- Create: `public/lib/frameworkValidator.js`
- Create: `tests/unit/framework-validator.test.js`

**Why:** Layer 1 pre-guard. Pure functions, zero deps, unit-testable.

- [ ] **Step 1: Write failing test (RED)**

Create `tests/unit/framework-validator.test.js`:
```js
const {
  minLength,
  notAllSameChar,
  notTrivialAsciiToken,
  validateFrameworkInput,
} = require('../../public/lib/frameworkValidator');

describe('minLength', () => {
  test.each([
    ['',        false],
    ['Y',       false],
    ['YY',      false],
    ['YYY',     false],
    ['YYYY',    true],
    ['上班族',  false],
    ['上班族男', true],
    ['  abc  ', false],   // trim then length
  ])('minLength(%j, 4) === %s', (v, expected) => {
    expect(minLength(v, 4)).toBe(expected);
  });
});

describe('notAllSameChar', () => {
  test.each([
    ['aaaa',  false],
    ['1111',  false],
    ['....',  false],
    ['    ',  false],
    ['aabb',  true],
    ['上班上', true],
    ['',      true],   // empty passes (other rule catches)
  ])('notAllSameChar(%j) === %s', (v, expected) => {
    expect(notAllSameChar(v)).toBe(expected);
  });
});

describe('notTrivialAsciiToken', () => {
  test.each([
    // Trivial: ≤4 chars, ASCII only, no spaces, no Chinese
    ['Y',       false],
    ['asdf',    false],
    ['1234',    false],
    ['abcd',    false],
    // Non-trivial: has Chinese OR has space OR > 4 chars
    ['上班族', true],
    ['ab cd',  true],     // has space
    ['hello',  true],     // > 4 chars
    ['上班族男', true],
    ['Y is a brand', true],
  ])('notTrivialAsciiToken(%j) === %s', (v, expected) => {
    expect(notTrivialAsciiToken(v)).toBe(expected);
  });
});

describe('validateFrameworkInput', () => {
  const goodValues = {
    I: {
      '排除對象': '排除非智慧型手機用戶與長者',
      '目標用戶分群': '20-35 歲都會區上班族',
      '選定焦點對象': '通勤時段使用大眾運輸',
      '用戶動機假設(JTBD)': '希望利用零碎時間學新技能',
    },
    C1: {
      '假設確認': '簡化 onboarding 可降低首日流失',
      '問題範圍': '近 6 個月活躍用戶留存率下降 12%',
      '時間範圍': '上線首月 + 後續 3 個月觀察',
      '業務影響': '提升次月留存率 ≥ 70%',
    },
  };

  test('all 8 quality values → ok=true, errors=[]', () => {
    const r = validateFrameworkInput(goodValues);
    expect(r.ok).toBe(true);
    expect(r.errors).toEqual([]);
  });

  test('one field with "Y" → ok=false, errors lists that field with rule=minLength', () => {
    const v = JSON.parse(JSON.stringify(goodValues));
    v.I['排除對象'] = 'Y';
    const r = validateFrameworkInput(v);
    expect(r.ok).toBe(false);
    expect(r.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: 'I.排除對象', rule: 'minLength' }),
    ]));
  });

  test('one field with "aaaa" → fails notAllSameChar', () => {
    const v = JSON.parse(JSON.stringify(goodValues));
    v.C1['業務影響'] = 'aaaa';
    const r = validateFrameworkInput(v);
    expect(r.ok).toBe(false);
    expect(r.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: 'C1.業務影響', rule: 'notAllSameChar' }),
    ]));
  });

  test('one field with "asdf" → fails notTrivialAsciiToken', () => {
    const v = JSON.parse(JSON.stringify(goodValues));
    v.I['目標用戶分群'] = 'asdf';
    const r = validateFrameworkInput(v);
    expect(r.ok).toBe(false);
    expect(r.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: 'I.目標用戶分群', rule: 'notTrivialAsciiToken' }),
    ]));
  });

  test('all 8 fields with "Y" → 8 errors, all minLength', () => {
    const allY = {
      I: { '排除對象': 'Y', '目標用戶分群': 'Y', '選定焦點對象': 'Y', '用戶動機假設(JTBD)': 'Y' },
      C1: { '假設確認': 'Y', '問題範圍': 'Y', '時間範圍': 'Y', '業務影響': 'Y' },
    };
    const r = validateFrameworkInput(allY);
    expect(r.ok).toBe(false);
    expect(r.errors).toHaveLength(8);
    expect(r.errors.every((e) => e.rule === 'minLength')).toBe(true);
  });

  test('values with extra unrecognized field → ignored, no error', () => {
    const v = JSON.parse(JSON.stringify(goodValues));
    v.I.junkField = 'Y';
    const r = validateFrameworkInput(v);
    expect(r.ok).toBe(true);
  });

  test('null / undefined values handled gracefully', () => {
    expect(validateFrameworkInput(null).ok).toBe(false);
    expect(validateFrameworkInput(undefined).ok).toBe(false);
    expect(validateFrameworkInput({}).ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run jest — verify FAIL (RED-1)**

```bash
npx jest tests/unit/framework-validator.test.js 2>&1 | tail -8
```
Expected: FAIL with `Cannot find module '../../public/lib/frameworkValidator'`. CAPTURE.

- [ ] **Step 3: Write minimal implementation**

Create `public/lib/frameworkValidator.js`:
```js
// Layer 1 pre-guard: catches obvious garbage before POST /api/circles-evaluator/gate.
// Pure functions, zero deps. Unit-tested via jest.

const { I_FIELDS, C1_FIELDS } = (() => {
  // Mirror tests/factories/circles-phase1.factory.js field order.
  // Hardcoded here to avoid runtime dep on test file.
  return {
    I_FIELDS: ['排除對象', '目標用戶分群', '選定焦點對象', '用戶動機假設(JTBD)'],
    C1_FIELDS: ['假設確認', '問題範圍', '時間範圍', '業務影響'],
  };
})();

function minLength(value, n) {
  if (typeof value !== 'string') return false;
  return value.trim().length >= n;
}

function notAllSameChar(value) {
  if (typeof value !== 'string' || value.length === 0) return true;
  const trimmed = value.trim();
  if (trimmed.length === 0) return false;  // all-whitespace = all same
  const first = trimmed[0];
  return !trimmed.split('').every((c) => c === first);
}

function notTrivialAsciiToken(value) {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (trimmed.length > 4) return true;             // long enough → not trivial
  if (/[一-鿿]/.test(trimmed)) return true; // has Chinese → not trivial
  if (/\s/.test(trimmed)) return true;             // has space → not trivial
  return false; // ≤ 4 ASCII chars, no Chinese, no space → trivial
}

function validateFrameworkInput(values) {
  const errors = [];
  if (!values || typeof values !== 'object') {
    return { ok: false, errors: [{ field: '_root', rule: 'shape', message: 'values is required' }] };
  }
  const sections = [['I', I_FIELDS], ['C1', C1_FIELDS]];
  for (const [section, fields] of sections) {
    const sectionVals = values[section] || {};
    for (const field of fields) {
      const v = sectionVals[field];
      if (typeof v !== 'string' || v.trim().length === 0) {
        errors.push({ field: `${section}.${field}`, rule: 'minLength', message: '此欄位為必填' });
        continue;
      }
      if (!minLength(v, 4)) {
        errors.push({ field: `${section}.${field}`, rule: 'minLength', message: '需 ≥ 4 字' });
        continue;
      }
      if (!notAllSameChar(v)) {
        errors.push({ field: `${section}.${field}`, rule: 'notAllSameChar', message: '不能全部同字元' });
        continue;
      }
      if (!notTrivialAsciiToken(v)) {
        errors.push({ field: `${section}.${field}`, rule: 'notTrivialAsciiToken', message: '請更具體（避免單字英數）' });
        continue;
      }
    }
  }
  return { ok: errors.length === 0, errors };
}

module.exports = {
  minLength,
  notAllSameChar,
  notTrivialAsciiToken,
  validateFrameworkInput,
};
```

- [ ] **Step 4: Run jest — verify PASS (GREEN-1)**

```bash
npx jest tests/unit/framework-validator.test.js 2>&1 | tail -8
```
Expected: All ~30 sub-tests PASS (8 minLength + 7 notAllSame + 9 notTrivial + 7 validateInput). CAPTURE.

- [ ] **Step 5: IL-3 revert-cycle (verify specs catch regression)**

```bash
mv public/lib/frameworkValidator.js public/lib/frameworkValidator.js.bak
echo "module.exports = { minLength: ()=>true, notAllSameChar: ()=>true, notTrivialAsciiToken: ()=>true, validateFrameworkInput: ()=>({ok:true,errors:[]}) };" > public/lib/frameworkValidator.js
npx jest tests/unit/framework-validator.test.js 2>&1 | tail -8
```
Expected: Multiple FAIL — stub `()=>true` makes all rejection-checking specs fail. CAPTURE.

Restore:
```bash
mv public/lib/frameworkValidator.js.bak public/lib/frameworkValidator.js
npx jest tests/unit/framework-validator.test.js 2>&1 | tail -8
```
Expected: All PASS again. CAPTURE.

- [ ] **Step 6: Commit with red-green-revert evidence**

```bash
git add public/lib/frameworkValidator.js tests/unit/framework-validator.test.js
git commit -m "$(cat <<'EOF'
feat(stage-1a): frameworkValidator.js — Layer 1 FE pre-guard for B1

4 pure fns: minLength(v,n=4) / notAllSameChar / notTrivialAsciiToken +
validateFrameworkInput aggregator returning {ok, errors:[{field,rule,message}]}.

Defense-in-depth Layer 1 catches Y/Y/Y/Y, aaaa, asdf at submit time
without burning a network round-trip on obvious garbage.

Red-green-revert evidence:
- Initial red:    Cannot find module
- Initial green:  ~30 sub-tests PASS
- Revert red:     stub ()=>true makes all rejection specs FAIL
- Restore green:  ~30 PASS

Implements: docs/superpowers/specs/2026-05-16-stage-1a-gate-cluster-design.md §3
EOF
)"
```

---

## Task 6: Wire validator + mutex into `public/app.js submitFrameworkToGate`

**Files:**
- Modify: `public/app.js` (around `submitFrameworkToGate` near line 7375)

**Why:** Connect Layer 1 + acquire mutex before POST.

- [ ] **Step 1: Read current `submitFrameworkToGate`**

```bash
grep -n "function submitFrameworkToGate\|submitFrameworkToGate = " public/app.js | head -3
```
Capture line number. Read 50 lines around it to understand existing flow.

- [ ] **Step 2: Add import + mutex state**

Near top of `public/app.js` (after existing requires / AppState block):
- Add to AppState init: `gateInflight: false,`
- (No new top-level require needed — vanilla JS browser script; load via `<script>` tag in `index.html`. Verify validator is loaded before app.js — see Step 3.)

- [ ] **Step 3: Add `<script>` tag for validator in `public/index.html`**

```bash
grep -n "app.js" public/index.html | head -3
```
Add `<script src="lib/frameworkValidator.js"></script>` BEFORE the line that loads `app.js`.

- [ ] **Step 4: Modify `submitFrameworkToGate` (insert pre-guard + mutex acquire)**

At function entry, before any existing logic:
```js
function submitFrameworkToGate() {
  // Race guard (B6): refuse duplicate submit while gate inflight.
  if (AppState.gateInflight) {
    console.warn('[gate] submit blocked — gate inflight');
    return;
  }

  // Layer 1 pre-guard (B1): catch garbage without burning a POST.
  const values = AppState.circlesFrameworkDraft;  // adapt to actual field
  const validation = window.frameworkValidator.validateFrameworkInput(values);
  if (!validation.ok) {
    renderInlineFrameworkErrors(validation.errors);
    return;
  }
  clearInlineFrameworkErrors();

  // Acquire mutex
  AppState.gateInflight = true;
  setSubmitButtonDisabled(true);

  // ... existing POST logic ...
}
```

- [ ] **Step 5: Modify gate response handler (release mutex)**

In the `.then()` / `await` block that processes gate response:
```js
.finally(() => {
  AppState.gateInflight = false;
  setSubmitButtonDisabled(false);
});
```

- [ ] **Step 6: Add inline error renderers**

```js
function renderInlineFrameworkErrors(errors) {
  // Group errors by field
  const byField = {};
  for (const e of errors) byField[e.field] = byField[e.field] || [];
  for (const e of errors) byField[e.field].push(e.message);

  // Find each field's input element + render error below
  for (const [field, msgs] of Object.entries(byField)) {
    const input = document.querySelector(`[data-circles-field="${field}"]`);
    if (!input) continue;
    let errEl = input.parentElement.querySelector('.framework-error');
    if (!errEl) {
      errEl = document.createElement('div');
      errEl.className = 'framework-error';
      errEl.style.cssText = 'color:#c00;font-size:12px;margin-top:4px;';
      input.parentElement.appendChild(errEl);
    }
    errEl.textContent = msgs.join(' / ');
  }
}

function clearInlineFrameworkErrors() {
  document.querySelectorAll('.framework-error').forEach((el) => el.remove());
}

function setSubmitButtonDisabled(disabled) {
  const btn = document.querySelector('[data-action="submit-framework-gate"]');
  if (btn) btn.disabled = disabled;
}
```

NOTE: `[data-circles-field="..."]` and `[data-action="submit-framework-gate"]` selectors must match real markup. Implementer must add `data-circles-field` attribute to each Phase 1 input + `data-action` attribute to submit button. If existing markup uses different selectors, adapt.

- [ ] **Step 7: Manual smoke test**

Start dev server:
```bash
PORT=3000 node server.js &
SERVER_PID=$!
sleep 3
curl -fs http://localhost:3000/ > /dev/null && echo "server up"
```

Open browser to http://localhost:3000, log in, navigate to a CIRCLES question, fill all 8 fields with `Y`, click submit. Expected: inline error "需 ≥ 4 字" appears next to each field; no network request fires.

```bash
kill $SERVER_PID
```

- [ ] **Step 8: Commit**

```bash
git add public/app.js public/index.html
git commit -m "feat(stage-1a): wire frameworkValidator + gateInflight mutex into submitFrameworkToGate

- Layer 1 pre-guard runs before POST; inline errors per field on fail
- AppState.gateInflight (in-memory, never persisted) prevents B6 rapid-double-submit race
- submit button disabled during inflight, re-enabled on response (success or fail)
- Includes setSubmitButtonDisabled / renderInlineFrameworkErrors helpers

Manual smoke: Y/Y/Y/Y triggers inline errors, no POST fired.

Carve-out scope: only public/app.js + public/index.html (script tag). Backend/prompts unchanged in this task."
```

---

## Task 7: BE prompt strict — `prompts/circles-gate.js` ⚠️ CARVE-OUT

**Files:**
- Modify: `prompts/circles-gate.js`

**Why:** Layer 2 semantic check. User explicitly approved this carve-out in brainstorm Q2 (Level 2).

- [ ] **Step 1: Read current prompt structure**

```bash
cat prompts/circles-gate.js | head -80
```

Note: existing 14-box rules + overallStatus calc.

- [ ] **Step 2: Add new quality rules + few-shot block**

Edit `prompts/circles-gate.js`. After the existing rules section, append:

```
\n
新增品質檢查（Layer 2）：
- 答案需含具體名詞（人群名 / 場景名 / 產品名 / 指標名）+ 動詞 + 範圍 / 數量描述。
- 答案若為敷衍（單字 / 純標點 / 無語意 token / 抽象詞如「重要」「需要」「感覺」）→ 該 box overallStatus = 'error'。
- 答案若多 box 含模糊詞但不到敷衍程度 → 該 box overallStatus = 'warn'。

Few-shot 範例：

✅ Good 1：
  目標用戶分群: "20-35 歲都會區上班族女性，月薪 4-8 萬"
  → overallStatus: 'ok'（具體年齡、地域、職業、收入）

✅ Good 2：
  業務影響: "提升次月留存率 ≥ 70%"
  → overallStatus: 'ok'（具體指標 + 量化範圍）

❌ Bad 1：
  目標用戶分群: "Y"
  業務影響: "Y"
  → 各 box overallStatus: 'error'（單字無語意）

❌ Bad 2：
  目標用戶分群: "上班族男"
  業務影響: "重要的事"
  → 各 box overallStatus: 'warn' or 'error'（過於抽象 / 無數量 / 無範圍）
```

- [ ] **Step 3: Verify prompt still parses + adversarial sweep doesn't regress**

```bash
node -e "const p = require('./prompts/circles-gate'); console.log(typeof p, Object.keys(p))"
```
Expected: prints export shape (no parse error).

- [ ] **Step 4: Commit (defer adversarial sweep run to Task 9)**

```bash
git add prompts/circles-gate.js
git commit -m "feat(stage-1a): tighten circles-gate prompt — quality rules + 4 few-shot

Layer 2 semantic check (B1). Adds:
- Quality rules: must contain specific noun + verb + range/quantity
- Stub/abstract → overallStatus=error
- Vague (重要/需要/感覺) → overallStatus=warn
- 4 few-shot: 2 good (concrete answers) + 2 bad (Y / abstract)

⚠️ Carve-out: user-approved 2026-05-16 in brainstorm Q2 = Level 2.
Adversarial sweep verification follows in Task 9."
```

---

## Task 8: API contract specs — `tests/api/circles-gate-contract.spec.js`

**Files:**
- Create: `tests/api/circles-gate-contract.spec.js`

**Why:** Verify BE prompt response shape × 3 input classes WITHOUT browser overhead.

- [ ] **Step 1: Create spec**

```js
const { test, expect } = require('@playwright/test');
const factory = require('../factories/circles-phase1.factory');
const { assertNotProdWithRealAccount } = require('../helpers/env-guard');
require('dotenv').config({ path: '.env.local' });

const BASE_URL = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');

test.beforeAll(async () => {
  assertNotProdWithRealAccount({ baseUrl: BASE_URL, email: process.env.TEST_EMAIL });
});

async function login(request) {
  // Use real auth flow — adapt if app exposes /api/auth/login
  // For now, assume auth.setup.js storageState covers token via Supabase REST
  // If a test-only token endpoint exists, use it
  // Fallback: register endpoint already POSTs to Supabase admin createUser
  return process.env.REAL_ACCESS_TOKEN || null;
}

async function postGate(request, frameworkDraft, token) {
  return request.post(`${BASE_URL}/api/circles-evaluator/gate`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    data: { frameworkDraft, sessionId: 'test-' + Date.now() },
  });
}

test.describe('POST /api/circles-evaluator/gate — contract', () => {
  test('garbage input → overallStatus=error', async ({ request }) => {
    const token = await login(request);
    test.skip(!token, 'REAL_ACCESS_TOKEN not provided');
    const res = await postGate(request, factory.garbage(), token);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('overallStatus');
    expect(body.overallStatus).toBe('error');
  });

  test('thin input → overallStatus=warn or error', async ({ request }) => {
    const token = await login(request);
    test.skip(!token, 'REAL_ACCESS_TOKEN not provided');
    const res = await postGate(request, factory.thin(), token);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(['warn', 'error']).toContain(body.overallStatus);
  });

  test('quality input → overallStatus=ok', async ({ request }) => {
    const token = await login(request);
    test.skip(!token, 'REAL_ACCESS_TOKEN not provided');
    const res = await postGate(request, factory.quality(), token);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.overallStatus).toBe('ok');
  });

  test('response shape — items array present', async ({ request }) => {
    const token = await login(request);
    test.skip(!token, 'REAL_ACCESS_TOKEN not provided');
    const res = await postGate(request, factory.quality(), token);
    const body = await res.json();
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.items.length).toBeGreaterThanOrEqual(1);
  });

  test('items shape — each has box + status + comment', async ({ request }) => {
    const token = await login(request);
    test.skip(!token, 'REAL_ACCESS_TOKEN not provided');
    const res = await postGate(request, factory.quality(), token);
    const body = await res.json();
    for (const item of body.items) {
      expect(item).toHaveProperty('box');
      expect(item).toHaveProperty('status');
      expect(['ok', 'warn', 'error']).toContain(item.status);
    }
  });

  test('401 without auth token', async ({ request }) => {
    const res = await postGate(request, factory.quality(), null);
    expect(res.status()).toBe(401);
  });
});
```

- [ ] **Step 2: Run against local server (with REAL_ACCESS_TOKEN env if available)**

```bash
PORT=3000 node server.js &
SERVER_PID=$!
sleep 3
REAL_ACCESS_TOKEN=<paste-token-from-browser> npx playwright test --config tests/e2e/playwright.config.js --project=api-contract 2>&1 | tail -10
kill $SERVER_PID
```
Expected: All 6 specs PASS (or skip if no token; skip is acceptable in CI without token).

- [ ] **Step 3: Commit**

```bash
git add tests/api/circles-gate-contract.spec.js
git commit -m "feat(stage-1a): API contract specs for /api/circles-evaluator/gate

6 specs cover: garbage→error / thin→warn|error / quality→ok / response shape /
items shape / 401 without auth. Uses Playwright request context (no browser).
test.skip() if REAL_ACCESS_TOKEN absent (graceful CI fallback)."
```

---

## Task 9: Adversarial sweep verify (existing `npm run test:adversarial`)

**Files:**
- Read-only: existing `scripts/adversarial-sweep.*` (verify CIRCLES gate is in scope)

**Why:** per memory `feedback_adversarial_review_testing` — any AI-review prompt change must run 10 case × 5 stage sweep before ship.

- [ ] **Step 1: Verify command exists**

```bash
grep -E "test:adversarial" package.json
```
Expected: line found.

- [ ] **Step 2: Run sweep**

```bash
npm run test:adversarial 2>&1 | tail -30
```
Expected: 10 case × 5 stage results; CIRCLES gate stage (1 of 5) shows pass/fail.

- [ ] **Step 3: If any case ❌ on CIRCLES gate stage, BLOCK**

Read failure case → revisit prompt in Task 7 → re-run sweep until 10/10 pass on CIRCLES gate stage.

- [ ] **Step 4: Capture sweep output → audit doc**

```bash
mkdir -p audit
npm run test:adversarial 2>&1 > audit/adversarial-sweep-stage-1a-2026-05-16.log
echo "Saved to audit/adversarial-sweep-stage-1a-2026-05-16.log"
```

- [ ] **Step 5: Commit log**

```bash
git add audit/adversarial-sweep-stage-1a-2026-05-16.log
git commit -m "verify(stage-1a): adversarial sweep 10×5 cases — CIRCLES gate stage

Prompt change in commit (Task 7) verified against existing adversarial harness.
0 ❌ on CIRCLES gate stage. Other 4 stages unchanged (passed baseline)."
```

---

## Task 10: Add `gateInflight` mutex to additional sites in `public/app.js`

**Files:**
- Modify: `public/app.js` (3 sites total — Task 6 covered submitFrameworkToGate; this task adds the other 2)

**Why:** B6 race guard at full coverage — phase setter + rehydrate path.

- [ ] **Step 1: Find phase setter**

```bash
grep -nE "circlesPhase\s*=|setCirclesPhase" public/app.js | head -10
```
Identify the canonical setter (likely `setCirclesPhase(n)` or direct `AppState.circlesPhase = n` assignment). Pick the most-used one as the guard site.

- [ ] **Step 2: Wrap phase transitions with mutex check**

If a setter exists, modify it:
```js
function setCirclesPhase(n) {
  if (AppState.gateInflight && n !== 1.5) {
    console.warn('[gate] phase transition blocked — gate inflight, target=' + n);
    return;
  }
  AppState.circlesPhase = n;
  render();
}
```

If no setter (raw assignments scattered), add inline guards at each callsite that transitions to phase 2:
```js
if (AppState.gateInflight) { console.warn('blocked'); return; }
AppState.circlesPhase = 2;
```

- [ ] **Step 3: Find rehydrate function**

```bash
grep -nE "rehydrateCircles|tryResumeLatestSession|loadCircles" public/app.js | head -5
```
Add at start of rehydrate function:
```js
if (AppState.gateInflight) {
  console.warn('[gate] rehydrate blocked — gate inflight; will rehydrate on next poll');
  return;
}
```

- [ ] **Step 4: Manual smoke test (race)**

```bash
PORT=3000 node server.js &
SERVER_PID=$!
sleep 3
```

Open browser to http://localhost:3000, log in, navigate CIRCLES question, fill quality answers, then in DevTools console:
```js
// Simulate B6 race: trigger phase=2 during inflight
AppState.gateInflight = true;
setCirclesPhase(2);  // should log "blocked"
console.log(AppState.circlesPhase);  // should NOT be 2
AppState.gateInflight = false;
```
Expected: `setCirclesPhase(2)` is rejected; phase remains < 2.

```bash
kill $SERVER_PID
```

- [ ] **Step 5: Commit**

```bash
git add public/app.js
git commit -m "feat(stage-1a): extend gateInflight mutex to setCirclesPhase + rehydrate paths

Race guard now covers 3 entry points (Task 6 = submit; Task 10 = setPhase + rehydrate).
Manual smoke confirms setCirclesPhase(2) rejected while gateInflight=true.
gateInflight stays in-memory only — never persisted, never read from localStorage."
```

---

## Task 11: E2E race spec — verify B6 fix

**Files:**
- Create: `tests/e2e/circles-gate.spec.js` (this task: 1 race spec only; remaining 4 in Task 12)

**Why:** Behavioral proof B6 race is closed.

- [ ] **Step 1: Create file with race spec**

```js
const { test, expect } = require('../fixtures/auto-cleanup.fixture').test
  ? require('../fixtures/auto-cleanup.fixture')
  : require('@playwright/test');
const { CirclesPhase1Page } = require('../page-objects/circles-phase1.page');
const factory = require('../factories/circles-phase1.factory');

// Use auto-cleanup fixture — afterEach DELETEs any tracked sessions
const t = require('../fixtures/auto-cleanup.fixture').test;

t.describe('Gate cluster — B6 race guard', () => {
  t('rapid double-click on submit → only 1 POST fires', async ({ page, cleanupTracker }) => {
    let postCount = 0;
    let sessionId = null;
    await page.route('**/api/circles-evaluator/gate', (route) => {
      postCount++;
      route.continue();
    });
    await page.route('**/api/circles-sessions', (route, req) => {
      if (req.method() === 'POST') {
        // Capture sessionId for cleanup
        route.continue().then(async () => {
          const resp = await route.request().response();
          if (resp) {
            const body = await resp.json().catch(() => ({}));
            if (body.id) {
              sessionId = body.id;
              cleanupTracker.track('circles', body.id);
            }
          }
        });
      } else {
        route.continue();
      }
    });

    const form = new CirclesPhase1Page(page);
    await form.goto();
    await form.fillAll(factory.quality());
    await form.submitGateRapidDouble();  // dblclick

    // Wait for response
    await page.waitForResponse('**/api/circles-evaluator/gate', { timeout: 15_000 });

    // Assert only 1 POST fired (mutex blocked the 2nd click)
    expect(postCount).toBe(1);

    // Submit button should be re-enabled after response
    await expect(form.submitButton).toBeEnabled({ timeout: 5_000 });
  });

  t('submit button disabled during gate inflight', async ({ page, cleanupTracker }) => {
    // Slow down gate response so we can observe disabled state
    await page.route('**/api/circles-evaluator/gate', async (route) => {
      await new Promise((r) => setTimeout(r, 1500));
      await route.continue();
    });

    const form = new CirclesPhase1Page(page);
    await form.goto();
    await form.fillAll(factory.quality());

    // Click and immediately assert disabled (web-first, auto-retries)
    await form.submitButton.click();
    await expect(form.submitButton).toBeDisabled({ timeout: 1_000 });

    // After response, re-enabled
    await page.waitForResponse('**/api/circles-evaluator/gate');
    await expect(form.submitButton).toBeEnabled({ timeout: 3_000 });

    // Track for cleanup if a session was created
    const sid = await page.evaluate(() => window.AppState && window.AppState.circlesSessionId);
    if (sid) cleanupTracker.track('circles', sid);
  });
});
```

- [ ] **Step 2: Run e2e race specs (need REAL_ACCESS_TOKEN or auth.setup completed)**

```bash
PORT=3000 node server.js &
SERVER_PID=$!
sleep 3

# First time: run setup project to create storageState
npx playwright test --config tests/e2e/playwright.config.js --project=setup 2>&1 | tail -5

# Then run race specs on desktop
npx playwright test --config tests/e2e/playwright.config.js --project=e2e-desktop -g "B6 race guard" 2>&1 | tail -15

kill $SERVER_PID
```
Expected: 2 specs PASS.

- [ ] **Step 3: If FAIL, investigate**

Common issues:
- Selectors in POM don't match real DOM → `playwright codegen http://localhost:3000` to find right ones
- `submitButton` doesn't have stable `name=送出評估` text → adjust regex in POM
- `gateInflight` mutex not actually wired → return to Task 6/10

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/circles-gate.spec.js
git commit -m "feat(stage-1a): E2E race specs (B6) — gateInflight mutex behavioral proof

2 specs:
- rapid dblclick → only 1 POST counted via page.route
- submit button disabled during inflight (slow-route observation)

Uses auto-cleanup fixture from Stage 0 (cleanupTracker.track for afterEach DELETE)."
```

---

## Task 12: E2E happy + sad path specs (4 more in same spec file)

**Files:**
- Modify: `tests/e2e/circles-gate.spec.js` (append 4 specs to existing race file)

**Why:** Cover B1 functional acceptance criteria (B1-AC1..6).

- [ ] **Step 1: Append happy path spec**

```js
t.describe('Gate cluster — B1 happy path', () => {
  t('quality input → gate ok → can proceed to Phase 2', async ({ page, cleanupTracker }) => {
    const form = new CirclesPhase1Page(page);
    await form.goto();
    await form.fillAll(factory.quality());
    await form.submitGate();
    await expect(form.gateResult).toBeVisible({ timeout: 15_000 });
    const status = await form.getGateStatus();
    expect(status).toBe('ok');
    // Proceed button visible
    await expect(page.getByRole('button', { name: /進入下一步|next/i })).toBeVisible();

    const sid = await page.evaluate(() => window.AppState && window.AppState.circlesSessionId);
    if (sid) cleanupTracker.track('circles', sid);
  });
});
```

- [ ] **Step 2: Append garbage sad path spec (Layer 1 catch)**

```js
t.describe('Gate cluster — B1 sad: garbage (Layer 1)', () => {
  t('all-Y input → Layer 1 blocks; no POST; inline errors visible', async ({ page }) => {
    let postCount = 0;
    await page.route('**/api/circles-evaluator/gate', (route) => {
      postCount++; route.continue();
    });

    const form = new CirclesPhase1Page(page);
    await form.goto();
    await form.fillAll(factory.garbage());
    await form.submitGate();

    // Wait a beat — should NOT see any /gate POST
    await page.waitForTimeout(500);  // allowed: explicit "no event" check
    expect(postCount).toBe(0);

    // Inline errors visible
    await expect(page.locator('.framework-error').first()).toBeVisible();
  });
});
```

NOTE: `waitForTimeout(500)` is **intentional** here — we're proving absence of an event. Per `playwright-skill core/assertions-and-waiting.md`, this is one of the few legitimate uses of `waitForTimeout`. Comment justifies.

- [ ] **Step 3: Append thin sad path spec (Layer 2 catch)**

```js
t.describe('Gate cluster — B1 sad: thin (Layer 2)', () => {
  t('thin Chinese input → passes Layer 1 but BE returns warn/error', async ({ page, cleanupTracker }) => {
    const form = new CirclesPhase1Page(page);
    await form.goto();
    await form.fillAll(factory.thin());
    await form.submitGate();
    await expect(form.gateResult).toBeVisible({ timeout: 15_000 });
    const status = await form.getGateStatus();
    expect(['warn', 'error']).toContain(status);

    const sid = await page.evaluate(() => window.AppState && window.AppState.circlesSessionId);
    if (sid) cleanupTracker.track('circles', sid);
  });
});
```

- [ ] **Step 4: Append visual baseline spec**

```js
t.describe('Gate cluster — visual baseline', () => {
  t('gate result rendered — pixel-diff against locked baseline', async ({ page, cleanupTracker }) => {
    const form = new CirclesPhase1Page(page);
    await form.goto();
    await form.fillAll(factory.quality());
    await form.submitGate();
    await expect(form.gateResult).toBeVisible({ timeout: 15_000 });

    await expect(form.gateResult).toHaveScreenshot('gate-ok-result.png', {
      maxDiffPixelRatio: 0.005,
      animations: 'disabled',
    });

    const sid = await page.evaluate(() => window.AppState && window.AppState.circlesSessionId);
    if (sid) cleanupTracker.track('circles', sid);
  });
});
```

- [ ] **Step 5: Run all 5 e2e specs across 3 viewports**

```bash
PORT=3000 node server.js &
SERVER_PID=$!
sleep 3
npx playwright test --config tests/e2e/playwright.config.js \
  --project=e2e-desktop --project=e2e-mobile-chrome --project=e2e-mobile-safari \
  2>&1 | tail -25
kill $SERVER_PID
```
Expected: 15 specs PASS (5 specs × 3 viewports).

If visual baseline missing on first run, accept generated screenshots:
```bash
npx playwright test --config tests/e2e/playwright.config.js --project=e2e-desktop --update-snapshots
```
Then commit screenshots.

- [ ] **Step 6: Commit**

```bash
git add tests/e2e/circles-gate.spec.js tests/e2e/circles-gate.spec.js-snapshots/
git commit -m "feat(stage-1a): E2E happy + sad + visual baseline (B1 acceptance)

4 specs added (race specs in Task 11):
- happy: quality → ok → proceed visible
- sad-garbage: Layer 1 blocks, no POST, inline errors
- sad-thin: passes Layer 1, BE returns warn/error
- visual: gate-ok-result baseline (maxDiffPixelRatio 0.005)

Total: 5 e2e specs × 3 viewports = 15 cases all green."
```

---

## Task 13: Cross-vp full regression (8 vp)

**Files:**
- (no new files; runs existing Playwright suites)

**Why:** Per memory `feedback_full_sit_uat_uiux` — ship-readiness gate.

- [ ] **Step 1: Run jest baseline**

```bash
npx jest 2>&1 | tail -10
```
Expected: 1 pre-existing fail (per Stage 0 baseline) + N passing. New `framework-validator.test.js` adds ~30 specs that should all pass.

- [ ] **Step 2: Run existing Playwright visual suite (regression)**

```bash
PORT=3000 node server.js &
SERVER_PID=$!
sleep 3
npx playwright test --config tests/visual/playwright.config.js 2>&1 | tail -15
kill $SERVER_PID
```
Expected: no NEW failures vs baseline. Pre-existing failures OK if documented.

- [ ] **Step 3: Run new e2e config across all 3 mobile/desktop projects**

```bash
PORT=3000 node server.js &
SERVER_PID=$!
sleep 3
npx playwright test --config tests/e2e/playwright.config.js 2>&1 | tail -20
kill $SERVER_PID
```
Expected: 15 e2e + 6 api contract = 21 specs PASS (or contract specs SKIP if no token).

- [ ] **Step 4: Document any new failures + decide**

If new failures appear, root-cause first (per IL-1). Do NOT mark Stage 1A done with new failures.

- [ ] **Step 5: No commit (verification step)**

---

## Task 14: iOS Safari 15-item review + director cold-Read PNG

**Files:**
- Create: `audit/eyeball-stage-1a-2026-05-16.md` (Director walks through PNGs + comments)

**Why:** Per memory `feedback_ios_review_before_ship` + `feedback_uiux_visual_only`.

- [ ] **Step 1: iOS Safari 15-item static checklist walk**

Per master spec `docs/superpowers/specs/2026-05-02-frontend-rewrite-master-spec.md` §0.2. Walk each item against gate-cluster changes:
- focus state on Phase 1 inputs (`tap` ↔ scroll-into-view)
- touch hit-target on submit button (≥ 44×44)
- sticky header during gate loading
- modal overlay for gate result on mobile
- SSE / fetch loading state visibility
- ... (full 15)

For each item, note PASS / N/A / FAIL → `audit/eyeball-stage-1a-2026-05-16.md`.

- [ ] **Step 2: Capture 9 PNGs (3 viewports × 3 gate states)**

Run a one-off capture spec or use existing Playwright machinery:
```bash
PORT=3000 node server.js &
SERVER_PID=$!
sleep 3

# This runs the visual baseline spec which already captures gate-ok-result.png across 3 vp
npx playwright test --config tests/e2e/playwright.config.js -g "visual baseline" 2>&1 | tail -10

# Manually trigger sad paths via DevTools or expand the visual spec
# (For Stage 1A, accept 3 PNG = ok-state × 3 viewports; capture warn/error in a follow-up spec if needed)

kill $SERVER_PID
```

- [ ] **Step 3: Director cold-Read each PNG**

Open each PNG via Read tool and write 1-line comment per PNG to `audit/eyeball-stage-1a-2026-05-16.md`:
```
- mobile-chrome / gate-ok: green badge centered, layout reflows correctly, no overflow
- mobile-safari / gate-ok: same as chrome, no WebKit-specific rendering issue
- desktop / gate-ok: 4-column box layout matches mockup 04 §A
```

If any PNG shows drift from mockup 04 → flag as new bug, decide ship vs fix.

- [ ] **Step 4: Commit eyeball doc**

```bash
git add audit/eyeball-stage-1a-2026-05-16.md
git commit -m "verify(stage-1a): iOS 15-item + director cold-Read 3 PNG × 3 viewport

Walk: 15 iOS Safari static checks all PASS / N/A.
Cold-Read: 9 PNGs (or 3 if sad-state capture deferred), inline comments per file.
No drift from mockup 04 §A."
```

---

## Task 15: Update CLAUDE.md + push to origin/main

**Files:**
- Modify: `CLAUDE.md`

**Why:** Per memory `feedback_claude_md_live_state` — single source of truth.

- [ ] **Step 1: Read current state board**

```bash
head -20 CLAUDE.md
```

- [ ] **Step 2: Update Last updated + add Stage 1A bullet**

Edit `CLAUDE.md`:
- `Last updated:` → `2026-05-16（Stage 1A Gate cluster ship — B1 + B6 fix + 30+ TDD specs across 3 layers; Stage 1B pending）`
- Insert under 「當前狀態」:
  ```
  - **Stage 1A ship (2026-05-16)**: B1 + B6 fix (frameworkValidator FE pre-guard + circles-gate prompt strict + gateInflight mutex 3-site). Tests: 15 unit + 6 API contract + 5 E2E × 3 vp = 36 specs all green. Adversarial sweep 10×5 0 ❌. Carve-out: prompts/circles-gate.js (user-approved Level 2). Stage 1B (B3 + B4) pending brainstorm.
  ```

- [ ] **Step 3: Commit + push**

```bash
git add CLAUDE.md
git commit -m "chore(stage-1a): mark Stage 1A done in CLAUDE.md

B1 + B6 cluster ship complete. Stage 1B (B3 cache + B4 offcanvas) opens next."
git push origin main
```
Expected: commits land on origin/main.

---

## Self-Review

(Inline per writing-plans skill — not subagent.)

### 1. Spec coverage

| Spec section | Plan task |
|---|---|
| §1 Context (B1 + B6 hypothesis) | Task references via header |
| §2 Architecture (2-layer + mutex) | Tasks 5/6/7/10 implement |
| §3 Components — frameworkValidator | Task 5 |
| §3 Components — auth.setup | Task 1 |
| §3 Components — factory | Task 2 |
| §3 Components — POM | Task 3 |
| §3 Components — e2e/api specs | Tasks 11/12/8 |
| §3 Components — config | Task 4 |
| §3 Components — app.js wiring | Tasks 6/10 |
| §3 Components — prompt change | Task 7 |
| §4 Data flow / state machine | Tasks 6/10 (mutex 3 sites) |
| §5 Error handling — Layer 1/2 fail UX | Task 6 (renderInlineFrameworkErrors) |
| §5 Network fail toast + retry | NOT explicitly covered → ADD inline note in Task 6 if implementer encounters |
| §6 Testing — unit/API/E2E/adversarial | Tasks 5/8/11/12/9 |
| §6 Cross-vp + iOS + cold-Read | Tasks 13/14 |
| §7 AC — B1-AC1..6 | Task 5 unit + Task 12 e2e |
| §7 AC — B6-AC1..4 | Task 11 race specs |
| §7 Quality gates | Task 13 |
| §7 Process gates (CLAUDE.md) | Task 15 |

**Gap noted:** Network fail toast + retry button not explicitly spec'd as a task. Adding a note: implementer should hook the existing fetch error path; if no existing toast helper, defer to Stage 1B (B3 may need same). Mark non-blocking for Stage 1A ship.

### 2. Placeholder scan

Scanned for: TBD, TODO, "implement later", "appropriate error handling", "similar to Task N", "fill in details", "add validation", "handle edge cases".

Findings:
- Task 1 selectors marked "best-guess" + "implementer adjusts after `playwright codegen`" — this is a known unknown, not a placeholder. Acceptable.
- Task 6 selectors `[data-circles-field]` + `[data-action]` marked "must match real markup" — same. Acceptable but flag: implementer must add these `data-*` attributes if not present.
- No literal TBD / TODO / vague language.

### 3. Type consistency

- `validateFrameworkInput` returns `{ ok: bool, errors: [{field, rule, message}] }` (Task 5) — consumed by `renderInlineFrameworkErrors(errors)` in Task 6 — match.
- `AppState.gateInflight` set by Tasks 6 + 10, read by Task 6 + 10 + Task 11 e2e — match.
- POM `getGateStatus()` returns `'ok'|'warn'|'error'|null` (Task 3) — consumed by Task 12 specs — match.
- `cleanupTracker.track('circles', sessionId)` used in Tasks 11/12 — Stage 0 fixture interface — match.

No issues found.

---

## Execution Handoff

**Plan complete and saved to** `docs/superpowers/plans/2026-05-16-stage-1a-gate-cluster.md`.

**Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, two-stage review (spec compliance + code quality) between tasks, fast iteration. Sequential (no parallel lanes for Stage 1A — each task depends on prior).

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

**Which approach?**
