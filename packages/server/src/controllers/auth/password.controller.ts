import type { Request, Response } from 'express';
import crypto from 'node:crypto';
import { eq } from 'drizzle-orm';
import * as authService from '../../services/auth.service';
import { db } from '../../config/database';
import { accounts, passwordResetTokens } from '../../db/schema';
import { logger } from '../../utils/logger';
import { hashPassword, validatePasswordStrength } from '../../utils/password';
import { sendEmail } from '../../services/email.service';
import { env } from '../../config/env';

// ─── Password Reset ─────────────────────────────────────────────────

export async function forgotPassword(req: Request, res: Response) {
  try {
    const { email } = req.body;
    if (!email) {
      res.status(400).json({ success: false, error: 'Email is required' });
      return;
    }

    const account = await authService.findAccountByEmail(email);
    if (!account || !account.passwordHash) {
      res.json({ success: true, message: 'If an account exists with that email, a reset link has been sent.' });
      return;
    }

    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await db.insert(passwordResetTokens).values({
      accountId: account.id,
      token,
      expiresAt,
    });

    // Send password reset email (silently fails if SMTP not configured)
    const resetUrl = `${env.CLIENT_PUBLIC_URL}/reset-password?token=${token}`;
    await sendEmail({
      to: email,
      subject: 'Atlas — Password reset',
      text: `You requested a password reset. Click this link to reset your password:\n\n${resetUrl}\n\nThis link expires in 1 hour. If you didn't request this, you can ignore this email.`,
      html: `<p>You requested a password reset.</p><p><a href="${resetUrl}">Click here to reset your password</a></p><p>This link expires in 1 hour. If you didn't request this, you can ignore this email.</p>`,
    });
    logger.info({ email }, 'Password reset token generated');

    res.json({ success: true, message: 'If an account exists with that email, a reset link has been sent.' });
  } catch (error) {
    logger.error({ error }, 'Forgot password failed');
    res.json({ success: true, message: 'If an account exists with that email, a reset link has been sent.' });
  }
}

export async function resetPassword(req: Request, res: Response) {
  try {
    const { token, password } = req.body;
    if (!token || !password) {
      res.status(400).json({ success: false, error: 'Token and password are required' });
      return;
    }

    const strength = validatePasswordStrength(password);
    if (!strength.valid) {
      res.status(400).json({ success: false, error: strength.error });
      return;
    }

    const [resetRecord] = await db.select().from(passwordResetTokens)
      .where(eq(passwordResetTokens.token, token)).limit(1);

    if (!resetRecord) {
      res.status(400).json({ success: false, error: 'Invalid or expired reset link' });
      return;
    }

    if (resetRecord.usedAt) {
      res.status(400).json({ success: false, error: 'This reset link has already been used' });
      return;
    }

    if (new Date(resetRecord.expiresAt) < new Date()) {
      res.status(400).json({ success: false, error: 'This reset link has expired' });
      return;
    }

    const newHash = await hashPassword(password);
    await db.update(accounts).set({ passwordHash: newHash }).where(eq(accounts.id, resetRecord.accountId));
    await db.update(passwordResetTokens).set({ usedAt: new Date() }).where(eq(passwordResetTokens.id, resetRecord.id));

    res.json({ success: true, message: 'Password has been reset successfully' });
  } catch (error) {
    logger.error({ error }, 'Reset password failed');
    res.status(500).json({ success: false, error: 'Failed to reset password' });
  }
}
