import { google } from 'googleapis';
import { createOAuth2Client } from '../config/google';
import { decrypt, encrypt } from '../utils/crypto';
import { db } from '../config/database';
import { accounts, contacts, threads, emails, attachments } from '../db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { logger } from '../utils/logger';

// ─── People API client ────────────────────────────────────────────────

async function getPeopleClient(accountId: string) {
  const [account] = await db.select().from(accounts).where(eq(accounts.id, accountId)).limit(1);
  if (!account) throw new Error('Account not found');

  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({
    access_token: decrypt(account.accessToken),
    refresh_token: decrypt(account.refreshToken),
    expiry_date: new Date(account.tokenExpiresAt).getTime(),
  });

  // Persist refreshed tokens (same pattern as gmail.service.ts)
  oauth2Client.on('tokens', async (tokens) => {
    if (tokens.access_token) {
      const updates: Record<string, string> = {
        accessToken: encrypt(tokens.access_token),
        tokenExpiresAt: new Date(tokens.expiry_date || Date.now() + 3600000).toISOString(),
        updatedAt: new Date().toISOString(),
      };
      if (tokens.refresh_token) {
        updates.refreshToken = encrypt(tokens.refresh_token);
      }
      await db.update(accounts).set(updates).where(eq(accounts.id, accountId));
    }
  });

  return google.people({ version: 'v1', auth: oauth2Client });
}

// ─── Sync contacts from Google ────────────────────────────────────────

export async function syncGoogleContacts(accountId: string) {
  const people = await getPeopleClient(accountId);
  let nextPageToken: string | undefined;
  const now = new Date().toISOString();
  let synced = 0;

  do {
    const response = await people.people.connections.list({
      resourceName: 'people/me',
      pageSize: 1000,
      personFields: 'names,emailAddresses,phoneNumbers,photos,organizations,biographies',
      pageToken: nextPageToken,
    });

    const connections = response.data.connections || [];

    for (const person of connections) {
      const primaryEmail = person.emailAddresses?.[0]?.value?.toLowerCase();
      if (!primaryEmail) continue;

      const allEmails = (person.emailAddresses || [])
        .map((e) => e.value?.toLowerCase())
        .filter(Boolean) as string[];

      const primaryName = person.names?.[0];
      const primaryOrg = person.organizations?.[0];
      const primaryPhoto = person.photos?.[0];
      const primaryBio = person.biographies?.[0];

      const phoneNumbers = (person.phoneNumbers || [])
        .map((p) => p.value)
        .filter(Boolean) as string[];

      await db
        .insert(contacts)
        .values({
          accountId,
          email: primaryEmail,
          emails: allEmails,
          name: primaryName?.displayName || null,
          givenName: primaryName?.givenName || null,
          familyName: primaryName?.familyName || null,
          photoUrl: primaryPhoto?.url || null,
          phoneNumbers,
          organization: primaryOrg?.name || null,
          jobTitle: primaryOrg?.title || null,
          notes: primaryBio?.value || null,
          googleResourceName: person.resourceName || null,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [contacts.accountId, contacts.email],
          set: {
            emails: allEmails,
            name: primaryName?.displayName || sql`${contacts.name}`,
            givenName: primaryName?.givenName || null,
            familyName: primaryName?.familyName || null,
            photoUrl: primaryPhoto?.url || null,
            phoneNumbers,
            organization: primaryOrg?.name || null,
            jobTitle: primaryOrg?.title || null,
            notes: primaryBio?.value || null,
            googleResourceName: person.resourceName || null,
            updatedAt: now,
          },
        });

      synced++;
    }

    nextPageToken = response.data.nextPageToken || undefined;
  } while (nextPageToken);

  logger.info({ accountId, synced }, 'Google Contacts sync complete');
}

// ─── Query contacts ───────────────────────────────────────────────────

export async function getContactByEmail(accountId: string, email: string) {
  const normalizedEmail = email.toLowerCase();

  // Exact match on primary email
  let [contact] = await db
    .select()
    .from(contacts)
    .where(and(eq(contacts.accountId, accountId), eq(contacts.email, normalizedEmail)))
    .limit(1);

  // Fall back to searching the emails JSON array
  if (!contact) {
    [contact] = await db
      .select()
      .from(contacts)
      .where(
        and(
          eq(contacts.accountId, accountId),
          sql`EXISTS (SELECT 1 FROM json_each(${contacts.emails}) WHERE LOWER(value) = ${normalizedEmail})`,
        ),
      )
      .limit(1);
  }

  return contact || null;
}

