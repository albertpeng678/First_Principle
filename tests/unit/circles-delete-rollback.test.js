// tests/unit/circles-delete-rollback.test.js
// Stage 1B B4 — offcanvas DELETE snapshot + rollback unit specs.
// Spec ref: 2026-05-16-stage-1b §6 B4-U1..U4.

describe('Stage 1B B4 — offcanvas delete handler rollback semantics', () => {
  let handler;        // function (id) => Promise — exposed test hook
  let AppState;
  let mockApiFetch;

  beforeEach(() => {
    // Implementer harness: load app.js IIFE, expose deleteOffcanvasItem(id) on
    // window for test (production behavior unchanged — hook is debug-only).
    ({ handler, AppState } = loadDeleteHandlerForTest());
    mockApiFetch = jest.fn();
    window.apiFetch = mockApiFetch;
    AppState.historyList = [
      { id: 'a', mode: 'drill', drill_step: 'C1' },
      { id: 'b', mode: 'drill', drill_step: 'C1' },
      { id: 'c', mode: 'drill', drill_step: 'C1' },
    ];
    AppState.accessToken = 'tok';
  });

  test('B4-U1: apiFetch resolves 200 → list stays filtered, no rollback', async () => {
    mockApiFetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true }) });
    await handler('b');
    expect(AppState.historyList.map(i => i.id)).toEqual(['a', 'c']);
    expect(AppState._resumeToastShow).not.toBe(true);
  });

  test('B4-U2: apiFetch resolves 500 → list rolled back to original', async () => {
    mockApiFetch.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
    await handler('b');
    expect(AppState.historyList.map(i => i.id)).toEqual(['a', 'b', 'c']);
    expect(AppState._resumeToastMsg).toBe('刪除失敗，請再試一次');
    expect(AppState._resumeToastShow).toBe(true);
  });

  test('B4-U3: apiFetch rejects (network) → list rolled back + toast', async () => {
    mockApiFetch.mockRejectedValue(new Error('network'));
    await handler('b');
    expect(AppState.historyList.map(i => i.id)).toEqual(['a', 'b', 'c']);
    expect(AppState._resumeToastMsg).toBe('刪除失敗，請再試一次');
    expect(AppState._resumeToastShow).toBe(true);
  });

  test('B4-U4: apiFetch resolves 404 → treated as success, no rollback, no toast', async () => {
    mockApiFetch.mockResolvedValue({ ok: false, status: 404, json: async () => ({}) });
    await handler('b');
    expect(AppState.historyList.map(i => i.id)).toEqual(['a', 'c']);
    expect(AppState._resumeToastShow).not.toBe(true);
  });
});

function loadDeleteHandlerForTest() {
  throw new Error('IMPLEMENTER: expose deleteOffcanvasItem on window via test-only hook, or use the same harness pattern as B3 unit specs');
}
