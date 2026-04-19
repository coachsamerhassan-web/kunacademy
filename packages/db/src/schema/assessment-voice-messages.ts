import { bigint, pgTable, text, timestamp, uuid, integer } from 'drizzle-orm/pg-core';
import { packageAssessments } from './package-assessments';
import { profiles } from './profiles';

/**
 * assessment_voice_messages — voice feedback from assessor to student on a
 * failed (or any) assessment explaining reasoning and next steps.
 *
 * Source: Phase 2.6 spec — Voice Message Upload
 *
 * One assessment may have at most one voice message (latest upload wins).
 * The assessor records in-browser (MediaRecorder / WebM Opus); the client
 * POSTs multipart/form-data with field `voice`.
 *
 * 10-min cap enforced at the UI layer; the server enforces 15 MB file-size
 * limit (10-min WebM Opus ≈ 5 MB with generous headroom).
 */
export const assessmentVoiceMessages = pgTable("assessment_voice_messages", {
  id: uuid("id").primaryKey().defaultRandom(),

  assessment_id: uuid("assessment_id")
    .notNull()
    .references(() => packageAssessments.id, { onDelete: 'cascade' }),

  assessor_id: uuid("assessor_id")
    .notNull()
    .references(() => profiles.id),

  /** Absolute path on VPS: uploads/voice-messages/[assessmentId]/[timestamp].[ext] */
  file_path: text("file_path").notNull(),

  /** MIME type as reported by the browser: audio/webm, audio/mp4, audio/ogg, etc. */
  mime_type: text("mime_type").notNull(),

  size_bytes: bigint("size_bytes", { mode: 'number' }).notNull(),

  /** Probed via ffprobe. Null if ffprobe unavailable or probe fails. */
  duration_seconds: integer("duration_seconds"),

  created_at: timestamp("created_at", {
    withTimezone: true,
    mode: 'string',
  }).notNull().defaultNow(),
});

export type AssessmentVoiceMessage    = typeof assessmentVoiceMessages.$inferSelect;
export type NewAssessmentVoiceMessage = typeof assessmentVoiceMessages.$inferInsert;
