// @kunacademy/email — Multi-channel notification system
// Channels: Email (Resend) | WhatsApp (Meta API) | Telegram (Bot API)

// Email templates
export {
  sendEmail,
  sendWelcomeEmail,
  sendBookingConfirmation,
  sendEnrollmentConfirmation,
  sendPaymentReceipt,
  sendBookingReminder,
  sendInstallmentReminder,
  sendPayoutNotification,
  sendProposalEmail,
} from './sender';

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
