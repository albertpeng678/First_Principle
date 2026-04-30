# 7-Agent Audit & Fix Cycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run a deep usability audit of PM-Drill via 5 newbie-persona user agents + 2 UI/UX recorder agents on `localhost:4000`, fix every P0+P1 issue with TDD, and verify visual RWD across 8 viewports before ship.

**Architecture:** Six phases — A (env setup) → B (parallel user agents) → C (recorder agents) → D (TDD fix loop, one subagent per issue, in worktrees) → E (regression suite) → F (mandatory 8-viewport RWD visual gate). All issues drain into a single `audit/issues-master.md` triaged by R1; every fix lands a Playwright spec that previously failed.

**Tech Stack:** Node 22 + Express server (`server.js`), vanilla JS SPA (`public/app.js` + `public/style.css`), Playwright (`tests/playwright/`), Jest (`tests/`), Supabase Postgres backend.

**Reference spec:** `docs/superpowers/specs/2026-04-30-7-agent-audit-design.md`

**Predecessor context:** `docs/superpowers/plans/2026-04-28-pm-drill-mega-rollout.md` defined the current per-page desktop max-widths (1180/920/720/420). Its SIT-3 only validated `Desktop 1280 + Mobile 375` — leaving the 1440+/1920+/2560+ band un-tested. **Issue #0 (cramped center column on wide monitor) escaped through that gap.** This audit closes it.

---

## Phase A: Environment & scaffolding

**Worktree:** stay on `main` for env setup; fix worktrees branch off later.
**Estimate:** 10 min

### Task A.1: Create audit directory tree

- [ ] **Step 1: Create dirs**

```bash
mkdir -p audit/{traces,screenshots/{u1,u2,u3,u4,u5},rwd-grid}
mkdir -p tests/playwright/journeys/audit
touch audit/issues-master.md audit/acceptance.md audit/README.md
```

- [ ] **Step 2: Seed `audit/README.md`**

```markdown
# 2026-04-30 Audit Run

| Wave | Agent | Status | Output |
|---|---|---|---|
| 1 | U1 大三學生 (Desktop) | pending | u1-log.md |
| 1 | U2 應屆 iPhone | pending | u2-log.md |
| 1 | U3 轉職 Edge | pending | u3-log.md |
| 1 | U4 文組 iPad | pending | u4-log.md |
| 1 | U5 打工 Android | pending | u5-log.md |
| 2 | R1 Severity | pending | issues-master.md |
| 2 | R2 Acceptance | pending | acceptance.md |
| Gate | RWD 8-viewport | pending | rwd-grid/ |

Pre-Audit Issue #0: Desktop home (≥1440px) cramped + duplicate `北極星指標` nav entry.
```

- [ ] **Step 3: Commit**

```bash
git add audit/ tests/playwright/journeys/audit
git commit -m "chore(audit): scaffold 2026-04-30 audit directory tree"
```

### Task A.2: Boot dev server and confirm reachable

- [ ] **Step 1: Start server in background**

```bash
PORT=4000 npm run dev
```

(via Bash `run_in_background: true`)

- [ ] **Step 2: Smoke test**

```bash
curl -fsS http://localhost:4000/ -o /dev/null && echo OK
```

Expected: `OK`. If not, fix before continuing.

- [ ] **Step 3: Confirm Supabase env**

```bash
node -e "require('dotenv').config(); console.log(!!process.env.SUPABASE_URL, !!process.env.SUPABASE_ANON_KEY, !!process.env.OPENAI_API_KEY)"
```

Expected: `true true true`. If any false, abort and ask user to populate `.env`.

### Task A.3: Test-account naming convention

- [ ] **Step 1:** Use `agent-u<n>+<unix_ts>@pmdrill.test` for each user agent's signup email. Password fixed: `AuditRun-2026-04-30!`.
- [ ] **Step 2:** After audit, run `scripts/cleanup-empty-sessions.js` then a manual SQL DELETE for test accounts (defer cleanup script writing until Phase E).

---

## Phase B: 5 user-persona agents (parallel via dispatching-parallel-agents)

**Worktree:** none — agents run Playwright against the running dev server.
**Estimate:** 45 min wall-clock (all 5 in parallel).

### Task B.1: Write the per-agent prompt template

