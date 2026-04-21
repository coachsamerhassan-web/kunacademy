import {
  pgTable,
  text,
  uuid,
  numeric,
  timestamp,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { programs } from './programs';

/**
 * Region-level price overrides for service-type programs.
 *
 * Introduced in migration 0042 (2026-04-21).
 *
 * Use-case: Wisal, Seeds-Parents, Seeds-Caregivers are priced differently
 * across UAE (AED), Egypt (EGP), KSA (SAR) and other regions.  Admins set
 * these via /admin/programs/[slug]/overrides.
 *
 * Public-facing price display reads from here first, falling back to the
 * base program price_* columns when no override exists for the visitor's
 * region.
 *
 * RLS: anon + authenticated can SELECT; writes require kunacademy_admin
 * (withAdminContext).  See migration 0042 for the full RLS policy DDL.
 */
export const programPriceOverrides = pgTable(
  'program_price_overrides',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    /** FK to programs.slug — cascades on program delete */
    program_slug: text('program_slug')
      .notNull()
      .references(() => programs.slug, { onDelete: 'cascade' }),

    /**
     * Region key — free-form but convention is ISO 3166-1 alpha-2:
     *   "AE" (UAE), "EG" (Egypt), "SA" (Saudi Arabia), "OTHER"
     * Unique per program+region (enforced at DB level).
     */
    region: text('region').notNull(),

    /** Override price in the specified currency (decimal, 2dp). */
    price: numeric('price', { precision: 10, scale: 2 }).notNull(),

    /** Currency code: AED | EGP | SAR | USD | EUR */
    currency: text('currency').notNull(),

    /** Optional admin memo (e.g. "Q2 2026 promo rate — review July"). */
    notes: text('notes'),

    created_at: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    slugRegionUidx: uniqueIndex('ppo_slug_region_uidx').on(t.program_slug, t.region),
    programSlugIdx: index('ppo_program_slug_idx').on(t.program_slug),
    regionIdx: index('ppo_region_idx').on(t.region),
  }),
);

export type ProgramPriceOverrideRow = typeof programPriceOverrides.$inferSelect;
export type NewProgramPriceOverrideRow = typeof programPriceOverrides.$inferInsert;
