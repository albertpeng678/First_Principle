// tests/playwright/helpers/metrics.js

async function checkPageHealth(page) {
  const errors = [];

  // 2. CLS measurement
  const cls = await page.evaluate(() => {
    return new Promise(resolve => {
      let clsValue = 0;
      const observer = new PerformanceObserver(list => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) clsValue += entry.value;
        }
      });
      try {
        observer.observe({ type: 'layout-shift', buffered: true });
      } catch (e) {
        return resolve(0); // not supported
      }
      setTimeout(() => {
        observer.disconnect();
        resolve(clsValue);
      }, 300);
    });
  });

  // 3. Horizontal overflow check
  const hasOverflow = await page.evaluate(() =>
    document.documentElement.scrollWidth > window.innerWidth
  );

  if (cls > 0.1) errors.push({ type: 'cls', detail: `CLS=${cls.toFixed(3)}` });
  if (hasOverflow) errors.push({ type: 'overflow', detail: 'horizontal scroll detected' });

  return errors;
}

function collectConsoleErrors(page) {
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  return consoleErrors;
}

module.exports = { checkPageHealth, collectConsoleErrors };
