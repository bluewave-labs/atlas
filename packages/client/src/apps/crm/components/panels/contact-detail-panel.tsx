import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatDate, formatCurrency } from '../../../../lib/format';
import { Building2, Mail, Phone as PhoneIcon, X, Trash2, Users } from 'lucide-react';
import {
  useUpdateContact, useDeleteContact, useActivities,
  useMyCrmPermission, canAccess,
  type CrmContact, type CrmDeal,
} from '../../hooks';
import { ActivityTimeline } from '../activity-timeline';
import { IconButton } from '../../../../components/ui/icon-button';
import { Chip } from '../../../../components/ui/chip';
import { SmartButtonBar } from '../../../../components/shared/SmartButtonBar';
import { PresenceAvatars } from '../../../../components/shared/presence-avatars';
import { CustomFieldsRenderer } from '../../../../components/shared/custom-fields-renderer';
import { ConfirmDialog } from '../../../../components/ui/confirm-dialog';
import { CalendarEvents } from '../calendar-events';
import { NotesSection } from '../notes-section';

export function ContactDetailPanel({
  contact, deals, onClose, onCompanyClick, onDealClick,
}: {
  contact: CrmContact;
  deals: CrmDeal[];
  onClose: () => void;
  onCompanyClick?: (companyId: string) => void;
  onDealClick?: (dealId: string) => void;
}) {
  const { t } = useTranslation();
  const { data: perm } = useMyCrmPermission();
  const canDelete = canAccess(perm?.role, 'contacts', 'delete');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const updateContact = useUpdateContact();
  const deleteContact = useDeleteContact();
  const { data: activitiesData } = useActivities({ contactId: contact.id });
  const activities = activitiesData?.activities ?? [];
  const contactDeals = deals.filter((d) => d.contactId === contact.id);

  return (
    <div className="crm-detail-panel">
      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title={t('crm.contacts.deleteContact')}
        description={t('crm.confirm.deleteContact', { name: contact.name })}
        confirmLabel={t('common.delete')}
        destructive
        onConfirm={() => { deleteContact.mutate(contact.id); onClose(); }}
      />
      <div style={{
        padding: '12px var(--spacing-lg)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid var(--color-border-secondary)', flexShrink: 0,
      }}>
        <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: 'var(--font-family)' }}>
          {t('crm.contacts.contactDetail')}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <PresenceAvatars appId="crm" recordId={contact.id} />
          {canDelete && <IconButton icon={<Trash2 size={14} />} label={t('crm.contacts.deleteContact')} size={28} destructive onClick={() => setShowDeleteConfirm(true)} />}
          <IconButton icon={<X size={14} />} label={t('common.close')} size={28} onClick={onClose} />
        </div>
      </div>

      <SmartButtonBar appId="crm" recordId={contact.id} />

      <div className="crm-detail-body">
        <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)' }}>
          {contact.name}
        </div>
        {contact.position && (
          <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-family)', marginTop: -8 }}>
            {contact.position}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
          {contact.email && (
            <div className="crm-detail-field">
              <span className="crm-detail-field-label">{t('crm.contacts.email')}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)' }}>
                <Mail size={14} style={{ color: 'var(--color-text-tertiary)' }} />
                {contact.email}
              </div>
            </div>
          )}

          {contact.phone && (
            <div className="crm-detail-field">
              <span className="crm-detail-field-label">{t('crm.contacts.phone')}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)' }}>
                <PhoneIcon size={14} style={{ color: 'var(--color-text-tertiary)' }} />
                {contact.phone}
              </div>
            </div>
          )}

          {contact.companyName && (
            <div className="crm-detail-field">
              <span className="crm-detail-field-label">{t('crm.deals.company')}</span>
              <div
                style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)', fontSize: 'var(--font-size-sm)', color: contact.companyId && onCompanyClick ? 'var(--color-accent-primary)' : 'var(--color-text-primary)', fontFamily: 'var(--font-family)', cursor: contact.companyId && onCompanyClick ? 'pointer' : 'default' }}
                onClick={() => { if (contact.companyId && onCompanyClick) onCompanyClick(contact.companyId); }}
              >
                <Building2 size={14} style={{ color: 'var(--color-text-tertiary)' }} />
                {contact.companyName}
              </div>
            </div>
          )}

          {contact.source && (
            <div className="crm-detail-field">
              <span className="crm-detail-field-label">{t('crm.contacts.source')}</span>
              <Chip>{contact.source}</Chip>
            </div>
          )}
        </div>

        {/* Linked deals */}
        {contactDeals.length > 0 && (
          <div style={{ marginTop: 'var(--spacing-sm)' }}>
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

        {/* Activities */}
        <div style={{ marginTop: 'var(--spacing-lg)', borderTop: '1px solid var(--color-border-secondary)', paddingTop: 'var(--spacing-lg)' }}>
          <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 'var(--spacing-sm)', fontFamily: 'var(--font-family)' }}>
            {t('crm.sidebar.activities')}
          </div>
          <ActivityTimeline activities={activities} />
        </div>

        {/* Calendar */}
        <div style={{ marginTop: 'var(--spacing-lg)', borderTop: '1px solid var(--color-border-secondary)', paddingTop: 'var(--spacing-lg)' }}>
          <CalendarEvents contactId={contact.id} defaultAttendee={contact.email || undefined} />
        </div>

        {/* Notes */}
        <div style={{ marginTop: 'var(--spacing-lg)', borderTop: '1px solid var(--color-border-secondary)', paddingTop: 'var(--spacing-lg)' }}>
          <NotesSection contactId={contact.id} />
        </div>
      </div>
    </div>
  );
}
