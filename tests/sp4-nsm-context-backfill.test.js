'use strict';

const path = require('path');
const fs = require('fs');

describe('scripts/backfill-nsm-context.js', () => {
  const SCRIPT_PATH = path.join(__dirname, '..', 'scripts', 'backfill-nsm-context.js');

  test('script file exists', () => {
    expect(fs.existsSync(SCRIPT_PATH)).toBe(true);
  });

  test('exposes isContextComplete + loadQuestions + saveQuestions for testability', () => {
    const mod = require(SCRIPT_PATH);
    expect(typeof mod.isContextComplete).toBe('function');
    expect(typeof mod.loadQuestions).toBe('function');
    expect(typeof mod.saveQuestions).toBe('function');
  });

  test('isContextComplete returns true only when all 4 fields present and non-empty', () => {
    const { isContextComplete } = require(SCRIPT_PATH);
    expect(isContextComplete({})).toBe(false);
    expect(isContextComplete({ context: {} })).toBe(false);
    expect(isContextComplete({ context: { model: 'a', users: 'b', traps: 'c' } })).toBe(false);
    expect(isContextComplete({ context: { model: 'a', users: 'b', traps: 'c', insight: '' } })).toBe(false);
    expect(isContextComplete({ context: { model: 'a', users: 'b', traps: 'c', insight: '   ' } })).toBe(false);
    expect(isContextComplete({ context: { model: 'a', users: 'b', traps: 'c', insight: 'd' } })).toBe(true);
  });

  test('loadQuestions reads public/nsm-db.js and returns array of 103', () => {
    const { loadQuestions } = require(SCRIPT_PATH);
    const qs = loadQuestions();
    expect(Array.isArray(qs)).toBe(true);
    expect(qs.length).toBe(103);
  });

  test('saveQuestions roundtrip preserves length and id order', () => {
    const { loadQuestions, saveQuestions } = require(SCRIPT_PATH);
    const original = loadQuestions();
    saveQuestions(original);
    const reloaded = loadQuestions();
    expect(reloaded.length).toBe(original.length);
    expect(reloaded.map(q => q.id)).toEqual(original.map(q => q.id));
  });
});
