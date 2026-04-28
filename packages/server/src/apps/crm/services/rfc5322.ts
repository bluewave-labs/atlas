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
