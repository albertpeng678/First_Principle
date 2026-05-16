# Memory Hygiene Audit — 2026-05-16

Read-only scan of `/Users/albertpeng/.claude/projects/-Users-albertpeng-Desktop-claude-project-First-Principle/memory/`.
**41 files** total (1 index + 40 entries). One file (`feedback_phase_discipline_mandatory.md`) exists on disk but is **NOT listed in MEMORY.md** — index drift.

---

## Tally per classification

| Tier | Count | Notes |
|---|---|---|
| CURRENT | 22 | Active standing rules, recent (≤14 days) or load-bearing reference docs |
| DUPLICATE | 4 | Two clusters of overlapping mockup/visual rules |
| STALE | 6 | All `project_*` and `*_2026-05-09`/`*_2026-05-10` items shipped per git log |
| SUPERSEDED | 4 | Older feedback rolled up into newer STANDING memos or CLAUDE.md §8 |
| VERIFY | 4 | Concrete file/function references — most still exist, but values drifted |
| INDEX-DRIFT | 1 | `feedback_phase_discipline_mandatory.md` not in MEMORY.md |

---

## Full list grouped

### CURRENT (22)
- `feedback_three_iron_laws.md` (2026-05-16, top-level IL-1/2/3)
- `feedback_e2e_real_data_only.md` (2026-05-16, B7 incident rule)
- `feedback_phase_discipline_mandatory.md` (2026-05-16, NOT in index — add)
- `feedback_test_all_devices_visual.md` (5 days)
- `feedback_karpathy_guidelines_standard.md` (6 days)
- `feedback_two_stage_review_mandatory.md` (6 days)
- `feedback_browser_open_must_notify.md` (6 days)
- `feedback_lock_state_hint_example_always_available.md` (6 days)
- `feedback_hint_example_unified_component.md` (6 days)
- `feedback_adversarial_review_testing.md` (8 days)
- `feedback_observation_vs_bug.md` (11 days)
- `feedback_parallel_subagent_default.md` (12 days)
- `feedback_mockup_show_and_sonnet_make.md` (12 days)
- `feedback_push_directly_to_main.md` (12 days)
- `feedback_verify_with_live_port.md` (12 days)
- `feedback_design_after_verifying_product.md` (13 days)
- `feedback_locked_components_reuse.md` (13 days)
- `feedback_gate_red_blocks_always.md` (13 days)
- `feedback_mockup_strict_compliance.md` (13 days)
- `feedback_typography_system_ui.md` (14 days)
- `feedback_language_traditional_chinese.md` (15 days)
- `feedback_ios_review_before_ship.md` (16 days)
- `reference_playwright_skill_testing_bible.md` (load-bearing)
- `project_circles_methodology.md` (load-bearing reference)

### DUPLICATE (4) — merge candidates
- `feedback_mockup_self_verify_playwright.md` ↔ `feedback_uiux_visual_only.md` — both say "Read every PNG via Read tool"; SP2 era + post-SP2 era
- `feedback_full_sit_uat_uiux.md` ↔ `feedback_test_all_devices_visual.md` — both mandate full 8-viewport runs; latter explicitly cites former as parallel rule
- `feedback_5_random_questions.md` — also captured in `project_circles_methodology.md` §How to Apply
- `feedback_superpower_skills.md` ↔ `feedback_mockup_first.md` — both demand brainstorming→visual→writing-plans→subagent chain

### STALE (6) — projects shipped per git log
- `project_circles_overhaul_status.md` — 12 missing items all fixed (mockup-as-Spec era closed all)
- `project_path2_known_issues.md` — Plan A navbar mobile-360 issue resolved; Path 2 17/17 ship per CLAUDE.md
- `project_sp3_sp4_backend_pending.md` — Path 2 closed; SP3/SP4 plan obsolete
- `project_pending_followups_2026-05-09.md` — 5-mockup sprint shipped, Phase B done
- `project_pending_followups_2026-05-10.md` — Phase B 6 items all shipped per CLAUDE.md ("17/17 全 ship")
- `feedback_write_plan_after_mockup.md` — superseded by `feedback_mockup_first.md` + `feedback_phase_discipline_mandatory.md` (newer + tighter)

