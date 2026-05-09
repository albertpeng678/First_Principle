# NSM ↔ CIRCLES Feature Parity Bundle — Design Spec

**Date:** 2026-05-10
**Status:** Draft (awaiting user spec review before invoking writing-plans skill)
**Plan output target:** `docs/superpowers/plans/2026-05-10-nsm-circles-parity-plan.md`
**Owner:** Path 2 frontend rewrite — final NSM/CIRCLES parity bundle

---

## Goal

Bring NSM Step 2/3 to full feature/UX parity with CIRCLES Phase 1 form (mockup 03), and fix two NSM lifecycle bugs surfaced by user during this design session.

User constraint: **嚴格遵循 CLAUDE.md 8 條 standing rules**, especially #8 Karpathy guidelines. Strict opus director cold review enforces all gates.

## Scope (6 gaps + 2 mockup amendments + carry-forwards)

| # | Item | Phase | Backend? | Cost |
|---|---|---|---|---|
| 1 | NSM preflight session creation (mirror CIRCLES `9d92656`) | 1 | ❌ | $0 |
| 2 | NSM tab nav reset (mirror CIRCLES navbar handler) | 1 | ❌ | $0 |
| 3 | Gap C — Step 2 + Step 3 nsm-context-card 4-block expand | 1 | ❌ | $0 |
| 4 | Gap D — CIRCLES qchip-expand stale snapshot fallback fix | 1 | ❌ | $0 |
| 5 | Sub-A — Remove `renderNSMSubTabs()` carry-forward from mockup 07 v2 / 08 v2 | 1 | ❌ | $0 |
| 6 | Sub-B — Update `renderNSMGuide` step 3 vanity-check rewrite | 1 | ❌ | $0 |
| 7 | Gap A — Per-question pre-generated examples (Step 2: 300 cells + Step 3: 400 cells) | 2 | ✅ | ~$3.5 |
| 8 | Gap B — Dynamic AI hint endpoint + frontend wire (Step 2 + Step 3) | 2 | ✅ | ~$0.5 |

**Mockup amendments already shipped (no spec needed)**:
- mockup 07 v3 (Section A/B/C/D + sub-tabs removed + guide v2 + LOCKED component reuse)
- mockup 08 v2 (sub-tabs removed)

## Architecture overview

### 2-phase split rationale (per Karpathy §2 Simplicity First)

- **Phase 1**: Pure frontend, $0 cost, 6 items. Ship-completes 75% of user-visible improvements without backend carve-out.
- **Phase 2**: Backend carve-out (5 prompts/route/script files + DB backfill). Requires user $$ approval for OpenAI cost.

Each phase ships independently with its own 4 ship products (jest log / Playwright log / pixel-diff report / eyeball walk doc).

### Mockup HTML URL (visual contract — implementer must open before coding)

| Mockup | Path | Coverage |
|---|---|---|
| 03 | [docs/superpowers/specs/mockups/2026-05-02-frontend-rewrite/03-phase-1-form.html](../mockups/2026-05-02-frontend-rewrite/03-phase-1-form.html) | LOCKED component source: `.field__hint-row` / `.field-example-toggle` / `.example-expand` / `.rt-field*` / `.modal-card` / `.overlay-frame*` |
| 06 | [docs/superpowers/specs/mockups/2026-05-02-frontend-rewrite/06-nsm-step-1.html](../mockups/2026-05-02-frontend-rewrite/06-nsm-step-1.html) | NSM tab nav reset target (Step 1 home) |
| 07 v3 | [docs/superpowers/specs/mockups/2026-05-02-frontend-rewrite/07-nsm-step-2.html](../mockups/2026-05-02-frontend-rewrite/07-nsm-step-2.html) | NSM Step 2/3 final state (context-card expand + LOCKED hint+example + Section D modal) |
| 08 v2 | [docs/superpowers/specs/mockups/2026-05-02-frontend-rewrite/08-nsm-step-3-gate.html](../mockups/2026-05-02-frontend-rewrite/08-nsm-step-3-gate.html) | sub-tabs removal carry-forward |
| 09 | [docs/superpowers/specs/mockups/2026-05-02-frontend-rewrite/09-offcanvas-history.html](../mockups/2026-05-02-frontend-rewrite/09-offcanvas-history.html) | NSM history visibility (existing 2 variants kept unchanged) |

