import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import * as signController from './controller';
import { authMiddleware } from '../../middleware/auth';
import { requireAppPermission } from '../../middleware/require-app-permission';
import { withConcurrencyCheck } from '../../middleware/concurrency-check';
import { signatureDocuments } from '../../db/schema';
import { isTenantAdmin } from '@atlas-platform/shared';

function requireSeedAdmin(req: Request, res: Response, next: NextFunction) {
  if (!isTenantAdmin(req.auth?.tenantRole)) {
    res.status(403).json({ success: false, error: 'Only organization admins can seed demo data' });
    return;
  }
  next();
}

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
router.use(requireAppPermission('sign'));

// ─── Widget (lightweight summary for home dashboard) ────────────────
router.get('/widget', signController.getWidgetData);

// ─── Settings (tenant-wide) ─────────────────────────────────────────
// Must be declared before the `/:id` document routes so that the literal
// "settings" path never gets matched as a document id.
router.get('/settings', signController.getSettings);
router.patch('/settings', signController.updateSettings);

// ─── Reminders (admin) ──────────────────────────────────────────────
router.post('/reminders/send', signController.triggerReminders);

// ─── Templates ─────────────────────────────────────────────────────
router.get('/templates', signController.listTemplates);
router.post('/templates', signController.createTemplate);
router.post('/templates/seed-starter', requireSeedAdmin, signController.seedStarterTemplates);
router.post('/templates/:id/use', signController.useTemplate);
router.delete('/templates/:id', signController.deleteTemplate);

// ─── Documents ──────────────────────────────────────────────────────
router.get('/', signController.listDocuments);
router.post('/', signController.createDocument);
router.post('/upload', upload.single('pdf'), signController.uploadPDF);
router.get('/:id', signController.getDocument);
router.put('/:id', withConcurrencyCheck(signatureDocuments), signController.updateDocument);
router.delete('/:id', signController.deleteDocument);
router.get('/:id/view', signController.viewPDF);
router.get('/:id/download', signController.downloadPDF);
router.post('/:id/void', signController.voidDocument);
router.get('/:id/audit', signController.getAuditLog);
router.post('/:id/save-as-template', signController.saveAsTemplate);

// ─── Fields ─────────────────────────────────────────────────────────
router.get('/:id/fields', signController.listFields);
router.post('/:id/fields', signController.createField);
router.put('/fields/:fieldId', signController.updateField);
router.delete('/fields/:fieldId', signController.deleteField);

// ─── Tokens ─────────────────────────────────────────────────────────
router.post('/:id/tokens', signController.createSigningToken);
router.get('/:id/tokens', signController.listSigningTokens);
router.post('/:id/tokens/:tokenId/remind', signController.sendSingleReminder);

export default router;
