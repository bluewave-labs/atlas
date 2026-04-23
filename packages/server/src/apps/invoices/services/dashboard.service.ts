import { db } from '../../../config/database';
import { sql } from 'drizzle-orm';
import { getInvoiceSettings } from './settings.service';

interface ReceivablesBuckets {
  total: number;
  current: number;
  overdue1to15: number;
  overdue16to30: number;
  overdue31to45: number;
  overdue45plus: number;
}

interface MonthlyActivity {
  month: string;
  invoiced: number;
  paid: number;
}

interface PeriodRow {
  invoiced: number;
  received: number;
  due: number;
}

interface PeriodSummary {
  today: PeriodRow;
  thisWeek: PeriodRow;
  thisMonth: PeriodRow;
  thisQuarter: PeriodRow;
  thisYear: PeriodRow;
}

export async function getInvoicesDashboard(tenantId: string, userIdFilter?: string) {
  const settings = await getInvoiceSettings(tenantId);
  const defaultCurrency = settings?.defaultCurrency ?? 'USD';

  const [receivables, monthlyActivity, periodSummary, excludedCount] = await Promise.all([
    getReceivables(tenantId, userIdFilter, defaultCurrency),
    getMonthlyActivity(tenantId, userIdFilter, defaultCurrency),
    getPeriodSummary(tenantId, userIdFilter, defaultCurrency),
    getExcludedCurrencyCount(tenantId, userIdFilter, defaultCurrency),
  ]);

  return { receivables, monthlyActivity, periodSummary, defaultCurrency, excludedCurrencyCount: excludedCount };
}

async function getExcludedCurrencyCount(tenantId: string, userIdFilter?: string, defaultCurrency = 'USD'): Promise<number> {
  const userClause = userIdFilter ? sql`AND user_id = ${userIdFilter}` : sql``;
  const result = await db.execute(sql`
    SELECT COUNT(*)::int AS cnt
    FROM invoices
    WHERE tenant_id = ${tenantId}
      AND currency != ${defaultCurrency}
      AND is_archived = false
      ${userClause}
  `);
  const row = result.rows[0] as { cnt: number };
  return Number(row?.cnt) || 0;
}

// ─── Receivables ────────────────────────────────────────────────────

async function getReceivables(tenantId: string, userIdFilter?: string, defaultCurrency = 'USD'): Promise<ReceivablesBuckets> {
  // Each bucket sums the outstanding balance (total - net payments) rather
  // than the raw invoice total so partial payments reduce the aging amounts.
  // Invoices with zero balance are excluded from every bucket.
  // Only invoices in the tenant's default currency are aggregated (audit #82).
  const userClause = userIdFilter ? sql`AND i.user_id = ${userIdFilter}` : sql``;
  const result = await db.execute(sql`
    WITH outstanding AS (
      SELECT
        i.id,
        i.due_date,
        i.total - COALESCE((
          SELECT SUM(CASE WHEN p.type = 'payment' THEN p.amount ELSE -p.amount END)
          FROM invoice_payments p
          WHERE p.invoice_id = i.id
        ), 0) AS balance_due
      FROM invoices i
      WHERE i.tenant_id = ${tenantId}
        AND i.currency = ${defaultCurrency}
        AND i.status IN ('sent', 'viewed', 'approved')
        AND i.is_archived = false
        ${userClause}
    )
    SELECT
      COALESCE(SUM(CASE WHEN balance_due > 0 THEN balance_due ELSE 0 END), 0) AS total,
      COALESCE(SUM(CASE WHEN balance_due > 0 AND due_date >= NOW() THEN balance_due ELSE 0 END), 0) AS current_amount,
      COALESCE(SUM(CASE WHEN balance_due > 0 AND due_date < NOW() AND due_date >= NOW() - INTERVAL '15 days' THEN balance_due ELSE 0 END), 0) AS overdue_1_15,
      COALESCE(SUM(CASE WHEN balance_due > 0 AND due_date < NOW() - INTERVAL '15 days' AND due_date >= NOW() - INTERVAL '30 days' THEN balance_due ELSE 0 END), 0) AS overdue_16_30,
      COALESCE(SUM(CASE WHEN balance_due > 0 AND due_date < NOW() - INTERVAL '30 days' AND due_date >= NOW() - INTERVAL '45 days' THEN balance_due ELSE 0 END), 0) AS overdue_31_45,
      COALESCE(SUM(CASE WHEN balance_due > 0 AND due_date < NOW() - INTERVAL '45 days' THEN balance_due ELSE 0 END), 0) AS overdue_45_plus
    FROM outstanding
  `);

  const row = result.rows[0] as Record<string, string>;
  return {
    total: Number(row.total) || 0,
    current: Number(row.current_amount) || 0,
    overdue1to15: Number(row.overdue_1_15) || 0,
    overdue16to30: Number(row.overdue_16_30) || 0,
    overdue31to45: Number(row.overdue_31_45) || 0,
    overdue45plus: Number(row.overdue_45_plus) || 0,
  };
}

// ─── Monthly Activity ───────────────────────────────────────────────

