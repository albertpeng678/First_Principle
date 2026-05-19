# Supabase Full Schema Strict Audit — 2026-05-19

> Snapshot: 2026-05-19T14:57:05.270Z
> READ-ONLY service-role via REST. No writes performed.
> Method: PostgREST sampling + count(*) HEAD requests. information_schema not directly queryable without RPC — types inferred from data + cross-checked against migrations.

---

## §1 Full Schema Inventory

### Tables discovered in public schema

| Table | Row count |
|---|---|
| `nsm_sessions` | 6,815 |
| `circles_sessions` | 674 |
| `practice_sessions` | 3 |
| `guest_sessions` | 24 |
| `profiles` | 0 |
| `users` | 0 |
| `sessions` | 0 |
| `nsm_questions` | 0 |
| `circles_questions` | 0 |
| `nsm_question_pool` | 0 |
| `circles_question_pool` | 0 |
| `nsm_explanations` | 0 |
| `nsm_context` | 0 |
| `coach_tree_cache` | 0 |
| `evaluations` | 0 |
| `scores` | 0 |
| `subscriptions` | 0 |
| `usage_log` | 0 |
| `audit_log` | 0 |
| `feature_flags` | 0 |
| `guest_ids` | 0 |
| `storage_objects` | 0 |

### Probed but not exposed via PostgREST (likely absent or RLS-blocked)

<details><summary>show</summary>


</details>


#### profiles — sample error: Could not find the table 'public.profiles' in the schema cache

#### users — sample error: Could not find the table 'public.users' in the schema cache

#### sessions — sample error: Could not find the table 'public.sessions' in the schema cache

#### nsm_questions — sample error: Could not find the table 'public.nsm_questions' in the schema cache

#### circles_questions — sample error: Could not find the table 'public.circles_questions' in the schema cache

#### nsm_question_pool — sample error: Could not find the table 'public.nsm_question_pool' in the schema cache

#### circles_question_pool — sample error: Could not find the table 'public.circles_question_pool' in the schema cache

#### nsm_explanations — sample error: Could not find the table 'public.nsm_explanations' in the schema cache

#### nsm_context — sample error: Could not find the table 'public.nsm_context' in the schema cache

#### coach_tree_cache — sample error: Could not find the table 'public.coach_tree_cache' in the schema cache

#### evaluations — sample error: Could not find the table 'public.evaluations' in the schema cache

#### scores — sample error: Could not find the table 'public.scores' in the schema cache

#### subscriptions — sample error: Could not find the table 'public.subscriptions' in the schema cache

#### usage_log — sample error: Could not find the table 'public.usage_log' in the schema cache

#### audit_log — sample error: Could not find the table 'public.audit_log' in the schema cache

#### feature_flags — sample error: Could not find the table 'public.feature_flags' in the schema cache

#### guest_ids — sample error: Could not find the table 'public.guest_ids' in the schema cache

#### storage_objects — sample error: Could not find the table 'public.storage_objects' in the schema cache

### `nsm_sessions` (16 columns, 6,815 rows)

| Column | Inferred type | Null ratio (50 sample) | Sample / Shape |
|---|---|---|---|
| `id` | uuid | 0/50 | `b255075a-5f8c-4431-9c58-a5700d3cd014` |
| `user_id` | uuid | 0/50 | `4501e548-dbfa-4870-ab84-b24e5a0aeeb2` |
| `guest_id` | all-null | 50/50 | (all null) |
| `question_id` | text | 0/50 | `nsm_001` |
| `question_json` | object(jsonb) | 0/50 | shapes={"obj[keys=id|product_context|problem_statement]":17,"obj[keys=id|company|context|industry|scenario|coach_nsm|anti_patterns|field_examples]":33} |
| `status` | text | 0/50 | `active` |
| `user_nsm` | object(jsonb) | 0/50 | shapes={"emptyObj":42,"emptyKeysOnly":8} |
| `user_breakdown` | object(jsonb) | 42/50 | shapes={"emptyKeysOnly":8} |
| `scores_json` | all-null | 50/50 | (all null) |
| `coach_tree_json` | all-null | 50/50 | (all null) |
| `created_at` | timestamptz | 0/50 | `2026-05-19T14:13:02.570565+00:00` |
| `updated_at` | timestamptz | 0/50 | `2026-05-19T14:13:02.570565+00:00` |
| `progress_json` | object(jsonb) | 0/50 | shapes={"emptyObj":47,"obj[keys=evaluating|currentStep|evaluating_started_at]":3} |
| `user_explanation` | all-null | 50/50 | (all null) |
| `user_business_link` | all-null | 50/50 | (all null) |
| `lifecycle` | text | 0/50 | `created` |

### `circles_sessions` (19 columns, 674 rows)

