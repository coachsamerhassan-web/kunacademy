import { pgTable, text, timestamp, uuid, jsonb, integer, index } from 'drizzle-orm/pg-core';

/**
 * Wave 15 Phase 1.5 — agent_tokens
 *
 * Per-agent API credentials for the Agent Content API
 * (/api/agent/content/:entity/:id). Tokens are hashed at rest; plaintext
 * only appears once at creation and must be copied to
 *   /Users/samer/Claude Code/Project Memory/KUN-Website/Execution/agent-tokens.md
 * which is NOT checked into any git repo.
 *
 * Scope enforcement keeps each agent in their lane:
 *   - Hakima  → programs, pathfinder
 *   - Shahira → landing_pages, blog_posts, testimonials
 *   - Sani'   → system-level (deploy hooks, not content)
 *   - Amin    → pricing_config (read-heavy)
 *   - Nashit  → landing_pages (operations copy only)
 *   - Hakawati → (content TBD — flagged for Samer)
 *   - Rafik   → read-only across everything (orchestration visibility)
 *
 * See migration 0057_wave_15_rich_content.sql.
 */
export const agent_tokens = pgTable("agent_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  agent_name: text("agent_name").notNull(),
  token_hash: text("token_hash").notNull().unique(),
  token_prefix: text("token_prefix").notNull(),
  scopes: jsonb("scopes").notNull().default({}),
  rate_limit_per_min: integer("rate_limit_per_min").notNull().default(60),
  created_at: timestamp("created_at", { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  last_used_at: timestamp("last_used_at", { withTimezone: true, mode: 'string' }),
  last_used_ip: text("last_used_ip"),
  revoked_at: timestamp("revoked_at", { withTimezone: true, mode: 'string' }),
  revoked_reason: text("revoked_reason"),
  notes: text("notes"),
}, (t) => ({
  agentNameIdx: index("idx_agent_tokens_agent_name").on(t.agent_name),
  revokedAtIdx: index("idx_agent_tokens_revoked_at").on(t.revoked_at),
}));

export type AgentToken = typeof agent_tokens.$inferSelect;
export type NewAgentToken = typeof agent_tokens.$inferInsert;

/** Expected shape of the scopes column */
export interface AgentTokenScopes {
  entities: string[];
  actions: Array<'read' | 'write'>;
  fields_excluded?: string[];
}
