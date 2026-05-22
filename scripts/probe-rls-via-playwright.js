#!/usr/bin/env node
/**
 * P0-SCHEMA-4 RLS probe via Playwright + Supabase Studio
 * ------------------------------------------------------------
 * Per round-2 quiz Q7: pg_policies + pg_class.relrowsecurity not reachable
 * via PostgREST. User authorized Playwright drive (2026-05-22).
 *
 * Flow:
 *   1. Launch headed Chromium pointing at this project's SQL editor URL
 *   2. Wait for user to login (if not already)
 *   3. Once on the SQL editor page, paste the probe SQL
 *   4. Click "Run" button
 *   5. Screenshot the result + scrape the rendered table cells
 *   6. Save to audit/rls-policies-snapshot-2026-05-22.md
 *
 * No writes. Just SELECT queries to pg_class / pg_policies / role grants.
 */

const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const PROJECT_REF = 'klvlizxmvzfpvfgswmfk';
const SQL_EDITOR_URL = `https://supabase.com/dashboard/project/${PROJECT_REF}/sql/new`;

const PROBE_SQL = `
-- (1) RLS enabled flag per table
SELECT n.nspname AS schema,
       c.relname AS table_name,
       c.relrowsecurity AS rls_enabled,
       c.relforcerowsecurity AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('nsm_sessions', 'circles_sessions')
ORDER BY c.relname;

-- (2) Policies per table (full body)
SELECT schemaname,
       tablename,
       policyname,
       permissive,
       roles,
       cmd,
       qual          AS using_expr,
       with_check    AS with_check_expr
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('nsm_sessions', 'circles_sessions')
ORDER BY tablename, policyname;

-- (3) Role grants (for full picture)
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN ('nsm_sessions', 'circles_sessions')
ORDER BY table_name, grantee, privilege_type;
`.trim();

const OUT_DIR = path.join(__dirname, '..', 'audit');
const OUT_PNG = path.join(OUT_DIR, 'rls-policies-snapshot-2026-05-22.png');
const OUT_MD = path.join(OUT_DIR, 'rls-policies-snapshot-2026-05-22.md');

(async () => {
  console.log('Launching headed Chromium → Supabase Studio SQL editor...');
  console.log('URL:', SQL_EDITOR_URL);
  console.log('');
  console.log('User: please login in the opened browser if not already logged in.');
  console.log('Script will wait up to 5 minutes for the SQL editor page to load.');
  console.log('');

  const browser = await chromium.launch({ headless: false, slowMo: 100 });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  await page.goto(SQL_EDITOR_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });

  // Wait for actual Supabase SQL editor (NOT github oauth redirect with /sql in URL).
  // Must match hostname AND monaco editor element present.
  console.log('Waiting for login + Supabase SQL editor (up to 5 min)...');
  await page.waitForFunction(
    () => location.hostname === 'supabase.com'
      && location.pathname.includes('/sql/')
      && !!document.querySelector('.monaco-editor'),
    { timeout: 300_000 }
  );
  console.log('SQL editor reached. URL:', page.url());
  console.log('Monaco editor ready. Pasting probe SQL...');

  // Click into editor, paste SQL via clipboard
  await page.locator('.monaco-editor').first().click();
  await page.keyboard.press('Meta+A');
  await page.keyboard.press('Backspace');
  await page.keyboard.insertText(PROBE_SQL);
  await page.waitForTimeout(500);

  // Click Run button — usually has text "Run" or shortcut Cmd+Enter
  console.log('Pressing Cmd+Enter to run query...');
  await page.keyboard.press('Meta+Enter');

  // Wait for result panel to render
  await page.waitForTimeout(8_000);

  // Screenshot
  await page.screenshot({ path: OUT_PNG, fullPage: true });
  console.log('Screenshot saved:', OUT_PNG);

  // Try to scrape table cells (Supabase Studio renders results in a div grid)
  // Selector may vary by Studio version; we capture multiple candidates.
  const tableData = await page.evaluate(() => {
    const out = [];
    const grids = document.querySelectorAll('[role="grid"], .ag-root, .results-table, table');
    grids.forEach((g, i) => {
      const rows = g.querySelectorAll('[role="row"], tr');
      const rowData = [];
      rows.forEach((r) => {
        const cells = r.querySelectorAll('[role="cell"], [role="gridcell"], td, th');
        const cellTexts = Array.from(cells).map((c) => c.textContent?.trim() || '');
        if (cellTexts.length) rowData.push(cellTexts);
      });
      if (rowData.length) out.push({ gridIdx: i, rows: rowData });
    });
    return out;
  });

  // Write markdown report
  let md = `# RLS Policies Snapshot — 2026-05-22\n\n`;
  md += `Probed via Playwright + Supabase Studio SQL editor.\n`;
  md += `Project: \`${PROJECT_REF}\`\n`;
  md += `URL: ${SQL_EDITOR_URL}\n\n`;
  md += `## SQL\n\n\`\`\`sql\n${PROBE_SQL}\n\`\`\`\n\n`;
  md += `## Result (scraped from Studio table cells)\n\n`;
  if (!tableData.length) {
    md += `**WARNING**: No table data scraped — Studio UI may have changed. Inspect screenshot manually.\n\n`;
  } else {
    tableData.forEach((g) => {
      md += `### Grid ${g.gridIdx}\n\n`;
      g.rows.forEach((row) => {
        md += `| ${row.map((c) => c.replace(/\|/g, '\\|')).join(' | ')} |\n`;
      });
      md += `\n`;
    });
  }
  md += `\n## Screenshot\n\n![](rls-policies-snapshot-2026-05-22.png)\n`;

  fs.writeFileSync(OUT_MD, md);
  console.log('Markdown report saved:', OUT_MD);

  console.log('\nKeeping browser open for 30s — verify result visually then it closes.');
  await page.waitForTimeout(30_000);

  await ctx.close();
  await browser.close();
  console.log('Done.');
})().catch((e) => {
  console.error('ERROR:', e.message || e);
  console.error(e.stack);
  process.exit(1);
});
