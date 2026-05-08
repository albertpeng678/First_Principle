// tests/visual/capture-prod-mockup-01-pngs.spec.js
// Capture production CIRCLES Home renders across 8 viewports.
// Output: audit/png-prod-mockup-01/section-{A,B,C}-{vp}.png — 24 PNGs.
// Mockup: docs/superpowers/specs/mockups/2026-05-02-frontend-rewrite/01-circles-home.html
//
// Sections:
//   A  — guest home (no accessToken, no session, no question) — simulation mode default
//   B  — authed signed-in home (email visible, signed-in state, recent sessions strip)
//   C  — drill mode home with 5 questions displayed (q-cards list)

const { test } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const OUT_DIR = path.resolve(__dirname, '../../audit/png-prod-mockup-01');

const SAMPLE_QUESTIONS = [
  {
    id: 'circles_001',
    company: 'Spotify',
    product: 'Spotify Podcast',
    question_type: 'design',
    difficulty: 'medium',
    problem_statement: '設計一個新功能，提升用戶在 Spotify 上的 Podcast 體驗，並增加用戶的黏著度。',
  },
  {
    id: 'circles_002',
    company: 'Notion',
    product: '工作協作',
    question_type: 'design',
    difficulty: 'hard',
    problem_statement: '設計一個功能，讓 Notion 用戶能夠更好地在團隊中協作。',
  },
  {
    id: 'circles_003',
    company: 'Airbnb',
    product: 'Marketplace 擴展',
    question_type: 'strategy',
    difficulty: 'medium',
    problem_statement: '為 Airbnb 設計一個策略，擴展其在亞洲市場的業務。',
  },
  {
    id: 'circles_004',
    company: 'Line',
    product: 'Line Pay',
    question_type: 'improve',
    difficulty: 'easy',
    problem_statement: '如何提升 Line Pay 的用戶黏著度與每月使用頻次？',
  },
  {
    id: 'circles_005',
    company: 'Grab',
    product: 'Food Delivery',
    question_type: 'improve',
    difficulty: 'medium',
    problem_statement: '如何改善 Grab Food 的送餐準時率並提升用戶滿意度？',
  },
];

const VIEWPORTS = [
  { name: 'Mobile-360',    width: 360,  height: 900 },
  { name: 'iPhone-SE',     width: 375,  height: 900 },
  { name: 'iPhone-14',     width: 390,  height: 900 },
  { name: 'iPhone-15-Pro', width: 430,  height: 900 },
  { name: 'iPad',          width: 768,  height: 900 },
  { name: 'Desktop-1280',  width: 1280, height: 900 },
  { name: 'Desktop-1440',  width: 1440, height: 900 },
  { name: 'Desktop-2560',  width: 2560, height: 900 },
];

async function mockApis(page) {
  await page.route('**/api/guest-circles-stats**', r => r.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ completed: 3, active: 1, thisWeek: 2 }),
  }));
  await page.route('**/api/circles-stats**', r => r.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ completed: 12, active: 2, thisWeek: 4 }),
  }));
  await page.route('**/api/guest-circles-sessions**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/circles-sessions**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/guest/nsm-sessions**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/nsm-sessions**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/guest-nsm-sessions**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
}

test.describe('capture-prod-mockup-01 — 24 production PNGs', () => {
  test.setTimeout(180000);

  test('Section A — guest home (simulation mode default) × 8 viewports', async ({ page }) => {
    if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
    await mockApis(page);

    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/');
      await page.waitForSelector('.navbar');

      await page.evaluate((qs) => {
        Object.assign(window.AppState, {
          view: 'circles',
          circlesPhase: 1,
          circlesMode: 'simulation',
          circlesDrillStep: null,
          circlesSelectedQuestion: null,
          circlesSession: null,
          accessToken: null,
          guestId: 'guest-test-001',
          circlesDisplayedQuestions: qs,
          circlesTypeFilter: 'design',
          circlesSearchText: '',
          circlesQaOpen: false,
          onboardingComplete: true,
          onboardingActive: false,
        });
        window.renderApp();
      }, SAMPLE_QUESTIONS);

      await page.waitForSelector('.mode-card', { timeout: 5000 });
      await page.waitForTimeout(300);
      await page.screenshot({
        path: path.join(OUT_DIR, 'section-A-' + vp.name + '.png'),
        fullPage: false,
      });
    }
  });

  test('Section B — authed signed-in home × 8 viewports', async ({ page }) => {
    if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
    await mockApis(page);

    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/');
      await page.waitForSelector('.navbar');

      await page.evaluate((qs) => {
        Object.assign(window.AppState, {
          view: 'circles',
          circlesPhase: 1,
          circlesMode: 'simulation',
          circlesDrillStep: null,
          circlesSelectedQuestion: null,
          circlesSession: null,
          accessToken: 'mock-jwt-token-authed',
          userEmail: 'user@example.com',
          guestId: null,
          circlesDisplayedQuestions: qs,
          circlesTypeFilter: 'design',
          circlesSearchText: '',
          circlesQaOpen: false,
          circlesRecentSessions: [],
          onboardingComplete: true,
          onboardingActive: false,
        });
        window.renderApp();
      }, SAMPLE_QUESTIONS);

      await page.waitForSelector('.mode-card', { timeout: 5000 });
      await page.waitForTimeout(300);
      await page.screenshot({
        path: path.join(OUT_DIR, 'section-B-' + vp.name + '.png'),
        fullPage: false,
      });
    }
  });

  test('Section C — drill mode home with 5 questions × 8 viewports', async ({ page }) => {
    if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
    await mockApis(page);

    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/');
      await page.waitForSelector('.navbar');

      await page.evaluate((qs) => {
        Object.assign(window.AppState, {
          view: 'circles',
          circlesPhase: 1,
          circlesMode: 'drill',
          circlesDrillStep: null,
          circlesSelectedQuestion: null,
          circlesSession: null,
          accessToken: null,
          guestId: 'guest-test-001',
          circlesDisplayedQuestions: qs,
          circlesTypeFilter: 'design',
          circlesSearchText: '',
          circlesQaOpen: false,
          circlesExpandedQid: null,
          onboardingComplete: true,
          onboardingActive: false,
        });
        window.renderApp();
      }, SAMPLE_QUESTIONS);

      await page.waitForSelector('.mode-card.is-active', { timeout: 5000 });
      await page.waitForTimeout(300);
      await page.screenshot({
        path: path.join(OUT_DIR, 'section-C-' + vp.name + '.png'),
        fullPage: false,
      });
    }
  });
});
