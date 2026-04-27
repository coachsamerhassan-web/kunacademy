/**
 * Wave 15 Phase 1.5 + Wave 2 — Agent scope registry.
 *
 * Maps each agent to the content entities it can READ and WRITE. Every
 * Agent Content API request checks this registry BEFORE touching the DB.
 * If an agent attempts a surface outside its scope, the API returns 403
 * and logs a scope-violation audit row.
 *
 * Ownership boundaries are derived from the C-suite's domain split:
 *   - Hakima   (CEDO) — curriculum, pathfinder, programs
 *                       + Wave 15: static_pages (methodology_essay, program_detail)
 *                       + new verb `approve_methodology_adjacent`
 *   - Shahira  (CMO)  — marketing surfaces — landing_pages, blog_posts, testimonials
 *                       + Wave 15: static_pages (field-level on landing_pages composition_json)
 *                       + Wave 2: `publish_scopes: ['testimonials']` (D8 narrow carve-out)
 *   - Sani'    (CTO)  — no public-content surfaces. Read-only awareness.
 *   - Amin     (CFO)  — pricing_config (READ only)
 *                       + Wave 15: static_pages (kind: 'static' for terms/refund)
 *   - Nashit   (COO)  — operations copy on landing_pages (READ + WRITE scoped)
 *                       + Wave 15: static_pages (portal_page, static); blog_posts kind='announcement_post'
 *   - Hakawati (CCD)  — creative copy on testimonials (READ + WRITE scoped)
 *                       + Wave 15: read on landing_pages/blog_posts/static_pages for proposal context
 *   - Rafik    (CoS)  — read-only across everything for orchestration
 *
 * Wave 15 Wave 2 additions:
 *
 *   1. `actions` set on every agent — fine-grained verbs beyond
 *      read/write/delete. Verbs include:
 *        create_draft, submit_review, approve_methodology_adjacent,
 *        create_proposal, schedule_publish, archive, rollback
 *      Used by /transition + /rollback + /sections routes.
 *
 *   2. `publish_scopes` (Set<entity>) — the ONLY mechanism by which an
 *      agent can move a row from `review` to `published` without an
 *      admin in the loop. Default empty for every agent. Shahira's
 *      `testimonials` entry is the launch-day carve-out (D8); others
 *      route to admin via `submit_review`.
 *
 *   3. Field-level exclusions extended for new entities + new fields.
 *      `status`, `scheduled_publish_at`, `published`, `published_at`,
 *      `launch_lock`, `last_edited_*`, and `created_by_*` are universally
 *      excluded — agent writes cannot touch them via the general PATCH
 *      surface. Status changes go through the dedicated /transition route
 *      (which still gates on publish_scopes).
 *
 * Field-level exclusions exist because an agent should NEVER be able to
 * mutate identifiers, slugs, ownership FKs, or launch controls. Those are
 * always human-gated in admin UI.
 */

export type AgentAction = 'read' | 'write';

/**
 * Wave 15 Wave 2 — fine-grained verbs beyond CRUD. Used by /transition,
 * /rollback, /sections and MCP tools to gate destructive or
 * authority-sensitive operations.
 */
export type AgentVerb =
  | 'create_draft'
  | 'submit_review'
  | 'approve_methodology_adjacent'
  | 'create_proposal'
  | 'schedule_publish'
  | 'archive'
  | 'rollback';

export interface AgentScopeEntry {
  /** Entities the agent can READ. */
  readable: Set<string>;
  /** Entities the agent can WRITE. */
  writable: Set<string>;
  /** Per-entity field exclusions — even if the agent has write access to
   *  the entity, these fields are read-only. */
  fieldExcluded: Record<string, Set<string>>;
  /** Wave 15 W2: fine-grained verbs the agent may invoke. */
  actions: Set<AgentVerb>;
  /** Wave 15 W2: entities the agent may directly publish (review→published)
   *  without admin approval. EMPTY by default; populate narrowly. */
  publishScopes: Set<string>;
  /** Rate limit override. Defaults to 60 req/min. */
  rateLimitPerMin?: number;
}