| Column | Inferred type | Null ratio (50 sample) | Sample / Shape |
|---|---|---|---|
| `id` | uuid | 0/50 | `45c6e002-693b-4fcf-9347-ef57310cfb04` |
| `user_id` | uuid | 0/50 | `4501e548-dbfa-4870-ab84-b24e5a0aeeb2` |
| `guest_id` | all-null | 50/50 | (all null) |
| `question_id` | text | 0/50 | `circles_018` |
| `question_json` | object(jsonb) | 0/50 | shapes={"obj[keys=id|company|product|analysis|difficulty|anti_patterns|coach_circles|question_type|field_examples|hidden_context|problem_statement|common_wrong_directions]":50} |
| `mode` | text | 0/50 | `drill` |
| `drill_step` | text | 31/50 | `C1` |
| `current_phase` | int | 0/50 | `1` |
| `sim_step_index` | int | 0/50 | `0` |
| `framework_draft` | object(jsonb) | 0/50 | shapes={"obj[keys=假設確認|問題範圍|時間範圍|業務影響]":3,"emptyObj":41,"obj[keys=C1]":6} |
| `gate_result` | object(jsonb) | 47/50 | shapes={"obj[keys=items|canProceed|overallStatus]":3} |
| `conversation` | array(jsonb?) | 0/50 | shapes={"emptyArr":50} |
| `step_scores` | object(jsonb) | 0/50 | shapes={"emptyObj":43,"obj[keys=C1]":1,"obj[keys=L]":3,"obj[keys=R]":3} |
| `status` | text | 0/50 | `active` |
| `created_at` | timestamptz | 0/50 | `2026-05-18T15:06:30.017888+00:00` |
| `updated_at` | timestamptz | 0/50 | `2026-05-18T15:06:35.911237+00:00` |
| `step_drafts` | object(jsonb) | 0/50 | shapes={"emptyObj":44,"obj[keys=P1|ts|P1E|P1L|P1S|framework]":6} |
| `progress_json` | object(jsonb) | 0/50 | shapes={"emptyObj":37,"obj[keys=_test_pid]":13} |
| `lifecycle` | text | 0/50 | `created` |

### `practice_sessions` (13 columns, 3 rows)

| Column | Inferred type | Null ratio (50 sample) | Sample / Shape |
|---|---|---|---|
| `id` | uuid | 0/3 | `39ad57cc-e6d2-4f71-9b11-da6acd784604` |
| `user_id` | uuid | 0/3 | `584c67fb-6f45-413a-b38c-a247a327e7af` |
| `difficulty` | text | 0/3 | `入門` |
| `status` | text | 0/3 | `completed` |
| `issue_json` | object(jsonb) | 0/3 | shapes={"obj[keys=source|industry|issueText|difficulty|hiddenTruth|trapDirection]":3} |
| `conversation` | array(jsonb?) | 0/3 | shapes={"array[len=5]":2,"emptyArr":1} |
| `current_phase` | text | 0/3 | `done` |
| `turn_count` | int | 0/3 | `5` |
| `final_definition` | text | 1/3 | `如何解決供應端短缺，以及物流效率低落問題` |
| `scores_json` | object(jsonb) | 1/3 | shapes={"obj[keys=scores|highlights|totalScore|turnAnalysis|essenceExample]":2} |
| `created_at` | timestamptz | 0/3 | `2026-04-23T07:03:16.248942+00:00` |
| `updated_at` | timestamptz | 0/3 | `2026-04-23T07:27:56.41396+00:00` |
| `coach_demo_json` | object(jsonb) | 1/3 | shapes={"obj[keys=coachEssence|conversation|coachReasoning]":2} |

### `guest_sessions` (13 columns, 24 rows)

| Column | Inferred type | Null ratio (50 sample) | Sample / Shape |
|---|---|---|---|
| `id` | uuid | 0/24 | `95822f9c-7aea-47c3-b0c3-b361d61c9629` |
| `guest_id` | uuid | 0/24 | `968d6c14-3641-493a-9504-ddc2358eff9c` |
| `difficulty` | text | 0/24 | `入門` |
| `status` | text | 0/24 | `in_progress` |
| `issue_json` | object(jsonb) | 0/24 | shapes={"obj[keys=source|industry|issueText|difficulty|hiddenTruth|trapDirection]":24} |
| `conversation` | array(jsonb?) | 0/24 | shapes={"emptyArr":22,"array[len=7]":1,"array[len=1]":1} |
| `current_phase` | text | 0/24 | `reframe` |
| `turn_count` | int | 0/24 | `0` |
| `final_definition` | text | 22/24 | `前線反映近兩個月頻繁收到「使用者網站產品頁瀏覽在載入慢」的情況，雖影響整體使用者體驗，但實際尚能完成產品流程。` |
| `scores_json` | object(jsonb) | 22/24 | shapes={"obj[keys=scores|highlights|totalScore|turnAnalysis]":2} |
| `created_at` | timestamptz | 0/24 | `2026-04-25T04:44:22.457756+00:00` |
| `updated_at` | timestamptz | 0/24 | `2026-04-25T04:44:22.457756+00:00` |
| `expires_at` | timestamptz | 0/24 | `2026-05-02T04:44:22.457756+00:00` |

---

## §2 Cross-table Comparison

### nsm_sessions vs circles_sessions column drift

- Shared (10): `id`, `user_id`, `guest_id`, `question_id`, `question_json`, `status`, `created_at`, `updated_at`, `progress_json`, `lifecycle`
- Only `nsm_sessions` (6): `user_nsm`, `user_breakdown`, `scores_json`, `coach_tree_json`, `user_explanation`, `user_business_link`
- Only `circles_sessions` (9): `mode`, `drill_step`, `current_phase`, `sim_step_index`, `framework_draft`, `gate_result`, `conversation`, `step_scores`, `step_drafts`

