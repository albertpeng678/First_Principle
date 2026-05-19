# C-Drift-4 Plan — 功能補 + STANDING + maint debt (4 fixes)

> Atomic commit 4/4 of Phase 2 NSM↔CIRCLES drift Wave 2.
> Source: `audit/nsm-circles-drift-scan-2026-05-19.md` (D-12 + D-13 + §5 STANDING + row 26-30 + row 31).
> Tracker: `audit/e2e-master-tracker.md` §2 「NSM↔CIRCLES drift scan results」 + §3 COMMON design issue.
>
> **Largest commit** — combines functional gap fix (NSM recent rail), latent bug pre-emption, NEW STANDING memory, and 2 maintainability debts. Sequenced LAST so D-7 / D-11 helpers from C-Drift-3 are available for reuse.
>
> **Karpathy guardrails**:
> - §4.1 Think Before — D-12 NSM recent rail requires NEW design + mockup work; do NOT just copy CIRCLES blindly (NSM home layout has 3-col rail at 200/1fr/220 per mockup 06; recent rail belongs in right column).
> - §4.2 Simplicity First — hint modal 4 shell → 1 = significant refactor; only ship if mockup proves shells are identical. Else defer to C-Drift-5.
> - §4.3 Surgical Changes — each sub-fix isolated; STANDING memory write is a 1-file add with no production touch.
> - §4.4 Goal-Driven — D-12 verifiable: NSM home shows recent NSM practices; D-13 verifiable: delete NSM session → home rail removes it next render.

---

## §1 Scope

| # | Audit ref | App.js anchor | Effort | User-visible goal |
|---|---|---|---|---|
| 1 | D-12 (P1 gap) | `app.js:6297-6299` `renderNSMRecentRail` empty stub + new `nsmRecentSessions` AppState + new `loadNsmHistoryForRail` | L | NSM home 右側 desktop rail 顯示近期 NSM 練習，點擊 → restore (parallel CIRCLES home recent rail) |
| 2 | D-13 (P2 latent) | `app.js:8697` `_doOffcanvasDelete` cache invalidate | XS | 刪 NSM session → home rail next render 不再顯示 (latent — only matters AFTER D-12 lands) |
| 3 | STANDING | NEW memory file in `~/.claude/projects/.../memory/` | XS | 立 `feedback_nsm_circles_shared_helper_mandate.md` per audit §5 |
| 4 | Row 26-30 unify | `app.js:3959` + `4124` + `4231` + `4373` — 4 hint modal shells | L | (maint debt) — Optional. **Recommend defer to C-Drift-5** |
| 5 | Row 31 progress class align | `app.js:4511` + `6515` + `6226` — 3 progress bar functions | S | (maint debt) — class naming consistent across 3 progress bars |

**Tracker cross-ref**: §2 + §3 — closes both 「NSM↔CIRCLES drift scan results」 and 「COMMON design issue」 (latter pending STANDING memory).
**Recommendation**: ship **D-12 + D-13 + STANDING memory** in C-Drift-4. **Defer row 26-30 hint modal unify** to C-Drift-5 (separate commit; large refactor). **Optionally include row 31** if effort permits.

---

## §2 File diff plan

### File: `public/app.js` + NEW memory file + (optionally) mockup 06

---

#### Fix 1 — D-12 NSM recent rail (functional gap)

**New AppState key**: insert after `circlesRecentSessions: null,` (line 74):
```js
nsmRecentSessions: null,        // null = not loaded; [] = empty; [...] = NSM-only recent items
```

**New helper**: `loadNsmHistoryForRail` — insert near `loadHistoryForRail` (line 5550). Pattern:
```js
async function loadNsmHistoryForRail() {
  // Fetch NSM-only recent sessions for NSM home rail (parallel to CIRCLES mixed rail).
  // Mirrors loadHistoryForRail (app.js:5550-5579) but filters to NSM only.
  if (!AppState.accessToken && !AppState.guestId) return;
  try {
    var path = AppState.accessToken ? '/api/nsm-sessions' : '/api/guest/nsm-sessions';
    var res = await window.apiFetch(path);
    if (!res.ok) throw new Error('nsm_history_load_error');
    var items = await res.json();
    items.sort(function (a, b) {
      return new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at);
    });
    AppState.nsmRecentSessions = items.slice(0, 5);
    render();
  } catch (e) {
    AppState.nsmRecentSessions = [];
    render();
  }
}
```
+15 / 0 lines.

