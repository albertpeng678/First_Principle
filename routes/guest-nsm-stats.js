// routes/guest-nsm-stats.js
const express = require('express');
const router = express.Router();
const db = require('../db/client');
const { requireGuestId } = require('../middleware/guest');
const { dedupSessions } = require('../lib/session-dedup');

// GET /api/guest-nsm-stats — guest stats (mirrors nsm-stats.js for X-Guest-ID).
router.get('/', requireGuestId, async (req, res) => {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await db
      .from('nsm_sessions')
      .select('id, question_id, status, created_at, updated_at')
      .eq('guest_id', req.guestId);

    if (error) {
      return res.status(500).json({ error: 'db_error' });
    }

    const deduped = dedupSessions(data || []);
    let completed = 0;
    let active = 0;
    let weeklyCompleted = 0;
    for (const row of deduped) {
      if (row.status === 'completed') {
        completed += 1;
        if (row.updated_at && row.updated_at >= sevenDaysAgo) weeklyCompleted += 1;
      } else if (row.status === 'active') {
        active += 1;
      }
    }

    res.json({ completed, active, weeklyCompleted });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