async function getMonthlyActivity(tenantId: string, userIdFilter?: string, defaultCurrency = 'USD'): Promise<MonthlyActivity[]> {
  const invoicedUserClause = userIdFilter ? sql`AND user_id = ${userIdFilter}` : sql``;
  const paymentsUserClause = userIdFilter ? sql`AND i.user_id = ${userIdFilter}` : sql``;

  // Get invoiced amounts by month (last 12 months), default currency only
  const invoicedResult = await db.execute(sql`
    SELECT
      TO_CHAR(DATE_TRUNC('month', issue_date), 'YYYY-MM') AS month,
      COALESCE(SUM(total), 0) AS amount
    FROM invoices
    WHERE tenant_id = ${tenantId}
      AND currency = ${defaultCurrency}
      AND status != 'draft'
      AND is_archived = false
      AND issue_date >= DATE_TRUNC('month', NOW()) - INTERVAL '11 months'
      ${invoicedUserClause}
    GROUP BY DATE_TRUNC('month', issue_date)
    ORDER BY month
  `);

  // Get received amounts by month (last 12 months) from invoice_payments.
  // Sum payments minus refunds so partial payments and refunds are reflected.
  const paidResult = await db.execute(sql`
    SELECT
      TO_CHAR(DATE_TRUNC('month', p.payment_date), 'YYYY-MM') AS month,
      COALESCE(SUM(CASE WHEN p.type = 'payment' THEN p.amount ELSE -p.amount END), 0) AS amount
    FROM invoice_payments p
    INNER JOIN invoices i ON i.id = p.invoice_id
    WHERE p.tenant_id = ${tenantId}
      AND i.currency = ${defaultCurrency}
      AND i.is_archived = false
      AND p.payment_date >= DATE_TRUNC('month', NOW()) - INTERVAL '11 months'
      ${paymentsUserClause}
    GROUP BY DATE_TRUNC('month', p.payment_date)
    ORDER BY month
  `);

  // Build a map of all 12 months
  const months: Map<string, MonthlyActivity> = new Map();
  for (let i = 11; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    months.set(key, { month: key, invoiced: 0, paid: 0 });
  }

  for (const row of invoicedResult.rows as Array<{ month: string; amount: string }>) {
    const entry = months.get(row.month);
    if (entry) entry.invoiced = Number(row.amount) || 0;
  }

  for (const row of paidResult.rows as Array<{ month: string; amount: string }>) {
    const entry = months.get(row.month);
    if (entry) entry.paid = Number(row.amount) || 0;
  }

  return Array.from(months.values());
}

// ─── Period Summary ─────────────────────────────────────────────────

async function getPeriodSummary(tenantId: string, userIdFilter?: string, defaultCurrency = 'USD'): Promise<PeriodSummary> {
  const invoicedUserClause = userIdFilter ? sql`AND user_id = ${userIdFilter}` : sql``;
  const paymentsUserClause = userIdFilter ? sql`AND i.user_id = ${userIdFilter}` : sql``;

  // "Invoiced" totals — default currency only (audit #82)
  const invoicedResult = await db.execute(sql`
    SELECT
      COALESCE(SUM(CASE WHEN issue_date::date = CURRENT_DATE AND status != 'draft' THEN total ELSE 0 END), 0) AS today_invoiced,
      COALESCE(SUM(CASE WHEN issue_date >= DATE_TRUNC('week', NOW()) AND status != 'draft' THEN total ELSE 0 END), 0) AS week_invoiced,
      COALESCE(SUM(CASE WHEN issue_date >= DATE_TRUNC('month', NOW()) AND status != 'draft' THEN total ELSE 0 END), 0) AS month_invoiced,
      COALESCE(SUM(CASE WHEN issue_date >= DATE_TRUNC('quarter', NOW()) AND status != 'draft' THEN total ELSE 0 END), 0) AS quarter_invoiced,
      COALESCE(SUM(CASE WHEN issue_date >= DATE_TRUNC('year', NOW()) AND status != 'draft' THEN total ELSE 0 END), 0) AS year_invoiced
    FROM invoices
    WHERE tenant_id = ${tenantId}
      AND currency = ${defaultCurrency}
      AND is_archived = false
      ${invoicedUserClause}
  `);

  // "Received" totals — default currency only (audit #82)
  const receivedResult = await db.execute(sql`
    SELECT
      COALESCE(SUM(CASE WHEN p.payment_date::date = CURRENT_DATE THEN (CASE WHEN p.type = 'payment' THEN p.amount ELSE -p.amount END) ELSE 0 END), 0) AS today_received,
      COALESCE(SUM(CASE WHEN p.payment_date >= DATE_TRUNC('week', NOW()) THEN (CASE WHEN p.type = 'payment' THEN p.amount ELSE -p.amount END) ELSE 0 END), 0) AS week_received,
      COALESCE(SUM(CASE WHEN p.payment_date >= DATE_TRUNC('month', NOW()) THEN (CASE WHEN p.type = 'payment' THEN p.amount ELSE -p.amount END) ELSE 0 END), 0) AS month_received,
      COALESCE(SUM(CASE WHEN p.payment_date >= DATE_TRUNC('quarter', NOW()) THEN (CASE WHEN p.type = 'payment' THEN p.amount ELSE -p.amount END) ELSE 0 END), 0) AS quarter_received,
      COALESCE(SUM(CASE WHEN p.payment_date >= DATE_TRUNC('year', NOW()) THEN (CASE WHEN p.type = 'payment' THEN p.amount ELSE -p.amount END) ELSE 0 END), 0) AS year_received
    FROM invoice_payments p
    INNER JOIN invoices i ON i.id = p.invoice_id
    WHERE p.tenant_id = ${tenantId}
      AND i.currency = ${defaultCurrency}
      AND i.is_archived = false
      ${paymentsUserClause}
  `);

  const row = {
    ...(invoicedResult.rows[0] as Record<string, string>),
    ...(receivedResult.rows[0] as Record<string, string>),
  };

  function buildPeriod(prefix: string): PeriodRow {
    const invoiced = Number(row[`${prefix}_invoiced`]) || 0;
    const received = Number(row[`${prefix}_received`]) || 0;
    return { invoiced, received, due: invoiced - received };
  }

  return {
    today: buildPeriod('today'),
    thisWeek: buildPeriod('week'),
    thisMonth: buildPeriod('month'),
    thisQuarter: buildPeriod('quarter'),
    thisYear: buildPeriod('year'),
  };
}
