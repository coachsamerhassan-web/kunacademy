/**
 * email-outbox — enqueue helper for the transactional outbox pattern.
 *
 * Usage (inside an existing Drizzle transaction):
 *
 *   await withAdminContext(async (db) => {
 *     await db.update(someTable).set({...}).where(...);
 *     await enqueueEmail(db, {
 *       template_key: 'assessment-result',
 *       to_email:     student.email,
 *       payload:      { student_name, locale, decision, result_url, is_fail },
 *     });
 *   });
 *
 * Because enqueueEmail uses the SAME `db` handle that withAdminContext wraps
 * in BEGIN/COMMIT, the INSERT into email_outbox is atomic with the caller's
 * business-logic writes.  If the transaction rolls back, the outbox row rolls
 * back too — no ghost emails.
 *
 * If the caller passes a plain adminDb (not inside a transaction), the INSERT
 * becomes its own implicit single-statement transaction — still safe.
 *
 * Template keys:
 *   'assessment-result'    → sendAssessmentResultEmail
 *   'recording-received'   → sendRecordingReceivedEmail
 *   'assessor-assignment'  → sendAssessorAssignmentEmail
 *   'assessor-reassigned'  → sendAssessorReassignedEmail
 */

import { emailOutbox } from '@kunacademy/db/schema';

// The Drizzle db handle type — we accept any object that has an .insert() method
// matching the Drizzle pattern so callers can pass either the tx db or adminDb.
// Using `any` here mirrors the existing withAdminContext pattern in this codebase.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DrizzleDb = any;

export type EmailTemplateKey =
  | 'assessment-result'
  | 'assessment-result-pass'
  | 'assessment-result-fail'
  | 'recording-received'
  | 'assessor-assignment'
  | 'assessor-reassigned'
  | 'journey-paused'
  | 'second-try-deadline-warning'
  | 'second-opinion-request'
  | 'password-reset'
  | 'coach-new-rating';

export interface EnqueueEmailParams {
  template_key: EmailTemplateKey;
  to_email:     string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload:      Record<string, any>;
}

/**
 * Insert one row into email_outbox using the provided Drizzle db handle.
 *
 * Atomicity guarantee: when called with the db handle provided by
 * withAdminContext (or any explicit db.transaction() callback), the INSERT
 * participates in the enclosing transaction and will roll back if the caller
 * does.
 */
export async function enqueueEmail(
  db: DrizzleDb,
  params: EnqueueEmailParams,
): Promise<void> {
  await db.insert(emailOutbox).values({
    templateKey: params.template_key,
    toEmail:     params.to_email,
    payload:     params.payload,
  });
}
