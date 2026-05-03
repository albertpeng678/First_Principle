'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadAppHelpers() {
  const appSrc = fs.readFileSync(path.join(__dirname, '../public/app.js'), 'utf8');
  const ctx = {
    window: {}, document: { documentElement: { dataset: {} }, getElementById: () => null },
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    navigator: { userAgent: 'jest' }, console: { log: () => {}, warn: () => {}, error: () => {} },
  };
  ctx.window.AppState = {};
  vm.createContext(ctx);
  try { vm.runInContext(appSrc, ctx); } catch (_) { /* ignore late-binding errors */ }
  return ctx;
}

// PENDING_PATH_2_REIMPL — Plan A skeleton replaced app.js; renderStaleLockedBar removed; re-enable in Plan B with new BEM render layer
describe.skip('renderStaleLockedBar', () => {
  let ctx;
  beforeEach(() => { ctx = loadAppHelpers(); });

  test('returns empty string when not stale', () => {
    ctx.window.AppState.circlesStale = false;
    expect(ctx.renderStaleLockedBar('C1', { C1: { totalScore: 65 } })).toBe('');
  });

  test('returns banner without pill when stale but step not locked', () => {
    ctx.window.AppState.circlesStale = true;
    const html = ctx.renderStaleLockedBar('C1', {});
    expect(html).toContain('class="stale-locked-bar"');
    expect(html).toContain('此題目已更新');
    expect(html).not.toContain('class="pill"');
  });

  test('returns banner with score pill when stale + locked', () => {
    ctx.window.AppState.circlesStale = true;
    const html = ctx.renderStaleLockedBar('C1', { C1: { totalScore: 65 } });
    expect(html).toContain('class="stale-locked-bar"');
    expect(html).toContain('class="pill"');
    expect(html).toContain('65 分');
  });
});