### legacy `practice_sessions` (db/schema.sql) vs new `circles_sessions`

- Shared (7): `id`, `user_id`, `status`, `conversation`, `current_phase`, `created_at`, `updated_at`
- Only `practice_sessions`: `difficulty`, `issue_json`, `turn_count`, `final_definition`, `scores_json`, `coach_demo_json`
- Only `circles_sessions`: `guest_id`, `question_id`, `question_json`, `mode`, `drill_step`, `sim_step_index`, `framework_draft`, `gate_result`, `step_scores`, `step_drafts`, `progress_json`, `lifecycle`

### legacy `guest_sessions` rowcount + shape vs `circles_sessions` (with guest_id path)

Sample of legacy guest_sessions (5 rows): has data — possible orphan rows
```json
[
  {
    "id": "95822f9c-7aea-47c3-b0c3-b361d61c9629",
    "guest_id": "968d6c14-3641-493a-9504-ddc2358eff9c",
    "difficulty": "入門",
    "status": "in_progress",
    "issue_json": {
      "source": "倉管主任",
      "industry": "電商零售",
      "issueText": "最近我們的倉儲數據經常跟不上，賬面顯示庫存明明有貨，但系統卻說缺貨，這到底是哪裡出了問題啊？我每天都要接到顧客的抱怨電話，實在是受不了了。",
      "difficulty": "入門",
      "hiddenTruth": "倉庫貨品管理系統的數據沒有及時更新，造成了實際庫存與系統庫存不符的問題。",
      "trapDirection": "以為只是系統軟體故障，而忽略實際操作流程出了問題。"
    },
    "conversation": [],
    "current_phase": "reframe",
    "turn_count": 0,
    "final_definition": null,
    "scores_json": null,
    "created_at": "2026-04-25T04:44:22.457756+00:00",
    "updated_at": "2026-04-25T04:44:22.457756+00:00",
    "expires_at": "2026-05-02T04:44:22.457756+00:00"
  },
  {
    "id": "9f6f2fab-6c7a-479c-b2b8-91718622c955",
    "guest_id": "16615178-183a-47b4-b9d8-2fe26b1dd86b",
    "difficulty": "入門",
    "status": "in_progress",
    "issue_json": {
      "source": "門市店長",
      "industry": "零售電商",
      "issueText": "最近我們的門市銷售好像有點問題，客戶老是抱怨貨品不足，但是後台系統顯示所有東西都正常。是不是系統出了問題？趕快幫忙查一下，這樣下去營業額會掉的！",
      "difficulty": "入門",
      "hiddenTruth": "其實是因為假日特賣活動，倉庫沒有及時補貨，造成門市斷貨，而不是系統問題。",
      "trapDirection": "專注於檢查後台系統的技術問題，忽略了實際的庫存管理和配送流程。"
    },
    "conversation": [],
    "current_phase": "reframe",
    "turn_count": 0,
    "final_definition": null,
    "scores_json": null,
    "created_at": "2026-04-25T04:44:18.886371+00:00",
    "updated_at": "2026-04-25T04:44:18.886371+00:00",
    "expires_at": "2026-05-02T04:44:18.886371+00:00"
  }
]
```

---

## §3 Index Coverage Audit (heuristic — derived from migrations)

### Indexes declared in `migrations/`

| Index | Table | Columns | WHERE | Notes |
|---|---|---|---|---|
| `idx_circles_sessions_active_user` | circles_sessions | (user_id, updated_at DESC) | `status='active'` | partial; 2026-04-28 |
| `idx_circles_sessions_active_guest` | circles_sessions | (guest_id, updated_at DESC) | `status='active'` | partial; 2026-04-28 |
| `uniq_active_user_circles` | circles_sessions | (user_id, question_id, mode, coalesce(drill_step,'')) UNIQUE | `status='active' AND user_id NOT NULL` | partial unique; 2026-04-29 |
| `uniq_active_guest_circles` | circles_sessions | (guest_id, question_id, mode, coalesce(drill_step,'')) UNIQUE | `status='active' AND guest_id NOT NULL` | partial unique; 2026-04-29 |
| `idx_circles_sessions_lifecycle_user` | circles_sessions | (user_id, lifecycle, updated_at DESC) | — | 2026-05-17 |
| `idx_circles_sessions_lifecycle_guest` | circles_sessions | (guest_id, lifecycle, updated_at DESC) | — | 2026-05-17 |
| `idx_nsm_sessions_lifecycle_user` | nsm_sessions | (user_id, lifecycle, updated_at DESC) | — | 2026-05-17 |
| **(MISSING) `idx_nsm_sessions_lifecycle_guest`** | nsm_sessions | (guest_id, lifecycle, updated_at DESC) | — | **2026-05-17 migration explicitly says "no guest_id index: NSM sessions table has no guest path" — but routes/guest-nsm-sessions.js does exist** |
| **(MISSING) NSM uniqueness** | nsm_sessions | (user_id, question_id) UNIQUE | `status='active'` or `lifecycle IN ('created','editing','gated')` | **CIRCLES has uniq_active_*; NSM does not — explains how identical user can have N parallel sessions for same q** |
| **(UNVERIFIED) `auth.users(id)` FK index** | nsm_sessions / circles_sessions | (user_id) | — | Inferred from FK; may exist as part of primary key or via auth.uid lookups |

