const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function requireGuestId(req, res, next) {
  const guestId = req.headers['x-guest-id'];
  if (!guestId || !UUID_V4.test(guestId)) {
    return res.status(400).json({ error: 'missing_or_invalid_guest_id' });
  }
  req.guestId = guestId;
  next();
}

module.exports = { requireGuestId };