export async function getRecentThreadsWithContact(
  accountId: string,
  email: string,
  limit = 5,
) {
  const normalizedEmail = email.toLowerCase();

  return db
    .select({
      id: threads.id,
      subject: threads.subject,
      snippet: threads.snippet,
      lastMessageAt: threads.lastMessageAt,
      unreadCount: threads.unreadCount,
    })
    .from(threads)
    .where(
      and(
        eq(threads.accountId, accountId),
        eq(threads.isTrashed, false),
        sql`EXISTS (
          SELECT 1 FROM emails e
          WHERE e.thread_id = ${threads.id}
          AND LOWER(e.from_address) = ${normalizedEmail}
        )`,
      ),
    )
    .orderBy(desc(threads.lastMessageAt))
    .limit(limit);
}

export async function listContacts(
  accountId: string,
  options: { limit?: number; offset?: number; search?: string },
) {
  const conditions = [eq(contacts.accountId, accountId)];

  if (options.search) {
    const pattern = `%${options.search.toLowerCase()}%`;
    conditions.push(
      sql`(LOWER(${contacts.name}) LIKE ${pattern} OR LOWER(${contacts.email}) LIKE ${pattern})`,
    );
  }

  return db
    .select()
    .from(contacts)
    .where(and(...conditions))
    .orderBy(desc(contacts.frequency))
    .limit(options.limit || 50)
    .offset(options.offset || 0);
}

// ─── Shared attachments ───────────────────────────────────────────────

export async function getSharedAttachments(
  accountId: string,
  email: string,
  limit = 10,
) {
  const normalizedEmail = email.toLowerCase();

  const rows = await db
    .select({
      id: attachments.id,
      filename: attachments.filename,
      mimeType: attachments.mimeType,
      size: attachments.size,
      emailId: attachments.emailId,
      threadSubject: threads.subject,
      date: emails.internalDate,
    })
    .from(attachments)
    .innerJoin(emails, eq(attachments.emailId, emails.id))
    .innerJoin(threads, eq(emails.threadId, threads.id))
    .where(
      and(
        eq(emails.accountId, accountId),
        eq(attachments.isInline, false),
        sql`LOWER(${emails.fromAddress}) = ${normalizedEmail}`,
      ),
    )
    .orderBy(desc(emails.internalDate))
    .limit(limit);

  return rows;
}

// ─── Interaction stats ────────────────────────────────────────────────

export async function getInteractionStats(accountId: string, contactEmail: string) {
  const normalizedEmail = contactEmail.toLowerCase();

  // Get the account's own email for "from you" count
  const [account] = await db
    .select({ email: accounts.email })
    .from(accounts)
    .where(eq(accounts.id, accountId))
    .limit(1);

  const accountEmail = account?.email?.toLowerCase() || '';

  const [row] = await db
    .select({
      totalEmails: sql<number>`COUNT(*)`,
      fromThem: sql<number>`SUM(CASE WHEN LOWER(${emails.fromAddress}) = ${normalizedEmail} THEN 1 ELSE 0 END)`,
      fromYou: sql<number>`SUM(CASE WHEN LOWER(${emails.fromAddress}) = ${accountEmail} THEN 1 ELSE 0 END)`,
      firstEmailDate: sql<string | null>`MIN(${emails.internalDate})`,
      lastEmailDate: sql<string | null>`MAX(${emails.internalDate})`,
    })
    .from(emails)
    .where(
      and(
        eq(emails.accountId, accountId),
        sql`EXISTS (
          SELECT 1 FROM threads t
          WHERE t.id = ${emails.threadId}
          AND t.is_trashed = 0
        )`,
        sql`(
          LOWER(${emails.fromAddress}) = ${normalizedEmail}
          OR LOWER(${emails.fromAddress}) = ${accountEmail}
        )`,
        // Only count emails in threads involving this contact
        sql`EXISTS (
          SELECT 1 FROM emails e2
          WHERE e2.thread_id = ${emails.threadId}
          AND LOWER(e2.from_address) = ${normalizedEmail}
        )`,
      ),
    );

  return {
    totalEmails: row?.totalEmails ?? 0,
    fromThem: row?.fromThem ?? 0,
    fromYou: row?.fromYou ?? 0,
    firstEmailDate: row?.firstEmailDate ?? null,
    lastEmailDate: row?.lastEmailDate ?? null,
  };
}

