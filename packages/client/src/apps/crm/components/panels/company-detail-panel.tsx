import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatCurrency } from '../../../../lib/format';
import { Phone as PhoneIcon, X, Trash2, RefreshCw, Copy } from 'lucide-react';
import {
  useDeleteCompany, useActivities, useRegeneratePortalToken,
  useMyCrmPermission, canAccess,
  type CrmCompany, type CrmContact, type CrmDeal,
} from '../../hooks';
import { ActivityTimeline } from '../activity-timeline';
import { IconButton } from '../../../../components/ui/icon-button';
import { Button } from '../../../../components/ui/button';
import { Chip } from '../../../../components/ui/chip';
import { SmartButtonBar } from '../../../../components/shared/SmartButtonBar';
import { PresenceAvatars } from '../../../../components/shared/presence-avatars';
import { ConfirmDialog } from '../../../../components/ui/confirm-dialog';
import { NotesSection } from '../notes-section';
import { CompanyLogo } from '../../lib/crm-helpers';

export function CompanyDetailPanel({
  company, contacts, deals, onClose, onContactClick, onDealClick,
}: {
  company: CrmCompany;
  contacts: CrmContact[];
  deals: CrmDeal[];
  onClose: () => void;
  onContactClick?: (contactId: string) => void;
  onDealClick?: (dealId: string) => void;
}) {
  const { t } = useTranslation();
  const { data: perm } = useMyCrmPermission();
  const canDelete = canAccess(perm?.role, 'companies', 'delete');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [tokenCopied, setTokenCopied] = useState(false);
  const deleteCompany = useDeleteCompany();
  const regenerateToken = useRegeneratePortalToken();
  const { data: activitiesData } = useActivities({ companyId: company.id });
  const activities = activitiesData?.activities ?? [];
  const companyContacts = contacts.filter((c) => c.companyId === company.id);
  const companyDeals = deals.filter((d) => d.companyId === company.id);

  return (
    <div className="crm-detail-panel">
      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title={t('crm.companies.deleteCompany')}
        description={t('crm.confirm.deleteCompany', { name: company.name })}
        confirmLabel={t('common.delete')}
        destructive
        onConfirm={() => { deleteCompany.mutate(company.id); onClose(); }}
      />
      <div style={{
        padding: '12px var(--spacing-lg)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid var(--color-border-secondary)', flexShrink: 0,
      }}>
        <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: 'var(--font-family)' }}>
          {t('crm.companies.companyDetail')}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <PresenceAvatars appId="crm" recordId={company.id} />
          {canDelete && <IconButton icon={<Trash2 size={14} />} label={t('crm.companies.deleteCompany')} size={28} destructive onClick={() => setShowDeleteConfirm(true)} />}
          <IconButton icon={<X size={14} />} label={t('common.close')} size={28} onClick={onClose} />
        </div>
      </div>

      <SmartButtonBar appId="crm" recordId={company.id} />

      <div className="crm-detail-body">
        <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)', display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
          <CompanyLogo domain={company.domain} size={32} />
          {company.name}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
          {company.domain && (
            <div className="crm-detail-field">
              <span className="crm-detail-field-label">{t('crm.companies.domain')}</span>
              <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)' }}>
                {company.domain}
              </div>
            </div>
          )}

          {company.industry && (
            <div className="crm-detail-field">
              <span className="crm-detail-field-label">{t('crm.companies.industry')}</span>
              <Chip>{company.industry}</Chip>
            </div>
          )}

          {company.size && (
            <div className="crm-detail-field">
              <span className="crm-detail-field-label">{t('crm.companies.size')}</span>
              <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)' }}>
                {company.size} {t('crm.companies.employees')}
              </div>
            </div>
          )}

          {company.address && (
            <div className="crm-detail-field">
              <span className="crm-detail-field-label">{t('crm.companies.address')}</span>
              <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)' }}>
                {company.address}
              </div>
            </div>
          )}

          {company.phone && (
            <div className="crm-detail-field">
              <span className="crm-detail-field-label">{t('crm.contacts.phone')}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)' }}>
                <PhoneIcon size={14} style={{ color: 'var(--color-text-tertiary)' }} />
                {company.phone}
              </div>
            </div>
          )}

          {company.taxId && (
            <div className="crm-detail-field">
              <span className="crm-detail-field-label">{t('crm.companies.taxId')}</span>
              <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)' }}>
                {company.taxId}
              </div>
            </div>
          )}
        </div>

        {/* Billing */}
        {(company.taxOffice || company.currency || company.postalCode || company.state || company.country || company.logo || company.portalToken) && (
          <div style={{ marginTop: 'var(--spacing-sm)' }}>
            <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 'var(--spacing-sm)', fontFamily: 'var(--font-family)' }}>
              {t('crm.companies.billing')}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
              {company.taxOffice && (
                <div className="crm-detail-field">
                  <span className="crm-detail-field-label">{t('crm.companies.taxOffice')}</span>
                  <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)' }}>
                    {company.taxOffice}
                  </div>
                </div>
              )}
              {company.currency && (
                <div className="crm-detail-field">
                  <span className="crm-detail-field-label">{t('crm.companies.currency')}</span>
                  <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)' }}>
                    {company.currency}
                  </div>
                </div>
              )}
              {company.postalCode && (
                <div className="crm-detail-field">
                  <span className="crm-detail-field-label">{t('crm.companies.postalCode')}</span>
                  <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)' }}>
                    {company.postalCode}
                  </div>
                </div>
              )}
              {company.state && (
                <div className="crm-detail-field">
                  <span className="crm-detail-field-label">{t('crm.companies.state')}</span>
                  <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)' }}>
                    {company.state}
                  </div>
                </div>
              )}
              {company.country && (
                <div className="crm-detail-field">
                  <span className="crm-detail-field-label">{t('crm.companies.country')}</span>
                  <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)' }}>
                    {company.country}
                  </div>
                </div>
              )}
              {company.logo && (
                <div className="crm-detail-field">
                  <span className="crm-detail-field-label">{t('crm.companies.logo')}</span>
                  <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)', wordBreak: 'break-all' }}>
                    {company.logo}
                  </div>
                </div>
              )}
              {company.portalToken && (
                <div className="crm-detail-field">
                  <span className="crm-detail-field-label">{t('crm.companies.portalToken')}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
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
                </div>
              )}
              {!company.portalToken && (
                <div className="crm-detail-field">
                  <span className="crm-detail-field-label">{t('crm.companies.portalToken')}</span>
                  <Button variant="ghost" size="sm" onClick={() => regenerateToken.mutate(company.id)}>
                    <RefreshCw size={13} style={{ marginRight: 4 }} />
                    {t('crm.companies.regenerateToken')}
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Contacts */}
        {companyContacts.length > 0 && (
          <div style={{ marginTop: 'var(--spacing-sm)' }}>
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
          <div style={{ marginTop: 'var(--spacing-sm)' }}>
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
                  <span style={{ color: 'var(--color-text-tertiary)', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(deal.value, deal.currency)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Activity */}
        <div style={{ marginTop: 'var(--spacing-sm)' }}>
          <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 'var(--spacing-sm)', fontFamily: 'var(--font-family)' }}>
            {t('crm.sidebar.activities')}
          </div>
          <ActivityTimeline activities={activities} />
        </div>

        {/* Notes */}
        <div style={{ marginTop: 'var(--spacing-lg)', borderTop: '1px solid var(--color-border-secondary)', paddingTop: 'var(--spacing-lg)' }}>
          <NotesSection companyId={company.id} />
        </div>
      </div>
    </div>
  );
}
