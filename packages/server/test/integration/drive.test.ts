import { describe, it, expect } from 'vitest';
import request from 'supertest';
import path from 'path';
import fs from 'fs';
import { createApp } from '../../src/app';
import { setupTestAdmin } from './setup';

const app = createApp();

// Create a small test file for upload tests
const TEST_FILE_PATH = path.join(__dirname, 'test-upload.txt');
fs.writeFileSync(TEST_FILE_PATH, 'Hello, this is a test file for drive upload.');

describe('Drive API (integration)', () => {
  it('GET /drive returns empty list initially', async () => {
    const auth = await setupTestAdmin(app, request);

    const res = await request(app)
      .get('/api/v1/drive')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    const items = Array.isArray(res.body.data) ? res.body.data : res.body.data?.items || [];
    expect(items).toEqual([]);
  });

  it('POST /drive/folder creates a folder', async () => {
    const auth = await setupTestAdmin(app, request);

    const res = await request(app)
      .post('/api/v1/drive/folder')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({ name: 'My Folder' })
      .expect((r: any) => { if (![200, 201].includes(r.status)) throw new Error(`Expected 200/201, got ${r.status}`); });

    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('My Folder');
    expect(res.body.data.type).toBe('folder');
  });

  it('POST /drive/upload uploads a file', async () => {
    const auth = await setupTestAdmin(app, request);

    const res = await request(app)
      .post('/api/v1/drive/upload')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .attach('files', TEST_FILE_PATH)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].name).toContain('test-upload');
  });

  it('uploaded file appears in listing', async () => {
    const auth = await setupTestAdmin(app, request);

    await request(app)
      .post('/api/v1/drive/upload')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .attach('files', TEST_FILE_PATH);

    const res = await request(app)
      .get('/api/v1/drive')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .expect(200);

    const items = Array.isArray(res.body.data) ? res.body.data : res.body.data?.items || [];
    expect(items.length).toBeGreaterThanOrEqual(1);
  });

  it('DELETE /drive/:id soft-deletes an item', async () => {
    const auth = await setupTestAdmin(app, request);

    const folderRes = await request(app)
      .post('/api/v1/drive/folder')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({ name: 'Trash Me' })
      .expect((r: any) => { if (![200, 201].includes(r.status)) throw new Error(`Expected 200/201, got ${r.status}`); });

    await request(app)
      .delete(`/api/v1/drive/${folderRes.body.data.id}`)
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .expect(200);

    // Should appear in trash
    const trashRes = await request(app)
      .get('/api/v1/drive/trash')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .expect(200);

    const trashItems = Array.isArray(trashRes.body.data) ? trashRes.body.data : trashRes.body.data?.items || [];
    const found = trashItems.find((i: any) => i.id === folderRes.body.data.id);
    expect(found).toBeDefined();
  });

  it('GET /drive/storage returns usage stats', async () => {
    const auth = await setupTestAdmin(app, request);

    const res = await request(app)
      .get('/api/v1/drive/storage')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty(res.body.data.totalBytes !== undefined ? 'totalBytes' : 'totalSize');
    expect(res.body.data).toHaveProperty('fileCount');
  });
});
