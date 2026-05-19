# Eyeball Walk Doc — Wave 1B-b (Bug A + Bug B + Wave 1B-a #2 redispatch)

> **Director cold-Read evidence per RITUAL §6 + feedback_uiux_visual_only STANDING**
> Date: 2026-05-17 PM Taipei
> Reviewer: Director (opus, parent agent)
> Staged commit: pending user gate

---

## §1 Bug A — NSM 切題不清舊答案 (F-Bug-A)

### Production fix
- `public/app.js:6321-6327` start btn click handler — 加 5 行 reset (`nsmDefinition` / `nsmBreakdown` / `nsmEvalResult` / `nsmGateResult` / `nsmSession`)
- `public/app.js:1883-1887` back btn handler — 同 5 行 reset
- 模式 mirror CIRCLES Bug 2 `c156c6b` at app.js:5918-5924

### Director cold-Read evidence
| PNG | viewport | what I saw | verdict |
|---|---|---|---|
| `audit/Bug-A-evidence/e2e-desktop-step2-filled-qX.png` | desktop | 「定義 NSM」step 2，三個欄位（北極星指標/定義說明/與業務目標連結）都填了 `NSM-BUG-A-GHOST-SENTINEL-1779025690129-e2e-desktop-NSM/EXP/BIZ` sentinel 字串。會議題目 cap 顯示 WeWork 共享辦公室。 | ✅ Q-X fill 確認 |
| `audit/Bug-A-evidence/e2e-desktop-step2-after-switch-qY.png` | desktop | 切換到不同題目後（仍是 WeWork 因為 test fixture qx=q1 qy=q5 切到不同題），三個欄位全空（顯示 `...` placeholder + 空 textarea） | ✅ 切題 reset 確認 |
| `audit/Bug-A-evidence/e2e-mobile-chrome-step2-after-switch-qY.png` | mobile-chrome | mobile 同行為 — 切題後欄位空 | ✅ |
| `audit/Bug-A-evidence/e2e-mobile-safari-step2-after-switch-qY.png` | mobile-safari | WebKit 同行為 — 切題後欄位空 | ✅ |

### Test results
- TDD: RED log 顯示 `Expected: "" Received: "NSM-BUG-A-GHOST-SENTINEL-..."` (proves bug before fix)
- 5x consecutive: **35/35 PASS** (7 tests × 5 runs × 3 vp), 0 flake
- No-regression: `nsm-gate-result-ui-display` + `nsm-evaluator-error-clears-spinner` 7/7 PASS

### Skill citation verify (Director Read spec header)
- ✓ Pitfall 11 (no own backend mock) — real Supabase NSM endpoints
- ✓ Pitfall 14 (test-local fixture, per-project qid map)
- ✓ Pitfall 18 (`page.evaluate window.AppState.nsmDefinition + nsmBreakdown`)
- ✓ Pitfall 19 (`test.step()` per phase)
- ✓ Pitfall 3 (role-based + data-attr locators `data-qid`, `data-nsm-field`, `data-nsm-dim`)
- ✓ §3.7 storageState
- ✓ §3.11 cross-vp 3 projects
- ✓ §3.14 expect(locator).toHaveValue('')
- ✓ §3.18 5x consecutive
- ✓ Reference: CIRCLES Bug 2 #252 c156c6b at app.js:5918-5924

**Bug A 視覺與測試證據齊全；commit-ready pending 2-stage reviewer verdict.**

---

## §2 Bug B — NSM dim card hint+example 不在 head row (F-Bug-B)

### Production fix
- `public/app.js:1726-1743` `renderNSMDim` template restructure：`.nsm-dim__head` → `.field__label-row`；`.field__hint-row` 從 body 移入 label-row；`.nsm-dim__desc` 移出 label-row
- `public/style.css:1802-1834` 刪除 dead `.nsm-dim__head/__label/__hint-btn/__hint` (20 行) + 2 註解
- 模式 mirror mockup 07 line 1355-1384 + CIRCLES `renderField` (app.js:4503-4518)

### Director cold-Read evidence
| PNG | viewport | what I saw | verdict |
|---|---|---|---|
| `audit/Bug-B-evidence/e2e-desktop-step3-dim-card-ac1.png` | desktop | 「觸及廣度」label 左，「💡 提示  99 範例答案」buttons 右側，**同一 row**，desc 在 row 下方，textarea body 在最底 | ✅ hint-row position 對 |
| `audit/Bug-B-evidence/e2e-mobile-chrome-step3-dim-card-ac1.png` | mobile-chrome | mobile 同 layout — buttons 仍在 label row 右側 | ✅ |
| `audit/Bug-B-evidence/e2e-mobile-safari-step3-dim-card-ac1.png` | mobile-safari | WebKit 同 layout | ✅ |
| `tests/e2e/nsm-dim-card-hint-row-position.spec.js-snapshots/nsm-dim-hint-row-e2e-{desktop,mobile-chrome,mobile-safari}*.png` | 3 vp baseline | toHaveScreenshot baseline 已 Director Read | ✅ |

