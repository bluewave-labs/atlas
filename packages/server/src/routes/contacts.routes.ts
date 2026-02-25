import { Router } from 'express';
import * as contactsController from '../controllers/contacts.controller';
import { authMiddleware } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

router.get('/', contactsController.listContacts);
router.post('/sync', contactsController.syncContacts);
router.get('/by-email/:email', contactsController.getContactByEmail);
router.post('/by-email/:email/enrich', contactsController.enrichContact);
router.patch('/by-email/:email/notes', contactsController.updateNotes);

export default router;
