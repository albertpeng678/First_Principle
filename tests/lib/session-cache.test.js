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

  test('TTL_MS is 30000', () => {
    expect(cache.TTL_MS).toBe(30000);
  });
});
