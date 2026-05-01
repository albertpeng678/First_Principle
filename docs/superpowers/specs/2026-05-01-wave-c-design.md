# Wave C 修復設計 — Audit Cycle 2026-04-30 收尾

**Status:** 待使用者覆核
**Date:** 2026-05-01
**Cycle:** `audit/cycles/2026-04-30/issues-master.md`
**Director:** main thread
**Base:** `c263605` (Wave A + B 已 ship)

## 範圍

P2 polish + tech debt + coverage gap + 使用者新報的 login 跳首頁 bug，分 4 cluster。

| Cluster | Issues | 視覺策略 |
|---|---|---|
| C-1 Tech debt | M-022 字型 / M-023 hex token | 純 CSS、無視覺差異 |
| C-2 Polish | M-024 (8 子項) | mockup 已過 4 個視覺、4 個 spec-only |
| C-3 Coverage tests | A3 / A5 / A6 / C7 | test-only，需 supabase auth fixture |
| C-4 **新增 MASTER-025** | login 成功後不跳首頁 | 行為 bug，無 mockup 必要 |

## 測試門檻（共通標準延續）

完工前必跑：jest + audit-master.spec.js × 8 viewport + rwd-visual-gate × 8 viewport 全綠。新 spec 也跑滿 8 viewport。

---

## C-1 · Tech debt（M-022 + M-023）

### M-022 字型 token 統一
```css
:root {
  --c-font-sans: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}
body, button, input, textarea, select { font-family: var(--c-font-sans); }
```
全站 grep `font-family:` 把 9 處不一致的字串改 `var(--c-font-sans)`。`Instrument Serif`（grade letter）保留。

### M-023 inline hex 改 token
- grep `style=".*color:\s*#` 跟 `style=".*background:.*#` 找 inline 硬編色。
- 對應到既有 `--c-text-1/2/3 / --c-primary / --c-bg-*` token。
- 10 處清完。

---

## C-2 · Polish (M-024 子項)

### 視覺 mockup 已過

**A. Desktop home 顯示 step pill**
- 現況：mobile/iPad 有 `<div class="circles-info-step">data-step="I"` pill；desktop 條件下被隱藏。
- 修：移除 desktop gate（`@media (min-width: 1280px)` 內 `display: none` 規則），desktop 也顯示。

**B. iPhone-SE step E 上一步重點預設折疊**
- 現況：step E 「上一步重點 L 提出方案」inline 展開，吃光上半屏。
- 修：改 collapsible details/summary，預設關，標題「▸ 上一步重點 L 提出方案（點擊展開）」。

**C. NSM step 4 desktop 寬度放寬**
- 現況：Desktop-2560 wrapper 36% viewport 留白。
- 修：套既有 `.circles-home-desktop` cap 模式 `max-width: min(2800px, 94vw)` 或 `min(1880px, 94vw) at 1440+`。

**D. Login 忘記密碼次要化**
- 現況：`<a href>` 主色底線像主行動。
- 修：font-size: 12px、color: var(--c-text-3)、text-decoration: none、hover 才轉 primary 色。

### Spec-only

- **Progress label：**`L · 提出方案 · 5/7` → `L · 提出方案 · 第 5 步 / 共 7 步`（grep `progressLabel` 改 string）。
- **Hint card 收起／展開：**確認 step I 也用 D9 統一 copy `查看教練提示／收起提示`。
- **Conclusion-back-btn：**已被 M-008 token 蓋；spec 加 `min-height ≥ 44px` 斷言確認。
- **Meta-strip orphan wrap on Mobile-360：**`.circles-step-meta-row` flex-wrap: nowrap + min-width: 0 + ellipsis。

---

## C-3 · Coverage tests（A3 / A5 / A6 / C7）

寫新 spec 不動 production code，僅補 test fixture 與 spec 覆蓋。

### A3 wrong-credential UX
- spec：`tests/playwright/journeys/audit/cov-a3-login-errors.spec.js`
  - case 1：錯誤密碼 → 顯示錯誤訊息、不切 view
  - case 2：不存在 email → 顯示錯誤訊息
  - case 3：empty submit → form-level validation

### A5 migration with 23505 conflict
- spec：`tests/playwright/journeys/audit/cov-a5-migration.spec.js`
  - case 1：guest 寫 CIRCLES draft → SIGNED_IN → migration 把 guest 行轉移 user_id
  - case 2：(23505 path) auth 用戶已有同 question_id 行 → 不複製、刪 guest 行、result.conflicts +1
  - case 3：legacy `practice_sessions` bucket 也搬
