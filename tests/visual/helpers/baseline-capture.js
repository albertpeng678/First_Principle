const path = require('path');
const { prepareForCapture } = require('./screenshot');

const MOCKUPS = [
  '00-design-system', '01-circles-home', '02-auth-flow', '03-phase-1-form',
  '04-phase-1-5-gate', '05-phase-2-chat', '06-nsm-step-1', '07-nsm-step-2',
  '08-nsm-step-3-gate', '09-offcanvas-history', '10-onboarding', '11-phase-3-score',
  '12-phase-3-error-loading', '13-phase-4-final', '14-nsm-step-4',
  '15-error-empty-collation', '16-flow-transitions-edge',
];

const VIEWPORTS = [
  { name: 'mobile-360', w: 360, h: 1100 },
  { name: 'tablet-768', w: 768, h: 1100 },
  { name: 'desktop-1280', w: 1280, h: 1100 },
];

const MOCKUP_DIR = path.resolve(__dirname, '../../../docs/superpowers/specs/mockups/2026-05-02-frontend-rewrite');
const BASELINE_DIR = path.resolve(__dirname, '../baselines');

module.exports = { MOCKUPS, VIEWPORTS, MOCKUP_DIR, BASELINE_DIR };