**Renderer replacement** — `renderNSMRecentRail` (line 6297-6299) — replace empty stub with full impl mirror CIRCLES line 5824-5840:
```js
function renderNSMRecentRail() {
  // Kick async fetch if not yet loaded
  if (AppState.nsmRecentSessions === null) {
    setTimeout(loadNsmHistoryForRail, 0);
  }
  var recentItemsHtml;
  if (AppState.nsmRecentSessions === null) {
    recentItemsHtml = '<div class="nsm-recent__placeholder" style="font-size:var(--t-cap);color:var(--c-ink-3);">載入中…</div>';
  } else if (AppState.nsmRecentSessions.length === 0) {
    recentItemsHtml = '<div class="nsm-recent__placeholder" style="font-size:var(--t-cap);color:var(--c-ink-3);">尚無 NSM 練習</div>';
  } else {
    recentItemsHtml = AppState.nsmRecentSessions.map(function (item) {
      item._isNsm = true; // ensure renderRecentItem treats it as NSM
      return renderRecentItem(item);
    }).join('');
  }
  return '<aside class="nsm-recent">'
    + '<div class="nsm-recent__label">近期 NSM 練習</div>'
    + '<div class="nsm-recent__list">' + recentItemsHtml + '</div>'
    + '</aside>';
}
```
~-3 / +18 lines = +15.

**Click handler** — add NSM rail item click handler in `bindNSMStep1` (line ~6440-6473):
```js
document.querySelectorAll('[data-nsm-recent-item]').forEach(function (el) {
  el.addEventListener('click', function () {
    var id = el.dataset.id;
    var list = AppState.nsmRecentSessions || [];
    var item = list.find(function (i) { return String(i.id) === String(id); });
    if (!item) return;
    loadCirclesSessionFromHistory(item);  // shared helper routes by isNsm
  });
});
```
+8 lines. **Note**: the `renderRecentItem` helper already emits `data-circles="recent-item"` not `data-nsm-recent-item`. Either reuse `data-circles="recent-item"` and the existing CIRCLES handler routes via item._isNsm, OR add new attribute. **Recommendation**: reuse — change `renderNSMRecentRail` to NOT override data attribute; the CIRCLES handler at line 6075-6082 already calls `loadCirclesSessionFromHistory(item)` which routes by isNsm.

**Surgical contract**: ~+40 / -3 for D-12 = +37 net.

---

#### Fix 2 — D-13 latent cache invalidate

**Location**: line 8697 in `_doOffcanvasDelete` after `AppState.circlesRecentSessions = null;`
**Target**: add one line:
```js
AppState.nsmRecentSessions = null;
```
+1 / 0 line.
**Also**: 3 other invalidation sites at lines 2954, 3037, 3340 (search results above). For each, evaluate whether NSM cache should ALSO invalidate. Likely YES for all 3 (those are auth state change handlers). Add `AppState.nsmRecentSessions = null;` to each = +3 lines.
**Total D-13**: +4 lines.

---

#### Fix 3 — STANDING memory file (NEW)

**Path**: `~/.claude/projects/-Users-albertpeng-Desktop-claude-project-First-Principle/memory/feedback_nsm_circles_shared_helper_mandate.md`

**Content**: copy verbatim from `audit/nsm-circles-drift-scan-2026-05-19.md` §5 codeblock (lines 278-296). Already drafted in audit doc.

**MEMORY.md index update**: add entry near other `feedback_*` STANDING entries:
```markdown
- [NSM ↔ CIRCLES 共用 helper 強制](feedback_nsm_circles_shared_helper_mandate.md) — STANDING：CIRCLES helper 改 → NSM 必同步 check；新增 *Loading / *Error / *Stale / *Draft AppState key 必兩邊都加；PATCH 必經 persistRetry；localStorage write 必對應 read；modal close 必 abort 全 controller
```

**No production diff**. Memory files live outside repo (in `~/.claude/`).

---

#### Fix 4 (DEFER recommended) — Row 26-30 hint modal shell unify

**Scope**: 4 modal shell functions (`renderHintModalShell` / `_renderNSMHintModalShell` / `_renderNSMStep3HintModalShell` / `_renderNSMStep1HintModalShell`) → unify to single parametric.

**Reason to defer**:
- Each shell has different head icon / label / retry data-attr / fetch endpoint.
- Unification requires designing param shape: `{ headIcon, labelText, bodyHtml, retryAttr, retryArgs, isLoading, isError, isStep1 }`.
- Spec compliance check: 4 mockups (03/07/08/06) need cross-verify identical shell.
- Estimated effort: half-day for refactor + 4 specs that all hint modals still work.
- **Recommendation**: tracker P3 maint debt; ship as standalone commit C-Drift-5 after Phase 2 wrap-up.

