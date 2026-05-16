const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const db = require('../db/client');
const { requireAuth } = require('../middleware/auth');
const { reviewFramework } = require('../prompts/circles-gate');
const { streamCirclesReply } = require('../prompts/circles-coach');
const { runEvaluateStep, EvaluatorError } = require('../lib/evaluate-step-handler');
const { checkConclusion } = require('../prompts/circles-conclusion-check');
const { generateFinalReport } = require('../prompts/circles-final-report');
const { generateCirclesHint } = require('../prompts/circles-hint');
const { generateCirclesExample } = require('../prompts/circles-example');
const { rehydrateMany, rehydrateQuestionJson } = require('../lib/session-rehydrate');
const cache = require('../lib/session-cache');
const { dedupSessions } = require('../lib/session-dedup');
const { computeLifecycle } = require('../lib/session-lifecycle');

const CACHE_KIND = 'circles-auth';

const QUESTION_BY_ID = Object.fromEntries(
  JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'circles_plan', 'circles_database.json'), 'utf8'))
    .map(q => [q.id, q])
);

// POST /api/circles-sessions
router.post('/', requireAuth, async (req, res) => {
  const { questionId, questionJson, mode, drillStep } = req.body;
  if (!questionId || !questionJson || !mode) return res.status(400).json({ error: 'missing_fields' });
  try {
    const { data, error } = await db
      .from('circles_sessions')
      .insert({ user_id: req.user.id, question_id: questionId, question_json: questionJson, mode, drill_step: drillStep || null })
      .select('id')
      .single();
    if (error) throw error;
    cache.invalidate(CACHE_KIND, req.user.id);
    res.json({ sessionId: data.id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/circles-sessions/draft — Lazy-create endpoint (Spec 2 § 3.1)
// Used by Phase 1 auto-save to mint an active session on first textarea input.
// Returns the inserted row (not just `{ sessionId }`) so the front-end can
// hydrate AppState.circlesSession in one round-trip.
router.post('/draft', requireAuth, async (req, res) => {
  const { question_id, mode, drill_step, sim_step_index } = req.body;
  if (!question_id || !mode) return res.status(400).json({ error: 'missing_fields' });
  const q = QUESTION_BY_ID[question_id];
  if (!q) return res.status(404).json({ error: 'question_not_found' });
  try {
    // Idempotency: see guest-circles-sessions.js draft endpoint.
    let existingQuery = db
      .from('circles_sessions')
      .select('*')
      .eq('user_id', req.user.id)
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
        user_id: req.user.id,
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
      let retryQuery = db
        .from('circles_sessions')
        .select('*')
        .eq('user_id', req.user.id)
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
    cache.invalidate(CACHE_KIND, req.user.id);
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/circles-sessions
router.get('/', requireAuth, async (req, res) => {
  const owner = req.user.id;

  // Operator gate for include_empty flag (SLC-AC13/AC14)
  const wantsEmpty = req.query.include_empty === 'true';
  const isOperator = (req.user.email || '').toLowerCase() === (process.env.OPERATOR_EMAIL || '').toLowerCase();
  if (wantsEmpty && !isOperator) {
    return res.status(403).json({ error: 'forbidden' });
  }

  // Cache only for default (no filter, no include_empty) requests to keep invalidation simple.
  if (!req.query.status && !req.query.limit && !wantsEmpty) {
    const cached = cache.get(CACHE_KIND, owner);
    if (cached) return res.json(cached);
  }

  let query = db
    .from('circles_sessions')
    .select('id, question_id, question_json, mode, drill_step, current_phase, sim_step_index, status, step_scores, step_drafts, framework_draft, lifecycle, created_at, updated_at')
    .eq('user_id', owner)
    .order('updated_at', { ascending: false })
    .limit(Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 50));
  if (req.query.status) query = query.eq('status', req.query.status);
  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  // Default-exclude lifecycle='created' rows; operator with include_empty=true sees all.
  const rows = wantsEmpty ? (data || []) : (data || []).filter(r => r.lifecycle !== 'created');
  const deduped = dedupSessions(rows);
  const enriched = rehydrateMany(
    deduped.map(d => ({ ...d, currentQuestion: QUESTION_BY_ID[d.question_id] || null })),
    'circles'
  );
  if (!req.query.status && !req.query.limit && !wantsEmpty) {
    cache.set(CACHE_KIND, owner, enriched);
  }
  res.json(enriched);
});

// GET /api/circles-sessions/:id
router.get('/:id', requireAuth, async (req, res) => {
  const { data, error } = await db
    .from('circles_sessions')
    .select('*')
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)
    .single();
  if (error || !data) return res.status(404).json({ error: 'not_found' });
  data.currentQuestion = QUESTION_BY_ID[data.question_id] || null;
  res.json(rehydrateQuestionJson(data, 'circles'));
});

// DELETE /api/circles-sessions/:id
router.delete('/:id', requireAuth, async (req, res) => {
  const { data, error } = await db
    .from('circles_sessions')
    .delete()
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)
    .select('id')
    .single();
  if (error && error.code !== 'PGRST116') return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'not_found' });
  cache.invalidate(CACHE_KIND, req.user.id);
  res.json({ ok: true });
});

// POST /api/circles-sessions/:id/gate — Phase 1.5 AI review
router.post('/:id/gate', requireAuth, async (req, res) => {
  const { frameworkDraft } = req.body;
  if (!frameworkDraft) return res.status(400).json({ error: 'missing frameworkDraft' });
  const { data: session, error } = await db
    .from('circles_sessions')
    .select('*')
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)
    .single();
  if (error || !session) return res.status(404).json({ error: 'not_found' });
  try {
    const gateResult = await reviewFramework({
      step: session.drill_step || 'C1',
      frameworkDraft,
      questionJson: session.question_json,
      mode: session.mode,
    });
    const route = gateResult && gateResult.canProceed && (gateResult.overallStatus === 'ok' || gateResult.overallStatus === 'warn') ? 'gate_ok' : 'gate_fail';
    const nextLifecycle = computeLifecycle(session, { frameworkDraft }, 'circles', route);
    await db.from('circles_sessions').update({ framework_draft: frameworkDraft, gate_result: gateResult, lifecycle: nextLifecycle }).eq('id', req.params.id).eq('user_id', req.user.id);
    res.json(gateResult);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/circles-sessions/:id/message — Phase 2 SSE streaming
router.post('/:id/message', requireAuth, async (req, res) => {
  const { userMessage } = req.body;
  if (!userMessage || typeof userMessage !== 'string' || !userMessage.trim()) {
    return res.status(400).json({ error: 'empty_user_message' });
  }
  const { data: session, error } = await db
    .from('circles_sessions')
    .select('*')
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)
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

    // Parse 3-role reply
    const interviewee = fullText.match(/【被訪談者】[ \t]*\r?\n([\s\S]*?)(?=【教練點評】|$)/)?.[1]?.trim() || '';
    const coaching   = fullText.match(/【教練點評】[ \t]*\r?\n([\s\S]*?)(?=【教練提示】|$)/)?.[1]?.trim() || '';
    const hint       = fullText.match(/【教練提示】[ \t]*\r?\n([\s\S]*?)$/)?.[1]?.trim() || '';

    // B1-1 guard: if model output is unparseable (no 【...】 markers at all),
    // surface a parse_failed error instead of persisting an empty turn that
    // looks like a silent success on the client.
    if (!interviewee && !coaching && !hint) {
      res.write('data: ' + JSON.stringify({ error: 'parse_failed', raw: fullText.slice(0, 500) }) + '\n\n');
      res.end();
      return;
    }

    const newTurn = { userMessage, interviewee, coaching, hint };
    const updated = [...(session.conversation || []), newTurn];
    await db.from('circles_sessions').update({ conversation: updated }).eq('id', req.params.id).eq('user_id', req.user.id);

    res.write(`data: ${JSON.stringify({ done: true, turn: newTurn })}\n\n`);
    res.end();
  } catch (e) {
    res.write(`data: ${JSON.stringify({ error: e.message })}\n\n`);
    res.end();
  }
});

// POST /api/circles-sessions/:id/evaluate-step
router.post('/:id/evaluate-step', requireAuth, async (req, res) => {
  const { data: session, error } = await db
    .from('circles_sessions')
    .select('*')
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)
    .single();
  if (error || !session) return res.status(404).json({ error: 'not_found' });
  try {
    const { result } = await runEvaluateStep({
      session,
      supabase: db,
      ownerFilter: (q) => q.eq('user_id', req.user.id),
    });
    res.json(result);
  } catch (err) {
    if (err instanceof EvaluatorError) return res.status(err.status).json({ error: err.message, code: err.code });
    res.status(500).json({ error: (err && err.message) || 'unknown_error' });
  }
});

// POST /api/circles-sessions/:id/conclusion-check
router.post('/:id/conclusion-check', requireAuth, async (req, res) => {
  const { conclusionText } = req.body;
  if (!conclusionText || !conclusionText.trim()) return res.status(400).json({ error: 'missing_conclusion' });
  const { data: session, error } = await db
    .from('circles_sessions')
    .select('question_json, drill_step')
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)
    .single();
  if (error || !session) return res.status(404).json({ error: 'not_found' });
  try {
    const result = await checkConclusion(session.drill_step || 'C1', conclusionText, session.question_json);
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH /api/circles-sessions/:id/progress — save phase/step without AI call
// Called on every phase transition so the session can be resumed after page close.
// Block 2: also accepts phase2ConclusionDraft → stored in progress_json.
router.patch('/:id/progress', requireAuth, async (req, res) => {
  // Strip FE-supplied lifecycle — server always computes it (SLC-AC10)
  delete req.body.lifecycle;
  const { currentPhase, simStepIndex, frameworkDraft, gateResult, stepDrafts, phase2ConclusionDraft } = req.body;
  const patch = {};
  let priorSession = { lifecycle: 'created' }; // default; overwritten by fetches below
  let lifecycleFetched = false;

  if (currentPhase   !== undefined) patch.current_phase    = currentPhase;
  if (simStepIndex   !== undefined) patch.sim_step_index   = simStepIndex;
  if (frameworkDraft !== undefined) patch.framework_draft  = frameworkDraft;
  if (gateResult     !== undefined) patch.gate_result      = gateResult;
  // Persist free-form UI state in progress_json (shallow-merge to preserve sibling keys)
  if (phase2ConclusionDraft !== undefined) {
    const { data: prior } = await db
      .from('circles_sessions')
      .select('progress_json, lifecycle')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .maybeSingle();
    const existingPj = (prior && prior.progress_json) || {};
    patch.progress_json = { ...existingPj, phase2ConclusionDraft };
    if (prior) priorSession = prior;
    lifecycleFetched = true;
  }
  // B2-2 — shallow-merge step_drafts so two tabs each editing a different
  // step key don't last-write-wins each other's keys. Read-modify-write is
  // protected by the (id, user_id) ownership guard.
  if (stepDrafts !== undefined) {
    if (stepDrafts && typeof stepDrafts === 'object' && !Array.isArray(stepDrafts)) {
      const { data: prior } = await db
        .from('circles_sessions')
        .select('step_drafts, lifecycle')
        .eq('id', req.params.id)
        .eq('user_id', req.user.id)
        .maybeSingle();
      patch.step_drafts = { ...(prior?.step_drafts || {}), ...stepDrafts };
      if (prior && !lifecycleFetched) priorSession = prior;
      lifecycleFetched = true;
    } else {
      patch.step_drafts = stepDrafts;
    }
  }
  // When frameworkDraft is present but no other DB read has captured lifecycle,
  // do a targeted lifecycle fetch for the monotone promotion check (SLC-AC5/AC9).
  if (frameworkDraft !== undefined && !lifecycleFetched) {
    const { data: prior } = await db
      .from('circles_sessions')
      .select('lifecycle')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .maybeSingle();
    if (prior) priorSession = prior;
  }
  // Compute next lifecycle from content in req.body (monotone — never demotes)
  const nextLifecycle = computeLifecycle(priorSession, req.body, 'circles', 'patch');
  const currentLc = priorSession.lifecycle || 'created';
  if (nextLifecycle !== currentLc) patch.lifecycle = nextLifecycle;

  if (Object.keys(patch).length === 0) return res.status(400).json({ error: 'nothing_to_update' });

  const { data, error } = await db
    .from('circles_sessions')
    .update(patch)
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)
    .select('id')
    .maybeSingle();
  if (error) {
    console.error('[circles-sessions] PATCH /progress db error:', error);
    return res.status(500).json({ error: 'db_error' });
  }
  if (!data) return res.status(404).json({ error: 'not_found' });
  cache.invalidate(CACHE_KIND, req.user.id);
  res.json({ ok: true });
});

// POST /api/circles-sessions/:id/final-report
router.post('/:id/final-report', requireAuth, async (req, res) => {
  // NOTE: `final_report` column does not exist in the live circles_sessions
  // schema, so we don't SELECT or persist it here — final report is
  // re-computed on every call. Mirror of guest variant.
  const { data: session, error } = await db
    .from('circles_sessions')
    .select('question_json, step_scores, lifecycle')
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)
    .maybeSingle();
  if (error) {
    console.error('[circles-sessions] POST /final-report db error:', error);
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
    const nextLifecycle = computeLifecycle(session, {}, 'circles', 'analysis_done');
    await db.from('circles_sessions').update({
      status: 'completed',
      lifecycle: nextLifecycle,
    }).eq('id', req.params.id).eq('user_id', req.user.id);
    cache.invalidate(CACHE_KIND, req.user.id);
    res.json(report);
  } catch (e) {
    console.error('[circles-sessions] POST /final-report generation error:', e);
    res.status(500).json({ error: 'report_generation_failed' });
  }
});

// POST /api/circles-sessions/:id/hint
const ALLOWED_STEPS = ['C1', 'I', 'R', 'C2', 'L', 'E', 'S'];
const FIELD_MAX_LEN = 40;
router.post('/:id/hint', requireAuth, async (req, res) => {
  const { step, field } = req.body;
  if (!step || !field) return res.status(400).json({ error: 'missing_step_or_field' });
  if (!ALLOWED_STEPS.includes(step)) return res.status(400).json({ error: 'invalid_step' });
  if (typeof field !== 'string' || field.length > FIELD_MAX_LEN) return res.status(400).json({ error: 'invalid_field' });
  const { data: session, error } = await db
    .from('circles_sessions')
    .select('question_json')
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)
    .single();
  if (error || !session) return res.status(404).json({ error: 'not_found' });
  try {
    const hint = await generateCirclesHint({ step, field, questionJson: session.question_json });
    res.json({ hint });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/circles-sessions/:id/example
router.post('/:id/example', requireAuth, async (req, res) => {
  const { step, field } = req.body;
  if (!step || !field) return res.status(400).json({ error: 'missing_step_or_field' });
  if (!ALLOWED_STEPS.includes(step)) return res.status(400).json({ error: 'invalid_step' });
  if (typeof field !== 'string' || field.length > FIELD_MAX_LEN) return res.status(400).json({ error: 'invalid_field' });
  const { data: session, error } = await db
    .from('circles_sessions')
    .select('question_json')
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)
    .single();
  if (error || !session) return res.status(404).json({ error: 'not_found' });
  try {
    const example = await generateCirclesExample({ step, field, questionJson: session.question_json });
    res.json({ example });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
