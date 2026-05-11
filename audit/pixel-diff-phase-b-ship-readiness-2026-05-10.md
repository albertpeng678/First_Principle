# Pixel-Diff Report — Phase B Ship Readiness

_Generated: 2026-05-11T03:46:48.995Z_

## Scope

4 sections × Desktop-1280 (surgical; reuse master-pixel-diff.spec.js infra)
- Mockup 14 §A: NSM Step 4 qchip wire (Phase B Batch 1 / B1)
- Mockup 05 §G: Phase 2 typewriter State C done (Phase B Batch 1 / B2)
- Mockup 07 §D: NSM Step 2 locked state (Phase B Batch 2 / B3)
- Mockup 07 §E: NSM Step 3 locked state (Phase B Batch 2 / B4)

## Results

| Mockup | Section | Diff % | Verdict |
|---|---|---|---|
| 14 §A qchip (B1) | Desktop-1280 | 5.59% | 🟠 5.59% |
| 05 §G typewriter State C (B2) | Desktop-1280 | 2.17% | 🟡 2.17% |
| 07 §D Step 2 locked (B3) | Desktop-1280 | 3.20% | 🟡 3.20% |
| 07 §E Step 3 locked (B4) | Desktop-1280 | 3.34% | 🟡 3.34% |

## Verdict bands

- ✅ < 0.5% — pixel 契約嚴格達標
- 🟡 < 5% — 結構 OK，cosmetic drift
- 🟠 < 15% — state diff 預期（content diff / frame height padding）
- 🔴 ≥ 15% — 結構偏離需排查
- 🔲 gap — frame label 未找到

## Expected diff sources for this run

1. **14 §A**: mockup frame is fullPage clip; production is fullPage screenshot padded to same. qchip 題目情境 bar is hardcoded in mockup (Spotify Podcast scenario text) vs dynamic AppState injection. Minor text rendering delta expected.
2. **05 §G State C**: mockup shows static "全文 + cursor.is-done" frame; production uses injected StreamingTurn with matching deltaText. Exact text differs (mockup hardcoded zh-TW sentence vs injected fixture). Content diff expected 5-20%.
3. **07 §D/§E**: mockup shows tall static locked frame; production clips to 1240px viewport. Banner + rt-field--locked + submit-bar change all structurally verified. Height padding drives % up on desktop.

---

_Spec: `tests/visual/phase-b-ship-readiness.spec.js`_