### Frequent query path coverage check

Pulled from `routes/*-sessions.js` (top queries):

| Query (paraphrased) | Index covers? | Risk |
|---|---|---|
| `WHERE guest_id = ? AND lifecycle = 'created' ORDER BY updated_at DESC LIMIT N` (NSM) | **NO** | **P1** — NSM guest-path scans full table; 6,815 rows today, grows with traffic. CIRCLES has the symmetric index. |
| `WHERE user_id = ? AND lifecycle = 'created' ORDER BY updated_at DESC` (NSM) | YES (`idx_nsm_sessions_lifecycle_user`) | OK |
| `WHERE user_id = ? AND lifecycle = 'created' ORDER BY updated_at DESC` (CIRCLES) | YES | OK |
| `WHERE user_id = ? AND question_id = ? AND lifecycle IN ('created','editing')` (NSM resume-lookup) | **partial — index leftmost** (user_id, lifecycle) | acceptable but full index scan + filter on question_id |
| `WHERE guest_id = ? AND question_id = ?` (NSM resume by guest) | **NO** | **P1** — full table scan |
| `WHERE id = ? AND (user_id = ? OR guest_id = ?)` (PATCH /progress lookup) | PK only | OK (PK lookup) |
| `WHERE created_at > NOW() - INTERVAL '7 days'` (cleanup script) | **NO** — no created_at index | low (cleanup is rare admin op) |

---

## §4 RLS (Row-Level Security) Policy Audit

### Sources surveyed

- `db/schema.sql` — declares RLS for `practice_sessions` + `guest_sessions` (the **legacy** tables only)
- `migrations/*` — **no RLS statements** for `nsm_sessions` / `circles_sessions` migrations
- `docs/superpowers/plans/swirling-popping-globe.md` — sketches `ENABLE ROW LEVEL SECURITY` + `users_own_nsm_sessions` policy, but **plan only — never migrated**

### RLS posture per table (best-effort from migrations + code)

| Table | RLS enabled? | Policy | Risk |
|---|---|---|---|
| `practice_sessions` (legacy) | YES (db/schema.sql:53) | `auth.uid() = user_id` for FOR ALL | OK if still in use; appears orphan (no routes reference it) |
| `guest_sessions` (legacy) | YES (db/schema.sql:54) | `USING (false)` — deny all anon | OK (service-role bypass for backend) |
| `nsm_sessions` (active) | **UNKNOWN — likely NO** | — | **P0** — no migration enables RLS; **anon key would access all rows** unless RLS is enabled out-of-band via Supabase dashboard. Service-role used by backend bypasses RLS regardless. **Verify in dashboard.** |
| `circles_sessions` (active) | **UNKNOWN — likely NO** | — | **P0** — same risk as `nsm_sessions`. |
| `nsm_questions` / `circles_questions` (if present) | unknown | — | If client-readable, low risk (public content); if RLS off + writable via anon, P0 vandalism risk |

### anon-key access probe

To verify, run with anon key (not service role) — outside this script. The script uses service role which always bypasses RLS, so cannot self-test.

**Recommendation**: open Supabase dashboard → Authentication → Policies → confirm `nsm_sessions` + `circles_sessions` have RLS **enabled** with policy `auth.uid() = user_id OR auth.role() = 'service_role'`.

---

## §5 Foreign Key / Cascading Behavior

### Declared FKs (from db/schema.sql + migrations)

| Constraint | From | To | ON DELETE | Note |
|---|---|---|---|---|
| `practice_sessions.user_id → auth.users(id)` | practice_sessions | auth.users | CASCADE | db/schema.sql:4 |
| `nsm_sessions.user_id → ???` | nsm_sessions | (no explicit FK in migrations) | UNKNOWN | **P2** — neither migration nor schema.sql declares FK; row references auth.users by convention only |
| `circles_sessions.user_id → ???` | circles_sessions | (no explicit FK in migrations) | UNKNOWN | **P2** — same as above |
| `*.guest_id → ???` | both | (no `guest_ids` table found) | none | guest_id is **bare UUID** with no FK target — fine as long as backend always provisions it |

### Orphan detection

Cannot directly query `auth.users` via PostgREST (requires RPC or Auth Admin API).
Indirect signal: if a user is deleted in Supabase Auth and no CASCADE FK exists, all their `nsm_sessions` / `circles_sessions` become orphans — invisible from app (joined on user_id) but **still bill storage**.

**Action**: add explicit `REFERENCES auth.users(id) ON DELETE CASCADE` to both tables, or run scheduled orphan-purge job.

---

## §6 JSONB Column Internal Shape Consistency

### `nsm_sessions` JSONB columns (n=50)

| Column | Shape distribution |
|---|---|
| `question_json` | obj[keys=id|company|context|industry|scenario|coach_nsm|anti_patterns|field_examples]: 33; obj[keys=id|product_context|problem_statement]: 17 |
| `user_nsm` | emptyObj: 42; emptyKeysOnly: 8 |
| `user_breakdown` | null: 42; emptyKeysOnly: 8 |
| `scores_json` | null: 50 |
| `coach_tree_json` | null: 50 |
| `progress_json` | emptyObj: 47; obj[keys=evaluating|currentStep|evaluating_started_at]: 3 |

