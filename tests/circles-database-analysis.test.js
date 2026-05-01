'use strict';

const fs = require('fs');
const path = require('path');

describe('circles_database.json analysis backfill', () => {
  const DB_PATH = path.join(__dirname, '..', 'circles_plan', 'circles_database.json');
  const questions = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));

  test('100/100 questions have populated analysis', () => {
    expect(questions.length).toBeGreaterThanOrEqual(100);
    const incomplete = questions.filter(function(q) {
      return !q.analysis ||
        !q.analysis.business || !String(q.analysis.business).trim() ||
        !q.analysis.users || !String(q.analysis.users).trim() ||
        !q.analysis.insight || !String(q.analysis.insight).trim();
    });
    if (incomplete.length > 0) {
      const ids = incomplete.map(function(q) { return q.id; }).join(', ');
      throw new Error('Incomplete analysis: ' + ids);
    }
    expect(incomplete).toHaveLength(0);
  });

  test('every question.analysis has 4 fields including traps fallback', () => {
    questions.forEach(function(q) {
      expect(q.analysis).toBeDefined();
      expect(typeof q.analysis.business).toBe('string');
      expect(typeof q.analysis.users).toBe('string');
      expect(typeof q.analysis.insight).toBe('string');
      // traps may come from analysis.traps OR fallback to common_wrong_directions
      const traps = q.analysis.traps || (q.common_wrong_directions || []).join('、');
      expect(typeof traps).toBe('string');
      expect(traps.length).toBeGreaterThan(0);
    });
  });

  test('derived public/circles-db.js is in sync (same 100 questions, same analysis content)', () => {
    const JS_PATH = path.join(__dirname, '..', 'public', 'circles-db.js');
    const jsSrc = fs.readFileSync(JS_PATH, 'utf8');
    const match = jsSrc.match(/var CIRCLES_QUESTIONS\s*=\s*(\[[\s\S]*\]);?\s*$/);
    expect(match).not.toBeNull();
    const jsQs = JSON.parse(match[1]);
    expect(jsQs.length).toBe(questions.length);
    // Verify analysis content matches for first/last/random sample
    const sample = [jsQs[0], jsQs[Math.floor(jsQs.length / 2)], jsQs[jsQs.length - 1]];
    sample.forEach(function(jq) {
      const json = questions.find(function(x) { return x.id === jq.id; });
      expect(json).toBeDefined();
      expect(jq.analysis && jq.analysis.business).toBeTruthy();
      expect(jq.analysis.business).toBe(json.analysis.business);
      expect(jq.analysis.users).toBe(json.analysis.users);
      expect(jq.analysis.insight).toBe(json.analysis.insight);
    });
  });
});