**If still in scope**: each shell delete saves ~30 LOC; total -120 / +40 = -80 net but spec count +4.

---

#### Fix 5 (OPTIONAL) — Row 31 progress class align

**Scope**: 3 progress bars use different class prefixes:
- `renderProgressBar` (line 4511) — `.progress` — CIRCLES Phase 1
- `renderCirclesProgressBar` (line 6515) — `.circles-progress` — CIRCLES Phase 3
- `renderNSMProgress` (line 6226) — `.nsm-progress` — NSM 4-step

**Target**: align inner classnames using `__step / __dot / __label / __line` BEM pattern (already the case in `circles-progress` and `nsm-progress`). The outlier is `renderProgressBar` (older legacy) — check current classnames.

**Recommendation**: include ONLY if `renderProgressBar` (line 4511) deviates from BEM. If consistent → no work needed; close as "no drift in practice".

**Surgical contract** if needed: ~+5/-5 rename within renderProgressBar markup + CSS @import sync.

---

## §3 TDD spec list

### Spec 1 — D-12 NSM recent rail render + load

- **Path**: `tests/e2e/nsm-recent-rail-load.spec.js` (new)
- **Skill citations**:
  ```js
  // Skills cited:
  //   playwright-skill/core/api-testing.md:783-848 — service-role seed
  //   playwright-skill/core/auth-flows.md:928-949 — API seed auth
  //   playwright-skill/core/mobile-and-responsive.md:49-71 — desktop device profile
  //   playwright-skill/core/common-pitfalls.md Pitfall 3 — role-based locators
  ```
- **Test shape (3 cases)**:
  - Case A (empty state): logged in fresh user with 0 NSM sessions → NSM home → rail shows 「尚無 NSM 練習」.
  - Case B (3 items): seed 3 NSM sessions via service-role → NSM home → rail shows 3 items sorted by updated_at DESC.
  - Case C (click → restore): rail item click → `loadCirclesSessionFromHistory` triggers → NSM Step 2/3/4 renders restored data.
- **5x consecutive**: required.

### Spec 2 — D-13 NSM rail cache invalidate after delete

- **Path**: `tests/e2e/nsm-rail-cache-invalidate-after-delete.spec.js` (new)
- **Skill citations**: identical to Spec 1.
- **Test shape**:
  1. seed 2 NSM sessions
  2. NSM home → assert 2 items in rail
  3. open offcanvas → delete item 1 → assert 1 item in offcanvas
  4. close offcanvas → NSM home → assert rail re-fetches → shows 1 item
- **5x consecutive**: required.

### Spec 3 — STANDING memory file existence (jest sanity)

- **Path**: `tests/api/standing-memory-files-exist.spec.js` (new — OR append to existing housekeeping jest)
- **Test shape**: assert file exists at expected memory path. (Optional — process check, not behavior. Skip if no equivalent test exists.)
- **Alternative**: just commit the file; no test needed.

### Spec count summary
- 2 new playwright e2e specs (D-12, D-13)
- 0 jest (defer STANDING memory existence test; trust file commit)
- **Total**: 2 new test files + 1 new memory file for commit C-Drift-4.

---

## §4 Risk + rollback

| Fix | Risk if break | Detection signal | Rollback path |
|---|---|---|---|
| D-12 | If `loadNsmHistoryForRail` overlaps with `loadHistoryForRail`, double-fetch `/api/nsm-sessions` → wasted bandwidth. Mitigated: NSM home only renders nsm rail (not mixed rail) → `loadHistoryForRail` not triggered. | network tab + Spec 1 case B passing | revert renderNSMRecentRail to stub + revert AppState key + loadNsmHistoryForRail |
| D-12 click handler | If renderRecentItem markup uses `data-circles="recent-item"` — NSM rail item click routes via CIRCLES handler at line 6075, which calls `loadCirclesSessionFromHistory(item)` and routes by isNsm. Already works if `_isNsm` flag set. | Spec 1 case C passing | refactor: ensure item flagged before render OR use new data-attr |
| D-13 | If `nsmRecentSessions` invalidate fires on auth events before user even logs in, rail flickers. Mitigated by lazy load (null → setTimeout → fetch). | Manual login + logout test | revert 4 added invalidation lines |
| STANDING file | None — pure documentation. | N/A | git rm file + revert MEMORY.md index |

**Cross-spec drift risk**:
- D-12 introduces NEW DOM in NSM home → NSM home visual snapshots WILL diff.
- **Mockup 06 must be updated** to include recent rail in right column. Per `feedback_visual_baseline_from_mockup_not_production` STANDING:
  1. Update mockup `06-nsm-step-1.html` to include `.nsm-recent` with 5-item list shown (desktop only).
  2. Get user 放行 per `feedback_mockup_first`.
  3. Re-capture mockup HTML baseline for nsm-step-1 viewport tests.
  4. Run production through new baseline; should pass (since we mirror CIRCLES recent rail markup).

