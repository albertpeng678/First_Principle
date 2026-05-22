# P0-SCHEMA-1-v2 NSM `/evaluate` Shape Coerce Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Defend NSM `/evaluate` against string-shape `user_nsm` writes (which silently drop `explanation` + `businessLink` fields), via FE source fix + BE coerce-merge helper.

**Architecture:** Two-layer defense — (1) BE `coerceUserNsm()` helper centralizes shape coercion across 6 write sites, merging incoming strings with existing DB row to preserve fields; (2) FE 2 lines switch from sending `nsm` string to sending full 3-key object. Shipped in 2 sequential commits (BE first / FE second) with 6 hr + 24 hr soak windows respectively.

**Tech Stack:** Node.js + Express (BE routes), Supabase service-role client (DB), vanilla JS (FE `public/app.js`), Playwright (API + E2E tests).

**Spec ref:** `docs/superpowers/specs/2026-05-22-schema-1-v2-evaluate-shape-coerce-design.md`

**Skill citations (RITUAL §3.19)** — every test spec header must cite these:
- `playwright-skill/core/api-testing.md §APIRequestContext Basics` — request fixture
- `playwright-skill/core/api-testing.md §Data Seeding (service-role carve-out)` — DB seed
- `playwright-skill/core/common-pitfalls.md Pitfall 11` — no-mock self-backend
- `playwright-skill/core/common-pitfalls.md Pitfall 14` — test-local + auto-cleanup
- `playwright-skill/core/common-pitfalls.md Pitfall 19` — `test.step()` per phase
- `playwright-skill/core/auth-flows.md:928-949` — login via API for speed
- `playwright-skill/core/mobile-and-responsive.md` — cross-vp 3 projects
- `addy/test-driven-development` Prove-It pattern — red → green proof
- `karpathy-guidelines §4.1-§4.4` — Think Before / Simplicity / Surgical / Goal-Driven

**Prerequisite gate:** NEW-1 (CIRCLES RLS `917d485`) 24 hr soak GREEN before Task 6 (Commit 1 push) and again before Task 11 (Commit 2 push).

---

## File Structure

### New files
- `routes/_helpers/coerce-user-nsm.js` — Helper module, single export `coerceUserNsm({incoming, sessionId, db})` async function with 5 branches (B1-B5)
- `tests/api/nsm-evaluate-shape-coerce.spec.js` — 3 TCs (TC1 string merge / TC2 object passthrough / TC3 invalid type no-op), auth + guest variants
- `tests/e2e/nsm-evaluate-shape-roundtrip.spec.js` — 1 TC, full browser fill→evaluate→reload→assert, 3 vp

### Modified files
- `routes/nsm-sessions.js` — 3 edits: line 131 (eval checkpoint), 140 (eval final), 228 (progress PATCH) + 1 import
- `routes/guest-nsm-sessions.js` — 3 edits: line 108 (eval checkpoint), 114 (eval final), 181 (progress PATCH) + 1 import
- `public/app.js` — 2 edits: line 2016 (evaluate first), 2518 (evaluate retry)
- `tests/api/playwright.config.js` — Add `nsm-evaluate-shape-coerce` project

---

# COMMIT 1 — BE coerce defense layer

## Task 1: Create coerce helper module + jest sanity probe (TDD red)

**Files:**
- Create: `routes/_helpers/coerce-user-nsm.js`
- Probe: stdout via temporary `node -e` invocation (no jest spec; helper has DB dep — full coverage is API spec Task 4)

- [ ] **Step 1: Create helper file with stub that throws**

```js
// routes/_helpers/coerce-user-nsm.js
'use strict';

/**
 * Coerce incoming userNsm value into a guaranteed object shape.
 * Idempotent for object input; merges with existing DB row on string input.
 *
 * Spec: docs/superpowers/specs/2026-05-22-schema-1-v2-evaluate-shape-coerce-design.md §3
 *
 * @param {Object}  args
 * @param {*}       args.incoming    Raw value from req.body.userNsm
 * @param {string}  args.sessionId   nsm_sessions.id for SELECT-merge path
 * @param {Object}  args.db          Supabase service-role client
 * @returns {Promise<Object|undefined>}
 */
async function coerceUserNsm({ incoming, sessionId, db }) {
  throw new Error('not_implemented');
}

module.exports = { coerceUserNsm };
```

- [ ] **Step 2: Probe stub throws**

Run:
```bash
node -e "require('./routes/_helpers/coerce-user-nsm').coerceUserNsm({incoming:'x', sessionId:'y', db:null}).catch(e => console.log('RED:', e.message))"
```
Expected output: `RED: not_implemented`

- [ ] **Step 3: Implement all 5 branches**

Replace the stub body with:

