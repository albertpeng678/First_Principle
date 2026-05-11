'use strict';

// STATUS_RANK: higher number = more progressed.
const STATUS_RANK = { completed: 3, active: 2 };

/**
 * dedupSessions(rows)
 *
 * Given an array of session rows (each with at least question_id, status,
 * created_at), returns one row per question_id: the most-progressed one by
 * STATUS_RANK, with ties broken by most-recent created_at.
 *
 * @param {Array<{question_id: string, status: string, created_at: string}>} rows
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
      // Tie: keep most-recent created_at
      if (new Date(row.created_at) > new Date(prev.created_at)) {
        best.set(key, row);
      }
    }
  }
  return Array.from(best.values());
}

module.exports = { dedupSessions };
