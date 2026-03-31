import { useState, useEffect, type ComponentType } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CloudSun, Sun, Cloud, CloudFog, CloudDrizzle, CloudRain,
  CloudSnow, CloudLightning, Snowflake, Wind, CloudHail,
  type LucideProps,
} from 'lucide-react';
import type { WidgetDefinition, WidgetProps } from './types';

interface ForecastDay {
  date: string; // ISO date string for locale formatting
  high: number;
  low: number;
  code: number;
}

// Map WMO weather codes to Lucide icons
function getWeatherIcon(code: number): ComponentType<LucideProps> {
  if (code === 0) return Sun;
  if (code <= 2) return CloudSun;
  if (code === 3) return Cloud;
  if (code <= 48) return CloudFog;
  if (code <= 57) return CloudDrizzle;
  if (code <= 67) return CloudRain;
  if (code <= 77) return Snowflake;
  if (code <= 82) return CloudHail;
  if (code <= 86) return CloudSnow;
  if (code <= 99) return CloudLightning;
  return Sun;
}


// Try browser geolocation first, then fall back to IP-based location
async function getLocation(): Promise<{ latitude: number; longitude: number }> {
  // Try browser geolocation
  if (navigator.geolocation) {
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
      });
      return { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
    } catch { /* fall through to IP-based */ }
  }

  // Fallback: IP-based geolocation (no API key needed)
  const res = await fetch('https://ipapi.co/json/');
  const data = await res.json();
  if (data.latitude && data.longitude) {
    return { latitude: data.latitude, longitude: data.longitude };
  }

  throw new Error('Could not determine location');
}

function WeatherWidgetComponent({ width, height }: WidgetProps) {
  const { t, i18n } = useTranslation();
  const [forecast, setForecast] = useState<ForecastDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const cached = localStorage.getItem('atlasmail_weather_forecast');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        // Validate cache: must have `date` field (not old `day` format) and be fresh
        if (Date.now() - parsed.ts < 60 * 60 * 1000 && parsed.data?.[0]?.date) {
          setForecast(parsed.data);
          setLoading(false);
          return;
        }
      } catch { /* ignore */ }
      localStorage.removeItem('atlasmail_weather_forecast');
    }

    (async () => {
      try {
        const { latitude, longitude } = await getLocation();
        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=temperature_2m_max,temperature_2m_min,weather_code&timezone=auto&forecast_days=3`
        );
        const json = await res.json();
        const days: ForecastDay[] = json.daily.time.map((date: string, i: number) => ({
          date,
          high: Math.round(json.daily.temperature_2m_max[i]),
          low: Math.round(json.daily.temperature_2m_min[i]),
          code: json.daily.weather_code[i],
        }));
        setForecast(days);
        localStorage.setItem('atlasmail_weather_forecast', JSON.stringify({ ts: Date.now(), data: days }));
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div style={{ width, height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Wind size={20} color="rgba(255,255,255,0.4)" style={{ animation: 'pulse 1.5s ease infinite' }} />
      </div>
    );
  }

  if (error || forecast.length === 0) {
    return (
      <div style={{
        width, height, display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'rgba(255,255,255,0.5)', fontSize: 'var(--font-size-sm)',
      }}>
        <Cloud size={16} style={{ marginRight: 6, opacity: 0.6 }} />
        {t('widgets.weather.unavailable')}
      </div>
    );
  }

  return (
    <div style={{
      width, height, display: 'flex', alignItems: 'center', justifyContent: 'space-around',
      padding: '12px 8px',
    }}>
      {forecast.map((d) => {
        const Icon = getWeatherIcon(d.code);
        const dayLabel = new Date(d.date + 'T12:00:00').toLocaleDateString(i18n.language, { weekday: 'short' });
        return (
          <div key={d.date} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 'var(--font-size-md)', color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>
              {dayLabel}
            </span>
            <Icon size={22} color="rgba(255,255,255,0.85)" strokeWidth={1.5} />
            <div style={{ display: 'flex', gap: 4, fontSize: 'var(--font-size-md)', fontWeight: 500 }}>
              <span style={{ color: 'rgba(255,255,255,0.9)' }}>{d.high}°</span>
              <span style={{ color: 'rgba(255,255,255,0.45)' }}>{d.low}°</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export const weatherWidget: WidgetDefinition = {
  id: 'weather',
  name: '3-day forecast',
  description: 'Weather forecast for the next 3 days based on your location',
  icon: CloudSun,
  defaultEnabled: true,
  component: WeatherWidgetComponent,
};