### Files touched (Phase 1)

| File | Action | Approx lines |
|---|---|---|
| `public/app.js` | Modify | +90 / -15 |
| `public/style.css` | Add (LOCKED CSS copy from mockup 07 v3) | +30 |
| `tests/visual/nsm-circles-parity-phase1.spec.js` | NEW | ~150 (~12 specs) |
| `tests/visual/bounding-box-phase1-invariants.spec.js` | NEW | ~80 (5 invariants) |
| `audit/eyeball-nsm-circles-parity-phase1.md` | NEW | doc, ≥22 PNG director cold-review |

### Files touched (Phase 2)

| File | Action |
|---|---|
| `prompts/nsm-step2-hint.js` | NEW (mirror `prompts/circles-hint.js` pattern) |
| `prompts/nsm-step2-example.js` | NEW (mirror `prompts/circles-example.js` pattern, used by backfill script) |
| `routes/nsm-public.js` | NEW (mirror `routes/circles-public.js` session-less hint endpoint) |
| `server.js` | +1 mount line: `app.use('/api/nsm-public', require('./routes/nsm-public'))` |
| `scripts/backfill-nsm-step2-examples.js` | NEW (idempotent, mirror `scripts/generate-circles-examples.js`) |
| `scripts/backfill-nsm-step3-examples.js` | NEW (or merged into above) |
| `public/nsm-db.js` | Data write via backfill script (100q × 7 fields = 700 cells) |
| `public/app.js` | +50 / -3 (read field_examples, hint button wire, modal reuse) |
| `tests/visual/nsm-circles-parity-phase2.spec.js` | NEW (~15 specs × 8 vp) |
| `tests/visual/nsm-step2-hint-modal-close-paths.spec.js` | NEW (8 vp × 4 paths × 3 states = 96 cases) |
| `tests/adversarial/nsm-step2-hint.test.js` | NEW (10 cases, real OpenAI sweep) |
| `audit/eyeball-nsm-circles-parity-phase2.md` | NEW (≥30 PNG + 30 cell spot-check) |
| `audit/pixel-diff-phase2-2026-05-10.md` | NEW |

### Standing rules保留

- ✅ rule #1 CLAUDE.md 即時更新（每 ship 後立即 update state board）
- ✅ rule #2 Mockup 三裝置並排 + user 放行才實作（已完成 07 v3 / 08 v2 amend + user approval）
- ✅ rule #3 全 zh-TW / 無 emoji / system-ui font / Phosphor icons
- ✅ rule #4 UI/UX 親看 PNG（director cold-review ≥22+30 PNG read）
- ✅ rule #5 iOS 15-item before ship
- ✅ rule #6 1px alignment / 4-grid spacing
- ✅ rule #7 Path 2 backend 不動 — Phase 1 strictly enforced; Phase 2 user-explicit carve-out per "完全對齊 CIRCLES" approval + Combo C / Stats fix / config 三個 carve-out 先例
- ✅ rule #8 Karpathy guidelines 4 條 implementer dispatch prepend + main agent 寫/改/review code 必套

## Detailed design

### Phase 1 — Pure frontend (6 items)

#### Item 1: NSM Preflight Session Creation (Issue 1)

**Root cause** (from `public/app.js:1620-1641` audit): `ensureNsmSession()` only fires inside `nsmSubmitBtn` click handler. Backend row creation is gated on submit click. User typing in Step 2 fields creates NO backend row → drafts never appear in offcanvas history.

**Fix pattern**: Mirror CIRCLES commit `9d92656` (`bindCirclesPhase1` opens with `preflightDraftSession` IIFE).

**New helper**:
```js
// near ensureNsmSession (line ~1627)
var _nsmPreflightInFlightForQid = null;

async function ensureNsmDraftSession() {
  if (AppState.nsmSession && AppState.nsmSession.id) return AppState.nsmSession.id;
  var qid = (AppState.nsmSelectedQuestion || {}).id;
  if (!qid || _nsmPreflightInFlightForQid === qid) return null;
  _nsmPreflightInFlightForQid = qid;
  try {
    var basePath = AppState.accessToken ? '/api/nsm-sessions' : '/api/guest/nsm-sessions';
    var res = await window.apiFetch(basePath, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId: qid, questionJson: AppState.nsmSelectedQuestion }),
    });
    if (!res.ok) throw new Error('session_create_failed');
    var data = await res.json();
    AppState.nsmSession = { id: data.sessionId || data.id };
    return AppState.nsmSession.id;
  } finally {
    if (_nsmPreflightInFlightForQid === qid) _nsmPreflightInFlightForQid = null;
  }
}
```

