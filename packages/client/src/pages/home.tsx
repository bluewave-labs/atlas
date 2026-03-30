import { useState, useEffect, useMemo, useRef, useCallback, type MouseEvent as ReactMouseEvent, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api-client';
import { queryKeys } from '../config/query-keys';
import {
  FileText, Pencil, CheckSquare, Table2,
  ArrowRight, Settings, LogOut,
  HardDrive,
  Building2,
} from 'lucide-react';
import { useAuthStore } from '../stores/auth-store';
import { useTaskCounts } from '../apps/tasks/hooks';
import { ROUTES } from '../config/routes';
import { appRegistry } from '../apps';
import { useUIStore } from '../stores/ui-store';
import { WidgetGrid } from '../components/home/widgets/widget-grid';
import '../styles/home.css';

// ---------------------------------------------------------------------------
// Background images — curated nature collection (Unsplash, free to use)
// ---------------------------------------------------------------------------

const BG_IMAGES = [
  // Forest path with sunlight filtering through trees
  'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1920&q=80&auto=format&fit=crop',
  // Misty mountain lake at dawn
  'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&q=80&auto=format&fit=crop',
  // Serene wooden bridge in tropical forest
  'https://images.unsplash.com/photo-1448375240586-882707db888b?w=1920&q=80&auto=format&fit=crop',
  // Mountain range with golden hour light
  'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1920&q=80&auto=format&fit=crop',
  // Calm lake with mountain reflection
  'https://images.unsplash.com/photo-1439853949127-fa647821eba0?w=1920&q=80&auto=format&fit=crop',
  // Autumn forest with golden foliage
  'https://images.unsplash.com/photo-1507041957456-9c397ce39c97?w=1920&q=80&auto=format&fit=crop',
  // Lavender field at sunset
  'https://images.unsplash.com/photo-1499002238440-d264edd596ec?w=1920&q=80&auto=format&fit=crop',
  // Northern lights over snowy landscape
  'https://images.unsplash.com/photo-1483347756197-71ef80e95f73?w=1920&q=80&auto=format&fit=crop',
  // Tropical beach with crystal water
  'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1920&q=80&auto=format&fit=crop',
  // Misty pine forest
  'https://images.unsplash.com/photo-1511497584788-876760111969?w=1920&q=80&auto=format&fit=crop',
  // Japanese garden with cherry blossoms
  'https://images.unsplash.com/photo-1522383225653-ed111181a951?w=1920&q=80&auto=format&fit=crop',
  // Waterfall in lush greenery
  'https://images.unsplash.com/photo-1432405972618-c6b0c1d50207?w=1920&q=80&auto=format&fit=crop',
];

function getDailyImageIndex(): number {
  // Pick a consistent image for the day so it doesn't change on every page load
  const daysSinceEpoch = Math.floor(Date.now() / (1000 * 60 * 60 * 24));
  return daysSinceEpoch % BG_IMAGES.length;
}

// ---------------------------------------------------------------------------
// Time-of-day tint overlay
// ---------------------------------------------------------------------------

function getTimeTint(hour: number): string {
  // Early morning (5-7): warm golden
  if (hour >= 5 && hour < 7) return 'rgba(255, 180, 50, 0.12)';
  // Morning (7-11): light warm
  if (hour >= 7 && hour < 11) return 'rgba(255, 220, 130, 0.06)';
  // Midday (11-14): neutral/clear
  if (hour >= 11 && hour < 14) return 'rgba(255, 255, 255, 0.03)';
  // Afternoon (14-17): warm amber
  if (hour >= 14 && hour < 17) return 'rgba(255, 170, 60, 0.08)';
  // Golden hour (17-19): deep amber
  if (hour >= 17 && hour < 19) return 'rgba(255, 130, 30, 0.14)';
  // Dusk (19-21): blue-purple
  if (hour >= 19 && hour < 21) return 'rgba(80, 60, 180, 0.12)';
  // Night (21-5): deep blue
  return 'rgba(20, 30, 80, 0.18)';
}

// ---------------------------------------------------------------------------
// Mouse parallax hook
// ---------------------------------------------------------------------------

function useMouseParallax(strength: number = 15) {
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    let rafId: number;
    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;

    function handleMouseMove(e: MouseEvent) {
      // Normalize mouse position to -1..1
      const nx = (e.clientX / window.innerWidth - 0.5) * 2;
      const ny = (e.clientY / window.innerHeight - 0.5) * 2;
      targetX = -nx * strength;
      targetY = -ny * strength;
    }

    function animate() {
      // Smooth lerp toward target
      currentX += (targetX - currentX) * 0.06;
      currentY += (targetY - currentY) * 0.06;
      setOffset({ x: currentX, y: currentY });
      rafId = requestAnimationFrame(animate);
    }

    window.addEventListener('mousemove', handleMouseMove);
    rafId = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(rafId);
    };
  }, [strength]);

  return offset;
}

