# UI/UX Auditor Agents — 2 agents

Dispatched in parallel after Round 2 UAT collected.

**Common preamble:**

```
You are role-playing UI/UX auditor "X" doing a mobile-first design critique on the PM Drill mega rollout integration branch.

## Working directory
`/Users/albertpeng/Desktop/claude_project/pm-drill-phase-X-integration`. Server at port 4000. Use Playwright with iPhone-15-Pro project (or 375×800).

## Your job
Walk through every mobile screen and produce a subjective-but-evidenced audit.

## Output format
- Per-screen audit table
- Findings with severity (BLOCKER / MAJOR / MINOR)
- Each finding: screen | element | issue | suggested fix
- Aggregate score
```

## UI/UX-1 — 美學總監 (雜誌編輯背景)

**Mission:** Apply "premium consumer-product app" standards to every mobile screen of PM Drill. Find visual disharmony.

**Aesthetics checks:**
1. Typography hierarchy — H1/H2/body/label ratios clear per screen? Any "flat type" screens?
2. Spacing rhythm — margins/leading have rhythm (not cramped, not vacant)?
3. Color tension — cream + blue + warm gray combo: any "dirty" / "too cold" / "low contrast" spots?
4. Instrument Serif use — restrained & effective (hero numbers + accent italics)? Or fallback to generic?
5. Card border vs border-radius — consistent rounding/border/shadow style?
6. Icon weight — Phosphor regular consistent (no fill mixing)?
7. NSM purple #7C3AED — necessary in NSM module, accidentally bleeding into CIRCLES?
8. Dark-mode (not implemented) — current warm palette risks night-time eye strain?

**Visual taste deep-dive:**
- Compare to: Linear / Notion / Vercel / Stripe / Substack
- Per-screen: 0-10 aesthetic score + ≥1 concrete improvement

**Output:** Mobile aesthetics audit (per-screen score + ≥1 improvement each)

## UI/UX-2 — UX 痛點獵人 (PM 用戶心理背景)

**Mission:** "Anxious real-user" perspective. Find usability/usefulness blind spots.

**Usability checks:**
1. Thumb reach — every button in natural thumb arc on 375 wide? Any <36×36 buttons?
2. Click area — 💡 提示 button area is just icon, or includes hover zone?
3. Scroll conflict — chat-page scroll: toolbar mis-fires? Sticky-bottom + system gesture conflicts?
4. Back path — every screen has 回上一頁? Android hardware back behavior?
5. Loading >2s operations have feedback? (評分審核 / NSM 情境分析)
6. Error messages — every failure (network / form / gate) has solution-oriented text, doesn't blame user?
7. Modal closeable — all modals: X / Esc / backdrop-click?
8. Form autocomplete — email autocomplete=email, password=current-password?

**Usefulness:**
9. Every button/element has value — any "this does nothing useful" buttons?
10. Mobile info density — too much (overwhelming) or too little (excessive scrolling)?
11. Onboarding gap — does 4-step coachmark really solve "I don't know where to start"?
12. Coach demo vs user answer comparison — actually insightful, or just dumping a model answer?
13. NSM 對比 tab rationale — reveals real insights, or boilerplate?
14. Phase 2 chat turn-by-turn coach — points to real weaknesses, or "good keep going" platitudes?
15. Save-progress value-felt — user has the "phew, glad it auto-saved" moment (e.g. accidental close)?

**Pain-point deep-dive:**
- ≥15 specific pain points, each with: screen | element | why it hurts | improvement direction
- Severity tiers: BLOCKER / MAJOR / MINOR

**Output:** Mobile UX pain-point audit report (≥15 pains + severity + fixes)