**Mount point**: `bindNSMStep2And3()` opening — call `ensureNsmDraftSession()` IIFE-style on mount.

**Race window quantification**:
- Pre-fix: T+0 mount → user typing → triggerNsmSaveCycle PATCH attempt → no session.id → PATCH skipped → backend row永遠不存在 until submit
- Post-fix: T+0 mount → ensureNsmDraftSession() POST → 100-500ms resolve → session.id ready before user finishes first field → triggerNsmSaveCycle PATCH directly hits

**RED test** (`tests/visual/nsm-preflight-session.spec.js`):
```js
test('NSM Step 2 mount fires POST /draft preflight', async ({ page }) => {
  // intercept POST, count calls
  // navigate to Step 2 without typing
  // assert POST fired within 1s of mount
});
```

#### Item 2: NSM Tab Nav Reset (Issue 2)

**Root cause** (`public/app.js:2797-2800`): NSM tab handler only sets `AppState.view = 'nsm'`, doesn't reset `nsmStep`. Compare CIRCLES line 2785-2796 which calls `resetCirclesToHome()`.

**Fix** (mirror CIRCLES pattern):
```js
} else if (target === 'nsm') {
  AppState.evalToastDismissed = false;
  // Mirror CIRCLES tab: reset to home unless mid-eval/loading (Karpathy §2 — minimum diff)
  if (!(AppState.nsmGateLoading || AppState.nsmEvalLoading)) {
    AppState.nsmStep = 1;
    AppState.nsmSubTab = null;
  }
  AppState.view = 'nsm';
  render();
}
```

**RED test** (`tests/visual/nsm-tab-reset.spec.js`):
```js
test('NSM tab click resets to step 1', async ({ page }) => {
  // navigate to step 2, type something
  // click navbar 北極星指標 tab
  // assert nsmStep === 1, view shows question selector
});
test('NSM tab does NOT reset during nsmGateLoading', async ({ page }) => {
  // set nsmGateLoading=true, click tab
  // assert nsmStep preserved
});
```

#### Item 3: Gap C — Step 2/3 Context-Card Expand

**Goal**: Both Step 2 and Step 3 show toggleable expand panel revealing 4 context blocks (商業模式/使用者/常見陷阱 warn橘/破題切入). Data source `q.context.{model, users, traps, insight}` already pre-generated by SP4.

**Frontend changes** (`public/app.js`):
1. Add `AppState.nsmContextExpanded = false` (boolean, shared between Step 2/3)
2. Modify `renderNSMContextCard(q, typeCfg)` — add expand toggle button + conditional 4-block render
3. Add click handler `[data-nsm="context-toggle"]`
4. Step 2 + Step 3 both call same `renderNSMContextCard()` → automatically gets the new behavior

**CSS** (`public/style.css`):
- Copy verbatim from mockup 07 v3 line 316-403:
  - `.nsm-context-card__expand-toggle`
  - `.nsm-context-card__expand`
  - `.nsm-context-card__expand-label`
  - `.nsm-context-card__ana`
  - `.nsm-context-card__ana-block`
  - `.nsm-context-card__ana-block--trap` (warn橘)
  - `.nsm-context-card__collapse-btn`

**RED test** (`tests/visual/nsm-context-expand.spec.js`):
```js
test('NSM Step 2 context-card expand reveals 4 ana blocks', async ({ page }) => {
  // navigate Step 2
  // click 深入了解問題 toggle
  // assert .nsm-context-card__ana-block visible × 4
  // assert .nsm-context-card__ana-block--trap has warn-orange color
});
test('Step 2 expand state persists when navigating to Step 3', async ({ page }) => {
  // expand on Step 2 → submit → land on Step 3 → ana visible
});
```

#### Item 4: Gap D — CIRCLES qchip Stale Snapshot Fix

