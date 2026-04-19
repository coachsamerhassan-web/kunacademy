import { pgTable, bigint, integer, jsonb, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { packageInstances } from './package-instances';
import { beneficiaryFileSessions } from './beneficiary-file-sessions';

/**
 * package_recordings — one row per coaching recording submitted for assessment.
 *
 * Source: Phase 1.5 spec — Recording Submission + Assessor Assignment Queue
 * Sub-phase: S2-Layer-1 / 1.5
 *
 * status machine (server-enforced at API layer):
 *   pending_assignment → under_review  (after assignAssessor() completes)
 *   under_review       → assessed      (after assessor submits decision)
 */
export const packageRecordings = pgTable("package_recordings", {
  id: uuid("id").primaryKey().defaultRandom(),

  package_instance_id: uuid("package_instance_id")
    .notNull()
    .references(() => packageInstances.id, { onDelete: 'cascade' }),

  /**
   * Optional FK to beneficiary_file_sessions.
   * Null when the recording is submitted at the package level (not tied to a
   * specific beneficiary session).
   */
  beneficiary_session_id: uuid("beneficiary_session_id")
    .references(() => beneficiaryFileSessions.id, { onDelete: 'set null' }),

  /** Absolute VPS path: /var/www/kunacademy-git/uploads/recordings/[instanceId]/[recordingId].[ext] */
  file_path: text("file_path").notNull(),

  /** Original filename as uploaded by the student. */
  original_filename: text("original_filename").notNull(),

  /** MIME type validated server-side. One of the allowed set. */
  mime_type: text("mime_type").notNull(),

  /** File size in bytes. Max enforced at API layer (500 MB). */
  file_size_bytes: bigint("file_size_bytes", { mode: 'number' }).notNull(),

  /**
   * Duration probed server-side via ffprobe (if available).
   * Null until the probe completes or if ffprobe is unavailable.
   */
  duration_seconds: integer("duration_seconds"),

  /**
   * 'pending_assignment' → waiting for assessor round-robin
   * 'under_review'       → assessor assigned and working
   * 'assessed'           → final decision recorded
   * CHECK enforced in DB migration.
   */
  status: text("status").notNull().default('pending_assignment'),

  /**
   * Timestamp when the student confirmed all 6 attestation checkboxes.
   * Required — set at submission time. Null until the attestation form
   * is submitted.
   */
  attestation_confirmed_at: timestamp("attestation_confirmed_at", {
    withTimezone: true,
    mode: 'string',
  }),

  submitted_at: timestamp("submitted_at", {
    withTimezone: true,
    mode: 'string',
  }).notNull().defaultNow(),

  created_at: timestamp("created_at", {
    withTimezone: true,
    mode: 'string',
  }).notNull().defaultNow(),

  updated_at: timestamp("updated_at", {
    withTimezone: true,
    mode: 'string',
  }).notNull().defaultNow(),

  // ── Transcript (Phase 2.2) ──────────────────────────────────────────────────
  // Student submits a transcript document alongside the audio recording.
  // Assessors read it in the left-pane while listening.
  // Accepted: PDF (application/pdf), plain text (text/plain), Markdown (text/markdown).
  // Max 2 MB. Required by the API layer; nullable in DB for rows pre-migration.

  /** Absolute VPS path: same directory as file_path, with suffix .transcript.{ext} */
  transcript_file_path: text("transcript_file_path"),

  /** MIME type of the uploaded transcript. One of: application/pdf | text/plain | text/markdown */
  transcript_mime: text("transcript_mime"),

  /** File size in bytes. API enforces ≤ 2 MB (2,097,152 bytes). */
  transcript_size_bytes: bigint("transcript_size_bytes", { mode: 'number' }),

  /** Timestamp when the transcript was written to disk and the row was updated. */
  transcript_uploaded_at: timestamp("transcript_uploaded_at", {
    withTimezone: true,
    mode: 'string',
  }),
});

export type PackageRecording    = typeof packageRecordings.$inferSelect;
export type NewPackageRecording = typeof packageRecordings.$inferInsert;
