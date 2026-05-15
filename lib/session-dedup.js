'use strict';

// STATUS_RANK: higher number = more progressed.
const STATUS_RANK = { completed: 3, active: 2 };

/**
 * dedupSessions(rows)
 *
 * Given an array of session rows (each with at least question_id, status,
 * created_at), returns one row per question_id: the most-progressed one by
 * STATUS_RANK, with ties broken by most-recent updated_at (falling back to
 * created_at for rows that lack updated_at).
 *
 * Using updated_at as the tie-breaker ensures that a desktop-written row
 * (which always carries a fresh updated_at) beats an older mobile snapshot
 * even when both rows share the same created_at or status rank.
 *
 * @param {Array<{question_id: string, status: string, created_at: string, updated_at?: string}>} rows
 * @returns {Array}
 */
function dedupSessions(rows) {
  const best = new Map();
  for (const row of rows) {
    const key = row.question_id;
    const prev = best.get(key);
    if (!prev) {
      best.set(key, row);
      continue;
    }
    const rankRow  = STATUS_RANK[row.status]  ?? 1;
    const rankPrev = STATUS_RANK[prev.status] ?? 1;
    if (rankRow > rankPrev) {
      best.set(key, row);
    } else if (rankRow === rankPrev) {
      // Tie: prefer the row with the most-recent activity timestamp.
      // updated_at reflects the last write; fall back to created_at when absent.
      const tsRow  = row.updated_at  || row.created_at;
      const tsPrev = prev.updated_at || prev.created_at;
      if (new Date(tsRow) > new Date(tsPrev)) {
        best.set(key, row);
      }
    }
  }
  return Array.from(best.values());
}

module.exports = { dedupSessions };
