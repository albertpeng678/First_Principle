// tests/adversarial/nsm-gate.spec.js
// Adversarial spec for NSM Step 2 → Step 3 gate.

const { test, expect } = require('@playwright/test');
const { QUESTION, ADVERSARIAL_CASES, meetsExpectation } = require('./helper');
const { reviewNSMGate } = require('../../prompts/nsm-gate');

// Borderline-ok NSM input (real valid concise NSM definition)
const BORDERLINE_NSM = '每月完成至少一首完整曲目播放的活躍月用戶數';
const BORDERLINE_RATIONALE = 'NSM 上升直接驅動廣告播放總時長與訂閱轉換率，是 Spotify 廣告營收與留存的領先指標';

test.describe('Adversarial — nsm-gate Step 2', () => {
  test.describe.configure({ mode: 'serial' });

  for (const c of ADVERSARIAL_CASES) {
    test(`[${c.id}] should produce status meeting min severity "${c.expectMinSeverity}"`, async () => {
      test.setTimeout(60_000);
      let nsm, rationale;
      if (c.id === 'borderline-ok') {
        nsm = BORDERLINE_NSM;
        rationale = BORDERLINE_RATIONALE;
      } else {
        nsm = c.input;
        rationale = c.input;
      }
      const result = await reviewNSMGate({
        question: QUESTION,
        nsm,
        rationale,
      });
      console.log(`[${c.id}] overallStatus=${result.overallStatus} canProceed=${result.canProceed} items=${JSON.stringify((result.items||[]).map(i => ({ criterion: i.criterion, status: i.status })))}`);
      if (c.expectMinSeverity === 'ok') {
        expect(result.overallStatus, `borderline got ${result.overallStatus}`).not.toBe('error');
      } else {
        expect(meetsExpectation(result.overallStatus, c.expectMinSeverity), `actual=${result.overallStatus} expected ≥ ${c.expectMinSeverity}`).toBe(true);
      }
    });
  }
});
