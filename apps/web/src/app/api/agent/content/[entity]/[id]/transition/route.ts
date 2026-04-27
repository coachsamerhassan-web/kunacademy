/**
 * POST /api/agent/content/:entity/:id/transition
 *
 * Transition the row's status. THIS is the boundary where IP-rule (R1)
 * + program-canon-compliance (R2/R3) lints fire. Both HARD-BLOCK on
 * violation per CLAUDE.md and Wave 15 spec §11.
 *
 * Body:
 *   {
 *     to: 'review' | 'published' | 'archived' | 'draft',
 *     reason?: string,
 *     metadata?: { ... }
 *   }
 *
 * Authorization rules:
 *   - canWrite(agent, entity)
 *   - to='review'     → canInvokeVerb(agent, 'submit_review')
 *   - to='published'  → canDirectPublish(agent, entity) — requires the entity
 *                       to be in the agent's publish_scopes set. Default
 *                       empty for every agent; only Shahira:testimonials
 *                       carve-out exists at launch (D8).
 *   - to='archived'   → canInvokeVerb(agent, 'archive')
 *   - to='draft'      → from review/archived only (re-edit path);
 *                       no specific verb required (canWrite is enough)
 *
 * Lint hooks:
 *   When the target state is 'review' OR 'published', lintRowBody() runs
 *   on the pre-transition row body (composition + hero + seo + scalars).
 *   Any HARD-BLOCK violation aborts with 422 + structured violations[]
 *   AND writes a content_edits row of change_kind='lint_block'.
 *   SOFT-WARN violations attach to the response but do not block; a
 *   matching content_edits row of 'lint_warn' is written.
 *
 * Returns the post-transition row (200) or a structured error (4xx/5xx).
 */

import { NextRequest, NextResponse } from 'next/server';
import { routePreflight, mapServiceError, rlHeaders } from '@/lib/agent-api/route-helpers';
import { withAdminContext } from '@kunacademy/db';
import {
  transitionStatus,
  assertEntityKnown,
  type Status,
} from '@/lib/authoring/page-service';
import { canInvokeVerb, canDirectPublish, AGENT_SCOPES } from '@/lib/agent-api/scopes';
import {
  lintRowBody,
  hasHardBlock,
  violationsToResponse,
  violationsForAudit,
} from '@/lib/agent-api/lints';
import { sql } from 'drizzle-orm';

interface RouteContext {
  params: Promise<{ entity: string; id: string }>;
}

const VALID_TARGETS: Status[] = ['draft', 'review', 'published', 'archived'];

