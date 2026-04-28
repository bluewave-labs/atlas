# Google Sync Engine — Design Spec

**Status:** Approved by user, ready for implementation planning.
**Author session:** 2026-04-28
**Supersedes:** `docs/superpowers/plans/2026-04-28-google-sync-engine-phase-1.md` (the original Phase 1-only plan; its 6 commits remain valid as foundation, but their semantics evolve under this design — see "Phase 1 reuse" below).

---

## 1. Goal

Atlas needs a real engine room for Google integration. Today only Calendar sync works (and only when triggered manually via Phase 1 BullMQ wiring). Email sync — the marquee CRM feature — is entirely stubbed.

This spec defines a **production-grade email + calendar sync subsystem** that:

- Pulls Gmail messages into Atlas as first-class CRM activities and a queryable inbox-style store.
- Lets users compose and reply to emails from inside CRM, threaded correctly in Gmail.
- Auto-matches senders/recipients to CRM contacts (with configurable policy).
- Handles rate limits, token expiry, and revoked auth without cascading failures.
- Stays private by default; exposes channel-level visibility for shared inboxes.

Scope is **"light email client inside CRM"** — see contact's email history, reply, initiate. Not a full inbox UI, not drafts, not templates. Those are Phase 3.

## 2. What we're not building (this phase)

| Out of scope | Why |
|---|---|
| Microsoft / Outlook OAuth | Atlas's user base is primarily Google; one provider per phase |
| Generic IMAP / SMTP | Same — and dramatically more complex auth & sync |
| Push notifications (Pub/Sub / Gmail watch) | Polling is sufficient at our latency tolerance; push is its own infra project |
| Drafts (server-saved, multi-device) | Real product surface in itself; needs autosave, conflict handling |
| Email templates with variables | Orthogonal feature, easy to add later |
| Attachment send/receive | Phase 3; needs file upload + multipart MIME |
| Email aliases (multiple from-addresses per channel) | Phase 3 |
| Read receipts / open tracking | Privacy-sensitive product decision; not core CRM |
| Folder mirroring (per-channel folder entity) | Gmail labels stored as JSONB on `messages` is sufficient |
| Multi-channel-per-account UI | Schema supports it; UI to add channels other than the primary is Phase 3 |
| Full blocklist management UI | Schema + "block this sender" button only |
| Tenant-level retention UI | Server-side enforcement only; settings UI is Phase 3 |

## 3. Architecture

```
┌─────────────────────────────────────────────┐
│ Client UI                                   │
│   Settings > Integrations: connect, channels │
│   CRM contact/deal page: timeline + composer │
└─────────────────────────────────────────────┘
                    │ REST
┌─────────────────────────────────────────────┐
│ HTTP layer (CRM controllers)                │
│   /crm/google/sync/start  (Phase 1 — extend)  │
│   /crm/channels/*         (new)              │
│   /crm/messages/*         (new)              │
└─────────────────────────────────────────────┘
                    │ enqueue
┌─────────────────────────────────────────────┐
│ Sync worker (Phase 1 BullMQ)                │
│   Job names:                                 │
│     calendar-full-sync (Phase 1)             │
│     calendar-incremental-sync (Phase 1)      │
│     gmail-full-sync                          │
│     gmail-incremental-sync                   │
│     gmail-send                               │
│     participant-match                        │
│     gmail-message-cleaner                    │
└─────────────────────────────────────────────┘
                    │ calls
┌─────────────────────────────────────────────┐
│ Domain services                             │
│   gmail-sync.service       (fetch + parse)   │
│   gmail-send.service       (compose + send)  │
│   participant-match.service                  │
│   channel.service          (CRUD + settings) │
│   retention.service        (cleaner)         │
│   google-api-call          (401/refresh wrap)│
└─────────────────────────────────────────────┘
                    │
                  Postgres
```

**Boundaries:**

