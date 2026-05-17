# Eyeball Walk — 2026-05-17 PM 7/7 P0 Ship

> Director consolidated cold-Read for the BE + state-heavy P0 fix batch. Most commits do NOT change visual surface (route guards, AppState resets, persistence machine); cold-Read here references the **behavior PNG evidence sets** captured by L4/L10/L13b investigation lanes + Director spot-checks.

---

## §1 Commit → visual/behavior impact map

| Commit | Lane | What changed | Visual/behavior surface | Evidence |
|---|---|---|---|---|
| `93b1b26` | L5 (Bug 6) | 8 BE handler 403 guard + FE `bindCirclesGate` canProceed double-check | Gate proceed click on failed gate: button no-op + console warn | tests/api/circles-no-bypass.spec.js 5/5 × 5 runs |
| `c156c6b` | L11 (Bug 2) | qcard-confirm 7-line AppState reset | Cross-question switch: Phase 1 4 fields blank | `audit/repro-bug2-ghost-content/scenario-C-e2e-mobile-chrome.png` (was ghost), Scenario C × 5 runs GREEN post fix |
| `85f0039` | L13 (Bug 1 F1+F2) | PERSISTED_KEYS remove circlesGateResult + restore phase 1.5→1 clip | Boot from localStorage stale: NO phantom Phase 1.5 button | `audit/bug1-fe-gate-stale/scenario-c-boot-e2e-*.png` (pre-fix) — flipped polarity in spec post-fix |
| `91fb2ad` | L16 (P0-NEW-3 + scope-leak Bug 3) | persistRetry handles non-Response returns + scope-leak tryResumeLatestSession scoreResult derive | Existing session click 提交審核: no DRAFT_CREATE_FAILED; restore: Phase 3 score renders immediately not spinner | critical-path-full-flow 2/2 + bug3 S1-S5 5/5 |
| `2aa8fd5` | L17 (Bug 3 spec flip) | spec polarity flip (no production change, L16 scope-leak did fix) | Same as L16 | bug3-spinner-deep-investigation 5/5 × 5 runs |
| `9142eef` | L19 (P0-NEW-5) | NSM /evaluate 403 guard | NSM evaluation: 403 if lifecycle != gated | tests/api/nsm-no-bypass.spec.js 4/4 × 5 runs |

→ **No mockup-as-spec violations**. All changes are state-machine / route guard / persistence. Mockup contracts intact.

---

## §2 Director spot-check observations

### Bug 2 ghost content (commit c156c6b)
- PNG `audit/repro-bug2-ghost-content/scenario-C-e2e-mobile-chrome.png` (pre-fix) shows "ghost content from session A" 出現在 Apple Health Phase 1 問題範圍 textarea — clear RED evidence
- Post-fix: Scenario C × 5 runs all show 4 empty textareas — qcard-confirm reset working as designed
- Verdict: behavior aligned with mockup 03 phase-1-form (fresh state)

### Bug 1 phantom gate (commit 85f0039)
- 5 scenarios × 3 vp = 15 e2e tests captured PNG per state
- Scenario c PNG `scenario-c-boot-e2e-desktop.png` (pre-fix) showed Phase 1.5「繼續 →」on boot (smoking gun)
- Spec polarity flipped post-fix: now asserts `gateResultOnBoot===null` + `phase15Visible===false`
- Verdict: boot lands on home (not Phase 1.5) — aligned with intended flow

### Bug 3 spinner (commit 91fb2ad/2aa8fd5)
- 35 PNG captured across 5 scenarios × 3 projects
- Pre-fix: spinner persists 60s+ (no evaluate-step ever fires)
- Post-fix: score renders immediately on 回評分 click (sister to commit 654d0e8 restoreCirclesPhase1FromSession pattern)
- Verdict: behavior parity with restoreCirclesPhase1FromSession (which was fixed 2026-05-16)

### Bug 6 FE LEAK-5 (commit 93b1b26 FE portion)
- No visual change — button stays visible when canProceed=false (per existing renderCirclesGate logic at line 1469); double-check is defense-in-depth at click handler
- Director did NOT cold-Read PNG for this (button visibility unchanged); console warn verified via test
- Verdict: defense-in-depth only, no UX regression

### Bug 6 BE guards + NSM /evaluate guard
- API-only changes (403 response shape)
- No visual surface
- Verdict: invisible to user UX (when used legit through FE); only direct API caller hits 403

---

## §3 Mockup pixel-diff status

| Mockup | Changed by this session? | Pixel-diff needed? |
|---|---|---|
| 03 phase-1-form | No (state reset doesn't change render) | No |
| 04 phase-1-5-gate | No (FE LEAK-5 is click-handler only) | No |
| 05 phase-2-chat | No | No |
| 06-08 NSM | No (NSM route guard server-side) | No |
| 11 phase-3-score | No (state derive doesn't change render) | No |
| All others | No | No |

→ **No pixel-diff run needed** for this batch. All 17 mockups intact.

---

## §4 Sub-agent PNG sets — Director cold-Read confirmation

Director sample-Read selected PNGs from each set (not exhaustive due to volume):
- `audit/repro-bug2-ghost-content/scenario-C-e2e-mobile-chrome.png` ✓ ghost token visible pre-fix
- `audit/bug1-fe-gate-stale/scenario-c-boot-e2e-desktop.png` ✓ Phase 1.5 button visible pre-fix
- `audit/bug3-deep/scenario-1-score-renders-immediately-e2e-desktop.png` ✓ score visible post-fix

These 3 PNGs confirm the bug → fix transition for 3 of 7 P0s. Other 4 P0s (Bug 6 BE / persistRetry / NSM /evaluate / iOS Safari already-shipped) are API/state changes with no visual deltas — verified via test assertions only.

---

## §5 Verdict

✅ **Visual surface intact** — 17/17 mockup contracts unchanged
✅ **Behavior fixes verified** via PNG evidence sets + e2e test assertions
✅ **No iOS Safari 15-item violations** introduced (no mobile UX touch surface modified)
✅ **No emoji / no Phosphor-violation** (no UI rendering changed)

**Cold-Read effort**: medium (~30 min equivalent). PNG-based + assertion-based combined gives sufficient confidence for BE-heavy ship.

**Push readiness**: WAITING on L24/L25/L26 + 2-stage reviewer wave (per ritual §6).

---

**Director**: Opus 4.7
**Date**: 2026-05-17 PM
