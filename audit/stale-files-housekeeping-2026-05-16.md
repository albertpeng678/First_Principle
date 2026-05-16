# Stale Files Housekeeping Audit — 2026-05-16

**Auditor:** Claude Code (read-only)
**Method:** git log timestamps + cross-reference against active specs/plans + current CLAUDE.md
**NO FILES DELETED** — inventory only. Director reviews before any `git rm`.

## Executive Summary

| Tier | Count | Disk |
|---|---|---|
| DELETE_SAFE (≥95% conf) | 85 | ~278 MB |
| DELETE_PROBABLE (70-85%) | 28 | +20 MB |
| REVIEW_NEEDED (40-60%) | 12 | varies (worktrees 650 MB) |
| KEEP | 150+ | (active) |

**Total recoverable (safe + probable + worktrees if approved):** ~928 MB

## Tier 1: DELETE_SAFE

### S-01: `audit/png-*` 42 dirs (~250 MB)
- Last touch: 2026-05-11
- Capture specs completed; outputs archived in `tests/visual/baselines/`
- Exception: keep png-mockup-05/11/13 (still referenced by mockup specs)

### S-02: `tests/visual/diffs/master/` (~26 MB)
- 2026-05-11 archive; production baselines now in `tests/visual/baselines/`

### S-03: `tests/visual/diffs/sb{4-5,6,7,9b}` (4 dirs, ~3 MB)
- Plan B ship bundle audits, all merged

### S-04: `audit/eyeball-plan-{a,b,c,d,e,sb*}.md` (18 files, ~150 KB)
- Wave A/B/C/D design docs pre-master-spec lockdown (`2026-05-02`)

### S-05: `audit/{sp1,sp1.5,sp4}-{signoff,bugfix,log}.md` (12 files, ~70 KB)
- Shipped sprint closures, compliance only in git log

### S-06: `audit/repro-bug{1,2,3}/` + `audit/debug-rail{,2}/` + `audit/director-uat-prod-*` (8 dirs)
- Historical debugging screenshots, root cause fixed + shipped

### S-07: 5 skipped capture spec files (~25 KB)
- `tests/visual/capture-mockup-02-pngs.spec.js` (test.skip)
- `tests/visual/capture-prod-mockup-02-pngs.spec.js`
- `tests/visual/capture-phase-b-b2-typewriter.spec.js`
- `tests/visual/capture-phase2-chat-audit.spec.js`
- `tests/visual/capture-uat-fix-issue-a-search-empty.spec.js`

## Tier 2: DELETE_PROBABLE

### S-08: `audit/eyeball-nsm-circles-parity-{phase1,phase2}.md` (~36 KB)
- 2026-05-10, Phase 2 shipped 2026-05-12

### S-09: `audit/eyeball-phase2-chat-audit-2026-05-10.md` (12 KB)

### S-10: `audit/pixel-diff-phase-b-ship-readiness-2026-05-10.md` (2 KB)

### S-11: Pre-master-spec design docs (15 files, ~180 KB)
`docs/superpowers/specs/2026-04-{20..28}-*.md` — superseded by `2026-05-02-frontend-rewrite-master-spec.md`

### S-12: `audit/eyeball-nsm-step2-circles-parity.md` (5 KB)

### S-13: `audit/{nsm-example-pilot,nsm-vs-circles-evaluator}*.md` (5 files, ~50 KB)

## Tier 3: REVIEW_NEEDED

### S-14: `audit/pixel-diff-master-2026-05-09.md` (40 MB)
- 281 test cases; verify no test harness reads it before delete

### S-15: Data pollution receipts (2 files, ~5 KB)
- KEEP `audit/data-pollution-{report,executed}-2026-05-16.md` for compliance

### S-16: `.claude/worktrees/agent-*` × 10 (~650 MB) ⚠️ HIGH RISK
- Locked background-agent worktrees; check `git worktree list`

### S-17: `playwright-report/` + `test-results/` (~976 KB)
- Ephemeral, regenerated on each run; safe anytime

## Tier 4: KEEP

- `tests/visual/baselines/**` (production baselines)
- `tests/visual/_quarantine_prod_legacy/**` (Stage 0 compliance)
- `CLAUDE.md` / `docs/PATH-2-HANDOFF.md`
- Memory files
- Master specs `2026-05-02+` (LOCKED)
- Current Stage 1A/1B/1C/1D/Lifecycle/Resilience specs + plans
- All active capture specs (non-skip'd)
- jest 410/428 regression suite
- All factories / fixtures / helpers

---

## Top 5 Safest One-Shot Deletions

```bash
# 1. audit/png-* (except 05/11/13) — 250 MB
git rm -r audit/png-button-navy-unify audit/png-coach-overlay-prod \
  audit/png-exhaustive-nsm audit/png-hotfix audit/png-mockup-02 \
  audit/png-mockup-04 audit/png-mockup-07 audit/png-mockup-08 \
  audit/png-mockup-10 audit/png-mockup-14 audit/png-mockup-16-resume \
  audit/png-nsm-full-scan audit/png-nsm-restore-vintages-2026-05-11 \
  audit/png-phase-b audit/png-phase1 audit/png-phase2 \
  audit/png-prod-mockup-01 audit/png-prod-mockup-02 audit/png-prod-mockup-03 \
  audit/png-prod-mockup-06 audit/png-prod-mockup-09 audit/png-prod-mockup-12 \
  audit/png-prod-mockup-13 audit/png-step2-locked-prod audit/png-step4-drift-audit \
  audit/png-uat-bundle-prod audit/png-uat-fix audit/png-uat-r5-fullmatrix \
  audit/png-uat-suite-D-H audit/png-user-nsm-bugs audit/png-verify-3-fixes \
  audit/png-walk-all-sessions audit/png-p0-drill-fix audit/png-p1-preflight \
  audit/png-onboarding-position audit/png-nsm-bug1-longwait \
  audit/png-nsm-bug1-vintageB audit/png-nsm-audit-2026-05-11

# 2. tests/visual/diffs/master — 26 MB
git rm -r tests/visual/diffs/master

# 3. Skipped capture specs — 25 KB
git rm tests/visual/capture-mockup-02-pngs.spec.js \
  tests/visual/capture-prod-mockup-02-pngs.spec.js \
  tests/visual/capture-phase-b-b2-typewriter.spec.js \
  tests/visual/capture-phase2-chat-audit.spec.js \
  tests/visual/capture-uat-fix-issue-a-search-empty.spec.js

# 4. Wave A-E eyeball docs — 150 KB
git rm audit/eyeball-plan-a-cross-viewport-final.md \
  audit/eyeball-plan-b-sb{1..9}.md audit/eyeball-plan-d-sb1-fix.md \
  audit/eyeball-plan-e-final-ship.md

# 5. Old sprint signoffs — 70 KB
git rm audit/sp1-signoff.md audit/sp1.5-*.md audit/sp4-backend-signoff.md
```

## Top 5 REVIEW Items (do NOT auto-delete)

1. `pixel-diff-master-2026-05-09.md` (40 MB) — check test harness refs first
2. `.claude/worktrees/agent-*` × 10 (650 MB) — confirm no active agent sessions
3. Pollution receipts — keep latest 2026-05-16
4. Pre-master-spec design docs — verify zero git refs before delete
5. `playwright-report/` + `test-results/` — safe anytime
