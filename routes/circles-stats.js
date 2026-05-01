const express = require('express');
const router = express.Router();
const db = require('../db/client');

// GET /api/circles-stats — auth-required
// Returns { completed, active, weeklyCompleted } for the authenticated user.
router.get('/', async (req, res) => {
  if (!req.user || !req.user.id) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  const userId = req.user.id;

  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const [completedRes, activeRes, weeklyRes] = await Promise.all([
      db.from('circles_sessions').select('id', { count: 'exact', head: true })
        .eq('user_id', userId).eq('status', 'completed'),
      db.from('circles_sessions').select('id', { count: 'exact', head: true })
        .eq('user_id', userId).eq('status', 'active'),
      db.from('circles_sessions').select('id', { count: 'exact', head: true })
        .eq('user_id', userId).eq('status', 'completed').gte('updated_at', sevenDaysAgo),
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
