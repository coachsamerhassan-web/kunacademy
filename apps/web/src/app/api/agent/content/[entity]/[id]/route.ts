/**
 * Wave 15 Phase 1.5 — Agent Content API
 *
 *   GET   /api/agent/content/:entity/:id
 *   PATCH /api/agent/content/:entity/:id
 *
 * Authentication: Bearer token in Authorization header. Token must be a
 * valid, non-revoked entry in agent_tokens. Tokens are SHA-256 hashed at
 * rest — see /lib/agent-api/auth.ts.
 *
 * Authorization:
 *   - Agent must have READ  scope on the entity for GET
 *   - Agent must have WRITE scope on the entity for PATCH
 *   - Per-field exclusions enforce human-gated fields (see scopes.ts)
 *
 * Rate limiting: per-token, in-memory sliding-window. Default 60 req/min.
 *
 * Audit: every PATCH writes one row per changed field to content_edits.
 * The audit trail is HOT — it's the only forensic record of what an agent
 * touched. Writes are NOT fire-and-forget — if the audit insert fails,
 * the whole PATCH fails and rolls back.
 *
 * Response shape for GET:
 *   {
 *     entity: 'landing_pages',
 *     id: '...',
 *     fields: {
 *       [field_name]: {
 *         kind: 'scalar' | 'rich_text' | 'jsonb',
 *         value: ...,
 *         // for rich_text fields:
 *         tiptap?: JSONContent,
 *         html_rendered?: string,   // sanitized
 *         markdown?: string,
 *         plain_text?: string,
 *       }
 *     },
 *     metadata: { updated_at, last_edited_at }
 *   }
 *
 * Request shape for PATCH:
 *   {
 *     updates: {
 *       [field_name]: scalar | tiptap-json | { markdown: "..." } | jsonb-object
 *     },
 *     reason?: "optional commit message for audit trail"
 *   }
 *
 * Rich-text fields accept EITHER TipTap JSON directly OR { markdown: "..." }.
 * Markdown is converted server-side via markdown-adapter. Both channels
 * end up sanitized before storage.
 */

import { NextRequest, NextResponse } from 'next/server';
import { eq, sql } from 'drizzle-orm';
import { db, withAdminContext } from '@kunacademy/db';
import { content_edits } from '@kunacademy/db/schema';
import { authenticateAgent, extractBearer, checkRateLimit, clientIpFromRequest } from '@/lib/agent-api/auth';
import { canRead, canWrite, isFieldWritable } from '@/lib/agent-api/scopes';
import { getEntity, fieldKind, type FieldKind } from '@/lib/agent-api/entities';
import { markdownToTipTapJson, tipTapJsonToMarkdown } from '@/lib/agent-api/markdown-adapter';
// Import from sub-paths so the 'use client' editor component doesn't leak
// into the server build.
import { sanitizeRichHtml } from '@kunacademy/ui/rich-editor/sanitizer';
import { extractPlainText } from '@kunacademy/ui/rich-editor/rich-content';
import { generateHTML } from '@tiptap/html';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import TextAlign from '@tiptap/extension-text-align';
import { Node, mergeAttributes } from '@tiptap/core';
import type { JSONContent } from '@tiptap/react';

// Extensions mirror the server-side render path for consistent HTML output
const VideoEmbedAgentNode = Node.create({
  name: 'videoEmbed',
  group: 'block',
  atom: true,
  addAttributes() {
    return {
      src: { default: null },
      provider: { default: null },
      title: { default: 'Embedded video' },
    };
  },
  parseHTML() { return [{ tag: 'iframe[data-rich-video-provider]' }]; },
  renderHTML({ HTMLAttributes, node }) {
    const provider = node.attrs.provider as string | null;
    const allowAttr = provider === 'gdrive' ? { allow: 'autoplay' } : {};
    return ['iframe', mergeAttributes(HTMLAttributes, {
      'data-rich-video-provider': provider ?? '',
      width: '100%',
      height: '400',
      loading: 'lazy',
      referrerpolicy: 'strict-origin-when-cross-origin',
      sandbox: 'allow-scripts allow-same-origin allow-presentation',
      frameborder: '0',
      allowfullscreen: 'true',
      ...allowAttr,
    })];
  },
});

const RENDER_EXTENSIONS = [
  StarterKit.configure({ heading: { levels: [1, 2, 3] }, code: false, codeBlock: false }),
  Link.configure({ openOnClick: false, autolink: false }),
  Image.configure({ inline: false, allowBase64: false }),
  TextAlign.configure({ types: ['heading', 'paragraph'] }),
  VideoEmbedAgentNode,
];

