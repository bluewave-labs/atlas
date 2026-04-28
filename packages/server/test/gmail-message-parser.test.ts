import { describe, it, expect } from 'vitest';
import {
  parseHeaders,
  extractParticipants,
  extractBodyText,
  parseGmailMessage,
} from '../src/apps/crm/services/gmail-message-parser';

describe('parseHeaders', () => {
  it('builds a lowercase-keyed map from a Gmail headers array', () => {
    const headers = [
      { name: 'From', value: 'Alice <alice@example.com>' },
      { name: 'To', value: 'bob@example.com, Carol <carol@example.com>' },
      { name: 'Subject', value: 'Hello' },
      { name: 'Message-ID', value: '<abc123@mail.example.com>' },
    ];
    const result = parseHeaders(headers as any);
    expect(result.from).toBe('Alice <alice@example.com>');
    expect(result.to).toBe('bob@example.com, Carol <carol@example.com>');
    expect(result.subject).toBe('Hello');
    expect(result['message-id']).toBe('<abc123@mail.example.com>');
  });

  it('handles missing headers gracefully', () => {
    const result = parseHeaders([{ name: 'From', value: 'a@b' }] as any);
    expect(result.from).toBe('a@b');
    expect(result.to).toBeUndefined();
  });
});

describe('extractParticipants', () => {
  it('parses single addresses', () => {
    const result = extractParticipants({
      from: 'Alice <alice@Example.com>',
      to: 'bob@example.com',
      cc: undefined,
      bcc: undefined,
    });
    expect(result).toEqual([
      { role: 'from', handle: 'alice@example.com', displayName: 'Alice' },
      { role: 'to', handle: 'bob@example.com', displayName: null },
    ]);
  });

  it('parses comma-separated multi-address fields', () => {
    const result = extractParticipants({
      from: 'a@x.com',
      to: 'Bob <bob@x.com>, carol@x.com',
      cc: 'Dave <dave@x.com>',
      bcc: undefined,
    });
    expect(result).toHaveLength(4);
    expect(result.map((p) => p.role)).toEqual(['from', 'to', 'to', 'cc']);
    expect(result.map((p) => p.handle)).toEqual(['a@x.com', 'bob@x.com', 'carol@x.com', 'dave@x.com']);
  });

  it('lowercases all handles', () => {
    const result = extractParticipants({
      from: 'A@B.COM',
      to: 'C@D.com',
      cc: undefined,
      bcc: undefined,
    });
    expect(result.map((p) => p.handle)).toEqual(['a@b.com', 'c@d.com']);
  });

  it('skips empty/whitespace fields', () => {
    const result = extractParticipants({
      from: '',
      to: '   ',
      cc: undefined,
      bcc: undefined,
    });
    expect(result).toEqual([]);
  });

  it('handles malformed addresses without crashing', () => {
    const result = extractParticipants({
      from: 'Not An Email',
      to: 'valid@example.com',
      cc: undefined,
      bcc: undefined,
    });
    // 'Not An Email' yields no @ and gets dropped; 'valid@example.com' survives
    expect(result).toEqual([
      { role: 'to', handle: 'valid@example.com', displayName: null },
    ]);
  });
});

