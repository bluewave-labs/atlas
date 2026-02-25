import type { Request, Response } from 'express';
import * as contactsService from '../services/contacts.service';
import { logger } from '../utils/logger';

export async function getContactByEmail(req: Request, res: Response) {
  try {
    const email = req.params.email as string;
    if (!email) {
      res.status(400).json({ success: false, error: 'Email is required' });
      return;
    }

    const [contact, recentThreads, sharedAttachments, stats] = await Promise.all([
      contactsService.getContactByEmail(req.auth!.accountId, email),
      contactsService.getRecentThreadsWithContact(req.auth!.accountId, email),
      contactsService.getSharedAttachments(req.auth!.accountId, email),
      contactsService.getInteractionStats(req.auth!.accountId, email),
    ]);

    res.json({ success: true, data: { contact, recentThreads, sharedAttachments, stats } });
  } catch (error) {
    logger.error({ error }, 'Failed to fetch contact by email');
    res.status(500).json({ success: false, error: 'Failed to fetch contact' });
  }
}

export async function listContacts(req: Request, res: Response) {
  try {
    const { limit, offset, search } = req.query;
    const result = await contactsService.listContacts(req.auth!.accountId, {
      limit: limit ? parseInt(limit as string, 10) : 50,
      offset: offset ? parseInt(offset as string, 10) : 0,
      search: search as string | undefined,
    });

    res.json({ success: true, data: result });
  } catch (error) {
    logger.error({ error }, 'Failed to list contacts');
    res.status(500).json({ success: false, error: 'Failed to list contacts' });
  }
}

export async function syncContacts(req: Request, res: Response) {
  try {
    await contactsService.syncGoogleContacts(req.auth!.accountId);
    res.json({ success: true, data: { message: 'Contacts sync complete' } });
  } catch (error) {
    logger.error({ error }, 'Failed to sync contacts');
    res.status(500).json({ success: false, error: 'Failed to sync contacts' });
  }
}

export async function enrichContact(req: Request, res: Response) {
  try {
    const email = req.params.email as string;
    if (!email) {
      res.status(400).json({ success: false, error: 'Email is required' });
      return;
    }

    const contact = await contactsService.enrichContactByEmail(req.auth!.accountId, email);
    res.json({ success: true, data: { contact } });
  } catch (error) {
    logger.error({ error }, 'Failed to enrich contact');
    res.status(500).json({ success: false, error: 'Failed to enrich contact' });
  }
}

export async function updateNotes(req: Request, res: Response) {
  try {
    const email = req.params.email as string;
    const { notes } = req.body;

    if (!email) {
      res.status(400).json({ success: false, error: 'Email is required' });
      return;
    }
    if (typeof notes !== 'string') {
      res.status(400).json({ success: false, error: 'Notes must be a string' });
      return;
    }

    await contactsService.updateContactNotes(req.auth!.accountId, email, notes);
    res.json({ success: true, data: null });
  } catch (error) {
    logger.error({ error }, 'Failed to update contact notes');
    res.status(500).json({ success: false, error: 'Failed to update notes' });
  }
}
