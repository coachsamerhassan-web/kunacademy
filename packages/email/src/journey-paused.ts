/**
 * Journey Paused Email — sendJourneyPausedEmail()
 *
 * Bilingual (AR + EN) warm-toned notification sent when a student's journey
 * is paused after two consecutive assessment fails (M4).
 *
 * Tone: supportive, not punitive. Explains next steps clearly.
 *
 * Usage:
 *   await sendJourneyPausedEmail('student@example.com', {
 *     student_name: 'Sara Ahmed',
 *     locale:       'ar',
 *     result_url:   'https://kunacademy.com/ar/portal/packages/abc123/assessment',
 *   });
 *
 * Source: POST /api/assessments/[assessmentId]/submit — M4 pause hook
 */

import { sendEmail } from './sender';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface JourneyPausedEmailParams {
  /** Student's display name */
  student_name: string;
  /** 'ar' | 'en' — controls direction, subject, and copy */
  locale: 'ar' | 'en';
  /** Full URL to the assessment result page (shows paused state) */
  result_url: string;
}

// ── Subject ───────────────────────────────────────────────────────────────────

function buildSubject(locale: 'ar' | 'en'): string {
  return locale === 'ar'
    ? 'رحلتك التدريبية — معلومة مهمة بشأن وضعك الحالي'
    : 'Your coaching journey — an important update on your current status';
}

// ── HTML builder ──────────────────────────────────────────────────────────────

function buildHtml(params: JourneyPausedEmailParams): string {
  const { student_name, locale, result_url } = params;
  const isAr  = locale === 'ar';
  const dir   = isAr ? 'rtl' : 'ltr';
  const align = isAr ? 'right' : 'left';

  const intro = isAr
    ? `مرحبًا ${student_name}، نكتب إليك بعد مراجعة جلستَيك التدريبيتَين. بعد تقييم دقيق من فريق المشرفين، قُرِّر إيقاف رحلتك مؤقتاً في هذه المرحلة.`
    : `Hi ${student_name}, we are writing to you following the review of your two coaching sessions. After careful assessment by our mentoring team, your journey has been paused at this stage.`;

  const meaning = isAr
    ? 'هذا ليس قراراً نهائياً. الهدف منه إعطاؤك فرصة حقيقية للتوقف والتطور، قبل أن تتقدم في مسيرتك التدريبية.'
    : 'This is not a final decision. The intention is to give you a genuine opportunity to pause and grow before you continue your coaching journey.';

  const nextStepsTitle = isAr ? 'الخطوات التالية:' : 'Your next steps:';

  const steps = isAr
    ? `<ul style="margin:0;padding-inline-start:20px;font-size:14px;color:#374151;line-height:2;">
        <li>راجع تقارير المقيِّم المتاحة في صفحة نتيجتك</li>
        <li>تواصل مع مرشدك لجدولة جلسة تحضيرية ومتابعة</li>
        <li>أرسل لنا بريداً على <a href="mailto:support@kunacademy.com" style="color:#474099;">support@kunacademy.com</a> إذا كانت لديك أسئلة</li>
      </ul>`
    : `<ul style="margin:0;padding-left:20px;font-size:14px;color:#374151;line-height:2;">
        <li>Review your assessor's feedback on your result page</li>
        <li>Contact your mentor to schedule a preparation and follow-up session</li>
        <li>Email us at <a href="mailto:support@kunacademy.com" style="color:#474099;">support@kunacademy.com</a> if you have any questions</li>
      </ul>`;

  const ctaLabel = isAr ? 'عرض صفحة النتيجة' : 'View Result Page';

  const closing = isAr
    ? 'نؤمن بك وبقدرتك على النمو. نحن هنا لدعمك في كل خطوة.'
    : 'We believe in you and your capacity to grow. We are here to support you at every step.';

  const footerNote = isAr
    ? 'هذا البريد أُرسل تلقائياً من أكاديمية كُن. للاستفسار: <a href="mailto:support@kunacademy.com" style="color:#7C73C0;">support@kunacademy.com</a>'
    : 'This email was sent automatically by Kun Academy. Questions? <a href="mailto:support@kunacademy.com" style="color:#7C73C0;">support@kunacademy.com</a>';

  return `<!DOCTYPE html>
<html lang="${locale}" dir="${dir}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${buildSubject(locale)}</title>
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
                ${isAr ? 'تحديث بشأن رحلتك التدريبية' : 'Update on Your Coaching Journey'}
              </h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px;text-align:${align};" dir="${dir}">

              <!-- Status badge -->
              <div style="display:inline-block;background:#F3F0FF;border:1px solid #C4B5FD;
                          border-radius:20px;padding:6px 16px;margin-bottom:24px;">
                <span style="color:#5B21B6;font-size:14px;font-weight:700;">
                  ${isAr ? 'متوقفة مؤقتاً' : 'Journey Paused'}
                </span>
              </div>

              <!-- Intro paragraph -->
              <p style="margin:0 0 20px;font-size:15px;color:#333333;line-height:1.8;">
                ${intro}
              </p>

              <!-- Meaning paragraph -->
              <p style="margin:0 0 20px;font-size:14px;color:#555555;line-height:1.7;">
                ${meaning}
              </p>

              <!-- Next steps -->
              <p style="margin:0 0 12px;font-size:14px;font-weight:600;color:#333333;">
                ${nextStepsTitle}
              </p>
              ${steps}

              <!-- CTA button -->
              <div style="text-align:center;margin:28px 0;">
                <a href="${result_url}"
                   style="display:inline-block;background:#474099;color:#ffffff;text-decoration:none;
                          padding:14px 36px;border-radius:8px;font-size:15px;font-weight:bold;">
                  ${ctaLabel}
                </a>
              </div>

              <!-- Closing -->
              <p style="margin:0 0 20px;font-size:14px;color:#555555;line-height:1.7;
                        background:#F9F7FF;border-inline-start:4px solid #7C73C0;padding:14px 18px;border-radius:4px;">
                ${closing}
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
 * Send the journey-paused notification email to a student.
 * Non-throwing — call inside try/catch and log errors without blocking.
 */
export async function sendJourneyPausedEmail(
  to: string,
  params: JourneyPausedEmailParams,
): Promise<void> {
  const subject = buildSubject(params.locale);
  await sendEmail({ to, subject, html: buildHtml(params) });
}
