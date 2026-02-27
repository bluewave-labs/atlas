import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Mail, Calendar, FileText, Pencil, CheckSquare,
  Clock, ArrowRight, Settings,
} from 'lucide-react';
import { useAuthStore } from '../stores/auth-store';
import { useThreadCounts } from '../hooks/use-threads';
import { useCalendarEvents } from '../hooks/use-calendar';
import { useTaskCounts } from '../hooks/use-tasks';
import { ROUTES } from '../config/routes';
import { buildGoogleOAuthUrl } from '../components/auth/login-page';
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
// App card
// ---------------------------------------------------------------------------

function AppCard({
  icon: Icon,
  label,
  color,
  badge,
  onClick,
}: {
  icon: typeof Mail;
  label: string;
  color: string;
  badge?: string;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 14,
        padding: '32px 20px 24px',
        background: hovered ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.18)',
        borderRadius: 22,
        cursor: 'pointer',
        transition: 'all 0.25s ease',
        transform: hovered ? 'translateY(-6px)' : 'translateY(0)',
        boxShadow: hovered
          ? '0 24px 48px rgba(0,0,0,0.3)'
          : '0 8px 32px rgba(0,0,0,0.15)',
        width: 150,
        outline: 'none',
        fontFamily: 'var(--font-family)',
        position: 'relative',
      }}
    >
      <div
        style={{
          width: 60,
          height: 60,
          borderRadius: 18,
          background: color,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: `0 6px 20px ${color}55`,
          transition: 'transform 0.25s ease',
          transform: hovered ? 'scale(1.08)' : 'scale(1)',
        }}
      >
        <Icon size={28} color="#fff" strokeWidth={1.7} />
      </div>
      <span style={{ color: '#fff', fontSize: 15, fontWeight: 500 }}>
        {label}
      </span>
      {badge && (
        <span
          style={{
            color: 'rgba(255,255,255,0.55)',
            fontSize: 14,
            marginTop: -8,
          }}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

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
  const weather = useWeather();
  const account = useAuthStore((s) => s.account);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isDesktop = !!('atlasDesktop' in window);
  const { data: counts } = useThreadCounts({ enabled: isAuthenticated });
  const { data: taskCounts } = useTaskCounts({ enabled: isAuthenticated });
  const parallax = useMouseParallax(15);

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

  // Today's events
  const todayStart = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }, []);
  const todayEnd = useMemo(() => {
    const d = new Date();
    d.setHours(23, 59, 59, 999);
    return d.toISOString();
  }, []);
  const { data: todayEvents } = useCalendarEvents(todayStart, todayEnd, { enabled: isAuthenticated });

  const rawName = account?.name || '';
  const cleanedName = rawName.replace(/^Dr\.?\s+/i, '');
  const firstName = cleanedName.split(' ')[0] || '';
  const hour = now.getHours();
  const greetingKey = getGreetingKey(hour);
  const inboxUnread = counts?.categories?.all?.unread ?? 0;
  const eventCount = todayEvents?.length ?? 0;
  const pendingTaskCount = taskCounts?.total ?? 0;
  const timeTint = getTimeTint(hour);

  // Upcoming events (next 3 that haven't ended yet)
  const upcomingEvents = useMemo(() => {
    if (!todayEvents?.length) return [];
    const nowMs = now.getTime();
    return todayEvents
      .filter((ev) => {
        const end = ev.endTime ? new Date(ev.endTime).getTime() : Infinity;
        return end > nowMs;
      })
      .slice(0, 3);
  }, [todayEvents, now]);

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

      {/* Settings gear — top-right */}
      <button
        onClick={() => navigate(ROUTES.SETTINGS)}
        aria-label="Settings"
        style={{
          position: 'absolute',
          top: isDesktop ? 46 : 16,
          right: 20,
          zIndex: 50,
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

      {/* Background images with ken burns + parallax + crossfade */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
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
      </div>

      {/* Dark overlay + vignette */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.4) 100%)',
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

      {/* Center content */}
      <div
        className="home-content-entrance"
        style={{
          position: 'relative',
          zIndex: 10,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
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

        {/* Date + Weather */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 10 }}>
          <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 20, fontWeight: 500, letterSpacing: '0.01em' }}>
            {formatDate(now)}
          </span>
          {weather && (
            <>
              <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 20 }}>·</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <WeatherIconSVG code={weather.icon} size={28} />
                <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: 19, fontWeight: 400 }}>
                  {weather.temp}°C{weather.description ? `, ${weather.description}` : ''}
                  {weather.city ? ` · ${weather.city}` : ''}
                </span>
              </div>
            </>
          )}
        </div>

        {/* Greeting */}
        <h1
          style={{
            color: '#fff',
            fontSize: 48,
            fontWeight: 600,
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
              fontWeight: 400,
              textShadow: '0 1px 8px rgba(0,0,0,0.2)',
            }}
          >
            {t('home.whatToDo')}
          </p>
        )}

        {/* Today at a glance */}
        {(upcomingEvents.length > 0 || pendingTaskCount > 0) && (
          <div
            style={{
              marginTop: 28,
              display: 'flex',
              gap: 12,
              alignItems: 'stretch',
            }}
          >
            {/* Upcoming events */}
            {upcomingEvents.length > 0 && (
              <button
                onClick={() => navigate(ROUTES.CALENDAR)}
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
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontFamily: 'var(--font-family)',
                  outline: 'none',
                  transition: 'background 0.2s',
                  minWidth: 200,
                  maxWidth: 280,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.18)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <Clock size={14} color="rgba(255,255,255,0.5)" />
                  <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Coming up
                  </span>
                </div>
                {upcomingEvents.map((ev) => (
                  <div key={ev.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, fontWeight: 500, minWidth: 48 }}>
                      {ev.startTime && !ev.isAllDay
                        ? new Date(ev.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : 'All day'}
                    </span>
                    <span style={{ color: 'rgba(255,255,255,0.9)', fontSize: 15, fontWeight: 500 }}>
                      {ev.summary || 'Event'}
                    </span>
                  </div>
                ))}
              </button>
            )}

            {/* Quick stats */}
            {(inboxUnread > 0 || pendingTaskCount > 0) && (
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
                <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>
                  Today
                </span>
                {inboxUnread > 0 && (
                  <button
                    onClick={() => navigate(ROUTES.INBOX)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                      fontFamily: 'var(--font-family)', outline: 'none',
                    }}
                  >
                    <Mail size={15} color="rgba(255,255,255,0.6)" />
                    <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 15, fontWeight: 500 }}>
                      {inboxUnread} unread email{inboxUnread !== 1 ? 's' : ''}
                    </span>
                    <ArrowRight size={13} color="rgba(255,255,255,0.3)" />
                  </button>
                )}
                {pendingTaskCount > 0 && (
                  <button
                    onClick={() => navigate(ROUTES.TASKS)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                      fontFamily: 'var(--font-family)', outline: 'none',
                    }}
                  >
                    <CheckSquare size={15} color="rgba(255,255,255,0.6)" />
                    <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 15, fontWeight: 500 }}>
                      {pendingTaskCount} pending task{pendingTaskCount !== 1 ? 's' : ''}
                    </span>
                    <ArrowRight size={13} color="rgba(255,255,255,0.3)" />
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* App cards */}
        <div style={{ display: 'flex', gap: 20, marginTop: 36 }}>
          <AppCard
            icon={Mail}
            label={t('nav.mail')}
            color="#4a9e8f"
            badge={inboxUnread > 0 ? t('home.unread', { count: inboxUnread }) : undefined}
            onClick={() => {
              if (isAuthenticated) { navigate(ROUTES.INBOX); }
              else { window.location.href = buildGoogleOAuthUrl(); }
            }}
          />
          <AppCard
            icon={Calendar}
            label={t('nav.calendar')}
            color="#7c6fbd"
            badge={eventCount > 0 ? t('home.eventsToday', { count: eventCount }) : undefined}
            onClick={() => {
              if (isAuthenticated) { navigate(ROUTES.CALENDAR); }
              else { window.location.href = buildGoogleOAuthUrl(); }
            }}
          />
          <AppCard
            icon={CheckSquare}
            label={t('nav.tasks')}
            color="#6366f1"
            badge={pendingTaskCount > 0 ? t('home.pendingTasks', { count: pendingTaskCount }) : undefined}
            onClick={() => {
              if (isAuthenticated) { navigate(ROUTES.TASKS); }
              else { window.location.href = buildGoogleOAuthUrl(); }
            }}
          />
          <AppCard
            icon={FileText}
            label={t('nav.write')}
            color="#c4856c"
            onClick={() => navigate(ROUTES.DOCS)}
          />
          <AppCard
            icon={Pencil}
            label={t('nav.draw')}
            color="#e06c9f"
            onClick={() => navigate(ROUTES.DRAW)}
          />
        </div>
      </div>
    </div>
  );
}