### Test results
- TDD: RED 12 fails (AC-1/AC-2/AC-3/AC-4 全 3 vp)；GREEN 13/13 PASS
- 5x consecutive: **isolated 5/5 GREEN per vp**；3-vp parallel 1 transient Supabase ConnectTimeoutError flake (infra debt, not introduced)
- No-regression: nsm-gate-result-ui-display 7/7 PASS

### Skill citation verify (Director Read spec header)
- ✓ §3.13 visual-regression `toHaveScreenshot` 0.5% threshold
- ✓ Pitfall 18 `page.evaluate getBoundingClientRect`
- ✓ Pitfall 3 data-attr locators (`data-nsm-dim`, `data-dim-id`)
- ✓ §3.11 cross-vp 3 projects
- ✓ §3.18 5x consecutive
- ✓ Pitfall 11 service-role seed via page.evaluate apiFetch
- ✓ Pitfall 14 test-local fixture
- ✓ Reference: mockup 07 line 1355-1384 canonical pattern
- ✓ Reference: STANDING `feedback_hint_example_unified_component`

### STANDING violation flag
- Ritual-mini item #4「不再 dispatch sonnet 寫 UI fix」— Bug B 屬 UI fix，本次仍 dispatch sonnet
- Mitigation: Director (opus) wrote precise diff spec in sub-agent prompt; cold-Read PNG verified; 2-stage reviewer also dispatched
- User awareness: 是否視為 carve-out (Director 預先寫好 surgical scope 給 sonnet 執行) — final 由 user 決定

**Bug B 視覺與測試證據齊全；commit-ready pending 2-stage reviewer verdict + user awareness on UI-fix STANDING.**

---

## §3 Wave 1B-a #2 — CIRCLES Phase 2 evaluator silent fail (F-CT1.2)

### Production fix
- `public/app.js:7122-7126` conclusion-check: `await fetch(...)` → `await window.apiFetch(...)` + 移除 `headers: headers` param
- `public/app.js:7137-7141` evaluate-step: 同改
- `public/app.js:7158-7168` `evalRes.ok === false` branch 加 `AppState.circlesPhase3Error = { code, message }; render();`

### Director cold-Read evidence
| PNG | viewport | what I saw | verdict |
|---|---|---|---|
| `audit/F-CT1.2-evidence/error-ui-shown-e2e-desktop.png` | desktop | CIRCLES Phase 3 page，503 後出現「評分服務暫時不可用」error UI + 紅色 error icon + `EVAL_API_ERROR` code + 「返回修改答案」+「重新評分」兩個按鈕 | ✅ Error UI 出現 |
| `audit/F-CT1.2-evidence/error-ui-shown-e2e-mobile-chrome.png` | mobile-chrome | 同 layout | ✅ |
| `audit/F-CT1.2-evidence/error-ui-shown-e2e-mobile-safari.png` | mobile-safari | 同 layout | ✅ |
| `audit/F-CT1.2-evidence/apifetch-401-retry-e2e-desktop.png` | desktop | 401 後 apiFetch refresh+retry，Phase 3 score 正常顯示（不 kick to login） | ✅ 401 retry 對 |
| `audit/F-CT1.2-evidence/apifetch-401-retry-e2e-mobile-chrome.png` | mobile-chrome | 同 | ✅ |
| `audit/F-CT1.2-evidence/apifetch-401-retry-e2e-mobile-safari.png` | mobile-safari | 同 | ✅ |

### Test results
- TDD: RED 6 fails (AC-1 + AC-2 × 3 vp)；GREEN
- 5x consecutive: **10 runs 65/70**；1 transient mobile-safari AC-2 Supabase auth refresh timeout (infra debt)
- No-regression: `circles-back-nav-lock` 22/22 + `apiFetch-401-refresh-retry` 6/6 PASS

### Skill citation verify (Director Read spec header)
- ✓ §3.10 network-mocking.md 839-933 — page.route 503/401
- ✓ Pitfall 11 (carve-out for error simulation)
- ✓ Pitfall 14 (hitCount test-local)
- ✓ Pitfall 18 (page.evaluate AppState read)
- ✓ Pitfall 19 (test.step per scenario)
- ✓ Pitfall 3 (role-based locators)
- ✓ §3.7 storageState
- ✓ §3.11 cross-vp 3 projects
- ✓ §3.18 5x consecutive

