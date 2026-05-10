# Inline Hint Text Audit — All Phases / Steps

User UAT 2026-05-10: remove all inline coaching text below field labels.
Reasoning: 「提示」+「範例答案」buttons already provide guidance; inline text is redundant + clutters UI.

---

## Summary

| Area | Instances found |
|---|---|
| Phase 1 C1/I/R/C2 (metaSpan hint suffix) | 4 fields (field idx=0 per step) |
| Phase 1 E step (sol-card field__meta) | 4 fields × up to 3 sol-cards = up to 12 |
| Phase 1 S step tracking-section__sub | 1 section-level |
| Phase 1 S step tracking-card__sub (dimSub) | 4 cards (attention type only currently) |
| Phase 2 chat icebreaker__text | 6 step configs |
| Phase 2 conclusion-box__sub | 6 step configs |
| Phase 2 chat phase2-min-tip | 1 (display:none, triggered on send) |
| Auth register — password 「至少 6 字」 | 1 |
| **Total inline coaching text sites** | **~35 rendered instances** |

**Counter floor suffix「（至少 X 字）」:** appears in 2 code paths (render-time + input handler).

**NOT in scope (keep as-is):**
- NSM Step 2 field labels (北極星指標 (NSM) / 定義說明 / 與業務目標連結) — labels only, no coaching text
- NSM Step 3 `nsm-dim__desc` + `nsm-dim__coach` — part of the structural design (not below-label coaching)
- NSM Step 4 — display-only, no editable fields
- Phase 3 Score / Phase 4 — display-only
- Rail sidebar text (desktop aside.rail) — context panel, not below-field coaching
- Error messages (auth-field__error) — functional, keep
- Placeholder text in textareas — functional, keep

---

## Found Instances — Detail

### GROUP A: Phase 1 — metaSpan (「建議 X-Y 字 · hint」)

**Code path:** `renderPhase1Field()` — app.js:4166

```js
var metaSpan = minMax ? '<span>建議 ' + minMax + ' 字' + (idx === 0 && hint ? ' · ' + hint : '') + '</span>' : '';
```

**Rendered output for field idx=0 per step:**
`建議 40-120 字 · 列出用戶想完成的具體任務或操作`

The `hint` data comes from `CIRCLES_STEP_CONFIG[step].fields[0].hint`. Affected steps and their idx=0 field hint values:

| Step | Field (idx=0) | Inline hint text | File:line |
|---|---|---|---|
| C1 | 問題範圍 | 寫具體的功能或場景邊界 | app.js:3129, rendered at 4166 |
| I | 目標用戶分群 | 依行為或使用情境分群，不只人口統計 | app.js:3148, rendered at 4166 |
| R | 功能性 | 列出用戶想完成的具體任務或操作 | app.js:3167, rendered at 4166 |
| C2 | 取捨標準 | 列出 2-3 個判斷優先級的明確標準 | app.js:3186, rendered at 4166 |

**Note:** `metaSpan` also shows `建議 X-Y 字` (without hint suffix) for all other fields (idx > 0). This is also inline coaching — remove the `建議 X-Y 字` part entirely or leave only on non-idx=0 fields. Full removal recommended per user intent.

**Action:** Remove the `' · ' + hint` suffix at minimum. Remove entire `metaSpan` (including `建議 X 字`) per user's "all inline coaching text" mandate. Counter (`charCounter`) stays.

---

### GROUP B: Phase 1 E step — sol-card field__meta

**Code path:** `renderEStepSolCard()` — app.js:4571

```js
+ '<div class="field__meta" style="font-size: var(--t-cap); color: var(--c-ink-3); margin-top: 2px;">建議 ' + f.minMax + ' 字</div>'
```

Rendered for each of the 4 perSolFields (優點 / 缺點 / 風險與依賴 / 成功指標) in each of up to 3 sol-cards.

| Phase/Step | Field | Inline text | File:line |
|---|---|---|---|
| Phase 1 E (sol-card × 3) | 優點 | 建議 40-150 字 | app.js:4571 |
| Phase 1 E (sol-card × 3) | 缺點 | 建議 40-150 字 | app.js:4571 |
| Phase 1 E (sol-card × 3) | 風險與依賴 | 建議 40-150 字 | app.js:4571 |
| Phase 1 E (sol-card × 3) | 成功指標 | 建議 30-100 字 | app.js:4571 |

