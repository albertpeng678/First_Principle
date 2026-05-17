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

Locator:  locator('.navbar__email')
Expected: visible
Received: hidden
Timeout:  10000ms

Call log:
  - Expect "toBeVisible" with timeout 10000ms
  - waiting for locator('.navbar__email')
    14 × locator resolved to <span class="navbar__email">e2e@first-principle.test</span>
       - unexpected value "hidden"

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
    - button "登出" [ref=e11] [cursor=pointer]:
      - generic [ref=e12]: 
  - generic [ref=e13]:
    - generic [ref=e14]:
      - generic [ref=e15]: 
      - generic [ref=e16]:
        - generic [ref=e17]: "0"
        - text: 已完成
      - generic [ref=e18]: ·
      - generic [ref=e19]:
        - generic [ref=e20]: "37"
        - text: 進行中
      - generic [ref=e21]: ·
      - generic [ref=e22]:
        - generic [ref=e23]: "0"
        - text: 本週
    - generic [ref=e25] [cursor=pointer]:
      - generic [ref=e26]: 什麼是 CIRCLES 實戰訓練？
      - generic [ref=e27]: 
    - generic [ref=e29]:
      - generic [ref=e30]:
        - generic [ref=e32]: 
        - generic [ref=e33]: 歡迎來到 PM Drill
        - paragraph [ref=e34]: CIRCLES 是 PM 面試常用的七步框架。第一次使用？建議跟著引導跑一輪，5 分鐘內了解整個流程。
        - generic [ref=e35]:
          - button "開始引導 " [ref=e36] [cursor=pointer]:
            - text: 開始引導
            - generic [ref=e37]: 
          - button "直接自己選題" [ref=e38] [cursor=pointer]
      - generic [ref=e39]:
        - button " 完整模擬 7 步循序練習" [ref=e40] [cursor=pointer]:
          - generic [ref=e41]:
            - generic [ref=e42]: 
            - generic [ref=e43]: 完整模擬
          - generic [ref=e44]: 7 步循序練習
        - button " 步驟加練 單練 C / I / R" [ref=e45] [cursor=pointer]:
          - generic [ref=e46]:
            - generic [ref=e47]: 
            - generic [ref=e48]: 步驟加練
          - generic [ref=e49]: 單練 C / I / R
      - generic [ref=e50]:
        - generic: 
        - searchbox "搜尋題目（公司 / 產品 / 主題關鍵字）— 不分大小寫" [ref=e51]
      - generic [ref=e52]:
        - button "產品設計 ×40" [ref=e53] [cursor=pointer]
        - button "產品改進 ×35" [ref=e54] [cursor=pointer]
        - button "產品策略 ×25" [ref=e55] [cursor=pointer]
      - generic [ref=e56]:
        - generic [ref=e57] [cursor=pointer]:
          - generic [ref=e58]:
            - generic [ref=e59]: "01"
            - heading "LINE · LINE Messaging" [level=3] [ref=e60]
          - generic [ref=e61]:
            - generic [ref=e62]:
              - generic [ref=e63]: 
              - generic [ref=e64]: 完整
            - generic [ref=e65]: ·
            - text: LINE
          - paragraph [ref=e66]: 為 LINE 設計一個新功能，以提高用戶的聊天互動性，特別是在群聊中。
        - generic [ref=e67] [cursor=pointer]:
          - generic [ref=e68]:
            - generic [ref=e69]: "02"
            - heading "Grab · GrabFood" [level=3] [ref=e70]
          - generic [ref=e71]:
            - generic [ref=e72]:
              - generic [ref=e73]: 
              - generic [ref=e74]: 完整
            - generic [ref=e75]: ·
            - text: Grab
          - paragraph [ref=e76]: 設計一個功能來提升 GrabFood 用戶在選擇餐廳時的決策效率。
        - generic [ref=e77] [cursor=pointer]:
          - generic [ref=e78]:
            - generic [ref=e79]: "03"
            - heading "Meta · Facebook Marketplace" [level=3] [ref=e80]
          - generic [ref=e81]:
            - generic [ref=e82]:
              - generic [ref=e83]: 
              - generic [ref=e84]: 完整
            - generic [ref=e85]: ·
            - text: Meta
          - paragraph [ref=e86]: 設計一個功能來幫助 Facebook Marketplace 用戶提高交易的安全性和信任度。
        - generic [ref=e87] [cursor=pointer]:
          - generic [ref=e88]:
            - generic [ref=e89]: "04"
            - heading "LINE · LINE Messaging" [level=3] [ref=e90]
          - generic [ref=e91]:
            - generic [ref=e92]:
              - generic [ref=e93]: 
              - generic [ref=e94]: 完整
            - generic [ref=e95]: ·
            - text: LINE
          - paragraph [ref=e96]: 設計一個功能，讓 LINE 用戶可以更輕鬆地管理群組通知設定。
        - generic [ref=e97] [cursor=pointer]:
          - generic [ref=e98]:
            - generic [ref=e99]: "05"
            - heading "Google · Google Maps" [level=3] [ref=e100]
          - generic [ref=e101]:
            - generic [ref=e102]:
              - generic [ref=e103]: 
              - generic [ref=e104]: 完整
            - generic [ref=e105]: ·
            - text: Google
          - paragraph [ref=e106]: 設計一個新功能，提升 Google Maps 在城市交通導航中的使用體驗，特別是在高峰期。
      - button " 隨機抽 5 題（不含目前的題）" [ref=e107] [cursor=pointer]:
        - generic [ref=e108]: 
        - text: 隨機抽 5 題（不含目前的題）
    - generic [ref=e109]:
      - generic [ref=e110]:
        - generic [ref=e111]: S 步驟含北極星指標練習
        - generic [ref=e112]: 想做最完整的 NSM 定義訓練？單獨進入北極星指標訓練器拆解 4 個維度的輸入指標。
      - link "前往 NSM " [ref=e113] [cursor=pointer]:
        - /url: "#"
        - text: 前往 NSM
        - generic [ref=e114]: 
