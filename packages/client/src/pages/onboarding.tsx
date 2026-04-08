import { useState, useEffect, type CSSProperties } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n';
import { api } from '../lib/api-client';
import { useAuthStore } from '../stores/auth-store';
import { ROUTES } from '../config/routes';
import { Button } from '../components/ui/button';
import { Select } from '../components/ui/select';
import { CheckCircle2, ArrowRight, ArrowLeft, Globe, Settings, Rocket, ClipboardList } from 'lucide-react';

const BG_IMAGE = '/wallpapers/04-mountain-golden.jpg';

const LANGUAGES = [
  { value: 'en', label: 'English', flag: '\u{1F1EC}\u{1F1E7}' },
  { value: 'tr', label: 'T\u00FCrk\u00E7e', flag: '\u{1F1F9}\u{1F1F7}' },
  { value: 'de', label: 'Deutsch', flag: '\u{1F1E9}\u{1F1EA}' },
  { value: 'fr', label: 'Fran\u00E7ais', flag: '\u{1F1EB}\u{1F1F7}' },
  { value: 'it', label: 'Italiano', flag: '\u{1F1EE}\u{1F1F9}' },
];

const DATE_FORMATS = [
  { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY' },
  { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY' },
  { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD' },
];

const CURRENCIES = [
  { value: '$', label: '$ \u2014 US Dollar (USD)' },
  { value: '\u20AC', label: '\u20AC \u2014 Euro (EUR)' },
  { value: '\u00A3', label: '\u00A3 \u2014 British Pound (GBP)' },
  { value: '\u00A5', label: '\u00A5 \u2014 Japanese Yen (JPY)' },
  { value: '\u20BA', label: '\u20BA \u2014 Turkish Lira (TRY)' },
];

export function OnboardingPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [seedingStep, setSeedingStep] = useState('');
  const [seedingProgress, setSeedingProgress] = useState(0);

  const [language, setLanguage] = useState(i18n.language?.split('-')[0] || 'en');
  const [timezone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [dateFormat, setDateFormat] = useState('DD/MM/YYYY');
  const [currency, setCurrency] = useState('$');
  const [withDemoData, setWithDemoData] = useState(true);

  useEffect(() => {
    i18n.changeLanguage(language);
    document.documentElement.lang = language;
  }, [language]);

  if (!isAuthenticated) {
    return <Navigate to={ROUTES.LOGIN} replace />;
  }

  async function handleSubmit() {
    setLoading(true);

    try {
      // 1. Save preferences
      setSeedingStep(t('setup.savingPrefs', 'Saving preferences...'));
      setSeedingProgress(10);
      try {
        await api.put('/settings', { language, timezone, dateFormat, currencySymbol: currency, calendarStartDay: 'monday' });
      } catch { /* non-critical */ }

      // 2. Seed demo data if requested
      if (withDemoData) {
        const seedSteps = [
          { label: 'CRM', url: '/crm/seed' },
          { label: 'HRM', url: '/hr/seed' },
          { label: 'Tasks', url: '/tasks/seed' },
          { label: 'Projects', url: '/projects/seed' },
          { label: 'Tables', url: '/tables/seed' },
          { label: 'Drive', url: '/drive/seed' },
          { label: 'Docs', url: '/docs/seed' },
          { label: 'Draw', url: '/drawings/seed' },
          { label: 'Sign', url: '/sign/seed' },
        ];

        for (let i = 0; i < seedSteps.length; i++) {
          const s = seedSteps[i];
          setSeedingStep(t('setup.seedingApp', 'Setting up {{app}}...', { app: s.label }));
          setSeedingProgress(15 + Math.round(((i + 1) / seedSteps.length) * 80));
          try { await api.post(s.url); } catch { /* non-critical */ }
        }

        try { await api.put('/settings', { homeDemoDataActive: true }); } catch { /* non-critical */ }
      }

      setSeedingProgress(100);
      setSuccess(true);
      setTimeout(() => navigate(ROUTES.HOME, { replace: true }), 2000);
    } catch {
      setLoading(false);
    }
  }

  const stepTitles = [
    { title: t('setup.welcomeTitle', 'Welcome to Atlas'), subtitle: t('setup.welcomeSubtitle', 'Choose your language to get started'), icon: Globe, color: '#3b82f6' },
    { title: t('setup.prefsTitle', 'Preferences'), subtitle: t('setup.prefsSubtitle', 'Configure your defaults'), icon: Settings, color: '#f59e0b' },
  ];

  const currentStep = stepTitles[step];

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-family)', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: '-20px', backgroundImage: `url(${BG_IMAGE})`, backgroundSize: 'cover', backgroundPosition: 'center', filter: 'brightness(0.5)', animation: 'loginKenBurns 30s ease-in-out infinite alternate' }} />
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.5) 100%)' }} />

      <div className="glass-card" style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 470, padding: '36px 32px 28px', background: 'rgba(255,255,255,0.10)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 20, boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}>
        {success ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(16,185,129,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <CheckCircle2 size={32} color="#10b981" />
            </div>
            <h2 style={{ color: '#fff', fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-semibold)' as CSSProperties['fontWeight'], margin: '0 0 8px' }}>
              {t('setup.successTitle', 'Atlas is ready')}
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 'var(--font-size-sm)', margin: 0 }}>
              {t('setup.successSubtitle', 'Redirecting to your dashboard...')}
            </p>
          </div>
        ) : loading && seedingProgress > 0 ? (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <h2 style={{ color: '#fff', fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)' as CSSProperties['fontWeight'], margin: '0 0 16px' }}>
              {t('setup.settingUpAtlas', 'Setting up Atlas')}
            </h2>
            <div style={{ width: '100%', height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden', marginBottom: 14 }}>
              <div style={{ height: '100%', width: `${seedingProgress}%`, background: 'linear-gradient(90deg, #3b82f6, #10b981)', borderRadius: 3, transition: 'width 0.4s ease' }} />
            </div>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 'var(--font-size-sm)', margin: 0 }}>{seedingStep}</p>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 20 }}>
              {[0, 1].map((i) => (
                <div key={i} style={{ width: i === step ? 24 : 8, height: 4, borderRadius: 4, background: i === step ? 'rgba(255,255,255,0.8)' : i < step ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.2)', transition: 'all 0.3s ease' }} />
              ))}
            </div>

            <div style={{ width: 48, height: 48, borderRadius: 14, background: `${currentStep.color}22`, border: `1px solid ${currentStep.color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <currentStep.icon size={24} color={currentStep.color} />
            </div>

            <h1 style={{ color: '#fff', fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-semibold)' as CSSProperties['fontWeight'], textAlign: 'center', margin: '0 0 6px' }}>
              {currentStep.title}
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 'var(--font-size-md)', textAlign: 'center', margin: '0 0 24px' }}>
              {currentStep.subtitle}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 24 }}>
              {step === 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {LANGUAGES.map((lang) => {
                    const isActive = language === lang.value;
                    return (
                      <button
                        key={lang.value}
                        onClick={() => setLanguage(lang.value)}
                        onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
                        onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                        style={{
                          position: 'relative', display: 'flex', alignItems: 'center', padding: '14px 18px',
                          background: isActive ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.04)',
                          border: isActive ? '1px solid rgba(255,255,255,0.35)' : '1px solid rgba(255,255,255,0.08)',
                          borderRadius: 14, cursor: 'pointer', transition: 'all 0.2s', fontFamily: 'var(--font-family)', overflow: 'hidden', minHeight: 52,
                        }}
                      >
                        <span style={{ position: 'absolute', right: -10, top: '50%', transform: 'translateY(-50%) rotate(15deg)', fontSize: 64, lineHeight: 1, opacity: isActive ? 0.3 : 0.12, pointerEvents: 'none', transition: 'opacity 0.2s', filter: 'saturate(1.2)' }}>{lang.flag}</span>
                        <span style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, transparent 40%, rgba(0,0,0,0.3) 100%)', pointerEvents: 'none' }} />
                        <span style={{ position: 'relative', color: '#fff', fontSize: 'var(--font-size-md)', fontWeight: isActive ? 'var(--font-weight-medium)' : 'var(--font-weight-normal)', flex: 1, textAlign: 'left', zIndex: 1 } as CSSProperties}>{lang.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {step === 1 && (
                <>
                  <div style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
                    {([
                      { key: false, icon: Rocket, label: t('setup.startFresh', 'Start fresh'), desc: t('setup.startFreshDesc', 'Empty workspace, ready for your data') },
                      { key: true, icon: ClipboardList, label: t('setup.exploreSample', 'Explore with sample data'), desc: t('setup.exploreSampleDesc', 'Pre-filled examples to explore features') },
                    ] as const).map((opt) => {
                      const isActive = withDemoData === opt.key;
                      const Icon = opt.icon;
                      return (
                        <button
                          key={String(opt.key)}
                          onClick={() => setWithDemoData(opt.key)}
                          onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
                          onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                          style={{
                            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '16px 12px',
                            background: isActive ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.04)',
                            border: isActive ? '1px solid rgba(255,255,255,0.35)' : '1px solid rgba(255,255,255,0.08)',
                            borderRadius: 14, cursor: 'pointer', transition: 'all 0.2s', fontFamily: 'var(--font-family)',
                          }}
                        >
                          <Icon size={20} color={isActive ? '#fff' : 'rgba(255,255,255,0.5)'} />
                          <span style={{ color: '#fff', fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)' as CSSProperties['fontWeight'] }}>{opt.label}</span>
                          <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, textAlign: 'center', lineHeight: 1.3 }}>{opt.desc}</span>
                        </button>
                      );
                    })}
                  </div>

                  <Select label={t('setup.dateFormat', 'Date format')} value={dateFormat} onChange={setDateFormat} options={DATE_FORMATS} size="md" />
                  <Select label={t('setup.currency', 'Currency')} value={currency} onChange={setCurrency} options={CURRENCIES} size="md" />
                </>
              )}
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              {step > 0 && (
                <Button variant="secondary" size="md" onClick={() => setStep(step - 1)} style={{ background: 'rgba(255,255,255,0.1)', borderColor: 'rgba(255,255,255,0.15)' }}>
                  <ArrowLeft size={16} />
                </Button>
              )}
              <Button
                variant="primary"
                size="md"
                onClick={step < 1 ? () => setStep(step + 1) : handleSubmit}
                disabled={loading}
                style={{ flex: 1, background: 'rgba(255,255,255,0.2)', borderColor: 'rgba(255,255,255,0.25)' }}
              >
                {step < 1 ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {t('setup.next', 'Continue')} <ArrowRight size={16} />
                  </span>
                ) : (
                  t('setup.finish', 'Get started')
                )}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
