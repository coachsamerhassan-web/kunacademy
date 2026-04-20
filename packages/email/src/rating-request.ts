/**
 * Rating Request Email — sendRatingRequestEmail()
 *
 * Bilingual (AR + EN) email sent to the CLIENT after a coach marks a session
 * as completed. Contains a deep-link to the rating page.
 *
 * Wave S9: triggered by POST /api/bookings/[bookingId]/mark-completed
 * Dispatched via email_outbox with template_key = 'rating-request'.
 *
 * Usage:
 *   await sendRatingRequestEmail('client@example.com', {
 *     client_name:  'Sara Ahmed',
 *     coach_name:   'Ahmed Nasser',
 *     session_date: '2026-04-20T14:00:00Z',
 *     locale:       'ar',
 *     rating_url:   'https://kunacademy.com/ar/portal/bookings/abc123/rate',
 *   });
 */

import { sendEmail } from './sender';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RatingRequestEmailParams {
  /** Client's display name */
  client_name: string;
  /** Coach's display name */
  coach_name: string;
  /** ISO 8601 session date/time — formatted for display */
  session_date: string;
  /** Controls direction and copy language */
  locale: 'ar' | 'en';
  /** Deep-link to /{locale}/portal/bookings/[bookingId]/rate */
  rating_url: string;
}

// ── Subject ───────────────────────────────────────────────────────────────────

export function buildRatingSubject(locale: 'ar' | 'en', coachName: string): string {
  return locale === 'ar'
    ? `قيّم جلستك مع ${coachName}`
    : `Rate your session with ${coachName}`;
}

// ── Date formatter ────────────────────────────────────────────────────────────

function formatSessionDate(iso: string, locale: 'ar' | 'en'): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(locale === 'ar' ? 'ar-AE' : 'en-AE', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

// ── HTML builder ──────────────────────────────────────────────────────────────

function buildHtml(params: RatingRequestEmailParams): string {
  const { client_name, coach_name, session_date, locale, rating_url } = params;
  const isAr  = locale === 'ar';
  const dir   = isAr ? 'rtl' : 'ltr';
  const align = isAr ? 'right' : 'left';
  const formattedDate = formatSessionDate(session_date, locale);

  const greeting = isAr
    ? `مرحبًا ${client_name}،`
    : `Hi ${client_name},`;

  const body1 = isAr
    ? `لقد أتمّ المدرّب <strong>${coach_name}</strong> جلسة الكوتشينج الخاصة بك بتاريخ ${formattedDate}.`
    : `Your coaching session with <strong>${coach_name}</strong> on ${formattedDate} has been marked as completed.`;

  const body2 = isAr
    ? 'نودّ معرفة رأيك. يستغرق التقييم أقل من دقيقة ويساعدنا على تقديم تجربة أفضل لك ولغيرك.'
    : 'We would love to hear your feedback. The rating takes less than a minute and helps us improve the experience for everyone.';

  const ctaLabel = isAr ? 'قيّم الجلسة' : 'Rate the Session';

  const privacyNote = isAr
    ? 'يمكنك اختيار إبقاء تقييمك خاصًا أو مشاركته مع المجتمع.'
    : 'You can choose to keep your rating private or share it with the community.';

  const footerNote = isAr
    ? 'هذا البريد أُرسل تلقائياً من أكاديمية كُن. للاستفسار: <a href="mailto:support@kunacademy.com" style="color:#7C73C0;">support@kunacademy.com</a>'
    : 'This email was sent automatically by Kun Academy. Questions? <a href="mailto:support@kunacademy.com" style="color:#7C73C0;">support@kunacademy.com</a>';

  return `<!DOCTYPE html>
<html lang="${locale}" dir="${dir}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${buildRatingSubject(locale, coach_name)}</title>
</head>
<body style="margin:0;padding:0;background:#f5f3ef;font-family:${isAr ? 'Tahoma,Arial' : 'system-ui,Arial'},sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
         style="background:#f5f3ef;padding:32px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0"
               style="background:#ffffff;border-radius:12px;overflow:hidden;max-width:600px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background:#474099;padding:28px 32px;text-align:${align};">
              <p style="margin:0 0 4px;color:rgba(255,255,255,0.7);font-size:13px;">
                ${isAr ? 'أكاديمية كُن للكوتشينج' : 'Kun Coaching Academy'}
              </p>
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;line-height:1.4;">
                ${isAr ? 'كيف كانت جلستك؟' : 'How was your session?'}
              </h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px;text-align:${align};" dir="${dir}">

              <!-- Greeting -->
              <p style="margin:0 0 20px;font-size:15px;color:#333333;line-height:1.8;">
                ${greeting}
              </p>

              <!-- Body 1 -->
              <p style="margin:0 0 16px;font-size:15px;color:#333333;line-height:1.8;">
                ${body1}
              </p>

              <!-- Body 2 -->
              <p style="margin:0 0 28px;font-size:14px;color:#555555;line-height:1.7;">
                ${body2}
              </p>

              <!-- Star graphic (static hint — interactive rating is on the page) -->
              <div style="text-align:center;margin:0 0 20px;font-size:28px;letter-spacing:4px;">
                &#9733;&#9733;&#9733;&#9733;&#9733;
              </div>

              <!-- CTA button -->
              <div style="text-align:center;margin:0 0 24px;">
                <a href="${rating_url}"
                   style="display:inline-block;background:#474099;color:#ffffff;text-decoration:none;
                          padding:14px 40px;border-radius:8px;font-size:15px;font-weight:bold;">
                  ${ctaLabel}
                </a>
              </div>

              <!-- Privacy note -->
              <p style="margin:0 0 24px;font-size:13px;color:#888888;text-align:center;line-height:1.6;">
                ${privacyNote}
              </p>

              <!-- Footer note -->
              <p style="margin:0;font-size:12px;color:#999999;border-top:1px solid #eeeeee;
                        padding-top:16px;line-height:1.6;">
                ${footerNote}
              </p>

            </td>
          </tr>

          <!-- Footer bar -->
          <tr>
            <td style="background:#2D2860;padding:18px 32px;text-align:center;">
              <p style="margin:0;color:rgba(255,255,255,0.5);font-size:11px;">
                ${isAr ? 'أكاديمية كُن للكوتشينج — kunacademy.com' : 'Kun Coaching Academy — kunacademy.com'}
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Send the rating-request email to a client after coach marks session completed.
 * Non-throwing — call inside try/catch if used directly.
 * Prefer outbox enqueue for durability.
 */
export async function sendRatingRequestEmail(
  to: string,
  params: RatingRequestEmailParams,
): Promise<void> {
  const subject = buildRatingSubject(params.locale, params.coach_name);
  await sendEmail({ to, subject, html: buildHtml(params) });
}
