// Unit-level test: simulate the fixture's afterEach behavior with a mock request.delete
// (full Playwright integration tested implicitly when specs use this fixture)

const { runAfterEachCleanup } = require('./auto-cleanup.fixture');

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
});
