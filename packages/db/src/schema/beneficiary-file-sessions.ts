import { pgTable, integer, jsonb, text, timestamp, uuid, unique } from 'drizzle-orm/pg-core';
import { beneficiaryFiles } from './beneficiary-files';

/**
 * beneficiary_file_sessions — one row per (beneficiary_file × session_number).
 *
 * Source: SPEC-mentoring-package-template.md §6.1 (second table block)
 * Sub-phase: S2-Layer-1 / 1.3
 *
 * session_number: 1..3 (STIC L1 has 3 sessions per volunteer client).
 * CHECK (session_number BETWEEN 1 AND 3) enforced in DB migration.
 *
 * Status machine (server-enforced, API layer):
 *   draft  → submitted  (student submits pre OR post data)
 *   submitted → reviewed  (mentor marks reviewed after session)
 *   No regression allowed.
 *
 * ─── JSONB shapes ───────────────────────────────────────────────────────────
 *
 * pre_session_data — Beneficiary File pages 3-4:
 *   {
 *     "client_goal": string,
 *     "presenting_topic": string,
 *     "previous_session_follow_up": string,
 *     "somatic_hypothesis": string,
 *     "intended_tools": string[]
 *   }
 *
 * awareness_map — 5 cells (SPEC §6.1 inline comment):
 *   {
 *     "حكيمة":      { "observation": string, "evidence": string },
 *     "حركات":      { "observation": string, "evidence": string },
 *     "تحكم":       { "observation": string, "evidence": string },
 *     "الشخصية":    { "observation": string, "evidence": string },
 *     "الأنا":      { "observation": string, "evidence": string }
 *   }
 *
 * needs_resources_challenges — structured table from page 8:
 *   [{ "category": "needs" | "resources" | "challenges", "item": string }]
 *
 * self_evaluation — checklist against same criteria mentor will use:
 *   { "items": [{ "criterion": string, "met": boolean, "note": string | null }] }
 */
export const beneficiaryFileSessions = pgTable("beneficiary_file_sessions", {
  id:                  uuid("id").primaryKey().defaultRandom(),
  beneficiary_file_id: uuid("beneficiary_file_id")
                         .notNull()
                         .references(() => beneficiaryFiles.id, { onDelete: 'cascade' }),

  /**
   * Which session in this client's sequence (1, 2, or 3).
   * CHECK (session_number BETWEEN 1 AND 3) enforced in DB migration.
   */
  session_number: integer("session_number").notNull(),

  // ── Pre-session prep (pages 3-4) ──────────────────────────────────────────
  /** Structured prep reflection — see JSONB shape above. */
  pre_session_data: jsonb("pre_session_data"),

  // ── Post-session reflection (pages 5-11) ──────────────────────────────────
  /** Verbatim client quote about their goal. */
  client_goal_in_client_words:     text("client_goal_in_client_words"),
  /** Verbatim client quote about their learning from this session. */
  client_learning_in_client_words: text("client_learning_in_client_words"),
  /** 5-cell Awareness Map — see JSONB shape above. */
  awareness_map:                   jsonb("awareness_map"),
  /** Structured needs/resources/challenges table — see JSONB shape above. */
  needs_resources_challenges:      jsonb("needs_resources_challenges"),
  /** Student's immediate metaphor for this specific session. */
  immediate_metaphor:              text("immediate_metaphor"),
  /** Student's developmental metaphor (longer arc across sessions). */
  developmental_metaphor:          text("developmental_metaphor"),
  /** Self-evaluation checklist — see JSONB shape above. */
  self_evaluation:                 jsonb("self_evaluation"),
  /** Page 11 reflection: what to continue / stop / start. */
  continue_stop_start:             text("continue_stop_start"),

  // ── Recording (mandatory for session 3 per SPEC §5.1 M1.c / M2.b) ────────
  recording_url:               text("recording_url"),
  recording_duration_seconds:  integer("recording_duration_seconds"),

  // ── Status ─────────────────────────────────────────────────────────────────
  /**
   * 'draft' | 'submitted' | 'reviewed'
   * CHECK enforced in DB migration.
   * Transitions enforced at API layer — no regression allowed.
   */
  status: text("status").notNull().default('draft'),

  submitted_at: timestamp("submitted_at", { withTimezone: true, mode: 'string' }),
  reviewed_at:  timestamp("reviewed_at",  { withTimezone: true, mode: 'string' }),

  // ── Phase 1.4 reminder cron columns ────────────────────────────────────────
  /** Scheduled datetime for this session (Dubai timezone). Used by reminder crons. */
  scheduled_at: timestamp("scheduled_at", { withTimezone: true, mode: 'string' }),
  /** Set by cron/upcoming-session-24h after 24h reminder email is sent. */
  reminder_24h_sent_at: timestamp("reminder_24h_sent_at", { withTimezone: true, mode: 'string' }),
  /** Set by cron/upcoming-session-1h after 1h reminder email is sent. */
  reminder_1h_sent_at:  timestamp("reminder_1h_sent_at",  { withTimezone: true, mode: 'string' }),

  created_at: timestamp("created_at", { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
}, (table) => ({
  uniq_file_session: unique("beneficiary_file_sessions_file_session_uniq").on(
    table.beneficiary_file_id,
    table.session_number,
  ),
}));

export type BeneficiaryFileSession    = typeof beneficiaryFileSessions.$inferSelect;
export type NewBeneficiaryFileSession = typeof beneficiaryFileSessions.$inferInsert;