- The BullMQ worker (Phase 1) gets new job names but no architectural change. Adding `gmail-*` cases is a one-case addition to the existing `processSyncJob` switch in `packages/server/src/workers/sync.worker.ts`.
- Calendar sync stays exactly as-is. Email is parallel.
- The existing `accounts` table keeps OAuth credentials. New `message_channels` table holds per-channel config + sync state. Designed for many-per-account later (shared sales@), even though every account starts with exactly one channel today.
- Visibility enforcement lives in `message.service` at the query layer — every read filters by `channel.visibility = 'shared-with-tenant' OR channel.ownerUserId = req.auth.userId`. Controllers don't re-implement.

## 4. Phase 1 reuse and migration

The 6 unpushed Phase 1 commits already on `main` stay. They built the BullMQ rails (queue factory, worker, lifecycle, bootstrap wiring, real `startGoogleSync` enqueue, `WORKER_MODE` env var). All of that remains correct under this design.

Two semantic shifts as Phase 2 lands:

1. **`accounts.syncStatus` semantics narrow.** Phase 1 used `accounts.syncStatus` as the single sync flag. Phase 2 keeps it as the **OAuth health flag** (`'idle'` | `'pending'` | `'disconnected'`), and moves per-sync state to `message_channels.syncStage` / `.syncStatus` / `.syncCursor`. The `startGoogleSync` controller (currently Phase 1 commit `c0a0b88a`) evolves to enqueue both `calendar-full-sync` (already done) and `gmail-full-sync` per channel of the account.

2. **Repeatable scheduler in `workers/index.ts:scheduleIncrementalSyncForAllAccounts` extends.** Today it schedules one `calendar-incremental-sync` per Google-connected account. Phase 2 adds: one `gmail-incremental-sync` per **channel** that is `isSyncEnabled=true` AND not currently throttled. Same shape, just two job types instead of one.

No Phase 1 commits get reverted. No DB migration of existing data — every existing account gets a `message_channels` row inserted on first Phase 2 boot (one-time backfill in the bootstrap migration).

## 5. Data model

Five new tables, three column additions to `crm_activities`. No schema changes to `accounts` (only column-usage semantics).

### 5.1 `message_channels` (new)

The unit of sync. One row per Gmail inbox per Atlas account. Schema designed for many-per-account; Phase 2 only ever creates one.

| column | type | constraints | notes |
|---|---|---|---|
| `id` | `uuid` | PK | |
| `accountId` | `uuid` | FK → `accounts.id`, cascade on delete | the Google connection |
| `tenantId` | `uuid` | not null | denormalized for fast tenant queries |
| `ownerUserId` | `uuid` | FK → `users.id`, cascade on delete | who connected |
| `type` | `text` | default `'gmail'` | `'gmail'` only for Phase 2; reserve `'imap'`, `'outlook'` |
| `handle` | `text` | not null | the email address |
| `visibility` | `text` | default `'private'` | `'private'` \| `'shared-with-tenant'` |
| `isSyncEnabled` | `boolean` | default `true` | toggle without disconnecting |
| `contactAutoCreationPolicy` | `text` | default `'send-only'` | `'none'` \| `'send-only'` \| `'send-and-receive'` |
| `syncStage` | `text` | default `'pending'` | `'pending'` \| `'full-sync'` \| `'incremental'` \| `'failed'` \| `'paused'` |
| `syncStatus` | `text` | nullable | last short status string |
| `syncError` | `text` | nullable | last error |
| `syncCursor` | `text` | nullable | Gmail `historyId` |
| `lastFullSyncAt` | `timestamptz` | nullable | |
| `lastIncrementalSyncAt` | `timestamptz` | nullable | |
| `throttleFailureCount` | `int` | default `0` | |
| `throttleRetryAfter` | `timestamptz` | nullable | when set, worker skips channel until past |
| `pushSubscriptionId` | `text` | nullable | Phase 3 — null today |
| `pushWatchExpiration` | `timestamptz` | nullable | Phase 3 — null today |
| `createdAt`, `updatedAt` | `timestamptz` | not null, defaults | |

**Indexes:**
- `(accountId)` — list channels for an account
- `(tenantId, isSyncEnabled)` — scheduler scan
- `(ownerUserId)` — user-owned channels for visibility filter

### 5.2 `message_threads` (new)