- [ ] **Step 1:** Save the canonical prompt to `audit/agent-prompt-template.md`:

```markdown
You are user-agent **U<N>** for the PM-Drill audit. You are <persona>.
Device: <device>. Playwright project: <project>.

## Your Mission
Walk the **full 10-step journey** below on http://localhost:4000 using Playwright (`@playwright/test`). Take a screenshot at every step into `audit/screenshots/u<N>/<step>.png`. Record everything frustrating, confusing, broken, ugly, or slow into `audit/u<N>-log.md`.

## Mandatory journey (do every step in order, no skipping)
1. Land on `/` as guest. Browse the question list. Note: how long until you understand what to do?
2. Pick ONE question. Enter the CIRCLES flow.
3. Complete steps C → I → R → C → L → E → S **with real Chinese answers** (≥40 字 per step). No blank submissions, no copy-paste filler.
4. Wait for AI evaluation. Read the Summary.
5. Sign up an account: email `agent-u<N>+<Date.now()>@pmdrill.test` / password `AuditRun-2026-04-30!`. Confirm guest→user `migrate` succeeds (your earlier session must appear in your account).
6. Open a new question. Enter NSM Workshop. Complete all 4 steps.
7. Return to home. Pick CIRCLES Drill mode. Do **2** single-step drills (any 2 of the 7 letters).
8. Visit `/review-examples.html`. Browse at least 3 example sessions.
9. Reload mid-CIRCLES on a 4th new question. Verify Resume restores your draft.
10. Delete one of your sessions from the Offcanvas. Logout.

## Persona behaviour to enact
<persona-specific behaviour>

## Output format — `audit/u<N>-log.md`

For every observation use this row:

| Step | Severity guess | Category | Description | Repro | Screenshot |
|---|---|---|---|---|---|
| 3-L | P1 | copy | "List 解法" 按鈕沒提示要寫幾個 | 進 step L 後立刻 stuck 8s | u<N>/03-L.png |

Categories: `layout`, `copy`, `flow`, `a11y`, `perf`, `bug`, `visual`, `mobile`, `auth`.

End the log with a **summary paragraph (3–5 sentences)** in your persona's voice describing the overall feeling.

## Hard rules
- Use real Chinese. No `lorem ipsum` style filler.
- Tap-targets <44px on mobile = automatic P1.
- Any console error = automatic P0.
- Any horizontal scroll on a non-carousel = automatic P0.
- Any duplicate nav element = automatic P1.
- If you can't complete a step due to a bug, log it as P0 and skip to the next step.

You have at most 35 minutes. Trace ON. Save trace to `audit/traces/u<N>.zip`.
```

- [ ] **Step 2: Commit**

```bash
git add audit/agent-prompt-template.md
git commit -m "chore(audit): add user-agent prompt template"
```

### Task B.2: Dispatch U1–U5 in parallel

- [ ] **Step 1:** In a single message, dispatch 5 Agent calls (subagent_type: `general-purpose`, isolation: none — they share the dev server):

  - **U1** persona: 大三學生, distractible. Device: MacBook Chrome. Playwright project `Desktop`.
  - **U2** persona: 應屆畢業生, single-thumb portrait. Device: iPhone Safari. Project `iPhone-15-Pro`.
  - **U3** persona: 轉職者, reads every word. Device: Windows Edge. Project `Desktop` (UA spoof).
  - **U4** persona: 文組求職者, jargon-shy. Device: iPad Safari. Project `iPad`.
  - **U5** persona: 休學打工青年, impatient skipper. Device: low-end Android. Project `iPhone-SE`.

  Each prompt = template + that persona's specific behaviour line.

- [ ] **Step 2:** Wait for all 5 to return. Confirm each `audit/u<n>-log.md` exists and has ≥10 issue rows. If any agent returned <10 rows or didn't complete the journey, re-dispatch with a sharper prompt asking specifically what was missed.

- [ ] **Step 3: Commit raw logs**

```bash
git add audit/u*-log.md audit/traces/ audit/screenshots/
git commit -m "chore(audit): U1-U5 raw issue logs and traces"
```

---

## Phase C: 2 recorder agents (sequential — R1 then R2)

**Estimate:** 20 min total.

### Task C.1: Dispatch R1 (Severity Classifier)

