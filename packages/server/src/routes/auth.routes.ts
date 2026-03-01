import { Router } from 'express';
import * as authController from '../controllers/auth.controller';
import { authMiddleware } from '../middleware/auth';
import { authLimiter } from '../middleware/rate-limit';

const router = Router();

router.post('/register', authLimiter, authController.register);
router.post('/login', authLimiter, authController.loginWithPassword);
router.get('/url', authController.getAuthUrl);
router.post('/callback', authLimiter, authController.handleCallback);
router.post('/refresh', authLimiter, authController.refreshToken);
router.post('/local', authLimiter, authController.createLocalUser);
router.get('/me', authMiddleware, authController.getMe);
router.get('/accounts', authMiddleware, authController.listAccounts);
router.post('/link-google', authMiddleware, authLimiter, authController.linkGoogleAccount);
router.get('/invitation/:token', authController.getInvitationDetails);
router.post('/invitation/:token/accept', authLimiter, authController.acceptInvitation);

export default router;
