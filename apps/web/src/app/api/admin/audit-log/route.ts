/**
 * GET /api/admin/audit-log
 *
 * Paginated, filterable audit log for compliance and debugging.
 *
 * Auth: role in ['admin', 'super_admin'] — NOT mentor_manager (more sensitive).
 *
 * Query params:
 *   ?action=<AuditAction>           — single action, or comma-separated list
 *   ?actor_id=<uuid>                — filter by actor (admin who performed action)
 *   ?target_type=<string>           — filter by target entity type
 *   ?target_id=<uuid>               — filter by target entity id
 *   ?from=<iso>                     — created_at >= from (inclusive)
 *   ?to=<iso>                       — created_at <= to (inclusive)
 *   ?limit=50                       — rows per page (default 50, max 500)
 *   ?offset=0                       — pagination offset
 *
 * Returns: { rows: AuditLogRow[], total: number, has_more: boolean }
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminContext, sql } from '@kunacademy/db';
import { getAuthUser } from '@kunacademy/auth/server';
import type { AuditAction } from '@kunacademy/db';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_RE  = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?(\.\d+)?Z?)?$/;

const ADMIN_ROLES  = new Set(['admin', 'super_admin']);
const DEFAULT_LIMIT = 50;
const MAX_LIMIT     = 500;

// All valid AuditAction values — mirrors packages/db/src/audit.ts union.
// Kept here to avoid importing the union type for runtime validation.
const VALID_ACTIONS = new Set<string>([
  'CREATE_BOOKING', 'UPDATE_BOOKING', 'CANCEL_BOOKING', 'REVOKE_GUEST_TOKEN',
  'APPROVE_PAYOUT', 'REJECT_PAYOUT', 'COMPLETE_PAYOUT',
  'UPDATE_ORDER', 'REFUND_ORDER',
  'UPDATE_ENROLLMENT', 'CREATE_ENROLLMENT',
  'UPDATE_COMMISSION', 'CREATE_COMMISSION',
  'DELETE_POST', 'UPDATE_POST',
  'APPROVE_COACH', 'REJECT_COACH',
  'DECRYPT_BANK_DETAILS',
  'UPDATE_PROFILE_ROLE',
  'CREATE_BLOG_POST', 'UPDATE_BLOG_POST', 'DELETE_BLOG_POST',
  'UPDATE_TESTIMONIAL', 'DELETE_TESTIMONIAL',
  'SUBMIT_ASSESSMENT',
  'OVERRIDE_ASSESSMENT_DECISION',
  'OVERRIDE_AUTO_UNPAUSE',
  'REQUEST_SECOND_OPINION',
  'RESOLVE_SECOND_OPINION',
  'PAUSE_JOURNEY',
  'UNPAUSE_JOURNEY',
]);

export interface AuditLogRow {
  id: string;
  action: AuditAction;
  actor_id: string | null;
  actor_name: string | null;
  actor_email: string | null;
  target_type: string | null;
  target_id: string | null;
  metadata: Record<string, unknown>;
  ip_address: string | null;
  created_at: string;
}

export async function GET(request: NextRequest) {
  // ── Auth: admin / super_admin only ─────────────────────────────────────────
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!ADMIN_ROLES.has(user.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // ── Parse & validate query params ─────────────────────────────────────────
  const sp = new URL(request.url).searchParams;

  // action — single or comma-separated; whitelist-validated
  const actionParam = sp.get('action') ?? '';
  const actionList  = actionParam
    ? actionParam.split(',').map(s => s.trim()).filter(s => VALID_ACTIONS.has(s))
    : [];

  // actor_id — UUID
  const actorIdParam = sp.get('actor_id') ?? '';
  const actorId = actorIdParam && UUID_RE.test(actorIdParam) ? actorIdParam : null;

  // target_type — free text, sanitise to alphanumeric + underscore only
  const targetTypeParam = sp.get('target_type') ?? '';
  const targetType = /^[a-z_A-Z0-9]{1,64}$/.test(targetTypeParam) ? targetTypeParam : null;

  // target_id — UUID
  const targetIdParam = sp.get('target_id') ?? '';
  const targetId = targetIdParam && UUID_RE.test(targetIdParam) ? targetIdParam : null;

  // from / to — ISO dates
  const fromParam = sp.get('from') ?? '';
  const toParam   = sp.get('to') ?? '';
  const from = fromParam && ISO_RE.test(fromParam) ? fromParam : null;
  const to   = toParam   && ISO_RE.test(toParam)   ? toParam   : null;

  // limit / offset
  const limitRaw  = parseInt(sp.get('limit')  ?? String(DEFAULT_LIMIT), 10);
  const offsetRaw = parseInt(sp.get('offset') ?? '0', 10);
  const limit  = isNaN(limitRaw)  || limitRaw  < 1 ? DEFAULT_LIMIT : Math.min(limitRaw, MAX_LIMIT);
  const offset = isNaN(offsetRaw) || offsetRaw < 0 ? 0 : offsetRaw;

  // ── Build WHERE clauses ────────────────────────────────────────────────────
  // Using raw SQL with parameterised template literals (drizzle sql tag).
  // Conditions are assembled as fragments and AND-joined.
  const conditions: ReturnType<typeof sql>[] = [];

  if (actionList.length > 0) {
    // action IN (...) — safe because we whitelist against VALID_ACTIONS
    const inList = actionList.map(a => `'${a}'`).join(', ');
    conditions.push(sql.raw(`al.action IN (${inList})`));
  }
  if (actorId) {
    conditions.push(sql`al.admin_id = ${actorId}::uuid`);
  }
  if (targetType) {
    conditions.push(sql`al.target_type = ${targetType}`);
  }
  if (targetId) {
    conditions.push(sql`al.target_id = ${targetId}`);
  }
  if (from) {
    conditions.push(sql`al.created_at >= ${from}::timestamptz`);
  }
  if (to) {
    conditions.push(sql`al.created_at <= ${to}::timestamptz`);
  }

  // ── Execute queries ─────────────────────────────────────────────────────────
  try {
    const { rows, total } = await withAdminContext(async (db) => {
      // Build WHERE sql fragment by hand — drizzle sql tag handles parameterisation.
      // We pass each condition as a separate tagged template and combine.

      // Helper: build a flat SQL for the query given the filter state.
      // Drizzle's sql`` tag supports nested sql`` fragments via template interpolation.
      const baseSelect = sql`
        SELECT
          al.id,
          al.action,
          al.admin_id                                AS actor_id,
          COALESCE(p.full_name_en, p.full_name_ar)   AS actor_name,
          p.email                                    AS actor_email,
          al.target_type,
          al.target_id,
          al.metadata,
          al.ip_address,
          al.created_at
        FROM admin_audit_log al
        LEFT JOIN profiles p ON p.id = al.admin_id
      `;

      const orderPaginateSql = sql`
        ORDER BY al.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;

      // Build the WHERE fragment dynamically — we collect sql fragments and
      // emit them. Drizzle's sql`` interpolates sql`` fragments correctly.
      let dataQuery: ReturnType<typeof sql>;
      let countQuery: ReturnType<typeof sql>;

      if (conditions.length === 0) {
        dataQuery  = sql`${baseSelect} ${orderPaginateSql}`;
        countQuery = sql`SELECT COUNT(*) AS cnt FROM admin_audit_log al`;
      } else {
        // Combine conditions using sql`` interpolation (each condition is a sql fragment)
        const combinedWhere = conditions.reduce((acc, cond, i) =>
          i === 0 ? cond : sql`${acc} AND ${cond}`
        );

        dataQuery  = sql`${baseSelect} WHERE ${combinedWhere} ${orderPaginateSql}`;
        countQuery = sql`
          SELECT COUNT(*) AS cnt
          FROM admin_audit_log al
          WHERE ${combinedWhere}
        `;
      }

      const [dataResult, countResult] = await Promise.all([
        db.execute(dataQuery),
        db.execute(countQuery),
      ]);

      const rowsData = dataResult.rows as AuditLogRow[];
      const totalCount = Number((countResult.rows[0] as { cnt: string }).cnt);

      return { rows: rowsData, total: totalCount };
    });

    return NextResponse.json({
      rows,
      total,
      has_more: offset + limit < total,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[GET /api/admin/audit-log] Error:', msg);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
