const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const vm = require('vm');
const { generateNSMStep2Hint } = require('../prompts/nsm-step2-hint');

// Load NSM question bank once at startup.
// nsm-db.js uses browser-style window.NSM_QUESTIONS assignment, so use vm to eval it.
function loadQuestions() {
  const src = fs.readFileSync(path.join(__dirname, '..', 'public', 'nsm-db.js'), 'utf8');
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  return sandbox.window.NSM_QUESTIONS || [];
}
const QUESTIONS = loadQuestions();
const QUESTION_BY_ID = Object.fromEntries(QUESTIONS.map(q => [q.id, q]));

// Field whitelist matches NSM Step 2's 3 input fields (mockup 07 Section A)
const ALLOWED_FIELDS = ['nsm', 'explanation', 'businessLink'];
const USER_DRAFT_MAX = 200;

// POST /api/nsm-public/step2-hint — session-less AI hint for NSM Step 2 fields
router.post('/step2-hint', async (req, res) => {
  const { questionId, field, userDraft } = req.body || {};

  if (!questionId || typeof questionId !== 'string') {
    return res.status(400).json({ error: 'missing_questionId' });
  }
  if (!ALLOWED_FIELDS.includes(field)) {
    return res.status(400).json({ error: 'invalid_field' });
  }

  const q = QUESTION_BY_ID[questionId];
  if (!q) {
    return res.status(404).json({ error: 'question_not_found' });
  }

  const draft = (typeof userDraft === 'string' ? userDraft : '').slice(0, USER_DRAFT_MAX);

  try {
    const hint = await generateNSMStep2Hint({ questionJson: q, field, userDraft: draft });
    return res.json({ hint });
  } catch (e) {
    return res.status(500).json({ error: 'hint_generation_failed', message: e.message });
  }
});

module.exports = router;
