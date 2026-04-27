/**
 * PATCH /api/agent/content/:entity/:id/sections/:idx
 * DELETE /api/agent/content/:entity/:id/sections/:idx
 *
 * PATCH: Edit (merge-patch) the section at composition_json.sections[idx].
 *        Body: { patch: { ...partial_section_fields }, reason?, metadata? }
 *
 * DELETE: Splice composition_json.sections[idx] out.
 *         Body: { reason?, metadata? } (optional)
 *
 * Required: canWrite(agent, entity), entity ∈ state-machine entities.
 *
 * Out-of-range idx returns 400. Section ops bypass lint hooks (lints fire
 * at /transition).
 */

import { NextRequest, NextResponse } from 'next/server';
import { routePreflight, mapServiceError, rlHeaders } from '@/lib/agent-api/route-helpers';
import { editSection, deleteSection } from '@/lib/authoring/page-service-w2';

interface RouteContext {
  params: Promise<{ entity: string; id: string; idx: string }>;
}

function parseIdx(idx: string): number | null {
  if (!/^\d+$/.test(idx)) return null;
  const n = parseInt(idx, 10);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { entity, id, idx: idxRaw } = await context.params;
  const pre = await routePreflight(request, { entity, id }, {
    action: 'write',
    requireStateMachine: true,
  });
  if ('error' in pre) return pre.error;
  const { agent, clientIp, userAgent, rateLimit } = pre;

  const idx = parseIdx(idxRaw);
  if (idx === null) {
    return NextResponse.json({ error: 'idx must be a non-negative integer' }, { status: 400 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Body must be a JSON object' }, { status: 400 });
  }

  const patch = body.patch;
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
    return NextResponse.json({ error: 'patch required (object)' }, { status: 400 });
  }

  try {
    const result = await editSection({
      entity: entity as any,
      rowId: id,
      index: idx,
      patch,
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
        action: 'edit_section',
        index: idx,
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
    return mapServiceError(err, `PATCH /sections/${idx}`);
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const { entity, id, idx: idxRaw } = await context.params;
  const pre = await routePreflight(request, { entity, id }, {
    action: 'write',
    requireStateMachine: true,
  });
  if ('error' in pre) return pre.error;
  const { agent, clientIp, userAgent, rateLimit } = pre;

  const idx = parseIdx(idxRaw);
  if (idx === null) {
    return NextResponse.json({ error: 'idx must be a non-negative integer' }, { status: 400 });
  }

  let body: any = null;
  try {
    const txt = await request.text();
    if (txt) body = JSON.parse(txt);
  } catch {
    body = null;
  }

  try {
    const result = await deleteSection({
      entity: entity as any,
      rowId: id,
      index: idx,
      actor: {
        kind: 'agent',
        id: agent.tokenId,
        name: agent.agentName,
      },
      ctx: {
        edit_source: 'agent_api',
        reason: typeof body?.reason === 'string' ? body.reason.slice(0, 500) : null,
        ip_address: clientIp,
        user_agent: userAgent,
        metadata: body?.metadata && typeof body.metadata === 'object' ? body.metadata : null,
      },
    });

    return NextResponse.json(
      {
        entity,
        id,
        action: 'delete_section',
        index: idx,
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
    return mapServiceError(err, `DELETE /sections/${idx}`);
  }
}
