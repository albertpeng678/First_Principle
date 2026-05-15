// Unit-level test: simulate the fixture's afterEach behavior with a mock request.delete
// (full Playwright integration tested implicitly when specs use this fixture)

const { runAfterEachCleanup, validateTrackArgs } = require('./auto-cleanup.fixture');

function makeMockRequest(failOn404 = false) {
  const calls = [];
  return {
    calls,
    async delete(path) {
      calls.push(path);
      if (failOn404 && path.includes('/SHOULD_404')) {
        return { ok: () => false, status: () => 404 };
      }
      return { ok: () => true, status: () => 200 };
    },
  };
}

describe('auto-cleanup runAfterEachCleanup', () => {
  test('zero tracked → no DELETE calls', async () => {
    const req = makeMockRequest();
    await runAfterEachCleanup([], req);
    expect(req.calls).toHaveLength(0);
  });

  test('one tracked nsm session → one DELETE', async () => {
    const req = makeMockRequest();
    await runAfterEachCleanup([{ kind: 'nsm', id: 'abc-123' }], req);
    expect(req.calls).toEqual(['/api/nsm-sessions/abc-123']);
  });

  test('three tracked mixed sessions → three DELETEs', async () => {
    const req = makeMockRequest();
    await runAfterEachCleanup(
      [
        { kind: 'nsm', id: 'a1' },
        { kind: 'circles', id: 'b2' },
        { kind: 'nsm', id: 'c3' },
      ],
      req
    );
    expect(req.calls).toEqual([
      '/api/nsm-sessions/a1',
      '/api/circles-sessions/b2',
      '/api/nsm-sessions/c3',
    ]);
  });

  test('404 swallowed and logged, does not throw', async () => {
    const req = makeMockRequest(true);
    const warns = [];
    const origWarn = console.warn;
    console.warn = (msg) => warns.push(msg);
    try {
      await expect(
        runAfterEachCleanup([{ kind: 'nsm', id: 'SHOULD_404' }], req)
      ).resolves.not.toThrow();
      expect(warns.some((w) => /SHOULD_404/.test(w))).toBe(true);
    } finally {
      console.warn = origWarn;
    }
  });

  test('500 response throws with failure summary', async () => {
    const req = {
      async delete() {
        return { ok: () => false, status: () => 500 };
      },
    };
    await expect(
      runAfterEachCleanup([{ kind: 'nsm', id: 'x500' }], req)
    ).rejects.toThrow(/non-404 cleanup failure.*returned 500/s);
  });

  test('mixed 404 + 500 throws with only 500 in failure list', async () => {
    const calls = [];
    const req = {
      async delete(path) {
        calls.push(path);
        if (path.includes('/g404')) return { ok: () => false, status: () => 404 };
        if (path.includes('/b500')) return { ok: () => false, status: () => 500 };
        return { ok: () => true, status: () => 200 };
      },
    };
    await expect(
      runAfterEachCleanup(
        [
          { kind: 'nsm', id: 'g404' },
          { kind: 'circles', id: 'b500' },
          { kind: 'nsm', id: 'ok' },
        ],
        req
      )
    ).rejects.toThrow(/1 non-404 cleanup failure.*returned 500/s);
    expect(calls).toEqual(['/api/nsm-sessions/g404', '/api/circles-sessions/b500', '/api/nsm-sessions/ok']);
  });

  test('thrown DELETE collected as failure (network error)', async () => {
    const req = {
      async delete() {
        throw new Error('ECONNREFUSED');
      },
    };
    await expect(
      runAfterEachCleanup([{ kind: 'nsm', id: 'netfail' }], req)
    ).rejects.toThrow(/threw: ECONNREFUSED/);
  });
});

describe('validateTrackArgs', () => {
  test.each([
    ['nsm', 'abc', null],
    ['circles', '123', null],
  ])('passes for valid kind=%j id=%j', (kind, id) => {
    expect(() => validateTrackArgs(kind, id)).not.toThrow();
  });

  test.each([
    ['NSM', 'abc', /invalid kind/],
    ['users', 'abc', /invalid kind/],
    ['', 'abc', /invalid kind/],
  ])('throws for invalid kind=%j', (kind, id, pattern) => {
    expect(() => validateTrackArgs(kind, id)).toThrow(pattern);
  });

  test.each([
    ['nsm', undefined],
    ['nsm', null],
    ['nsm', ''],
  ])('throws for empty id=%j', (kind, id) => {
    expect(() => validateTrackArgs(kind, id)).toThrow(/id is required/);
  });
});
