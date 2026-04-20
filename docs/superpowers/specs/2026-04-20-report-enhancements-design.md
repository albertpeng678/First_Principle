# Report Enhancements Design

**Date:** 2026-04-20
**Status:** Approved

## Overview

Six enhancements to PM Drill's report and submission flow:
1. Per-dimension quality example questions (AI-generated, issue-specific)
2. Problem essence quality example (static format + AI coach answer)
3. Coach demo conversation in review tab (independent coach run)
4. Coach answers problem essence with reasoning
5. Items 3 & 4 locked until scoring is complete
6. PDF export covers all tabs via print CSS

---

## System A — Dimension Examples (Features 1 & 2)

### Static (hardcoded in frontend)

Each dimension shows a one-line concept description:

| Dimension | Static Description |
|-----------|-------------------|
| 角色定位 | 釐清抱怨者的實際角色、負責範圍與在流程中的位置 |
| 任務卡點 | 找出具體的行為斷點——他在哪個步驟卡住、無法繼續 |
| 替代行為 | 挖掘用戶現在怎麼繞過這個問題（暗示真正的痛點） |
| 損失量化 | 了解損失的維度與量級（時間、金錢、頻率、影響範圍） |
| 定義品質 | 最終問句是否中性、不預設解法、聚焦在本質問題 |

問題本質格式範例（靜態）：
> 「如何讓 [具體角色] 在 [情境/流程節點] 降低 [可量化損失]？」

### AI-Generated (per session, added to evaluator output)

Evaluator prompt extended to output per dimension:
- `exampleQuestion`: one ideal question the coach would ask at this dimension

And at top level:
- `essenceExample`: one example problem essence sentence tailored to this issue

---

## System B — Coach Demo (Features 3, 4, 5)

### Generation

Triggered **synchronously at submit time**, after `evaluate()` completes.

New file: `prompts/coach-demo.js`

The AI plays a "perfect student" role:
- Receives the same issue as the student
- Runs 3–5 rounds of questioning (AI decides when enough info is collected)
- Each round: AI generates its own question + simulated interviewee reply
- Finishes by submitting a problem essence + reasoning

Output stored in new DB column `coach_demo_json`:

```json
{
  "conversation": [
    {
      "coachQuestion": "你遇到這問題的人，主要是哪類用戶？新用戶還是舊用戶？",
      "intervieweeReply": "主要是新用戶，第一次登入的那種"
    }
  ],
  "coachEssence": "如何讓首次登入的新用戶在驗證流程中不中斷完成率？",
  "coachReasoning": "追問後發現受害者集中在新用戶，且卡點在 email 驗證步驟，問題本質是流程完成率而非帳號系統。"
}
```

### Visibility Rule (Feature 5)

Coach demo and coach essence are **only rendered** when `session.scores_json` exists. The submit flow guarantees both `scores_json` and `coach_demo_json` are set before the report page loads, so no additional unlock logic is needed.

### Submit Flow

```
POST /:id/submit
  1. evaluate(session)          → scores_json
  2. generateCoachDemo(session) → coach_demo_json
  3. DB update: { final_definition, scores_json, coach_demo_json, status: 'completed' }
  4. res.json({ scores: scores_json, coachDemo: coach_demo_json })
```

Both steps run sequentially. If `generateCoachDemo` fails, log the error and store `coach_demo_json: null` — don't block the submit.

---

## System C — PDF Export (Feature 6)

Add `@media print` rules to `style.css`:

```css
@media print {
  /* Hide chrome */
  .navbar, .offcanvas, .offcanvas-overlay,
  .practice-bottom-bar, .tab-bar,
  .export-tab-actions, #btn-export-pdf, #btn-export-png { display: none !important; }

  /* Show all tab panes */
  .tab-pane { display: block !important; }

  /* Page break before each tab section */
  .tab-pane + .tab-pane { page-break-before: always; }

  /* Full width */
  #app { max-width: 100% !important; padding: 0 !important; }
  .score-summary-bar { padding: 12px 24px; }
}
```

`window.print()` in `exportPDF()` stays unchanged — browser handles the rest.

---

## Data Schema Changes

### DB columns to add (both `guest_sessions` and `practice_sessions`)

| Column | Type | Default |
|--------|------|---------|
| `coach_demo_json` | jsonb | null |

Migration: `routes/migrate.js` or direct SQL in `db/migrations/`.

### evaluator output changes

`scores_json` gains per-dimension `exampleQuestion` and top-level `essenceExample`. These are backward compatible (old sessions without these fields just won't show examples).

---

## Frontend Changes

### New 5th report tab: 「問題本質」

```
tabs: 評分總覽 | 練習回顧 | 亮點摘要 | 問題本質 | 匯出
```

Tab content:
- 學員的定義（always shown）
- 靜態格式範例（always shown）
- 教練的定義 + 思路（only when `coach_demo_json` exists）

### 評分總覽 tab changes

Each `score-detail-card` gets a new row:
```html
<div class="score-detail-row">
  <i class="ph ph-chat-circle-dots" style="color:var(--accent)"></i>
  <span><strong>示範問句：</strong>${exampleQuestion}</span>
</div>
```

### 練習回顧 tab changes

**Remove** the 「本輪預期重點」column (`turnAnalysis.idealFocus`) entirely — not shown in any view.

Desktop: two-column layout (學員 left, 教練 right).
Mobile: stacked (學員 first, 教練 below, separated by divider).

Coach column shows `coachQuestion` + `intervieweeReply` per round. Coach text (questions and replies) renders in `var(--accent)` (purple). If coach has fewer rounds than student, remaining rows are empty. Coach column hidden entirely if `coach_demo_json` is null.

---

## Files Changed

| File | Change |
|------|--------|
| `prompts/evaluator.js` | Add `exampleQuestion` per dimension + `essenceExample` to prompt + output |
| `prompts/coach-demo.js` | New file: generates coach demo conversation |
| `routes/guest-sessions.js` | Submit route: call `generateCoachDemo`, store `coach_demo_json`, return in response |
| `routes/sessions.js` | Same as above for auth users |
| `public/app.js` | `renderReport()`: new tab, updated review tab, dimension examples; `bindReport()`: wire new tab |
| `public/style.css` | Print CSS, coach demo layout styles |

---

## Out of Scope

- No DB migration script needed if using Supabase schema editor (add column manually)
- PNG export not changed (already captures all tabs)
- No streaming for coach demo — single blocking call is acceptable