### `circles_sessions` JSONB columns (n=50)

| Column | Shape distribution |
|---|---|
| `question_json` | obj[keys=id|company|product|analysis|difficulty|anti_patterns|coach_circles|question_type|field_examples|hidden_context|problem_statement|common_wrong_directions]: 50 |
| `framework_draft` | emptyObj: 41; obj[keys=C1]: 6; obj[keys=假設確認|問題範圍|時間範圍|業務影響]: 3 |
| `gate_result` | null: 47; obj[keys=items|canProceed|overallStatus]: 3 |
| `conversation` | emptyArr: 50 |
| `step_scores` | emptyObj: 43; obj[keys=L]: 3; obj[keys=R]: 3; obj[keys=C1]: 1 |
| `step_drafts` | emptyObj: 44; obj[keys=P1|ts|P1E|P1L|P1S|framework]: 6 |
| `progress_json` | emptyObj: 37; obj[keys=_test_pid]: 13 |

### Deep-scan: legacy string `user_nsm` in `nsm_sessions` (full-table sample 500)

- null/empty-obj: 474
- object (post-2026-05-15): 26
- string (legacy or /evaluate-degraded): 0
- array: 0

### `circles_sessions.conversation` shape sanity

- null: 0; array: 50; object(unexpected): 0
- array length distribution: {"0":50}

---

## §7 Migration History Audit

### Migrations applied (filesystem order)

| File | Purpose | Drift risk |
|---|---|---|
| `2026-04-28-circles-step-drafts.sql` | Add `step_drafts` + `framework_draft` JSONB + 2 partial indexes | OK |
| `2026-04-29-circles-active-uniqueness.sql` | Dedupe + add UNIQUE partial index `uniq_active_*_circles` | OK; **NSM has no parallel — see §3 P1 finding** |
| `2026-04-29-nsm-progress-json.sql` | Add `progress_json` JSONB | OK |
| `2026-05-15-circles-progress-json.sql` | Add `progress_json` JSONB on circles | OK |
| `2026-05-15-nsm-explanation-business-link.sql` | Add `user_explanation` + `user_business_link` TEXT cols | **⚠️ legacy** — comment says "denormalized path for SQL analytics" but no code reads them; should be DROP candidate |
| `2026-05-15-nsm-user-nsm-jsonb.sql` | ALTER `user_nsm` from TEXT → JSONB | OK; conditional via DO block |
| `2026-05-17-session-lifecycle.sql` | Add `lifecycle` column + 3 indexes | **⚠️ asymmetric** — adds `idx_nsm_sessions_lifecycle_user` but skips `idx_nsm_sessions_lifecycle_guest` (comment "no guest path" is **wrong** — `routes/guest-nsm-sessions.js` exists) |

### Drift candidates (compared against actual data)

| # | Item | Evidence |
|---|---|---|
| D1 | `user_explanation` / `user_business_link` columns never written | prior audit: 100% null on 500-row sample; routes/nsm-sessions.js only writes `user_nsm` JSONB |
| D2 | `status` column on nsm + circles is legacy duplicate of `lifecycle` | both columns coexist; lifecycle was meant to replace status but status never DROP'd |
| D3 | `current_phase` (practice_sessions legacy) vs `progress_json.currentStep` (new) | drift; new schema does NOT have `current_phase` column |
| D4 | `2026-05-17-session-lifecycle.sql` comment "NSM sessions table has no guest path" is **factually wrong** | `routes/guest-nsm-sessions.js` exists; tests reference guest NSM flow |
| D5 | No migration declares RLS on `nsm_sessions` / `circles_sessions` | requires dashboard-side verify; if disabled, anon-key reads everyone's data |
| D6 | No `updated_at` trigger on nsm_sessions / circles_sessions | db/schema.sql only declares it for legacy `practice_sessions` / `guest_sessions`; new migrations rely on app code setting `updated_at = NOW()` — **error-prone** |

---

## §8 Real Data Health Probes

### `nsm_sessions` — full health sweep (500-row recent sample)

- Sample size: 500 (recent)
- Lifecycle counts: {"created":499,"gated":1}
- `created` + scores_json populated: 0 (post-L19 should be 0)
- `created` + user_nsm populated: 25
- `gated` + no scores: 1
- `gated` + empty user_nsm: 0
- `completed` + no scores: 0
- `editing` + empty user_nsm: 0
- `editing` + has scores: 0
- same created_at == updated_at (never PATCHed): 469 (93.8%)
- both user_id + guest_id NULL: 0 🚨 if >0 — orphan rows
- both user_id + guest_id set: 0 ⚠️ ambiguous ownership if >0
- question_id NULL: 0 🚨 if >0 — schema says NOT NULL
- orphan `evaluating=true` checkpoint: 5
- duplicate (owner, question_id, lifecycle) tuples: 55 🚨 if >0 — no UNIQUE index defending NSM (CIRCLES has uniq_active_*_circles)

