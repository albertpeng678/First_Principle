'use strict';

const cache = require('../../lib/session-cache');

beforeEach(() => cache._reset());

describe('session-cache', () => {
  test('get returns null when nothing set', () => {
    expect(cache.get('nsm-auth', 'user-123')).toBeNull();
  });

  test('set then get returns the same data', () => {
    const data = [{ id: 'sess-1', question_id: 'nsm_001' }];
    cache.set('nsm-auth', 'user-abc', data);
    expect(cache.get('nsm-auth', 'user-abc')).toEqual(data);
  });

  test('different owners are isolated', () => {
    cache.set('circles-auth', 'user-A', [{ id: 'a' }]);
    cache.set('circles-auth', 'user-B', [{ id: 'b' }]);
    expect(cache.get('circles-auth', 'user-A')).toEqual([{ id: 'a' }]);
    expect(cache.get('circles-auth', 'user-B')).toEqual([{ id: 'b' }]);
  });

  test('invalidate removes the entry', () => {
    cache.set('nsm-guest', 'guest-xyz', [{ id: 'g' }]);
    cache.invalidate('nsm-guest', 'guest-xyz');
    expect(cache.get('nsm-guest', 'guest-xyz')).toBeNull();
  });

  test('TTL_MS is 5000 (reduced for cross-device freshness)', () => {
    expect(cache.TTL_MS).toBe(5000);
  });

  test('invalidateAll removes all entries for a given kind', () => {
    cache.set('nsm-auth', 'user-A', [{ id: '1' }]);
    cache.set('nsm-auth', 'user-B', [{ id: '2' }]);
    cache.set('circles-auth', 'user-A', [{ id: '3' }]);
    cache.invalidateAll('nsm-auth');
    expect(cache.get('nsm-auth', 'user-A')).toBeNull();
    expect(cache.get('nsm-auth', 'user-B')).toBeNull();
    // circles-auth is a different kind — must not be affected
    expect(cache.get('circles-auth', 'user-A')).toEqual([{ id: '3' }]);
  });
});