| column | type | constraints |
|---|---|---|
| `id` | `uuid` | PK |
| `channelId` | `uuid` | FK → `message_channels.id`, cascade |
| `tenantId` | `uuid` | not null |
| `gmailThreadId` | `text` | not null |
| `subject` | `text` | nullable |
| `messageCount` | `int` | default `0` |
| `lastMessageAt` | `timestamptz` | nullable |
| `createdAt`, `updatedAt` | `timestamptz` | not null |

**Constraints / indexes:**
- Unique `(channelId, gmailThreadId)`
- `(tenantId, lastMessageAt DESC)` — global timeline
- `(channelId, lastMessageAt DESC)` — per-channel timeline

### 5.3 `messages` (new)

| column | type | constraints |
|---|---|---|
| `id` | `uuid` | PK |
| `channelId` | `uuid` | FK → `message_channels.id`, cascade |
| `threadId` | `uuid` | FK → `message_threads.id`, cascade |
| `tenantId` | `uuid` | not null (denormalized for visibility) |
| `gmailMessageId` | `text` | not null |
| `headerMessageId` | `text` | nullable; RFC `Message-ID:` |
| `inReplyTo` | `text` | nullable; RFC `In-Reply-To:` |
| `subject` | `text` | nullable |
| `snippet` | `text` | nullable; Gmail-provided ~200 char preview |
| `bodyText` | `text` | nullable; truncate to 1MB |
| `bodyHtml` | `text` | nullable; sanitized |
| `direction` | `text` | not null; `'inbound'` \| `'outbound'` |
| `status` | `text` | default `'received'`; for outbound: `'pending'` \| `'sent'` \| `'failed'` |
| `sentAt` | `timestamptz` | nullable |
| `receivedAt` | `timestamptz` | nullable; inbound only |
| `labels` | `jsonb` | default `'[]'`; array of Gmail label names |
| `hasAttachments` | `boolean` | default `false` |
| `deletedAt` | `timestamptz` | nullable; soft-delete (cleaner / Gmail message deletions) |
| `createdAt`, `updatedAt` | `timestamptz` | not null |

**Constraints / indexes:**
- Unique `(channelId, gmailMessageId)`
- `(threadId, sentAt)` — render thread chronologically
- `(tenantId, sentAt DESC)` partial `WHERE direction='inbound' AND deletedAt IS NULL` — recent inbound
- `(tenantId, status, direction)` partial `WHERE direction='outbound'` — find pending sends

**Decision: no `message_folders` table.** Gmail labels stored as JSONB. Query-time filtering is cheap; folders are not load-bearing for our UI.

### 5.4 `message_participants` (new)

| column | type | constraints |
|---|---|---|
| `id` | `uuid` | PK |
| `messageId` | `uuid` | FK → `messages.id`, cascade |
| `tenantId` | `uuid` | not null |
| `role` | `text` | not null; `'from'` \| `'to'` \| `'cc'` \| `'bcc'` |
| `handle` | `text` | not null; lowercased |
| `displayName` | `text` | nullable |
| `personId` | `uuid` | nullable, FK → `crm_contacts.id`, set null on delete |
| `workspaceMemberId` | `uuid` | nullable, FK → `users.id`, set null on delete |
| `createdAt`, `updatedAt` | `timestamptz` | not null |

**Indexes:**
- `(handle, tenantId)` — re-match when contacts get added
- `(personId)` — "all messages with Jane"
- `(messageId, role)` — render headers

### 5.5 `message_blocklist` (new)

| column | type | constraints |
|---|---|---|
| `id` | `uuid` | PK |
| `tenantId` | `uuid` | not null |
| `pattern` | `text` | not null; exact email or `*@domain.com` |
| `createdByUserId` | `uuid` | FK → `users.id`, set null on delete |
| `createdAt` | `timestamptz` | not null, default now |

Unique `(tenantId, pattern)`.

**Bootstrap seed** (one-time, runs once per tenant on Phase 2 first boot):
- `*@noreply.*`
- `*@mailer-daemon.*`
- `*@no-reply.*`
- `notifications@github.com`

### 5.6 `crm_activities` — additions

| column | type | constraints |
|---|---|---|
| `messageId` | `uuid` | nullable, FK → `messages.id`, set null on delete |
| `externalProvider` | `text` | nullable |
| `externalId` | `text` | nullable |