**Director-clarification-needed items**:
1. **Mockup 06 update for D-12** — REQUIRED before D-12 visual baseline. **BLOCKER if mockup not updated**.
2. **Defer hint modal unify (Fix 4)** — confirm decision: yes defer, ship in C-Drift-5.
3. **Optional Fix 5 (progress class)** — confirm scope: include if `renderProgressBar` legacy class differs, skip otherwise.
4. **STANDING memory** — already drafted in audit §5. Confirm content unchanged before committing memory file.

---

## §5 Mockup-as-spec verification

| Fix | Mockup ref | Verification action |
|---|---|---|
| D-12 | mockup `06-nsm-step-1.html` UPDATE to include `.nsm-recent` rail in desktop layout (mirror mockup 01 line 1061-1092 recent-rail in CIRCLES home). **NEW MOCKUP WORK — user gate required** | Block until mockup approved |
| D-13 | No DOM delta. No mockup change. | N/A |
| STANDING | Audit doc `audit/nsm-circles-drift-scan-2026-05-19.md` §5 contains canonical text. | Cite audit §5 line numbers in memory file header |
| Fix 4 (deferred) | All 4 mockups (03, 06, 07, 08) — confirm shells visually identical before unify | DEFER |
| Fix 5 (optional) | Cross-check 3 mockups (03 Phase 1 progress, 11 Phase 3 progress, 06 NSM Step 1 progress) for class BEM consistency. | Read 3 mockups |

**Visual regression risk**: D-12 will make NSM home Desktop-1280 visual diff. New baseline needed. Per STANDING — source from mockup, not production.

---

## §6 Effort + commit message preview

- **Engineering effort** (D-12 + D-13 + STANDING only):
  - D-12: 3 hr (helper + renderer + handler + AppState + spec with 3 cases)
  - D-13: 0.5 hr (4 invalidation lines + spec)
  - STANDING memory: 0.5 hr (copy audit §5 to memory file + index update)
  - Mockup 06 update: 1 hr sonnet dispatch + wait for user 放行
  - Cross-spec smoke + 2-stage review: 2 hr
  - **Total**: ~7 hr if mockup approval fast; up to 1.5 days if blocked.

- **With Fix 4 (hint modal unify) added**: +4 hr (refactor + 4 specs). Recommend defer.

**Commit message draft (D-12 + D-13 + STANDING)**:
```
feat(nsm): C-Drift-4 — recent rail + cache invalidate + STANDING memory
                       (D-12 + D-13 + COMMON design issue closure)

D-12: NSM home 補 recent rail 功能 (mockup 06 update — mirror CIRCLES home rail)
      - 新 AppState.nsmRecentSessions cache
      - 新 loadNsmHistoryForRail helper (NSM-only fetch)
      - renderNSMRecentRail 從 empty stub 改完整 impl
      - item click 復用 loadCirclesSessionFromHistory routing
D-13: app.js:8697 + 3 auth invalidation sites 加 AppState.nsmRecentSessions = null
      (CIRCLES delete cache invalidate 同 commit 修 NSM 也要清，避免 stale rail)
STANDING: 新 memory feedback_nsm_circles_shared_helper_mandate.md
          (audit §5 verbatim — CIRCLES helper 改必 sync NSM；PATCH 必 persistRetry；
           localStorage write 必對應 read；modal close 必 abort 全 controller；
           submit 必 inflight mutex；reset 必過 helper 不 inline)

關 §3 COMMON design issue tracker entry。
Mirror refs: CIRCLES app.js:5824-5840 (recent rail render) / 5550-5579 (load helper)
            / 8697 (cache invalidate)

New specs:
- tests/e2e/nsm-recent-rail-load.spec.js (3 cases × 5x GREEN)
- tests/e2e/nsm-rail-cache-invalidate-after-delete.spec.js (5x GREEN)
New memory:
- ~/.claude/projects/.../memory/feedback_nsm_circles_shared_helper_mandate.md
Mockup updated:
- docs/superpowers/specs/mockups/2026-05-02-frontend-rewrite/06-nsm-step-1.html
  (added .nsm-recent rail in desktop 3-col layout)

Refs: audit/nsm-circles-drift-scan-2026-05-19.md §3 D-12 / D-13 / §5 STANDING
Tracker: closes audit/e2e-master-tracker.md §3 COMMON design issue entry
```
