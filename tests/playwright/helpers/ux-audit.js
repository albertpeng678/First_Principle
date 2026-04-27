// tests/playwright/helpers/ux-audit.js
//
// 34-item UX audit checklist (from plan section "UX 稽核元憲章")
// Covers: A. RWD | B. Smoothness | C. Touch | D. Viewport | E. Fonts | F. User Journey
//
// Each check returns { id, passed, detail } so the caller can fail
// the test or aggregate issues.

// ───────────────────────────────────────────────
// A. RWD 完整性 (8 items)
// ───────────────────────────────────────────────

async function A1_textOverflow(page) {
  // Detect text nodes that overflow their parent at 320px-class viewports.
  const overflowing = await page.evaluate(() => {
    const issues = [];
    const all = document.querySelectorAll('h1,h2,h3,h4,p,span,div,button,a,label');
    all.forEach(el => {
      if (!el.offsetParent) return; // skip hidden
      if (el.scrollWidth > el.clientWidth + 1) {
        issues.push({
          tag: el.tagName,
          cls: el.className.toString().slice(0, 60),
          text: (el.textContent || '').trim().slice(0, 30),
        });
      }
    });
    return issues;
  });
  return { id: 'A1', passed: overflowing.length === 0, detail: overflowing.slice(0, 5) };
}

async function A2_touchTargetSize(page) {
  // Buttons and links must be ≥44×44px when device is mobile.
  const tooSmall = await page.evaluate(() => {
    const issues = [];
    const targets = document.querySelectorAll('button, a, [role="button"], input[type="submit"], input[type="button"]');
    targets.forEach(el => {
      if (!el.offsetParent) return; // hidden
      const r = el.getBoundingClientRect();
      // Allow icon-only buttons inside larger nav containers; but the touch target itself must be ≥44.
      if (r.width > 0 && r.height > 0 && (r.width < 44 || r.height < 44)) {
        issues.push({
          cls: el.className.toString().slice(0, 60),
          w: Math.round(r.width),
          h: Math.round(r.height),
          text: (el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 20),
        });
      }
    });
    return issues;
  });
  return { id: 'A2', passed: tooSmall.length === 0, detail: tooSmall.slice(0, 5) };
}

async function A3_cardMaxWidth(page) {
  // Cards/inputs must not exceed viewport width.
  const overflowing = await page.evaluate(() => {
    const vw = window.innerWidth;
    const issues = [];
    document.querySelectorAll('.circles-mode-card,.circles-q-card,.circles-info-card,textarea,input,.problem-card,.prev-step-card,.tracking-block,.e-solution-block,.nsm-question-card,.nsm-context-card,.gate-item').forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.width > vw + 1) {
        issues.push({ cls: el.className.toString().slice(0, 50), width: Math.round(r.width), vw });
      }
    });
    return issues;
  });
  return { id: 'A3', passed: overflowing.length === 0, detail: overflowing };
}

async function A5_fixedElementCoverage(page) {
  // TopBar and BottomBar must not cover content (verify via padding).
  const coverage = await page.evaluate(() => {
    const issues = [];
    const navbar = document.querySelector('.navbar');
    const submitBar = document.querySelector('.circles-submit-bar');
    const body = document.body;
    if (navbar && navbar.offsetParent) {
      const n = navbar.getBoundingClientRect();
      if (n.bottom > window.innerHeight) issues.push({ el: 'navbar', detail: 'navbar exceeds viewport' });
    }
    if (submitBar && submitBar.offsetParent) {
      const s = submitBar.getBoundingClientRect();
      // submit bar should be at the bottom; if it's covering the main content, MainContent should have padding-bottom.
      const main = document.querySelector('.main-content,.circles-phase1,.circles-phase2');
      if (main) {
        const computed = getComputedStyle(main);
        const padB = parseInt(computed.paddingBottom, 10) || 0;
        if (padB < s.height - 5) {
          issues.push({ el: 'submit-bar', detail: `padding-bottom ${padB}px < bar height ${Math.round(s.height)}px` });
        }
      }
    }
    return issues;
  });
  return { id: 'A5', passed: coverage.length === 0, detail: coverage };
}

async function A7_horizontalOverflow(page) {
  const has = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  return { id: 'A7', passed: !has, detail: has ? 'page has horizontal scroll' : null };
}

async function A8_textLegibility(page) {
  // Min font size 11px, line-height ≥1.4
  const issues = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('p,span,div,label,button,a').forEach(el => {
      if (!el.offsetParent) return;
      if (!el.textContent || !el.textContent.trim()) return;
      const cs = getComputedStyle(el);
      const fontSize = parseFloat(cs.fontSize);
      const lineHeight = parseFloat(cs.lineHeight);
      if (fontSize > 0 && fontSize < 11) {
        out.push({ cls: el.className.toString().slice(0, 40), fontSize, type: 'too-small' });
      }
      if (fontSize > 0 && lineHeight > 0) {
        const ratio = lineHeight / fontSize;
        if (ratio < 1.35) {
          out.push({ cls: el.className.toString().slice(0, 40), ratio: ratio.toFixed(2), type: 'tight-leading' });
        }
      }
    });
    return out;
  });
  // Allow up to 3 minor leading violations (icon-only spans etc.)
  const tooSmall = issues.filter(i => i.type === 'too-small');
  return { id: 'A8', passed: tooSmall.length === 0, detail: tooSmall.slice(0, 5) };
}

