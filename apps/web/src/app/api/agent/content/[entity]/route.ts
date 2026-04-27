/**
 * /api/agent/content/:entity
 *
 *   GET   List all rows visible to the authenticated agent.
 *   POST  Create a new row at status='draft'. Wave 15 W2.
 *
 * GET returns minimal identifying columns (id + slug + timestamps). The
 * agent then calls GET /:entity/:id to fetch full field contents for a
 * specific row.
 *
 * POST requires:
 *   - canWrite(agent, entity)
 *   - canInvokeVerb(agent, 'create_draft')
 *   - body.slug + (entity-specific required scalars + kind)
 *   - the row lands as status='draft' (immutable: only /transition can flip it)
 *
 * IP rule R1+R2 are NOT linted on create — they fire on transition→review/published.
 * Empty drafts can be created; lints catch the body when the agent submits.
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
import { canRead, canWrite, canInvokeVerb, isFieldWritable } from '@/lib/agent-api/scopes';
import { getEntity, isStateMachineEntity } from '@/lib/agent-api/entities';
import { createPage, PageServiceError } from '@/lib/authoring/page-service-w2';

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

// ── POST — create a fresh draft row ────────────────────────────────────────
export async function POST(request: NextRequest, context: RouteContext) {
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

  // POST is only valid on state-machine entities (landing_pages, blog_posts, static_pages)
  if (!isStateMachineEntity(entity)) {
    return NextResponse.json(
      { error: `POST not supported on entity '${entity}' (state-machine entities only)` },
      { status: 405 },
    );
  }

  const writeCheck = canWrite(agent.agentName, entity);
  if (!writeCheck.allowed) {
    return NextResponse.json({ error: writeCheck.reason ?? 'Forbidden' }, { status: 403 });
  }

  const verbCheck = canInvokeVerb(agent.agentName, 'create_draft');
  if (!verbCheck.allowed) {
    return NextResponse.json({ error: verbCheck.reason ?? 'Forbidden' }, { status: 403 });
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

  const slug = body.slug;
  if (typeof slug !== 'string' || !slug) {
    return NextResponse.json({ error: 'slug required (string)' }, { status: 400 });
  }

  // Optional fields
  const kind = typeof body.kind === 'string' ? body.kind : undefined;
  const composition_json = isPlainObject(body.composition_json) ? body.composition_json : undefined;
  const hero_json = isPlainObject(body.hero_json) ? body.hero_json : undefined;
  const seo_meta_json = isPlainObject(body.seo_meta_json) ? body.seo_meta_json : undefined;

  // Per-entity scalar fields (e.g. blog_posts requires title_ar/_en;
  // landing_pages requires page_type). We pass these through scalars.
  const scalars: Record<string, unknown> = {};
  if (entity === 'landing_pages' && typeof body.page_type === 'string') {
    scalars.page_type = body.page_type;
  }
  if (entity === 'blog_posts') {
    if (typeof body.title_ar === 'string') scalars.title_ar = body.title_ar;
    if (typeof body.title_en === 'string') scalars.title_en = body.title_en;
  }

  // Field-level writability check on CREATE
  //
  // Creation seeds (page_type, title_ar/_en, kind) are required-at-INSERT
  // identifiers for their respective entities. They are NOT subject to the
  // general field-write check — that check protects the editing surface
  // (PATCH /[id]) from agents mutating structural identifiers on existing
  // rows. At creation time, the seeds ARE the structural identifiers
  // being established. Subsequent edits to these fields are still gated
  // by isFieldWritable.
  //
  // Body-shaped fields (composition_json, hero_json, seo_meta_json) DO
  // pass through the field-writable check, because they're the same fields
  // the editor uses for ongoing content edits and per-entity scope rules
  // apply (e.g. Shahira can't write hero_json on static_pages).
  const editableBodyFields = [
    'composition_json', 'hero_json', 'seo_meta_json',
  ];
  for (const f of editableBodyFields) {
    const provided = (f === 'composition_json') ? composition_json
      : (f === 'hero_json') ? hero_json
      : (f === 'seo_meta_json') ? seo_meta_json
      : undefined;
    if (provided === undefined) continue;
    const fw = isFieldWritable(agent.agentName, entity, f);
    if (!fw.allowed) {
      return NextResponse.json({ error: fw.reason ?? `Field ${f} not writable` }, { status: 403 });
    }
  }

  try {
    const created = await createPage({
      entity: entity as any, // already validated by isStateMachineEntity
      slug,
      kind,
      composition_json,
      hero_json,
      seo_meta_json,
      scalars,
      actor: {
        kind: 'agent',
        id: agent.tokenId,
        name: agent.agentName,
      },
      ctx: {
        edit_source: 'agent_api',
        reason: typeof body.reason === 'string' ? body.reason.slice(0, 500) : null,
        ip_address: clientIp,
        user_agent: request.headers.get('user-agent'),
        metadata: isPlainObject(body.metadata) ? body.metadata : null,
      },
    });

    return NextResponse.json(
      {
        entity: created.entity,
        id: created.id,
        slug: created.slug,
        kind: created.kind,
        status: 'draft',
        agent: agent.agentName,
      },
      {
        status: 201,
        headers: {
          'X-RateLimit-Remaining': rl.remaining.toString(),
          'X-RateLimit-Reset': Math.floor(rl.resetAt / 1000).toString(),
        },
      },
    );
  } catch (err) {
    return mapPageServiceError(err);
  }
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function mapPageServiceError(err: unknown): NextResponse {
  if (err instanceof PageServiceError) {
    return NextResponse.json(
      { error: err.message, code: err.code },
      { status: err.httpStatus },
    );
  }
  // Unique-violation fallback (Postgres SQLSTATE 23505)
  const e = err as { code?: string; message?: string };
  if (e?.code === '23505') {
    return NextResponse.json(
      { error: 'slug already exists', code: 'duplicate_slug' },
      { status: 409 },
    );
  }
  console.error('[agent api POST]', err);
  return NextResponse.json({ error: 'Internal error' }, { status: 500 });
}
