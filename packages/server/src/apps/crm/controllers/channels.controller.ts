import type { Request, Response } from 'express';
import {
  listChannelsForUser,
  updateChannelSettings,
  getChannelById,
} from '../services/channel.service';
import { getSyncQueue, SyncJobName, type GmailIncrementalSyncJobData } from '../../../config/queue';
import { logger } from '../../../utils/logger';

export async function listChannels(req: Request, res: Response) {
  try {
    const channels = await listChannelsForUser({
      userId: req.auth!.userId,
      tenantId: req.auth!.tenantId!,
    });
    res.json({ success: true, data: { channels } });
  } catch (error) {
    logger.error({ error }, 'Failed to list channels');
    res.status(500).json({ success: false, error: 'Failed to list channels' });
  }
}

export async function updateChannel(req: Request, res: Response) {
  try {
    await updateChannelSettings({
      channelId: req.params.id as string,
      userId: req.auth!.userId,
      tenantId: req.auth!.tenantId!,
      patch: {
        visibility: req.body?.visibility,
        isSyncEnabled: req.body?.isSyncEnabled,
        contactAutoCreationPolicy: req.body?.contactAutoCreationPolicy,
      },
    });
    res.json({ success: true, data: null });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/forbidden/i.test(message)) {
      res.status(403).json({ success: false, error: message });
      return;
    }
    if (/not found/i.test(message)) {
      res.status(404).json({ success: false, error: message });
      return;
    }
    if (/invalid /i.test(message)) {
      res.status(400).json({ success: false, error: message });
      return;
    }
    logger.error({ error }, 'Failed to update channel');
    res.status(500).json({ success: false, error: 'Failed to update channel' });
  }
}

export async function syncChannel(req: Request, res: Response) {
  try {
    const channelId = req.params.id as string;
    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId!;

    const channel = await getChannelById({ channelId, userId, tenantId });
    if (!channel) {
      res.status(404).json({ success: false, error: 'channel not found' });
      return;
    }

    const queue = getSyncQueue();
    if (!queue) {
      res.status(503).json({
        success: false,
        error: 'Sync queue unavailable — Redis is not configured',
      });
      return;
    }

    const job = await queue.add(SyncJobName.GmailFullSync, {
      channelId: channel.id,
      triggeredBy: 'user',
      userId,
    });

    // Also ensure a recurring incremental scheduler exists for this channel.
    // Idempotent — if `gmail-incremental-{channel.id}` already exists,
    // upsertJobScheduler is a no-op. This handles the case where a user
    // connects a new Gmail channel mid-runtime: the boot-time scheduler
    // (workers/index.ts:scheduleGmailIncrementalSyncForAllChannels) only
    // runs at startup, so without this call the new channel would never
    // get incremental sync until the next reboot.
    try {
      await queue.upsertJobScheduler(
        `gmail-incremental-${channel.id}`,
        { every: 5 * 60 * 1000 },
        {
          name: SyncJobName.GmailIncrementalSync,
          data: { channelId: channel.id } satisfies GmailIncrementalSyncJobData,
        },
      );
    } catch (err) {
      logger.warn({ err, channelId: channel.id }, 'Failed to upsert Gmail incremental scheduler on manual sync');
    }

    res.json({ success: true, data: { jobId: job.id, queued: true } });
  } catch (error) {
    logger.error({ error }, 'Failed to enqueue channel sync');
    res.status(500).json({ success: false, error: 'Failed to start sync' });
  }
}
