/**
 * POST /api/agent/content/:entity/:id/sections
 *
 * Append (or insert at index) a new section into composition_json.sections.
 *
 * Body:
 *   {
 *     section: { type: 'mirror', body_ar: '...', ... },
 *     index?: 3,
 *     reason?: string,
 *     metadata?: { ... }
 *   }
 *
 * Required: canWrite(agent, entity), entity ∈ state-machine entities.
 *
 * Section ops do NOT trigger lint hooks — lints fire at /transition only.
 * Audit row is written to content_edits with field='composition_json' and
 * change_kind='rich_text_replaced'.
 */

import { NextRequest, NextResponse } from 'next/server';
import { routePreflight, mapServiceError, rlHeaders } from '@/lib/agent-api/route-helpers';
import { addSection } from '@/lib/authoring/page-service-w2';

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

  const section = body.section;
  if (!section || typeof section !== 'object' || Array.isArray(section)) {
    return NextResponse.json({ error: 'section required (object)' }, { status: 400 });
  }

  const index = body.index;
  if (index !== undefined && (typeof index !== 'number' || !Number.isInteger(index) || index < 0)) {
    return NextResponse.json({ error: 'index must be a non-negative integer' }, { status: 400 });
  }

  try {
    const result = await addSection({
      entity: entity as any,
      rowId: id,
      section,
      index,
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
        action: 'add_section',
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
    return mapServiceError(err, 'POST /sections');
  }
}
