# Mockup 07 — NSM Step 2 + Step 3 Implementation Design

**Date:** 2026-05-07
**Path 2 sub-project:** Plan C SB2
**Worktree:** `feat/path-2-nsm`
**Mockup contract:** `docs/superpowers/specs/mockups/2026-05-02-frontend-rewrite/07-nsm-step-2.html`
**Master Spec ref:** §2.5 (rt-field) + §3.4 (NSM workshop) + memory `feedback_card_based_analysis_layout`

---

## 0. Scope

Replace `renderNSMStub()` (currently `public/app.js:205`) with full Step 2 (定義 NSM) + Step 3 (4-dim 拆解) renderers, sharing the `nsm-sub-tabs` chrome. Step 2 includes context-card + 3-step guide + 3 fields with example-toggle. Step 3 includes 4-dim section cards with **dynamic labels per product type** and hint-expand toggles.

**Out of scope:**
- Step 3 Gate (mockup 08) — Plan C SB3
- Step 4 report (mockup 14) — Plan C SB4
- Backend NSM endpoints — CONTRACT-LOCKED

## 1. AppState additions

```js
nsmStep: 2,                  // already exists, value 2 enters this view
nsmSubTab: 'nsm-step2',      // already exists; values: 'nsm-step2' | 'nsm-gate' | 'nsm-step3'
nsmDefinition: {             // NEW
  nsm: '',                    // string — 北極星指標 (input)
  explanation: '',            // string — 定義說明 (rt-textarea innerHTML)
  businessLink: '',           // string — 業務連結 (rt-textarea innerHTML)
},
nsmBreakdown: {              // NEW — keyed by canonical dim id, not user-visible label
  reach: '', depth: '', frequency: '', retention: '',
},
nsmExampleExpanded: {},      // NEW — { 'nsm': true, 'explanation': false, ... }
nsmHintExpanded: {},         // NEW — { reach: true, depth: false, ... }
```

Persist `nsmDefinition` + `nsmBreakdown` via PATCH `/api/(guest/)nsm-sessions/:id/progress` `{user_nsm, user_breakdown}` mirrored from existing pattern. (Backend route already exists.)

## 2. Sub-tabs (mockup line 683-687)

```html
<div class="nsm-sub-tabs">
  <button class="nsm-sub-tab is-active" data-nsm-subtab="nsm-step2">步驟 2：定義 NSM</button>
  <button class="nsm-sub-tab" disabled data-nsm-subtab="nsm-gate">NSM 審核</button>
  <button class="nsm-sub-tab" disabled data-nsm-subtab="nsm-step3">步驟 3：拆解</button>
</div>
```

Tab enabled rules:
- Step 2 always enabled when `nsmStep >= 2`
- Gate enabled when `nsmDefinition.nsm.trim() && nsmDefinition.businessLink.trim()` (per mockup A submit-bar comment line 664)
- Step 3 enabled only after gate passes (`nsmGateResult.overall_status` ∈ {ok, warn}) — mockup 08 contract; this spec leaves disabled by default.

## 3. NSM_DIMENSION_CONFIGS — dynamic labels per product type

Per master spec §3.4 + mockup 07 line 651-654 ("4 type × 4 dim = 16 組組合"):

```js
const NSM_DIMENSION_CONFIGS = {
  attention: {
    label: '注意力型',
    typeIcon: 'ph-play-circle',
    typeClass: 'nsm-context-card__type--attention',
    dims: [
      { id: 'reach',     label: '觸及廣度', desc: '有多少用戶真正觸碰到核心功能（非僅登入）',     coachQ: 'AHA 時刻是什麼動作？做到這個動作的人有多少？' },
      { id: 'depth',     label: '互動深度', desc: '每位用戶每次使用的品質與投入程度',             coachQ: '用戶停得夠深嗎？時長、完播率、互動次數哪個更能反映價值？' },
      { id: 'frequency', label: '習慣頻率', desc: '用戶是否形成定期回訪的使用習慣',               coachQ: '每週/每月回來幾次？DAU/MAU 比越高代表黏性越強' },
      { id: 'retention', label: '留存驅力', desc: '什麼讓用戶持續回訪而非逐漸流失',               coachQ: '社交關係？個人化推薦？收藏習慣？找出最強的留存槓桿' },
    ],
  },
  transaction: { /* 交易量型 — see mockup line 1700+ */ },
  creator:     { /* 創造力型 */ },
  saas:        {
    label: 'SaaS 型', typeIcon: 'ph-buildings', typeClass: 'nsm-context-card__type--saas',
    dims: [
      { id: 'reach',     label: '啟用廣度', desc: '...', coachQ: '...' },
      { id: 'depth',     label: '席次深度', desc: '...', coachQ: '...' },
      { id: 'frequency', label: '黏著頻率', desc: '...', coachQ: '...' },
      { id: 'retention', label: '擴張信號', desc: '...', coachQ: '...' },
    ],
  },
};
```

