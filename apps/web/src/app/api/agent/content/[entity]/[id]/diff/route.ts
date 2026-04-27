/**
 * GET /api/agent/content/:entity/:id/diff?from=<snapshot_id>&to=<snapshot_id|head>
 *
 * Diff two snapshots, OR a snapshot vs the current row state.
 *
 * Query parameters:
 *   - from (required) — snapshot UUID
 *   - to   (required) — snapshot UUID OR the literal string 'head'
 *
 * Required: canRead(agent, entity), entity ∈ state-machine entities.
 *
 * Returns:
 *   {
 *     entity, id,
 *     from: { kind: 'snapshot', snapshot_id, reason, created_at },
 *     to:   { kind: 'snapshot' | 'head', ... },
 *     diff: { sections: [...], fields: [...] },
 *     summary: '+2 added, ~3 changed, 1 reorder',
 *     agent
 *   }
 */

import { NextRequest, NextResponse } from 'next/server';
import { routePreflight, mapServiceError, rlHeaders } from '@/lib/agent-api/route-helpers';
import { diffPageVersions } from '@/lib/authoring/page-service-w2';

interface RouteContext {
  params: Promise<{ entity: string; id: string }>;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest, context: RouteContext) {
  const { entity, id } = await context.params;
  const pre = await routePreflight(request, { entity, id }, {
    action: 'read',
    requireStateMachine: true,
  });
  if ('error' in pre) return pre.error;
  const { agent, rateLimit } = pre;

  const url = new URL(request.url);
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');

  if (!from || !UUID_RE.test(from)) {
    return NextResponse.json({ error: 'from required (snapshot UUID)' }, { status: 400 });
  }
  if (!to || (to !== 'head' && !UUID_RE.test(to))) {
    return NextResponse.json({ error: 'to required (snapshot UUID or "head")' }, { status: 400 });
  }

  try {
    const result = await diffPageVersions(entity as any, id, from, to);
    return NextResponse.json(
      {
        entity,
        id,
        from: result.from,
        to: result.to,
        diff: result.diff,
        summary: result.summary,
        agent: agent.agentName,
      },
      {
        status: 200,
        headers: rlHeaders(rateLimit),
      },
    );
  } catch (err) {
    return mapServiceError(err, 'GET /diff');
  }
}
