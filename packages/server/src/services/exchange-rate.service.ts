import { eq, and, gt } from 'drizzle-orm';
import { db } from '../config/database';
import { exchangeRates } from '../db/schema';
import { logger } from '../utils/logger';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const FETCH_TIMEOUT_MS = 5000;

interface RateResult {
  rate: number;
  provider: string;
  cached: boolean;
}

// ─── Provider: Frankfurter (ECB data, free, no key) ─────────────────

async function fetchFromFrankfurter(
  base: string,
  target: string,
): Promise<{ rate: number; provider: string } | null> {
  try {
    const res = await fetch(
      `https://api.frankfurter.dev/v1/latest?base=${base}&symbols=${target}`,
      { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { rates?: Record<string, number> };
    const rate = data.rates?.[target];
    if (typeof rate !== 'number') return null;
    return { rate, provider: 'frankfurter' };
  } catch (err) {
    logger.warn({ err, base, target }, 'Frankfurter API failed');
    return null;
  }
}

// ─── Provider: Open Exchange Rates (free tier, no key) ──────────────

async function fetchFromOpenER(
  base: string,
  target: string,
): Promise<{ rate: number; provider: string } | null> {
  try {
    const res = await fetch(
      `https://open.er-api.com/v6/latest/${base}`,
      { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { rates?: Record<string, number> };
    const rate = data.rates?.[target];
    if (typeof rate !== 'number') return null;
    return { rate, provider: 'open-er' };
  } catch (err) {
    logger.warn({ err, base, target }, 'Open ER API failed');
    return null;
  }
}

// ─── DB cache helpers ───────────────────────────────────────────────

async function getCachedRate(
  base: string,
  target: string,
  maxAge?: Date,
): Promise<RateResult | null> {
  try {
    const conditions = [
      eq(exchangeRates.baseCurrency, base),
      eq(exchangeRates.targetCurrency, target),
    ];
    if (maxAge) {
      conditions.push(gt(exchangeRates.fetchedAt, maxAge));
    }

    const rows = await db
      .select()
      .from(exchangeRates)
      .where(and(...conditions))
      .orderBy(exchangeRates.fetchedAt)
      .limit(1);

    if (rows.length === 0) return null;
    const row = rows[0];
    return { rate: row.rate, provider: row.provider, cached: true };
  } catch (err) {
    logger.error({ err }, 'Failed to read exchange rate cache');
    return null;
  }
}

async function cacheRate(
  base: string,
  target: string,
  rate: number,
  provider: string,
): Promise<void> {
  try {
    await db.insert(exchangeRates).values({
      baseCurrency: base,
      targetCurrency: target,
      rate,
      provider,
    });
  } catch (err) {
    logger.error({ err }, 'Failed to cache exchange rate');
  }
}

// ─── Public API ─────────────────────────────────────────────────────

export async function getExchangeRate(
  base: string,
  target: string,
): Promise<RateResult | null> {
  const b = base.toUpperCase();
  const t = target.toUpperCase();

  // Same-currency shortcut
  if (b === t) return { rate: 1.0, provider: 'identity', cached: false };

  // 1. Check fresh cache (24h)
  const freshCutoff = new Date(Date.now() - CACHE_TTL_MS);
  const fresh = await getCachedRate(b, t, freshCutoff);
  if (fresh) return fresh;

  // 2. Try providers in order
  const providers = [fetchFromFrankfurter, fetchFromOpenER];
  for (const fetchFn of providers) {
    const result = await fetchFn(b, t);
    if (result) {
      await cacheRate(b, t, result.rate, result.provider);
      return { ...result, cached: false };
    }
  }

  // 3. Stale cache fallback (any age)
  const stale = await getCachedRate(b, t);
  if (stale) {
    logger.warn({ base: b, target: t }, 'Using stale exchange rate');
    return stale;
  }

  // 4. Nothing works
  logger.error({ base: b, target: t }, 'All exchange rate sources failed');
  return null;
}

export async function getExchangeRates(
  base: string,
  targets: string[],
): Promise<Record<string, RateResult | null>> {
  const results = await Promise.all(
    targets.map(async (t) => {
      const rate = await getExchangeRate(base, t);
      return [t.toUpperCase(), rate] as const;
    }),
  );
  return Object.fromEntries(results);
}
