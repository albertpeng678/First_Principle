# Plan B Phase 2 Chat — Mockup 05 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement CIRCLES Phase 2 對話練習 view per mockup 05 visual contract — 6 sections (A 對話開頭 / B 中段 / C streaming / D 對話足夠 / E 結論填寫 / F 已評分唯讀) × 3 viewports.

**Architecture:** Pure frontend rewrite per Path 2. New `renderCirclesPhase2()` + 5 sub-renderers in `public/app.js`; SSE wire-up via `fetch` ReadableStream; CSS verbatim copy from mockup 05 (line 240-660). Backend / DB / prompts not touched.

**Tech Stack:** Vanilla JS (no framework), Phosphor icons, system-ui font, SSE streaming, localStorage persistence.

**Spec:** `docs/superpowers/specs/2026-05-08-mockup-05-phase2-chat-design.md`
**Mockup:** `docs/superpowers/specs/mockups/2026-05-02-frontend-rewrite/05-phase-2-chat.html` (1953 lines, 18 frames opus-verified `audit/png-mockup-05/`)

---

## File Structure

**Modify:**
- `public/app.js` — replace `renderCirclesStub()` call site at line 214 with `renderCirclesPhase2()`; add 5 sub-renderers + SSE handler + AppState fields + binders
- `public/style.css` — append Phase 2 chat CSS section (verbatim from mockup line 240-660 — chat-body / bubble / conclusion-box / locked-banner / chat-input-bar / .pill—conclude / .bubble__streaming animation)

**New tests:**
- `tests/visual/phase2-chat.spec.js` — 8 specs covering all 6 sections + SSE happy/error path

**Update:**
- `CLAUDE.md` — Plan B Phase 2 row + last-updated
- `audit/eyeball-mockup-05.md` (new) — 18-PNG cross-viewport audit doc

---

## Sub-bundle Decomposition

Given 6-section scope + SSE wiring + 12 new AppState fields, split into **2 sub-bundles** dispatched sequentially:

- **SB-Phase2-A**: Sections **A + B** + AppState scaffolding + base CSS — foundation
- **SB-Phase2-B**: Sections **C + D + E + F** + SSE + conclusion-check wire-up + locked overlay — builds on SB-Phase2-A

---

## SB-Phase2-A — Sections A + B + Foundation

### Task A1: AppState scaffolding + Phase 2 router

**Files:**
- Modify: `public/app.js:55-100` (AppState block — add 6 fields)
- Modify: `public/app.js:214` (`return renderCirclesStub()` → conditional)

- [ ] **Step 1: Write failing test**

```javascript
// tests/visual/phase2-chat.spec.js
test('Phase 2 router: circlesPhase=2 + selected question → renderCirclesPhase2 not stub', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('.navbar');
  await page.evaluate(() => {
    window.AppState.view = 'circles';
    window.AppState.circlesPhase = 2;
    window.AppState.circlesSession = { id: 'test-session' };
    window.AppState.circlesSelectedQuestion = { id: 'q1', company: 'Spotify', industry: 'streaming', problem_statement: '...' };
    window.AppState.circlesDrillStep = 'C1';
    window.AppState.circlesConversation = [];
    window.renderApp();
  });
  await expect(page.locator('[data-view="circles"][data-phase="2"]')).toBeVisible();
  await expect(page.locator('text=Plan B 實作')).toHaveCount(0); // stub gone
});
```

- [ ] **Step 2: Run test → FAIL** (renderCirclesPhase2 不存在)

```bash
npx playwright test --config=tests/visual/playwright.config.js tests/visual/phase2-chat.spec.js -g "router" --project=Desktop-1280
```

- [ ] **Step 3: Add AppState fields + router**

```javascript
// In AppState block
circlesPhase2Streaming: false,
circlesPhase2StreamingTurn: null,        // { userMessage, deltaText }
circlesPhase2ConclusionMode: false,
circlesPhase2ConclusionDraft: '',
circlesPhase2ExampleOpen: false,
circlesPhase2CoachHintExpanded: {},     // { turnIdx: boolean }

// Router — replace line 214 area
if (AppState.circlesPhase === 2 && AppState.circlesSession && AppState.circlesSelectedQuestion) {
  return renderCirclesPhase2();
}
return renderCirclesStub();

// Stub renderer — minimum to pass router test
function renderCirclesPhase2() {
  return '<div data-view="circles" data-phase="2"><div class="phase2-loading">Phase 2 placeholder</div></div>';
}
```

- [ ] **Step 4: Run test → PASS**

- [ ] **Step 5: Commit**

```bash
git add public/app.js tests/visual/phase2-chat.spec.js
git commit -m "feat(plan-b-phase2): SB-A Task 1 — AppState + Phase 2 router scaffolding"
```

### Task A2: Section A — empty chat + icebreaker box

