// A5 coverage — POST /api/migrate-guest 三個 bucket（CIRCLES / NSM / Legacy）
// 與 A5-conflict（23505 → result.conflicts++ 且刪掉 guest orphan）。

jest.mock('../middleware/auth', () => ({
  requireAuth: (req, _res, next) => { req.user = { id: 'AUTH-USER-1' }; next(); },
}));
jest.mock('../middleware/guest', () => ({
  requireGuestId: (req, _res, next) => { req.guestId = 'GUEST-1'; next(); },
}));

jest.mock('../db/client', () => {
  const qb = {};
  const chain = ['from', 'select', 'insert', 'update', 'delete', 'eq', 'in', 'is'];
  chain.forEach((m) => { qb[m] = jest.fn().mockReturnValue(qb); });
  qb.maybeSingle = jest.fn();
  qb._next = [];
  qb.then = (resolve, reject) => {
    const v = qb._next.shift();
    if (v && v instanceof Error) return Promise.reject(v).then(resolve, reject);
    return Promise.resolve(v).then(resolve, reject);
  };
  return { from: jest.fn(() => qb), __qb: qb };
});

const db = require('../db/client');
const qb = db.__qb;

const express = require('express');
const request = require('supertest');
const migrateRouter = require('../routes/migrate');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/migrate-guest', migrateRouter);
  return app;
}

beforeEach(() => {
  qb._next.length = 0;
  qb.maybeSingle.mockReset();
});

test('A5 happy: legacy + CIRCLES + NSM 三 bucket 全 claim', async () => {
  // legacy
  qb._next.push({ data: [{ id: 'GS-1', question_id: 'Q1', payload: 'x' }], error: null });
  qb._next.push({ error: null }); // insert practice_sessions
  qb._next.push({ error: null }); // delete guest_sessions
  // circles select
  qb._next.push({ data: [{ id: 'CIR-1' }], error: null });
  qb.maybeSingle.mockResolvedValueOnce({ data: { id: 'CIR-1' }, error: null });
  // nsm select
  qb._next.push({ data: [{ id: 'NSM-1' }], error: null });
  qb.maybeSingle.mockResolvedValueOnce({ data: { id: 'NSM-1' }, error: null });

  const res = await request(buildApp())
    .post('/api/migrate-guest')
    .send({ guestSessionIds: ['GS-1'] });

  expect(res.status).toBe(200);
  expect(res.body).toMatchObject({ legacy: 1, circles: 1, nsm: 1, conflicts: 0 });
  expect(res.body.migratedCount).toBe(1);
});

test('A5-conflict: 23505 unique violation → result.conflicts++ 且 guest orphan 被刪', async () => {
  // CIRCLES select → 1 row
  qb._next.push({ data: [{ id: 'CIR-DUP' }], error: null });
  // per-row UPDATE returns 23505
  qb.maybeSingle.mockResolvedValueOnce({ data: null, error: { code: '23505', message: 'unique violation' } });
  // DELETE orphan guest row
  qb._next.push({ error: null });
  // NSM select → empty
  qb._next.push({ data: [], error: null });

  const res = await request(buildApp())
    .post('/api/migrate-guest')
    .send({});

  expect(res.status).toBe(200);
  expect(res.body.circles).toBe(0);
  expect(res.body.conflicts).toBe(1);
});

test('A5: 無 guestSessionIds 時跳過 legacy bucket', async () => {
  qb._next.push({ data: [], error: null });
  qb._next.push({ data: [], error: null });

  const res = await request(buildApp())
    .post('/api/migrate-guest')
    .send({});

  expect(res.status).toBe(200);
  expect(res.body).toMatchObject({ legacy: 0, circles: 0, nsm: 0 });
});
