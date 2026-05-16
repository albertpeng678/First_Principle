'use strict';

const { persistRetry, defaultBackoff, RetryExhausted } = require('../../public/lib/persistRetry');

// Helper to make a mock Response-like object
function makeResponse(status) {
  return { ok: status >= 200 && status < 300, status };
}

// Helper to make a fetch-like function returning Responses or rejecting with Errors
function makeFetch(responses) {
  let callCount = 0;
  return jest.fn(() => {
    const resp = responses[Math.min(callCount, responses.length - 1)];
    callCount++;
    if (resp instanceof Error) return Promise.reject(resp);
    return Promise.resolve(resp);
  });
}

describe('defaultBackoff', () => {
  test('returns [250, 500, 1000]', () => {
    expect(defaultBackoff()).toEqual([250, 500, 1000]);
  });
});

describe('persistRetry', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('resolves immediately on first-attempt 200', async () => {
    const fetch = makeFetch([makeResponse(200)]);
    const result = await persistRetry(fetch);
    expect(result.status).toBe(200);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  test('retries on 503 and resolves on 2nd attempt', async () => {
    const fetch = makeFetch([makeResponse(503), makeResponse(200)]);
    const resultPromise = persistRetry(fetch);
    await jest.runAllTimersAsync();
    const result = await resultPromise;
    expect(result.status).toBe(200);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  test('retries on TypeError and resolves on 3rd attempt', async () => {
    const networkErr = new TypeError('Failed to fetch');
    const fetch = makeFetch([networkErr, networkErr, makeResponse(200)]);
    const resultPromise = persistRetry(fetch);
    await jest.runAllTimersAsync();
    const result = await resultPromise;
    expect(result.status).toBe(200);
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  test('throws RetryExhausted after 4 failed attempts (maxAttempts=4)', async () => {
    const fetch = makeFetch([makeResponse(503)]);
    let caught;
    const resultPromise = persistRetry(fetch).catch(err => { caught = err; });
    await jest.runAllTimersAsync();
    await resultPromise;
    expect(caught).toBeInstanceOf(RetryExhausted);
    expect(caught.attempts).toBe(4);
    expect(fetch).toHaveBeenCalledTimes(4);
  });

  test('does not retry on 4xx (400, 401, 403, 404)', async () => {
    for (const status of [400, 401, 403, 404]) {
      const fetch = makeFetch([makeResponse(status)]);
      let caught;
      const resultPromise = persistRetry(fetch).catch(err => { caught = err; });
      await jest.runAllTimersAsync();
      await resultPromise;
      expect(caught).toBeDefined();
      expect(fetch).toHaveBeenCalledTimes(1);
      fetch.mockClear();
    }
  });

  test('honors [250, 500, 1000] backoff — onRetry called 3 times for 4 failed attempts', async () => {
    const fetch = makeFetch([makeResponse(503)]);
    const onRetry = jest.fn();
    let caught;
    const resultPromise = persistRetry(fetch, { backoff: [250, 500, 1000], onRetry })
      .catch(err => { caught = err; });
    await jest.runAllTimersAsync();
    await resultPromise;
    expect(caught).toBeInstanceOf(RetryExhausted);
    // 4 attempts = 3 retries
    expect(onRetry).toHaveBeenCalledTimes(3);
    // Attempt numbers passed to onRetry: 2, 3, 4
    expect(onRetry.mock.calls[0][0]).toBe(2);
    expect(onRetry.mock.calls[1][0]).toBe(3);
    expect(onRetry.mock.calls[2][0]).toBe(4);
  });

  test('onRetry callback fires per retry with (attempt, error)', async () => {
    const networkErr = new TypeError('net fail');
    const fetch = makeFetch([networkErr, networkErr, makeResponse(200)]);
    const onRetry = jest.fn();
    const resultPromise = persistRetry(fetch, { onRetry });
    await jest.runAllTimersAsync();
    await resultPromise;
    expect(onRetry).toHaveBeenCalledTimes(2);
    expect(onRetry.mock.calls[0]).toEqual([2, networkErr]);
    expect(onRetry.mock.calls[1]).toEqual([3, networkErr]);
  });

  test('AbortError does not retry', async () => {
    // Use a plain Error with name='AbortError' for cross-env compatibility
    const abortErr = Object.assign(new Error('The user aborted a request.'), { name: 'AbortError' });
    const fetch = makeFetch([abortErr]);
    let caught;
    const resultPromise = persistRetry(fetch).catch(err => { caught = err; });
    await jest.runAllTimersAsync();
    await resultPromise;
    expect(caught).toBeDefined();
    expect(caught.name).toBe('AbortError');
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
