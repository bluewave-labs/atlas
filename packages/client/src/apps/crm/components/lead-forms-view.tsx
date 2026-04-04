import { useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Plus, Copy, Trash2, Check, Globe, ToggleLeft, ToggleRight, FileText,
  ChevronUp, ChevronDown, ArrowLeft, Type, Mail, Phone,
  AlignLeft, ListFilter, Eye,
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Textarea } from '../../../components/ui/textarea';
import { Select } from '../../../components/ui/select';
import { Modal } from '../../../components/ui/modal';
import { Badge } from '../../../components/ui/badge';
import { IconButton } from '../../../components/ui/icon-button';
import { ConfirmDialog } from '../../../components/ui/confirm-dialog';
import { useToastStore } from '../../../stores/toast-store';
import {
  useLeadForms, useCreateLeadForm, useUpdateLeadForm, useDeleteLeadForm,
  type CrmLeadForm, type LeadFormField, type LeadFormFieldType,
} from '../hooks';

// ─── Constants ──────────────────────────────────────────────────────

const FIELD_TYPE_OPTIONS: { value: LeadFormFieldType; label: string; icon: typeof Type }[] = [
  { value: 'text', label: 'Text', icon: Type },
  { value: 'email', label: 'Email', icon: Mail },
  { value: 'phone', label: 'Phone', icon: Phone },
  { value: 'textarea', label: 'Long text', icon: AlignLeft },
  { value: 'select', label: 'Dropdown', icon: ListFilter },
];

const MAP_TO_OPTIONS = [
  { value: '', label: 'None' },
  { value: 'name', label: 'Lead name' },
  { value: 'email', label: 'Lead email' },
  { value: 'phone', label: 'Lead phone' },
  { value: 'companyName', label: 'Company name' },
  { value: 'message', label: 'Notes / message' },
];

function generateId(): string {
  return 'f' + Math.random().toString(36).slice(2, 10);
}

// ─── Helpers ────────────────────────────────────────────────────────