export async function POST(request: NextRequest, context: RouteContext) {
  const { entity, id } = await context.params;
  const pre = await routePreflight(request, { entity, id }, {
    action: 'write',
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

  const to = body.to;
  if (typeof to !== 'string' || !VALID_TARGETS.includes(to as Status)) {
    return NextResponse.json(
      { error: `to must be one of: ${VALID_TARGETS.join(', ')}` },
      { status: 400 },
    );
  }

  // Verb authorization gate per target
  if (to === 'review') {
    const v = canInvokeVerb(agent.agentName, 'submit_review');
    if (!v.allowed) return NextResponse.json({ error: v.reason ?? 'Forbidden' }, { status: 403 });
  } else if (to === 'archived') {
    const v = canInvokeVerb(agent.agentName, 'archive');
    if (!v.allowed) return NextResponse.json({ error: v.reason ?? 'Forbidden' }, { status: 403 });
  } else if (to === 'published') {
    // Direct publish ONLY allowed if entity ∈ agent's publish_scopes
    const dp = canDirectPublish(agent.agentName, entity);
    if (!dp.allowed) {
      return NextResponse.json({ error: dp.reason ?? 'Forbidden' }, { status: 403 });
    }
  }
  // to='draft' — no specific verb (re-edit path); canWrite is enough.

  // Lint hook — fires on transition→review and transition→published
  let lintViolations: ReturnType<typeof lintRowBody> = [];
  if (to === 'review' || to === 'published') {
    let row: Record<string, unknown> | null = null;
    try {
      row = await loadRowForLint(entity, id);
    } catch (err) {
      return mapServiceError(err, 'POST /transition (preload)');
    }
    if (!row) {
      return NextResponse.json({ error: `${entity} ${id} not found` }, { status: 404 });
    }

    lintViolations = lintRowBody({ entity: entity as any, row });

    if (hasHardBlock(lintViolations)) {
      const audit = violationsForAudit(lintViolations);
      // Write the lint_block audit row BEFORE returning (so the violation
      // is recorded even if the agent ignores the response).
      try {
        await withAdminContext(async (adminDb) => {
          await adminDb.execute(sql`
            INSERT INTO content_edits
              (entity, entity_id, field, editor_type, editor_id, editor_name,
               previous_value, new_value, change_kind, reason,
               ip_address, user_agent, edit_source, metadata)
            VALUES (${entity}, ${id}, '__lint',
                    'agent', ${agent.tokenId}, ${agent.agentName},
                    ${JSON.stringify({ to, status_attempted: to })}::jsonb,
                    ${JSON.stringify({
                      blocked: true,
                      rule_ids: audit.rule_ids,
                      paths: audit.paths,
                    })}::jsonb,
                    'lint_block',
                    ${`HARD-BLOCK on transition→${to}: ${audit.rule_ids.join(', ')}`},
                    ${clientIp}, ${userAgent}, 'agent_api',
                    ${JSON.stringify({ violations: lintViolations.slice(0, 25) })}::jsonb)
          `);
        });
      } catch (err) {
        console.error('[agent api transition] lint_block audit insert failed:', err);
      }

      return NextResponse.json(
        {
          error: 'lint_block',
          code: 'lint_block',
          target: to,
          lints: violationsToResponse(lintViolations),
          message: 'Transition blocked by IP-rule / canon-compliance lint. Revise body and retry.',
        },
        {
          status: 422,
          headers: rlHeaders(rateLimit),
        },
      );
    }
    // Soft-warn: attach to response but don't block. We still record an
    // audit row so it surfaces in the editor's lint history.
    if (lintViolations.length > 0) {
      try {
        await withAdminContext(async (adminDb) => {
          await adminDb.execute(sql`
            INSERT INTO content_edits
              (entity, entity_id, field, editor_type, editor_id, editor_name,
               previous_value, new_value, change_kind, reason,
               ip_address, user_agent, edit_source, metadata)
            VALUES (${entity}, ${id}, '__lint',
                    'agent', ${agent.tokenId}, ${agent.agentName},
                    ${JSON.stringify({ to })}::jsonb,
                    ${JSON.stringify({ blocked: false, count: lintViolations.length })}::jsonb,
                    'lint_warn',
                    ${`SOFT-WARN on transition→${to}`},
                    ${clientIp}, ${userAgent}, 'agent_api',
                    ${JSON.stringify({ violations: lintViolations.slice(0, 25) })}::jsonb)
          `);
        });
      } catch (err) {
        console.error('[agent api transition] lint_warn audit insert failed:', err);
      }
    }
  }

  // Populate publish_scopes from the agent's scope row so transitionStatus()
  // can validate publish authority. (Even though we already gated above on
  // canDirectPublish, transitionStatus has its own internal gate using
  // actor.publish_scopes — pass it through.)
  const publishScopes = AGENT_SCOPES[agent.agentName]?.publishScopes ?? new Set<string>();

  try {
    const post = await transitionStatus(
      entity as any,
      id,
      to as Status,
      {
        kind: 'agent',
        id: agent.tokenId,
        name: agent.agentName,
        publish_scopes: publishScopes as Set<any>,
      },
      {
        edit_source: 'agent_api',
        reason: typeof body.reason === 'string' ? body.reason.slice(0, 500) : null,
        ip_address: clientIp,
        user_agent: userAgent,
        metadata: body.metadata && typeof body.metadata === 'object' ? body.metadata : null,
      },
    );

    return NextResponse.json(
      {
        entity,
        id,
        from: post.status, // post-transition; status = to
        to,
        transitioned: true,
        lints: lintViolations.length > 0 ? violationsToResponse(lintViolations) : null,
        agent: agent.agentName,
      },
      {
        status: 200,
        headers: rlHeaders(rateLimit),
      },
    );
  } catch (err) {
    return mapServiceError(err, 'POST /transition');
  }
}

async function loadRowForLint(entity: string, id: string): Promise<Record<string, unknown> | null> {
  // SECURITY: assertEntityKnown is the canonical whitelist guard from
  // page-service. Calling it here keeps the sql.raw boundary tight even if
  // the caller forgot to validate. (DeepSeek W2 catch — local whitelist
  // copies drift; canonical reference does not.)
  const safe = assertEntityKnown(entity);
  return withAdminContext(async (adminDb) => {
    // Drizzle v0.45 pattern: sql template with sql.raw() for whitelisted
    // identifier; ${id} parameterized as a uuid value.
    const result = await adminDb.execute(
      sql`SELECT * FROM ${sql.raw(safe)} WHERE id = ${id}::uuid LIMIT 1`,
    );
    if (Array.isArray(result)) return (result[0] as Record<string, unknown>) ?? null;
    if (Array.isArray((result as any).rows)) return ((result as any).rows[0] as Record<string, unknown>) ?? null;
    return null;
  });
}
