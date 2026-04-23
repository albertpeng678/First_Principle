// tests/playwright/journeys/theme.spec.js
// Journey: Find theme toggle → switch dark/light → confirm CLS ≈ 0 (no white flash)

const { test, expect } = require('@playwright/test');
const { checkPageHealth, collectConsoleErrors } = require('../helpers/metrics');
const { formatIssues, createIssue } = require('../helpers/issue-reporter');

test.describe('Theme Toggle Journey', () => {
  test('theme toggle switches correctly with low CLS', async ({ page }, testInfo) => {
    const device = testInfo.project.name;
    const issues = [];
    collectConsoleErrors(page);

    await page.goto('/');

    // Wait for app to initialize in guest mode
    await page.waitForSelector('#navbar-actions', { timeout: 10000 });
    // Wait for the theme toggle button to appear (rendered after auth state settles)
    await page.waitForSelector('button[title="切換主題"]', { timeout: 10000 });

    const themeToggle = page.locator('button[title="切換主題"]');

    if (await themeToggle.count() === 0) {
      // No theme toggle present — just confirm no overflow
      const hasOverflow = await page.evaluate(() =>
        document.documentElement.scrollWidth > window.innerWidth
      );
      if (hasOverflow) {
        issues.push(createIssue('theme', device, 'home', 'overflow', 'horizontal scroll detected'));
      }
      const healthIssues = await checkPageHealth(page);
      for (const hi of healthIssues) {
        issues.push(createIssue('theme', device, 'home', hi.type, hi.detail));
      }
      if (issues.length > 0) console.warn('\n' + formatIssues(issues));
      expect(issues.filter(i => i.type === 'overflow')).toHaveLength(0);
      return;
    }

    // Get initial theme
    const initialTheme = await page.evaluate(() =>
      document.documentElement.dataset.theme
    );

    // Switch to opposite theme (→ dark if currently light)
    await themeToggle.click();

    const afterFirstToggle = await page.evaluate(() =>
      document.documentElement.dataset.theme
    );
    expect(afterFirstToggle).not.toBe(initialTheme);

    // CLS check after first toggle
    const cls1 = await page.evaluate(() => {
      return new Promise(resolve => {
        let clsValue = 0;
        const observer = new PerformanceObserver(list => {
          for (const entry of list.getEntries()) {
            if (!entry.hadRecentInput) clsValue += entry.value;
          }
        });
        try {
          observer.observe({ type: 'layout-shift', buffered: false });
        } catch (e) {
          return resolve(0);
        }
        setTimeout(() => {
          observer.disconnect();
          resolve(clsValue);
        }, 800);
      });
    });

    if (cls1 > 0.1) {
      issues.push(createIssue('theme', device, 'toggle-to-dark', 'cls', `CLS=${cls1.toFixed(3)} on theme toggle`));
    }

    // Switch back to original theme
    await themeToggle.click();

    const afterSecondToggle = await page.evaluate(() =>
      document.documentElement.dataset.theme
    );
    expect(afterSecondToggle).toBe(initialTheme);

    // CLS check after second toggle
    const cls2 = await page.evaluate(() => {
      return new Promise(resolve => {
        let clsValue = 0;
        const observer = new PerformanceObserver(list => {
          for (const entry of list.getEntries()) {
            if (!entry.hadRecentInput) clsValue += entry.value;
          }
        });
        try {
          observer.observe({ type: 'layout-shift', buffered: false });
        } catch (e) {
          return resolve(0);
        }
        setTimeout(() => {
          observer.disconnect();
          resolve(clsValue);
        }, 800);
      });
    });

    if (cls2 > 0.1) {
      issues.push(createIssue('theme', device, 'toggle-to-light', 'cls', `CLS=${cls2.toFixed(3)} on theme toggle back`));
    }

    // Overall page health
    const healthIssues = await checkPageHealth(page);
    for (const hi of healthIssues) {
      issues.push(createIssue('theme', device, 'final', hi.type, hi.detail));
    }

    if (issues.length > 0) {
      console.warn('\n' + formatIssues(issues));
    }

    // Theme toggle CLS should be near 0 (no white flash / layout shift)
    expect(issues.filter(i => i.type === 'cls')).toHaveLength(0);
    expect(issues.filter(i => i.type === 'overflow')).toHaveLength(0);
  });
});
