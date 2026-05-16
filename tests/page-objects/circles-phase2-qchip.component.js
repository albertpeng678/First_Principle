// @ts-check
const { expect } = require('@playwright/test');

class CirclesPhase2QchipComponent {
  /** @param {import('@playwright/test').Page} page */
  constructor(page) {
    this.page = page;
    this.qchipBtn   = page.locator('[data-phase2="qchip"]').first();
    this.qchipCaret = this.qchipBtn.locator('.qchip__caret');
    this.qchipPanel = page.locator('[data-phase2="qchip-panel"]').first();
    this.panelType  = this.qchipPanel.locator('.qchip-panel__type');
    this.panelBody  = this.qchipPanel.locator('.qchip-panel__body');
    this.closeBtn   = page.locator('[data-phase2="qchip-panel-close"]').first();
    // 上一步 button — 必須在 input-bar__row 的第一個子元素
    this.inputBarRow      = page.locator('.input-bar__row').first();
    this.inputBarBackBtn  = this.inputBarRow.locator('button[data-phase2="back"]').first();
    this.inputBarTextarea = this.inputBarRow.locator('textarea[data-phase2="message-input"]').first();
  }

  async open() {
    await this.qchipBtn.click();
    await expect(this.qchipPanel).toBeVisible({ timeout: 2000 });
  }

  async close() {
    await this.closeBtn.click();
    await expect(this.qchipPanel).toBeHidden({ timeout: 2000 });
  }

  async toggleViaCaret() {
    await this.qchipBtn.click();
  }

  // Returns 'down' | 'right' | 'up' | 'unknown' based on Phosphor class
  async caretDirection() {
    const cls = await this.qchipCaret.getAttribute('class') || '';
    if (/\bph-caret-down\b/.test(cls)) return 'down';
    if (/\bph-caret-right\b/.test(cls)) return 'right';
    if (/\bph-caret-up\b/.test(cls)) return 'up';
    return 'unknown';
  }

  async ariaExpanded() {
    return this.qchipBtn.getAttribute('aria-expanded');
  }

  async isPhaseBackRowAbsent() {
    return (await this.page.locator('.phase-back-row').count()) === 0;
  }

  // Returns boundingBox Y delta between back btn and textarea
  async backButtonYDelta() {
    const a = await this.inputBarBackBtn.boundingBox();
    const b = await this.inputBarTextarea.boundingBox();
    if (!a || !b) return null;
    return Math.abs(a.y - b.y);
  }
}

module.exports = { CirclesPhase2QchipComponent };
