// step-s probe — drive S step + Phase 3 score + Phase 4 final report across viewports.
// Uses chromium directly. Read-only against the app code.
const { chromium } = require('@playwright/test');

const BASE = process.env.PMDRILL_BASE_URL || 'http://localhost:4000';
const OUT = '/Users/albertpeng/Desktop/claude_project/First_Principle/audit/cycles/2026-04-30/screenshots/step-s';

const VIEWPORTS = [
  { name: 'Mobile-360',    w: 360,  h: 780,  mobile: true  },
  { name: 'iPhone-SE',     w: 375,  h: 667,  mobile: true  },
  { name: 'iPhone-14',     w: 390,  h: 844,  mobile: true  },
  { name: 'iPhone-15-Pro', w: 430,  h: 932,  mobile: true  },
  { name: 'iPad',          w: 768,  h: 1024, mobile: true  },
  { name: 'Desktop-1280',  w: 1280, h: 800,  mobile: false },
  { name: 'Desktop-1440',  w: 1440, h: 900,  mobile: false },
  { name: 'Desktop-2560',  w: 2560, h: 1440, mobile: false },
];

async function jumpToS(page, mode='simulation') {
  await page.goto(BASE + '/?onboarding=0');
  await page.waitForLoadState('networkidle');
  // Force simulation mode + skip-to-S by directly seeding AppState then navigating.
  await page.evaluate((mode) => {
    try { localStorage.setItem('circles_onboarding_done', '1'); } catch(_) {}
    localStorage.setItem('circlesMode', mode);
  }, mode);
  // Click first .circles-q-card
  await page.locator('.circles-q-card').first().click().catch(() => {});
  await page.locator('.circles-q-confirm-btn').first().click().catch(() => {});
  await page.waitForSelector('.circles-submit-bar, #circles-p1-submit', { timeout: 5000 }).catch(() => {});
  // Drive AppState to S step + simulate scores so renderer paints S body.
  await page.evaluate(() => {
    if (!window.AppState) return;
    AppState.circlesMode = 'simulation';
    AppState.circlesSimStep = 6;
    AppState.circlesPhase = 1;
    AppState.circlesStepDrafts = AppState.circlesStepDrafts || {};
    AppState.circlesFrameworkDraft = AppState.circlesFrameworkDraft || {};
    if (typeof render === 'function') render();
  });
  await page.waitForTimeout(400);
}

async function jumpToPhase3(page) {
  await jumpToS(page, 'simulation');
  await page.evaluate(() => {
    AppState.circlesDrillStep = 'S';
    AppState.circlesScoreResult = {
      totalScore: 78,
      dimensions: [
        { name: '清晰度', score: 4, comment: 'OK' },
        { name: '完整度', score: 3, comment: 'OK' },
        { name: '邏輯性', score: 4, comment: 'OK' },
      ],
      dims: [
        { name: '清晰度', score: 80 },
        { name: '完整度', score: 75 },
        { name: '邏輯性', score: 78 },
      ],
      highlight: '推薦方案邏輯清楚',
      improvement: '北極星指標可更精確',
      coachAnswer: '建議定義 NSM 為「每月完成 ≥5 堂課的學習用戶數」。',
    };
    AppState.circlesStepScores = AppState.circlesStepScores || {};
    AppState.circlesStepScores.S = AppState.circlesScoreResult;
    AppState.circlesPhase = 3;
    if (typeof render === 'function') render();
  });
  await page.waitForTimeout(300);
}

async function jumpToPhase4(page) {
  await jumpToS(page, 'simulation');
  await page.evaluate(() => {
    AppState.circlesPhase = 4;
    AppState.circlesFinalReport = {
      grade: 'B',
      overallScore: 78,
      headline: '具備清楚的方案推薦邏輯，但量化指標可再精煉',
      strengths: ['推薦方案 trade-off 清楚', '北極星指標方向正確', 'Trade-off 對照具體'],
      improvements: ['NSM 應該量化到具體門檻', '追蹤指標需排序優先級'],
      coachVerdict: '整體論述脈絡完整，建議在 NSM 與追蹤指標的可量化、可衡量上再加強。',
      nextSteps: '練習 NSM workshop 加深量化指標訓練。',
    };
    AppState.circlesStepScores = {
      C1: { totalScore: 75 }, I: { totalScore: 78 }, R: { totalScore: 82 },
      C2: { totalScore: 72 }, L: { totalScore: 80 }, E: { totalScore: 76 }, S: { totalScore: 79 },
    };
    if (typeof render === 'function') render();
  });
  await page.waitForTimeout(400);
}

