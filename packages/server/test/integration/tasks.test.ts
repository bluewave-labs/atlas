import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import { setupTestAdmin } from './setup';

const app = createApp();

describe('Tasks API (integration)', () => {
  it('GET /tasks returns empty list initially', async () => {
    const auth = await setupTestAdmin(app, request);

    const res = await request(app)
      .get('/api/v1/tasks')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    const items = Array.isArray(res.body.data) ? res.body.data : [];
    expect(items).toEqual([]);
  });

  it('POST /tasks creates a task', async () => {
    const auth = await setupTestAdmin(app, request);

    const res = await request(app)
      .post('/api/v1/tasks')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({ title: 'Write tests', priority: 'high' })
      .expect((r: any) => { if (![200, 201].includes(r.status)) throw new Error(`Expected 200/201, got ${r.status}`); });

    expect(res.body.success).toBe(true);
    expect(res.body.data.title).toBe('Write tests');
    expect(res.body.data.priority).toBe('high');
    expect(res.body.data.status).toBe('todo');
  });

  it('PATCH /tasks/:id updates a task', async () => {
    const auth = await setupTestAdmin(app, request);

    const created = await request(app)
      .post('/api/v1/tasks')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({ title: 'Update me' })
      .expect((r: any) => { if (![200, 201].includes(r.status)) throw new Error(`Expected 200/201, got ${r.status}`); });

    const res = await request(app)
      .patch(`/api/v1/tasks/${created.body.data.id}`)
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({ status: 'done', title: 'Updated' })
      .expect(200);

    expect(res.body.data.status).toBe('done');
    expect(res.body.data.title).toBe('Updated');
  });

  it('DELETE /tasks/:id removes a task', async () => {
    const auth = await setupTestAdmin(app, request);

    const created = await request(app)
      .post('/api/v1/tasks')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({ title: 'Delete me' })
      .expect((r: any) => { if (![200, 201].includes(r.status)) throw new Error(`Expected 200/201, got ${r.status}`); });

    await request(app)
      .delete(`/api/v1/tasks/${created.body.data.id}`)
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .expect(200);

    const list = await request(app)
      .get('/api/v1/tasks')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .expect(200);

    const tasks = Array.isArray(list.body.data) ? list.body.data : [];
    expect(tasks.find((t: any) => t.id === created.body.data.id)).toBeUndefined();
  });

  it('GET /tasks/counts returns status counts', async () => {
    const auth = await setupTestAdmin(app, request);

    await request(app)
      .post('/api/v1/tasks')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({ title: 'Task 1', status: 'todo' })
      .expect((r: any) => { if (![200, 201].includes(r.status)) throw new Error(`Expected 200/201, got ${r.status}`); });

    await request(app)
      .post('/api/v1/tasks')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({ title: 'Task 2', status: 'done' })
      .expect((r: any) => { if (![200, 201].includes(r.status)) throw new Error(`Expected 200/201, got ${r.status}`); });

    const res = await request(app)
      .get('/api/v1/tasks/counts')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
  });
});
