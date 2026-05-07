// TDD RED — written before implementation per superpowers:test-driven-development
const request = require('supertest');
const app = require('../server');

describe('GET /api/guest-circles-stats', () => {
  it('returns 400 without X-Guest-ID header', async () => {
    const res = await request(app).get('/api/guest-circles-stats');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/guest_id/i);
  });

  it('returns 400 with malformed (non-UUIDv4) X-Guest-ID', async () => {
    const res = await request(app)
      .get('/api/guest-circles-stats')
      .set('X-Guest-ID', 'not-a-uuid');
    expect(res.status).toBe(400);
  });

  it('returns { completed, active, weeklyCompleted } shape with valid X-Guest-ID', async () => {
    const guestId = '00000000-0000-4000-8000-000000000999'; // synthetic UUID v4
    const res = await request(app)
      .get('/api/guest-circles-stats')
      .set('X-Guest-ID', guestId);
    expect(res.status).toBe(200);
    expect(typeof res.body.completed).toBe('number');
    expect(typeof res.body.active).toBe('number');
    expect(typeof res.body.weeklyCompleted).toBe('number');
    expect(res.body.completed).toBeGreaterThanOrEqual(0);
    expect(res.body.active).toBeGreaterThanOrEqual(0);
    expect(res.body.weeklyCompleted).toBeGreaterThanOrEqual(0);
  });
});