describe('extractBodyText', () => {
  it('reads a top-level text/plain body', () => {
    const payload = {
      mimeType: 'text/plain',
      body: { data: Buffer.from('Hello world').toString('base64url') },
    };
    expect(extractBodyText(payload as any)).toBe('Hello world');
  });

  it('walks multipart/alternative to find text/plain', () => {
    const payload = {
      mimeType: 'multipart/alternative',
      parts: [
        { mimeType: 'text/plain', body: { data: Buffer.from('plain text').toString('base64url') } },
        { mimeType: 'text/html', body: { data: Buffer.from('<p>html</p>').toString('base64url') } },
      ],
    };
    expect(extractBodyText(payload as any)).toBe('plain text');
  });

  it('returns null when no text/plain part exists', () => {
    const payload = {
      mimeType: 'text/html',
      body: { data: Buffer.from('<p>only html</p>').toString('base64url') },
    };
    expect(extractBodyText(payload as any)).toBeNull();
  });

  it('truncates body to 1MB', () => {
    const big = 'x'.repeat(1_500_000);
    const payload = {
      mimeType: 'text/plain',
      body: { data: Buffer.from(big).toString('base64url') },
    };
    const result = extractBodyText(payload as any);
    expect(result).not.toBeNull();
    expect(result!.length).toBe(1_000_000);
  });

  it('does not corrupt UTF-8 at the truncation boundary', () => {
    // 4-byte emoji repeated to push the boundary mid-character
    // \u{1F600} is a 4-byte UTF-8 sequence; 250,001 of them = 1,000,004 bytes
    const big = '\u{1F600}'.repeat(250_001);
    const payload = {
      mimeType: 'text/plain',
      body: { data: Buffer.from(big).toString('base64url') },
    };
    const result = extractBodyText(payload as any);
    expect(result).not.toBeNull();
    // The result must not contain U+FFFD (Unicode replacement character)
    expect(result!.includes('�')).toBe(false);
    // And every code point in the result must be a complete \u{1F600}
    expect(result!.split('').length % 2).toBe(0); // emoji = 2 UTF-16 code units (surrogate pair)
  });

  it('returns null on missing body data', () => {
    expect(extractBodyText({ mimeType: 'text/plain' } as any)).toBeNull();
    expect(extractBodyText({ mimeType: 'text/plain', body: {} } as any)).toBeNull();
  });
});

describe('parseGmailMessage', () => {
  it('extracts a structured ingestion record from a full message', () => {
    const fakeMessage = {
      id: 'gm-123',
      threadId: 'gt-1',
      labelIds: ['INBOX', 'IMPORTANT'],
      snippet: 'preview text',
      internalDate: '1714000000000',
      payload: {
        headers: [
          { name: 'From', value: 'Alice <alice@example.com>' },
          { name: 'To', value: 'me@example.com' },
          { name: 'Subject', value: 'Hello' },
          { name: 'Message-ID', value: '<abc@mail.example.com>' },
          { name: 'In-Reply-To', value: '<prev@mail.example.com>' },
        ],
        mimeType: 'text/plain',
        body: { data: Buffer.from('Hi there').toString('base64url') },
      },
    };

    const result = parseGmailMessage(fakeMessage as any);

    expect(result).toMatchObject({
      gmailMessageId: 'gm-123',
      gmailThreadId: 'gt-1',
      headerMessageId: '<abc@mail.example.com>',
      inReplyTo: '<prev@mail.example.com>',
      subject: 'Hello',
      snippet: 'preview text',
      bodyText: 'Hi there',
      labels: ['INBOX', 'IMPORTANT'],
      hasAttachments: false,
    });
    expect(result.receivedAt).toEqual(new Date(1_714_000_000_000));
    expect(result.participants.map((p) => `${p.role}:${p.handle}`)).toEqual([
      'from:alice@example.com',
      'to:me@example.com',
    ]);
  });

  it('detects attachments via filename in part', () => {
    const fakeMessage = {
      id: 'gm-att',
      threadId: 'gt-1',
      labelIds: [],
      snippet: '',
      internalDate: '1714000000000',
      payload: {
        headers: [
          { name: 'From', value: 'a@b.com' },
          { name: 'To', value: 'c@d.com' },
        ],
        mimeType: 'multipart/mixed',
        parts: [
          { mimeType: 'text/plain', body: { data: Buffer.from('see attached').toString('base64url') } },
          { mimeType: 'application/pdf', filename: 'report.pdf', body: { attachmentId: 'att-1' } },
        ],
      },
    };
    const result = parseGmailMessage(fakeMessage as any);
    expect(result.hasAttachments).toBe(true);
  });
});