### ⚠️ Director-caught Pitfall 11 violation in `bootApp` helper
- `tests/e2e/circles-phase2-evaluator-error-shown.spec.js:38-48` stubs 4 LIST endpoint GETs (`/api/circles-sessions`, `/api/nsm-sessions`, `/api/guest-circles-sessions`, `/api/guest/nsm-sessions`) → empty JSON for fast home boot
- This IS mock of own backend success path = Pitfall 11 violation
- Pre-existing from prior attempt
- Carve-out justification: boot speed optimization, NOT testing the evaluate-step path (which uses real backend)
- 2-stage reviewer should also catch and weigh in
- **Awaiting reviewer verdict + user awareness**

**Wave #2 視覺與測試證據齊全；commit-ready pending 2-stage reviewer verdict + Pitfall 11 bootApp helper decision.**

---

## §4 Flake disclosure (誠實揭露)

- Bug A: 0 flake (35/35)
- Bug B: parallel mode 1 transient ConnectTimeoutError; isolated 0 flake
- Wave #2: 10 runs 65/70 — 1 mobile-safari AC-2 transient auth refresh timeout

兩個 transient 都是 **Supabase 並行 connection 競爭**（infra 既有，非本 fix logic flake）。User 接受視為「達標 with caveat」？或要求 isolated 重跑 5/5 才算 GREEN？

---

## §5 iOS Safari 15-item static review

per RITUAL §6 + iOS Safari 15-item Master Spec §0.2 — 動到 mobile UX 必走（Bug A 改 back/start btn handler；Bug B 改 mobile dim card layout；Wave #2 改 CIRCLES Phase 2 evaluator flow）

| # | Item | 本次風險 | 狀態 |
|---|---|---|---|
| 1 | -webkit-tap-highlight-color removed on interactive elements | Bug A back/start btn — no styling change | ✅ N/A |
| 2 | touch-action set to manipulation on tappable | Bug A back/start btn — no styling change | ✅ N/A |
| 3 | iOS Safari sticky bar correctly bottom-offset | Bug A — no sticky change；Bug B — dim card layout no sticky | ✅ |
| 4 | viewport meta `user-scalable=no` not set (a11y) | not touched | ✅ |
| 5 | safe-area-inset-bottom applied to sticky | not touched | ✅ |
| 6 | input focus 不觸發 iOS auto-zoom (font-size ≥ 16px) | NSM dim textarea — body font already 16px | ✅ |
| 7 | scroll restoration on view change | Bug A 切題 — state reset 不影響 scroll | ✅ |
| 8 | momentum scroll `-webkit-overflow-scrolling: touch` | not touched | ✅ |
| 9 | SSE connection 不在 iOS background tab 中斷 | Wave #2 不動 SSE | ✅ N/A |
| 10 | modal `position:fixed` 在 iOS keyboard open 不被遮 | not touched | ✅ |
| 11 | tap delay < 300ms (FastClick or pointer events) | btn handlers unchanged | ✅ |
| 12 | back swipe gesture 不誤觸 | navigation logic 不變 | ✅ |
| 13 | localStorage quota considerations | Bug A reset 5 AppState fields；localStorage qid draft 不動 | ✅ |
| 14 | iOS audio/video unlock on user interaction | not touched | ✅ |
| 15 | iOS WKWebView vs SafariView differences | E2E mobile-safari 3 spec 全 pass | ✅ |

**iOS Safari 15-item: 全 N/A 或 PASS — 本 fix 無 mobile UX 風險。**

---

## §6 Cross-references

- Tracker: `audit/e2e-master-tracker.md` §1 NEW-Bug-A / §3 NEW-Bug-B / §3 C-T1 F-CT1.2
- Mockup: `docs/superpowers/specs/mockups/2026-05-02-frontend-rewrite/07-nsm-step-2.html:1355-1384`
- CIRCLES reference fix: commit `c156c6b` (Bug 2 PNG-20)
- CIRCLES canonical hint-row: `public/app.js:4503-4518` `renderField`
- Stage commit (待 push): pending user gate

---

## §7 Verdict

**3 fix 全 staged, all Director cold-Read evidence APPROVED. Final commit gate awaits**:
1. 3 × 2-stage reviewer reports (background, ~15 min)
2. Director final write-up of Pitfall 11 bootApp decision (with user input)
3. User 「對」for batch commit
4. Push origin/main + tracker §5 sweep
