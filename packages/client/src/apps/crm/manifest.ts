import { Briefcase, Settings } from 'lucide-react';
import type { ClientAppManifest } from '../../config/app-manifest.client';
import { CrmPage } from './page';
import { CrmStagesPanel, CrmGeneralPanel, CrmIntegrationsPanel } from './components/crm-settings-modal';
import { PipelineWidget } from './widgets/pipeline-widget';

export const crmManifest: ClientAppManifest = {
  id: 'crm',
  name: 'CRM',
  labelKey: 'sidebar.crm',
  iconName: 'Briefcase',
  icon: Briefcase,
  color: '#f97316',
  minPlan: 'starter',
  category: 'data',
  dependencies: [],
  defaultEnabled: true,
  version: '1.0.0',
  sidebarOrder: 10,
  routes: [{ path: '/crm', component: CrmPage }],
  widgets: [
    {
      id: 'pipeline',
      name: 'Pipeline',
      description: 'CRM pipeline value and deal count',
      iconName: 'Briefcase',
      icon: Briefcase,
      defaultSize: 'sm',
      defaultEnabled: true,
      component: PipelineWidget,
    },
  ],
  settingsCategory: {
    id: 'crm',
    label: 'CRM',
    icon: Briefcase,
    color: '#f97316',
    panels: [
      { id: 'stages', label: 'Pipeline stages', icon: Settings, component: CrmStagesPanel },
      { id: 'general', label: 'General', icon: Settings, component: CrmGeneralPanel },
      { id: 'integrations', label: 'Integrations', icon: Settings, component: CrmIntegrationsPanel },
    ],
  },
};
