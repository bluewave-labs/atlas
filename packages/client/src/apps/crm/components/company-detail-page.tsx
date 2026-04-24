import { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useBreadcrumb } from '../../../lib/breadcrumb-context';
import {
  ArrowLeft, ChevronLeft, ChevronRight,
  Trash2, RefreshCw, Copy,
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Select } from '../../../components/ui/select';
import { Chip } from '../../../components/ui/chip';
import { IconButton } from '../../../components/ui/icon-button';
import { EditableField } from '../../../components/ui/editable-field';
import { ConfirmDialog } from '../../../components/ui/confirm-dialog';
import { SmartButtonBar } from '../../../components/shared/SmartButtonBar';
import { PresenceAvatars } from '../../../components/shared/presence-avatars';
import { NotesSection } from './notes-section';
import { getActivityIcon } from '../utils';
import { formatDate, formatCurrency } from '../../../lib/format';
import { CompanyLogo } from '../lib/crm-helpers';
import { translateActivityBody } from '../lib/workflow-i18n';
import {
  useCompanies, useUpdateCompany, useDeleteCompany, useRegeneratePortalToken,
  useContacts, useDeals,
  useActivities, useCreateActivity,
  useMyCrmPermission, canAccess,
  type CrmCompany,
} from '../hooks';

interface CompanyDetailPageProps {
  companyId: string;
  onBack: () => void;
  onNavigate: (companyId: string) => void;
  onContactClick?: (contactId: string) => void;
  onDealClick?: (dealId: string) => void;
}