**Root cause**: `renderQchipExpand()` (line 3729) reads `q.analysis` from `AppState.circlesSelectedQuestion = item.question_json` (set by `restoreCirclesPhase1FromSession`). Old session snapshots / Playwright fixtures have stale or missing `analysis` field → 4 ana blocks render empty bodies.

**Fix** (1-line fallback, Karpathy §2 minimum):
```js
function renderQchipExpand(q) {
  if (!q) return '';
  // Stale snapshot fallback: when session.question_json lacks analysis,
  // look up fresh CIRCLES_QUESTIONS by id (data-only救援, 0 視覺 change)
  var fresh = (q.id && window.CIRCLES_QUESTIONS) ?
    window.CIRCLES_QUESTIONS.find(function(x){ return x.id === q.id; }) : null;
  var an = (q.analysis && q.analysis.business) ? q.analysis : (fresh && fresh.analysis) || {};
  var statement = q.problem_statement || (fresh && fresh.problem_statement) || '';
  // ... rest unchanged
}
```

**RED test** (`tests/visual/circles-qchip-stale-fix.spec.js`):
```js
test('renderQchipExpand falls back to fresh DB lookup when session snapshot lacks analysis', async ({ page }) => {
  // mock session with question_json that has no analysis
  // restore session, navigate to Phase 1
  // expand qchip
  // assert all 4 ana bodies have content (not empty)
});
```

#### Item 5: Sub-A — Remove renderNSMSubTabs()

**Surgical removal** (Karpathy §3 — DO NOT clean adjacent dead code):
- Delete `renderNSMSubTabs()` function body
- Remove call sites (line 1235 in renderNSMStep2, line 1491 in renderNSMStep3)
- Remove sub-tabs click handler in bind* functions
- **DO NOT remove `nsmSubTab` AppState field** (still used by gate routing)
- **DO NOT remove unused branches in render switch** (deferred cleanup)

**RED test**: covered by existing nsm-step-2-3 spec — assert `.nsm-sub-tabs` selector returns null.

#### Item 6: Sub-B — Update renderNSMGuide Step 3 Text

**1-line text change** (`public/app.js:1462`):
```diff
-  <p>問自己：如果這個數字翻倍，產品的商業收益一定增加嗎？</p>
+  <p>問自己：這個指標是否真的能如實反映「用戶體會到產品價值」？</p>
```

**RED test** (`tests/visual/nsm-guide-vanity-rewrite.spec.js`):
```js
test('NSMGuide step 3 text matches mockup 07 v3 vanity rewrite', async ({ page }) => {
  // navigate Step 2
  // assert .nsm-guide__step:nth-child(3) p text contains "如實反映「用戶體會到產品價值」"
  // assert NOT contains "如果這個數字翻倍"
});
```

### Phase 2 — Backend carve-out (5 items)

#### Item 7: Backend Prompts (NEW)

`prompts/nsm-step2-hint.js` (mirror `prompts/circles-hint.js`):
- Schema: `generateNSMStep2Hint({ questionJson, field, userDraft }) → markdown bullets ≤ 320 chars`
- Field whitelist: `['nsm', 'explanation', 'businessLink']`
- Adversarial guard: `## 輸入品質檢查` section (per Combo C standing rule)