// ─── Contact enrichment ──────────────────────────────────────────────

const ENRICHMENT_CACHE_DAYS = 30;

export async function enrichContactByEmail(accountId: string, contactEmail: string) {
  const normalizedEmail = contactEmail.toLowerCase();
  const now = new Date().toISOString();

  // Check if we already have a contact with recent enrichment
  let contact = await getContactByEmail(accountId, normalizedEmail);

  if (contact?.enrichedAt) {
    const enrichedDate = new Date(contact.enrichedAt);
    const daysSinceEnrich = (Date.now() - enrichedDate.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceEnrich < ENRICHMENT_CACHE_DAYS) {
      return contact; // Still fresh
    }
  }

  // Import enrichment service lazily to avoid circular deps
  const { enrichContact } = await import('./enrichment.service');
  const result = await enrichContact(normalizedEmail);

  if (!result) {
    // Mark as enriched (with no data) to avoid re-fetching too often
    if (contact) {
      await db
        .update(contacts)
        .set({ enrichedAt: now, enrichmentSource: 'none', updatedAt: now })
        .where(and(eq(contacts.accountId, accountId), eq(contacts.email, normalizedEmail)));
    }
    return contact;
  }

  // Build update set — only fill empty fields, never overwrite Google Contacts data
  const updates: Record<string, unknown> = {
    enrichedAt: now,
    enrichmentSource: result.source,
    updatedAt: now,
  };

  if (result.socialProfiles.length > 0) {
    // Merge with existing social profiles
    const existing = (contact?.socialProfiles || []) as import('@atlasmail/shared').SocialProfile[];
    const existingTypes = new Set(existing.map((s) => s.type));
    const merged = [...existing, ...result.socialProfiles.filter((s) => !existingTypes.has(s.type))];
    updates.socialProfiles = merged;
  }

  // Only fill in empty fields
  if (!contact?.name && result.name) updates.name = result.name;
  if (!contact?.jobTitle && result.jobTitle) updates.jobTitle = result.jobTitle;
  if (!contact?.organization && result.organization) updates.organization = result.organization;
  if (!contact?.photoUrl && result.photoUrl) updates.photoUrl = result.photoUrl;

  if (contact) {
    await db
      .update(contacts)
      .set(updates)
      .where(and(eq(contacts.accountId, accountId), eq(contacts.email, normalizedEmail)));
  } else {
    // Create a new contact with enrichment data
    await db.insert(contacts).values({
      accountId,
      email: normalizedEmail,
      emails: [normalizedEmail],
      name: (result.name as string) || null,
      jobTitle: (result.jobTitle as string) || null,
      organization: (result.organization as string) || null,
      photoUrl: (result.photoUrl as string) || null,
      socialProfiles: result.socialProfiles.length > 0 ? result.socialProfiles : null,
      enrichedAt: now,
      enrichmentSource: result.source,
      createdAt: now,
      updatedAt: now,
    });
  }

  // Return the updated contact
  return getContactByEmail(accountId, normalizedEmail);
}

// ─── Contact notes ────────────────────────────────────────────────────

export async function updateContactNotes(
  accountId: string,
  contactEmail: string,
  notes: string,
) {
  const normalizedEmail = contactEmail.toLowerCase();
  const now = new Date().toISOString();

  // Try to update existing contact
  const result = await db
    .update(contacts)
    .set({ notes, updatedAt: now })
    .where(and(eq(contacts.accountId, accountId), eq(contacts.email, normalizedEmail)));

  // If no matching contact exists, create one with just the email and notes
  if (result.changes === 0) {
    await db.insert(contacts).values({
      accountId,
      email: normalizedEmail,
      emails: [normalizedEmail],
      notes,
      createdAt: now,
      updatedAt: now,
    });
  }
}
