import React, { type CSSProperties, useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api-client';
import { queryKeys } from '../../config/query-keys';
import { SettingsSection, SettingsRow, SettingsToggle } from '../settings/settings-primitives';
import { Input } from '../ui/input';
import { widgetRegistry } from './widgets/registry';
import { appRegistry } from '../../config/app-registry';

// Map widget IDs to i18n keys for translated names/descriptions
const WIDGET_I18N: Record<string, { name: string; desc: string }> = {
  weather: { name: 'widgets.weatherName', desc: 'widgets.weatherDesc' },
  quote: { name: 'widgets.quoteName', desc: 'widgets.quoteDesc' },
  stocks: { name: 'widgets.stocksName', desc: 'widgets.stocksDesc' },
  pomodoro: { name: 'widgets.pomodoroName', desc: 'widgets.pomodoroDesc' },
};
import { PET_OPTIONS, PetPreview, type PetType } from './dock-pet';

type BgType = 'unsplash' | 'solid' | 'gradient' | 'custom';

// Wallpaper photos — bundled locally for airgapped/offline support
const WALLPAPER_PHOTOS = [
  { url: '/wallpapers/01-forest-sunlight.jpg', thumb: '/wallpapers/01-forest-sunlight.jpg', label: 'Forest path' },
  { url: '/wallpapers/02-misty-pines.jpg', thumb: '/wallpapers/02-misty-pines.jpg', label: 'Misty pines' },
  { url: '/wallpapers/03-tropical-bridge.jpg', thumb: '/wallpapers/03-tropical-bridge.jpg', label: 'Tropical forest' },
  { url: '/wallpapers/04-mountain-golden.jpg', thumb: '/wallpapers/04-mountain-golden.jpg', label: 'Mountain range' },
  { url: '/wallpapers/05-dark-forest.jpg', thumb: '/wallpapers/05-dark-forest.jpg', label: 'Dark forest' },
  { url: '/wallpapers/06-autumn-forest.jpg', thumb: '/wallpapers/06-autumn-forest.jpg', label: 'Autumn forest' },
  { url: '/wallpapers/07-night-sky.jpg', thumb: '/wallpapers/07-night-sky.jpg', label: 'Night sky' },
  { url: '/wallpapers/08-northern-lights.jpg', thumb: '/wallpapers/08-northern-lights.jpg', label: 'Northern lights' },
  { url: '/wallpapers/09-mountain-sunset.jpg', thumb: '/wallpapers/09-mountain-sunset.jpg', label: 'Mountain sunset' },
  { url: '/wallpapers/10-waterfall.jpg', thumb: '/wallpapers/10-waterfall.jpg', label: 'Waterfall' },
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

  const bgType = (settings?.homeBgType as BgType) || 'unsplash';
  const bgValue = (settings?.homeBgValue as string) || '';
  const bgRotate = (settings?.homeBgRotate as boolean) ?? false;

  const [customHex, setCustomHex] = useState('');

  const mutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      await api.put('/settings', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.settings.all });
    },
  });

  const setBg = (type: BgType, value: string | null) => {
    mutation.mutate({ homeBgType: type, homeBgValue: value });
  };

  const setRotate = (enabled: boolean) => {
    if (enabled) {
      mutation.mutate({ homeBgRotate: true, homeBgValue: null });
    } else {
      mutation.mutate({ homeBgRotate: false });
    }
  };

  const typeOptions: Array<{ value: BgType; label: string; desc: string }> = [
    { value: 'unsplash', label: t('widgets.bgTypePhoto', 'Photo'), desc: t('widgets.bgTypePhotoDesc', 'Choose a wallpaper from curated photos') },
    { value: 'solid', label: t('widgets.bgTypeSolid', 'Solid color'), desc: t('widgets.bgTypeSolidDesc', 'Dark colors curated for readability') },
    { value: 'gradient', label: t('widgets.bgTypeGradient', 'Gradient'), desc: t('widgets.bgTypeGradientDesc', 'Dark gradients curated for readability') },
  ];

  return (
    <div>
      <SettingsSection title={t('widgets.bgType', 'Background type')} description={t('widgets.bgTypeDesc', 'Choose what appears behind the home screen')}>
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
        <>
          <SettingsSection title={t('widgets.autoRotate', 'Auto-rotate')} description={t('widgets.autoRotateDesc', 'Cycle through wallpapers automatically')}>
            <SettingsRow label={t('widgets.rotateWallpapers', 'Rotate wallpapers')} description={t('widgets.rotateWallpapersDesc', 'Change wallpaper every 5 minutes')}>
              <SettingsToggle checked={bgRotate} onChange={setRotate} label={t('widgets.rotateWallpapers', 'Rotate wallpapers')} />
            </SettingsRow>
          </SettingsSection>

          {!bgRotate && (
            <SettingsSection title={t('widgets.chooseWallpaper', 'Choose a wallpaper')} description={t('widgets.chooseWallpaperDesc', 'Select a photo for your home screen')}>
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
        </>
      )}

      {bgType === 'solid' && (
        <SettingsSection title={t('widgets.pickColor', 'Pick a color')} description={t('widgets.pickColorDesc', 'Select a background color for the home screen')}>
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
        <SettingsSection title={t('widgets.pickGradient', 'Pick a gradient')} description={t('widgets.pickGradientDesc', 'Select a gradient for the home screen')}>
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
        <SettingsSection title={t('widgets.customColor', 'Custom color')} description={t('widgets.customColorDesc', 'Enter a hex color code')}>
          <SettingsRow label={t('widgets.hexColor', 'Hex color')} description={t('widgets.hexColorDesc', 'e.g. #1a1a2e or #f5f5f5')}>
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

      <SettingsSection title={t('widgets.clockSection', 'Clock')} description={t('widgets.clockDesc', 'Configure the home screen clock display')}>
        <SettingsRow label={t('widgets.showSeconds', 'Show seconds')} description={t('widgets.showSecondsDesc', 'Display seconds on the clock')}>
          <SettingsToggle
            checked={!!(settings?.homeShowSeconds)}
            onChange={(val) => {
              mutation.mutate({ homeShowSeconds: val } as any);
              queryClient.setQueryData(queryKeys.settings.all, (old: any) => old ? { ...old, homeShowSeconds: val } : old);
            }}
            label={t('widgets.showSeconds', 'Show seconds')}
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
                      {WIDGET_I18N[widget.id] ? t(WIDGET_I18N[widget.id].name) : widget.name}
                    </div>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', marginTop: 1 }}>
                      {WIDGET_I18N[widget.id] ? t(WIDGET_I18N[widget.id].desc) : widget.description}
                    </div>
                  </div>
                </div>
                <SettingsToggle
                  checked={isEnabled(widget.id)}
                  onChange={() => toggle(widget.id)}
                  label={WIDGET_I18N[widget.id] ? t(WIDGET_I18N[widget.id].name) : widget.name}
                />
              </div>
            );
          })}
        </div>
      </SettingsSection>

      {/* Dock pet picker */}
      <SettingsSection title={t('widgets.dockPet')} description={t('widgets.dockPetDesc')}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: 8 }}>
          {(() => { const currentPet = String(settings?.homeDockPet ?? 'cat'); return PET_OPTIONS.map((option) => {
            const isSelected = option.id === currentPet;
            return (
              <button
                key={option.id}
                onClick={() => {
                  api.put('/settings', { homeDockPet: option.id }).then(() => {
                    queryClient.invalidateQueries({ queryKey: queryKeys.settings.all });
                  });
                }}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 6,
                  padding: '12px 8px',
                  border: `2px solid ${isSelected ? 'var(--color-accent-primary)' : 'var(--color-border-secondary)'}`,
                  borderRadius: 'var(--radius-lg)',
                  background: isSelected ? 'color-mix(in srgb, var(--color-accent-primary) 8%, transparent)' : 'transparent',
                  cursor: 'pointer',
                  transition: 'border-color 0.15s, background 0.15s',
                  fontFamily: 'var(--font-family)',
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) e.currentTarget.style.borderColor = 'var(--color-border-primary)';
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) e.currentTarget.style.borderColor = 'var(--color-border-secondary)';
                }}
              >
                {option.id !== 'none' ? (
                  <PetPreview pet={option.id as Exclude<PetType, 'none'>} size={40} />
                ) : (
                  <div style={{ width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-tertiary)', fontSize: 20 }}>
                    —
                  </div>
                )}
                <span style={{ fontSize: 'var(--font-size-xs)', color: isSelected ? 'var(--color-accent-primary)' : 'var(--color-text-secondary)' }}>
                  {option.label}
                </span>
              </button>
            );
          }); })()}
        </div>
      </SettingsSection>

      {/* Flying birds toggle */}
      <SettingsSection title={t('widgets.flyingBirds')} description={t('widgets.flyingBirdsDesc')}>
        <SettingsToggle
          checked={settings?.homeFlyingBirds !== false}
          onChange={(v) => {
            api.put('/settings', { homeFlyingBirds: v }).then(() => {
              queryClient.invalidateQueries({ queryKey: queryKeys.settings.all });
            });
          }}
          label={t('widgets.flyingBirds')}
        />
      </SettingsSection>

      {appWidgetsByApp.size > 0 && (
        <SettingsSection title={t('widgets.appWidgets')} description={t('widgets.appWidgetsDesc')}>
          {Array.from(appWidgetsByApp.entries()).map(([appId, widgets]) => (
            <div key={appId} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-primary)' }}>
                {widgets[0].appName}
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
