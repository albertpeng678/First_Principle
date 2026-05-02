'use strict';

// Q3 contract test: server-side AI prompts must use session.question_json snapshot,
// NEVER fresh DB lookup by question_id. This guards against a future regression
// where someone "optimizes" by re-fetching from the question bank.

const fs = require('fs');
const path = require('path');

describe('Q3 — server-side prompts use session.question_json (not current DB)', () => {
  const PROMPT_FILES = [
    'prompts/circles-evaluator.js',
    'prompts/circles-gate.js',
    'prompts/circles-coach.js',
    'prompts/circles-hint.js',
    'prompts/circles-conclusion-check.js',
    'prompts/circles-final-report.js'
  ];

  test('no prompt file imports circles_database.json directly for runtime use', () => {
    PROMPT_FILES.forEach(function(file) {
      const fullPath = path.join(__dirname, '..', file);
      if (!fs.existsSync(fullPath)) return;  // optional file
      const content = fs.readFileSync(fullPath, 'utf8');
      // Allow require for dev-time test fixtures, but NOT runtime question lookup
      const hasRuntimeLookup = /QUESTION_BY_ID\s*\[|questions\.find\(/.test(content) ||
        /circles_database\.json[^.]*find/.test(content);
      if (hasRuntimeLookup) {
        throw new Error(file + ' performs runtime DB lookup — must use session.question_json instead');
      }
    });
  });

  test('routes pass question_json from session record to prompt builders', () => {
    const ROUTES = ['routes/circles-sessions.js', 'routes/guest-circles-sessions.js'];
    ROUTES.forEach(function(file) {
      const fullPath = path.join(__dirname, '..', file);
      if (!fs.existsSync(fullPath)) return;
      const content = fs.readFileSync(fullPath, 'utf8');
      // Heuristic: route handlers fetching session must reference question_json field
      expect(content).toMatch(/question_json/);
    });
  });
});
