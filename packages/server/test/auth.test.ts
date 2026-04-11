import { describe, it, expect, vi, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../src/middleware/auth';

const JWT_SECRET = process.env.JWT_SECRET!;

function makeRes() {
  const res: any = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return res as Response;
}

function makeNext(): NextFunction {
  return vi.fn();
}

describe('authMiddleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sets req.auth when a valid Bearer token is provided', () => {
    const payload = { userId: 'u1', accountId: 'a1', email: 'test@test.com' };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });

    const req = { headers: { authorization: `Bearer ${token}` }, query: {} } as any;
    const res = makeRes();
    const next = makeNext();

    authMiddleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.auth).toBeDefined();
    expect(req.auth.userId).toBe('u1');
    expect(req.auth.accountId).toBe('a1');
    expect(req.auth.email).toBe('test@test.com');
  });

  it('returns 401 when no authorization header or query token is present', () => {
    const req = { headers: {}, query: {} } as any;
    const res = makeRes();
    const next = makeNext();

    authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: expect.stringContaining('Missing') })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when the token is expired', () => {
    const payload = { userId: 'u1', accountId: 'a1', email: 'test@test.com' };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '-1s' });

    const req = { headers: { authorization: `Bearer ${token}` }, query: {} } as any;
    const res = makeRes();
    const next = makeNext();

    authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: expect.stringContaining('Invalid or expired') })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when the token is signed with a wrong secret', () => {
    const payload = { userId: 'u1', accountId: 'a1', email: 'test@test.com' };
    const token = jwt.sign(payload, 'totally-wrong-secret-that-is-32-chars!!');

    const req = { headers: { authorization: `Bearer ${token}` }, query: {} } as any;
    const res = makeRes();
    const next = makeNext();

    authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when the token is malformed garbage', () => {
    const req = { headers: { authorization: 'Bearer not.a.real.token' }, query: {} } as any;
    const res = makeRes();
    const next = makeNext();

    authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('accepts token from query parameter when no auth header is present', () => {
    const payload = { userId: 'u2', accountId: 'a2', email: 'query@test.com' };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });

    const req = { headers: {}, query: { token } } as any;
    const res = makeRes();
    const next = makeNext();

    authMiddleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.auth).toBeDefined();
    expect(req.auth.userId).toBe('u2');
  });

  it('prefers Bearer header token over query token', () => {
    const headerPayload = { userId: 'header-user', accountId: 'a1', email: 'header@test.com' };
    const queryPayload = { userId: 'query-user', accountId: 'a2', email: 'query@test.com' };
    const headerToken = jwt.sign(headerPayload, JWT_SECRET, { expiresIn: '1h' });
    const queryToken = jwt.sign(queryPayload, JWT_SECRET, { expiresIn: '1h' });

    const req = { headers: { authorization: `Bearer ${headerToken}` }, query: { token: queryToken } } as any;
    const res = makeRes();
    const next = makeNext();

    authMiddleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.auth.userId).toBe('header-user');
  });

  it('returns 401 when authorization header exists but is not Bearer scheme', () => {
    const req = { headers: { authorization: 'Basic dXNlcjpwYXNz' }, query: {} } as any;
    const res = makeRes();
    const next = makeNext();

    authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('preserves tenantId and tenantRole from token payload', () => {
    const payload = {
      userId: 'u1',
      accountId: 'a1',
      email: 'admin@test.com',
      tenantId: 't1',
      tenantRole: 'owner',
    };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });

    const req = { headers: { authorization: `Bearer ${token}` }, query: {} } as any;
    const res = makeRes();
    const next = makeNext();

    authMiddleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.auth.tenantId).toBe('t1');
    expect(req.auth.tenantRole).toBe('owner');
  });
});
