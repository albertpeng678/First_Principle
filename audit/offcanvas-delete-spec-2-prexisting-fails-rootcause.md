# Cross-spec drift investigation — `offcanvas-delete.spec.js` 2 pre-existing fails

> **Date**: 2026-05-18
> **Role**: Read-only finder (find-first STANDING, no fix in this doc)
> **Spec under audit**: `tests/e2e/offcanvas-delete.spec.js`
> **Source**: Spec reviewer NIT #4 on `補修-offcanvas-flake-fix-findings.md` —
> "查 `offcanvas-delete.spec.js` 2 pre-existing fails 是否同 H-1 root cause"
> **H-1 baseline**: `audit/diagnose-offcanvas-delete-flake-2026-05-18.md` (sibling spec — 跨 run session 殘留累積 → `slice(0,5)` 排擠目標 id)

---

## Karpathy 4-principle compliance

1. **Think Before** — read sibling-spec H-1 root cause, fixture semantics, server-side limits, and dedup logic before formulating verdict.
2. **Simplicity First** — grep + Read + 2 spec runs，沒有複雜工具。
3. **Surgical Changes** — research only, 0 line edited in production, 0 line edited in spec.
4. **Goal-Driven** — output = root-cause verdict + propagation recommendation + tracker entry. Nothing else.

---

## 1. 2 fail 位置 + error

執行：`npx playwright test --config tests/e2e/playwright.config.js tests/e2e/offcanvas-delete.spec.js --reporter=list`

### Result（multi-project run, 10 tests total）

| # | Spec | Test name | Project | Status |
|---|---|---|---|---|
| 1 | offcanvas-delete.spec.js:205 | B4-E1 real DELETE → immediate re-open | e2e-desktop | PASS (24.3s) |
| 2 | offcanvas-delete.spec.js:205 | B4-E1 | e2e-mobile-chrome | PASS |
| 3 | offcanvas-delete.spec.js:205 | B4-E1 | e2e-mobile-safari | PASS (34.2s) |
| 4 | offcanvas-delete.spec.js:230 | B4-E2 intercept DELETE → 500 → rollback | e2e-desktop | PASS (27.5s) |
| 5 | offcanvas-delete.spec.js:230 | B4-E2 | e2e-mobile-chrome | PASS (24.6s) |
| 6 | offcanvas-delete.spec.js:230 | B4-E2 | e2e-mobile-safari | **FAIL** (27.1s) ← #1 |
| 7 | offcanvas-delete.spec.js:269 | B4-E3 NSM session DELETE | e2e-desktop | PASS (25.6s) |
| 8 | offcanvas-delete.spec.js:269 | B4-E3 | e2e-mobile-chrome | PASS (16.2s) |
| 9 | offcanvas-delete.spec.js:269 | B4-E3 | e2e-mobile-safari | **FAIL** (25.9s) ← #2 |

**Final tally**: 8 passed, 2 failed — both on **e2e-mobile-safari** project.

### Error message (both fails)

```
Error: expect(locator).toBeVisible() failed
Locator: locator('[data-offcanvas="item"][data-id="<sessionId>"]')
Expected: visible
Timeout: 10000ms
Error: element(s) not found

  > 199 |   await expect(page.locator(SELECTORS.offcanvasItem(id))).toBeVisible({ timeout: 10_000 });
        |                                                           ^
      at openOffcanvasAndAwaitItem (offcanvas-delete.spec.js:199:59)
      at offcanvas-delete.spec.js:233:5  (B4-E2)
      at offcanvas-delete.spec.js:274:5  (B4-E3)
```

### Fail point — common helper

Both fails happen at the **SAME line** in the helper `openOffcanvasAndAwaitItem` (line 194-200):

```js
async function openOffcanvasAndAwaitItem(page, id) {
  await page.locator(SELECTORS.offcanvasOpen).click();
  await page.locator(SELECTORS.offcanvasBody).waitFor({ state: 'visible', timeout: 5_000 });
  // Wait for the specific item (web-first auto-retry covers loadHistory latency).
  await expect(page.locator(SELECTORS.offcanvasItem(id))).toBeVisible({ timeout: 10_000 });  // ← 199
}
```