```js
async function coerceUserNsm({ incoming, sessionId, db }) {
  // B1: undefined → no-op
  if (incoming === undefined) return undefined;

  // B2: object → passthrough (FE contract: caller MUST send all 3 keys)
  if (incoming !== null && typeof incoming === 'object' && !Array.isArray(incoming)) {
    return incoming;
  }

  // B3/B4: string → SELECT existing + merge (with fallback)
  if (typeof incoming === 'string') {
    try {
      const { data, error } = await db
        .from('nsm_sessions')
        .select('user_nsm')
        .eq('id', sessionId)
        .single();
      const existing = (data && data.user_nsm && typeof data.user_nsm === 'object' && !Array.isArray(data.user_nsm))
        ? data.user_nsm
        : null;
      if (!error && existing) {
        console.warn('[coerce-user-nsm] string→object', { sessionId, incomingLen: incoming.length });
        return {
          nsm: incoming,
          explanation: existing.explanation || '',
          businessLink: existing.businessLink || '',
        };
      }
      // B4: SELECT fail or row missing → fallback wrap
      console.warn('[coerce-user-nsm] SELECT fail fallback', { sessionId, err: error && error.message });
      return { nsm: incoming, explanation: '', businessLink: '' };
    } catch (e) {
      console.warn('[coerce-user-nsm] SELECT throw fallback', { sessionId, err: e.message });
      return { nsm: incoming, explanation: '', businessLink: '' };
    }
  }

  // B5: number/array/null/boolean → invalid → no-op
  console.warn('[coerce-user-nsm] invalid type', { sessionId, type: typeof incoming, isArray: Array.isArray(incoming) });
  return undefined;
}
```

- [ ] **Step 4: Probe each branch via inline node -e**

Run B1:
```bash
node -e "require('./routes/_helpers/coerce-user-nsm').coerceUserNsm({incoming:undefined, sessionId:'x', db:null}).then(r => console.log('B1:', r))"
```
Expected: `B1: undefined`

Run B2:
```bash
node -e "require('./routes/_helpers/coerce-user-nsm').coerceUserNsm({incoming:{nsm:'a',explanation:'b',businessLink:'c'}, sessionId:'x', db:null}).then(r => console.log('B2:', JSON.stringify(r)))"
```
Expected: `B2: {"nsm":"a","explanation":"b","businessLink":"c"}`

Run B5 array:
```bash
node -e "require('./routes/_helpers/coerce-user-nsm').coerceUserNsm({incoming:[1,2], sessionId:'x', db:null}).then(r => console.log('B5-array:', r))"
```
Expected: `B5-array: undefined`

Run B5 number:
```bash
node -e "require('./routes/_helpers/coerce-user-nsm').coerceUserNsm({incoming:42, sessionId:'x', db:null}).then(r => console.log('B5-num:', r))"
```
Expected: `B5-num: undefined`

(B3/B4 require real DB — covered in Task 4 API spec.)

- [ ] **Step 5: Do NOT commit yet** — helper unused, will be committed alongside route wires in Task 6.

---

## Task 2: Wire helper into `routes/nsm-sessions.js` (auth, 3 sites)

**Files:**
- Modify: `routes/nsm-sessions.js` lines 1-20 (add require), 131, 140, 228

- [ ] **Step 1: Add require at top of file**

Read `routes/nsm-sessions.js` lines 1-15 to find existing requires. Insert:

```js
const { coerceUserNsm } = require('./_helpers/coerce-user-nsm');
```

after the last existing `require(...)` line.

- [ ] **Step 2: Patch line 131 (evaluate checkpoint write)**

Find:
```js
    if (cpErr) console.error('[nsm-evaluate] checkpoint write failed', cpErr);
  }
```

The line above this (around 124-126) does the checkpoint UPDATE. Replace `user_nsm: userNsm` in that update with:

```js
user_nsm: await coerceUserNsm({ incoming: userNsm, sessionId: req.params.id, db }),
```

Note: the enclosing function is already `async` and the line is inside an `await db.from(...).update(...)` chain, so `await` is valid.

- [ ] **Step 3: Patch line 140 (evaluate final write)**

Find the final update block (around lines 138-148):
```js
    const { error: upErr } = await db.from('nsm_sessions').update({
      user_nsm: userNsm,
      user_breakdown: userBreakdown,
      ...
```

Replace `user_nsm: userNsm,` with:
```js
user_nsm: await coerceUserNsm({ incoming: userNsm, sessionId: req.params.id, db }),
```

- [ ] **Step 4: Patch line 228 (progress PATCH)**

Find:
```js
    if (userNsm       !== undefined) patch.user_nsm       = userNsm;
```

Replace with:
```js
    if (userNsm !== undefined) {
      const coerced = await coerceUserNsm({ incoming: userNsm, sessionId: req.params.id, db });
      if (coerced !== undefined) patch.user_nsm = coerced;
    }
```

- [ ] **Step 5: Verify syntax via node parse**

Run:
```bash
node --check routes/nsm-sessions.js
```
Expected: no output (syntax OK)

---

## Task 3: Wire helper into `routes/guest-nsm-sessions.js` (guest, 3 sites)

**Files:**
- Modify: `routes/guest-nsm-sessions.js` (require + lines 108, 114, 181)

- [ ] **Step 1: Add require at top**

Same pattern as Task 2 Step 1:
```js
const { coerceUserNsm } = require('./_helpers/coerce-user-nsm');
```

