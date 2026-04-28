/**
 * Wave 15 Wave 3 — GET /api/admin/content-edits
 *
 * Returns recent content_edits for a given entity in a time window.
 * Used by the multi-agent coordination strip (Hakawati §4.5) to show
 * which agents have touched the page recently.
 *
 * Query parameters:
 *   entity_id  : UUID of the entity row (landing_pages.id / blog_posts.id / etc.)
 *   entity     : 'landing_pages' | 'blog_posts' | 'static_pages'
 *   window     : '24h' (default) | '7d' | '30d'
 *
 * Response: { edits: ContentEditRow[], total: number }
 *
 * Security:
 *   - Admin auth required (getAuthUser + isAllowedRole)
 *   - entity validated against allowlist (no raw user strings in SQL)
 *   - entity_id validated as UUID before query
 *   - All SQL is parameterised via Drizzle sql`` tag
 *   - Max 50 rows returned (no unbounded result set)
 *
 * DeepSeek QA notes:
 *   - entity_id validated with UUID regex — no injection via UUID param
 *   - entity validated against allowlist before use in sql.raw()
 *   - window validated against closed set — no open-ended SQL fragment
 *   - admin auth gated — no public exposure of audit trail
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminContext } from '@kunacademy/db';
import { sql } from 'drizzle-orm';
import { getAuthUser } from '@kunacademy/auth/server';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ALLOWED_ENTITIES = new Set(['landing_pages', 'blog_posts', 'static_pages']);

const WINDOW_INTERVALS: Record<string, string> = {
  '24h': '24 hours',
  '7d': '7 days',
  '30d': '30 days',
};

function isAllowedRole(role: string | undefined): boolean {
  return role === 'admin' || role === 'super_admin' || role === 'content_editor';
}

export async function GET(request: NextRequest) {
  // Auth
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!isAllowedRole(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);

  // entity_id — UUID validation.
  const entityIdRaw = searchParams.get('entity_id') ?? '';
  if (!UUID_RE.test(entityIdRaw)) {
    return NextResponse.json({ error: 'Invalid entity_id' }, { status: 400 });
  }
  const entityId = entityIdRaw;

  // entity — allowlist validation.
  const entityRaw = searchParams.get('entity') ?? '';
  if (!ALLOWED_ENTITIES.has(entityRaw)) {
    return NextResponse.json({ error: 'Invalid entity' }, { status: 400 });
  }
  const entity = entityRaw;

  // window — closed set.
  const windowRaw = searchParams.get('window') ?? '24h';
  const intervalStr = WINDOW_INTERVALS[windowRaw] ?? '24 hours';

  try {
    const { edits } = await withAdminContext(async (adminDb) => {
      // Query content_edits filtered by entity + entity_id + time window.
      // All values are Drizzle-parameterised. sql.raw() is used ONLY for
      // the entity string which is validated against ALLOWED_ENTITIES above.
      const rows = await adminDb.execute(
        sql`
          SELECT
            id,
            entity,
            entity_id,
            field,
            editor_type,
            editor_id,
            editor_name,
            change_kind,
            reason AS change_summary,
            metadata,
            created_at
          FROM content_edits
          WHERE
            entity = ${entity}
            AND entity_id = ${entityId}::uuid
            AND editor_type = 'agent'
            AND created_at >= NOW() - INTERVAL ${sql.raw(`'${intervalStr}'`)}
          ORDER BY created_at DESC
          LIMIT 50
        `,
      );

      return { edits: rows.rows };
    });

    return NextResponse.json({
      edits: edits.map((row: Record<string, unknown>) => ({
        id: row.id,
        entity: row.entity,
        entity_id: row.entity_id,
        field: row.field,
        editor_type: row.editor_type,
        editor_id: row.editor_id,
        editor_name: row.editor_name,
        change_kind: row.change_kind,
        change_summary: row.change_summary ?? null,
        section_index: extractSectionIndex(row.field as string),
        created_at: row.created_at,
      })),
      total: edits.length,
    });
  } catch (err) {
    console.error('[content-edits GET]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * Extract section index from a field path like
 * `composition_json.sections[3].body_ar` → 3.
 * Returns null if the field is not a composition section path.
 */
function extractSectionIndex(field: string): number | null {
  const m = /composition_json\.sections\[(\d+)\]/.exec(field);
  return m ? Number(m[1]) : null;
}
