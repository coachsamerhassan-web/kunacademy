import { NextResponse, type NextRequest } from 'next/server';
import { withAdminContext } from '@kunacademy/db';
import { payments } from '@kunacademy/db/schema';
import { and, desc, gte, lte, eq, or, sql } from 'drizzle-orm';
import { getAuthUser } from '@kunacademy/auth/server';

// ─── Date helpers ─────────────────────────────────────────────────────────────

/**
 * Parse a date string strictly: rejects inputs where the YYYY-MM-DD parts
 * don't round-trip (e.g. "2025-02-30" silently rolls to March in native Date).
 */
function parseStrictDate(input: string | null): Date | null {
  if (!input) return null;
  // Require at least a YYYY-MM-DD prefix
  const match = input.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const [, y, m, d] = match;
  const date = new Date(input);
  if (isNaN(date.getTime())) return null;
  // Confirm no month rollover — UTC parts must match the supplied values exactly
  if (
    date.getUTCFullYear() !== parseInt(y, 10) ||
    date.getUTCMonth() + 1 !== parseInt(m, 10) ||
    date.getUTCDate() !== parseInt(d, 10)
  ) {
    return null;
  }
  return date;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ALLOWED_GATEWAYS = ['stripe', 'tabby', 'instapay', 'paytabs'] as const;
const ALLOWED_STATUSES = ['pending', 'completed', 'failed', 'refunded'] as const;
type Gateway = (typeof ALLOWED_GATEWAYS)[number];
type Status = (typeof ALLOWED_STATUSES)[number];

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 500;

// ─── Auth helper (mirrors instapay/route.ts) ──────────────────────────────────

function isAdmin(role: string | undefined): boolean {
  return role === 'admin' || role === 'super_admin';
}

// ─── CSV helpers ──────────────────────────────────────────────────────────────

/** Prevent CSV/Excel formula injection. Wrap every cell in quotes, double internal quotes. */
function csvCell(value: unknown): string {
  const str = value === null || value === undefined ? '' : String(value);
  // Prefix formula-injection triggers with a single quote
  const safe = /^[=+\-@]/.test(str) ? `'${str}` : str;
  // Wrap in double-quotes and escape any embedded double-quotes
  return `"${safe.replace(/"/g, '""')}"`;
}

const CSV_HEADERS = [
  'id',
  'created_at',
  'order_id',
  'booking_id',
  'amount',
  'currency',
  'gateway',
  'status',
  'gateway_payment_id',
] as const;

type PaymentRow = Pick<
  typeof payments.$inferSelect,
  'id' | 'created_at' | 'order_id' | 'booking_id' | 'amount' | 'currency' | 'gateway' | 'status' | 'gateway_payment_id'
>;

function rowToCsv(row: PaymentRow): string {
  return [
    csvCell(row.id),
    csvCell(row.created_at),
    csvCell(row.order_id),
    csvCell(row.booking_id),
    csvCell(row.amount),
    csvCell(row.currency),
    csvCell(row.gateway),
    csvCell(row.status),
    csvCell(row.gateway_payment_id),
  ].join(',');
}

// ─── GET /api/admin/payments ──────────────────────────────────────────────────

/**
 * Query params (all optional):
 *   from     — ISO date string, lower bound on created_at
 *   to       — ISO date string, upper bound on created_at
 *   gateway  — one of: stripe | tabby | instapay | paytabs
 *   status   — one of: pending | completed | failed | refunded
 *   q        — search on metadata item_id or user_id (exact-ish via LIKE)
 *   format   — "json" (default) | "csv"
 *   limit    — default 50, max 500
 *   offset   — default 0
 */
export async function GET(request: NextRequest) {
  try {
    // ── Auth ──────────────────────────────────────────────────────────────────
    const sessionUser = await getAuthUser();
    if (!sessionUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!isAdmin(sessionUser.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // ── Parse & validate query params ─────────────────────────────────────────
    const { searchParams } = request.nextUrl;

    // limit / offset
    const rawLimit = searchParams.get('limit');
    const rawOffset = searchParams.get('offset');
    const limit = rawLimit ? Math.min(parseInt(rawLimit, 10), MAX_LIMIT) : DEFAULT_LIMIT;
    const offset = rawOffset ? parseInt(rawOffset, 10) : 0;
    if (isNaN(limit) || isNaN(offset) || limit < 1 || offset < 0) {
      return NextResponse.json({ error: 'Invalid limit or offset' }, { status: 400 });
    }

    // from / to — use strict parser to reject calendar-invalid dates (e.g. Feb 30)
    const fromParam = searchParams.get('from');
    const toParam = searchParams.get('to');
    const fromDate = fromParam ? parseStrictDate(fromParam) : null;
    const toDate = toParam ? parseStrictDate(toParam) : null;
    if (fromParam && fromDate === null) {
      return NextResponse.json({ error: 'Invalid from/to date' }, { status: 400 });
    }
    if (toParam && toDate === null) {
      return NextResponse.json({ error: 'Invalid from/to date' }, { status: 400 });
    }

    // gateway — explicit empty string check: ?gateway= must be rejected, not silently ignored
    const gatewayParam = searchParams.get('gateway');
    if (gatewayParam !== null) {
      if (
        gatewayParam.trim() === '' ||
        !(ALLOWED_GATEWAYS as readonly string[]).includes(gatewayParam)
      ) {
        return NextResponse.json(
          { error: `Invalid gateway. Allowed: ${ALLOWED_GATEWAYS.join(', ')}` },
          { status: 400 }
        );
      }
    }
    const gateway = gatewayParam as Gateway | null;

    // status — same empty string guard
    const statusParam = searchParams.get('status');
    if (statusParam !== null) {
      if (
        statusParam.trim() === '' ||
        !(ALLOWED_STATUSES as readonly string[]).includes(statusParam)
      ) {
        return NextResponse.json(
          { error: `Invalid status. Allowed: ${ALLOWED_STATUSES.join(', ')}` },
          { status: 400 }
        );
      }
    }
    const statusFilter = statusParam as Status | null;

    // q — free-text search on metadata fields (item_id, user_id)
    const q = searchParams.get('q')?.trim() ?? null;

    // format
    const format = searchParams.get('format') === 'csv' ? 'csv' : 'json';

    // ── Build Drizzle filter conditions ───────────────────────────────────────
    const conditions = [];

    if (fromDate) {
      conditions.push(gte(payments.created_at, fromDate.toISOString()));
    }
    if (toDate) {
      conditions.push(lte(payments.created_at, toDate.toISOString()));
    }
    if (gateway) {
      conditions.push(eq(payments.gateway, gateway));
    }
    if (statusFilter) {
      conditions.push(eq(payments.status, statusFilter));
    }
    if (q) {
      // Search within metadata jsonb for item_id or user_id.
      // Using sql template tag — fully parameterized, no raw string injection.
      const pattern = `%${q}%`;
      conditions.push(
        or(
          sql`${payments.metadata}->>'item_id' ILIKE ${pattern}`,
          sql`${payments.metadata}->>'user_id' ILIKE ${pattern}`
        )
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // ── Query — explicit column select: prevents accidental PII leak via future schema additions ──
    const data = await withAdminContext(async (db) => {
      return db
        .select({
          id: payments.id,
          created_at: payments.created_at,
          order_id: payments.order_id,
          booking_id: payments.booking_id,
          amount: payments.amount,
          currency: payments.currency,
          gateway: payments.gateway,
          status: payments.status,
          gateway_payment_id: payments.gateway_payment_id,
        })
        .from(payments)
        .where(whereClause)
        .orderBy(desc(payments.created_at))
        .limit(limit)
        .offset(offset);
    });

    // ── Response ──────────────────────────────────────────────────────────────
    if (format === 'csv') {
      const headerRow = CSV_HEADERS.join(',');
      const rows = (data as PaymentRow[]).map(rowToCsv);
      const csvBody = [headerRow, ...rows].join('\n');

      return new Response(csvBody, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="payments-${Date.now()}.csv"`,
        },
      });
    }

    return NextResponse.json({
      payments: data,
      meta: {
        limit,
        offset,
        count: (data as unknown[]).length,
      },
    });
  } catch (err: unknown) {
    console.error('[api/admin/payments]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
