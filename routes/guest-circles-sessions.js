const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const db = require('../db/client');
const { requireGuestId } = require('../middleware/guest');
const { reviewFramework } = require('../prompts/circles-gate');
const { streamCirclesReply } = require('../prompts/circles-coach');
const { evaluateCirclesStep } = require('../prompts/circles-evaluator');
const { checkConclusion } = require('../prompts/circles-conclusion-check');
const { generateFinalReport } = require('../prompts/circles-final-report');
const { generateCirclesHint } = require('../prompts/circles-hint');
const { generateCirclesExample } = require('../prompts/circles-example');

const QUESTION_BY_ID = Object.fromEntries(
  JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'circles_plan', 'circles_database.json'), 'utf8'))
    .map(q => [q.id, q])
);

// GET /api/guest-circles-sessions
router.get('/', requireGuestId, async (req, res) => {
  let query = db
    .from('circles_sessions')
    .select('id, question_id, question_json, mode, drill_step, current_phase, sim_step_index, status, step_scores, step_drafts, framework_draft, created_at, updated_at')
    .eq('guest_id', req.guestId)
    .order('updated_at', { ascending: false })
    .limit(Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 50));
  if (req.query.status) query = query.eq('status', req.query.status);
  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

// POST /api/guest-circles-sessions/draft — Lazy-create endpoint (Spec 2 § 3.1)
router.post('/draft', requireGuestId, async (req, res) => {
  const { question_id, mode, drill_step, sim_step_index } = req.body;
  if (!question_id || !mode) return res.status(400).json({ error: 'missing_fields' });
  const q = QUESTION_BY_ID[question_id];
  if (!q) return res.status(404).json({ error: 'question_not_found' });
  try {
    // Idempotency: if an active session already exists for this
    // (guest_id, question_id, mode, drill_step) tuple, return it instead of
    // creating a duplicate. Protects against parallel autosave races.
    let existingQuery = db
      .from('circles_sessions')
      .select('*')
      .eq('guest_id', req.guestId)
      .eq('question_id', question_id)
      .eq('mode', mode)
      .eq('status', 'active');
    existingQuery = drill_step
      ? existingQuery.eq('drill_step', drill_step)
      : existingQuery.is('drill_step', null);
    const { data: existing } = await existingQuery
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existing) return res.json(existing);

    const { data, error } = await db
      .from('circles_sessions')
      .insert({
        guest_id: req.guestId,
        question_id,
        question_json: q,
        mode,
        drill_step: drill_step || null,
        sim_step_index: sim_step_index || 0,
        current_phase: 1,
        status: 'active',
        step_drafts: {},
        framework_draft: {},
      })
      .select()
      .single();
    if (error) {
      // Race: another concurrent insert won. Re-read and return that row.
      let retryQuery = db
        .from('circles_sessions')
        .select('*')
        .eq('guest_id', req.guestId)
        .eq('question_id', question_id)
        .eq('mode', mode)
        .eq('status', 'active');
      retryQuery = drill_step
        ? retryQuery.eq('drill_step', drill_step)
        : retryQuery.is('drill_step', null);
      const { data: raced } = await retryQuery
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (raced) return res.json(raced);
      throw error;
    }
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/guest-circles-sessions
router.post('/', requireGuestId, async (req, res) => {
  const { questionId, questionJson, mode, drillStep } = req.body;
  if (!questionId || !questionJson || !mode) return res.status(400).json({ error: 'missing_fields' });
  try {
    const { data, error } = await db
      .from('circles_sessions')
      .insert({ guest_id: req.guestId, question_id: questionId, question_json: questionJson, mode, drill_step: drillStep || null })
      .select('id')
      .single();
    if (error) throw error;
    res.json({ sessionId: data.id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/guest-circles-sessions/:id
router.get('/:id', requireGuestId, async (req, res) => {
  const { data, error } = await db
    .from('circles_sessions')
    .select('*')
    .eq('id', req.params.id)
    .eq('guest_id', req.guestId)
    .single();
  if (error || !data) return res.status(404).json({ error: 'not_found' });
  res.json(data);
});

// DELETE /api/guest-circles-sessions/:id
router.delete('/:id', requireGuestId, async (req, res) => {
  const { data, error } = await db
    .from('circles_sessions')
    .delete()
    .eq('id', req.params.id)
    .eq('guest_id', req.guestId)
    .select('id')
    .single();
  if (error && error.code !== 'PGRST116') return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'not_found' });
  res.json({ ok: true });
});

// POST /api/guest-circles-sessions/:id/gate — Phase 1.5 AI review
router.post('/:id/gate', requireGuestId, async (req, res) => {
  const { frameworkDraft } = req.body;
  if (!frameworkDraft) return res.status(400).json({ error: 'missing frameworkDraft' });
  const { data: session, error } = await db
    .from('circles_sessions')
    .select('*')
    .eq('id', req.params.id)
    .eq('guest_id', req.guestId)
    .single();
  if (error || !session) return res.status(404).json({ error: 'not_found' });
  try {
    const gateResult = await reviewFramework({
      step: session.drill_step || 'C1',
      frameworkDraft,
      questionJson: session.question_json,
      mode: session.mode,
    });
    await db.from('circles_sessions').update({ framework_draft: frameworkDraft, gate_result: gateResult }).eq('id', req.params.id).eq('guest_id', req.guestId);
    res.json(gateResult);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/guest-circles-sessions/:id/message — Phase 2 SSE streaming
router.post('/:id/message', requireGuestId, async (req, res) => {
  const { userMessage } = req.body;
  if (!userMessage || typeof userMessage !== 'string' || !userMessage.trim()) {
    return res.status(400).json({ error: 'empty_user_message' });
  }
  const { data: session, error } = await db
    .from('circles_sessions')
    .select('*')
    .eq('id', req.params.id)
    .eq('guest_id', req.guestId)
    .single();
  if (error || !session) return res.status(404).json({ error: 'not_found' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  let fullText = '';
  try {
    for await (const chunk of streamCirclesReply(session, userMessage)) {
      fullText += chunk;
      res.write(`data: ${JSON.stringify({ delta: chunk })}\n\n`);
    }
    const interviewee = fullText.match(/【被訪談者】[ \t]*\r?\n([\s\S]*?)(?=【教練點評】|$)/)?.[1]?.trim() || '';
    const coaching   = fullText.match(/【教練點評】[ \t]*\r?\n([\s\S]*?)(?=【教練提示】|$)/)?.[1]?.trim() || '';
    const hint       = fullText.match(/【教練提示】[ \t]*\r?\n([\s\S]*?)$/)?.[1]?.trim() || '';
    // B1-1 guard: if model output is unparseable, surface a parse_failed
    // error instead of persisting an empty turn that looks like success.
    if (!interviewee && !coaching && !hint) {
      res.write('data: ' + JSON.stringify({ error: 'parse_failed', raw: fullText.slice(0, 500) }) + '\n\n');
      res.end();
      return;
    }
    const newTurn = { userMessage, interviewee, coaching, hint };
    const updated = [...(session.conversation || []), newTurn];
    await db.from('circles_sessions').update({ conversation: updated }).eq('id', req.params.id).eq('guest_id', req.guestId);
    res.write(`data: ${JSON.stringify({ done: true, turn: newTurn })}\n\n`);
    res.end();
  } catch (e) {
    res.write(`data: ${JSON.stringify({ error: e.message })}\n\n`);
    res.end();
  }
});

// POST /api/guest-circles-sessions/:id/evaluate-step
router.post('/:id/evaluate-step', requireGuestId, async (req, res) => {
  const { data: session, error } = await db
    .from('circles_sessions')
    .select('*')
    .eq('id', req.params.id)
    .eq('guest_id', req.guestId)
    .single();
  if (error || !session) return res.status(404).json({ error: 'not_found' });
  try {
    const result = await evaluateCirclesStep({
      step: session.drill_step || 'C1',
      frameworkDraft: session.framework_draft || {},
      conversation: session.conversation || [],
      questionJson: session.question_json,
      mode: session.mode,
    });
    const stepKey = session.drill_step || 'C1';
    const updatedScores = { ...(session.step_scores || {}), [stepKey]: result };
    // B4-1 — derive completion from server-side scores, not client step idx.
    const isLastStep = Object.keys(updatedScores).length === 7;
    await db.from('circles_sessions').update({
      step_scores: updatedScores,
      current_phase: 3,
      status: (session.mode === 'drill' || isLastStep) ? 'completed' : 'active',
    }).eq('id', req.params.id).eq('guest_id', req.guestId);
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/guest-circles-sessions/:id/conclusion-check
router.post('/:id/conclusion-check', requireGuestId, async (req, res) => {
  const { conclusionText } = req.body;
  if (!conclusionText || !conclusionText.trim()) return res.status(400).json({ error: 'missing_conclusion' });
  const { data: session, error } = await db
    .from('circles_sessions')
    .select('question_json, drill_step')
    .eq('id', req.params.id)
    .eq('guest_id', req.guestId)
    .single();
  if (error || !session) return res.status(404).json({ error: 'not_found' });
  try {
    const result = await checkConclusion(session.drill_step || 'C1', conclusionText, session.question_json);
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH /api/guest-circles-sessions/:id/progress
router.patch('/:id/progress', requireGuestId, async (req, res) => {
  const { currentPhase, simStepIndex, frameworkDraft, gateResult, stepDrafts } = req.body;
  const patch = {};
  if (currentPhase   !== undefined) patch.current_phase    = currentPhase;
  if (simStepIndex   !== undefined) patch.sim_step_index   = simStepIndex;
  if (frameworkDraft !== undefined) patch.framework_draft  = frameworkDraft;
  if (gateResult     !== undefined) patch.gate_result      = gateResult;
  // B2-2 — shallow-merge step_drafts (see auth variant for rationale).
  if (stepDrafts !== undefined) {
    if (stepDrafts && typeof stepDrafts === 'object' && !Array.isArray(stepDrafts)) {
      const { data: prior } = await db
        .from('circles_sessions')
        .select('step_drafts')
        .eq('id', req.params.id)
        .eq('guest_id', req.guestId)
        .maybeSingle();
      patch.step_drafts = { ...(prior?.step_drafts || {}), ...stepDrafts };
    } else {
      patch.step_drafts = stepDrafts;
    }
  }
  if (Object.keys(patch).length === 0) return res.status(400).json({ error: 'nothing_to_update' });

  // Chain .select() so Supabase reports the affected row. If 0 rows match
  // (wrong owner / wrong id), data will be null — return 404 to avoid
  // tenant enumeration.
  const { data, error } = await db
    .from('circles_sessions')
    .update(patch)
    .eq('id', req.params.id)
    .eq('guest_id', req.guestId)
    .select('id')
    .maybeSingle();
  if (error) {
    console.error('[guest-circles-sessions] PATCH /progress db error:', error);
    return res.status(500).json({ error: 'db_error' });
  }
  if (!data) return res.status(404).json({ error: 'not_found' });
  res.json({ ok: true });
});

// POST /api/guest-circles-sessions/:id/final-report
router.post('/:id/final-report', requireGuestId, async (req, res) => {
  // NOTE: `final_report` column does not exist in the live circles_sessions
  // schema, so we don't SELECT or persist it here — final report is
  // re-computed on every call. Use .maybeSingle() so we can distinguish
  // "row not found" (404) from a real DB error (500).
  const { data: session, error } = await db
    .from('circles_sessions')
    .select('question_json, step_scores')
    .eq('id', req.params.id)
    .eq('guest_id', req.guestId)
    .maybeSingle();
  if (error) {
    console.error('[guest-circles-sessions] POST /final-report db error:', error);
    return res.status(500).json({ error: 'db_error' });
  }
  if (!session) return res.status(404).json({ error: 'not_found' });
  if (!session.step_scores || Object.keys(session.step_scores).length < 7) {
    return res.status(400).json({ error: 'incomplete_steps' });
  }
  try {
    const report = await generateFinalReport({
      stepScores: session.step_scores,
      questionJson: session.question_json,
    });
    await db.from('circles_sessions').update({
      status: 'completed',
    }).eq('id', req.params.id).eq('guest_id', req.guestId);
    res.json(report);
  } catch (e) {
    console.error('[guest-circles-sessions] POST /final-report generation error:', e);
    res.status(500).json({ error: 'report_generation_failed' });
  }
});

// POST /api/guest/circles-sessions/:id/hint
const ALLOWED_STEPS = ['C1', 'I', 'R', 'C2', 'L', 'E', 'S'];
const FIELD_MAX_LEN = 40;
router.post('/:id/hint', requireGuestId, async (req, res) => {
  const { step, field } = req.body;
  if (!step || !field) return res.status(400).json({ error: 'missing_step_or_field' });
  if (!ALLOWED_STEPS.includes(step)) return res.status(400).json({ error: 'invalid_step' });
  if (typeof field !== 'string' || field.length > FIELD_MAX_LEN) return res.status(400).json({ error: 'invalid_field' });
  const { data: session, error } = await db
    .from('circles_sessions')
    .select('question_json')
    .eq('id', req.params.id)
    .eq('guest_id', req.guestId)
    .single();
  if (error || !session) return res.status(404).json({ error: 'not_found' });
  try {
    const hint = await generateCirclesHint({ step, field, questionJson: session.question_json });
    res.json({ hint });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/guest/circles-sessions/:id/example
router.post('/:id/example', requireGuestId, async (req, res) => {
  const { step, field } = req.body;
  if (!step || !field) return res.status(400).json({ error: 'missing_step_or_field' });
  if (!ALLOWED_STEPS.includes(step)) return res.status(400).json({ error: 'invalid_step' });
  if (typeof field !== 'string' || field.length > FIELD_MAX_LEN) return res.status(400).json({ error: 'invalid_field' });
  const { data: session, error } = await db
    .from('circles_sessions')
    .select('question_json')
    .eq('id', req.params.id)
    .eq('guest_id', req.guestId)
    .single();
  if (error || !session) return res.status(404).json({ error: 'not_found' });
  try {
    const example = await generateCirclesExample({ step, field, questionJson: session.question_json });
    res.json({ example });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