`prompts/nsm-step2-example.js` (mirror `prompts/circles-example.js` short-form, **NOT** offline pre-gen format — that's separate, see Item 9):
- Schema: `generateNSMStep2Example({ questionJson, field }) → 50-90 chars single-line`
- Used only if needed for runtime example (likely unused if pre-gen covers all)

#### Item 8: Backend Route (NEW)

`routes/nsm-public.js` (mirror `routes/circles-public.js`):
```js
const QUESTIONS = JSON.parse(fs.readFileSync(/* nsm-db parsed */));
const QUESTION_BY_ID = Object.fromEntries(QUESTIONS.map(q => [q.id, q]));
const ALLOWED_FIELDS = ['nsm', 'explanation', 'businessLink'];

router.post('/step2-hint', async (req, res) => {
  // validate questionId + field + userDraft (≤ 200 chars)
  // call generateNSMStep2Hint
  // return JSON
});
```

`server.js`: `app.use('/api/nsm-public', require('./routes/nsm-public'));`

#### Item 9: Backfill Script — Step 2 Examples (300 cells)

**LOCKED contract** (1:1 mirror `scripts/generate-circles-examples.js`):

```js
// scripts/backfill-nsm-step2-examples.js
const STYLE_GUIDE = `[verbatim copy from generate-circles-examples.js lines 74-88]`;

const FIELD_GUIDE = {
  step2: {
    nsm:          '建議主項：行為動詞 / 量化門檻 / 排除對象（避虛榮指標）',
    explanation:  '建議主項：量化定義 / 行為閾值 / 為什麼這數字代表價值',
    businessLink: '建議主項：NSM ↑ → 商業指標 ↑ 因果鏈 / 留存或變現的具體連結',
  },
};

const ANCHOR_FEW_SHOT = {
  field: 'step2.nsm',
  context: '題目：訂閱用戶每月活躍觀看時長 NSM 定義 / 公司：Netflix / 情境：訂閱制',
  output: `- 行為動詞：**完整觀看** ≥ 1 集劇集（5 分鐘以上）
- 量化門檻：**月活躍訂閱用戶**（月內至少 1 次達標）
- 排除：純打開 App 不播放、< 5 分鐘的試看`,
};

// generate() function structure verbatim from CIRCLES script lines 102-167
// validation: text.length ≤ 320, top bullets ≥ 2
// gpt-4o, temperature 0.5, max_tokens 480, 3 retries with backoff
// idempotent: skip if q.field_examples.step2 already complete
// save to public/nsm-db.js as q.field_examples.step2 = {nsm, explanation, businessLink}
```

#### Item 10: Backfill Script — Step 3 Per-Dim Examples (400 cells)

Same script (or extended), Step 3 generation uses generic dimId keys (not zh labels):

```js
FIELD_GUIDE.step3 = {
  reach:     '建議主項：母群體定義 / 達標行為 / 排除誤觸',
  depth:     '建議主項：深度行為定義 / 質量門檻 / 為什麼這個是「真投入」',
  frequency: '建議主項：週期定義 / 頻率閾值 / 為什麼這個週期適合本產品',
  impact:    '建議主項：留存或商業留痕 / 量化轉換 / 排除滯後指標',
};

// save as q.field_examples.step3 = {reach, depth, frequency, impact}
// Frontend renders correct zh label per product type config (attention/saas/transaction/creator)
```

Total Phase 2 backfill: 100 questions × 7 fields = 700 cells, ~$3.5 OpenAI cost.

#### Item 11: Frontend Wire-up + Modal Reuse

`public/app.js`:
1. Replace hardcoded Spotify example (line 1240-1242) → read `q.field_examples.step2.{field}`
2. `renderNSMField()` rebuild head with LOCKED `.field__label-row` + `.field__hint-row` (1:1 from mockup 07 v3)
3. `renderNSMDim()` same pattern + read `q.field_examples.step3.{dimId}`
4. Add `openNSMStep2HintModal(field)` helper — mirror `openHintModal()` from CIRCLES SB8:
   - Reuse `renderHintModalShell` + `_hintCache` per (qid, field)
   - AbortController for 4 close paths (ESC / backdrop / X / button)
   - 3-state: loading → content → error retry
5. Step 3 hint button wire to existing `POST /api/nsm-sessions/:id/hints` endpoint (already exists per Plan C SB2 — just connect, removing hardcoded `dim.hint` static fallback)
6. CSS via mockup 07 v3 LOCKED reuse — NSM-only variants 全 NUKE (already done in mockup amend)
7. `markdownBulletsToHtml()` (existing helper from CIRCLES SB8) renders the bullet examples

## Testing + Verification

### 8-layer verification stack (per CLAUDE.md)

| Layer | Phase 1 | Phase 2 |
|---|---|---|
| 1 baseline凍結 | mockup 07 v3 + 08 v2 + 09不變 | + Section D modal baseline |
| 2 pixel-diff 0.5% | mockup 07 v3 A/B/C × 8 vp | + Section D 9 baselines |
| 3 boundingBox | 5 invariants × 8 vp = 40 cases | + 5 modal invariants × 8 = 40 |
| 4 webkit + chromium | spec × 2 engines | spec × 2 engines |
| 5 state matrix | 6 items × ~3 states each | + 3 modal states × 4 close paths |
| 6 PNG eyeball | ≥22 PNG director Read | ≥30 PNG + 30 cell spot-check |
| 7 user real device | dev port 4000 SOP | same |
| 8 pre-commit/CI | jest + race regression hook | + adversarial sweep on push |

### Director cold review protocol (sonnet self-report 不算數)

#### Phase 1 mechanical gates (must all pass = 0 violations)

```bash
grep -c "nsm-rt-" public/style.css                       # = 0
grep -c "nsm-field__hint-toggle" public/                # = 0
grep -c "nsm-dim__hint-btn" public/                     # = 0
grep -c "<strong>B</strong>" public/                    # = 0
grep -c "renderNSMSubTabs" public/app.js                # = 0
grep -c "如果這個數字翻倍" public/app.js                # = 0
grep -c "如實反映「用戶體會到產品價值」" public/app.js  # ≥ 1
git diff --stat HEAD~6..HEAD public/app.js              # ≤ 200 lines net
```

#### Phase 2 mechanical gates (extra)

```bash
diff scripts/backfill-nsm-step2-examples.js scripts/generate-circles-examples.js
# Expected drift only in: FIELD_GUIDE entries / ANCHOR_FEW_SHOT / JSON_PATH / questionFullyFilled
# STYLE_GUIDE / generate() / validation logic must be IDENTICAL
# Significant drift = bundle reject

npm run test:adversarial -- nsm-step2-hint  # 10/10 must pass
```

#### Director PNG cold-review (per CLAUDE.md rule #4)

- Director must `open` each PNG via Read tool + write ≥1 sentence comment to eyeball doc
- DOM-only audit forbidden (per memory `feedback_uiux_visual_only.md`)
- Phase 1: ≥22 PNG (mobile-360 / iPad / Desktop-1280 × 6 items × ≥1 state + iPhone-SE/15-Pro hint-row right-align × 4)
- Phase 2: ≥30 PNG + 30 sample cell spot-check (10 from each section)

#### Director Karpathy cross-check (per standing rule #8)

After every sonnet implementer DONE, director cross-checks 4 rules:

| Rule | Director check |
|---|---|
| §1 Think Before | Did sonnet surface assumptions? Any silent picking? Unexplained git diff lines? |
| §2 Simplicity | git diff > 1.5x plan estimate? Single-use abstractions? Future-proofing? |
| §3 Surgical | Touched files outside plan? "While I'm here" cleanup? |
| §4 Goal-Driven | RED test committed first? Test reproduces issue? Coverage matches plan? |

Any violation = dispatch fix-sonnet to clean up; do NOT accept self-report.

### iOS Safari 15-item static review (per rule #5)

Both Phase 1 (Item 1 preflight + Item 3 expand) and Phase 2 (modal interaction) trigger mobile UX changes — checklist mandatory:
1. autocomplete attributes
2. inputmode hints
3. -webkit-tap-highlight-color
4. -webkit-touch-callout
5. position: sticky behavior
6. overflow-anchor
7. passive scroll listeners
8. requestAnimationFrame for animations
9. touch-action CSS
10. SSE / EventSource handling
11. body scroll lock during modal
12. focus trap in modal
13. ESC keyboard handling on iOS keyboard-shown state
14. backdrop touch-end vs click distinction
15. modal max-height with virtual keyboard

### 4 ship products per phase (缺一不過)

| Phase | jest log | Playwright log | Pixel-diff report | Eyeball walk doc |
|---|---|---|---|---|
| 1 | jest 160/160 baseline | nsm-circles-parity-phase1 ~96 cases × 8 vp 全綠 | `audit/pixel-diff-phase1-2026-05-10.md` | `audit/eyeball-nsm-circles-parity-phase1.md` ≥22 PNG |
| 2 | jest baseline + N (new prompt/route specs) 不破 | nsm-circles-parity-phase2 ~120 cases + modal-close ~96 + adversarial 10 | `audit/pixel-diff-phase2-2026-05-10.md` (含 Section D) | `audit/eyeball-nsm-circles-parity-phase2.md` ≥30 PNG + 30 cell spot-check |

User 殺手鐧 3 問必答得出（任一答不出 = bundle 重做）：
1. 「Read 過 PNG 沒？貼 viewport + 評論」
2. 「5 條 boundingBox invariant 數字」
3. 「mockup ↔ production diff 結果？引 report 路徑」

### Implementer subagent dispatch — Karpathy compliance prepend (standing rule #8)

Every Phase 1 + Phase 2 sonnet implementer prompt MUST start with this block:

```
**Karpathy guidelines compliance (standing rule #8):**

§1 Think Before Coding — surface assumptions explicitly. If multiple
   interpretations exist, ASK before implementing. Don't pick silently.

§2 Simplicity First — minimum code for spec. No abstractions for
   single-use. No "future-proof" flexibility. If you write 100 lines
   for what could be 30, rewrite.

§3 Surgical Changes — touch ONLY what spec says. No "while I'm here"
   cleanup of adjacent code. Match existing style. If you notice
   unrelated issues, mention but don't fix.

§4 Goal-Driven — write RED test first, watch fail, write minimum
   code, watch green, commit. Verifiable success criteria per item.

Director will cold-review against these 4 rules. Self-report doesn't
count.
```

Phase 2 implementer additionally MUST contain:

```
**Pre-gen format LOCKED (CIRCLES 1:1 mirror):**

DO NOT invent NSM-specific format. DO:
1. Read scripts/generate-circles-examples.js entirely
2. Copy STYLE_GUIDE verbatim (lines 74-88)
3. Copy generate() function structure verbatim (lines 102-167)
4. Copy validation logic verbatim (length ≤ 320, top-bullets ≥ 2, prefix strip)
5. Adapt only FIELD_GUIDE entries to NSM step2/step3 fields
6. Hand-write 1 ANCHOR_FEW_SHOT example for NSM (preferably q1 Netflix)
7. Save to public/nsm-db.js as q.field_examples.{step2: {nsm,explanation,businessLink}, step3: {reach,depth,frequency,impact}}
8. Frontend markdownBulletsToHtml() existing helper handles render — NO new helper

Director will diff your script against generate-circles-examples.js — significant divergence = bundle rejected.
```

## Cost summary

| Item | Cost |
|---|---|
| Phase 1 (pure frontend) | $0 |
| Phase 2 backfill 700 cells × $0.005 | $3.50 |
| Phase 2 adversarial sweep 10 cases × $0.005 | $0.05 |
| Buffer (retry / regenerate) | $1.00 |
| **Total ≤** | **$5** |

## Open questions / known limitations

1. **Phase 2 starts only after**:
   - Phase 1 fully shipped + stable in production
   - User explicit go-ahead with $$ approval
   - Mockup 07 v3 Section D rendered modal verified by user in browser
2. **NSM history granularity decision (per Q3 in brainstorming)**: Using existing 2 mockup 09 variants (`NSM · 4 步` + `NSM · 4 步 · 進行中`) — no per-step granularity. Acceptable per CIRCLES sim parity.
3. **Step 3 hint endpoint already exists** (`POST /api/nsm-sessions/:id/hints` from Plan C SB2). Phase 2 only needs frontend wire — does NOT need new backend route for Step 3 hint.
4. **Drill_step legacy migration not in scope** — already noted in `project_pending_followups_2026-05-09.md`; user-discretion to clean later.

---

## Spec self-review (per brainstorming skill step 7)

✅ **Placeholder scan**: No "TBD" / "TODO" / "placeholder" / vague specs.
✅ **Internal consistency**: Phase 1/2 boundaries clear; no contradictions between architecture overview and item details.
✅ **Scope check**: Single coherent spec (NSM ↔ CIRCLES parity); not too big to need decomposition. Phase split is implementation strategy, not separate specs.
✅ **Ambiguity check**:
- "完全對齊 CIRCLES" interpreted explicitly per item (LOCKED component reuse + pre-gen format mirror + dynamic hint endpoint mirror).
- "嚴格遵循 CLAUDE.md 規範" mapped to all 8 standing rules with per-item compliance.
- "全裝置全尺寸 mockup 對齊" mapped to 8 viewport × pixel-diff 0.5% threshold + director PNG cold review.

---

**Next step (per brainstorming skill)**: User reviews this spec → if approved, invoke `superpowers:writing-plans` skill to create implementation plan (`docs/superpowers/plans/2026-05-10-nsm-circles-parity-plan.md`).
