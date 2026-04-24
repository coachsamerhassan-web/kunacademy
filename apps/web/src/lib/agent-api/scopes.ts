/**
 * Wave 15 Phase 1.5 — Agent scope registry.
 *
 * Maps each agent to the content entities it can READ and WRITE. Every
 * Agent Content API request checks this registry BEFORE touching the DB.
 * If an agent attempts a surface outside its scope, the API returns 403
 * and logs a scope-violation audit row.
 *
 * Ownership boundaries are derived from the C-suite's domain split:
 *   - Hakima   (CEDO) — curriculum, pathfinder, programs
 *   - Shahira  (CMO)  — marketing surfaces — landing_pages, blog_posts, testimonials
 *   - Sani'    (CTO)  — no content surfaces (builds infra, not copy)
 *   - Amin     (CFO)  — pricing_config (READ only — writes go through admin UI)
 *   - Nashit   (COO)  — operations copy on landing_pages (READ + WRITE scoped)
 *   - Hakawati (CCD)  — creative copy on testimonials (READ + WRITE scoped)
 *   - Rafik    (CoS)  — read-only across everything for orchestration
 *
 * Field-level exclusions exist because an agent should NEVER be able to
 * mutate identifiers, slugs, ownership FKs, or launch controls. Those are
 * always human-gated in admin UI.
 */

export type AgentAction = 'read' | 'write';

export interface AgentScopeEntry {
  /** Entities the agent can READ. */
  readable: Set<string>;
  /** Entities the agent can WRITE. */
  writable: Set<string>;
  /** Per-entity field exclusions — even if the agent has write access to
   *  the entity, these fields are read-only. */
  fieldExcluded: Record<string, Set<string>>;
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
  hakima: {
    readable: new Set(['programs', 'landing_pages', 'pathfinder_questions', 'pathfinder_answers', 'pathfinder_outcomes']),
    writable: new Set(['programs', 'pathfinder_questions', 'pathfinder_answers', 'pathfinder_outcomes']),
    fieldExcluded: mergeExclusions({
      programs: ['tier_id', 'price_usd', 'price_egp', 'price_aed'],
      pathfinder_questions: [],
      pathfinder_answers: [],
      pathfinder_outcomes: [],
    }),
  },

  // CMO — Shahira: marketing surfaces
  shahira: {
    readable: new Set(['landing_pages', 'blog_posts', 'testimonials', 'programs']),
    writable: new Set(['landing_pages', 'blog_posts', 'testimonials']),
    fieldExcluded: mergeExclusions({
      landing_pages: ['page_type', 'program_id', 'program_slug'],
      blog_posts:   [],
      testimonials: ['approved', 'approved_by', 'approved_at'],
    }),
  },

  // CTO — Sani': infrastructure, not content. Read-only for awareness.
  sani: {
    readable: new Set(['landing_pages', 'programs', 'blog_posts']),
    writable: new Set(),
    fieldExcluded: {},
  },

  // CFO — Amin: pricing visibility + nothing else
  amin: {
    readable: new Set(['programs', 'pricing_config']),
    writable: new Set(),
    fieldExcluded: {},
  },

  // COO — Nashit: operations copy on landing pages
  nashit: {
    readable: new Set(['landing_pages', 'programs']),
    writable: new Set(['landing_pages']),
    fieldExcluded: mergeExclusions({
      landing_pages: ['page_type', 'program_id', 'program_slug', 'composition_json'],
    }),
  },

  // CCD — Hakawati: creative surfaces on testimonials
  hakawati: {
    readable: new Set(['testimonials', 'landing_pages', 'programs']),
    writable: new Set(['testimonials']),
    fieldExcluded: mergeExclusions({
      testimonials: ['approved', 'approved_by', 'approved_at'],
    }),
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
    ]),
    writable: new Set(),
    fieldExcluded: {},
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
} | null {
  const scope = AGENT_SCOPES[agentName];
  if (!scope) return null;
  const entities = Array.from(new Set([...scope.readable, ...scope.writable])).sort();
  const actions: AgentAction[] = scope.writable.size > 0 ? ['read', 'write'] : ['read'];
  const excluded: string[] = [];
  for (const [entity, fields] of Object.entries(scope.fieldExcluded)) {
    for (const f of fields) excluded.push(`${entity}.${f}`);
  }
  return { entities, actions, fields_excluded: excluded.sort() };
}