```

# Test source

```ts
  152 |   // Also mock /api/circles-sessions/:id/evaluate-step — AI call for step scoring.
  153 |   await page.route('**/api/circles-sessions/*/evaluate-step', (route) => {
  154 |     route.fulfill({
  155 |       status: 200,
  156 |       contentType: 'application/json',
  157 |       body: JSON.stringify({
  158 |         stepKey: 'C1',
  159 |         totalScore: 82,
  160 |         dimensions: {
  161 |           clarity: { score: 85, feedback: '清晰' },
  162 |           specificity: { score: 80, feedback: '具體' },
  163 |           insight: { score: 82, feedback: '有洞察' },
  164 |           actionability: { score: 81, feedback: '可執行' },
  165 |         },
  166 |       }),
  167 |     });
  168 |   });
  169 | 
  170 |   // Mock /api/circles-sessions/:id/gate — Phase 1.5 AI gate (Stage 1A T7).
  171 |   // Field names match renderGateResult (app.js:4940): result.overallStatus, item.field,
  172 |   // item.title, item.status, item.suggestion. Proceed button appears for 'ok'/'warn'.
  173 |   await page.route('**/api/circles-sessions/*/gate', (route) => {
  174 |     if (route.request().method() !== 'POST') {
  175 |       return route.continue();
  176 |     }
  177 |     route.fulfill({
  178 |       status: 200,
  179 |       contentType: 'application/json',
  180 |       body: JSON.stringify({
  181 |         canProceed: true,
  182 |         overallStatus: 'ok',
  183 |         items: [
  184 |           { field: '問題範圍', title: '清晰具體，定義精準', status: 'ok',  suggestion: null },
  185 |           { field: '時間範圍', title: '60 天週期合理',        status: 'ok',  suggestion: null },
  186 |           { field: '業務影響', title: '量化目標明確',          status: 'ok',  suggestion: null },
  187 |           { field: '假設確認', title: '假設合理，可驗證',      status: 'ok',  suggestion: null },
  188 |         ],
  189 |         summary: '通過審核，可進入 Phase 2。',
  190 |       }),
  191 |     });
  192 |   });
  193 | 
  194 |   // Mock /api/circles-public/hint — Stage 1D B-Hint.
  195 |   // openHintModal() in app.js calls /api/circles-public/hint (public stateless endpoint;
  196 |   // no session ID, no userDraft passed → pure question-only prompt per Stage 1D spec).
  197 |   await page.route('**/api/circles-public/hint', (route) => {
  198 |     if (route.request().method() !== 'POST') return route.continue();
  199 |     route.fulfill({
  200 |       status: 200,
  201 |       contentType: 'application/json',
  202 |       body: JSON.stringify({
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
> 252 |         await expect(page.locator('.navbar__email')).toBeVisible({ timeout: 10_000 });
      |                                                      ^ Error: expect(locator).toBeVisible() failed
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
  303 |         await expect(page.locator('.gate-wrap')).toBeVisible({ timeout: 30_000 });
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
```