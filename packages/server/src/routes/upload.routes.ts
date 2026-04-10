import { Router } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { authMiddleware } from '../middleware/auth';
import { handleUpload } from '../controllers/upload.controller';

const uploadsDir = path.join(__dirname, '../../uploads');

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
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
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB
});

const router = Router();
router.use(authMiddleware);
router.post('/', upload.single('file'), handleUpload);

export default router;
