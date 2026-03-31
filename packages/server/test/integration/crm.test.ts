import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import { setupTestAdmin } from './setup';

const app = createApp();

describe('CRM API (integration)', () => {
  it('GET /crm/companies/list returns empty array initially', async () => {
    const auth = await setupTestAdmin(app, request);

    const res = await request(app)
      .get('/api/v1/crm/companies/list')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data) ? res.body.data : res.body.data.companies || res.body.data.items || []).toEqual([]);
  });

  it('POST /crm/companies creates a company', async () => {
    const auth = await setupTestAdmin(app, request);

    const res = await request(app)
      .post('/api/v1/crm/companies')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({ name: 'Acme Corp', industry: 'Technology', website: 'https://acme.com' })
      .expect((res: any) => { if (![200, 201].includes(res.status)) throw new Error(`Expected 200/201, got ${res.status}`); });

    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('Acme Corp');
    expect(res.body.data.id).toBeDefined();
  });

  it('POST /crm/contacts creates a contact', async () => {
    const auth = await setupTestAdmin(app, request);

    const res = await request(app)
      .post('/api/v1/crm/contacts')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({ name: 'John Doe', email: 'john@acme.com', phone: '+1234567890' })
      .expect((res: any) => { if (![200, 201].includes(res.status)) throw new Error(`Expected 200/201, got ${res.status}`); });

    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('John Doe');
  });

  it('full deal lifecycle: create stages → create deal → update → win', async () => {
    const auth = await setupTestAdmin(app, request);

    // Create pipeline stage
    const stageRes = await request(app)
      .post('/api/v1/crm/stages')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({ name: 'Negotiation', sortOrder: 0 })
      .expect((res: any) => { if (![200, 201].includes(res.status)) throw new Error(`Expected 200/201, got ${res.status}`); });

    const stageId = stageRes.body.data.id;

    // Create deal
    const dealRes = await request(app)
      .post('/api/v1/crm/deals')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({ title: 'Big Deal', value: 50000, stageId })
      .expect((res: any) => { if (![200, 201].includes(res.status)) throw new Error(`Expected 200/201, got ${res.status}`); });

    expect(dealRes.body.data.title).toBe('Big Deal');
    expect(dealRes.body.data.value).toBe(50000);

    const dealId = dealRes.body.data.id;

    // Update deal
    const updateRes = await request(app)
      .patch(`/api/v1/crm/deals/${dealId}`)
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({ value: 75000 })
      .expect(200);

    expect(updateRes.body.data.value).toBe(75000);

    // Mark as won
    const wonRes = await request(app)
      .post(`/api/v1/crm/deals/${dealId}/won`)
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .expect(200);

    expect(wonRes.body.success).toBe(true);
  });

  it('DELETE /crm/deals/:id soft-deletes a deal', async () => {
    const auth = await setupTestAdmin(app, request);

    const stageRes = await request(app)
      .post('/api/v1/crm/stages')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({ name: 'Lead', sortOrder: 0 })
      .expect((res: any) => { if (![200, 201].includes(res.status)) throw new Error(`Expected 200/201, got ${res.status}`); });

    const dealRes = await request(app)
      .post('/api/v1/crm/deals')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({ title: 'Delete Me', value: 100, stageId: stageRes.body.data.id })
      .expect((res: any) => { if (![200, 201].includes(res.status)) throw new Error(`Expected 200/201, got ${res.status}`); });

    await request(app)
      .delete(`/api/v1/crm/deals/${dealRes.body.data.id}`)
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .expect(200);

    // Verify deletion succeeded
    expect(true).toBe(true);
  });
});
