// @kunacademy/email — Multi-channel notification system
// Channels: Email (Resend) | WhatsApp (Meta API) | Telegram (Bot API)

// Email templates
export {
  sendEmail,
  sendWelcomeEmail,
  sendBookingConfirmation,
  sendEnrollmentConfirmation,
  sendPaymentReceipt,
  sendPaymentReceivedEmail,
  sendBookingReminder,
  sendInstallmentReminder,
  sendPayoutNotification,
  sendProposalEmail,
} from './sender';
export type { PaymentReceivedEmailParams } from './sender';

// Calendar invites
export { generateICS } from './ics';

// Internal alerts (Telegram)
export { sendTelegramAlert, alertPaymentReceived, alertNewEnrollment, alertNewBooking, alertNewProposal, alertCriticalError, alertWebhookFailure, alertPaymentMismatch } from './telegram';

// Customer messaging (WhatsApp)
export { sendWhatsApp, whatsappBookingConfirmation, whatsappBookingReminder, whatsappPaymentConfirmation } from './whatsapp';

// Unified dispatcher (orchestrates all channels)
export { notify } from './dispatcher';
export type { NotificationEvent } from './dispatcher';

// Zoho CRM integration
export { createZohoCrmContact } from './zoho-crm';

// Mentor prep email (Phase 1.6 — wired to cron #9 in Phase 1.4)
export { sendMentorPrepEmail } from './mentor-prep';
export type { MentorPrepEmailParams } from './mentor-prep';

// Assessment result notification (Phase 2.7 — wired to submit handler)
export { sendAssessmentResultEmail } from './assessment-result';
export type { AssessmentResultEmailParams } from './assessment-result';

// Assessment result — PASS variant (distinct celebratory copy, template key: 'assessment-result-pass')
export { sendAssessmentResultPassEmail } from './assessment-result-pass';
export type { AssessmentResultPassEmailParams } from './assessment-result-pass';

// Assessment result — FAIL variant (supportive/growth-framing copy, template key: 'assessment-result-fail')
export { sendAssessmentResultFailEmail } from './assessment-result-fail';
export type { AssessmentResultFailEmailParams } from './assessment-result-fail';

// Recording received confirmation (Phase 2 — wired to upload POST handler)
export { sendRecordingReceivedEmail } from './recording-received';
export type { RecordingReceivedEmailParams } from './recording-received';

// Assessor assignment notification (Phase 2 — wired to assign-assessor.ts)
export { sendAssessorAssignmentEmail } from './assessor-assignment';
export type { AssessorAssignmentEmailParams } from './assessor-assignment';

// Journey paused notification (M4 — wired to submit handler on 2nd consecutive fail)
export { sendJourneyPausedEmail } from './journey-paused';
export type { JourneyPausedEmailParams } from './journey-paused';

// Second-try deadline warning (T-7 / T-3 / T-1 — wired to cron #7)
export { sendSecondTryDeadlineWarningEmail } from './second-try-deadline-warning';
export type { SecondTryDeadlineWarningEmailParams } from './second-try-deadline-warning';

// Second opinion request (M5 — wired to request-second-opinion endpoint)
export { sendSecondOpinionRequestEmail } from './second-opinion-request';
export type { SecondOpinionRequestEmailParams } from './second-opinion-request';

// Assessor reassigned notice (M5-ext — wired to reassign endpoint)
export { sendAssessorReassignedEmail } from './assessor-reassigned';
export type { AssessorReassignedEmailParams } from './assessor-reassigned';

// Rating request (Wave S9 — wired to mark-completed endpoint via email_outbox)
export { sendRatingRequestEmail } from './rating-request';
export type { RatingRequestEmailParams } from './rating-request';

// Password reset (wired to POST /api/auth/reset-password)
export { sendPasswordResetEmail } from './password-reset';
export type { PasswordResetEmailParams } from './password-reset';

