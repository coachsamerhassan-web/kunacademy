/**
 * GET /api/agent/content/:entity
 *
 * List all rows of a given entity visible to the authenticated agent.
 * Returns minimal identifying columns (id + slug/name_field + timestamps).
 * The agent then calls GET /:entity/:id to fetch full field contents for
 * a specific row.
 */

import { NextRequest, NextResponse } from 'next/server';
import { desc } from 'drizzle-orm';
import { withAdminContext } from '@kunacademy/db';
import {
  authenticateAgent,
  extractBearer,
  checkRateLimit,
  clientIpFromRequest,
} from '@/lib/agent-api/auth';
import { canRead } from '@/lib/agent-api/scopes';
import { getEntity } from '@/lib/agent-api/entities';

interface RouteContext {
  params: Promise<{ entity: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { entity } = await context.params;

  if (!/^[a-z_][a-z0-9_]*$/i.test(entity)) {
    return NextResponse.json({ error: 'Invalid entity name' }, { status: 400 });
  }

  const clientIp = clientIpFromRequest(request);
  const token = extractBearer(request.headers.get('authorization'));
  const agent = await authenticateAgent(token, clientIp);
  if (!agent) {
    return NextResponse.json(
      { error: 'Unauthorized — invalid, missing, or revoked token' },
      { status: 401 },
    );
  }

  const rl = checkRateLimit(agent.agentNameKey, agent.rateLimitPerMin);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded' },
      {
        status: 429,
        headers: { 'X-RateLimit-Reset': Math.floor(rl.resetAt / 1000).toString() },
      },
    );
  }

  const scope = canRead(agent.agentName, entity);
  if (!scope.allowed) {
    return NextResponse.json({ error: scope.reason ?? 'Forbidden' }, { status: 403 });
  }

  const registration = getEntity(entity);
  if (!registration) {
    return NextResponse.json(
      { error: `Entity '${entity}' not available via the agent API` },
      { status: 404 },
    );
  }

  // Parse pagination
  const url = new URL(request.url);
  const rawLimit = parseInt(url.searchParams.get('limit') ?? '50', 10);
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 200) : 50;
  const rawOffset = parseInt(url.searchParams.get('offset') ?? '0', 10);
  const offset = Number.isFinite(rawOffset) ? Math.max(rawOffset, 0) : 0;

  const table = registration.table;
  const idCol = (table as unknown as Record<string, unknown>)[registration.idColumn];
  const nameCol = registration.nameField
    ? (table as unknown as Record<string, unknown>)[registration.nameField]
    : null;
  const updatedAtCol = (table as unknown as Record<string, unknown>).updated_at;

  const rows = await withAdminContext(async (adminDb) => {
    const query = adminDb
      .select(
        nameCol
          ? { id: idCol as never, name: nameCol as never, updated_at: updatedAtCol as never }
          : { id: idCol as never, updated_at: updatedAtCol as never },
      )
      .from(table);
    if (updatedAtCol) {
      query.orderBy(desc(updatedAtCol as never));
    }
    return query.limit(limit).offset(offset);
  });

  return NextResponse.json(
    {
      entity,
      count: rows.length,
      limit,
      offset,
      rows,
      agent: agent.agentName,
    },
    {
      headers: {
        'X-RateLimit-Remaining': rl.remaining.toString(),
        'X-RateLimit-Reset': Math.floor(rl.resetAt / 1000).toString(),
      },
    },
  );
}
