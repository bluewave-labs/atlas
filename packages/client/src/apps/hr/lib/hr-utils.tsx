import { Badge } from '../../../components/ui/badge';
import type { HrEmployee, HrTimeOff } from '../hooks';

export function getStatusBadge(status: HrEmployee['status'], t: (k: string) => string) {
  switch (status) {
    case 'active':
      return <Badge variant="success">{t('hr.status.active')}</Badge>;
    case 'on-leave':
      return <Badge variant="warning">{t('hr.status.onLeave')}</Badge>;
    case 'terminated':
      return <Badge variant="error">{t('hr.status.terminated')}</Badge>;
  }
}

export function getTimeOffTypeBadge(type: HrTimeOff['type'], t: (k: string) => string) {
  switch (type) {
    case 'vacation':
      return <Badge variant="primary">{t('hr.leaveType.vacation')}</Badge>;
    case 'sick':
      return <Badge variant="warning">{t('hr.leaveType.sick')}</Badge>;
    case 'personal':
      return <Badge variant="default">{t('hr.leaveType.personal')}</Badge>;
  }
}

export function getTimeOffStatusBadge(status: HrTimeOff['status'], t: (k: string) => string) {
  switch (status) {
    case 'pending':
      return <Badge variant="warning">{t('hr.timeOffStatus.pending')}</Badge>;
    case 'approved':
      return <Badge variant="success">{t('hr.timeOffStatus.approved')}</Badge>;
    case 'rejected':
      return <Badge variant="error">{t('hr.timeOffStatus.rejected')}</Badge>;
  }
}

const categoryKeys: Record<string, string> = {
  general: 'hr.onboardingCategory.general',
  IT: 'hr.onboardingCategory.it',
  HR: 'hr.onboardingCategory.hr',
  Team: 'hr.onboardingCategory.team',
  Admin: 'hr.onboardingCategory.admin',
};

export function getCategoryBadge(category: string, t?: (k: string) => string) {
  const variants: Record<string, 'primary' | 'success' | 'warning' | 'error' | 'default'> = {
    IT: 'primary', HR: 'success', Team: 'warning', Admin: 'error',
  };
  const label = t && categoryKeys[category] ? t(categoryKeys[category]) : category;
  return <Badge variant={variants[category] || 'default'}>{label}</Badge>;
}

const docTypeKeys: Record<string, string> = {
  contract: 'hr.documents.types.contract',
  certificate: 'hr.documents.types.certificate',
  ID: 'hr.documents.types.id',
  resume: 'hr.documents.types.resume',
  'policy-acknowledgment': 'hr.documents.types.policy',
  other: 'hr.documents.types.other',
};

export function getDocTypeBadge(type: string, t?: (k: string) => string) {
  const variants: Record<string, 'primary' | 'success' | 'warning' | 'error' | 'default'> = {
    contract: 'primary', certificate: 'success', ID: 'warning', resume: 'default', 'policy-acknowledgment': 'error',
  };
  const label = t && docTypeKeys[type] ? t(docTypeKeys[type]) : type;
  return <Badge variant={variants[type] || 'default'}>{label}</Badge>;
}

// --- Color Presets -------------------------------------------------------

export const DEPARTMENT_COLORS = [
  '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
  '#ec4899', '#06b6d4', '#f97316', '#6366f1', '#14b8a6',
];
