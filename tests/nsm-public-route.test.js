const request = require('supertest');
const app = require('../server');

describe('POST /api/nsm-public/step2-hint', () => {
  it('returns 400 on missing questionId', async () => {
    const res = await request(app)
      .post('/api/nsm-public/step2-hint')
      .send({ field: 'nsm', userDraft: 'some draft' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('returns 400 on invalid field', async () => {
    const res = await request(app)
      .post('/api/nsm-public/step2-hint')
      .send({ questionId: 'q1', field: 'invalid_field', userDraft: 'some draft' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('returns 404 on unknown questionId', async () => {
    const res = await request(app)
      .post('/api/nsm-public/step2-hint')
      .send({ questionId: 'qX-NOT-FOUND', field: 'nsm', userDraft: 'some draft' });
    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
  });

  it('returns 200 with hint string for valid input', async () => {
    const res = await request(app)
      .post('/api/nsm-public/step2-hint')
      .send({ questionId: 'q1', field: 'nsm', userDraft: '訂閱用戶每月觀看 ≥ 1 集完整內容' });
    expect(res.status).toBe(200);
    expect(typeof res.body.hint).toBe('string');
    expect(res.body.hint.length).toBeGreaterThan(0);
    expect(res.body.hint.length).toBeLessThanOrEqual(320);
  }, 30000);
});
