import { google } from 'googleapis';
import { createOAuth2Client } from '../config/google';
import { decrypt, encrypt } from '../utils/crypto';
import { db } from '../config/database';
import { accounts } from '../db/schema';
import { eq } from 'drizzle-orm';

export async function getGmailClient(accountId: string) {
  const [account] = await db.select().from(accounts).where(eq(accounts.id, accountId)).limit(1);
  if (!account) throw new Error('Account not found');

  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({
    access_token: decrypt(account.accessToken),
    refresh_token: decrypt(account.refreshToken),
    expiry_date: new Date(account.tokenExpiresAt).getTime(),
  });

  oauth2Client.on('tokens', async (tokens) => {
    if (tokens.access_token) {
      const updates: Record<string, string> = {
        accessToken: encrypt(tokens.access_token),
        tokenExpiresAt: new Date(tokens.expiry_date || Date.now() + 3600000).toISOString(),
        updatedAt: new Date().toISOString(),
      };
      // Google may issue a new refresh token — persist it so the old one
      // doesn't become stale and cause auth failures down the line.
      if (tokens.refresh_token) {
        updates.refreshToken = encrypt(tokens.refresh_token);
      }
      await db.update(accounts).set(updates).where(eq(accounts.id, accountId));
    }
  });

  return google.gmail({ version: 'v1', auth: oauth2Client });
}

export async function listMessageIds(accountId: string, query?: string, pageToken?: string, maxResults = 500) {
  const gmail = await getGmailClient(accountId);
  const response = await gmail.users.messages.list({
    userId: 'me',
    // When query is omitted the Gmail API returns all messages (no filter).
    // Only fall back to 'in:inbox' when a non-empty query is explicitly supplied
    // to avoid restricting full-sync fetches to just the inbox.
    q: query || undefined,
    maxResults,
    pageToken,
  });
  return {
    messageIds: (response.data.messages || []).map((m) => m.id!),
    nextPageToken: response.data.nextPageToken || null,
  };
}

export async function getMessage(accountId: string, messageId: string) {
  const gmail = await getGmailClient(accountId);
  const response = await gmail.users.messages.get({
    userId: 'me',
    id: messageId,
    format: 'full',
  });
  return response.data;
}

export async function batchGetMessages(accountId: string, messageIds: string[]) {
  const results = [];
  // Fetch in small concurrent chunks (5 at a time) to stay well within Gmail's
  // 250 quota-units/second limit while still benefiting from parallelism.
  // Each getMessage call costs 5 units → 5 × 5 = 25 units per tick, leaving
  // plenty of headroom when multiple accounts sync concurrently.
  const CONCURRENCY = 5;
  for (let i = 0; i < messageIds.length; i += CONCURRENCY) {
    const chunk = messageIds.slice(i, i + CONCURRENCY);
    const messages = await Promise.all(chunk.map((id) => getMessage(accountId, id)));
    results.push(...messages);
  }
  return results;
}

export async function getHistory(accountId: string, startHistoryId: string) {
  const gmail = await getGmailClient(accountId);
  const response = await gmail.users.history.list({
    userId: 'me',
    startHistoryId,
    historyTypes: ['messageAdded', 'messageDeleted', 'labelAdded', 'labelRemoved'],
  });
  return response.data;
}

export async function modifyMessage(accountId: string, messageId: string, addLabels: string[], removeLabels: string[]) {
  const gmail = await getGmailClient(accountId);
  await gmail.users.messages.modify({
    userId: 'me',
    id: messageId,
    requestBody: {
      addLabelIds: addLabels,
      removeLabelIds: removeLabels,
    },
  });
}

export async function trashMessage(accountId: string, messageId: string) {
  const gmail = await getGmailClient(accountId);
  await gmail.users.messages.trash({ userId: 'me', id: messageId });
}

export async function sendMessage(accountId: string, raw: string) {
  const gmail = await getGmailClient(accountId);
  const response = await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw },
  });
  return response.data;
}

export async function getAttachment(accountId: string, messageId: string, attachmentId: string) {
  const gmail = await getGmailClient(accountId);
  const response = await gmail.users.messages.attachments.get({
    userId: 'me',
    messageId,
    id: attachmentId,
  });
  return response.data; // { size, data (base64url) }
}

export async function getProfile(accountId: string) {
  const gmail = await getGmailClient(accountId);
  const response = await gmail.users.getProfile({ userId: 'me' });
  return response.data;
}