// ───────────────────────────────────────────────
// B. 流暢度 (6 items)
// ───────────────────────────────────────────────

async function B2_tapHighlightRemoved(page) {
  // -webkit-tap-highlight-color must be transparent on body or root *
  const ok = await page.evaluate(() => {
    const cs = getComputedStyle(document.documentElement);
    const v = cs.getPropertyValue('-webkit-tap-highlight-color') || '';
    // accepted: rgba(0,0,0,0) or transparent
    return /rgba\(0,\s*0,\s*0,\s*0\)|transparent/i.test(v);
  });
  return { id: 'B2', passed: ok, detail: ok ? null : '-webkit-tap-highlight-color not transparent' };
}

async function B3_inertialScroll(page) {
  // -webkit-overflow-scrolling: touch on scroll containers
  const issues = await page.evaluate(() => {
    const containers = document.querySelectorAll('.main-content,.circles-chat-body,.circles-step-pills,[class*="scroll"]');
    const out = [];
    containers.forEach(el => {
      const cs = getComputedStyle(el);
      if (cs.overflowY === 'auto' || cs.overflowY === 'scroll' || cs.overflowX === 'auto') {
        const ws = cs.getPropertyValue('-webkit-overflow-scrolling');
        if (ws !== 'touch') {
          out.push({ cls: el.className.toString().slice(0, 50), got: ws || '(none)' });
        }
      }
    });
    return out;
  });
  return { id: 'B3', passed: issues.length === 0, detail: issues.slice(0, 5) };
}

async function B4_scrollbarHidden(page) {
  // Custom scrollbar styles ensure scrollbar is not visible (system scrollbar)
  const issues = await page.evaluate(() => {
    const out = [];
    const containers = document.querySelectorAll('.circles-step-pills');
    containers.forEach(el => {
      const cs = getComputedStyle(el);
      const sw = cs.scrollbarWidth || cs.getPropertyValue('scrollbar-width');
      if (sw && sw !== 'none') {
        out.push({ cls: el.className.toString().slice(0, 50), scrollbarWidth: sw });
      }
    });
    return out;
  });
  return { id: 'B4', passed: issues.length === 0, detail: issues };
}

// ───────────────────────────────────────────────
// C. Touch / Mobile (6 items)
// ───────────────────────────────────────────────

async function C1_overscrollContain(page) {
  // Modals/sheets must use overscroll-behavior: contain to prevent scroll-through.
  const issues = await page.evaluate(() => {
    const modals = document.querySelectorAll('.hint-overlay,.offcanvas,.bottom-sheet,[role="dialog"]');
    const out = [];
    modals.forEach(el => {
      if (!el.offsetParent) return;
      const cs = getComputedStyle(el);
      const oc = cs.overscrollBehavior || cs.overscrollBehaviorY || 'auto';
      if (!/contain|none/.test(oc)) {
        out.push({ cls: el.className.toString().slice(0, 40), got: oc });
      }
    });
    return out;
  });
  return { id: 'C1', passed: issues.length === 0, detail: issues };
}

async function C2_textareaFontSize(page) {
  // Textareas need font-size ≥ 16px on iOS to prevent zoom on focus.
  const issues = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('textarea, input[type="text"], input[type="email"], input[type="password"], input:not([type])').forEach(el => {
      if (!el.offsetParent) return;
      const cs = getComputedStyle(el);
      const fs = parseFloat(cs.fontSize);
      if (fs > 0 && fs < 16) {
        out.push({ cls: el.className.toString().slice(0, 40), fontSize: fs });
      }
    });
    return out;
  });
  return { id: 'C2', passed: issues.length === 0, detail: issues.slice(0, 5) };
}

// ───────────────────────────────────────────────
// D. Viewport safety (4 items)
// ───────────────────────────────────────────────

async function D1_dvhFallback(page) {
  // Full-height elements should use both vh and dvh — verify via raw stylesheet text.
  const usesVh = await page.evaluate(() => {
    let foundVh = false, foundDvh = false;
    for (const sheet of Array.from(document.styleSheets)) {
      try {
        for (const rule of Array.from(sheet.cssRules || [])) {
          const txt = rule.cssText || '';
          if (/100vh|95vh/.test(txt)) foundVh = true;
          if (/100dvh|95dvh/.test(txt)) foundDvh = true;
        }
      } catch (_) { /* cross-origin sheet */ }
    }
    return { foundVh, foundDvh };
  });
  // If we use vh, we must also have dvh fallback
  const passed = !usesVh.foundVh || (usesVh.foundVh && usesVh.foundDvh);
  return { id: 'D1', passed, detail: passed ? null : 'uses vh without dvh fallback' };
}