**Files:**
- Modify: `public/app.js` (replace stub `renderCirclesPhase2` body)
- Modify: `public/style.css` (append Phase 2 base CSS verbatim mockup line 240-260 + 269-305 chat-body / .qchip__compact / .icebreaker)

- [ ] **Step 1: Write failing test**

```javascript
test('Section A: empty conversation renders navbar + drill-pill row + phase-head + qchip__compact + icebreaker box + chat-input', async ({ page }) => {
  await page.goto('/'); await page.waitForSelector('.navbar');
  await page.evaluate(() => {
    Object.assign(window.AppState, {
      view: 'circles', circlesPhase: 2,
      circlesSession: { id: 's1' },
      circlesSelectedQuestion: { id: 'q1', company: 'Spotify', industry: 'streaming', product: 'Podcast', problem_statement: '...', question_type: 'design' },
      circlesDrillStep: 'C1', circlesConversation: [],
      circlesMode: 'drill',
    });
    window.renderApp();
  });
  await expect(page.locator('.navbar')).toBeVisible();
  await expect(page.locator('.drill-pill')).toHaveCount(7);
  await expect(page.locator('.phase-head__num')).toHaveText('2');
  await expect(page.locator('.phase-head__eyebrow')).toContainText('PHASE 2');
  await expect(page.locator('.phase-head__title')).toContainText('C · 澄清情境');
  await expect(page.locator('.qchip__compact')).toBeVisible();
  await expect(page.locator('.icebreaker')).toBeVisible();
  await expect(page.locator('.icebreaker').first()).toContainText('開始提問方向');
  await expect(page.locator('.chat-body .bubble')).toHaveCount(0); // empty
  await expect(page.locator('.chat-input-bar textarea')).toBeVisible();
});
```

- [ ] **Step 2: Run test → FAIL**

- [ ] **Step 3: Implement Section A renderer**

(Implementer fills in render code — verbatim copy from mockup 05 line 665-849 Section A markup, with `{{interp}}` for dynamic data. Reuse LOCKED components from existing `renderCirclesPhase1` for navbar / drill-pill / phase-head / qchip__compact patterns.)

Step-specific icebreaker copy table (per `circlesDrillStep`):
- C1: 「先與被訪談者澄清題目本身的邊界 — 具體在問什麼問題、涵蓋哪些功能或場景、有哪些業務限制不能突破。」
- I:  「了解目標用戶 — 他們是誰、什麼情境下會使用、目前如何解決問題。」
- R:  「挖掘真實需求 — 痛點頻率、嚴重度、現有方案的不足。」
- C2: 「排序需求 — RICE / ICE / 戰略對齊。」
- L:  「列方案 — 至少 2-3 個獨立方案，包含明顯不同 mechanism。」
- E:  「評估每個方案 — 優點 / 缺點 / 風險 / 成功指標。」
- S:  「總結並設定 tracking — 主推薦方案 + 4 維度追蹤。」

- [ ] **Step 4: Run test → PASS**

- [ ] **Step 5: Append CSS verbatim from mockup 05 line 240-310** + run visual test

- [ ] **Step 6: Commit**

```bash
git add public/app.js public/style.css tests/visual/phase2-chat.spec.js
git commit -m "feat(plan-b-phase2): SB-A Task 2 — Section A empty chat + icebreaker"
```

### Task A3: Section B — 3 bubble types + turn counter

**Files:**
- Modify: `public/app.js` (renderChatBubble helper × 3 variants + bubble--coach hint toggle binder)
- Modify: `public/style.css` (append .bubble base + .bubble--user + .bubble--interviewee + .bubble--coach + .bubble--coach__hint-toggle/-content from mockup line 279-345 verbatim)

- [ ] **Step 1: Write failing test**

```javascript
test('Section B: 2-turn conversation renders 3 bubble types + turn-counter pill', async ({ page }) => {
  // ... seed 2 turns with conversation array
  // Assert .bubble--user count, .bubble--interviewee count, .bubble--coach count
  // Assert turn-counter chip in navbar shows "2 輪"
  // Assert coach hint toggle clickable + expands hint-content
});
```

- [ ] **Step 2-5**: implement + verify + commit

```bash
git commit -m "feat(plan-b-phase2): SB-A Task 3 — Section B 3-bubble + turn counter + coach hint toggle"
```

### Task A4: Section A+B PNG audit + commit

- [ ] Capture 6 PNGs (A/B × mobile/tablet/desktop) — modify `tests/visual/capture-mockup-05-pngs.spec.js` to include production-render variants
- [ ] Director (opus) Read 6 PNGs + comment per viewport
- [ ] Append `audit/eyeball-mockup-05.md` Section A+B verdict

---

## SB-Phase2-B — Sections C + D + E + F + SSE + Conclusion

### Task B1: Section C — Streaming SSE + 3-dot bubble

