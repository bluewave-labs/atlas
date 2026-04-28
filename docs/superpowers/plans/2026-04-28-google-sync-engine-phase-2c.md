# Google Sync Engine — Phase 2c: Outbound Send + Auto-Create Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users send and reply to emails from inside CRM. Outbound messages get composed in a CRM-side composer, persisted as `messages` rows with `direction='outbound'`, enqueued as `gmail-send` BullMQ jobs, and delivered via `users.messages.send` with correct threading headers. Also wire the contact auto-creation path that 2b left as a no-op.

**Architecture:** New `gmail-send.service` builds RFC 5322 messages (subject, from, to, cc, bcc, threading headers, plaintext body) and submits via `googleapis`. The worker's `processSyncJob` switch grows a `gmail-send` case. New `crm-contact-create.service` handles auto-creation when policy + direction permit. New REST endpoints `POST /crm/messages/send` and `POST /crm/messages/:id/retry` orchestrate persistence + enqueue. Composer UI sits inside the CRM contact / deal timelines as a popover.

**Tech Stack:** `googleapis@144` (Gmail v1 `users.messages.send`), Drizzle ORM, BullMQ ^5.25, vitest, React + TanStack Query + react-i18next.

**Out of scope for 2c:** Drafts (server-saved across devices) — Phase 3. Templates with variable substitution — Phase 3. Scheduled send. Attachments out (multipart MIME upload) — Phase 3. Rich-text / HTML body composition — `messages.bodyHtml` stays nullable on outbound; the composer is plaintext only. Email aliases / multiple from-addresses per channel — Phase 3. Read receipts / open tracking. Visibility enforcement on read paths — Phase 2d. Retention cleaner — Phase 2d.

---

## Phase 2b baseline

The Phase 2b commits already on `origin/main` (`7605afba..fa7c38e7`) define the foundation:
- `gmail-sync.service.ts` ingests inbound messages and accepts a `direction: 'inbound' | 'outbound'` parameter on its internal `ingestMessage` helper. Outbound is never called today; 2c will reuse the same shape.
- `messages.status` is `text` defaulting to `'received'`. Outbound rows use `'pending' → 'sent' → 'failed'`.
- `messages.direction` is `text` (no DB-level enum constraint); `'inbound'` and `'outbound'` are the only values used.
- `participant-match.service` exports `shouldAutoCreate(policy, role, direction)`. The decision exists; the create call is what 2c adds.
- Composer can use the same auth scope already requested (`gmail.send`). No OAuth re-grant needed.
- `gmail-sync.service:ingestMessage` has the upsert and threading logic we need; 2c's outbound path inserts a NEW message row directly (not via `ingestMessage`) because we know the channel + we don't have a `gmailMessageId` until after the API call returns.

---

## File structure

