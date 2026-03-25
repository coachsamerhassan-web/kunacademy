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
