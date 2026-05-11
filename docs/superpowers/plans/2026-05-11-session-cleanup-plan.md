# Session State Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring repo to clean state after NSM 4-bug fix session — gitignore patch, baseline revert, audit PNG commit, task list scrub.

**Architecture:** 4 independent sub-tasks executed sequentially via Bash + Edit tools. No new code written. Verification by `git status` cleanliness + jest baseline preservation.

**Tech Stack:** git, bash, .gitignore patterns, TaskUpdate API.

**Implementer dispatch prepend (ALL tasks):**

> **Karpathy 4 rules:**
> 1. **Think Before** — read current state before mutating
> 2. **Simplicity First** — minimal diff, no extra cleanup
> 3. **Surgical Changes** — only the listed paths
> 4. **Goal-Driven** — `git status` clean is the goal, nothing else

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `.gitignore` | Modify (append) | Add `*.db` pattern for plugin sqlite cache |
| `tests/visual/baselines/**.png` (6 files) | Revert via `git checkout` | Restore last-committed visual contract bytes |
| `audit/png-nsm-audit-2026-05-11/` | Add (new dir) | NSM audit Round 1 capture (56 PNG, 6.9M) |
| `audit/png-nsm-bug1-longwait/` | Add (new dir) | Bug 1 long-wait capture (6 PNG, 804K) |
| `audit/png-nsm-bug1-vintageB/` | Add (new dir) | Bug 1 Round 4 vintage B capture (12 PNG, 1.6M) |
| `audit/png-nsm-restore-vintages-2026-05-11/` | Add (new dir) | Vintage matrix capture (72+ PNG, 7.4M) |
| `audit/png-mockup-*/` (250 files) | Add modified (re-captures) | Historical bundle PNG re-capture |
| `audit/png-prod-mockup-*/` | Add modified | Production mockup re-capture |
| `audit/png-uat-fix/` (6 untracked) | Add new | UAT fix iPhone-14/SE captures |
| `audit/png-p0-drill-fix/`, `audit/png-p1-preflight/`, `audit/png-phase1/`, `audit/png-phase2/`, `audit/png-bug-F-*`, `audit/png-button-navy-unify/`, `audit/png-issue-4-*`, `audit/png-uat-r5-fullmatrix/`, `audit/png-step4-drift-audit/`, `audit/png-mockup-{02,04,05,07,08,10,11,12,13,14}/`, `audit/png-mockup-05-amend-AF/`, `audit/png-mockup-16-resume/`, `audit/png-prod-mockup-{01,02,03,05,09,11,13}/` | Add modified | Various bundle re-captures |
| `audit/sb*-pixel-diff-report.md` (4 files), `audit/pixel-diff-master-2026-05-09.md`, `audit/pixel-diff-phase-b-ship-readiness-2026-05-10.md` | Add modified | Pixel diff report timestamp updates |
| `tests/visual/diffs/phase-b/*.png` (5 files) | Add modified | SB Phase B diff artifacts |
| Task list (`#1`–`#100`) | TaskUpdate to deleted | Stale tracking cleanup |

---

## Task 1: Patch .gitignore for plugin sqlite cache

**Files:**
- Modify: `.gitignore` (append `*.db` rule at end)

- [ ] **Step 1: Write the failing verification (RED)**

```bash
ls ruvector.db && grep -q "^\*\.db$" .gitignore && echo "PASS — .db ignored" || echo "FAIL — .db not in .gitignore"
```

Expected: `FAIL — .db not in .gitignore`

- [ ] **Step 2: Add `*.db` pattern to `.gitignore`**

Use Edit tool:

```
old_string:
螢幕擷取畫面*.png

new_string:
螢幕擷取畫面*.png

# plugin sqlite caches (e.g., ruvector.db)
*.db
```

- [ ] **Step 3: Run verification (GREEN)**

```bash
grep -q "^\*\.db$" .gitignore && echo "PASS — .db ignored" || echo "FAIL"
git check-ignore ruvector.db && echo "PASS — git ignores ruvector.db"
```

Expected: both PASS

- [ ] **Step 4: Commit**

