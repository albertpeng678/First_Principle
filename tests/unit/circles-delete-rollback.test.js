// tests/unit/circles-delete-rollback.test.js
// Stage 1B B4 — offcanvas DELETE snapshot + rollback unit specs.
// Spec ref: 2026-05-16-stage-1b §6 B4-U1..U4.

'use strict';

const path = require('path');
const fs = require('fs');
const vm = require('vm');

describe('Stage 1B B4 — offcanvas delete handler rollback semantics', () => {
  let handler;        // function (id) => Promise — exposed test hook
  let AppState;
  let mockApiFetch;

  beforeEach(() => {
    // Implementer harness: load app.js IIFE, expose deleteOffcanvasItem(id) on
    // window for test (production behavior unchanged — hook is debug-only).
    ({ handler, AppState } = loadDeleteHandlerForTest());
    mockApiFetch = jest.fn();
    // Wire the mock into AppState's window reference used by the handler
    AppState.__apiFetch = mockApiFetch;
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
  const appSrc = fs.readFileSync(
    path.join(__dirname, '../../public/app.js'),
    'utf8'
  );

  // Extract _doOffcanvasDelete from app.js source text.
  const fnMarker = 'function _doOffcanvasDelete(id)';
  const fnStart = appSrc.indexOf(fnMarker);
  if (fnStart === -1) throw new Error('_doOffcanvasDelete not found in app.js');

  // Find the closing brace: look for the pattern "  }" at the two-space indent level
  // that closes this function (same depth as the function declaration)
  let braceDepth = 0;
  let inFn = false;
  let fnEnd = -1;
  for (let i = fnStart; i < appSrc.length; i++) {
    if (appSrc[i] === '{') { braceDepth++; inFn = true; }
    else if (appSrc[i] === '}') {
      braceDepth--;
      if (inFn && braceDepth === 0) { fnEnd = i + 1; break; }
    }
  }
  if (fnEnd === -1) throw new Error('Could not find closing brace of _doOffcanvasDelete');

  const fnSrc = appSrc.slice(fnStart, fnEnd);

  // Build a minimal AppState with required fields.
  const AppState = {
    historyList: [],
    accessToken: null,
    _resumeToastMsg: null,
    _resumeToastShow: false,
    __apiFetch: null,  // test sets this before each call
  };

  // The wrapper runs _doOffcanvasDelete in a vm context where:
  //   - AppState is shared by reference
  //   - window.apiFetch delegates to AppState.__apiFetch (set per-test by jest.fn())
  //   - render() is a no-op stub
  //   - setTimeout is a no-op (we only care about state, not the auto-clear timer)
  const wrapperSrc = `
    ${fnSrc}
    __exposedHandler = _doOffcanvasDelete;
  `;

  const ctx = {
    AppState,
    window: {
      apiFetch: function () {
        return AppState.__apiFetch.apply(this, arguments);
      },
    },
    render: function () {},
    setTimeout: function () {},
    console: { log: function(){}, warn: function(){}, error: function(){} },
    __exposedHandler: null,
  };
  vm.createContext(ctx);
  vm.runInContext(wrapperSrc, ctx);

  return { handler: ctx.__exposedHandler, AppState };
}
