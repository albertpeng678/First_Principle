# iOS Safari 15-item Static Review — Phase B Production Wire

**Date:** 2026-05-10
**Reviewer:** opus director (cold-read code + verbatim against Master Spec §0.2)
**Scope:** Phase B Batch 1+2 production code changes affecting mobile UX
**Files in scope:**
- `public/app.js` — `streamCirclesMessage` (B2), `applyNSMStateOverlay` (B3+B4), `openNSMStep3HintModal` (B5)
- `public/style.css` — `.bubble-coach__cursor` (B2), `.nsm-input.rt-field--locked` etc. (B3+B4)

**Out of scope:** B1 (passive qchip div, no interaction), B6 (backend prompt only)

---

## 15-item verdict

| # | Item | B2 Typewriter | B3+B4 Lock | B5 Step3 Hint | Verdict |
|---|---|---|---|---|---|
| 1 | 100vh 不跳 (use 100dvh) | ✅ no layout height change | ✅ banner 1 row inside existing nsm-body | ✅ existing modal pattern | PASS |
| 2 | safe-area-inset 處理 | ✅ cursor inside chat bubble (no edge) | ✅ submit-bar inherits existing padding-bottom: max(N, env(safe-area-inset-bottom)) | ✅ modal scoped, edges from base modal | PASS |
| 3 | input 16px 防 zoom | ✅ no new inputs | ✅ textareas only become readonly (still ≥16px) | ✅ no inputs in modal (display only) | PASS |
| 4 | Tap highlight 透明 | ✅ inherited globally | ✅ inherited | ✅ inherited | PASS |
| 5 | 動畫 GPU-accelerated | ✅ cursor uses `opacity` keyframe (50% { opacity: 0; }) — GPU-friendly | ✅ no animations added | ✅ existing modal fade-in (transform-based) | PASS |
| 6 | Sticky 穩定 | ✅ no sticky element touched | ✅ banner is in-flow, NOT sticky; submit-bar sticky inherits existing pattern | ✅ no sticky | PASS |
| 7 | Momentum scroll | ✅ unchanged | ✅ unchanged | ✅ modal body uses overflow-y: auto | PASS |
| 8 | 鍵盤彈出 layout | ✅ no input change | ✅ readonly textareas don't trigger keyboard | ✅ modal display-only | PASS |
| 9 | Modal focus trap | N/A | N/A | ✅ B5 modal mirrors B (Step 2 hint modal) verbatim — same focus trap, body scroll lock, Esc + overlay click close | PASS |
| 10 | 無 FOUC | ✅ cursor CSS verbatim from mockup 05 §G LOCKED (already in baseline cycle) | ✅ rt-field--locked CSS already from mockup 03 §E port; new .nsm-input.rt-field--locked is additive (not breaking initial render) | ✅ no new CSS | PASS |
| 11 | Touch target ≥ 44px | N/A (cursor is decorative, not tappable) | 🟡 「查看評分結果 →」navy button — mirror mockup 07 v3 §D submit-bar height (need device verify) | 🟡 提示 button = `field__hint-link` (existing size, need verify ≥44px on mobile)| **PASS pending live UAT** |
| 12 | Long content 不爆版 | ✅ streaming text inside .bubble--coach uses existing word-break: break-word | ✅ banner body uses break-word; locked textareas keep existing wrap | ✅ modal body has overflow-y: auto + word-wrap | PASS |
| 13 | backdrop-filter -webkit-prefix | ✅ no new backdrop-filter | ✅ no new backdrop-filter | ✅ modal overlay inherits existing prefix | PASS |
| 14 | 滾動性能 60fps | 🟡 35 renders/sec during streaming — sonnet B2 self-audited "acceptable for Phase 2 chat DOM size; no jank risk" but **needs live iOS device verify**. Mitigation: clearTimeout on AbortError prevents leak after navigation. | ✅ no continuous animation | ✅ modal load is single fetch + render | **PASS pending live UAT** |
| 15 | 無 layout thrashing | 🟡 each `render()` call triggers full app re-render; at 35/sec during streaming this could cause thrash on weaker devices. Mitigation: render() is pure HTML string replace (single innerHTML write), so reflow is contained. **Needs Safari Devtools Performance verify on iPhone-SE (oldest device profile).** | ✅ static DOM after 1 render | ✅ modal scope contained | **PASS pending live UAT** |

---

## Summary

**12/15 ✅ PASS via static analysis**

**3/15 🟡 PASS pending live UAT:**
- #11 touch target ≥ 44px (B3+B4 + B5 buttons need device measure)
- #14 60fps during typewriter streaming (B2 needs Safari Devtools timeline)
- #15 layout thrashing during typewriter (B2 needs iPhone-SE profile)

**No 🔴 FAIL.** All 3 yellow items are B2 typewriter performance + B3/B5 button touch ergonomics — all expected per design + sonnet self-audit, but require physical device confirmation per CLAUDE.md「Layer 7 — User 真機抽驗」.

---

## Recommendations

1. **B2 typewriter throttle:** if iPhone-SE (oldest device) shows jank, lower throttle from 28ms (35 cps) to 33ms (30 cps) — still within mockup 05 §G contract (30-40 cps range). The 28ms upper-bound was sonnet's choice; can ratchet down without spec violation.

2. **Touch target:** if B3 「查看評分結果」or B5 「提示」 button measures < 44px on iPhone-SE, add `min-height: 44px` to button class globally — mockup 03 §E LOCKED submit-bar buttons should already be ≥44px tall.

3. **Layout thrashing:** if `render()` profiling shows >16ms paint during streaming, batch multiple deltas before one render (e.g. 100ms aggregation) — this would reduce render frequency from 35/sec to 10/sec while still appearing smooth.

---

## Live UAT verification needed

User to walk through on real iPhone (Safari):
- [ ] Phase 2 chat: type a question, observe coach reply streams char-by-char with blinking cursor; cursor disappears on done; no jank during scroll
- [ ] NSM Step 2 lock state: complete an evaluation, return to Step 2; banner visible at top, form fields grey/readonly, hint+example buttons still tappable + open modal correctly
- [ ] NSM Step 3 dynamic hint: tap 提示 button on any of 4 dim cards; modal opens, AI hint loads, scroll within modal works; close modal returns focus
- [ ] Touch target measurement: try tapping 「查看評分結果 →」navy button — should not require pixel-precision tap

---

**Verdict for ship:** ✅ APPROVE pending live UAT for 3 yellow items. No blocking bug from static analysis.