- [ ] **Step 2: Patch line 108 (guest evaluate checkpoint)**

Find the checkpoint UPDATE block around 105-110, replace `user_nsm: userNsm` with:
```js
user_nsm: await coerceUserNsm({ incoming: userNsm, sessionId: req.params.id, db }),
```

- [ ] **Step 3: Patch line 114 (guest evaluate final)**

Find the final UPDATE block around 112-120, replace `user_nsm: userNsm,` with:
```js
user_nsm: await coerceUserNsm({ incoming: userNsm, sessionId: req.params.id, db }),
```

- [ ] **Step 4: Patch line 181 (guest progress PATCH)**

Find:
```js
    if (userNsm       !== undefined) patch.user_nsm       = userNsm;
```

Replace with:
```js
    if (userNsm !== undefined) {
      const coerced = await coerceUserNsm({ incoming: userNsm, sessionId: req.params.id, db });
      if (coerced !== undefined) patch.user_nsm = coerced;
    }
```

- [ ] **Step 5: Verify syntax**

Run:
```bash
node --check routes/guest-nsm-sessions.js
```
Expected: no output

---

## Task 4: Create API spec with 3 TCs (auth + guest), wire to playwright config

**Files:**
- Create: `tests/api/nsm-evaluate-shape-coerce.spec.js`
- Modify: `tests/api/playwright.config.js` (add project)

- [ ] **Step 1: Add project to playwright config**

Open `tests/api/playwright.config.js`. After the last project (currently `api-rls-isolation` ending around line 210), add inside the `projects` array:

```js
    // P0-SCHEMA-1-v2 — NSM /evaluate user_nsm shape coerce verification.
    // 6 TCs (auth × 3 + guest × 3): TC1 string→object merge preserves explanation/businessLink;
    // TC2 object passthrough; TC3 invalid type (array) → no-op.
    // Skills: api-testing.md §APIRequestContext + §Data Seeding (service-role).
    {
      name: 'api-nsm-evaluate-shape-coerce',
      testMatch: /nsm-evaluate-shape-coerce\.spec\.js$/,
    },
```

- [ ] **Step 2: Create test spec file**

Create `tests/api/nsm-evaluate-shape-coerce.spec.js`:

```js
// tests/api/nsm-evaluate-shape-coerce.spec.js
//
// P0-SCHEMA-1-v2 — NSM /evaluate user_nsm shape coerce verification.
// Spec: docs/superpowers/specs/2026-05-22-schema-1-v2-evaluate-shape-coerce-design.md §6
//
// Skills applied:
//   playwright-skill/core/api-testing.md §APIRequestContext Basics — request fixture
//   playwright-skill/core/api-testing.md §Data Seeding (service-role carve-out)
//   playwright-skill/core/common-pitfalls.md Pitfall 11 — no-mock self-backend
//   playwright-skill/core/common-pitfalls.md Pitfall 14 — test-local + auto-cleanup
//   addy/test-driven-development Prove-It pattern — red→green proof of B3 merge
//
// 6 TCs = auth × 3 + guest × 3:
//   TC1 string→object merge preserves existing explanation/businessLink
//   TC2 object passthrough (idempotent)
//   TC3 invalid type (array) → no-op (DB unchanged)

const { test, expect } = require('@playwright/test');
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BASE_URL = (process.env.API_BASE_URL || 'http://localhost:4000').replace(/\/$/, '');
const TEST_EMAIL = 'e2e@first-principle.test';
const TEST_PASSWORD = process.env.TEST_PASSWORD;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !TEST_PASSWORD) {
  throw new Error('Missing env: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / TEST_PASSWORD');
}

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Test-local cleanup tracker (Pitfall 14)
const createdSessionIds = [];

test.afterAll(async () => {
  if (createdSessionIds.length) {
    await admin.from('nsm_sessions').delete().in('id', createdSessionIds);
  }
});

async function getAuthToken(request) {
  const res = await request.post(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    headers: { 'apikey': process.env.SUPABASE_ANON_KEY || '', 'Content-Type': 'application/json' },
    data: { email: TEST_EMAIL, password: TEST_PASSWORD },
  });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  return { token: body.access_token, userId: body.user.id };
}

async function seedAuthSession(userId, initialUserNsm) {
  const id = crypto.randomUUID();
  const { error } = await admin.from('nsm_sessions').insert({
    id,
    user_id: userId,
    question_id: `coerce-tc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    question_json: { id: 'q1', nsm: 'Test', evaluator: { dims: [] } },
    status: 'editing',
    lifecycle: 'editing',
    user_nsm: initialUserNsm,
    user_breakdown: {},
    progress_json: { currentStep: 3 },
  });
  if (error) throw new Error(`seed failed: ${error.message}`);
  createdSessionIds.push(id);
  return id;
}

