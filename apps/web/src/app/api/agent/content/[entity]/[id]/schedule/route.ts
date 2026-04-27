/**
 * POST /api/agent/content/:entity/:id/schedule
 *
 * Wave 15 Wave 2 — schedule a future publish.
 *
 * Sets `scheduled_publish_at` and transitions the row to `review`. The
 * publish-cron flips `review → published` when `scheduled_publish_at <= now()`
 * (per Wave 15 D13). Body lints (R1+R2+R3) fire BEFORE the transition.
 *
 * Body:
 *   {
 *     scheduled_publish_at: "2026-05-01T10:00:00.000Z",   // ISO timestamp, future
 *     reason?: string,
 *     metadata?: { ... }
 *   }
 *
 * Required:
 *   - canWrite(agent, entity)
 *   - canInvokeVerb(agent, 'schedule_publish')
 *   - entity ∈ state-machine entities
 *   - scheduled_publish_at must be ≥ 60s in the future
 *
 * Lint hooks:
 *   This route runs the same lint pipeline as /transition→review. HARD-BLOCK
 *   on R1/R2/R3 violations returns 422. The agent must revise body content
 *   and retry. Soft-warn violations attach to the response without blocking.
 *
 * State machine:
 *   - draft → review  (allowed; lints fire)
 *   - review → review (no-op for status; updates scheduled_publish_at only)
 *   - published → review is NOT allowed via /schedule. Use /transition then /schedule.
 *   - archived → … is NOT allowed via /schedule. Use /transition (archived→draft) first.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminContext } from '@kunacademy/db';
import { sql } from 'drizzle-orm';
import { routePreflight, mapServiceError, rlHeaders } from '@/lib/agent-api/route-helpers';
import { schedulePublish } from '@/lib/authoring/page-service-w2';
import { assertEntityKnown } from '@/lib/authoring/page-service';
import {
  lintRowBody,
  hasHardBlock,
  violationsToResponse,
  violationsForAudit,
} from '@/lib/agent-api/lints';

interface RouteContext {
  params: Promise<{ entity: string; id: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { entity, id } = await context.params;
  const pre = await routePreflight(request, { entity, id }, {
    action: 'write',
    verb: 'schedule_publish',
    requireStateMachine: true,
  });
  if ('error' in pre) return pre.error;
  const { agent, clientIp, userAgent, rateLimit } = pre;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Body must be a JSON object' }, { status: 400 });
  }

  const ts = body.scheduled_publish_at;
  if (typeof ts !== 'string') {
    return NextResponse.json(
      { error: 'scheduled_publish_at required (ISO 8601 timestamp string)' },
      { status: 400 },
    );
  }
  // Strict ISO-8601 shape check (requires Z or ±HH:MM offset)
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})$/.test(ts)) {
    return NextResponse.json(
      {
        error: 'scheduled_publish_at must be a strict ISO 8601 timestamp with explicit timezone (Z or ±HH:MM)',
        example: '2026-05-01T10:00:00.000Z',
      },
      { status: 400 },
    );
  }
  const dt = new Date(ts);
  if (Number.isNaN(dt.getTime())) {
    return NextResponse.json(
      { error: `scheduled_publish_at could not be parsed: ${ts}` },
      { status: 400 },
    );
  }
  // Require ≥60s in the future to avoid race conditions with the cron sweeper.
  if (dt.getTime() <= Date.now() + 60 * 1000) {
    return NextResponse.json(
      { error: 'scheduled_publish_at must be at least 60 seconds in the future' },
      { status: 400 },
    );
  }

  // Lint pre-flight — same pipeline as /transition→review
  let row: Record<string, unknown> | null = null;
  try {
    row = await loadRowForLint(entity, id);
  } catch (err) {
    return mapServiceError(err, 'POST /schedule (preload)');
  }
  if (!row) {
    return NextResponse.json({ error: `${entity} ${id} not found` }, { status: 404 });
  }

  // Reject if the row is currently archived — schedule cannot happen from
  // archived without an explicit unarchive (transition archived → draft) first.
  if (row.status === 'archived') {
    return NextResponse.json(
      {
        error: 'cannot schedule an archived row. Transition to draft first via /transition.',
        code: 'invalid_transition',
      },
      { status: 422 },
    );
  }

  const violations = lintRowBody({ entity: entity as any, row });

  if (hasHardBlock(violations)) {
    const audit = violationsForAudit(violations);
    try {
      await withAdminContext(async (adminDb) => {
        await adminDb.execute(sql`
          INSERT INTO content_edits
            (entity, entity_id, field, editor_type, editor_id, editor_name,
             previous_value, new_value, change_kind, reason,
             ip_address, user_agent, edit_source, metadata)
          VALUES (${entity}, ${id}, '__lint',
                  'agent', ${agent.tokenId}, ${agent.agentName},
                  ${JSON.stringify({ scheduled_publish_at: ts })}::jsonb,
                  ${JSON.stringify({
                    blocked: true,
                    rule_ids: audit.rule_ids,
                    paths: audit.paths,
                  })}::jsonb,
                  'lint_block',
                  ${`HARD-BLOCK on /schedule: ${audit.rule_ids.join(', ')}`},
                  ${clientIp}, ${userAgent}, 'agent_api',
                  ${JSON.stringify({ violations: violations.slice(0, 25) })}::jsonb)
        `);
      });
    } catch (err) {
      console.error('[agent api schedule] lint_block audit insert failed:', err);
    }

    return NextResponse.json(
      {
        error: 'lint_block',
        code: 'lint_block',
        target: 'review',
        scheduled_publish_at: ts,
        lints: violationsToResponse(violations),
        message: 'Schedule blocked by IP-rule / canon-compliance lint. Revise body and retry.',
      },
      {
        status: 422,
        headers: rlHeaders(rateLimit),
      },
    );
  }

  if (violations.length > 0) {
    // Soft-warn audit
    try {
      await withAdminContext(async (adminDb) => {
        await adminDb.execute(sql`
          INSERT INTO content_edits
            (entity, entity_id, field, editor_type, editor_id, editor_name,
             previous_value, new_value, change_kind, reason,
             ip_address, user_agent, edit_source, metadata)
          VALUES (${entity}, ${id}, '__lint',
                  'agent', ${agent.tokenId}, ${agent.agentName},
                  ${JSON.stringify({ scheduled_publish_at: ts })}::jsonb,
                  ${JSON.stringify({ blocked: false, count: violations.length })}::jsonb,
                  'lint_warn',
                  ${`SOFT-WARN on /schedule`},
                  ${clientIp}, ${userAgent}, 'agent_api',
                  ${JSON.stringify({ violations: violations.slice(0, 25) })}::jsonb)
        `);
      });
    } catch (err) {
      console.error('[agent api schedule] lint_warn audit insert failed:', err);
    }
  }

  // Apply schedule — service layer enforces state-machine validity
  try {
    const post = await schedulePublish({
      entity: entity as any,
      rowId: id,
      scheduled_publish_at: ts,
      actor: {
        kind: 'agent',
        id: agent.tokenId,
        name: agent.agentName,
      },
      ctx: {
        edit_source: 'agent_api',
        reason: typeof body.reason === 'string' ? body.reason.slice(0, 500) : null,
        ip_address: clientIp,
        user_agent: userAgent,
        metadata: body.metadata && typeof body.metadata === 'object' ? body.metadata : null,
      },
    });

    return NextResponse.json(
      {
        entity,
        id,
        scheduled_publish_at: post.scheduled_publish_at,
        status: post.status,
        lints: violations.length > 0 ? violationsToResponse(violations) : null,
        agent: agent.agentName,
        hint: 'The publish-cron will transition this row to published after scheduled_publish_at passes (no further lint pass; lints ran here).',
      },
      {
        status: 200,
        headers: rlHeaders(rateLimit),
      },
    );
  } catch (err) {
    return mapServiceError(err, 'POST /schedule');
  }
}

async function loadRowForLint(entity: string, id: string): Promise<Record<string, unknown> | null> {
  // SECURITY: assertEntityKnown is canonical (DeepSeek W2 catch).
  const safe = assertEntityKnown(entity);
  return withAdminContext(async (adminDb) => {
    const result = await adminDb.execute(sql.raw(`SELECT * FROM ${safe} WHERE id = $1 LIMIT 1`), [id]);
    if (Array.isArray(result)) return (result[0] as Record<string, unknown>) ?? null;
    if (Array.isArray((result as any).rows)) return ((result as any).rows[0] as Record<string, unknown>) ?? null;
    return null;
  });
}