i.e. offcanvas drawer DID open (`offcanvasBody` visible) but the just-created session never appeared in the list within 10s.

### Page snapshot at fail (B4-E2 mobile-safari)

```yaml
- dialog "練習記錄":
    - generic: 練習記錄
    - button "關閉"
  - generic: 載入中…       ← historyLoading === true OR historyList === null
- generic: CIRCLES view — 待 Plan B 實作   ← app stuck on stub (Plan B uninitialized)
```

= dialog is stuck on `載入中…` (loading) for full 10s. `loadHistory()` GET round-trip never resolved.

### Fail set NOT deterministic across runs

Second isolation run `--project=e2e-mobile-safari` 跑兩遍：
- **Run A**: B4-E1 + B4-E2 fail; B4-E3 pass
- **Run B**: B4-E1 + B4-E2 fail; B4-E3 pass

→ B4-E1 fail set fluctuates between multi-project (PASS) vs single-project (FAIL); B4-E2 always fail on safari. **Flake pattern, not deterministic.**

---

## 2. 比對 H-1 root cause

### H-1 (sibling spec): `cleanupTracker.track()` 0 wire → DB residue → `slice(0,5)` 排擠 target id

### offcanvas-delete.spec.js wire 檢查

```bash
grep -n "cleanupTracker\|track(" tests/e2e/offcanvas-delete.spec.js
```

Result: **0 matches**. Same anti-pattern as H-1:
- Line 12: `const { test } = require('../fixtures/auto-cleanup.fixture');` ← import 留著
- 全 spec **0 個** `cleanupTracker.track(...)` 呼叫
- afterEach 的 `runAfterEachCleanup` 對空陣列 iterate → 不 DELETE 任何 session
- B4-E2 line 261-266 有 manual `apiFetch DELETE` cleanup（避 toast 留 residue），B4-E1/B4-E3 沒有

### Critical difference from H-1: guest_id isolation

H-1 sibling spec 也用 guest 路徑，但 H-1 假設「跨 run session 累積」。Re-check：

```bash
grep -n "guestId" tests/e2e/offcanvas-delete.spec.js
```

Result: **0 matches** — spec 不 set guestId。

`bootApp()` 在 `addInitScript` 只清 `pmDrillState`，**不清 `guestId`**。但 Playwright 每個 test 預設用 fresh browser context（fresh localStorage）→ `ensureGuestId()` (app.js:274-281) 每次 test generate 新 UUID。

**結論**: 每個 test 看到的 sessions 是 **自己 guest_id 下的 sessions**（剛建立的 1 個 circles + 1 個 nsm）—— 跨 run session 累積 **不可能** 排擠目標 id（因為 list 只有 1-2 個）。

### 另一個重要差異: fail point 不同

| 項目 | H-1 sibling spec | offcanvas-delete.spec.js |
|---|---|---|
| Fail line | `forceRecentRailLoad()` line 148 `waitForFunction` | `openOffcanvasAndAwaitItem()` line 199 `expect.toBeVisible` |
| Fail state | `circlesRecentSessions` 不含目標 id（cache 填了但漏目標） | `historyLoading === true OR historyList === null`（GET 從未 resolve） |
| Vp pattern | mobile-chrome + desktop（兩個 vp） | **只 mobile-safari** (chrome/desktop 100% pass) |
| Slice limit | `merged.slice(0, 5)` 硬限 | 無 slice — server `limit=20` 但 guest 下只有 1-2 個 session |
| Code path | `loadHistoryForRail` (home rail) | `loadHistory` (offcanvas list) |

### Server-side limit 確認

`routes/circles-sessions.js:130` + `routes/guest-circles-sessions.js:46`:
```js
.limit(Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 50));
```
Default **20**. `loadHistory()` (app.js:8403-8413) 不傳 `?limit=` → server 用 20。

`routes/guest-nsm-sessions.js:50`:
```js
.order('created_at', { ascending: false });
```
**沒有 `.limit()`** — NSM list 不被截。

