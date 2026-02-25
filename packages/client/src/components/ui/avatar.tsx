import { useState, useCallback, useRef } from 'react';
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

// ─── Inline MD5 for Gravatar ────────────────────────────────────────
// Minimal MD5 implementation (RFC 1321).  Only used to hash email addresses
// for Gravatar URLs — not for any security purpose.

function md5(input: string): string {
  function toUtf8(s: string): number[] {
    const buf: number[] = [];
    for (let i = 0; i < s.length; i++) {
      let c = s.charCodeAt(i);
      if (c < 0x80) buf.push(c);
      else if (c < 0x800) { buf.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f)); }
      else if (c < 0x10000) { buf.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f)); }
      else { c -= 0x10000; buf.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 0x3f), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f)); }
    }
    return buf;
  }

  const bytes = toUtf8(input);
  const origLen = bytes.length;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  const bitLen = origLen * 8;
  bytes.push(bitLen & 0xff, (bitLen >>> 8) & 0xff, (bitLen >>> 16) & 0xff, (bitLen >>> 24) & 0xff, 0, 0, 0, 0);

  let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
  const S = [
    7,12,17,22,7,12,17,22,7,12,17,22,7,12,17,22,
    5,9,14,20,5,9,14,20,5,9,14,20,5,9,14,20,
    4,11,16,23,4,11,16,23,4,11,16,23,4,11,16,23,
    6,10,15,21,6,10,15,21,6,10,15,21,6,10,15,21,
  ];
  const K = [
    0xd76aa478,0xe8c7b756,0x242070db,0xc1bdceee,0xf57c0faf,0x4787c62a,0xa8304613,0xfd469501,
    0x698098d8,0x8b44f7af,0xffff5bb1,0x895cd7be,0x6b901122,0xfd987193,0xa679438e,0x49b40821,
    0xf61e2562,0xc040b340,0x265e5a51,0xe9b6c7aa,0xd62f105d,0x02441453,0xd8a1e681,0xe7d3fbc8,
    0x21e1cde6,0xc33707d6,0xf4d50d87,0x455a14ed,0xa9e3e905,0xfcefa3f8,0x676f02d9,0x8d2a4c8a,
    0xfffa3942,0x8771f681,0x6d9d6122,0xfde5380c,0xa4beea44,0x4bdecfa9,0xf6bb4b60,0xbebfbc70,
    0x289b7ec6,0xeaa127fa,0xd4ef3085,0x04881d05,0xd9d4d039,0xe6db99e5,0x1fa27cf8,0xc4ac5665,
    0xf4292244,0x432aff97,0xab9423a7,0xfc93a039,0x655b59c3,0x8f0ccc92,0xffeff47d,0x85845dd1,
    0x6fa87e4f,0xfe2ce6e0,0xa3014314,0x4e0811a1,0xf7537e82,0xbd3af235,0x2ad7d2bb,0xeb86d391,
  ];

  for (let i = 0; i < bytes.length; i += 64) {
    const M = new Array(16);
    for (let j = 0; j < 16; j++) {
      M[j] = bytes[i + j * 4] | (bytes[i + j * 4 + 1] << 8) | (bytes[i + j * 4 + 2] << 16) | (bytes[i + j * 4 + 3] << 24);
    }
    let A = a0, B = b0, C = c0, D = d0;
    for (let j = 0; j < 64; j++) {
      let F: number, g: number;
      if (j < 16) { F = (B & C) | (~B & D); g = j; }
      else if (j < 32) { F = (D & B) | (~D & C); g = (5 * j + 1) % 16; }
      else if (j < 48) { F = B ^ C ^ D; g = (3 * j + 5) % 16; }
      else { F = C ^ (B | ~D); g = (7 * j) % 16; }
      F = (F + A + K[j] + M[g]) >>> 0;
      A = D; D = C; C = B;
      B = (B + ((F << S[j]) | (F >>> (32 - S[j])))) >>> 0;
    }
    a0 = (a0 + A) >>> 0; b0 = (b0 + B) >>> 0; c0 = (c0 + C) >>> 0; d0 = (d0 + D) >>> 0;
  }

  function toHex(n: number): string {
    let s = '';
    for (let i = 0; i < 4; i++) s += ((n >> (i * 8)) & 0xff).toString(16).padStart(2, '0');
    return s;
  }
  return toHex(a0) + toHex(b0) + toHex(c0) + toHex(d0);
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

function getGravatarUrl(email: string | undefined, size: number): string | null {
  if (!email) return null;
  const hash = md5(email.trim().toLowerCase());
  const sz = Math.max(size * 2, 64); // 2x for retina, min 64
  return `https://gravatar.com/avatar/${hash}?d=404&s=${sz}`;
}

function getDomain(email: string | undefined): string | null {
  if (!email) return null;
  const atIndex = email.lastIndexOf('@');
  if (atIndex < 0) return null;
  const domain = email.substring(atIndex + 1).toLowerCase();
  if (!domain || FREEMAIL_DOMAINS.has(domain)) return null;
  return domain;
}

function getClearbitLogoUrl(email: string | undefined): string | null {
  const domain = getDomain(email);
  if (!domain) return null;
  return `https://logo.clearbit.com/${encodeURIComponent(domain)}`;
}

function getFaviconUrl(email: string | undefined, size: number): string | null {
  const domain = getDomain(email);
  if (!domain) return null;
  // Skip favicon for large avatars — favicons are inherently low-res
  if (size > 40) return null;
  const sz = Math.min(64, Math.max(32, size * 2));
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=${sz}`;
}

/**
 * Build the ordered list of image URLs to try.
 * Priority: explicit src → Gravatar → Clearbit Logo → Google Favicon
 */
function buildImageCandidates(
  src: string | null | undefined,
  email: string | undefined,
  size: number,
): string[] {
  const urls: string[] = [];
  if (src) urls.push(src);

  const gravatar = getGravatarUrl(email, size);
  if (gravatar) urls.push(gravatar);

  const clearbit = getClearbitLogoUrl(email);
  if (clearbit) urls.push(clearbit);

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
