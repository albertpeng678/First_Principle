// Phase 1, Task 1.5 — TDD test for bullet parser.
// Verifies window.renderBulletText exists and produces nested <ul>/<li>/<strong>.

const { test, expect } = require('@playwright/test');

test('parser renders nested bullets correctly', async ({ page }) => {
  await page.goto('http://localhost:4000/');
  // Wait for app.js to load (window.renderBulletText is defined at file top-level)
  await page.waitForFunction(() => typeof window.renderBulletText === 'function', null, { timeout: 10000 });

  const html = await page.evaluate(() => {
    return window.renderBulletText('- 主一\n- 主二：\n  - 子 a\n  - 子 b\n- 主三 **bold**');
  });

  expect(html).toContain('<ul');
  expect(html).toContain('<li>主一</li>');
  // Nested ul should be present
  const ulCount = (html.match(/<ul/g) || []).length;
  expect(ulCount).toBeGreaterThanOrEqual(2);
  expect(html).toContain('<li>子 a</li>');
  expect(html).toContain('<li>子 b</li>');
  expect(html).toContain('<strong>bold</strong>');
});

test('parser falls back to single bullet for legacy prose', async ({ page }) => {
  await page.goto('http://localhost:4000/');
  await page.waitForFunction(() => typeof window.renderBulletText === 'function', null, { timeout: 10000 });
  const html = await page.evaluate(() => window.renderBulletText('整段沒有 bullet 的文字 **重點** 句子。'));
  expect(html).toContain('<ul');
  expect(html).toContain('<strong>重點</strong>');
});

test('parser escapes HTML', async ({ page }) => {
  await page.goto('http://localhost:4000/');
  await page.waitForFunction(() => typeof window.renderBulletText === 'function', null, { timeout: 10000 });
  const html = await page.evaluate(() => window.renderBulletText('- <script>alert(1)</script>\n- 安全'));
  expect(html).not.toContain('<script>');
  expect(html).toContain('&lt;script&gt;');
});
