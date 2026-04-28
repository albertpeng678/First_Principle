// Desktop RWD audit — scan every major view at 1280×800 and 1440×900,
// collect overflow issues, misaligned elements, and visual inconsistencies.
const { test } = require('@playwright/test');

test.setTimeout(120000);

const VIEWS = [
  { name: 'home',          path: '/' },
  { name: 'login',         setup: async (page) => { await page.evaluate(() => window.navigate('login')); } },
  { name: 'circles-home',  setup: async (page) => { await page.evaluate(() => window.navigate('circles')); } },
  { name: 'nsm-home',      setup: async (page) => { await page.evaluate(() => window.navigate('nsm')); } },
  { name: 'review-examples', path: '/review-examples.html' },
];

async function login(page) {
  await page.goto('http://localhost:4000/');
  await page.waitForSelector('#navbar-actions button', { timeout: 10000 });
  await page.evaluate(() => window.navigate('login'));
  await page.waitForSelector('#auth-form', { timeout: 5000 });
  await page.fill('#email', 'albertpeng678@gmail.com');
  await page.fill('#password', '21345678');
  await page.click('#auth-form button[type="submit"]');
  await page.waitForSelector('#auth-form', { state: 'hidden', timeout: 10000 }).catch(()=>{});
  await page.waitForTimeout(1500);
}

async function snapshotIssues(page, viewName, viewport) {
  return await page.evaluate(({ vw }) => {
    const issues = [];
    const seen = new Set();
    document.querySelectorAll('body *').forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      if (r.right > vw + 1) {
        const sel = el.tagName.toLowerCase() + (el.id ? '#' + el.id : el.className && typeof el.className === 'string' ? '.' + el.className.split(' ').slice(0, 2).join('.') : '');
        const key = 'overflow:' + sel;
        if (seen.has(key)) return;
        seen.add(key);
        issues.push({ type: 'overflow-x', selector: sel, right: Math.round(r.right), vw, text: (el.innerText || '').slice(0, 40) });
      }
    });
    const bodyCs = getComputedStyle(document.body);
    if (bodyCs.overflowY === 'auto' || bodyCs.overflowY === 'scroll') {
      issues.push({ type: 'body-scroll-trap', detail: `body overflow-y: ${bodyCs.overflowY}` });
    }
    document.querySelectorAll('main, [class*=container], [class*=wrapper], section').forEach(el => {
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      if (r.width > vw * 0.95 && parseFloat(cs.maxWidth || 'none') > vw && el.children.length > 0) {
        const sel = el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : '');
        const key = 'wide:' + sel;
        if (seen.has(key)) return;
        seen.add(key);
        issues.push({ type: 'no-max-width', selector: sel, width: Math.round(r.width) });
      }
    });
    document.querySelectorAll('button, a.btn, .btn, [role=button]').forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.height > 0 && r.height < 24) {
        const sel = el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : '');
        const key = 'tiny:' + sel + Math.round(r.height);
        if (seen.has(key)) return;
        seen.add(key);
        issues.push({ type: 'tiny-button', selector: sel, height: Math.round(r.height), text: (el.innerText || '').slice(0, 30) });
      }
    });
    return issues;
  }, { vw: viewport.width });
}

test.describe('Desktop RWD Audit', () => {
  for (const vp of [{ width: 1280, height: 800 }, { width: 1440, height: 900 }]) {
    test(`audit @ ${vp.width}x${vp.height}`, async ({ page }) => {
      await page.setViewportSize(vp);
      await login(page);
      const allReports = {};
      for (const view of VIEWS) {
        if (view.path) await page.goto('http://localhost:4000' + view.path);
        if (view.setup) await view.setup(page);
        await page.waitForTimeout(1500);
        const issues = await snapshotIssues(page, view.name, vp);
        const shotPath = `rwd-audit/${vp.width}x${vp.height}-${view.name}.png`;
        await page.screenshot({ path: shotPath, fullPage: true }).catch(()=>{});
        allReports[view.name] = { issues, screenshot: shotPath };
      }
      console.log('\n=== RWD AUDIT @', vp.width + 'x' + vp.height, '===');
      for (const [view, report] of Object.entries(allReports)) {
        console.log(`\n[${view}] (${report.issues.length} issues, screenshot: ${report.screenshot})`);
        for (const iss of report.issues.slice(0, 15)) {
          console.log('  -', iss.type + ':', JSON.stringify(iss).slice(0, 200));
        }
        if (report.issues.length > 15) console.log(`  ... +${report.issues.length - 15} more`);
      }
    });
  }
});
