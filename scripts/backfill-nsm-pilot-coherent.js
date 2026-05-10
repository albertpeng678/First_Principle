'use strict';
// Pilot backfill — COHERENT NSM examples v2
// Regenerate field_examples for 3 trial questions using new coherent generator.
// Unlike pilot-3, all 7 examples per question reference THE SAME anchor NSM.
//
// Questions:
//   q1  Netflix   — attention type
//   q3  Slack     — saas type
//   q9  Duolingo  — creator type (note: q9 was misclassified as creator in nsm-db,
//                   Duolingo is closer to attention/creator hybrid; generator will handle)
//
// Run: node -r dotenv/config scripts/backfill-nsm-pilot-coherent.js
// Cost estimate: 6 calls total (2 per question) × ~300 tokens/call ≈ $0.06-0.10

require('dotenv').config();
const fs   = require('fs');
const path = require('path');
const vm   = require('vm');

const { generateCoherentNSMExamples, guessProductType } = require('../prompts/nsm-coherent-example');

const NSM_DB_PATH = path.join(__dirname, '..', 'public', 'nsm-db.js');
const PILOT_IDS   = ['q1', 'q3', 'q9'];

// ── Load / Save DB (mirrors backfill-nsm-pilot-3.js) ──────────────────────────
function loadQuestions() {
  const src = fs.readFileSync(NSM_DB_PATH, 'utf8');
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  return sandbox.window.NSM_QUESTIONS;
}

function saveQuestions(questions) {
  const header = '// Auto-generated — do not edit manually\n' +
                 '// Run: node -r dotenv/config scripts/backfill-nsm-context.js to regenerate context fields\n';
  const body   = 'window.NSM_QUESTIONS = ' + JSON.stringify(questions, null, 2) + ';\n';
  fs.writeFileSync(NSM_DB_PATH, header + body, 'utf8');
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const all       = loadQuestions();
  const startTime = Date.now();
  const results   = [];

  for (const qId of PILOT_IDS) {
    const q = all.find(x => x.id === qId);
    if (!q) { console.warn(`Question ${qId} not found, skipping`); continue; }

    const productType = guessProductType(q);
    console.log(`\n[${qId}] ${q.company} (${productType} type)`);
    console.log(`  Generating coherent step2 + step3…`);

    try {
      const coherent = await generateCoherentNSMExamples({ questionJson: q, productType });

      // Overwrite field_examples
      if (!q.field_examples)       q.field_examples       = {};
      if (!q.field_examples.step2) q.field_examples.step2 = {};
      if (!q.field_examples.step3) q.field_examples.step3 = {};

      q.field_examples.step2.nsm          = coherent.step2.nsm;
      q.field_examples.step2.explanation  = coherent.step2.explanation;
      q.field_examples.step2.businessLink = coherent.step2.businessLink;
      q.field_examples.step3.reach        = coherent.step3.reach;
      q.field_examples.step3.depth        = coherent.step3.depth;
      q.field_examples.step3.frequency    = coherent.step3.frequency;
      q.field_examples.step3.impact       = coherent.step3.impact;

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
      console.log(`  ✓ anchor_nsm: ${coherent.anchor_nsm}`);
      console.log(`  ✓ 7 examples written (${elapsed}s elapsed)`);

      results.push({ qId, company: q.company, productType, coherent });

      // Save after each question (fail-safe)
      saveQuestions(all);
      console.log(`  Saved.`);
    } catch (e) {
      console.error(`  ✗ ${qId} failed: ${e.message}`);
    }
  }

  const elapsedMin = ((Date.now() - startTime) / 60000).toFixed(1);
  const totalQ     = results.length;
  console.log(`\nDone. Generated coherent examples for ${totalQ}/${PILOT_IDS.length} questions in ${elapsedMin} min.`);

  // ── Print summary ─────────────────────────────────────────────────────────
  console.log('\n' + '='.repeat(60));
  console.log('COHERENT EXAMPLES SUMMARY — v2 pilot');
  console.log('='.repeat(60));

  for (const { qId, company, productType, coherent } of results) {
    console.log(`\n${'─'.repeat(55)}`);
    console.log(`${qId}  ${company}  (${productType})`);
    console.log(`anchor_nsm: ${coherent.anchor_nsm}`);
    console.log(`${'─'.repeat(55)}`);

    console.log(`\nstep2.nsm:\n${coherent.step2.nsm}`);
    console.log(`\nstep2.explanation:\n${coherent.step2.explanation}`);
    console.log(`\nstep2.businessLink:\n${coherent.step2.businessLink}`);
    console.log(`\nstep3.reach:\n${coherent.step3.reach}`);
    console.log(`\nstep3.depth:\n${coherent.step3.depth}`);
    console.log(`\nstep3.frequency:\n${coherent.step3.frequency}`);
    console.log(`\nstep3.impact:\n${coherent.step3.impact}`);
  }

  // ── Coherence check ───────────────────────────────────────────────────────
  console.log('\n' + '='.repeat(60));
  console.log('COHERENCE VERIFICATION');
  console.log('='.repeat(60));

  for (const { qId, company, coherent } of results) {
    console.log(`\n[${qId}] ${company}`);
    console.log(`  Anchor NSM: "${coherent.anchor_nsm}"`);

    // Extract key terms from anchor_nsm for simple keyword overlap check
    const anchorWords = coherent.anchor_nsm
      .replace(/[（）【】「」、，。：；！？\s]/g, ' ')
      .split(' ')
      .filter(w => w.length >= 2);

    const fields = {
      'step2.nsm':          coherent.step2.nsm,
      'step2.explanation':  coherent.step2.explanation,
      'step2.businessLink': coherent.step2.businessLink,
      'step3.reach':        coherent.step3.reach,
      'step3.depth':        coherent.step3.depth,
      'step3.frequency':    coherent.step3.frequency,
      'step3.impact':       coherent.step3.impact,
    };

    for (const [fieldName, text] of Object.entries(fields)) {
      // Check overlap: does the field mention any anchor word?
      const overlap = anchorWords.filter(w => text.includes(w));
      const mark = overlap.length > 0 ? 'OK' : 'WARN';
      console.log(`  [${mark}] ${fieldName}: ${overlap.length > 0 ? `mentions "${overlap[0]}"` : 'no anchor keyword found'}`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('Run: node -r dotenv/config scripts/backfill-nsm-pilot-coherent.js to regenerate.');
  console.log('Director: check audit/nsm-example-pilot-coherent-2026-05-10.md for side-by-side.');
}

main().catch(e => { console.error(e); process.exit(1); });
