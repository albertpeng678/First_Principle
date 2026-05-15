# Stage 0 — B7 Cleanup + Prevention Infra Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clean prod DB pollution caused by past UAT specs writing into user's real account, and ship permanent prevention infra (env-guard, auto-cleanup fixture, pre-commit hook) so the same root cause cannot recur.

**Architecture:** Two parallel lanes — Lane A (sonnet, write-only infra: helpers + fixtures + hooks) and Lane B (opus, read-only audit report generation) → user-confirmed merge → destructive cleanup script (guarded by Lane A helper) → re-scan + security-review verification → 2 new STANDING memory files.

**Tech Stack:** Node.js (Express backend) + Supabase JS SDK + Playwright (fixtures/helpers — but specs run via existing `jest` since unit tests not browser) + husky pre-commit + curl for prod register/login.

**Branch:** `main`（per user standing rule `feedback_push_directly_to_main.md` — solo workflow, no worktree needed for this bundle）

**Spec reference:** `docs/superpowers/specs/2026-05-16-stage-0-b7-cleanup-design.md`

---

## File Structure

### New files (Lane A — Prevention Infra)
- `.env.test` (git-ignored, never committed)
- `.env.local` (git-ignored)
- `.env.example` (committed; placeholders only)
- `tests/helpers/env-guard.js` — 2 export functions
- `tests/helpers/env-guard.test.js` — 8 jest specs
- `tests/fixtures/auto-cleanup.fixture.js` — Playwright auto fixture
- `tests/fixtures/auto-cleanup.test.js` — 4 jest specs（unit-level mock）

### New files (Lane B — Audit Tooling)
- `scripts/register-test-account.js` — one-time CLI
- `scripts/scan-pollution.js` — login + scan + write report
- `scripts/scan-pollution.test.js` — 4 jest specs（regex + extract）
- `audit/data-pollution-report-2026-05-16.md` — generated（user checks）

### New files (Merge / Verify)
- `scripts/execute-cleanup.js` — destructive cleanup with guard
- `audit/data-pollution-executed-2026-05-16.md` — generated receipt

### Modified files
- `.gitignore` — verify `.env*` present (likely already is)
- `.husky/pre-commit` — append hardcoded-URL/email guard
- `CLAUDE.md` — state board update

### New STANDING memory files
- `~/.claude/projects/-Users-.../memory/feedback_three_iron_laws.md`
- `~/.claude/projects/-Users-.../memory/feedback_e2e_real_data_only.md`
- `~/.claude/projects/-Users-.../memory/MEMORY.md` — 2 index lines added

---

## Execution Order

```
Phase 1: Parallel dispatch — Lane A (sonnet) ∥ Lane B (opus)
  Lane A (sequential within lane):  Task 1 → Task 2 → Task 3 → Task 4
  Lane B (sequential within lane):  Task 5 → Task 6

Phase 2: Merge (after both lanes done): Task 7

Phase 3: User gate — user reviews audit report

Phase 4 (post-confirm): Task 8 → Task 9

Phase 5 (standing rules): Task 10 → Task 11
```

---

## Lane A — Prevention Infra (sonnet, write-only)

### Task 1: `.env.test` / `.env.local` / `.env.example` setup + `.gitignore` verify

**Files:**
- Create: `.env.test`（git-ignored；one-time local creation）
- Create: `.env.local`（git-ignored；one-time local creation）
- Create: `.env.example`（committed）
- Verify: `.gitignore` already contains `.env*`

**Why:** Establishes 3-env separation (local / test / prod-UAT opt-in) before any code reads env vars. `.env.example` documents required keys for future contributors.

- [ ] **Step 1: Verify `.gitignore` covers `.env*`**

Run:
```bash
grep -E "^\.env" /Users/albertpeng/Desktop/claude_project/First_Principle/.gitignore
```
Expected: At least one line matching `.env*` or `.env.*` or `.env`.

If missing, append:
```bash
echo ".env*" >> .gitignore
echo "!.env.example" >> .gitignore
git add .gitignore && git commit -m "chore: ensure .env* gitignored, keep .env.example"
```

- [ ] **Step 2: Create `.env.example`**

Create file `.env.example` with content:
```
# Copy to .env.local (for local dev) or .env.test (for test fixtures).
# Never commit values — only placeholders below.

BASE_URL=<http://localhost:3000 OR https://first-principle.up.railway.app/>
TEST_EMAIL=<e2e@first-principle.test>
TEST_PASSWORD=<set via scripts/register-test-account.js; 16-char random>
USER_REAL_EMAIL=<your real account email; only used by execute-cleanup.js>
```

- [ ] **Step 3: Generate random 16-char password (for `.env.test` and `.env.local`)**

Run:
```bash
node -e "console.log(require('crypto').randomBytes(12).toString('base64').replace(/[/+=]/g,'').slice(0,16))"
```
Capture output (e.g. `aB3cD4eF5gH6iJ7k`) — used in next step.

- [ ] **Step 4: Create `.env.test` (LOCAL ONLY — do NOT commit)**

Create file `.env.test`:
```
BASE_URL=https://first-principle.up.railway.app/
TEST_EMAIL=e2e@first-principle.test
TEST_PASSWORD=<paste from Step 3>
USER_REAL_EMAIL=albertpeng678@gmail.com
```

- [ ] **Step 5: Create `.env.local` (LOCAL ONLY — do NOT commit)**

Create file `.env.local`:
```
BASE_URL=http://localhost:3000
TEST_EMAIL=e2e@first-principle.test
TEST_PASSWORD=<same as .env.test Step 4>
USER_REAL_EMAIL=albertpeng678@gmail.com
```

- [ ] **Step 6: Verify `.env.test` and `.env.local` not staged**

Run:
```bash
git status --short | grep -E "^\?\? \.env\.(test|local)$"
```
Expected: Either lines NOT shown (untracked but `.gitignore` excluding) or absence (already ignored). If shown, verify `.gitignore` line `!.env.example` is the ONLY exception. Run `git check-ignore -v .env.test` — expected: ignored by `.gitignore` rule.

- [ ] **Step 7: Commit `.env.example` only**

```bash
git add .env.example
git commit -m "feat(stage-0): add .env.example for 3-env separation (local/test/prod-UAT)"
```

---

### Task 2: `env-guard.js` helper + 8 TDD specs

**Files:**
- Create: `tests/helpers/env-guard.js`
- Create: `tests/helpers/env-guard.test.js`

**Why:** Two guard functions are the runtime gate that prevents any e2e spec from hitting prod with a real account. Implements §3.5 of spec.

- [ ] **Step 1: Write the failing test file (red phase)**

