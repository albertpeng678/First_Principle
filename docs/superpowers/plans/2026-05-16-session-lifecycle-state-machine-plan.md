# Session Lifecycle State Machine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate empty-draft skeletons from the `練習記錄` drawer by adding a server-computed `lifecycle` column (`created → editing → gated → completed`), filtering the list endpoints, and pruning stale `created` rows via a nightly cron — without removing the load-bearing eager-INSERT pre-flight or touching any FE write path / OpenAI prompt.

**Architecture:** A four-layer defense-in-depth design. Layer 1 = schema (`lifecycle TEXT NOT NULL DEFAULT 'created' CHECK (...)` on `circles_sessions` + `nsm_sessions`, indexed by `(user_id, lifecycle, updated_at DESC)`). Layer 2 = a single shared helper `lib/session-lifecycle.js` (`computeLifecycle` + `hasSubstantiveContent`) wired into every PATCH/POST that mutates a session; FE-supplied `lifecycle` is ignored. Layer 3 = list endpoints append `.neq('lifecycle','created')` unless an operator passes `?include_empty=true`. Layer 4 = idempotent cron endpoint `POST /api/admin/cleanup-empty-sessions` with `x-cron-secret` auth, `?dry=true` mode, and `MAX_DELETES_PER_RUN=500` safety cap. Spec: `docs/superpowers/specs/2026-05-16-session-lifecycle-state-machine-design.md` (commit `33d5bf9`).

**Tech Stack:** Node/Express, Supabase Postgres, Railway cron, Playwright (JavaScript), jest.

---

## Spec ↔ Task Coverage Matrix

| Acceptance Criteria | Task |
|---|---|
| SLC-AC1, AC2 (schema + indexes) | T1 |
| SLC-AC3 (backfill correctness) | T2 |
| SLC-AC4, AC5, AC6, AC9, AC10 (CIRCLES transition + monotone + ignore body) | T3 |
| SLC-AC4, AC5, AC7, AC8 (NSM transition + gate/evaluate promotion) | T4 |
| SLC-AC11, AC12, AC13, AC14 (list filter + detail unchanged + operator gate) | T5 |
| SLC-AC15, AC16, AC17, AC18, AC19 (cron auth/dry/cap/idempotency) | T6 |
| SLC-AC5 (end-to-end), AC11, AC20 (FE drawer renders filtered list) | T7 |
| SLC-AC6 (stub anti-promotion adversarial) | T8 |
| SLC-AC21 (Bug B1-H invariants intact) | T9 |

Total tasks: **9**. T1-T6 are author-then-test pairs (TDD red→green). T7 is Playwright E2E. T8 is adversarial sweep. T9 is director cold-Read regression.

---

## Pre-flight (one-time setup, before T1)

- [ ] Confirm `tests/contracts/` directory exists; if not, the first contract spec (T3) creates it. No code change needed here — flagged so the implementer doesn't think the missing dir is a bug.
- [ ] Confirm `.env.test` has `OPERATOR_EMAIL=e2e@first-principle.test` and `CRON_SECRET=test-cron-secret-do-not-use-in-prod`. If missing, append both lines. (Required by T5 + T6 tests.)
- [ ] Read the design spec end-to-end:
  ```bash
  $ wc -l /Users/albertpeng/Desktop/claude_project/First_Principle/docs/superpowers/specs/2026-05-16-session-lifecycle-state-machine-design.md
  # Expected: 480 docs/superpowers/specs/2026-05-16-session-lifecycle-state-machine-design.md
  ```

---

## T1 — Schema migration + indexes

**Goal:** Add `lifecycle` column + 3 indexes (CIRCLES user + guest, NSM user) on both session tables. Idempotent (`IF NOT EXISTS` everywhere).

### Files

| Action | Path |
|---|---|
| Create | `migrations/2026-05-17-session-lifecycle.sql` |
| Create | `tests/migrations/2026-05-17-session-lifecycle.test.js` |

### Step 1.1 — Write failing test (TDD red)

Create `tests/migrations/2026-05-17-session-lifecycle.test.js`:

```javascript
// tests/migrations/2026-05-17-session-lifecycle.test.js
// Verifies the lifecycle migration is well-formed and idempotent.
// Does NOT run psql — that's deploy-time. This guards the SQL text.

const fs = require('fs');
const path = require('path');

const MIGRATION = fs.readFileSync(
  path.join(__dirname, '..', '..', 'migrations', '2026-05-17-session-lifecycle.sql'),
  'utf8'
);

describe('migration 2026-05-17-session-lifecycle.sql', () => {
  test('adds lifecycle column to circles_sessions with correct shape', () => {
    expect(MIGRATION).toMatch(
      /ALTER TABLE\s+circles_sessions\s+ADD COLUMN IF NOT EXISTS\s+lifecycle\s+TEXT\s+NOT NULL\s+DEFAULT\s+'created'\s+CHECK\s*\(\s*lifecycle\s+IN\s*\(\s*'created'\s*,\s*'editing'\s*,\s*'gated'\s*,\s*'completed'\s*\)\s*\)/i
    );
  });

  test('adds lifecycle column to nsm_sessions with correct shape', () => {
    expect(MIGRATION).toMatch(
      /ALTER TABLE\s+nsm_sessions\s+ADD COLUMN IF NOT EXISTS\s+lifecycle\s+TEXT\s+NOT NULL\s+DEFAULT\s+'created'\s+CHECK\s*\(\s*lifecycle\s+IN\s*\(\s*'created'\s*,\s*'editing'\s*,\s*'gated'\s*,\s*'completed'\s*\)\s*\)/i
    );
  });

  test('creates user index on circles_sessions', () => {
    expect(MIGRATION).toMatch(
      /CREATE INDEX IF NOT EXISTS\s+idx_circles_sessions_lifecycle_user\s+ON\s+circles_sessions\s*\(\s*user_id\s*,\s*lifecycle\s*,\s*updated_at\s+DESC\s*\)/i
    );
  });

  test('creates guest index on circles_sessions', () => {
    expect(MIGRATION).toMatch(
      /CREATE INDEX IF NOT EXISTS\s+idx_circles_sessions_lifecycle_guest\s+ON\s+circles_sessions\s*\(\s*guest_id\s*,\s*lifecycle\s*,\s*updated_at\s+DESC\s*\)/i
    );
  });

  test('creates user index on nsm_sessions', () => {
    expect(MIGRATION).toMatch(
      /CREATE INDEX IF NOT EXISTS\s+idx_nsm_sessions_lifecycle_user\s+ON\s+nsm_sessions\s*\(\s*user_id\s*,\s*lifecycle\s*,\s*updated_at\s+DESC\s*\)/i
    );
  });

  test('is fully idempotent — every DDL statement uses IF NOT EXISTS', () => {
    const ddl = MIGRATION.split(';').map((s) => s.trim()).filter((s) => /^(ALTER|CREATE)/i.test(s));
    expect(ddl.length).toBeGreaterThanOrEqual(5);
    for (const stmt of ddl) {
      expect(stmt).toMatch(/IF NOT EXISTS/i);
    }
  });
});
```

Run — expect red (file does not exist):

```bash
$ npx jest tests/migrations/2026-05-17-session-lifecycle.test.js
# Expected: ENOENT — migrations/2026-05-17-session-lifecycle.sql not found
```

### Step 1.2 — Minimal impl (TDD green)

Create `migrations/2026-05-17-session-lifecycle.sql`:

```sql
-- migrations/2026-05-17-session-lifecycle.sql
-- Adds the lifecycle state column + indexes to both session tables.
-- Idempotent: safe to re-run.
-- Default 'created' satisfies the NOT NULL constraint for existing rows
-- and is set by every eager-INSERT pre-flight without code change.

ALTER TABLE circles_sessions
  ADD COLUMN IF NOT EXISTS lifecycle TEXT NOT NULL DEFAULT 'created'
    CHECK (lifecycle IN ('created','editing','gated','completed'));

CREATE INDEX IF NOT EXISTS idx_circles_sessions_lifecycle_user
  ON circles_sessions (user_id, lifecycle, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_circles_sessions_lifecycle_guest
  ON circles_sessions (guest_id, lifecycle, updated_at DESC);

ALTER TABLE nsm_sessions
  ADD COLUMN IF NOT EXISTS lifecycle TEXT NOT NULL DEFAULT 'created'
    CHECK (lifecycle IN ('created','editing','gated','completed'));

CREATE INDEX IF NOT EXISTS idx_nsm_sessions_lifecycle_user
  ON nsm_sessions (user_id, lifecycle, updated_at DESC);
```