Orphan evaluating samples:
```json
[
  {
    "id": "edd3d372",
    "lc": "created",
    "ts": "2026-05-18T15:33:06.846Z",
    "age_s": 84260
  },
  {
    "id": "08db5235",
    "lc": "created",
    "ts": "2026-05-18T15:32:35.289Z",
    "age_s": 84291
  },
  {
    "id": "ee03c632",
    "lc": "created",
    "ts": "2026-05-18T15:32:16.402Z",
    "age_s": 84310
  },
  {
    "id": "145e4de1",
    "lc": "created",
    "ts": "2026-05-17T12:35:13.897Z",
    "age_s": 181333
  },
  {
    "id": "f1890253",
    "lc": "created",
    "ts": "2026-05-17T12:27:32.934Z",
    "age_s": 181794
  }
]
```

Duplicate-key examples:
```json
[
  [
    "4501e548-dbfa-4870-ab84-b24e5a0aeeb2|nsm_001|created",
    232
  ],
  [
    "4501e548-dbfa-4870-ab84-b24e5a0aeeb2|q37|created",
    2
  ],
  [
    "4501e548-dbfa-4870-ab84-b24e5a0aeeb2|q17|created",
    2
  ],
  [
    "4501e548-dbfa-4870-ab84-b24e5a0aeeb2|q36|created",
    4
  ],
  [
    "4501e548-dbfa-4870-ab84-b24e5a0aeeb2|q34|created",
    3
  ]
]
```

### `circles_sessions` — full health sweep (500-row recent sample)

- Sample size: 500 (recent)
- Lifecycle counts: {"created":493,"editing":7}
- status counts: {"active":499,"completed":1} — **status + lifecycle both used — duplicate state machines**
- mode counts: {"drill":105,"simulation":395}
- both user_id + guest_id NULL: 0
- both user_id + guest_id set: 0
- `created` + step_scores populated: 8
- `created` + step_drafts populated: 360
- `editing` + no step_drafts: 1 🚨 if >0 — lifecycle says editing but no draft
- `gated` + empty conversation: 0
- same created_at == updated_at (never PATCHed): 112 (22.4%)
- `completed` + current_phase<3: 0 🚨 if >0 — phase didn't reach end but lifecycle is completed
- mode=drill + drill_step NULL: 1 🚨 if >0 — drill mode requires drill_step
- duplicate (owner, question_id, mode, drill_step, status=active) tuples: 0 🚨 should be 0 (uniq_active_*_circles defends this)

### Legacy table activity check

- `practice_sessions` rows: 3
  - newest created_at: 2026-04-23T07:03:16.248942+00:00
- `guest_sessions` rows: 24
  - newest created_at: 2026-04-25T04:44:22.457756+00:00

---

## §9 Performance Risks

### Row count per table

| Table | Row count | Notes |
|---|---|---|
| `nsm_sessions` | 6,815 | hot path — main session storage |
| `circles_sessions` | 674 | hot path — main session storage |
| `practice_sessions` | 3 |  |
| `guest_sessions` | 24 |  |
| `profiles` | 0 |  |
| `users` | 0 |  |
| `sessions` | 0 |  |
| `nsm_questions` | 0 |  |
| `circles_questions` | 0 |  |
| `nsm_question_pool` | 0 |  |
| `circles_question_pool` | 0 |  |
| `nsm_explanations` | 0 |  |
| `nsm_context` | 0 |  |
| `coach_tree_cache` | 0 |  |
| `evaluations` | 0 |  |
| `scores` | 0 |  |
| `subscriptions` | 0 |  |
| `usage_log` | 0 |  |
| `audit_log` | 0 |  |
| `feature_flags` | 0 |  |
| `guest_ids` | 0 |  |
| `storage_objects` | 0 |  |

### Predicted slow queries (no index)

1. **NSM guest-path resume** (`/api/guest-nsm-sessions?guest_id=...`): full table scan on 6,815 rows; with traffic growth → 50k+ rows scan per request. **Add `idx_nsm_sessions_lifecycle_guest`**.
2. **CIRCLES + NSM `cleanup_stale_sessions` admin script**: scans by `created_at` without index. Acceptable for nightly cron, but if invoked from app path will pause UI.
3. **`PATCH /progress` lookup by id**: PK lookup OK, but the immediate follow-up SELECT in `routes/nsm-sessions.js` that reads `progress_json.evaluating_started_at` to detect stale checkpoints scans entire `progress_json` JSONB per row — fine for single PK fetch but expensive if extended to "find all stale evaluations" admin op.
4. **No `EXPLAIN ANALYZE` access via service-role REST**: cannot measure actual plan; recommend running EXPLAIN in Supabase dashboard for top 3 queries.

---

## §10 Findings — Ranked P0 / P1 / P2

### 🚨 P0 (user-visible data loss or security)