When a message is ingested, the worker upserts a `crm_activities` row with `type='email-received'` or `type='email-sent'`, `messageId` set, plus `contactId`/`dealId`/`companyId` resolved from participant matching.

**Why both `messages` and `crm_activities`?** Separation: `messages` is the canonical email store (used by inbox-style UI on contact pages); `crm_activities` is the unified timeline (used everywhere else). A message can fan out to multiple activities (one per linked contact / deal / company). Keeping them separate means we can re-derive activities when matching logic changes, without re-fetching from Gmail.

## 6. Sync flow

### 6.1 Connect flow (extends Phase 1)

1. User clicks "Connect Google" in Settings > Integrations.
2. Existing OAuth flow runs (Phase 1, unchanged); tokens stored encrypted in `accounts`.
3. **New:** on successful callback, insert one `message_channels` row with:
   - `type='gmail'`
   - `handle=<google email>`
   - `visibility='private'` (safe default)
   - `contactAutoCreationPolicy='send-only'`
   - `syncStage='pending'`
   - `isSyncEnabled=true`
4. Enqueue `gmail-full-sync` for the new channel (and `calendar-full-sync` for the account, as Phase 1 already does).

### 6.2 Full sync — `gmail-full-sync` job

Runs once per channel on connect, or when user clicks "Sync now."

1. Lock: `UPDATE message_channels SET syncStage='full-sync', syncStatus='running' WHERE id=?`.
2. Initial fetch: `users.history.list` requires a starting `historyId`. So instead, do `users.messages.list` paginating with `q=newer_than:90d` to bound scope. (Default backfill: 90 days. Configurable later.)
3. For each batch of message ids: `users.messages.get(id, format='metadata')` for headers + snippet; full body fetch only when ingesting.
4. Per message:
   - Upsert `message_threads` by `(channelId, threadId)`.
   - Insert `messages` row (skip if `(channelId, gmailMessageId)` already exists).
   - Extract participants from `From`/`To`/`Cc`/`Bcc` headers, lowercase, dedupe.
   - For each participant: lookup CRM contact by lowercased handle within tenant; if found, set `personId`. If not found AND policy permits AND not blocklisted, enqueue `participant-match` (so contact creation runs separately and batches).
   - Resolve which CRM entities the message links to (contact via `participant.personId`; deal via contact's open deals; company via contact's company). Insert `crm_activities` rows.
5. After last page: fetch latest `historyId` (`users.getProfile`), store as `syncCursor`.
6. Set `syncStage='incremental'`, `lastFullSyncAt=now()`, clear `syncError`.
7. Schedule the repeatable incremental job for this channel.

### 6.3 Incremental sync — `gmail-incremental-sync` job

Repeatable BullMQ job, every 5 minutes per channel.

1. Skip if `throttleRetryAfter > now()` or `isSyncEnabled=false`.
2. Call `users.history.list(startHistoryId=channel.syncCursor)`. If 404 (cursor expired — happens if cursor is >7 days stale), set `syncStage='pending'`, enqueue `gmail-full-sync`, return.
3. For each `historyRecord`:
   - `messagesAdded`: ingest like full-sync.
   - `messagesDeleted`: soft-delete (`messages.deletedAt = now()`); don't drop `crm_activities` (history preserved).
   - `labelsAdded` / `labelsRemoved`: update `messages.labels` JSONB.
4. Update `syncCursor` to the last `historyRecord.id`.
5. Set `lastIncrementalSyncAt=now()`.

### 6.4 Throttle / backoff

On Gmail 429 / `userRateLimitExceeded`:
1. Read `Retry-After` header if present, else default 60s.
2. `throttleRetryAfter = now() + retryAfter`; `throttleFailureCount++`.
3. Return cleanly — do **not** rethrow. The BullMQ retry budget stays for actual errors; the repeatable scheduler will try next tick and find `throttleRetryAfter` past.
4. On successful sync, reset `throttleFailureCount=0`.
5. If `throttleFailureCount > 10`: `syncStage='failed'`, `syncError='Persistent rate limit; sync paused'`. Surface in UI.

### 6.5 Token refresh / 401 handling