// ---------------------------------------------------------------------------
// Weather helpers
// ---------------------------------------------------------------------------

interface WeatherData {
  temp: number;
  description: string;
  icon: string;
  city: string;
}

// Beautiful inline SVG weather icons
function WeatherIconSVG({ code, size = 28 }: { code: string; size?: number }) {
  const prefix = code.slice(0, 2);
  const isNight = code.endsWith('n');
  const s = size;

  // Clear sky — sun or moon
  if (prefix === '01') {
    if (isNight) {
      return (
        <svg width={s} height={s} viewBox="0 0 64 64" fill="none">
          <path d="M42 16a22 22 0 1 0-4 42 18 18 0 0 1 4-42z" fill="#CBD5E1" opacity="0.9" />
          <circle cx="38" cy="20" r="2" fill="#94A3B8" opacity="0.5" />
          <circle cx="32" cy="30" r="3" fill="#94A3B8" opacity="0.3" />
          <circle cx="28" cy="42" r="1.5" fill="#94A3B8" opacity="0.4" />
        </svg>
      );
    }
    return (
      <svg width={s} height={s} viewBox="0 0 64 64" fill="none">
        <circle cx="32" cy="32" r="12" fill="#FBBF24" />
        <circle cx="32" cy="32" r="15" stroke="#FCD34D" strokeWidth="1" opacity="0.4" />
        {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => {
          const rad = (angle * Math.PI) / 180;
          const x1 = 32 + Math.cos(rad) * 19;
          const y1 = 32 + Math.sin(rad) * 19;
          const x2 = 32 + Math.cos(rad) * 24;
          const y2 = 32 + Math.sin(rad) * 24;
          return <line key={angle} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#FBBF24" strokeWidth="2.5" strokeLinecap="round" opacity="0.8" />;
        })}
      </svg>
    );
  }

  // Partly cloudy
  if (prefix === '02') {
    return (
      <svg width={s} height={s} viewBox="0 0 64 64" fill="none">
        <circle cx="24" cy="22" r="9" fill="#FBBF24" />
        {[0, 60, 120, 180, 240, 300].map((angle) => {
          const rad = (angle * Math.PI) / 180;
          const x1 = 24 + Math.cos(rad) * 13;
          const y1 = 22 + Math.sin(rad) * 13;
          const x2 = 24 + Math.cos(rad) * 16;
          const y2 = 22 + Math.sin(rad) * 16;
          return <line key={angle} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#FBBF24" strokeWidth="2" strokeLinecap="round" opacity="0.6" />;
        })}
        <path d="M18 44 h30 a10 10 0 0 0 0-20 h-1 a14 14 0 0 0-27 6 a8 8 0 0 0-2 14z" fill="white" opacity="0.9" />
      </svg>
    );
  }

  // Cloudy / overcast
  if (prefix === '03' || prefix === '04') {
    return (
      <svg width={s} height={s} viewBox="0 0 64 64" fill="none">
        <path d="M14 44 h36 a10 10 0 0 0 0-20 h-1 a14 14 0 0 0-27 6 a8 8 0 0 0-8 14z" fill="white" opacity="0.85" />
        <path d="M22 38 h28 a8 8 0 0 0 0-16 h-1 a11 11 0 0 0-21 5 a6 6 0 0 0-6 11z" fill="white" opacity="0.6" />
      </svg>
    );
  }

  // Drizzle
  if (prefix === '09') {
    return (
      <svg width={s} height={s} viewBox="0 0 64 64" fill="none">
        <path d="M14 36 h36 a10 10 0 0 0 0-20 h-1 a14 14 0 0 0-27 6 a8 8 0 0 0-8 14z" fill="white" opacity="0.8" />
        <line x1="24" y1="42" x2="22" y2="48" stroke="#93C5FD" strokeWidth="2" strokeLinecap="round" opacity="0.7" />
        <line x1="34" y1="42" x2="32" y2="48" stroke="#93C5FD" strokeWidth="2" strokeLinecap="round" opacity="0.7" />
        <line x1="44" y1="42" x2="42" y2="48" stroke="#93C5FD" strokeWidth="2" strokeLinecap="round" opacity="0.7" />
      </svg>
    );
  }

  // Rain
  if (prefix === '10') {
    return (
      <svg width={s} height={s} viewBox="0 0 64 64" fill="none">
        <path d="M14 34 h36 a10 10 0 0 0 0-20 h-1 a14 14 0 0 0-27 6 a8 8 0 0 0-8 14z" fill="white" opacity="0.8" />
        <line x1="20" y1="40" x2="17" y2="50" stroke="#60A5FA" strokeWidth="2.5" strokeLinecap="round" opacity="0.8" />
        <line x1="30" y1="40" x2="27" y2="50" stroke="#60A5FA" strokeWidth="2.5" strokeLinecap="round" opacity="0.8" />
        <line x1="40" y1="40" x2="37" y2="50" stroke="#60A5FA" strokeWidth="2.5" strokeLinecap="round" opacity="0.8" />
        <line x1="25" y1="50" x2="22" y2="58" stroke="#60A5FA" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
        <line x1="35" y1="50" x2="32" y2="58" stroke="#60A5FA" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
      </svg>
    );
  }

  // Thunderstorm
  if (prefix === '11') {
    return (
      <svg width={s} height={s} viewBox="0 0 64 64" fill="none">
        <path d="M14 32 h36 a10 10 0 0 0 0-20 h-1 a14 14 0 0 0-27 6 a8 8 0 0 0-8 14z" fill="#94A3B8" opacity="0.8" />
        <polygon points="33,34 28,46 33,46 29,58 40,42 34,42 38,34" fill="#FBBF24" opacity="0.9" />
        <line x1="20" y1="38" x2="17" y2="48" stroke="#60A5FA" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
        <line x1="46" y1="38" x2="43" y2="48" stroke="#60A5FA" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
      </svg>
    );
  }

  // Snow
  if (prefix === '13') {
    return (
      <svg width={s} height={s} viewBox="0 0 64 64" fill="none">
        <path d="M14 34 h36 a10 10 0 0 0 0-20 h-1 a14 14 0 0 0-27 6 a8 8 0 0 0-8 14z" fill="white" opacity="0.85" />
        <circle cx="22" cy="44" r="2.5" fill="white" opacity="0.8" />
        <circle cx="32" cy="48" r="2.5" fill="white" opacity="0.8" />
        <circle cx="42" cy="44" r="2.5" fill="white" opacity="0.8" />
        <circle cx="27" cy="54" r="2" fill="white" opacity="0.5" />
        <circle cx="37" cy="56" r="2" fill="white" opacity="0.5" />
      </svg>
    );
  }

  // Fog / mist
  if (prefix === '50') {
    return (
      <svg width={s} height={s} viewBox="0 0 64 64" fill="none">
        <line x1="10" y1="24" x2="54" y2="24" stroke="white" strokeWidth="3" strokeLinecap="round" opacity="0.4" />
        <line x1="14" y1="32" x2="50" y2="32" stroke="white" strokeWidth="3" strokeLinecap="round" opacity="0.5" />
        <line x1="10" y1="40" x2="54" y2="40" stroke="white" strokeWidth="3" strokeLinecap="round" opacity="0.4" />
        <line x1="16" y1="48" x2="48" y2="48" stroke="white" strokeWidth="3" strokeLinecap="round" opacity="0.3" />
      </svg>
    );
  }

  // Default: partly cloudy
  return (
    <svg width={s} height={s} viewBox="0 0 64 64" fill="none">
      <circle cx="24" cy="22" r="9" fill="#FBBF24" />
      <path d="M18 44 h30 a10 10 0 0 0 0-20 h-1 a14 14 0 0 0-27 6 a8 8 0 0 0-2 14z" fill="white" opacity="0.9" />
    </svg>
  );
}