**Action:** Remove the entire `<div class="field__meta" ...>建議 X 字</div>` block (single line).

---

### GROUP C: Phase 1 S step — tracking-section__sub

**Code path:** `renderCirclesPhase1Sstep()` — app.js:4718–4722

```js
var trackingSub = '分別說明北極星指標的 reach / depth / frequency / impact。本題（' + typeLabelDisplay + '）label 自動切換為對應產業術語。';
// rendered as:
'<p class="tracking-section__sub">' + escHtml(trackingSub) + '</p>'
```

| Phase/Step | Location | Inline text | File:line |
|---|---|---|---|
| Phase 1 S | tracking-section header | 分別說明北極星指標的 reach / depth / frequency / impact。本題（attention 型）label 自動切換為對應產業術語。 | app.js:4718, 4722 |

**Action:** Remove the `<p class="tracking-section__sub">` line entirely. The section heading `追蹤指標 · 4 個維度` is sufficient.

---

### GROUP D: Phase 1 S step — tracking-card__sub (dimSub)

**Code path:** `renderCirclesPhase1Sstep()` — app.js:4709

```js
var dimSub = dimSubs ? (dimSubs[dimKey] || '') : '';
// rendered as:
'<div class="tracking-card__sub">' + escHtml(dimSub) + '</div>'
```

`dimSubs` are from `trackingSubsByType.attention` — currently only attention type is defined:

| dim | dimSub text | File:line |
|---|---|---|
| reach | 每月至少播放 1 首歌的 MAU 數 | app.js:3271, rendered 4709 |
| depth | 每 session 平均聆聽時長（分鐘） | app.js:3272, rendered 4709 |
| frequency | 每週使用 ≥ 3 天的用戶佔比 | app.js:3273, rendered 4709 |
| impact | 擁有 ≥ 5 首收藏歌曲的 30 日留存率 | app.js:3274, rendered 4709 |