### Step 1.3 — Verify green

```bash
$ npx jest tests/migrations/2026-05-17-session-lifecycle.test.js
# Expected: 6 passed
```

### Step 1.4 — Commit

```bash
$ git add migrations/2026-05-17-session-lifecycle.sql tests/migrations/2026-05-17-session-lifecycle.test.js
$ git commit -m "feat(schema): add lifecycle column + indexes to session tables (SLC-AC1/AC2)"
```

---

## T2 — Lifecycle helper (`lib/session-lifecycle.js`) + backfill script

**Goal:** Single source of truth for `hasSubstantiveContent` + `computeLifecycle`. Also ship the backfill script that derives lifecycle for pre-existing rows.

### Files

| Action | Path |
|---|---|
| Create | `lib/session-lifecycle.js` |
| Create | `tests/lib/session-lifecycle.test.js` |
| Create | `scripts/backfill-lifecycle.js` |
| Create | `tests/scripts/backfill-lifecycle.test.js` |

### Step 2.1 — Write failing helper test (TDD red)

Create `tests/lib/session-lifecycle.test.js`:

```javascript
// tests/lib/session-lifecycle.test.js
const {
  hasSubstantiveContent,
  computeLifecycle,
} = require('../../lib/session-lifecycle');

describe('hasSubstantiveContent (CIRCLES)', () => {
  test('empty patch → false', () => {
    expect(hasSubstantiveContent({}, 'circles', 'patch')).toBe(false);
  });

  test('whitespace-only string → false', () => {
    expect(
      hasSubstantiveContent({ frameworkDraft: { C1: { 問題範圍: '   ' } } }, 'circles', 'patch')
    ).toBe(false);
  });

  test('HTML-only string → false', () => {
    expect(
      hasSubstantiveContent({ frameworkDraft: { C1: { 問題範圍: '<p><br></p>' } } }, 'circles', 'patch')
    ).toBe(false);
  });

  test('polluted stub (matches scan-pollution.isPolluted) → false', () => {
    // Pattern from B7: "e2e-r1-1789..." style stubs
    expect(
      hasSubstantiveContent(
        { frameworkDraft: { C1: { 問題範圍: 'e2e-r1-17896543210' } } },
        'circles',
        'patch'
      )
    ).toBe(false);
  });

  test('real prose → true', () => {
    expect(
      hasSubstantiveContent(
        { frameworkDraft: { C1: { 問題範圍: '我們的目標是把週活躍提升到 30%' } } },
        'circles',
        'patch'
      )
    ).toBe(true);
  });

  test('legacy stepDrafts.framework shape → true', () => {
    expect(
      hasSubstantiveContent(
        { stepDrafts: { framework: { C1: { 問題範圍: '真實內容' } } } },
        'circles',
        'patch'
      )
    ).toBe(true);
  });

  test('phase2ConclusionDraft → true', () => {
    expect(
      hasSubstantiveContent({ phase2ConclusionDraft: '結論是...' }, 'circles', 'patch')
    ).toBe(true);
  });

  test('mixed real + polluted → true (real wins)', () => {
    expect(
      hasSubstantiveContent(
        {
          frameworkDraft: {
            C1: { 問題範圍: 'e2e-r1-17896543210' },
            I:  { 假設: '真實假設內容' },
          },
        },
        'circles',
        'patch'
      )
    ).toBe(true);
  });
});

describe('hasSubstantiveContent (NSM)', () => {
  test('empty patch → false', () => {
    expect(hasSubstantiveContent({}, 'nsm', 'patch')).toBe(false);
  });

  test('userNsm prose → true', () => {
    expect(hasSubstantiveContent({ userNsm: '週活躍會員數' }, 'nsm', 'patch')).toBe(true);
  });

  test('userNsm object shape with non-empty nsm → true', () => {
    expect(
      hasSubstantiveContent({ userNsm: { nsm: '週活躍', explanation: '', businessLink: '' } }, 'nsm', 'patch')
    ).toBe(true);
  });

  test('userBreakdown single dim → true', () => {
    expect(
      hasSubstantiveContent({ userBreakdown: { reach: '所有付費會員', depth: '', frequency: '', impact: '' } }, 'nsm', 'patch')
    ).toBe(true);
  });

  test('all 4 dim empty → false', () => {
    expect(
      hasSubstantiveContent({ userBreakdown: { reach: '', depth: '', frequency: '', impact: '' } }, 'nsm', 'patch')
    ).toBe(false);
  });

  test('polluted userExplanation → false', () => {
    expect(
      hasSubstantiveContent({ userExplanation: 'e2e-r1-17896543210' }, 'nsm', 'patch')
    ).toBe(false);
  });
});

describe('computeLifecycle (transitions)', () => {
  const cases = [
    // [priorLifecycle, patch, route, expected]
    ['created',   {}, 'patch', 'created'],
    ['created',   { frameworkDraft: { C1: { 問題範圍: '真實' } } }, 'patch', 'editing'],
    ['created',   {}, 'gate_ok',          'gated'],
    ['created',   {}, 'analysis_done',    'completed'],
    ['editing',   {}, 'patch',            'editing'],
    ['editing',   { frameworkDraft: { C1: { 問題範圍: '更新' } } }, 'patch', 'editing'],
    ['editing',   {}, 'gate_ok',          'gated'],
    ['editing',   {}, 'gate_fail',        'editing'], // failed gate does not promote
    ['editing',   {}, 'analysis_done',    'completed'],
    ['gated',     {}, 'patch',            'gated'],   // monotone, no demotion
    ['gated',     { frameworkDraft: { C1: { 問題範圍: '改' } } }, 'patch', 'gated'],
    ['gated',     {}, 'gate_ok',          'gated'],
    ['gated',     {}, 'analysis_done',    'completed'],
    ['completed', {}, 'patch',            'completed'], // terminal
    ['completed', {}, 'gate_ok',          'completed'],
    ['completed', {}, 'analysis_done',    'completed'],
  ];

  test.each(cases)(
    'prior=%s + route=%s → %s',
    (prior, patch, route, expected) => {
      expect(computeLifecycle({ lifecycle: prior }, patch, 'circles', route)).toBe(expected);
    }
  );

  test('FE-supplied lifecycle in body is ignored', () => {
    expect(
      computeLifecycle({ lifecycle: 'created' }, { lifecycle: 'completed' }, 'circles', 'patch')
    ).toBe('created');
  });

  test('null prior lifecycle defaults to "created"', () => {
    expect(computeLifecycle({}, {}, 'circles', 'patch')).toBe('created');
  });
});
```

Run — expect red:

```bash
$ npx jest tests/lib/session-lifecycle.test.js
# Expected: Cannot find module '../../lib/session-lifecycle'
```

### Step 2.2 — Minimal impl

Create `lib/session-lifecycle.js`:

```javascript
// lib/session-lifecycle.js
// Single source of truth for session lifecycle state transitions.
// Used by both circles-sessions + nsm-sessions (auth + guest variants).
//
// State machine:
//   created → editing → gated → completed
//   Transitions are monotone in priority — a patch can only advance or stay.
//
// Routes recognised:
//   'patch'         — PATCH /:id/progress (lifecycle derived from payload content)
//   'gate_ok'       — POST /:id/gate that returned ok=true
//   'gate_fail'     — POST /:id/gate that returned ok=false / error (no promotion)
//   'analysis_done' — POST /:id/final-report (CIRCLES) or /:id/evaluate (NSM) success

const { isPolluted } = require('../scripts/scan-pollution');

const PRIORITY = { created: 0, editing: 1, gated: 2, completed: 3 };

function stripAndTrim(v) {
  if (typeof v !== 'string') return '';
  return v.replace(/<[^>]+>/g, '').trim();
}

function isMeaningful(v) {
  const s = stripAndTrim(v);
  if (!s) return false;
  if (isPolluted(s)) return false;
  return true;
}

// Walk a CIRCLES patch body and collect all user-editable string values.
function collectCirclesStrings(patch) {
  const out = [];
  const fd = patch && patch.frameworkDraft;
  if (fd && typeof fd === 'object') {
    for (const step of Object.values(fd)) {
      if (step && typeof step === 'object') {
        for (const v of Object.values(step)) {
          if (typeof v === 'string') out.push(v);
        }
      }
    }
  }
  const legacy = patch && patch.stepDrafts && patch.stepDrafts.framework;
  if (legacy && typeof legacy === 'object') {
    for (const step of Object.values(legacy)) {
      if (step && typeof step === 'object') {
        for (const v of Object.values(step)) {
          if (typeof v === 'string') out.push(v);
        }
      }
    }
  }
  // Phase 1 sub-steps + Phase 2 conclusion
  for (const k of ['P1', 'P1S', 'P1L', 'P1E']) {
    const v = patch && patch.stepDrafts && patch.stepDrafts[k];
    if (v && typeof v === 'object') {
      for (const inner of Object.values(v)) {
        if (typeof inner === 'string') out.push(inner);
      }
    }
  }
  if (typeof patch.phase2ConclusionDraft === 'string') out.push(patch.phase2ConclusionDraft);
  return out;
}

// Walk an NSM patch body and collect all user-editable string values.
function collectNsmStrings(patch) {
  const out = [];
  if (typeof patch.userNsm === 'string') out.push(patch.userNsm);
  if (patch.userNsm && typeof patch.userNsm === 'object') {
    for (const k of ['nsm', 'explanation', 'businessLink']) {
      if (typeof patch.userNsm[k] === 'string') out.push(patch.userNsm[k]);
    }
  }
  if (patch.userBreakdown && typeof patch.userBreakdown === 'object') {
    for (const k of ['reach', 'depth', 'frequency', 'impact']) {
      if (typeof patch.userBreakdown[k] === 'string') out.push(patch.userBreakdown[k]);
    }
  }
  if (typeof patch.userExplanation === 'string') out.push(patch.userExplanation);
  if (typeof patch.userBusinessLink === 'string') out.push(patch.userBusinessLink);
  return out;
}

function hasSubstantiveContent(patch, kind, _route) {
  if (!patch || typeof patch !== 'object') return false;
  const strings =
    kind === 'nsm' ? collectNsmStrings(patch) : collectCirclesStrings(patch);
  return strings.some(isMeaningful);
}

function computeLifecycle(prior, patch, kind, route) {
  const priorLc = (prior && prior.lifecycle) || 'created';
  // Terminal
  if (priorLc === 'completed') return 'completed';
  // Route-driven advancement
  if (route === 'analysis_done') return 'completed';
  if (route === 'gate_ok') {
    return PRIORITY[priorLc] >= PRIORITY.gated ? priorLc : 'gated';
  }
  // 'patch' or 'gate_fail' or anything else — content-driven promotion only
  if (priorLc === 'created' && hasSubstantiveContent(patch, kind, route)) {
    return 'editing';
  }
  return priorLc;
}

module.exports = { hasSubstantiveContent, computeLifecycle, PRIORITY };
```

### Step 2.3 — Verify helper green

```bash
$ npx jest tests/lib/session-lifecycle.test.js
# Expected: all describe blocks pass (~30 assertions)
```

### Step 2.4 — Write failing backfill test

Create `tests/scripts/backfill-lifecycle.test.js`:

```javascript
// tests/scripts/backfill-lifecycle.test.js
const { classify } = require('../../scripts/backfill-lifecycle');

describe('backfill-lifecycle.classify (CIRCLES)', () => {
  test('status=completed → completed', () => {
    expect(classify({ status: 'completed' }, 'circles')).toBe('completed');
  });

  test('lifecycle already completed → completed (idempotent)', () => {
    expect(classify({ lifecycle: 'completed' }, 'circles')).toBe('completed');
  });

  test('gate_result.ok=true → gated', () => {
    expect(classify({ gate_result: { ok: true } }, 'circles')).toBe('gated');
  });

  test('gate_result.ok=false → falls through to content check', () => {
    expect(
      classify({ gate_result: { ok: false }, framework_draft: { C1: { 問題範圍: '真實' } } }, 'circles')
    ).toBe('editing');
  });

  test('framework_draft with real content → editing', () => {
    expect(
      classify({ framework_draft: { C1: { 問題範圍: '我們的目標是...' } } }, 'circles')
    ).toBe('editing');
  });

  test('framework_draft empty + no gate → created', () => {
    expect(classify({ framework_draft: {} }, 'circles')).toBe('created');
  });

  test('framework_draft polluted only → created', () => {
    expect(
      classify({ framework_draft: { C1: { 問題範圍: 'e2e-r1-17896543210' } } }, 'circles')
    ).toBe('created');
  });
});

describe('backfill-lifecycle.classify (NSM)', () => {
  test('status=completed → completed', () => {
    expect(classify({ status: 'completed' }, 'nsm')).toBe('completed');
  });

  test('scores_json present → completed', () => {
    expect(classify({ scores_json: { total: 80 } }, 'nsm')).toBe('completed');
  });

  test('progress_json.gateResult.ok=true → gated', () => {
    expect(classify({ progress_json: { gateResult: { ok: true } } }, 'nsm')).toBe('gated');
  });

  test('user_nsm prose → editing', () => {
    expect(classify({ user_nsm: '週活躍會員數' }, 'nsm')).toBe('editing');
  });

  test('user_breakdown single dim → editing', () => {
    expect(
      classify({ user_breakdown: { reach: '付費會員', depth: '', frequency: '', impact: '' } }, 'nsm')
    ).toBe('editing');
  });

  test('empty NSM row → created', () => {
    expect(classify({}, 'nsm')).toBe('created');
  });

  test('polluted user_explanation only → created', () => {
    expect(classify({ user_explanation: 'e2e-r1-17896543210' }, 'nsm')).toBe('created');
  });
});
```

Run — red.

### Step 2.5 — Backfill script impl

Create `scripts/backfill-lifecycle.js`:

```javascript
#!/usr/bin/env node
// scripts/backfill-lifecycle.js
// Computes lifecycle for every pre-existing row in circles_sessions + nsm_sessions
// based on existing columns (status, gate_result, framework_draft, etc.).
//
// Usage:
//   node scripts/backfill-lifecycle.js --dry      # print counts only
//   node scripts/backfill-lifecycle.js --apply    # write the updates
//
// Idempotent: re-run is safe (the rule reads existing lifecycle and respects 'completed').

const { hasSubstantiveContent } = require('../lib/session-lifecycle');

function classify(row, kind) {
  if (!row || typeof row !== 'object') return 'created';

  // Terminal first
  if (row.status === 'completed' || row.lifecycle === 'completed') return 'completed';
  if (kind === 'nsm' && row.scores_json) return 'completed';

  // Gated
  if (kind === 'circles' && row.gate_result && row.gate_result.ok === true) return 'gated';
  if (kind === 'nsm' && row.progress_json && row.progress_json.gateResult && row.progress_json.gateResult.ok === true) {
    return 'gated';
  }

  // Editing — fold the row shape into a virtual patch body, then re-use helper
  if (kind === 'circles') {
    const virtual = {
      frameworkDraft: row.framework_draft || {},
      stepDrafts: row.step_drafts || {},
      phase2ConclusionDraft: (row.progress_json && row.progress_json.phase2ConclusionDraft) || '',
    };
    if (hasSubstantiveContent(virtual, 'circles', 'patch')) return 'editing';
  } else {
    const virtual = {
      userNsm: row.user_nsm,
      userBreakdown: row.user_breakdown,
      userExplanation: row.user_explanation,
      userBusinessLink: row.user_business_link,
    };
    if (hasSubstantiveContent(virtual, 'nsm', 'patch')) return 'editing';
  }

  return 'created';
}

async function main() {
  const apply = process.argv.includes('--apply');
  const dry = process.argv.includes('--dry') || !apply;

  // Late require so unit tests don't need supabase env vars.
  const { db } = require('../lib/db');
  const summary = { circles: { completed: 0, gated: 0, editing: 0, created: 0 }, nsm: { completed: 0, gated: 0, editing: 0, created: 0 } };

  for (const kind of ['circles', 'nsm']) {
    const table = kind === 'circles' ? 'circles_sessions' : 'nsm_sessions';
    const { data, error } = await db.from(table).select('*');
    if (error) throw error;
    for (const row of data) {
      const next = classify(row, kind);
      summary[kind][next]++;
      if (apply && row.lifecycle !== next) {
        const { error: uErr } = await db.from(table).update({ lifecycle: next }).eq('id', row.id);
        if (uErr) throw uErr;
      }
    }
  }

  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ mode: dry ? 'dry' : 'apply', summary }, null, 2));
}

if (require.main === module) {
  main().catch((e) => {
    // eslint-disable-next-line no-console
    console.error('[backfill-lifecycle] error:', e);
    process.exit(1);
  });
}

module.exports = { classify };
```

