/**
 * Wave 15 Wave 3 — Admin transition route for blog_posts.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminContext } from '@kunacademy/db';
import { getAuthUser } from '@kunacademy/auth/server';
import { sql } from 'drizzle-orm';
import {
  transitionStatus,
  assertEntityKnown,
  type Status,
} from '@/lib/authoring/page-service';
import {
  lintRowBody,
  hasHardBlock,
  violationsToResponse,
  violationsForAudit,
} from '@/lib/agent-api/lints';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isAdmin(role: string | undefined): boolean {
  return role === 'admin' || role === 'super_admin' || role === 'content_editor';
}

const VALID_TARGETS: Status[] = ['draft', 'review', 'published', 'archived'];

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user || !isAdmin(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await context.params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }); }
  const to = body?.to;
  if (typeof to !== 'string' || !VALID_TARGETS.includes(to as Status)) {
    return NextResponse.json({ error: `to must be one of: ${VALID_TARGETS.join(', ')}` }, { status: 400 });
  }

  let lintViolations: ReturnType<typeof lintRowBody> = [];
  if (to === 'review' || to === 'published') {
    let row: Record<string, unknown> | null = null;
    try { row = await loadRowForLint('blog_posts', id); }
    catch (err) { console.error('[admin blog transition] preload failed', err); return NextResponse.json({ error: 'preload failed' }, { status: 500 }); }
    if (!row) return NextResponse.json({ error: 'blog_posts row not found' }, { status: 404 });

    lintViolations = lintRowBody({ entity: 'blog_posts', row });

    if (hasHardBlock(lintViolations)) {
      const audit = violationsForAudit(lintViolations);
      try {
        await withAdminContext(async (adminDb) => {
          await adminDb.execute(sql`
            INSERT INTO content_edits
              (entity, entity_id, field, editor_type, editor_id, editor_name,
               previous_value, new_value, change_kind, reason, edit_source)
            VALUES ('blog_posts', ${id}, '__lint',
                    'human', ${user.id}, ${user.name ?? user.email ?? 'admin'},
                    ${JSON.stringify({ to, status_attempted: to })}::jsonb,
                    ${JSON.stringify({ blocked: true, rule_ids: audit.rule_ids, paths: audit.paths })}::jsonb,
                    'lint_block',
                    ${`HARD-BLOCK on transition→${to} (admin blog_posts): ${audit.rule_ids.join(', ')}`},
                    'admin_ui')
          `);
        });
      } catch (err) { console.error('[admin blog transition] lint_block audit failed', err); }
      return NextResponse.json({
        error: 'lint_block', code: 'lint_block', target: to,
        lints: violationsToResponse(lintViolations),
        message: 'Transition blocked by IP-rule / canon-compliance lint. Revise body and retry.',
      }, { status: 422 });
    }
    if (lintViolations.length > 0) {
      try {
        await withAdminContext(async (adminDb) => {
          await adminDb.execute(sql`
            INSERT INTO content_edits
              (entity, entity_id, field, editor_type, editor_id, editor_name,
               previous_value, new_value, change_kind, reason, edit_source)
            VALUES ('blog_posts', ${id}, '__lint',
                    'human', ${user.id}, ${user.name ?? user.email ?? 'admin'},
                    ${JSON.stringify({ to })}::jsonb,
                    ${JSON.stringify({ blocked: false, count: lintViolations.length })}::jsonb,
                    'lint_warn',
                    ${`SOFT-WARN on transition→${to} (admin blog_posts)`},
                    'admin_ui')
          `);
        });
      } catch (err) { console.error('[admin blog transition] lint_warn audit failed', err); }
    }
  }

  try {
    const post = await transitionStatus('blog_posts', id, to as Status, {
      kind: 'human', id: user.id, name: user.name ?? user.email ?? 'admin',
    }, {
      edit_source: 'admin_ui',
      reason: typeof body.reason === 'string' ? body.reason.slice(0, 500) : null,
      metadata: body.metadata && typeof body.metadata === 'object' && !Array.isArray(body.metadata)
        ? (body.metadata as Record<string, unknown>)
        : null,
    });
    return NextResponse.json({ entity: 'blog_posts', id, status: post.status, lints: lintViolations.length > 0 ? violationsToResponse(lintViolations) : null });
  } catch (err) {
    console.error('[admin blog transition]', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Transition failed' }, { status: 400 });
  }
}

async function loadRowForLint(entity: string, id: string): Promise<Record<string, unknown> | null> {
  const safe = assertEntityKnown(entity);
  return withAdminContext(async (adminDb) => {
    const result = await adminDb.execute(sql`SELECT * FROM ${sql.raw(safe)} WHERE id = ${id}::uuid LIMIT 1`);
    if (Array.isArray(result)) return (result[0] as Record<string, unknown>) ?? null;
    const maybeRows = (result as { rows?: unknown }).rows;
    if (Array.isArray(maybeRows)) return ((maybeRows[0] as Record<string, unknown> | undefined) ?? null);
    return null;
  });
}