**New files (server):**
- `packages/server/src/apps/crm/services/gmail-send.service.ts` — `performGmailSend(messageId)`. Reads the pending `messages` row, builds RFC 5322, calls `users.messages.send`, updates row with `gmailMessageId`, `headerMessageId`, `status='sent'`, `sentAt`. Wires participant-match + activity fan-out.
- `packages/server/src/apps/crm/services/rfc5322.ts` — pure functions: `buildRfc5322Message(input)` that emits the encoded MIME string ready for `users.messages.send`. Header-only (no MIME multipart for 2c — plaintext only).
- `packages/server/src/apps/crm/services/crm-contact-create.service.ts` — `autoCreateContactIfNeeded(args)`: applies policy + blocklist + creates the contact when permitted. Used both during inbound ingestion (Phase 2b's stubbed branch) and outbound send.
- `packages/server/src/apps/crm/controllers/messages.controller.ts` — REST handlers for `sendMessage`, `retryMessage`, `getMessage`.
- `packages/server/test/rfc5322.test.ts`
- `packages/server/test/gmail-send-service.test.ts`
- `packages/server/test/crm-contact-create-service.test.ts`
- `packages/server/test/messages-controller.test.ts`

**Modified files (server):**
- `packages/server/src/config/queue.ts` — add `SyncJobName.GmailSend` + `GmailSendJobData` type + extend `SyncJobData` union
- `packages/server/src/workers/sync.worker.ts` — add `case SyncJobName.GmailSend`
- `packages/server/test/sync-worker.test.ts` — extend with one new dispatch test
- `packages/server/src/apps/crm/routes.ts` — register `/messages/send`, `/messages/:id/retry`, `/messages/:id`
- `packages/server/src/apps/crm/services/gmail-sync.service.ts` — wire the auto-create path inside `ingestMessage` (replaces the 2b no-op stub) by calling `autoCreateContactIfNeeded`

**New files (client):**
- `packages/client/src/apps/crm/hooks/use-send-message.ts` — `useSendMessage`, `useRetryMessage` mutations
- `packages/client/src/apps/crm/components/email-composer/email-composer.tsx` — controlled composer (subject, to, cc, body), submit button
- `packages/client/src/apps/crm/components/email-composer/email-composer-popover.tsx` — Popover wrapper used from contact card and timeline reply button
- `packages/client/src/apps/crm/components/email-composer/use-composer-state.ts` — local Zustand store keyed by `composerKey` so opening/closing the popover doesn't lose draft text
- `packages/client/src/apps/crm/components/activity-list/email-activity-row.tsx` — renderer for `email-received` / `email-sent` activity rows in the timeline (with a "Reply" button)

**Modified files (client):**
- The contact card / contact detail page (find via grep) — add "Email" button → opens composer popover with `to=contact.email`
- The activity-list switch (find via grep) — route email-typed activities to `EmailActivityRow`
- `packages/client/src/config/query-keys.ts` — add `crm.messages` namespace
- `packages/client/src/i18n/locales/{en,tr,de,fr,it}.json` — translation keys (EN populated; others follow team workflow)

**Why this layout:** Same boundary as 2b — domain logic in `apps/crm/services/`, pure logic in its own file (`rfc5322.ts`) for fixture-based testing, controllers in `apps/crm/controllers/`. The composer splits into 3 client files because each has a different responsibility (form, popover wrapping, draft state) and we mount the composer from two places (contact card, timeline reply) without prop-drilling.

---

## Conventions you must follow

These come from `CLAUDE.md` and the project's auto-memory:

- **Branch policy:** Commit and push to `main`. Do NOT create a feature branch.
- **No PR.** Do NOT run `gh pr create`. Push directly to `main` (per Atlas convention).
- **Don't push automatically.** This plan ends with all commits on `main` but **not pushed**. The user pushes when ready (per the Phase 2a/2b pattern).
- **Tests live in `packages/server/test/`** (NOT colocated). Run from `packages/server`: `npm test`. Vitest config at `packages/server/vitest.config.ts`. Global setup at `packages/server/test/setup.ts` mocks `../src/config/database` and `../src/utils/logger` for every test.
- **Test-driven:** every task that adds logic writes a failing vitest first, sees it fail, then implements.
- **Schema source of truth:** `packages/server/src/db/schema.ts`. No new tables in 2c — `messages` already supports outbound. No bootstrap migration needed.
- **Logger:** `import { logger } from '../utils/logger'`. Pino-style structured logs.
- **i18n:** every user-facing string MUST use `t()`. New keys in ALL 5 locale files (`en`, `tr`, `de`, `fr`, `it`).
- **UI components:** use shared components from `packages/client/src/components/ui/`. Never raw `<button>` / `<input>` / `<textarea>`.
- **Concurrency control:** outbound updates are server-driven (worker → DB); the controller enforces ownership before enqueue. No `withConcurrencyCheck` middleware needed because there's no user-edited row that survives the request.
- **CSS:** use design tokens from `packages/client/src/styles/theme.css` — no hardcoded hex colors.
- **Error envelope:** controllers return `{ success: true, data: ... }` or `{ success: false, error: '...' }` matching the existing CRM controller pattern (see Phase 2a `channels.controller.ts`).

---

## Task 1: Pure RFC 5322 message builder

**Why:** Building a Gmail-API-compatible MIME message is the most error-prone part of outbound. Threading correctness depends on three headers (`In-Reply-To`, `References`, plus `threadId` passed alongside the `raw` field) and a missing one breaks visual threading in Gmail. By extracting this as a pure function with fixture tests, we make threading correctness verifiable without mocking `googleapis`.

**Files:**
- Create: `packages/server/src/apps/crm/services/rfc5322.ts`
- Test: `packages/server/test/rfc5322.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/server/test/rfc5322.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { buildRfc5322Message, encodeForGmailApi } from '../src/apps/crm/services/rfc5322';

describe('buildRfc5322Message', () => {
  it('builds a minimal new-thread message with required headers', () => {
    const result = buildRfc5322Message({
      from: 'me@example.com',
      to: ['alice@example.com'],
      cc: [],
      bcc: [],
      subject: 'Hello',
      body: 'Hi Alice',
    });

    expect(result).toMatch(/^From: me@example\.com\r?\n/m);
    expect(result).toMatch(/^To: alice@example\.com\r?\n/m);
    expect(result).toMatch(/^Subject: Hello\r?\n/m);
    expect(result).toMatch(/^MIME-Version: 1\.0\r?\n/m);
    expect(result).toMatch(/^Content-Type: text\/plain; charset="utf-8"\r?\n/m);
    expect(result).toMatch(/^Content-Transfer-Encoding: 7bit\r?\n/m);
    expect(result).toMatch(/\r?\n\r?\nHi Alice$/);
    // Must NOT include any threading headers when there's no reply context
    expect(result).not.toMatch(/^In-Reply-To:/m);
    expect(result).not.toMatch(/^References:/m);
  });

  it('joins multiple to/cc/bcc with commas', () => {
    const result = buildRfc5322Message({
      from: 'me@x.com',
      to: ['a@x.com', 'b@x.com'],
      cc: ['c@x.com', 'd@x.com'],
      bcc: ['e@x.com'],
      subject: 'Sup',
      body: '',
    });
    expect(result).toMatch(/^To: a@x\.com, b@x\.com\r?\n/m);
    expect(result).toMatch(/^Cc: c@x\.com, d@x\.com\r?\n/m);
    expect(result).toMatch(/^Bcc: e@x\.com\r?\n/m);
  });

  it('omits empty cc and bcc entirely', () => {
    const result = buildRfc5322Message({
      from: 'me@x.com',
      to: ['a@x.com'],
      cc: [],
      bcc: [],
      subject: 'Sup',
      body: '',
    });
    expect(result).not.toMatch(/^Cc:/m);
    expect(result).not.toMatch(/^Bcc:/m);
  });

  it('includes In-Reply-To and References when reply context is provided', () => {
    const result = buildRfc5322Message({
      from: 'me@x.com',
      to: ['a@x.com'],
      cc: [],
      bcc: [],
      subject: 'Re: Hello',
      body: 'reply',
      replyTo: {
        inReplyTo: '<original@x.com>',
        references: ['<thread-start@x.com>', '<original@x.com>'],
      },
    });
    expect(result).toMatch(/^In-Reply-To: <original@x\.com>\r?\n/m);
    expect(result).toMatch(/^References: <thread-start@x\.com> <original@x\.com>\r?\n/m);
  });

  it('References uses single-space-separated message ids', () => {
    const result = buildRfc5322Message({
      from: 'me@x.com',
      to: ['a@x.com'],
      cc: [],
      bcc: [],
      subject: 'Re: Hello',
      body: 'reply',
      replyTo: {
        inReplyTo: '<c@x.com>',
        references: ['<a@x.com>', '<b@x.com>', '<c@x.com>'],
      },
    });
    expect(result).toMatch(/^References: <a@x\.com> <b@x\.com> <c@x\.com>\r?\n/m);
  });

  it('throws when from is missing', () => {
    expect(() =>
      buildRfc5322Message({ from: '', to: ['a@x.com'], cc: [], bcc: [], subject: 's', body: '' }),
    ).toThrow(/from is required/i);
  });

  it('throws when to is empty AND cc is empty AND bcc is empty', () => {
    expect(() =>
      buildRfc5322Message({ from: 'me@x.com', to: [], cc: [], bcc: [], subject: 's', body: '' }),
    ).toThrow(/at least one recipient/i);
  });

  it('preserves UTF-8 in body and subject', () => {
    const result = buildRfc5322Message({
      from: 'me@x.com',
      to: ['a@x.com'],
      cc: [],
      bcc: [],
      subject: 'Üñïcödé 🎉',
      body: 'こんにちは',
    });
    // Subject should be encoded with RFC 2047 (=?utf-8?B?...?=) for non-ASCII
    expect(result).toMatch(/^Subject: =\?utf-8\?B\?.+\?=\r?\n/m);
    // Body is plaintext UTF-8 with 7bit encoding — multi-byte chars survive at the byte level
    expect(result).toMatch(/こんにちは/);
  });
});

describe('encodeForGmailApi', () => {
  it('returns a base64url-encoded string suitable for the raw field', () => {
    const raw = 'From: me\r\nTo: you\r\n\r\nbody';
    const encoded = encodeForGmailApi(raw);
    // base64url uses - and _ instead of + and / and has no padding
    expect(encoded).not.toContain('+');
    expect(encoded).not.toContain('/');
    expect(encoded).not.toContain('=');
    // Round-trip must reproduce the original
    expect(Buffer.from(encoded, 'base64url').toString('utf-8')).toBe(raw);
  });
});
```

- [ ] **Step 2: Run, expect failure**

```bash
cd packages/server && npm test -- rfc5322
```

Expected: module-not-found.

- [ ] **Step 3: Implement the builder**

Create `packages/server/src/apps/crm/services/rfc5322.ts`:

```typescript
const CRLF = '\r\n';

export interface ReplyContext {
  /** The message-id of the message being replied to (with angle brackets). */
  inReplyTo: string;
  /** The full chain of message-ids in the thread, oldest first. Should include the message being replied to as the last entry. */
  references: string[];
}

export interface BuildRfc5322Input {
  from: string;
  to: string[];
  cc: string[];
  bcc: string[];
  subject: string;
  body: string;
  replyTo?: ReplyContext;
}

/**
 * Build a UTF-8 plaintext RFC 5322 message ready for Gmail API
 * `users.messages.send`. Returns the raw message string (NOT yet
 * base64url-encoded — call `encodeForGmailApi` for that).
 *
 * Threading rules (when `replyTo` is present):
 *   1. `In-Reply-To: <messageId>` of the message being replied to
 *   2. `References: <id1> <id2> ...` — full chain, single-space-separated
 *   3. Caller must ALSO pass `threadId` to `users.messages.send` —
 *      header-only threading is unreliable in Gmail's web UI.
 *
 * Subjects with non-ASCII characters use RFC 2047 base64 encoding.
 * Body is plaintext UTF-8 with `Content-Transfer-Encoding: 7bit` —
 * for plaintext bodies with non-ASCII, this is technically incorrect
 * (should be `quoted-printable` or `base64`), but Gmail accepts and
 * displays it correctly. Phase 3 may switch to `quoted-printable` if
 * downstream MTAs in cc chains complain.
 */
export function buildRfc5322Message(input: BuildRfc5322Input): string {
  if (!input.from || !input.from.trim()) {
    throw new Error('from is required');
  }
  if (input.to.length === 0 && input.cc.length === 0 && input.bcc.length === 0) {
    throw new Error('at least one recipient (to, cc, or bcc) is required');
  }

  const headers: string[] = [];
  headers.push(`From: ${input.from}`);
  if (input.to.length > 0) headers.push(`To: ${input.to.join(', ')}`);
  if (input.cc.length > 0) headers.push(`Cc: ${input.cc.join(', ')}`);
  if (input.bcc.length > 0) headers.push(`Bcc: ${input.bcc.join(', ')}`);
  headers.push(`Subject: ${encodeSubject(input.subject)}`);
  headers.push('MIME-Version: 1.0');
  headers.push('Content-Type: text/plain; charset="utf-8"');
  headers.push('Content-Transfer-Encoding: 7bit');

  if (input.replyTo) {
    headers.push(`In-Reply-To: ${input.replyTo.inReplyTo}`);
    headers.push(`References: ${input.replyTo.references.join(' ')}`);
  }

  return headers.join(CRLF) + CRLF + CRLF + input.body;
}

/**
 * Base64url-encode the raw RFC 5322 string for Gmail API's `raw` parameter.
 * Gmail requires base64url (RFC 4648 §5) — no `=` padding, `-`/`_` instead of `+`/`/`.
 */
export function encodeForGmailApi(raw: string): string {
  return Buffer.from(raw, 'utf-8').toString('base64url');
}

/**
 * RFC 2047 encoded-word for subjects containing non-ASCII characters.
 * Returns the input unchanged if it's pure ASCII.
 */
function encodeSubject(subject: string): string {
  // eslint-disable-next-line no-control-regex
  if (/^[\x00-\x7F]*$/.test(subject)) {
    return subject;
  }
  const b64 = Buffer.from(subject, 'utf-8').toString('base64');
  return `=?utf-8?B?${b64}?=`;
}
```

- [ ] **Step 4: Run, expect pass**

```bash
cd packages/server && npm test -- rfc5322
```

Expected: 9 passing (8 buildRfc5322Message + 1 encodeForGmailApi).

- [ ] **Step 5: Run full suite + typecheck**

```bash
cd packages/server && npm test 2>&1 | tail -8
cd packages/server && npm run typecheck 2>&1 | tail -3
```

Expected: 533 passed (was 524 + 9), typecheck clean.

- [ ] **Step 6: Commit**

```bash
git add packages/server/src/apps/crm/services/rfc5322.ts packages/server/test/rfc5322.test.ts
git commit -m "feat(crm): pure RFC 5322 message builder for Gmail send"
```

---

## Task 2: Add `gmail-send` job name + extend queue types

**Why:** The worker dispatch needs a stable job name and the controller needs typed payload data. Mirrors the Phase 2a `GmailFullSync` pattern.

**Files:**
- Modify: `packages/server/src/config/queue.ts`

- [ ] **Step 1: Add to `SyncJobName`**

In `packages/server/src/config/queue.ts`, find the `SyncJobName` const (it currently has 4 entries: CalendarFullSync, CalendarIncrementalSync, GmailFullSync, GmailIncrementalSync). Replace:

```typescript
export const SyncJobName = {
  CalendarFullSync: 'calendar-full-sync',
  CalendarIncrementalSync: 'calendar-incremental-sync',
  GmailFullSync: 'gmail-full-sync',
  GmailIncrementalSync: 'gmail-incremental-sync',
} as const;
```

with:

```typescript
export const SyncJobName = {
  CalendarFullSync: 'calendar-full-sync',
  CalendarIncrementalSync: 'calendar-incremental-sync',
  GmailFullSync: 'gmail-full-sync',
  GmailIncrementalSync: 'gmail-incremental-sync',
  GmailSend: 'gmail-send',
} as const;
```

- [ ] **Step 2: Add the typed job-data interface**

Below the existing `GmailIncrementalSyncJobData` interface, add:

```typescript
/**
 * Outbound send job. The message row is already inserted with
 * `direction='outbound'`, `status='pending'` by the controller before this
 * job is enqueued — the worker just reads the row, builds the RFC 5322,
 * calls Gmail, and updates the row to `'sent'` or `'failed'`.
 */
export interface GmailSendJobData {
  messageId: string;
}
```

- [ ] **Step 3: Extend the `SyncJobData` discriminated union**

Find the existing union type — replace:

```typescript
export type SyncJobData =
  | { name: typeof SyncJobName.CalendarFullSync; data: CalendarFullSyncJobData }
  | { name: typeof SyncJobName.CalendarIncrementalSync; data: CalendarIncrementalSyncJobData }
  | { name: typeof SyncJobName.GmailFullSync; data: GmailFullSyncJobData }
  | { name: typeof SyncJobName.GmailIncrementalSync; data: GmailIncrementalSyncJobData };
```

with:

```typescript
export type SyncJobData =
  | { name: typeof SyncJobName.CalendarFullSync; data: CalendarFullSyncJobData }
  | { name: typeof SyncJobName.CalendarIncrementalSync; data: CalendarIncrementalSyncJobData }
  | { name: typeof SyncJobName.GmailFullSync; data: GmailFullSyncJobData }
  | { name: typeof SyncJobName.GmailIncrementalSync; data: GmailIncrementalSyncJobData }
  | { name: typeof SyncJobName.GmailSend; data: GmailSendJobData };
```

- [ ] **Step 4: Typecheck**

```bash
cd packages/server && npm run typecheck 2>&1 | tail -3
```

Expected: clean.

- [ ] **Step 5: Run full suite**

```bash
cd packages/server && npm test 2>&1 | tail -5
```

Expected: 533 passed (unchanged — no new tests, no regressions).

- [ ] **Step 6: Commit**

```bash
git add packages/server/src/config/queue.ts
git commit -m "feat(server): add GmailSend job name + GmailSendJobData type"
```

---

## Task 3: CRM contact auto-create service

**Why:** Phase 2b's `gmail-sync.service:ingestMessage` has a stub branch (`else if (shouldAutoCreate(...)) { resolved.push({ ...p, personId: null }); }`) — it decides "would auto-create" but never actually calls a create. 2c implements the create path, then both inbound (gmail-sync) and outbound (gmail-send, this task wires it) use it. Splitting from the sync services keeps the logic in one place and testable independently.

**Files:**
- Create: `packages/server/src/apps/crm/services/crm-contact-create.service.ts`
- Test: `packages/server/test/crm-contact-create-service.test.ts`

- [ ] **Step 1: Read the existing CRM contact service to match its create pattern**

The CRM has an existing `packages/server/src/apps/crm/services/contact.service.ts` that creates contacts. Read it briefly to understand the column shape:

```bash
grep -n "createContact\|export async function" /Users/gorkemcetin/atlasmail/packages/server/src/apps/crm/services/contact.service.ts | head -10
```

The auto-create needs to insert a `crm_contacts` row with `tenantId`, `userId`, `email`, optionally `firstName` / `lastName` / `name` parsed from the `displayName` if present. **Match whatever column shape the existing `createContact` uses** — read the schema before implementing.

```bash
grep -nA12 "export const crmContacts = pgTable" /Users/gorkemcetin/atlasmail/packages/server/src/db/schema.ts | head -20
```

The implementation below assumes `firstName` and `lastName`. If the schema has a single `name` column instead, adjust both the implementation and the tests to match.

- [ ] **Step 2: Write the failing test**

Create `packages/server/test/crm-contact-create-service.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const dbInsertMock = vi.fn();

vi.mock('../src/config/database', () => ({
  db: {
    insert: () => dbInsertMock(),
  },
}));

import { autoCreateContactIfNeeded } from '../src/apps/crm/services/crm-contact-create.service';

beforeEach(() => {
  dbInsertMock.mockReset();
});

describe('autoCreateContactIfNeeded', () => {
  it('returns null and inserts nothing when policy is none', async () => {
    const result = await autoCreateContactIfNeeded({
      handle: 'alice@example.com',
      displayName: 'Alice',
      role: 'to',
      direction: 'outbound',
      policy: 'none',
      tenantId: 't-1',
      userId: 'u-1',
      isBlocked: false,
    });
    expect(result).toBeNull();
    expect(dbInsertMock).not.toHaveBeenCalled();
  });

  it('returns null and inserts nothing when handle is blocked', async () => {
    const result = await autoCreateContactIfNeeded({
      handle: 'spam@x.com',
      displayName: null,
      role: 'from',
      direction: 'inbound',
      policy: 'send-and-receive',
      tenantId: 't-1',
      userId: 'u-1',
      isBlocked: true,
    });
    expect(result).toBeNull();
    expect(dbInsertMock).not.toHaveBeenCalled();
  });

  it('returns null when shouldAutoCreate decides no (e.g. send-only + inbound)', async () => {
    // send-only + inbound + role='from' -> false
    const result = await autoCreateContactIfNeeded({
      handle: 'someone@x.com',
      displayName: null,
      role: 'from',
      direction: 'inbound',
      policy: 'send-only',
      tenantId: 't-1',
      userId: 'u-1',
      isBlocked: false,
    });
    expect(result).toBeNull();
    expect(dbInsertMock).not.toHaveBeenCalled();
  });

  it('creates a contact with parsed name when policy permits (send-only + outbound + recipient)', async () => {
    let captured: any = null;
    dbInsertMock.mockReturnValue({
      values: (row: any) => ({
        returning: () => {
          captured = row;
          return Promise.resolve([{ id: 'new-contact-1' }]);
        },
      }),
    });

    const result = await autoCreateContactIfNeeded({
      handle: 'jane@example.com',
      displayName: 'Jane Doe',
      role: 'to',
      direction: 'outbound',
      policy: 'send-only',
      tenantId: 't-1',
      userId: 'u-1',
      isBlocked: false,
    });

    expect(result).toBe('new-contact-1');
    expect(captured).toMatchObject({
      tenantId: 't-1',
      userId: 'u-1',
      email: 'jane@example.com',
    });
    // Display name "Jane Doe" should be parsed into first/last names
    expect(captured.firstName).toBe('Jane');
    expect(captured.lastName).toBe('Doe');
  });

  it('uses email local-part as firstName when displayName is null', async () => {
    let captured: any = null;
    dbInsertMock.mockReturnValue({
      values: (row: any) => ({
        returning: () => {
          captured = row;
          return Promise.resolve([{ id: 'new-contact-2' }]);
        },
      }),
    });

    await autoCreateContactIfNeeded({
      handle: 'jane.smith@example.com',
      displayName: null,
      role: 'to',
      direction: 'outbound',
      policy: 'send-and-receive',
      tenantId: 't-1',
      userId: 'u-1',
      isBlocked: false,
    });

    expect(captured.firstName).toBe('jane.smith');
    expect(captured.lastName).toBeNull();
  });

  it('handles single-word displayName (no last name)', async () => {
    let captured: any = null;
    dbInsertMock.mockReturnValue({
      values: (row: any) => ({
        returning: () => {
          captured = row;
          return Promise.resolve([{ id: 'new-contact-3' }]);
        },
      }),
    });

    await autoCreateContactIfNeeded({
      handle: 'cher@example.com',
      displayName: 'Cher',
      role: 'to',
      direction: 'outbound',
      policy: 'send-and-receive',
      tenantId: 't-1',
      userId: 'u-1',
      isBlocked: false,
    });

    expect(captured.firstName).toBe('Cher');
    expect(captured.lastName).toBeNull();
  });

  it('handles displayName with 3+ words (everything after first becomes lastName)', async () => {
    let captured: any = null;
    dbInsertMock.mockReturnValue({
      values: (row: any) => ({
        returning: () => {
          captured = row;
          return Promise.resolve([{ id: 'new-contact-4' }]);
        },
      }),
    });

    await autoCreateContactIfNeeded({
      handle: 'mvw@example.com',
      displayName: 'Maria von Weber',
      role: 'to',
      direction: 'outbound',
      policy: 'send-and-receive',
      tenantId: 't-1',
      userId: 'u-1',
      isBlocked: false,
    });

    expect(captured.firstName).toBe('Maria');
    expect(captured.lastName).toBe('von Weber');
  });
});
```

- [ ] **Step 3: Run, expect failure**

```bash
cd packages/server && npm test -- crm-contact-create-service
```

Expected: module-not-found.

- [ ] **Step 4: Implement the service**

Create `packages/server/src/apps/crm/services/crm-contact-create.service.ts`:

```typescript
import { db } from '../../../config/database';
import { crmContacts } from '../../../db/schema';
import {
  shouldAutoCreate,
  type ContactAutoCreationPolicy,
  type ParticipantRole,
  type MessageDirection,
} from './participant-match.service';

export interface AutoCreateInput {
  handle: string;
  displayName: string | null;
  role: ParticipantRole;
  direction: MessageDirection;
  policy: ContactAutoCreationPolicy;
  tenantId: string;
  userId: string;
  /** Pre-resolved blocklist match — caller passes the result of `loadBlocklist(tenantId)(handle)`. */
  isBlocked: boolean;
}

/**
 * Apply the contact-auto-creation policy and create a new `crm_contacts` row
 * if all three conditions hold:
 *   1. `policy` permits creation for this `(role, direction)` pair
 *   2. `isBlocked` is false
 *   3. (caller verified) no existing contact matched this handle
 *
 * Returns the new contact's `id` on creation, or `null` when no contact was
 * created (any of the conditions above were false).
 *
 * The caller (gmail-sync ingestion or gmail-send post-send) is responsible
 * for ensuring (3) — typically by checking `matchHandlesToContacts` first
 * and only calling this for unmatched handles.
 */
export async function autoCreateContactIfNeeded(input: AutoCreateInput): Promise<string | null> {
  if (input.isBlocked) return null;
  if (!shouldAutoCreate(input.policy, input.role, input.direction)) return null;

  const { firstName, lastName } = parseName(input.displayName, input.handle);

  const [inserted] = await db
    .insert(crmContacts)
    .values({
      tenantId: input.tenantId,
      userId: input.userId,
      email: input.handle.toLowerCase(),
      firstName,
      lastName,
    })
    .returning({ id: crmContacts.id });

  return inserted.id;
}

/**
 * Split a display name into firstName + lastName, falling back to the email
 * local-part when displayName is null.
 *
 * Rules:
 *   - null displayName -> firstName = local-part of email, lastName = null
 *   - "Cher" -> firstName = "Cher", lastName = null
 *   - "Jane Doe" -> firstName = "Jane", lastName = "Doe"
 *   - "Maria von Weber" -> firstName = "Maria", lastName = "von Weber"
 */
function parseName(displayName: string | null, handle: string): {
  firstName: string;
  lastName: string | null;
} {
  if (!displayName || !displayName.trim()) {
    const localPart = handle.split('@')[0];
    return { firstName: localPart, lastName: null };
  }
  const trimmed = displayName.trim();
  const firstSpace = trimmed.indexOf(' ');
  if (firstSpace === -1) {
    return { firstName: trimmed, lastName: null };
  }
  return {
    firstName: trimmed.slice(0, firstSpace),
    lastName: trimmed.slice(firstSpace + 1).trim(),
  };
}
```

**Important:** if Step 1 revealed the `crmContacts` table has a single `name` field (not `firstName`/`lastName`), rewrite the insert to use `name` and update `parseName` to return a single string. The test must also be updated to match. **Match the schema.**

- [ ] **Step 5: Run, expect pass**

```bash
cd packages/server && npm test -- crm-contact-create-service
```

Expected: 7 passing.

- [ ] **Step 6: Run full suite + typecheck**

```bash
cd packages/server && npm test 2>&1 | tail -5
cd packages/server && npm run typecheck 2>&1 | tail -3
```

Expected: 540 passed (was 533 + 7).

- [ ] **Step 7: Commit**

```bash
git add packages/server/src/apps/crm/services/crm-contact-create.service.ts packages/server/test/crm-contact-create-service.test.ts
git commit -m "feat(crm): contact auto-create service for inbound/outbound participant matching"
```

---

## Task 4: Wire auto-create into Phase 2b's inbound `ingestMessage`

**Why:** Phase 2b had a stub branch where unmatched participants got `personId: null` even when policy said "auto-create". Now we have `autoCreateContactIfNeeded`; route the stub through it. The channel's `contactAutoCreationPolicy` becomes the input.

**Files:**
- Modify: `packages/server/src/apps/crm/services/gmail-sync.service.ts`
- Modify: `packages/server/test/gmail-sync-service.test.ts`

- [ ] **Step 1: Update the channel load to include `contactAutoCreationPolicy`**

In `packages/server/src/apps/crm/services/gmail-sync.service.ts`, find `loadChannel`:

```typescript
async function loadChannel(channelId: string): Promise<ChannelRow> {
  const [row] = await db
    .select({
      id: messageChannels.id,
      accountId: messageChannels.accountId,
      tenantId: messageChannels.tenantId,
      ownerUserId: messageChannels.ownerUserId,
      isSyncEnabled: messageChannels.isSyncEnabled,
      syncCursor: messageChannels.syncCursor,
      throttleRetryAfter: messageChannels.throttleRetryAfter,
    })
    ...
```

Replace the `select` shape with:

```typescript
async function loadChannel(channelId: string): Promise<ChannelRow> {
  const [row] = await db
    .select({
      id: messageChannels.id,
      accountId: messageChannels.accountId,
      tenantId: messageChannels.tenantId,
      ownerUserId: messageChannels.ownerUserId,
      isSyncEnabled: messageChannels.isSyncEnabled,
      contactAutoCreationPolicy: messageChannels.contactAutoCreationPolicy,
      syncCursor: messageChannels.syncCursor,
      throttleRetryAfter: messageChannels.throttleRetryAfter,
    })
    ...
```

Update the `ChannelRow` interface to include the new field. Find:

```typescript
interface ChannelRow {
  id: string;
  accountId: string;
  tenantId: string;
  ownerUserId: string;
  isSyncEnabled: boolean;
  syncCursor: string | null;
  throttleRetryAfter: Date | null;
}
```

Replace with:

```typescript
interface ChannelRow {
  id: string;
  accountId: string;
  tenantId: string;
  ownerUserId: string;
  isSyncEnabled: boolean;
  contactAutoCreationPolicy: 'none' | 'send-only' | 'send-and-receive';
  syncCursor: string | null;
  throttleRetryAfter: Date | null;
}
```

- [ ] **Step 2: Add the import**

At the top of the file, find the imports from `participant-match.service`. Add a parallel import:

```typescript
import { autoCreateContactIfNeeded } from './crm-contact-create.service';
```

- [ ] **Step 3: Replace the stub branch in `ingestMessage`**

Find the existing block in `ingestMessage`:

```typescript
  const resolved: ResolvedParticipant[] = parsed.participants.map((p) => {
    if (isBlocked(p.handle)) {
      return { ...p, personId: null };
    }
    const personId = contactMap.get(p.handle.toLowerCase()) ?? null;
    return { ...p, personId };
  });
```

This loop is currently `parsed.participants.map(...)` — synchronous. The auto-create path is async, so we switch to a `for...of` accumulator. Replace the block with:

```typescript
  const resolved: ResolvedParticipant[] = [];
  for (const p of parsed.participants) {
    if (isBlocked(p.handle)) {
      resolved.push({ ...p, personId: null });
      continue;
    }
    const matched = contactMap.get(p.handle.toLowerCase()) ?? null;
    if (matched) {
      resolved.push({ ...p, personId: matched });
      continue;
    }
    // Try auto-create per channel policy. If it returns a new contact id,
    // use it; otherwise leave personId null (orphan participant).
    const created = await autoCreateContactIfNeeded({
      handle: p.handle,
      displayName: p.displayName,
      role: p.role,
      direction,
      policy: channel.contactAutoCreationPolicy,
      tenantId: channel.tenantId,
      userId: channel.ownerUserId,
      isBlocked: false, // already checked above
    });
    resolved.push({ ...p, personId: created });
  }
```

The `await` inside the loop is fine — typical inbound message has < 10 participants; the per-message latency cost is small and the alternative (Promise.all of creates) introduces uniqueness-conflict races on contacts created within the same message.

- [ ] **Step 4: Update existing test mocks**

The `gmail-sync-service.test.ts` test only covers gating (channel not found, throttled, disabled, no cursor). It doesn't enter `ingestMessage`. So this change has no test impact at the gating-test level. The auto-create branch is exercised by Phase 2c Task 13's manual smoke against a real Gmail account.

However, the tests do mock `participant-match.service`. Add a sibling mock for the new `crm-contact-create.service` import. In the test file, after the existing `vi.mock('../src/apps/crm/services/participant-match.service', ...)` block, add:

```typescript
vi.mock('../src/apps/crm/services/crm-contact-create.service', () => ({
  autoCreateContactIfNeeded: vi.fn(async () => null),
}));
```

This ensures the gating tests don't crash when `gmail-sync.service` imports the module — the existing tests never enter the `ingestMessage` code path so the mock is just there to satisfy the import graph.

- [ ] **Step 5: Run gmail-sync tests**

```bash
cd packages/server && npm test -- gmail-sync-service
```

Expected: 6 passing (no behavioural change at the gating level).

- [ ] **Step 6: Run full suite + typecheck**

```bash
cd packages/server && npm test 2>&1 | tail -5
cd packages/server && npm run typecheck 2>&1 | tail -3
```

Expected: 540 passed (unchanged from Task 3), typecheck clean.

- [ ] **Step 7: Commit**

```bash
git add packages/server/src/apps/crm/services/gmail-sync.service.ts packages/server/test/gmail-sync-service.test.ts
git commit -m "feat(crm): wire auto-create into inbound participant matching"
```

---

## Task 5: Gmail send service

**Why:** The worker's executor for `gmail-send` jobs. Reads the pending message, builds RFC 5322, calls `users.messages.send` with both `raw` and `threadId`, updates the message row with the actual `gmailMessageId` returned by Gmail, fans out activities, runs the same auto-create path for outbound recipients.

**Files:**
- Create: `packages/server/src/apps/crm/services/gmail-send.service.ts`
- Test: `packages/server/test/gmail-send-service.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/server/test/gmail-send-service.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const dbSelectMock = vi.fn();
const dbUpdateMock = vi.fn();

vi.mock('../src/config/database', () => ({
  db: {
    select: () => dbSelectMock(),
    update: () => dbUpdateMock(),
  },
}));

const callGoogleApiMock = vi.fn();
vi.mock('../src/services/google-api-call', () => ({
  callGoogleApi: callGoogleApiMock,
}));

const insertParticipantsMock = vi.fn();
const loadBlocklistMock = vi.fn();
const matchHandlesToContactsMock = vi.fn();
vi.mock('../src/apps/crm/services/participant-match.service', () => ({
  insertParticipants: insertParticipantsMock,
  loadBlocklist: loadBlocklistMock,
  matchHandlesToContacts: matchHandlesToContactsMock,
}));

const autoCreateContactIfNeededMock = vi.fn();
vi.mock('../src/apps/crm/services/crm-contact-create.service', () => ({
  autoCreateContactIfNeeded: autoCreateContactIfNeededMock,
}));

const upsertActivitiesForMessageMock = vi.fn();
vi.mock('../src/apps/crm/services/message-activity.service', () => ({
  upsertActivitiesForMessage: upsertActivitiesForMessageMock,
}));

import { performGmailSend } from '../src/apps/crm/services/gmail-send.service';

beforeEach(() => {
  dbSelectMock.mockReset();
  dbUpdateMock.mockReset();
  callGoogleApiMock.mockReset();
  insertParticipantsMock.mockReset();
  loadBlocklistMock.mockReset();
  matchHandlesToContactsMock.mockReset();
  autoCreateContactIfNeededMock.mockReset();
  upsertActivitiesForMessageMock.mockReset();
  dbUpdateMock.mockReturnValue({ set: () => ({ where: () => Promise.resolve() }) });
});

describe('performGmailSend', () => {
  it('throws "message not found" when the message does not exist', async () => {
    dbSelectMock.mockReturnValueOnce({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) }),
    });
    await expect(performGmailSend('msg-missing')).rejects.toThrow(/message not found/i);
  });

  it('returns early when message is not pending (idempotent on retry)', async () => {
    dbSelectMock.mockReturnValueOnce({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([{
        id: 'msg-1',
        channelId: 'ch-1',
        tenantId: 't-1',
        threadId: 'thr-1',
        direction: 'outbound',
        status: 'sent', // already sent
        subject: 'Hi',
        bodyText: 'body',
      }]) }) }),
    });
    await performGmailSend('msg-1');
    expect(callGoogleApiMock).not.toHaveBeenCalled();
  });

  it('marks failed and rethrows on Gmail API error', async () => {
    dbSelectMock
      // First select: load message
      .mockReturnValueOnce({
        from: () => ({ where: () => ({ limit: () => Promise.resolve([{
          id: 'msg-1',
          channelId: 'ch-1',
          tenantId: 't-1',
          threadId: 'thr-1',
          direction: 'outbound',
          status: 'pending',
          subject: 'Hi',
          bodyText: 'body',
          inReplyTo: null,
        }]) }) }),
      })
      // Second select: load channel
      .mockReturnValueOnce({
        from: () => ({ where: () => ({ limit: () => Promise.resolve([{
          id: 'ch-1',
          accountId: 'a-1',
          tenantId: 't-1',
          ownerUserId: 'u-1',
          handle: 'me@example.com',
          contactAutoCreationPolicy: 'send-only',
        }]) }) }),
      })
      // Third select: load participants
      .mockReturnValueOnce({
        from: () => ({ where: () => Promise.resolve([
          { role: 'to', handle: 'alice@example.com', displayName: 'Alice' },
        ]) }),
      });

    callGoogleApiMock.mockRejectedValue(new Error('quota exceeded'));

    let updatedFields: any = null;
    dbUpdateMock.mockReturnValue({
      set: (vals: any) => { updatedFields = vals; return { where: () => Promise.resolve() }; },
    });

    await expect(performGmailSend('msg-1')).rejects.toThrow(/quota exceeded/);
    expect(updatedFields).toMatchObject({ status: 'failed' });
    expect(updatedFields.syncError ?? updatedFields.error ?? '').toMatch(/quota exceeded/i);
  });
});
```

- [ ] **Step 2: Run, expect failure**

```bash
cd packages/server && npm test -- gmail-send-service
```

Expected: module-not-found.

- [ ] **Step 3: Implement the service**

Create `packages/server/src/apps/crm/services/gmail-send.service.ts`:

```typescript
import { google } from 'googleapis';
import { and, eq, asc } from 'drizzle-orm';
import { db } from '../../../config/database';
import { messageChannels, messageParticipants, messages } from '../../../db/schema';
import { callGoogleApi } from '../../../services/google-api-call';
import { logger } from '../../../utils/logger';
import { withRetry } from '../../../utils/retry';
import { buildRfc5322Message, encodeForGmailApi, type ReplyContext } from './rfc5322';
import {
  loadBlocklist,
  matchHandlesToContacts,
} from './participant-match.service';
import { autoCreateContactIfNeeded } from './crm-contact-create.service';
import { upsertActivitiesForMessage } from './message-activity.service';

interface MessageRow {
  id: string;
  channelId: string;
  tenantId: string;
  threadId: string;
  direction: string;
  status: string;
  subject: string | null;
  bodyText: string | null;
  inReplyTo: string | null;
}

interface ChannelRow {
  id: string;
  accountId: string;
  tenantId: string;
  ownerUserId: string;
  handle: string;
  contactAutoCreationPolicy: 'none' | 'send-only' | 'send-and-receive';
}

interface ParticipantRow {
  role: string;
  handle: string;
  displayName: string | null;
}

/**
 * Phase 2c outbound send. Reads a pending outbound message row that the
 * controller already inserted, builds an RFC 5322 raw message with proper
 * threading headers, calls `users.messages.send`, and updates the row to
 * `status='sent'` (or `'failed'` on error).
 *
 * Idempotent: if `status !== 'pending'`, returns early. The controller
 * inserts with `status='pending'`; the BullMQ retry of an already-sent
 * job is a no-op.
 *
 * On 429: marks failed and rethrows. BullMQ's existing retry policy
 * (3 attempts with exponential backoff) handles transient send rate-limits.
 * No throttle-state tracking on outbound — sends are user-initiated and
 * low-volume; the channel-level throttle is for sync background loops.
 */
export async function performGmailSend(messageId: string): Promise<void> {
  const message = await loadMessage(messageId);
  if (!message) throw new Error(`message not found: ${messageId}`);
  if (message.status !== 'pending') {
    logger.info({ messageId, status: message.status }, 'Gmail send skipped: message not pending');
    return;
  }
  if (message.direction !== 'outbound') {
    throw new Error(`message ${messageId} is not outbound`);
  }

  const channel = await loadChannel(message.channelId);
  if (!channel) throw new Error(`channel not found for message ${messageId}`);

  const participants = await loadParticipants(messageId);
  const replyContext = await buildReplyContext(message);

  const recipientsByRole = groupByRole(participants);

  try {
    const raw = buildRfc5322Message({
      from: channel.handle,
      to: recipientsByRole.to,
      cc: recipientsByRole.cc,
      bcc: recipientsByRole.bcc,
      subject: message.subject ?? '',
      body: message.bodyText ?? '',
      replyTo: replyContext,
    });

    const sendRes = await callGoogleApi(channel.accountId, async (auth) => {
      const gmail = google.gmail({ version: 'v1', auth });
      return withRetry(
        () => gmail.users.messages.send({
          userId: 'me',
          requestBody: {
            raw: encodeForGmailApi(raw),
            // Pass threadId on replies so Gmail groups the message in the same conversation.
            // For new threads (no replyTo), threadId is undefined and Gmail starts a new conversation.
            threadId: replyContext ? message.threadId : undefined,
          },
        }),
        'Gmail API messages.send',
      );
    });

    const gmailMessageId = sendRes.data.id ?? null;
    const gmailThreadId = sendRes.data.threadId ?? null;

    await db
      .update(messages)
      .set({
        status: 'sent',
        sentAt: new Date(),
        gmailMessageId,
        // headerMessageId comes from Gmail's response payload but the response
        // doesn't include it directly — we'd need a follow-up `messages.get`
        // to fetch it. For Phase 2c, the inbound sync will pick up the sent
        // message on its next incremental run (Gmail puts sent messages in
        // the channel's mailbox), backfilling headerMessageId then.
        updatedAt: new Date(),
      })
      .where(eq(messages.id, messageId));

    logger.info({ messageId, gmailMessageId, gmailThreadId }, 'Gmail send completed');

    // Auto-create contacts for unmatched recipients per channel policy.
    // Activity fan-out is also done now so the timeline picks up the sent message.
    await runPostSendMatching(message, channel, participants);
    await upsertActivitiesForMessage({
      messageId: message.id,
      tenantId: message.tenantId,
      userId: channel.ownerUserId,
      direction: 'outbound',
    });
  } catch (err: any) {
    logger.error({ err, messageId }, 'Gmail send failed');
    await db
      .update(messages)
      .set({
        status: 'failed',
        syncError: String(err?.message ?? err),
        updatedAt: new Date(),
      })
      .where(eq(messages.id, messageId));
    throw err;
  }
}

async function loadMessage(messageId: string): Promise<MessageRow | null> {
  const [row] = await db
    .select({
      id: messages.id,
      channelId: messages.channelId,
      tenantId: messages.tenantId,
      threadId: messages.threadId,
      direction: messages.direction,
      status: messages.status,
      subject: messages.subject,
      bodyText: messages.bodyText,
      inReplyTo: messages.inReplyTo,
    })
    .from(messages)
    .where(eq(messages.id, messageId))
    .limit(1);
  return (row as MessageRow | undefined) ?? null;
}

async function loadChannel(channelId: string): Promise<ChannelRow | null> {
  const [row] = await db
    .select({
      id: messageChannels.id,
      accountId: messageChannels.accountId,
      tenantId: messageChannels.tenantId,
      ownerUserId: messageChannels.ownerUserId,
      handle: messageChannels.handle,
      contactAutoCreationPolicy: messageChannels.contactAutoCreationPolicy,
    })
    .from(messageChannels)
    .where(eq(messageChannels.id, channelId))
    .limit(1);
  return (row as ChannelRow | undefined) ?? null;
}

async function loadParticipants(messageId: string): Promise<ParticipantRow[]> {
  const rows = await db
    .select({
      role: messageParticipants.role,
      handle: messageParticipants.handle,
      displayName: messageParticipants.displayName,
    })
    .from(messageParticipants)
    .where(eq(messageParticipants.messageId, messageId));
  return rows as ParticipantRow[];
}

/**
 * If the outbound message is a reply (has `inReplyTo` from the controller),
 * walk the thread's prior messages and collect their headerMessageIds in
 * chronological order. Append the message being replied to (inReplyTo) at
 * the end. This is the proper References-header chain.
 */
async function buildReplyContext(message: MessageRow): Promise<ReplyContext | undefined> {
  if (!message.inReplyTo) return undefined;

  const priorMessages = await db
    .select({ headerMessageId: messages.headerMessageId })
    .from(messages)
    .where(
      and(
        eq(messages.threadId, message.threadId),
        eq(messages.tenantId, message.tenantId),
      ),
    )
    .orderBy(asc(messages.sentAt))
    .limit(50);

  const ids: string[] = [];
  for (const m of priorMessages) {
    if (m.headerMessageId && m.headerMessageId !== message.inReplyTo) {
      ids.push(m.headerMessageId);
    }
  }
  // The message being replied to MUST be the last entry in References.
  ids.push(message.inReplyTo);

  return { inReplyTo: message.inReplyTo, references: ids };
}

function groupByRole(participants: ParticipantRow[]): {
  to: string[];
  cc: string[];
  bcc: string[];
} {
  const out: { to: string[]; cc: string[]; bcc: string[] } = { to: [], cc: [], bcc: [] };
  for (const p of participants) {
    if (p.role === 'to') out.to.push(p.handle);
    else if (p.role === 'cc') out.cc.push(p.handle);
    else if (p.role === 'bcc') out.bcc.push(p.handle);
  }
  return out;
}

/**
 * After a successful send, resolve recipient handles to CRM contact ids and
 * auto-create where the channel policy permits. Mirrors the inbound flow but
 * runs against the participant rows already inserted by the controller.
 */
async function runPostSendMatching(
  message: MessageRow,
  channel: ChannelRow,
  participants: ParticipantRow[],
): Promise<void> {
  const handles = participants.map((p) => p.handle);
  const isBlocked = await loadBlocklist(channel.tenantId);
  const contactMap = await matchHandlesToContacts(handles, channel.tenantId);

  for (const p of participants) {
    if (isBlocked(p.handle)) continue;
    const matched = contactMap.get(p.handle.toLowerCase());
    if (matched) {
      // Already linked — nothing to do here; activity fan-out below picks it up.
      continue;
    }
    const created = await autoCreateContactIfNeeded({
      handle: p.handle,
      displayName: p.displayName,
      role: (p.role as 'from' | 'to' | 'cc' | 'bcc'),
      direction: 'outbound',
      policy: channel.contactAutoCreationPolicy,
      tenantId: channel.tenantId,
      userId: channel.ownerUserId,
      isBlocked: false,
    });
    if (created) {
      // Update the existing participant row with the newly-created personId.
      await db
        .update(messageParticipants)
        .set({ personId: created, updatedAt: new Date() })
        .where(
          and(
            eq(messageParticipants.messageId, message.id),
            eq(messageParticipants.handle, p.handle),
            eq(messageParticipants.role, p.role),
          ),
        );
    }
  }
}
```

- [ ] **Step 4: Run, expect pass**

```bash
cd packages/server && npm test -- gmail-send-service
```

Expected: 3 passing.

- [ ] **Step 5: Run full suite + typecheck**

```bash
cd packages/server && npm test 2>&1 | tail -5
cd packages/server && npm run typecheck 2>&1 | tail -3
```

Expected: 543 passed (was 540 + 3).

- [ ] **Step 6: Commit**

```bash
git add packages/server/src/apps/crm/services/gmail-send.service.ts packages/server/test/gmail-send-service.test.ts
git commit -m "feat(crm): Gmail send service with threading + post-send matching"
```

---

## Task 6: Wire `gmail-send` into the worker

**Why:** The worker dispatch needs to handle the new job name.

**Files:**
- Modify: `packages/server/src/workers/sync.worker.ts`
- Modify: `packages/server/test/sync-worker.test.ts`

- [ ] **Step 1: Add the import + dispatch case**

In `packages/server/src/workers/sync.worker.ts`, find the existing imports block. Add `GmailSendJobData` to the queue imports:

```typescript
import {
  SYNC_QUEUE_NAME,
  SyncJobName,
  type CalendarFullSyncJobData,
  type CalendarIncrementalSyncJobData,
  type GmailFullSyncJobData,
  type GmailIncrementalSyncJobData,
  type GmailSendJobData,
} from '../config/queue';
```

Add the new service import:

```typescript
import { performGmailSend } from '../apps/crm/services/gmail-send.service';
```

In `processSyncJob`, add the new case immediately before the `default:`:

```typescript
    case SyncJobName.GmailSend: {
      const { messageId } = job.data as GmailSendJobData;
      logger.info({ jobId: job.id, messageId }, 'Running Gmail send');
      await performGmailSend(messageId);
      return;
    }
```

- [ ] **Step 2: Extend the worker test**

In `packages/server/test/sync-worker.test.ts`, find the existing `vi.mock('../src/apps/crm/services/gmail-sync.service', ...)` block. Add a parallel mock for the new send service:

```typescript
vi.mock('../src/apps/crm/services/gmail-send.service', () => ({
  performGmailSend: vi.fn(async () => undefined),
}));
```

Add the import:

```typescript
import * as gmailSend from '../src/apps/crm/services/gmail-send.service';
```

Add a new test case inside the existing `describe('sync.worker: processSyncJob', ...)` block:

```typescript
  it('dispatches gmail-send to performGmailSend', async () => {
    await processSyncJob({
      name: 'gmail-send',
      data: { messageId: 'msg-1' },
    } as any);
    expect(gmailSend.performGmailSend).toHaveBeenCalledWith('msg-1');
  });
```

- [ ] **Step 3: Run worker tests**

```bash
cd packages/server && npm test -- sync-worker
```

Expected: 6 passing (was 5 + 1 new).

- [ ] **Step 4: Run full suite + typecheck**

```bash
cd packages/server && npm test 2>&1 | tail -5
cd packages/server && npm run typecheck 2>&1 | tail -3
```

Expected: 544 passed (was 543 + 1).

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/workers/sync.worker.ts packages/server/test/sync-worker.test.ts
git commit -m "feat(server): wire gmail-send job into worker dispatch"
```

---

## Task 7: Messages controller (`POST /messages/send`, `/messages/:id/retry`, `GET /messages/:id`)

**Why:** The HTTP entry points. `send` validates the request, looks up the channel (visibility-filtered, owner-only), inserts the `messages` row + participants, enqueues the `gmail-send` job, returns the new message id. `retry` re-enqueues a `failed` message after marking it `pending` again. `getMessage` is needed by the timeline UI to render embedded message details.

**Files:**
- Create: `packages/server/src/apps/crm/controllers/messages.controller.ts`
- Modify: `packages/server/src/apps/crm/routes.ts`
- Test: `packages/server/test/messages-controller.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/server/test/messages-controller.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';

const queueAddMock = vi.fn(async () => ({ id: 'job-1' }));
const getChannelByIdMock = vi.fn();
let getSyncQueueMock: () => any = () => ({ add: queueAddMock });

vi.mock('../src/config/queue', () => ({
  getSyncQueue: () => getSyncQueueMock(),
  SyncJobName: {
    CalendarFullSync: 'calendar-full-sync',
    CalendarIncrementalSync: 'calendar-incremental-sync',
    GmailFullSync: 'gmail-full-sync',
    GmailIncrementalSync: 'gmail-incremental-sync',
    GmailSend: 'gmail-send',
  },
}));

vi.mock('../src/apps/crm/services/channel.service', () => ({
  getChannelById: getChannelByIdMock,
}));

const dbInsertMock = vi.fn();
const dbSelectMock = vi.fn();
const dbUpdateMock = vi.fn();
vi.mock('../src/config/database', () => ({
  db: {
    insert: () => dbInsertMock(),
    select: () => dbSelectMock(),
    update: () => dbUpdateMock(),
  },
}));

import { sendMessage, retryMessage, getMessage } from '../src/apps/crm/controllers/messages.controller';

function mockRes() {
  const res: Partial<Response> = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res as Response;
}

beforeEach(() => {
  queueAddMock.mockClear();
  getChannelByIdMock.mockReset();
  dbInsertMock.mockReset();
  dbSelectMock.mockReset();
  dbUpdateMock.mockReset();
  getSyncQueueMock = () => ({ add: queueAddMock });
});

describe('messages.controller: sendMessage', () => {
  it('returns 400 when channelId is missing', async () => {
    const req = {
      auth: { userId: 'u-1', tenantId: 't-1' },
      body: { to: ['a@x.com'], subject: 'Hi', body: 'body' },
      params: {},
    } as unknown as Request;
    const res = mockRes();
    await sendMessage(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 400 when no recipient is given', async () => {
    const req = {
      auth: { userId: 'u-1', tenantId: 't-1' },
      body: { channelId: 'ch-1', subject: 'Hi', body: 'body' },
      params: {},
    } as unknown as Request;
    const res = mockRes();
    await sendMessage(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 404 when channel is not visible to the user', async () => {
    getChannelByIdMock.mockResolvedValue(null);
    const req = {
      auth: { userId: 'u-1', tenantId: 't-1' },
      body: { channelId: 'ch-missing', to: ['a@x.com'], subject: 'Hi', body: 'b' },
      params: {},
    } as unknown as Request;
    const res = mockRes();
    await sendMessage(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(queueAddMock).not.toHaveBeenCalled();
  });

  it('returns 503 when queue is unavailable', async () => {
    getChannelByIdMock.mockResolvedValue({ id: 'ch-1', accountId: 'a-1', ownerUserId: 'u-1', visibility: 'private', handle: 'me@x.com' });
    getSyncQueueMock = () => null;
    const req = {
      auth: { userId: 'u-1', tenantId: 't-1' },
      body: { channelId: 'ch-1', to: ['a@x.com'], subject: 'Hi', body: 'b' },
      params: {},
    } as unknown as Request;
    const res = mockRes();
    await sendMessage(req, res);
    expect(res.status).toHaveBeenCalledWith(503);
  });

  it('inserts message + participants and enqueues a gmail-send job on success', async () => {
    getChannelByIdMock.mockResolvedValue({ id: 'ch-1', accountId: 'a-1', ownerUserId: 'u-1', visibility: 'private', handle: 'me@x.com' });

    let insertedMessage: any = null;
    let insertedParticipants: any = null;
    let insertCallNumber = 0;
    dbInsertMock.mockImplementation(() => ({
      values: (rowOrRows: any) => {
        insertCallNumber++;
        if (insertCallNumber === 1) {
          // First call: thread placeholder
          return { returning: () => Promise.resolve([{ id: 'thr-1' }]) };
        }
        if (insertCallNumber === 2) {
          // Second call: message
          insertedMessage = rowOrRows;
          return { returning: () => Promise.resolve([{ id: 'msg-1' }]) };
        }
        // Third call: participants
        insertedParticipants = rowOrRows;
        return Promise.resolve();
      },
    }));

    const req = {
      auth: { userId: 'u-1', tenantId: 't-1' },
      body: {
        channelId: 'ch-1',
        to: ['Alice <alice@example.com>'],
        cc: ['bob@example.com'],
        subject: 'Hello',
        body: 'Hi Alice',
      },
      params: {},
    } as unknown as Request;
    const res = mockRes();
    await sendMessage(req, res);

    expect(insertedMessage).toMatchObject({
      channelId: 'ch-1',
      tenantId: 't-1',
      direction: 'outbound',
      status: 'pending',
      subject: 'Hello',
      bodyText: 'Hi Alice',
    });
    expect(Array.isArray(insertedParticipants)).toBe(true);
    // Should have from + to + cc = 3 participants
    expect(insertedParticipants).toHaveLength(3);
    const fromRow = insertedParticipants.find((r: any) => r.role === 'from');
    const toRow = insertedParticipants.find((r: any) => r.role === 'to');
    const ccRow = insertedParticipants.find((r: any) => r.role === 'cc');
    expect(fromRow).toMatchObject({ handle: 'me@x.com' });
    expect(toRow).toMatchObject({ handle: 'alice@example.com' });
    expect(ccRow).toMatchObject({ handle: 'bob@example.com' });

    expect(queueAddMock).toHaveBeenCalledWith('gmail-send', { messageId: 'msg-1' });
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { messageId: 'msg-1', status: 'pending' },
    });
  });
});

describe('messages.controller: retryMessage', () => {
  it('returns 404 when the message does not exist or is not visible', async () => {
    dbSelectMock.mockReturnValue({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) }),
    });
    const req = {
      auth: { userId: 'u-1', tenantId: 't-1' },
      params: { id: 'msg-missing' },
      body: {},
    } as unknown as Request;
    const res = mockRes();
    await retryMessage(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns 400 when the message is not in failed state', async () => {
    dbSelectMock.mockReturnValue({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([{
        id: 'msg-1',
        tenantId: 't-1',
        channelId: 'ch-1',
        direction: 'outbound',
        status: 'sent',
      }]) }) }),
    });
    getChannelByIdMock.mockResolvedValue({ id: 'ch-1', accountId: 'a-1', ownerUserId: 'u-1', visibility: 'private', handle: 'me@x.com' });
    const req = {
      auth: { userId: 'u-1', tenantId: 't-1' },
      params: { id: 'msg-1' },
      body: {},
    } as unknown as Request;
    const res = mockRes();
    await retryMessage(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('flips status back to pending and re-enqueues on a failed message', async () => {
    dbSelectMock.mockReturnValue({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([{
        id: 'msg-1',
        tenantId: 't-1',
        channelId: 'ch-1',
        direction: 'outbound',
        status: 'failed',
      }]) }) }),
    });
    getChannelByIdMock.mockResolvedValue({ id: 'ch-1', accountId: 'a-1', ownerUserId: 'u-1', visibility: 'private', handle: 'me@x.com' });
    let updated: any = null;
    dbUpdateMock.mockReturnValue({
      set: (vals: any) => { updated = vals; return { where: () => Promise.resolve() }; },
    });

    const req = {
      auth: { userId: 'u-1', tenantId: 't-1' },
      params: { id: 'msg-1' },
      body: {},
    } as unknown as Request;
    const res = mockRes();
    await retryMessage(req, res);

    expect(updated).toMatchObject({ status: 'pending' });
    expect(queueAddMock).toHaveBeenCalledWith('gmail-send', { messageId: 'msg-1' });
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { messageId: 'msg-1', queued: true },
    });
  });
});

