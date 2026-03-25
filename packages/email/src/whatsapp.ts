/**
 * WhatsApp Business API sender.
 * Built on test number — production number activated when available.
 * Gracefully skips when WHATSAPP_API_TOKEN is not set.
 *
 * Quiet hours: no customer messages outside 8am-10pm local timezone.
 */
const WHATSAPP_API_TOKEN = process.env.WHATSAPP_API_TOKEN || '';
const WHATSAPP_PHONE_ID = process.env.WHATSAPP_PHONE_ID || '';
const WHATSAPP_API_URL = `https://graph.facebook.com/v21.0/${WHATSAPP_PHONE_ID}/messages`;

interface WhatsAppMessage {
  to: string; // phone number with country code, e.g. +971501234567
  template?: string; // pre-approved template name
  templateParams?: string[];
  text?: string; // freeform text (only works within 24h window)
  locale?: string;
}

/** Check if current time is within quiet hours (10pm-8am) in a timezone */
function isQuietHours(timezone: string = 'Asia/Dubai'): boolean {
  const now = new Date();
  const localHour = parseInt(
    new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: timezone }).format(now)
  );
  return localHour >= 22 || localHour < 8;
}

export async function sendWhatsApp({ to, template, templateParams, text, locale = 'ar' }: WhatsAppMessage) {
  if (!WHATSAPP_API_TOKEN || !WHATSAPP_PHONE_ID) {
    console.warn('[whatsapp] Not configured, skipping message to:', to);
    return { ok: false, reason: 'not_configured' };
  }

  // Quiet hours check — skip non-urgent customer messages
  if (isQuietHours()) {
    console.warn('[whatsapp] Quiet hours (10pm-8am Dubai), deferring message to:', to);
    return { ok: false, reason: 'quiet_hours', deferred: true };
  }

  const body: Record<string, unknown> = {
    messaging_product: 'whatsapp',
    to: to.replace(/[^0-9+]/g, ''),
    type: template ? 'template' : 'text',
  };

  if (template) {
    body.template = {
      name: template,
      language: { code: locale === 'ar' ? 'ar' : 'en' },
      components: templateParams?.length
        ? [{ type: 'body', parameters: templateParams.map((p) => ({ type: 'text', text: p })) }]
        : undefined,
    };
  } else if (text) {
    body.text = { body: text };
  }

  const res = await fetch(WHATSAPP_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${WHATSAPP_API_TOKEN}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('[whatsapp] Send failed:', err);
    return { ok: false, reason: err };
  }

  return { ok: true, data: await res.json() };
}

/** Booking confirmation via WhatsApp template */
export async function whatsappBookingConfirmation(phone: string, details: {
  name: string;
  service: string;
  date: string;
  time: string;
}, locale: string = 'ar') {
  return sendWhatsApp({
    to: phone,
    template: 'booking_confirmation',
    templateParams: [details.name, details.service, details.date, details.time],
    locale,
  });
}

/** Booking reminder (24h before) via WhatsApp template */
export async function whatsappBookingReminder(phone: string, details: {
  name: string;
  service: string;
  time: string;
}, locale: string = 'ar') {
  return sendWhatsApp({
    to: phone,
    template: 'booking_reminder',
    templateParams: [details.name, details.service, details.time],
    locale,
  });
}

/** Payment confirmation via WhatsApp */
export async function whatsappPaymentConfirmation(phone: string, details: {
  name: string;
  amount: string;
  item: string;
}, locale: string = 'ar') {
  return sendWhatsApp({
    to: phone,
    template: 'payment_confirmation',
    templateParams: [details.name, details.amount, details.item],
    locale,
  });
}
