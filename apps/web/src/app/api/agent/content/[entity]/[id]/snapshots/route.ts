/**
 * GET  /api/agent/content/:entity/:id/snapshots
 * POST /api/agent/content/:entity/:id/snapshots
 *
 * GET — list snapshots (newest first). Query: ?limit=N&offset=N (defaults
 *       50/0; max 200).
 *
 * POST — create a manual snapshot. Body: { reason?: string, metadata? }.
 *        The snapshot reason is hard-coded 'manual' at this surface
 *        (admin-triggered checkpoint per Wave 15 §3.5). Returns the new
 *        snapshot's id.
 *
 * Required: canRead(agent, entity) for GET; canWrite(agent, entity) for POST.
 *
 * Snapshots are append-only (REVOKE UPDATE/DELETE + BEFORE UPDATE/DELETE
 * triggers per migration 0067). There is NO endpoint to delete a snapshot —
 * not even for admins. If you need to redact, the only path is
 * `ALTER TABLE … DISABLE TRIGGER … ; DELETE … ; ENABLE TRIGGER …` from a
 * superuser shell. By design — the audit trail is immutable.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminContext } from '@kunacademy/db';
import { sql } from 'drizzle-orm';
import { routePreflight, mapServiceError, rlHeaders } from '@/lib/agent-api/route-helpers';
import { listSnapshots } from '@/lib/authoring/page-service-w2';
import { createSnapshot } from '@/lib/authoring/page-service';

interface RouteContext {
  params: Promise<{ entity: string; id: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { entity, id } = await context.params;
  const pre = await routePreflight(request, { entity, id }, {
    action: 'read',
    requireStateMachine: true,
  });
  if ('error' in pre) return pre.error;
  const { agent, rateLimit } = pre;

  const url = new URL(request.url);
  const limit = clampInt(url.searchParams.get('limit'), 50, 1, 200);
  const offset = clampInt(url.searchParams.get('offset'), 0, 0, 100_000);

  try {
    const snapshots = await listSnapshots(entity as any, id, { limit, offset });

    return NextResponse.json(
      {
        entity,
        id,
        count: snapshots.length,
        limit,
        offset,
        snapshots,
        agent: agent.agentName,
      },
      {
        status: 200,
        headers: rlHeaders(rateLimit),
      },
    );
  } catch (err) {
    return mapServiceError(err, 'GET /snapshots');
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { entity, id } = await context.params;
  const pre = await routePreflight(request, { entity, id }, {
    action: 'write',
    requireStateMachine: true,
  });
  if ('error' in pre) return pre.error;
  const { agent, clientIp, userAgent, rateLimit } = pre;

  let body: any = null;
  try {
    const txt = await request.text();
    if (txt) body = JSON.parse(txt);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  try {
    const snapshotId = await createSnapshot(
      entity as any,
      id,
      'manual',
      {
        kind: 'agent',
        id: agent.tokenId,
        name: agent.agentName,
      },
    );

    // Audit the manual snapshot creation (DeepSeek W2 catch — every
    // mutation needs a content_edits row, including manual snapshots).
    // Since 'snapshot_manual' isn't in the change_kind CHECK whitelist,
    // we use 'scalar' with a structured payload pointing to the snapshot.
    try {
      await withAdminContext(async (adminDb) => {
        await adminDb.execute(sql`
          INSERT INTO content_edits
            (entity, entity_id, field, editor_type, editor_id, editor_name,
             previous_value, new_value, change_kind, reason,
             ip_address, user_agent, edit_source, metadata)
          VALUES (${entity}, ${id}, '__snapshot_manual',
                  'agent', ${agent.tokenId}, ${agent.agentName},
                  null::jsonb,
                  ${JSON.stringify({ snapshot_id: snapshotId, reason: 'manual' })}::jsonb,
                  'scalar',
                  ${typeof body?.reason === 'string' ? body.reason.slice(0, 500) : 'manual snapshot'},
                  ${clientIp}, ${userAgent}, 'agent_api',
                  ${body?.metadata && typeof body.metadata === 'object' ? JSON.stringify(body.metadata) : null}::jsonb)
        `);
      });
    } catch (err) {
      console.error('[agent api snapshots] manual-snapshot audit insert failed:', err);
    }

    return NextResponse.json(
      {
        entity,
        id,
        snapshot_id: snapshotId,
        reason: 'manual',
        agent: agent.agentName,
      },
      {
        status: 201,
        headers: rlHeaders(rateLimit),
      },
    );
  } catch (err) {
    return mapServiceError(err, 'POST /snapshots');
  }
}

function clampInt(raw: string | null, def: number, min: number, max: number): number {
  if (raw === null) return def;
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n)) return def;
  return Math.min(Math.max(n, min), max);
}