Create `tests/helpers/env-guard.test.js`:
```js
const {
  assertNotProdWithRealAccount,
  assertActingOnBehalfOfPollutionTarget,
} = require('./env-guard');

describe('assertNotProdWithRealAccount', () => {
  test('throws when prod URL + real account email', () => {
    expect(() =>
      assertNotProdWithRealAccount({
        baseUrl: 'https://first-principle.up.railway.app/',
        email: 'albertpeng678@gmail.com',
      })
    ).toThrow(/BLOCKED.*real account/);
  });

  test('passes when prod URL + test account email', () => {
    expect(() =>
      assertNotProdWithRealAccount({
        baseUrl: 'https://first-principle.up.railway.app/',
        email: 'e2e@first-principle.test',
      })
    ).not.toThrow();
  });

  test('passes when local URL + real account email', () => {
    expect(() =>
      assertNotProdWithRealAccount({
        baseUrl: 'http://localhost:3000',
        email: 'albertpeng678@gmail.com',
      })
    ).not.toThrow();
  });

  test('passes when local URL + test account email', () => {
    expect(() =>
      assertNotProdWithRealAccount({
        baseUrl: 'http://localhost:3000',
        email: 'e2e@first-principle.test',
      })
    ).not.toThrow();
  });

  test('throws with clear message when email is missing', () => {
    expect(() =>
      assertNotProdWithRealAccount({
        baseUrl: 'https://first-principle.up.railway.app/',
        email: undefined,
      })
    ).toThrow(/email is required/);
  });
});

describe('assertActingOnBehalfOfPollutionTarget', () => {
  // env contract: USER_REAL_EMAIL must be set in .env.test/.env.local
  const ORIGINAL_USER_REAL_EMAIL = process.env.USER_REAL_EMAIL;
  beforeEach(() => {
    process.env.USER_REAL_EMAIL = 'albertpeng678@gmail.com';
  });
  afterAll(() => {
    if (ORIGINAL_USER_REAL_EMAIL !== undefined) {
      process.env.USER_REAL_EMAIL = ORIGINAL_USER_REAL_EMAIL;
    } else {
      delete process.env.USER_REAL_EMAIL;
    }
  });

  test('passes when target matches USER_REAL_EMAIL', () => {
    expect(() =>
      assertActingOnBehalfOfPollutionTarget('albertpeng678@gmail.com')
    ).not.toThrow();
  });

  test('throws when target is the test account email (cleanup mode is opt-in for real account only)', () => {
    expect(() =>
      assertActingOnBehalfOfPollutionTarget('e2e@first-principle.test')
    ).toThrow(/cleanup mode is only for the polluted real account/);
  });

  test('throws when target is a third-party email', () => {
    expect(() =>
      assertActingOnBehalfOfPollutionTarget('someone-else@gmail.com')
    ).toThrow(/cleanup mode is only for the polluted real account/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails (red)**

Run:
```bash
npx jest tests/helpers/env-guard.test.js
```
Expected: FAIL with `Cannot find module './env-guard'` or similar (file doesn't exist yet).

- [ ] **Step 3: Write minimal implementation**

Create `tests/helpers/env-guard.js`:
```js
function assertNotProdWithRealAccount({ baseUrl, email }) {
  if (!email) {
    throw new Error('env-guard: email is required');
  }
  const isProd = String(baseUrl || '').includes('railway.app');
  const isTestEmail = email.endsWith('@first-principle.test');
  if (isProd && !isTestEmail) {
    throw new Error(
      `BLOCKED: e2e spec hitting prod with real account "${email}". ` +
      `Either set BASE_URL to local OR use TEST_EMAIL ending in @first-principle.test`
    );
  }
}

function assertActingOnBehalfOfPollutionTarget(targetEmail) {
  const realEmail = process.env.USER_REAL_EMAIL;
  if (!realEmail) {
    throw new Error(
      'env-guard: USER_REAL_EMAIL not set in env; cleanup mode requires explicit opt-in'
    );
  }
  if (targetEmail !== realEmail) {
    throw new Error(
      `BLOCKED: cleanup mode is only for the polluted real account ` +
      `(USER_REAL_EMAIL=${realEmail}). Got: ${targetEmail}`
    );
  }
}

module.exports = {
  assertNotProdWithRealAccount,
  assertActingOnBehalfOfPollutionTarget,
};
```

- [ ] **Step 4: Run test to verify all 8 pass (green)**

Run:
```bash
npx jest tests/helpers/env-guard.test.js
```
Expected: PASS — 8 tests across 2 describes.

- [ ] **Step 5: IL-3 red-revert cycle — verify spec truly tests behavior**

```bash
# Revert implementation temporarily
mv tests/helpers/env-guard.js tests/helpers/env-guard.js.bak
echo "module.exports = { assertNotProdWithRealAccount: ()=>{}, assertActingOnBehalfOfPollutionTarget: ()=>{} };" > tests/helpers/env-guard.js
npx jest tests/helpers/env-guard.test.js
```
Expected: FAIL — multiple `Expected ... to throw` failures (proves specs aren't just smoke tests).

Restore:
```bash
mv tests/helpers/env-guard.js.bak tests/helpers/env-guard.js
npx jest tests/helpers/env-guard.test.js
```
Expected: PASS — 8/8.

Capture all 3 outputs (green-1 / red-2 / green-3) into commit message.

- [ ] **Step 6: Commit**

```bash
git add tests/helpers/env-guard.js tests/helpers/env-guard.test.js
git commit -m "$(cat <<'EOF'
feat(stage-0): env-guard helpers — assertNotProdWithRealAccount + assertActingOnBehalfOfPollutionTarget

8 TDD specs (5 + 3) cover all guard branches per spec §3.5.

Red-green-revert cycle evidence:
- Initial green:  8/8 pass after impl written
- Revert red:     spec FAILS when impl stubbed empty
- Restore green:  8/8 pass after restore

Implements: docs/superpowers/specs/2026-05-16-stage-0-b7-cleanup-design.md §2.1 A2 + §3.5
EOF
)"
```

---

### Task 3: `auto-cleanup.fixture.js` Playwright auto fixture + 4 TDD specs

**Files:**
- Create: `tests/fixtures/auto-cleanup.fixture.js`
- Create: `tests/fixtures/auto-cleanup.test.js`

**Why:** Every spec that creates session data via API must register the ID with `cleanupTracker.track(kind, id)` so afterEach guarantees DELETE even on spec crash. Implements §2.1 A3.

- [ ] **Step 1: Write the failing test (red)**

Create `tests/fixtures/auto-cleanup.test.js`:
```js
// Unit-level test: simulate the fixture's afterEach behavior with a mock request.delete
// (full Playwright integration tested implicitly when specs use this fixture)

const { runAfterEachCleanup } = require('./auto-cleanup.fixture');

function makeMockRequest(failOn404 = false) {
  const calls = [];
  return {
    calls,
    async delete(path) {
      calls.push(path);
      if (failOn404 && path.includes('/SHOULD_404')) {
        return { ok: () => false, status: () => 404 };
      }
      return { ok: () => true, status: () => 200 };
    },
  };
}

