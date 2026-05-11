// routes/guest-nsm-stats.js
const express = require('express');
const router = express.Router();
const db = require('../db/client');
const { requireGuestId } = require('../middleware/guest');

// GET /api/guest-nsm-stats — guest stats (mirrors nsm-stats.js for X-Guest-ID).
router.get('/', requireGuestId, async (req, res) => {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const [completedRes, activeRes, weeklyRes] = await Promise.all([
      db.from('nsm_sessions').select('id', { count: 'exact', head: true })
        .eq('guest_id', req.guestId).eq('status', 'completed'),
      db.from('nsm_sessions').select('id', { count: 'exact', head: true })
        .eq('guest_id', req.guestId).eq('status', 'active'),
      db.from('nsm_sessions').select('id', { count: 'exact', head: true })
        .eq('guest_id', req.guestId).eq('status', 'completed').gte('updated_at', sevenDaysAgo),
    ]);

    if (completedRes.error || activeRes.error || weeklyRes.error) {
      return res.status(500).json({ error: 'db_error' });
    }

    res.json({
      completed: completedRes.count || 0,
      active: activeRes.count || 0,
      weeklyCompleted: weeklyRes.count || 0,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
