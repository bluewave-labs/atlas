import { Router } from 'express';
import * as tableController from './controller';
import { authMiddleware } from '../../middleware/auth';

const router = Router();
router.use(authMiddleware);

router.get('/', tableController.listSpreadsheets);
router.post('/', tableController.createSpreadsheet);
router.get('/search', tableController.searchSpreadsheets);
router.get('/:id', tableController.getSpreadsheet);
router.patch('/:id', tableController.updateSpreadsheet);
router.delete('/:id', tableController.deleteSpreadsheet);
router.patch('/:id/restore', tableController.restoreSpreadsheet);

export default router;
