import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import { setupTestAdmin } from './setup';

const app = createApp();

describe('System API (integration)', () => {
  it('GET /system/metrics returns system info', async () => {
    const auth = await setupTestAdmin(app, request);

    const res = await request(app)
      .get('/api/v1/system/metrics')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.cpu).toBeDefined();
    expect(res.body.data.memory).toBeDefined();
    expect(res.body.data.disk).toBeDefined();
    expect(res.body.data.os).toBeDefined();
    expect(res.body.data.node.version).toContain('v');
  });

  it('GET /system/email-settings returns settings for admin', async () => {
    const auth = await setupTestAdmin(app, request);

    const res = await request(app)
      .get('/api/v1/system/email-settings')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('smtpHost');
    expect(res.body.data).toHaveProperty('smtpPort');
    expect(res.body.data).toHaveProperty('smtpEnabled');
  });

  it('PUT /system/email-settings updates SMTP config', async () => {
    const auth = await setupTestAdmin(app, request);

    const res = await request(app)
      .put('/api/v1/system/email-settings')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({ smtpHost: 'smtp.test.com', smtpPort: 465, smtpSecure: true })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.smtpHost).toBe('smtp.test.com');
    expect(res.body.data.smtpPort).toBe(465);
    expect(res.body.data.smtpSecure).toBe(true);
  });

  it('GET /health returns ok without auth', async () => {
    const res = await request(app).get('/api/v1/health').expect(200);

    expect(res.body.status).toBe('ok');
    expect(res.body.uptime).toBeGreaterThanOrEqual(0);
    expect(res.body.memory).toBeDefined();
  });
});
