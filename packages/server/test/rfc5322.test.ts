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
    expect(result).toMatch(/^Subject: =\?utf-8\?B\?.+\?=\r?\n/m);
    expect(result).toMatch(/こんにちは/);
  });
});

describe('encodeForGmailApi', () => {
  it('returns a base64url-encoded string suitable for the raw field', () => {
    const raw = 'From: me\r\nTo: you\r\n\r\nbody';
    const encoded = encodeForGmailApi(raw);
    expect(encoded).not.toContain('+');
    expect(encoded).not.toContain('/');
    expect(encoded).not.toContain('=');
    expect(Buffer.from(encoded, 'base64url').toString('utf-8')).toBe(raw);
  });
});