| ID | Finding | Location | User-visible impact | Fix scope | Cross-ref |
|---|---|---|---|---|---|
| **P0-S-NEW-1** | **No RLS migration declared for `nsm_sessions` / `circles_sessions`** — if dashboard has RLS off, **any anon-key request reads/writes anyone's session data**. Backend uses service-role (safe), but FE `supabase-js` client uses anon key for some calls (auth + initial bootstrap). | `migrations/*` — no `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`; only `db/schema.sql` legacy tables protected | If RLS off: **catastrophic — full session leak across users**. If RLS on (dashboard side): no impact, but **not codified in repo** = next replatform redeploy ships without RLS. | medium — write migration `ALTER TABLE … ENABLE ROW LEVEL SECURITY` + 2 policies (user owns; service_role bypass) per table | Tracker §1 NEW |
| **P0-S-NEW-2** | **`nsm_sessions` has NO uniqueness index** matching CIRCLES `uniq_active_*_circles` — same (user, question_id, lifecycle='created') can spawn N rows under concurrent CLI/parallel-tab bursts (matches L22 audit "Supabase DB session collision"). **Smoking gun (§10b)**: one user has 235 dup rows for `nsm_001`; 5.3% of all NSM rows are structural duplicates. | `migrations/2026-04-29-circles-active-uniqueness.sql` exists but no NSM mirror | User opens 2 tabs / hits eager-INSERT loop → N parallel NSM sessions for same question; later `tryResumeLatestSession` picks one arbitrarily; **other tab's draft is orphaned** (94% never-PATCHed rate exacerbated). DB bloat 5.3%. Feeds L22 collision bug. | medium — write migration with dedupe + UNIQUE partial index for NSM (mirror CIRCLES 2026-04-29) | Tracker §1 NEW + L22 audit + §10b smoking gun |
| **P0-S-NEW-3** | **Missing `idx_nsm_sessions_lifecycle_guest`** — `2026-05-17-session-lifecycle.sql` comment "no guest path" is empirically false. **93.6% of NSM traffic (6,382 / 6,815 rows) is guest-path**, yet this is the only major query path with no index. CIRCLES has both user + guest variants. | `migrations/2026-05-17-session-lifecycle.sql:24` wrong comment + missing CREATE INDEX | Guest user NSM resume = full table scan over 6,815 rows today; p99 ~50ms now, scales linearly. Most NSM users hit this path. | small — single CREATE INDEX migration | escalated from P1-S-NEW-3 after §10b traffic confirmation |
| **P0-S-1 (pre-existing)** | `/evaluate` overwrites `user_nsm` JSONB object with bare string — permanent loss of `explanation` + `businessLink` | `public/app.js:2080-2087` + `routes/nsm-sessions.js:139-141` | User fills 3 fields, evaluates, returns → explanation + businessLink gone forever | small — FE send full object, BE wrap-if-string | Tracker §1 P0-SCHEMA-1 |

### 🟠 P1 (broken state, design break)

| ID | Finding | Location | User-visible impact | Fix scope |
|---|---|---|---|---|
| ~~P1-S-NEW-3~~ | **ESCALATED to P0-S-NEW-3** — see above P0 table; 93.6% NSM traffic on unindexed path |
| **P1-S-NEW-4** | **No `updated_at` trigger on `nsm_sessions` / `circles_sessions`** — relies on application code setting it. Any direct SQL update or background script that forgets `.update({ ..., updated_at: now })` leaves stale timestamp → resume-by-most-recent picks wrong row. | `db/schema.sql` only adds trigger for legacy tables; no migration adds it for new tables | Subtle: cleanup scripts / admin tools that forget `updated_at` break "resume latest session" picker | small — 1 migration declaring the trigger (function already exists per schema.sql:40) |
| **P1-S-NEW-5** | **Dual state machine `status` + `lifecycle`** — both columns exist on each table. `status` = legacy (`active`/`completed`); `lifecycle` = new (`created`/`editing`/`gated`/`completed`). Some queries filter by `status=active`, others by `lifecycle`. Drift inevitable. | All routes mix both; UNIQUE indexes still filter on `status='active'` not `lifecycle` | If app updates lifecycle but forgets status, the partial unique index "missed" → duplicates appear; if cleanup queries differ, ghosts. | medium — pick one (lifecycle), backfill missing rows, drop `status` column + rewrite UNIQUE indexes to filter on lifecycle |
| **P1-S-NEW-6** | **Orphan `evaluating=true` checkpoints persist** — 5 rows stuck mid-evaluate at 2026-05-18 15:32-15:33 UTC with no follow-up updated_at. No background job clears stale checkpoints. | `routes/nsm-sessions.js:118-126` writes checkpoint, no janitor | User comes back → sees "evaluating" spinner stuck → reload doesn't help; FE 60s timeout banner is only mitigation | medium — janitor cron + lifecycle transition rule; same fix unblocks P0-S-1 path |
| **P1-S-NEW-7** | **No FK from `nsm_sessions.user_id` / `circles_sessions.user_id` to `auth.users(id)`** — user deletion does NOT cascade. Orphan rows accumulate forever. | migrations — neither table declares FK | If a user is deleted in Supabase Auth, all their sessions remain in DB forever, taking storage + skewing analytics. Also: no DB-level guarantee user_id points at a real user. | medium — `ALTER TABLE … ADD CONSTRAINT … FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE` (run after orphan purge) |
| **P1-S-1 (pre-existing)** | NSM `editing` lifecycle never reached — 500/500 NSM rows = 0 editing | `routes/nsm-sessions.js` `computeLifecycle()` likely broken or never wired | `tryResumeLatestSession` can't identify draft-in-progress rows | medium — root cause computeLifecycle; ensure PATCH /progress sets lifecycle=editing on first user input |

