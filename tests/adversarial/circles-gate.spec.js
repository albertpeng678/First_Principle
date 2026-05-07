// tests/adversarial/circles-gate.spec.js
// Adversarial RED spec — verifies circles-gate AI rejects garbage input.
// Hits real OpenAI (gpt-4o). Cost ~ $0.10 per run.

const { test, expect } = require('@playwright/test');
const { QUESTION, ADVERSARIAL_CASES, meetsExpectation } = require('./helper');
const { reviewFramework } = require('../../prompts/circles-gate');

test.describe('Adversarial — circles-gate Phase 1.5', () => {
  // No serial mode — we want all 10 cases to run independently even if some fail.
  // This gives us the full 10-cell baseline matrix in RED state.

  for (const c of ADVERSARIAL_CASES) {
    test(`[${c.id}] should produce status meeting min severity "${c.expectMinSeverity}"`, async () => {
      test.setTimeout(60_000); // OpenAI calls can be slow
      const draft = {
        '問題範圍':  c.input,
        '時間範圍':  c.input,
        '業務影響':  c.input,
        '假設確認':  c.input,
      };
      const result = await reviewFramework({
        step: 'C1',
        frameworkDraft: draft,
        questionJson: QUESTION,
        mode: 'drill',
      });
      // Log full result so the audit doc has raw evidence
      console.log(`[${c.id}] overallStatus=${result.overallStatus} canProceed=${result.canProceed} items=${JSON.stringify(result.items?.map(i => ({ field: i.field, status: i.status, title: i.title })) || [])}`);
      if (c.expectMinSeverity === 'ok') {
        // borderline-ok case: must NOT be over-flagged as error
        expect(result.overallStatus, `borderline case over-flagged: ${result.overallStatus}`).not.toBe('error');
      } else {
        expect(meetsExpectation(result.overallStatus, c.expectMinSeverity), `actual=${result.overallStatus} expected ≥ ${c.expectMinSeverity}`).toBe(true);
      }
    });
  }
});
