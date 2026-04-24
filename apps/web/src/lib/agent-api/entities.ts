/**
 * Wave 15 Phase 1.5 — Entity registry for the Agent Content API.
 *
 * Every entity the API understands is declared HERE. For each entity we
 * list:
 *   - table           (Drizzle table object)
 *   - idColumn        (the PK column — used for WHERE id=$1)
 *   - richTextFields  (TipTap JSON columns — agents PATCH these)
 *   - scalarFields    (simple text/number/bool — agents PATCH these)
 *   - jsonbFields     (structured JSONB — agents PATCH these in whole)
 *   - nameField       (optional — for human-readable audit trail)
 *
 * Agents can ONLY write to columns listed here. Anything else (FKs,
 * timestamps, identifiers) is implicitly excluded.
 *
 * To add a new entity: add it here, in agent-api/scopes.ts, and verify
 * the DeepSeek test suite still passes.
 */

import { landing_pages, programs, blog_posts, testimonials } from '@kunacademy/db/schema';
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
    },
    nameField: 'slug',
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
