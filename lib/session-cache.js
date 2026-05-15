'use strict';

const TTL_MS = 5 * 1000; // 5 seconds — reduced from 30s to limit cross-device staleness lag

// Internal store: Map<`${kind}:${owner}`, { data, expiresAt }>
let _store = new Map();

/**
 * get(kind, owner) → cached data or null
 * @param {string} kind  e.g. 'nsm-auth', 'circles-guest'
 * @param {string} owner user_id or guestId
 */
function get(kind, owner) {
  const key = `${kind}:${owner}`;
  const entry = _store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    _store.delete(key);
    return null;
  }
  return entry.data;
}

/**
 * set(kind, owner, data) — store with 30s TTL
 */
function set(kind, owner, data) {
  const key = `${kind}:${owner}`;
  _store.set(key, { data, expiresAt: Date.now() + TTL_MS });
}

/**
 * invalidate(kind, owner) — remove one cache entry
 */
function invalidate(kind, owner) {
  _store.delete(`${kind}:${owner}`);
}

/**
 * invalidateAll(kind) — remove all cache entries matching a given kind prefix.
 * Hook for future cross-user or cross-device invalidation (not called on write path today).
 * @param {string} kind  e.g. 'nsm-auth', 'circles-auth'
 */
function invalidateAll(kind) {
  const prefix = kind + ':';
  for (const key of _store.keys()) {
    if (key.startsWith(prefix)) _store.delete(key);
  }
}

/**
 * _reset() — clear all entries (test-only)
 */
function _reset() {
  _store = new Map();
}

module.exports = { get, set, invalidate, invalidateAll, _reset, TTL_MS };