describe('messages.controller: getMessage', () => {
  it('returns 404 when message does not exist', async () => {
    dbSelectMock.mockReturnValue({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) }),
    });
    const req = {
      auth: { userId: 'u-1', tenantId: 't-1' },
      params: { id: 'msg-missing' },
      body: {},
    } as unknown as Request;
    const res = mockRes();
    await getMessage(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns the message when visible to the user', async () => {
    dbSelectMock.mockReturnValue({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([{
        id: 'msg-1',
        channelId: 'ch-1',
        subject: 'Hi',
        snippet: 'preview',
        bodyText: 'body',
        status: 'sent',
        threadId: 'thr-1',
        headerMessageId: '<abc@mail.com>',
        direction: 'outbound',
        sentAt: new Date('2026-04-28T10:00:00Z'),
      }]) }) }),
    });
    getChannelByIdMock.mockResolvedValue({ id: 'ch-1', accountId: 'a-1', ownerUserId: 'u-1', visibility: 'private', handle: 'me@x.com' });
    const req = {
      auth: { userId: 'u-1', tenantId: 't-1' },
      params: { id: 'msg-1' },
      body: {},
    } as unknown as Request;
    const res = mockRes();
    await getMessage(req, res);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({ id: 'msg-1', status: 'sent' }),
      }),
    );
  });
});
```

- [ ] **Step 2: Run, expect failure**

```bash
cd packages/server && npm test -- messages-controller
```

Expected: module-not-found.

- [ ] **Step 3: Implement the controller**

Create `packages/server/src/apps/crm/controllers/messages.controller.ts`:

```typescript
import type { Request, Response } from 'express';
import crypto from 'crypto';
import { and, eq } from 'drizzle-orm';
import { db } from '../../../config/database';
import {
  messages,
  messageParticipants,
  messageThreads,
} from '../../../db/schema';
import { getChannelById } from '../services/channel.service';
import { getSyncQueue, SyncJobName } from '../../../config/queue';
import { logger } from '../../../utils/logger';