The existing `getAuthenticatedClient` only refreshes proactively (60s before expiry). New wrapper for mid-call 401s:

```ts
// services/google-api-call.ts
export async function callGoogleApi<T>(
  accountId: string,
  fn: (auth: OAuth2Client) => Promise<T>,
): Promise<T> {
  const auth = await getAuthenticatedClient(accountId);
  try {
    return await fn(auth);
  } catch (err: any) {
    if (err?.code === 401 || err?.response?.status === 401) {
      const auth2 = await forceRefreshClient(accountId);
      return await fn(auth2);
    }
    throw err;
  }
}
```

**Calendar sync wraps with this too** — Phase 1 review item that was deferred. Lands in Phase 2 as a small refactor of `calendar-sync.service.ts`.

### 6.6 Watch expiry / token revoked

On `invalid_grant` (refresh token revoked):
- `accounts.syncStatus='disconnected'`
- All channels of that account: `syncStage='paused'`, `syncStatus='Account disconnected — please reconnect'`
- UI shows "reconnect" prompt at the top of the integrations panel.

## 7. Outbound send

### 7.1 UI surface

Two entry points in CRM:

1. **Reply-in-thread** — On a contact/deal timeline, an email-type activity row has a "Reply" button. Inline composer below pre-fills `to` (the participants of the original, minus the user), `subject` (`Re: <original>`), `inReplyTo`, `references`.
2. **New email to contact** — On a contact card, "Email" button. Composer with `to` prefilled to `contact.email`. User picks `from` (one of their connected channels — usually only one for Phase 2).

Plaintext-first composer. HTML-rich is Phase 3. Both entry points use the same composer component.

### 7.2 Send flow — `gmail-send` job

Send happens **synchronously to Atlas, asynchronously to Gmail**:

1. Client POSTs `/crm/messages/send` with body fields.
2. Server validates (sender owns the channel, channel is enabled, recipients valid).
3. Server writes a `messages` row with `direction='outbound'`, `status='pending'`.
4. Server enqueues `gmail-send` job, returns 202 to client with the message id.
5. Client renders the message in the timeline immediately, marked "sending."
6. Worker handles the actual API call.

**Why async-to-Gmail:** Gmail API is slow (~2s typical); BullMQ retries are uniform with inbound; UI feels instant (optimistic render flips to "sent" or "failed").

### 7.3 Worker steps

1. Read the pending `messages` row by id.
2. Build RFC 5322 message: `From`, `To`, `Cc`, `Bcc`, `Subject`, `In-Reply-To` (if reply), `References` (if reply), body. Base64url-encode.
3. `users.messages.send({ raw, threadId })` — pass `threadId` only when replying.
4. Response gives the actual `gmailMessageId` and `threadId`. Update the `messages` row: set `gmailMessageId`, `headerMessageId` from `Message-Id` header, `status='sent'`, `sentAt=now()`.
5. Insert `crm_activities` row with `type='email-sent'`, linked to contact/deal/company derived from recipient matching.
6. On send failure: `status='failed'`, store error. UI surfaces "retry" — clicking enqueues a fresh `gmail-send` for that message id.

### 7.4 Threading correctness rules

The single most common bug in CRM email integrations:

1. **Always pass `threadId`** to `users.messages.send` when replying. Header-only threading is unreliable.
2. **Always include `In-Reply-To: <headerMessageId>`** of the message being replied to.
3. **`References:` must be cumulative** — original's `References` header (if any) + original's `Message-ID`. Gmail's web client uses this for visual threading even when your client uses `threadId`.

## 8. Error handling, observability, retention

### 8.1 Error categories

