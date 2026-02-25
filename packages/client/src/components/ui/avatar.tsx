import * as AvatarPrimitive from '@radix-ui/react-avatar';
import BoringAvatar from 'boring-avatars';
import { getInitials } from '@atlasmail/shared';

// Theme-aware color palettes.  Light palettes use softer, desaturated tones so
// they don't pop too aggressively on a bright background.  Dark palettes keep
// richer saturation to stand out against dark surfaces.  Every color stays
// below ~60% luminance so white initials remain legible.
const LIGHT_PALETTES = [
  ['#5b8aab', '#6d97b5', '#7ea4be', '#4f7d9e', '#8bb0c7'],
  ['#8472b3', '#9080bc', '#9d8ec6', '#7766a8', '#a99bcf'],
  ['#5d9e90', '#6dab9e', '#7db8ab', '#4e9184', '#8dc4b6'],
  ['#c08a6e', '#c99679', '#d1a285', '#b57e63', '#d9ae91'],
  ['#7b8ea3', '#8898ab', '#95a3b4', '#6e8198', '#a2aebc'],
  ['#b07a93', '#b9879e', '#c294a9', '#a56d87', '#cba1b4'],
];

const DARK_PALETTES = [
  ['#3b7cb5', '#2e6da4', '#4a8ec8', '#1e5a8f', '#5a9ed4'],
  ['#7251b5', '#6247aa', '#8b6cc4', '#5a3d99', '#9b80d0'],
  ['#3d9485', '#2a7e6f', '#4da897', '#1f6b5e', '#5cb8a6'],
  ['#c4703e', '#b85c3a', '#d48858', '#a34e30', '#de9a6a'],
  ['#4b5d78', '#5c6e8a', '#6a7e96', '#3f5068', '#7a8ea6'],
  ['#b05880', '#9c4a6e', '#c06890', '#8a3d5e', '#d07aa0'],
];

// Pick a palette deterministically from a seed string
function pickPalette(seed: string, isDark: boolean): string[] {
  const palettes = isDark ? DARK_PALETTES : LIGHT_PALETTES;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  return palettes[Math.abs(hash) % palettes.length];
}

// Detect current theme
function isDarkTheme(): boolean {
  return document.documentElement.getAttribute('data-theme') === 'dark';
}

// Extract domain from an email address and build a Google favicon URL.
// Returns null for common freemail providers (gmail, outlook, yahoo, etc.)
// since their favicons aren't meaningful as sender avatars.
const FREEMAIL_DOMAINS = new Set([
  'gmail.com', 'googlemail.com', 'outlook.com', 'hotmail.com', 'live.com',
  'msn.com', 'yahoo.com', 'yahoo.co.uk', 'ymail.com', 'aol.com',
  'icloud.com', 'me.com', 'mac.com', 'protonmail.com', 'proton.me',
  'zoho.com', 'mail.com', 'gmx.com', 'gmx.net', 'fastmail.com',
  'tutanota.com', 'tuta.com',
]);

function getFaviconUrl(email: string | undefined, size: number): string | null {
  if (!email) return null;
  const atIndex = email.lastIndexOf('@');
  if (atIndex < 0) return null;
  const domain = email.substring(atIndex + 1).toLowerCase();
  if (!domain || FREEMAIL_DOMAINS.has(domain)) return null;
  // Google's favicon service — request a square icon at the desired resolution
  const sz = Math.min(128, Math.max(32, size * 2)); // 2x for retina
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=${sz}`;
}

interface AvatarProps {
  src?: string | null;
  name?: string | null;
  email?: string;
  size?: number;
  /** CSS size string (e.g. "var(--email-list-avatar, 32px)"). When set, overrides `size` for layout. */
  cssSize?: string;
}

export function Avatar({ src, name, email = '', size = 32, cssSize }: AvatarProps) {
  const seed = email || name || 'default';
  const colors = pickPalette(seed, isDarkTheme());
  const initials = getInitials(name ?? null, email);

  // Use explicit src if provided, otherwise try the domain favicon
  const imageSrc = src || getFaviconUrl(email, size);

  // When cssSize is provided, use it for width/height (CSS variable driven).
  // The numeric `size` is still used for BoringAvatar and font sizing fallback.
  const widthHeight = cssSize || size;

  return (
    <AvatarPrimitive.Root
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: widthHeight,
        height: widthHeight,
        borderRadius: '50%',
        overflow: 'hidden',
        flexShrink: 0,
        userSelect: 'none',
      }}
    >
      {imageSrc && (
        <AvatarPrimitive.Image
          src={imageSrc}
          alt={name || email}
          style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
        />
      )}
      <AvatarPrimitive.Fallback
        delayMs={imageSrc ? 600 : 0}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: '100%',
          position: 'relative',
        }}
      >
        {/* Boring-avatars gradient background */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <BoringAvatar
            name={seed}
            variant="marble"
            size={size}
            colors={colors}
            square={false}
          />
        </div>
        {/* Initials overlay */}
        <span
          style={{
            position: 'relative',
            zIndex: 1,
            color: '#ffffff',
            fontSize: size <= 24 ? 9 : size <= 32 ? 11 : size <= 40 ? 13 : 15,
            fontWeight: 600,
            fontFamily: 'var(--font-family)',
            letterSpacing: '0.03em',
            textShadow: '0 0 3px rgba(0, 0, 0, 0.5), 0 1px 2px rgba(0, 0, 0, 0.4)',
            lineHeight: 1,
          }}
        >
          {initials}
        </span>
      </AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  );
}