- 需 supabase fixture：用 `createUser({ email_confirm: true })` 建測試帳號，每 test 跑完 cleanup。
- **director judgment**：A5 走 e2e 太貴。改用 unit test 直接打 `migrateGuestSessions()` mock fetch；E2E 只做 smoke。

### A6 401 mid-call interceptor
- spec：`tests/playwright/journeys/audit/cov-a6-401-interceptor.spec.js`
  - case 1：用 `page.route` mock PATCH /progress 回 401，斷言 `.save-indicator` 顯示「未連線」(M-011 fallback)、localStorage 有 draft、無 silent loss。

### C7 boot resume confirm
- spec：`tests/playwright/journeys/audit/cov-c7-boot-resume.spec.js`
  - case 1：`localStorage.lastSessionId` 設成有效 id → boot → `confirm()` 顯示 → OK 走 resume
  - case 2：同上 → Cancel 不 resume，回首頁
  - 用 `page.on('dialog')` 捕捉 confirm。

---

## C-4 · MASTER-025 [P1] 登入成功後不跳首頁

### Bug
`public/app.js:802-814` `onAuthStateChange(SIGNED_IN)` handler 只呼叫 `render()`，沒改 `AppState.view`。使用者從 `/?view=login` 提交成功後，view 仍是 `'login'`，re-render 還是 login 螢幕。

### 修法
```js
supabase.auth.onAuthStateChange((event, session) => {
  if (session) {
    AppState.mode = 'auth';
    AppState.accessToken = session.access_token;
    AppState.user = session.user;
    if (event === 'SIGNED_IN') {
      migrateGuestSessions();
      // 跳回首頁（避免停留在 login/register 頁）
      if (AppState.view === 'login' || AppState.view === 'register') {
        AppState.view = 'circles';
      }
    }
  } else {
    AppState.mode = 'guest';
    AppState.accessToken = null;
    AppState.user = null;
  }
  render();
});
```

只在從 login/register 進來時才強制切 view，避免影響其他場景（例：使用者在練習中 SIGNED_IN refresh）。

### TDD spec
- spec：`tests/playwright/journeys/audit/master-025-login-redirect.spec.js`
  - case 1：goto `/?view=login`，模擬 SIGNED_IN（呼叫 `supabase.auth.onAuthStateChange` callback 或實際登入），等 1s，斷言 `AppState.view === 'circles'` AND `[data-view="circles"]` 元素 visible。
  - case 2：goto `/?view=circles`，SIGNED_IN，斷言 view 維持 'circles'（不要意外切回）。

---

## 實作分配

| Agent | Cluster | 主要檔案 |
|---|---|---|
| fix-C1 | M-022 + M-023 字型 / hex token | `public/style.css` |
| fix-C2 | M-024 polish (4 視覺 + 4 spec-only) | `public/app.js` + `public/style.css` |
| fix-C3 | A3/A5/A6/C7 + M-025 login redirect | `tests/playwright/journeys/audit/*.spec.js`（4 新 cov spec + 1 master-025 spec）+ `public/app.js`（M-025 一處 4 行修） |

**派 3 個 implementer 並行**（worktree 隔離）。director 收 commit 後親跑全 SIT/UAT/UI-UX × 8 viewport 才放行。

## TDD spec 落點

- `tests/playwright/journeys/audit/master-024-polish.spec.js` — meta wrap / step pill desktop / NSM widening / login forgot styling / progress label。
- `tests/playwright/journeys/audit/master-025-login-redirect.spec.js` — 登入成功後 view 切 circles。
- `tests/playwright/journeys/audit/cov-a3-login-errors.spec.js` / `cov-a5-migration.spec.js` / `cov-a6-401-interceptor.spec.js` / `cov-c7-boot-resume.spec.js`。

## 全套 verification（director 親跑）

```bash
npm test 2>&1 | tail -5
PMDRILL_BASE_URL=http://localhost:4000 npx playwright test \
  --config=tests/playwright/playwright.config.js \
  journeys/audit/ \
  --workers=4 --reporter=line 2>&1 | tail -10
```

期望：jest 104+ pass / audit master 整合套 800+ pass / 0 stable failed（flake 容許）。

## Wave C 完工門檻

- [ ] 三層測試（SIT / UAT / UI-UX）全綠
- [ ] 8 viewport project 都跑過
- [ ] M-024 4 個視覺修補在 Mobile-360 / Desktop-2560 都正常
- [ ] M-025 登入後跳首頁
- [ ] 4 個 coverage gap 都有 spec 覆蓋
- [ ] M-022 / M-023 全站 grep 殘餘 = 0
