'use strict';

/**
 * persistRetry — retry helper for fire-and-forget writes
 *
 * 3 exports: persistRetry / defaultBackoff / RetryExhausted
 * No dependencies. ~50 LOC.
 */

class RetryExhausted extends Error {
  constructor(lastError, attempts) {
    super(`RetryExhausted after ${attempts} attempts: ${lastError && lastError.message}`);
    this.name = 'RetryExhausted';
    this.lastError = lastError;
    this.attempts = attempts;
  }
}

function defaultBackoff() {
  return [250, 500, 1000];
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function isRetryable(errOrResp) {
  // AbortError: intentional abort — do not retry
  if (errOrResp && errOrResp.name === 'AbortError') return false;
  // TypeError: network error — retry
  if (errOrResp instanceof TypeError) return true;
  // Response-like: retry 5xx; do NOT retry 4xx
  if (errOrResp && typeof errOrResp.status === 'number') {
    return errOrResp.status >= 500 || errOrResp.status === 0;
  }
  // Unknown error — retry by default (defensive)
  return true;
}

/**
 * @param {() => Promise<Response>} fn  - fetch-returning thunk
 * @param {{ maxAttempts?: number, backoff?: number[], label?: string, onRetry?: Function }} opts
 * @returns {Promise<Response>}
 * @throws {RetryExhausted}
 */
async function persistRetry(fn, opts = {}) {
  const {
    maxAttempts = 4,
    backoff = defaultBackoff(),
    label = '',
    onRetry
  } = opts;

  let lastError = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let resp;
    try {
      resp = await fn();
    } catch (err) {
      if (!isRetryable(err)) throw err;
      lastError = err;
    }

    if (resp !== undefined) {
      if (resp.ok) return resp;
      if (!isRetryable(resp)) {
        const err = new Error(`HTTP ${resp.status}`);
        err.status = resp.status;
        throw err;
      }
      lastError = new Error(`HTTP ${resp.status}`);
      lastError.status = resp.status;
    }

    if (attempt < maxAttempts) {
      const delay = backoff[attempt - 1] || backoff[backoff.length - 1];
      if (onRetry) onRetry(attempt + 1, lastError);
      await sleep(delay);
    }
  }

  throw new RetryExhausted(lastError, maxAttempts);
}

// Dual-mode export: Node CJS (unit tests) + browser window global (app.js wiring)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { persistRetry, defaultBackoff, RetryExhausted };
}
if (typeof window !== 'undefined') {
  window.persistRetry = { persistRetry: persistRetry, defaultBackoff: defaultBackoff, RetryExhausted: RetryExhausted };
}
