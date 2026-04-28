/**
 * GET /api/admin/media
 *
 * Wave 15 Wave 3 canary v2 — content_media library list endpoint.
 *
 * Backs the "Media Library" tab of the Add Media modal (Issue 1 in canary v2
 * dispatch). See `Workspace/CTO/output/2026-04-28-wp-ux-research.md` §1.
 *
 * Authorization:
 *   admin | super_admin | content_editor — same gate as POST upload route.
 *
 * Response shape (200):
 *   {
 *     items: [{ id, url, alt_ar, alt_en, original_name, content_type,
 *               width, height, size_bytes, uploaded_at, uploaded_by_agent_token }, ...],
 *     next_cursor: <ISO uploaded_at of last row | null>
 *   }
 *
 * Pagination: cursor-based by `uploaded_at DESC, id DESC`. Page size 30.
 *
 * Filters:
 *   - q          — case-insensitive LIKE on original_name + alt_ar + alt_en
 *   - type       — `image|video|audio|document` (we only have image now;
 *                  reserved for forward-compat — currently maps to image MIMEs)
 *   - source     — `human|agent|all` (default: all). Filters by whether
 *                  uploaded_by IS NOT NULL vs uploaded_by_agent_token IS NOT NULL.
 *
 * Security:
 *   - URL is the only path returned to the client. file_path stays server-side.
 *   - q LIKE is parameterised via Drizzle's sql template literal — no
 *     concatenation; ILIKE is used so search is case-insensitive.
 *   - Cursor is opaque (ISO timestamp + id); we don't expose row counts or
 *     total pages.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminContext } from '@kunacademy/db';
import { sql } from 'drizzle-orm';
import { getAuthUser } from '@kunacademy/auth/server';

const PAGE_SIZE = 30;
const MAX_Q_LEN = 200;

function isAllowedRole(role: string | undefined): boolean {
  return role === 'admin' || role === 'super_admin' || role === 'content_editor';
}

export async function GET(request: NextRequest) {
  // 1. Auth
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!isAllowedRole(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // 2. Parse query params
  const { searchParams } = new URL(request.url);
  const qRaw = (searchParams.get('q') ?? '').trim().slice(0, MAX_Q_LEN);
  const sourceRaw = (searchParams.get('source') ?? 'all').toLowerCase();
  const cursorRaw = searchParams.get('cursor'); // ISO timestamp of last row's uploaded_at
  const cursorId = searchParams.get('cursor_id'); // tie-breaker on equal timestamps

  const q = qRaw.length > 0 ? `%${qRaw}%` : null;
  const source: 'human' | 'agent' | 'all' = (
    sourceRaw === 'human' || sourceRaw === 'agent' ? sourceRaw : 'all'
  );

  // Cursor validation — must be a valid ISO date string if provided.
  let cursorIso: string | null = null;
  if (cursorRaw) {
    const t = new Date(cursorRaw);
    if (!Number.isNaN(t.getTime())) {
      cursorIso = t.toISOString();
    }
  }
  let cursorIdValidated: string | null = null;
  if (cursorId && /^[0-9a-f-]{36}$/i.test(cursorId)) {
    cursorIdValidated = cursorId;
  }

  // 3. Query (parameterised; filters composed via sql template fragments)
  // Build WHERE clauses incrementally; use AND. Drizzle's sql tag binds
  // every interpolated value as a parameter — concatenation-safe.
  try {
    const rows = await withAdminContext(async (adminDb) => {
      // Build the search filter as a single sql fragment.
      const searchFragment = q
        ? sql`AND (original_name ILIKE ${q} OR COALESCE(alt_ar,'') ILIKE ${q} OR COALESCE(alt_en,'') ILIKE ${q})`
        : sql``;
      const sourceFragment =
        source === 'human'
          ? sql`AND uploaded_by IS NOT NULL`
          : source === 'agent'
          ? sql`AND uploaded_by_agent_token IS NOT NULL`
          : sql``;
      const cursorFragment = cursorIso && cursorIdValidated
        ? sql`AND (uploaded_at, id) < (${cursorIso}::timestamptz, ${cursorIdValidated}::uuid)`
        : sql``;

      const result = await adminDb.execute(sql`
        SELECT
          id::text AS id,
          url,
          alt_ar,
          alt_en,
          original_name,
          content_type,
          width,
          height,
          size_bytes,
          uploaded_at,
          uploaded_by IS NOT NULL AS by_human,
          uploaded_by_agent_token IS NOT NULL AS by_agent
        FROM content_media
        WHERE 1=1
          ${searchFragment}
          ${sourceFragment}
          ${cursorFragment}
        ORDER BY uploaded_at DESC, id DESC
        LIMIT ${PAGE_SIZE + 1}
      `);
      return (result.rows ?? []) as Array<{
        id: string;
        url: string;
        alt_ar: string | null;
        alt_en: string | null;
        original_name: string;
        content_type: string;
        width: number | null;
        height: number | null;
        size_bytes: number | string;
        uploaded_at: string;
        by_human: boolean;
        by_agent: boolean;
      }>;
    });

    const hasMore = rows.length > PAGE_SIZE;
    const page = hasMore ? rows.slice(0, PAGE_SIZE) : rows;
    const last = page[page.length - 1];
    const next_cursor = hasMore && last ? last.uploaded_at : null;
    const next_cursor_id = hasMore && last ? last.id : null;

    return NextResponse.json({
      items: page.map((r) => ({
        id: r.id,
        url: r.url,
        alt_ar: r.alt_ar,
        alt_en: r.alt_en,
        original_name: r.original_name,
        content_type: r.content_type,
        width: r.width,
        height: r.height,
        size_bytes: typeof r.size_bytes === 'string' ? Number(r.size_bytes) : r.size_bytes,
        uploaded_at: r.uploaded_at,
        source: r.by_agent ? 'agent' : r.by_human ? 'human' : 'unknown',
      })),
      next_cursor,
      next_cursor_id,
      page_size: PAGE_SIZE,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[admin/media GET] query failed:', msg);
    return NextResponse.json({ error: 'Failed to query media library' }, { status: 500 });
  }
}

export const runtime = 'nodejs';
