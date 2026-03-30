import type { Request, Response } from 'express';
import os from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

// ─── Types ─────────────────────────────────────────────────────────

interface SystemMetrics {
  cpu: { usage: number; model: string; cores: number };
  memory: { total: number; used: number; free: number; usagePercent: number };
  disk: { total: number; used: number; free: number; usagePercent: number };
  uptime: { system: number; process: number };
  node: { version: string; platform: string; arch: string };
  os: { type: string; release: string; hostname: string };
  process: { pid: number; memoryUsage: { rss: number; heapTotal: number; heapUsed: number; external: number } };
  timestamp: string;
}

// ─── Cache ─────────────────────────────────────────────────────────

let cachedMetrics: SystemMetrics | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 5_000;

// ─── CPU Measurement ───────────────────────────────────────────────

function getCpuTimes() {
  const cpus = os.cpus();
  let idleTotal = 0;
  let total = 0;
  for (const cpu of cpus) {
    const times = cpu.times;
    const sum = times.user + times.nice + times.sys + times.idle + times.irq;
    idleTotal += times.idle;
    total += sum;
  }
  return { idle: idleTotal, total };
}

async function measureCpu(): Promise<number> {
  const start = getCpuTimes();
  await new Promise((resolve) => setTimeout(resolve, 100));
  const end = getCpuTimes();

  const idleDelta = end.idle - start.idle;
  const totalDelta = end.total - start.total;

  if (totalDelta === 0) return 0;
  return Math.round(((totalDelta - idleDelta) / totalDelta) * 100 * 10) / 10;
}

// ─── Disk Measurement ──────────────────────────────────────────────

async function measureDisk(): Promise<{ total: number; used: number; free: number; usagePercent: number }> {
  try {
    const { stdout } = await execFileAsync('df', ['-k', '/']);
    const lines = stdout.trim().split('\n');
    if (lines.length < 2) throw new Error('Unexpected df output');

    // df -k output columns: Filesystem, 1K-blocks, Used, Available, Use%, Mounted
    const parts = lines[1].split(/\s+/);
    const totalKb = parseInt(parts[1], 10);
    const usedKb = parseInt(parts[2], 10);
    const availKb = parseInt(parts[3], 10);

    const total = totalKb * 1024;
    const used = usedKb * 1024;
    const free = availKb * 1024;
    const usagePercent = total > 0 ? Math.round((used / total) * 100 * 10) / 10 : 0;

    return { total, used, free, usagePercent };
  } catch {
    return { total: 0, used: 0, free: 0, usagePercent: 0 };
  }
}

// ─── Collect Metrics ───────────────────────────────────────────────

async function collectMetrics(): Promise<SystemMetrics> {
  const now = Date.now();
  if (cachedMetrics && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedMetrics;
  }

  const [cpuUsage, disk] = await Promise.all([measureCpu(), measureDisk()]);

  const cpus = os.cpus();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const mem = process.memoryUsage();

  const metrics: SystemMetrics = {
    cpu: {
      usage: cpuUsage,
      model: cpus[0]?.model ?? 'Unknown',
      cores: cpus.length,
    },
    memory: {
      total: totalMem,
      used: usedMem,
      free: freeMem,
      usagePercent: Math.round((usedMem / totalMem) * 100 * 10) / 10,
    },
    disk,
    uptime: {
      system: os.uptime(),
      process: process.uptime(),
    },
    node: {
      version: process.version,
      platform: process.platform,
      arch: process.arch,
    },
    os: {
      type: os.type(),
      release: os.release(),
      hostname: os.hostname(),
    },
    process: {
      pid: process.pid,
      memoryUsage: {
        rss: mem.rss,
        heapTotal: mem.heapTotal,
        heapUsed: mem.heapUsed,
        external: mem.external,
      },
    },
    timestamp: new Date().toISOString(),
  };

  cachedMetrics = metrics;
  cacheTimestamp = now;
  return metrics;
}

// ─── Controller ────────────────────────────────────────────────────

export async function getMetrics(_req: Request, res: Response) {
  try {
    const data = await collectMetrics();
    res.json({ success: true, data });
  } catch (error) {
    console.error('Failed to collect system metrics:', error);
    res.status(500).json({ success: false, error: 'Failed to collect system metrics' });
  }
}
