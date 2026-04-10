import { Router } from 'express';
import * as invoiceController from './controller';
import { authMiddleware } from '../../middleware/auth';

const router = Router();

// Public routes (no auth)
router.get('/portal/:token/list', invoiceController.getPortalInvoices);
router.get('/portal/:token/:invoiceId', invoiceController.getPortalInvoice);

// Auth middleware
router.use(authMiddleware);

// Settings
router.get('/settings', invoiceController.getSettings);
router.patch('/settings', invoiceController.updateSettings);

// Dashboard
router.get('/dashboard', invoiceController.getInvoicesDashboard);

// Recurring Invoices
// IMPORTANT: register /recurring/... (literal) before any /:id routes so
// Express never mistakes the literal "recurring" segment for an invoice id.
router.get('/recurring', invoiceController.listRecurring);
router.post('/recurring', invoiceController.createRecurring);
router.get('/recurring/:id', invoiceController.getRecurring);
router.patch('/recurring/:id', invoiceController.updateRecurring);
router.delete('/recurring/:id', invoiceController.deleteRecurring);
router.post('/recurring/:id/pause', invoiceController.pauseRecurring);
router.post('/recurring/:id/resume', invoiceController.resumeRecurring);
router.post('/recurring/:id/run-now', invoiceController.runRecurringNow);

// Invoices
router.get('/list', invoiceController.listInvoices);
router.get('/next-number', invoiceController.getNextInvoiceNumber);
router.post('/', invoiceController.createInvoice);
router.get('/:id/pdf', invoiceController.getInvoicePdf);
router.get('/:id', invoiceController.getInvoice);
router.patch('/:id', invoiceController.updateInvoice);
router.delete('/:id', invoiceController.deleteInvoice);
router.post('/:id/send', invoiceController.sendInvoice);
router.post('/:id/email', invoiceController.emailInvoice);
router.post('/:id/paid', invoiceController.markInvoicePaid);
router.post('/:id/waive', invoiceController.waiveInvoice);
router.post('/:id/duplicate', invoiceController.duplicateInvoice);

// Payments
// IMPORTANT: register /payments/:paymentId (literal) before any /:invoiceId/...
// routes so Express never mistakes the literal "payments" segment for an invoice id.
router.patch('/payments/:paymentId', invoiceController.updatePayment);
router.delete('/payments/:paymentId', invoiceController.deletePayment);
router.get('/:invoiceId/payments', invoiceController.listPayments);
router.post('/:invoiceId/payments', invoiceController.recordPayment);

// Line Items
router.get('/:invoiceId/line-items', invoiceController.listLineItems);
router.post('/:invoiceId/line-items', invoiceController.createLineItem);
router.patch('/:id/line-items/:itemId', invoiceController.updateLineItem);
router.delete('/:id/line-items/:itemId', invoiceController.deleteLineItem);

// e-Fatura
router.post('/:id/efatura/generate', invoiceController.generateEFatura);
router.get('/:id/efatura/xml', invoiceController.getEFaturaXml);
router.get('/:id/efatura/preview', invoiceController.getEFaturaPreview);
router.get('/:id/efatura/pdf', invoiceController.getEFaturaPdf);

export default router;
