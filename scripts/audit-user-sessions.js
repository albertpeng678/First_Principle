#!/usr/bin/env node
// Read-only DB audit for user albertpeng678@gmail.com — duplicate sessions,
// stats count mismatch, user_nsm schema variance, field_examples presence.
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const EMAIL = 'albertpeng678@gmail.com';

(async () => {
  // 1) Find user_id by email
  const { data: users, error: uErr } = await supabase.auth.admin.listUsers();
  if (uErr) { console.error('list users err:', uErr); process.exit(1); }
  const me = users.users.find(u => u.email === EMAIL);
  if (!me) { console.error('User not found'); process.exit(1); }
  console.log('USER_ID=' + me.id + ' EMAIL=' + me.email);

  // 2) CIRCLES sessions
  const { data: circles, error: cErr } = await supabase
    .from('circles_sessions')
    .select('id, question_id, status, created_at, updated_at')
    .eq('user_id', me.id)
    .order('created_at', { ascending: false });
  if (cErr) { console.error('circles err:', cErr); }
  console.log('\n=== CIRCLES sessions: count=' + (circles || []).length + ' ===');
  (circles || []).forEach(s => console.log(`  id=${s.id} q=${s.question_id} status=${s.status} created=${s.created_at} updated=${s.updated_at}`));

  // 3) NSM sessions
  const { data: nsm, error: nErr } = await supabase
    .from('nsm_sessions')
    .select('id, question_id, status, created_at, updated_at, user_nsm, user_breakdown')
    .eq('user_id', me.id)
    .order('created_at', { ascending: false });
  if (nErr) { console.error('nsm err:', nErr); }
  console.log('\n=== NSM sessions: count=' + (nsm || []).length + ' ===');
  (nsm || []).forEach(s => {
    const unt = typeof s.user_nsm;
    const unp = s.user_nsm === null ? 'null'
              : (typeof s.user_nsm === 'string' ? `string(len=${s.user_nsm.length})`
              : `object(keys=${Object.keys(s.user_nsm).join(',')})`);
    const ubp = s.user_breakdown === null ? 'null'
              : (typeof s.user_breakdown === 'string' ? `string(len=${s.user_breakdown.length})`
              : `object(keys=${Object.keys(s.user_breakdown).join(',')})`);
    console.log(`  id=${s.id} q=${s.question_id} status=${s.status} created=${s.created_at}`);
    console.log(`    user_nsm: ${unp}`);
    console.log(`    user_breakdown: ${ubp}`);
  });

  // 4) Check duplicate sessions (same user_id + question_id)
  console.log('\n=== Duplicate detection (CIRCLES) ===');
  const cByQ = {};
  (circles || []).forEach(s => { cByQ[s.question_id] = cByQ[s.question_id] || []; cByQ[s.question_id].push(s); });
  for (const qid in cByQ) if (cByQ[qid].length > 1) console.log(`  DUP qid=${qid}: ${cByQ[qid].length} rows`);
  console.log('=== Duplicate detection (NSM) ===');
  const nByQ = {};
  (nsm || []).forEach(s => { nByQ[s.question_id] = nByQ[s.question_id] || []; nByQ[s.question_id].push(s); });
  for (const qid in nByQ) if (nByQ[qid].length > 1) console.log(`  DUP qid=${qid}: ${nByQ[qid].length} rows`);

  // 5) Stats endpoint logic — replicate /api/circles-stats + /api/nsm-stats
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const cCompleted = (circles || []).filter(s => s.status === 'completed').length;
  const cActive    = (circles || []).filter(s => s.status === 'active').length;
  const cWeekly    = (circles || []).filter(s => s.status === 'completed' && s.updated_at >= sevenDaysAgo).length;
  const nCompleted = (nsm || []).filter(s => s.status === 'completed').length;
  const nActive    = (nsm || []).filter(s => s.status === 'active').length;
  const nWeekly    = (nsm || []).filter(s => s.status === 'completed' && s.updated_at >= sevenDaysAgo).length;
  console.log('\n=== Stats replicated ===');
  console.log(`  CIRCLES: completed=${cCompleted} active=${cActive} weekly=${cWeekly}`);
  console.log(`  NSM:     completed=${nCompleted} active=${nActive} weekly=${nWeekly}`);
  console.log(`  Total sessions across both tables: ${(circles || []).length + (nsm || []).length}`);

  // 6) Check whether scored NSM sessions have field_examples in their stored question_json
  console.log('\n=== Stored question_json snapshot vs current circles_database / question bank ===');
  for (const s of (nsm || []).slice(0, 5)) {
    const { data: full } = await supabase.from('nsm_sessions').select('question_json').eq('id', s.id).single();
    if (full && full.question_json) {
      const qj = full.question_json;
      const hasFE = qj.field_examples ? Object.keys(qj.field_examples) : 'MISSING';
      const hasCtx = qj.context ? Object.keys(qj.context) : 'MISSING';
      console.log(`  NSM id=${s.id} qid=${s.question_id}: field_examples=${JSON.stringify(hasFE)} context=${JSON.stringify(hasCtx)}`);
    }
  }
  for (const s of (circles || []).slice(0, 5)) {
    const { data: full } = await supabase.from('circles_sessions').select('question_json').eq('id', s.id).single();
    if (full && full.question_json) {
      const qj = full.question_json;
      const hasFE = qj.field_examples ? Object.keys(qj.field_examples) : 'MISSING';
      console.log(`  CIRCLES id=${s.id} qid=${s.question_id}: field_examples=${JSON.stringify(hasFE)}`);
    }
  }
})().catch(e => { console.error('FATAL', e); process.exit(1); });
