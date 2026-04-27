/**
 * POST /api/agent/content/:entity/:id/sections/reorder
 *
 * Apply a permutation to composition_json.sections.
 *
 * Body:
 *   {
 *     order: [3, 0, 1, 2],   // permutation of indices 0..n-1
 *     reason?: string,
 *     metadata?: { ... }
 *   }
 *
 * Required: canWrite(agent, entity), entity ∈ state-machine entities.
 *
 * Permutation must be complete and contain each index exactly once.
 * Length must match current sections[] length. Order is the new positional
 * sequence — element at order[k] becomes the k-th position in the new
 * sections[] array.
 */

import { NextRequest, NextResponse } from 'next/server';
import { routePreflight, mapServiceError, rlHeaders } from '@/lib/agent-api/route-helpers';
import { reorderSections } from '@/lib/authoring/page-service-w2';

interface RouteContext {
  params: Promise<{ entity: string; id: string }>;
}

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

  const order = body.order;
  if (!Array.isArray(order)) {
    return NextResponse.json({ error: 'order required (array of indices)' }, { status: 400 });
  }
  if (order.length === 0) {
    return NextResponse.json({ error: 'order cannot be empty' }, { status: 400 });
  }

  try {
    const result = await reorderSections({
      entity: entity as any,
      rowId: id,
      order,
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
        action: 'reorder_sections',
        order,
        diff: result.diff,
        summary: result.summary,
        composition_json: result.next,
        agent: agent.agentName,
      },
      {
        status: 200,
        headers: rlHeaders(rateLimit),
      },
    );
  } catch (err) {
    return mapServiceError(err, 'POST /sections/reorder');
  }
}