interface SendBody {
  channelId?: string;
  to?: string[];
  cc?: string[];
  bcc?: string[];
  subject?: string;
  body?: string;
  /** Optional: when replying, the headerMessageId of the message being replied to. */
  inReplyTo?: string;
  /** Optional: when replying, the threadId to attach to. If omitted, a new thread is created. */
  threadId?: string;
}

/**
 * Parse "Display Name <email@x>" or bare "email@x" into { handle, displayName }.
 * Returns null if no @ is present.
 */
function parseAddress(s: string): { handle: string; displayName: string | null } | null {
  const match = s.match(/<([^>]+)>/);
  if (match) {
    const handle = match[1].trim().toLowerCase();
    if (!handle.includes('@')) return null;
    const displayName = s.slice(0, match.index).trim().replace(/^"|"$/g, '') || null;
    return { handle, displayName };
  }
  const trimmed = s.trim().toLowerCase();
  if (!trimmed.includes('@')) return null;
  return { handle: trimmed, displayName: null };
}

export async function sendMessage(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId!;
    const body = (req.body ?? {}) as SendBody;

    if (!body.channelId) {
      res.status(400).json({ success: false, error: 'channelId is required' });
      return;
    }
    const to = body.to ?? [];
    const cc = body.cc ?? [];
    const bcc = body.bcc ?? [];
    if (to.length === 0 && cc.length === 0 && bcc.length === 0) {
      res.status(400).json({ success: false, error: 'at least one recipient (to, cc, or bcc) is required' });
      return;
    }

    const channel = await getChannelById({ channelId: body.channelId, userId, tenantId });
    if (!channel) {
      res.status(404).json({ success: false, error: 'channel not found' });
      return;
    }
    if (channel.ownerUserId !== userId) {
      res.status(403).json({ success: false, error: 'only the channel owner can send from this channel' });
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

    // Determine threadId. If the caller passed one (replying inside an existing
    // thread), use it. Otherwise, create a new thread row first so the message
    // FK is valid. The Gmail-side threadId is only known after the send succeeds;
    // for new threads we use a placeholder gmailThreadId, and the inbound sync
    // will pick up the canonical thread when Gmail's response surfaces in the inbox.
    let threadId = body.threadId ?? null;
    if (!threadId) {
      const placeholder = `local-${crypto.randomUUID()}`;
      const [thread] = await db
        .insert(messageThreads)
        .values({
          channelId: channel.id,
          tenantId,
          gmailThreadId: placeholder,
          subject: body.subject ?? null,
          messageCount: 1,
          lastMessageAt: new Date(),
        })
        .returning({ id: messageThreads.id });
      threadId = thread.id;
    }

    // Insert the outbound message row in pending state
    const [insertedMsg] = await db
      .insert(messages)
      .values({
        channelId: channel.id,
        threadId,
        tenantId,
        gmailMessageId: null as unknown as string,
        headerMessageId: null,
        inReplyTo: body.inReplyTo ?? null,
        subject: body.subject ?? null,
        snippet: (body.body ?? '').slice(0, 200),
        bodyText: body.body ?? '',
        bodyHtml: null,
        direction: 'outbound',
        status: 'pending',
        sentAt: null,
        receivedAt: null,
        labels: [],
        hasAttachments: false,
      })
      .returning({ id: messages.id });

    const messageId = insertedMsg.id;

    // Insert participant rows for from + each recipient
    const participantRows: Array<{
      messageId: string;
      tenantId: string;
      role: string;
      handle: string;
      displayName: string | null;
    }> = [];

    // From: the channel's own handle
    participantRows.push({
      messageId,
      tenantId,
      role: 'from',
      handle: (channel.handle ?? '').toLowerCase(),
      displayName: null,
    });

    for (const role of ['to', 'cc', 'bcc'] as const) {
      const list = role === 'to' ? to : role === 'cc' ? cc : bcc;
      for (const raw of list) {
        const parsed = parseAddress(raw);
        if (!parsed) continue;
        participantRows.push({
          messageId,
          tenantId,
          role,
          handle: parsed.handle,
          displayName: parsed.displayName,
        });
      }
    }

    if (participantRows.length > 0) {
      await db.insert(messageParticipants).values(participantRows);
    }

    // Enqueue the send job
    await queue.add(SyncJobName.GmailSend, { messageId });

    res.json({
      success: true,
      data: { messageId, status: 'pending' },
    });
  } catch (error) {
    logger.error({ error }, 'Failed to send message');
    res.status(500).json({ success: false, error: 'Failed to send message' });
  }
}