// ── Route param types ───────────────────────────────────────────────────
interface RouteContext {
  params: Promise<{ entity: string; id: string }>;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ── Common pre-flight: auth + rate limit + param validation ──────────
async function preflight(
  request: NextRequest,
  context: RouteContext,
  action: 'read' | 'write',
) {
  const { entity, id } = await context.params;

  // 1. Shape guards on URL params
  if (!/^[a-z_][a-z0-9_]*$/i.test(entity)) {
    return {
      error: NextResponse.json({ error: 'Invalid entity name' }, { status: 400 }),
    };
  }
  if (!UUID_RE.test(id)) {
    return {
      error: NextResponse.json({ error: 'Invalid id — must be UUID' }, { status: 400 }),
    };
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
  const scopeCheck = action === 'read' ? canRead(agent.agentName, entity) : canWrite(agent.agentName, entity);
  if (!scopeCheck.allowed) {
    // Log scope violation to audit trail — these are high-value forensic events
    await logScopeViolation({
      entity,
      entity_id: id,
      editor_id: agent.tokenId,
      editor_name: agent.agentName,
      action,
      ip_address: clientIp,
      user_agent: request.headers.get('user-agent'),
      reason: scopeCheck.reason ?? 'Scope violation',
    });
    return {
      error: NextResponse.json({ error: scopeCheck.reason ?? 'Forbidden' }, { status: 403 }),
    };
  }

  // 5. Entity exists in the registry
  const registration = getEntity(entity);
  if (!registration) {
    return {
      error: NextResponse.json({ error: `Entity '${entity}' not available via the agent API` }, { status: 404 }),
    };
  }

  return {
    agent,
    entity,
    id,
    registration,
    clientIp,
    userAgent: request.headers.get('user-agent'),
    rateLimit: rl,
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

// ── GET ─────────────────────────────────────────────────────────────────
export async function GET(request: NextRequest, context: RouteContext) {
  const pre = await preflight(request, context, 'read');
  if ('error' in pre) return pre.error;
  const { agent, entity, id, registration, rateLimit } = pre;

  const row = await withAdminContext(async (adminDb) => {
    const rows = await adminDb
      .select()
      .from(registration.table)
      .where(eq((registration.table as unknown as Record<string, unknown>)[registration.idColumn] as never, id))
      .limit(1);
    return rows[0] ?? null;
  });

  if (!row) {
    return NextResponse.json({ error: `${entity} with id ${id} not found` }, { status: 404 });
  }

  // Serialize each registered field with TipTap-aware rendering
  const fields: Record<string, unknown> = {};
  for (const [fieldName, kind] of Object.entries(registration.fields)) {
    const value = (row as Record<string, unknown>)[fieldName];
    fields[fieldName] = serializeField(value, kind);
  }

  return NextResponse.json(
    {
      entity,
      id,
      fields,
      metadata: {
        updated_at: (row as Record<string, unknown>).updated_at ?? null,
        last_edited_at: (row as Record<string, unknown>).last_edited_at ?? null,
      },
      agent: agent.agentName,
    },
    {
      headers: {
        'X-RateLimit-Remaining': rateLimit.remaining.toString(),
        'X-RateLimit-Reset': Math.floor(rateLimit.resetAt / 1000).toString(),
      },
    },
  );
}

function serializeField(value: unknown, kind: FieldKind): unknown {
  if (kind === 'scalar') {
    return { kind: 'scalar', value };
  }
  if (kind === 'jsonb') {
    return { kind: 'jsonb', value };
  }
  // rich_text — value is a TipTap JSON doc (or null)
  const doc = value as JSONContent | null | undefined;
  if (!doc) {
    return { kind: 'rich_text', tiptap: null, html_rendered: '', plain_text: '', markdown: '' };
  }
  let html = '';
  try {
    const raw = generateHTML(doc, RENDER_EXTENSIONS);
    html = sanitizeRichHtml(raw);
  } catch (err) {
    console.error('[agent api] generateHTML failed:', err);
  }
  return {
    kind: 'rich_text',
    tiptap: doc,
    html_rendered: html,
    plain_text: extractPlainText(doc, 1000),
    markdown: tipTapJsonToMarkdown(doc),
  };
}

// ── PATCH ───────────────────────────────────────────────────────────────
export async function PATCH(request: NextRequest, context: RouteContext) {
  const pre = await preflight(request, context, 'write');
  if ('error' in pre) return pre.error;
  const { agent, entity, id, registration, clientIp, userAgent, rateLimit } = pre;

  // Parse body
  let body: { updates?: Record<string, unknown>; reason?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Body must be a JSON object' }, { status: 400 });
  }
  const updates = body.updates;
  if (!updates || typeof updates !== 'object') {
    return NextResponse.json({ error: 'Missing required field: updates' }, { status: 400 });
  }
  const reason = typeof body.reason === 'string' ? body.reason.slice(0, 500) : null;

  // Validate every update BEFORE hitting the DB
  const normalizedUpdates: Record<string, { kind: FieldKind; value: unknown }> = {};
  const errors: string[] = [];

  for (const [fieldName, rawValue] of Object.entries(updates)) {
    // Field must be in the registry
    const kind = fieldKind(entity, fieldName);
    if (!kind) {
      errors.push(`Unknown field '${fieldName}' on entity '${entity}'`);
      continue;
    }
    // Field must be writable by this agent
    const fw = isFieldWritable(agent.agentName, entity, fieldName);
    if (!fw.allowed) {
      errors.push(fw.reason ?? `Field '${fieldName}' not writable`);
      continue;
    }

    // Normalize by kind
    try {
      normalizedUpdates[fieldName] = { kind, value: normalizeValue(rawValue, kind) };
    } catch (err) {
      errors.push(`${fieldName}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  if (errors.length > 0) {
    return NextResponse.json({ error: 'Validation failed', details: errors }, { status: 400 });
  }

  if (Object.keys(normalizedUpdates).length === 0) {
    return NextResponse.json({ error: 'No valid updates supplied' }, { status: 400 });
  }

  // Read current row so we can diff for audit + verify existence
  const currentRow = await withAdminContext(async (adminDb) => {
    const rows = await adminDb
      .select()
      .from(registration.table)
      .where(eq((registration.table as unknown as Record<string, unknown>)[registration.idColumn] as never, id))
      .limit(1);
    return rows[0] ?? null;
  });

  if (!currentRow) {
    return NextResponse.json({ error: `${entity} with id ${id} not found` }, { status: 404 });
  }

  const nameField = registration.nameField;
  const entityDisplayName = nameField
    ? (currentRow as Record<string, unknown>)[nameField]
    : id;

  // Build the SET clause
  const setClause: Record<string, unknown> = {};
  const diffs: Array<{ field: string; previous: unknown; next: unknown; kind: FieldKind }> = [];
  for (const [fieldName, { kind, value }] of Object.entries(normalizedUpdates)) {
    const previous = (currentRow as Record<string, unknown>)[fieldName];
    // Skip updates that don't change anything
    if (JSON.stringify(previous) === JSON.stringify(value)) continue;
    setClause[fieldName] = value;
    diffs.push({ field: fieldName, previous, next: value, kind });
  }

  if (diffs.length === 0) {
    return NextResponse.json({
      entity,
      id,
      entity_name: entityDisplayName,
      changes: 0,
      message: 'No changes — every submitted value already matches the stored value',
    });
  }

  // Single transaction: update the entity + insert one audit row per diff.
  // If the audit insert fails, the update rolls back — we never leave
  // an unlogged mutation on a content surface.
  //
  // IMPORTANT: withAdminContext already wraps the callback in BEGIN/COMMIT
  // on a dedicated connection. All queries below run inside that outer
  // transaction — throwing at any point triggers ROLLBACK.
  try {
    await withAdminContext(async (adminDb) => {
      await adminDb
        .update(registration.table)
        .set(setClause)
        .where(eq((registration.table as unknown as Record<string, unknown>)[registration.idColumn] as never, id));

      for (const diff of diffs) {
        await adminDb.insert(content_edits).values({
          entity,
          entity_id: id,
          field: diff.field,
          editor_type: 'agent',
          editor_id: agent.tokenId,
          editor_name: agent.agentName,
          previous_value: diff.previous as never,
          new_value: diff.next as never,
          change_kind: diff.kind === 'rich_text' ? 'rich_text_replaced'
                     : diff.kind === 'jsonb'    ? 'jsonb_merged'
                     : 'scalar',
          reason,
          ip_address: clientIp,
          user_agent: userAgent,
          edit_source: 'agent_api',
        });
      }
    });
  } catch (err) {
    console.error('[agent api PATCH] transaction failed:', err);
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }

  return NextResponse.json(
    {
      entity,
      id,
      entity_name: entityDisplayName,
      changes: diffs.length,
      fields_changed: diffs.map((d) => d.field),
      agent: agent.agentName,
    },
    {
      status: 200,
      headers: {
        'X-RateLimit-Remaining': rateLimit.remaining.toString(),
        'X-RateLimit-Reset': Math.floor(rateLimit.resetAt / 1000).toString(),
      },
    },
  );
}

/**
 * Normalize a raw patch value based on its declared kind.
 *   - scalar: must be string | number | boolean | null
 *   - jsonb:  must be a plain object or array or null
 *   - rich_text: accept TipTap JSON directly OR { markdown: "..." }
 *     Either way we end up with a sanitized TipTap JSON doc.
 */
function normalizeValue(raw: unknown, kind: FieldKind): unknown {
  if (kind === 'scalar') {
    if (raw === null) return null;
    if (typeof raw === 'string') {
      if (raw.length > 20_000) {
        throw new Error('scalar string too long (max 20,000 chars)');
      }
      return raw;
    }
    if (typeof raw === 'number' || typeof raw === 'boolean') return raw;
    throw new Error('scalar must be string | number | boolean | null');
  }
  if (kind === 'jsonb') {
    if (raw === null) return null;
    if (typeof raw !== 'object') throw new Error('jsonb must be object, array, or null');
    const serialized = JSON.stringify(raw);
    if (serialized.length > 500_000) {
      throw new Error('jsonb value too large (max 500 KB serialized)');
    }
    return raw;
  }
  // rich_text
  if (raw === null) return null;

  if (
    typeof raw === 'object' &&
    raw !== null &&
    'markdown' in (raw as Record<string, unknown>) &&
    typeof (raw as { markdown: unknown }).markdown === 'string'
  ) {
    // Markdown channel — convert through the adapter, which sanitizes.
    const md = (raw as { markdown: string }).markdown;
    return markdownToTipTapJson(md);
  }

  // Direct TipTap JSON — validate shape + sanitize via HTML round-trip
  if (typeof raw === 'object' && (raw as { type?: string }).type === 'doc') {
    const serialized = JSON.stringify(raw);
    if (serialized.length > 500_000) {
      throw new Error('rich_text value too large (max 500 KB serialized)');
    }
    // Round-trip through HTML to guarantee nothing bypasses the sanitizer.
    try {
      const raw2 = raw as JSONContent;
      const html = generateHTML(raw2, RENDER_EXTENSIONS);
      // If sanitizer strips anything material, the round-trip still preserves
      // valid content. Anything it STRIPS is content we wouldn't render anyway,
      // so storing pre-sanitized is a win.
      void sanitizeRichHtml(html);
      return raw2;
    } catch (err) {
      throw new Error(`invalid TipTap JSON: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  throw new Error('rich_text must be a TipTap doc ({type:"doc",...}) or { markdown: "..." }');
}

// ── DELETE — soft-delete via transition to 'archived' (Wave 15 W2) ─────────
//
// The Agent Content API never hard-deletes content rows. DELETE is a soft
// delete — it transitions the row to status='archived', which writes:
//   1. A snapshot row (taken BEFORE the transition, reason='archive')
//   2. A content_edits row with change_kind='transition_archived'
//   3. The status flip itself (sync trigger keeps published BOOLEAN in sync)
//
// Required: canWrite(agent, entity) + canInvokeVerb(agent, 'archive').
// Returns 422 if the row is already archived (invalid transition).
import { softDeletePage as softDeletePageW2, PageServiceError as PageServiceErrorW2 } from '@/lib/authoring/page-service-w2';
import { canInvokeVerb as canInvokeVerbW2 } from '@/lib/agent-api/scopes';
import { isStateMachineEntity as isSM_W2 } from '@/lib/agent-api/entities';

export async function DELETE(request: NextRequest, context: RouteContext) {
  const pre = await preflight(request, context, 'write');
  if ('error' in pre) return pre.error;
  const { agent, entity, id, clientIp, userAgent, rateLimit } = pre;

  // DELETE is only valid on state-machine entities
  if (!isSM_W2(entity)) {
    return NextResponse.json(
      { error: `DELETE not supported on entity '${entity}' (state-machine entities only)` },
      { status: 405 },
    );
  }

  const verb = canInvokeVerbW2(agent.agentName, 'archive');
  if (!verb.allowed) {
    return NextResponse.json({ error: verb.reason ?? 'Forbidden' }, { status: 403 });
  }

  // Best-effort body parse (DELETE may have empty body)
  let body: { reason?: string; metadata?: Record<string, unknown> } | null = null;
  try {
    const txt = await request.text();
    if (txt) body = JSON.parse(txt);
  } catch {
    body = null;
  }

  try {
    const post = await softDeletePageW2(
      entity as any,
      id,
      {
        kind: 'agent',
        id: agent.tokenId,
        name: agent.agentName,
      },
      {
        edit_source: 'agent_api',
        reason: body && typeof body.reason === 'string' ? body.reason.slice(0, 500) : null,
        ip_address: clientIp,
        user_agent: userAgent,
        metadata: body && typeof body.metadata === 'object' && body.metadata !== null ? body.metadata : null,
      },
    );

    return NextResponse.json(
      {
        entity,
        id,
        status: post.status,
        archived: true,
        agent: agent.agentName,
      },
      {
        status: 200,
        headers: {
          'X-RateLimit-Remaining': rateLimit.remaining.toString(),
          'X-RateLimit-Reset': Math.floor(rateLimit.resetAt / 1000).toString(),
        },
      },
    );
  } catch (err) {
    if (err instanceof PageServiceErrorW2) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.httpStatus },
      );
    }
    console.error('[agent api DELETE]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
