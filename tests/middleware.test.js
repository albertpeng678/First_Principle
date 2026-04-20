const { requireGuestId } = require('../middleware/guest');
const { requireAuth } = require('../middleware/auth');

jest.mock('../db/client', () => ({
  auth: {
    getUser: jest.fn(),
  },
}));
const db = require('../db/client');

function makeRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

// ── Guest middleware ──────────────────────────────
test('missing guestId returns 400', () => {
  const req = { headers: {} };
  const res = makeRes();
  const next = jest.fn();
  requireGuestId(req, res, next);
  expect(res.status).toHaveBeenCalledWith(400);
  expect(next).not.toHaveBeenCalled();
});

test('invalid uuid returns 400', () => {
  const req = { headers: { 'x-guest-id': 'not-a-uuid' } };
  const res = makeRes();
  const next = jest.fn();
  requireGuestId(req, res, next);
  expect(res.status).toHaveBeenCalledWith(400);
});

test('valid uuid v4 calls next', () => {
  const req = { headers: { 'x-guest-id': '550e8400-e29b-41d4-a716-446655440000' } };
  const res = makeRes();
  const next = jest.fn();
  requireGuestId(req, res, next);
  expect(next).toHaveBeenCalled();
  expect(req.guestId).toBe('550e8400-e29b-41d4-a716-446655440000');
});

// ── Auth middleware ───────────────────────────────
test('missing authorization header returns 401', async () => {
  const req = { headers: {} };
  const res = makeRes();
  const next = jest.fn();
  await requireAuth(req, res, next);
  expect(res.status).toHaveBeenCalledWith(401);
  expect(next).not.toHaveBeenCalled();
});

test('invalid token returns 401', async () => {
  db.auth.getUser.mockResolvedValue({ data: { user: null }, error: { message: 'invalid' } });
  const req = { headers: { authorization: 'Bearer bad-token' } };
  const res = makeRes();
  const next = jest.fn();
  await requireAuth(req, res, next);
  expect(res.status).toHaveBeenCalledWith(401);
  expect(next).not.toHaveBeenCalled();
});

test('valid token sets req.user and calls next', async () => {
  const fakeUser = { id: 'user-uuid-123', email: 'test@example.com' };
  db.auth.getUser.mockResolvedValue({ data: { user: fakeUser }, error: null });
  const req = { headers: { authorization: 'Bearer valid-token' } };
  const res = makeRes();
  const next = jest.fn();
  await requireAuth(req, res, next);
  expect(next).toHaveBeenCalled();
  expect(req.user).toEqual(fakeUser);
});
