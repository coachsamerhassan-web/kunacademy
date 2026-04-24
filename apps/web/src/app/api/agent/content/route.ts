/**
 * GET /api/agent/content
 *
 * Discovery endpoint. Returns the authenticated agent's name, scopes,
 * rate limit, and the list of entities they can read/write. Agents call
 * this on startup to orient themselves before making content requests.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  authenticateAgent,
  extractBearer,
  checkRateLimit,
  clientIpFromRequest,
} from '@/lib/agent-api/auth';
import { AGENT_SCOPES } from '@/lib/agent-api/scopes';
import { ENTITIES } from '@/lib/agent-api/entities';

export async function GET(request: NextRequest) {
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
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  const scope = AGENT_SCOPES[agent.agentName];
  if (!scope) {
    return NextResponse.json({ error: 'Agent scope not configured' }, { status: 500 });
  }

  // Enrich each entity in the agent's scope with its registered fields
  const readable: Record<string, { fields: Record<string, unknown>; writable: boolean }> = {};
  for (const entityName of scope.readable) {
    const registration = ENTITIES[entityName];
    readable[entityName] = {
      fields: registration?.fields ?? {},
      writable: scope.writable.has(entityName),
    };
  }

  return NextResponse.json(
    {
      agent: agent.agentName,
      rate_limit_per_min: agent.rateLimitPerMin,
      scopes: {
        readable: Array.from(scope.readable).sort(),
        writable: Array.from(scope.writable).sort(),
        fields_excluded: Object.fromEntries(
          Object.entries(scope.fieldExcluded).map(([e, s]) => [e, Array.from(s).sort()]),
        ),
      },
      entities: readable,
      endpoints: {
        list: 'GET  /api/agent/content/:entity?limit=N&offset=N',
        read: 'GET  /api/agent/content/:entity/:id',
        write: 'PATCH /api/agent/content/:entity/:id',
      },
      hint: {
        rich_text_accepts: [
          { type: 'doc', content: [] },
          { markdown: '# Heading\n\nParagraph' },
        ],
        video_providers: ['youtube', 'vimeo', 'loom', 'gdrive'],
      },
    },
    {
      headers: {
        'X-RateLimit-Remaining': rl.remaining.toString(),
        'X-RateLimit-Reset': Math.floor(rl.resetAt / 1000).toString(),
      },
    },
  );
}
