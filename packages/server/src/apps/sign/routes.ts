import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import * as signController from './controller';
import { authMiddleware } from '../../middleware/auth';

const storage = multer.diskStorage({
  destination: path.join(__dirname, '../../../uploads'),
  filename: (_req, file, cb) => {
    const userId = (_req as any).auth?.userId || 'anon';
    const timestamp = Date.now();
    const decoded = Buffer.from(file.originalname, 'latin1').toString('utf8');
    const safeName = decoded.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `sign_${userId}_${timestamp}_${safeName}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
});

const router = Router();

// ─── Public routes (no auth) — defined BEFORE authMiddleware ────────
router.get('/public/:token', signController.getByToken);
router.post('/public/:token/sign', signController.signByToken);
router.post('/public/:token/decline', signController.declineByToken);
router.get('/public/:token/view', signController.viewPDFByToken);

// ─── Auth middleware for all routes below ────────────────────────────
router.use(authMiddleware);

// ─── Documents ──────────────────────────────────────────────────────
router.get('/', signController.listDocuments);
router.post('/', signController.createDocument);
router.post('/upload', upload.single('pdf'), signController.uploadPDF);
router.get('/:id', signController.getDocument);
router.put('/:id', signController.updateDocument);
router.delete('/:id', signController.deleteDocument);
router.get('/:id/view', signController.viewPDF);
router.get('/:id/download', signController.downloadPDF);
router.post('/:id/void', signController.voidDocument);

// ─── Fields ─────────────────────────────────────────────────────────
router.get('/:id/fields', signController.listFields);
router.post('/:id/fields', signController.createField);
router.put('/fields/:fieldId', signController.updateField);
router.delete('/fields/:fieldId', signController.deleteField);

// ─── Tokens ─────────────────────────────────────────────────────────
router.post('/:id/tokens', signController.createSigningToken);
router.get('/:id/tokens', signController.listSigningTokens);

export default router;
