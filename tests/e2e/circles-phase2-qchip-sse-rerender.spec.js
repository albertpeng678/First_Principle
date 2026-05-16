// tests/e2e/circles-phase2-qchip-sse-rerender.spec.js
//
// T4 follow-up: verifies qchip panel survives Phase 2 re-renders
// (e.g. SSE chunk arrival → render() → bindCirclesPhase2() rebind cycle).
//
// Bug: public/app.js bindCirclesPhase2 used to unconditionally close .qchip-expand
// on every render. SSE streaming fires render() per chunk → user-opened qchip got
// stomped closed. Fix: persist open-state in AppState.circlesPhase2QchipOpen and
// honor it on rebind.
//
// Skill citations:
//   common-pitfalls.md Pitfall 11 — own API NOT mocked; only seed via real BE
//   common-pitfalls.md Pitfall 19 — test.step per scenario phase
//   authentication.md 29-70       — reuse storageState from auth.setup.js
//   api-testing.md 783-848        — API seed via apiFetch (no UI ceremony)

'use strict';

const { test, expect } = require('@playwright/test');

async function bootApp(page) {
  await page.addInitScript(() => {
    try { localStorage.removeItem('pmDrillState'); } catch (_) {}
  });
  const emptyJson = JSON.stringify([]);
  const stubGet = (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: emptyJson });
    }
    return route.continue();
  };
  await page.route('**/api/circles-sessions', stubGet);
  await page.route('**/api/nsm-sessions', stubGet);
  await page.route('**/api/guest-circles-sessions', stubGet);
  await page.route('**/api/guest/nsm-sessions', stubGet);
  await page.goto('/');
  await page.locator('[data-circles-mode="drill"]').waitFor({ state: 'visible', timeout: 15_000 });
  await page.unrouteAll({ behavior: 'ignoreErrors' });
}

async function waitForAuth(page) {
  await page.waitForFunction(
    () => window.AppState && !!window.AppState.accessToken,
    { timeout: 15_000 }
  );
}

async function seedCirclesSession(page, qi = 0) {
  await page.waitForFunction(
    () => window.CIRCLES_QUESTIONS && window.CIRCLES_QUESTIONS.length > 0,
    { timeout: 10_000 }
  );
  const id = await page.evaluate(async (qIndex) => {
    const A = window.AppState;
    const q = window.CIRCLES_QUESTIONS[qIndex];
    const res = await window.apiFetch('/api/circles-sessions/draft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question_id: q.id, mode: 'drill', drill_step: 'C1' }),
    });
    if (!res.ok) throw new Error('seed failed ' + res.status);
    const s = await res.json();
    A.circlesSession = s;
    A.circlesSelectedQuestion = q;
    return s.id;
  }, qi);
  return String(id);
}

async function deleteSession(page, sid) {
  if (!sid) return;
  await page.evaluate(async (s) => {
    try { await window.apiFetch('/api/circles-sessions/' + s, { method: 'DELETE' }); } catch (_) {}
  }, sid);
}

test.describe('T4 SSE re-render — qchip persists across render() invocations', () => {
  test('qchip stays open after render() triggered by SSE-like state update', async ({ page }) => {
    let sid = null;
    try {
      await bootApp(page);
      await waitForAuth(page);
      await expect(page.locator('[data-circles-mode="drill"]')).toBeVisible();

      sid = await seedCirclesSession(page, 0);

      // ── Enter Phase 2 with a coach turn already in conversation ───────────
      await test.step('inject Phase 2 with conversation', async () => {
        await page.evaluate(() => {
          const A = window.AppState;
          A.circlesPhase            = 2;
          A.circlesMode             = 'drill';
          A.circlesDrillStep        = 'C1';
          A.circlesConversation     = [
            { role: 'coach', text: '你的目標用戶是誰？請描述。', hint: null, example: null },
          ];
          A.circlesStepScores       = {};
          A.circlesPhase2ConclusionMode = false;
          A.circlesPhase2Streaming  = false;
          A.circlesPhase2StreamError = false;
          A.circlesChipExpanded     = false;
          A.circlesPhase2QchipOpen  = false;  // baseline: closed
          A.view                    = 'circles';
          window.render();
        });
        await expect(page.locator('[data-view="circles"][data-phase="2"]')).toBeVisible({ timeout: 10_000 });
      });

      // ── User opens qchip ──
      await test.step('user clicks qchip → panel visible', async () => {
        const qchipBtn = page.locator('[data-phase2="qchip"]').first();
        await expect(qchipBtn).toBeVisible({ timeout: 5_000 });
        await qchipBtn.click();

        const panel = page.locator('.qchip-expand').first();
        await expect(panel).toBeVisible({ timeout: 3_000 });

        // AppState must reflect open
        const flag = await page.evaluate(() => window.AppState.circlesPhase2QchipOpen);
        expect(flag).toBe(true);
      });

      // ── Simulate SSE chunk arrival: mutate conversation + render() ──
      // Production code path: appendStreamChunkToLastCoach() → render() → bindCirclesPhase2().
      // We exercise the exact re-bind path the bug was on (line 6716 unconditional close).
      await test.step('SSE chunk re-renders Phase 2 — qchip MUST remain open', async () => {
        for (let i = 0; i < 5; i += 1) {
          await page.evaluate((chunk) => {
            const A = window.AppState;
            const last = A.circlesConversation[A.circlesConversation.length - 1];
            last.text = (last.text || '') + chunk;
            A.circlesPhase2Streaming = true;
            window.render();
          }, ' streaming chunk ' + i);
        }

        // The bug: panel.style.display='none' was applied on every render → invisible.
        const panel = page.locator('.qchip-expand').first();
        await expect(panel).toBeVisible({ timeout: 3_000 });

        const inlineDisplay = await panel.evaluate((el) => el.style.display);
        expect(inlineDisplay).not.toBe('none');

        const flagAfter = await page.evaluate(() => window.AppState.circlesPhase2QchipOpen);
        expect(flagAfter).toBe(true);

        // qchipBtn also retains is-open class
        const qchipBtn = page.locator('[data-phase2="qchip"]').first();
        const klass = await qchipBtn.getAttribute('class') || '';
        expect(klass).toMatch(/\bis-open\b/);
      });

      // ── Close path still works: clicking again hides panel and flips flag ──
      await test.step('close via qchip click — panel hidden + flag false', async () => {
        const qchipBtn = page.locator('[data-phase2="qchip"]').first();
        await qchipBtn.click();
        const panel = page.locator('.qchip-expand').first();
        await expect(panel).toBeHidden({ timeout: 3_000 });
        const flag = await page.evaluate(() => window.AppState.circlesPhase2QchipOpen);
        expect(flag).toBe(false);
      });

      // ── After close, SSE re-render keeps it closed (not toggled back open) ──
      await test.step('closed state also survives re-render', async () => {
        await page.evaluate(() => { window.render(); });
        const panel = page.locator('.qchip-expand').first();
        await expect(panel).toBeHidden({ timeout: 3_000 });
      });
    } finally {
      await deleteSession(page, sid);
    }
  });
});
