'use strict';

const TTL_MS = 30 * 1000; // 30 seconds

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
 * _reset() — clear all entries (test-only)
 */
function _reset() {
  _store = new Map();
}

module.exports = { get, set, invalidate, _reset, TTL_MS };
