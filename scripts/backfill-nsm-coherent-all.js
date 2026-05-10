'use strict';
// backfill-nsm-coherent-all.js
// Full-run coherent NSM example backfill for ALL 103 questions in nsm-db.js.
// Adapted from backfill-nsm-pilot-coherent.js — removes [q1, q3, q9] filter,
// adds chunked parallel processing (4 concurrent), progress logging, skip-on-failure.
//
// Run: node -r dotenv/config scripts/backfill-nsm-coherent-all.js
// Expected: 103 questions × 2 calls × ~5-7s ≈ 10-15 min at 4 concurrent
// Cost estimate: 206 calls × ~700 tokens avg ≈ $1.50-2.50

require('dotenv').config();
const fs   = require('fs');
const path = require('path');
const vm   = require('vm');

const { generateCoherentNSMExamples, guessProductType } = require('../prompts/nsm-coherent-example');

const NSM_DB_PATH  = path.join(__dirname, '..', 'public', 'nsm-db.js');
const CONCURRENCY  = 4; // 3-5 per spec; 4 is sweet spot for gpt-4o rate limit

// ── Load / Save DB (mirrors backfill-nsm-pilot-coherent.js) ──────────────────
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

// ── Process a single question — returns { success: bool, qId, error? } ───────
async function processQuestion(q, idx, total, all) {
  const productType = guessProductType(q);
  console.log(`[${idx + 1}/${total}] Processing q${q.id} (${q.company}) — ${productType}`);

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

    console.log(`  OK  [${idx + 1}/${total}] ${q.id} (${q.company}) — anchor: ${coherent.anchor_nsm}`);

    // Save after each successful question (fail-safe checkpoint)
    saveQuestions(all);

    return { success: true, qId: q.id, company: q.company };
  } catch (e) {
    console.error(`  FAIL [${idx + 1}/${total}] ${q.id} (${q.company}): ${e.message}`);
    return { success: false, qId: q.id, company: q.company, error: e.message };
  }
}

// ── Chunk array into groups of size n ─────────────────────────────────────────
function chunk(arr, n) {
  const result = [];
  for (let i = 0; i < arr.length; i += n) result.push(arr.slice(i, i + n));
  return result;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const all       = loadQuestions();
  const total     = all.length;
  const startTime = Date.now();

  console.log(`\nBackfill started — ${total} questions, ${CONCURRENCY} concurrent`);
  console.log(`Model: gpt-4o | Estimated time: 10-20 min | Cost: ~$1.50-2.50\n`);

  const successes = [];
  const failures  = [];

  // Process in chunks of CONCURRENCY (parallel within chunk, sequential between)
  const chunks = chunk(all, CONCURRENCY);

  for (let ci = 0; ci < chunks.length; ci++) {
    const chunkQuestions = chunks[ci];
    const chunkResults   = await Promise.all(
      chunkQuestions.map((q, localIdx) => {
        const globalIdx = ci * CONCURRENCY + localIdx;
        return processQuestion(q, globalIdx, total, all);
      })
    );

    for (const r of chunkResults) {
      if (r.success) successes.push(r);
      else            failures.push(r);
    }

    // Small pause between chunks to respect rate limits
    if (ci < chunks.length - 1) {
      await new Promise(r => setTimeout(r, 500));
    }
  }

  const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(0);
  const elapsedMin = (elapsedSec / 60).toFixed(1);

  // ── Final save (already saved incrementally, but ensure last chunk is flushed) ──
  saveQuestions(all);

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n' + '='.repeat(65));
  console.log('BACKFILL SUMMARY — v3.1 coherent examples — ALL questions');
  console.log('='.repeat(65));
  console.log(`  Success : ${successes.length}/${total}`);
  console.log(`  Fail    : ${failures.length}/${total}`);
  console.log(`  Time    : ${elapsedMin} min (${elapsedSec}s)`);
  console.log(`  Cost est: ~$${(total * 2 * 700 * 0.000005).toFixed(2)} (gpt-4o $5/1M tok, avg 700 tok/call)`);

  if (failures.length > 0) {
    console.log('\nFailed questions:');
    for (const f of failures) {
      console.log(`  - ${f.qId} (${f.company}): ${f.error}`);
    }
  }

  console.log('\n' + '='.repeat(65));
  console.log(`nsm-db.js written: ${fs.statSync(NSM_DB_PATH).size} bytes`);
  console.log('='.repeat(65));
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