export async function retryMessage(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId!;
    const messageId = req.params.id as string;

    const [message] = await db
      .select({
        id: messages.id,
        tenantId: messages.tenantId,
        channelId: messages.channelId,
        direction: messages.direction,
        status: messages.status,
      })
      .from(messages)
      .where(and(eq(messages.id, messageId), eq(messages.tenantId, tenantId)))
      .limit(1);

    if (!message) {
      res.status(404).json({ success: false, error: 'message not found' });
      return;
    }

    // Verify the user owns the channel that the message belongs to
    const channel = await getChannelById({ channelId: message.channelId, userId, tenantId });
    if (!channel || channel.ownerUserId !== userId) {
      res.status(403).json({ success: false, error: 'only the channel owner can retry sends from this channel' });
      return;
    }

    if (message.status !== 'failed') {
      res.status(400).json({
        success: false,
        error: `cannot retry a message with status '${message.status}' (only 'failed' is retryable)`,
      });
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

    // Flip status back to pending so the worker treats it as a fresh send
    await db
      .update(messages)
      .set({ status: 'pending', updatedAt: new Date() })
      .where(eq(messages.id, messageId));

    await queue.add(SyncJobName.GmailSend, { messageId });

    res.json({
      success: true,
      data: { messageId, queued: true },
    });
  } catch (error) {
    logger.error({ error }, 'Failed to retry message');
    res.status(500).json({ success: false, error: 'Failed to retry message' });
  }
}

