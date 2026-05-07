// tests/adversarial/circles-final-report.spec.js
// Adversarial spec for Phase 4 final report.
// Garbage 7-step → grade D + low overallScore + no hallucinated praise.

const { test, expect } = require('@playwright/test');
const { QUESTION } = require('./helper');
const { generateFinalReport } = require('../../prompts/circles-final-report');

// 正面讚美詞 — 只捕捉明確的正面評語，排除「完整」（語境歧義太高）
const HALLUCINATED_PRAISE = /扎實|不錯|優秀|(?<!不)清楚(?!的|地)|(?<!不)清晰(?!的|地)|思路.{0,5}清晰|分析.{0,5}佳|論述.{0,5}強|表現.{0,5}好/;

test.describe('Adversarial — circles-final-report Phase 4', () => {
  test.describe.configure({ mode: 'serial' });

  test('all-garbage 7-step → grade D + overallScore < 40 + no hallucinated praise', async () => {
    test.setTimeout(120_000);
    const garbageStep = {
      dimensions: [
        { name: 'd1', score: 1, comment: '欄位內容不足' },
        { name: 'd2', score: 1, comment: '欄位內容不足' },
        { name: 'd3', score: 1, comment: '欄位內容不足' },
        { name: 'd4', score: 1, comment: '欄位內容不足' },
      ],
      totalScore: 20,
      highlight: '無顯著表現 — 欄位內容不足',
      improvement: '請補充每欄位至少 30 字具體內容',
    };
    const stepScores = {
      C1: garbageStep, I: garbageStep, R: garbageStep, C2: garbageStep,
      L: garbageStep, E: garbageStep, S: garbageStep,
    };
    const result = await generateFinalReport({ stepScores, questionJson: QUESTION });
    console.log('[garbage-final] overallScore=', result.overallScore, 'grade=', result.grade, 'headline=', result.headline, 'coachVerdict=', result.coachVerdict);
    expect(result.overallScore).toBeLessThan(40);
    expect(result.grade).toBe('D');
    expect(result.coachVerdict, `verdict contained praise: ${result.coachVerdict}`).not.toMatch(HALLUCINATED_PRAISE);
    expect(result.headline, `headline contained praise: ${result.headline}`).not.toMatch(HALLUCINATED_PRAISE);
  });

  test('strong 7-step (all dims 4/5) → grade A or B + overallScore ≥ 70', async () => {
    test.setTimeout(120_000);
    const strongStep = {
      dimensions: [
        { name: 'd1', score: 4 }, { name: 'd2', score: 4 },
        { name: 'd3', score: 4 }, { name: 'd4', score: 4 },
      ],
      totalScore: 80,
      highlight: '邏輯清晰',
      improvement: '可加入競品對比',
    };
    const stepScores = {
      C1: strongStep, I: strongStep, R: strongStep, C2: strongStep,
      L: strongStep, E: strongStep, S: strongStep,
    };
    const result = await generateFinalReport({ stepScores, questionJson: QUESTION });
    console.log('[strong-final] overallScore=', result.overallScore, 'grade=', result.grade, 'headline=', result.headline);
    expect(result.overallScore).toBeGreaterThanOrEqual(70);
    expect(['A', 'B']).toContain(result.grade);
  });
});
