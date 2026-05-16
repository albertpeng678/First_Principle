---
date: 2026-05-16
stage: 1C
status: draft
scope: Phase 2 chat UI fix — qcard alignment + 上一步 inline with input
linked-mockup: 05-phase-2-chat.html (docs/superpowers/specs/mockups/2026-05-02-frontend-rewrite/05-phase-2-chat.html)
---

# Stage 1C — Phase 2 Chat UI Fix Mockup

**User feedback source:** PNG 22 report (2026-05-16)
**Applies to:** ALL chat phases that use Phase 2 chat surface (CIRCLES Phase 2 對話練習)

---

## §A — What's Wrong

### Bug 1: qcard (題目說明) 未對齊其他頁面 + 無法展開

**Current production behavior** (`public/app.js` lines 791-798, `renderPhase2QchipHtml`):

```
┌─────────────────────────────────────────────┐
│ [i] Spotify · Podcast                    [>] │   ← compact qchip, no visual weight
│     設計一個新功能，提升 Spotify Podcast 黏著度     │   ← title truncated, no expand UX
└─────────────────────────────────────────────┘
```

The qchip renders as a `<button>` with `ph-caret-right` on the right, which implies it is tappable/expandable — but tapping it does nothing (data-phase2="qchip" event is wired but the expand panel does not show full question text + context). The `ph-caret-right` points **right** (suggesting navigation) rather than **down** (suggesting expand-in-place). On Phase 1 (`renderQCard` in Phase 1 form), the question card has full visible body with company, type badge, and full `problem_statement` visible without truncation.

**Gap from mockup 05 §A annotation** (`05-phase-2-chat.html` line 710-716):
The mockup renders the qchip at full width as a sticky bar below `phase-head`. The mockup does NOT show an expand panel in §A/B — the qchip in mockup 05 is intentionally compact. However user is reporting it "doesn't match other pages" — meaning the visual weight and alignment differ from how Phase 1 shows the question (full card with body text visible, no truncation needed).

**Root cause:** The qchip caret icon is `ph-caret-right` suggesting navigation/drill-down but no expand panel exists. Other pages (Phase 1, NSM Step 1) show question in a full card. User expectation: the caret should toggle an expandable panel showing full question text + type badge.

### Bug 2: 上一步 button 渲染在 input bar 上方（獨立 row），應與輸入框同一行

**Current production behavior** (`public/app.js` lines 1005-1045):

```
[上一步]               ← phase-back-row: separate div ABOVE input-bar
─────────────────────────────────────────────
[textarea................] [>]   ← input-bar__row: textarea + send
```

**Mockup 05 §A contract** (`05-phase-2-chat.html` lines 726-732, 784-790, 920-926):

```
─────────────────────────────────────────────
[上一步] [textarea.............] [>]   ← ALL in same .input-bar__row
```

The production implementation diverged: `backRowHtml` (a `.phase-back-row` div, app.js line 1006) is rendered as a sibling above `.input-bar` (line 1044), not inside `.input-bar__row`. The mockup puts `上一步` as the **first child** inside `.input-bar__row`, making it inline with the textarea and send button.

---

## §B — Proposed Fix (3-Viewport HTML Mockup)

The HTML mockup below shows the corrected Phase 2 chat mid-conversation state (Section B in mockup 05 terms) with both fixes applied:

1. qchip expanded to show `ph-caret-down` with a collapsible panel below (closed by default, user taps to expand)
2. `上一步` button inline inside `.input-bar__row` as first child

