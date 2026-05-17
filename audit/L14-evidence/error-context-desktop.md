# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: critical-path-full-flow.spec.js >> Critical Path — Lifecycle + Stage 1A + 1B + 1C + 1D end-to-end >> login → Phase 1 fill + gate → Phase 2 UI → Phase 2 → score → offcanvas delete → hint modal
- Location: tests/e2e/critical-path-full-flow.spec.js:216:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('.gate-wrap')
Expected: visible
Timeout: 30000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 30000ms
  - waiting for locator('.gate-wrap')

```

# Page snapshot

```yaml
- generic [ref=e2]:
  - banner [ref=e3]:
    - button "練習記錄" [ref=e4] [cursor=pointer]:
      - generic [ref=e5]: 
    - generic [ref=e6] [cursor=pointer]:
      - generic [ref=e8]: 
      - generic [ref=e9]: PM Drill
    - generic [ref=e10]:
      - button "CIRCLES" [ref=e11] [cursor=pointer]
      - button "北極星指標" [ref=e12] [cursor=pointer]
    - generic [ref=e13]:
      - generic [ref=e14]: e2e@first-principle.test
      - button "登出" [ref=e15] [cursor=pointer]:
        - generic [ref=e16]: 
      - button "回首頁" [ref=e17] [cursor=pointer]:
        - generic [ref=e18]: 
  - generic [ref=e19]:
    - generic [ref=e20]:
      - generic [ref=e21]:
        - generic [ref=e22]: C
        - text: 澄清
      - generic [ref=e23]:
        - generic [ref=e24]: I
        - text: 用戶
      - generic [ref=e25]:
        - generic [ref=e26]: R
        - text: 需求
      - generic [ref=e27]:
        - generic [ref=e28]: C
        - text: 排序
      - generic [ref=e29]:
        - generic [ref=e30]: L
        - text: 方案
      - generic [ref=e31]:
        - generic [ref=e32]: E
        - text: 取捨
      - generic [ref=e33]:
        - generic [ref=e34]: S
        - text: 總結
    - generic [ref=e35]:
      - generic [ref=e36]: "1.5"
      - generic [ref=e37]:
        - generic [ref=e38]: Phase 1.5 · 框架審核
        - generic [ref=e39]: C · 澄清情境
    - generic [ref=e40] [cursor=pointer]:
      - generic [ref=e42]: 
      - generic [ref=e43]:
        - generic [ref=e44]: Spotify · Spotify Podcast
        - generic [ref=e45]: 設計一個新功能，提升用戶在 Spotify 上的 Podcast 體驗，並增加用戶的黏著度。
      - generic [ref=e46]: 
    - generic [ref=e48]:
      - generic [ref=e49]: 
      - generic [ref=e50]: 建立練習失敗
      - generic [ref=e51]: 無法建立練習，請檢查網路後重試
      - generic [ref=e52]: DRAFT_CREATE_FAILED
      - generic [ref=e53]:
        - button "重新嘗試" [ref=e54] [cursor=pointer]
        - button "返回修改" [ref=e55] [cursor=pointer]
