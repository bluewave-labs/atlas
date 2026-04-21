import { Router } from 'express';
import type { Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { getExchangeRate, getExchangeRates } from '../services/exchange-rate.service';
import { convertExchangeRate } from '../openapi/paths/misc';

const router = Router();
router.use(authMiddleware);

// GET /exchange-rates/convert?from=EUR&to=USD&amount=100
router.get('/convert', convertExchangeRate.validate, async (req: Request, res: Response) => {
  const from = (req.query.from as string).toUpperCase();
  const to = (req.query.to as string).toUpperCase();
  const amount = req.query.amount !== undefined ? Number(req.query.amount) : 1;

  const result = await getExchangeRate(from, to);
  if (!result) {
    return res.status(503).json({
      success: false,
      error: 'Exchange rate unavailable',
      code: 'RATE_UNAVAILABLE',
    });
  }

  return res.json({
    success: true,
    data: {
      from,
      to,
      rate: result.rate,
      amount,
      converted: Math.round(amount * result.rate * 100) / 100,
      provider: result.provider,
      cached: result.cached,
    },
  });
});

// GET /exchange-rates/rates?base=USD&targets=EUR,GBP,TRY
router.get('/rates', async (req: Request, res: Response) => {
  const base = (req.query.base as string)?.toUpperCase();
  const targetsStr = req.query.targets as string;

  if (!base || !targetsStr || base.length !== 3 || !/^[A-Z]{3}$/.test(base)) {
    return res.status(400).json({ success: false, error: 'Invalid currency code' });
  }

  const targets = targetsStr
    .split(',')
    .map((t) => t.trim().toUpperCase())
    .filter(Boolean);

  if (targets.length === 0 || targets.some((t) => t.length !== 3 || !/^[A-Z]{3}$/.test(t))) {
    return res.status(400).json({ success: false, error: 'Invalid currency code' });
  }

  const rates = await getExchangeRates(base, targets);

  // Check if any rate is unavailable
  const unavailable = Object.entries(rates).filter(([, v]) => v === null);
  if (unavailable.length === targets.length) {
    return res.status(503).json({
      success: false,
      error: 'Exchange rate unavailable',
      code: 'RATE_UNAVAILABLE',
    });
  }

  const ratesMap: Record<string, { rate: number; provider: string }> = {};
  for (const [currency, result] of Object.entries(rates)) {
    if (result) {
      ratesMap[currency] = { rate: result.rate, provider: result.provider };
    }
  }

  return res.json({
    success: true,
    data: {
      base,
      rates: ratesMap,
    },
  });
});

export const exchangeRateRoutes = router;