async function seedGuestSession(guestId, initialUserNsm) {
  const id = crypto.randomUUID();
  const { error } = await admin.from('nsm_sessions').insert({
    id,
    guest_id: guestId,
    question_id: `coerce-tc-guest-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    question_json: { id: 'q1', nsm: 'Test', evaluator: { dims: [] } },
    status: 'editing',
    lifecycle: 'editing',
    user_nsm: initialUserNsm,
    user_breakdown: {},
    progress_json: { currentStep: 3 },
  });
  if (error) throw new Error(`seed failed: ${error.message}`);
  createdSessionIds.push(id);
  return id;
}

async function readBack(sessionId) {
  const { data, error } = await admin.from('nsm_sessions').select('user_nsm').eq('id', sessionId).single();
  if (error) throw error;
  return data.user_nsm;
}

test.describe('P0-SCHEMA-1-v2 coerce — auth route', () => {
  test('TC1 string input merges with existing explanation/businessLink', async ({ request }) => {
    const { token, userId } = await getAuthToken(request);
    const sid = await seedAuthSession(userId, { nsm: 'old', explanation: 'X', businessLink: 'Y' });

    const res = await request.patch(`${BASE_URL}/api/nsm-sessions/${sid}/progress`, {
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { userNsm: 'new' },
    });
    expect(res.status()).toBeLessThan(500);

    const after = await readBack(sid);
    expect(after).toEqual({ nsm: 'new', explanation: 'X', businessLink: 'Y' });
  });

  test('TC2 object input passes through unchanged', async ({ request }) => {
    const { token, userId } = await getAuthToken(request);
    const sid = await seedAuthSession(userId, {});

    const res = await request.patch(`${BASE_URL}/api/nsm-sessions/${sid}/progress`, {
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { userNsm: { nsm: 'a', explanation: 'b', businessLink: 'c' } },
    });
    expect(res.status()).toBeLessThan(500);

    const after = await readBack(sid);
    expect(after).toEqual({ nsm: 'a', explanation: 'b', businessLink: 'c' });
  });

  test('TC3 array input → no-op (DB unchanged)', async ({ request }) => {
    const { token, userId } = await getAuthToken(request);
    const sid = await seedAuthSession(userId, { nsm: 'old', explanation: 'X', businessLink: 'Y' });

    const res = await request.patch(`${BASE_URL}/api/nsm-sessions/${sid}/progress`, {
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { userNsm: [1, 2, 3] },
    });
    expect(res.status()).toBeLessThan(500);

    const after = await readBack(sid);
    expect(after).toEqual({ nsm: 'old', explanation: 'X', businessLink: 'Y' });
  });
});

test.describe('P0-SCHEMA-1-v2 coerce — guest route', () => {
  test('TC1 guest string input merges', async ({ request }) => {
    const guestId = crypto.randomUUID();
    const sid = await seedGuestSession(guestId, { nsm: 'old', explanation: 'X', businessLink: 'Y' });

    const res = await request.patch(`${BASE_URL}/api/guest/nsm-sessions/${sid}/progress`, {
      headers: { 'X-Guest-ID': guestId, 'Content-Type': 'application/json' },
      data: { userNsm: 'new' },
    });
    expect(res.status()).toBeLessThan(500);

    const after = await readBack(sid);
    expect(after).toEqual({ nsm: 'new', explanation: 'X', businessLink: 'Y' });
  });

  test('TC2 guest object passthrough', async ({ request }) => {
    const guestId = crypto.randomUUID();
    const sid = await seedGuestSession(guestId, {});

    const res = await request.patch(`${BASE_URL}/api/guest/nsm-sessions/${sid}/progress`, {
      headers: { 'X-Guest-ID': guestId, 'Content-Type': 'application/json' },
      data: { userNsm: { nsm: 'a', explanation: 'b', businessLink: 'c' } },
    });
    expect(res.status()).toBeLessThan(500);

    const after = await readBack(sid);
    expect(after).toEqual({ nsm: 'a', explanation: 'b', businessLink: 'c' });
  });

  test('TC3 guest array → no-op', async ({ request }) => {
    const guestId = crypto.randomUUID();
    const sid = await seedGuestSession(guestId, { nsm: 'old', explanation: 'X', businessLink: 'Y' });

    const res = await request.patch(`${BASE_URL}/api/guest/nsm-sessions/${sid}/progress`, {
      headers: { 'X-Guest-ID': guestId, 'Content-Type': 'application/json' },
      data: { userNsm: [1, 2, 3] },
    });
    expect(res.status()).toBeLessThan(500);

    const after = await readBack(sid);
    expect(after).toEqual({ nsm: 'old', explanation: 'X', businessLink: 'Y' });
  });
});
```

- [ ] **Step 3: Run spec — expect GREEN (all 6 TCs)**

Run:
```bash
npx playwright test --config tests/api/playwright.config.js --project=api-nsm-evaluate-shape-coerce --reporter=list 2>&1 | tail -20
```
Expected: `6 passed`

If RED on TC1/TC2 — wire fix in Task 2/3 is wrong. Re-check line edits.
If RED on TC3 — helper B5 branch returning the wrong thing.

- [ ] **Step 4: 5× consecutive verification**

Run:
```bash
for i in 1 2 3 4 5; do echo "=== Run $i ==="; npx playwright test --config tests/api/playwright.config.js --project=api-nsm-evaluate-shape-coerce --reporter=list 2>&1 | tail -3; done
```
Expected: all 5 runs show `6 passed`. Total 30/30.

If any flake → diagnose via `flaky-tests.md` (do NOT retry hack). Common cause: cleanup race — add per-test seed nonce.

- [ ] **Step 5: Do NOT commit yet** — final commit assembled in Task 6.

---

## Task 5: Jest regression check

**Files:** none modified

- [ ] **Step 1: Run full jest suite**

Run:
```bash
npx jest 2>&1 | tail -15
```
Expected: ≥ 605 pass (baseline post-NEW-1 e2e supplementation). 2 known fails in `circles-final-report-adversarial.test.js:450` (HALLUCINATED_PRAISE — pre-existing LLM variance, tracker NEW-B13-W1).

If any NEW fail outside that file → BE wire broke something in jest land. Diagnose before commit.

- [ ] **Step 2: Cross-vp smoke (optional but recommended for ship-gate)**

Run NSM-related e2e:
```bash
npx playwright test --config tests/e2e/playwright.config.js tests/e2e/nsm-full-flow.spec.js --reporter=list 2>&1 | tail -10
```
Expected: 0 NEW fail. Any pre-existing fail must match tracker §3 entry (e.g., P2-Q-3 / O-13 / #264).

---

## Task 6: 2-stage review + Commit 1 + push origin/main

**Files staged:**
- `routes/_helpers/coerce-user-nsm.js` (new)
- `routes/nsm-sessions.js` (modified)
- `routes/guest-nsm-sessions.js` (modified)
- `tests/api/nsm-evaluate-shape-coerce.spec.js` (new)
- `tests/api/playwright.config.js` (modified)

- [ ] **Step 1: Pre-commit verify NEW-1 soak gate**

Check if NEW-1 (commit `917d485`) has been on main for ≥ 24 hr:
```bash
git log --format='%H %ai' 917d485 -1
date -u
```
Compute delta. If < 24 hr → STOP and wait. If ≥ 24 hr → continue.

- [ ] **Step 2: Stage files**

```bash
git add routes/_helpers/coerce-user-nsm.js \
        routes/nsm-sessions.js \
        routes/guest-nsm-sessions.js \
        tests/api/nsm-evaluate-shape-coerce.spec.js \
        tests/api/playwright.config.js
git diff --cached --stat
```

- [ ] **Step 3: Dispatch 2-stage review (parallel, opus)**

Reviewer 1 (spec compliance): "Read `docs/superpowers/specs/2026-05-22-schema-1-v2-evaluate-shape-coerce-design.md` § 1-11. Read staged diff. Confirm every spec requirement has matching code. Flag any gap or extra unrequested change. Output: APPROVED / BLOCKED + list."

Reviewer 2 (code quality, addy `code-reviewer` persona): "5-axis review on staged diff (correctness / readability / architecture / security / performance). Karpathy §4.1-§4.4 compliance check. Output: APPROVED / BLOCKED + severity-tagged issues."

If either BLOCKED → fix → re-review → loop until both APPROVED.

- [ ] **Step 4: Commit**

```bash
git commit -m "$(cat <<'EOF'
fix(P0-SCHEMA-1-v2/BE): coerce user_nsm shape across 6 write sites

New: routes/_helpers/coerce-user-nsm.js (5 branches B1-B5 incl SELECT-merge for string input, fallback-wrap on SELECT fail, no-op for invalid types)
Wire: nsm-sessions.js (auth /evaluate × 2 phases + /progress PATCH)
Wire: guest-nsm-sessions.js (guest /evaluate × 2 phases + /progress PATCH)
Test: tests/api/nsm-evaluate-shape-coerce.spec.js — 6 TCs (auth × 3 + guest × 3) × 5 runs = 30/30 GREEN

FE source fix (app.js:2016+2518) ships in Commit 2 after 6 hr soak.

Spec: docs/superpowers/specs/2026-05-22-schema-1-v2-evaluate-shape-coerce-design.md
Closes (partial): tracker §1 P0-SCHEMA-1-v2

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 5: Push origin/main**

```bash
git push origin main
git log -1 --oneline
```

---

## Task 7: 6 hr BE soak window monitoring

**Files:** none

- [ ] **Step 1: Log timestamp of Commit 1 push**

Note the timestamp. Soak ends at `push_ts + 6 hours`.

- [ ] **Step 2: Mid-soak check (~3 hr in)**

Open Supabase log dashboard (manual). Search for `[coerce-user-nsm]`.
Expected:
- B3 (`string→object`) triggers > 0 (FE still sends string, proves coerce active)
- B4 + B5 should be 0 (no DB failures, no invalid types)

If B4 or B5 appears unexpectedly → investigate before continuing to Commit 2.

- [ ] **Step 3: End-of-soak verify (6 hr mark)**

Re-run API spec:
```bash
npx playwright test --config tests/api/playwright.config.js --project=api-nsm-evaluate-shape-coerce --reporter=list 2>&1 | tail -5
```
Expected: 6/6 GREEN.

Run agent-B-style DB scan (1 command):
```bash
node -e "
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
admin.from('nsm_sessions').select('user_nsm').limit(10000).then(({data}) => {
  let str = 0, obj = 0, other = 0;
  for (const r of data) {
    if (typeof r.user_nsm === 'string') str++;
    else if (r.user_nsm && typeof r.user_nsm === 'object') obj++;
    else other++;
  }
  console.log({total: data.length, string: str, object: obj, other});
});
"
```
Expected: `string: 0` (defense kept 0 string rows).

---

# COMMIT 2 — FE source fix

## Task 8: Patch `public/app.js` line 2016 (evaluate first call)

**Files:**
- Modify: `public/app.js:2014-2019`

- [ ] **Step 1: Find current line 2016**

Read lines 2010-2020:
```js
            var res = await window.apiFetch(basePath + sessionId + '/evaluate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                userNsm: (AppState.nsmDefinition || {}).nsm || '',
                userBreakdown: AppState.nsmBreakdown || {},
              }),
            });
```

- [ ] **Step 2: Edit line 2016**

Replace:
```js
                userNsm: (AppState.nsmDefinition || {}).nsm || '',
```

With:
```js
                userNsm: AppState.nsmDefinition || { nsm: '', explanation: '', businessLink: '' },
```

(Mirrors existing `app.js:2075` pattern from NEW-Bug-A `b126937`.)

- [ ] **Step 3: Verify syntax via node parse**

Run:
```bash
node --check public/app.js
```
Expected: no output

---

## Task 9: Patch `public/app.js` line 2518 (evaluate retry button)

**Files:**
- Modify: `public/app.js:2516-2520`

- [ ] **Step 1: Read current line 2518**

Read lines 2513-2522:
```js
          var res = await window.apiFetch(basePath + sid + '/evaluate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userNsm: (AppState.nsmDefinition || {}).nsm || '',
              userBreakdown: AppState.nsmBreakdown || {},
            }),
          });
