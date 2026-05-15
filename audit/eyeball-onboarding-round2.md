# Onboarding Tooltip Round 2 — Eyeball Walk
Director cold-read of 12 PNG screenshots after round 2 fix.
All captures: `audit/png-onboarding-position/`

## Verdict Matrix

| step × viewport | Placement | Overlap? | Verdict |
|---|---|---|---|
| step1-Mobile-360 | Below mode-section, arrow-top | None — tooltip clear below both cards | ✅ |
| step1-iPad | Below mode-section, arrow-top, left-aligned | mode-section fully above tooltip, q-list cards visible below | ✅ |
| step1-Desktop-1280 | Below mode-section, arrow-top, left-aligned at ~x=15 | No overlap with mode-section cards; q-list items readable | ✅ |
| step2-Mobile-360 | Below type-tabs row, arrow-top | type-tabs chip row above tooltip; first q-card partially visible below | ✅ |
| step2-iPad | Below type-tabs, arrow-top | type-tabs (3 chips) fully above; tooltip sits cleanly in gap | ✅ |
| step2-Desktop-1280 | Below type-tabs row, arrow-top | type-tabs fully above tooltip; no right-side overlap with cards | ✅ |
| step3-Mobile-360 | Between mode-section and q-list, arrow-bottom | tooltip nestled in gap between mode-section bottom and q-list card 01 | ✅ |
| step3-iPad | Between mode-section and q-list top, arrow-bottom | tooltip top clear of mode-section bottom; q-list card titles visible below | ✅ |
| step3-Desktop-1280 | Between mode-section and q-list, arrow-bottom | tooltip fits in gap, mode-section not covered; q-card 01 partial visible below | ✅ |
| step4-Mobile-360 | Below first q-card (expanded), arrow-top | tooltip directly below card 01 content; no overlap | ✅ |
| step4-iPad | Below first q-card, arrow-top | tooltip positioned after card 01 bottom; card title/description legible above | ✅ |
| step4-Desktop-1280 | Below first q-card (card 01), arrow-top | tooltip anchored below card 01 boundary, card text readable above | ✅ |

## Summary
All 5 previously-overlapping viewports now resolved:
- step1-iPad: tooltip now below mode-section (not right-side overlapping "步驟加練")
- step1-Desktop-1280: tooltip now below mode-section (not right-side overlapping card)
- step2-Desktop-1280: tooltip now below type-tabs (not right-side overlapping tab row)
- step3-iPad: tooltip now in gap between mode-section and q-list (not inside mode-section card)
- step3-Desktop-1280: tooltip now in gap between mode-section and q-list (not inside mode-section card)

12/12 ✅ — Zero overlap regressions. 5/5 consecutive runs pass (0 flaky).