```html
<!doctype html>
<html lang="zh-TW">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>PM Drill — Stage 1C Fix Mockup — Phase 2 Chat UI</title>

  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@phosphor-icons/web@2.1.1/src/regular/style.css">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@phosphor-icons/web@2.1.1/src/fill/style.css">
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&display=swap">

  <style>
    /* ── design tokens — verbatim from mockup 00 + 05 LOCKED ── */
    :root {
      --c-bg: #F2F0EB; --c-bg-soft: #ECE9E1; --c-bg-deep: #E5E1D7;
      --c-card: #FFFFFF; --c-surface: #FAFAF7;
      --c-ink: #1F1D1B; --c-ink-2: #5A5046; --c-ink-3: #8A7E70; --c-ink-4: #B8AC9D;
      --c-rule: rgba(60,45,30,0.10); --c-rule-bold: rgba(60,45,30,0.18);
      --c-primary: #1A56DB;
      --c-navy: #1B2D5C; --c-navy-2: #142347; --c-navy-lt: rgba(27,45,92,0.08);
      --c-success: #137A3D; --c-success-lt: #DCEFE0;
      --c-warn: #B85C00; --c-warn-lt: #FBE9D0;
      --c-danger: #B61F1F; --c-danger-lt: #FADCDC;
      --font-sans: system-ui, -apple-system, BlinkMacSystemFont, 'PingFang TC', 'Microsoft JhengHei', 'Heiti TC', 'Noto Sans TC', sans-serif;
      --font-serif: 'Instrument Serif', 'Times New Roman', serif;
      --t-h1: 24px; --t-h2: 19px; --t-h3: 16px; --t-body: 15px; --t-body-sm: 14px; --t-meta: 13px; --t-cap: 12px;
      --s-1: 4px; --s-2: 8px; --s-3: 12px; --s-4: 16px; --s-5: 20px; --s-6: 24px; --s-7: 32px; --s-8: 40px;
      --r-input: 6px; --r-card: 10px; --r-pill: 999px;
      --touch-min: 44px;
      --t-fast: 120ms; --t-norm: 200ms;
      --ease: cubic-bezier(0.4, 0, 0.2, 1);
      --shadow-1: 0 1px 0 rgba(60,45,30,0.04);
      --shadow-3: 0 4px 12px rgba(60,45,30,0.08);
      --shadow-focus: 0 0 0 3px rgba(26,86,219,0.18);
    }

    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      background: var(--c-bg);
      color: var(--c-ink);
      font-family: var(--font-sans);
      font-size: var(--t-body);
      line-height: 1.55;
      -webkit-font-smoothing: antialiased;
    }
    button { font: inherit; color: inherit; cursor: pointer; background: none; border: none; }

    /* viewport grid */
    .vp-grid {
      display: grid;
      grid-template-columns: 360px 768px 1280px;
      gap: var(--s-6);
      padding: var(--s-6);
      align-items: start;
      overflow-x: auto;
    }
    .vp-frame {
      border: 1px solid var(--c-rule-bold);
      border-radius: var(--r-card);
      background: var(--c-bg);
      overflow: hidden;
    }
    .vp-frame__label {
      padding: var(--s-3) var(--s-4);
      border-bottom: 1px solid var(--c-rule);
      background: var(--c-card);
      display: flex;
      justify-content: space-between;
      font-size: var(--t-cap);
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--c-ink-2);
    }
    .vp-frame__label span:last-child { font-family: ui-monospace, 'SF Mono', monospace; color: var(--c-ink-3); }

    /* page header */
    .ds-page { padding: var(--s-6); }
    .ds-header { max-width: 2800px; margin: 0 auto var(--s-7); padding-bottom: var(--s-6); border-bottom: 1px solid var(--c-rule); }
    .ds-header h1 { font-size: var(--t-h1); margin-top: var(--s-2); }
    .ds-header__eyebrow { font-size: var(--t-cap); letter-spacing: 0.12em; text-transform: uppercase; color: var(--c-ink-3); }
    .ds-header__sub { color: var(--c-ink-2); font-size: var(--t-body-sm); margin-top: var(--s-3); max-width: 720px; }

    .vp-section-title { max-width: 2800px; margin: var(--s-7) auto var(--s-3); padding-bottom: var(--s-2); border-bottom: 1px solid var(--c-rule); font-size: var(--t-h2); display: flex; align-items: baseline; gap: var(--s-3); }
    .vp-section-title__sub { font-size: var(--t-cap); color: var(--c-ink-3); letter-spacing: 0.04em; text-transform: uppercase; }
    .anno {
      background: var(--c-bg-soft);
      border-left: 2px solid var(--c-ink-3);
      padding: var(--s-3) var(--s-4);
      font-size: var(--t-meta);
      color: var(--c-ink-2);
      margin: var(--s-4) auto;
      max-width: 2800px;
      line-height: 1.7;
    }
    .anno strong { color: var(--c-ink); }
    .anno code { font-family: ui-monospace, 'SF Mono', monospace; font-size: 12px; background: var(--c-card); padding: 1px 6px; border-radius: 4px; border: 1px solid var(--c-rule); }
    .fix-badge {
      display: inline-flex;
      align-items: center;
      gap: var(--s-1);
      padding: 2px var(--s-2);
      background: var(--c-navy-lt);
      color: var(--c-navy);
      font-size: var(--t-cap);
      font-weight: 600;
      border-radius: var(--r-pill);
      letter-spacing: 0.04em;
    }

    /* ── LOCKED components — verbatim from mockup 05 ── */
    .navbar {
      display: flex;
      align-items: center;
      gap: var(--s-3);
      padding: var(--s-3) var(--s-4);
      background: rgba(255,255,255,0.85);
      -webkit-backdrop-filter: saturate(140%) blur(10px);
      backdrop-filter: saturate(140%) blur(10px);
      border-bottom: 1px solid var(--c-rule);
    }
    .navbar__icon-btn { width: 40px; height: 40px; border-radius: var(--r-pill); display: inline-flex; align-items: center; justify-content: center; color: var(--c-ink-2); }
    .navbar__brand { display: flex; align-items: center; gap: var(--s-2); padding: 4px var(--s-2); border-radius: var(--r-input); cursor: pointer; }
    .navbar__brand-icon { width: 28px; height: 28px; border-radius: 6px; background: var(--c-navy); color: #fff; display: inline-flex; align-items: center; justify-content: center; font-size: 16px; }
    .navbar__brand-name { font-size: var(--t-body-sm); font-weight: 500; }
    .navbar__tabs { display: flex; gap: var(--s-2); margin-left: var(--s-4); }
    .navbar__tab { padding: 6px var(--s-3); border-radius: var(--r-pill); font-size: var(--t-meta); color: var(--c-ink-3); }
    .navbar__tab.is-active { background: var(--c-navy); color: #fff; }
    .navbar__actions { margin-left: auto; display: flex; align-items: center; gap: var(--s-2); }
    .navbar__email { font-size: var(--t-cap); color: var(--c-ink-3); max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .turn-badge { font-size: var(--t-meta); color: var(--c-ink-2); background: var(--c-bg-soft); padding: 2px var(--s-2); border-radius: var(--r-pill); }

    .progress {
      padding: var(--s-3) var(--s-4);
      background: var(--c-bg-soft);
      border-bottom: 1px solid var(--c-rule);
      display: flex;
      gap: var(--s-2);
      align-items: center;
      overflow-x: auto;
      white-space: nowrap;
    }
    .progress__step { flex: 0 0 auto; padding: 4px 10px; border-radius: var(--r-pill); font-size: var(--t-cap); color: var(--c-ink-3); }
    .progress__step.is-done { color: var(--c-ink); }
    .progress__step.is-active { background: var(--c-navy); color: #fff; }
    .progress__step .step-letter { font-family: var(--font-serif); font-style: italic; margin-right: 4px; font-size: 14px; }

    .phase-head {
      padding: var(--s-3) var(--s-5);
      background: var(--c-bg-soft);
      border-bottom: 1px solid var(--c-rule);
      display: flex;
      align-items: center;
      gap: var(--s-3);
    }
    .phase-head__num { font-family: var(--font-serif); font-style: italic; font-size: 22px; color: var(--c-navy); line-height: 1; flex: 0 0 auto; }
    .phase-head__main { flex: 1; min-width: 0; }
    .phase-head__eyebrow { font-size: var(--t-cap); letter-spacing: 0.08em; text-transform: uppercase; color: var(--c-ink-3); }
    .phase-head__title { font-size: var(--t-h3); color: var(--c-ink); margin-top: 2px; letter-spacing: -0.005em; }
    .phase-head__meta { flex: 0 0 auto; font-size: var(--t-meta); color: var(--c-ink-3); display: flex; gap: var(--s-3); align-items: center; flex-wrap: wrap; justify-content: flex-end; }
    @media (max-width: 480px) {
      .phase-head__meta { gap: var(--s-2); }
      .phase-head__meta > *:not(.save-indicator) { display: none; }
    }

    /* ── FIX 1: qchip with expandable panel ──────────────────────
       Previously: caret-right always, no expand panel (mockup 05 LOCKED compact)
       Now: caret-down toggles an expand panel showing full question body + type badge
       Rationale: user feedback 2026-05-16 "無法展開" — align with Phase 1 q-card UX
       AMENDED from: mockup 05 qchip (compact, no expand) */
    .qchip {
      display: flex;
      align-items: center;
      gap: var(--s-3);
      padding: var(--s-3) var(--s-5);
      background: var(--c-card);
      border-bottom: 1px solid var(--c-rule);
      width: 100%;
      cursor: pointer;
      transition: background var(--t-fast) var(--ease);
    }
    .qchip:hover { background: var(--c-bg-soft); }
    .qchip__icon { width: 28px; height: 28px; flex: 0 0 auto; border-radius: var(--r-pill); background: var(--c-navy-lt); color: var(--c-navy); display: inline-flex; align-items: center; justify-content: center; font-size: 14px; }
    .qchip__main { flex: 1; min-width: 0; }
    .qchip__company { font-size: var(--t-cap); color: var(--c-ink-3); margin-bottom: 2px; }
    .qchip__title {
      font-size: var(--t-body-sm);
      color: var(--c-ink);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    /* FIX: caret-down instead of caret-right; rotates to caret-up when expanded */
    .qchip__caret { color: var(--c-ink-3); font-size: 16px; flex: 0 0 auto; transition: transform var(--t-fast) var(--ease); }
    .qchip.is-open .qchip__caret { transform: rotate(180deg); }

    /* expand panel — shown when qchip.is-open */
    .qchip-panel {
      display: none;
      background: var(--c-surface);
      border-bottom: 1px solid var(--c-rule);
      padding: var(--s-3) var(--s-5);
    }
    .qchip-panel.is-open { display: block; }
    .qchip-panel__type {
      display: inline-flex;
      align-items: center;
      gap: var(--s-1);
      padding: 2px var(--s-2);
      background: var(--c-navy-lt);
      color: var(--c-navy);
      font-size: var(--t-cap);
      font-weight: 600;
      border-radius: var(--r-pill);
      letter-spacing: 0.04em;
      margin-bottom: var(--s-3);
    }
    .qchip-panel__body {
      font-size: var(--t-body-sm);
      color: var(--c-ink);
      line-height: 1.7;
    }
    .qchip-panel__close {
      margin-top: var(--s-3);
      display: inline-flex;
      align-items: center;
      gap: var(--s-1);
      font-size: var(--t-cap);
      color: var(--c-ink-3);
    }
    .qchip-panel__close:hover { color: var(--c-ink); }

    /* chat components — LOCKED verbatim from mockup 05 */
    .chat-content {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
    }
    .chat-body {
      padding: var(--s-5) var(--s-4);
      max-width: 920px;
      margin: 0 auto;
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: var(--s-3);
      flex: 1;
    }
    .bubble {
      padding: var(--s-3) var(--s-4);
      max-width: 88%;
      font-size: var(--t-body-sm);
      line-height: 1.7;
      color: var(--c-ink);
    }
    .bubble__section {
      font-size: var(--t-cap);
      font-weight: 600;
      letter-spacing: 0.04em;
      margin-bottom: var(--s-1);
      display: flex;
      align-items: center;
      gap: var(--s-1);
    }
    .bubble--user {
      background: var(--c-card);
      border: 1px solid var(--c-rule-bold);
      border-radius: var(--r-card) 4px var(--r-card) var(--r-card);
      align-self: flex-end;
      margin-left: auto;
    }
    .bubble--interviewee {
      background: var(--c-bg-soft);
      border: 1px solid var(--c-rule);
      border-radius: 4px var(--r-card) var(--r-card) var(--r-card);
      align-self: flex-start;
    }
    .bubble--interviewee .bubble__section { color: var(--c-ink-3); }
    .bubble--coach {
      background: var(--c-card);
      border: 1px solid var(--c-rule);
      border-left: 2px solid var(--c-navy);
      border-radius: 4px var(--r-input) var(--r-input) var(--r-input);
      align-self: flex-start;
      max-width: 88%;
      font-size: var(--t-meta);
      padding: var(--s-3);
    }
    .bubble--coach .bubble__section { color: var(--c-navy); }
    .bubble--coach__hint-toggle {
      margin-top: var(--s-2);
      font-size: var(--t-cap);
      color: var(--c-ink-3);
      display: inline-flex;
      align-items: center;
      gap: var(--s-1);
    }

    /* ── FIX 2: 上一步 inline with input ──────────────────────────
       Previously (production): separate .phase-back-row above .input-bar
         app.js lines 1005-1008 + 1044: backRowHtml rendered before inputBarHtml
         style.css line 2007: .phase-back-row is a separate block above border-top
       Now: 上一步 is first child inside .input-bar__row
         Matches mockup 05 §A contract (05-phase-2-chat.html lines 726-732)
       RESTORED to original mockup 05 spec — production had drifted */
    .input-bar {
      background: var(--c-card);
      border-top: 1px solid var(--c-rule);
      padding: var(--s-3) var(--s-4) max(var(--s-3), env(safe-area-inset-bottom));
      display: flex;
      flex-direction: column;
      gap: var(--s-2);
      align-items: stretch;
    }
    .input-bar__row {
      display: flex;
      gap: var(--s-2);
      align-items: flex-end;
    }
    .input-bar__textarea {
      flex: 1;
      min-height: 44px;
      max-height: 120px;
      padding: 10px var(--s-3);
      border: 1px solid var(--c-rule-bold);
      border-radius: var(--r-input);
      background: var(--c-surface);
      font-size: var(--t-body-sm);
      line-height: 1.5;
      color: var(--c-ink);
      resize: none;
      font-family: inherit;
    }
    .input-bar__textarea::placeholder { color: var(--c-ink-3); }
    .input-bar__textarea:focus { outline: none; border-color: var(--c-navy); box-shadow: 0 0 0 3px var(--c-navy-lt); }
    .input-bar__send {
      width: 44px;
      height: 44px;
      flex: 0 0 auto;
      background: var(--c-navy);
      color: #fff;
      border-radius: var(--r-input);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
    }
    .input-bar__send:hover { background: var(--c-navy-2); }

    /* btn — LOCKED from mockup 03/05 */
    .btn {
      display: inline-flex;
      align-items: center;
      gap: var(--s-2);
      min-height: var(--touch-min);
      padding: 0 var(--s-4);
      border-radius: var(--r-input);
      font-size: var(--t-body-sm);
      font-weight: 500;
      transition: all var(--t-fast) var(--ease);
      white-space: nowrap;
      flex: 0 0 auto;
    }
    .btn--ghost { background: transparent; color: var(--c-ink-2); border: 1px solid var(--c-rule-bold); }
    .btn--ghost:hover { background: var(--c-bg-soft); color: var(--c-ink); }

    /* submit pill (turns >= 3) — LOCKED from mockup 05 */
    .input-bar__suggest { display: flex; justify-content: center; }
    .submit-row__btn {
      padding: 8px var(--s-4);
      border-radius: var(--r-pill);
      background: var(--c-navy);
      color: #fff;
      font-size: var(--t-meta);
      font-weight: 500;
      display: inline-flex;
      align-items: center;
      gap: var(--s-2);
    }

    /* viewport frame layout */
    .vp-frame__inner {
      background: var(--c-bg);
      min-height: 880px;
      display: flex;
      flex-direction: column;
    }
    .vp-frame__inner > .chat-content { flex: 1; min-height: 0; }
  </style>
</head>
<body>
  <div class="ds-page">
    <header class="ds-header">
      <div class="ds-header__eyebrow">Stage 1C · Fix Mockup · DRAFT — pending user review</div>
      <h1>Phase 2 Chat UI Fix — 題目說明展開 + 上一步 inline</h1>
      <p class="ds-header__sub">
        兩個 bug 修正：(1) qchip 改用 caret-down + 展開面板顯示完整題目說明，對齊 Phase 1 q-card 體驗；
        (2) 上一步 button 移入 input-bar__row，與 textarea / 送出鈕同一行。
        三裝置並排：mobile 360 / tablet 768 / desktop 1280。
      </p>
    </header>

    <!-- ============================================================ -->
    <!-- Section B-fix — 中段對話：qchip closed（預設狀態）             -->
    <!-- ============================================================ -->
    <h2 class="vp-section-title">
      B-fix · 中段對話（qchip 收合）
      <span class="vp-section-title__sub">預設狀態 · 2 fixes applied</span>
    </h2>
    <div class="anno">
      <strong>視覺契約（修正後）：</strong>
      <span class="fix-badge"><i class="ph ph-wrench"></i> FIX 1</span> qchip 右側改為 <code>ph-caret-down</code>，點擊展開題目完整說明面板（預設收合）。
      <span class="fix-badge"><i class="ph ph-wrench"></i> FIX 2</span> 上一步 button 移入 input-bar__row 第一位，與 textarea + 送出鈕同一行，無獨立 phase-back-row。
      其他所有 LOCKED components（navbar / progress / phase-head / bubble styles / submit pill）不變。
    </div>
    <div class="vp-grid">

      <!-- B-fix · Mobile 360 -->
      <div class="vp-frame">
        <div class="vp-frame__label"><span>Mobile</span><span>360 × 880</span></div>
        <div class="vp-frame__inner" style="width:360px">
          <!-- navbar — LOCKED from mockup 05 -->
          <div class="navbar">
            <button class="navbar__icon-btn" aria-label="menu"><i class="ph ph-list"></i></button>
            <div class="navbar__brand">
              <span class="navbar__brand-icon"><i class="ph ph-circles-three"></i></span>
              <span class="navbar__brand-name">PM Drill</span>
            </div>
            <div class="navbar__actions">
              <span class="turn-badge">2 輪</span>
              <button class="navbar__icon-btn" aria-label="home"><i class="ph ph-house"></i></button>
            </div>
          </div>
          <!-- progress — LOCKED from mockup 05 -->
          <div class="progress">
            <span class="progress__step is-active"><span class="step-letter">C</span><span>澄清</span></span>
            <span class="progress__step"><span class="step-letter">I</span><span>用戶</span></span>
            <span class="progress__step"><span class="step-letter">R</span><span>需求</span></span>
            <span class="progress__step"><span class="step-letter">C</span><span>排序</span></span>
            <span class="progress__step"><span class="step-letter">L</span><span>方案</span></span>
            <span class="progress__step"><span class="step-letter">E</span><span>取捨</span></span>
            <span class="progress__step"><span class="step-letter">S</span><span>總結</span></span>
          </div>
          <!-- phase-head — LOCKED from mockup 05 -->
          <div class="phase-head">
            <span class="phase-head__num">2</span>
            <div class="phase-head__main">
              <div class="phase-head__eyebrow">Phase 2 · 對話練習</div>
              <div class="phase-head__title">C · 澄清情境</div>
            </div>
          </div>
          <!-- FIX 1: qchip with caret-down (closed state) -->
          <button class="qchip" aria-expanded="false">
            <span class="qchip__icon"><i class="ph ph-bookmark-simple"></i></span>
            <div class="qchip__main">
              <div class="qchip__company">Spotify · Podcast</div>
              <div class="qchip__title">設計新功能提升 Spotify Podcast 黏著度</div>
            </div>
            <i class="ph ph-caret-down qchip__caret"></i>
          </button>
          <!-- qchip-panel: hidden by default, shown on tap -->
          <div class="qchip-panel">
            <div class="qchip-panel__type"><i class="ph ph-tag"></i>設計題</div>
            <div class="qchip-panel__body">設計一個新功能，提升 Spotify Podcast 用戶黏著度，鎖定第一週新用戶 7 日留存（從 18% 提升至 25%）。</div>
            <button class="qchip-panel__close"><i class="ph ph-caret-up"></i>收合題目</button>
          </div>
          <!-- chat body — LOCKED bubble styles -->
          <div class="chat-content">
            <div class="chat-body">
              <div class="bubble bubble--user">這個題目是只看 podcast，還是包含音樂？目標是訂閱用戶還是免費用戶？</div>
              <div class="bubble bubble--interviewee">
                <div class="bubble__section">被訪談者</div>
                只看 podcast。目標族群以「30 天內註冊但未養成日常收聽習慣的新用戶」為主。
              </div>
              <div class="bubble bubble--coach">
                <div class="bubble__section"><i class="ph ph-graduation-cap"></i>教練點評</div>
                好的開頭問題。同時釐清「涵蓋範圍」與「目標族群」，避免後續分析展開時邊界模糊。
                <button class="bubble--coach__hint-toggle"><i class="ph ph-caret-right"></i>查看教練提示</button>
              </div>
              <div class="bubble bubble--user">那我們希望看到的具體行為改變是什麼？是 DAU、收聽時長、還是完播率？</div>
              <div class="bubble bubble--interviewee">
                <div class="bubble__section">被訪談者</div>
                7 日留存率（從 18% 到 25%）。次指標是平均收聽時長 15 分鐘以上的用戶比例。
              </div>
            </div>
          </div>
          <!-- FIX 2: 上一步 inline in input-bar__row (matches mockup 05 §A line 728) -->
          <div class="input-bar">
            <div class="input-bar__row">
              <button class="btn btn--ghost"><i class="ph ph-arrow-left"></i>上一步</button>
              <textarea class="input-bar__textarea" placeholder="輸入你的問題..." rows="1"></textarea>
              <button class="input-bar__send" aria-label="送出"><i class="ph ph-paper-plane-tilt"></i></button>
            </div>
          </div>
        </div>
      </div>

      <!-- B-fix · Tablet 768 -->
      <div class="vp-frame">
        <div class="vp-frame__label"><span>Tablet</span><span>768 × 880</span></div>
        <div class="vp-frame__inner" style="width:768px">
          <div class="navbar">
            <button class="navbar__icon-btn" aria-label="menu"><i class="ph ph-list"></i></button>
            <div class="navbar__brand">
              <span class="navbar__brand-icon"><i class="ph ph-circles-three"></i></span>
              <span class="navbar__brand-name">PM Drill</span>
            </div>
            <nav class="navbar__tabs">
              <button class="navbar__tab is-active">CIRCLES</button>
              <button class="navbar__tab">北極星</button>
            </nav>
            <div class="navbar__actions">
              <span class="turn-badge">2 輪</span>
              <button class="navbar__icon-btn" aria-label="search"><i class="ph ph-magnifying-glass"></i></button>
              <button class="navbar__icon-btn" aria-label="home"><i class="ph ph-house"></i></button>
            </div>
          </div>
          <div class="progress">
            <span class="progress__step is-active"><span class="step-letter">C</span><span>澄清</span></span>
            <span class="progress__step"><span class="step-letter">I</span><span>用戶</span></span>
            <span class="progress__step"><span class="step-letter">R</span><span>需求</span></span>
            <span class="progress__step"><span class="step-letter">C</span><span>排序</span></span>
            <span class="progress__step"><span class="step-letter">L</span><span>方案</span></span>
            <span class="progress__step"><span class="step-letter">E</span><span>取捨</span></span>
            <span class="progress__step"><span class="step-letter">S</span><span>總結</span></span>
          </div>
          <div class="phase-head">
            <span class="phase-head__num">2</span>
            <div class="phase-head__main">
              <div class="phase-head__eyebrow">Phase 2 · 對話練習</div>
              <div class="phase-head__title">C · 澄清情境</div>
            </div>
            <div class="phase-head__meta"><span>2 輪對話 · 建議 5-10 輪</span></div>
          </div>
          <!-- FIX 1: qchip with caret-down -->
          <button class="qchip" aria-expanded="false">
            <span class="qchip__icon"><i class="ph ph-bookmark-simple"></i></span>
            <div class="qchip__main">
              <div class="qchip__company">Spotify · Podcast（Drill · 設計題）</div>
              <div class="qchip__title">設計一個新功能，提升 Spotify Podcast 用戶黏著度</div>
            </div>
            <i class="ph ph-caret-down qchip__caret"></i>
          </button>
          <div class="qchip-panel">
            <div class="qchip-panel__type"><i class="ph ph-tag"></i>設計題</div>
            <div class="qchip-panel__body">設計一個新功能，提升 Spotify Podcast 用戶黏著度，鎖定第一週新用戶 7 日留存（從 18% 提升至 25%）。</div>
            <button class="qchip-panel__close"><i class="ph ph-caret-up"></i>收合題目</button>
          </div>
          <div class="chat-content">
            <div class="chat-body">
              <div class="bubble bubble--user">這個題目是只看 podcast，還是包含音樂？目標是訂閱用戶還是免費用戶？</div>
              <div class="bubble bubble--interviewee">
                <div class="bubble__section">被訪談者</div>
                只看 podcast。目標族群以「30 天內註冊但未養成日常收聽習慣的新用戶」為主。
              </div>
              <div class="bubble bubble--coach">
                <div class="bubble__section"><i class="ph ph-graduation-cap"></i>教練點評</div>
                好的開頭問題。同時釐清「涵蓋範圍」與「目標族群」，避免後續分析展開時邊界模糊。
                <button class="bubble--coach__hint-toggle"><i class="ph ph-caret-right"></i>查看教練提示</button>
              </div>
              <div class="bubble bubble--user">那我們希望看到的具體行為改變是什麼？是 DAU、收聽時長、還是完播率？</div>
              <div class="bubble bubble--interviewee">
                <div class="bubble__section">被訪談者</div>
                7 日留存率（從 18% 到 25%）。次指標是平均收聽時長 15 分鐘以上的用戶比例。
              </div>
            </div>
          </div>
          <!-- FIX 2: 上一步 inline -->
          <div class="input-bar">
            <div class="input-bar__row">
              <button class="btn btn--ghost"><i class="ph ph-arrow-left"></i>上一步</button>
              <textarea class="input-bar__textarea" placeholder="輸入你的問題..." rows="1"></textarea>
              <button class="input-bar__send" aria-label="送出"><i class="ph ph-paper-plane-tilt"></i></button>
            </div>
          </div>
        </div>
      </div>

      <!-- B-fix · Desktop 1280 -->
      <div class="vp-frame">
        <div class="vp-frame__label"><span>Desktop</span><span>1280 × 880</span></div>
        <div class="vp-frame__inner" style="width:1280px">
          <div class="navbar">
            <button class="navbar__icon-btn" aria-label="menu"><i class="ph ph-list"></i></button>
            <div class="navbar__brand">
              <span class="navbar__brand-icon"><i class="ph ph-circles-three"></i></span>
              <span class="navbar__brand-name">PM Drill</span>
            </div>
            <nav class="navbar__tabs">
              <button class="navbar__tab is-active">CIRCLES</button>
              <button class="navbar__tab">北極星</button>
            </nav>
            <div class="navbar__actions">
              <span class="navbar__email">albertpeng678@gmail.com</span>
              <span class="turn-badge">2 輪</span>
              <button class="navbar__icon-btn" aria-label="search"><i class="ph ph-magnifying-glass"></i></button>
              <button class="navbar__icon-btn" aria-label="home"><i class="ph ph-house"></i></button>
            </div>
          </div>
          <div class="progress">
            <span class="progress__step is-active"><span class="step-letter">C</span><span>澄清</span></span>
            <span class="progress__step"><span class="step-letter">I</span><span>用戶</span></span>
            <span class="progress__step"><span class="step-letter">R</span><span>需求</span></span>
            <span class="progress__step"><span class="step-letter">C</span><span>排序</span></span>
            <span class="progress__step"><span class="step-letter">L</span><span>方案</span></span>
            <span class="progress__step"><span class="step-letter">E</span><span>取捨</span></span>
            <span class="progress__step"><span class="step-letter">S</span><span>總結</span></span>
          </div>
          <div class="phase-head">
            <span class="phase-head__num">2</span>
            <div class="phase-head__main">
              <div class="phase-head__eyebrow">Phase 2 · 對話練習</div>
              <div class="phase-head__title">C · 澄清情境</div>
            </div>
            <div class="phase-head__meta">
              <span>2 輪對話</span>
              <span style="color:var(--c-rule-bold)">·</span>
              <span>已用 6 分鐘</span>
              <span style="color:var(--c-rule-bold)">·</span>
              <span>建議 5-10 輪</span>
            </div>
          </div>
          <!-- FIX 1: qchip with caret-down -->
          <button class="qchip" aria-expanded="false">
            <span class="qchip__icon"><i class="ph ph-bookmark-simple"></i></span>
            <div class="qchip__main">
              <div class="qchip__company">Spotify · Podcast（Drill mode · 設計題）</div>
              <div class="qchip__title">設計一個新功能，提升 Spotify Podcast 用戶黏著度，鎖定第一週新用戶 7 日留存</div>
            </div>
            <i class="ph ph-caret-down qchip__caret"></i>
          </button>
          <div class="qchip-panel">
            <div class="qchip-panel__type"><i class="ph ph-tag"></i>設計題</div>
            <div class="qchip-panel__body">設計一個新功能，提升 Spotify Podcast 用戶黏著度，鎖定第一週新用戶 7 日留存（從 18% 提升至 25%）。</div>
            <button class="qchip-panel__close"><i class="ph ph-caret-up"></i>收合題目</button>
          </div>
          <div class="chat-content">
            <div class="chat-body">
              <div class="bubble bubble--user">這個題目是只看 podcast，還是包含音樂？目標是訂閱用戶還是免費用戶？</div>
              <div class="bubble bubble--interviewee">
                <div class="bubble__section">被訪談者</div>
                只看 podcast。目標族群以「30 天內註冊但未養成日常收聽習慣的新用戶」為主。
              </div>
              <div class="bubble bubble--coach">
                <div class="bubble__section"><i class="ph ph-graduation-cap"></i>教練點評</div>
                好的開頭問題。同時釐清「涵蓋範圍」與「目標族群」，避免後續分析展開時邊界模糊。
                <button class="bubble--coach__hint-toggle"><i class="ph ph-caret-right"></i>查看教練提示</button>
              </div>
              <div class="bubble bubble--user">那我們希望看到的具體行為改變是什麼？是 DAU、收聽時長、還是完播率？</div>
              <div class="bubble bubble--interviewee">
                <div class="bubble__section">被訪談者</div>
                7 日留存率（從 18% 到 25%）。次指標是平均收聽時長 15 分鐘以上的用戶比例。
              </div>
            </div>
          </div>
          <!-- FIX 2: 上一步 inline -->
          <div class="input-bar">
            <div class="input-bar__row">
              <button class="btn btn--ghost"><i class="ph ph-arrow-left"></i>上一步</button>
              <textarea class="input-bar__textarea" placeholder="輸入你的問題..." rows="1"></textarea>
              <button class="input-bar__send" aria-label="送出"><i class="ph ph-paper-plane-tilt"></i></button>
            </div>
          </div>
        </div>
      </div>

    </div>

    <!-- ============================================================ -->
    <!-- Section B-fix-open — qchip 展開狀態                          -->
    <!-- ============================================================ -->
    <h2 class="vp-section-title">
      B-fix-open · 中段對話（qchip 展開）
      <span class="vp-section-title__sub">FIX 1 — 展開面板顯示完整題目</span>
    </h2>
    <div class="anno">
      <strong>視覺契約（展開狀態）：</strong>
      使用者點擊 qchip 後 caret 轉 180°（caret-up），下方展開 <code>.qchip-panel</code> 顯示 type badge + 完整 problem_statement。
      點擊「收合題目」或再次點擊 qchip 收合。chat 內容正常可繼續滾動互動。
    </div>
    <div class="vp-grid">

      <!-- B-fix-open · Mobile 360 -->
      <div class="vp-frame">
        <div class="vp-frame__label"><span>Mobile</span><span>360 × 880</span></div>
        <div class="vp-frame__inner" style="width:360px">
          <div class="navbar">
            <button class="navbar__icon-btn" aria-label="menu"><i class="ph ph-list"></i></button>
            <div class="navbar__brand">
              <span class="navbar__brand-icon"><i class="ph ph-circles-three"></i></span>
              <span class="navbar__brand-name">PM Drill</span>
            </div>
            <div class="navbar__actions">
              <span class="turn-badge">2 輪</span>
              <button class="navbar__icon-btn" aria-label="home"><i class="ph ph-house"></i></button>
            </div>
          </div>
          <div class="progress">
            <span class="progress__step is-active"><span class="step-letter">C</span><span>澄清</span></span>
            <span class="progress__step"><span class="step-letter">I</span><span>用戶</span></span>
            <span class="progress__step"><span class="step-letter">R</span><span>需求</span></span>
            <span class="progress__step"><span class="step-letter">C</span><span>排序</span></span>
            <span class="progress__step"><span class="step-letter">L</span><span>方案</span></span>
            <span class="progress__step"><span class="step-letter">E</span><span>取捨</span></span>
            <span class="progress__step"><span class="step-letter">S</span><span>總結</span></span>
          </div>
          <div class="phase-head">
            <span class="phase-head__num">2</span>
            <div class="phase-head__main">
              <div class="phase-head__eyebrow">Phase 2 · 對話練習</div>
              <div class="phase-head__title">C · 澄清情境</div>
            </div>
          </div>
          <!-- qchip open state -->
          <button class="qchip is-open" aria-expanded="true">
            <span class="qchip__icon"><i class="ph ph-bookmark-simple"></i></span>
            <div class="qchip__main">
              <div class="qchip__company">Spotify · Podcast</div>
              <div class="qchip__title">設計新功能提升 Spotify Podcast 黏著度</div>
            </div>
            <i class="ph ph-caret-down qchip__caret"></i>
          </button>
          <!-- panel open -->
          <div class="qchip-panel is-open">
            <div class="qchip-panel__type"><i class="ph ph-tag"></i>設計題</div>
            <div class="qchip-panel__body">設計一個新功能，提升 Spotify Podcast 用戶黏著度，鎖定第一週新用戶 7 日留存（從 18% 提升至 25%）。</div>
            <button class="qchip-panel__close"><i class="ph ph-caret-up"></i>收合題目</button>
          </div>
          <div class="chat-content">
            <div class="chat-body">
              <div class="bubble bubble--user">這個題目是只看 podcast，還是包含音樂？</div>
              <div class="bubble bubble--interviewee">
                <div class="bubble__section">被訪談者</div>
                只看 podcast。目標族群以新用戶為主。
              </div>
            </div>
          </div>
          <div class="input-bar">
            <div class="input-bar__row">
              <button class="btn btn--ghost"><i class="ph ph-arrow-left"></i>上一步</button>
              <textarea class="input-bar__textarea" placeholder="輸入你的問題..." rows="1"></textarea>
              <button class="input-bar__send" aria-label="送出"><i class="ph ph-paper-plane-tilt"></i></button>
            </div>
          </div>
        </div>
      </div>

      <!-- B-fix-open · Tablet 768 -->
      <div class="vp-frame">
        <div class="vp-frame__label"><span>Tablet</span><span>768 × 880</span></div>
        <div class="vp-frame__inner" style="width:768px">
          <div class="navbar">
            <button class="navbar__icon-btn" aria-label="menu"><i class="ph ph-list"></i></button>
            <div class="navbar__brand">
              <span class="navbar__brand-icon"><i class="ph ph-circles-three"></i></span>
              <span class="navbar__brand-name">PM Drill</span>
            </div>
            <nav class="navbar__tabs">
              <button class="navbar__tab is-active">CIRCLES</button>
              <button class="navbar__tab">北極星</button>
            </nav>
            <div class="navbar__actions">
              <span class="turn-badge">2 輪</span>
              <button class="navbar__icon-btn" aria-label="search"><i class="ph ph-magnifying-glass"></i></button>
              <button class="navbar__icon-btn" aria-label="home"><i class="ph ph-house"></i></button>
            </div>
          </div>
          <div class="progress">
            <span class="progress__step is-active"><span class="step-letter">C</span><span>澄清</span></span>
            <span class="progress__step"><span class="step-letter">I</span><span>用戶</span></span>
            <span class="progress__step"><span class="step-letter">R</span><span>需求</span></span>
            <span class="progress__step"><span class="step-letter">C</span><span>排序</span></span>
            <span class="progress__step"><span class="step-letter">L</span><span>方案</span></span>
            <span class="progress__step"><span class="step-letter">E</span><span>取捨</span></span>
            <span class="progress__step"><span class="step-letter">S</span><span>總結</span></span>
          </div>
          <div class="phase-head">
            <span class="phase-head__num">2</span>
            <div class="phase-head__main">
              <div class="phase-head__eyebrow">Phase 2 · 對話練習</div>
              <div class="phase-head__title">C · 澄清情境</div>
            </div>
            <div class="phase-head__meta"><span>2 輪對話 · 建議 5-10 輪</span></div>
          </div>
          <button class="qchip is-open" aria-expanded="true">
            <span class="qchip__icon"><i class="ph ph-bookmark-simple"></i></span>
            <div class="qchip__main">
              <div class="qchip__company">Spotify · Podcast（Drill · 設計題）</div>
              <div class="qchip__title">設計一個新功能，提升 Spotify Podcast 用戶黏著度</div>
            </div>
            <i class="ph ph-caret-down qchip__caret"></i>
          </button>
          <div class="qchip-panel is-open">
            <div class="qchip-panel__type"><i class="ph ph-tag"></i>設計題</div>
            <div class="qchip-panel__body">設計一個新功能，提升 Spotify Podcast 用戶黏著度，鎖定第一週新用戶 7 日留存（從 18% 提升至 25%）。</div>
            <button class="qchip-panel__close"><i class="ph ph-caret-up"></i>收合題目</button>
          </div>
          <div class="chat-content">
            <div class="chat-body">
              <div class="bubble bubble--user">這個題目是只看 podcast，還是包含音樂？目標是訂閱用戶還是免費用戶？</div>
              <div class="bubble bubble--interviewee">
                <div class="bubble__section">被訪談者</div>
                只看 podcast。目標族群以「30 天內註冊但未養成日常收聽習慣的新用戶」為主。
              </div>
            </div>
          </div>
          <div class="input-bar">
            <div class="input-bar__row">
              <button class="btn btn--ghost"><i class="ph ph-arrow-left"></i>上一步</button>
              <textarea class="input-bar__textarea" placeholder="輸入你的問題..." rows="1"></textarea>
              <button class="input-bar__send" aria-label="送出"><i class="ph ph-paper-plane-tilt"></i></button>
            </div>
          </div>
        </div>
      </div>

      <!-- B-fix-open · Desktop 1280 -->
      <div class="vp-frame">
        <div class="vp-frame__label"><span>Desktop</span><span>1280 × 880</span></div>
        <div class="vp-frame__inner" style="width:1280px">
          <div class="navbar">
            <button class="navbar__icon-btn" aria-label="menu"><i class="ph ph-list"></i></button>
            <div class="navbar__brand">
              <span class="navbar__brand-icon"><i class="ph ph-circles-three"></i></span>
              <span class="navbar__brand-name">PM Drill</span>
            </div>
            <nav class="navbar__tabs">
              <button class="navbar__tab is-active">CIRCLES</button>
              <button class="navbar__tab">北極星</button>
            </nav>
            <div class="navbar__actions">
              <span class="navbar__email">albertpeng678@gmail.com</span>
              <span class="turn-badge">2 輪</span>
              <button class="navbar__icon-btn" aria-label="search"><i class="ph ph-magnifying-glass"></i></button>
              <button class="navbar__icon-btn" aria-label="home"><i class="ph ph-house"></i></button>
            </div>
          </div>
          <div class="progress">
            <span class="progress__step is-active"><span class="step-letter">C</span><span>澄清</span></span>
            <span class="progress__step"><span class="step-letter">I</span><span>用戶</span></span>
            <span class="progress__step"><span class="step-letter">R</span><span>需求</span></span>
            <span class="progress__step"><span class="step-letter">C</span><span>排序</span></span>
            <span class="progress__step"><span class="step-letter">L</span><span>方案</span></span>
            <span class="progress__step"><span class="step-letter">E</span><span>取捨</span></span>
            <span class="progress__step"><span class="step-letter">S</span><span>總結</span></span>
          </div>
          <div class="phase-head">
            <span class="phase-head__num">2</span>
            <div class="phase-head__main">
              <div class="phase-head__eyebrow">Phase 2 · 對話練習</div>
              <div class="phase-head__title">C · 澄清情境</div>
            </div>
            <div class="phase-head__meta">
              <span>2 輪對話</span>
              <span style="color:var(--c-rule-bold)">·</span>
              <span>已用 6 分鐘</span>
              <span style="color:var(--c-rule-bold)">·</span>
              <span>建議 5-10 輪</span>
            </div>
          </div>
          <button class="qchip is-open" aria-expanded="true">
            <span class="qchip__icon"><i class="ph ph-bookmark-simple"></i></span>
            <div class="qchip__main">
              <div class="qchip__company">Spotify · Podcast（Drill mode · 設計題）</div>
              <div class="qchip__title">設計一個新功能，提升 Spotify Podcast 用戶黏著度，鎖定第一週新用戶 7 日留存</div>
            </div>
            <i class="ph ph-caret-down qchip__caret"></i>
          </button>
          <div class="qchip-panel is-open">
            <div class="qchip-panel__type"><i class="ph ph-tag"></i>設計題</div>
            <div class="qchip-panel__body">設計一個新功能，提升 Spotify Podcast 用戶黏著度，鎖定第一週新用戶 7 日留存（從 18% 提升至 25%）。</div>
            <button class="qchip-panel__close"><i class="ph ph-caret-up"></i>收合題目</button>
          </div>
          <div class="chat-content">
            <div class="chat-body">
              <div class="bubble bubble--user">這個題目是只看 podcast，還是包含音樂？目標是訂閱用戶還是免費用戶？</div>
              <div class="bubble bubble--interviewee">
                <div class="bubble__section">被訪談者</div>
                只看 podcast。目標族群以「30 天內註冊但未養成日常收聽習慣的新用戶」為主。
              </div>
              <div class="bubble bubble--coach">
                <div class="bubble__section"><i class="ph ph-graduation-cap"></i>教練點評</div>
                好的開頭問題。同時釐清「涵蓋範圍」與「目標族群」。
                <button class="bubble--coach__hint-toggle"><i class="ph ph-caret-right"></i>查看教練提示</button>
              </div>
            </div>
          </div>
          <div class="input-bar">
            <div class="input-bar__row">
              <button class="btn btn--ghost"><i class="ph ph-arrow-left"></i>上一步</button>
              <textarea class="input-bar__textarea" placeholder="輸入你的問題..." rows="1"></textarea>
              <button class="input-bar__send" aria-label="送出"><i class="ph ph-paper-plane-tilt"></i></button>
            </div>
          </div>
        </div>
      </div>

    </div>
  </div>
</body>
</html>
```