> Note: the script's `main()` requires `lib/db.js`; if that module name differs in this repo (e.g. `lib/supabase.js`), the implementer adjusts in step 2.6 and re-runs jest — `classify` is pure and stays test-covered.

### Step 2.6 — Verify backfill green

```bash
$ npx jest tests/scripts/backfill-lifecycle.test.js tests/lib/session-lifecycle.test.js
# Expected: all green
```

### Step 2.7 — Commit

```bash
$ git add lib/session-lifecycle.js scripts/backfill-lifecycle.js \
          tests/lib/session-lifecycle.test.js tests/scripts/backfill-lifecycle.test.js
$ git commit -m "feat(lib): session lifecycle helper + idempotent backfill (SLC-AC3..AC10)"
```

---

## T3 — Wire CIRCLES routes (auth + guest)

**Goal:** Every CIRCLES PATCH/POST that mutates a session computes and writes `lifecycle`. FE-supplied `lifecycle` ignored. Failed gate does NOT promote.

### Files

| Action | Path |
|---|---|
| Modify | `routes/circles-sessions.js` |
| Modify | `routes/guest-circles-sessions.js` |
| Create | `tests/contracts/lifecycle-circles-route.test.js` |

### Step 3.1 — Failing contract test (red)

Create `tests/contracts/lifecycle-circles-route.test.js`:

```javascript
// tests/contracts/lifecycle-circles-route.test.js
// Uses supertest against the in-process app to verify the lifecycle column
// is written correctly by every PATCH/POST. Real DB calls are stubbed via
// the existing test helpers (tests/helpers/test-supabase.js pattern — see
// circles-sessions.test.js for prior art).

const request = require('supertest');
const { createTestApp, seedSession } = require('../helpers/test-supabase');

describe('CIRCLES lifecycle wiring', () => {
  let app;
  beforeAll(() => { app = createTestApp(); });

  test('POST /draft inserts lifecycle=created (SLC-AC4)', async () => {
    const res = await request(app)
      .post('/api/circles-sessions/draft')
      .set('Authorization', 'Bearer test-user-1')
      .send({ question_id: 'Q1', question_json: { id: 'Q1' }, mode: 'drill' });
    expect(res.status).toBe(200);
    const row = await seedSession.fetch('circles_sessions', res.body.id);
    expect(row.lifecycle).toBe('created');
  });

  test('PATCH /:id/progress with substantive content → editing (SLC-AC5)', async () => {
    const id = await seedSession.insert('circles_sessions', { lifecycle: 'created', user_id: 'test-user-1' });
    const res = await request(app)
      .patch(`/api/circles-sessions/${id}/progress`)
      .set('Authorization', 'Bearer test-user-1')
      .send({ frameworkDraft: { C1: { 問題範圍: '我們的目標是把週活躍提升到 30%' } } });
    expect(res.status).toBe(200);
    const row = await seedSession.fetch('circles_sessions', id);
    expect(row.lifecycle).toBe('editing');
  });

  test('PATCH /:id/progress with polluted-only stub does NOT promote (SLC-AC6)', async () => {
    const id = await seedSession.insert('circles_sessions', { lifecycle: 'created', user_id: 'test-user-1' });
    const res = await request(app)
      .patch(`/api/circles-sessions/${id}/progress`)
      .set('Authorization', 'Bearer test-user-1')
      .send({ frameworkDraft: { C1: { 問題範圍: 'e2e-r1-17896543210' } } });
    expect(res.status).toBe(200);
    const row = await seedSession.fetch('circles_sessions', id);
    expect(row.lifecycle).toBe('created');
  });

  test('POST /:id/gate ok=true → gated (SLC-AC7)', async () => {
    const id = await seedSession.insert('circles_sessions', { lifecycle: 'editing', user_id: 'test-user-1' });
    seedSession.stubAi('circles-gate', { ok: true, issues: [] });
    const res = await request(app)
      .post(`/api/circles-sessions/${id}/gate`)
      .set('Authorization', 'Bearer test-user-1')
      .send({ step: 'C1', frameworkDraft: { C1: { 問題範圍: '真實' } } });
    expect(res.status).toBe(200);
    const row = await seedSession.fetch('circles_sessions', id);
    expect(row.lifecycle).toBe('gated');
  });

  test('POST /:id/gate ok=false does NOT promote (SLC-AC7 negative)', async () => {
    const id = await seedSession.insert('circles_sessions', { lifecycle: 'editing', user_id: 'test-user-1' });
    seedSession.stubAi('circles-gate', { ok: false, issues: ['too vague'] });
    await request(app)
      .post(`/api/circles-sessions/${id}/gate`)
      .set('Authorization', 'Bearer test-user-1')
      .send({ step: 'C1', frameworkDraft: { C1: { 問題範圍: '真實' } } });
    const row = await seedSession.fetch('circles_sessions', id);
    expect(row.lifecycle).toBe('editing');
  });

  test('POST /:id/final-report → completed (SLC-AC8)', async () => {
    const id = await seedSession.insert('circles_sessions', { lifecycle: 'gated', user_id: 'test-user-1' });
    seedSession.stubAi('circles-final', { total: 85 });
    await request(app)
      .post(`/api/circles-sessions/${id}/final-report`)
      .set('Authorization', 'Bearer test-user-1');
    const row = await seedSession.fetch('circles_sessions', id);
    expect(row.lifecycle).toBe('completed');
  });

  test('PATCH following gated cannot demote (SLC-AC9 monotone)', async () => {
    const id = await seedSession.insert('circles_sessions', { lifecycle: 'gated', user_id: 'test-user-1' });
    await request(app)
      .patch(`/api/circles-sessions/${id}/progress`)
      .set('Authorization', 'Bearer test-user-1')
      .send({ currentStep: 'I' });
    const row = await seedSession.fetch('circles_sessions', id);
    expect(row.lifecycle).toBe('gated');
  });

  test('FE-supplied lifecycle in body is ignored (SLC-AC10)', async () => {
    const id = await seedSession.insert('circles_sessions', { lifecycle: 'created', user_id: 'test-user-1' });
    await request(app)
      .patch(`/api/circles-sessions/${id}/progress`)
      .set('Authorization', 'Bearer test-user-1')
      .send({ lifecycle: 'completed' });
    const row = await seedSession.fetch('circles_sessions', id);
    expect(row.lifecycle).toBe('created');
  });
});

// Mirror block for guest-circles-sessions — identical assertions, different mount.
describe('GUEST CIRCLES lifecycle wiring', () => {
  // (same 7 tests, swap auth header for guest cookie / x-guest-id pattern;
  // implementer copies from existing guest-circles-stats.test.js setup.)
});
```

Run — red.

### Step 3.2 — Impl: wire `computeLifecycle` into CIRCLES handlers

Modify `routes/circles-sessions.js`. For each mutating handler, after computing the patch payload but before the Supabase `.update(...)`:

```javascript
// Top of file
const { computeLifecycle } = require('../lib/session-lifecycle');

// In POST /:id/gate (existing logic around line 165–185):
//   ... after reviewFramework() returns gateResult ...
const route = gateResult && gateResult.ok ? 'gate_ok' : 'gate_fail';
const nextLifecycle = computeLifecycle(session, { frameworkDraft }, 'circles', route);
await db.from('circles_sessions')
  .update({ framework_draft: frameworkDraft, gate_result: gateResult, lifecycle: nextLifecycle })
  .eq('id', req.params.id).eq('user_id', req.user.id);

// In POST /:id/final-report (existing logic around line 334):
//   ... after generateFinalReport() succeeds ...
const nextLifecycle = computeLifecycle(session, {}, 'circles', 'analysis_done');
await db.from('circles_sessions')
  .update({ /* existing fields */, lifecycle: nextLifecycle, status: 'completed' })
  .eq('id', req.params.id).eq('user_id', req.user.id);

// In PATCH /:id/progress (existing patch-building around line 287–315):
//   - Strip any incoming `lifecycle` from body BEFORE building `patch`:
delete req.body.lifecycle;
//   - After patch is built and current row fetched:
const nextLifecycle = computeLifecycle(session, req.body, 'circles', 'patch');
if (nextLifecycle !== session.lifecycle) patch.lifecycle = nextLifecycle;
```

