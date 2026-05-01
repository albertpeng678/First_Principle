// TDD: Tests written BEFORE implementation (RED phase)
// circles-stats.test.js — Auth route for user CIRCLES statistics

const request = require('supertest');
const app = require('../server');

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
