'use strict';

const fs = require('fs');
const path = require('path');

// PENDING_PATH_2_REIMPL — Plan A skeleton removed getNsmContextSource helper from app.js; re-enable in Plan C (NSM) with new render layer
describe('NSM context source selection (prefer q.context over fetch)', () => {
  const APP_PATH = path.join(__dirname, '..', 'public', 'app.js');
  const src = fs.readFileSync(APP_PATH, 'utf8');

  function extractFn() {
    // 匹配 function getNsmContextSource(...) { ... }，使用 stack-based balance
    const start = src.search(/function\s+getNsmContextSource\s*\(/);
    if (start < 0) return null;
    const braceStart = src.indexOf('{', start);
    let depth = 0, i = braceStart;
    for (; i < src.length; i++) {
      if (src[i] === '{') depth++;
      else if (src[i] === '}') { depth--; if (depth === 0) break; }
    }
    return src.slice(start, i + 1);
  }

  test('app.js exposes / defines getNsmContextSource helper', () => {
    expect(src).toMatch(/function\s+getNsmContextSource\s*\(/);
  });

  test('getNsmContextSource returns "pregenerated" when q.context has all 4 fields', () => {
    const fnSrc = extractFn();
    expect(fnSrc).not.toBeNull();
    const fn = (new Function(fnSrc + '\nreturn getNsmContextSource;'))();
    const q = { id: 'q1', context: { model: 'm', users: 'u', traps: 't', insight: 'i' } };
    expect(fn(q, null, null)).toBe('pregenerated');
  });

  test('getNsmContextSource returns "cached" when AppState already has context for this qid', () => {
    const fnSrc = extractFn();
    const fn = (new Function(fnSrc + '\nreturn getNsmContextSource;'))();
    const q = { id: 'q1' }; // 沒有 q.context
    expect(fn(q, { model: 'x', users: 'y', traps: 'z', insight: 'w' }, 'q1')).toBe('cached');
  });

  test('getNsmContextSource returns "fetch" when no q.context and no cache', () => {
    const fnSrc = extractFn();
    const fn = (new Function(fnSrc + '\nreturn getNsmContextSource;'))();
    expect(fn({ id: 'q1' }, null, null)).toBe('fetch');
  });

  test('getNsmContextSource returns "fetch" when q.context exists but is incomplete', () => {
    const fnSrc = extractFn();
    const fn = (new Function(fnSrc + '\nreturn getNsmContextSource;'))();
    const q = { id: 'q1', context: { model: 'm', users: 'u' } }; // 缺 traps + insight
    expect(fn(q, null, null)).toBe('fetch');
  });

  test('getNsmContextSource returns "fetch" when cached context belongs to a different qid', () => {
    const fnSrc = extractFn();
    const fn = (new Function(fnSrc + '\nreturn getNsmContextSource;'))();
    const q = { id: 'q2' };
    expect(fn(q, { model: 'a', users: 'b', traps: 'c', insight: 'd' }, 'q1')).toBe('fetch');
  });
});
