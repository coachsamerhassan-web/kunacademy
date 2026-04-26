/**
 * GET /api/admin/membership/lifecycle — Wave F.6
 *
 * Admin observability for membership lifecycle. Returns four sections:
 *   1. dunning queue       — memberships in past_due (revenue at risk)
 *   2. upcoming cancels    — memberships with cancel_at set, not yet swept
 *   3. recent grace sweeps — last 50 grace_sweep events
 *   4. recent reminders    — last 50 reminder/dunning/winback events
 *
 * Auth: admin | super_admin via getAuthUser(). Unauthed → 401; non-admin → 403.
 *
 * Optional `?format=csv&section=<section>` exports a section as CSV.
 */

import { NextRequest, NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { withAdminContext } from '@kunacademy/db';
import { getAuthUser } from '@kunacademy/auth/server';

function isAdmin(role: string | undefined): boolean {
  return role === 'admin' || role === 'super_admin';
}

interface DunningRow {
  membership_id: string;
  email: string | null;
  full_name_ar: string | null;
  full_name_en: string | null;
  status: string;
  current_period_end: string | null;
  tier_slug: string;
}

interface UpcomingCancelRow {
  membership_id: string;
  email: string | null;
  full_name_ar: string | null;
  full_name_en: string | null;
  cancel_at: string;
  cancel_reason: string | null;
  tier_slug: string;
}

interface LifecycleEventRow {
  id: string;
  membership_id: string;
  user_id: string | null;
  event_type: string;
  send_key: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
  email: string | null;
}

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = typeof v === 'string' ? v : JSON.stringify(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCSV(rows: Record<string, unknown>[], headers: string[]): string {
  const lines = [headers.join(',')];
  for (const r of rows) {
    lines.push(headers.map((h) => csvEscape(r[h])).join(','));
  }
  return lines.join('\n');
}

export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdmin(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const url = new URL(req.url);
  const format = url.searchParams.get('format');
  const section = url.searchParams.get('section');

  const dunning = await withAdminContext(async (db) => {
    const r = await db.execute(sql`
      SELECT
        m.id                           AS membership_id,
        p.email,
        p.full_name_ar,
        p.full_name_en,
        m.status,
        m.current_period_end,
        t.slug                         AS tier_slug
      FROM memberships m
      JOIN tiers t ON t.id = m.tier_id
      LEFT JOIN profiles p ON p.id = m.user_id
      WHERE m.status = 'past_due'
        AND m.ended_at IS NULL
      ORDER BY m.updated_at DESC
      LIMIT 200
    `);
    return r.rows as DunningRow[];
  });

  const upcomingCancels = await withAdminContext(async (db) => {
    const r = await db.execute(sql`
      SELECT
        m.id                           AS membership_id,
        p.email,
        p.full_name_ar,
        p.full_name_en,
        m.cancel_at,
        m.cancel_reason,
        t.slug                         AS tier_slug
      FROM memberships m
      JOIN tiers t ON t.id = m.tier_id
      LEFT JOIN profiles p ON p.id = m.user_id
      WHERE m.cancel_at IS NOT NULL
        AND m.ended_at IS NULL
      ORDER BY m.cancel_at ASC
      LIMIT 200
    `);
    return r.rows as UpcomingCancelRow[];
  });

  const graceSweeps = await withAdminContext(async (db) => {
    const r = await db.execute(sql`
      SELECT e.id, e.membership_id, e.user_id, e.event_type, e.send_key,
             e.metadata, e.created_at,
             p.email
      FROM membership_lifecycle_events e
      LEFT JOIN profiles p ON p.id = e.user_id
      WHERE e.event_type = 'cancel_effective_grace_swept'
      ORDER BY e.created_at DESC
      LIMIT 50
    `);
    return r.rows as LifecycleEventRow[];
  });

  const recentReminders = await withAdminContext(async (db) => {
    const r = await db.execute(sql`
      SELECT e.id, e.membership_id, e.user_id, e.event_type, e.send_key,
             e.metadata, e.created_at,
             p.email
      FROM membership_lifecycle_events e
      LEFT JOIN profiles p ON p.id = e.user_id
      WHERE e.event_type IN (
        'renewal_reminder_t7',
        'renewal_reminder_t1',
        'dunning_payment_failed',
        'dunning_back_in_good_standing',
        'dunning_payment_failed_final',
        'winback_30d',
        'cancel_requested',
        'reactivated'
      )
      ORDER BY e.created_at DESC
      LIMIT 100
    `);
    return r.rows as LifecycleEventRow[];
  });

  if (format === 'csv') {
    let rows: Record<string, unknown>[] = [];
    let headers: string[] = [];
    let filename = 'membership-lifecycle.csv';
    switch (section) {
      case 'dunning':
        rows = dunning as unknown as Record<string, unknown>[];
        headers = ['membership_id', 'email', 'full_name_ar', 'full_name_en', 'status', 'current_period_end', 'tier_slug'];
        filename = 'membership-dunning.csv';
        break;
      case 'upcoming_cancels':
        rows = upcomingCancels as unknown as Record<string, unknown>[];
        headers = ['membership_id', 'email', 'full_name_ar', 'full_name_en', 'cancel_at', 'cancel_reason', 'tier_slug'];
        filename = 'membership-upcoming-cancels.csv';
        break;
      case 'grace_sweeps':
        rows = graceSweeps as unknown as Record<string, unknown>[];
        headers = ['id', 'membership_id', 'email', 'event_type', 'created_at', 'metadata'];
        filename = 'membership-grace-sweeps.csv';
        break;
      case 'reminders':
      default:
        rows = recentReminders as unknown as Record<string, unknown>[];
        headers = ['id', 'membership_id', 'email', 'event_type', 'created_at', 'metadata'];
        filename = 'membership-reminders.csv';
        break;
    }
    const csv = toCSV(rows, headers);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  }

  return NextResponse.json({
    dunning,
    upcoming_cancels: upcomingCancels,
    grace_sweeps: graceSweeps,
    recent_reminders: recentReminders,
    counts: {
      dunning: dunning.length,
      upcoming_cancels: upcomingCancels.length,
      grace_sweeps: graceSweeps.length,
      recent_reminders: recentReminders.length,
    },
  });
}