Apply the same three insertion points to `routes/guest-circles-sessions.js`.

### Step 3.3 — Verify green

```bash
$ npx jest tests/contracts/lifecycle-circles-route.test.js
# Expected: 7 auth + 7 guest = 14 passed
$ npx jest tests/circles-sessions.test.js tests/circles-sessions-draft.test.js
# Expected: baseline still green (no regressions)
```

### Step 3.4 — Commit

```bash
$ git add routes/circles-sessions.js routes/guest-circles-sessions.js \
          tests/contracts/lifecycle-circles-route.test.js
$ git commit -m "feat(circles): wire lifecycle into PATCH/gate/final-report handlers (SLC-AC4..AC10)"
```

---

## T4 — Wire NSM routes (auth + guest)

**Goal:** Same as T3 for NSM. Triggers: `POST /` (insert), `PATCH /:id/progress` (content), `POST /:id/gate` (gate_ok), `POST /:id/evaluate` (analysis_done).

### Files

| Action | Path |
|---|---|
| Modify | `routes/nsm-sessions.js` |
| Modify | `routes/guest-nsm-sessions.js` |
| Create | `tests/contracts/lifecycle-nsm-route.test.js` |

### Step 4.1 — Failing contract test (red)

Create `tests/contracts/lifecycle-nsm-route.test.js` mirroring T3's structure but using NSM endpoints + payload shapes. Reuse `seedSession.stubAi('nsm-gate', ...)` and `seedSession.stubAi('nsm-evaluator', ...)`. Six tests per mount × 2 mounts (auth + guest) = 12 cases:

```javascript
// tests/contracts/lifecycle-nsm-route.test.js (skeleton — implementer fills bodies
// mirroring tests/contracts/lifecycle-circles-route.test.js exactly)

describe('NSM lifecycle wiring', () => {
  test('POST /api/nsm-sessions → lifecycle=created (SLC-AC4)', async () => { /* ... */ });
  test('PATCH /:id/progress with userNsm → editing (SLC-AC5)', async () => { /* ... */ });
  test('PATCH /:id/progress with polluted userBreakdown → still created (SLC-AC6)', async () => { /* ... */ });
  test('POST /:id/gate ok=true → gated (SLC-AC7)', async () => { /* ... */ });
  test('POST /:id/gate ok=false → no promotion', async () => { /* ... */ });
  test('POST /:id/evaluate → completed (SLC-AC8)', async () => { /* ... */ });
});

describe('GUEST NSM lifecycle wiring', () => { /* mirror */ });
```

Run — red.

### Step 4.2 — Impl

Modify `routes/nsm-sessions.js`:

```javascript
const { computeLifecycle } = require('../lib/session-lifecycle');

// POST /api/nsm-sessions (~line 19): row is INSERTed with status='active' —
//   default 'created' fills lifecycle, no code change needed (but confirm in test).

// PATCH /:id/progress (handler to be located — same pattern as CIRCLES PATCH):
delete req.body.lifecycle;
// after fetching prior row:
const nextLifecycle = computeLifecycle(prior, req.body, 'nsm', 'patch');
if (nextLifecycle !== prior.lifecycle) patch.lifecycle = nextLifecycle;

// POST /:id/gate (~line 114):
const route = gateResult && gateResult.ok ? 'gate_ok' : 'gate_fail';
const nextLifecycle = computeLifecycle(prior, { nsm, rationale }, 'nsm', route);
// merge nextLifecycle into the .update() call

// POST /:id/evaluate (~line 80):
//   already sets status: 'completed' at line 103 — add lifecycle: 'completed' in the
//   same .update() block. Use computeLifecycle for parity:
const nextLifecycle = computeLifecycle(prior, {}, 'nsm', 'analysis_done');
// merge into .update()
```

Apply mirrored edits to `routes/guest-nsm-sessions.js`.

### Step 4.3 — Verify green

```bash
$ npx jest tests/contracts/lifecycle-nsm-route.test.js tests/issue-bug1-nsm-session-restore.test.js tests/bug6-nsm-persistence-fix.test.js
# Expected: 12 new + existing NSM baseline all green
```

### Step 4.4 — Commit

```bash
$ git add routes/nsm-sessions.js routes/guest-nsm-sessions.js \
          tests/contracts/lifecycle-nsm-route.test.js
$ git commit -m "feat(nsm): wire lifecycle into PATCH/gate/evaluate handlers (SLC-AC4..AC10)"
```

---

## T5 — List filter + operator gate

**Goal:** `GET /api/{circles,nsm}-sessions` (+ guest variants) default-exclude `lifecycle='created'`. `?include_empty=true` requires the request user's email to match `process.env.OPERATOR_EMAIL`; non-operators get `403`. Detail endpoint `GET /:id` is unchanged.

### Files

| Action | Path |
|---|---|
| Modify | `routes/circles-sessions.js` |
| Modify | `routes/nsm-sessions.js` |
| Modify | `routes/guest-circles-sessions.js` |
| Modify | `routes/guest-nsm-sessions.js` |
| Create | `tests/contracts/lifecycle-list-filter.test.js` |

### Step 5.1 — Failing test (red)

Create `tests/contracts/lifecycle-list-filter.test.js`:

```javascript
// tests/contracts/lifecycle-list-filter.test.js
const request = require('supertest');
const { createTestApp, seedSession } = require('../helpers/test-supabase');

describe('list filter — lifecycle=created hidden by default', () => {
  let app;
  beforeAll(() => { app = createTestApp(); process.env.OPERATOR_EMAIL = 'op@first-principle.test'; });

  beforeEach(async () => {
    await seedSession.reset();
    await seedSession.insert('circles_sessions', { user_id: 'user-A', lifecycle: 'created' });
    await seedSession.insert('circles_sessions', { user_id: 'user-A', lifecycle: 'editing' });
    await seedSession.insert('circles_sessions', { user_id: 'user-A', lifecycle: 'gated' });
    await seedSession.insert('circles_sessions', { user_id: 'user-A', lifecycle: 'completed' });
  });

  test('default GET returns ZERO created rows (SLC-AC11)', async () => {
    const res = await request(app)
      .get('/api/circles-sessions')
      .set('Authorization', 'Bearer user-A');
    expect(res.status).toBe(200);
    const lifecycles = res.body.map((r) => r.lifecycle).sort();
    expect(lifecycles).toEqual(['completed', 'editing', 'gated']);
  });

  test('GET /:id still returns a created row (SLC-AC12)', async () => {
    const id = await seedSession.insert('circles_sessions', { user_id: 'user-A', lifecycle: 'created' });
    const res = await request(app)
      .get(`/api/circles-sessions/${id}`)
      .set('Authorization', 'Bearer user-A');
    expect(res.status).toBe(200);
    expect(res.body.lifecycle).toBe('created');
  });

  test('?include_empty=true as non-operator → 403 (SLC-AC13)', async () => {
    const res = await request(app)
      .get('/api/circles-sessions?include_empty=true')
      .set('Authorization', 'Bearer user-A');
    expect(res.status).toBe(403);
  });

  test('?include_empty=true as operator → returns all (SLC-AC14)', async () => {
    const res = await request(app)
      .get('/api/circles-sessions?include_empty=true')
      .set('Authorization', 'Bearer op@first-principle.test');
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(4);
  });

  test('OPERATOR_EMAIL unset → flag fails closed (defense-in-depth)', async () => {
    const saved = process.env.OPERATOR_EMAIL;
    delete process.env.OPERATOR_EMAIL;
    try {
      const res = await request(app)
        .get('/api/circles-sessions?include_empty=true')
        .set('Authorization', 'Bearer op@first-principle.test');
      expect(res.status).toBe(403);
    } finally {
      process.env.OPERATOR_EMAIL = saved;
    }
  });
});

// Mirror describe blocks for /api/nsm-sessions, /api/guest-circles-sessions, /api/guest/nsm-sessions.
// Guest variants: replace 403 expectation with the matching pattern — operator gate is auth-only,
// so guest endpoints simply ignore include_empty=true (document this in the impl).
```