export function CompanyDetailPage({ companyId, onBack, onNavigate, onContactClick, onDealClick }: CompanyDetailPageProps) {
  const { t } = useTranslation();
  const { data: perm } = useMyCrmPermission();
  const canUpdate = canAccess(perm?.role, 'companies', 'update');
  const canDelete = canAccess(perm?.role, 'companies', 'delete');
  const canCreateActivity = canAccess(perm?.role, 'activities', 'create');

  const { data: companiesData } = useCompanies({});
  const companies = companiesData?.companies ?? [];
  const company = companies.find(c => c.id === companyId);

  const { data: contactsData } = useContacts({});
  const contacts = contactsData?.contacts ?? [];
  const { data: dealsData } = useDeals({});
  const deals = dealsData?.deals ?? [];

  const updateCompany = useUpdateCompany();
  const deleteCompany = useDeleteCompany();
  const regenerateToken = useRegeneratePortalToken();

  const { data: activitiesData } = useActivities({ companyId });
  const activities = activitiesData?.activities ?? [];
  const createActivity = useCreateActivity();

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [tokenCopied, setTokenCopied] = useState(false);
  const [newActivityType, setNewActivityType] = useState('note');
  const [newActivityBody, setNewActivityBody] = useState('');

  // Navigation
  const currentIdx = companies.findIndex(c => c.id === companyId);
  const canPrev = currentIdx > 0;
  const canNext = currentIdx < companies.length - 1 && currentIdx >= 0;

  const companyContacts = useMemo(() => contacts.filter(c => c.companyId === companyId), [contacts, companyId]);
  const companyDeals = useMemo(() => deals.filter(d => d.companyId === companyId), [deals, companyId]);

  const handleLogActivity = useCallback(() => {
    if (!company || !newActivityBody.trim()) return;
    createActivity.mutate({
      type: newActivityType,
      body: newActivityBody.trim(),
      companyId: company.id,
    }, {
      onSuccess: () => setNewActivityBody(''),
    });
  }, [company, newActivityType, newActivityBody, createActivity]);

  useBreadcrumb(
    company
      ? [
          { label: t('sidebar.crm', 'CRM'), to: '/crm' },
          { label: t('crm.sidebar.companies', 'Companies'), to: '/crm?view=companies' },
          { label: company.name },
        ]
      : null,
  );

  if (!company) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-family)' }}>
        {t('crm.companies.notFound')}
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Top bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)',
        padding: 'var(--spacing-sm) var(--spacing-lg)',
        borderBottom: '1px solid var(--color-border-secondary)', flexShrink: 0,
      }}>
        <IconButton icon={<ArrowLeft size={16} />} label={t('common.previous')} size={28} onClick={onBack} />
        <CompanyLogo domain={company.domain} size={24} />
        <span style={{ fontSize: 'var(--font-size-md)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)' }}>
          {company.name}
        </span>
        <div style={{ flex: 1 }} />
        <PresenceAvatars appId="crm" recordId={company.id} />
        <SmartButtonBar appId="crm" recordId={company.id} />

        {/* Navigation */}
        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-family)' }}>
          {currentIdx >= 0 ? `${currentIdx + 1} / ${companies.length}` : ''}
        </span>
        <IconButton icon={<ChevronLeft size={16} />} label={t('common.previous')} size={28} onClick={() => canPrev && onNavigate(companies[currentIdx - 1].id)} style={{ opacity: canPrev ? 1 : 0.3 }} />
        <IconButton icon={<ChevronRight size={16} />} label={t('common.next')} size={28} onClick={() => canNext && onNavigate(companies[currentIdx + 1].id)} style={{ opacity: canNext ? 1 : 0.3 }} />
      </div>

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left column — Company info */}
        <div style={{ flex: 6, overflow: 'auto', padding: 'var(--spacing-xl)', display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
            <CompanyLogo domain={company.domain} size={48} />
            <h2 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)', margin: 0 }}>
              {company.name}
            </h2>
          </div>

          {/* Editable field grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-md)' }}>
            <EditableField
              label={t('crm.companies.domain')}
              value={company.domain || ''}
              onSave={(v) => updateCompany.mutate({ id: company.id, updatedAt: company.updatedAt, domain: v || null })}
            />
            <EditableField
              label={t('crm.companies.industry')}
              value={company.industry || ''}
              onSave={(v) => updateCompany.mutate({ id: company.id, updatedAt: company.updatedAt, industry: v || null })}
            />
            <EditableField
              label={t('crm.companies.size')}
              value={company.size || ''}
              onSave={(v) => updateCompany.mutate({ id: company.id, updatedAt: company.updatedAt, size: v || null })}
            />
            <EditableField
              label={t('crm.contacts.phone')}
              value={company.phone || ''}
              onSave={(v) => updateCompany.mutate({ id: company.id, updatedAt: company.updatedAt, phone: v || null })}
            />
            <EditableField
              label={t('crm.companies.address')}
              value={company.address || ''}
              onSave={(v) => updateCompany.mutate({ id: company.id, updatedAt: company.updatedAt, address: v || null })}
            />
            <EditableField
              label={t('crm.companies.taxId')}
              value={company.taxId || ''}
              onSave={(v) => updateCompany.mutate({ id: company.id, updatedAt: company.updatedAt, taxId: v || null })}
            />
          </div>

          {/* Billing section */}
          <div>
            <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 'var(--spacing-sm)', fontFamily: 'var(--font-family)' }}>
              {t('crm.companies.billing')}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-md)' }}>
              <EditableField
                label={t('crm.companies.taxOffice')}
                value={company.taxOffice || ''}
                onSave={(v) => updateCompany.mutate({ id: company.id, updatedAt: company.updatedAt, taxOffice: v || null })}
              />
              <EditableField
                label={t('crm.companies.currency')}
                value={company.currency || ''}
                onSave={(v) => updateCompany.mutate({ id: company.id, updatedAt: company.updatedAt, currency: v || undefined })}
              />
              <EditableField
                label={t('crm.companies.postalCode')}
                value={company.postalCode || ''}
                onSave={(v) => updateCompany.mutate({ id: company.id, updatedAt: company.updatedAt, postalCode: v || null })}
              />
              <EditableField
                label={t('crm.companies.state')}
                value={company.state || ''}
                onSave={(v) => updateCompany.mutate({ id: company.id, updatedAt: company.updatedAt, state: v || null })}
              />
              <EditableField
                label={t('crm.companies.country')}
                value={company.country || ''}
                onSave={(v) => updateCompany.mutate({ id: company.id, updatedAt: company.updatedAt, country: v || null })}
              />
            </div>

            {/* Portal token */}
            <div style={{ marginTop: 'var(--spacing-md)' }}>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', fontWeight: 'var(--font-weight-medium)', textTransform: 'uppercase', letterSpacing: '0.04em', fontFamily: 'var(--font-family)' }}>
                {t('crm.companies.portalToken')}
              </span>
              {company.portalToken ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', marginTop: 4 }}>
                  <code style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', fontFamily: 'monospace', background: 'var(--color-bg-tertiary)', padding: '2px 6px', borderRadius: 'var(--radius-sm)', wordBreak: 'break-all', flex: 1 }}>
                    {company.portalToken}
                  </code>
                  <IconButton
                    icon={<Copy size={13} />}
                    label={tokenCopied ? '✓' : t('crm.companies.portalToken')}
                    size={24}
                    onClick={() => {
                      navigator.clipboard.writeText(company.portalToken!);
                      setTokenCopied(true);
                      setTimeout(() => setTokenCopied(false), 2000);
                    }}
                  />
                  <IconButton
                    icon={<RefreshCw size={13} />}
                    label={t('crm.companies.regenerateToken')}
                    size={24}
                    onClick={() => regenerateToken.mutate(company.id)}
                  />
                </div>
              ) : (
                <div style={{ marginTop: 4 }}>
                  <Button variant="ghost" size="sm" onClick={() => regenerateToken.mutate(company.id)}>
                    <RefreshCw size={13} style={{ marginRight: 4 }} />
                    {t('crm.companies.regenerateToken')}
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Contacts */}
          {companyContacts.length > 0 && (
            <div>
              <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 'var(--spacing-sm)', fontFamily: 'var(--font-family)' }}>
                {t('crm.sidebar.contacts')} ({companyContacts.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
                {companyContacts.map((contact) => (
                  <div key={contact.id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px var(--spacing-sm)', borderRadius: 'var(--radius-md)', background: 'var(--color-bg-secondary)',
                    fontSize: 'var(--font-size-sm)', fontFamily: 'var(--font-family)',
                    cursor: onContactClick ? 'pointer' : 'default',
                  }}
                    onClick={() => { if (onContactClick) onContactClick(contact.id); }}
                  >
                    <span style={{ color: onContactClick ? 'var(--color-accent-primary)' : 'var(--color-text-primary)' }}>{contact.name}</span>
                    <span style={{ color: 'var(--color-text-tertiary)' }}>{contact.position || ''}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Deals */}
          {companyDeals.length > 0 && (
            <div>
              <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 'var(--spacing-sm)', fontFamily: 'var(--font-family)' }}>
                {t('crm.sidebar.deals')} ({companyDeals.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
                {companyDeals.map((deal) => (
                  <div key={deal.id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px var(--spacing-sm)', borderRadius: 'var(--radius-md)', background: 'var(--color-bg-secondary)',
                    fontSize: 'var(--font-size-sm)', fontFamily: 'var(--font-family)',
                    cursor: onDealClick ? 'pointer' : 'default',
                  }}
                    onClick={() => { if (onDealClick) onDealClick(deal.id); }}
                  >
                    <span style={{ color: onDealClick ? 'var(--color-accent-primary)' : 'var(--color-text-primary)' }}>{deal.title}</span>
                    <span style={{ color: 'var(--color-text-tertiary)', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(deal.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          <div style={{ borderTop: '1px solid var(--color-border-secondary)', paddingTop: 'var(--spacing-lg)' }}>
            <NotesSection companyId={company.id} />
          </div>

          {/* Delete */}
          {canDelete && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 'var(--spacing-lg)' }}>
              <Button variant="danger" size="sm" icon={<Trash2 size={14} />} onClick={() => setShowDeleteConfirm(true)}>
                {t('crm.companies.deleteCompany')}
              </Button>
            </div>
          )}
        </div>

        {/* Right column — Activity */}
        <div style={{
          flex: 4, overflow: 'auto',
          borderLeft: '1px solid var(--color-border-secondary)',
          padding: 'var(--spacing-lg)',
          display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)',
        }}>
          <div style={{
            fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-semibold)',
            color: 'var(--color-text-tertiary)', textTransform: 'uppercase',
            letterSpacing: '0.04em', fontFamily: 'var(--font-family)',
          }}>
            {t('crm.sidebar.activities')}
          </div>

          {/* Log activity */}
          {canCreateActivity && (
            <div style={{ display: 'flex', gap: 'var(--spacing-xs)', alignItems: 'flex-end' }}>
              <Select
                value={newActivityType}
                onChange={setNewActivityType}
                options={[
                  { value: 'note', label: t('crm.activities.note') },
                  { value: 'call', label: t('crm.activities.call') },
                  { value: 'email', label: t('crm.activities.email') },
                  { value: 'meeting', label: t('crm.activities.meeting') },
                ]}
                size="sm"
                width={100}
              />
              <Input
                value={newActivityBody}
                onChange={(e) => setNewActivityBody(e.target.value)}
                placeholder={t('crm.activities.logActivity')}
                size="sm"
                style={{ flex: 1 }}
                onKeyDown={(e) => { if (e.key === 'Enter') handleLogActivity(); }}
              />
              <Button variant="primary" size="sm" onClick={handleLogActivity} disabled={!newActivityBody.trim()}>
                {t('crm.activities.logActivity')}
              </Button>
            </div>
          )}

          {/* Timeline */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
            {activities.length === 0 ? (
              <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-family)', padding: 'var(--spacing-lg) 0', textAlign: 'center' }}>
                {t('crm.activities.noActivities')}
              </div>
            ) : (
              activities.slice(0, 20).map((activity) => (
                <div key={activity.id} style={{
                  display: 'flex', gap: 'var(--spacing-sm)', padding: 'var(--spacing-sm) 0',
                  borderBottom: '1px solid var(--color-border-secondary)',
                }}>
                  <span style={{ color: 'var(--color-text-tertiary)', flexShrink: 0, marginTop: 2 }}>
                    {getActivityIcon(activity.type)}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)' }}>
                      {translateActivityBody(activity.body, t)}
                    </div>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-family)', marginTop: 2 }}>
                      {activity.type} &middot; {formatDate(activity.createdAt)}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Delete confirm */}
      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title={t('crm.companies.deleteCompany')}
        description={t('crm.confirm.deleteCompany', { name: company.name })}
        confirmLabel={t('common.delete')}
        destructive
        onConfirm={() => { deleteCompany.mutate(company.id); onBack(); }}
      />
    </div>
  );
}
