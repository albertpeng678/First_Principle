const express = require('express');
const router = express.Router();
const db = require('../db/client');
const { requireAuth } = require('../middleware/auth');
const { requireGuestId } = require('../middleware/guest');

// POST /api/migrate-guest
router.post('/', requireAuth, requireGuestId, async (req, res) => {
  const { guestSessionIds } = req.body;
  if (!Array.isArray(guestSessionIds) || guestSessionIds.length === 0) {
    return res.status(400).json({ error: 'invalid_session_ids' });
  }

  const { data: guestSessions, error: fetchError } = await db
    .from('guest_sessions')
    .select('*')
    .eq('guest_id', req.guestId)
    .in('id', guestSessionIds);

  if (fetchError) return res.status(500).json({ error: fetchError.message });
  if (!guestSessions.length) return res.json({ migratedCount: 0 });

  const toInsert = guestSessions.map(({ id: _id, guest_id: _gid, expires_at: _exp, ...rest }) => ({
    ...rest,
    user_id: req.user.id
  }));

  const { error: insertError } = await db.from('practice_sessions').insert(toInsert);
  if (insertError) return res.status(500).json({ error: insertError.message });

  await db.from('guest_sessions').delete().in('id', guestSessionIds);

  res.json({ migratedCount: guestSessions.length });
});

module.exports = router;