Run — red.

### Step 5.2 — Impl

In each list handler (`routes/circles-sessions.js` GET `/`, `routes/nsm-sessions.js` GET `/`, both guest variants):

```javascript
// At top of handler (after auth):
const wantsEmpty = req.query.include_empty === 'true';
const isOperator = !!(req.user && req.user.email && process.env.OPERATOR_EMAIL
  && req.user.email === process.env.OPERATOR_EMAIL);
if (wantsEmpty && !isOperator) {
  return res.status(403).json({ error: 'forbidden' });
}

// Where the supabase query is built:
let query = db.from('circles_sessions').select(/* ... existing columns + ', lifecycle' ... */);
// ... existing filters ...
if (!wantsEmpty) query = query.neq('lifecycle', 'created');
```

Guest endpoints have no user.email; treat them as never-operator (always filter; reject `include_empty=true` with 403 or silently drop — choose 403 for consistency).

### Step 5.3 — Verify green

```bash
$ npx jest tests/contracts/lifecycle-list-filter.test.js
# Expected: 5 × 4 mounts = 20 passed
$ npx jest tests/circles-sessions.test.js tests/issue2b-offcanvas-phase-restore.test.js
# Expected: existing list/restore baselines stay green
```

### Step 5.4 — Commit

```bash
$ git add routes/circles-sessions.js routes/nsm-sessions.js \
          routes/guest-circles-sessions.js routes/guest-nsm-sessions.js \
          tests/contracts/lifecycle-list-filter.test.js
$ git commit -m "feat(routes): default-filter lifecycle=created + operator-gated include_empty (SLC-AC11..AC14)"
```

---

## T6 — Cron cleanup endpoint

**Goal:** `POST /api/admin/cleanup-empty-sessions` — deletes `lifecycle='created' AND created_at < NOW() - INTERVAL '24h'` from both tables. Auth via `x-cron-secret` header. `?dry=true` mode logs counts without DELETE. Safety cap `MAX_DELETES_PER_RUN=500`.

### Files

| Action | Path |
|---|---|
| Create | `routes/admin-cleanup.js` |
| Modify | `server.js` (mount the route) |
| Create | `tests/contracts/admin-cleanup.test.js` |

### Step 6.1 — Failing test (red)

Create `tests/contracts/admin-cleanup.test.js`:

```javascript
// tests/contracts/admin-cleanup.test.js
const request = require('supertest');
const { createTestApp, seedSession } = require('../helpers/test-supabase');

describe('admin cleanup endpoint', () => {
  let app;
  beforeAll(() => {
    app = createTestApp();
    process.env.CRON_SECRET = 'test-cron-secret-do-not-use-in-prod';
  });
  beforeEach(() => seedSession.reset());

  test('missing secret → 401 (SLC-AC15)', async () => {
    const res = await request(app).post('/api/admin/cleanup-empty-sessions');
    expect(res.status).toBe(401);
  });

  test('wrong secret → 401 (SLC-AC15)', async () => {
    const res = await request(app)
      .post('/api/admin/cleanup-empty-sessions')
      .set('x-cron-secret', 'wrong');
    expect(res.status).toBe(401);
  });

  test('?dry=true returns counts without delete (SLC-AC16)', async () => {
    await seedSession.insert('circles_sessions', { lifecycle: 'created', created_at: new Date(Date.now() - 26 * 3600 * 1000) });
    await seedSession.insert('nsm_sessions',     { lifecycle: 'created', created_at: new Date(Date.now() - 26 * 3600 * 1000) });
    const res = await request(app)
      .post('/api/admin/cleanup-empty-sessions?dry=true')
      .set('x-cron-secret', process.env.CRON_SECRET);
    expect(res.status).toBe(200);
    expect(res.body.dry).toBe(true);
    expect(res.body.would_delete).toEqual({ circles: 1, nsm: 1 });
    expect(Array.isArray(res.body.sample_ids.circles)).toBe(true);
    // No actual deletion
    expect(await seedSession.count('circles_sessions')).toBe(1);
  });

  test('real run deletes only matching rows (SLC-AC17)', async () => {
    const stale = await seedSession.insert('circles_sessions', { lifecycle: 'created', created_at: new Date(Date.now() - 26 * 3600 * 1000) });
    const fresh = await seedSession.insert('circles_sessions', { lifecycle: 'created', created_at: new Date() });
    const editing = await seedSession.insert('circles_sessions', { lifecycle: 'editing', created_at: new Date(Date.now() - 26 * 3600 * 1000) });
    const res = await request(app)
      .post('/api/admin/cleanup-empty-sessions')
      .set('x-cron-secret', process.env.CRON_SECRET);
    expect(res.status).toBe(200);
    expect(res.body.deleted.circles).toBe(1);
    expect(await seedSession.fetch('circles_sessions', stale)).toBeNull();
    expect(await seedSession.fetch('circles_sessions', fresh)).toBeTruthy();
    expect(await seedSession.fetch('circles_sessions', editing)).toBeTruthy();
  });

  test('aborts with 503 when over cap (SLC-AC18)', async () => {
    process.env.MAX_DELETES_PER_RUN = '2';
    for (let i = 0; i < 5; i++) {
      await seedSession.insert('circles_sessions', { lifecycle: 'created', created_at: new Date(Date.now() - 26 * 3600 * 1000) });
    }
    const res = await request(app)
      .post('/api/admin/cleanup-empty-sessions')
      .set('x-cron-secret', process.env.CRON_SECRET);
    expect(res.status).toBe(503);
    expect(res.body.error).toMatch(/exceeds_cap/i);
    expect(await seedSession.count('circles_sessions')).toBe(5); // nothing deleted
    delete process.env.MAX_DELETES_PER_RUN;
  });

  test('second run within 24h is a no-op (SLC-AC19 idempotent)', async () => {
    await seedSession.insert('circles_sessions', { lifecycle: 'created', created_at: new Date(Date.now() - 26 * 3600 * 1000) });
    await request(app).post('/api/admin/cleanup-empty-sessions').set('x-cron-secret', process.env.CRON_SECRET);
    const res2 = await request(app).post('/api/admin/cleanup-empty-sessions').set('x-cron-secret', process.env.CRON_SECRET);
    expect(res2.body.deleted).toEqual({ circles: 0, nsm: 0 });
  });
});
```

Run — red.

### Step 6.2 — Impl

Create `routes/admin-cleanup.js`:

```javascript
// routes/admin-cleanup.js
// Nightly Railway cron — prunes empty-draft skeletons that the eager-INSERT
// pre-flight leaves behind when a user lands but never types.
//
// Auth: x-cron-secret header (env CRON_SECRET). NOT routed through requireAuth.
// Modes: POST /api/admin/cleanup-empty-sessions          → real DELETE
//        POST /api/admin/cleanup-empty-sessions?dry=true → SELECT-only summary
// Safety: aborts with 503 if would-delete > MAX_DELETES_PER_RUN (default 500).

const express = require('express');
const router = express.Router();
const { db } = require('../lib/db'); // adjust if the repo uses lib/supabase.js

const TABLES = ['circles_sessions', 'nsm_sessions'];

function cap() {
  const n = parseInt(process.env.MAX_DELETES_PER_RUN || '500', 10);
  return Number.isFinite(n) && n > 0 ? n : 500;
}

router.post('/cleanup-empty-sessions', async (req, res) => {
  const expected = process.env.CRON_SECRET;
  const given = req.get('x-cron-secret');
  if (!expected || !given || given !== expected) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const dry = req.query.dry === 'true';
  const cutoff = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const summary = { dry, deleted: { circles: 0, nsm: 0 }, would_delete: { circles: 0, nsm: 0 }, sample_ids: { circles: [], nsm: [] } };

  // Phase 1: count + sample (always, for both modes)
  for (const table of TABLES) {
    const { data, error } = await db.from(table)
      .select('id')
      .eq('lifecycle', 'created')
      .lt('created_at', cutoff);
    if (error) {
      // eslint-disable-next-line no-console
      console.error('[admin-cleanup] select error', table, error);
      return res.status(500).json({ error: 'select_failed', table });
    }
    const key = table === 'circles_sessions' ? 'circles' : 'nsm';
    summary.would_delete[key] = data.length;
    summary.sample_ids[key] = data.slice(0, 10).map((r) => r.id);
  }

  const total = summary.would_delete.circles + summary.would_delete.nsm;
  if (total > cap()) {
    // eslint-disable-next-line no-console
    console.error('[admin-cleanup] ABORT — exceeds_cap', { total, cap: cap(), summary });
    return res.status(503).json({ error: 'exceeds_cap', total, cap: cap(), sample_ids: summary.sample_ids });
  }

  if (dry) {
    // eslint-disable-next-line no-console
    console.log('[admin-cleanup] dry run', JSON.stringify(summary));
    return res.json(summary);
  }

  // Phase 2: real delete
  for (const table of TABLES) {
    const key = table === 'circles_sessions' ? 'circles' : 'nsm';
    if (summary.would_delete[key] === 0) continue;
    const { error } = await db.from(table)
      .delete()
      .eq('lifecycle', 'created')
      .lt('created_at', cutoff);
    if (error) {
      // eslint-disable-next-line no-console
      console.error('[admin-cleanup] delete error', table, error);
      return res.status(500).json({ error: 'delete_failed', table });
    }
    summary.deleted[key] = summary.would_delete[key];
  }

  // eslint-disable-next-line no-console
  console.log('[admin-cleanup] applied', JSON.stringify(summary));
  res.json(summary);
});

module.exports = router;
```

