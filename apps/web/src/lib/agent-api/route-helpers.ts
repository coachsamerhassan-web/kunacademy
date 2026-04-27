/**
 * Wave 15 Wave 2 — Shared route-handler helpers for the Agent Content API.
 *
 * Each new sub-route (sections, transition, snapshots, rollback, diff)
 * runs the same preflight: shape guard → auth → rate-limit → scope check →
 * entity-registration check → optional verb check. Centralizing the
 * boilerplate keeps the per-route code focused on the actual mutation.
 *
 * Usage:
 *   const pre = await routePreflight(request, { entity, id }, {
 *     action: 'write',
 *     verb: 'submit_review',
 *     requireStateMachine: true,
 *   });
 *   if ('error' in pre) return pre.error;
 *   const { agent, registration, clientIp, userAgent, rateLimit } = pre;
 *
 * Returns either { error: NextResponse } (on any preflight failure) or
 * the success bundle. Always-on: when scope check fails, a content_edits
 * row of `__scope_violation__` is written for forensic visibility.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminContext } from '@kunacademy/db';
import { content_edits } from '@kunacademy/db/schema';
import {
  authenticateAgent,
  extractBearer,
  checkRateLimit,
  clientIpFromRequest,
  type AuthedAgent,
} from './auth';
import { canRead, canWrite, canInvokeVerb, type AgentVerb } from './scopes';
import { getEntity, isStateMachineEntity, type EntityRegistration } from './entities';
import { PageServiceError } from '@/lib/authoring/page-service';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface RoutePreflightOptions {
  /** read | write — controls scope check. */
  action: 'read' | 'write';
  /** Optional verb to check. Skipped if undefined. */
  verb?: AgentVerb;
  /** Reject if entity isn't a state-machine entity (landing_pages /
   *  blog_posts / static_pages). Defaults to false. */
  requireStateMachine?: boolean;
}

export interface RoutePreflightSuccess {
  agent: AuthedAgent;
  entity: string;
  id: string;
  registration: EntityRegistration;
  clientIp: string | null;
  userAgent: string | null;
  rateLimit: { remaining: number; resetAt: number };
}

export type RoutePreflightResult = { error: NextResponse } | RoutePreflightSuccess;

export async function routePreflight(
  request: NextRequest,
  params: { entity: string; id: string },
  opts: RoutePreflightOptions,
): Promise<RoutePreflightResult> {
  const { entity, id } = params;

  // 1. Shape guards
  if (!/^[a-z_][a-z0-9_]*$/i.test(entity)) {
    return { error: NextResponse.json({ error: 'Invalid entity name' }, { status: 400 }) };
  }
  if (!UUID_RE.test(id)) {
    return { error: NextResponse.json({ error: 'Invalid id — must be UUID' }, { status: 400 }) };
  }

  // 2. Auth
  const clientIp = clientIpFromRequest(request);
  const token = extractBearer(request.headers.get('authorization'));
  const agent = await authenticateAgent(token, clientIp);
  if (!agent) {
    return {
      error: NextResponse.json(
        { error: 'Unauthorized — invalid, missing, or revoked token' },
        { status: 401 },
      ),
    };
  }

  // 3. Rate limit
  const rl = checkRateLimit(agent.agentNameKey, agent.rateLimitPerMin);
  if (!rl.allowed) {
    return {
      error: NextResponse.json(
        { error: `Rate limit exceeded. Resets at ${new Date(rl.resetAt).toISOString()}` },
        {
          status: 429,
          headers: {
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': Math.floor(rl.resetAt / 1000).toString(),
          },
        },
      ),
    };
  }

  // 4. Scope check
  const scopeCheck = opts.action === 'read'
    ? canRead(agent.agentName, entity)
    : canWrite(agent.agentName, entity);
  if (!scopeCheck.allowed) {
    await logScopeViolation({
      entity,
      entity_id: id,
      editor_id: agent.tokenId,
      editor_name: agent.agentName,
      action: opts.action,
      ip_address: clientIp,
      user_agent: request.headers.get('user-agent'),
      reason: scopeCheck.reason ?? 'Scope violation',
    });
    return {
      error: NextResponse.json({ error: scopeCheck.reason ?? 'Forbidden' }, { status: 403 }),
    };
  }

  // 5. Verb check (optional)
  if (opts.verb) {
    const verbCheck = canInvokeVerb(agent.agentName, opts.verb);
    if (!verbCheck.allowed) {
      return {
        error: NextResponse.json({ error: verbCheck.reason ?? 'Forbidden' }, { status: 403 }),
      };
    }
  }

  // 6. Entity must be in the registry
  const registration = getEntity(entity);
  if (!registration) {
    return {
      error: NextResponse.json(
        { error: `Entity '${entity}' not available via the agent API` },
        { status: 404 },
      ),
    };
  }

  // 7. State-machine gate (per-route option)
  if (opts.requireStateMachine && !isStateMachineEntity(entity)) {
    return {
      error: NextResponse.json(
        {
          error: `Operation not supported on entity '${entity}' — state-machine entities only`,
          code: 'not_state_machine_entity',
        },
        { status: 405 },
      ),
    };
  }

  return {
    agent,
    entity,
    id,
    registration,
    clientIp,
    userAgent: request.headers.get('user-agent'),
    rateLimit: { remaining: rl.remaining, resetAt: rl.resetAt },
  };
}

async function logScopeViolation(args: {
  entity: string;
  entity_id: string;
  editor_id: string;
  editor_name: string;
  action: 'read' | 'write';
  ip_address: string | null;
  user_agent: string | null;
  reason: string;
}) {
  try {
    await withAdminContext(async (adminDb) => {
      await adminDb.insert(content_edits).values({
        entity: args.entity,
        entity_id: args.entity_id,
        field: '__scope_violation__',
        editor_type: 'agent',
        editor_id: args.editor_id,
        editor_name: args.editor_name,
        change_kind: 'scalar',
        reason: `${args.action.toUpperCase()} denied: ${args.reason}`,
        ip_address: args.ip_address,
        user_agent: args.user_agent,
        edit_source: 'agent_api',
      });
    });
  } catch (err) {
    console.error('[agent api] failed to log scope violation:', err);
  }
}

/** Convert PageServiceError or generic error → NextResponse. */
export function mapServiceError(err: unknown, label: string): NextResponse {
  if (err instanceof PageServiceError) {
    return NextResponse.json(
      { error: err.message, code: err.code },
      { status: err.httpStatus },
    );
  }
  // Postgres unique violation
  const e = err as { code?: string; message?: string };
  if (e?.code === '23505') {
    return NextResponse.json(
      { error: e.message ?? 'unique constraint violation', code: 'duplicate' },
      { status: 409 },
    );
  }
  console.error(`[agent api ${label}]`, err);
  return NextResponse.json({ error: 'Internal error' }, { status: 500 });
}

/** Standard rate-limit headers attached to every successful response. */
export function rlHeaders(rl: { remaining: number; resetAt: number }): Record<string, string> {
  return {
    'X-RateLimit-Remaining': rl.remaining.toString(),
    'X-RateLimit-Reset': Math.floor(rl.resetAt / 1000).toString(),
  };
}