| failure | where caught | reaction |
|---|---|---|
| 401 Unauthorized (expired/invalid token) | `callGoogleApi` wrapper | force refresh, retry once; if second 401, channel `syncStage='paused'` + reconnect prompt |
| 429 / `userRateLimitExceeded` | per-call try/catch in `gmail-sync.service` | set `throttleRetryAfter`, increment counter, return cleanly |
| 5xx Gmail | BullMQ retry (existing 3-attempt exponential backoff) | logs failure; eventually fails the job; `syncCursor` preserved so next tick retries |
| Cursor expired (404 from `history.list`) | `gmail-incremental-sync` | re-enqueue full sync, return |
| `invalid_grant` (refresh revoked) | `forceRefreshClient` | `accounts.syncStatus='disconnected'`; all channels paused |
| Postgres write failure mid-ingest | per-message try/catch | log, skip that message, continue batch (don't poison whole sync) |
| Body > 1MB | extraction layer | truncate, set `bodyText`, log warning |
| Inbound message with no `from` header | participant extraction | skip; rare, usually spam |

### 8.2 Observability

- **Structured per-sync logs** — `Gmail sync completed` with `{ channelId, messagesIngested, durationMs, throttleFailureCount }`. JSON logs queryable via Dokploy.
- **`/crm/google/status` extends** to include `channels: [{ id, handle, syncStage, syncStatus, lastIncrementalSyncAt, throttleRetryAfter, messageCount24h }]`. Settings UI renders as a list.
- **`/api/v1/health` adds** `gmailSync: { activeChannels, throttledChannels, failedChannels }`.

### 8.3 Retention — `gmail-message-cleaner` job

Repeatable BullMQ job, daily.

1. Read tenant-level setting `gmail_retention_days` (default `null` = keep forever).
2. For tenants with retention set, soft-delete `messages` rows where `sentAt < now() - retention_days` (set `deletedAt`); keep `crm_activities` row in place — timeline survives even when email body is cleaned.
3. Hard-delete (drop the message + its participants) runs 30 days after soft-delete.
4. Setting lives in `tenant_settings` (existing table) — server-side only in Phase 2; UI control is Phase 3.

### 8.4 Blocklist enforcement

- `participant-match` job, before enqueueing contact auto-creation, checks `message_blocklist` for the handle. If blocked, skip auto-creation but **still create the participant** (with `personId=null`). Blocklist is "don't grow CRM from this sender," not "hide this email."
- "Block this sender" button on a participant inserts a `message_blocklist` row.
- Initial seed (per tenant, on Phase 2 first boot): `*@noreply.*`, `*@mailer-daemon.*`, `*@no-reply.*`, `notifications@github.com`.

## 9. Visibility and authorization

- `message_channels.visibility` is `'private'` (default) or `'shared-with-tenant'`.
- **Enforcement is at the query layer in `message.service`.** Every read from `messages`, `message_threads`, `message_participants`, or `crm_activities` (when filtering for email-type activities) joins through `message_channels` and applies:
  ```sql
  WHERE message_channels.tenantId = req.auth.tenantId
    AND (
      message_channels.visibility = 'shared-with-tenant'
      OR message_channels.ownerUserId = req.auth.userId
    )
  ```
- Controllers do **not** re-implement this filter. The service layer is the only legitimate read path.
- Visibility changes propagate via the channel UPDATE — no per-message ACL.

## 10. New endpoints

### Server
- `GET /crm/channels` — list channels for current user (filter by visibility above).
- `PATCH /crm/channels/:id` — update visibility, isSyncEnabled, contactAutoCreationPolicy.
- `POST /crm/channels/:id/sync` — manual full sync (enqueues `gmail-full-sync`).
- `GET /crm/contacts/:id/messages` — emails on a contact's timeline.
- `GET /crm/deals/:id/messages` — emails on a deal's timeline.
- `GET /crm/threads/:id` — full thread with participants.
- `POST /crm/messages/send` — initiate send; returns message id.
- `POST /crm/messages/:id/retry` — re-enqueue a failed outbound.
- `POST /crm/blocklist` — add an entry.
- `GET /crm/google/status` — extended (Phase 1 endpoint, now includes per-channel array).

### Client
- Settings > Integrations: extend to render channel list with per-channel toggles (visibility, sync on/off, auto-create policy).
- Contact card: "Email" button → composer popover.
- Contact/deal timeline: email activities render as expandable thread cards with reply button.

## 11. Testing strategy

### Unit (vitest, existing pattern)
- `gmail-sync.service.test.ts` — full sync, incremental, cursor expiry, throttle.
- `gmail-send.service.test.ts` — RFC message construction, threading headers, threadId propagation.
- `participant-match.service.test.ts` — handle lookup, auto-create policy, blocklist.
- `gmail-message-cleaner.service.test.ts` — soft/hard delete cycle.
- `crm-channels-controller.test.ts` — list, update, manual sync.
- `sync.worker.test.ts` — extend with new job dispatch cases.
- `google-api-call.test.ts` — 401 retry-with-refresh.

### Integration (`test:integration` lane)
- One end-to-end: connect a fixture account, run full sync against recorded Gmail trace (nock), verify messages/threads/participants/activities land correctly.

### Manual smoke gates (before push)
- Sync a real Gmail to dev tenant.
- Messages appear on contact timeline.
- Sender auto-creates contact (`send-only` policy).
- Reply-in-thread: verify in Gmail web that it's threaded.
- Private channel: messages NOT visible to a different user in the same tenant.
- Pause sync stops new messages.

## 12. Phasing within "Phase 2"

To keep PRs reviewable, Phase 2 implementation breaks into **four sub-phases**, each shippable on its own:

### 2a. Schema + read path (no Gmail API yet)
- All five new tables + `crm_activities` columns
- `channel.service` CRUD
- `/crm/channels/*` endpoints
- Settings UI rendering channel list (read-only first)
- Migration: backfill `message_channels` row for every existing Google `accounts` row
- **Gates:** no behavior change for users; just schema in place

### 2b. Gmail inbound sync
- `gmail-sync.service` (full + incremental)
- `participant-match.service`
- `google-api-call` 401 wrapper (also retrofitted into calendar)
- New job dispatches in worker
- Repeatable scheduler now per-channel
- Settings UI: per-channel sync toggle, manual "sync now" button
- **Gates:** messages appear on contact timeline

### 2c. Outbound send
- `gmail-send.service`
- `/crm/messages/send` + `/crm/messages/:id/retry`
- Composer UI (reply-in-thread + new-to-contact)
- Outbound message status states (pending → sent → failed)
- **Gates:** users can compose and reply; threading verified in Gmail web

### 2d. Visibility + retention + blocklist
- Enforcement filter in `message.service`
- Visibility controls in Settings
- `gmail-message-cleaner` job
- Blocklist seed + "block sender" button
- **Gates:** privacy correct; cleaner runs without breaking history

Each sub-phase gets its own implementation plan and PR. The four together = Phase 2 done.

## 13. Open questions deferred to implementation

- **HTML body sanitization library** (DOMPurify? sanitize-html?). Decide during 2b implementation; doesn't affect schema.
- **Backfill window for first sync** — 90 days proposed; may need to be configurable per tenant if some users have huge inboxes. Decide during 2b.
- **Soft-delete TTL before hard delete** — 30 days proposed. Decide during 2d.
- **Composer rich text** — explicitly Phase 3, but the schema already supports `bodyHtml` so it's purely a UI question later.
- **Partial index on `messages` for inbound + non-deleted reads** — 2a code review (commit `4f579f86`) flagged that the existing `idx_messages_tenant_inbound_sent` on `(tenantId, sentAt)` doesn't include `direction` or `deletedAt` predicates. Acceptable for 2a (no reads yet), but **2b MUST add a partial index** before the inbox-listing query lands: `CREATE INDEX idx_messages_tenant_inbound_active ON messages (tenant_id, sent_at DESC) WHERE direction = 'inbound' AND deleted_at IS NULL;` (Drizzle: pass a `where` predicate to the `.index()` builder). Without it, large tenants will scan every row in the `sentAt` range before applying the filter. **Done in 2b Task 1 (commit `7605afba`).**
- **Functional index on `crm_contacts.email` for case-insensitive lookups** — Phase 2b's participant matching does `LOWER(email) = ?` lookups within tenant. Postgres can't use a plain B-tree on `email` for this; for tenants with thousands of contacts, the per-message lookup will table-scan. Phase 2b mitigates by using a single tenant-scoped SELECT + JS-side filtering in `matchHandlesToContacts`, which is one query per message instead of one per participant. A proper functional index `CREATE INDEX idx_crm_contacts_tenant_email_lower ON crm_contacts (tenant_id, LOWER(email))` should land before production volume — track as a Phase 2c or 2d follow-up.