function useWeather() {
  const [weather, setWeather] = useState<WeatherData | null>(null);

  useEffect(() => {
    const cached = localStorage.getItem('atlasmail_weather');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Date.now() - parsed.ts < 30 * 60 * 1000) {
          setWeather(parsed.data);
          return;
        }
      } catch { /* ignore */ }
    }

    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const res = await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code&timezone=auto`
          );
          const json = await res.json();
          const current = json.current;
          const wmoCode = current.weather_code as number;
          const { desc, icon } = mapWMOCode(wmoCode);

          let city = '';
          try {
            const geoRes = await fetch(
              `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
            );
            const geoJson = await geoRes.json();
            city = geoJson.city || geoJson.locality || '';
          } catch { /* ignore */ }

          const data: WeatherData = {
            temp: Math.round(current.temperature_2m),
            description: desc,
            icon,
            city,
          };
          setWeather(data);
          localStorage.setItem('atlasmail_weather', JSON.stringify({ data, ts: Date.now() }));
        } catch { /* ignore */ }
      },
      () => { /* permission denied */ },
      { timeout: 5000 },
    );
  }, []);

  return weather;
}

function mapWMOCode(code: number): { desc: string; icon: string } {
  if (code === 0) return { desc: 'Clear sky', icon: '01d' };
  if (code <= 3) return { desc: 'Partly cloudy', icon: '02d' };
  if (code <= 49) return { desc: 'Foggy', icon: '50d' };
  if (code <= 59) return { desc: 'Drizzle', icon: '09d' };
  if (code <= 69) return { desc: 'Rain', icon: '10d' };
  if (code <= 79) return { desc: 'Snow', icon: '13d' };
  if (code <= 84) return { desc: 'Rain showers', icon: '10d' };
  if (code <= 86) return { desc: 'Snow showers', icon: '13d' };
  if (code <= 99) return { desc: 'Thunderstorm', icon: '11d' };
  return { desc: 'Clear', icon: '01d' };
}

