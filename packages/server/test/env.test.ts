import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';

describe('env: WORKER_MODE', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    vi.resetModules();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('defaults to "both" when WORKER_MODE is unset', async () => {
    delete process.env.WORKER_MODE;
    const { env } = await import('../src/config/env');
    expect(env.WORKER_MODE).toBe('both');
  });

  it('accepts "api"', async () => {
    process.env.WORKER_MODE = 'api';
    const { env } = await import('../src/config/env');
    expect(env.WORKER_MODE).toBe('api');
  });

  it('accepts "worker"', async () => {
    process.env.WORKER_MODE = 'worker';
    const { env } = await import('../src/config/env');
    expect(env.WORKER_MODE).toBe('worker');
  });

  it('rejects an unknown value', async () => {
    process.env.WORKER_MODE = 'banana';
    await expect(import('../src/config/env')).rejects.toThrow();
  });

  it('treats empty string as unset and defaults to "both"', async () => {
    process.env.WORKER_MODE = '';
    const { env } = await import('../src/config/env');
    expect(env.WORKER_MODE).toBe('both');
  });
});