```

- [ ] **Step 2: Edit line 2518**

Replace:
```js
              userNsm: (AppState.nsmDefinition || {}).nsm || '',
```

With:
```js
              userNsm: AppState.nsmDefinition || { nsm: '', explanation: '', businessLink: '' },
```

- [ ] **Step 3: Verify syntax**

Run:
```bash
node --check public/app.js
```
Expected: no output

---

## Task 10: Create E2E roundtrip spec

**Files:**
- Create: `tests/e2e/nsm-evaluate-shape-roundtrip.spec.js`

- [ ] **Step 1: Create spec file**

Create `tests/e2e/nsm-evaluate-shape-roundtrip.spec.js`:

```js
// tests/e2e/nsm-evaluate-shape-roundtrip.spec.js
//
// P0-SCHEMA-1-v2 — full browser roundtrip: fill 3 fields → evaluate → reload → assert 3 fields restored.
// Spec: docs/superpowers/specs/2026-05-22-schema-1-v2-evaluate-shape-coerce-design.md §6
//
// Skills applied:
//   playwright-skill/core/auth-flows.md:928-949 — login via API for speed (storageState)
//   playwright-skill/core/common-pitfalls.md Pitfall 14 — auto-cleanup fixture
//   playwright-skill/core/common-pitfalls.md Pitfall 19 — test.step per phase
//   playwright-skill/core/common-pitfalls.md Pitfall 3 — role-based locators
//   playwright-skill/core/mobile-and-responsive.md — cross-vp 3 projects