```bash
git add .gitignore
git commit -m "chore(gitignore): ignore *.db plugin sqlite cache

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 2: Revert 6 modified Layer 1 baseline PNG files

**Files:**
- Revert: `tests/visual/baselines/desktop-1280/00-design-system.png`
- Revert: `tests/visual/baselines/desktop-1280/03-phase-1-form.png`
- Revert: `tests/visual/baselines/desktop-1280/07-nsm-step-2.png`
- Revert: `tests/visual/baselines/desktop-1280/12-phase-3-error-loading.png`
- Revert: `tests/visual/baselines/desktop-1280/15-error-empty-collation.png`
- Revert: `tests/visual/baselines/mobile-360/00-design-system.png`
- Revert: `tests/visual/baselines/mobile-360/02-auth-flow.png`
- Revert: `tests/visual/baselines/mobile-360/03-phase-1-form.png`
- Revert: `tests/visual/baselines/mobile-360/07-nsm-step-2.png`
- Revert: `tests/visual/baselines/mobile-360/12-phase-3-error-loading.png`
- Revert: `tests/visual/baselines/mobile-360/15-error-empty-collation.png`
- Revert: `tests/visual/baselines/tablet-768/00-design-system.png`
- Revert: `tests/visual/baselines/tablet-768/01-circles-home.png`
- Revert: `tests/visual/baselines/tablet-768/03-phase-1-form.png`
- Revert: `tests/visual/baselines/tablet-768/07-nsm-step-2.png`
- Revert: `tests/visual/baselines/tablet-768/12-phase-3-error-loading.png`
- Revert: `tests/visual/baselines/tablet-768/15-error-empty-collation.png`

(Note: 17 files total per `git status`, not 6 — verified via Bash count earlier in session)

- [ ] **Step 1: Write the failing verification (RED)**

```bash
git diff --stat tests/visual/baselines/ | tail -3
```

Expected: shows non-zero modifications to baseline files

- [ ] **Step 2: Revert all baseline PNGs to last-committed bytes**

```bash
git checkout -- tests/visual/baselines/
```

- [ ] **Step 3: Run verification (GREEN)**

```bash
git diff --stat tests/visual/baselines/ | tail -3
```

Expected: empty output (no diffs)

- [ ] **Step 4: No commit needed — revert leaves working tree clean for these paths**

(Skip commit step; this task only verifies revert, no new content shipped.)

---

## Task 3: Stage and commit all audit PNG additions + modifications

**Files:**
- Add new (4 dirs, 16.8M total): `audit/png-nsm-audit-2026-05-11/`, `audit/png-nsm-bug1-longwait/`, `audit/png-nsm-bug1-vintageB/`, `audit/png-nsm-restore-vintages-2026-05-11/`
- Add new (6 files): `audit/png-uat-fix/{bug-A-step2-cached-ctx,bug-A-step2-context,bug-A-step3-context,bug-D-step4-comparison-base,bug-D-step4-comparison-reach}-iPhone-{14,SE}.png`
- Add modified (~250 historical re-capture PNGs across 20+ subdirs)
- Add modified (4 pixel-diff report markdowns + 5 phase-b diff PNGs)

- [ ] **Step 1: Write the failing verification (RED)**

```bash
git status --short | grep -cE "^(\?\?| M) audit/" && echo "audit dirty count above"
```

Expected: ~250+ untracked/modified entries

- [ ] **Step 2: Stage audit/ + tests/visual/diffs/ atomically**

```bash
git add audit/ tests/visual/diffs/
```

- [ ] **Step 3: Verify staged file count matches expected (~280)**

```bash
git diff --cached --name-only | wc -l
```

Expected: ~280 files (audit modified + new + diffs modified)

- [ ] **Step 4: Commit**

```bash
git commit -m "chore(audit-archive): bundle accumulated PNG captures + pixel-diff updates

Adds 4 new audit PNG dirs from NSM 4-bug fix session (16.8M):
  - png-nsm-audit-2026-05-11/ (56 PNG, fresh baseline capture)
  - png-nsm-bug1-longwait/ (6 PNG, hint long-wait probe)
  - png-nsm-bug1-vintageB/ (12 PNG, vintage B restore path)
  - png-nsm-restore-vintages-2026-05-11/ (72+ PNG, 3-vintage matrix)

Each dir referenced as evidence in:
  - audit/eyeball-nsm-2026-05-11-full146.md
  - audit/eyeball-nsm-2026-05-11-supplement.md
  - audit/nsm-comprehensive-audit-2026-05-11.md

Plus ~250 historical bundle PNG re-captures from cumulative spec runs
this session and prior. No baseline drift (Task 2 reverted Layer 1
visual contract baselines to last-committed bytes).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

- [ ] **Step 5: Run verification (GREEN)**

```bash
git status --short | grep -cE "^(\?\?| M) audit/"
```

Expected: 0 (or ≤ small number for genuinely new files added during commit)

- [ ] **Step 6: Push**

```bash
git push origin main
```

Expected: push succeeds, remote has new commit SHA

---

## Task 4: Scrub stale task list entries (#1–#100)

**Files:**
- TaskUpdate batch on tracking system (no source file)

- [ ] **Step 1: Write the failing verification (RED)**

```bash
echo "Task tracker count check — should currently show ≥100 completed entries that are stale"
echo "(visible in task list snapshots in earlier system-reminder messages)"
```

Expected acknowledgment: yes, task list has 105+ completed legacy entries

- [ ] **Step 2: Use TaskUpdate to mark stale tasks deleted**

For each task in IDs `1–100`, call TaskUpdate with `status: "deleted"`. Use TaskList first to confirm IDs that exist.

Preservation cutoff: keep `#101+` (current 2026-05-10/11 NSM session continuity).

Implementer should batch 10 TaskUpdate calls per message for efficiency.

- [ ] **Step 3: Run verification (GREEN)**

Call TaskList. Confirm count of non-deleted entries ≤ 30.

- [ ] **Step 4: No commit needed — task list lives in tracker, not git**

---

## Self-Review

**1. Spec coverage:**

- ✅ `.gitignore` patch — Task 1
- ✅ Baseline revert — Task 2
- ✅ Audit PNG commit (4 new dirs + 250 modified) — Task 3
- ✅ Task list scrub — Task 4
- ✅ Pixel-diff reports + diff PNGs — covered in Task 3 staged via `git add audit/ tests/visual/diffs/`

**2. Placeholder scan:** None.

**3. Type consistency:** All paths use forward slash; baseline revert paths are explicit; commit messages have full body text; verification commands have explicit expected output.

**4. Cross-task dependency:** Task 1 → Task 2 → Task 3 → Task 4 is sequential because:
- Task 1 (gitignore) before Task 3 (commit) so `*.db` ignored at commit time
- Task 2 (baseline revert) before Task 3 (commit) so reverted bytes don't get re-staged
- Task 4 (task list) independent, runs last

---

**Generated by Claude Opus 4.7 — 2026-05-11**
