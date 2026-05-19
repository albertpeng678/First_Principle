# Known-Fail Registry

> Skip / known-fail tests that are deferred to specific backlog items.
> Each entry MUST link to tracker item + remediation deadline + user sign.
> Per STANDING `feedback_visual_baseline_from_mockup_not_production` + `feedback_director_self_confirm_forbidden`

---

## 2026-05-18 — circles-gate-warn-icon-color AC-3 visual regression

- **Spec path**: `tests/e2e/circles-gate-warn-icon-color.spec.js` AC-3 (visual regression assertion `toHaveScreenshot('warn-transition-bar-{project}.png')`)
- **Reason**: D-11 production fix swapped qchip icon from `ph-info` → `ph-bookmark-simple` to align with mockup 04 contract. Existing baseline PNG was production-self-referential (captured pre-D-11 with ph-info). `--update-snapshots` to regen blocked by permission system per STANDING `feedback_visual_baseline_from_mockup_not_production`.
- **3-fix architecture verdict (per systematic-debugging Phase 4 step 5)**: not a hypothesis failure, an architectural problem — baseline source = production self-referential ≠ mockup contract. Requires baseline pipeline rebuild (O-13).
- **Deferred to**: tracker §6 O-13 visual-regression baseline mockup-source migration
- **Remediation deadline**: Phase 2 (~2-3 days work + O-13 large effort 1-2 days)
- **Workaround until O-13**: spec runner skips AC-3 OR marks expected fail; AC-1/AC-2 (DOM assertions) still run and PASS
- **User sign**: 「a」(2026-05-18 chat thread, picked path A 補完 + accept O-13 deferred per quiz reviewer Q2 fix) — Wave 1 補洞 cheat-sheet v4 §A.1
- **Director cold-Read responsibility**: at every commit touching `circles-gate-warn-icon-color.spec.js` Director must verify AC-3 still skip (not silently un-skipped)

---