---

## §C — Diff from Mockup 05

### AMENDED (2 changes)

| 元素 | 原 mockup 05 規格 | 本 mockup 修正 | 原因 |
|---|---|---|---|
| `qchip` caret icon | `ph-caret-right`（始終右箭頭，無展開動作）| `ph-caret-down`（預設），`.is-open` 時 rotate 180deg；新增 `.qchip-panel` 展開面板顯示 type badge + full body | user 回報「無法展開」；caret-right 語意為跳頁而非展開 |
| `上一步` button 位置 | 生產 drift：獨立 `.phase-back-row` 在 input-bar 上方（app.js line 1006）| **恢復** mockup 05 原始規格：上一步為 `.input-bar__row` 第一子元素，與 textarea + send 同行（mockup 05 line 728） | user 回報「應該與輸入框同一行」；這實際是還原漂移而非新設計 |

### UNCHANGED (all LOCKED components)

| 元素 | 狀態 |
|---|---|
| navbar（mobile / tablet / desktop 變體）| LOCKED — verbatim from mockup 05 |
| progress bar（7-step pills）| LOCKED |
| phase-head（num / eyebrow / title / meta）| LOCKED |
| bubble styles（user / interviewee / coach）| LOCKED |
| coach hint toggle button | LOCKED |
| input-bar__textarea + input-bar__send | LOCKED |
| submit pill（turns >= 3 `ph-arrow-right`）| LOCKED |
| submit-strip / conclusion-box | LOCKED |
| locked-banner / phase-back-row CSS | REMOVED (phase-back-row no longer needed) |
| design tokens (colors / spacing / radii) | LOCKED from mockup 00 |

---

## §D — LOCKED Contracts

The following from mockup 05 carry forward unchanged into Stage 1C implementation:

- `.qchip` base styles (padding, bg, hover, border-bottom) — only caret icon + panel added
- `.input-bar__textarea` all CSS properties including iOS font-size 16px
- `.input-bar__send` 44×44px navy square
- `.btn--ghost` border + ghost treatment
- all bubble classes and their alignment rules
- all color token values (`--c-navy: #1B2D5C`, `--c-bg: #F2F0EB`, etc.)
- Phosphor icon family (`ph-*`) — no emoji

### New locked contracts (from this mockup)

- `ph-caret-down` on qchip (closed state); CSS `transform: rotate(180deg)` on `.is-open`
- `.qchip-panel` display: none default; `.is-open` display: block
- `.qchip-panel__type` = navy-lt bg pill with `ph-tag` icon
- `上一步` = `.btn.btn--ghost` as first child of `.input-bar__row`
- No `.phase-back-row` div in DOM

---

**Status: DRAFT — pending user 放行 before Stage 1C implementation**
