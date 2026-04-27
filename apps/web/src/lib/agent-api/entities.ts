/**
 * Wave 15 Phase 1.5 + Wave 2 — Entity registry for the Agent Content API.
 *
 * Every entity the API understands is declared HERE. For each entity we
 * list:
 *   - table           (Drizzle table object)
 *   - idColumn        (the PK column — used for WHERE id=$1)
 *   - fields          (map of field name → kind: rich_text | scalar | jsonb)
 *   - nameField       (optional — for human-readable audit trail)
 *   - supportsStateMachine (whether the row has Wave 15 W1 status state machine)
 *   - supportsComposition (whether composition_json sections ops apply)
 *
 * Agents can ONLY write to columns listed here. Anything else (FKs,
 * timestamps, identifiers) is implicitly excluded.
 *
 * Wave 15 Wave 2 additions:
 *   - `static_pages` registered (sibling of landing_pages, four kinds)
 *   - blog_posts gets `composition_json` + `*_rich` companion fields
 *   - blog_posts + landing_pages + static_pages are flagged as
 *     state-machine-aware (status / scheduled_publish_at) AND
 *     composition-aware (sections live inside composition_json)
 *   - Status state machine + scheduled_publish_at are read-only via the
 *     general PATCH path; transitions go through the dedicated
 *     /transition route to enforce lints + publish_scopes.
 *
 * To add a new entity: add it here, in agent-api/scopes.ts, and verify
 * the DeepSeek test suite still passes.
 */

import { landing_pages, programs, blog_posts, testimonials, static_pages } from '@kunacademy/db/schema';
import type { AnyPgTable } from 'drizzle-orm/pg-core';

export type FieldKind = 'rich_text' | 'scalar' | 'jsonb';

export interface EntityRegistration {
  // The Drizzle table — typed as AnyPgTable to allow a heterogeneous registry
  table: AnyPgTable;
  /** Column name carrying the UUID PK */
  idColumn: string;
  /** Map of field name → kind. Agents may only read/write these. */
  fields: Record<string, FieldKind>;
  /** Optional: column to populate editor_name audit trail from. */
  nameField?: string;
  /** Wave 15 W1: row participates in the status state machine. */
  supportsStateMachine?: boolean;
  /** Wave 15 W1: row's composition_json holds a sections[] array. */
  supportsComposition?: boolean;
  /** Slug column — used by create() to assign the URL identifier. */
  slugColumn?: string;
}

// ── Registry ──────────────────────────────────────────────────────────
// NOTE: blog_posts + testimonials registration depends on those schemas
// existing. If blog_posts has no body_ar/body_en we fall back gracefully
// by only registering confirmed fields.

export const ENTITIES: Record<string, EntityRegistration> = {
  landing_pages: {
    table: landing_pages,
    idColumn: 'id',
    fields: {
      // Existing bilingual scalars
      page_type: 'scalar',
      // JSONB content surfaces that TipTap documents may live under
      composition_json: 'jsonb',
      sections_json: 'jsonb',
      hero_json: 'jsonb',
      seo_meta_json: 'jsonb',
      lead_capture_config: 'jsonb',
      payment_config: 'jsonb',
      analytics_config: 'jsonb',
    },
    nameField: 'slug',
    slugColumn: 'slug',
    supportsStateMachine: true,
    supportsComposition: true,
  },

  programs: {
    table: programs,
    idColumn: 'id',
    fields: {
      // Bilingual copy fields on programs. Schema verified 2026-04-24.
      title_ar:             'scalar',
      title_en:             'scalar',
      subtitle_ar:          'scalar',
      subtitle_en:          'scalar',
      description_ar:       'scalar',
      description_en:       'scalar',
      // Long-form rich content (TipTap JSON stored as JSONB)
      long_description_ar:  'rich_text',
      long_description_en:  'rich_text',
      // SEO
      meta_title_ar:        'scalar',
      meta_title_en:        'scalar',
      meta_description_ar:  'scalar',
      meta_description_en:  'scalar',
    },
    nameField: 'slug',
    slugColumn: 'slug',
    // programs uses launch_lock + a different lifecycle (canon-bound)
    supportsStateMachine: false,
    supportsComposition: false,
  },

  blog_posts: {
    table: blog_posts,
    idColumn: 'id',
    fields: {
      title_ar:            'scalar',
      title_en:            'scalar',
      content_ar:          'scalar',
      content_en:          'scalar',
      excerpt_ar:          'scalar',
      excerpt_en:          'scalar',
      meta_title_ar:       'scalar',
      meta_title_en:       'scalar',
      meta_description_ar: 'scalar',
      meta_description_en: 'scalar',
      // Wave 15 W1 additions
      kind:                'scalar', // 'blog_article' | 'announcement_post'
      composition_json:    'jsonb',
      content_ar_rich:     'rich_text',
      content_en_rich:     'rich_text',
      excerpt_ar_rich:     'rich_text',
      excerpt_en_rich:     'rich_text',
    },
    nameField: 'slug',
    slugColumn: 'slug',
    supportsStateMachine: true,
    supportsComposition: true,
  },

  testimonials: {
    table: testimonials,
    idColumn: 'id',
    fields: {
      author_name_ar: 'scalar',
      author_name_en: 'scalar',
      content_ar:     'scalar',
      content_en:     'scalar',
      role_ar:        'scalar',
      role_en:        'scalar',
      location_ar:    'scalar',
      location_en:    'scalar',
    },
    nameField: 'author_name_en',
    // testimonials has its own approval flow (approved/approved_by/approved_at);
    // not part of the Wave 15 status state machine.
    supportsStateMachine: false,
    supportsComposition: false,
  },

  // Wave 15 Wave 2 — static_pages registration
  static_pages: {
    table: static_pages,
    idColumn: 'id',
    fields: {
      // kind discriminator: 'static' | 'program_detail' | 'methodology_essay' | 'portal_page'
      kind:             'scalar',
      composition_json: 'jsonb',
      hero_json:        'jsonb',
      seo_meta_json:    'jsonb',
    },
    nameField: 'slug',
    slugColumn: 'slug',
    supportsStateMachine: true,
    supportsComposition: true,
  },
};

export function getEntity(name: string): EntityRegistration | null {
  return ENTITIES[name] ?? null;
}

export function allEntityNames(): string[] {
  return Object.keys(ENTITIES);
}

export function fieldKind(entity: string, field: string): FieldKind | null {
  const reg = ENTITIES[entity];
  if (!reg) return null;
  return reg.fields[field] ?? null;
}

/**
 * Wave 15 Wave 2 — entities supported by the page-service state-machine /
 * snapshot / composition surface. Used by /transition, /sections,
 * /snapshots, /rollback, /diff routes to short-circuit non-supported
 * entities (e.g. testimonials, programs).
 */
export const STATE_MACHINE_ENTITIES = ['landing_pages', 'blog_posts', 'static_pages'] as const;
export type StateMachineEntity = (typeof STATE_MACHINE_ENTITIES)[number];

export function isStateMachineEntity(entity: string): entity is StateMachineEntity {
  return (STATE_MACHINE_ENTITIES as readonly string[]).includes(entity);
}