- [ ] **Step 1: Prompt**

```markdown
You are R1, the Severity Classifier. Read all five `audit/u*-log.md` files plus `audit/README.md` (Issue #0).

Produce `audit/issues-master.md` with these properties:
- One row per UNIQUE issue. Dedupe across the 5 logs (same root issue reported by ≥2 personas → merge, list reporters).
- Columns: `id` (AUD-001…), `severity` (P0/P1/P2 — your final call, NOT the user agents'), `category`, `title`, `repro`, `reporters` (comma list of u1..u5 + "self" for Issue #0), `affected viewports`, `proposed acceptance`.
- Severity rules (override agents):
  - **P0** = blocks core flow OR data loss OR a11y violation OR desktop layout broken at ≥1440 OR console error
  - **P1** = major UX friction, broken sticky/modal, mobile tap target <44px, contrast fail, broken resume, copy that misled ≥2 users
  - **P2** = polish only

Sort by severity then by reporter count desc. Issue #0 must appear with severity P0.

End with a summary block: counts per severity, top-3 categories, top-3 most-reported issues.
```

- [ ] **Step 2:** After R1 returns, manually skim `audit/issues-master.md` for sanity. If a P0 looks like P2 (or vice versa), edit inline — your taste overrides agent triage.

- [ ] **Step 3: Commit**

```bash
git add audit/issues-master.md
git commit -m "chore(audit): R1 master issue list with severity triage"
```

### Task C.2: Dispatch R2 (Acceptance & Test Writer)

- [ ] **Step 1: Prompt**

```markdown
You are R2, the Acceptance & Test Writer. Read `audit/issues-master.md`. For EVERY P0 and P1 issue:

1. Append to `audit/acceptance.md` a section:
   ### AUD-NNN — <title>
   **Acceptance:** <2-4 bullet points, observable & testable>
   **Out of scope:** <what explicitly is NOT being fixed by this issue>

2. Create `tests/playwright/journeys/audit/audit-AUD-NNN.spec.js` containing a **failing** Playwright test that exercises the bug. Skeleton:
   const { test, expect } = require('@playwright/test');
   test.describe('AUD-NNN <title>', () => {
     test('<acceptance criterion 1>', async ({ page }) => {
       await page.goto('/');
       // … reproduce path …
       await expect(<assertion>).toBeTruthy(); // currently FAILS
     });
   });

3. Run `npx playwright test tests/playwright/journeys/audit/audit-AUD-NNN.spec.js` and confirm it FAILS as expected. Save the failure output as a comment block at the top of each spec.

P2 issues: just write the acceptance, no spec.

Output: `audit/acceptance.md` + `tests/playwright/journeys/audit/audit-AUD-*.spec.js` × N.
```

- [ ] **Step 2:** Confirm every P0/P1 issue has a matching spec file. Run them all once:

```bash
PMDRILL_BASE_URL=http://localhost:4000 npx playwright test tests/playwright/journeys/audit/ --reporter=list 2>&1 | tee audit/initial-failures.log
```

Expected: every spec fails (this is the baseline).

- [ ] **Step 3: Commit**

```bash
git add audit/acceptance.md audit/initial-failures.log tests/playwright/journeys/audit/
git commit -m "chore(audit): R2 acceptance criteria + failing-by-design Playwright specs"
```

---

## Phase D: TDD fix loop (one subagent per issue, in worktrees)

**Worktree pattern:** `../audit-fix-AUD-NNN` per issue.
**Order:** P0 first (sorted by reporter count desc), then P1.
**Estimate:** depends on issue count — assume 15-30 min per issue.

### Task D.1: Per-issue fix template (apply for every P0 then every P1)

For each issue `AUD-NNN`:

- [ ] **Step 1: Create worktree**

```bash
git worktree add ../audit-fix-AUD-NNN -b fix/audit-AUD-NNN main
cd ../audit-fix-AUD-NNN
```

- [ ] **Step 2: Confirm baseline failure**

```bash
PMDRILL_BASE_URL=http://localhost:4000 npx playwright test tests/playwright/journeys/audit/audit-AUD-NNN.spec.js --reporter=list
```

Expected: FAIL.

