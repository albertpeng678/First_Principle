// tests/adversarial/circles-evaluator.spec.js
// Adversarial spec for Phase 3 step score evaluator.
// Garbage input → totalScore ≤ 40 (avg dim ≤ 2/5).

const { test, expect } = require('@playwright/test');
const { QUESTION, ADVERSARIAL_CASES } = require('./helper');
const { evaluateCirclesStep } = require('../../prompts/circles-evaluator');

test.describe('Adversarial — circles-evaluator Phase 3 step', () => {
  test.describe.configure({ mode: 'serial' });

  for (const c of ADVERSARIAL_CASES) {
    test(`[${c.id}] garbage → low totalScore (or borderline → passable)`, async () => {
      test.setTimeout(120_000); // evaluator is slower than gate
      const draft = c.perFieldInputs || {
        '問題範圍':  c.input,
        '時間範圍':  c.input,
        '業務影響':  c.input,
        '假設確認':  c.input,
      };
      const result = await evaluateCirclesStep({
        step: 'C1',
        frameworkDraft: draft,
        conversation: [],
        questionJson: QUESTION,
        mode: 'drill',
      });
      console.log(`[${c.id}] totalScore=${result.totalScore} dims=${JSON.stringify((result.dimensions||[]).map(d=>({name:d.name,score:d.score})))}`);
      if (c.expectMinSeverity === 'ok') {
        // borderline-ok: real but concise — expect a passable score
        expect(result.totalScore, `borderline got ${result.totalScore}, want ≥ 40`).toBeGreaterThanOrEqual(40);
      } else {
        // garbage: expect very low score
        expect(result.totalScore, `${c.id} got ${result.totalScore}, want ≤ 40`).toBeLessThanOrEqual(40);
      }
    });
  }
});
