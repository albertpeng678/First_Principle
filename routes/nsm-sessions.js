const express = require('express');
const router = express.Router();
const db = require('../db/client');
const { requireAuth } = require('../middleware/auth');
const { evaluateNSM } = require('../prompts/nsm-evaluator');
const { generateNSMHints } = require('../prompts/nsm-hints');
const { reviewNSMGate } = require('../prompts/nsm-gate');
const { generateNSMContext } = require('../prompts/nsm-context');
const { guessProductType } = require('../prompts/utils/product-type');

// POST /api/nsm-sessions
router.post('/', requireAuth, async (req, res) => {
  const { questionId, questionJson } = req.body;
  if (!questionId || !questionJson) return res.status(400).json({ error: 'missing_fields' });
  try {
    const { data, error } = await db
      .from('nsm_sessions')
      .insert({ user_id: req.user.id, question_id: questionId, question_json: questionJson })
      .select('id')
      .single();
    if (error) throw error;
    res.json({ sessionId: data.id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/nsm-sessions
router.get('/', requireAuth, async (req, res) => {
  const { data, error } = await db
    .from('nsm_sessions')
    .select('id, question_id, question_json, status, scores_json, created_at')
    .eq('user_id', req.user.id)
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

// GET /api/nsm-sessions/:id
router.get('/:id', requireAuth, async (req, res) => {
  const { data, error } = await db
    .from('nsm_sessions')
    .select('*')
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)
    .single();
  if (error || !data) return res.status(404).json({ error: 'not_found' });
  res.json(data);
});

// DELETE /api/nsm-sessions/:id
router.delete('/:id', requireAuth, async (req, res) => {
  const { data, error } = await db
    .from('nsm_sessions')
    .delete()
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)
    .select('id')
    .single();
  if (error && error.code !== 'PGRST116') return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'not_found' });
  res.json({ ok: true });
});

// POST /api/nsm-sessions/:id/evaluate
router.post('/:id/evaluate', requireAuth, async (req, res) => {
  const { userNsm, userBreakdown } = req.body;
  const { data: session, error } = await db
    .from('nsm_sessions')
    .select('*')
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)
    .single();
  if (error || !session) return res.status(404).json({ error: 'not_found' });
  try {
    const result = await evaluateNSM({
      question_json: session.question_json,
      user_nsm: userNsm,
      user_breakdown: userBreakdown
    });
    // B6-1 — defense-in-depth: scope the UPDATE to the authenticated owner
    // so a TOCTOU race or future regression in the SELECT guard above can't
    // let one user mutate another's session row.
    const { error: upErr } = await db.from('nsm_sessions').update({
      user_nsm: userNsm,
      user_breakdown: userBreakdown,
      scores_json: result,
      coach_tree_json: result.coachTree,
      status: 'completed',
      updated_at: new Date().toISOString()
    }).eq('id', req.params.id).eq('user_id', req.user.id);
    if (upErr) throw upErr;
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/nsm-sessions/:id/gate
const NSM_GATE_MAX = 2000; // protect against runaway token cost
router.post('/:id/gate', requireAuth, async (req, res) => {
  const { nsm, rationale } = req.body;
  if (typeof nsm !== 'string' || typeof rationale !== 'string') return res.status(400).json({ error: 'invalid_body' });
  if (!nsm.trim() || !rationale.trim()) return res.status(400).json({ error: 'empty_body' });
  if (nsm.length > NSM_GATE_MAX || rationale.length > NSM_GATE_MAX) return res.status(400).json({ error: 'input_too_long' });
  const { data: session, error } = await db
    .from('nsm_sessions')
    .select('question_json')
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)
    .single();
  if (error || !session) return res.status(404).json({ error: 'not_found' });
  try {
    const result = await reviewNSMGate({
      question: session.question_json,
      nsm,
      rationale,
    });
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/nsm-sessions/:id/context
router.post('/:id/context', requireAuth, async (req, res) => {
  const { data: session, error } = await db
    .from('nsm_sessions')
    .select('question_json')
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)
    .single();
  if (error || !session) return res.status(404).json({ error: 'not_found' });
  try {
    const context = await generateNSMContext({ question_json: session.question_json });
    res.json(context);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH /api/nsm-sessions/:id/progress — auth sibling of guest variant.
// Requires migrations/2026-04-29-nsm-progress-json.sql.
router.patch('/:id/progress', requireAuth, async (req, res) => {
  const { currentStep, userNsm, userBreakdown, gateResult, progress } = req.body || {};
  const patch = {};
  if (userNsm       !== undefined) patch.user_nsm       = userNsm;
  if (userBreakdown !== undefined) patch.user_breakdown = userBreakdown;
  const merged = { ...(progress && typeof progress === 'object' ? progress : {}) };
  if (currentStep !== undefined) merged.currentStep = currentStep;
  if (gateResult  !== undefined) merged.gateResult  = gateResult;
  if (Object.keys(merged).length > 0) patch.progress_json = merged;
  if (Object.keys(patch).length === 0) return res.status(400).json({ error: 'nothing_to_update' });
  patch.updated_at = new Date().toISOString();

  const { data, error } = await db
    .from('nsm_sessions')
    .update(patch)
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)
    .select('id')
    .maybeSingle();
  if (error) {
    console.error('[nsm-sessions] PATCH /progress db error:', error);
    return res.status(500).json({ error: 'db_error' });
  }
  if (!data) return res.status(404).json({ error: 'not_found' });
  res.json({ ok: true });
});

// POST /api/nsm-sessions/:id/hints
router.post('/:id/hints', requireAuth, async (req, res) => {
  const { userNsm } = req.body;
  const { data: session, error } = await db
    .from('nsm_sessions')
    .select('question_json')
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)
    .single();
  if (error || !session) return res.status(404).json({ error: 'not_found' });
  try {
    const hints = await generateNSMHints({
      question_json: session.question_json,
      user_nsm: userNsm || '',
      product_type: guessProductType(session.question_json),
    });
    res.json(hints);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
