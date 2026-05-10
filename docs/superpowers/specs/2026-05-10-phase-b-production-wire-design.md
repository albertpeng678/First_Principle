# Phase B — Production Wire-up Design Spec

**Goal:** Wire up production code to honor 5 mockup-amend contracts shipped in Phase A + audit nsm-evaluator depth vs circles-evaluator.

**Scope:** Pure frontend wire-up + 1 backend endpoint mirror + 1 prompt file mirror + 1 prompt audit. **NO** new business logic, **NO** schema change, **NO** jest baseline drift (162/162 must hold).

**Master Spec ref:** `docs/superpowers/specs/2026-05-02-frontend-rewrite-master-spec.md`
**Mockup contracts:** mockup 14 §A / mockup 05 §G / mockup 07 v3 §D §E (all 放行 + LOCKED)

---

## 6 Items

### B1 — NSM Step 4 qchip wire
- **Mockup contract:** `docs/superpowers/specs/mockups/2026-05-02-frontend-rewrite/14-nsm-step-4.html` §A LOCKED qchip persistent component
- **Files:** `public/app.js` `renderNSMStep4()` at line 2201
- **What to do:** Inject qchip render at top of Step 4 report, mirror mockup 14 §A markup. qchip data source: `AppState.circlesSession.question` + `AppState.circlesSession.drill_meta` (existing fields used by Phase 2 chat qchip)
- **Reference pattern:** mockup 13 §A uses same qchip — production已經 wire 在 Phase 4 final（renderPhase4Final），可以複用 helper

### B2 — Phase 2 typewriter
- **Mockup contract:** `docs/superpowers/specs/mockups/2026-05-02-frontend-rewrite/05-phase-2-chat.html` §G LOCKED typewriter
- **Files:** `public/app.js` `streamCirclesMessage()` line 1109-1198 + `style.css` (cursor blink)
- **What to do:**
  - Remove line 1170 `// no re-render on each delta` short-circuit
  - Add per-delta render at 30-40 chars/sec throttle (use simple setTimeout-based queue OR `requestAnimationFrame` with chars/frame budget)
  - Add `.bubble--coach__cursor` element appended to streaming bubble; on `done` arrival add `.is-done` class
- **Reference contract:** mockup 05 §G CSS `cursor-blink` keyframes (already LOCKED + committed)
- **Performance budget:** Single SSE delta could be 5-200 chars. Throttle so user sees 30-40 chars/sec smooth fade-in, not chunked bursts

### B3 — NSM Step 2 lock state
- **Mockup contract:** mockup 07 v3 §D LOCKED locked state
- **Files:** `public/app.js` add `applyNSMStateOverlay(html, step)` mirroring `applyPhase1StateOverlay` at line 3285
- **What to do:**
  - When `AppState.nsmEvalResult` exists for current step → wrap render with overlay
  - Overlay injects: `.banner.banner--locked` 「⊕ 已評分完成 — 內容鎖定，可繼續查看提示與範例」+ `.rt-field--locked` class on textarea + submit-bar variant 移除原 submit + 加「查看評分結果 →」navy button
  - **Per standing rule `feedback_lock_state_hint_example_always_available.md` UNIVERSAL**: hint+example button 永遠可用，**不**動 `.field__hint-row`
- **Reference pattern:** `applyPhase1StateOverlay` line 3285-3357 — copy structure verbatim, swap selectors for NSM (e.g. `.nsm-textarea` instead of `.rt-field__solo`)

### B4 — NSM Step 3 lock state
- Same as B3 but for Step 3 (4-dim form). Share `applyNSMStateOverlay(html, step)` helper from B3, branch on `step` arg for selector differences.

### B5 — NSM Step 3 dynamic hint frontend wire
- **Mockup contract:** mockup 07 v3 §B Step 3 - 4 dim cards each with「提示」+「範例答案」buttons
- **Files:**
  - **Create:** `prompts/nsm-step3-hint.js` (mirror `prompts/nsm-step2-hint.js`)
  - **Modify:** `routes/nsm-public.js` add `/step3-hint` route mirror `/step2-hint`
  - **Modify:** `public/app.js` add `openNSMStep3HintModal(field)` mirror `openNSMStep2HintModal` at line 3753
- **Field guidance map for nsm-step3-hint.js:** 4 dimensions per type — reach / depth / frequency / impact (attention type) OR breadth / depth / frequency / expansion (saas type) OR (4 fields per type from `NSM_DIMENSION_CONFIGS` in app.js)
- **Adversarial:** ship adversarial sweep `tests/adversarial/nsm-step3-hint.spec.js` ≥6 cases (attention + saas variants × 4 dims sample)

### B6 — nsm-evaluator vs circles-evaluator depth audit
- **Files:** `prompts/nsm-evaluator.js` (131 lines) vs `prompts/circles-evaluator.js` (129 lines)
- **What to do:**
  - Read both fully, compare structure (sections / rubric depth / good_answer_shape / refusal guards)
  - If parity ✅ → audit doc only, no commit
  - If gaps found → strengthen nsm-evaluator + add adversarial sweep cases
- **Audit doc target:** `audit/nsm-vs-circles-evaluator-depth-audit-2026-05-10.md`

---

## Sequencing

**Batch 1 (parallel — independent UI tasks):**
- B1 NSM Step 4 qchip wire (1 file, ~30 lines)
- B2 Phase 2 typewriter (1 file + CSS, ~50 lines)
- B5 NSM Step 3 dynamic hint wire (3 files, ~150 lines + adversarial 80 lines)

**Batch 2 (sequential — shared helper):**
- B3 + B4 NSM lock state (1 helper function `applyNSMStateOverlay`, used by both — single task)

**Batch 3:**
- B6 audit (read-only first, may add commits if drift found)

---

## Quality Gates

Per CLAUDE.md ship-before checklist:
- [ ] jest 162/162 (baseline 不破)
- [ ] Playwright suite × 8 viewport (chromium minimum)
- [ ] mockup ↔ production pixel-diff for affected screens (mockup 05 / 07 v3 / 14)
- [ ] Director cold Read all PNGs, eyeball walk doc per task
- [ ] iOS Safari 15-item static review (B2 typewriter affects mobile UX)
- [ ] Adversarial sweep for B5 (per memory `feedback_adversarial_review_testing.md`)
- [ ] CLAUDE.md state board update post-ship

---

## Out of scope

- Changing OpenAI prompts beyond B5 hint + B6 evaluator (if drift)
- Changing DB schema or session creation logic
- Rewriting render functions wholesale (surgical edits only per Karpathy)
- New mockup amends (Phase A 全結束)
