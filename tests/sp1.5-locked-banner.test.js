'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadHelpers() {
  const src = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');
  const ctx = { window: {}, document: { addEventListener: () => {} }, console };
  const isStepLockedMatch = src.match(/function isStepLocked\([^)]*\)\s*\{[^}]+\}/);
  const renderLockedBannerMatch = src.match(/function renderLockedBanner\([^)]*\)\s*\{[\s\S]+?\n\}/);
  if (!isStepLockedMatch || !renderLockedBannerMatch) {
    throw new Error('Helpers not found in app.js');
  }
  vm.createContext(ctx);
  vm.runInContext(
    isStepLockedMatch[0] + '\n' +
    renderLockedBannerMatch[0] + '\n' +
    'this.isStepLocked = isStepLocked; this.renderLockedBanner = renderLockedBanner;',
    ctx
  );
  return ctx;
}

// PENDING_PATH_2_REIMPL — Plan A skeleton removed renderLockedBanner; re-enable in Plan B with new BEM render layer
describe.skip('renderLockedBanner', () => {
  test('returns empty string when not locked', () => {
    const { renderLockedBanner } = loadHelpers();
    expect(renderLockedBanner('C1', null)).toBe('');
    expect(renderLockedBanner('C1', {})).toBe('');
    expect(renderLockedBanner('C1', { I: { totalScore: 65 } })).toBe('');
  });

  test('renders banner with numeric score (no escHtml crash)', () => {
    const { renderLockedBanner } = loadHelpers();
    const html = renderLockedBanner('C1', { C1: { totalScore: 85 } });
    expect(html).toContain('locked-banner');
    expect(html).toContain('已評分');
    expect(html).toContain('85 分');
    expect(html).toContain('score-pill');
  });

  test('rounds float scores', () => {
    const { renderLockedBanner } = loadHelpers();
    const html = renderLockedBanner('C1', { C1: { totalScore: 65.49 } });
    expect(html).toContain('65 分');
  });

  test('handles zero / undefined score', () => {
    const { renderLockedBanner } = loadHelpers();
    expect(renderLockedBanner('C1', { C1: { totalScore: 0 } })).toContain('0 分');
    expect(renderLockedBanner('C1', { C1: {} })).toContain('0 分');
  });
});