```

# Test source

```ts
  203 |         hint: '提示：請從目標用戶的背景、動機與排除對象三個維度思考，確保定義清晰、聚焦。\n問題澄清時需明確指定目標用戶群體。',
  204 |       }),
  205 |     });
  206 |   });
  207 | }
  208 | 
  209 | // ── THE TEST ──────────────────────────────────────────────────────────────────
  210 | 
  211 | test.describe('Critical Path — Lifecycle + Stage 1A + 1B + 1C + 1D end-to-end', () => {
  212 |   // test.slow() signals Playwright to use 3× the configured timeout.
  213 |   // Needed for full stack flow (~6 AI-adjacent steps, real Supabase).
  214 |   test.slow();
  215 | 
  216 |   test(
  217 |     'login → Phase 1 fill + gate → Phase 2 UI → Phase 2 → score → offcanvas delete → hint modal',
  218 |     async ({ page }) => {
  219 |       // ── State: sessions created are tracked here (Pitfall 14 — no module-level var).
  220 |       // Cleanup is done via deleteSessionFromPage (apiFetch carries Bearer token),
  221 |       // matching circles-gate.spec.js pattern (auto-cleanup fixture uses standalone
  222 |       // request which lacks Bearer token header → 401 / ECONNREFUSED at teardown).
  223 |       let mainSessionId = null;
  224 |       let hintSessionId = null;
  225 | 
  226 |       // ════════════════════════════════════════════════════════════════════════
  227 |       // STEP 1 — Login via storageState + enter CIRCLES + pick question
  228 |       //           (Stage 1A: authentication + session creation)
  229 |       // ════════════════════════════════════════════════════════════════════════
  230 |       await test.step('Stage 1A — login via storageState → CIRCLES home visible', async () => {
  231 |         // storageState is injected by the e2e-desktop project config (auth.setup.js).
  232 |         // By the time page.goto runs, Supabase cookies + localStorage are already loaded.
  233 |         // No UI login clicks needed — authentication.md 29-70.
  234 |         //
  235 |         // IMPORTANT: installOpenAIMock MUST be called AFTER bootApp because bootApp calls
  236 |         // page.unrouteAll() which removes all routes including our mocks. Mocks are
  237 |         // installed here, after unrouteAll has run, so they persist through the rest of the test.
  238 |         await bootApp(page);
  239 | 
  240 |         // ── Mock external OpenAI + own AI endpoints (Pitfall 11 — only external).
  241 |         // Installed AFTER bootApp's unrouteAll to avoid being cleared.
  242 |         // Own API endpoints /gate, /hint are mocked here because they hit real OpenAI upstream;
  243 |         // carve-out per Pitfall 11: "testing specific error states / OpenAI-dependent flows".
  244 |         await installOpenAIMock(page);
  245 | 
  246 |         await waitForAuth(page);
  247 | 
  248 |         // CIRCLES home: mode selector must be visible with an active auth session.
  249 |         await expect(page.locator('[data-circles-mode="drill"]')).toBeVisible();
  250 | 
  251 |         // Verify navbar shows user email (post-login signal per auth.setup.js).
  252 |         await expect(page.locator('.navbar__email')).toBeVisible({ timeout: 10_000 });
  253 |       });
  254 | 
  255 |       // ════════════════════════════════════════════════════════════════════════
  256 |       // STEP 2 — Phase 1 fill + Phase 1.5 Gate (Stage 1A T7)
  257 |       // ════════════════════════════════════════════════════════════════════════
  258 |       await test.step('Stage 1A T7 — Phase 1 → gate → canProceed → lifecycle promoted to gated', async () => {
  259 |         // Seed session via API (api-testing.md 783-848 — faster than UI clicks).
  260 |         mainSessionId = await seedCirclesSession(page, 0);
  261 | 
  262 |         // Inject Phase 1 drill C1 state + quality draft into AppState.
  263 |         // This mirrors the bootToPhase1Drill pattern from circles-gate.spec.js.
  264 |         await page.evaluate((sid) => {
  265 |           const A = window.AppState;
  266 |           A.circlesPhase            = 1;
  267 |           A.circlesMode             = 'drill';
  268 |           A.circlesDrillStep        = 'C1';
  269 |           A.circlesGateResult       = null;
  270 |           A.circlesGateLoading      = false;
  271 |           A.gateInflight            = false;
  272 |           A.circlesLocked           = false;
  273 |           A.circlesStale            = false;
  274 |           A.view                    = 'circles';
  275 | 
  276 |           if (!A.circlesFrameworkDraft) A.circlesFrameworkDraft = {};
  277 |           A.circlesFrameworkDraft['C1'] = {
  278 |             '問題範圍': '20-35 歲都會區上班族女性，每日通勤 40-90 分鐘，廣告打斷體驗差',
  279 |             '時間範圍': '60 天，以月為週期觀察留存效應與廣告耐受度',
  280 |             '業務影響': '廣告收入不降超過 3%，次月留存提升 ≥ 5 個百分點',
  281 |             '假設確認': '用戶廣告負感主要來自時段與頻率，非廣告本身',
  282 |           };
  283 |           window.render();
  284 |         }, mainSessionId);
  285 | 
  286 |         // Phase 1 form must be visible.
  287 |         const submitBtn = page.locator('button.btn--primary[data-phase1="submit"]');
  288 |         await expect(submitBtn).toBeVisible({ timeout: 10_000 });
  289 | 
  290 |         // Fire gate via AppState (bypass Layer 1 validator per drill-mode architecture;
  291 |         // validator-null approach mirrors T11/T12 in circles-gate.spec.js).
  292 |         await page.evaluate(() => {
  293 |           const saved = window.frameworkValidator;
  294 |           window.frameworkValidator = null;
  295 |           try {
  296 |             window.submitFrameworkToGate();
  297 |           } finally {
  298 |             window.frameworkValidator = saved;
  299 |           }
  300 |         });
  301 | 
  302 |         // Gate result must appear (mocked OpenAI → fast; real BE /gate endpoint).
> 303 |         await expect(page.locator('.gate-wrap')).toBeVisible({ timeout: 30_000 });
      |                                                  ^ Error: expect(locator).toBeVisible() failed
  304 | 
  305 |         // Verify canProceed=true → proceed button visible (Stage 1A T7 acceptance criteria).
  306 |         await expect(page.locator('[data-gate-action="proceed"]')).toBeVisible({ timeout: 10_000 });
  307 | 
  308 |         // Verify lifecycle in AppState has the gate result set (promoted to 'gated').
  309 |         const gateResult = await page.evaluate(() => window.AppState && window.AppState.circlesGateResult);
  310 |         expect(gateResult).not.toBeNull();
  311 |         expect(gateResult.canProceed).toBe(true);
  312 |         expect(gateResult.overallStatus).toBe('ok');
  313 |       });
  314 | 
  315 |       // ════════════════════════════════════════════════════════════════════════
  316 |       // STEP 3 — Phase 2 UI: qchip caret-down + 上一步 inline (Stage 1C B5)
  317 |       // ════════════════════════════════════════════════════════════════════════
  318 |       await test.step('Stage 1C B5 — Phase 2: qchip caret-down + 上一步 inline in input-bar__row', async () => {
  319 |         // Transition to Phase 2 via AppState injection.
  320 |         // Per phase2-ui-fix.spec.js pattern: inject circlesPhase=2 + conversation.
  321 |         await page.evaluate((sid) => {
  322 |           const A = window.AppState;
  323 |           A.circlesPhase            = 2;
  324 |           A.circlesConversation     = [
  325 |             { role: 'coach', text: '你的目標用戶是誰？請詳細描述。', hint: null, example: null },
  326 |           ];
  327 |           A.circlesStepScores       = {};
  328 |           A.circlesPhase2ConclusionMode = false;
  329 |           A.circlesPhase2Streaming  = false;
  330 |           A.circlesPhase2StreamError = false;
  331 |           A.circlesChipExpanded     = false;
  332 |           A.view                    = 'circles';
  333 |           window.render();
  334 |         }, mainSessionId);
  335 | 
  336 |         // Phase 2 container must be visible.
  337 |         await expect(page.locator('[data-view="circles"][data-phase="2"]')).toBeVisible({ timeout: 10_000 });
  338 | 
  339 |         // B5-AC1: qchip button must exist with caret-down icon (not caret-right regression).
  340 |         // Selector: [data-phase2="qchip"] per CirclesPhase2QchipComponent page object.
  341 |         // qchip__caret carries the ph-caret-down / ph-caret-right class.
  342 |         const qchipBtn = page.locator('[data-phase2="qchip"]').first();
  343 |         await expect(qchipBtn).toBeVisible({ timeout: 5_000 });
  344 | 
  345 |         // Caret direction: default closed = ph-caret-down (B5-BUG-1 fixed: was ph-caret-right).
  346 |         const qchipCaret = qchipBtn.locator('.qchip__caret');
  347 |         await expect(qchipCaret).toBeVisible({ timeout: 3_000 });
  348 |         const caretClass = await qchipCaret.getAttribute('class') || '';
  349 |         expect(caretClass).toMatch(/\bph-caret-down\b/);
  350 | 
  351 |         // B5-AC5: 上一步 must be INSIDE .input-bar__row (not in .phase-back-row above it).
  352 |         // The .phase-back-row wrapper must NOT exist (or must be hidden).
  353 |         await expect(page.locator('.phase-back-row')).not.toBeVisible();
  354 | 
  355 |         // 上一步 button (data-phase2="back") must be inside .input-bar__row.
  356 |         // Selector per CirclesPhase2QchipComponent: inputBarRow → button[data-phase2="back"].
  357 |         const backBtnInRow = page.locator('.input-bar__row button[data-phase2="back"]').first();
  358 |         await expect(backBtnInRow).toBeVisible({ timeout: 5_000 });
  359 |       });
  360 | 
  361 |       // ════════════════════════════════════════════════════════════════════════
  362 |       // STEP 4 — Phase 2 → conclusion → AI evaluator → Phase 3 score (Lifecycle T4)
  363 |       // ════════════════════════════════════════════════════════════════════════
  364 |       await test.step('Lifecycle T4 — Phase 2 conclusion → AI evaluator → Phase 3 score visible', async () => {
  365 |         // Enter conclusion mode via AppState (mock SSE already installed).
  366 |         await page.evaluate(() => {
  367 |           const A = window.AppState;
  368 |           A.circlesPhase2ConclusionMode = true;
  369 |           A.circlesPhase2ConclusionDraft = '目標用戶是 20-35 歲都會區上班族女性，通勤時廣告干擾是核心痛點，需在廣告收入不減損的前提下改善體驗。';
  370 |           window.render();
  371 |         });
  372 | 
  373 |         // Conclusion box must be visible.
  374 |         await expect(page.locator('.conclusion-box')).toBeVisible({ timeout: 5_000 });
  375 | 
  376 |         // Inject a completed score to simulate evaluator response (AI mocked above).
  377 |         // Transition directly to Phase 3 via AppState (mirrors circles-phase3-restore-real pattern).
  378 |         await page.evaluate(() => {
  379 |           const A = window.AppState;
  380 |           A.circlesStepScores = {
  381 |             C1: { totalScore: 82, dimensions: { clarity: { score: 85 }, specificity: { score: 80 }, insight: { score: 82 }, actionability: { score: 81 } } },
  382 |             I:  { totalScore: 78, dimensions: {} },
  383 |             R:  { totalScore: 80, dimensions: {} },
  384 |             C2: { totalScore: 76, dimensions: {} },
  385 |             L:  { totalScore: 81, dimensions: {} },
  386 |             E:  { totalScore: 79, dimensions: {} },
  387 |             S:  { totalScore: 77, dimensions: {} },
  388 |           };
  389 |           A.circlesScoreResult = {
  390 |             totalScore: 79,
  391 |             grade: 'B',
  392 |             dimensions: [],
  393 |           };
  394 |           A.circlesPhase = 3;
  395 |           A.circlesPhase3LoadingStep = 0;
  396 |           A.circlesPhase3LoadingSlow = false;
  397 |           A.circlesPhase3Error = null;
  398 |           window.render();
  399 |         });
  400 | 
  401 |         // Phase 3 score must be visible — Lifecycle T4 acceptance criteria.
  402 |         // Selector: data-view="circles" data-phase="3" (renderPhase3Score app.js:6414).
  403 |         // Score body: .score-body; score number: .score-total__num (app.js:6393).
```