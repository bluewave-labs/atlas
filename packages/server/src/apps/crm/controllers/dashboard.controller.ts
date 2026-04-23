import type { Request, Response } from 'express';
import * as crmService from '../services/dashboard.service';
import { createActivity as createActivityService } from '../services/activity.service';
import * as crmEmailService from '../email.service';
import * as crmCalendarService from '../calendar.service';
import { isGoogleConfigured } from '../../../services/google-auth';
import { getRedisClient } from '../../../config/redis';
import { enqueueSyncJob, SyncJobType } from '../../../workers';
import { db } from '../../../config/database';
import { accounts } from '../../../db/schema';
import { eq } from 'drizzle-orm';
import { logger } from '../../../utils/logger';

// ─── Widget ─────────────────────────────────────────────────────────

export async function getWidgetData(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId;
    const data = await crmService.getWidgetData(userId, tenantId);
    res.json({ success: true, data });
  } catch (error) {
    logger.error({ error }, 'Failed to get CRM widget data');
    res.status(500).json({ success: false, error: 'Failed to get CRM widget data' });
  }
}

// ─── Dashboard ─────────────────────────────────────────────────────

export async function getDashboard(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId;

    const perm = req.crmPerm!;
    const dashboard = await crmService.getDashboard(userId, tenantId, perm.recordAccess);
    res.json({ success: true, data: dashboard });
  } catch (error) {
    logger.error({ error }, 'Failed to get CRM dashboard');
    res.status(500).json({ success: false, error: 'Failed to get dashboard' });
  }
}

export async function getDashboardCharts(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId;

    const perm = req.crmPerm!;
    const charts = await crmService.getDashboardCharts(userId, tenantId, perm.recordAccess);
    res.json({ success: true, data: charts });
  } catch (error) {
    logger.error({ error }, 'Failed to get CRM dashboard charts');
    res.status(500).json({ success: false, error: 'Failed to get dashboard charts' });
  }
}

// ─── Seed Sample Data ───────────────────────────────────────────────

export async function seedSampleData(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId;

    const result = await crmService.seedSampleData(userId, tenantId);
    res.json({ success: true, data: { message: 'Seeded CRM sample data', ...result } });
  } catch (error) {
    logger.error({ error }, 'Failed to seed CRM sample data');
    res.status(500).json({ success: false, error: 'Failed to seed CRM sample data' });
  }
}

// ─── Google Sync Status & Control ──────────────────────────────────────

export async function getGoogleSyncStatus(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;

    const [account] = await db.select({
      provider: accounts.provider,
      syncStatus: accounts.syncStatus,
      syncError: accounts.syncError,
      lastSync: accounts.lastSync,
      lastFullSync: accounts.lastFullSync,
    }).from(accounts).where(eq(accounts.userId, userId)).limit(1);

    res.json({
      success: true,
      data: {
        googleConfigured: isGoogleConfigured(),
        connected: account?.provider === 'google',
        syncStatus: account?.syncStatus ?? 'idle',
        syncError: account?.syncError ?? null,
        lastSync: account?.lastSync ?? null,
        lastFullSync: account?.lastFullSync ?? null,
        redisAvailable: !!getRedisClient(),
      },
    });
  } catch (error) {
    logger.error({ error }, 'Failed to get Google sync status');
    res.status(500).json({ success: false, error: 'Failed to get sync status' });
  }
}

export async function startGoogleSync(req: Request, res: Response) {
  try {
    const tenantId = req.auth!.tenantId;

    if (!getRedisClient()) {
      res.status(503).json({ success: false, error: 'Redis is not available. Background sync requires Redis.' });
      return;
    }

    await enqueueSyncJob(SyncJobType.FULL_EMAIL, tenantId);
    await enqueueSyncJob(SyncJobType.FULL_CALENDAR, tenantId);

    res.json({ success: true, data: { message: 'Sync jobs enqueued' } });
  } catch (error) {
    logger.error({ error }, 'Failed to start Google sync');
    res.status(500).json({ success: false, error: 'Failed to start sync' });
  }
}

export async function stopGoogleSync(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;

    await db.update(accounts).set({
      syncStatus: 'idle',
      syncError: null,
      updatedAt: new Date(),
    }).where(eq(accounts.userId, userId));

    res.json({ success: true, data: null });
  } catch (error) {
    logger.error({ error }, 'Failed to stop Google sync');
    res.status(500).json({ success: false, error: 'Failed to stop sync' });
  }
}

// ─── CRM Emails ────────────────────────────────────────────────────────

