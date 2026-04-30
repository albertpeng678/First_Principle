# step-nsm — NSM 工作坊 audit log (2026-04-30)

Agent: `step-nsm`
Director: PM Drill audit-cycle test director
Scope: Universe rows **A1/A4/A5/A6, B6/B7, J1–J8, K1–K3, L1, M1–M8** as they touch the NSM workshop (steps 1 → 2 → gate → 3 → 4 + hints + context + evaluate + offcanvas integration).
Mode: READ-ONLY. No code changes.

## Evidence

- Probe: `audit/cycles/2026-04-30/probes/step-nsm-probe.js`
- Per-viewport JSON results: `audit/cycles/2026-04-30/probes/step-nsm-<viewport>.json`
- Screenshots: `audit/cycles/2026-04-30/screenshots/step-nsm/<viewport>/01..09-*.png`
- Playwright NSM-tagged audit-master run (8 projects): **53 passed / 0 failed / 46 skipped** (3.4 m).
  Command:
  ```
  PMDRILL_BASE_URL=http://localhost:4000 npx playwright test \
    --config=tests/playwright/playwright.config.js journeys/audit/audit-master.spec.js \
    -g "nsm|NSM" --workers=4 --reporter=line
  ```

## Coverage matrix (NSM rows × 8 viewports)

Legend: ✅ pass · ⚠️ partial / spec gap · ❌ fail. Source: probe JSON + screenshots.