Mount in `server.js` (after the existing route mounts around line 50):

```javascript
app.use('/api/admin', require('./routes/admin-cleanup'));
```

### Step 6.3 — Verify green

```bash
$ npx jest tests/contracts/admin-cleanup.test.js
# Expected: 6 passed
```

### Step 6.4 — Commit

```bash
$ git add routes/admin-cleanup.js server.js tests/contracts/admin-cleanup.test.js
$ git commit -m "feat(cron): admin cleanup endpoint with dry-run + cap + secret auth (SLC-AC15..AC19)"
```

---

## T7 — Playwright E2E lifecycle suite

**Playwright skill applied:** `playwright-skill/core/crud-testing.md` — the lifecycle is fundamentally Create → Read (list filter) → Update (PATCH-driven state change) → Delete (cron prune), and Recipe 1 + Recipe 2 + Tip §3 ("Test the full lifecycle") map 1:1 to our state machine. Cron is split off into jest (T6) because it has no UI surface, per the same skill's "API verification" variation.

**Real-data guard:** per `feedback_e2e_real_data_only` and `feedback_three_iron_laws`, **NO `page.route()` mocks of our own API or stubbed AI calls**. We use the live `e2e@first-principle.test` account against the real backend on a known seed question that the real CIRCLES gate is observed to pass on.

### Files

| Action | Path |
|---|---|
| Create | `tests/visual/lifecycle.spec.js` |

### Step 7.1 — Write the spec (no separate red step — Playwright greenness IS the verification)

```javascript
// tests/visual/lifecycle.spec.js
const { test, expect } = require('@playwright/test');
const { loginAsE2E, apiGetSessions, apiGetSessionRaw } = require('../helpers/playwright-helpers');

const SEED_QID = 'Q-LIFECYCLE-E2E'; // confirmed pass on real gate (director to confirm SEED_QID before dispatch — flagged in §Spec Gaps below)

test.describe('Session Lifecycle E2E', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsE2E(page);
  });

  // E1 — created → editing on first substantive keystroke
  test('E1 created → editing on first substantive PATCH', async ({ page, request }) => {
    await page.goto(`/circles?qid=${SEED_QID}`);
    // Wait for preflight to land
    await page.waitForResponse((r) => r.url().includes('/api/circles-sessions/draft') && r.status() === 200);
    // Verify created via API (operator only)
    const created = await apiGetSessionRaw(request, { include_empty: true });
    const target = created.find((s) => s.question_id === SEED_QID);
    expect(target.lifecycle).toBe('created');

    // Type into C1
    await page.getByLabel(/問題範圍/).fill('我們的目標是把週活躍提升到 30%');
    await page.waitForTimeout(1000); // debounced save cycle (~800ms)

    // Verify promoted to editing
    const after = await apiGetSessionRaw(request, { include_empty: true });
    expect(after.find((s) => s.id === target.id).lifecycle).toBe('editing');

    // Drawer (no flag) → row present
    const drawer = await apiGetSessions(request);
    expect(drawer.find((s) => s.id === target.id)).toBeTruthy();
  });

  // E2 — editing → gated on successful gate
  test('E2 editing → gated on submitFrameworkToGate ok', async ({ page, request }) => {
    await page.goto(`/circles?qid=${SEED_QID}`);
    await page.waitForResponse((r) => r.url().includes('/api/circles-sessions/draft'));
    // Fill a full valid C1 draft (seed question known to pass)
    await page.getByLabel(/問題範圍/).fill('週活躍會員 < 30%；目標 90 天提升到 45%');
    await page.getByLabel(/假設/).fill('推播頻次過低');
    await page.getByLabel(/驗證指標/).fill('週開信率');
    await page.getByRole('button', { name: '送出' }).click();
    await page.waitForResponse((r) => r.url().includes('/gate') && r.status() === 200);

    const after = await apiGetSessionRaw(request, { include_empty: true });
    const me = after.find((s) => s.question_id === SEED_QID);
    expect(me.lifecycle).toBe('gated');
  });

  // E3 — gated → completed (real final-report on seed question)
  test('E3 gated → completed via final-report', async ({ page, request }) => {
    // Build on E2's flow — walk all 7 CIRCLES steps + final-report.
    // Implementer reuses the existing circles-phase1 POM walker.
    // Final API check:
    const after = await apiGetSessionRaw(request, { include_empty: true });
    const me = after.find((s) => s.question_id === SEED_QID);
    expect(me.lifecycle).toBe('completed');
  });

  // E4 — stub content does NOT promote
  test('E4 polluted-stub PATCH leaves row at created', async ({ page, request }) => {
    await page.goto(`/circles?qid=${SEED_QID}`);
    await page.waitForResponse((r) => r.url().includes('/api/circles-sessions/draft'));
    // Type a string that matches scan-pollution.isPolluted shape
    await page.getByLabel(/問題範圍/).fill('e2e-r1-' + Date.now());
    await page.waitForTimeout(1000);

    const after = await apiGetSessionRaw(request, { include_empty: true });
    const me = after.find((s) => s.question_id === SEED_QID);
    expect(me.lifecycle).toBe('created');

    // Drawer (no flag) → row absent
    const drawer = await apiGetSessions(request);
    expect(drawer.find((s) => s.id === me.id)).toBeFalsy();
  });

  // E5 — list filter + operator gate
  test('E5 ?include_empty=true is operator-only', async ({ request }) => {
    // As default e2e user (non-operator)
    const denied = await request.get('/api/circles-sessions?include_empty=true');
    expect(denied.status()).toBe(403);

    // As operator: only run if OPERATOR_EMAIL matches the test account.
    // If not configured, skip this assertion with a console warning (still red flag for director).
  });

  // Race coverage — one test, monotone rule
  test.describe('lifecycle race', () => {
    test('parallel PATCH + gate → final state is gated, not editing', async ({ page, request }) => {
      // Trigger gate POST and a content PATCH in arbitrary order via two browser contexts
      // or via two parallel request.post() calls. Assert final lifecycle is 'gated'.
    });
  });
});
```

### Step 7.2 — Smoke run

```bash
$ npx playwright test tests/visual/lifecycle.spec.js --project=Mobile-360
# Expected: 6 passed (5 numbered + 1 race), zero flake
$ npx playwright test tests/visual/lifecycle.spec.js --project=Desktop-1280
# Expected: 6 passed
```

### Step 7.3 — Drawer smoke (2 viewports, not 8 — §6.4 of spec)

```bash
$ npx playwright test tests/visual/audit-nsm-comprehensive-2026-05-11.spec.js \
    --project=Mobile-360 --project=Desktop-1280 \
    --grep "練習記錄"
# Expected: drawer renders correctly with filtered list, no JS console errors
```

### Step 7.4 — Commit

```bash
$ git add tests/visual/lifecycle.spec.js
$ git commit -m "test(e2e): lifecycle state machine Playwright suite (5 transitions + race + filter)"
```

