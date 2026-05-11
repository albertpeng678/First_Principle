const express = require('express');
const router = express.Router();
const db = require('../db/client');
const { dedupSessions } = require('../lib/session-dedup');

// GET /api/circles-stats — auth-required
// Returns { completed, active, weeklyCompleted } for the authenticated user.
// Applies same per-question_id dedup as GET /api/circles-sessions so the home
// stats card and the offcanvas list agree.
router.get('/', async (req, res) => {
  if (!req.user || !req.user.id) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  const userId = req.user.id;

  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await db
      .from('circles_sessions')
      .select('id, question_id, status, created_at, updated_at')
      .eq('user_id', userId);

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
