/**
 * POST /api/agent/content/:entity/:id/rollback
 *
 * Roll a row back to a prior snapshot.
 *
 * Body:
 *   {
 *     snapshot_id: '<uuid>',
 *     reason?: string,
 *     metadata?: { ... }
 *   }
 *
 * Required: canWrite(agent, entity), canInvokeVerb(agent, 'rollback'),
 *           entity ∈ state-machine entities.
 *
 * Behavior (per page-service.rollbackToSnapshot):
 *   1. Pre-rollback snapshot is taken first (reason='pre_rollback'),
 *      capturing the CURRENT row state. This guarantees rollback is
 *      always reversible.
 *   2. Snapshotted body fields (composition_json + hero_json + seo_meta_json
 *      OR composition_json + content/excerpt + *_rich on blog_posts) are
 *      restored.
 *   3. Status is NOT changed — the row stays in whatever status it was;
 *      the agent must follow up with a /transition call if they want
 *      republish behavior.
 *
 * Rollback DOES NOT trigger lint hooks (lints fire only on transition→
 * review/published). When the agent subsequently transitions the rolled-
 * back body to review/published, the lints will fire on the restored
 * body. That's the desired ordering — rollback is a body-level operation;
 * lint is a publish-gate.
 */

import { NextRequest, NextResponse } from 'next/server';
import { routePreflight, mapServiceError, rlHeaders } from '@/lib/agent-api/route-helpers';
import { rollbackToSnapshot } from '@/lib/authoring/page-service';

interface RouteContext {
  params: Promise<{ entity: string; id: string }>;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest, context: RouteContext) {
  const { entity, id } = await context.params;
  const pre = await routePreflight(request, { entity, id }, {
    action: 'write',
    verb: 'rollback',
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

  const snapshotId = body.snapshot_id;
  if (typeof snapshotId !== 'string' || !UUID_RE.test(snapshotId)) {
    return NextResponse.json({ error: 'snapshot_id required (UUID)' }, { status: 400 });
  }

  try {
    const post = await rollbackToSnapshot(
      entity as any,
      id,
      snapshotId,
      {
        kind: 'agent',
        id: agent.tokenId,
        name: agent.agentName,
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
        rolled_back_to: snapshotId,
        status: post.status,
        agent: agent.agentName,
      },
      {
        status: 200,
        headers: rlHeaders(rateLimit),
      },
    );
  } catch (err) {
    return mapServiceError(err, 'POST /rollback');
  }
}
