const express = require('express');
const router = express.Router();
const db = require('../db/client');
const { requireAuth } = require('../middleware/auth');
const { requireGuestId } = require('../middleware/guest');

// POST /api/migrate-guest
// Migrates ALL guest data tied to req.guestId into req.user.id:
//   1. Legacy practice sessions (guest_sessions → practice_sessions, copy + delete)
//   2. CIRCLES sessions (circles_sessions: guest_id → user_id, in-place)
//   3. NSM sessions     (nsm_sessions:     guest_id → user_id, in-place)
//
// Body: { guestSessionIds?: string[] }   // optional — controls legacy migration only
// Returns: { circles, nsm, legacy }      // counts migrated for each bucket
router.post('/', requireAuth, requireGuestId, async (req, res) => {
  const { guestSessionIds } = req.body || {};
  const result = { circles: 0, nsm: 0, legacy: 0, conflicts: 0 };

  // -------- 1) Legacy practice sessions (copy then delete) --------
  if (Array.isArray(guestSessionIds) && guestSessionIds.length > 0) {
    const { data: guestSessions, error: fetchError } = await db
      .from('guest_sessions')
      .select('*')
      .eq('guest_id', req.guestId)
      .in('id', guestSessionIds);
    if (fetchError) return res.status(500).json({ error: fetchError.message });

    if (guestSessions && guestSessions.length) {
      const toInsert = guestSessions.map(({ id: _id, guest_id: _gid, expires_at: _exp, ...rest }) => ({
        ...rest,
        user_id: req.user.id
      }));
      const { error: insertError } = await db.from('practice_sessions').insert(toInsert);
      if (insertError) return res.status(500).json({ error: insertError.message });
      await db.from('guest_sessions').delete().in('id', guestSessionIds);
      result.legacy = guestSessions.length;
    }
  }

  // -------- 2) CIRCLES sessions (claim in-place) --------
  // circles_sessions has both guest_id + user_id columns; flip ownership.
  // B5-2 — set-based UPDATE silently swallows 23505 (unique violation) when
  // the user already has an active row for the same (question_id, mode,
  // drill_step). Fall back to per-row claim so we can count conflicts and
  // dispose of the orphan guest row.
  try {
    const { data: guestCircles, error: cListErr } = await db
      .from('circles_sessions')
      .select('id')
      .eq('guest_id', req.guestId)
      .is('user_id', null);
    if (cListErr) {
      console.error('[migrate-guest] circles_sessions list error:', cListErr);
    } else {
      for (const row of guestCircles || []) {
        const { data: claimed, error: cErr } = await db
          .from('circles_sessions')
          .update({ guest_id: null, user_id: req.user.id })
          .eq('id', row.id)
          .eq('guest_id', req.guestId)
          .is('user_id', null)
          .select('id')
          .maybeSingle();
        if (cErr && cErr.code === '23505') {
          // User already has an active row for this tuple. The guest copy is
          // an orphan duplicate — delete it and count the conflict.
          await db.from('circles_sessions').delete().eq('id', row.id).eq('guest_id', req.guestId);
          result.conflicts += 1;
        } else if (cErr) {
          console.error('[migrate-guest] circles_sessions claim error:', cErr);
        } else if (claimed) {
          result.circles += 1;
        }
      }
    }
  } catch (e) {
    console.error('[migrate-guest] circles_sessions exception:', e);
  }

  // -------- 3) NSM sessions (claim in-place) --------
  try {
    const { data: guestNsm, error: nListErr } = await db
      .from('nsm_sessions')
      .select('id')
      .eq('guest_id', req.guestId)
      .is('user_id', null);
    if (nListErr) {
      console.error('[migrate-guest] nsm_sessions list error:', nListErr);
    } else {
      for (const row of guestNsm || []) {
        const { data: claimed, error: nErr } = await db
          .from('nsm_sessions')
          .update({ guest_id: null, user_id: req.user.id })
          .eq('id', row.id)
          .eq('guest_id', req.guestId)
          .is('user_id', null)
          .select('id')
          .maybeSingle();
        if (nErr && nErr.code === '23505') {
          await db.from('nsm_sessions').delete().eq('id', row.id).eq('guest_id', req.guestId);
          result.conflicts += 1;
        } else if (nErr) {
          console.error('[migrate-guest] nsm_sessions claim error:', nErr);
        } else if (claimed) {
          result.nsm += 1;
        }
      }
    }
  } catch (e) {
    console.error('[migrate-guest] nsm_sessions exception:', e);
  }

  res.json({ ...result, migratedCount: result.legacy }); // keep legacy field for back-compat
});

module.exports = router;
