import type { Request, Response } from 'express';
import * as proposalService from '../services/proposal.service';
import { logger } from '../../../utils/logger';

// ─── Auth controllers ──────────────────────────────────────────────

export async function listProposals(req: Request, res: Response) {
  try {
    const tenantId = req.auth!.tenantId;
    const { dealId, companyId, status, search } = req.query;

    const proposals = await proposalService.listProposals(tenantId, {
      dealId: dealId as string | undefined,
      companyId: companyId as string | undefined,
      status: status as string | undefined,
      search: search as string | undefined,
    });

    res.json({ success: true, data: { proposals } });
  } catch (error) {
    logger.error({ error }, 'Failed to list proposals');
    res.status(500).json({ success: false, error: 'Failed to list proposals' });
  }
}

export async function getProposal(req: Request, res: Response) {
  try {
    const tenantId = req.auth!.tenantId;
    const id = req.params.id as string;

    const proposal = await proposalService.getProposal(tenantId, id);
    if (!proposal) {
      res.status(404).json({ success: false, error: 'Proposal not found' });
      return;
    }

    res.json({ success: true, data: proposal });
  } catch (error) {
    logger.error({ error }, 'Failed to get proposal');
    res.status(500).json({ success: false, error: 'Failed to get proposal' });
  }
}

export async function createProposal(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId;
    const { title, dealId, contactId, companyId, content, lineItems, taxPercent, discountPercent, currency, validUntil, notes } = req.body;

    if (!title?.trim()) {
      res.status(400).json({ success: false, error: 'Title is required' });
      return;
    }

    const proposal = await proposalService.createProposal(userId, tenantId, {
      title: title.trim(),
      dealId, contactId, companyId, content, lineItems,
      taxPercent, discountPercent, currency, validUntil, notes,
    });

    res.json({ success: true, data: proposal });
  } catch (error) {
    logger.error({ error }, 'Failed to create proposal');
    res.status(500).json({ success: false, error: 'Failed to create proposal' });
  }
}

export async function updateProposal(req: Request, res: Response) {
  try {
    const tenantId = req.auth!.tenantId;
    const id = req.params.id as string;
    const { title, dealId, contactId, companyId, content, lineItems, taxPercent, discountPercent, currency, validUntil, notes } = req.body;

    const proposal = await proposalService.updateProposal(tenantId, id, {
      title, dealId, contactId, companyId, content, lineItems,
      taxPercent, discountPercent, currency, validUntil, notes,
    });

    if (!proposal) {
      res.status(404).json({ success: false, error: 'Proposal not found' });
      return;
    }

    res.json({ success: true, data: proposal });
  } catch (error) {
    logger.error({ error }, 'Failed to update proposal');
    res.status(500).json({ success: false, error: 'Failed to update proposal' });
  }
}

export async function deleteProposal(req: Request, res: Response) {
  try {
    const tenantId = req.auth!.tenantId;
    const id = req.params.id as string;

    await proposalService.deleteProposal(tenantId, id);
    res.json({ success: true, data: null });
  } catch (error) {
    logger.error({ error }, 'Failed to delete proposal');
    res.status(500).json({ success: false, error: 'Failed to delete proposal' });
  }
}

export async function sendProposal(req: Request, res: Response) {
  try {
    const tenantId = req.auth!.tenantId;
    const id = req.params.id as string;

    const proposal = await proposalService.sendProposal(tenantId, id);
    if (!proposal) {
      res.status(404).json({ success: false, error: 'Proposal not found' });
      return;
    }

    res.json({ success: true, data: proposal });
  } catch (error) {
    logger.error({ error }, 'Failed to send proposal');
    res.status(500).json({ success: false, error: 'Failed to send proposal' });
  }
}

export async function duplicateProposal(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId;
    const id = req.params.id as string;

    const proposal = await proposalService.duplicateProposal(userId, tenantId, id);
    if (!proposal) {
      res.status(404).json({ success: false, error: 'Proposal not found' });
      return;
    }

    res.json({ success: true, data: proposal });
  } catch (error) {
    logger.error({ error }, 'Failed to duplicate proposal');
    res.status(500).json({ success: false, error: 'Failed to duplicate proposal' });
  }
}

// ─── Public controllers (no auth) ──────────────────────────────────

export async function getPublicProposal(req: Request, res: Response) {
  try {
    const token = req.params.token as string;

    const proposal = await proposalService.getProposalByPublicToken(token);
    if (!proposal) {
      res.status(404).json({ success: false, error: 'Proposal not found' });
      return;
    }

    res.json({ success: true, data: proposal });
  } catch (error) {
    logger.error({ error }, 'Failed to get public proposal');
    res.status(500).json({ success: false, error: 'Failed to get proposal' });
  }
}

export async function acceptPublicProposal(req: Request, res: Response) {
  try {
    const token = req.params.token as string;

    const proposal = await proposalService.acceptProposal(token);
    if (!proposal) {
      res.status(404).json({ success: false, error: 'Proposal not found' });
      return;
    }

    res.json({ success: true, data: proposal });
  } catch (error) {
    logger.error({ error }, 'Failed to accept proposal');
    res.status(500).json({ success: false, error: 'Failed to accept proposal' });
  }
}

export async function declinePublicProposal(req: Request, res: Response) {
  try {
    const token = req.params.token as string;

    const proposal = await proposalService.declineProposal(token);
    if (!proposal) {
      res.status(404).json({ success: false, error: 'Proposal not found' });
      return;
    }

    res.json({ success: true, data: proposal });
  } catch (error) {
    logger.error({ error }, 'Failed to decline proposal');
    res.status(500).json({ success: false, error: 'Failed to decline proposal' });
  }
}