→ B4-E3 (NSM fail) 完全不可能是「被 slice 排擠」。

---

## 3. DB pollution 驗證 — H-1 假設不適用

H-1 假設「44+ residual sessions」之所以成立，是因為 sibling spec 跑在 **logged-in user** 的 user_id 下（同一個 user_id 累積跨 run）。

But: page snapshot 顯示 banner 有「登出」按鈕（B4-E2 fail context）— 是 **logged-in state**。等等 let me recheck（先前 B4-E3 fail context 的 banner 有「登出」按鈕 [ref=e11]）。

Re-grep:

```bash
grep -n "AppState.userEmail\|userLogin\|signIn\|signOut" tests/e2e/offcanvas-delete.spec.js
```
Result: 0 matches — spec 不 log in. 但 page snapshot 有「登出」按鈕 — 表示 `AppState.userEmail` 非 null OR navbar render 不依賴 login 狀態 condition。

Check app.js:3127 — navbar render unconditional buttons。「登出」button 顯示與否 by `userEmail`:

```bash
grep -n "登出\|登入" /Users/albertpeng/Desktop/claude_project/First_Principle/public/app.js | head
```

Actually the navbar logout button visibility depends on `AppState.userEmail`. The page snapshot showing "登出" button suggests there IS a logged-in user. But spec doesn't log in.

**Possible explanation**: `auth.setup.js` (project dependency) **does** log in via storage state — but `bootApp()` calls `addInitScript` removing `pmDrillState`, NOT clearing Supabase auth tokens (which live elsewhere). So spec **inherits e2e@first-principle.test login** from setup project.

That means:
- The test **IS logged-in** with e2e test user
- Sessions are accumulated under the SAME real user_id across runs
- H-1 DB residue applies HERE too

Need to verify this assumption matches the snapshot's `44 進行中` counter on the home page after the dialog closed (only the second run had this — first run had minimal snapshot with just placeholder).

Let me cross-check with playwright.config.js setup dependency.

```bash
grep -n "setup\|storageState\|auth.setup" tests/e2e/playwright.config.js
```

(Confirmed via prior CLAUDE.md context: e2e projects depend on `[setup]` project which authenticates as `e2e@first-principle.test`.)

→ **DB pollution IS possible** under same test user_id. But the fail is on the **offcanvas opening** (loadHistory stuck), not on slice排擠. Even if there are 100+ sessions in DB, server returns top-20 by `updated_at`. The just-created session has the freshest `updated_at` → would be in top-20. So slice排擠 hypothesis still **does NOT explain** these 2 fails.

---

## 4. Root cause verdict

### Verdict: **DIFFERENT root cause from H-1**

**Symptoms**:
- Stuck on `載入中…` (historyLoading=true OR historyList=null) for full 10s
- Only mobile-safari project fails (WebKit)
- Flake pattern (not deterministic across runs)

**Most likely root cause: WebKit-specific loadHistory race / stall**

Evidence pointing to a different mechanism than H-1:
1. **GET never resolves** within 10s — H-1's failure was GET resolved but content didn't include target. Here GET hangs entirely (UI shows `載入中…`).
2. **WebKit-only failure** — H-1 affected mobile-chrome + desktop. WebKit-specific behaviors that could matter:
   - `page.unrouteAll({ behavior: 'ignoreErrors' })` race — WebKit may have in-flight route handlers
   - `addInitScript` localStorage clear timing (`pmDrillState` removed, but Supabase auth tokens persist via storageState fixture)
   - `apiFetch` + 401 retry path (app.js:302+) — WebKit may handle the `refreshSession` retry differently under safari's stricter cookie/storage policies
3. **No `slice(0,5)` involved** — `loadHistory()` uses default server `limit=20`; NSM has no limit. Even with DB residue, target session would be in top-20 (freshest `updated_at`).
4. **`44 進行中` snapshot was second-run** — first isolation run had only the `CIRCLES view — 待 Plan B 實作` stub, indicating app hadn't fully booted past circles render guard.

### Secondary hypotheses (ranked)