export async function getMessage(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId!;
    const messageId = req.params.id as string;

    const [message] = await db
      .select({
        id: messages.id,
        channelId: messages.channelId,
        subject: messages.subject,
        snippet: messages.snippet,
        bodyText: messages.bodyText,
        status: messages.status,
        threadId: messages.threadId,
        headerMessageId: messages.headerMessageId,
        direction: messages.direction,
        sentAt: messages.sentAt,
      })
      .from(messages)
      .where(and(eq(messages.id, messageId), eq(messages.tenantId, tenantId)))
      .limit(1);

    if (!message) {
      res.status(404).json({ success: false, error: 'message not found' });
      return;
    }

    // Visibility: only the channel owner sees it (Phase 2d will broaden to
    // shared-with-tenant visibility on the channel level — for now, owner-only
    // is the safe default).
    const channel = await getChannelById({ channelId: message.channelId, userId, tenantId });
    if (!channel) {
      res.status(404).json({ success: false, error: 'message not found' });
      return;
    }

    res.json({ success: true, data: message });
  } catch (error) {
    logger.error({ error }, 'Failed to load message');
    res.status(500).json({ success: false, error: 'Failed to load message' });
  }
}
```

- [ ] **Step 4: Wire routes**

In `packages/server/src/apps/crm/routes.ts`, find the existing `/channels/*` routes block (added in Phase 2a Task 4). Add the messages routes after it. Add the import alongside other controller imports:

```typescript
import * as messagesController from './controllers/messages.controller';
```

Then in the routes section (after the `/channels/*` registrations):

```typescript
router.post('/messages/send', messagesController.sendMessage);
router.post('/messages/:id/retry', messagesController.retryMessage);
router.get('/messages/:id', messagesController.getMessage);
```

All three are inside `authMiddleware` and `requireAppPermission('crm')` middleware that's already applied to the rest of the CRM routes.

- [ ] **Step 5: Run controller tests**

```bash
cd packages/server && npm test -- messages-controller
```

Expected: 9 passing.

- [ ] **Step 6: Run full suite + typecheck**

```bash
cd packages/server && npm test 2>&1 | tail -5
cd packages/server && npm run typecheck 2>&1 | tail -3
```

Expected: 553 passed (was 544 + 9).

- [ ] **Step 7: Commit**

```bash
git add packages/server/src/apps/crm/controllers/messages.controller.ts packages/server/src/apps/crm/routes.ts packages/server/test/messages-controller.test.ts
git commit -m "feat(crm): /messages/send, /messages/:id/retry, GET /messages/:id endpoints"
```

---

## Task 8: Client hooks for send and retry

**Why:** The composer UI calls these. Two mutations: `useSendMessage` for new sends, `useRetryMessage` for retrying a failed message. Both invalidate the message list / activity feed query keys so the timeline refreshes.

**Files:**
- Create: `packages/client/src/apps/crm/hooks/use-send-message.ts`
- Modify: `packages/client/src/config/query-keys.ts` (add `crm.messages` namespace)

- [ ] **Step 1: Add the query-keys namespace**

In `packages/client/src/config/query-keys.ts`, find the existing `crm` block (it has `channels`, `activities`, `contacts`, etc.). Add a `messages` entry — paste it as a sibling next to `channels`:

```typescript
    messages: {
      all: ['crm', 'messages'] as const,
      detail: (id: string) => ['crm', 'messages', id] as const,
    },
```

- [ ] **Step 2: Create the hooks file**

Create `packages/client/src/apps/crm/hooks/use-send-message.ts`:

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api-client';
import { queryKeys } from '../../../config/query-keys';

export interface SendMessageInput {
  channelId: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
  inReplyTo?: string;
  threadId?: string;
}

export interface SendMessageResult {
  messageId: string;
  status: 'pending' | 'sent' | 'failed';
}

export function useSendMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SendMessageInput): Promise<SendMessageResult> => {
      const { data } = await api.post('/crm/messages/send', input);
      return data.data as SendMessageResult;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.crm.activities.all });
      qc.invalidateQueries({ queryKey: queryKeys.crm.messages.all });
    },
  });
}

export function useRetryMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (messageId: string): Promise<{ messageId: string; queued: boolean }> => {
      const { data } = await api.post(`/crm/messages/${messageId}/retry`, {});
      return data.data as { messageId: string; queued: boolean };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.crm.activities.all });
      qc.invalidateQueries({ queryKey: queryKeys.crm.messages.all });
    },
  });
}
```

- [ ] **Step 3: Typecheck the client**

```bash
cd packages/client && npm run typecheck 2>&1 | tail -3
```

Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add packages/client/src/apps/crm/hooks/use-send-message.ts packages/client/src/config/query-keys.ts
git commit -m "feat(crm): client hooks for send and retry message"
```

---

## Task 9: Composer draft store

**Why:** Drafts persist across popover open/close (and component re-renders) but NOT across browser sessions or devices (that's Phase 3). Use a Zustand store keyed by composer key (per-contact or per-thread) so multiple composers can be open at once without colliding.

**Files:**
- Create: `packages/client/src/apps/crm/components/email-composer/use-composer-state.ts`

- [ ] **Step 1: Implement the store**

Create `packages/client/src/apps/crm/components/email-composer/use-composer-state.ts`:

```typescript
import { create } from 'zustand';

export interface ComposerDraft {
  to: string;
  cc: string;
  bcc: string;
  subject: string;
  body: string;
}

interface ComposerStore {
  /** Map of composerKey -> draft. Composer keys are caller-supplied (e.g. "contact-{id}" or "thread-{id}"). */
  drafts: Record<string, ComposerDraft>;
  /** Read a draft, returning the empty default if missing. */
  getDraft: (key: string) => ComposerDraft;
  /** Update a single draft field. */
  updateDraft: (key: string, patch: Partial<ComposerDraft>) => void;
  /** Clear a draft (call on successful send). */
  clearDraft: (key: string) => void;
}