- [ ] **Step 3: Dispatch fix subagent** (subagent_type: `general-purpose`, isolation: none — already in worktree).

  Prompt:
  ```
  You are a fix subagent for AUD-NNN. The failing spec is `tests/playwright/journeys/audit/audit-AUD-NNN.spec.js`. Acceptance is in `audit/acceptance.md`.
  
  Apply the systematic-debugging discipline:
  1. Reproduce locally and read the trace (use `npx playwright show-trace`).
  2. Form a hypothesis. State it explicitly.
  3. Identify root cause — not a symptom patch.
  4. Make the minimal change to `public/app.js` / `public/style.css` / `routes/<x>.js` / `server.js` to make the failing spec pass.
  5. Do NOT widen scope. No drive-by refactors.
  6. Run the failing spec → must PASS.
  7. Run the full audit suite — must not regress any other audit spec.
  8. Run `npx playwright test tests/playwright/journeys/` (full suite) — must not regress baseline journeys.
  9. Run `npm test` — must stay green.
  
  Hand back: list of files changed, root-cause one-liner, before/after snippets.
  ```

- [ ] **Step 4: Verify (verification-before-completion)**

```bash
PMDRILL_BASE_URL=http://localhost:4000 npx playwright test tests/playwright/journeys/audit/audit-AUD-NNN.spec.js --reporter=list   # PASS
PMDRILL_BASE_URL=http://localhost:4000 npx playwright test tests/playwright/journeys/ --reporter=list                              # all PASS
npm test                                                                                                                            # PASS
```

If any regress, hand the regression back to the subagent — do not paper over.

- [ ] **Step 5: Commit fix**

```bash
git add -A
git commit -m "fix(audit): AUD-NNN <title>

Root cause: <one-liner>.
Spec: tests/playwright/journeys/audit/audit-AUD-NNN.spec.js now passes."
```

- [ ] **Step 6: Self-review via code-review skill** on the diff. Address any blocking comments by repeating Step 3 with sharper guidance.

- [ ] **Step 7: Merge worktree back to main**

```bash
cd /Users/albertpeng/Desktop/claude_project/First_Principle
git merge --no-ff fix/audit-AUD-NNN -m "merge: AUD-NNN fix"
git worktree remove ../audit-fix-AUD-NNN
git branch -d fix/audit-AUD-NNN
```

(If a later fix needs a file the earlier fix already touched, rebase the later worktree onto current `main` first.)

### Task D.2: After all P0+P1 fixes merged

- [ ] **Step 1:** Update `audit/issues-master.md` — mark every fixed issue with `[fixed]` and the merge SHA.

- [ ] **Step 2:** Re-run the full audit suite from main:

```bash
PMDRILL_BASE_URL=http://localhost:4000 npx playwright test tests/playwright/journeys/audit/ --reporter=list
```

Expected: 100% pass.

- [ ] **Step 3: Commit master update**

```bash
git add audit/issues-master.md
git commit -m "chore(audit): mark P0+P1 fixed in master list"
```

---

## Phase E: Regression suite

**Estimate:** 15 min.

### Task E.1: Full Jest + Playwright matrix

- [ ] **Step 1: Jest**

```bash
npm test 2>&1 | tee audit/final-jest.log
```

Expected: all green. Any red → back to Phase D.

- [ ] **Step 2: Playwright across 4 device projects**

```bash
PMDRILL_BASE_URL=http://localhost:4000 npx playwright test --project=Desktop --project=iPad --project=iPhone-15-Pro --project=iPhone-SE --reporter=list 2>&1 | tee audit/final-playwright.log
```

