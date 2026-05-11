# Walk-all-sessions audit — 2026-05-11

Director-personal Playwright walkthrough of user `albertpeng678@gmail.com` real account, all 5 saved practice sessions (Mobile-360 baseline; remaining 7 vp pending after fixes ship).

## Sessions enumerated (offcanvas list)

| # | Title | Type | State | Date |
|---|---|---|---|---|
| 0 | Spotify · Spotify播放列表推薦 | CIRCLES · C 澄清 · 草稿 | in-progress draft | 46 分鐘前 |
| 1 | Spotify · Spotify播放列表推薦 | CIRCLES · C 澄清 | scored | 5/2 |
| 2 | Zoom | NSM · 4 步 | scored 80分 | 5/1 |
| 3 | Netflix · Netflix Originals | CIRCLES · R 重新定義 · 草稿 | in-progress draft | 5/1 |
| 4 | Fiverr | NSM · 4 步 | scored 60分 | 4/22 |

## Findings — what's working

| Item | Status |
|---|---|
| Login flow (#auth-email + auth-submit) | ✓ |
| Offcanvas history list — 5/5 records visible | ✓ |
| Click session card → restores correct phase | ✓ |
| Bug 1 smart routing (Zoom → Step 4 80分) | ✓ confirmed via state JSON |
| Step 3 textareas show user's saved breakdown | ✓ all 4 dims populated |
| Phase title parentheses removed (drill + sim, 7 steps) | ✓ |
| CIRCLES example buttons enabled | ✓ all 4 fields |
| CIRCLES hint buttons enabled | ✓ all 4 fields |
| CIRCLES user-typed content visible (e.g. Spotify 時間範圍="測試") | ✓ |
| 教練思路 mobile bottom-sheet | ✓ now overlay-modal (post bdd505a) |

## Findings — bugs confirmed still broken

### Bug X1 — NSM example buttons ALL DISABLED (data layer)

Visual + JSON evidence:
- Step 2 (nsm / explanation / businessLink) × 3 buttons: all `disabled` with `title="此題暫無範例答案"`
- Step 3 (reach / depth / frequency / impact) × 4 buttons: same
- Affects BOTH Zoom (5/1) AND Fiverr (4/22) — every NSM session

Root cause: `nsmSelectedQuestion.field_examples.step2[fieldId]` and `.step3[dim.id]` are missing from the saved `question_json` snapshot. This is a question-bank data gap — sessions stored questions before `field_examples` was added to the bank.

Fix scope:
- **Backend rehydration** (preferred): on list/detail endpoint, replace `question_json` with current question-bank row (which has `field_examples`). Path 2 carve-out NEEDED for prompts/data layer.
- **Frontend fallback**: lookup current question by `question_id` and merge `field_examples` into the in-memory copy. Frontend-only, no backend change.

### Bug X2 — NSM Step 2 locked view missing "你的 NSM" section

Visual evidence (Mobile-360 `s2-nsm-Zoom-04-step2-Mobile-360.png`):
- "已評分完成 內容鎖定，可繼續查看提示與範例" banner visible
- Question card + 3-step rail (找 AHA 時刻 / 轉成可量化指標 / 做虛榮指標檢驗) visible
- "← 上一步" / "下一步" buttons present
- **The user's saved NSM definition (`每週使用Zoom 完成一場「1 小時 3 人以上會議」的用戶數`) is NOWHERE rendered on this view**

Root cause: when `nsmEvalResult` exists (scored session), the Step 2 render skips emitting the input/output area entirely; only the rail and submit-bar remain. The locked overlay banner says "可繼續查看提示與範例" but there's nothing to view because the user's input is gone from the UI.

Fix scope: frontend — in locked state, render the saved NSM definition + explanation + business-link as read-only `<div>` blocks (or `disabled` textareas) showing the user's saved text.

### Bug X3 — NSM Step 4 question banner truncated, no expand

Visual evidence (`s2-nsm-Zoom-02-step4-Mobile-360.png`):
- "遠端工作普及後，Zoom 需確保企業用戶真的在..." banner shown TRUNCATED on mobile
- No expand-chevron / no "深入了解問題" toggle (unlike Step 2/3 which have it)

Fix scope: frontend — mirror Step 2/3 `nsm-context-card__head` pattern with toggle + expand block driven by `AppState.nsmContextExpanded` state (already exists, just need to add render path in Step 4 wrapper).

### Bug X4 — Hint content feels generic / not question-specific

Step 2 + Step 3 hint modals on Zoom session both returned IDENTICAL text:
> "想想看你的 Activation 門檻是什麼？是「建帳號」還是「完成核心工作流一次」？..."

Same text for both fields suggests either (a) cache collision, (b) hint endpoint is field-agnostic, or (c) Zoom's hint template defaults to Activation regardless of field. User perception: hint feels generic, not Zoom-specific.

Root cause: needs deeper read of `prompts/nsm-hints.js` + `prompts/nsm-step2-hint.js` + `prompts/nsm-step3-hint.js`. Possibly a prompt-engineering issue.

Fix scope: **prompts layer — Path 2 carve-out REQUIRED.**

## Out-of-scope confirmed

- CIRCLES example/hint buttons: enabled, working — user's CIRCLES complaint not visually confirmed. Need user clarification.
- CIRCLES user typed content: shown correctly for fields user actually typed. Empty placeholder for never-typed fields is correct.

## Cross-vp coverage status

**Mobile-360 only as of this report.** Remaining 7 viewports (iPhone-SE / iPhone-14 / iPhone-15-Pro / iPad / Desktop-1280 / Desktop-1440 / Desktop-2560) will be captured after the X1-X3 fixes ship.

---

## Ship-status of fixes deployed today

| commit | what | localhost | production |
|---|---|---|---|
| `a07a300` | CIRCLES drill paren removed | ✓ | ✓ |
| `48eea1f` | CIRCLES sim paren removed (E + S) | ✓ | ✓ |
| `2cd4374` | Bug 3 navbar reset + user_nsm string coerce | ✓ | ✓ |
| `bdd505a` | 教練思路 mobile bottom-sheet overlay | ✓ | ✓ (after 60a7333 redeploy trigger) |
| `60a7333` | empty commit (Railway ghcr.io 502 redeploy) | n/a | ✓ |

## Pending fixes (need user decision)

| Bug | Scope | Path 2 implications |
|---|---|---|
| X1 NSM example data missing | data backfill or FE merge | carve-out needed if backend; FE-only is workaround |
| X2 Step 2 locked view missing user NSM | frontend only | ✓ within current carve-out |
| X3 Step 4 expand 問題說明 | frontend only | ✓ within current carve-out |
| X4 Hint generic content | prompts | full carve-out needed for prompts |
