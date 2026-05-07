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
});
