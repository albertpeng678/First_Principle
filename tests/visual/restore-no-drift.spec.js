// tests/visual/restore-no-drift.spec.js
// RED — Bug B repro: partial-fill draftForStep → positional fallback drifts to wrong textarea.
// All assertions use Chinese keys (cfg.fields[i].key canonical form).
const { test, expect } = require('@playwright/test');

const ROUTES = {
  stats: '**/api/(guest-)?circles-stats**',
  list: '**/api/(guest-)?circles-sessions',
  nsm: '**/api/(guest-)?(nsm|nsm-sessions)**',
};

function stubAll(page, listSession, detailSession) {
  page.route('**/api/circles-stats**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  page.route('**/api/guest-circles-stats**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"completed":0,"active":1,"weeklyCompleted":0}' }));
  page.route('**/api/guest-circles-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([listSession]) }));
  page.route('**/api/circles-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([listSession]) }));
  page.route('**/api/guest-circles-sessions/' + listSession.id, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(detailSession) }));
  page.route('**/api/circles-sessions/' + listSession.id, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(detailSession) }));
  page.route('**/api/guest/nsm-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  page.route('**/api/nsm-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
}

async function openSessionViaOffcanvas(page) {
  await page.goto('/');
  await page.waitForSelector('.qcard');
  await page.locator('button[data-nav="offcanvas"]').first().click();
  await page.waitForSelector('.offcanvas-item');
  await page.locator('.offcanvas-item').first().click();
  await page.waitForSelector('.rt-textarea', { timeout: 5000 });
}