export async function getContactEmails(req: Request, res: Response) {
  try {
    const tenantId = req.auth!.tenantId;
    const contactId = req.params.id as string;
    const limit = parseInt(req.query.limit as string) || 50;

    const emailList = await crmEmailService.getContactEmails(tenantId, req.auth!.userId, contactId, limit);
    res.json({ success: true, data: { emails: emailList } });
  } catch (error) {
    logger.error({ error }, 'Failed to get contact emails');
    res.status(500).json({ success: false, error: 'Failed to get contact emails' });
  }
}

export async function getDealEmails(req: Request, res: Response) {
  try {
    const tenantId = req.auth!.tenantId;
    const dealId = req.params.id as string;
    const limit = parseInt(req.query.limit as string) || 50;

    const emailList = await crmEmailService.getDealEmails(tenantId, req.auth!.userId, dealId, limit);
    res.json({ success: true, data: { emails: emailList } });
  } catch (error) {
    logger.error({ error }, 'Failed to get deal emails');
    res.status(500).json({ success: false, error: 'Failed to get deal emails' });
  }
}

export async function getCompanyEmails(req: Request, res: Response) {
  try {
    const tenantId = req.auth!.tenantId;
    const companyId = req.params.id as string;
    const limit = parseInt(req.query.limit as string) || 50;

    const emailList = await crmEmailService.getCompanyEmails(tenantId, req.auth!.userId, companyId, limit);
    res.json({ success: true, data: { emails: emailList } });
  } catch (error) {
    logger.error({ error }, 'Failed to get company emails');
    res.status(500).json({ success: false, error: 'Failed to get company emails' });
  }
}

export async function sendCrmEmail(req: Request, res: Response) {
  try {
    const tenantId = req.auth!.tenantId;
    const userId = req.auth!.userId;
    const { to, subject, body, threadGmailId, dealId, contactId, companyId } = req.body;

    if (!to || !subject || !body) {
      res.status(400).json({ success: false, error: 'to, subject, and body are required' });
      return;
    }

    const sentMessage = await crmEmailService.sendEmail(tenantId, to, subject, body, threadGmailId);

    // Create a CRM activity for the sent email
    await createActivityService(userId, tenantId, {
      type: 'email',
      body: `Sent email: ${subject}`,
      dealId: dealId ?? null,
      contactId: contactId ?? null,
      companyId: companyId ?? null,
    });

    res.json({ success: true, data: sentMessage });
  } catch (error) {
    logger.error({ error }, 'Failed to send CRM email');
    res.status(500).json({ success: false, error: 'Failed to send email' });
  }
}

// ─── CRM Calendar Events ──────────────────────────────────────────────

export async function getContactEvents(req: Request, res: Response) {
  try {
    const tenantId = req.auth!.tenantId;
    const contactId = req.params.id as string;
    const limit = parseInt(req.query.limit as string) || 50;

    const events = await crmCalendarService.getContactEvents(tenantId, req.auth!.userId, contactId, limit);
    res.json({ success: true, data: { events } });
  } catch (error) {
    logger.error({ error }, 'Failed to get contact events');
    res.status(500).json({ success: false, error: 'Failed to get contact events' });
  }
}

export async function getDealEvents(req: Request, res: Response) {
  try {
    const tenantId = req.auth!.tenantId;
    const dealId = req.params.id as string;
    const limit = parseInt(req.query.limit as string) || 50;

    const events = await crmCalendarService.getDealEvents(tenantId, req.auth!.userId, dealId, limit);
    res.json({ success: true, data: { events } });
  } catch (error) {
    logger.error({ error }, 'Failed to get deal events');
    res.status(500).json({ success: false, error: 'Failed to get deal events' });
  }
}

export async function createCrmEvent(req: Request, res: Response) {
  try {
    const tenantId = req.auth!.tenantId;
    const userId = req.auth!.userId;
    const { summary, startTime, endTime, attendees, location, description, dealId, contactId, companyId } = req.body;

    if (!summary || !startTime || !endTime) {
      res.status(400).json({ success: false, error: 'summary, startTime, and endTime are required' });
      return;
    }

    const accountId = await (await import('../../../utils/account-lookup')).getAccountIdForUser(userId);
    if (!accountId) {
      res.status(404).json({ success: false, error: 'Account not found' });
      return;
    }
    const event = await crmCalendarService.createCalendarEvent(
      accountId, summary, startTime, endTime,
      attendees ?? [], location, description,
    );

    // Create a CRM activity for the meeting
    await createActivityService(userId, tenantId, {
      type: 'meeting',
      body: `Scheduled meeting: ${summary}`,
      dealId: dealId ?? null,
      contactId: contactId ?? null,
      companyId: companyId ?? null,
    });

    res.json({ success: true, data: event });
  } catch (error) {
    logger.error({ error }, 'Failed to create CRM calendar event');
    res.status(500).json({ success: false, error: 'Failed to create calendar event' });
  }
}