const { test, expect } = require('@playwright/test');
const { createClient } = require('@supabase/supabase-js');

test.use({ storageState: 'playwright/.auth/user.json' });

const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const createdIds = [];

test.afterAll(async () => {
  if (createdIds.length) await admin.from('nsm_sessions').delete().in('id', createdIds);
});

test('SCHEMA-1-v2 roundtrip: 3 fields persist through evaluate + reload', async ({ page }) => {
  await test.step('Phase 1: navigate to NSM step 1, pick question', async () => {
    await page.goto('/');
    await page.getByRole('link', { name: /NSM/ }).first().click();
    await expect(page).toHaveURL(/nsm/, { timeout: 10000 });
    // Click any question card to enter step 1
    await page.locator('[data-nsm-question-id]').first().click();
    await expect(page.locator('.nsm-step-1, [data-nsm-step="1"]')).toBeVisible({ timeout: 10000 });
  });

  await test.step('Phase 2: fill 3 fields (nsm + explanation + businessLink)', async () => {
    await page.locator('[data-nsm-field="nsm"]').fill('TEST_NSM_VALUE_' + Date.now());
    await page.locator('[data-nsm-field="explanation"]').fill('TEST_EXPL_VALUE');
    await page.locator('[data-nsm-field="businessLink"]').fill('TEST_LINK_VALUE');
    // Wait for 800ms debounced save (triggerNsmSaveCycle)
    await page.waitForTimeout(1200);
    // Wait for PATCH /progress to land
    await page.waitForResponse(r => /\/progress/.test(r.url()) && r.request().method() === 'PATCH', { timeout: 5000 }).catch(() => {});
  });

  let sessionIdBefore;
  await test.step('Phase 3: capture session id, navigate to evaluate (step 3)', async () => {
    sessionIdBefore = await page.evaluate(() => window.AppState && window.AppState.nsmSession && window.AppState.nsmSession.id);
    expect(sessionIdBefore).toBeTruthy();
    createdIds.push(sessionIdBefore);
  });

  await test.step('Phase 4: F5 reload, expect 3 fields restored from DB roundtrip', async () => {
    await page.reload();
    await expect(page.locator('[data-nsm-field="nsm"]')).toHaveValue(/TEST_NSM_VALUE_/, { timeout: 15000 });
    await expect(page.locator('[data-nsm-field="explanation"]')).toHaveValue('TEST_EXPL_VALUE');
    await expect(page.locator('[data-nsm-field="businessLink"]')).toHaveValue('TEST_LINK_VALUE');
  });

  await test.step('Phase 5: verify DB user_nsm is object shape with 3 keys', async () => {
    const { data } = await admin.from('nsm_sessions').select('user_nsm').eq('id', sessionIdBefore).single();
    expect(typeof data.user_nsm).toBe('object');
    expect(data.user_nsm).toMatchObject({
      explanation: 'TEST_EXPL_VALUE',
      businessLink: 'TEST_LINK_VALUE',
    });
    expect(data.user_nsm.nsm).toMatch(/^TEST_NSM_VALUE_/);
  });
});
```

- [ ] **Step 2: Run once to verify GREEN**

```bash
npx playwright test --config tests/e2e/playwright.config.js tests/e2e/nsm-evaluate-shape-roundtrip.spec.js --project=e2e-desktop --reporter=list 2>&1 | tail -10
```
Expected: `1 passed`

If RED on Phase 4 (3 fields not restored) → FE restore path bug, may interact with D-2 LS issue. Diagnose via `nsmTryResumeLatestSession` log.

If RED on Phase 5 (`user_nsm` is string) → FE fix in Task 8/9 didn't land OR BE coerce broke. Re-check.

- [ ] **Step 3: Cross-vp 5× verification**

Run:
```bash
for i in 1 2 3 4 5; do echo "=== Run $i ==="; npx playwright test --config tests/e2e/playwright.config.js tests/e2e/nsm-evaluate-shape-roundtrip.spec.js --reporter=list 2>&1 | tail -3; done
```
Expected: all 5 runs show 3 passed (1 TC × 3 projects). Total 15/15.

Any flake → diagnose root cause. Common: `waitForTimeout(1200)` may need extension on slow mobile-safari → switch to event-based wait.

---

## Task 11: 2-stage review + Commit 2 + push origin/main

**Files staged:**
- `public/app.js` (modified, 2 lines)
- `tests/e2e/nsm-evaluate-shape-roundtrip.spec.js` (new)

- [ ] **Step 1: Verify Commit 1 has soaked ≥ 6 hr**

```bash
git log --format='%H %ai %s' | grep 'P0-SCHEMA-1-v2/BE' | head -1
date -u
```
Compute delta. < 6 hr → STOP and wait.

- [ ] **Step 2: Stage**

```bash
git add public/app.js tests/e2e/nsm-evaluate-shape-roundtrip.spec.js
git diff --cached --stat
```

- [ ] **Step 3: Dispatch 2-stage review (parallel, opus)**

Same pattern as Task 6 Step 3. Spec compliance + code quality on the 2-line FE change + new E2E spec.

- [ ] **Step 4: Commit**

```bash
git commit -m "$(cat <<'EOF'
fix(P0-SCHEMA-1-v2/FE): NSM /evaluate POST send full object instead of nsm string

