// tests/adversarial/nsm-evaluator.spec.js
// Adversarial spec for NSM Step 3 evaluator (final NSM scoring).
// Garbage 5-field → totalScore < 40, all dim scores ≤ 2.
// Borderline-ok 5 distinct valid → totalScore ≥ 60.

const { test, expect } = require('@playwright/test');
const { QUESTION, ADVERSARIAL_CASES } = require('./helper');
const { evaluateNSM } = require('../../prompts/nsm-evaluator');

// Borderline-ok inputs (real valid concise NSM + 4-dim breakdown)
const BORDERLINE_NSM = '每月完成至少一首完整曲目播放的活躍月用戶數';
const BORDERLINE_BREAKDOWN = {
  reach: '每月新觸碰播放介面的免費版用戶數（不含付費）',
  depth: '每位活躍用戶平均每月完整聽完曲目的次數',
  frequency: 'DAU/MAU 比率，反映用戶習慣養成程度',
  impact: '免費→付費轉換率與廣告完播率，直接連結廣告營收',
};

// Praise pattern (avoiding 完整 ambiguity per Task 5 lesson)
const HALLUCINATED_PRAISE = /扎實|不錯|優秀|(?<!不)清楚(?!的|地)|(?<!不)清晰(?!的|地)|思路.{0,5}清晰|分析.{0,5}佳|論述.{0,5}強|表現.{0,5}好/;

test.describe('Adversarial — nsm-evaluator Step 3', () => {
  test.describe.configure({ mode: 'serial' });

  for (const c of ADVERSARIAL_CASES) {
    test(`[${c.id}] garbage → low totalScore (or borderline → passable)`, async () => {
      test.setTimeout(120_000);
      let user_nsm, user_breakdown;
      if (c.id === 'borderline-ok') {
        user_nsm = BORDERLINE_NSM;
        user_breakdown = BORDERLINE_BREAKDOWN;
      } else {
        user_nsm = c.input;
        user_breakdown = { reach: c.input, depth: c.input, frequency: c.input, impact: c.input };
      }
      const result = await evaluateNSM({
        question_json: QUESTION,
        user_nsm,
        user_breakdown,
      });
      const s = result.scores || {};
      console.log(`[${c.id}] totalScore=${result.totalScore} scores={a:${s.alignment},l:${s.leading},ac:${s.actionability},si:${s.simplicity},se:${s.sensitivity}} summary="${(result.summary||'').substring(0,80)}"`);
      if (c.expectMinSeverity === 'ok') {
        expect(result.totalScore, `borderline got ${result.totalScore}, want ≥ 60`).toBeGreaterThanOrEqual(60);
      } else {
        expect(result.totalScore, `${c.id} got ${result.totalScore}, want < 40`).toBeLessThan(40);
        Object.values(s).forEach(score => {
          expect(score, `${c.id} dim score ${score} > 2`).toBeLessThanOrEqual(2);
        });
        // No hallucinated praise on garbage
        expect(result.summary || '', `${c.id} summary praise: ${result.summary}`).not.toMatch(HALLUCINATED_PRAISE);
      }
    });
  }
});