| Row | Mob-360 | iPh-SE | iPh-14 | iPh-15P | iPad | D-1280 | D-1440 | D-2560 |
|---|---|---|---|---|---|---|---|---|
| J1 sub-tab nav (step3 disabled before gate) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| J2 step1→2→gate(POST 200)→3→4 (guest) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| J3 重新定義 NSM resets step 3 | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| J4 hints API POST `/:id/hints` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| J5 context API POST `/api/nsm-context` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| J6 evaluate API POST `/:id/evaluate` (200) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| J7 step-4 subtab row + radar layout | ⚠️ | ⚠️ | ⚠️ | ⚠️ | ⚠️ | ⚠️ | ⚠️ | ⚠️ |
| J8 `#btn-nsm-back` + `#btn-nsm-home-nav` on 2/3/**4** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| K1 offcanvas list (NSM session interleaved) | ✅ | ✅ | ⚠️ empty | ✅ | ✅ | ✅ | ✅ | ⚠️ empty |
| L1 review-examples standalone | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| B6/B7 navbar tabs + hamburger | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| M2 zero console errors (full happy path) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

## Findings (file as ISSUE-NSM-NN)

### ISSUE-NSM-01 [P1] — `#btn-nsm-home-nav` missing on Step 4
- **Universe row:** J8 (universe says: "appears on steps 2/3/4").
- **Reproduce:** Run probe `J8_home_nav_on_steps_234` — every viewport reports `step4.homeNav=false step4.back=true`.
- **Code evidence:** `public/app.js:5981` (Step 4 navbar) renders only `#btn-nsm-back` (re-purposed as a house icon `aria-label="回首頁"`). The matching navbar on Step 2 (`5595/5597`) and Step 3 (`5818/5820`) renders both buttons. The same omission exists on the gate sub-tab navbar at line `5856` (only `btn-nsm-back` with house icon).
- **Impact:** Inconsistent IA — Step 4 lacks the dedicated 回首頁 affordance. Anyone tab-navigating with screen reader gets a single `aria-label="回首頁"` that the back-handler routes through `nsmStep===4` branch (line 6029) which does `nsmStep=1; nsmSession=null; navigate('nsm')`, so functionally it is the same; but the universe spec is violated and the icon is the same as `btn-nsm-back` elsewhere — accessibility / labelling drift.
- **Director call:** Either (a) add `#btn-nsm-home-nav` to Step 4 navbar to match Step 2/3, or (b) update universe J8 to read "Step 4 collapses back+home into a single house button" and fix the aria-label / id consistency.

### ISSUE-NSM-02 [P1] — `#btn-nsm-redefine` not surfaced on Step 2 in normal flow
- **Universe row:** J3 (universe says: "Step 2 has #btn-nsm-redefine — clicking resets step 3 state").
- **Reproduce:** Probe `J3_redefine_resets_step3` — every viewport reports `redefine-btn=0`. Walking step1→step2 never reveals the button.
- **Code evidence:** `public/app.js:5584` shows the button is wrapped in the `vanityWarningPanel` — it only renders when `AppState.nsmVanityWarning` is set (legacy state). The handler at `6198` only clears `nsmVanityWarning` and `nsmNsmDraft` — it does **not** reset `nsmBreakdownDraft`, `nsmGateResult`, `nsmHints`, `nsmContext`, etc.
- **Impact:** J3 is unreachable in the live UX, and even when reached the click does NOT reset Step 3 state as the universe claims.
- **Director call:** Either expose the button on Step 2 unconditionally and broaden the handler to wipe `nsmBreakdownDraft / nsmGateResult / nsmHints` (matches universe), or correct the universe row to describe the actual vanity-warning-only path.

### ISSUE-NSM-03 [P1] — Step 4 radar canvas not detected at any viewport
- **Universe row:** J6 / J7 / H2 ("NSM 4-dimension scores correct" + "radar size").
- **Reproduce:** Probe `J7_step4_layout` reports `radarRect:null` for all 8 viewports even though the preceding `J6_evaluate_radar` confirms `evaluate.status=200`.
- **Selectors searched:** `.nsm-step4-desktop canvas`, `.nsm-view canvas`, `canvas`. None matched after evaluate returned.
- **Possible causes:** (a) radar renders only on a specific tab (`overview` is the default per `5991`, but the canvas may be inside `comparison` / `highlights` tabs); (b) Chart.js / SVG instead of `<canvas>` — selector mismatch; (c) deferred render that needs additional waitTime / scroll into view. Screenshot `06-step4-layout.png` should clarify visually.
- **Director call:** Inspect screenshots `05-nsm-step4.png` + `06-step4-layout.png` per viewport. If radar IS visually present it is a probe-selector miss (downgrade to documentation fix). If it is NOT visually present, this is a P0 bug — file accordingly. **Defer severity to director after eyeball.**

### ISSUE-NSM-04 [P2] — Step 4 main content column extremely narrow on Desktop-2560
- **Universe row:** J7 + cross-cutting wide-monitor layout (CLUSTER-A in audit-master).
- **Reproduce:** Probe J7 on Desktop-2560 reports `subRect.width=931 / mainW=2560` → tab-bar is 36 % of viewport. On Desktop-1280 the ratio is 62 % (789/1280); on Desktop-1440 it is 51 %.
- **Code evidence:** `.nsm-step4-desktop` likely capped at `max-width: ~1100px` in CSS while `.circles-home-desktop` was widened to 88 % per `audit-master.spec.js:65-76` (AUD-000-A). NSM Step 4 was not part of that widen pass.
- **Impact:** Two large empty side bands at ≥1440 — same complaint that drove AUD-000-A4 for CIRCLES home.
- **Director call:** Apply the same wide-monitor sizing rule to NSM Step 4 wrapper.

### ISSUE-NSM-05 [P2] — Offcanvas list intermittently empty on iPhone-14 / Desktop-2560
- **Universe row:** K1.
- **Reproduce:** Probe `K1_offcanvas_nsm_in_list` — `offcanvas-items=0` on iPhone-14 and Desktop-2560 in this run; `=1` on the other six. iPhone-14 also logged `requestFailures=1`. Other viewports do show 1 item (the NSM session created mid-probe).
- **Possible cause:** Race between guest-id cookie + listing call after a fresh `goto('/')` resets the page. Single failed request on iPhone-14 supports this hypothesis.
- **Director call:** Add a short retry/wait or ensure offcanvas waits for the list-fetch to settle before measuring; not user-visible if the list ultimately renders.

### ISSUE-NSM-06 [P3 / spec drift] — Universe wording "step 2 has 3 textareas" was inaccurate
- The Step 2 form is **one `<input>` (`#nsm-nsm-input`) plus two `<textarea>` (`#nsm-definition-input`, `#nsm-business-link-input`)**, not three textareas. Initial probe filled only the two textareas and the `/gate` POST never fired (passes the empty-NSM client-side guard at `app.js:6133`). After updating the probe to fill the input as well, gate=200 / hints/evaluate all green.
- **Director call:** Update the universe row J2 to clarify the field shape (input + 2 textareas) so future probes don't regress.

## Negative paths exercised cleanly

- A1 guest first-visit + UUID issuance → no 4xx.
- A6 mid-call 401: not directly exercised by this probe (no auth swap mid-flight); requires step-c1 / step-r agents' work — flagged for director cross-check.
- M2 console: 0 errors / 0 page errors across all 8 viewports for the full step1→4 happy path.
- M8 server JSON envelope: not specifically invoked here (no malformed-body probe); covered elsewhere.

## Audit-master Playwright run (NSM filter)

- 53 passed / 0 failed / 46 skipped, 3.4 m, all 8 projects (Mobile-360 / iPhone-SE / iPhone-14 / iPhone-15-Pro / iPad / Desktop-1280 / Desktop / Desktop-1440 / Desktop-2560). The `Desktop` legacy alias is exercised; results identical to `Desktop-1280`.
- Notable green tests: AUD-004 (Step 1 multi-col grid ≥1440), AUD-008 (`北極星指標` tap routing), AUD-009 (NSM never shows CIRCLES C header), AUD-016 (4-step indicator labels), AUD-035 (代理變數 inline plain explanation), AUD-037 (Step 1 disabled CTA helper text), AUD-040 (Step 1 = 5 cards), AUD-054 (Step 2 sticky bottom bar), AUD-055 (logout right-edge gap parity), AUD-014 (`前往 NSM` button non-overlap).

## Hand-off to director

- Director should triage **ISSUE-NSM-01 / 02 / 03** before sign-off. NSM-03 is the only candidate P0; the rest are P1/P2.
- Re-verification path: rerun `node audit/cycles/2026-04-30/probes/step-nsm-probe.js <vp>` per viewport after fixes; expect `step4.homeNav=true`, `redefine-btn>=1` with `bdAfter='{}'` from a non-empty `bdBefore`, and `radarRect != null`.

— end log —