test.describe('Phase 1 restore — partial-fill no-drift (Bug B)', () => {
  test('C1: only idx 1 (時間範圍) filled with 「測試」 → idx 1 shows it, idx 0/2/3 empty', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const session = {
      id: 'sess-c1-partial-1', question_id: 'q-c1-1',
      question_json: { id: 'q-c1-1', company: 'Spotify', product: 'Spotify Podcast' },
      mode: 'drill', drill_step: 'C1', current_phase: 1, sim_step_index: 0, status: 'active',
      step_drafts: { ts: Date.now() },
      framework_draft: { C1: { '時間範圍': '測試' } }, // ONLY idx 1 — drift bait
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    };
    stubAll(page, session, session);
    await openSessionViaOffcanvas(page);
    const textareas = page.locator('.rt-textarea');
    expect(await textareas.count()).toBe(4);
    expect((await textareas.nth(0).textContent()).trim()).toBe('');
    expect((await textareas.nth(1).textContent()).trim()).toBe('測試');
    expect((await textareas.nth(2).textContent()).trim()).toBe('');
    expect((await textareas.nth(3).textContent()).trim()).toBe('');
  });

  test('C1: idx 0 + idx 2 filled (skip idx 1, idx 3) → idx 1 stays empty (positional fallback bait)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const session = {
      id: 'sess-c1-partial-2', question_id: 'q-c1-2',
      question_json: { id: 'q-c1-2', company: 'Notion', product: '工作協作' },
      mode: 'drill', drill_step: 'C1', current_phase: 1, sim_step_index: 0, status: 'active',
      step_drafts: { ts: Date.now() },
      framework_draft: { C1: { '問題範圍': 'A', '業務影響': 'C' } }, // idx 0 + 2; positional fallback would put 'C' in idx 1
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    };
    stubAll(page, session, session);
    await openSessionViaOffcanvas(page);
    const textareas = page.locator('.rt-textarea');
    expect((await textareas.nth(0).textContent()).trim()).toBe('A');
    expect((await textareas.nth(1).textContent()).trim()).toBe(''); // BUG would show 'C'
    expect((await textareas.nth(2).textContent()).trim()).toBe('C');
    expect((await textareas.nth(3).textContent()).trim()).toBe('');
  });

  test('C1: insertion-order != field-order (timeWindow inserted first) → fields land in correct slots', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    // Object.values would return ['T', 'B'] if insertion order is [時間範圍, 問題範圍].
    // Without canonical key lookup, idx 0 would get 'T' (wrong).
    const draftOutOfOrder = {};
    draftOutOfOrder['時間範圍'] = 'T';
    draftOutOfOrder['問題範圍'] = 'B';
    const session = {
      id: 'sess-c1-order', question_id: 'q-c1-3',
      question_json: { id: 'q-c1-3', company: 'Airbnb', product: 'Marketplace' },
      mode: 'drill', drill_step: 'C1', current_phase: 1, sim_step_index: 0, status: 'active',
      step_drafts: { ts: Date.now() },
      framework_draft: { C1: draftOutOfOrder },
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    };
    stubAll(page, session, session);
    await openSessionViaOffcanvas(page);
    const textareas = page.locator('.rt-textarea');
    expect((await textareas.nth(0).textContent()).trim()).toBe('B'); // 問題範圍
    expect((await textareas.nth(1).textContent()).trim()).toBe('T'); // 時間範圍
  });

  test('I step: partial-fill (idx 0 + idx 3 only) → idx 1 idx 2 stay empty', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const session = {
      id: 'sess-i-partial', question_id: 'q-i',
      question_json: { id: 'q-i', company: 'X', product: 'Y' },
      mode: 'drill', drill_step: 'I', current_phase: 1, sim_step_index: 1, status: 'active',
      step_drafts: { ts: Date.now() },
      framework_draft: { I: { '目標用戶分群': 'GroupA', '排除對象': 'ExcludeZ' } },
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    };
    stubAll(page, session, session);
    await openSessionViaOffcanvas(page);
    const ta = page.locator('.rt-textarea');
    expect((await ta.nth(0).textContent()).trim()).toBe('GroupA');
    expect((await ta.nth(1).textContent()).trim()).toBe('');
    expect((await ta.nth(2).textContent()).trim()).toBe('');
    expect((await ta.nth(3).textContent()).trim()).toBe('ExcludeZ');
  });

  test('R step: partial-fill (only 核心痛點 idx 3) → idx 3 only', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const session = {
      id: 'sess-r-partial', question_id: 'q-r',
      question_json: { id: 'q-r', company: 'X', product: 'Y' },
      mode: 'drill', drill_step: 'R', current_phase: 1, sim_step_index: 2, status: 'active',
      step_drafts: { ts: Date.now() },
      framework_draft: { R: { '核心痛點': 'CorePain99' } },
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    };
    stubAll(page, session, session);
    await openSessionViaOffcanvas(page);
    const ta = page.locator('.rt-textarea');
    expect((await ta.nth(0).textContent()).trim()).toBe('');
    expect((await ta.nth(1).textContent()).trim()).toBe('');
    expect((await ta.nth(2).textContent()).trim()).toBe('');
    expect((await ta.nth(3).textContent()).trim()).toBe('CorePain99');
  });

  test('C2 step: partial-fill (idx 1 + idx 2) → idx 0 idx 3 empty, no drift', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const session = {
      id: 'sess-c2-partial', question_id: 'q-c2',
      question_json: { id: 'q-c2', company: 'X', product: 'Y' },
      mode: 'drill', drill_step: 'C2', current_phase: 1, sim_step_index: 3, status: 'active',
      step_drafts: { ts: Date.now() },
      framework_draft: { C2: { '最優先': 'P1', '暫緩': 'P2' } },
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    };
    stubAll(page, session, session);
    await openSessionViaOffcanvas(page);
    const ta = page.locator('.rt-textarea');
    expect((await ta.nth(0).textContent()).trim()).toBe('');
    expect((await ta.nth(1).textContent()).trim()).toBe('P1');
    expect((await ta.nth(2).textContent()).trim()).toBe('P2');
    expect((await ta.nth(3).textContent()).trim()).toBe('');
  });

  test('Legacy English-key alias: framework_draft uses {boundaryScope, timeWindow} → restored to Chinese-keyed slots', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const session = {
      id: 'sess-legacy', question_id: 'q-legacy',
      question_json: { id: 'q-legacy', company: 'Old', product: 'Schema' },
      mode: 'drill', drill_step: 'C1', current_phase: 1, sim_step_index: 0, status: 'active',
      step_drafts: { ts: Date.now() - 7 * 24 * 60 * 60 * 1000 }, // pre-migration timestamp
      framework_draft: { C1: { boundaryScope: 'Legacy-bound', timeWindow: 'Legacy-time' } },
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    };
    stubAll(page, session, session);
    // Pre-clear localStorage to avoid override from prior tests
    await page.addInitScript(() => { try { localStorage.clear(); } catch (_) {} });
    await openSessionViaOffcanvas(page);
    const ta = page.locator('.rt-textarea');
    expect((await ta.nth(0).textContent()).trim()).toBe('Legacy-bound');
    expect((await ta.nth(1).textContent()).trim()).toBe('Legacy-time');
    expect((await ta.nth(2).textContent()).trim()).toBe('');
    expect((await ta.nth(3).textContent()).trim()).toBe('');
  });

  test('L step: only solutions[1] filled → sol-card 0 empty, sol-card 1 shows it', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const session = {
      id: 'sess-l-partial', question_id: 'q-l',
      question_json: { id: 'q-l', company: 'X', product: 'Y' },
      mode: 'drill', drill_step: 'L', current_phase: 1, sim_step_index: 4, status: 'active',
      step_drafts: {
        P1L: [
          { name: '', mechanism: '' },
          { name: 'SolB-name', mechanism: 'SolB-mechanism' },
        ],
        ts: Date.now(),
      },
      framework_draft: {},
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    };
    stubAll(page, session, session);
    await openSessionViaOffcanvas(page);
    await page.waitForSelector('.sol-card', { timeout: 5000 });
    const m0 = await page.locator('.rt-textarea[data-sol-idx="0"]').textContent();
    const m1 = await page.locator('.rt-textarea[data-sol-idx="1"]').textContent();
    const n0 = await page.locator('input.sol-card__name-input[data-sol-idx="0"]').inputValue();
    const n1 = await page.locator('input.sol-card__name-input[data-sol-idx="1"]').inputValue();
    expect(m0.trim()).toBe('');
    expect(m1.trim()).toBe('SolB-mechanism');
    expect(n0).toBe('');
    expect(n1).toBe('SolB-name');
  });

  test('E step: only sol[1].metrics filled → other 7 nested fields empty', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const session = {
      id: 'sess-e-partial', question_id: 'q-e',
      question_json: { id: 'q-e', company: 'X', product: 'Y' },
      mode: 'drill', drill_step: 'E', current_phase: 1, sim_step_index: 5, status: 'active',
      step_drafts: {
        P1L: [
          { name: 'SolA', mechanism: 'A-mech' },
          { name: 'SolB', mechanism: 'B-mech' },
        ],
        P1E: [
          { advantages: '', disadvantages: '', risks: '', metrics: '' },
          { advantages: '', disadvantages: '', risks: '', metrics: 'Metric-99' },
        ],
        ts: Date.now(),
      },
      framework_draft: {},
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    };
    stubAll(page, session, session);
    await openSessionViaOffcanvas(page);
    await page.waitForSelector('.rt-textarea[data-circles-e-sol-idx]', { timeout: 5000 });
    const sol0Adv = await page.locator('.rt-textarea[data-circles-e-sol-idx="0"][data-circles-e-field-key="advantages"]').textContent();
    const sol1Metrics = await page.locator('.rt-textarea[data-circles-e-sol-idx="1"][data-circles-e-field-key="metrics"]').textContent();
    expect(sol0Adv.trim()).toBe('');
    expect(sol1Metrics.trim()).toBe('Metric-99');
  });

  test('S main: only reasoning filled → recommendation + nsm empty', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const session = {
      id: 'sess-s-main', question_id: 'q-s',
      question_json: { id: 'q-s', company: 'X', product: 'Y' },
      mode: 'drill', drill_step: 'S', current_phase: 1, sim_step_index: 6, status: 'active',
      step_drafts: {
        P1S: { recommendation: '', reasoning: 'Reason-OK', nsm: '', tracking: { reach: '', depth: '', frequency: '', impact: '' } },
        ts: Date.now(),
      },
      framework_draft: {},
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    };
    stubAll(page, session, session);
    await openSessionViaOffcanvas(page);
    await page.waitForSelector('.rt-textarea[data-s-textarea]', { timeout: 5000 });
    const rec = await page.locator('.rt-textarea[data-s-textarea="推薦方案"]').textContent();
    const reason = await page.locator('.rt-textarea[data-s-textarea="選擇理由"]').textContent();
    const nsm = await page.locator('.rt-textarea[data-s-textarea="北極星指標"]').textContent();
    expect(rec.trim()).toBe('');
    expect(reason.trim()).toBe('Reason-OK');
    expect(nsm.trim()).toBe('');
  });

  test('S tracking: only frequency filled → other 3 dims empty', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const session = {
      id: 'sess-s-track', question_id: 'q-st',
      question_json: { id: 'q-st', company: 'X', product: 'Y' },
      mode: 'drill', drill_step: 'S', current_phase: 1, sim_step_index: 6, status: 'active',
      step_drafts: {
        P1S: { recommendation: 'R', reasoning: 'Why', nsm: 'NSM', tracking: { reach: '', depth: '', frequency: 'freq-99', impact: '' } },
        ts: Date.now(),
      },
      framework_draft: {},
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    };
    stubAll(page, session, session);
    await openSessionViaOffcanvas(page);
    await page.waitForSelector('input[data-s-tracking]', { timeout: 5000 });
    expect(await page.locator('input[data-s-tracking="reach"]').inputValue()).toBe('');
    expect(await page.locator('input[data-s-tracking="depth"]').inputValue()).toBe('');
    expect(await page.locator('input[data-s-tracking="frequency"]').inputValue()).toBe('freq-99');
    expect(await page.locator('input[data-s-tracking="impact"]').inputValue()).toBe('');
  });
});