Expected: 0 failures, 0 flakes (re-run any flake; if it persists it's a real bug, file new AUD-NNN and loop back to Phase D).

- [ ] **Step 3: Console-error sweep**

Add temporary `tests/playwright/journeys/audit/console-sweep.spec.js`:

```javascript
const { test, expect } = require('@playwright/test');
const ROUTES = ['/', '/review-examples.html'];
test.describe('console-error sweep', () => {
  for (const route of ROUTES) {
    test(`no console errors on ${route}`, async ({ page }) => {
      const errors = [];
      page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
      page.on('pageerror', e => errors.push(String(e)));
      await page.goto(route);
      await page.waitForLoadState('networkidle');
      expect(errors, 'console errors').toEqual([]);
    });
  }
});
```

Run:

```bash
PMDRILL_BASE_URL=http://localhost:4000 npx playwright test tests/playwright/journeys/audit/console-sweep.spec.js --reporter=list
```

Expected: PASS.

- [ ] **Step 4: Commit logs**

```bash
git add audit/final-*.log tests/playwright/journeys/audit/console-sweep.spec.js
git commit -m "chore(audit): final regression run, all green"
```

---

## Phase F: HARD RWD VISUAL GATE (8 viewports × 8 routes)

**This phase is non-negotiable. It exists because the original mega-rollout SIT-3 only screenshotted 1280 + 375, leaving Issue #0 to leak through.**

**Estimate:** 25 min.

### Task F.1: Add 4 missing viewport projects to playwright.config.js

- [ ] **Step 1: Modify**

`tests/playwright/playwright.config.js`:

```javascript
const DEVICES = [
  { name: 'Mobile-360',     viewport: { width: 360,  height: 780  }, isMobile: true  }, // narrow Android
  { name: 'iPhone-SE',      viewport: { width: 375,  height: 667  }, isMobile: true  },
  { name: 'iPhone-14',      viewport: { width: 390,  height: 844  }, isMobile: true  }, // NEW
  { name: 'iPhone-15-Pro',  viewport: { width: 430,  height: 932  }, isMobile: true  },
  { name: 'iPad',           viewport: { width: 768,  height: 1024 }, isMobile: true  },
  { name: 'Desktop-1280',   viewport: { width: 1280, height: 800  }, isMobile: false }, // renamed from Desktop
  { name: 'Desktop-1440',   viewport: { width: 1440, height: 900  }, isMobile: false }, // NEW
  { name: 'Desktop-2560',   viewport: { width: 2560, height: 1440 }, isMobile: false }, // NEW — Issue #0 victim
];
```

- [ ] **Step 2:** Update any spec referencing project name `Desktop` → `Desktop-1280`.

```bash
grep -rn "project: 'Desktop'\|--project=Desktop" tests/ docs/ scripts/ 2>/dev/null
# replace each with Desktop-1280
```

- [ ] **Step 3: Commit**

```bash
git add tests/playwright/playwright.config.js
git commit -m "test(rwd): expand to 8 viewport projects (360/375/390/430/768/1280/1440/2560)"
```

### Task F.2: Write `rwd-visual-gate.spec.js`

- [ ] **Step 1: Create**

`tests/playwright/journeys/audit/rwd-visual-gate.spec.js`:

```javascript
const { test, expect } = require('@playwright/test');

const ROUTES = [
  { name: '01-home',         path: '/' },
  { name: '02-review',       path: '/review-examples.html' },
  // CIRCLES + NSM in-flow routes seeded via helper:
];

const ENTER_CIRCLES_STEP = require('../../helpers/enter-circles-step');
const ENTER_NSM_STEP = require('../../helpers/enter-nsm-step');

test.describe.configure({ mode: 'parallel' });

for (const r of ROUTES) {
  test(`screenshot ${r.name}`, async ({ page }, testInfo) => {
    const proj = testInfo.project.name;
    await page.goto(r.path);
    await page.waitForLoadState('networkidle');
    await page.screenshot({
      path: `audit/rwd-grid/${proj}/${r.name}.png`,
      fullPage: true,
    });
    const widthBoxRatio = await page.evaluate(() => {
      const main = document.querySelector('main') || document.body;
      return main.getBoundingClientRect().width / window.innerWidth;
    });
    const minRatio = testInfo.project.use.isMobile ? 0.92 : 0.70;
    expect(widthBoxRatio, `main content too narrow on ${proj}`).toBeGreaterThanOrEqual(minRatio);

    const hasHorizontalScroll = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    expect(hasHorizontalScroll, `unintended horizontal scroll on ${proj}`).toBeFalsy();
  });
}

// CIRCLES step 1 / step 5 / Summary + NSM step 1 / step 4 + auth
test('screenshot 03-circles-C', async ({ page }, testInfo) => {
  await ENTER_CIRCLES_STEP(page, 'C');
  await page.screenshot({ path: `audit/rwd-grid/${testInfo.project.name}/03-circles-C.png`, fullPage: true });
});
test('screenshot 04-circles-L', async ({ page }, testInfo) => {
  await ENTER_CIRCLES_STEP(page, 'L');
  await page.screenshot({ path: `audit/rwd-grid/${testInfo.project.name}/04-circles-L.png`, fullPage: true });
});
test('screenshot 05-circles-summary', async ({ page }, testInfo) => {
  await ENTER_CIRCLES_STEP(page, 'summary');
  await page.screenshot({ path: `audit/rwd-grid/${testInfo.project.name}/05-circles-summary.png`, fullPage: true });
});
test('screenshot 06-nsm-step1', async ({ page }, testInfo) => {
  await ENTER_NSM_STEP(page, 1);
  await page.screenshot({ path: `audit/rwd-grid/${testInfo.project.name}/06-nsm-1.png`, fullPage: true });
});
test('screenshot 07-nsm-step4', async ({ page }, testInfo) => {
  await ENTER_NSM_STEP(page, 4);
  await page.screenshot({ path: `audit/rwd-grid/${testInfo.project.name}/07-nsm-4.png`, fullPage: true });
});
test('screenshot 08-auth', async ({ page }, testInfo) => {
  await page.goto('/');
  await page.click('text=登入');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: `audit/rwd-grid/${testInfo.project.name}/08-auth.png`, fullPage: true });
});
```

- [ ] **Step 2:** Create the two helpers if missing:

`tests/playwright/helpers/enter-circles-step.js`:

```javascript
module.exports = async function enterCirclesStep(page, target) {
  await page.goto('/');
  await page.click('.circles-q-card', { timeout: 10000 });
  // Walk to target letter — relies on each step having data-step attr.
  if (target === 'summary') {
    // Use seeded test session route if present, else skip.
    return;
  }
  // Click "下一步" until data-step matches target.
  for (let i = 0; i < 10; i++) {
    const cur = await page.getAttribute('[data-step]', 'data-step').catch(() => null);
    if (cur === target) return;
    const next = page.locator('button', { hasText: /下一步|繼續/ }).first();
    if (!(await next.isVisible())) break;
    await next.click();
    await page.waitForLoadState('networkidle');
  }
};
```

`tests/playwright/helpers/enter-nsm-step.js`:

```javascript
module.exports = async function enterNsmStep(page, n) {
  await page.goto('/');
  await page.click('text=北極星指標');
  await page.click('.circles-q-card', { timeout: 10000 });
  for (let i = 1; i < n; i++) {
    await page.locator('button', { hasText: /下一步/ }).first().click();
    await page.waitForLoadState('networkidle');
  }
};
```

- [ ] **Step 3: Commit**

```bash
git add tests/playwright/journeys/audit/rwd-visual-gate.spec.js tests/playwright/helpers/
git commit -m "test(rwd): 8-viewport visual gate spec + helpers"
```

### Task F.3: Run the gate across all 8 viewports

- [ ] **Step 1:**

```bash
rm -rf audit/rwd-grid
PMDRILL_BASE_URL=http://localhost:4000 npx playwright test tests/playwright/journeys/audit/rwd-visual-gate.spec.js \
  --project=Mobile-360 --project=iPhone-SE --project=iPhone-14 --project=iPhone-15-Pro \
  --project=iPad --project=Desktop-1280 --project=Desktop-1440 --project=Desktop-2560 \
  --reporter=list 2>&1 | tee audit/rwd-gate.log
```

Expected: all assertions PASS, 64 PNGs in `audit/rwd-grid/<project>/`.

- [ ] **Step 2:** If any width-ratio or horizontal-scroll assertion fails → that's a NEW issue. File `AUD-NNN-rwd-<viewport>` and **loop back to Phase D**. Do not advance until all 64 pass.

### Task F.4: Recorder R1 visual review

- [ ] **Step 1: Dispatch R1 (or yourself if R1 was killed)**

Prompt:
```
Read every PNG in audit/rwd-grid/. For each <viewport>/<route> pair confirm:
- No giant empty bands (≥70 % desktop, ≥92 % mobile content width — automated check passed but spot-check visually)
- No clipped text or button
- No duplicate nav element (Issue #0 root)
- Tap targets ≥44px on mobile shots
- Sticky / fixed elements don't overlap content
- Page looks INTENTIONAL at every width — no "stretched mobile on desktop" or "shrunk desktop on mobile" feel

Output `audit/rwd-review.md` listing any concerns. If anything looks wrong → file new AUD-NNN.
```

- [ ] **Step 2:** If R1 files any new issue, loop back to Phase D. **Hard gate.**

- [ ] **Step 3: Commit gate artefacts**

```bash
git add audit/rwd-grid audit/rwd-gate.log audit/rwd-review.md
git commit -m "chore(audit): RWD visual gate green across 8 viewports"
```

---

## Phase G: Finishing the development branch

**Estimate:** 5 min.

### Task G.1: Final ship-criteria checklist

- [ ] All P0+P1 audit specs pass: ✅
- [ ] `npm test` green: ✅
- [ ] All 8 Playwright projects green: ✅
- [ ] No console errors: ✅
- [ ] RWD visual gate green: ✅
- [ ] R1 RWD review file empty: ✅

If any unchecked → back to Phase D.

### Task G.2: Invoke `superpowers:finishing-a-development-branch`

- [ ] **Step 1:** Invoke the skill. It will offer merge / PR / cleanup.
- [ ] **Step 2:** Follow its decision. Tag the merge commit `audit/2026-04-30-passed`.
- [ ] **Step 3:** Run `npm run cleanup:empty-sessions` (cleanup of test sessions). Verify in Supabase that `agent-u*+*@pmdrill.test` rows are removed.
- [ ] **Step 4:** Update `audit/README.md` status table — every row → `done`. Commit.

```bash
git tag audit/2026-04-30-passed
git add audit/README.md
git commit -m "chore(audit): 2026-04-30 cycle complete; ship-ready"
```

---

## Self-review

**Spec coverage:**
- § 2 roster (5+2) → Phase B + C ✅
- § 3 journey (10 steps) → Phase B prompt template ✅
- § 4 Issue #0 → seeded in `audit/README.md`, R1 must include in P0, fix loop covers ✅
- § 5 14 skills mapped → using-superpowers (start), brainstorming (done), writing-plans (this doc), executing-plans (Phase D), using-git-worktrees (Phase D Step 1), dispatching-parallel-agents (Phase B Step 2), subagent-driven-development (Phase D Step 3), systematic-debugging (Phase D Step 3 prompt), test-driven-development (Phase C Step 1 spec-first → Phase D fix), verification-before-completion (Phase D Step 4), requesting-code-review (Phase D Step 6), receiving-code-review (Phase D Step 6 loop), writing-skills (deferred — surfaces only if reusable pattern emerges; if none, skip with note), finishing-a-development-branch (Phase G Step 2) ✅
- § 6 file layout → matches Phase A scaffolding ✅
- § 7 ship criteria — items 1–6 → Phase D-G ✅
- § 7.1 RWD gate → Phase F ✅
- § 8 risks: OpenAI quota — Phase B prompt acknowledges; test accounts — Phase A.3 + Phase G Step 3 cleanup ✅

**Placeholder scan:** `<persona-specific behaviour>` and `<persona-NN>` in B.1 prompt template — these are placeholders by design (filled per-agent in B.2). Acceptable. No other TBDs.

**Type consistency:** Issue ID format `AUD-NNN` used throughout. Path `audit/screenshots/u<n>/` matches Phase A.1 scaffolding. Project names in F.1 match the `--project=` flags in F.3. Spec filenames `audit-AUD-NNN.spec.js` consistent across C.2 / D.1.

One soft spot acknowledged: helper `enter-circles-step.js` relies on `[data-step]` attribute existing in the DOM. If it doesn't, F.2 helpers will need a one-line tweak when the spec first runs — flag for the executing agent, not a plan failure.

---

## Execution Handoff

**Two execution options:**

**1. Subagent-Driven (recommended)** — REQUIRED SUB-SKILL: `superpowers:subagent-driven-development`. Fresh subagent per Phase B/C/D issue, two-stage review, fast iteration. Phases B, C, D are subagent-native; A, E, F, G executed inline.

**2. Inline Execution** — REQUIRED SUB-SKILL: `superpowers:executing-plans`. Walk every task in this session. Slower, more main-context bloat.

Default: **Subagent-Driven.**
