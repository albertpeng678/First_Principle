# 補洞 F-CT1.3 — Playwright e2e leg findings
**日期:** 2026-05-18  
**Task:** #3 補洞 — F-CT1.3 缺 Playwright e2e leg

## 架構發現（重要）

原 task 設計要在瀏覽器層模擬 OpenAI 429 (`page.route gate endpoint → 429`)，但架構不符：

- `circles-gate.js` 的 backoff retry loop 是 **server-to-OpenAI**（Node.js 內部）
- 瀏覽器只發出 **1 個 POST** 到 `/api/circles-sessions/:id/gate`
- Playwright `page.route` 只能攔截瀏覽器→server 的請求，無法攔截 server→OpenAI
- 若把 gate endpoint 回傳 429 給瀏覽器 → `apiFetch` 沒有 429 retry → `circlesGateError = 'GATE_API_ERROR'` → UI 顯示錯誤（不會 retry）

**結論：** jest unit test（15/15 GREEN, `tests/circles-gate-backoff.test.js`）已覆蓋 800ms backoff 數學。  
e2e leg 的正確定位是：**RITUAL §1 full chain regression guard** — 驗證 backoff patch 沒有破壞 gate success path。

## 完成產出

### 新增檔案
- `tests/e2e/wave1-fct1.3-circles-gate-backoff-real-flow.spec.js`
- `tests/e2e/playwright.config.js` (testMatch 加入 `wave1-fct1\.3-circles-gate-backoff-real-flow`)

### 測試設計

單一 test, 1 scenario, 3 vp (e2e-desktop / e2e-mobile-chrome / e2e-mobile-safari):

1. Boot to CIRCLES home (clear localStorage + stub session-list GETs 防 auto-resume)
2. Drill mode → qcard click → confirm → Phase 1 form
3. AppState inject valid C1 draft + render() → submit button enabled → click
4. Observe gate POST count = 1 (server-side backoff transparent)
5. Wait gate result renders (expect.poll, ≤ 60s)
6. Assert: `gateInflight=false`, `circlesGateError=null`, `.gate-transition` visible
7. page.reload() → GET `/api/circles-sessions/:id` → assert `gate_result` not null in DB
8. cleanup via `apiFetch DELETE`

## 數字總覽

| 指標 | 值 |
|---|---|
| 5x consecutive runs | 5/5 PASS |
| 測試 per run | 4 (setup + 3 vp) |
| 累計通過 | 20/20 |
| Flake | 0 |
| Gate round-trip (典型) | 6–10s |
| DB persistence verified | gate_result 非 null + lifecycle ∈ {created, editing, gated} |

## 7 條絕對禁令遵守狀況

1. 禁 `--update-snapshots` — ✅ DOM assertion only
2. 禁 mock 自家 backend success path — ✅ gate POST 走真 backend；只 stub session-list GET (carve-out)
3. 禁 `waitForTimeout` — ✅ 全用 `expect.poll` / `waitForFunction` / `waitFor`
4. 禁 module-level shared state — ✅ `capturedSessionId` 等全為 test-local
5. 禁直接 append tracker.md — ✅ 本檔為 `audit/補洞-fct1.3-e2e-findings.md`
6. 禁 self-approve — `git ls-files` 結果見下方
7. 禁 commit — ✅ 只 stage，未 commit

## git ls-files 結果

```
# 新檔案 (git ls-files --error-unmatch 失敗 = NOT TRACKED = new file)
tests/e2e/wave1-fct1.3-circles-gate-backoff-real-flow.spec.js → NOT TRACKED YET (new file, staged)
tests/e2e/playwright.config.js → tracked, modified (staged)
```

## 已 Stage 的檔案

```
A  tests/e2e/wave1-fct1.3-circles-gate-backoff-real-flow.spec.js
M  tests/e2e/playwright.config.js
```

(其他 staged 檔案均為此 task 之前已 staged，非本 task 所動)

## 待 Director 核可事項

1. 架構發現：確認「server-side backoff 對瀏覽器透明」的理解是否符合 director 預期
2. 若 director 希望保留 429 simulation pattern：需從 Node.js server test 角度做（jest supertest 或 nock 攔截 OpenAI），不是 Playwright 層
3. 本 e2e spec 已充分覆蓋 RITUAL §1 full chain：submit → real gate → DB persist → reload verify
