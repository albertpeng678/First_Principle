# Multi-Phase Ship Plan — 2026-05-17 PM

> **Director-issued execution roadmap** post 7/7 P0 milestone + PAUSED plans restart. User goal: maximum robustness, long-term time-saving via hollow test → real test conversion (F-007 wave is biggest lever).

**Status**: Phase A in progress (L27 + L28 + L29 dispatched)
**Last updated**: 2026-05-17 PM Taipei

---

## §0 Tier overview

| Phase | Wall-clock | Scope | User involvement |
|---|---|---|---|
| **A. Immediate ship** | 1-2h | current 3 lanes + reviewer wave + push + CLAUDE.md | user 看著 |
| **B. F-007 wave (biggest lever)** | 8-15h | 65 hollow specs → real Supabase, 5-7 batches × 3 lanes | user 不必每步 review |
| **C. Cleanup** | 3-5h | Retrofit G hollow tests + mockup 04 pixel-diff + adversarial extension | user 不必每步 review |
| **D. User decisions** | 5-30 min | B5 #207 + Trophy #199 close | **user must decide** |

---

## §A Phase A — Immediate Ship (in flight)

### A.1 Active lanes
| Lane | Task | Status | Files scope |
|---|---|---|---|
| L27 | P0-NEW-6 fix 5 API spec lifecycle seed drift | 🏃 dispatched | `tests/api/*` only |
| L28 | B-Hint UI ship (#174+#193) | 🏃 dispatched | `public/app.js` NSM region + new spec |
| L29 | 1B state/cache plan audit (#191) | 🏃 dispatched | audit doc + maybe small spec |

### A.2 Post-A actions (Director main agent after lanes return)
1. **Cold-verify** each commit (git show + spot 3x re-run per skill citation discipline)
2. **2-stage reviewer wave** for 7+ ship commits:
   - L5/L11/L13/L16/L17/L19/L23/L25/L26/L27/L28/L29 each → spec-compliance + code-quality reviewer
   - Use `code-reviewer` persona (addy/agent-skills) — 5-axis review per commit
3. **Final cross-plan smoke** (per memory `feedback_cross_plan_smoke_after_each_ship`):
   - Full API suite (180 specs)
   - Critical e2e × 3 vp
   - jest full (target ≥535/552)
4. **CLAUDE.md final state board update** — reflect 7 P0 + paused restart + push status
5. **Push origin/main** — using `/ship` slash command for pre-launch checklist

### A.3 Exit criteria
- All 3 lanes commit + IL-2 verified
- 12+ reviewer subagents APPROVED
- Smoke 0 fail across 4 suites
- CLAUDE.md mirrors
- `git push origin main` succeeded

---

## §B Phase B — F-007 Wave (biggest lever, ~8-15h)

### B.1 Context
Per master tracker §6 O-1 + §2 P1-#257 + master plan F-007:
- ~65 e2e specs partial-mock `/api/circles-sessions` list endpoint with `route.fulfill` stubs
- Hollow mock = doesn't catch P0-NEW-6 class regression (lifecycle guard cascade)
- Convert to real Supabase + service-role seed per L5/L25 pattern
- **Biggest single ROI** — prevents future cluster regression

### B.2 Batch design
- 5-7 batches × 3 parallel lanes
- Each batch: ~10-13 specs scoped
- Per spec: read existing → adapt setLifecycleGated pattern → service-role seed → real API call → 5x consecutive verify
- Estimated per spec: 30-60 min
- Per batch wall-clock: ~1-2h (3 parallel) — total ~7-14h

### B.3 Director responsibilities per batch
1. Read master plan F-007 §7 to identify batch scope
2. Dispatch 3 lanes (one per spec cluster)
3. After each batch return: cold-verify + cross-plan smoke
4. Update tracker §4 verification matrix
5. Commit + advance to next batch

### B.4 Exit criteria
- All ~65 specs converted to real Supabase
- 0 route.fulfill stub on own backend (Pitfall 11 cleared)
- jest baseline maintained at 535+/552
- Full API suite 0 fail

---

## §C Phase C — Cleanup (~3-5h)

### C.1 Items
- **Retrofit G** (#205) — delete hollow tests + test-supabase mock library (now that F-007 done)
- **Mockup 04 audit** (#21) — pixel-diff 9 transition drift fixes
- **Adversarial extension** — nsm-context / circles-conclusion-check / circles-final-report prompts (4-pillar → 6-pillar sweep)

### C.2 Batch design
- 3 lanes parallel per cluster
- Director cold-Read PNG per visual change

---

## §D Phase D — User Decisions (~5-30 min)

### D.1 Items needing user gate
- **#207 B5 decision** — revert 1C or keep, per user mockup signoff (cannot auto-decide)
- **#199 Trophy Step 4 critical-path E2E** — verify if `#212` already covers (or close as duplicate)

### D.2 Director will prep
- For #207: present current B5 ship status + 1C SUPERSEDED note + 推薦 close (already done via chat-drift)
- For #199: cross-check with #212 e2e coverage, present close case

---

## §E Auto-wake schedule

Director will set ScheduleWakeup at 50-min intervals to:
1. Cold-verify recent lane returns
2. Dispatch next batch if previous all GREEN
3. Update tracker + commit per ritual
4. Continue until user re-engages OR all phases done

User can check in any time. Tracker `audit/e2e-master-tracker.md` always reflects current state.

---

## §F Cross-references

| Doc | Purpose |
|---|---|
| `audit/e2e-master-tracker.md` | Living finding tracker (single source of truth) |
| `CLAUDE.md` | Live state board |
| `docs/PATH-2-HANDOFF.md` | Compact-ready handoff |
| `docs/SESSION-START-RITUAL.md` | Session ritual + new §14 addy/agent-skills |
| `~/.claude/skills/playwright-skill/core/` | Playwright bible (24 md) |
| `~/.claude/skills/agent-skills-addyosmani/` | 23 skills + 7 commands + 3 personas |
| `docs/superpowers/specs/2026-05-17-e2e-integration-coverage-master-plan.md` | F-007 wave scope source |
