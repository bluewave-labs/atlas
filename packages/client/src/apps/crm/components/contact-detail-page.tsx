import { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useBreadcrumb } from '../../../lib/breadcrumb-context';
import {
  ArrowLeft, ChevronLeft, ChevronRight, Trash2,
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
import { CustomFieldsRenderer } from '../../../components/shared/custom-fields-renderer';
import { CalendarEvents } from './calendar-events';
import { NotesSection } from './notes-section';
import { getActivityIcon } from '../utils';
import { translateActivityBody } from '../lib/workflow-i18n';
import { formatDate, formatCurrency } from '../../../lib/format';
import {
  useContacts, useUpdateContact, useDeleteContact,
  useDeals, useCompanies,
  useActivities, useCreateActivity,
  useMyCrmPermission, canAccess,
  type CrmContact,
} from '../hooks';

interface ContactDetailPageProps {
  contactId: string;
  onBack: () => void;
  onNavigate: (contactId: string) => void;
  onCompanyClick?: (companyId: string) => void;
  onDealClick?: (dealId: string) => void;
}

export function ContactDetailPage({ contactId, onBack, onNavigate, onCompanyClick, onDealClick }: ContactDetailPageProps) {
  const { t } = useTranslation();
  const { data: perm } = useMyCrmPermission();
  const canUpdate = canAccess(perm?.role, 'contacts', 'update');
  const canDelete = canAccess(perm?.role, 'contacts', 'delete');
  const canCreateActivity = canAccess(perm?.role, 'activities', 'create');

  const { data: contactsData } = useContacts({});
  const contacts = contactsData?.contacts ?? [];
  const contact = contacts.find(c => c.id === contactId);

  const { data: dealsData } = useDeals({});
  const deals = dealsData?.deals ?? [];
  const { data: companiesData } = useCompanies({});
  const companies = companiesData?.companies ?? [];

  const updateContact = useUpdateContact();
  const deleteContact = useDeleteContact();

  const { data: activitiesData } = useActivities({ contactId });
  const activities = activitiesData?.activities ?? [];
  const createActivity = useCreateActivity();

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [newActivityType, setNewActivityType] = useState('note');
  const [newActivityBody, setNewActivityBody] = useState('');

  // Navigation
  const currentIdx = contacts.findIndex(c => c.id === contactId);
  const canPrev = currentIdx > 0;
  const canNext = currentIdx < contacts.length - 1 && currentIdx >= 0;

  const contactDeals = useMemo(() => deals.filter(d => d.contactId === contactId), [deals, contactId]);

  const handleLogActivity = useCallback(() => {
    if (!contact || !newActivityBody.trim()) return;
    createActivity.mutate({
      type: newActivityType,
      body: newActivityBody.trim(),
      contactId: contact.id,
    }, {
      onSuccess: () => setNewActivityBody(''),
    });
  }, [contact, newActivityType, newActivityBody, createActivity]);

  useBreadcrumb(
    contact
      ? [
          { label: t('sidebar.crm', 'CRM'), to: '/crm' },
          { label: t('crm.sidebar.contacts', 'Contacts'), to: '/crm?view=contacts' },
          { label: contact.name },
        ]
      : null,
  );

  if (!contact) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-family)' }}>
        {t('crm.contacts.notFound')}
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
        <span style={{ fontSize: 'var(--font-size-md)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)' }}>
          {contact.name}
        </span>
        {contact.position && (
          <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-family)' }}>
            {contact.position}
          </span>
        )}
        <div style={{ flex: 1 }} />
        <PresenceAvatars appId="crm" recordId={contact.id} />
        <SmartButtonBar appId="crm" recordId={contact.id} />

        {/* Navigation */}
        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-family)' }}>
          {currentIdx >= 0 ? `${currentIdx + 1} / ${contacts.length}` : ''}
        </span>
        <IconButton icon={<ChevronLeft size={16} />} label={t('common.previous')} size={28} onClick={() => canPrev && onNavigate(contacts[currentIdx - 1].id)} style={{ opacity: canPrev ? 1 : 0.3 }} />
        <IconButton icon={<ChevronRight size={16} />} label={t('common.next')} size={28} onClick={() => canNext && onNavigate(contacts[currentIdx + 1].id)} style={{ opacity: canNext ? 1 : 0.3 }} />
      </div>

      {/* Main content */}
      <div className="crm-detail-split">
        {/* Left column — Contact info */}
        <div className="crm-detail-main">
          <h2 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)', margin: 0 }}>
            {contact.name}
          </h2>

          {/* Editable field grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-md)' }}>
            <EditableField
              label={t('crm.contacts.email')}
              value={contact.email || ''}
              onSave={(v) => updateContact.mutate({ id: contact.id, updatedAt: contact.updatedAt, email: v || null })}
            />
            <EditableField
              label={t('crm.contacts.phone')}
              value={contact.phone || ''}
              onSave={(v) => updateContact.mutate({ id: contact.id, updatedAt: contact.updatedAt, phone: v || null })}
            />
            <EditableField
              label={t('crm.contacts.position')}
              value={contact.position || ''}
              onSave={(v) => updateContact.mutate({ id: contact.id, updatedAt: contact.updatedAt, position: v || null })}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', fontWeight: 'var(--font-weight-medium)', textTransform: 'uppercase', letterSpacing: '0.04em', fontFamily: 'var(--font-family)' }}>
                {t('crm.deals.company')}
              </span>
              <Select
                value={contact.companyId || ''}
                onChange={(v) => updateContact.mutate({ id: contact.id, updatedAt: contact.updatedAt, companyId: v || null })}
                options={[{ value: '', label: t('crm.deals.noneAssigned') }, ...companies.map(c => ({ value: c.id, label: c.name }))]}
                size="sm"
              />
            </div>
            {contact.source && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', fontWeight: 'var(--font-weight-medium)', textTransform: 'uppercase', letterSpacing: '0.04em', fontFamily: 'var(--font-family)' }}>
                  {t('crm.contacts.source')}
                </span>
                <Chip>{contact.source}</Chip>
              </div>
            )}
          </div>

          {/* Linked deals */}
          {contactDeals.length > 0 && (
            <div>
              <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 'var(--spacing-sm)', fontFamily: 'var(--font-family)' }}>
                {t('crm.sidebar.deals')} ({contactDeals.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
                {contactDeals.map((deal) => (
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

          <CustomFieldsRenderer appId="crm" recordType="contacts" recordId={contact.id} />

          {/* Calendar */}
          <div style={{ borderTop: '1px solid var(--color-border-secondary)', paddingTop: 'var(--spacing-lg)' }}>
            <CalendarEvents contactId={contact.id} defaultAttendee={contact.email || undefined} />
          </div>

          {/* Notes */}
          <div style={{ borderTop: '1px solid var(--color-border-secondary)', paddingTop: 'var(--spacing-lg)' }}>
            <NotesSection contactId={contact.id} />
          </div>

          {/* Delete */}
          {canDelete && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 'var(--spacing-lg)' }}>
              <Button variant="danger" size="sm" icon={<Trash2 size={14} />} onClick={() => setShowDeleteConfirm(true)}>
                {t('crm.contacts.deleteContact')}
              </Button>
            </div>
          )}
        </div>

        {/* Right column — Activity */}
        <div className="crm-detail-side">
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
        title={t('crm.contacts.deleteContact')}
        description={t('crm.confirm.deleteContact', { name: contact.name })}
        confirmLabel={t('common.delete')}
        destructive
        onConfirm={() => { deleteContact.mutate(contact.id); onBack(); }}
      />
    </div>
  );
}
