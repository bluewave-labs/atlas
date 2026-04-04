import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Sparkles, Check, X, Loader2, Key, Trash2 } from 'lucide-react';
import { api } from '../../lib/api-client';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select } from '../ui/select';
import { Badge } from '../ui/badge';
import { IconButton } from '../ui/icon-button';
import { useToastStore } from '../../stores/toast-store';
import {
  SettingsSection,
  SettingsRow,
} from './settings-primitives';

const AI_PROVIDERS = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'openrouter', label: 'OpenRouter' },
];

interface AiSettings {
  enabled: boolean;
  provider: string;
  keys: Record<string, { hasKey: boolean; maskedKey: string | null }>;
}

function useAiSettings() {
  return useQuery({
    queryKey: ['settings', 'ai'],
    queryFn: async () => {
      const { data } = await api.get('/settings/ai');
      return data.data as AiSettings;
    },
    staleTime: 10_000,
  });
}

function useUpdateAiSettings() {
  const queryClient = useQueryClient();
  const { addToast } = useToastStore();
  return useMutation({
    mutationFn: async (input: { enabled?: boolean; provider?: string; apiKey?: { provider: string; key: string } }) => {
      await api.put('/settings/ai', input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'ai'] });
      addToast({ message: 'AI settings saved', type: 'success' });
    },
  });
}

function useRemoveAiKey() {
  const queryClient = useQueryClient();
  const { addToast } = useToastStore();
  return useMutation({
    mutationFn: async (provider: string) => {
      await api.delete(`/settings/ai/key/${provider}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'ai'] });
      addToast({ message: 'API key removed', type: 'success' });
    },
  });
}

function useTestAiKey() {
  return useMutation({
    mutationFn: async (input: { provider: string; apiKey: string }) => {
      const { data } = await api.post('/settings/ai/test', input);
      return data.data as { valid: boolean; error?: string };
    },
  });
}

function ProviderKeyRow({
  provider,
  label,
  hasKey,
  maskedKey,
  onSave,
  onRemove,
  onTest,
}: {
  provider: string;
  label: string;
  hasKey: boolean;
  maskedKey: string | null;
  onSave: (key: string) => void;
  onRemove: () => void;
  onTest: (key: string) => Promise<{ valid: boolean; error?: string }>;
}) {
  const [editing, setEditing] = useState(false);
  const [keyValue, setKeyValue] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ valid: boolean; error?: string } | null>(null);

  const handleSave = () => {
    if (!keyValue.trim()) return;
    onSave(keyValue.trim());
    setEditing(false);
    setKeyValue('');
    setTestResult(null);
  };

  const handleTest = async () => {
    if (!keyValue.trim()) return;
    setTesting(true);
    try {
      const result = await onTest(keyValue.trim());
      setTestResult(result);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)',
      padding: '8px var(--spacing-sm)',
      borderBottom: '1px solid var(--color-border-secondary)',
    }}>
      <span style={{
        width: 100, fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)',
        color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)',
      }}>
        {label}
      </span>

      {editing ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}>
          <Input
            value={keyValue}
            onChange={(e) => { setKeyValue(e.target.value); setTestResult(null); }}
            placeholder={`Enter ${label} API key`}
            size="sm"
            style={{ flex: 1 }}
            type="password"
            autoFocus
            onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') { setEditing(false); setKeyValue(''); } }}
          />
          <Button variant="ghost" size="sm" onClick={handleTest} disabled={!keyValue.trim() || testing}>
            {testing ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : 'Test'}
          </Button>
          {testResult && (
            testResult.valid
              ? <Badge variant="success">Valid</Badge>
              : <Badge variant="error">Invalid</Badge>
          )}
          <Button variant="primary" size="sm" onClick={handleSave} disabled={!keyValue.trim()}>Save</Button>
          <IconButton icon={<X size={13} />} label="Cancel" size={24} onClick={() => { setEditing(false); setKeyValue(''); setTestResult(null); }} />
        </div>
      ) : hasKey ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
          <code style={{
            fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)',
            fontFamily: 'monospace', background: 'var(--color-bg-tertiary)',
            padding: '2px 8px', borderRadius: 'var(--radius-sm)',
          }}>
            {maskedKey}
          </code>
          <Badge variant="success">Configured</Badge>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 'var(--spacing-xs)' }}>
            <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>Update</Button>
            <IconButton icon={<Trash2 size={13} />} label="Remove" size={24} destructive onClick={onRemove} />
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-family)' }}>
            Not configured
          </span>
          <Button variant="ghost" size="sm" icon={<Key size={13} />} onClick={() => setEditing(true)} style={{ marginLeft: 'auto' }}>
            Add key
          </Button>
        </div>
      )}
    </div>
  );
}

export function AiSettingsPanel() {
  const { data: settings, isLoading } = useAiSettings();
  const updateSettings = useUpdateAiSettings();
  const removeKey = useRemoveAiKey();
  const testKey = useTestAiKey();

  if (isLoading || !settings) {
    return <div style={{ padding: 'var(--spacing-xl)', color: 'var(--color-text-tertiary)' }}>Loading...</div>;
  }

  return (
    <div>
      <SettingsSection title="AI configuration" description="Configure AI providers to enable enrichment, writing assistance, and other AI features.">
        <SettingsRow label="Enable AI features" description="Allow AI features across the platform">
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={settings.enabled}
              onChange={(e) => updateSettings.mutate({ enabled: e.target.checked })}
              style={{ width: 16, height: 16, accentColor: 'var(--color-accent-primary)' }}
            />
            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)' }}>
              {settings.enabled ? 'Enabled' : 'Disabled'}
            </span>
          </label>
        </SettingsRow>

        <SettingsRow label="Default provider" description="Provider used for AI features when no specific provider is requested">
          <Select
            value={settings.provider}
            onChange={(v) => updateSettings.mutate({ provider: v })}
            options={AI_PROVIDERS}
            size="sm"
            width={180}
          />
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title="API keys" description="Add API keys for each provider you want to use. Keys are encrypted at rest.">
        {AI_PROVIDERS.map((p) => {
          const keyInfo = settings.keys[p.value] || { hasKey: false, maskedKey: null };
          return (
            <ProviderKeyRow
              key={p.value}
              provider={p.value}
              label={p.label}
              hasKey={keyInfo.hasKey}
              maskedKey={keyInfo.maskedKey}
              onSave={(key) => updateSettings.mutate({ apiKey: { provider: p.value, key } })}
              onRemove={() => removeKey.mutate(p.value)}
              onTest={async (key) => {
                const result = await testKey.mutateAsync({ provider: p.value, apiKey: key });
                return result;
              }}
            />
          );
        })}
      </SettingsSection>
    </div>
  );
}
