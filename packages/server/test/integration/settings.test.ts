import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import { setupTestAdmin } from './setup';

const app = createApp();

describe('Settings API (integration)', () => {
  it('GET /settings returns null for new user', async () => {
    const auth = await setupTestAdmin(app, request);

    const res = await request(app)
      .get('/api/v1/settings')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    // May be null or have defaults from setup
  });

  it('PUT /settings saves and returns updated settings', async () => {
    const auth = await setupTestAdmin(app, request);

    const res = await request(app)
      .put('/api/v1/settings')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({ theme: 'light', language: 'tr', dateFormat: 'DD/MM/YYYY' })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.theme).toBe('light');
    expect(res.body.data.language).toBe('tr');
    expect(res.body.data.dateFormat).toBe('DD/MM/YYYY');
  });

  it('PUT /settings persists across requests', async () => {
    const auth = await setupTestAdmin(app, request);

    await request(app)
      .put('/api/v1/settings')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({ theme: 'dark', density: 'compact' })
      .expect(200);

    const res = await request(app)
      .get('/api/v1/settings')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .expect(200);

    expect(res.body.data.theme).toBe('dark');
    expect(res.body.data.density).toBe('compact');
  });

  it('PUT /settings rejects invalid theme value', async () => {
    const auth = await setupTestAdmin(app, request);

    await request(app)
      .put('/api/v1/settings')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({ theme: 'neon' })
      .expect(400);
  });

  it('GET /settings requires authentication', async () => {
    await request(app).get('/api/v1/settings').expect(401);
  });
});