// ── Default field exclusions applied across all agents ─────────────────
// These should NEVER be agent-writable no matter the entity.
const UNIVERSAL_EXCLUDED_FIELDS = new Set<string>([
  'id',
  'created_at',
  'updated_at',
  'published_at',
  'launch_lock',
  'published',
  'slug',              // structural — changes break routing
  'program_id',
  'program_slug',
  'last_edited_by',
  'last_edited_at',
  // Wave 15 W2 universal exclusions: state-machine columns + provenance
  'status',
  'scheduled_publish_at',
  'last_edited_by_kind',
  'last_edited_by_name',
  'created_by_kind',
  'created_by_id',
]);

function mergeExclusions(
  perEntity: Record<string, string[]>,
): Record<string, Set<string>> {
  const out: Record<string, Set<string>> = {};
  for (const [entity, fields] of Object.entries(perEntity)) {
    const s = new Set<string>(UNIVERSAL_EXCLUDED_FIELDS);
    for (const f of fields) s.add(f);
    out[entity] = s;
  }
  return out;
}

// ── Per-agent scope definitions ────────────────────────────────────────
// Single source of truth. To expand an agent's reach, edit this file and
// re-deploy. Tokens in the DB carry a snapshot of their scopes at issuance
// time — but the runtime check uses THIS registry, so changes take effect
// on the next request.

