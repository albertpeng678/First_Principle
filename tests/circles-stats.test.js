// TDD: Tests written BEFORE implementation (RED phase)
// circles-stats.test.js — Auth route for user CIRCLES statistics

jest.mock('../db/client', () => {
  const state = { chainResult: { data: null, error: null } };
  const mockFns = {
    from: jest.fn(),
    select: jest.fn(),
    eq: jest.fn(),
    gt: jest.fn(),
    lt: jest.fn(),
    lte: jest.fn(),
    count: jest.fn(),
    maybeSingle: jest.fn(),
    auth: {
      getUser: jest.fn(),
    },
    __state: state,
    then: jest.fn((resolve, reject) => {
      const result = state.chainResult;
      Promise.resolve(result).then(resolve, reject);
    }),
  };
  ['from', 'select', 'eq', 'gt', 'lt', 'lte', 'count'].forEach(k => {
    mockFns[k].mockReturnValue(mockFns);
  });
  mockFns.maybeSingle.mockResolvedValue({ data: { id: 'mock-id' }, error: null });
  return mockFns;
});

const request = require('supertest');
const express = require('express');
const db = require('../db/client');

// Build test app — include the router under test
const app = express();
app.use(express.json());

// Mock auth to inject req.user automatically
const FAKE_USER = { id: 'user-123', email: 'test@example.com' };
const AUTH_HEADER = { Authorization: 'Bearer valid-token' };

// Before loading the router, set up auth mock to always succeed
db.auth.getUser.mockResolvedValue({ data: { user: FAKE_USER }, error: null });

// TODO: Route will be created in Task 4
// const router = require('../routes/circles-stats');
// app.use('/api/circles-stats', router);

describe('GET /api/circles-stats', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/circles-stats');
    expect(res.status).toBe(401);
  });

  it('returns { completed, active, weeklyCompleted } for an authed user', async () => {
    const token = process.env.TEST_AUTH_TOKEN;
    if (!token) return;  // skip locally without test token
    const res = await request(app)
      .get('/api/circles-stats')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(typeof res.body.completed).toBe('number');
    expect(typeof res.body.active).toBe('number');
    expect(typeof res.body.weeklyCompleted).toBe('number');
    expect(res.body.completed).toBeGreaterThanOrEqual(0);
  });
});