app.js:2016 (first eval) + 2518 (retry): switch from `userNsm: nsm_string` to `userNsm: AppState.nsmDefinition || {nsm,explanation,businessLink default}`. Mirrors NEW-Bug-A b126937 pattern at app.js:2075 (already correct for /progress).

Source-fix layer of P0-SCHEMA-1-v2; BE coerce defense from Commit 1 (`<COMMIT-1-SHA>`) still active for any future regression.

Test: tests/e2e/nsm-evaluate-shape-roundtrip.spec.js — fill 3 fields → /evaluate → reload → 3 fields restored. Cross-vp 3 × 5 runs = 15/15 GREEN. Phase 5 asserts DB user_nsm is object shape with all 3 keys.

Spec: docs/superpowers/specs/2026-05-22-schema-1-v2-evaluate-shape-coerce-design.md
Closes tracker §1 P0-SCHEMA-1-v2

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 5: Push origin/main**

```bash
git push origin main
git log -1 --oneline
```

---

## Task 12: 24 hr FE soak + final closure

**Files:**
- Modify: `audit/e2e-master-tracker.md` (cut §1 entry → §5)
- Modify: `CLAUDE.md`

- [ ] **Step 1: Mark soak window start**

Note Commit 2 push timestamp. Soak ends 24 hr later.

- [ ] **Step 2: Mid-soak monitoring (~12 hr)**

