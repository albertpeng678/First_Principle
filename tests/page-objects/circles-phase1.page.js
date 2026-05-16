// CirclesPhase1Page — POM for the CIRCLES Phase 1 form.
// Per playwright-skill/pom/page-object-model.md:
//   - Constructor takes only Page
//   - Locators are readonly instance properties
//   - Methods perform user actions, return void (or next Locator if needed)
//   - ZERO assertions inside POM (specs assert on returned values)
//
// Selectors discovered from public/app.js (grep 2026-05-16):
//   1. Submit button:    button.btn.btn--primary[data-phase1="submit"]
//                        Text varies: "下一步" (active) | "下一步（請先恢復連線）" (offline-disabled)
//   2. Gate loading:     .gate-content > .gate-loading-wrap
//                        Rendered while circlesGateLoading === true
//   3. Gate result wrap: .gate-content > .gate-wrap
//                        Present when circlesGateResult is set
//   4. Gate status:      .gate-transition (modifier: .gate-transition--ok | --warn | --error)
//                        CSS class encodes overallStatus, confirmed at app.js line 4935
//   5. Input fields:     div.rt-textarea[contenteditable="true"][data-phase1="textarea"]
//                        Each is inside a parent div.field[data-field-key="FIELD_NAME"]
//                        → locator: [data-field-key="KEY"] .rt-textarea[data-phase1="textarea"]
//   6. qcard (question): [data-circles="qcard"][data-qid="QID"]  (click to expand)
//   7. qcard-confirm:    [data-circles="qcard-confirm"][data-qid="QID"] (click to enter Phase 1)
//
// Navigation flow:
//   goto(qid) → page.goto('/') → click qcard → click qcard-confirm → Phase 1 renders
//   (The app is a SPA with no direct URL per question; navigation is AppState-driven)

const { I_FIELDS, C1_FIELDS } = require('../factories/circles-phase1.factory');

class CirclesPhase1Page {
  constructor(page) {
    this.page = page;

    // Locators — readonly. All discovered from public/app.js (see header comments).
    this.submitButton = page.locator('button.btn--primary[data-phase1="submit"]');
    this.gateLoading  = page.locator('.gate-content > .gate-loading-wrap');
    this.gateResult   = page.locator('.gate-content > .gate-wrap');
    this.gateStatus   = page.locator('.gate-transition');
  }

  // Navigate to the CIRCLES home and start Phase 1 for the given question ID.
  // Flow: load SPA → wait for qcard to appear → click to expand → confirm to enter Phase 1.
  // The app is an SPA; there is no direct URL per question — navigation is via AppState.
  async goto(questionId = 'circles_001') {
    await this.page.goto('/');
    // Wait for qcard with this questionId to be present (home renders question cards).
    const qcard = this.page.locator(`[data-circles="qcard"][data-qid="${questionId}"]`);
    await qcard.waitFor({ state: 'visible', timeout: 15_000 });
    // Click qcard to expand it (reveals cancel + confirm buttons).
    await qcard.click();
    // Click confirm to enter Phase 1.
    const confirm = this.page.locator(`[data-circles="qcard-confirm"][data-qid="${questionId}"]`);
    await confirm.click();
    // Wait for Phase 1 form to render (submit button is the sentinel).
    await this.submitButton.waitFor({ state: 'visible', timeout: 10_000 });
  }

  // Fill I-step fields (目標用戶分群 / 選定焦點對象 / 用戶動機假設(JTBD) / 排除對象).
  // values: { '目標用戶分群': '...', '選定焦點對象': '...', ... }
  // Iterates I_FIELDS so order matches factory + production (single source of truth).
  // Fields are contenteditable divs — Playwright fill() works on contenteditable.
  async fillI(values) {
    for (const field of I_FIELDS) {
      const v = (values && values[field]) || '';
      const el = this.page.locator(`[data-field-key="${field}"] .rt-textarea[data-phase1="textarea"]`);
      await el.fill(v);
    }
  }

  // Fill C1-step fields (問題範圍 / 時間範圍 / 業務影響 / 假設確認).
  // values: { '問題範圍': '...', '時間範圍': '...', ... }
  async fillC1(values) {
    for (const field of C1_FIELDS) {
      const v = (values && values[field]) || '';
      const el = this.page.locator(`[data-field-key="${field}"] .rt-textarea[data-phase1="textarea"]`);
      await el.fill(v);
    }
  }

  // Fill both I and C1 fields from a factory payload: { I: {...}, C1: {...} }.
  async fillAll(payload) {
    if (payload && payload.I)  await this.fillI(payload.I);
    if (payload && payload.C1) await this.fillC1(payload.C1);
  }

  // Click the submit button once (triggers gate evaluation).
  async submitGate() {
    await this.submitButton.click();
  }

  // Double-click the submit button (race condition proof test — B6).
  // dblclick fires both clicks in rapid succession within a single user gesture.
  async submitGateRapidDouble() {
    await this.submitButton.dblclick();
  }

  // Read the gate overall status after evaluation completes.
  // Waits up to 30 s for .gate-transition to appear (AI eval takes 8-12 s typically).
  // Returns 'ok' | 'warn' | 'error' | null
  // ZERO assertions — spec asserts on the returned string.
  async getGateStatus() {
    try {
      await this.gateStatus.waitFor({ state: 'visible', timeout: 30_000 });
    } catch (_) {
      return null;
    }
    const cls = await this.gateStatus.getAttribute('class').catch(() => null);
    if (!cls) return null;
    if (cls.includes('gate-transition--error')) return 'error';
    if (cls.includes('gate-transition--warn'))  return 'warn';
    if (cls.includes('gate-transition--ok'))    return 'ok';
    return null;
  }
}

module.exports = { CirclesPhase1Page };
