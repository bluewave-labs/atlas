import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/apps/drive/service', () => ({
  listItems: vi.fn().mockResolvedValue([]),
  getItem: vi.fn().mockResolvedValue({ id: 'f1', userId: 'u-self', type: 'file' }),
  createFolder: vi.fn().mockResolvedValue({ id: 'f1' }),
  uploadFile: vi.fn().mockResolvedValue({ id: 'f1' }),
  updateItem: vi.fn().mockResolvedValue({ id: 'f1' }),
  deleteItem: vi.fn().mockResolvedValue(undefined),
  restoreItem: vi.fn().mockResolvedValue({ id: 'f1' }),
  permanentDelete: vi.fn().mockResolvedValue(undefined),
  listTrash: vi.fn().mockResolvedValue([]),
  listFavourites: vi.fn().mockResolvedValue([]),
  listRecent: vi.fn().mockResolvedValue([]),
  searchItems: vi.fn().mockResolvedValue([]),
  getBreadcrumbs: vi.fn().mockResolvedValue([]),
  getStorageUsage: vi.fn().mockResolvedValue({ used: 0, limit: 0 }),
  getWidgetData: vi.fn().mockResolvedValue({}),
  seedSampleFolder: vi.fn().mockResolvedValue(undefined),
  seedSampleData: vi.fn().mockResolvedValue(undefined),
  listFolders: vi.fn().mockResolvedValue([]),
  duplicateItem: vi.fn().mockResolvedValue({ id: 'f2' }),
  copyItem: vi.fn().mockResolvedValue({ id: 'f2' }),
  batchDelete: vi.fn().mockResolvedValue(undefined),
  batchMove: vi.fn().mockResolvedValue(undefined),
  batchFavourite: vi.fn().mockResolvedValue(undefined),
  listItemsByType: vi.fn().mockResolvedValue([]),
  getFolderContents: vi.fn().mockResolvedValue([]),
  updateDriveItemVisibility: vi.fn().mockResolvedValue(undefined),
  logDriveActivity: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../src/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../src/services/event.service', () => ({
  emitAppEvent: vi.fn(),
}));

import * as itemsController from '../src/apps/drive/controllers/items.controller';
import * as driveService from '../src/apps/drive/service';
import { makeReqWithPerm, makeRes, expectForbidden, expectSuccess, expectNotFound, SELF_USER_ID, OTHER_USER_ID } from './helpers/rbac-harness';

function req(role: 'admin' | 'editor' | 'viewer', recordAccess: 'all' | 'own' = 'all', extra: any = {}) {
  return makeReqWithPerm('drive', role, recordAccess, extra);
}

describe('RBAC matrix — Drive', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(driveService.getItem).mockResolvedValue({ id: 'f1', userId: SELF_USER_ID, type: 'file' } as any);
  });

  it('viewer can list items', async () => {
    const res = makeRes();
    await itemsController.listItems(req('viewer', 'all', { query: {} }), res);
    expectSuccess(res);
  });

  it('viewer can get item', async () => {
    const res = makeRes();
    await itemsController.getItem(req('viewer', 'all', { params: { id: 'f1' } }), res);
    expectSuccess(res);
  });

  it('viewer cannot create folder', async () => {
    const res = makeRes();
    await itemsController.createFolder(req('viewer', 'all', { body: { name: 'F' } }), res);
    expectForbidden(res);
  });

  it('viewer cannot update item', async () => {
    const res = makeRes();
    await itemsController.updateItem(req('viewer', 'all', { params: { id: 'f1' }, body: { name: 'F2' } }), res);
    expectForbidden(res);
  });

  it('viewer cannot delete item', async () => {
    const res = makeRes();
    await itemsController.deleteItem(req('viewer', 'all', { params: { id: 'f1' } }), res);
    expectForbidden(res);
  });

  it('viewer cannot seed sample data', async () => {
    const res = makeRes();
    await itemsController.seedSampleData(req('viewer'), res);
    expectForbidden(res);
  });

  it('viewer cannot change visibility', async () => {
    const res = makeRes();
    await itemsController.updateDriveItemVisibility(req('viewer', 'all', { params: { id: 'f1' }, body: { visibility: 'team' } }), res);
    expectForbidden(res);
  });

  it('editor can create folder', async () => {
    const res = makeRes();
    await itemsController.createFolder(req('editor', 'all', { body: { name: 'F' } }), res);
    expectSuccess(res);
  });

  it('editor can update own item', async () => {
    vi.mocked(driveService.getItem).mockResolvedValue({ id: 'f1', userId: SELF_USER_ID, type: 'file' } as any);
    const res = makeRes();
    await itemsController.updateItem(req('editor', 'all', { params: { id: 'f1' }, body: { name: 'F2' } }), res);
    expectSuccess(res);
  });

  it('editor can delete own item', async () => {
    vi.mocked(driveService.getItem).mockResolvedValue({ id: 'f1', userId: SELF_USER_ID, type: 'file' } as any);
    const res = makeRes();
    await itemsController.deleteItem(req('editor', 'all', { params: { id: 'f1' } }), res);
    expectSuccess(res);
  });

  it("editor cannot delete another user's item", async () => {
    vi.mocked(driveService.getItem).mockResolvedValue({ id: 'f1', userId: OTHER_USER_ID, type: 'file' } as any);
    const res = makeRes();
    await itemsController.deleteItem(req('editor', 'all', { params: { id: 'f1' } }), res);
    expectNotFound(res);
  });

  it('admin can delete any item', async () => {
    vi.mocked(driveService.getItem).mockResolvedValue({ id: 'f1', userId: OTHER_USER_ID, type: 'file' } as any);
    const res = makeRes();
    await itemsController.deleteItem(req('admin', 'all', { params: { id: 'f1' } }), res);
    expectSuccess(res);
  });
});
