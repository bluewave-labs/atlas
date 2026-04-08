import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api-client';
import { queryKeys } from '../../config/query-keys';
import { useAuthStore } from '../../stores/auth-store';

// ─── Types ─────────────────────────────────────────────────────────

export interface SystemMetrics {
  cpu: { usage: number; model: string; cores: number };
  memory: { total: number; used: number; free: number; usagePercent: number };
  disk: { total: number; used: number; free: number; usagePercent: number };
  uptime: { system: number; process: number };
  node: { version: string; platform: string; arch: string };
  os: { type: string; release: string; hostname: string };
  process: { pid: number; memoryUsage: { rss: number; heapTotal: number; heapUsed: number; external: number } };
  timestamp: string;
}

// ─── Hooks ─────────────────────────────────────────────────────────

export function useSystemMetrics() {
  const isSuperAdmin = useAuthStore((s) => s.isSuperAdmin);
  return useQuery({
    queryKey: queryKeys.system.metrics,
    queryFn: async () => {
      const { data } = await api.get('/system/metrics');
      return data.data as SystemMetrics;
    },
    enabled: isSuperAdmin,
    refetchInterval: 10_000,
    staleTime: 5_000,
  });
}
