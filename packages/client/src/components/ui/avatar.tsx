import { useState, useCallback, useRef } from 'react';
import * as AvatarPrimitive from '@radix-ui/react-avatar';
function getInitials(name: string | null, email?: string): string {
  if (name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return parts[0].substring(0, 2).toUpperCase();
  }
  if (email) return email.substring(0, 2).toUpperCase();
  return '?';
}

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

// ─── URL generators ─────────────────────────────────────────────────

const FREEMAIL_DOMAINS = new Set([
  // Google
  'gmail.com', 'googlemail.com',
  // Microsoft
  'outlook.com', 'hotmail.com', 'live.com', 'msn.com', 'hotmail.co.uk',
  'hotmail.fr', 'hotmail.de', 'hotmail.it', 'hotmail.es', 'live.co.uk',
  'live.fr', 'live.nl', 'outlook.co.uk', 'outlook.fr', 'outlook.de',
  // Yahoo
  'yahoo.com', 'yahoo.co.uk', 'yahoo.co.in', 'yahoo.ca', 'yahoo.com.au',
  'yahoo.com.br', 'yahoo.co.jp', 'yahoo.fr', 'yahoo.de', 'yahoo.it',
  'yahoo.es', 'yahoo.co.id', 'ymail.com', 'rocketmail.com', 'myyahoo.com',
  // AOL / Verizon
  'aol.com', 'aol.co.uk', 'aim.com', 'verizon.net',
  // Apple
  'icloud.com', 'me.com', 'mac.com',
  // ProtonMail
  'protonmail.com', 'protonmail.ch', 'proton.me', 'pm.me',
  // Tutanota / Tuta
  'tutanota.com', 'tutanota.de', 'tuta.com', 'tuta.io', 'keemail.me',
  // Other privacy / secure mail
  'fastmail.com', 'fastmail.fm', 'hushmail.com', 'mailfence.com',
  'startmail.com', 'posteo.de', 'posteo.net', 'disroot.org', 'riseup.net',
  'ctemplar.com', 'runbox.com', 'kolabnow.com', 'countermail.com',
  // Zoho
  'zoho.com', 'zohomail.com',
  // GMX / mail.com / 1&1
  'gmx.com', 'gmx.net', 'gmx.de', 'gmx.at', 'gmx.ch', 'mail.com',
  'email.com', 'usa.com', 'post.com', 'europe.com',
  // German providers
  'web.de', 't-online.de', 'freenet.de', 'arcor.de',
  // French providers
  'laposte.net', 'orange.fr', 'wanadoo.fr', 'free.fr', 'sfr.fr',
  // Italian providers
  'libero.it', 'virgilio.it', 'alice.it', 'tin.it',
  // Russian providers
  'mail.ru', 'yandex.ru', 'yandex.com', 'rambler.ru', 'list.ru',
  'bk.ru', 'inbox.ru',
  // Chinese providers
  'qq.com', '163.com', '126.com', 'sina.com', 'sohu.com', 'yeah.net',
  'foxmail.com', 'aliyun.com',
  // Japanese providers
  'nifty.com', 'excite.co.jp',
  // Indian providers
  'rediffmail.com', 'sify.com',
  // Brazilian providers
  'bol.com.br', 'uol.com.br', 'terra.com.br',
  // US ISPs
  'comcast.net', 'att.net', 'sbcglobal.net', 'bellsouth.net',
  'charter.net', 'cox.net', 'earthlink.net', 'juno.com', 'netzero.net',
  'optonline.net', 'roadrunner.com', 'windstream.net',
  // Canadian ISPs
  'rogers.com', 'shaw.ca', 'sympatico.ca', 'telus.net',
  // UK ISPs
  'btinternet.com', 'sky.com', 'talktalk.net', 'ntlworld.com',
  'virginmedia.com',
  // Other global
  'inbox.com', 'lycos.com', 'hush.com', 'lavabit.com',
]);

function getDomain(email: string | undefined): string | null {
  if (!email) return null;
  const atIndex = email.lastIndexOf('@');
  if (atIndex < 0) return null;
  const domain = email.substring(atIndex + 1).toLowerCase();
  if (!domain || FREEMAIL_DOMAINS.has(domain)) return null;
  return domain;
}

const SKIP_FAVICON_TLDS = ['.test', '.local', '.internal', '.example', '.invalid', '.localhost'];

function getFaviconUrl(email: string | undefined, size: number): string | null {
  const domain = getDomain(email);
  if (!domain) return null;
  // Skip favicon for large avatars — favicons are inherently low-res
  if (size > 40) return null;
  // Skip fake/test domains
  if (SKIP_FAVICON_TLDS.some(tld => domain.endsWith(tld))) return null;
  const sz = Math.min(64, Math.max(32, size * 2));
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=${sz}`;
}

/**
 * Build the ordered list of image URLs to try.
 * Priority: explicit src → Google Favicon (for business domains)
 *
 * Note: Gravatar and Clearbit Logo removed — Clearbit's logo API has been shut
 * down (DNS no longer resolves) and Gravatar returns 404 for most addresses,
 * both generating noisy console errors on every render.
 */
function buildImageCandidates(
  src: string | null | undefined,
  email: string | undefined,
  size: number,
): string[] {
  const urls: string[] = [];
  if (src) urls.push(src);

  const favicon = getFaviconUrl(email, size);
  if (favicon) urls.push(favicon);

  return urls;
}

// ─── Component ──────────────────────────────────────────────────────

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
  const candidates = buildImageCandidates(src, email, size);
  const [imgIndex, setImgIndex] = useState(0);
  const prevKeyRef = useRef('');

  // Reset when candidates change
  const candidateKey = candidates.join('|');
  if (candidateKey !== prevKeyRef.current) {
    prevKeyRef.current = candidateKey;
    if (imgIndex !== 0) setImgIndex(0);
  }

  const currentSrc = imgIndex < candidates.length ? candidates[imgIndex] : null;

  const handleError = useCallback(() => {
    setImgIndex((prev) => prev + 1);
  }, []);

  // When cssSize is provided, use it for width/height (CSS variable driven).
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
      {currentSrc && (
        <AvatarPrimitive.Image
          key={currentSrc}
          src={currentSrc}
          alt={name || email}
          onLoadingStatusChange={(status) => {
            if (status === 'error') handleError();
          }}
          style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
        />
      )}
      <AvatarPrimitive.Fallback
        delayMs={currentSrc ? 600 : 0}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: '100%',
          background: colors[0],
        }}
      >
        <span
          style={{
            color: '#ffffff',
            fontSize: size <= 24 ? 9 : size <= 32 ? 11 : size <= 40 ? 13 : 15,
            fontWeight: 600,
            fontFamily: 'var(--font-family)',
            letterSpacing: '0.03em',
            lineHeight: 1,
          }}
        >
          {initials}
        </span>
      </AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  );
}
