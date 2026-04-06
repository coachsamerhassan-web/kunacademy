/**
 * Send Telegram alerts to internal team (Amin, Nashit, Samer).
 * Gracefully skips when TELEGRAM_BOT_TOKEN is not set.
 */
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';

/** Known internal chat IDs — populated from env or hardcoded after setup */
const CHAT_IDS: Record<string, string> = {
  samer: process.env.TELEGRAM_CHAT_SAMER || '',
  amin: process.env.TELEGRAM_CHAT_AMIN || '',
  nashit: process.env.TELEGRAM_CHAT_NASHIT || '',
};

interface TelegramAlert {
  to: keyof typeof CHAT_IDS | string;
  message: string;
}

export async function sendTelegramAlert({ to, message }: TelegramAlert) {
  if (!TELEGRAM_BOT_TOKEN) {
    console.warn('[telegram] TELEGRAM_BOT_TOKEN not set, skipping alert to:', to);
    return { ok: false, reason: 'not_configured' };
  }

  const chatId = CHAT_IDS[to] || to;
  if (!chatId) {
    console.warn('[telegram] No chat ID for:', to);
    return { ok: false, reason: 'no_chat_id' };
  }

  const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: message,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('[telegram] Send failed:', err);
    return { ok: false, reason: err };
  }

  return { ok: true, data: await res.json() };
}

/** Shorthand: alert Amin about a new payment */
export async function alertPaymentReceived(details: {
  studentName: string;
  amount: string;
  currency: string;
  program: string;
}) {
  return sendTelegramAlert({
    to: 'amin',
    message: `💰 <b>New Payment</b>\nStudent: ${details.studentName}\nAmount: ${details.amount} ${details.currency}\nProgram: ${details.program}`,
  });
}

/** Shorthand: alert Nashit about a new enrollment */
export async function alertNewEnrollment(details: {
  studentName: string;
  program: string;
}) {
  return sendTelegramAlert({
    to: 'nashit',
    message: `📚 <b>New Enrollment</b>\nStudent: ${details.studentName}\nProgram: ${details.program}`,
  });
}

/** Shorthand: alert about a new booking */
export async function alertNewBooking(details: {
  studentName: string;
  coachName: string;
  service: string;
  date: string;
}) {
  return sendTelegramAlert({
    to: 'nashit',
    message: `📅 <b>New Booking</b>\nStudent: ${details.studentName}\nCoach: ${details.coachName}\nService: ${details.service}\nDate: ${details.date}`,
  });
}

/** Shorthand: alert Samer about a critical application error. Non-blocking — never throws. */
export async function alertCriticalError(params: {
  error: string;
  context: string;
  route?: string;
}) {
  try {
    await sendTelegramAlert({
      to: 'samer',
      message: `🚨 <b>CRITICAL ERROR</b>\n\n<b>Context:</b> ${params.context}\n<b>Route:</b> ${params.route ?? 'unknown'}\n<b>Error:</b> ${params.error}`,
    });
  } catch (err) {
    console.error('[telegram] alertCriticalError failed silently:', err);
  }
}

/** 6.5.7 — Alert Samer + Amin when a webhook event fails processing. Non-blocking — never throws. */
export async function alertWebhookFailure(params: {
  gateway: string;
  eventType: string;
  eventId: string;
  error: string;
}) {
  const message =
    `⚠️ <b>Webhook Processing Failed</b>\n\n` +
    `<b>Gateway:</b> ${params.gateway}\n` +
    `<b>Event:</b> ${params.eventType}\n` +
    `<b>Event ID:</b> ${params.eventId}\n` +
    `<b>Error:</b> ${params.error}`;
  try {
    await Promise.allSettled([
      sendTelegramAlert({ to: 'samer', message }),
      sendTelegramAlert({ to: 'amin', message }),
    ]);
  } catch (err) {
    console.error('[telegram] alertWebhookFailure failed silently:', err);
  }
}

/** 6.5.8 — Alert Amin when a payment amount doesn't match the expected value. Non-blocking — never throws. */
export async function alertPaymentMismatch(params: {
  paymentId: string;
  expectedAmount: number;
  actualAmount: number;
  currency: string;
  gateway: string;
}) {
  const message =
    `🔴 <b>Payment Amount Mismatch!</b>\n\n` +
    `<b>Payment ID:</b> ${params.paymentId}\n` +
    `<b>Expected:</b> ${params.expectedAmount} ${params.currency}\n` +
    `<b>Received:</b> ${params.actualAmount} ${params.currency}\n` +
    `<b>Gateway:</b> ${params.gateway}\n\n` +
    `⚡ Manual verification required.`;
  try {
    await sendTelegramAlert({ to: 'amin', message });
  } catch (err) {
    console.error('[telegram] alertPaymentMismatch failed silently:', err);
  }
}

/** Shorthand: alert Samer about a new corporate proposal */
export async function alertNewProposal(details: {
  name: string;
  email: string;
  jobTitle: string;
  direction: string;
  totalSavings: number;
  roiMultiple: number;
}) {
  const formattedSavings = details.totalSavings.toLocaleString('en-AE');
  return sendTelegramAlert({
    to: 'samer',
    message: `🏢 <b>New Corporate Proposal</b>\nName: ${details.name}\nEmail: ${details.email}\nTitle: ${details.jobTitle}\nDirection: ${details.direction}\nProjected Savings: AED ${formattedSavings}\nROI: ${details.roiMultiple}×`,
  });
}
