import { Router } from 'express';
import type { Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { getExchangeRate, getExchangeRates } from '../services/exchange-rate.service';

const router = Router();
router.use(authMiddleware);

// GET /exchange-rates/convert?from=EUR&to=USD&amount=100
router.get('/convert', async (req: Request, res: Response) => {
  const from = (req.query.from as string)?.toUpperCase();
  const to = (req.query.to as string)?.toUpperCase();
  const amountStr = req.query.amount as string;

  if (!from || !to) {
    return res.status(400).json({
      success: false,
      error: 'Missing required query params: from, to',
    });
  }

  const amount = amountStr ? parseFloat(amountStr) : 1;
  if (isNaN(amount)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid amount',
    });
  }

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

  if (!base || !targetsStr) {
    return res.status(400).json({
      success: false,
      error: 'Missing required query params: base, targets',
    });
  }

  const targets = targetsStr
    .split(',')
    .map((t) => t.trim().toUpperCase())
    .filter(Boolean);

  if (targets.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'No valid targets provided',
    });
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