### SUPERSEDED (4)
- `feedback_discipline_enforcement.md` (May 2) — discipline mechanism analysis; superseded by `feedback_three_iron_laws.md` + `feedback_two_stage_review_mandatory.md`
- `feedback_card_based_analysis_layout.md` — q-card v4 LOCKED in mockups; lives in mockup 11/14 spec
- `feedback_no_emoji.md` — duplicated in CLAUDE.md §Standing Rules #3
- `feedback_mockup_3_viewports.md` — duplicated in CLAUDE.md §Standing Rules #2

### VERIFY (4) — file paths / line refs that may have rotted
- `project_circles_methodology.md` — references `prompts/circles-evaluator.js` schema (still exists; coachVersion was being migrated per stale SP3 memo — verify current schema)
- `feedback_adversarial_review_testing.md` — 5 prompts named exist (all confirmed in `prompts/`). NSM Step 4 prompt may now exist too (per CLAUDE.md). Update.
- `project_pending_followups_2026-05-09.md` — references `audit/eyeball-plan-a-cross-viewport-final.md` (not listed in `audit/` head)
- `feedback_locked_components_reuse.md` — references "mockups/_shared/components.css" as future; verify not yet implemented

---

## Top 5 safest deletions (paste-ready)

```bash
# 1. Project status memo — 12 items all shipped (Path 2 17/17)
rm "/Users/albertpeng/.claude/projects/-Users-albertpeng-Desktop-claude-project-First-Principle/memory/project_circles_overhaul_status.md"

# 2. Plan A known issue — navbar fix shipped, Path 2 closed
rm "/Users/albertpeng/.claude/projects/-Users-albertpeng-Desktop-claude-project-First-Principle/memory/project_path2_known_issues.md"

# 3. SP3/SP4 backend pending — Path 2 ended; carve-out moot
rm "/Users/albertpeng/.claude/projects/-Users-albertpeng-Desktop-claude-project-First-Principle/memory/project_sp3_sp4_backend_pending.md"

# 4. 2026-05-09 follow-ups — sprint shipped
rm "/Users/albertpeng/.claude/projects/-Users-albertpeng-Desktop-claude-project-First-Principle/memory/project_pending_followups_2026-05-09.md"

# 5. 2026-05-10 follow-ups — Phase B 6/6 shipped per CLAUDE.md
rm "/Users/albertpeng/.claude/projects/-Users-albertpeng-Desktop-claude-project-First-Principle/memory/project_pending_followups_2026-05-10.md"
```

After deletion, prune the corresponding 5 lines from `MEMORY.md`.

---

## Top 5 merges

| # | Source(s) | Target | Rationale |
|---|---|---|---|
| 1 | `feedback_mockup_self_verify_playwright.md` + `feedback_uiux_visual_only.md` | New `feedback_visual_audit_consolidated.md` | Both mandate Playwright + Read PNG; same rule, different eras |
| 2 | `feedback_full_sit_uat_uiux.md` + `feedback_test_all_devices_visual.md` | Keep `feedback_test_all_devices_visual.md` (newer, richer); delete former | Newer file already cross-refs former as parallel rule |
| 3 | `feedback_mockup_first.md` + `feedback_write_plan_after_mockup.md` + `feedback_superpower_skills.md` | New `feedback_workflow_skill_chain.md` | All three mandate brainstorming → visual → writing-plans → subagent chain |
| 4 | `feedback_no_emoji.md` + `feedback_mockup_3_viewports.md` | Delete both (already in CLAUDE.md §8 Standing Rules #2/#3) | Live source of truth is CLAUDE.md |
| 5 | `feedback_discipline_enforcement.md` | Fold §1/§3/§5 highlights into `feedback_three_iron_laws.md` appendix; delete original | Discipline analysis now obsolete with Iron Laws + 2-stage review STANDING |

---

## Other actions

- **Add to `MEMORY.md` index:** `feedback_phase_discipline_mandatory.md` (2026-05-16 rule, on disk but not indexed — risk: invisible to future loads if memory loader only walks the index)
- **VERIFY tier:** spot-check `prompts/` for NSM Step 4 evaluator (CLAUDE.md says 14-tab ship 蘊含 step 4 evaluator); update `feedback_adversarial_review_testing.md` 5→6 stages if so
- **Reference doc:** `project_circles_methodology.md` is 19 days old but load-bearing — recommend stamp "verify against current code" header banner only, do not delete

---

## Net effect if all recommendations applied

- 40 entries → 28 entries (5 deletions + 4 merges collapsing 7→3 + 1 fold-in)
- MEMORY.md index gains 1 line (phase_discipline_mandatory) net change ≈ −11 lines
- All STANDING rules preserved; only stale project memos + duplicates removed
