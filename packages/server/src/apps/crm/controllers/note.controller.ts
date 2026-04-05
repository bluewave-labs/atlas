import type { Request, Response } from 'express';
import * as crmService from '../services/note.service';
import { logger } from '../../../utils/logger';

// ─── Notes ──────────────────────────────────────────────────────────

export async function listNotes(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const accountId = req.auth!.accountId;
    const { dealId, contactId, companyId } = req.query;

    const notes = await crmService.listNotes(userId, accountId, {
      dealId: dealId as string | undefined,
      contactId: contactId as string | undefined,
      companyId: companyId as string | undefined,
    });
    res.json({ success: true, data: { notes } });
  } catch (error) {
    logger.error({ error }, 'Failed to list CRM notes');
    res.status(500).json({ success: false, error: 'Failed to list notes' });
  }
}

export async function createNote(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const accountId = req.auth!.accountId;
    const { title, content, dealId, contactId, companyId } = req.body;

    if (!content) {
      res.status(400).json({ success: false, error: 'Content is required' });
      return;
    }

    const note = await crmService.createNote(userId, accountId, {
      title, content, dealId, contactId, companyId,
    });
    res.json({ success: true, data: note });
  } catch (error) {
    logger.error({ error }, 'Failed to create CRM note');
    res.status(500).json({ success: false, error: 'Failed to create note' });
  }
}

export async function updateNote(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const id = req.params.id as string;
    const { title, content, isPinned, isArchived } = req.body;

    const note = await crmService.updateNote(userId, id, { title, content, isPinned, isArchived });
    if (!note) {
      res.status(404).json({ success: false, error: 'Note not found' });
      return;
    }
    res.json({ success: true, data: note });
  } catch (error) {
    logger.error({ error }, 'Failed to update CRM note');
    res.status(500).json({ success: false, error: 'Failed to update note' });
  }
}

export async function deleteNote(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const id = req.params.id as string;

    await crmService.deleteNote(userId, id);
    res.json({ success: true, data: null });
  } catch (error) {
    logger.error({ error }, 'Failed to delete CRM note');
    res.status(500).json({ success: false, error: 'Failed to delete note' });
  }
}
