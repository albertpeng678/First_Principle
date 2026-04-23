// tests/playwright/helpers/issue-reporter.js

function formatIssues(issues) {
  if (!issues.length) return '✅ No issues found';
  return issues.map(i =>
    `❌ [${i.journey}][${i.device}][${i.step}] ${i.type}: ${i.detail}`
  ).join('\n');
}

function createIssue(journey, device, step, type, detail) {
  return { journey, device, step, type, detail };
}

module.exports = { formatIssues, createIssue };
