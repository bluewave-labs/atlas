import { and, eq, or, desc } from 'drizzle-orm';
import { db } from '../../../config/database';
import { messageChannels } from '../../../db/schema';

export type ChannelVisibility = 'private' | 'shared-with-tenant';
export type ContactAutoCreationPolicy = 'none' | 'send-only' | 'send-and-receive';

const VALID_VISIBILITIES: ChannelVisibility[] = ['private', 'shared-with-tenant'];
const VALID_POLICIES: ContactAutoCreationPolicy[] = ['none', 'send-only', 'send-and-receive'];

export interface ChannelDTO {
  id: string;
  accountId: string;
  tenantId: string;
  ownerUserId: string;
  type: string;
  handle: string;
  visibility: ChannelVisibility;
  isSyncEnabled: boolean;
  contactAutoCreationPolicy: ContactAutoCreationPolicy;
  syncStage: string;
  syncStatus: string | null;
  syncError: string | null;
  lastIncrementalSyncAt: Date | null;
  throttleRetryAfter: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const SELECT_FIELDS = {
  id: messageChannels.id,
  accountId: messageChannels.accountId,
  tenantId: messageChannels.tenantId,
  ownerUserId: messageChannels.ownerUserId,
  type: messageChannels.type,
  handle: messageChannels.handle,
  visibility: messageChannels.visibility,
  isSyncEnabled: messageChannels.isSyncEnabled,
  contactAutoCreationPolicy: messageChannels.contactAutoCreationPolicy,
  syncStage: messageChannels.syncStage,
  syncStatus: messageChannels.syncStatus,
  syncError: messageChannels.syncError,
  lastIncrementalSyncAt: messageChannels.lastIncrementalSyncAt,
  throttleRetryAfter: messageChannels.throttleRetryAfter,
  createdAt: messageChannels.createdAt,
  updatedAt: messageChannels.updatedAt,
} satisfies Record<keyof ChannelDTO, unknown>;

/**
 * List channels visible to the current user within their tenant:
 * shared-with-tenant channels + channels they personally own.
 * This is the only legitimate read path for channels — controllers
 * MUST use this and not query message_channels directly.
 */
export async function listChannelsForUser(args: {
  userId: string;
  tenantId: string;
}): Promise<ChannelDTO[]> {
  const rows = await db
    .select(SELECT_FIELDS)
    .from(messageChannels)
    .where(
      and(
        eq(messageChannels.tenantId, args.tenantId),
        or(
          eq(messageChannels.visibility, 'shared-with-tenant'),
          eq(messageChannels.ownerUserId, args.userId),
        ),
      ),
    )
    .orderBy(desc(messageChannels.createdAt));
  return rows as unknown as ChannelDTO[];
}

export interface UpdateChannelPatch {
  visibility?: ChannelVisibility;
  isSyncEnabled?: boolean;
  contactAutoCreationPolicy?: ContactAutoCreationPolicy;
}

/**
 * Update a channel's user-editable settings. Owner-only.
 * Throws if channel not found, user is not the owner, or any patch field
 * has an invalid enum value.
 */
export async function updateChannelSettings(args: {
  channelId: string;
  userId: string;
  tenantId: string;
  patch: UpdateChannelPatch;
}): Promise<void> {
  if (
    args.patch.visibility !== undefined &&
    !VALID_VISIBILITIES.includes(args.patch.visibility)
  ) {
    throw new Error(`invalid visibility: ${args.patch.visibility}`);
  }
  if (
    args.patch.contactAutoCreationPolicy !== undefined &&
    !VALID_POLICIES.includes(args.patch.contactAutoCreationPolicy)
  ) {
    throw new Error(
      `invalid contactAutoCreationPolicy: ${args.patch.contactAutoCreationPolicy}`,
    );
  }

  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select({
        id: messageChannels.id,
        ownerUserId: messageChannels.ownerUserId,
        tenantId: messageChannels.tenantId,
      })
      .from(messageChannels)
      .where(
        and(
          eq(messageChannels.id, args.channelId),
          eq(messageChannels.tenantId, args.tenantId),
        ),
      )
      .limit(1);

    if (!existing) {
      throw new Error(`channel not found: ${args.channelId}`);
    }
    if (existing.ownerUserId !== args.userId) {
      throw new Error(`forbidden: not the owner of channel ${args.channelId}`);
    }

    const setClause: Record<string, unknown> = { updatedAt: new Date() };
    if (args.patch.visibility !== undefined) setClause.visibility = args.patch.visibility;
    if (args.patch.isSyncEnabled !== undefined) setClause.isSyncEnabled = args.patch.isSyncEnabled;
    if (args.patch.contactAutoCreationPolicy !== undefined)
      setClause.contactAutoCreationPolicy = args.patch.contactAutoCreationPolicy;

    await tx
      .update(messageChannels)
      .set(setClause)
      .where(eq(messageChannels.id, args.channelId));
  });
}

export interface ChannelLookupResult {
  id: string;
  accountId: string;
  ownerUserId: string;
  visibility: ChannelVisibility;
  handle: string;
}

/**
 * Fetch a channel by id, applying the same visibility filter as
 * listChannelsForUser. Returns null if the channel does not exist or
 * is not visible to the user. Used by the controller for enqueue
 * endpoints that need the accountId without a full DTO.
 */
export async function getChannelById(args: {
  channelId: string;
  userId: string;
  tenantId: string;
}): Promise<ChannelLookupResult | null> {
  const [row] = await db
    .select({
      id: messageChannels.id,
      accountId: messageChannels.accountId,
      ownerUserId: messageChannels.ownerUserId,
      visibility: messageChannels.visibility,
      handle: messageChannels.handle,
    })
    .from(messageChannels)
    .where(
      and(
        eq(messageChannels.id, args.channelId),
        eq(messageChannels.tenantId, args.tenantId),
        or(
          eq(messageChannels.visibility, 'shared-with-tenant'),
          eq(messageChannels.ownerUserId, args.userId),
        ),
      ),
    )
    .limit(1);
  return (row as ChannelLookupResult | undefined) ?? null;
}
