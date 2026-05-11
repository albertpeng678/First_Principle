// lib/session-rehydrate.js
// Merges current question bank's field_examples + context into a session's
// stored question_json. Fixes legacy sessions that snapshotted before bank
// was enriched.

const { circlesById, nsmById } = require('./question-bank');

function rehydrateQuestionJson(sessionRow, kind) {
  if (!sessionRow || !sessionRow.question_id) return sessionRow;
  const lookup = kind === 'nsm' ? nsmById : circlesById;
  const bankRow = lookup(sessionRow.question_id);
  if (!bankRow) return sessionRow;

  const qj = sessionRow.question_json || {};
  const merged = Object.assign({}, qj);

  // CIRCLES + NSM both have field_examples (after T6 NSM bank backfill).
  if (!merged.field_examples && bankRow.field_examples) {
    merged.field_examples = bankRow.field_examples;
  }
  // NSM context only (CIRCLES uses different structure).
  if (kind === 'nsm' && !merged.context && bankRow.context) {
    merged.context = bankRow.context;
  }

  return Object.assign({}, sessionRow, { question_json: merged });
}

function rehydrateMany(rows, kind) {
  if (!Array.isArray(rows)) return rows;
  return rows.map(r => rehydrateQuestionJson(r, kind));
}

module.exports = { rehydrateQuestionJson, rehydrateMany };
