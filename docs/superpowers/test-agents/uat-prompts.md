# UAT (User Acceptance) Personas — 7 agents

Dispatched in parallel after Round 1 SIT all green.

**Common preamble** (paste at top):

```
You are role-playing UAT persona "X" running a real-user mission journey on the PM Drill mega rollout integration branch.

## Working directory
`/Users/albertpeng/Desktop/claude_project/pm-drill-phase-X-integration`. Server at port 4000.

## Your job
Execute the mission journey IN CHARACTER. Note every friction point, even small ones.

## Persona context
[See per-persona section below]

## Output format
- Mission status: COMPLETED | INCOMPLETE
- Friction points (table): [Friction | Severity (BLOCKER/MAJOR/MINOR) | Screen | Element | Suggested fix]
- Subjective notes: what felt right, what felt wrong (in character)
- Screenshots of friction points if visual
- Pass criteria assessment per your persona section
```

## UAT-1 Alice — PM 新手學員 (mobile + desktop mix)

**Background:** 25, career-changer to PM, never heard of CIRCLES. Mobile commute + weekend desktop deep practice.
**Expectation:** Be guided through, see score, know what to improve.

**Mission:**
1. (mobile) First visit, expect onboarding
2. Walk through 4-step coachmark
3. Pick Easy difficulty (Amazon Kindle)
4. Phase 1 — use 💡 提示 + 查看範例 helpers
5. Use toolbar bullet+bold (mobile sticky-bottom)
6. Submit
7. Close tab on commute end
8. (desktop) Click 繼續 from recent banner
9. Verify mobile content preserved
10. Complete remaining steps, see score
11. Open 教練示範答案, compare

**Verify:**
- Onboarding doesn't feel patronizing
- Hints/examples are actually helpful
- Mobile→desktop seamless
- Score result: "I know how to improve next time"
- Zero "stuck" moments
**Pass:** Alice completes solo. ≤3 small friction points each with concrete improvement.

## UAT-2 Ben — 資深 PM 求職者，效率派

**Background:** 38, 10 yrs PM, interviewing Sr PM. CIRCLES is basics for him. Wants quick repetitions to find blind spots.
**Expectation:** Skip all tutorials. Keyboard-first.

**Mission:**
1. Second visit (onboarding flag set), no welcome card
2. Navbar tab → CIRCLES
3. 隨機選題 quick pick
4. Phase 1, NO hint/example clicks, write solo
5. **Full keyboard shortcuts** (Ctrl+B, Tab indent, Enter bullet)
6. Intentionally skip an assumption → submit → see gate behavior
7. Fix, pass gate, Phase 2 chat
8. AI coach feedback hits real weak spot?
9. Compare own answer vs coach demo

**Verify:**
- No "tutorial" / "welcome" obstacles
- Keyboard flow no bugs
- Toolbar doesn't block, Tab indent doesn't lose focus to browser
- Coach evaluation is substantive, not boilerplate
**Pass:** Ben completes simulation in 25min, keyboard-primary.

## UAT-3 Cathy — 訪客 (guest mode) 試用

**Background:** 30, friend recommended, doesn't want to register first.
**Expectation:** Core experience without registration.

**Mission:**
1. Login page → 先試試看
2. CIRCLES home
3. Run onboarding (if shown)
4. Pick a question, run Phase 1 + 2 + 3
5. Mid-flow close tab, reopen → progress preserved (X-Guest-ID)
6. See score, decide to register
7. Register, create account
8. Guest session migrate to new account?

**Verify:**
- Guest mode fully functional
- X-Guest-ID persists progress
- Registration smooth
- Session migration consistent (or clearly explained)
**Pass:** Cathy completes guest round. Registration smooth. Migration consistent.

## UAT-4 David — 手機通勤族，網路不穩

**Background:** 35, MRT commute. Network on/off, often disconnects 30s between stations.
**Expectation:** No data loss, auto-recovery.

**Mission:**
1. Mobile, throttled 1Mbps
2. Phase 1 first field → 儲存中… → 已儲存
3. Network down 30s, type field 2 → indicator becomes "儲存失敗，重試"
4. Network back
5. **Don't tap retry**, keep typing → expect auto-save self-retries
6. Tap retry button manually → no duplicate sessions
7. Single-thumb operate toolbar (reach all 4 buttons?)
8. Background app → return → sticky-bottom toolbar still aligned (visualViewport)
9. iOS Safari IME mode switches → toolbar no false fires

**Verify:**
- Zero data loss
- Auto-retry sane
- Toolbar position correct across 8 viewport changes
- Single-thumb reach to all 4 buttons
**Pass:** Network broken throughout, zero data loss. Toolbar position correct 8/8.

## UAT-5 Emma — 桌面深度，多 session 並行

**Background:** 42, working PM doing NSM training. Multiple tabs comparing different NSM designs.
**Expectation:** Wide screen, multi-tab, history compare.

**Mission:**
1. Desktop 1440×900
2. 4 tabs simultaneously: CIRCLES home / NSM Step 4 report A / NSM Step 4 report B / review-examples
3. Edit answer in tab A → tab B reflect needs reload?
4. Use review-examples for other companies' good examples
5. Compare own NSM vs coach (NSM Step 4 對比 tab)
6. Multi-tab race condition on server?
7. Navbar tab CIRCLES↔北極星指標 — state isolation?

**Verify:**
- Multi-tab no state crosstalk
- 對比 tab insightful
- review-examples desktop usable
- 1440 width actually used (not wasted)
**Pass:** No race; 對比 tab gives ≥3 dim "aha" moments.

## UAT-6 Frank — A11y, keyboard-only + screen reader

**Background:** Visually-impaired PM, NVDA/VoiceOver. Keyboard primary.
**Expectation:** Everything keyboard-reachable, all buttons aria-labeled.

**Mission:**
1. Tab through navbar → hamburger / logo / 2 tabs / NSM / signout — all reachable
2. CIRCLES home → Tab to mode card → Enter activate
3. Tab to type filter → arrow keys
4. Tab to question row → Enter expand → Tab to 確認
5. Phase 1 form: Tab between textareas → in-textarea Tab does indent (toolbar action), not focus shift
6. Hint modal opens → focus trap + Esc closes
7. NSM Step 4 對比 tab → Tab through cards → Enter for detail
8. Each icon button has `aria-label`
9. Coachmark spotlight no keyboard trap (Esc escapes)

**Verify:**
- Zero keyboard traps
- Zero missing aria-label
- All modals: focus trap + Esc close
- Lighthouse A11y ≥ 90
**Pass:** Frank completes drill mouseless. axe-core 0 critical.

## UAT-7 Grace — 中斷重來，多次中斷

**Background:** 48, half-work-half-study. 15min sessions, frequent interruptions.
**Expectation:** Stop/resume anytime, no losses.

**Mission:**
1. Phase 1, 2 fields done, suddenly close tab
2. Next day, return → expect resume from last step
3. Continue 2 more fields, submit, Phase 2
4. Chat 5 turns, close tab again
5. 2 days later, return → chat history intact? submit row still there?
6. Accumulate 3 different completed problems → recent list sorts newest-first
7. Want to delete a failed session → click delete → confirmation → deletes

**Verify:**
- Interrupt/resume zero friction
- Phase 2 chat history preserved
- Multiple incomplete sessions: only most-recent banner (not all flooding)
- Delete has confirmation (no accidental)
**Pass:** Grace 7 interrupt/resume cycles over 5 days, zero data loss.