export const AGENT_SCOPES: Record<string, AgentScopeEntry> = {
  // CEDO — Hakima: curriculum + pathfinder + programs
  // Wave 15 W2: + static_pages (methodology_essay + program_detail kinds)
  //            + new verb approve_methodology_adjacent
  hakima: {
    readable: new Set([
      'programs',
      'landing_pages',
      'pathfinder_questions',
      'pathfinder_answers',
      'pathfinder_outcomes',
      'static_pages',
      'blog_posts',
      'instructors', // read-only for author_bio refs (per spec §5.3)
    ]),
    writable: new Set([
      'programs',
      'pathfinder_questions',
      'pathfinder_answers',
      'pathfinder_outcomes',
      'static_pages',
    ]),
    fieldExcluded: mergeExclusions({
      programs: ['tier_id', 'price_usd', 'price_egp', 'price_aed'],
      pathfinder_questions: [],
      pathfinder_answers: [],
      pathfinder_outcomes: [],
      static_pages: [],
    }),
    actions: new Set<AgentVerb>([
      'create_draft',
      'submit_review',
      'approve_methodology_adjacent',
      'archive',
      'rollback',
    ]),
    publishScopes: new Set<string>(),
  },

  // CMO — Shahira: marketing surfaces
  // Wave 15 W2: + publish_scopes: ['testimonials'] (D8 narrow carve-out)
  shahira: {
    readable: new Set([
      'landing_pages',
      'blog_posts',
      'testimonials',
      'programs',
      'static_pages',
    ]),
    writable: new Set([
      'landing_pages',
      'blog_posts',
      'testimonials',
      'static_pages', // field-level scope handled via fieldExcluded
    ]),
    fieldExcluded: mergeExclusions({
      landing_pages: ['page_type', 'program_id', 'program_slug'],
      blog_posts:    [],
      testimonials:  ['approved', 'approved_by', 'approved_at'],
      // static_pages — Shahira contributes hero/CTA copy in landing_pages
      // composition; on static_pages she's restricted to composition_json
      // only (no hero_json, no seo_meta_json — those are Hakima's lane on
      // static pages).
      static_pages:  ['hero_json', 'seo_meta_json', 'kind'],
    }),
    actions: new Set<AgentVerb>([
      'create_draft',
      'submit_review',
      'archive',
      'rollback',
    ]),
    publishScopes: new Set<string>(['testimonials']), // D8 narrow carve-out
  },

  // CTO — Sani': infrastructure, not content. Read-only for awareness.
  sani: {
    readable: new Set(['landing_pages', 'programs', 'blog_posts', 'static_pages']),
    writable: new Set(),
    fieldExcluded: {},
    actions: new Set<AgentVerb>(), // No content actions
    publishScopes: new Set<string>(),
  },

  // CFO — Amin: pricing visibility + scholarship/terms static pages
  amin: {
    readable: new Set(['programs', 'pricing_config', 'static_pages']),
    writable: new Set(['static_pages']),
    fieldExcluded: mergeExclusions({
      // Amin only writes 'static' kind static pages (terms/refund/scholarship-transparency).
      // The kind discriminator is universally excluded; downstream lints
      // would reject methodology_essay/program_detail/portal_page from
      // his writes (lint R12 routes to Hakima for review).
      static_pages: [],
    }),
    actions: new Set<AgentVerb>([
      'create_draft',
      'submit_review',
      'archive',
    ]),
    publishScopes: new Set<string>(),
  },

  // COO — Nashit: operations copy on landing pages + portal/announcements
  nashit: {
    readable: new Set([
      'landing_pages',
      'programs',
      'static_pages',
      'blog_posts',
    ]),
    writable: new Set(['landing_pages', 'static_pages', 'blog_posts']),
    fieldExcluded: mergeExclusions({
      landing_pages: ['page_type', 'program_id', 'program_slug', 'composition_json'],
      // Static page restrictions: portal_page + 'static' (operational topics)
      // are within scope; other kinds get caught by R12 lint.
      static_pages: [],
      // Blog: announcement_post only (not articles); body/title fields are
      // open but kind must equal 'announcement_post' or transition lints
      // catch it.
      blog_posts: [],
    }),
    actions: new Set<AgentVerb>([
      'create_draft',
      'submit_review',
      'schedule_publish',
      'archive',
      'rollback',
    ]),
    publishScopes: new Set<string>(),
  },

  // CCD — Hakawati: creative surfaces on testimonials + read on LPs/blogs/static
  // Wave 15 W2: read across content surfaces (proposal context); write on testimonials only.
  // NOTE: visual_proposals as a standalone entity is DEFERRED to Wave 3
  // (when the editor right-rail surface decides what shape proposals take).
  // For now Hakawati gets create_proposal verb; routes that consume it
  // (Wave 3) will write to a content_proposals table OR to content_edits
  // with change_kind='proposal'.
  hakawati: {
    readable: new Set([
      'testimonials',
      'landing_pages',
      'programs',
      'blog_posts',
      'static_pages',
    ]),
    writable: new Set(['testimonials']),
    fieldExcluded: mergeExclusions({
      testimonials: ['approved', 'approved_by', 'approved_at'],
    }),
    actions: new Set<AgentVerb>([
      'create_draft',
      'submit_review',
      'create_proposal', // Wave 3 surface
      'archive',
      'rollback',
    ]),
    publishScopes: new Set<string>(),
  },

  // CoS — Rafik: read across everything for orchestration
  rafik: {
    readable: new Set([
      'landing_pages',
      'programs',
      'blog_posts',
      'testimonials',
      'pathfinder_questions',
      'pathfinder_answers',
      'pathfinder_outcomes',
      'pricing_config',
      'static_pages',
    ]),
    writable: new Set(),
    fieldExcluded: {},
    actions: new Set<AgentVerb>(), // Read-only orchestrator
    publishScopes: new Set<string>(),
    rateLimitPerMin: 120, // higher because orchestration polls more
  },
};

// ── Scope check helpers ────────────────────────────────────────────────
export interface ScopeCheckResult {
  allowed: boolean;
  reason?: string;
}

