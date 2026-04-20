const { requireGuestId } = require('../middleware/guest');

function makeRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

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
