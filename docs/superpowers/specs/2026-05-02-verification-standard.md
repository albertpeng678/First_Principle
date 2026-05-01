# PM Drill — Verification Standard for SP1-4 Plans

**Source:** `audit-cycle.md` (the project's master test director rubric)

> Every implementation task in SP1 / SP2 / SP3 / SP4 plans must satisfy this standard before the task can be marked done. Subagent reviewers must reject claims that don't meet it.

## 1. Mockup compliance contract

- Each task lists its mockup file path + section reference. **Implementer MUST open the mockup HTML in browser and visually compare** before opening any source file.
- Any deviation from mockup (different padding, different radius, different copy, missing element) → **STOP** and escalate to user.
- No "I think this looks better" liberties. If mockup shows blue, you write blue.

## 2. TDD discipline (per-task, no exceptions)

Every code-changing task follows red-green-commit:
1. Write the failing Playwright (or jest) test
2. Run it, confirm it fails for the **expected reason** (assertion mismatch, not 500)
3. Write the minimal implementation to make it pass
4. Run, confirm green
5. Commit (one commit per task)

Pure CSS append tasks (no behaviour change) may skip step 1-2 but still must add a Playwright visual assertion before commit.

## 3. 8-viewport Playwright coverage (mandatory)

Every UI-touching plan must end with at least one Playwright spec that runs on all 8 official projects:

```
Mobile-360 / iPhone-SE / iPhone-14 / iPhone-15-Pro / iPad
Desktop-1280 / Desktop-1440 / Desktop-2560
```

Run command:
```bash
PMDRILL_BASE_URL=http://localhost:4000 npx playwright test \
  --config=tests/playwright/playwright.config.js \
  tests/playwright/journeys/<NEW-SPEC>.spec.js \
  --project=Mobile-360 --project=iPhone-SE --project=iPhone-14 --project=iPhone-15-Pro \
  --project=iPad --project=Desktop-1280 --project=Desktop-1440 --project=Desktop-2560 \
  --reporter=list --screenshot=on
```

Expected: 100% pass. NOT acceptable: "Desktop-1280 passed, others I didn't run".

## 4. Screenshot eyeball verification (memory `feedback_test_all_devices_visual.md`)

Per task that produces a Playwright screenshot:
- Subagent or controller must **personally view** at least 1 screenshot per viewport project
- "Test passed in console" alone does NOT count as evidence. Must have viewed the actual rendered image.

## 5. Happy path + error states + all interactive states

Test coverage for each new component:
- Happy path (renders correctly with realistic data)
- Empty state (no data / 0 items)
- Loading state (where applicable)
- Error state (API fail / network fail / parse fail)
- Hover / active / focus-visible / disabled (each as separate visual assertion)
- Keyboard navigation (Tab order, Enter/Space activation on `role="button"`)

## 6. Guest mode AND auth mode parity

Every flow must work for both:
- Guest (no auth, `X-Guest-ID` header)
- Auth (`Authorization: Bearer <token>`)

Auth-only features (e.g. stats strip, history) must explicitly hide for guests. Verify both paths in tests.

## 7. iOS Safari quirk checklist (memory `feedback_ios_review_before_ship.md`)

Before commit on `public/app.js` / `public/style.css` / `public/index.html` touching mobile UX:
- Touch targets ≥ 44×44 logical px
- `text-overflow: ellipsis` requires `nowrap` + `overflow:hidden`
- `prefers-reduced-motion` respected for any animation
- `env(safe-area-inset-*)` consumed on sticky bottom bars
- Form input `font-size: 16px+` (avoid focus-zoom)
- `interactive-widget=resizes-visual` honored (no sticky jump on keyboard)
- IME composition (`compositionstart`/`compositionend`) doesn't lose chars
- No `position: sticky` regressions inside scroll containers
- No `backdrop-filter` introduced
- No new horizontal scroll on any 360-2560 viewport
- focus-visible outline visible on iOS
- `-webkit-tap-highlight-color: transparent` global rule preserved
- No new `position: absolute` overlay without ARIA
- No new modal without focus trap
- No new long-press / 3D Touch dependencies

## 8. Console & network sanity

- 0 console errors / 0 unhandled rejections on any audited route
- 0 unexpected fetch failures (legitimate auth-required 401 on guest is expected, not a violation)

## 9. Plan sign-off gate

Each plan ends with a sign-off task that requires ALL of these to be true:
- [ ] All TDD tasks committed
- [ ] All 8 Playwright projects green for new specs
- [ ] Existing Playwright suite still green (no regression)
- [ ] Jest green
- [ ] iOS quirk checklist walked
- [ ] At least 8 screenshots personally viewed (1 per viewport)
- [ ] Mockup vs production diff: visual review by controller, no unexplained drift
- [ ] No console errors on dev server during walkthrough

Plan is NOT complete until the controller can answer "yes" to all of the above.

## 10. Self-doubt check before claiming done

Memory `feedback_full_sit_uat_uiux.md`: director sign-off requires SIT/UAT/UI-UX × full viewport. Before reporting "done":
- Did I personally view the rendered screenshot at every viewport, OR did I rely on green test output?
- Did I check console errors, OR did I assume because tests pass?
- Did I check guest AND auth, OR only the path tests covered?

If any answer is "I assumed", go re-verify.
