'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

describe('NSM_QUESTIONS extracted to public/nsm-db.js', () => {
  const NSM_DB_PATH = path.join(__dirname, '..', 'public', 'nsm-db.js');
  const APP_PATH = path.join(__dirname, '..', 'public', 'app.js');

  test('public/nsm-db.js exists and exposes window.NSM_QUESTIONS with 103 entries', () => {
    expect(fs.existsSync(NSM_DB_PATH)).toBe(true);
    const src = fs.readFileSync(NSM_DB_PATH, 'utf8');
    const sandbox = { window: {} };
    vm.createContext(sandbox);
    vm.runInContext(src, sandbox);
    expect(Array.isArray(sandbox.window.NSM_QUESTIONS)).toBe(true);
    expect(sandbox.window.NSM_QUESTIONS.length).toBe(103);
  });

  test('every NSM question has core fields id/company/industry/scenario/coach_nsm/anti_patterns', () => {
    const src = fs.readFileSync(NSM_DB_PATH, 'utf8');
    const sandbox = { window: {} };
    vm.createContext(sandbox);
    vm.runInContext(src, sandbox);
    sandbox.window.NSM_QUESTIONS.forEach(q => {
      expect(typeof q.id).toBe('string');
      expect(typeof q.company).toBe('string');
      expect(typeof q.industry).toBe('string');
      expect(typeof q.scenario).toBe('string');
      expect(typeof q.coach_nsm).toBe('string');
      expect(Array.isArray(q.anti_patterns)).toBe(true);
    });
  });

  test('public/app.js no longer embeds the 103-element NSM_QUESTIONS literal', () => {
    const src = fs.readFileSync(APP_PATH, 'utf8');
    // 應該只有一處宣告，且為 fallback 形式（讀 window.NSM_QUESTIONS）
    expect(src).toMatch(/(?:var|const|let)\s+NSM_QUESTIONS\s*=/);
    expect(src).toMatch(/window\.NSM_QUESTIONS/);
    // 不應再出現 100+ 條 id:'qN' 內嵌定義
    const inlineMatches = src.match(/id\s*:\s*['"]q\d+['"]/g) || [];
    expect(inlineMatches.length).toBeLessThan(10);
  });
});
