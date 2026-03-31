import React, { type CSSProperties, useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api-client';
import { queryKeys } from '../../config/query-keys';
import { SettingsSection, SettingsRow, SettingsToggle } from '../settings/settings-primitives';
import { Input } from '../ui/input';
import { Chip } from '../ui/chip';
import { widgetRegistry } from './widgets/registry';
import { appRegistry } from '../../config/app-registry';

type BgType = 'unsplash' | 'solid' | 'gradient' | 'custom';

// Wallpaper photos (same as home.tsx BG_IMAGES — thumbnail versions)
const WALLPAPER_PHOTOS = [
  { url: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1920&q=80&auto=format&fit=crop', thumb: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=120&h=80&q=60&fit=crop', label: 'Forest path' },
  { url: 'https://images.unsplash.com/photo-1511497584788-876760111969?w=1920&q=80&auto=format&fit=crop', thumb: 'https://images.unsplash.com/photo-1511497584788-876760111969?w=120&h=80&q=60&fit=crop', label: 'Misty pines' },
  { url: 'https://images.unsplash.com/photo-1448375240586-882707db888b?w=1920&q=80&auto=format&fit=crop', thumb: 'https://images.unsplash.com/photo-1448375240586-882707db888b?w=120&h=80&q=60&fit=crop', label: 'Tropical forest' },
  { url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1920&q=80&auto=format&fit=crop', thumb: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=120&h=80&q=60&fit=crop', label: 'Mountain range' },
  { url: 'https://images.unsplash.com/photo-1518818419601-72c8673f5852?w=1920&q=80&auto=format&fit=crop', thumb: 'https://images.unsplash.com/photo-1518818419601-72c8673f5852?w=120&h=80&q=60&fit=crop', label: 'Dark forest' },
  { url: 'https://images.unsplash.com/photo-1507041957456-9c397ce39c97?w=1920&q=80&auto=format&fit=crop', thumb: 'https://images.unsplash.com/photo-1507041957456-9c397ce39c97?w=120&h=80&q=60&fit=crop', label: 'Autumn forest' },
  { url: 'https://images.unsplash.com/photo-1534088568595-a066f410bcda?w=1920&q=80&auto=format&fit=crop', thumb: 'https://images.unsplash.com/photo-1534088568595-a066f410bcda?w=120&h=80&q=60&fit=crop', label: 'Night sky' },
  { url: 'https://images.unsplash.com/photo-1483347756197-71ef80e95f73?w=1920&q=80&auto=format&fit=crop', thumb: 'https://images.unsplash.com/photo-1483347756197-71ef80e95f73?w=120&h=80&q=60&fit=crop', label: 'Northern lights' },
  { url: 'https://images.unsplash.com/photo-1532274402911-5a369e4c4bb5?w=1920&q=80&auto=format&fit=crop', thumb: 'https://images.unsplash.com/photo-1532274402911-5a369e4c4bb5?w=120&h=80&q=60&fit=crop', label: 'Mountain sunset' },
  { url: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=1920&q=80&auto=format&fit=crop', thumb: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=120&h=80&q=60&fit=crop', label: 'Snowy peaks at night' },
  { url: 'https://images.unsplash.com/photo-1509773896068-7fd415d91e2e?w=1920&q=80&auto=format&fit=crop', thumb: 'https://images.unsplash.com/photo-1509773896068-7fd415d91e2e?w=120&h=80&q=60&fit=crop', label: 'Starry lake' },
  { url: 'https://images.unsplash.com/photo-1462275646964-a0e3c11f18a6?w=1920&q=80&auto=format&fit=crop', thumb: 'https://images.unsplash.com/photo-1462275646964-a0e3c11f18a6?w=120&h=80&q=60&fit=crop', label: 'Twilight canyon' },
];

// Only dark colors that ensure white text readability
const SOLID_COLORS = [
  '#1a1a2e', '#16213e', '#0f3460', '#533483',
  '#2c3e50', '#1b4332', '#3d348b', '#264653',
  '#283618', '#1e293b', '#18181b', '#1c1917',
  '#1e1b4b', '#172554', '#14532d', '#4c1d95',
  '#7c2d12', '#78350f', '#312e81', '#0c4a6e',
];

// Only dark gradients that ensure white text readability
const GRADIENTS = [
  'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  'linear-gradient(135deg, #0c0c1d 0%, #1a1a3e 50%, #2d1b69 100%)',
  'linear-gradient(135deg, #232526 0%, #414345 100%)',
  'linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)',
  'linear-gradient(135deg, #1a2a6c 0%, #b21f1f 50%, #fdbb2d 100%)',
  'linear-gradient(135deg, #141e30 0%, #243b55 100%)',
  'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)',
  'linear-gradient(135deg, #000428 0%, #004e92 100%)',
  'linear-gradient(135deg, #1f1c2c 0%, #928dab 100%)',
  'linear-gradient(135deg, #2c3e50 0%, #4ca1af 100%)',
  'linear-gradient(135deg, #373b44 0%, #4286f4 100%)',
  'linear-gradient(135deg, #0f0c29 0%, #6a0572 100%)',
];

const swatch: CSSProperties = {
  width: 40,
  height: 40,
  borderRadius: 'var(--radius-lg)',
  cursor: 'pointer',
  border: '2px solid transparent',
  transition: 'border-color 0.15s, transform 0.15s',
  flexShrink: 0,
};

const selectedSwatch: CSSProperties = {
  ...swatch,
  borderColor: 'var(--color-accent-primary)',
  transform: 'scale(1.1)',
};

export function HomeBackgroundPanel() {
  const queryClient = useQueryClient();

  const { data: settings } = useQuery({
    queryKey: queryKeys.settings.all,
    queryFn: async () => {
      const { data } = await api.get('/settings');
      return data.data as Record<string, unknown> | null;
    },
    staleTime: 60_000,
  });

  const bgType = (settings?.homeBgType as BgType) || 'unsplash';
  const bgValue = (settings?.homeBgValue as string) || '';

  const [customHex, setCustomHex] = useState('');

  const mutation = useMutation({
    mutationFn: async (payload: { homeBgType: BgType; homeBgValue: string | null }) => {
      await api.put('/settings', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.settings.all });
    },
  });

  const setBg = (type: BgType, value: string | null) => {
    mutation.mutate({ homeBgType: type, homeBgValue: value });
  };

  const typeOptions: Array<{ value: BgType; label: string; desc: string }> = [
    { value: 'unsplash', label: 'Photo', desc: 'Choose a wallpaper from curated photos' },
    { value: 'solid', label: 'Solid color', desc: 'Dark colors curated for readability' },
    { value: 'gradient', label: 'Gradient', desc: 'Dark gradients curated for readability' },
  ];

  return (
    <div>
      <SettingsSection title="Background type" description="Choose what appears behind the home screen">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {typeOptions.map((opt) => {
            const isActive = bgType === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => {
                  if (opt.value === 'unsplash') setBg('unsplash', null);
                  else if (opt.value === 'solid') setBg('solid', SOLID_COLORS[0]);
                  else if (opt.value === 'gradient') setBg('gradient', GRADIENTS[0]);
                  else if (opt.value === 'custom') setBg('custom', '#1a1a2e');
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 14px',
                  background: isActive ? 'var(--color-bg-tertiary)' : 'transparent',
                  border: isActive ? '1px solid var(--color-accent-primary)' : '1px solid var(--color-border-secondary)',
                  borderRadius: 'var(--radius-lg)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontFamily: 'var(--font-family)',
                  transition: 'all 0.15s',
                }}
              >
                <div
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: '50%',
                    border: isActive ? '5px solid var(--color-accent-primary)' : '2px solid var(--color-border-primary)',
                    flexShrink: 0,
                    boxSizing: 'border-box',
                  }}
                />
                <div>
                  <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500, color: 'var(--color-text-primary)' }}>
                    {opt.label}
                  </div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', marginTop: 1 }}>
                    {opt.desc}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </SettingsSection>

      {bgType === 'unsplash' && (
        <SettingsSection title="Choose a wallpaper" description="Select a photo for your home screen">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {WALLPAPER_PHOTOS.map((photo) => (
              <div
                key={photo.url}
                onClick={() => setBg('unsplash', photo.url)}
                title={photo.label}
                style={{
                  width: 80,
                  height: 56,
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  border: bgValue === photo.url ? '2px solid var(--color-accent-primary)' : '2px solid transparent',
                  backgroundImage: `url(${photo.thumb})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  flexShrink: 0,
                  transition: 'border-color 0.15s',
                }}
              />
            ))}
          </div>
        </SettingsSection>
      )}

      {bgType === 'solid' && (
        <SettingsSection title="Pick a color" description="Select a background color for the home screen">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {SOLID_COLORS.map((color) => (
              <div
                key={color}
                onClick={() => setBg('solid', color)}
                style={{
                  ...(bgValue === color ? selectedSwatch : swatch),
                  backgroundColor: color,
                }}
              />
            ))}
          </div>
        </SettingsSection>
      )}

      {bgType === 'gradient' && (
        <SettingsSection title="Pick a gradient" description="Select a gradient for the home screen">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {GRADIENTS.map((grad) => (
              <div
                key={grad}
                onClick={() => setBg('gradient', grad)}
                style={{
                  ...(bgValue === grad ? selectedSwatch : swatch),
                  background: grad,
                }}
              />
            ))}
          </div>
        </SettingsSection>
      )}

      {bgType === 'custom' && (
        <SettingsSection title="Custom color" description="Enter a hex color code">
          <SettingsRow label="Hex color" description="e.g. #1a1a2e or #f5f5f5">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: bgValue || '#000000',
                  border: '1px solid var(--color-border-secondary)',
                  flexShrink: 0,
                }}
              />
              <Input
                type="text"
                value={customHex || bgValue || ''}
                onChange={(e) => setCustomHex(e.target.value)}
                onBlur={() => {
                  const hex = customHex.trim();
                  if (/^#[0-9a-fA-F]{3,8}$/.test(hex)) {
                    setBg('custom', hex);
                  }
                  setCustomHex('');
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const hex = customHex.trim();
                    if (/^#[0-9a-fA-F]{3,8}$/.test(hex)) {
                      setBg('custom', hex);
                    }
                    setCustomHex('');
                  }
                }}
                placeholder="#1a1a2e"
                style={{
                  width: 120,
                  height: 32,
                  fontFamily: 'var(--font-mono)',
                  fontSize: 'var(--font-size-sm)',
                }}
              />
            </div>
          </SettingsRow>
        </SettingsSection>
      )}

      <SettingsSection title="Clock" description="Configure the home screen clock display">
        <SettingsRow label="Show seconds" description="Display seconds on the clock">
          <SettingsToggle
            checked={!!(settings?.homeShowSeconds)}
            onChange={(val) => {
              mutation.mutate({ homeShowSeconds: val } as any);
              queryClient.setQueryData(queryKeys.settings.all, (old: any) => old ? { ...old, homeShowSeconds: val } : old);
            }}
            label="Show seconds"
          />
        </SettingsRow>
      </SettingsSection>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Widgets settings panel
// ---------------------------------------------------------------------------

export function HomeWidgetsPanel() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const { data: settings } = useQuery({
    queryKey: queryKeys.settings.all,
    queryFn: async () => {
      const { data } = await api.get('/settings');
      return data.data as Record<string, unknown> | null;
    },
    staleTime: 60_000,
  });

  const enabledIds = useMemo(() => {
    const raw = settings?.homeEnabledWidgets;
    if (Array.isArray(raw)) return raw as string[];
    if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed as string[];
      } catch { /* ignore */ }
    }
    return null;
  }, [settings]);

  const isEnabled = (widgetId: string): boolean => {
    if (enabledIds === null) {
      return widgetRegistry.find((w) => w.id === widgetId)?.defaultEnabled ?? false;
    }
    return enabledIds.includes(widgetId);
  };

  const mutation = useMutation({
    mutationFn: async (ids: string[]) => {
      await api.put('/settings', { homeEnabledWidgets: ids });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.settings.all });
    },
  });

  const toggle = (widgetId: string) => {
    const currentIds = enabledIds ?? widgetRegistry.filter((w) => w.defaultEnabled).map((w) => w.id);
    const next = isEnabled(widgetId)
      ? currentIds.filter((id) => id !== widgetId)
      : [...currentIds, widgetId];
    mutation.mutate(next);
  };

  // App widgets
  const allAppWidgets = useMemo(() => appRegistry.getAllWidgets(), []);
  const appWidgetsByApp = useMemo(() => {
    const grouped = new Map<string, typeof allAppWidgets>();
    for (const w of allAppWidgets) {
      const list = grouped.get(w.appId) ?? [];
      list.push(w);
      grouped.set(w.appId, list);
    }
    return grouped;
  }, [allAppWidgets]);

  const isAppWidgetEnabled = (appId: string, widgetId: string): boolean => {
    const key = `${appId}:${widgetId}`;
    if (enabledIds === null) {
      return allAppWidgets.find((w) => w.appId === appId && w.id === widgetId)?.defaultEnabled ?? false;
    }
    return enabledIds.includes(key);
  };

  const toggleAppWidget = (appId: string, widgetId: string) => {
    const key = `${appId}:${widgetId}`;
    const currentIds = enabledIds ?? [
      ...widgetRegistry.filter((w) => w.defaultEnabled).map((w) => w.id),
      ...allAppWidgets.filter((w) => w.defaultEnabled).map((w) => `${w.appId}:${w.id}`),
    ];
    const next = currentIds.includes(key)
      ? currentIds.filter((id) => id !== key)
      : [...currentIds, key];
    mutation.mutate(next);
  };

  return (
    <div>
      <SettingsSection title={t('widgets.homeWidgets')} description={t('widgets.homeWidgetsDesc')}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {widgetRegistry.map((widget) => {
            const Icon = widget.icon;
            return (
              <div
                key={widget.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--color-border-secondary)',
                  background: isEnabled(widget.id) ? 'var(--color-bg-tertiary)' : 'transparent',
                  transition: 'background 0.15s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Icon size={16} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500, color: 'var(--color-text-primary)' }}>
                      {widget.name}
                    </div>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', marginTop: 1 }}>
                      {widget.description}
                    </div>
                  </div>
                </div>
                <SettingsToggle
                  checked={isEnabled(widget.id)}
                  onChange={() => toggle(widget.id)}
                  label={widget.name}
                />
              </div>
            );
          })}
        </div>
      </SettingsSection>

      {appWidgetsByApp.size > 0 && (
        <SettingsSection title={t('widgets.appWidgets')} description={t('widgets.appWidgetsDesc')}>
          {Array.from(appWidgetsByApp.entries()).map(([appId, widgets]) => (
            <div key={appId} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <Chip color={widgets[0].appColor} height={20}>
                  {widgets[0].appName}
                </Chip>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {widgets.map((widget) => {
                  const Icon = widget.icon;
                  return (
                    <div
                      key={widget.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--color-border-secondary)',
                        background: isAppWidgetEnabled(appId, widget.id) ? 'var(--color-bg-tertiary)' : 'transparent',
                        transition: 'background 0.15s',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Icon size={14} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} />
                        <div>
                          <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500, color: 'var(--color-text-primary)' }}>
                            {widget.name}
                          </div>
                          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>
                            {widget.description}
                          </div>
                        </div>
                      </div>
                      <SettingsToggle
                        checked={isAppWidgetEnabled(appId, widget.id)}
                        onChange={() => toggleAppWidget(appId, widget.id)}
                        label={widget.name}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </SettingsSection>
      )}
    </div>
  );
}