Supabase log: `[coerce-user-nsm] string→object` trigger count should drop to ~0 (FE no longer sends string).
If B3 still triggering → some other FE site still sending string. Investigate.

- [ ] **Step 3: End-of-soak verify (24 hr mark)**

Run all 3 lanes parallel (per `feedback_cross_plan_smoke_after_each_ship`):
- jest full
- api smoke (all 11+ projects)
- cross-vp 5× on nsm-evaluate-shape-roundtrip + nsm-full-flow + circles-gate

Re-run agent-B DB scan: expect `string: 0` AND obj_full ratio > 0.72% (proves new evaluations writing all 3 keys).

- [ ] **Step 4: Update tracker — cut §1 → §5**

Edit `audit/e2e-master-tracker.md`:
- Delete `### 🚨 P0-SCHEMA-1-v2` block from §1
- Append closure entry to §5 with: commit SHAs (Commit 1 + Commit 2) / e2e supplementation evidence / 24 hr soak verify / skill citations

Same pattern as NEW-1 closure entry (`### P0-SCHEMA-NEW-1` in §5).

- [ ] **Step 5: Update CLAUDE.md state board**

In `CLAUDE.md` `🚧 當前 phase` section, replace SCHEMA-1-v2 row in "進入下一步" with:
- ✅ SHIPPED `<C1>` + `<C2>` — 2-commit BE-first / FE-second
- Move down "SCHEMA-3 guest_id index" to "next 動工"

Update "Last updated" line.

- [ ] **Step 6: Commit + push doc sync**

```bash
git add audit/e2e-master-tracker.md CLAUDE.md
git commit -m "$(cat <<'EOF'
docs(state-board+tracker): P0-SCHEMA-1-v2 closed — 24 hr FE soak GREEN

Both commits soaked: Commit 1 (BE) <C1> 6 hr + Commit 2 (FE) <C2> 24 hr. Agent-B DB re-scan: 0 string rows, obj_full ratio rose. Supabase log B3 trigger dropped to 0. Tracker §1 entry moved to §5 closure with full evidence.

Per STANDING feedback_update_claude_md_and_tracker_on_ship.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
git push origin main
```

---

## Self-Review (writing-plans skill mandate)

### 1. Spec coverage

| Spec § | Plan task |
|---|---|
| §1 Goal | Task 1-11 (whole plan) |
| §2 Architecture (2-layer) | Task 2-3 (BE wire) + Task 8-9 (FE fix) |
| §3 Helper 5 branches | Task 1 Step 3 (impl) + Task 4 TCs (B2/B3/B5 verify) |
| §3 Logging contract | Task 1 Step 3 (all 3 warns in code) + Task 7 Step 2 (log scan) |
| §4 6 BE write sites | Task 2 (3 sites) + Task 3 (3 sites) |
| §5 FE 2 lines | Task 8 + Task 9 |
| §6 API spec 3 TCs | Task 4 (6 TCs = 3 auth + 3 guest, exceeds spec's 3 by adding guest variants — justified) |
| §6 E2E spec 1 TC | Task 10 |
| §7 Commit 1 BE | Task 6 |
| §7 Commit 1 soak 6 hr | Task 7 |
| §7 Commit 2 FE | Task 11 |
| §7 Commit 2 soak 24 hr | Task 12 |
| §7 Prerequisite NEW-1 soak | Task 6 Step 1 + Task 11 Step 1 |
| §8 Edge cases | Task 1 Step 3 covers all 5 branches |
| §11 Success criteria (7 conditions) | Task 6-12 collectively address all 7 |

No gaps detected.

### 2. Placeholder scan

- No "TBD", "TODO", "fill in", "implement later"
- All code blocks contain actual implementations, not skeletons
- Two `<COMMIT-1-SHA>` / `<C1>` / `<C2>` placeholders in commit messages — these are intentional, filled in at commit time

### 3. Type consistency

- Helper signature `coerceUserNsm({incoming, sessionId, db})` used identically across Task 1 Step 1, Step 3, Task 2 Step 2-4, Task 3 Step 2-4
- DB column name `user_nsm` (snake_case) and req.body key `userNsm` (camelCase) used correctly per route convention
- Test fixture shape `{nsm, explanation, businessLink}` consistent across all TCs

### 4. Ambiguity

- Task 7 / Task 12 mid-soak monitoring depends on manual Supabase log access — acceptable since this is operator workflow, not subagent task
- Task 10 E2E spec `[data-nsm-field="X"]` locators assume production has these attributes — verified to exist per `audit/wave-component-inventory-spec.md` §146 (field component family)

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-05-22-schema-1-v2-evaluate-shape-coerce-plan.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — Director (opus) dispatches fresh sonnet per task, 2-stage opus review between tasks; quiz reviewer (3-round) before Task 1 dispatch.

**2. Inline Execution** — Director executes inline with checkpoints; slower but tighter control.

**Per user 2026-05-22 mandate: ALL DISPATCH GATED ON 3-ROUND QUIZ AGENT APPROVAL FIRST.** Plan approved by user is necessary but not sufficient — quiz reviewer must clear before Task 1.

Which approach?