async function main() {
  const findings = {};
  for (const vp of VIEWPORTS) {
    findings[vp.name] = { issues: [], notes: [] };
    const browser = await chromium.launch();
    const ctx = await browser.newContext({
      viewport: { width: vp.w, height: vp.h },
      isMobile: vp.mobile, hasTouch: vp.mobile,
    });
    const page = await ctx.newPage();
    const consoleErrs = [];
    page.on('console', m => { if (m.type() === 'error') consoleErrs.push(m.text()); });
    page.on('pageerror', e => consoleErrs.push('pageerror: ' + e.message));

    // ── S step (Phase 1) ────────────────
    try {
      await jumpToS(page);
      await page.screenshot({ path: `${OUT}/01-s-step-${vp.name}.png`, fullPage: true });
      const sInfo = await page.evaluate(() => {
        const tabs = document.querySelectorAll('.s-step-tab').length;
        const tracking = document.querySelectorAll('.tracking-dim-input').length;
        const nsmAnno = !!document.querySelector('#circles-s-nsm-link');
        const submit = !!document.querySelector('#circles-p1-submit');
        const submitTxt = document.querySelector('#circles-p1-submit')?.textContent?.trim();
        const hasSubmitBar = !!document.querySelector('.circles-submit-bar');
        // overflow check
        const overflow = document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
        return { tabs, tracking, nsmAnno, submit, submitTxt, hasSubmitBar, overflow };
      });
      findings[vp.name].sStep = sInfo;
    } catch (e) {
      findings[vp.name].issues.push('S step navigation failed: ' + e.message);
    }

    // ── Phase 3 score ────────────────
    try {
      await jumpToPhase3(page);
      await page.screenshot({ path: `${OUT}/02-phase3-${vp.name}.png`, fullPage: true });
      const p3 = await page.evaluate(() => {
        const finalBtn = !!document.querySelector('#circles-score-final');
        const finalTxt = document.querySelector('#circles-score-final')?.textContent?.trim();
        const homeBtn = !!document.querySelector('#circles-score-home');
        const navHome = !!document.querySelector('#circles-score-home-btn');
        const radar = !!document.querySelector('svg, canvas, .circles-score-breakdown');
        return { finalBtn, finalTxt, homeBtn, navHome, radar };
      });
      findings[vp.name].phase3 = p3;
    } catch (e) {
      findings[vp.name].issues.push('Phase3 nav failed: ' + e.message);
    }

    // ── Phase 4 final report ────────────────
    try {
      await jumpToPhase4(page);
      await page.screenshot({ path: `${OUT}/03-phase4-${vp.name}.png`, fullPage: true });
      const p4 = await page.evaluate(() => {
        const radar = !!document.querySelector('.report-radar svg, .radar-container svg, canvas');
        const exportPng = !!document.querySelector('#btn-export-png');
        const subTabs = document.querySelectorAll('.s-step-tab').length;
        const trackingBlock = !!document.querySelector('.tracking-block');
        const nsm4dim = !!document.querySelector('.nsm-tracking-block, .nsm-dim, [data-nsm-dim]');
        const stepRows = document.querySelectorAll('div').length; // sentinel
        const headline = document.querySelector('[data-view="circles"]')?.innerText?.includes('總結報告');
        const homeBtn = !!document.querySelector('#circles-final-home');
        const overflow = document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
        return { radar, exportPng, subTabs, trackingBlock, nsm4dim, headline, homeBtn, overflow };
      });
      findings[vp.name].phase4 = p4;
    } catch (e) {
      findings[vp.name].issues.push('Phase4 nav failed: ' + e.message);
    }

    findings[vp.name].consoleErrs = consoleErrs;
    await browser.close();
  }
  console.log(JSON.stringify(findings, null, 2));
}

main().catch(e => { console.error(e); process.exit(1); });