(All 16 cells extracted verbatim from mockup 07 line 1052-1228 + master spec §2.5.)

Resolution: `nsmGuessProductType(q)` already exists at `app.js:2273`. Reuse it.

## 4. Render — `renderNSMStep2()` and `renderNSMStep3()`

### 4.1 `renderNSMStep2()` (mockup line 660-810 §A)

Full HTML structure:
```
.navbar (LOCKED copy)
.phase-head (Step 2 · 定義 NSM)
.nsm-sub-tabs (step2 active)
.nsm-progress (情境 done · 指標 active · 拆解 / 總結 pending)  -- already implemented at app.js:2313
.nsm-body
  .nsm-context-card (LOCKED copy from mockup 06)
  .nsm-guide (3 steps)
  .nsm-field × 3:
    1. NSM input (text input, single-line — `.nsm-input`)
    2. 定義說明 (rt-textarea contenteditable)
    3. 業務連結 (rt-textarea contenteditable)
  .submit-bar (上一步 ghost / 提交審核 primary, disabled until nsm + businessLink filled)
```

Each `.nsm-field` has:
- `.nsm-field__head` with `<label>` + `.nsm-field__example-toggle` (caret + 「查看範例」)
- `.nsm-field__example` (collapsible — defaults to closed; mockup §A shows first one open)
- input/textarea below

### 4.2 `renderNSMStep3()` (mockup line 1027-1228 §B)

```
.navbar / .phase-head (Step 3 · 拆解輸入指標) / .nsm-sub-tabs (step3 active) / .nsm-progress (拆解 active)
.nsm-body
  .step3-banner (你的 NSM 提示 + filled-in NSM read-only)
  .step3-intro (type badge + 4-dim 隨產品特性說明)
  .nsm-dim × 4:
    .nsm-dim__head (label + desc)
    .nsm-dim__body
      .nsm-dim__coach (icon + coachQ)
      <button class="nsm-dim__hint-btn">查看教練提示</button>
      .nsm-dim__hint (collapsible — defaults closed)
      .nsm-rt-field (textarea for breakdown content)
  .submit-bar (上一步 ghost / 提交審核 primary, disabled until all 4 dims have content)
```

### 4.3 Shared helpers
- `renderNsmField(fieldId, label, value, exampleHtml)` — example-toggle + collapsible example + input/rt-textarea
- `renderNsmDim(dim, value, hintHtml, isHintOpen)` — single 4-dim card

## 5. Bindings — `bindNSM()`

```js
function bindNSM() {
  // sub-tab clicks (only enabled tabs trigger nav)
  document.querySelectorAll('[data-nsm-subtab]').forEach(el => {
    el.addEventListener('click', () => {
      if (el.disabled) return;
      AppState.nsmSubTab = el.dataset.nsmSubtab;
      // map subtab → nsmStep
      if (AppState.nsmSubTab === 'nsm-step2') AppState.nsmStep = 2;
      else if (AppState.nsmSubTab === 'nsm-gate') AppState.nsmStep = 2.5; // gate is between step 2 and 3
      else if (AppState.nsmSubTab === 'nsm-step3') AppState.nsmStep = 3;
      render();
    });
  });

  // example-toggle: per-field
  document.querySelectorAll('[data-nsm-example-toggle]').forEach(btn => {
    btn.addEventListener('click', () => {
      const fid = btn.dataset.nsmExampleToggle;
      AppState.nsmExampleExpanded[fid] = !AppState.nsmExampleExpanded[fid];
      render();
    });
  });

  // hint-toggle: per-dim
  document.querySelectorAll('[data-nsm-hint-toggle]').forEach(btn => {
    btn.addEventListener('click', () => {
      const did = btn.dataset.nsmHintToggle;
      AppState.nsmHintExpanded[did] = !AppState.nsmHintExpanded[did];
      render();
    });
  });

  // nsm input + rt-textarea inputs → debounced save
  document.querySelectorAll('[data-nsm-field]').forEach(el => {
    el.addEventListener('input', () => {
      const fid = el.dataset.nsmField;
      const v = el.tagName === 'INPUT' ? el.value : el.innerHTML;
      AppState.nsmDefinition[fid] = v;
      triggerNsmSaveCycle();
    });
  });
  document.querySelectorAll('[data-nsm-dim]').forEach(el => {
    el.addEventListener('input', () => {
      const did = el.dataset.nsmDim;
      AppState.nsmBreakdown[did] = el.innerHTML;
      triggerNsmSaveCycle();
    });
  });

  // submit-bar
  const submitBtn = document.querySelector('[data-nsm-submit]');
  if (submitBtn) submitBtn.addEventListener('click', onNsmSubmit);
}
```

## 6. Save cycle — `triggerNsmSaveCycle()`

