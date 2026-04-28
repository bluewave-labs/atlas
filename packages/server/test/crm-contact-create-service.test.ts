import { describe, it, expect, vi, beforeEach } from 'vitest';

const { createContactMock } = vi.hoisted(() => ({
  createContactMock: vi.fn(),
}));

vi.mock('../src/apps/crm/services/contact.service', () => ({
  createContact: createContactMock,
}));

import { autoCreateContactIfNeeded } from '../src/apps/crm/services/crm-contact-create.service';

beforeEach(() => {
  createContactMock.mockReset();
});

describe('autoCreateContactIfNeeded', () => {
  it('returns null and creates nothing when policy is none', async () => {
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
    expect(createContactMock).not.toHaveBeenCalled();
  });

  it('returns null and creates nothing when handle is blocked', async () => {
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
    expect(createContactMock).not.toHaveBeenCalled();
  });

  it('returns null when shouldAutoCreate decides no (e.g. send-only + inbound)', async () => {
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
    expect(createContactMock).not.toHaveBeenCalled();
  });

  it('delegates to createContact with parsed name when policy permits (send-only + outbound + recipient)', async () => {
    createContactMock.mockResolvedValue({ id: 'new-contact-1' });

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
    expect(createContactMock).toHaveBeenCalledWith('u-1', 't-1', {
      name: 'Jane Doe',
      email: 'jane@example.com',
      source: 'email-auto',
    });
  });

  it('uses email local-part as name when displayName is null', async () => {
    createContactMock.mockResolvedValue({ id: 'new-contact-2' });

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

    expect(createContactMock).toHaveBeenCalledWith('u-1', 't-1', expect.objectContaining({
      name: 'jane.smith',
    }));
  });

  it('uses email local-part as name when displayName is empty/whitespace', async () => {
    createContactMock.mockResolvedValue({ id: 'new-contact-3' });

    await autoCreateContactIfNeeded({
      handle: 'cher@example.com',
      displayName: '   ',
      role: 'to',
      direction: 'outbound',
      policy: 'send-and-receive',
      tenantId: 't-1',
      userId: 'u-1',
      isBlocked: false,
    });

    expect(createContactMock).toHaveBeenCalledWith('u-1', 't-1', expect.objectContaining({
      name: 'cher',
    }));
  });

  it('lowercases the email handle', async () => {
    createContactMock.mockResolvedValue({ id: 'new-contact-4' });

    await autoCreateContactIfNeeded({
      handle: 'JANE@Example.COM',
      displayName: 'Jane',
      role: 'to',
      direction: 'outbound',
      policy: 'send-and-receive',
      tenantId: 't-1',
      userId: 'u-1',
      isBlocked: false,
    });

    expect(createContactMock).toHaveBeenCalledWith('u-1', 't-1', expect.objectContaining({
      email: 'jane@example.com',
    }));
  });
});
