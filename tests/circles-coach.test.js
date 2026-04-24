// TDD: Test written before implementation
// RED phase: this test must fail before circles-coach.js exists

test('circles-coach exports streamCirclesReply function', () => {
  const mod = require('../prompts/circles-coach');
  expect(typeof mod.streamCirclesReply).toBe('function');
});