export function canRead(agentName: string, entity: string): ScopeCheckResult {
  const scope = AGENT_SCOPES[agentName];
  if (!scope) return { allowed: false, reason: `Unknown agent '${agentName}'` };
  if (!scope.readable.has(entity)) {
    return { allowed: false, reason: `Agent '${agentName}' has no read scope for '${entity}'` };
  }
  return { allowed: true };
}

export function canWrite(agentName: string, entity: string): ScopeCheckResult {
  const scope = AGENT_SCOPES[agentName];
  if (!scope) return { allowed: false, reason: `Unknown agent '${agentName}'` };
  if (!scope.writable.has(entity)) {
    return { allowed: false, reason: `Agent '${agentName}' has no write scope for '${entity}'` };
  }
  return { allowed: true };
}

/** Wave 15 W2: verb-level gate. */
export function canInvokeVerb(agentName: string, verb: AgentVerb): ScopeCheckResult {
  const scope = AGENT_SCOPES[agentName];
  if (!scope) return { allowed: false, reason: `Unknown agent '${agentName}'` };
  if (!scope.actions.has(verb)) {
    return { allowed: false, reason: `Agent '${agentName}' cannot invoke verb '${verb}'` };
  }
  return { allowed: true };
}

/** Wave 15 W2: publish-scope gate. agent → review uses canWrite + canInvokeVerb('submit_review');
 *  agent → published uses THIS gate AND requires entity ∈ publishScopes. */
export function canDirectPublish(agentName: string, entity: string): ScopeCheckResult {
  const scope = AGENT_SCOPES[agentName];
  if (!scope) return { allowed: false, reason: `Unknown agent '${agentName}'` };
  if (!scope.publishScopes.has(entity)) {
    return {
      allowed: false,
      reason: `Agent '${agentName}' lacks publish_scopes for '${entity}' (defaults to draft; admin must publish)`,
    };
  }
  return { allowed: true };
}

/** Get the publish_scopes set for an agent (Wave 15 W2 page-service.ts integration). */
export function publishScopesFor(agentName: string): Set<string> {
  const scope = AGENT_SCOPES[agentName];
  if (!scope) return new Set();
  return scope.publishScopes;
}

/** Check whether a specific field on an entity is writable by this agent.
 *  Entities an agent has write access to MAY still exclude certain fields
 *  (e.g. testimonials.approved — requires human approval). */
export function isFieldWritable(
  agentName: string,
  entity: string,
  field: string,
): ScopeCheckResult {
  const write = canWrite(agentName, entity);
  if (!write.allowed) return write;
  const scope = AGENT_SCOPES[agentName];
  const excluded = scope.fieldExcluded[entity];
  if (excluded && excluded.has(field)) {
    return {
      allowed: false,
      reason: `Field '${field}' on '${entity}' is not writable by agents (human-gated)`,
    };
  }
  return { allowed: true };
}

/** List of all agents — for seeding tokens */
export function allAgentNames(): string[] {
  return Object.keys(AGENT_SCOPES);
}

/** Serialize scope for DB storage (snapshot at token issuance) */
export function serializeScope(agentName: string): {
  entities: string[];
  actions: AgentAction[];
  fields_excluded: string[];
  verbs: AgentVerb[];
  publish_scopes: string[];
} | null {
  const scope = AGENT_SCOPES[agentName];
  if (!scope) return null;
  const entities = Array.from(new Set([...scope.readable, ...scope.writable])).sort();
  const actions: AgentAction[] = scope.writable.size > 0 ? ['read', 'write'] : ['read'];
  const excluded: string[] = [];
  for (const [entity, fields] of Object.entries(scope.fieldExcluded)) {
    for (const f of fields) excluded.push(`${entity}.${f}`);
  }
  return {
    entities,
    actions,
    fields_excluded: excluded.sort(),
    verbs: Array.from(scope.actions).sort() as AgentVerb[],
    publish_scopes: Array.from(scope.publishScopes).sort(),
  };
}
