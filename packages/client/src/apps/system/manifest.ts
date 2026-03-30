import { Monitor, Cpu, MemoryStick } from 'lucide-react';
import type { ClientAppManifest } from '../../config/app-manifest.client';
import { SystemPage } from './page';
import { CpuWidget } from './widgets/cpu-widget';
import { MemoryWidget } from './widgets/memory-widget';

export const systemManifest: ClientAppManifest = {
  id: 'system',
  name: 'System',
  labelKey: 'sidebar.system',
  iconName: 'Monitor',
  icon: Monitor,
  color: '#6b7280',
  minPlan: 'starter',
  category: 'other',
  dependencies: [],
  defaultEnabled: true,
  version: '1.0.0',
  sidebarOrder: 90,
  routes: [{ path: '/system', component: SystemPage }],
  widgets: [
    {
      id: 'cpu-usage',
      name: 'CPU usage',
      description: 'Live CPU utilization gauge',
      iconName: 'Cpu',
      icon: Cpu,
      defaultSize: 'sm',
      refreshInterval: 10_000,
      defaultEnabled: true,
      component: CpuWidget,
    },
    {
      id: 'memory-usage',
      name: 'Memory usage',
      description: 'Live memory utilization bar',
      iconName: 'MemoryStick',
      icon: MemoryStick,
      defaultSize: 'sm',
      refreshInterval: 10_000,
      defaultEnabled: true,
      component: MemoryWidget,
    },
  ],
};
