import type { gmail_v1 } from 'googleapis';

const BODY_MAX_BYTES = 1_000_000;
const MAX_MIME_DEPTH = 20;
const ANGLE_BRACKET_PATTERN = /<([^>]+)>/;

export interface GmailHeaderMap {
  [lowercaseName: string]: string;
}

export interface ParsedParticipant {
  role: 'from' | 'to' | 'cc' | 'bcc';
  handle: string; // lowercased
  displayName: string | null;
}

export interface ParsedGmailMessage {
  gmailMessageId: string;
  gmailThreadId: string;
  headerMessageId: string | null;
  inReplyTo: string | null;
  subject: string | null;
  snippet: string | null;
  bodyText: string | null;
  receivedAt: Date | null;
  labels: string[];
  hasAttachments: boolean;
  participants: ParsedParticipant[];
}

/** Build a lowercase-keyed header map from Gmail's header array. */
export function parseHeaders(headers: gmail_v1.Schema$MessagePartHeader[]): GmailHeaderMap {
  const map: GmailHeaderMap = {};
  for (const h of headers ?? []) {
    if (h.name && h.value !== undefined && h.value !== null) {
      map[h.name.toLowerCase()] = h.value;
    }
  }
  return map;
}

interface AddressFields {
  from: string | undefined;
  to: string | undefined;
  cc: string | undefined;
  bcc: string | undefined;
}

const ROLE_ORDER: Array<'from' | 'to' | 'cc' | 'bcc'> = ['from', 'to', 'cc', 'bcc'];

/**
 * Parse from/to/cc/bcc strings into a flat list of participants.
 *
 * @remarks Consumers (gmail-sync.service.ts) must batch-lookup the returned
 * handles when matching to CRM contacts or checking the blocklist. A message
 * with 50 cc recipients yields 50 participant entries; a naive per-entry DB
 * loop would issue 100+ queries (blocklist + contact lookup) per message.
 * Use a single tenant-scoped contact lookup with `IN (handles...)` and a
 * single blocklist read per message.
 */
export function extractParticipants(fields: AddressFields): ParsedParticipant[] {
  const out: ParsedParticipant[] = [];
  for (const role of ROLE_ORDER) {
    const raw = fields[role];
    if (!raw || !raw.trim()) continue;
    for (const piece of splitAddressList(raw)) {
      const parsed = parseSingleAddress(piece);
      if (parsed) out.push({ role, handle: parsed.handle, displayName: parsed.displayName });
    }
  }
  return out;
}

/** Split "Alice <a@b>, c@d, Bob <b@c>" into individual address strings. */
function splitAddressList(s: string): string[] {
  // Naive comma-split is wrong for display names containing commas (e.g., 'Doe, Jane <jd@x>').
  // For Phase 2b we accept the imperfection — Gmail-sourced senders are extremely rarely formatted that way.
  // If false matches surface in production, swap for an RFC 5322 parser later.
  return s.split(',').map((x) => x.trim()).filter(Boolean);
}

/** Parse one address. Returns null if malformed (no @ found). */
function parseSingleAddress(s: string): { handle: string; displayName: string | null } | null {
  const angle = ANGLE_BRACKET_PATTERN.exec(s);
  if (angle) {
    const handle = angle[1].trim().toLowerCase();
    if (!handle.includes('@')) return null;
    const displayName = s.slice(0, angle.index).trim().replace(/^"|"$/g, '') || null;
    return { handle, displayName };
  }
  const trimmed = s.trim().toLowerCase();
  if (!trimmed.includes('@')) return null;
  return { handle: trimmed, displayName: null };
}

/**
 * Recursively walk the MIME tree to find the first text/plain part. Returns
 * the decoded UTF-8 string, truncated to BODY_MAX_BYTES bytes. Returns null
 * if no plain-text part is found.
 */
export function extractBodyText(
  payload: gmail_v1.Schema$MessagePart | undefined,
  depth: number = 0,
): string | null {
  if (!payload || depth > MAX_MIME_DEPTH) return null;

  const decode = (data: string | undefined | null): string | null => {
    if (!data) return null;
    try {
      const buf = Buffer.from(data, 'base64url');
      if (buf.length <= BODY_MAX_BYTES) return buf.toString('utf-8');
      // Truncate to BODY_MAX_BYTES, but step back any trailing UTF-8 continuation
      // bytes so we don't slice mid-multi-byte-character. Continuation bytes
      // have their top two bits set to 10 (0x80 mask = 0xC0 high bits). If the
      // byte just past the truncation is itself a continuation, then the
      // sequence at our boundary is incomplete — strip back through the
      // continuations and the leading byte that started the sequence.
      let end = BODY_MAX_BYTES;
      if (end < buf.length && (buf[end] & 0xc0) === 0x80) {
        while (end > 0 && (buf[end - 1] & 0xc0) === 0x80) end--;
        if (end > 0 && (buf[end - 1] & 0x80) !== 0) end--;
      }
      return buf.subarray(0, end).toString('utf-8');
    } catch {
      return null;
    }
  };

  if (payload.mimeType === 'text/plain') {
    return decode(payload.body?.data);
  }
  if (payload.parts && payload.parts.length > 0) {
    for (const part of payload.parts) {
      const found = extractBodyText(part, depth + 1);
      if (found !== null) return found;
    }
  }
  return null;
}

/** Walk parts to detect any attachment (filename present or part has attachmentId). */
function hasAttachmentInTree(
  payload: gmail_v1.Schema$MessagePart | undefined,
  depth: number = 0,
): boolean {
  if (!payload || depth > MAX_MIME_DEPTH) return false;
  if (payload.filename && payload.filename.length > 0) return true;
  if (payload.body?.attachmentId) return true;
  if (payload.parts) {
    for (const p of payload.parts) {
      if (hasAttachmentInTree(p, depth + 1)) return true;
    }
  }
  return false;
}

/**
 * Parse a Gmail API message (`format=full` or `format=metadata` + body fetch)
 * into an ingestion record. The caller is responsible for upserting threads,
 * messages, and participants — this function does no I/O.
 */
export function parseGmailMessage(message: gmail_v1.Schema$Message): ParsedGmailMessage {
  const headers = parseHeaders(message.payload?.headers ?? []);
  const participants = extractParticipants({
    from: headers.from,
    to: headers.to,
    cc: headers.cc,
    bcc: headers.bcc,
  });
  const internalDate = message.internalDate ? Number(message.internalDate) : null;

  return {
    gmailMessageId: message.id ?? '',
    gmailThreadId: message.threadId ?? '',
    headerMessageId: headers['message-id'] ?? null,
    inReplyTo: headers['in-reply-to'] ?? null,
    subject: headers.subject ?? null,
    snippet: message.snippet ?? null,
    bodyText: extractBodyText(message.payload),
    receivedAt: internalDate ? new Date(internalDate) : null,
    labels: message.labelIds ?? [],
    hasAttachments: hasAttachmentInTree(message.payload),
    participants,
  };
}