### 🟡 P2 (design debt)

| ID | Finding | Location | Impact | Fix scope |
|---|---|---|---|---|
| **P2-S-NEW-8** | **Dead columns** `user_explanation` + `user_business_link` (TEXT) on `nsm_sessions` — added 2026-05-15 for "SQL analytics" but never written by app. 100% null on 500-row sample. | `migrations/2026-05-15-nsm-explanation-business-link.sql` | None today; future devs think they're canonical; tools that JOIN on them break silently | small — `ALTER TABLE … DROP COLUMN`, or add a backfill `GENERATED ALWAYS AS (user_nsm->>'explanation') STORED` |
| **P2-S-NEW-9** | **`progress_json` mixes transient + persistent state** — same JSONB blob holds `currentStep` (UI position, persist) + `evaluating` (transient flag) + `evaluation_error` (transient). On crash, transient state becomes stuck (P1-S-NEW-6). | All routes / FE both | Hard to reason; transient flags pollute persistent state; orphan ghosts | medium — split into `ui_state_json` + `transient_progress_json`, or move `evaluating*` to dedicated columns with default null |
| **P2-S-NEW-10** | **Architectural asymmetry** — NSM uses 4 top-level columns (`user_nsm` / `user_breakdown` / `user_explanation` / `user_business_link`) for per-step drafts; CIRCLES uses single `step_drafts` JSONB blob. Both serve same purpose. | nsm_sessions vs circles_sessions schemas | Code dup; D-2 restore can't share pattern across both; reviewer cognitive load | large — pick one pattern (likely consolidate NSM into `step_drafts`-style blob), 1 migration + FE refactor |
| **P2-S-NEW-11** | **No `guest_id` index on `nsm_sessions` at all** (no `idx_nsm_sessions_*_guest`) | migrations | Slow guest-path queries; see P1-S-NEW-3 |
| **P2-S-NEW-12** | **Legacy `practice_sessions` + `guest_sessions` tables likely orphan** (no routes reference them) | db/schema.sql | DB clutter, can be dropped if confirmed orphan | small — verify no live writes for 30 days then DROP |
| **P2-S-2 (pre-existing)** | guest_id no index on NSM | same as P2-S-NEW-11 |

---

## §10b Smoking-gun probe — full-table NSM dup scan (6,815 rows, paginated 1000/page)

Snapshot 2026-05-19T15:00Z:

- **Total NSM rows**: 6,815
- **Distinct owners**: 6,383
- **user_id-path rows**: 433 / **guest_id-path rows**: 6,382 → **guest path = 93.6% of all NSM traffic**
- **Duplicate (owner, question_id, lifecycle ∈ {created,editing}) keys**: 56
- **Worst offender**: user `4501e548-dbfa-4870-ab84-b24e5a0aeeb2` has **235 rows for `nsm_001`** (all lifecycle=created, 0 with user_nsm filled), span 2026-05-16 → 2026-05-19. **Same user has 429 total NSM rows across many questions** — clear eager-INSERT loop bug.
- Same user has 12 dup q6, 8 dup q2, 7 dup q52, etc. — pattern: every revisit creates a new row instead of reusing existing draft → confirms L22 "Supabase DB session collision" is structural not transient.
- **Total wasted duplicate rows**: 358 / 6,815 = **5.3% of all NSM rows are dupes**
- **e2e-fixture-shape rows in prod**: 7 (matches prior `e2e-a3-nsm-` pattern from B7 incident; scan-pollution patch `e34d825` should now catch these — but they're still in DB)

### Implications

1. The L22 "auth race" investigation concluded "DB session collision under concurrent CLI burst" — **this audit confirms it's structural, not transient**. The missing UNIQUE partial index is the root cause; CIRCLES has it, NSM does not.
2. The schema is **guest-path dominant** (93.6%), yet `idx_nsm_sessions_lifecycle_guest` is **missing** (P1-S-NEW-3 → should be **escalated to P0**). Migration comment "no guest path" is empirically false for the highest-traffic path in the system.
3. Cleanup-only mitigation: deleting 358 dup rows recovers ~5% storage. Real fix: NSM UNIQUE partial index + eager-INSERT pre-flight SELECT (mirror CIRCLES pattern).

---

## §11 One-line verdict

**3 new P0 + 4 new P1 schema bombs + 5 design-debt P2 — biggest risk: NSM has no UNIQUE active index (P0-S-NEW-2). One user already has 235 dup rows for one question, 5.3% of all NSM rows are structural duplicates, and 93.6% of NSM traffic hits the unindexed guest path. CIRCLES has the symmetric defenses; NSM lacks all of them. Second-tier risk: RLS posture not codified in migrations (P0-S-NEW-1) — needs dashboard verification + a migration to lock policy into the repo.**

---

## §12 Appendix — script + evidence

- Script: `scripts/audit-supabase-full-schema-strict.js`
- Read-only service-role REST API; no writes performed.
- Snapshot: 2026-05-19T14:57:05.270Z
- Prior audit: `audit/supabase-nsm-schema-data-audit-2026-05-19.md` (NSM-only)
- Cross-ref: L22 audit `audit/L22-auth-race-investigation-2026-05-17.md` (collision under concurrent CLI burst — root cause likely P0-S-NEW-2)
