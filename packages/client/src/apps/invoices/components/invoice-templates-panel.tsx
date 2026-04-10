import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Upload, X } from 'lucide-react';
import { useInvoiceSettings, useUpdateInvoiceSettings } from '../hooks';
import { Input } from '../../../components/ui/input';
import { Textarea } from '../../../components/ui/textarea';
import { Button } from '../../../components/ui/button';
import { useToastStore } from '../../../stores/toast-store';
import { api } from '../../../lib/api-client';
import type { UpdateInvoiceSettingsInput } from '@atlasmail/shared';

const sectionLabelStyle: React.CSSProperties = {
  fontSize: 'var(--font-size-xs)',
  fontWeight: 'var(--font-weight-semibold)',
  color: 'var(--color-text-tertiary)',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  fontFamily: 'var(--font-family)',
};

const sectionBoxStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--spacing-lg)',
  padding: 'var(--spacing-lg)',
  background: 'var(--color-bg-secondary)',
  borderRadius: 'var(--radius-md)',
};

export function InvoiceTemplatesPanel() {
  const { t } = useTranslation();
  const { data: settings, isLoading } = useInvoiceSettings();
  const updateSettings = useUpdateInvoiceSettings();
  const addToast = useToastStore((s) => s.addToast);

  const [form, setForm] = useState<UpdateInvoiceSettingsInput>({});
  const [dirty, setDirty] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const templates = [
    { id: 'classic', name: t('invoices.settings.classic'), description: t('invoices.settings.classicDescription') },
    { id: 'modern', name: t('invoices.settings.modern'), description: t('invoices.settings.modernDescription') },
    { id: 'compact', name: t('invoices.settings.compact'), description: t('invoices.settings.compactDescription') },
  ];

  useEffect(() => {
    if (settings) {
      setForm({
        templateId: settings.templateId ?? 'classic',
        logoPath: settings.logoPath ?? null,
        accentColor: settings.accentColor ?? '#13715B',
        companyName: settings.companyName ?? '',
        companyAddress: settings.companyAddress ?? '',
        companyCity: settings.companyCity ?? '',
        companyCountry: settings.companyCountry ?? '',
        companyPhone: settings.companyPhone ?? '',
        companyEmail: settings.companyEmail ?? '',
        companyWebsite: settings.companyWebsite ?? '',
        companyTaxId: settings.companyTaxId ?? '',
        paymentInstructions: settings.paymentInstructions ?? '',
        bankDetails: settings.bankDetails ?? '',
        footerText: settings.footerText ?? '',
      });
      setDirty(false);
    }
  }, [settings]);

  // Fetch logo as blob (uploads endpoint requires auth, so <img src> won't work directly)
  useEffect(() => {
    if (!form.logoPath) {
      setLogoPreviewUrl(null);
      return;
    }
    let objectUrl: string | null = null;
    let cancelled = false;
    (async () => {
      try {
        const response = await api.get(`/uploads/${form.logoPath}`, { responseType: 'blob' });
        if (cancelled) return;
        objectUrl = URL.createObjectURL(response.data);
        setLogoPreviewUrl(objectUrl);
      } catch {
        if (!cancelled) setLogoPreviewUrl(null);
      }
    })();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [form.logoPath]);

  const update = (patch: Partial<UpdateInvoiceSettingsInput>) => {
    setForm((prev) => ({ ...prev, ...patch }));
    setDirty(true);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      addToast({ type: 'error', message: t('invoices.settings.logoInvalidType') });
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const { data } = await api.post('/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      const relativePath = data?.data?.path ?? null;
      if (relativePath) {
        update({ logoPath: relativePath });
      }
    } catch {
      addToast({ type: 'error', message: t('common.error') });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveLogo = () => {
    update({ logoPath: null });
  };

  const handleSave = () => {
    updateSettings.mutate(form, {
      onSuccess: () => {
        setDirty(false);
        addToast({ type: 'success', message: t('invoices.settings.saved') });
      },
      onError: () => {
        addToast({ type: 'error', message: t('common.error') });
      },
    });
  };

  if (isLoading) return <></>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xl)', maxWidth: 480 }}>
      {/* Template selector */}
      <div style={sectionBoxStyle}>
        <span style={sectionLabelStyle}>{t('invoices.settings.template')}</span>
        <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
          {templates.map((tpl) => (
            <button
              key={tpl.id}
              onClick={() => update({ templateId: tpl.id })}
              style={{
                flex: 1,
                padding: 'var(--spacing-md)',
                background: 'var(--color-bg-primary)',
                border: `2px solid ${form.templateId === tpl.id ? 'var(--color-accent-primary)' : 'var(--color-border-primary)'}`,
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                textAlign: 'left',
                fontFamily: 'var(--font-family)',
                transition: 'border-color 0.15s',
              }}
            >
              <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-primary)', marginBottom: 'var(--spacing-xs)' }}>
                {tpl.name}
              </div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>
                {tpl.description}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Accent color */}
      <div style={sectionBoxStyle}>
        <span style={sectionLabelStyle}>{t('invoices.settings.accentColor')}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
          <input
            type="color"
            value={form.accentColor ?? '#13715B'}
            onChange={(e) => update({ accentColor: e.target.value })}
            style={{ width: 40, height: 32, border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}
          />
          <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-family)' }}>
            {form.accentColor ?? '#13715B'}
          </span>
        </div>
      </div>

      {/* Logo */}
      <div style={sectionBoxStyle}>
        <span style={sectionLabelStyle}>{t('invoices.settings.logo')}</span>
        {form.logoPath ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
            <div style={{
              width: 120,
              height: 60,
              background: 'var(--color-bg-primary)',
              border: '1px solid var(--color-border-primary)',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 'var(--spacing-xs)',
            }}>
              {logoPreviewUrl ? (
                <img
                  src={logoPreviewUrl}
                  alt="Logo"
                  style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                />
              ) : (
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>…</span>
              )}
            </div>
            <Button variant="ghost" size="sm" icon={<X size={14} />} onClick={handleRemoveLogo}>
              {t('invoices.settings.removeLogo')}
            </Button>
          </div>
        ) : (
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/svg+xml"
              onChange={handleLogoUpload}
              style={{ display: 'none' }}
            />
            <Button
              variant="secondary"
              size="sm"
              icon={<Upload size={14} />}
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? t('common.loading') : t('invoices.settings.uploadLogo')}
            </Button>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', marginTop: 'var(--spacing-xs)', fontFamily: 'var(--font-family)' }}>
              {t('invoices.settings.logoHint')}
            </div>
          </div>
        )}
      </div>

      {/* Company details */}
      <div style={sectionBoxStyle}>
        <span style={sectionLabelStyle}>{t('invoices.settings.companyDetails')}</span>
        <Input
          label={t('invoices.settings.companyName')}
          value={form.companyName ?? ''}
          onChange={(e) => update({ companyName: e.target.value })}
          size="sm"
        />
        <Input
          label={t('invoices.settings.companyAddress')}
          value={form.companyAddress ?? ''}
          onChange={(e) => update({ companyAddress: e.target.value })}
          size="sm"
        />
        <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
          <Input
            label={t('invoices.settings.companyCity')}
            value={form.companyCity ?? ''}
            onChange={(e) => update({ companyCity: e.target.value })}
            size="sm"
          />
          <Input
            label={t('invoices.settings.companyCountry')}
            value={form.companyCountry ?? ''}
            onChange={(e) => update({ companyCountry: e.target.value })}
            size="sm"
          />
        </div>
        <Input
          label={t('invoices.settings.companyPhone')}
          value={form.companyPhone ?? ''}
          onChange={(e) => update({ companyPhone: e.target.value })}
          size="sm"
        />
        <Input
          label={t('invoices.settings.companyEmail')}
          value={form.companyEmail ?? ''}
          onChange={(e) => update({ companyEmail: e.target.value })}
          size="sm"
        />
        <Input
          label={t('invoices.settings.companyWebsite')}
          value={form.companyWebsite ?? ''}
          onChange={(e) => update({ companyWebsite: e.target.value })}
          size="sm"
        />
        <Input
          label={t('invoices.settings.companyTaxId')}
          value={form.companyTaxId ?? ''}
          onChange={(e) => update({ companyTaxId: e.target.value })}
          size="sm"
        />
      </div>

      {/* Payment info */}
      <div style={sectionBoxStyle}>
        <span style={sectionLabelStyle}>{t('invoices.settings.payment')}</span>
        <Textarea
          label={t('invoices.settings.paymentInstructions')}
          value={form.paymentInstructions ?? ''}
          onChange={(e) => update({ paymentInstructions: e.target.value })}
          rows={3}
        />
        <Textarea
          label={t('invoices.settings.bankDetails')}
          value={form.bankDetails ?? ''}
          onChange={(e) => update({ bankDetails: e.target.value })}
          rows={3}
        />
      </div>

      {/* Footer */}
      <div style={sectionBoxStyle}>
        <span style={sectionLabelStyle}>{t('invoices.settings.footer')}</span>
        <Textarea
          label={t('invoices.settings.footerText')}
          value={form.footerText ?? ''}
          onChange={(e) => update({ footerText: e.target.value })}
          rows={2}
        />
      </div>

      {dirty && (
        <div>
          <Button variant="primary" size="sm" onClick={handleSave} disabled={updateSettings.isPending}>
            {t('common.save')}
          </Button>
        </div>
      )}
    </div>
  );
}