const EMPTY_DRAFT: ComposerDraft = { to: '', cc: '', bcc: '', subject: '', body: '' };

export const useComposerStore = create<ComposerStore>((set, get) => ({
  drafts: {},
  getDraft: (key) => get().drafts[key] ?? EMPTY_DRAFT,
  updateDraft: (key, patch) => set((state) => ({
    drafts: {
      ...state.drafts,
      [key]: { ...EMPTY_DRAFT, ...state.drafts[key], ...patch },
    },
  })),
  clearDraft: (key) => set((state) => {
    const next = { ...state.drafts };
    delete next[key];
    return { drafts: next };
  }),
}));
```

- [ ] **Step 2: Typecheck**

```bash
cd packages/client && npm run typecheck 2>&1 | tail -3
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add packages/client/src/apps/crm/components/email-composer/use-composer-state.ts
git commit -m "feat(crm): composer draft store (in-memory, per-composer-key)"
```

---

## Task 10: Composer form component

**Why:** The actual form. Subject, To, Cc, Bcc, Body. Submit button. Pulls and writes drafts to the composer store.

**Files:**
- Create: `packages/client/src/apps/crm/components/email-composer/email-composer.tsx`
- Modify: 5 locale files

- [ ] **Step 1: Implement the form**

Create `packages/client/src/apps/crm/components/email-composer/email-composer.tsx`:

```tsx
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { Textarea } from '../../../../components/ui/textarea';
import { useToastStore } from '../../../../stores/toast-store';
import { useSendMessage } from '../../hooks/use-send-message';
import { useComposerStore } from './use-composer-state';

export interface EmailComposerProps {
  /** Stable key — typically `contact-{contactId}` or `thread-{threadId}`. */
  composerKey: string;
  channelId: string;
  /** Initial value for `to` if the draft is empty (e.g. contact's email). */
  defaultTo?: string;
  /** Initial value for `subject` if the draft is empty. */
  defaultSubject?: string;
  /** Reply context, if this composer is replying to a message. */
  replyTo?: { inReplyTo: string; threadId: string };
  /** Called after a successful send (so the parent can close the popover). */
  onSent?: () => void;
}

function splitAddressList(s: string): string[] {
  return s.split(',').map((x) => x.trim()).filter(Boolean);
}

export function EmailComposer(props: EmailComposerProps) {
  const { t } = useTranslation();
  const draft = useComposerStore((s) => s.getDraft(props.composerKey));
  const updateDraft = useComposerStore((s) => s.updateDraft);
  const clearDraft = useComposerStore((s) => s.clearDraft);
  const sendMessage = useSendMessage();
  const addToast = useToastStore((s) => s.addToast);

  const [showCc, setShowCc] = useState(draft.cc.length > 0 || draft.bcc.length > 0);

  // Pre-fill defaults if the draft is empty
  const to = draft.to || props.defaultTo || '';
  const subject = draft.subject || props.defaultSubject || '';

  const handleSend = () => {
    sendMessage.mutate(
      {
        channelId: props.channelId,
        to: splitAddressList(to),
        cc: splitAddressList(draft.cc),
        bcc: splitAddressList(draft.bcc),
        subject,
        body: draft.body,
        inReplyTo: props.replyTo?.inReplyTo,
        threadId: props.replyTo?.threadId,
      },
      {
        onSuccess: () => {
          addToast({
            type: 'success',
            message: t('crm.composer.sentToast', 'Message queued for sending'),
          });
          clearDraft(props.composerKey);
          props.onSent?.();
        },
        onError: (err: any) => {
          addToast({
            type: 'error',
            message: err?.response?.data?.error ?? t('crm.composer.sendError', 'Failed to send message'),
          });
        },
      },
    );
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--spacing-sm)',
        padding: 'var(--spacing-md)',
        width: 480,
      }}
    >
      <Input
        size="sm"
        label={t('crm.composer.to', 'To')}
        value={to}
        onChange={(e) => updateDraft(props.composerKey, { to: e.target.value })}
        placeholder="alice@example.com, bob@example.com"
      />

      {showCc ? (
        <>
          <Input
            size="sm"
            label={t('crm.composer.cc', 'Cc')}
            value={draft.cc}
            onChange={(e) => updateDraft(props.composerKey, { cc: e.target.value })}
          />
          <Input
            size="sm"
            label={t('crm.composer.bcc', 'Bcc')}
            value={draft.bcc}
            onChange={(e) => updateDraft(props.composerKey, { bcc: e.target.value })}
          />
        </>
      ) : (
        <Button size="sm" variant="ghost" onClick={() => setShowCc(true)}>
          {t('crm.composer.addCcBcc', 'Add Cc / Bcc')}
        </Button>
      )}

      <Input
        size="sm"
        label={t('crm.composer.subject', 'Subject')}
        value={subject}
        onChange={(e) => updateDraft(props.composerKey, { subject: e.target.value })}
      />

      <Textarea
        label={t('crm.composer.body', 'Message')}
        value={draft.body}
        onChange={(e) => updateDraft(props.composerKey, { body: e.target.value })}
        rows={8}
      />

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--spacing-sm)' }}>
        <Button
          size="sm"
          variant="primary"
          onClick={handleSend}
          disabled={sendMessage.isPending || !to.trim() || !draft.body.trim()}
        >
          {sendMessage.isPending
            ? t('crm.composer.sending', 'Sending...')
            : t('crm.composer.send', 'Send')}
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add translation keys to all 5 locale files**

For each of `packages/client/src/i18n/locales/{en,tr,de,fr,it}.json`, find the `"crm":` block and add a `composer` key as a sibling alongside the existing `integrations` block (added in Phase 2a Task 7). Use Node.js to round-trip the JSON safely.

The English keys to add inside `crm`:

```json
"composer": {
  "to": "To",
  "cc": "Cc",
  "bcc": "Bcc",
  "subject": "Subject",
  "body": "Message",
  "send": "Send",
  "sending": "Sending...",
  "addCcBcc": "Add Cc / Bcc",
  "sentToast": "Message queued for sending",
  "sendError": "Failed to send message",
  "newEmail": "New email",
  "reply": "Reply",
  "retry": "Retry",
  "retrying": "Retrying...",
  "retryToast": "Send retried",
  "retryError": "Failed to retry message",
  "statusPending": "Sending",
  "statusSent": "Sent",
  "statusFailed": "Failed"
}
```

