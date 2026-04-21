/**
 * Notification Dispatcher — orchestrates multi-channel notifications.
 * Each channel is optional and gracefully skips when not configured.
 *
 * Channels: Email via Zoho Mail API (OAuth) | WhatsApp (Meta API) | Telegram (Bot API)
 */
import { sendBookingConfirmation, sendBookingReminder, sendPaymentReceipt, sendEnrollmentConfirmation, sendInstallmentReminder, sendPayoutNotification } from './sender';
import { sendWhatsApp, whatsappBookingConfirmation, whatsappBookingReminder, whatsappPaymentConfirmation } from './whatsapp';
import { sendTelegramAlert, alertPaymentReceived, alertNewEnrollment, alertNewBooking } from './telegram';
import { generateICS } from './ics';
import { sendEmail } from './sender';

export type NotificationEvent =
  | 'booking_confirmed'
  | 'booking_reminder'
  | 'payment_received'
  | 'enrollment_confirmed'
  | 'installment_due'
  | 'payout_update';

interface NotifyOptions {
  event: NotificationEvent;
  locale?: string;
  email?: string;
  phone?: string;
  data: Record<string, string>;
}

/**
 * Dispatch notifications across all configured channels.
 * Returns a summary of which channels succeeded/failed.
 */
export async function notify({ event, locale = 'ar', email, phone, data }: NotifyOptions) {
  const results: Record<string, { ok: boolean; reason?: string }> = {};

  switch (event) {
    case 'booking_confirmed': {
      // Email
      if (email) {
        try {
          await sendBookingConfirmation(email, {
            name: data.name,
            service: data.service,
            date: data.date,
            time: data.time,
            coach: data.coach,
          }, locale);
          results.email = { ok: true };
        } catch (e) {
          results.email = { ok: false, reason: String(e) };
        }
      }

      // Email with .ics attachment
      if (email && data.startTime && data.endTime) {
        try {
          const ics = generateICS({
            title: `${data.service} — ${data.coach}`,
            description: `Coaching session at Kun Academy`,
            startTime: new Date(data.startTime),
            endTime: new Date(data.endTime),
            attendeeEmail: email,
            organizerEmail: 'bookings@kunacademy.com',
          });
          // Send ICS as a second email with attachment-like content
          await sendEmail({
            to: email,
            subject: locale === 'ar' ? 'إضافة الجلسة للتقويم' : 'Add Session to Calendar',
            html: `
              <div dir="${locale === 'ar' ? 'rtl' : 'ltr'}" style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px;">
                <p>${locale === 'ar' ? 'ملف التقويم مرفق أدناه:' : 'Calendar file attached below:'}</p>
                <pre style="background: #f5f3ef; padding: 12px; border-radius: 6px; font-size: 11px; overflow-x: auto;">${ics}</pre>
              </div>
            `,
          });
          results.ics = { ok: true };
        } catch (e) {
          results.ics = { ok: false, reason: String(e) };
        }
      }

      // WhatsApp
      if (phone) {
        const wa = await whatsappBookingConfirmation(phone, {
          name: data.name,
          service: data.service,
          date: data.date,
          time: data.time,
        }, locale);
        results.whatsapp = wa;
      }

      // Telegram (internal)
      const tg = await alertNewBooking({
        studentName: data.name,
        coachName: data.coach,
        service: data.service,
        date: data.date,
      });
      results.telegram = tg;
      break;
    }

    case 'booking_reminder': {
      if (email) {
        try {
          await sendBookingReminder(email, {
            name: data.name,
            service: data.service,
            date: data.date,
            time: data.time,
            coach: data.coach,
            meetingUrl: data.meetingUrl,
          }, locale);
          results.email = { ok: true };
        } catch (e) {
          results.email = { ok: false, reason: String(e) };
        }
      }
      if (phone) {
        const wa = await whatsappBookingReminder(phone, {
          name: data.name,
          service: data.service,
          time: data.time,
        }, locale);
        results.whatsapp = wa;
      }
      break;
    }

    case 'payment_received': {
      if (email) {
        try {
          await sendPaymentReceipt(email, {
            name: data.name,
            item: data.item,
            amount: data.amount,
            currency: data.currency,
            method: data.method,
            transactionId: data.transactionId,
          }, locale);
          results.email = { ok: true };
        } catch (e) {
          results.email = { ok: false, reason: String(e) };
        }
      }
      if (phone) {
        const wa = await whatsappPaymentConfirmation(phone, {
          name: data.name,
          amount: `${data.amount} ${data.currency}`,
          item: data.item,
        }, locale);
        results.whatsapp = wa;
      }
      const tg = await alertPaymentReceived({
        studentName: data.name,
        amount: data.amount,
        currency: data.currency,
        program: data.item,
      });
      results.telegram = tg;
      break;
    }

    case 'enrollment_confirmed': {
      if (email) {
        try {
          await sendEnrollmentConfirmation(email, { name: data.name, course: data.course }, locale);
          results.email = { ok: true };
        } catch (e) {
          results.email = { ok: false, reason: String(e) };
        }
      }
      const tg = await alertNewEnrollment({
        studentName: data.name,
        program: data.course,
      });
      results.telegram = tg;
      break;
    }

    case 'installment_due': {
      if (email) {
        try {
          await sendInstallmentReminder(email, {
            name: data.name,
            program: data.program,
            amount: data.amount,
            currency: data.currency,
            dueDate: data.dueDate,
            paymentUrl: data.paymentUrl,
          }, locale);
          results.email = { ok: true };
        } catch (e) {
          results.email = { ok: false, reason: String(e) };
        }
      }
      break;
    }

    case 'payout_update': {
      if (email) {
        try {
          await sendPayoutNotification(email, {
            name: data.name,
            amount: data.amount,
            currency: data.currency,
            status: data.status as 'approved' | 'completed' | 'rejected',
            note: data.note,
          }, locale);
          results.email = { ok: true };
        } catch (e) {
          results.email = { ok: false, reason: String(e) };
        }
      }
      break;
    }
  }

  return results;
}