function getServerUrl(): string {
  return import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:3001`;
}

function generateEmbedCode(form: CrmLeadForm): string {
  const serverUrl = getServerUrl();
  const url = `${serverUrl}/api/v1/crm/forms/public/${form.token}`;

  const fieldHtml = form.fields.map((field) => {
    const req = field.required ? ' required' : '';
    const star = field.required ? ' <span style="color:#ef4444">*</span>' : '';
    const label = `    <label style="display:block;margin-bottom:4px;font-size:14px;font-weight:500;color:#111318">${field.label}${star}</label>`;
    const inputStyle = 'width:100%;padding:8px 12px;border:1px solid #d0d5dd;border-radius:6px;font-size:14px;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,sans-serif;box-sizing:border-box;outline:none;background:#fff;color:#111318';
    let input: string;
    switch (field.type) {
      case 'textarea':
        input = `    <textarea name="${field.id}" placeholder="${field.placeholder}" rows="4" style="${inputStyle};resize:vertical"${req}></textarea>`;
        break;
      case 'select':
        input = `    <select name="${field.id}" style="${inputStyle};appearance:auto"${req}>\n      <option value="">${field.placeholder || 'Select...'}</option>\n${(field.options || []).map(o => `      <option value="${o}">${o}</option>`).join('\n')}\n    </select>`;
        break;
      default:
        input = `    <input name="${field.id}" type="${field.type === 'email' ? 'email' : 'text'}" placeholder="${field.placeholder}" style="${inputStyle}"${req} />`;
        break;
    }
    return `  <div style="margin-bottom:16px">\n${label}\n${input}\n  </div>`;
  });

  return `<div style="max-width:480px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<form action="${url}" method="POST" style="padding:32px;border:1px solid #e4e7ec;border-radius:12px;background:#fff">
  <h3 style="margin:0 0 24px 0;font-size:18px;font-weight:600;color:#111318">${form.name}</h3>
${fieldHtml.join('\n')}
  <button type="submit" style="padding:8px 20px;background:#13715B;color:#fff;border:none;border-radius:6px;font-size:14px;font-weight:500;cursor:pointer;font-family:inherit">Submit</button>
</form>
</div>`;
}

function getFieldTypeIcon(type: LeadFormFieldType) {
  switch (type) {
    case 'email': return <Mail size={14} />;
    case 'phone': return <Phone size={14} />;
    case 'textarea': return <AlignLeft size={14} />;
    case 'select': return <ListFilter size={14} />;
    default: return <Type size={14} />;
  }
}

// ─── Field Editor Panel ─────────────────────────────────────────────

function FieldEditorPanel({
  field, onChange, onDelete, onMoveUp, onMoveDown, isFirst, isLast,
}: {
  field: LeadFormField;
  onChange: (updated: LeadFormField) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  return (
    <div style={{
      border: '1px solid var(--color-border-primary)',
      borderRadius: 'var(--radius-md)',
      background: 'var(--color-bg-primary)',
      padding: 'var(--spacing-md)',
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--spacing-sm)',
    }}>
      {/* Header with type icon, label, and actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
        <span style={{ color: 'var(--color-text-tertiary)', display: 'flex', flexShrink: 0 }}>
          {getFieldTypeIcon(field.type)}
        </span>
        <Input
          value={field.label}
          onChange={(e) => onChange({ ...field, label: e.target.value })}
          size="sm"
          style={{ flex: 1, fontWeight: 500 }}
          placeholder="Field label"
        />
        <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
          <IconButton icon={<ChevronUp size={12} />} label="Move up" size={22} onClick={onMoveUp} style={{ opacity: isFirst ? 0.3 : 1 }} />
          <IconButton icon={<ChevronDown size={12} />} label="Move down" size={22} onClick={onMoveDown} style={{ opacity: isLast ? 0.3 : 1 }} />
          <IconButton icon={<Trash2 size={12} />} label="Delete field" size={22} destructive onClick={onDelete} />
        </div>
      </div>

      {/* Settings row */}
      <div style={{ display: 'flex', gap: 'var(--spacing-sm)', alignItems: 'flex-end' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <label style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-family)' }}>Type</label>
          <Select
            value={field.type}
            onChange={(v) => onChange({ ...field, type: v as LeadFormFieldType })}
            options={FIELD_TYPE_OPTIONS.map(o => ({ value: o.value, label: o.label }))}
            size="sm"
          />
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <label style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-family)' }}>Placeholder</label>
          <Input
            value={field.placeholder}
            onChange={(e) => onChange({ ...field, placeholder: e.target.value })}
            size="sm"
            placeholder="Placeholder text"
          />
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <label style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-family)' }}>Maps to</label>
          <Select
            value={field.mapTo || ''}
            onChange={(v) => onChange({ ...field, mapTo: v || undefined })}
            options={MAP_TO_OPTIONS}
            size="sm"
          />
        </div>
        <label style={{
          display: 'flex', alignItems: 'center', gap: 4,
          fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)',
          fontFamily: 'var(--font-family)', whiteSpace: 'nowrap', cursor: 'pointer',
          paddingBottom: 4,
        }}>
          <input
            type="checkbox"
            checked={field.required}
            onChange={(e) => onChange({ ...field, required: e.target.checked })}
          />
          Required
        </label>
      </div>

      {/* Options for select type */}
      {field.type === 'select' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
          <label style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-family)' }}>Options (one per line)</label>
          <Textarea
            value={(field.options || []).join('\n')}
            onChange={(e) => onChange({ ...field, options: e.target.value.split('\n').filter(Boolean) })}
            rows={3}
            placeholder="Option 1\nOption 2\nOption 3"
          />
        </div>
      )}
    </div>
  );
}

// ─── Form Editor ────────────────────────────────────────────────────

function FormEditor({
  form, onBack,
}: {
  form: CrmLeadForm;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const { addToast } = useToastStore();
  const updateForm = useUpdateLeadForm();
  const [fields, setFields] = useState<LeadFormField[]>(form.fields);
  const [formName, setFormName] = useState(form.name);
  const [hasChanges, setHasChanges] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showEmbedModal, setShowEmbedModal] = useState(false);
  const [copied, setCopied] = useState(false);

  const updateField = useCallback((index: number, updated: LeadFormField) => {
    setFields(prev => {
      const next = [...prev];
      next[index] = updated;
      return next;
    });
    setHasChanges(true);
  }, []);

  const addField = useCallback((type: LeadFormFieldType) => {
    const id = generateId();
    const typeConfig = FIELD_TYPE_OPTIONS.find(o => o.value === type);
    setFields(prev => [...prev, {
      id,
      type,
      label: typeConfig?.label || 'New field',
      placeholder: '',
      required: false,
    }]);
    setHasChanges(true);
  }, []);

  const deleteField = useCallback((index: number) => {
    setFields(prev => prev.filter((_, i) => i !== index));
    setHasChanges(true);
  }, []);

  const moveField = useCallback((index: number, direction: -1 | 1) => {
    setFields(prev => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    setHasChanges(true);
  }, []);

  const handleSave = useCallback(() => {
    updateForm.mutate({ id: form.id, name: formName, fields }, {
      onSuccess: () => {
        setHasChanges(false);
        addToast({ message: t('crm.leadForms.formSaved'), type: 'success' });
      },
    });
  }, [form.id, formName, fields, updateForm, addToast, t]);

  const handleCopyEmbed = useCallback(async () => {
    const updatedForm = { ...form, fields, name: formName };
    const code = generateEmbedCode(updatedForm);
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = code;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopied(true);
    addToast({ message: t('crm.leadForms.codeCopied'), type: 'success' });
    setTimeout(() => setCopied(false), 2000);
  }, [form, fields, formName, addToast, t]);

  // For preview
  const previewForm = useMemo(() => ({ ...form, fields, name: formName }), [form, fields, formName]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)',
        padding: 'var(--spacing-md) var(--spacing-xl)',
        borderBottom: '1px solid var(--color-border-secondary)',
        flexShrink: 0,
      }}>
        <IconButton icon={<ArrowLeft size={16} />} label="Back" size={28} onClick={onBack} />
        <Input
          value={formName}
          onChange={(e) => { setFormName(e.target.value); setHasChanges(true); }}
          size="sm"
          style={{ flex: 1, maxWidth: 300, fontWeight: 600 }}
        />
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 'var(--spacing-sm)', alignItems: 'center' }}>
          {hasChanges && (
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-warning)', fontFamily: 'var(--font-family)' }}>
              Unsaved changes
            </span>
          )}
          <Button variant="ghost" size="sm" icon={<Eye size={13} />} onClick={() => setShowPreview(!showPreview)}>
            {showPreview ? 'Editor' : 'Preview'}
          </Button>
          <Button variant="ghost" size="sm" icon={<Copy size={13} />} onClick={() => setShowEmbedModal(true)}>
            Embed
          </Button>
          <Button variant="primary" size="sm" onClick={handleSave} disabled={!hasChanges}>
            {t('crm.actions.save')}
          </Button>
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, overflow: 'auto', padding: 'var(--spacing-xl)' }}>
        {showPreview ? (
          /* Preview mode */
          <div style={{ maxWidth: 480, margin: '0 auto' }}>
            <div style={{
              border: '1px solid var(--color-border-primary)',
              borderRadius: 'var(--radius-lg)',
              padding: 'var(--spacing-xl)',
              background: 'var(--color-bg-primary)',
            }}>
              <h3 style={{
                fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)',
                color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)',
                margin: '0 0 var(--spacing-lg) 0',
              }}>
                {formName}
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                {fields.map((field) => (
                  <div key={field.id} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <label style={{
                      fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)',
                      color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)',
                    }}>
                      {field.label} {field.required && <span style={{ color: 'var(--color-error)' }}>*</span>}
                    </label>
                    {field.type === 'textarea' ? (
                      <Textarea placeholder={field.placeholder} rows={3} disabled />
                    ) : field.type === 'select' ? (
                      <Select
                        value=""
                        onChange={() => {}}
                        options={[
                          { value: '', label: field.placeholder || 'Select...' },
                          ...(field.options || []).map(o => ({ value: o, label: o })),
                        ]}
                        size="sm"
                      />
                    ) : (
                      <Input
                        placeholder={field.placeholder}
                        type={field.type === 'email' ? 'email' : 'text'}
                        size="sm"
                        disabled
                      />
                    )}
                  </div>
                ))}
                <Button variant="primary" size="sm" disabled style={{ alignSelf: 'flex-start', marginTop: 'var(--spacing-sm)' }}>
                  Submit
                </Button>
              </div>
            </div>
          </div>
        ) : (
          /* Editor mode */
          <div style={{ maxWidth: 640, margin: '0 auto' }}>
            {/* Field list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-lg)' }}>
              {fields.length === 0 && (
                <div style={{
                  textAlign: 'center', padding: 'var(--spacing-2xl)',
                  color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-family)',
                  border: '2px dashed var(--color-border-secondary)',
                  borderRadius: 'var(--radius-lg)',
                }}>
                  <Type size={32} style={{ marginBottom: 'var(--spacing-sm)', opacity: 0.3 }} />
                  <p style={{ fontSize: 'var(--font-size-sm)', margin: 0 }}>
                    No fields yet. Add a field below to get started.
                  </p>
                </div>
              )}
              {fields.map((field, i) => (
                <FieldEditorPanel
                  key={field.id}
                  field={field}
                  onChange={(updated) => updateField(i, updated)}
                  onDelete={() => deleteField(i)}
                  onMoveUp={() => moveField(i, -1)}
                  onMoveDown={() => moveField(i, 1)}
                  isFirst={i === 0}
                  isLast={i === fields.length - 1}
                />
              ))}
            </div>

            {/* Add field buttons */}
            <div style={{
              display: 'flex', gap: 'var(--spacing-sm)', flexWrap: 'wrap',
              padding: 'var(--spacing-md)',
              border: '1px dashed var(--color-border-secondary)',
              borderRadius: 'var(--radius-md)',
            }}>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-family)', width: '100%', marginBottom: 2 }}>
                Add field
              </span>
              {FIELD_TYPE_OPTIONS.map(opt => {
                const Icon = opt.icon;
                return (
                  <Button key={opt.value} variant="secondary" size="sm" icon={<Icon size={13} />} onClick={() => addField(opt.value)}>
                    {opt.label}
                  </Button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Embed code modal */}
      <Modal open={showEmbedModal} onOpenChange={setShowEmbedModal} width={560} title={t('crm.leadForms.embedCode')}>
        <Modal.Header title={t('crm.leadForms.embedCode')} />
        <Modal.Body>
          <p style={{
            fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)',
            fontFamily: 'var(--font-family)', marginBottom: 'var(--spacing-md)', marginTop: 0,
          }}>
            {t('crm.leadForms.embedInstructions')}
          </p>
          <pre style={{
            background: 'var(--color-bg-tertiary)', padding: 'var(--spacing-md)',
            borderRadius: 'var(--radius-md)', fontSize: 'var(--font-size-xs)',
            fontFamily: 'monospace', overflow: 'auto', maxHeight: 300,
            color: 'var(--color-text-primary)', border: '1px solid var(--color-border-secondary)',
            whiteSpace: 'pre-wrap', wordBreak: 'break-all',
          }}>
            {generateEmbedCode(previewForm)}
          </pre>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="ghost" onClick={() => setShowEmbedModal(false)}>{t('common.close')}</Button>
          <Button
            variant="primary"
            icon={copied ? <Check size={14} /> : <Copy size={14} />}
            onClick={handleCopyEmbed}
          >
            {copied ? t('crm.leadForms.copied') : t('crm.leadForms.copyCode')}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}

// ─── LeadFormsView component ────────────────────────────────────────

export function LeadFormsView() {
  const { t } = useTranslation();
  const { addToast } = useToastStore();
  const { data: formsData, isLoading } = useLeadForms();
  const createForm = useCreateLeadForm();
  const updateForm = useUpdateLeadForm();
  const deleteForm = useDeleteLeadForm();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formName, setFormName] = useState('');
  const [editingFormId, setEditingFormId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const forms = formsData?.forms ?? [];
  const editingForm = editingFormId ? forms.find(f => f.id === editingFormId) : null;

  const handleCreate = useCallback(() => {
    if (!formName.trim()) return;
    createForm.mutate({ name: formName.trim() }, {
      onSuccess: (form) => {
        setFormName('');
        setShowCreateModal(false);
        setEditingFormId(form.id);
      },
    });
  }, [formName, createForm]);

  const handleToggleActive = useCallback((form: CrmLeadForm) => {
    updateForm.mutate({ id: form.id, isActive: !form.isActive });
  }, [updateForm]);

  const handleDelete = useCallback((id: string) => {
    deleteForm.mutate(id);
    setDeleteConfirm(null);
  }, [deleteForm]);

  const handleCopyEmbed = useCallback(async (form: CrmLeadForm) => {
    const code = generateEmbedCode(form);
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = code;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    addToast({ message: t('crm.leadForms.codeCopied'), type: 'success' });
  }, [addToast, t]);

  if (isLoading) {
    return (
      <div style={{ padding: 'var(--spacing-xl)', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-family)' }}>
        {t('common.loading')}...
      </div>
    );
  }

  // If editing a form, show the editor
  if (editingForm) {
    return <FormEditor form={editingForm} onBack={() => setEditingFormId(null)} />;
  }

  return (
    <div style={{ padding: 'var(--spacing-xl)', overflow: 'auto', flex: 1 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-xl)' }}>
        <div>
          <h2 style={{
            fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-semibold)',
            color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)',
            margin: 0,
          }}>
            {t('crm.leadForms.title')}
          </h2>
          <p style={{
            fontSize: 'var(--font-size-sm)', color: 'var(--color-text-tertiary)',
            fontFamily: 'var(--font-family)', margin: '4px 0 0 0',
          }}>
            {t('crm.leadForms.subtitle')}
          </p>
        </div>
        <Button variant="primary" size="sm" icon={<Plus size={14} />} onClick={() => setShowCreateModal(true)}>
          {t('crm.leadForms.createForm')}
        </Button>
      </div>

      {/* Forms list */}
      {forms.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: 'var(--spacing-2xl)',
          color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-family)',
        }}>
          <Globe size={40} style={{ marginBottom: 'var(--spacing-md)', opacity: 0.4 }} />
          <p style={{ fontSize: 'var(--font-size-md)', fontWeight: 'var(--font-weight-medium)' }}>
            {t('crm.leadForms.noForms')}
          </p>
          <p style={{ fontSize: 'var(--font-size-sm)' }}>
            {t('crm.leadForms.noFormsDesc')}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
          {forms.map((form) => (
            <div
              key={form.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)',
                padding: 'var(--spacing-md) var(--spacing-lg)',
                border: '1px solid var(--color-border-secondary)',
                borderRadius: 'var(--radius-lg)', background: 'var(--color-bg-primary)',
                fontFamily: 'var(--font-family)', cursor: 'pointer',
                transition: 'border-color 0.1s',
              }}
              onClick={() => setEditingFormId(form.id)}
              onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--color-border-primary)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--color-border-secondary)'; }}
            >
              <FileText size={18} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} />

              {/* Name & info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)',
                  color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {form.name}
                </div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', marginTop: 2 }}>
                  {form.fields.length} {form.fields.length === 1 ? 'field' : 'fields'} &middot; {t('crm.leadForms.submissions', { count: form.submitCount })}
                </div>
              </div>

              {/* Status badge */}
              <Badge variant={form.isActive ? 'success' : 'default'}>
                {form.isActive ? t('crm.leadForms.active') : t('crm.leadForms.inactive')}
              </Badge>

              {/* Toggle active */}
              <IconButton
                icon={form.isActive ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                label={form.isActive ? t('crm.leadForms.deactivate') : t('crm.leadForms.activate')}
                size={28}
                onClick={(e) => { e.stopPropagation(); handleToggleActive(form); }}
                style={{ color: form.isActive ? 'var(--color-success)' : 'var(--color-text-tertiary)' }}
              />

              {/* Copy embed code */}
              <Button variant="ghost" size="sm" icon={<Copy size={13} />} onClick={(e) => { e.stopPropagation(); handleCopyEmbed(form); }}>
                {t('crm.leadForms.embedCode')}
              </Button>

              {/* Delete */}
              <IconButton
                icon={<Trash2 size={14} />}
                label={t('common.delete')}
                size={28}
                destructive
                onClick={(e) => { e.stopPropagation(); setDeleteConfirm(form.id); }}
              />
            </div>
          ))}
        </div>
      )}

      {/* Create form modal */}
      <Modal open={showCreateModal} onOpenChange={setShowCreateModal} width={400} title={t('crm.leadForms.createForm')}>
        <Modal.Header title={t('crm.leadForms.createForm')} />
        <Modal.Body>
          <Input
            label={t('crm.leadForms.formName')}
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            placeholder={t('crm.leadForms.formNamePlaceholder')}
            autoFocus
            onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
          />
        </Modal.Body>
        <Modal.Footer>
          <Button variant="ghost" onClick={() => { setShowCreateModal(false); setFormName(''); }}>{t('common.cancel')}</Button>
          <Button variant="primary" onClick={handleCreate} disabled={!formName.trim()}>{t('crm.leadForms.create')}</Button>
        </Modal.Footer>
      </Modal>

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!deleteConfirm}
        onOpenChange={(open) => { if (!open) setDeleteConfirm(null); }}
        title={t('crm.leadForms.deleteForm')}
        description={t('crm.leadForms.deleteFormDesc')}
        confirmLabel={t('common.delete')}
        onConfirm={() => deleteConfirm && handleDelete(deleteConfirm)}
      />
    </div>
  );
}
