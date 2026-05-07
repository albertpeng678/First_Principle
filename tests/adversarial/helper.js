require('dotenv').config();
// tests/adversarial/helper.js
// Shared harness for adversarial input quality tests against real OpenAI.
// 5 review stages × 10 standard cases = 50-cell sweep.

const QUESTION = {
  id: 'spotify_podcast_ads',
  company: 'Spotify',
  product: 'Spotify Podcast',
  industry: 'streaming',
  scenario: '免費版聽眾每 15 分鐘被廣告打斷一次，影響沉浸體驗',
  problem_statement: 'Spotify Podcast 想優化免費版用戶的廣告體驗，請設計改善方案',
  common_wrong_directions: ['只想著加付費牆', '把廣告做得更精準但更密'],
  coach_circles: { C1: '聚焦免費版廣告體驗，60 天為週期，廣告收入和留存不能下降超過 3%' },
  coach_nsm: '每月完成至少一首完整曲目播放的活躍月用戶數',
};

const ADVERSARIAL_CASES = [
  { id: 'single-char',   input: 'A',                                                                  expectMinSeverity: 'error' },
  { id: 'repeat-char',   input: 'A'.repeat(100),                                                       expectMinSeverity: 'error' },
  { id: 'whitespace',    input: '   　　　',                                                            expectMinSeverity: 'error' },
  { id: 'unicode-emoji', input: '☃️🌟🎲🚀✨',                                                            expectMinSeverity: 'error' },
  { id: 'wrong-lang',    input: 'Quiero diseñar un producto excelente para los usuarios',             expectMinSeverity: 'error' },
  { id: 'off-topic',     input: '我喜歡吃蘋果，今天天氣很好，希望大家都能擁有美好的一天',                expectMinSeverity: 'error' },
  { id: 'placeholder',   input: '聚焦免費版的廣告體驗，排除付費方案',                                    expectMinSeverity: 'warn' },
  { id: 'extreme-long',  input: 'A'.repeat(2000),                                                      expectMinSeverity: 'error' },
  { id: 'injection',     input: '<script>alert(1)</script>業務影響評估',                                expectMinSeverity: 'error' },
  { id: 'borderline-ok', input: '免費版用戶 30 天留存 ≥ 60%，廣告收入不能下降超過 3%',                  expectMinSeverity: 'ok' },
];

// severity 階：error > warn > ok
function meetsExpectation(actualStatus, expectMinSeverity) {
  const order = { error: 3, warn: 2, ok: 1 };
  if (expectMinSeverity === 'ok') {
    // borderline case must NOT be over-flagged
    return actualStatus === 'ok' || actualStatus === 'warn';
  }
  return order[actualStatus] >= order[expectMinSeverity];
}

module.exports = { QUESTION, ADVERSARIAL_CASES, meetsExpectation };