// Coach new rating notification (wired to POST /api/bookings/[id]/rate)
export { sendCoachNewRatingEmail } from './coach-new-rating';
export type { CoachNewRatingEmailParams } from './coach-new-rating';

// User activation (wired to POST /api/admin/users + /api/admin/users/[id]/send-activation)
export { sendUserActivationEmail } from './user-activation';
export type { UserActivationEmailParams } from './user-activation';

// ── Wave F.6 — Membership Lifecycle Emails ─────────────────────────────────
// Cancel / reactivation / dunning / renewal reminders / win-back.
// All bilingual (AR + EN), brand-aligned, IP-clean.

export { sendMembershipCancelConfirmationEmail } from './templates/membership/cancel-confirmation';
export type { MembershipCancelConfirmationParams } from './templates/membership/cancel-confirmation';

export { sendMembershipCancelEffectiveEmail } from './templates/membership/cancel-effective';
export type { MembershipCancelEffectiveParams } from './templates/membership/cancel-effective';

export { sendMembershipReactivationConfirmationEmail } from './templates/membership/reactivation-confirmation';
export type { MembershipReactivationConfirmationParams } from './templates/membership/reactivation-confirmation';

export { sendMembershipDunningPaymentFailedEmail } from './templates/membership/dunning-payment-failed';
export type { MembershipDunningPaymentFailedParams } from './templates/membership/dunning-payment-failed';

export { sendMembershipDunningBackInGoodStandingEmail } from './templates/membership/dunning-back-in-good-standing';
export type { MembershipDunningBackInGoodStandingParams } from './templates/membership/dunning-back-in-good-standing';

export { sendMembershipDunningPaymentFailedFinalEmail } from './templates/membership/dunning-payment-failed-final';
export type { MembershipDunningPaymentFailedFinalParams } from './templates/membership/dunning-payment-failed-final';

export { sendMembershipRenewalReminderEmail } from './templates/membership/renewal-reminders';
export type { MembershipRenewalReminderParams, RenewalCadence } from './templates/membership/renewal-reminders';

export { sendMembershipWinback30DayEmail } from './templates/membership/winback-30-day';
export type { MembershipWinback30DayParams } from './templates/membership/winback-30-day';

// ── Wave E.5 — Scholarship Application Emails ─────────────────────────────
// Application confirmation / admin notification / approved / declined / waitlisted.
// All bilingual (AR + EN), brand-aligned, IP-clean (no methodology references),
// dignity-framed (no banned words per spec §3.2).

export { sendScholarshipApplicationConfirmationEmail } from './templates/scholarship/application-confirmation';
export type { ScholarshipApplicationConfirmationParams } from './templates/scholarship/application-confirmation';

export { sendScholarshipAdminNotificationEmail } from './templates/scholarship/admin-notification';
export type { ScholarshipAdminNotificationParams } from './templates/scholarship/admin-notification';

export { sendScholarshipApplicationApprovedEmail } from './templates/scholarship/application-approved';
export type { ScholarshipApplicationApprovedParams } from './templates/scholarship/application-approved';

export { sendScholarshipApplicationDeclinedEmail } from './templates/scholarship/application-declined';
export type { ScholarshipApplicationDeclinedParams } from './templates/scholarship/application-declined';

export { sendScholarshipApplicationWaitlistedEmail } from './templates/scholarship/application-waitlisted';
export type { ScholarshipApplicationWaitlistedParams } from './templates/scholarship/application-waitlisted';

// Wave E.6 — allocation + disbursement templates.
export { sendScholarshipApplicationAllocatedEmail } from './templates/scholarship/application-allocated';
export type { ScholarshipApplicationAllocatedParams } from './templates/scholarship/application-allocated';

export { sendScholarshipApplicationDisbursedEmail } from './templates/scholarship/application-disbursed';
export type { ScholarshipApplicationDisbursedParams } from './templates/scholarship/application-disbursed';
