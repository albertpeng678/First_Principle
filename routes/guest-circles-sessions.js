const express = require('express');
const router = express.Router();
const db = require('../db/client');
const { requireGuestId } = require('../middleware/guest');
const { reviewFramework } = require('../prompts/circles-gate');
const { streamCirclesReply } = require('../prompts/circles-coach');
const { evaluateCirclesStep } = require('../prompts/circles-evaluator');
const { checkConclusion } = require('../prompts/circles-conclusion-check');
const { generateFinalReport } = require('../prompts/circles-final-report');
const { generateCirclesHint } = require('../prompts/circles-hint');
const { generateCirclesExample } = require('../prompts/circles-example');

// GET /api/guest-circles-sessions
router.get('/', requireGuestId, async (req, res) => {
  let query = db
    .from('circles_sessions')
    .select('id, question_id, question_json, mode, drill_step, current_phase, sim_step_index, status, step_scores, step_drafts, created_at, updated_at')
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
  try {
    const { data, error } = await db
      .from('circles_sessions')
      .insert({
        guest_id: req.guestId,
        question_id,
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
    if (error) throw error;
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
  if (!userMessage) return res.status(400).json({ error: 'missing userMessage' });
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
    const interviewee = fullText.match(/【被訪談者】\n([\s\S]*?)(?=【教練點評】|$)/)?.[1]?.trim() || '';
    const coaching   = fullText.match(/【教練點評】\n([\s\S]*?)(?=【教練提示】|$)/)?.[1]?.trim() || '';
    const hint       = fullText.match(/【教練提示】\n([\s\S]*?)$/)?.[1]?.trim() || '';
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
    const isLastStep = session.sim_step_index === 6;
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
  if (stepDrafts     !== undefined) patch.step_drafts      = stepDrafts;
  if (Object.keys(patch).length === 0) return res.status(400).json({ error: 'nothing_to_update' });

  const { error } = await db
    .from('circles_sessions')
    .update(patch)
    .eq('id', req.params.id)
    .eq('guest_id', req.guestId);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

// POST /api/guest-circles-sessions/:id/final-report
router.post('/:id/final-report', requireGuestId, async (req, res) => {
  const { data: session, error } = await db
    .from('circles_sessions')
    .select('question_json, step_scores, final_report')
    .eq('id', req.params.id)
    .eq('guest_id', req.guestId)
    .single();
  if (error || !session) return res.status(404).json({ error: 'not_found' });
  if (session.final_report) return res.json(session.final_report);
  if (!session.step_scores || Object.keys(session.step_scores).length < 7) {
    return res.status(400).json({ error: 'incomplete_steps' });
  }
  try {
    const report = await generateFinalReport({
      stepScores: session.step_scores,
      questionJson: session.question_json,
    });
    await db.from('circles_sessions').update({
      final_report: report,
      status: 'completed',
    }).eq('id', req.params.id).eq('guest_id', req.guestId);
    res.json(report);
  } catch (e) { res.status(500).json({ error: 'report_generation_failed' }); }
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
