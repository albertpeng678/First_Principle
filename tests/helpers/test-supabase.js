// tests/helpers/test-supabase.js
// Shared in-memory state + seedSession API for lifecycle contract tests.
//
// The contract test file (tests/contracts/lifecycle-circles-route.test.js)
// must declare jest.mock() calls before importing this helper. This module
// exports the shared store and seedSession so tests can insert/fetch rows
// and stub AI calls.
//
// Pattern: jest.mock() in test file (hoisted) ↔ store imported here.

const { randomUUID: uuidv4 } = require('crypto');

// ── Shared in-memory store ────────────────────────────────────────────────────

const tables = {};   // table name → Map(id → row)
const aiStubs = {};  // kind → result

function getTable(name) {
  if (!tables[name]) tables[name] = new Map();
  return tables[name];
}

// ── seedSession API ───────────────────────────────────────────────────────────

const seedSession = {
  /**
   * Insert a row into the in-memory table. Returns the generated id (string).
   * Caller may pass any subset of fields; defaults fill the rest.
   */
  insert(table, row) {
    const id = uuidv4();
    const defaults = {
      id,
      question_id: 'Q1',
      question_json: { id: 'Q1', problem_statement: 'test question', company: 'TestCo' },
      mode: 'drill',
      drill_step: null,
      current_phase: 1,
      sim_step_index: 0,
      status: 'active',
      step_drafts: {},
      step_scores: { C1: 80, I: 75, R: 70, C2: 65, L: 60, E: 55, S: 50 },
      framework_draft: {},
      gate_result: null,
      conversation: [],
      progress_json: {},
      lifecycle: 'created',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      user_id: null,
      guest_id: null,
    };
    const full = { ...defaults, ...row, id };
    getTable(table).set(id, full);
    // Return id synchronously (the contract test uses await but that's fine)
    return id;
  },

  /**
   * Fetch a row by id from the in-memory table. Returns the row or null.
   */
  fetch(table, id) {
    return getTable(table).get(id) || null;
  },

  /**
   * Stub an AI call for the current test.
   * kind: 'circles-gate' | 'circles-final' | 'nsm-gate' | 'nsm-evaluator'
   */
  stubAi(kind, result) {
    aiStubs[kind] = result;
  },

  /**
   * Reset all in-memory state. Call in beforeEach.
   */
  reset() {
    for (const k of Object.keys(tables)) delete tables[k];
    for (const k of Object.keys(aiStubs)) delete aiStubs[k];
  },
};

// ── DB mock factory ───────────────────────────────────────────────────────────
// Returns a Supabase-like chain that reads/writes the in-memory store.
// Use inside jest.mock('../db/client', () => createMockDb()).

function createMockDb() {
  function makeChain(tableName) {
    let _op = 'select';
    let _payload = null;
    let _filters = [];

    function applyFilters(rows) {
      return rows.filter(row =>
        _filters.every(({ field, value, mode }) => {
          if (mode === 'is') return row[field] === value;
          if (mode === 'neq') return row[field] !== value;
          return row[field] === value; // eq (default)
        })
      );
    }

    function execute(singleMode) {
      const store = getTable(tableName);

      if (_op === 'insert') {
        const id = uuidv4();
        const row = {
          id,
          question_id: 'Q1',
          question_json: { id: 'Q1', problem_statement: 'test question', company: 'TestCo' },
          mode: 'drill',
          drill_step: null,
          current_phase: 1,
          sim_step_index: 0,
          status: 'active',
          step_drafts: {},
          step_scores: { C1: 80, I: 75, R: 70, C2: 65, L: 60, E: 55, S: 50 },
          framework_draft: {},
          gate_result: null,
          conversation: [],
          progress_json: {},
          lifecycle: 'created',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          user_id: null,
          guest_id: null,
          ..._payload,
          id, // always override
        };
        store.set(id, row);
        if (singleMode === 'maybeSingle') return { data: null, error: null }; // idempotency: no existing
        return { data: row, error: null };
      }

      if (_op === 'select') {
        const all = [...store.values()];
        const matched = applyFilters(all);
        if (singleMode === 'single') {
          if (matched.length === 0) return { data: null, error: { code: 'PGRST116', message: 'not_found' } };
          return { data: matched[0], error: null };
        }
        if (singleMode === 'maybeSingle') {
          return { data: matched[0] || null, error: null };
        }
        return { data: matched, error: null };
      }

      if (_op === 'update') {
        const all = [...store.entries()];
        const matched = all.filter(([, row]) =>
          _filters.every(({ field, value, mode }) => {
            if (mode === 'is') return row[field] === value;
            if (mode === 'neq') return row[field] !== value;
            return row[field] === value;
          })
        );
        if (matched.length === 0) {
          if (singleMode === 'maybeSingle') return { data: null, error: null };
          return { data: null, error: null };
        }
        for (const [id, row] of matched) {
          store.set(id, { ...row, ..._payload, updated_at: new Date().toISOString() });
        }
        const updated = store.get(matched[0][0]);
        if (singleMode === 'single') return { data: { id: updated.id }, error: null };
        if (singleMode === 'maybeSingle') return { data: { id: updated.id }, error: null };
        return { data: updated, error: null };
      }

      if (_op === 'delete') {
        const all = [...store.entries()];
        const matched = all.filter(([, row]) =>
          _filters.every(({ field, value, mode }) => {
            if (mode === 'is') return row[field] === value;
            if (mode === 'neq') return row[field] !== value;
            return row[field] === value;
          })
        );
        if (matched.length === 0) {
          if (singleMode === 'single') return { data: null, error: { code: 'PGRST116' } };
          return { data: null, error: null };
        }
        store.delete(matched[0][0]);
        return { data: { id: matched[0][0] }, error: null };
      }

      return { data: null, error: null };
    }

    const chain = {
      from(t) { return makeChain(t); },
      select() {
        // Only switch to SELECT if no write op has been set yet.
        // After insert/update/delete, .select() is a Supabase return-column
        // modifier and should not change the operation type.
        if (_op === 'select') { /* already select — no-op */ }
        return chain;
      },
      insert(data) { _op = 'insert'; _payload = data; return chain; },
      update(data) { _op = 'update'; _payload = data; return chain; },
      delete() { _op = 'delete'; return chain; },
      eq(field, value) { _filters.push({ field, value, mode: 'eq' }); return chain; },
      is(field, value) { _filters.push({ field, value, mode: 'is' }); return chain; },
      neq(field, value) { _filters.push({ field, value, mode: 'neq' }); return chain; },
      order() { return chain; },
      limit() { return chain; },
      single() { return Promise.resolve(execute('single')); },
      maybeSingle() { return Promise.resolve(execute('maybeSingle')); },
      then(resolve, reject) {
        Promise.resolve(execute(null)).then(resolve, reject);
      },
    };
    return chain;
  }

  const db = {
    from(table) { return makeChain(table); },
    auth: {
      async getUser(token) {
        const userId = (token || '').replace(/^Bearer\s+/, '');
        return { data: { user: { id: userId, email: `${userId}@test.com` } }, error: null };
      },
    },
  };
  return db;
}

module.exports = { seedSession, createMockDb, tables, aiStubs };
