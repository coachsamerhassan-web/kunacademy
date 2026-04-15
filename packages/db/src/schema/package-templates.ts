import { pgTable, boolean, integer, jsonb, numeric, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { instructors } from './instructors';

/**
 * package_templates — the reusable, admin-configurable template artifact.
 *
 * Source: SPEC-mentoring-package-template.md §4.1
 * Sub-phase: S2-Layer-1 / 1.1
 *
 * Context:
 *   'kun_student_bundled'  — template is bundled into a Kun program (e.g. STCE).
 *                            Only mentor_manager (MCC) can create/update.
 *   'external_standalone'  — standalone purchasable package for external coaches.
 *
 * Rubric FK note:
 *   rubric_id + rubric_version are NULLABLE with NO FK constraint until sub-phase 2.0
 *   creates the rubric_templates table and back-fills the constraint.
 *
 * Mentor rate columns:
 *   NULLABLE pending Amin + Samer pricing decision (Q5 locked decision).
 */
export const packageTemplates = pgTable("package_templates", {
  id:   uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),

  // ── Identity ──────────────────────────────────────────────────────────────
  name_ar:        text("name_ar").notNull(),
  name_en:        text("name_en").notNull(),
  description_ar: text("description_ar"),
  description_en: text("description_en"),
  /** 'stce' | 'manhajak' | 'external' | ... */
  program_family: text("program_family"),
  /** 'stic' | 'staic' | null for external */
  program_name:   text("program_name"),
  /** 1 | 2 | 3 — null for non-STCE programs */
  program_level:  integer("program_level"),

  // ── Context ────────────────────────────────────────────────────────────────
  /** CHECK: 'kun_student_bundled' | 'external_standalone' */
  context: text("context").notNull(),

  // ── Session composition ────────────────────────────────────────────────────
  coaching_sessions_count:  integer("coaching_sessions_count").notNull().default(0),
  mentoring_sessions_count: integer("mentoring_sessions_count").notNull().default(0),
  assessment_enabled:       boolean("assessment_enabled").notNull().default(false),
  final_session_enabled:    boolean("final_session_enabled").notNull().default(false),

  // ── Sequence gates ─────────────────────────────────────────────────────────
  /** Ordered JSONB array of step labels defining the flow */
  sequence_gates: jsonb("sequence_gates").notNull(),

  // ── Assessment configuration ───────────────────────────────────────────────
  /** Nullable — no FK to rubric_templates until sub-phase 2.0 */
  rubric_id:      text("rubric_id"),
  rubric_version: integer("rubric_version"),

  // ── Pricing behavior ───────────────────────────────────────────────────────
  /** CHECK: 'bundled_in_program' | 'standalone_purchase' | 'deposit' */
  price_behavior:  text("price_behavior"),
  /** null when bundled_in_program */
  price_amount:    numeric("price_amount", { precision: 10, scale: 2 }),
  price_currency:  text("price_currency"),

  // ── Mentor economics — NULLABLE pending pricing decision ───────────────────
  mentoring_session_rate: numeric("mentoring_session_rate", { precision: 10, scale: 2 }),
  assessment_rate:        numeric("assessment_rate",        { precision: 10, scale: 2 }),
  final_session_rate:     numeric("final_session_rate",     { precision: 10, scale: 2 }),

  // ── Validity ───────────────────────────────────────────────────────────────
  validity_window_days:       integer("validity_window_days").notNull().default(90),
  /** Kept even though no consumer uses it yet — locked decision Q5 */
  validity_extension_allowed: boolean("validity_extension_allowed").default(false),

  // ── Post-completion actions ────────────────────────────────────────────────
  prompt_testimonial:     boolean("prompt_testimonial").default(false),
  /** CHECK: 'private' | 'kun_internal' | 'public' */
  testimonial_visibility: text("testimonial_visibility"),
  offer_referral:         boolean("offer_referral").default(false),
  referral_credit_amount: numeric("referral_credit_amount", { precision: 10, scale: 2 }),
  issue_certificate:      boolean("issue_certificate").default(false),
  /** 'samer' | 'kun_coaching' | 'program_specific' */
  certificate_brand:      text("certificate_brand"),

  // ── Audit ──────────────────────────────────────────────────────────────────
  published:  boolean("published").default(false),
  /** must be a mentor_manager instructor when context = 'kun_student_bundled' */
  created_by: uuid("created_by").references(() => instructors.id),

  created_at: timestamp("created_at", { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
});

export type PackageTemplate    = typeof packageTemplates.$inferSelect;
export type NewPackageTemplate = typeof packageTemplates.$inferInsert;
