'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadCtx() {
  const appSrc = fs.readFileSync(path.join(__dirname, '../public/app.js'), 'utf8');
  const ctx = {
    window: {}, navigator: { userAgent: 'jest' },
    console: { log: () => {}, warn: () => {}, error: () => {} },
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  };
  ctx.document = {
    documentElement: { dataset: {} },
    _handlers: {},
    getElementById(id) {
      const self = this;
      return {
        addEventListener(ev, fn) { self._handlers[id + ':' + ev] = fn; }
      };
    },
  };
  ctx.window.AppState = {};
  vm.createContext(ctx);
  try { vm.runInContext(appSrc, ctx); } catch (_) {}
  return ctx;
}

describe('bindStaleActionBar', () => {
  let ctx;
  beforeEach(() => {
    ctx = loadCtx();
    ctx.window.AppState.circlesStale = true;
    ctx.window.AppState.circlesPhase = 2;
    ctx.window.AppState.circlesSelectedQuestion = { id: 'q1' };
    ctx.window.AppState.circlesSession = { id: 's1' };
    // Inject mock navigate into ctx
    ctx.navigateCalls = [];
    vm.runInContext('var navigate = function(v) { window.__navigate = v; };', ctx);
  });

  test('stale-prev from phase 2 sets phase = 1', () => {
    ctx.bindStaleActionBar();
    ctx.document._handlers['circles-stale-prev:click']();
    expect(ctx.window.AppState.circlesPhase).toBe(1);
  });

  test('stale-prev from phase 3 sets phase = 2', () => {
    ctx.window.AppState.circlesPhase = 3;
    ctx.bindStaleActionBar();
    ctx.document._handlers['circles-stale-prev:click']();
    expect(ctx.window.AppState.circlesPhase).toBe(2);
  });

  test('stale-home clears state and triggers navigate to circles', () => {
    ctx.bindStaleActionBar();
    ctx.document._handlers['circles-stale-home:click']();
    expect(ctx.window.AppState.circlesStale).toBe(false);
    expect(ctx.window.AppState.circlesSelectedQuestion).toBeNull();
    expect(ctx.window.AppState.circlesSession).toBeNull();
    expect(ctx.window.__navigate).toBe('circles');
  });
});