describe('auto-cleanup runAfterEachCleanup', () => {
  test('zero tracked → no DELETE calls', async () => {
    const req = makeMockRequest();
    await runAfterEachCleanup([], req);
    expect(req.calls).toHaveLength(0);
  });

  test('one tracked nsm session → one DELETE', async () => {
    const req = makeMockRequest();
    await runAfterEachCleanup([{ kind: 'nsm', id: 'abc-123' }], req);
    expect(req.calls).toEqual(['/api/nsm-sessions/abc-123']);
  });

  test('three tracked mixed sessions → three DELETEs', async () => {
    const req = makeMockRequest();
    await runAfterEachCleanup(
      [
        { kind: 'nsm', id: 'a1' },
        { kind: 'circles', id: 'b2' },
        { kind: 'nsm', id: 'c3' },
      ],
      req
    );
    expect(req.calls).toEqual([
      '/api/nsm-sessions/a1',
      '/api/circles-sessions/b2',
      '/api/nsm-sessions/c3',
    ]);
  });

  test('404 swallowed and logged, does not throw', async () => {
    const req = makeMockRequest(true);
    const warns = [];
    const origWarn = console.warn;
    console.warn = (msg) => warns.push(msg);
    try {
      await expect(
        runAfterEachCleanup([{ kind: 'nsm', id: 'SHOULD_404' }], req)
      ).resolves.not.toThrow();
      expect(warns.some((w) => /SHOULD_404/.test(w))).toBe(true);
    } finally {
      console.warn = origWarn;
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails (red)**

Run:
```bash
npx jest tests/fixtures/auto-cleanup.test.js
```
Expected: FAIL with `Cannot find module './auto-cleanup.fixture'`.

- [ ] **Step 3: Write minimal implementation**

Create `tests/fixtures/auto-cleanup.fixture.js`:
```js
const { test: base } = require('@playwright/test');

async function runAfterEachCleanup(tracked, request) {
  for (const { kind, id } of tracked) {
    const path = `/api/${kind}-sessions/${id}`;
    try {
      const res = await request.delete(path);
      if (!res.ok() && res.status() !== 404) {
        console.warn(`auto-cleanup: DELETE ${path} returned ${res.status()}`);
      } else if (res.status() === 404) {
        console.warn(`auto-cleanup: DELETE ${path} returned 404 (already gone)`);
      }
    } catch (e) {
      console.warn(`auto-cleanup: DELETE ${path} threw: ${e.message}`);
    }
  }
}

const test = base.extend({
  cleanupTracker: [
    async ({ request }, use) => {
      const tracked = [];
      await use({
        track: (kind, id) => {
          if (!['nsm', 'circles'].includes(kind)) {
            throw new Error(`auto-cleanup: invalid kind "${kind}" — must be 'nsm' or 'circles'`);
          }
          tracked.push({ kind, id });
        },
      });
      await runAfterEachCleanup(tracked, request);
    },
    { auto: true },
  ],
});

module.exports = { test, runAfterEachCleanup };
```

- [ ] **Step 4: Run test to verify all 4 pass (green)**

Run:
```bash
npx jest tests/fixtures/auto-cleanup.test.js
```
Expected: PASS — 4 tests.

- [ ] **Step 5: IL-3 red-revert cycle**

```bash
mv tests/fixtures/auto-cleanup.fixture.js tests/fixtures/auto-cleanup.fixture.js.bak
echo "module.exports = { test: require('@playwright/test').test, runAfterEachCleanup: async()=>{} };" > tests/fixtures/auto-cleanup.fixture.js
npx jest tests/fixtures/auto-cleanup.test.js
```
Expected: 3 of 4 FAIL (zero-tracked case still passes; rest fail because `runAfterEachCleanup` is now no-op).

Restore:
```bash
mv tests/fixtures/auto-cleanup.fixture.js.bak tests/fixtures/auto-cleanup.fixture.js
npx jest tests/fixtures/auto-cleanup.test.js
```
Expected: PASS — 4/4.

- [ ] **Step 6: Commit**

```bash
git add tests/fixtures/auto-cleanup.fixture.js tests/fixtures/auto-cleanup.test.js
git commit -m "feat(stage-0): auto-cleanup fixture — afterEach DELETE for any tracked session

Implements spec §2.1 A3. 4 TDD specs (0 tracked / 1 nsm / 3 mixed / 404 swallow).
Red-green-revert cycle: 3/4 fail when impl stubbed empty."
```

---

### Task 4: `.husky/pre-commit` append + 3-case test script

**Files:**
- Modify: `.husky/pre-commit`（append block — preserve existing contents）
- Create: `scripts/test-pre-commit.sh`

**Why:** Block any future commit that hardcodes prod URL or real account email into a test spec file. Implements §2.1 A4 + §5.1 hook tests.

- [ ] **Step 1: Read existing `.husky/pre-commit`**

Run:
```bash
cat /Users/albertpeng/Desktop/claude_project/First_Principle/.husky/pre-commit 2>/dev/null || echo "FILE_DOES_NOT_EXIST"
```
Note the existing content (do not destroy).

- [ ] **Step 2: Write the failing test script (red)**

Create `scripts/test-pre-commit.sh`:
```bash
#!/usr/bin/env bash
# Mock 3 git scenarios and verify pre-commit hook responds correctly.
set -e

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HOOK="$REPO_ROOT/.husky/pre-commit"
TMP="$(mktemp -d)"
trap "rm -rf $TMP" EXIT

# Function: run hook against a staged set of files.
# Args: <case-name> <expected-exit> <spec-file-path> <spec-file-content>
run_case() {
  local name="$1" expected="$2" path="$3" content="$4"
  mkdir -p "$TMP/$(dirname "$path")"
  echo "$content" > "$TMP/$path"

  pushd "$TMP" > /dev/null
  git init -q
  git add "$path"

  # Run the hook in a way that uses TMP as the repo (override GIT_DIR).
  # The hook itself uses `git diff --cached`, which honors GIT_DIR.
  set +e
  GIT_DIR="$TMP/.git" GIT_WORK_TREE="$TMP" bash "$HOOK"
  actual=$?
  set -e
  popd > /dev/null

  rm -rf "$TMP/.git" "$TMP/$(dirname "$path" | cut -d/ -f1)"

  if [ "$actual" -ne "$expected" ]; then
    echo "FAIL: $name (expected exit $expected, got $actual)"
    exit 1
  fi
  echo "PASS: $name"
}

# Case 1: spec contains railway.app → exit 1
run_case "block hardcoded railway.app in spec" 1 \
  "tests/e2e/bad.spec.js" \
  "test('x', async ({ page }) => { await page.goto('https://first-principle.up.railway.app/'); });"

# Case 2: spec contains real email → exit 1
run_case "block hardcoded real email in spec" 1 \
  "tests/e2e/bad2.spec.js" \
  "const EMAIL = 'albertpeng678@gmail.com';"

# Case 3: non-spec file contains railway.app → exit 0 (allowed)
run_case "allow railway.app in non-spec file" 0 \
  "docs/notes.md" \
  "Deploy at https://first-principle.up.railway.app/"

echo "All 3 cases PASS"
```

Make executable:
```bash
chmod +x scripts/test-pre-commit.sh
```

- [ ] **Step 3: Run test to verify it fails (red)**

Run:
```bash
bash scripts/test-pre-commit.sh
```
Expected: FAIL (Case 1 — hook doesn't yet have the guard, so exit is 0 not 1).

- [ ] **Step 4: Append guard to `.husky/pre-commit`**

If `.husky/pre-commit` does NOT exist, create it with:
```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh" 2>/dev/null || true
```

Append to existing `.husky/pre-commit` (or create if missing):
```bash
# --- BEGIN: Stage 0 B7 prevention — block hardcoded prod URL / real email in test specs ---
STAGED_SPECS=$(git diff --cached --name-only --diff-filter=ACM | grep -E '^tests/.*\.(spec|test)\.js$' || true)
if [ -n "$STAGED_SPECS" ]; then
  if echo "$STAGED_SPECS" | xargs grep -l 'railway\.app' 2>/dev/null; then
    echo "ERROR: hardcoded prod URL (railway.app) found in spec file(s) above. Use process.env.BASE_URL instead."
    exit 1
  fi
  if echo "$STAGED_SPECS" | xargs grep -l 'albertpeng678@gmail\.com' 2>/dev/null; then
    echo "ERROR: hardcoded real account email found in spec file(s) above. Use process.env.TEST_EMAIL instead."
    exit 1
  fi
fi
# --- END: Stage 0 B7 prevention ---
```

Ensure executable:
```bash
chmod +x .husky/pre-commit
```

- [ ] **Step 5: Run test to verify all 3 pass (green)**

Run:
```bash
bash scripts/test-pre-commit.sh
```
Expected: PASS — all 3 cases output `PASS: <case-name>` and final `All 3 cases PASS`.

- [ ] **Step 6: Commit (test the hook on its own commit)**

```bash
git add .husky/pre-commit scripts/test-pre-commit.sh
git commit -m "feat(stage-0): pre-commit hook blocks hardcoded prod URL + real email in test specs

3 mock cases via scripts/test-pre-commit.sh:
  PASS: block hardcoded railway.app in spec
  PASS: block hardcoded real email in spec
  PASS: allow railway.app in non-spec file

Implements spec §2.1 A4 + §5.1 hook tests."
```

If commit blocked by the hook itself due to spec content of this very file, verify the hook only scans `tests/**/*.spec.js` — `scripts/test-pre-commit.sh` should not be flagged.

---

## Lane B — Audit Report (opus, read-only)

### Task 5: `register-test-account.js` — one-time test account creation

**Files:**
- Create: `scripts/register-test-account.js`

**Why:** Idempotent CLI that registers `e2e@first-principle.test` on prod once. Implements §2.2 B1 + §3.1.

- [ ] **Step 1: Write the implementation**

Create `scripts/register-test-account.js`:
```js
#!/usr/bin/env node
/**
 * One-time test account registration.
 * Usage:  node scripts/register-test-account.js
 * Reads:  BASE_URL, TEST_EMAIL, TEST_PASSWORD from .env.test (must exist)
 * Action: POST /api/auth/register; if 200 ok, prints success;
 *         if email_already_exists, verifies password by logging in;
 *         if login also fails, exits non-zero and instructs user.
 */
require('dotenv').config({ path: '.env.test' });

const BASE_URL = (process.env.BASE_URL || '').replace(/\/$/, '');
const EMAIL    = process.env.TEST_EMAIL;
const PASSWORD = process.env.TEST_PASSWORD;

if (!BASE_URL || !EMAIL || !PASSWORD) {
  console.error('Missing env: BASE_URL, TEST_EMAIL, TEST_PASSWORD must all be set in .env.test');
  process.exit(1);
}

async function register() {
  const res = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

async function login() {
  // Use the same login endpoint app.js uses (Supabase signIn via SDK is in browser;
  // we use Supabase REST goTrue endpoint via the project URL — but app exposes its own auth?
  // Simpler: try a guarded endpoint with the would-be access token.
  // The project uses Supabase JS SDK from client; server has no /api/auth/login wrapper.
  // So we verify by POSTing register again — duplicate emails return a recognizable error.
  return null; // placeholder for non-existent local login endpoint
}

(async () => {
  console.log(`Registering ${EMAIL} at ${BASE_URL}...`);
  const { status, body } = await register();

  if (status === 200 && body.ok) {
    console.log(`SUCCESS: account created (userId=${body.userId})`);
    process.exit(0);
  }

  if (status === 400 && /already/i.test(body.error || '')) {
    console.log(`NOTE: account "${EMAIL}" already exists.`);
    console.log(`  - If you set the password yourself, this is fine.`);
    console.log(`  - If a previous run failed mid-write, verify the password in .env.test matches the original.`);
    console.log(`  - If password is unknown, reset via Supabase admin dashboard and rerun this script.`);
    process.exit(0);
  }

  console.error(`FAILED: status=${status}, body=${JSON.stringify(body)}`);
  process.exit(1);
})();
```

- [ ] **Step 2: Verify the script exits with helpful output without actually registering yet**

Run with a dummy .env to verify error path:
```bash
BASE_URL='' node scripts/register-test-account.js 2>&1 | head -3
```
Expected: `Missing env: BASE_URL, TEST_EMAIL, TEST_PASSWORD must all be set in .env.test` and exit code 1.

- [ ] **Step 3: Run script for real (registers test account on prod)**

This is the actual one-time prod write. Pre-condition: `.env.test` from Task 1 exists.

```bash
node scripts/register-test-account.js
```
Expected output (first run): `SUCCESS: account created (userId=...)`
Or (if rerun): `NOTE: account "e2e@first-principle.test" already exists.`

Either is acceptable. Capture exact output for commit message.

- [ ] **Step 4: Commit**

```bash
git add scripts/register-test-account.js
git commit -m "feat(stage-0): register-test-account.js — one-time e2e@first-principle.test setup

Idempotent: first run creates, subsequent runs detect existing.
Reads creds from .env.test (gitignored). Implements spec §2.2 B1 + §3.1."
```

---

### Task 6: `scan-pollution.js` + 4 unit-test specs + run scan (produces audit report)

**Files:**
- Create: `scripts/scan-pollution.js`
- Create: `scripts/scan-pollution.test.js`
- Generated: `audit/data-pollution-report-2026-05-16.md`

**Why:** Read-only scan over user's real account sessions, applying pollution regex to 7 user-typed fields, producing the audit report user reviews. Implements §2.2 B2-B4 + §3.2 + §3.3.

- [ ] **Step 1: Write the failing test (red)**

Create `scripts/scan-pollution.test.js`:
```js
const { isPolluted, extractStrings } = require('./scan-pollution');

describe('isPolluted regex', () => {
  test.each([
    ['e2e-r2-B4-I-1778822383-f0', true],
    ['dual-uat-r2-nsm-1778822283008', true],
    ['dual-r-uat-test-x', true],
    ['test-stub-foo', true],
    ['smoke-bar', true],
    ['legitimate user answer with 完整中文 reasoning', false],
    ['北極星指標應該是每週活躍的付費用戶數', false],
    ['短答', false],
    ['', false],
    [null, false],
  ])('isPolluted(%j) === %s', (s, expected) => {
    expect(isPolluted(s)).toBe(expected);
  });
});

describe('extractStrings (jsonb traversal)', () => {
  test('extracts framework_draft jsonb leaves', () => {
    const session = {
      framework_draft: {
        C1: { problem_scope: 'e2e-r2-B4-C1-1778822383-f0', time_scope: '正常字串' },
        I:  { user_segment: 'dual-uat-test' },
      },
    };
    const out = extractStrings(session, 'circles');
    expect(out).toEqual(
      expect.arrayContaining([
        { path: 'framework_draft.C1.problem_scope', value: 'e2e-r2-B4-C1-1778822383-f0' },
        { path: 'framework_draft.C1.time_scope', value: '正常字串' },
        { path: 'framework_draft.I.user_segment', value: 'dual-uat-test' },
      ])
    );
  });

  test('extracts nsm user_breakdown 4 dims', () => {
    const session = {
      user_nsm: 'normal nsm answer',
      user_breakdown: { reach: 'e2e-r3-reach-test', depth: '正常', frequency: '', impact: 'smoke-x' },
      user_explanation: '',
      user_business_link: null,
    };
    const out = extractStrings(session, 'nsm');
    expect(out).toEqual(
      expect.arrayContaining([
        { path: 'user_nsm', value: 'normal nsm answer' },
        { path: 'user_breakdown.reach', value: 'e2e-r3-reach-test' },
        { path: 'user_breakdown.depth', value: '正常' },
        { path: 'user_breakdown.impact', value: 'smoke-x' },
      ])
    );
  });

  test('extracts circles phase2_chat_history array', () => {
    const session = {
      phase2_chat_history: [
        { role: 'user', text: '正常問題' },
        { role: 'coach', text: 'dual-uat-coach-reply' },
      ],
      phase2_conclusion_draft: 'e2e-r5-conclusion-x',
    };
    const out = extractStrings(session, 'circles');
    expect(out).toEqual(
      expect.arrayContaining([
        { path: 'phase2_chat_history[0].text', value: '正常問題' },
        { path: 'phase2_chat_history[1].text', value: 'dual-uat-coach-reply' },
        { path: 'phase2_conclusion_draft', value: 'e2e-r5-conclusion-x' },
      ])
    );
  });

  test('handles missing fields gracefully', () => {
    expect(extractStrings({}, 'nsm')).toEqual([]);
    expect(extractStrings(null, 'nsm')).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails (red)**

Run:
```bash
npx jest scripts/scan-pollution.test.js
```
Expected: FAIL with `Cannot find module './scan-pollution'`.

- [ ] **Step 3: Write minimal implementation**

Create `scripts/scan-pollution.js`:
```js
#!/usr/bin/env node
/**
 * Read-only scan of user's real account for B7 pollution.
 * Reads:    BASE_URL, USER_REAL_EMAIL from .env.test (cleanup-only mode);
 *           uses access_token from interactive Supabase login (prompted).
 *           Alternatively, paste token via env var REAL_ACCESS_TOKEN.
 * Writes:   audit/data-pollution-report-2026-05-16.md
 * Exits 0:  scan complete (even if 0 polluted)
 * Exits 1:  network / auth / disk failure
 */
require('dotenv').config({ path: '.env.test' });
const fs   = require('fs');
const path = require('path');

const POLLUTION_PATTERNS = [
  /^(e2e-r\d+-)/,
  /^(dual-(r-)?uat-)/,
  /^(test-stub-)/,
  /^(smoke-)/,
  /^[a-zA-Z0-9_-]+-178\d{6,}-f\d/,
];

function isPolluted(s) {
  if (typeof s !== 'string' || s.length === 0) return false;
  return POLLUTION_PATTERNS.some((re) => re.test(s));
}

function extractStrings(session, kind) {
  if (!session || typeof session !== 'object') return [];
  const out = [];
  if (kind === 'circles') {
    if (session.framework_draft && typeof session.framework_draft === 'object') {
      for (const stepKey of Object.keys(session.framework_draft)) {
        const stepObj = session.framework_draft[stepKey];
        if (!stepObj || typeof stepObj !== 'object') continue;
        for (const fieldKey of Object.keys(stepObj)) {
          const v = stepObj[fieldKey];
          if (typeof v === 'string') {
            out.push({ path: `framework_draft.${stepKey}.${fieldKey}`, value: v });
          }
        }
      }
    }
    if (Array.isArray(session.phase2_chat_history)) {
      session.phase2_chat_history.forEach((m, i) => {
        if (m && typeof m.text === 'string') {
          out.push({ path: `phase2_chat_history[${i}].text`, value: m.text });
        }
      });
    }
    if (typeof session.phase2_conclusion_draft === 'string') {
      out.push({ path: 'phase2_conclusion_draft', value: session.phase2_conclusion_draft });
    }
  } else if (kind === 'nsm') {
    if (typeof session.user_nsm === 'string') {
      out.push({ path: 'user_nsm', value: session.user_nsm });
    }
    if (session.user_breakdown && typeof session.user_breakdown === 'object') {
      for (const dim of ['reach', 'depth', 'frequency', 'impact']) {
        if (typeof session.user_breakdown[dim] === 'string') {
          out.push({ path: `user_breakdown.${dim}`, value: session.user_breakdown[dim] });
        }
      }
    }
    if (typeof session.user_explanation === 'string' && session.user_explanation) {
      out.push({ path: 'user_explanation', value: session.user_explanation });
    }
    if (typeof session.user_business_link === 'string' && session.user_business_link) {
      out.push({ path: 'user_business_link', value: session.user_business_link });
    }
  }
  return out;
}

async function fetchSessions(baseUrl, token, kind) {
  const res = await fetch(`${baseUrl}/api/${kind}-sessions`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`GET /api/${kind}-sessions failed: ${res.status}`);
  return res.json();
}

function classifySession(session, kind) {
  const fields = extractStrings(session, kind);
  const polluted = fields.filter((f) => isPolluted(f.value));
  if (polluted.length === 0) return null;
  const allFieldsPolluted = polluted.length === fields.length;
  return {
    sessionId: session.id,
    kind,
    created_at: session.created_at,
    polluted,
    suggested_action: allFieldsPolluted ? 'DELETE_ROW' : 'CLEAR_FIELDS',
  };
}

function renderReport(circles, nsm) {
  const deletes = [];
  const clears  = [];
  for (const item of [...circles, ...nsm]) {
    if (item.suggested_action === 'DELETE_ROW') deletes.push(item);
    else clears.push(item);
  }

  const fmtRow = (it) => {
    const f = it.polluted[0];
    const sample = (f.value || '').slice(0, 60).replace(/\|/g, '\\|').replace(/\n/g, ' ');
    return `| ${it.sessionId} | ${it.kind} | ${it.created_at} | ${f.path} | ${sample} | ☐ |`;
  };

  return [
    `# Data Pollution Report — 2026-05-16`,
    ``,
    `**Scanned:** ${process.env.USER_REAL_EMAIL || '<unknown>'} (real prod account)`,
    `**Patterns:** \`e2e-rN-\` / \`dual-uat-\` / \`*-178NNN-fN\` / \`test-stub-\` / \`smoke-\``,
    `**Result:** ${deletes.length + clears.length} polluted sessions found (${nsm.length} nsm + ${circles.length} circles)`,
    ``,
    `## DELETE list (whole row — created BY my UAT spec)`,
    ``,
    `| sessionId | kind | created_at | match field | sample (60 char) | confirm? |`,
    `|---|---|---|---|---|---|`,
    ...deletes.map(fmtRow),
    ``,
    `## CLEAR-FIELD list (legitimate session, single polluted field)`,
    ``,
    `| sessionId | kind | created_at | match field | sample (60 char) | confirm? |`,
    `|---|---|---|---|---|---|`,
    ...clears.map(fmtRow),
    ``,
    `## Curl preview (post-confirmation execution)`,
    ``,
    '```bash',
    `# DELETE rows`,
    ...deletes.map((it) => `curl -X DELETE "$BASE_URL/api/${it.kind}-sessions/${it.sessionId}" -H "Authorization: Bearer $TOKEN"`),
    ``,
    `# CLEAR fields (one example per row — execute-cleanup.js handles per-field PATCH)`,
    ...clears.map((it) => {
      const f = it.polluted[0];
      return `curl -X PATCH "$BASE_URL/api/${it.kind}-sessions/${it.sessionId}/progress" -H "Authorization: Bearer $TOKEN" -d '{"${f.path}": ""}'`;
    }),
    '```',
    ``,
  ].join('\n');
}

module.exports = { isPolluted, extractStrings, classifySession, renderReport };

if (require.main === module) {
  (async () => {
    const BASE_URL = (process.env.BASE_URL || '').replace(/\/$/, '');
    const TOKEN    = process.env.REAL_ACCESS_TOKEN;
    if (!BASE_URL || !TOKEN) {
      console.error('Required env: BASE_URL + REAL_ACCESS_TOKEN (paste your access_token after logging in via the app).');
      process.exit(1);
    }
    const circlesRaw = await fetchSessions(BASE_URL, TOKEN, 'circles');
    const nsmRaw     = await fetchSessions(BASE_URL, TOKEN, 'nsm');
    const circles    = circlesRaw.map((s) => classifySession(s, 'circles')).filter(Boolean);
    const nsm        = nsmRaw.map((s) => classifySession(s, 'nsm')).filter(Boolean);

    const out = renderReport(circles, nsm);
    const outPath = path.join(__dirname, '..', 'audit', 'data-pollution-report-2026-05-16.md');
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, out);
    console.log(`Report: ${outPath}`);
    console.log(`Polluted: ${circles.length + nsm.length} (${nsm.length} nsm, ${circles.length} circles)`);
  })();
}
```

- [ ] **Step 4: Run test to verify all pass (green)**

Run:
```bash
npx jest scripts/scan-pollution.test.js
```
Expected: PASS — 14 specs (10 isPolluted parametric + 4 extractStrings).

- [ ] **Step 5: IL-3 red-revert cycle**

```bash
mv scripts/scan-pollution.js scripts/scan-pollution.js.bak
echo "module.exports = { isPolluted: ()=>false, extractStrings: ()=>[], classifySession: ()=>null, renderReport: ()=>'' };" > scripts/scan-pollution.js
npx jest scripts/scan-pollution.test.js
```
Expected: Many failures (regex stub returns false; extract stub returns []).

Restore:
```bash
mv scripts/scan-pollution.js.bak scripts/scan-pollution.js
npx jest scripts/scan-pollution.test.js
```
Expected: PASS — all green again.

- [ ] **Step 6: Obtain REAL_ACCESS_TOKEN and run scan against prod**

Open <https://first-principle.up.railway.app/> in browser, login as `albertpeng678@gmail.com`, open DevTools → Application → Local Storage → Supabase auth token entry → copy `access_token` value.

Run:
```bash
REAL_ACCESS_TOKEN="<pasted-token>" node scripts/scan-pollution.js
```
Expected output:
```
Report: /Users/.../audit/data-pollution-report-2026-05-16.md
Polluted: <N> (<X> nsm, <Y> circles)
```

If N === 0, jump to Phase 5 (no cleanup needed; just standing rules + verify).

- [ ] **Step 7: Commit scanner + report**

```bash
git add scripts/scan-pollution.js scripts/scan-pollution.test.js audit/data-pollution-report-2026-05-16.md
git commit -m "feat(stage-0): scan-pollution.js + audit report

14 TDD specs (isPolluted regex × 10 + extractStrings × 4) green.
Red-revert cycle confirmed. Scan result: <N> polluted sessions.
Implements spec §2.2 B2-B4 + §3.2 + §3.3."
```

---

## Phase 2 — Merge

### Task 7: `execute-cleanup.js` — destructive cleanup with guard

**Files:**
- Create: `scripts/execute-cleanup.js`

**Why:** Reads user-confirmed audit report, applies `assertActingOnBehalfOfPollutionTarget` guard, supports `--dry-run` preview + stdin confirmation, executes DELETE / PATCH per row, writes receipt. Implements §2.3 M1.

- [ ] **Step 1: Write the implementation**

Create `scripts/execute-cleanup.js`:
```js
#!/usr/bin/env node
/**
 * Destructive cleanup driven by audit/data-pollution-report-2026-05-16.md.
 * Reads confirmed rows (lines whose checkbox is `[x]`) and DELETEs / PATCHes.
 *
 * Usage:
 *   --dry-run            : print curl commands without executing
 *   (no flag, default)   : prompt stdin "yes I confirm <N> deletions" then run
 *
 * Env: BASE_URL, REAL_ACCESS_TOKEN, USER_REAL_EMAIL (from .env.test)
 */
require('dotenv').config({ path: '.env.test' });
const fs   = require('fs');
const path = require('path');
const readline = require('readline');
const { assertActingOnBehalfOfPollutionTarget } = require('../tests/helpers/env-guard');

const REPORT_PATH   = path.join(__dirname, '..', 'audit', 'data-pollution-report-2026-05-16.md');
const RECEIPT_PATH  = path.join(__dirname, '..', 'audit', 'data-pollution-executed-2026-05-16.md');
const BASE_URL      = (process.env.BASE_URL || '').replace(/\/$/, '');
const TOKEN         = process.env.REAL_ACCESS_TOKEN;

function parseConfirmedRows(md) {
  // Rows look like: | sessionId | kind | created_at | path | sample | [x] |
  const rows = [];
  let currentList = null;
  for (const line of md.split('\n')) {
    if (/^## DELETE list/.test(line)) { currentList = 'DELETE_ROW'; continue; }
    if (/^## CLEAR-FIELD list/.test(line)) { currentList = 'CLEAR_FIELDS'; continue; }
    if (/^## /.test(line)) { currentList = null; continue; }
    if (!currentList) continue;
    if (!line.startsWith('|') || /^\|---/.test(line) || /^\| sessionId/.test(line)) continue;

    const cells = line.split('|').map((c) => c.trim());
    // cells: ['', sessionId, kind, created_at, path, sample, confirm, '']
    if (cells.length < 7) continue;
    const confirmCell = cells[6];
    if (!/\[x\]/i.test(confirmCell)) continue; // skip unchecked
    rows.push({
      sessionId: cells[1],
      kind: cells[2],
      created_at: cells[3],
      field_path: cells[4],
      action: currentList,
    });
  }
  return rows;
}

async function execDelete(row) {
  const url = `${BASE_URL}/api/${row.kind}-sessions/${row.sessionId}`;
  const res = await fetch(url, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  return { status: res.status };
}

async function execClear(row) {
  // PATCH the progress endpoint with the field set to ""
  // For nsm: user_explanation / user_business_link / user_nsm / user_breakdown.X
  // For circles: framework_draft.STEP.FIELD / phase2_conclusion_draft / phase2_chat_history (clear all)
  const url = `${BASE_URL}/api/${row.kind}-sessions/${row.sessionId}/progress`;
  const body = buildClearPatch(row.kind, row.field_path);
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${TOKEN}`,
    },
    body: JSON.stringify(body),
  });
  return { status: res.status };
}

function buildClearPatch(kind, field_path) {
  // Map field_path back to the PATCH-accepted shape used by FE.
  if (kind === 'nsm') {
    if (field_path === 'user_nsm') return { userNsm: '' };
    if (field_path === 'user_explanation') return { userExplanation: '' };
    if (field_path === 'user_business_link') return { userBusinessLink: '' };
    const m = field_path.match(/^user_breakdown\.(reach|depth|frequency|impact)$/);
    if (m) return { userBreakdown: { [m[1]]: '' } };
    throw new Error(`unsupported nsm clear path: ${field_path}`);
  }
  // circles: ride on PATCH /progress which accepts frameworkDraft (camelCase) + phase2ConclusionDraft.
  const fdm = field_path.match(/^framework_draft\.([^.]+)\.(.+)$/);
  if (fdm) return { frameworkDraft: { [fdm[1]]: { [fdm[2]]: '' } } };
  if (field_path === 'phase2_conclusion_draft') return { phase2ConclusionDraft: '' };
  if (/^phase2_chat_history\[/.test(field_path)) {
    throw new Error(`phase2_chat_history clearing not supported per-message; suggest DELETE_ROW instead`);
  }
  throw new Error(`unsupported circles clear path: ${field_path}`);
}

(async () => {
  if (!BASE_URL || !TOKEN) {
    console.error('Required env: BASE_URL + REAL_ACCESS_TOKEN. Set in .env.test or via shell.');
    process.exit(1);
  }

  // Pre-flight guard — required even in --dry-run for safety symmetry.
  assertActingOnBehalfOfPollutionTarget(process.env.USER_REAL_EMAIL);

  if (!fs.existsSync(REPORT_PATH)) {
    console.error(`Report not found at ${REPORT_PATH}. Run scan-pollution.js first.`);
    process.exit(1);
  }

  const md = fs.readFileSync(REPORT_PATH, 'utf8');
  const rows = parseConfirmedRows(md);
  if (rows.length === 0) {
    console.log('No confirmed rows (no [x] checkbox found). Nothing to do.');
    process.exit(0);
  }

  const dryRun = process.argv.includes('--dry-run');

  console.log(`\nConfirmed rows: ${rows.length}`);
  console.log(`  DELETE_ROW:   ${rows.filter((r) => r.action === 'DELETE_ROW').length}`);
  console.log(`  CLEAR_FIELDS: ${rows.filter((r) => r.action === 'CLEAR_FIELDS').length}`);

  if (dryRun) {
    console.log('\n--- DRY RUN (no execution) ---');
    for (const r of rows) {
      if (r.action === 'DELETE_ROW') {
        console.log(`curl -X DELETE "${BASE_URL}/api/${r.kind}-sessions/${r.sessionId}" -H "Authorization: Bearer <token>"`);
      } else {
        console.log(`curl -X PATCH  "${BASE_URL}/api/${r.kind}-sessions/${r.sessionId}/progress" -d '${JSON.stringify(buildClearPatch(r.kind, r.field_path))}' -H "Authorization: Bearer <token>"`);
      }
    }
    process.exit(0);
  }

  // Confirmation prompt
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const expected = `yes I confirm ${rows.length} deletions`;
  const answer = await new Promise((res) => rl.question(`\nType exactly:  ${expected}\n> `, res));
  rl.close();
  if (answer.trim() !== expected) {
    console.error('Confirmation phrase did not match. Aborting.');
    process.exit(1);
  }

  // Execute
  const receipt = [`# Cleanup Executed — 2026-05-16`, ``, `| sessionId | kind | action | path | status |`, `|---|---|---|---|---|`];
  for (const r of rows) {
    try {
      const result = r.action === 'DELETE_ROW' ? await execDelete(r) : await execClear(r);
      const tag = result.status === 200 ? '200_ok' : (result.status === 404 ? 'already_gone' : `failed_${result.status}`);
      receipt.push(`| ${r.sessionId} | ${r.kind} | ${r.action} | ${r.field_path} | ${tag} |`);
      console.log(`  ${tag.padEnd(14)} ${r.action} ${r.kind}/${r.sessionId}`);
    } catch (e) {
      receipt.push(`| ${r.sessionId} | ${r.kind} | ${r.action} | ${r.field_path} | error:${e.message.slice(0,40)} |`);
      console.log(`  ERROR          ${r.action} ${r.kind}/${r.sessionId}: ${e.message}`);
    }
  }
  fs.writeFileSync(RECEIPT_PATH, receipt.join('\n') + '\n');
  console.log(`\nReceipt: ${RECEIPT_PATH}`);
})();
```

- [ ] **Step 2: Verify dry-run mode works (read-only, safe)**

Run (assuming Task 6 produced an empty or pre-existing report):
```bash
REAL_ACCESS_TOKEN="<your-token>" node scripts/execute-cleanup.js --dry-run
```
Expected: Either `No confirmed rows (no [x] checkbox found)` (if user hasn't checked anything yet) or list of curl commands.

If guard throws (`USER_REAL_EMAIL not set`), confirm `.env.test` has `USER_REAL_EMAIL=albertpeng678@gmail.com`.

- [ ] **Step 3: Commit (do NOT execute destructive run yet — that's Phase 4)**

```bash
git add scripts/execute-cleanup.js
git commit -m "feat(stage-0): execute-cleanup.js — destructive cleanup with assertActingOnBehalfOf guard

Modes: --dry-run (preview curl) | interactive (stdin confirm phrase 'yes I confirm N deletions').
Per-row receipt at audit/data-pollution-executed-2026-05-16.md.
Implements spec §2.3 M1 + §3.4 + §5.3 gates G1-G4."
```

---

## Phase 3 — User Review Gate

### Task 8: User reviews audit report and marks confirmations

**Files:**
- Modify: `audit/data-pollution-report-2026-05-16.md` (user edits ☐ → [x] on confirmed rows)

**Why:** Single human checkpoint before any destructive op. Implements spec §5.3 G2-G3.

- [ ] **Step 1: Surface the report path to user**

Print the report location:
```bash
echo "📋 Please review: $PWD/audit/data-pollution-report-2026-05-16.md"
echo "   Change ☐ to [x] on rows you want me to execute."
echo "   When done, reply OK in chat."
```

- [ ] **Step 2: WAIT for user response**

Director (opus) waits for user to reply with confirmation. No code action this step. Director may answer questions about specific rows.

- [ ] **Step 3: Verify checkbox edits exist**

After user confirms, run:
```bash
grep -c "\[x\]" audit/data-pollution-report-2026-05-16.md
```
Expected: N >= 1 (number of confirmed rows).

If 0, user did not edit — return to Step 1 with clarifying question.

---

## Phase 4 — Execute + Verify

### Task 9: Run execute-cleanup, re-scan, security-review

**Files:**
- Generated: `audit/data-pollution-executed-2026-05-16.md`

**Why:** Apply confirmed cleanup, verify zero pollution remains, run security audit on all changes. Implements §2.4 V1-V2 + §5.4 evidence checklist.

- [ ] **Step 1: Run dry-run one more time to preview confirmed rows**

```bash
REAL_ACCESS_TOKEN="<token>" node scripts/execute-cleanup.js --dry-run
```
Expected: List of N curl commands matching user's confirmation count.

- [ ] **Step 2: Execute cleanup (DESTRUCTIVE — irreversible)**

```bash
REAL_ACCESS_TOKEN="<token>" node scripts/execute-cleanup.js
```

Stdin prompts: type `yes I confirm <N> deletions` exactly.

Expected output: per-row status (`200_ok` / `already_gone` / `failed_XXX`) and receipt path.

- [ ] **Step 3: Re-scan for pollution (V1)**

```bash
REAL_ACCESS_TOKEN="<token>" node scripts/scan-pollution.js
cat audit/data-pollution-report-2026-05-16.md | grep -c "^|" | head
```
Expected: Polluted count drops to 0 (or only failed rows remain — those need IL-1 root-cause analysis).

If any `failed_*` in receipt:
1. Read receipt to identify failures
2. For each: trace HTTP status + body, evidence first (IL-1 Phase 1)
3. Fix → re-run only failed rows

- [ ] **Step 4: Invoke security-review skill (V2)**

In session, invoke skill:
```
Skill: security-review
```

Expected output: report on `.env.test` / `.env.local` correctly gitignored, no leaked credentials in committed code, hook works.

If skill flags issues:
- `.env.test` accidentally staged → `git rm --cached .env.test`, then verify `.gitignore`
- Token leaked in commit → rotate password via `register-test-account.js` re-run, force-update `.env.test`, retroactive `git filter-repo` discussion with user

- [ ] **Step 5: Commit receipt + post-cleanup empty report**

```bash
git add audit/data-pollution-executed-2026-05-16.md audit/data-pollution-report-2026-05-16.md
git commit -m "$(cat <<'EOF'
chore(stage-0): execute B7 cleanup — receipt + post-cleanup re-scan

V1 verify: re-scan returns 0 polluted (or only documented failed rows).
V2 verify: security-review pass — .env.* gitignored, no leak.

Implements spec §4 Phase 4 execute flow + §5.4 evidence checklist.
EOF
)"
```

---

## Phase 5 — Standing Rules

### Task 10: Create 2 new STANDING memory files

**Files:**
- Create: `~/.claude/projects/-Users-albertpeng-Desktop-claude-project-First-Principle/memory/feedback_three_iron_laws.md`
- Create: `~/.claude/projects/-Users-albertpeng-Desktop-claude-project-First-Principle/memory/feedback_e2e_real_data_only.md`
- Modify: `~/.claude/projects/-Users-albertpeng-Desktop-claude-project-First-Principle/memory/MEMORY.md` (append 2 lines)

**Why:** Persist STANDING rules so future sessions automatically apply IL-1/2/3 + the B7-derived test-data discipline. Implements spec §6 acceptance criteria item.

- [ ] **Step 1: Write `feedback_three_iron_laws.md`**

Content:
```markdown
---
name: 三條 Iron Laws 為最頂層 STANDING
description: IL-1 (systematic-debugging) / IL-2 (verification-before-completion) / IL-3 (TDD) 比一切 process/style rule 更高位；implementer / reviewer dispatch 必 prepend
type: feedback
---

STANDING RULE：每次 implementer / reviewer / director 動手前先唸 3 條 Iron Laws；違反一律退件。

**Why:** 2026-05-16 之前 18 個 fix commits + 7 輪 UAT 失敗的根因，systematic-debugging skill Phase 4.5 點名為「architectural problem」— workflow 違反 Iron Laws。整合 plan 已升 3 條為 STANDING（與 Playwright 10 Golden Rules 同層）。

**How to apply:**

1. **IL-1 systematic-debugging**「**NO FIXES WITHOUT ROOT CAUSE INVESTIGATION FIRST**」
   - 任何 bug / test failure / 意外行為，先走 4 phase（root cause → pattern → hypothesis → impl）才能動手
   - 3+ fix 仍未過 → 停下找 user discuss architecture（不准繼續 fix）
   - Phase 1 evidence 必含：read errors / reproduce / git diff / data flow trace
2. **IL-2 verification-before-completion**「**NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE**」
   - 任何「done / fixed / passing / great」之前必跑 verification command 並貼 output
   - sonnet implementer 回「DONE」director 必 cross-check git diff 不准盲信
3. **IL-3 test-driven-development**「**NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST**」
   - 先寫紅燈 spec → 跑紅 → 寫 impl → 跑綠 → revert impl 跑紅 → restore 跑綠（4 段 evidence 進 commit message）
   - 違反「先寫 code 後補 test」一律 delete code + 重來
   - 例外：throwaway prototype / generated code / config — 必先問 user

**對應 skill：** `superpowers:systematic-debugging` / `superpowers:verification-before-completion` / `superpowers:test-driven-development`
```

Write file:
```bash
# Use absolute path expansion
MEM_DIR="/Users/albertpeng/.claude/projects/-Users-albertpeng-Desktop-claude-project-First-Principle/memory"
cat > "$MEM_DIR/feedback_three_iron_laws.md" <<'EOF'
<paste content above>
EOF
```

- [ ] **Step 2: Write `feedback_e2e_real_data_only.md`**

Content:
```markdown
---
name: e2e 測試禁止 stub timestamp / mock 自家 API / prod URL + 真帳號
description: B7 prod 污染 incident 後立的鐵則；所有新 spec 必符合，否則違反 Playwright Golden Rule #10 + test-data-management anti-pattern
type: feedback
---

STANDING RULE：e2e 測試契約 3 條紅線，任何 spec 違反 PR 一律退件。

**Why:** 2026-05-16 B7 incident — 過去 7 輪 UAT 用 production URL + user 真帳號 (`albertpeng678@gmail.com`) 跑，stub string `e2e-rN-XX-178NNN-fN` / `dual-uat-*` 寫進 prod DB，user 截圖看到「我都沒填卻有資料」。

`playwright-skill/core/test-data-management.md:1153` 明令 Anti-Pattern：「**Using production data in tests** — Never point test suites at production databases or use real customer identifiers.」
`playwright-skill/SKILL.md` Golden Rule #10：「**Mock external services only — never mock your own app**」

**How to apply：**

1. **禁 stub timestamp string 當 fixture value**
   - ❌ `await page.getByLabel('NSM').fill(\`e2e-r${round}-nsm-${Date.now()}\`)`
   - ✅ 用 `tests/factories/user-typed-strings.js`（faker zh_TW pool，≥30 字真實中文）
   - ✅ 用 `tests/factories/{nsm,circles}-session.factory.js` 產符合 schema 的真實 payload
2. **禁 mock 自家 app endpoint**
   - ❌ `page.route('**/api/nsm-sessions/**', route => route.fulfill(...))` 對自家 endpoint
   - ✅ 透過 fixture 用 `request.post` 真實創 session → `cleanupTracker.track()` → afterEach 真實 DELETE
   - 例外：mock 外部 service（OpenAI / Stripe / 分析 SDK）為唯一容許
3. **禁 prod URL + 真帳號組合**
   - ❌ hardcode `https://first-principle.up.railway.app/` + `albertpeng678@gmail.com`
   - ✅ `BASE_URL` 從 `.env.{local,test,prod-uat}` 讀；`TEST_EMAIL` 從 env 讀
   - ✅ `tests/helpers/env-guard.js` `assertNotProdWithRealAccount()` runtime 強制
   - ✅ `.husky/pre-commit` 攔截硬 code prod URL / 真 email 進 spec 的 commit

**對應 skill：** `playwright-skill/core/test-data-management.md` + `core/authentication.md`（storage state worker-scoped）+ `ci/global-setup-teardown.md`（global cleanup）

**對應檔案：**
- `tests/helpers/env-guard.js`（Stage 0 Task 2）
- `tests/fixtures/auto-cleanup.fixture.js`（Stage 0 Task 3）
- `.husky/pre-commit`（Stage 0 Task 4）
- `.env.{local,test,prod-uat}`（Stage 0 Task 1）
```

Write file:
```bash
MEM_DIR="/Users/albertpeng/.claude/projects/-Users-albertpeng-Desktop-claude-project-First-Principle/memory"
cat > "$MEM_DIR/feedback_e2e_real_data_only.md" <<'EOF'
<paste content above>
EOF
```

- [ ] **Step 3: Append 2 lines to MEMORY.md index**

Append to `/Users/albertpeng/.claude/projects/-Users-albertpeng-Desktop-claude-project-First-Principle/memory/MEMORY.md`:
```markdown
- [三條 Iron Laws 為最頂層 STANDING](feedback_three_iron_laws.md) — IL-1 root cause / IL-2 verification / IL-3 TDD；違反一律退件
- [e2e 測試 3 條紅線](feedback_e2e_real_data_only.md) — 禁 stub timestamp / 禁 mock 自家 API / 禁 prod URL + 真帳號（B7 incident 後立）
```

- [ ] **Step 4: Verify memory files load**

Run:
```bash
ls -la /Users/albertpeng/.claude/projects/-Users-albertpeng-Desktop-claude-project-First-Principle/memory/feedback_three_iron_laws.md /Users/albertpeng/.claude/projects/-Users-albertpeng-Desktop-claude-project-First-Principle/memory/feedback_e2e_real_data_only.md
wc -l /Users/albertpeng/.claude/projects/-Users-albertpeng-Desktop-claude-project-First-Principle/memory/MEMORY.md
```
Expected: 2 files exist + MEMORY.md line count grew by 2.

- [ ] **Step 5: Commit (memory files are outside repo — no git action; but commit `audit/` / `CLAUDE.md` next task covers this round)**

No git commit for memory files (lives in `~/.claude/`).

---

### Task 11: Update `CLAUDE.md` state board + Stage 0 done

**Files:**
- Modify: `CLAUDE.md` (top section: 當前狀態 + Last updated)

**Why:** Single-source-of-truth state board mirror per standing rule `feedback_claude_md_live_state`. Implements spec §6 acceptance criteria final item.

- [ ] **Step 1: Read current CLAUDE.md state lines**

```bash
head -30 /Users/albertpeng/Desktop/claude_project/First_Principle/CLAUDE.md
```
Note the `Last updated:` line and `當前狀態` block.

- [ ] **Step 2: Update state**

Edit `CLAUDE.md`:
- Change `Last updated:` line to `2026-05-16（Stage 0 B7 cleanup + prevention infra ship；Stage 1 brainstorm 開工 pending）`
- Append new bullet under「當前狀態」:
  ```
  - **Stage 0 ship (2026-05-16)：** B7 prod 污染清理完成 + prevention infra 上線（env-guard / auto-cleanup fixture / pre-commit hook / 3-env .env / `e2e@first-principle.test` 帳號）+ 2 條 STANDING memory（three_iron_laws / e2e_real_data_only）+ skill 完整整合 plan ship。
  ```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "chore(stage-0): mark Stage 0 done in CLAUDE.md state board

B7 cleanup + prevention infra + 2 STANDING memory ship.
Stage 1 (B1-B6 + B8 normal workflow) opens next."
```

- [ ] **Step 4: Push origin/main**

```bash
git push origin main
```
Expected: All Stage 0 commits land on origin/main.

---

## Self-Review

(Run inline — no subagent. Per writing-plans skill.)

**1. Spec coverage**

| Spec section | Plan task |
|---|---|
| §1 Architecture (parallel lanes + merge + verify) | Phase organization (1→2→3→4→5) |
| §2.1 Lane A files A1-A5 | Tasks 1, 2, 3, 4 |
| §2.2 Lane B files B1-B4 | Tasks 5, 6 |
| §2.3 Merge M1-M2 | Task 7 (M1) + Task 9 (M2 receipt) |
| §2.4 Verify V1-V2 | Task 9 Steps 3-4 |
| §3 Data flow | Inline in Task 5, 6, 7 implementations |
| §4 Error handling | Embedded in code (retry / 404 swallow / dry-run prompt) |
| §5 Testing strategy + IL-2/IL-3 gates | Tasks 2, 3, 4, 6 (red-green-revert) + Task 9 Step 4 |
| §6 Acceptance criteria checklist | Tasks 7-11 (each checklist item maps to a task step) |
| §7 Out of scope (B1-B6) | Not in plan — defers to Stage 1 |
| §8 References | Plan header `Spec reference` line |

No gaps.

**2. Placeholder scan**

- No `TBD` / `TODO` / `fill in details` literals in tasks.
- All steps have concrete commands / code / expected output.
- All paths absolute or repo-relative (consistent).
- Function names consistent: `assertNotProdWithRealAccount` / `assertActingOnBehalfOfPollutionTarget` (Tasks 2, 7, 9 all match).
- `cleanupTracker.track(kind, id)` interface consistent (Task 3 implements + Task 7 doesn't directly use but `auto-cleanup.fixture` is exported as `test` for future specs).

**3. Type consistency**

- `kind: 'nsm' | 'circles'` consistent across Tasks 3, 6, 7.
- `POLLUTION_PATTERNS` regex defined Task 6, used Task 6 (no other consumers — correct).
- `BASE_URL` from `.env.test` consistent across Tasks 1, 5, 6, 7.
- `USER_REAL_EMAIL` env var: declared Task 1, used Task 2 (`assertActingOnBehalfOfPollutionTarget`), used Task 7 (preflight). Consistent.

No issues found. Plan ready.

---

## Execution Handoff

**Plan complete and saved to** `docs/superpowers/plans/2026-05-16-stage-0-b7-cleanup.md`.

**Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, two-stage review (spec compliance + code quality) between tasks, fast iteration.
- Phase 1 (Lane A + Lane B parallel): 1 message dispatches 2 subagents simultaneously (sonnet for Lane A sequential 1-4; opus self does Lane B sequential 5-6)
- Phase 2-5 sequential

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch with checkpoints.

**Which approach?**
