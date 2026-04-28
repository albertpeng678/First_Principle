const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { generateCirclesHint } = require('../prompts/circles-hint');

// Load question bank once at startup. Source of truth = circles_plan/circles_database.json.
const QUESTIONS = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'circles_plan', 'circles_database.json'), 'utf8')
);
const QUESTION_BY_ID = Object.fromEntries(QUESTIONS.map(q => [q.id, q]));

const ALLOWED_STEPS = ['C1', 'I', 'R', 'C2', 'L', 'E', 'S'];
const FIELD_MAX_LEN = 40;

function lookupQuestion(req, res) {
  const { questionId } = req.body;
  if (!questionId || typeof questionId !== 'string') {
    res.status(400).json({ error: 'missing_questionId' });
    return null;
  }
  const q = QUESTION_BY_ID[questionId];
  if (!q) {
    res.status(404).json({ error: 'question_not_found' });
    return null;
  }
  return q;
}

function validateStepField(req, res) {
  const { step, field } = req.body;
  if (!step || !field) {
    res.status(400).json({ error: 'missing_step_or_field' });
    return false;
  }
  if (!ALLOWED_STEPS.includes(step)) {
    res.status(400).json({ error: 'invalid_step' });
    return false;
  }
  if (typeof field !== 'string' || field.length > FIELD_MAX_LEN) {
    res.status(400).json({ error: 'invalid_field' });
    return false;
  }
  return true;
}

// POST /api/circles-public/hint  — session-less AI hint
router.post('/hint', async (req, res) => {
  if (!validateStepField(req, res)) return;
  const question = lookupQuestion(req, res);
  if (!question) return;
  try {
    const hint = await generateCirclesHint({
      step: req.body.step,
      field: req.body.field,
      questionJson: question,
    });
    res.json({ hint });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/circles-public/all-examples  — dump all curated examples for review tool
router.get('/all-examples', (req, res) => {
  res.json(QUESTIONS.map(q => ({
    id: q.id,
    company: q.company,
    product: q.product,
    problem_statement: q.problem_statement,
    field_examples: q.field_examples || null,
  })));
});

// POST /api/circles-public/example  — curated good-answer example from JSON
router.post('/example', (req, res) => {
  if (!validateStepField(req, res)) return;
  const question = lookupQuestion(req, res);
  if (!question) return;
  const stepExamples = (question.field_examples || {})[req.body.step] || {};
  const example = stepExamples[req.body.field];
  if (!example) return res.status(404).json({ error: 'example_not_curated' });
  res.json({ example });
});

module.exports = router;
