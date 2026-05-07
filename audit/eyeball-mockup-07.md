# Eyeball Walk — Bundle 07 NSM Step 2 + Step 3

**Date:** 2026-05-08
**Branch:** `feat/path-2-nsm`
**Commit range (initial):** `8333158..ded8b35` (3 commits — CONFIGS + RED + GREEN)
**Fix-pass commits (2026-05-08):** `3621f53` (16 dim cells verbatim) / `91e8d51` (wire [data-nsm-submit] handler) / `0b27d6a` (RT toolbar covers .nsm-rt-field) / `50c26a8` (Step 3 copy 送出，取得 AI 評分) / `6faea26` (toolbar 4 buttons text-indent/outdent) / `a8b2633` (verbatim test asserts) / `16938d0` (real hint content + label/aria toggle)
**Final HEAD:** `16938d0`
**Mockup:** `docs/superpowers/specs/mockups/2026-05-02-frontend-rewrite/07-nsm-step-2.html`
**Spec:** `docs/superpowers/specs/2026-05-07-mockup-07-nsm-step-2-3-design.md`

> **Status: FIX-PASS LANDED, PENDING RE-REVIEW** — first-pass reviewer flagged 5 🔴 critical + 8 🟡 important; fix-sonnet landed 7 commits 2026-05-08. Re-review dispatched. This doc finalized after re-review.

## Test gates (initial pass)

- jest: **143 passed / 17 skipped / 0 fail** (no regression)
- Playwright `nsm-step-2-3.spec.js`: **12/12 pass** Desktop-1280
- 32 PNGs captured via `tests/visual/capture-mockup-07-pngs.spec.js` (4 states × 8 viewport)

## PNGs Read by director (cross-viewport)

| State | Viewport | Verdict |
|---|---|---|
| `step2-empty` | Desktop-1280 | ✓ sub-tabs (步驟2/NSM審核 disabled/步驟3 disabled) + 4-step nsm-progress (情境 done · 指標 active · 拆解 / 總結) + Spotify navy + 注意力型 chip + 3-step guide + 3 fields + submit-bar 提交審核 disabled |
| `step2-filled` | Desktop-1280 | ✓ NSM filled「每月完成至少一首完整曲目播放的活躍月用戶數」+ example expanded shows「例：…」+ 定義說明 / 業務連結 filled + 提交審核 enabled (navy fill) |
| `step3-attention` | Desktop-1280 | ✓ phase-head 拆解輸入指標 + 你的 NSM banner + attention 4-dim cards (觸及廣度 / 互動深度 / 習慣頻率 / 留存驅力) — labels match mockup |
| `step3-saas` | Desktop-1280 | ✓ SaaS labels switch (啟用廣度 / 席次深度 / 黏著頻率 / 擴張信號) — **key proof of dynamic NSM_DIMENSION_CONFIGS** |
| `step2-empty` | Mobile-360 | ✓ stacked single-col + sub-tabs + Spotify chip + 3-step guide + sticky submit-bar bottom |
| `step3-attention` | Mobile-360 | ✓ 4 dim cards 1-col stack + each card desc + coachQ + 查看教練提示 + textarea |
| `step3-saas` | iPad | ✓ SaaS labels confirmed in iPad viewport |

## Critical rules verified — at static render layer

✓ Sub-tab disabled when no `nsmGateResult` (step3 sub-tab `disabled` attribute)
✓ Submit-bar disabled when nsm OR businessLink empty (Step 2)
✓ Submit-bar disabled when any dim empty (Step 3)
✓ Dynamic NSM_DIMENSION_CONFIGS labels per product type (attention vs saas)
✓ All zh-TW + Phosphor icons + system-ui font

## Critical rules verified after fix-pass

- ✅ `[data-nsm-submit]` Step 2 → POST `:id/gate` body `{nsm, rationale}` (rationale = explanation + '\n\n' + businessLink) → sets `nsmGateResult` + switches sub-tab
- ✅ `[data-nsm-submit]` Step 3 → POST `:id/evaluate` body `{userNsm, userBreakdown}` → stores `nsmEvalResult`; Step 4 deferred per spec
- ✅ NSM RT toolbar B / list / indent / outdent (4 of 4) wired via `.nsm-rt-tbtn` selector in global handler
- ✅ Step 3 submit copy「送出，取得 AI 評分」(Step 2 keeps「提交審核」)
- ✅ 16 dim cells `desc / coachQ / hint` verbatim from mockup (SaaS 4/4 corrected; attention/transaction/creator audited)
- ✅ Hint content per dim — `renderNSMDim` now sources `dim.hint` from configs
- ✅ Hint button label toggle + `aria-expanded` per `AppState.nsmHintExpanded[dimKey]`
- ✅ Bonus: Playwright route glob bug fixed — `(guest-)?` regex syntax → explicit routes via `mockApis()` helper

Backend endpoints used (all already existed, locked):
- `POST /api/(guest-)nsm-sessions` body `{questionId, questionJson}` → returns `{sessionId}`
- `POST /api/(guest-)nsm-sessions/:id/gate` body `{nsm, rationale}` → returns gate result
- `POST /api/(guest-)nsm-sessions/:id/evaluate` body `{userNsm, userBreakdown}` → returns score

## iOS 15-item static review (mobile UX touched) — pending fix-pass

Will run after fix-pass commits land.

## Pixel-diff vs mockup baseline

Pending fix-pass complete.

## Verdict

**PENDING RE-REVIEW** — fix-pass landed, re-reviewer dispatched. Final verdict pending.

After re-review APPROVED:
1. Re-capture 32 PNGs + spot-check 4 critical states across 3 viewports (in progress on port 4104)
2. iOS 15-item walk
3. Then merge to main