**Files:**
- Modify: `public/app.js` — add `streamCirclesMessage(userMessage)` async fn using `fetch` + `getReader()` for SSE; updates `AppState.circlesPhase2Streaming` + `circlesPhase2StreamingTurn`; on `done:true` push to `circlesConversation`
- Modify: `public/style.css` — append `.bubble__streaming` 3-dot animation (mockup line 348-363 verbatim)

- [ ] Test: streaming bubble visible + chat-input placeholder「等待回應中…」 + send icon disabled while streaming
- [ ] Test: SSE chunks accumulate; on done, 3-dot bubble replaced with full 3-role bubbles
- [ ] Test: SSE error → inline error banner + 「重新發送」 button (mockup 16 §C contract)
- [ ] Commit: `feat(plan-b-phase2): SB-B Task 1 — Section C streaming SSE + 3-dot bubble + error fallback`

### Task B2: Section D — turns ≥ 3 submit pill

**Files:**
- Modify: `public/app.js` — conditional render of `<button class="conclude-pill">對話足夠了，提交這個步驟 →</button>` when `circlesConversation.length >= 3`
- Modify: `public/style.css` — append `.conclude-pill` styles (mockup search around line 1293-1500)

- [ ] Test: turns < 3 → no pill; turns ≥ 3 → pill visible + clicking sets `circlesPhase2ConclusionMode = true`
- [ ] Commit: `feat(plan-b-phase2): SB-B Task 2 — Section D 對話足夠 submit pill`

### Task B3: Section E — Conclusion box + dim chat + actions

**Files:**
- Modify: `public/app.js` — `renderConclusionBox()` + `bindConclusionActions()` + Layer 1 minLength gate (conclusionText ≥ 30); on submit → POST `/conclusion-check` then `/evaluate-step`; persist draft to localStorage `pmdrill:phase2:conclusion:{sessionId}:{step}`
- Modify: `public/style.css` — append `.conclusion-box*` + `.conclusion-actions*` + `.chat-body--dimmed` (45% opacity + pointer-events:none) verbatim from mockup line 492-620

- [ ] Test: conclusion mode dim chat + 2px navy 頂線 visible + box renders
- [ ] Test: example toggle expand/collapse
- [ ] Test: textarea below floor → submit disabled; meeting floor → enabled
- [ ] Test: 確認提交 click → POST `/conclusion-check` → on ok POST `/evaluate-step` → AppState.circlesPhase = 3
- [ ] Test: 繼續對話 click → `circlesPhase2ConclusionMode = false` + draft preserved in localStorage
- [ ] Commit: `feat(plan-b-phase2): SB-B Task 3 — Section E conclusion-box + check + evaluate-step wire`

### Task B4: Section F — Locked banner + 2-button row

**Files:**
- Modify: `public/app.js` — `renderCirclesPhase2Locked()` overlay path; entry condition `circlesPhase1.locked === true || step_scores[currentStep]` exists
- Modify: `public/style.css` — append `.locked-banner` (mockup line 621-660 verbatim)

- [ ] Test: locked entry → banner visible + chat-input replaced with 2-button row + chat history shown read-only
- [ ] Test: 上一步（看框架）→ AppState.circlesPhase = 1 (readonly view via existing locked overlay)
- [ ] Test: 回評分 → AppState.circlesPhase = 3
- [ ] Commit: `feat(plan-b-phase2): SB-B Task 4 — Section F locked banner + 2-button row`

### Task B5: SB-Phase2-B PNG audit + iOS 15-item + final commit

- [ ] Capture 12 PNGs (C/D/E/F × mobile/tablet/desktop) production render
- [ ] Director Read all 12 PNGs vs mockup 05 audit/png-mockup-05/section-{C,D,E,F}-{mobile,tablet,desktop}.png — line-by-line drift check
- [ ] iOS 15-item static review specifically for chat-input keyboard / streaming / safe-area
- [ ] Append `audit/eyeball-mockup-05.md` Section C-F verdict
- [ ] Update `CLAUDE.md` row + last-updated
- [ ] Final commit: `docs(plan-b-phase2): 18-PNG audit + iOS 15-item + CLAUDE.md`

---

## Self-Review (post-write)

Spec coverage: A/B/C/D/E/F sections + state matrix + AppState + backend endpoints + Layer 1 minLength + risk + DoD — all 10 sections of spec mapped to tasks. ✓

Type consistency: AppState fields used in tasks match spec §3 exactly. SSE handler signature matches spec §4 endpoint contracts. ✓

Placeholder scan: No "TBD" in steps. Conclusion-check warn/error UI marked as follow-up in spec §10 (intentional out-of-scope). ✓

---

## Execution Handoff

After completing this plan via subagent-driven-development:
- Director (opus) cold-reviews each Task's commit + final 18-PNG audit
- User SOP: dev server up + walk all 6 sections + verify mobile keyboard
- Then move on to next mockup (08 NSM Step 3 Gate / 11 Phase 3 score)