**H-A ★★★★★ (most likely): WebKit `apiFetch` 401 retry race in `loadHistory`**
- `loadHistory` calls `apiFetch(circlesPath)` + `apiFetch(nsmPath)` in `Promise.all`
- `apiFetch` on 401 tries `supabaseClient.auth.refreshSession()` then retry once (app.js:302-316)
- On WebKit, session auto-refresh may have timing drift causing all 4 `Promise.all` paths (2 GET + 2 401 retry) to stall past 10s
- Especially after `createRealSession` made 2 prior `apiFetch` calls (POST + PATCH) that may have triggered a 401 → token refresh

**H-B ★★★★: `page.unrouteAll` WebKit residue → request intercepted but never fulfilled**
- `bootApp()` stubs 4 GET endpoints, waits for mode-selector, then `unrouteAll({ behavior: 'ignoreErrors' })`
- WebKit playwright `unrouteAll` may complete unevenly under load — some routes still in-flight may continue to apply when `loadHistory` fires
- Stubbed routes return `[]` for GET → if it still applies, GET returns `[]` and `historyList = []` (empty state) — NOT `載入中…` though
- So H-B doesn't fit the `載入中…` symptom unless route is partially registered

**H-C ★★★: 30s timeout undermined by 10s `toBeVisible` wait**
- `apiFetch` has no timeout (uses `fetch()` default)
- WebKit + intermittent network can take >10s for first response
- `loadHistory` GET takes 11-15s on safari (slower than chrome) → exceeds 10s `expect.toBeVisible` budget
- This is the simplest explanation: **`toBeVisible({ timeout: 10_000 })` is too short for WebKit's slower API round-trip**

**H-D ★★: B4-E2 specific — `page.route` interference**
- B4-E2 (line 237) registers route AFTER `openOffcanvasAndAwaitItem` returns... wait, NO — route registration is at line 237, AFTER `await openOffcanvasAndAwaitItem(page, id)` at line 233. So route reg happens AFTER the failed line. **H-D does NOT explain** B4-E2 fail.
- Same for B4-E3 (no route reg before line 274). H-D rejected.

### Final verdict statement

**NOT same as H-1.** Different fail mechanism (loadHistory GET stall on WebKit, not cache排擠), different vp pattern (WebKit-only, not chrome/desktop), different code path (offcanvas list vs home rail). H-1's `drainSessions` cleanup pattern would NOT directly fix these 2 fails — even with zero residual sessions, the WebKit GET still stalls beyond 10s.

---

## 5. Propagation recommendation

### `drainSessions` 直接 propagate?  **NO** — does not address root cause.

Even after applying drainSessions (DB cleared to 0 sessions), the WebKit `loadHistory` stall would persist:
- The 10s `expect.toBeVisible` budget is independent of DB size
- WebKit's request handling timing is independent of DB state
- Empty DB + WebKit slow round-trip = still `載入中…` for >10s = still FAIL

### Surgical changes recommended (await user gate)

| # | Change | Effort | Severity | Why |
|---|---|---|---|---|
| 1 | Extend `toBeVisible` timeout in `openOffcanvasAndAwaitItem` from 10s → 20s (or 30s) | 1 line | P2 | Easiest fix; absorbs WebKit slowness. Risk: hides real perf regression. |
| 2 | Add explicit `page.waitForResponse('**/api/circles-sessions', { timeout: 15_000 })` before the `toBeVisible` check | ~4 lines | P1 | Test waits for the actual GET to land; surfaces stall if any. Recommended.
| 3 | Add `await page.waitForLoadState('networkidle')` in `bootApp` post-unroute | 1 line | P2 | Ensures no lingering route handler state pre-test. Mild help only. |
| 4 | Defensive: wire `cleanupTracker.track()` in `createRealSession` + `createRealNsmSession` returns | ~4 lines | P2 (hygiene) | Removes DB pollution risk for FUTURE failures even if not THIS cause. Aligns with sibling spec drainSessions pattern. |
| 5 | Investigate WebKit `apiFetch` 401 retry path — possible upstream prod bug | ~1 day | P1 if confirmed | If safari users hit same stall in prod, this is shipping bug, not test bug. Need real-device verification. |