For tr/de/fr/it: use the same keys with English values for now (Atlas's "keys-first" policy from Phase 2a).

- [ ] **Step 3: Typecheck + build the client**

```bash
cd packages/client && npm run typecheck 2>&1 | tail -3
cd packages/client && npm run build 2>&1 | tail -5
```

Expected: clean.

- [ ] **Step 4: Verify locale JSON validity**

```bash
for f in packages/client/src/i18n/locales/*.json; do
  node -e "require('$f')" || echo "BROKEN: $f"
done
```

Expected: no "BROKEN" output.

- [ ] **Step 5: Commit**

```bash
git add packages/client/src/apps/crm/components/email-composer/email-composer.tsx packages/client/src/i18n/locales/en.json packages/client/src/i18n/locales/tr.json packages/client/src/i18n/locales/de.json packages/client/src/i18n/locales/fr.json packages/client/src/i18n/locales/it.json
git commit -m "feat(crm): email composer form component"
```

---

## Task 11: Composer popover wrapper + integration into contact card

**Why:** The composer needs to mount somewhere. Two entry points:
1. **Contact card "Email" button** → opens composer with `to=contact.email`, no reply context
2. **Timeline "Reply" button on email activity** → opens composer with reply context (covered in Task 12)

This task does the contact-card entry. We need to find the contact card component and add a button.

**Files:**
- Create: `packages/client/src/apps/crm/components/email-composer/email-composer-popover.tsx`
- Modify: the contact card / contact detail page (find the actual file path)

- [ ] **Step 1: Implement the popover wrapper**

Create `packages/client/src/apps/crm/components/email-composer/email-composer-popover.tsx`:

```tsx
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '../../../../components/ui/popover';
import { Button } from '../../../../components/ui/button';
import { useChannels } from '../../hooks/use-channels';
import { EmailComposer } from './email-composer';

export interface EmailComposerPopoverProps {
  composerKey: string;
  defaultTo?: string;
  defaultSubject?: string;
  replyTo?: { inReplyTo: string; threadId: string };
  /** The trigger button label. Default: "New email". */
  triggerLabel?: string;
}

export function EmailComposerPopover(props: EmailComposerPopoverProps) {
  const { t } = useTranslation();
  const { data: channels } = useChannels();
  const [open, setOpen] = useState(false);

  // Pick the first owned, sync-enabled gmail channel as the default sender.
  // If multiple channels, future enhancement: let the user pick. For 2c,
  // most users have exactly one.
  const channel = channels?.find((c) => c.type === 'gmail' && c.isSyncEnabled) ?? null;

  if (!channel) {
    // No connected channel — render a disabled button.
    return (
      <Button size="sm" variant="secondary" disabled>
        {props.triggerLabel ?? t('crm.composer.newEmail', 'New email')}
      </Button>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="secondary">
          {props.triggerLabel ?? t('crm.composer.newEmail', 'New email')}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={4}
        style={{
          padding: 0,
          background: 'var(--color-bg-elevated)',
          border: '1px solid var(--color-border-primary)',
          borderRadius: 'var(--radius-md)',
          boxShadow: 'var(--shadow-elevated)',
        }}
      >
        <EmailComposer
          composerKey={props.composerKey}
          channelId={channel.id}
          defaultTo={props.defaultTo}
          defaultSubject={props.defaultSubject}
          replyTo={props.replyTo}
          onSent={() => setOpen(false)}
        />
      </PopoverContent>
    </Popover>
  );
}
```

- [ ] **Step 2: Find the contact card component**

```bash
grep -rln "contact.email\|contactEmail\|crm/contacts" packages/client/src/apps/crm/ | head -10
```

You're looking for the component that renders a contact's detail panel — likely something like `contact-detail.tsx`, `contact-card.tsx`, or a section inside the contacts page (`packages/client/src/apps/crm/page.tsx`).

Once located, add an "Email" button near the existing contact-info display. The exact JSX integration depends on the existing layout — match the surrounding pattern (typically a row of action buttons next to the contact name/email).

Add the import in that file:

```typescript
import { EmailComposerPopover } from '../components/email-composer/email-composer-popover';
```

(Adjust the relative path based on the file's location.)

Where the action buttons live, add:

```tsx
<EmailComposerPopover
  composerKey={`contact-${contact.id}`}
  defaultTo={contact.email ?? ''}
  defaultSubject=""
/>
```

If the contact has no email, render the popover anyway — it'll show but the user must type an address.

- [ ] **Step 3: Typecheck + build**

```bash
cd packages/client && npm run typecheck 2>&1 | tail -3
cd packages/client && npm run build 2>&1 | tail -5
```

Expected: clean.

- [ ] **Step 4: Manual UI smoke (recommended)**

Boot the dev environment:

```bash
cd /Users/gorkemcetin/atlasmail && docker compose up -d
cd packages/server && REDIS_URL="redis://localhost:6379" npm run dev &
cd packages/client && npm run dev &
```

Open http://localhost:5180, navigate to a contact, click "New email" — the composer popover should appear with `to=contact.email`. Don't actually click Send (that's Task 13's gate). Just verify the popover layout looks right and the draft persists when you close + reopen.

Kill servers when done.

- [ ] **Step 5: Commit**

```bash
git add packages/client/src/apps/crm/components/email-composer/email-composer-popover.tsx <path-to-modified-contact-card>
git commit -m "feat(crm): email composer popover + contact card integration"
```

(Replace `<path-to-modified-contact-card>` with the actual file path you modified in Step 2.)

---

## Task 12: Email activity row + Reply button in timeline

**Why:** The CRM activity timeline currently doesn't have a renderer for `email-received` / `email-sent` activity types. Phase 2b created those rows in the DB; now they need a UI. The renderer shows from/to, subject, snippet, and a Reply button that opens the composer with reply context.

**Files:**
- Create: `packages/client/src/apps/crm/components/activity-list/email-activity-row.tsx`
- Modify: the existing activity-list renderer (find with grep)

- [ ] **Step 1: Find the existing activity-list component**

```bash
grep -rln "activity.type\|crm.activities" packages/client/src/apps/crm/ | head -10
```

Locate the file that switches on `activity.type` to render different row variants (note, call, meeting, etc.). Read it briefly so the new email row matches the existing visual pattern.

- [ ] **Step 2: Create the email activity row**

Create `packages/client/src/apps/crm/components/activity-list/email-activity-row.tsx`:

```tsx
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Mail, Send } from 'lucide-react';
import { api } from '../../../../lib/api-client';
import { queryKeys } from '../../../../config/query-keys';
import { Button } from '../../../../components/ui/button';
import { Badge } from '../../../../components/ui/badge';
import { useRetryMessage } from '../../hooks/use-send-message';
import { useToastStore } from '../../../../stores/toast-store';
import { EmailComposerPopover } from '../email-composer/email-composer-popover';

export interface EmailActivityRowProps {
  activity: {
    id: string;
    type: 'email-received' | 'email-sent';
    messageId: string | null;
    createdAt: string;
  };
}

export function EmailActivityRow({ activity }: EmailActivityRowProps) {
  const { t } = useTranslation();
  const retry = useRetryMessage();
  const addToast = useToastStore((s) => s.addToast);
  const [showFullBody, setShowFullBody] = useState(false);

  const { data: message } = useQuery({
    queryKey: queryKeys.crm.messages.detail(activity.messageId ?? 'none'),
    queryFn: async () => {
      if (!activity.messageId) return null;
      const { data } = await api.get(`/crm/messages/${activity.messageId}`);
      return data.data as {
        id: string;
        subject: string | null;
        snippet: string | null;
        bodyText: string | null;
        status: string;
        threadId: string;
        headerMessageId: string | null;
        direction: 'inbound' | 'outbound';
      };
    },
    enabled: !!activity.messageId,
    staleTime: 30_000,
  });

  if (!message) {
    return (
      <div style={{ padding: 'var(--spacing-sm)', color: 'var(--color-text-tertiary)', fontSize: 'var(--font-size-sm)' }}>
        ...
      </div>
    );
  }

  const isOutbound = activity.type === 'email-sent';
  const Icon = isOutbound ? Send : Mail;

  const statusBadge = (() => {
    if (!isOutbound) return null;
    if (message.status === 'pending') return <Badge variant="warning">{t('crm.composer.statusPending', 'Sending')}</Badge>;
    if (message.status === 'failed') return <Badge variant="error">{t('crm.composer.statusFailed', 'Failed')}</Badge>;
    if (message.status === 'sent') return <Badge variant="success">{t('crm.composer.statusSent', 'Sent')}</Badge>;
    return null;
  })();

  const handleRetry = () => {
    retry.mutate(message.id, {
      onSuccess: () => addToast({ type: 'success', message: t('crm.composer.retryToast', 'Send retried') }),
      onError: (err: any) =>
        addToast({
          type: 'error',
          message: err?.response?.data?.error ?? t('crm.composer.retryError', 'Failed to retry message'),
        }),
    });
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--spacing-xs)',
        padding: 'var(--spacing-md)',
        border: '1px solid var(--color-border-primary)',
        borderRadius: 'var(--radius-md)',
        background: 'var(--color-bg-primary)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
        <Icon size={14} style={{ color: 'var(--color-text-secondary)' }} />
        <span style={{ fontWeight: 'var(--font-weight-semibold)' as any, fontSize: 'var(--font-size-sm)' }}>
          {message.subject ?? '(no subject)'}
        </span>
        {statusBadge}
      </div>

      <div
        style={{
          fontSize: 'var(--font-size-sm)',
          color: 'var(--color-text-secondary)',
          cursor: 'pointer',
          whiteSpace: showFullBody ? 'pre-wrap' : 'nowrap',
          overflow: showFullBody ? 'visible' : 'hidden',
          textOverflow: 'ellipsis',
        }}
        onClick={() => setShowFullBody((v) => !v)}
      >
        {showFullBody ? (message.bodyText ?? message.snippet ?? '') : (message.snippet ?? '')}
      </div>

      <div style={{ display: 'flex', gap: 'var(--spacing-sm)', justifyContent: 'flex-end' }}>
        {message.status === 'failed' && (
          <Button size="sm" variant="secondary" onClick={handleRetry} disabled={retry.isPending}>
            {retry.isPending ? t('crm.composer.retrying', 'Retrying...') : t('crm.composer.retry', 'Retry')}
          </Button>
        )}
        {message.headerMessageId && (
          <EmailComposerPopover
            composerKey={`thread-${message.threadId}`}
            replyTo={{ inReplyTo: message.headerMessageId, threadId: message.threadId }}
            defaultSubject={message.subject?.startsWith('Re: ') ? message.subject : `Re: ${message.subject ?? ''}`}
            triggerLabel={t('crm.composer.reply', 'Reply')}
          />
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Wire into the activity-list switch**

In the file you found in Step 1, find the switch (or chain of conditionals) on `activity.type`. Add a case for `email-received` and `email-sent` that renders `<EmailActivityRow activity={activity} />`.

Add the import:

```typescript
import { EmailActivityRow } from './email-activity-row';
```

Then add the case (the exact JSX form depends on the existing pattern — match it). Typically:

```tsx
{activity.type === 'email-received' || activity.type === 'email-sent' ? (
  <EmailActivityRow activity={activity} />
) : (
  // existing renderer for other activity types
)}
```

- [ ] **Step 4: Typecheck + build**

```bash
cd packages/server && npm run typecheck 2>&1 | tail -3
cd packages/client && npm run typecheck 2>&1 | tail -3
cd packages/client && npm run build 2>&1 | tail -5
```

Expected: clean.

- [ ] **Step 5: Run server tests**

```bash
cd packages/server && npm test 2>&1 | tail -5
```

Expected: 553 passed (no new tests in this client-only task).

- [ ] **Step 6: Commit**

```bash
git add packages/client/src/apps/crm/components/activity-list/email-activity-row.tsx <path-to-activity-list-file>
git commit -m "feat(crm): email activity row + Reply button in timeline"
```

(Replace `<path-to-activity-list-file>` with the actual file path you modified.)

---

## Task 13: Final verification + manual end-to-end smoke (NO PUSH)

**Why:** Unit tests cover gating + parsing + matching independently. The real integration — composing → enqueueing → API send → activity refresh — must be exercised against a real Gmail account at least once before declaring 2c done.

- [ ] **Step 1: Run full server test suite**

```bash
cd packages/server && npm test 2>&1 | tail -8
```

Expected: 553 passed (524 baseline + 29 new across rfc5322, contact-create, gmail-send, messages-controller, sync-worker).

- [ ] **Step 2: Server typecheck + lint + build**

```bash
cd packages/server && npm run typecheck 2>&1 | tail -3
cd packages/server && npm run lint 2>&1 | grep -E "error|^✖" | tail -3
cd packages/server && npm run build 2>&1 | tail -3
```

Expected: typecheck clean, 0 lint errors (pre-existing warnings ok), build clean.

Verify new artifacts:

```bash
ls packages/server/dist/apps/crm/services/rfc5322.js
ls packages/server/dist/apps/crm/services/gmail-send.service.js
ls packages/server/dist/apps/crm/services/crm-contact-create.service.js
ls packages/server/dist/apps/crm/controllers/messages.controller.js
```

All four should exist.

- [ ] **Step 3: Client typecheck + build**

```bash
cd packages/client && npm run typecheck 2>&1 | tail -3
cd packages/client && npm run build 2>&1 | tail -5
```

Expected: clean.

- [ ] **Step 4: Manual end-to-end smoke (REQUIRED)**

Prerequisites:
- Phase 2b's smoke must have already passed (you're sending from a Gmail account that's connected and synced)
- Postgres + Redis running (`docker compose up -d`)
- A test contact in CRM with an email you control (so you can verify the email arrives)

Procedure:

1. Start dev: `cd /Users/gorkemcetin/atlasmail/packages/server && REDIS_URL="redis://localhost:6379" npm run dev &` and `cd packages/client && npm run dev &`
2. Open http://localhost:5180, navigate to a CRM contact whose email you control.
3. Click "New email". The composer popover opens with `to=contact.email`.
4. Type a subject and body. Click Send.
5. Toast: "Message queued for sending".
6. Watch server logs for: `Running Gmail send { messageId: ..., jobId: ... }` → `Gmail send completed { gmailMessageId: ..., gmailThreadId: ... }`.
7. Check the contact's timeline — the email-sent activity row appears with `Sent` status badge.
8. Check your test inbox — the email actually arrives.
9. Verify in psql:
   ```bash
   docker compose exec -T postgres psql -U postgres atlas -c "SELECT id, status, gmail_message_id, sent_at FROM messages WHERE direction = 'outbound' ORDER BY created_at DESC LIMIT 5;"
   ```
   Latest row should have `status='sent'`, populated `gmail_message_id`, recent `sent_at`.

10. **Threading check:** find an existing inbound email in the contact's timeline. Click Reply. Composer opens with `subject="Re: ..."` and reply context. Send.
11. Verify in your test inbox: the reply lands in the same thread (Gmail's web client groups it under the original).
12. Verify in psql: the new outbound row has the same `thread_id` as the original inbound row.

13. **Failure path:** temporarily disconnect from the internet (or stop the redis container), then click Send. Status badge should show "Failed". Reconnect, click Retry. Verify the message goes through.

14. **Auto-create check:** send to an email address that doesn't yet exist as a CRM contact. After send completes, verify a new contact was auto-created (depends on the channel's `contactAutoCreationPolicy` — `send-only` will auto-create from outbound recipients).

Kill the dev servers when done.

If any step fails: file a bug, fix, retry. The plan's correctness gate is this manual smoke.

- [ ] **Step 5: Verify nothing accidentally pushed**

```bash
git log --oneline origin/main..HEAD
```

Expected: 12 unpushed commits (one per task plus initial plan commit, minus tasks that produce no commit).

- [ ] **Step 6: Report**

Per Atlas convention this plan does NOT push. The user pushes when satisfied. Summarize:
- Tasks 1–12 completed
- New endpoints: `POST /crm/messages/send`, `POST /crm/messages/:id/retry`, `GET /crm/messages/:id`
- New job: `gmail-send` dispatch wired into the worker
- Composer UI: contact card "New email" button + timeline "Reply" button on email activities
- Auto-create wired into both inbound (via gmail-sync) and outbound (via gmail-send) participant matching
- No new schema, no new dependencies, no visibility-on-read enforcement (still Phase 2d)
- Manual smoke verified send + reply + threading + retry + auto-create

---

## Acceptance criteria

This phase is done when:

- [ ] All server tests pass (~553 expected)
- [ ] `npm run typecheck` clean in both `packages/server` and `packages/client`
- [ ] `npm run lint` 0 errors in `packages/server`
- [ ] `npm run build` clean in both packages
- [ ] Manual end-to-end smoke (Task 13 Step 4) succeeds: compose → send → arrive at recipient + appear in CRM timeline with `Sent` status
- [ ] Reply-in-thread keeps Gmail's visual threading intact
- [ ] Retry works on a failed message
- [ ] Auto-create creates a new contact for unmatched outbound recipients (when channel policy permits)
- [ ] No outbound visibility enforcement on reads (Phase 2d)
- [ ] No new top-level dependencies added
- [ ] All commits target `main`; no feature branch; no `git push`

---

## What this unblocks for sub-phase 2d

Phase 2d (Visibility, Retention, Blocklist) becomes purely additive:

1. **Visibility filter at message read query layer** — `getMessage` and the timeline message-fetch should join through `messageChannels` and filter by `visibility='shared-with-tenant' OR ownerUserId=req.auth.userId`. The 2c controllers do owner-only; 2d broadens.
2. **Retention cleaner job** — new `gmail-message-cleaner` job that soft-deletes messages older than `tenant_settings.gmail_retention_days`. Scheduled daily.
3. **Blocklist UI** — Settings panel with the existing schema (added in 2a).
4. **Orphan scheduler reconcile** — drop BullMQ scheduler entries whose channel was deleted (the TODO from Phase 2b Task 7).
5. **Backfill activities for new contact matches** — when a contact is created (auto or manual), find pre-existing messages whose participants match by handle and back-fill `personId` + activities. Phase 2c's auto-create only links going-forward.

No schema migration needed in 2d (the `messageBlocklist` table and `tenant_settings` already exist).