// ---------------------------------------------------------------------------
// Time helpers
// ---------------------------------------------------------------------------

function useCurrentTime() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function getGreetingKey(hour: number): string {
  if (hour < 12) return 'home.goodMorning';
  if (hour < 17) return 'home.goodAfternoon';
  return 'home.goodEvening';
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(date: Date): string {
  return date.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' });
}

// ---------------------------------------------------------------------------
// Dock magnification utility
// ---------------------------------------------------------------------------

const scaleValue = (value: number, from: [number, number], to: [number, number]) => {
  const scale = (to[1] - to[0]) / (from[1] - from[0]);
  const capped = Math.min(from[1], Math.max(from[0], value)) - from[0];
  return Math.floor(capped * scale + to[0]);
};

// ---------------------------------------------------------------------------
// Background layer with crossfade
// ---------------------------------------------------------------------------

function BackgroundLayer({
  imageUrl,
  parallaxOffset,
  className,
}: {
  imageUrl: string;
  parallaxOffset: { x: number; y: number };
  className: string;
}) {
  return (
    <div
      className={className}
      style={{
        backgroundImage: `url(${imageUrl})`,
        translate: `${parallaxOffset.x}px ${parallaxOffset.y}px`,
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Home page
// ---------------------------------------------------------------------------

export function HomePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const now = useCurrentTime();
  const account = useAuthStore((s) => s.account);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isDesktop = !!('atlasDesktop' in window);
  const { openSettings } = useUIStore();
  const logout = useAuthStore((s) => s.logout);
  const { data: taskCounts } = useTaskCounts({ enabled: isAuthenticated });
  const parallax = useMouseParallax(15);

  // User settings for home background + recent items
  const { data: userSettings } = useQuery({
    queryKey: queryKeys.settings.all,
    queryFn: async () => {
      const { data } = await api.get('/settings');
      return data.data as Record<string, unknown> | null;
    },
    staleTime: 60_000,
  });

  const bgType = (userSettings?.homeBgType as string) || 'unsplash';
  const bgValue = userSettings?.homeBgValue as string | undefined;

  // Image rotation — changes daily, crossfade on manual cycle
  const [imageIndex, setImageIndex] = useState(getDailyImageIndex);
  const [prevImageIndex, setPrevImageIndex] = useState<number | null>(null);
  const crossfadeTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const cycleImage = useCallback(() => {
    setPrevImageIndex(imageIndex);
    setImageIndex((i) => (i + 1) % BG_IMAGES.length);
    if (crossfadeTimerRef.current) clearTimeout(crossfadeTimerRef.current);
    crossfadeTimerRef.current = setTimeout(() => setPrevImageIndex(null), 2200);
  }, [imageIndex]);

  // Auto-cycle every 5 minutes
  useEffect(() => {
    const id = setInterval(cycleImage, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [cycleImage]);

  // Preload next image
  useEffect(() => {
    const nextIdx = (imageIndex + 1) % BG_IMAGES.length;
    const img = new Image();
    img.src = BG_IMAGES[nextIdx];
  }, [imageIndex]);


  const rawName = account?.name || '';
  const cleanedName = rawName.replace(/^Dr\.?\s+/i, '');
  const firstName = cleanedName.split(' ')[0] || '';
  const hour = now.getHours();
  const greetingKey = getGreetingKey(hour);
  const pendingTaskCount = taskCounts?.total ?? 0;
  const timeTint = getTimeTint(hour);


  // Background style based on user settings
  const backgroundStyle = useMemo(() => {
    if (bgType === 'solid' && bgValue) {
      return { backgroundColor: bgValue };
    }
    if (bgType === 'gradient' && bgValue) {
      return { background: bgValue };
    }
    if (bgType === 'custom' && bgValue) {
      return {
        backgroundImage: `url(${bgValue})`,
        backgroundSize: 'cover' as const,
        backgroundPosition: 'center',
      };
    }
    // Default: unsplash rotation — handled by BackgroundLayer component
    return null;
  }, [bgType, bgValue]);

  // Recent items from settings
  interface RecentItem {
    type: 'doc' | 'drawing' | 'table' | 'task';
    id: string;
    title: string;
    timestamp: string;
  }

  const recentItems: RecentItem[] = useMemo(() => {
    try {
      const raw = userSettings?.recentItems as string | undefined;
      if (!raw) return [];
      return JSON.parse(raw) as RecentItem[];
    } catch {
      return [];
    }
  }, [userSettings]);

  // Dock magnification
  const dockRef = useRef<HTMLElement>(null);

  const handleDockItemHover = useCallback((e: ReactMouseEvent<HTMLDivElement>) => {
    const dock = dockRef.current;
    if (!dock) return;
    const mouseX = e.clientX;
    const items = dock.querySelectorAll<HTMLElement>('.dock-item');
    items.forEach((item) => {
      const rect = item.getBoundingClientRect();
      const itemCenterX = rect.left + rect.width / 2;
      const distance = Math.abs(mouseX - itemCenterX);
      const offsetPx = scaleValue(distance, [0, 200], [8, 0]);
      item.style.setProperty('--dock-offset-left', `${offsetPx}px`);
      item.style.setProperty('--dock-offset-right', `${offsetPx}px`);
    });
  }, []);

  const handleDockMouseLeave = useCallback(() => {
    const dock = dockRef.current;
    if (!dock) return;
    const items = dock.querySelectorAll<HTMLElement>('.dock-item');
    items.forEach((item) => {
      item.style.removeProperty('--dock-offset-left');
      item.style.removeProperty('--dock-offset-right');
    });
  }, []);

  // Dock app definitions
  const dockApps = useMemo(() =>
    appRegistry.getAll().map(app => ({
      icon: app.icon,
      label: app.name,
      color: app.color,
      route: app.routes[0]?.path ?? `/${app.id}`,
    })),
  []);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        fontFamily: 'var(--font-family)',
        userSelect: 'none',
        WebkitUserSelect: 'none',
      }}
    >
      {/* Desktop: invisible drag strip for window movement */}
      {isDesktop && (
        <div
          className="desktop-drag-region"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 38,
            zIndex: 60,
          }}
        />
      )}

      {/* Top-right — Marketplace + Settings */}
      <div
        style={{
          position: 'absolute',
          top: isDesktop ? 46 : 16,
          right: 20,
          zIndex: 50,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        {/* Organization button */}
        <button
          onClick={() => navigate(ROUTES.ORG)}
          aria-label="Organization"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            height: 36,
            padding: '0 14px',
            background: 'rgba(255,255,255,0.12)',
            border: '1px solid rgba(255,255,255,0.18)',
            borderRadius: 18,
            color: 'rgba(255,255,255,0.75)',
            cursor: 'pointer',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            transition: 'background 0.2s, color 0.2s',
            fontFamily: 'var(--font-family)',
            fontSize: 'var(--font-size-sm)',
            fontWeight: 'var(--font-weight-medium)' as CSSProperties['fontWeight'],
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.22)';
            e.currentTarget.style.color = '#fff';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.12)';
            e.currentTarget.style.color = 'rgba(255,255,255,0.75)';
          }}
        >
          <Building2 size={16} />
          Organization
        </button>

        {/* Settings gear */}
        <button
          onClick={() => openSettings()}
          aria-label="Settings"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 36,
            height: 36,
            background: 'rgba(255,255,255,0.12)',
            border: '1px solid rgba(255,255,255,0.18)',
            borderRadius: '50%',
            color: 'rgba(255,255,255,0.75)',
            cursor: 'pointer',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            transition: 'background 0.2s, color 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.22)';
            e.currentTarget.style.color = '#fff';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.12)';
            e.currentTarget.style.color = 'rgba(255,255,255,0.75)';
          }}
        >
          <Settings size={18} />
        </button>

        {/* Logout */}
        <button
          onClick={() => {
            logout();
            navigate(ROUTES.LOGIN);
          }}
          aria-label="Log out"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 36,
            height: 36,
            background: 'rgba(255,255,255,0.12)',
            border: '1px solid rgba(255,255,255,0.18)',
            borderRadius: '50%',
            color: 'rgba(255,255,255,0.75)',
            cursor: 'pointer',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            transition: 'background 0.2s, color 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.22)';
            e.currentTarget.style.color = '#fff';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.12)';
            e.currentTarget.style.color = 'rgba(255,255,255,0.75)';
          }}
        >
          <LogOut size={18} />
        </button>
      </div>

      {/* Background images with ken burns + parallax + crossfade */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
        {backgroundStyle ? (
          /* Custom background (solid / gradient / custom image) */
          <div
            style={{
              position: 'absolute',
              inset: '-20px',
              ...backgroundStyle,
            }}
          />
        ) : (
          <>
            {/* Previous image (fading out) */}
            {prevImageIndex !== null && (
              <BackgroundLayer
                key={`prev-${prevImageIndex}`}
                imageUrl={BG_IMAGES[prevImageIndex]}
                parallaxOffset={parallax}
                className="home-bg-image home-bg-image--exiting"
              />
            )}

            {/* Current image */}
            <BackgroundLayer
              key={`current-${imageIndex}`}
              imageUrl={BG_IMAGES[imageIndex]}
              parallaxOffset={parallax}
              className={prevImageIndex !== null ? 'home-bg-image home-bg-image--entering' : 'home-bg-image'}
            />
          </>
        )}
      </div>

      {/* Dark overlay — stronger in dark theme for readability */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: document.documentElement.getAttribute('data-theme') === 'dark'
            ? 'linear-gradient(180deg, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.65) 100%)'
            : 'linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.4) 100%)',
          zIndex: 1,
        }}
      />

      {/* Time-of-day tint */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: timeTint,
          zIndex: 2,
          transition: 'background 60s linear',
          pointerEvents: 'none',
        }}
      />

      {/* Vignette */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          boxShadow: 'inset 0 0 200px 40px rgba(0,0,0,0.25)',
          zIndex: 3,
          pointerEvents: 'none',
        }}
      />

      {/* Main layout: centered content, dock at bottom */}
      <div
        className="home-content-entrance"
        style={{
          position: 'relative',
          zIndex: 10,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          width: '100%',
          height: '100%',
          padding: '0 24px',
        }}
      >
        {/* Center content — Clock, greeting, widgets */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            overflowY: 'auto',
            maxHeight: 'calc(100vh - 120px)',
            paddingBottom: 24,
            width: '100%',
          }}
        >
          {/* Clock */}
          <span
            style={{
              color: '#fff',
              fontSize: 72,
              fontWeight: 300,
              lineHeight: 1,
              letterSpacing: '-1.5px',
              textShadow: '0 2px 20px rgba(0,0,0,0.2)',
            }}
          >
            {formatTime(now)}
          </span>

          {/* Date (no weather) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 10 }}>
            <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 20, fontWeight: 'var(--font-weight-medium)' as CSSProperties['fontWeight'], letterSpacing: '0.01em' }}>
              {formatDate(now)}
            </span>
          </div>

          {/* Greeting */}
          <h1
            style={{
              color: '#fff',
              fontSize: 48,
              fontWeight: 'var(--font-weight-semibold)' as CSSProperties['fontWeight'],
              margin: '32px 0 0',
              textShadow: '0 2px 30px rgba(0,0,0,0.25)',
              lineHeight: 1.15,
              letterSpacing: '-0.5px',
            }}
          >
            {firstName ? `${t(greetingKey)}, ${firstName}` : t(greetingKey)}
          </h1>

          {!firstName && (
            <p
              style={{
                color: 'rgba(255,255,255,0.7)',
                fontSize: 18,
                margin: '6px 0 0',
                fontWeight: 'var(--font-weight-normal)' as CSSProperties['fontWeight'],
                textShadow: '0 1px 8px rgba(0,0,0,0.2)',
              }}
            >
              {t('home.whatToDo')}
            </p>
          )}

          {/* Quick stats */}
          {pendingTaskCount > 0 && (
            <div
              style={{
                marginTop: 28,
                display: 'flex',
                gap: 12,
                alignItems: 'stretch',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  padding: '14px 20px',
                  background: 'rgba(255,255,255,0.1)',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: 14,
                  textAlign: 'left',
                  fontFamily: 'var(--font-family)',
                  minWidth: 160,
                }}
              >
                <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-semibold)' as CSSProperties['fontWeight'], textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>
                  {t('home.today')}
                </span>
                <button
                  onClick={() => navigate(ROUTES.TASKS)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                    fontFamily: 'var(--font-family)', outline: 'none',
                  }}
                >
                  <CheckSquare size={15} color="rgba(255,255,255,0.6)" />
                  <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 'var(--font-size-md)', fontWeight: 'var(--font-weight-medium)' as CSSProperties['fontWeight'] }}>
                    {t('home.pendingTasksFull', { count: pendingTaskCount })}
                  </span>
                  <ArrowRight size={13} color="rgba(255,255,255,0.3)" />
                </button>
              </div>
            </div>
          )}

          {/* Recent items */}
          {recentItems.length > 0 && (
            <div style={{ marginBottom: 16, maxWidth: 780, width: '100%', padding: '0 16px' }}>
              <h3 style={{ fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-medium)' as CSSProperties['fontWeight'], color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Recent</h3>
              <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8 }}>
                {recentItems.slice(0, 10).map((item) => {
                  const typeIconMap: Record<string, React.ReactNode> = {
                    doc: <FileText size={16} color="rgba(255,255,255,0.7)" />,
                    drawing: <Pencil size={16} color="rgba(255,255,255,0.7)" />,
                    table: <Table2 size={16} color="rgba(255,255,255,0.7)" />,
                    task: <CheckSquare size={16} color="rgba(255,255,255,0.7)" />,
                  };
                  const typePaths: Record<string, string> = { doc: '/docs/', drawing: '/draw/', table: '/tables/', task: '/tasks' };
                  return (
                    <button
                      key={`${item.type}-${item.id}`}
                      onClick={() => navigate(typePaths[item.type] + (item.type === 'task' ? '' : item.id))}
                      style={{
                        flexShrink: 0,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '8px 12px',
                        borderRadius: 8,
                        background: 'rgba(255,255,255,0.1)',
                        backdropFilter: 'blur(8px)',
                        border: 'none',
                        cursor: 'pointer',
                        textAlign: 'left',
                        minWidth: 140,
                        maxWidth: 200,
                        transition: 'background 0.15s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.2)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
                    >
                      {typeIconMap[item.type] || <FileText size={16} color="rgba(255,255,255,0.7)" />}
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 'var(--font-size-sm)', color: 'rgba(255,255,255,0.9)', fontWeight: 'var(--font-weight-medium)' as CSSProperties['fontWeight'], overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</div>
                        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>{item.type}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Widgets — centered, 2x size */}
          <WidgetGrid />
        </div>

        {/* Bottom dock bar */}
        <nav
          ref={dockRef}
          className="atlas-dock"
          onMouseLeave={handleDockMouseLeave}
          style={{
            position: 'absolute',
            bottom: 16,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 50,
            display: 'flex',
            alignItems: 'flex-end',
            padding: '8px 12px',
            borderRadius: 20,
            background: 'rgba(255,255,255,0.12)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.18)',
            boxShadow: '0 4px 24px rgba(0,0,0,0.2)',
            gap: 6,
          }}
        >
          {dockApps.map((app) => {
            const Icon = app.icon;
            return (
              <div
                key={app.route}
                className="dock-item"
                onMouseMove={handleDockItemHover}
              >
                <div
                  onClick={() => navigate(app.route)}
                  style={{
                    width: '100%',
                    height: '100%',
                    borderRadius: 14,
                    background: `linear-gradient(135deg, ${app.color} 0%, color-mix(in srgb, ${app.color} 70%, #000) 100%)`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    boxShadow: `0 4px 14px ${app.color}44, 0 2px 6px rgba(0,0,0,0.15)`,
                  }}
                >
                  <Icon size={28} color="#fff" strokeWidth={1.7} />
                </div>
                <span className="dock-tooltip">{app.label}</span>
              </div>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