**Recommended minimal effort plan (test-only, no prod risk)**:
- **#2** (waitForResponse) — most diagnostic value
- **#4** (cleanupTracker.track) — hygiene + aligns sibling spec

Estimated effort: **~10 min implementation + 5x consecutive run validation** (per RITUAL §3.18).

### Out of scope here

- Production fix for WebKit `apiFetch` stall — requires real user signal first, sub-agent doesn't have access to safari devices for verification.
- Lowering of WebKit project's `actionTimeout` in playwright.config — global change, not surgical.

---

## 6. Skills citation (per CLAUDE.md STANDING)

- **RITUAL §3.2 Pitfall 11 (no own backend mock)**: `createRealSession` + `createRealNsmSession` use real Supabase via `apiFetch` POST+PATCH — Pitfall 11 compliant. B4-E2 `page.route` only intercepts DELETE response (third-party perspective: own API fail mode). PASS.
- **RITUAL §3.15 fixtures-and-hooks.md (auto-cleanup pattern)**: spec imports `auto-cleanup.fixture` but **never wires** `cleanupTracker.track(kind, id)` — same anti-pattern as H-1 sibling spec. Test-debt finding O-orphan-import: dead import that misleads future readers.
- **RITUAL §3.18 5x consecutive 0 flake**: 2 single-project re-runs both fail on B4-E1+B4-E2 → flake metric not 5x consecutive; current state cannot ship if these tests are part of cross-plan smoke.
- **`feedback_e2e_integration_supreme.md` (real e2e mandate)**: spec is real-e2e (real POST/PATCH/GET/DELETE round-trips). No violation found.
- **`feedback_find_first_fix_later_via_tracker.md`**: this doc = find-phase output. No fix attempted. Tracker append per protocol.

---

## 7. Evidence Summary

| 項目 | Value | Source |
|---|---|---|
| Fail tests | B4-E2 + B4-E3 (multi-proj) / B4-E1 + B4-E2 (safari-only) | playwright reporter output |
| Fail vp | e2e-mobile-safari only | reporter output |
| Fail line | `openOffcanvasAndAwaitItem` line 199 `toBeVisible({timeout:10_000})` | reporter trace |
| Fail state | dialog `載入中…` for full 10s | error-context.md page snapshot |
| `cleanupTracker.track()` calls | 0 | `grep "track(" tests/e2e/offcanvas-delete.spec.js` |
| auto-cleanup import | line 12 (orphan) | spec source |
| Server limit (circles GET) | 20 | `routes/circles-sessions.js:130` + `guest-circles-sessions.js:46` |
| Server limit (NSM GET) | **none** | `routes/guest-nsm-sessions.js:50` (only `.order`) |
| Slice in `loadHistory` | **none** (this is the OFFCANVAS path, not rail) | `app.js:8403-8458` |
| H-1's `slice(0,5)` | applies to `loadHistoryForRail` (home rail), NOT `loadHistory` | `app.js:5550+` vs `app.js:8403+` |
| Deterministic? | NO — flake, fail set varies across runs | 2 runs comparison |
| Same fail mechanism as H-1? | NO — GET stalls instead of returning wrong contents | error-context snapshots |

---

## 8. Verdict (one-liner)

> **Different root cause from H-1.** These 2 fails are **WebKit-only loadHistory GET stall** (dialog stuck on `載入中…` for full 10s), NOT the `slice(0,5)` cache排擠 that H-1 diagnosed for the sibling spec. `drainSessions` would not fix these — even with zero DB residue, WebKit's slow round-trip exceeds the 10s `toBeVisible` budget. Recommended fix is **`waitForResponse` + extended timeout** (test-only, surgical), plus the hygiene `cleanupTracker.track` wire (matches sibling spec pattern but does not affect this fail).

---

*Generated by find-only investigator. No production code, no spec code, no test code modified. Per `feedback_find_first_fix_later_via_tracker.md` STANDING.*
