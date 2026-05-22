'use strict';

/**
 * Coerce incoming userNsm value into a guaranteed object shape.
 * Idempotent for object input; merges with existing DB row on string input.
 *
 * Spec: docs/superpowers/specs/2026-05-22-schema-1-v2-evaluate-shape-coerce-design.md §3
 *
 * @param {Object}  args
 * @param {*}       args.incoming    Raw value from req.body.userNsm
 * @param {string}  args.sessionId   nsm_sessions.id for SELECT-merge path
 * @param {Object}  args.db          Supabase service-role client
 * @returns {Promise<Object|undefined>}
 */
async function coerceUserNsm({ incoming, sessionId, db }) {
  // B1: undefined → no-op
  if (incoming === undefined) return undefined;

  // B2: object → passthrough (FE contract: caller MUST send all 3 keys)
  if (incoming !== null && typeof incoming === 'object' && !Array.isArray(incoming)) {
    return incoming;
  }

  // B3/B4: string → SELECT existing + merge (with fallback)
  if (typeof incoming === 'string') {
    try {
      const { data, error } = await db
        .from('nsm_sessions')
        .select('user_nsm')
        .eq('id', sessionId)
        .single();
      const existing = (data && data.user_nsm && typeof data.user_nsm === 'object' && !Array.isArray(data.user_nsm))
        ? data.user_nsm
        : null;
      if (!error && existing) {
        console.warn('[coerce-user-nsm] string→object', { sessionId, incomingLen: incoming.length });
        return {
          nsm: incoming,
          explanation: existing.explanation || '',
          businessLink: existing.businessLink || '',
        };
      }
      // B4: SELECT fail or row missing → fallback wrap
      console.warn('[coerce-user-nsm] SELECT fail fallback', { sessionId, err: error && error.message });
      return { nsm: incoming, explanation: '', businessLink: '' };
    } catch (e) {
      console.warn('[coerce-user-nsm] SELECT throw fallback', { sessionId, err: e.message });
      return { nsm: incoming, explanation: '', businessLink: '' };
    }
  }

  // B5: number/array/null/boolean → invalid → no-op
  console.warn('[coerce-user-nsm] invalid type', { sessionId, type: typeof incoming, isArray: Array.isArray(incoming) });
  return undefined;
}

module.exports = { coerceUserNsm };
