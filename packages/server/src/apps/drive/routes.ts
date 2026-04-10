import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import * as driveController from './controller';
import { authMiddleware } from '../../middleware/auth';
import googleDriveRoutes from './routes-google';

const uploadsDir = path.join(__dirname, '../../../uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    // Scope uploads by tenant for isolation on disk
    const tenantId = (req as any).auth?.tenantId || 'shared';
    const tenantDir = path.join(uploadsDir, tenantId);
    fs.mkdir(tenantDir, { recursive: true }, (err) => cb(err, tenantDir));
  },
  filename: (_req, file, cb) => {
    const userId = (_req as any).auth?.userId || 'anon';
    const timestamp = Date.now();
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${userId}_${timestamp}_${safeName}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB
});

// Multer error handler
function handleMulterError(err: any, _req: Request, res: Response, next: NextFunction) {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      res.status(413).json({ success: false, error: 'File too large. Maximum size is 500 MB.' });
      return;
    }
    res.status(400).json({ success: false, error: err.message });
    return;
  }
  if (err) {
    res.status(500).json({ success: false, error: 'Upload failed' });
    return;
  }
  next();
}

const router = Router();
router.use(authMiddleware);
router.use('/google', googleDriveRoutes);

router.get('/widget', driveController.getWidgetData);
router.get('/', driveController.listItems);
router.post('/folder', driveController.createFolder);
router.post('/upload', upload.array('files', 20), handleMulterError, driveController.uploadFiles);
router.get('/search', driveController.searchItems);
router.get('/trash', driveController.listTrash);
router.get('/favourites', driveController.listFavourites);
router.get('/recent', driveController.listRecent);
router.get('/folders', driveController.listFolders);
router.get('/storage', driveController.getStorageUsage);
router.get('/by-type', driveController.listItemsByType);
router.post('/batch/delete', driveController.batchDelete);
router.post('/batch/move', driveController.batchMove);
router.post('/batch/favourite', driveController.batchFavourite);
router.post('/seed', driveController.seedSampleData);
router.post('/create-document', driveController.createLinkedDocument);
router.post('/create-drawing', driveController.createLinkedDrawing);
router.post('/create-spreadsheet', driveController.createLinkedSpreadsheet);
router.get('/shared-with-me', driveController.getSharedWithMe);
router.delete('/share/:linkId', driveController.deleteShareLink);
router.delete('/comments/:commentId', driveController.deleteComment);
router.get('/:id', driveController.getItem);
router.get('/:id/breadcrumbs', driveController.getBreadcrumbs);
router.get('/:id/preview', driveController.previewFile);
router.get('/:id/view', driveController.viewFile);
router.get('/:id/download', driveController.downloadFile);
router.get('/:id/download-zip', driveController.downloadZip);
router.get('/:id/activity', driveController.getActivityLog);
router.get('/:id/comments', driveController.listComments);
router.post('/:id/comments', driveController.createComment);
router.get('/:id/versions', driveController.listVersions);
router.post('/:id/replace', upload.single('file'), handleMulterError, driveController.replaceFile);
router.post('/:id/versions/:versionId/restore', driveController.restoreVersion);
router.get('/:id/versions/:versionId/download', driveController.downloadVersion);
router.post('/:id/share', driveController.createShareLink);
router.get('/:id/share', driveController.listShareLinks);
router.post('/:id/shares', driveController.shareWithUser);
router.get('/:id/shares', driveController.listShares);
router.delete('/:id/shares/:userId', driveController.revokeShare);
router.post('/:id/copy', driveController.copyItem);
router.post('/:id/duplicate', driveController.duplicateItem);
router.patch('/:id', driveController.updateItem);
router.patch('/:id/visibility', driveController.updateDriveItemVisibility);
router.delete('/:id', driveController.deleteItem);
router.patch('/:id/restore', driveController.restoreItem);
router.delete('/:id/permanent', driveController.permanentDelete);

export default router;