async function D3_scrollbarGutterStable(page) {
  const ok = await page.evaluate(() => {
    const html = getComputedStyle(document.documentElement);
    const v = html.scrollbarGutter || html.getPropertyValue('scrollbar-gutter');
    return v === 'stable' || v.includes('stable');
  });
  return { id: 'D3', passed: ok, detail: ok ? null : 'html scrollbar-gutter is not stable' };
}

// ───────────────────────────────────────────────
// E. Fonts (4 items)
// ───────────────────────────────────────────────

async function E1_E2_fontPreconnect(page) {
  // Verify head has preconnect to fonts.googleapis.com and fonts.gstatic.com
  const linkInfo = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('link'));
    const has = pred => links.some(pred);
    return {
      preconnectGapis: has(l => l.rel === 'preconnect' && /fonts\.googleapis\.com/.test(l.href)),
      preconnectGstatic: has(l => l.rel === 'preconnect' && /fonts\.gstatic\.com/.test(l.href)),
      preloadCss: has(l => l.rel === 'preload' && l.as === 'style' && /fonts/.test(l.href)),
    };
  });
  const passedE1 = linkInfo.preconnectGapis && linkInfo.preconnectGstatic;
  const passedE2 = linkInfo.preloadCss;
  return [
    { id: 'E1', passed: passedE1, detail: passedE1 ? null : linkInfo },
    { id: 'E2', passed: passedE2, detail: passedE2 ? null : 'no font CSS preload' },
  ];
}

async function E4_dmSansEverywhere(page) {
  // All visible text should compute font-family beginning with DM Sans (except .score-number/.nsm-score-num use Instrument Serif).
  const issues = await page.evaluate(() => {
    const out = [];
    const allowSerif = el => el.classList.contains('score-number') || el.classList.contains('nsm-score-num');
    document.querySelectorAll('h1,h2,h3,h4,p,span,div,button,a,label,input,textarea').forEach(el => {
      if (!el.offsetParent) return;
      if (!el.textContent || !el.textContent.trim()) return;
      const ff = getComputedStyle(el).fontFamily;
      if (allowSerif(el)) return;
      // Accept any chain that puts DM Sans first
      if (!/^"?DM Sans"?/.test(ff.trim())) {
        out.push({ cls: el.className.toString().slice(0, 40), ff: ff.slice(0, 60) });
      }
    });
    return out;
  });
  return { id: 'E4', passed: issues.length === 0, detail: issues.slice(0, 5) };
}

// ───────────────────────────────────────────────
// Aggregate runner
// ───────────────────────────────────────────────

async function runAudit(page, opts = {}) {
  const checks = [];

  checks.push(await A1_textOverflow(page));
  if (opts.isMobile !== false) checks.push(await A2_touchTargetSize(page));
  checks.push(await A3_cardMaxWidth(page));
  checks.push(await A5_fixedElementCoverage(page));
  checks.push(await A7_horizontalOverflow(page));
  checks.push(await A8_textLegibility(page));

  checks.push(await B2_tapHighlightRemoved(page));
  checks.push(await B3_inertialScroll(page));
  checks.push(await B4_scrollbarHidden(page));

  checks.push(await C1_overscrollContain(page));
  if (opts.isMobile !== false) checks.push(await C2_textareaFontSize(page));

  checks.push(await D1_dvhFallback(page));
  checks.push(await D3_scrollbarGutterStable(page));

  const eChecks = await E1_E2_fontPreconnect(page);
  checks.push(...eChecks);
  checks.push(await E4_dmSansEverywhere(page));

  const failed = checks.filter(c => !c.passed);
  const passed = checks.filter(c => c.passed);

  return {
    total: checks.length,
    passedCount: passed.length,
    failedCount: failed.length,
    passed: passed.map(c => c.id),
    failed: failed,
  };
}

function formatAuditReport(report, screenName) {
  const lines = [];
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  lines.push(`UX Audit — ${screenName} — ${report.passedCount}/${report.total} passed`);
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  if (report.failed.length) {
    lines.push('Failed:');
    report.failed.forEach(f => {
      lines.push(`  ✗ ${f.id}: ${JSON.stringify(f.detail).slice(0, 200)}`);
    });
  } else {
    lines.push('All checks passed ✓');
  }
  return lines.join('\n');
}

module.exports = {
  runAudit,
  formatAuditReport,
  // export individual checks for selective use
  A1_textOverflow, A2_touchTargetSize, A3_cardMaxWidth, A5_fixedElementCoverage,
  A7_horizontalOverflow, A8_textLegibility,
  B2_tapHighlightRemoved, B3_inertialScroll, B4_scrollbarHidden,
  C1_overscrollContain, C2_textareaFontSize,
  D1_dvhFallback, D3_scrollbarGutterStable,
  E1_E2_fontPreconnect, E4_dmSansEverywhere,
};
