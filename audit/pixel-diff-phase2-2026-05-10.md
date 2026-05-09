# Pixel-Diff Report — Phase 2 NSM Step 2/3 Hint + Example

**Date:** 2026-05-10
**Phase:** Phase 2 Verification Bundle (Task 12)
**Scope:** NSM Step 2/3 hint modal (Section D) pixel-diff baseline decision

---

## Decision: Section D Modal Baselines NOT Added to master-pixel-diff

### Rationale

Section D is the hint modal — a 3-state dynamic overlay (loading / content / error). Unlike static production renders (e.g., NSM Step 1 card grid, CIRCLES home, Phase 1 form), the modal content state is:

1. **Dynamic AI content** — each call to `/api/nsm-public/step2-hint` returns a different response. There is no stable pixel baseline for "content state" since the bullet text varies by question, field, and model output.

2. **Loading state is timing-dependent** — the spinner animation frame captured at t=0.4s differs from t=0.8s. Pixel-diff against a spinner frame would be 100% unstable without deterministic animation control.

3. **Error state is structural** — the error state (cloud-warning icon + 重試 button) is stable but covers only ~300px of the modal, not a full-page render. The master-pixel-diff spec is designed for full-section production renders against mockup HTML baselines.

### What IS verified instead

- **Functional structure** via Playwright specs (`nsm-circles-parity-phase2.spec.js`, `nsm-step2-hint-modal-close-paths.spec.js`) — 8/8 pass
- **Visual director cold-read** of 21 PNGs (7 scenarios × 3 viewports) — 21/21 PASS (see `eyeball-nsm-circles-parity-phase2.md`)
- **Structural invariants**: modal card present, sparkle icon, 3-state body content, 4 close paths — all Playwright-verified

### Future Path

If pixel-diff for the NSM hint modal is desired in a future task:
- Error state (static): can be snapshotted after mocking `/api/nsm-public/step2-hint` → 500 and stored as baseline
- Loading state (static): can be snapshotted if spinner animation is CSS `animation-play-state:paused` via `--prefers-reduced-motion` test mode
- Content state: should NOT be pixel-diffed due to LLM output variance; functional assertions (bullet list present, `了解了` button, **bold** text) are the appropriate contract

**Estimated effort for future pixel-diff**: 1-2 specs (error + loading structural baseline against mockup), ~0.5 engineer-hours.

---

## Existing pixel-diff coverage (master-pixel-diff.spec.js)

The `tests/visual/master-pixel-diff.spec.js` (merged `ba6c49f`) covers:
- 60 cases across mockups 02/08/12/14/16-D
- 3 viewports per case
- Mockup 07 (NSM Step 2/3) is NOT in the master-pixel-diff scope (covers Step 2/3 static renders, not the Phase 2 modal feature)

Phase 2 structural sections (LOCKED hint-row in Step 2 fields, LOCKED example-expand in Step 3 dims) are inherited from the existing mockup 07 CSS LOCKED pattern and verified visually in `eyeball-nsm-circles-parity-phase2.md` Section 1.

---

## Conclusion

**Option B chosen**: Modal pixel-diff baselines deferred. Honest rationale documented above. All functional + visual verification performed via Playwright specs + director PNG cold-read. Phase 2 SHIP-READY without pixel-diff baseline addition.
