import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import { setupTestAdmin } from './setup';

const app = createApp();

describe('Auth API (integration)', () => {
  it('GET /auth/setup-status returns needsSetup: true on fresh DB', async () => {
    const res = await request(app).get('/api/v1/auth/setup-status').expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.needsSetup).toBe(true);
  });

  it('POST /auth/setup creates admin user and tenant', async () => {
    const res = await request(app)
      .post('/api/v1/auth/setup')
      .send({
        adminName: 'Test Admin',
        adminEmail: 'admin@test.local',
        adminPassword: 'TestPassword123!',
        companyName: 'Test Corp',
      })
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.refreshToken).toBeDefined();
    expect(res.body.data.account.email).toBe('admin@test.local');
    expect(res.body.data.tenant.name).toBe('Test Corp');
  });

  it('POST /auth/setup fails on second call (already set up)', async () => {
    await setupTestAdmin(app, request);

    const res = await request(app)
      .post('/api/v1/auth/setup')
      .send({
        adminName: 'Another',
        adminEmail: 'another@test.local',
        adminPassword: 'TestPassword123!',
        companyName: 'Another Corp',
      })
      .expect(409);

    expect(res.body.error).toContain('already been set up');
  });

  it('POST /auth/login works after setup', async () => {
    await setupTestAdmin(app, request);

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@test.local', password: 'TestPassword123!' })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.account.email).toBe('admin@test.local');
  });

  it('POST /auth/login rejects wrong password', async () => {
    await setupTestAdmin(app, request);

    await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@test.local', password: 'WrongPassword123!' })
      .expect(401);
  });

  it('GET /auth/me returns current user with valid token', async () => {
    const auth = await setupTestAdmin(app, request);

    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.email).toBe('admin@test.local');
  });

  it('GET /auth/me returns 401 without token', async () => {
    await request(app).get('/api/v1/auth/me').expect(401);
  });

  it('POST /auth/refresh returns new tokens', async () => {
    const auth = await setupTestAdmin(app, request);

    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: auth.refreshToken })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.accessToken).toBeDefined();
  });
});