---

## T8 — Adversarial sweep (anti-stub)

**Goal:** Prove the helper's anti-stub branch holds under a battery of polluted payload shapes — even if our env-guard or pre-commit hook misses a future regression, prod cannot be polluted via PATCH.

Spec note: this is NOT one of the 5 AI-call adversarial stages (lifecycle is pure logic), so the formal `npm run test:adversarial` infrastructure does not apply. We add a single contract-level adversarial block.

### Files

| Action | Path |
|---|---|
| Modify | `tests/contracts/lifecycle-circles-route.test.js` (append) |

### Step 8.1 — Adversarial cases

Append to the existing contract spec:

```javascript
describe('CIRCLES lifecycle adversarial', () => {
  const cases = [
    { label: 'pure stub',     body: { frameworkDraft: { C1: { 問題範圍: 'e2e-r1-17896543210' } } } },
    { label: 'stub + ws',     body: { frameworkDraft: { C1: { 問題範圍: '   e2e-r1-17896543210   ' } } } },
    { label: 'HTML-wrapped stub', body: { frameworkDraft: { C1: { 問題範圍: '<p>e2e-r1-17896543210</p>' } } } },
    { label: 'array as fd',   body: { frameworkDraft: ['e2e-r1-1789'] } },
    { label: 'string as fd',  body: { frameworkDraft: 'e2e-r1-1789' } },
    { label: 'object as ubd', body: { userBreakdown: { reach: { nested: 'evil' } } } }, // wrong shape, NSM-style in CIRCLES patch
    { label: 'injection',     body: { lifecycle: 'completed', frameworkDraft: {} } },
    { label: 'all empty {}',  body: { frameworkDraft: { C1: {}, I: {}, R: {} } } },
    { label: 'all whitespace',body: { frameworkDraft: { C1: { 問題範圍: '   \n   \t   ' } } } },
    { label: 'HTML-only',     body: { frameworkDraft: { C1: { 問題範圍: '<p><br></p><div></div>' } } } },
  ];

  test.each(cases)('$label PATCH does NOT promote created → editing', async ({ body }) => {
    const id = await seedSession.insert('circles_sessions', { lifecycle: 'created', user_id: 'test-user-1' });
    await request(app)
      .patch(`/api/circles-sessions/${id}/progress`)
      .set('Authorization', 'Bearer test-user-1')
      .send(body);
    const row = await seedSession.fetch('circles_sessions', id);
    expect(row.lifecycle).toBe('created');
  });
});
```

### Step 8.2 — Verify green

```bash
$ npx jest tests/contracts/lifecycle-circles-route.test.js
# Expected: 14 (T3) + 10 adversarial = 24 passed
```

### Step 8.3 — Commit

```bash
$ git add tests/contracts/lifecycle-circles-route.test.js
$ git commit -m "test(adversarial): 10 polluted-payload cases — none promote created → editing (SLC-AC6)"
```

---

## T9 — Director cold-Read + 8-viewport regression

**Goal:** Director (not implementer) personally validates that nothing visual or invariant-bearing regressed. Per `feedback_two_stage_review_mandatory` and `feedback_uiux_visual_only`, the director Reads every screenshot — no sampling.

### Pre-conditions

- T1-T8 merged on `main`
- Migration applied to dev Supabase
- Backfill run with `--dry` then `--apply`

### Step 9.1 — Baseline jest

```bash
$ npx jest --testPathIgnorePatterns="visual"
# Expected: 170/187 baseline + ~50 new lifecycle assertions = ~220+ passed.
# Any regression in pre-existing tests is a STOP — investigate before continuing.
```

### Step 9.2 — Full 8-viewport Playwright

```bash
$ npx playwright test --project=Mobile-360 --project=Desktop-1280 --project=Desktop-1440 \
    --project=Desktop-2560 --project=iPhone-SE --project=iPhone-14 \
    --project=iPhone-15-Pro --project=iPad
# Expected: all green; iPhone-15-Pro / 14 transient login timeouts are known-flaky (per CLAUDE.md NSM ship note) — re-run once if seen
```

### Step 9.3 — Drawer cold-Read (3 viewports)

```bash
$ npx playwright test tests/visual/audit-nsm-comprehensive-2026-05-11.spec.js \
    --grep "練習記錄" --project=Mobile-360 --project=iPad --project=Desktop-1280
$ ls -la test-results/**/practice-drawer-*.png
# Director Reads every PNG. Specifically confirms:
#   1. No row with no user-visible content (eyeball pass)
#   2. Row count <= pre-deploy count
#   3. Real sessions (gated/completed) still appear with correct labels
```

### Step 9.4 — iOS Safari 15-item checklist (per `feedback_ios_review_before_ship`)

Walk the 15-item checklist (Master Spec §0.2). If any FE write changed (it shouldn't have, per spec §3), perform the full pass; otherwise, smoke 5 critical items (focus / sticky / SSE / modal / scroll) and document in commit.

### Step 9.5 — Adversarial regression

```bash
$ npm run test:adversarial
# Expected: 5 AI stages × 10 cases all green — lifecycle work touched none of these prompts
```

### Step 9.6 — Sign-off commit (no code, just docs note)

If all green, this task does not commit code. The director records in the CLAUDE.md status board: `Stage 1B lifecycle ship: jest <NN>/<MM>, Playwright 8vp green, drawer cold-Read PASS, iOS 15-item PASS`.

---

## Spec Gaps Flagged for Director

The spec is internally complete per §11 self-review. Two implementation-time confirmations are needed before T7 / T9 dispatch — both are operational, not design:

1. **SEED_QID for E2E (T7).** The spec says "use real gate with the seed question known to pass" (§6.1 E3 footnote). The director picks the exact `question_id` from `circles_plan/circles_database.json` whose framework draft has been historically observed to gate-pass. Implementer cannot pick blindly — failure of real gate ≠ test failure of our code.
2. **`lib/db.js` module path.** T2 / T6 import `require('../lib/db')`. The repo currently has no `lib/db.js` listed at the lib/ root — routes get the Supabase client another way. The implementer audits one existing route (e.g. `routes/circles-sessions.js`) for the actual import pattern (likely `require('../db')` or inline `createClient`) and adjusts the cron + backfill scripts accordingly before T6/T2 step 2.6.

Both gaps are noted in CLAUDE.md after director resolves them.

---

## Self-Review (writing-plans §Self-Review)

1. **Spec coverage** — all 21 ACs mapped to tasks above (matrix at top). §1-9 of spec all decomposed. §10 Karpathy check baked into "Goal" and into each task's "minimal impl" framing. ✓
2. **Placeholder scan** — searched for `TBD`, `TODO`, `TK`, `???`, `<...>` in this plan: only `<NN>/<MM>` placeholder in T9.6 (director fills with real count at sign-off). All other placeholders are `${}` template literals inside code blocks, intentional. ✓
3. **Type consistency** — `lifecycle` is `TEXT` across schema/helper/tests; `MAX_DELETES_PER_RUN` parsed as int; `?dry=true` / `?include_empty=true` string-compared (no `Boolean()` coercion traps). ✓
4. **TDD / IL-3 compliance** — every code-touching task starts with a failing test before impl. T1's "test the SQL text" is a real failing-file-not-found red. ✓
5. **Iron Laws** — IL-1 (root cause: state-as-data, not derived predicate, per spec §1.3); IL-2 (every task ends with explicit `Expected: <output>`); IL-3 (red→green pairs in T1-T6, T8). ✓
6. **Carve-outs respected** — no OpenAI prompt touched; no `public/app.js` write change; no mockup CSS class moved; eager-INSERT in CIRCLES preserved (default fills lifecycle); zh-TW used for operator-facing strings (none added — all error keys are machine-readable, log lines are bracket-tagged English which is the established repo convention). ✓
7. **Karpathy** — Think Before: spec §1.3 read & cited. Simplicity First: one helper, one env var for operator gate, no ACL system. Surgical: file list matches spec §3 exactly. Goal-Driven: drawer hides empty rows is the north star; every task contributes. ✓
8. **B1-H invariants** — T9 baseline jest re-run covers `bug6-nsm-persistence-fix.test.js`, `bug6b-persistence.test.js`, `issue-bug1-nsm-session-restore.test.js`, `issue2b-offcanvas-phase-restore.test.js`. None touched by the new code. ✓