**Action:** Remove `<div class="tracking-card__sub">` line when `dimSub` is empty or always. Alternatively keep it (it's a structural sub-description, not purely coaching text). **BORDERLINE — user to decide.** The sub explains the dimension metric definition, which could be considered part of the label structure rather than coaching. Recommend keep for now, flag for user decision.

---

### GROUP E: Phase 2 chat — icebreaker__text

**Code path:** `renderCirclesPhase2()` — app.js:934

```js
'<div class="icebreaker__text">' + escHtml(phase2Cfg.icebreakerText) + '</div>'
```

Shown only when `turnCount === 0 && !streaming` (empty chat state). Data at app.js:700–750:

| Step | icebreakerText | File:line |
|---|---|---|
| C1 | 先與被訪談者澄清題目本身的邊界 — 具體在問什麼問題、涵蓋哪些功能或場景、有哪些業務限制不能突破。 | app.js:700 |
| I | 了解目標用戶 — 他們是誰、什麼情境下會使用、目前如何解決問題。 | app.js:708 |
| R | 挖掘真實需求 — 痛點頻率、嚴重度、現有方案的不足。 | app.js:716 |
| C2 | 排序需求 — RICE / ICE / 戰略對齊。 | app.js:724 |
| L | 列方案 — 至少 2-3 個獨立方案，包含明顯不同 mechanism。 | app.js:732 |
| E | 評估每個方案 — 優點 / 缺點 / 風險 / 成功指標。 | app.js:740 |
| S | 總結並設定 tracking — 主推薦方案 + 4 維度追蹤。 | app.js:748 |

**Note:** `icebreaker__text` appears in an `.icebreaker` card that also has `.icebreaker__label` 「開始提問方向」. This is contextual onboarding for Phase 2 CHAT — appears only when chat is empty. **BORDERLINE** — this is chat context UI, not strictly a "below field label" inline hint. User to decide. Recommend: keep `icebreaker__label`, ask if `icebreakerText` should be removed.

---

### GROUP F: Phase 2 — conclusion-box__sub

**Code path:** `renderConclusionBox()` — app.js:821

```js
var subText = isDesktop ? escHtml(cfg.conclusionSubDesktop) : escHtml(cfg.conclusionSub);
// rendered as:
'<div class="conclusion-box__sub">' + subText + '</div>'
```

Data (app.js:701–750):

| Step | conclusionSub | conclusionSubDesktop |
|---|---|---|
| C1 | 說明問題範圍、時間框架、業務約束，以及你確認或待確認的假設。 | …（同）+ 建議 80-120 字。 |
| I | 描述目標用戶輪廓、使用情境、現有解法。 | …（同）+ 建議 60-100 字。 |
| R | 列出關鍵需求並標註頻率/嚴重度/現有方案不足。 | …（同）+ 建議 60-100 字。 |
| C2 | 排序 + RICE/ICE/戰略對齊摘要。 | …（同）+ 建議 60-100 字。 |
| L | 列方案 + 每個方案核心 mechanism。 | …（同）+ 建議 80-120 字。 |
| E | 每個方案的優缺點/風險/成功指標摘要。 | …（同）+ 建議 80-120 字。 |
| S | 主推薦方案 + 4 維度追蹤摘要。 | …（同）+ 建議 80-120 字。 |

**Action:** Remove `<div class="conclusion-box__sub">` line entirely, OR keep but remove `建議 X-Y 字。` suffix (desktop variant). The sub-title describes what the user should write — **BORDERLINE.** It provides structure inside the conclusion box rather than below a field label. Flag for user decision: remove entirely vs. keep short version without word-count suggestion.

---

### GROUP G: Phase 2 chat — phase2-min-tip

**Code path:** `renderCirclesPhase2()` — app.js:1018

```js
'<div class="phase2-min-tip" style="display:none" data-phase2="min-tip">至少 5 字</div>'
```

This is `display:none` by default — shown only when user tries to send fewer than 5 characters. It's an **error/validation message**, not inline coaching. **Keep as-is.**

---

### GROUP H: Auth — password 「至少 6 字」 label suffix

**Code path:** `renderAuthRegister()` — app.js:2535

```js
var pwHintText = ... ? '過短' : '<span ...>至少 6 字</span>';
```

Rendered inline in the password `<label>` as a small grey suffix next to 「密碼」. This is a minimum-length hint for a security requirement, not coaching text. **Keep as-is** (functional UX for password fields is standard).

---

## Char Counter Floor Suffix — Cleanup

The counter suffix `（至少 X 字）` appears in two code paths:

| Path | Code | File:line |
|---|---|---|
| Render-time (field 1) | `var floorSuffix = _isBelowFloor ? '（至少 ' + floorN + ' 字）' : '';` | app.js:4180 |
| Input handler (live update) | `var floorSuffix = isBelowFloor ? '（至少 ' + floorN + ' 字）' : '';` | app.js:6998 |

**Proposed action:** Remove `floorSuffix` from counter text in both paths. Counter shows `X / Y` only. The red `is-below-floor` CSS class on the counter already provides visual validation signal. Submit-block tooltip `「X」至少需要 Y 字` (app.js:3573) keeps working — that's a submit-time error, not inline text.

---

## Summary Table — All Instances + Actions

| # | Phase/Step | Location | Inline text | Action | File:line |
|---|---|---|---|---|---|
| A1 | Phase 1 C1 | metaSpan (field 1) | 建議 50-120 字 · 寫具體的功能或場景邊界 | Remove metaSpan entirely | 4166 |
| A2 | Phase 1 I | metaSpan (field 1) | 建議 40-120 字 · 依行為或使用情境分群，不只人口統計 | Remove metaSpan entirely | 4166 |
| A3 | Phase 1 R | metaSpan (field 1) | 建議 40-120 字 · 列出用戶想完成的具體任務或操作 | Remove metaSpan entirely | 4166 |
| A4 | Phase 1 C2 | metaSpan (field 1) | 建議 40-120 字 · 列出 2-3 個判斷優先級的明確標準 | Remove metaSpan entirely | 4166 |
| A5 | Phase 1 all steps | metaSpan (field 2/3/4) | 建議 X-Y 字 | Remove metaSpan entirely | 4166 |
| B1–B12 | Phase 1 E (per sol-card) | field__meta | 建議 X-Y 字 | Remove field__meta block | 4571 |
| C1 | Phase 1 S | tracking-section__sub | 分別說明北極星指標的…本題（X 型）label 自動切換… | Remove | 4722 |
| D1–D4 | Phase 1 S | tracking-card__sub | per-dim metric description | **Flag** (borderline, keep for user decision) | 4709 |
| E1–E7 | Phase 2 chat | icebreaker__text | step-specific opening direction text | **Flag** (borderline, keep for user decision) | 934 |
| F1–F7 | Phase 2 conclusion | conclusion-box__sub | step-specific summary instructions | **Flag** (borderline, keep for user decision) | 821 |
| G1 | Phase 2 chat | phase2-min-tip | 至少 5 字 | Keep (display:none, validation only) | 1018 |
| H1 | Auth register | password label | 至少 6 字 | Keep (security requirement) | 2535 |
| CTR | Phase 1 all | char-counter suffix | （至少 X 字） | Remove suffix, keep X/Y counter | 4180, 6998 |

---

## Clear-Remove Count: 17–29 instances (confirmed)

Grouped by certainty:
- **Definite remove (user mandate clear):** A1–A5, B1–B12, C1, CTR = **17 instances + up to 12 more E-step** = up to 29
- **Flag / borderline (user to decide):** D1–D4, E1–E7, F1–F7 = 18 more

---

## Proposed Mockup Amendments

### Mockup 03 — Phase 1 Form (`03-phase-1-form.html`)

**Affected sections:** All field blocks (C1 / I / R / C2 / L / E / S steps)

**Amendment A — `field__meta` block:**
- BEFORE: `<div class="field__meta"><span>建議 40-120 字 · 列出用戶想完成的具體任務</span><span class="char-counter">0 / 120</span></div>`
- AFTER: `<div class="field__meta"><span class="char-counter">0 / 120</span></div>` (field 1 only) or remove `field__meta` entirely for field 2/3/4

**Amendment B — E step sol-card `field__meta`:**
- BEFORE: `<div class="field__meta" ...>建議 40-150 字</div>`
- AFTER: Remove this line entirely

**Amendment C — S step tracking-section__sub:**
- BEFORE: `<p class="tracking-section__sub">分別說明北極星指標的 reach / depth / frequency / impact…</p>`
- AFTER: Remove `<p class="tracking-section__sub">` line

**Amendment D — char-counter suffix:**
- BEFORE: `<span class="char-counter is-below-floor">0 / 120 （至少 40 字）</span>`
- AFTER: `<span class="char-counter is-below-floor">0 / 120</span>`

### Mockup 07 — NSM Step 2 (`07-nsm-step-2.html`)

No `metaSpan` / `field__meta` equivalents in NSM Step 2 fields — `renderNSMField()` does not produce inline coaching text below labels. The `提示` + `範例答案` buttons are already the sole guidance mechanism. **No amendment needed for mockup 07.**

### Mockup 05 — Phase 2 Chat (`05-phase-2-chat.html`) — BORDERLINE

If user decides to remove `icebreaker__text` and `conclusion-box__sub`:

**Amendment E — icebreaker card (Phase 2 §A):**
- BEFORE: `<div class="icebreaker"><div class="icebreaker__label">…開始提問方向</div><div class="icebreaker__text">先與被訪談者澄清題目本身的邊界…</div></div>`
- AFTER: Remove `<div class="icebreaker__text">` div; keep label only OR remove entire `.icebreaker` card

**Amendment F — conclusion-box__sub:**
- BEFORE: `<div class="conclusion-box__sub">說明問題範圍、時間框架、業務約束…建議 80-120 字。</div>`
- AFTER: Remove entirely, OR keep with word-count suffix removed

---

## Char Counter Cleanup — One-Line Fix

Both paths use the same pattern. Single change needed in each:

```js
// app.js:4180 — remove floorSuffix computation + usage
var floorSuffix = _isBelowFloor ? '（至少 ' + floorN + ' 字）' : '';  // DELETE this line
counterSpan = '<span class="' + counterClass + '">' + _currentLen + ' / ' + max + '</span>';

// app.js:6998 — remove floorSuffix computation + usage  
var floorSuffix = isBelowFloor ? '（至少 ' + floorN + ' 字）' : '';  // DELETE this line
counter.textContent = nonWsLen + ' / ' + max;
```

---

## Priority / Decision Required

**User to confirm:**
1. Remove `建議 X-Y 字` from metaSpan (incl. non-hint fields, all steps)? — Recommended YES
2. Remove `tracking-section__sub` entirely? — Recommended YES
3. `tracking-card__sub` (dim definition)? — Borderline; recommend keep (structural info)
4. `icebreaker__text` in Phase 2 empty chat state? — Borderline; recommend keep (chat onboarding)
5. `conclusion-box__sub` in Phase 2 conclusion box? — Borderline; recommend remove word-count suffix, keep description

---

*Audit by: Claude Sonnet 4.6 — 2026-05-10*
*No code changes made — audit + proposal only*