Mirror CIRCLES `triggerSaveCycle()` pattern (`public/app.js:735-779`):
- 800ms debounce
- localStorage cache `pmdrill:nsm:draft:{question_id}`
- Fire-and-forget PATCH `/api/(guest/)nsm-sessions/:id/progress` `{user_nsm: AppState.nsmDefinition.nsm, user_breakdown: AppState.nsmBreakdown}` — backend route already exists
- save-indicator state visualised via existing `renderSaveIndicator()` (no UX change, integrate by calling `setNsmSaveState()` on transitions)

## 7. CSS additions

`public/style.css` additions for new classes (none of the LOCKED chrome modified):
- `.nsm-sub-tabs` `.nsm-sub-tab` `.nsm-sub-tab.is-active` `.nsm-sub-tab[disabled]`
- `.nsm-context-card` (verify already exists from Plan C SB1; if not, add) — `.nsm-context-card__top/company/industry/type/scenario/hint`
- `.nsm-guide` `.nsm-guide__title/step/num/body`
- `.nsm-field` `.nsm-field__head/label/example-toggle/example`
- `.nsm-input` (single-line text input)
- `.nsm-rt-field` `.nsm-rt-toolbar` `.nsm-rt-tbtn` `.nsm-rt-textarea`
- `.step3-banner` `.step3-intro`
- `.nsm-dim` `.nsm-dim__head/label/desc/body/coach/hint-btn/hint`

Source mockup 07 lines 1-650 for full CSS reference. Pixel-diff threshold 0.5%.

## 8. Tests (TDD red first)

`tests/visual/nsm-step-2-3.spec.js`:

| # | Spec | Assertions |
|---|---|---|
| 1 | Step 2 renders sub-tabs + 3-step guide + 3 fields | 3 `.nsm-field` / `.nsm-sub-tab.is-active` step2 / `.nsm-guide__step` × 3 |
| 2 | Step 2 example-toggle expands `.nsm-field__example` | click toggle → `.nsm-field__example` visible / arrow rotates |
| 3 | Step 2 NSM input typing updates AppState.nsmDefinition.nsm | typeintoinput → AppState.nsmDefinition.nsm === typed value |
| 4 | Step 2 提交審核 disabled when nsm or businessLink empty | clear nsm → submit btn disabled |
| 5 | Step 2 提交審核 enabled when both filled | fill both → submit btn enabled |
| 6 | Step 3 attention type renders 4 dim labels: 觸及/互動/習慣/留存 | `.nsm-dim__label` text match |
| 7 | Step 3 saas type renders 4 dim labels: 啟用/席次/黏著/擴張 | same with saas product |
| 8 | Step 3 dim hint-toggle expands `.nsm-dim__hint` | click hint-btn → `.nsm-dim__hint` visible |
| 9 | Step 3 dim textarea typing updates AppState.nsmBreakdown[dimId] | type → state updated |
| 10 | Step 3 提交審核 disabled when any dim empty | clear one → btn disabled |
| 11 | Step 3 sub-tab disabled when no gate result | initial state → step3 sub-tab `[disabled]` |
| 12 | Sub-tab click triggers nsmSubTab switch + render | click step3 (when enabled) → AppState.nsmSubTab === 'nsm-step3' |

Run × 3 viewport = 36 specs. 8-viewport regression sweep separately.

## 9. Visual verification (director cold review)

12 PNGs:
- `step2-empty × {Mobile, iPad, Desktop}` (mockup §A)
- `step2-filled-with-example-open × {Mobile, iPad, Desktop}` (mockup §A')
- `step3-attention × {Mobile, iPad, Desktop}` (mockup §B)
- `step3-saas × {Mobile, iPad, Desktop}` (mockup §B variant)

Director Read each, verify dynamic labels match product type. Pixel-diff vs mockup 07 baseline. iOS 15-item.

## 10. Out of scope

- Step 3 Gate (mockup 08) — Plan C SB3
- Step 4 report (mockup 14) — Plan C SB4
- Backend NSM endpoint changes
- transaction / creator product types — defer to a follow-up if user's existing question DB doesn't have those types yet (the 16-cell config is structural; specific cells can be filled in incrementally per master spec)

## 11. Risk + rollback

Risk: medium-high (large render surface; saves wired to backend). Mitigation: TDD spec each piece; localStorage cache survives backend hiccups. Rollback: revert single Plan C SB2 commit.

## 12. Success criteria

- [ ] 36+ Playwright specs green
- [ ] 8-viewport regression sweep stays green (existing NSM Step 1 specs unaffected)
- [ ] jest 160/160 unchanged
- [ ] 12 PNGs read by opus director
- [ ] Pixel-diff < 0.5% vs mockup 07
- [ ] iOS 15-item check pass
- [ ] eyeball walk doc committed
- [ ] CLAUDE.md updated
