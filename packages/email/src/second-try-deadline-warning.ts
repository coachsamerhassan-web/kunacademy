/**
 * Second-Try Deadline Warning Email — sendSecondTryDeadlineWarningEmail()
 *
 * Bilingual (AR + EN) urgency email sent T-7, T-3, T-1 days before the
 * second_try_deadline_at for students in second_try_pending state.
 *
 * Tone: urgent but calm. Not panic. Shows concrete deadline and CTA.
 *
 * Usage:
 *   await sendSecondTryDeadlineWarningEmail('student@example.com', {
 *     student_name:   'Sara Ahmed',
 *     locale:         'ar',
 *     days_remaining: 7,
 *     deadline_iso:   '2026-04-26T00:00:00Z',
 *     instance_id:    'abc-123',
 *   });
 *
 * Source: GET /api/cron/second-try-deadline-warnings
 *         via drain-email-outbox (template_key: 'second-try-deadline-warning')
 */

import { sendEmail } from './sender';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SecondTryDeadlineWarningEmailParams {
  /** Student's display name */
  student_name: string;
  /** 'ar' | 'en' — controls direction, subject, and copy */
  locale: 'ar' | 'en';
  /** Days remaining until second_try_deadline_at — one of 7 | 3 | 1 */
  days_remaining: number;
  /** ISO-8601 timestamp of the deadline (used to render human-readable date) */
  deadline_iso: string;
  /** package_instances.id — used to build the portal CTA URL */
  instance_id: string;
}

// ── Subject ───────────────────────────────────────────────────────────────────

function buildSubject(locale: 'ar' | 'en', days: number): string {
  return locale === 'ar'
    ? `محاولتك الثانية تنتهي خلال ${days} ${days === 1 ? 'يوم' : 'أيام'} — بحاجة لاتخاذ إجراء`
    : `Your second-try window closes in ${days} ${days === 1 ? 'day' : 'days'} — action needed`;
}

// ── Deadline label ────────────────────────────────────────────────────────────

function formatDeadline(iso: string, locale: 'ar' | 'en'): string {
  return new Date(iso).toLocaleDateString(locale === 'ar' ? 'ar-AE' : 'en-GB', {
    year:    'numeric',
    month:   'long',
    day:     'numeric',
    timeZone: 'Asia/Dubai',
  });
}

// ── HTML builder ──────────────────────────────────────────────────────────────

function buildHtml(params: SecondTryDeadlineWarningEmailParams): string {
  const { student_name, locale, days_remaining, deadline_iso, instance_id } = params;
  const isAr  = locale === 'ar';
  const dir   = isAr ? 'rtl' : 'ltr';
  const align = isAr ? 'right' : 'left';

  const deadlineLabel = formatDeadline(deadline_iso, locale);
  const ctaUrl = `https://kunacademy.com/${locale}/portal/packages/${instance_id}/assessment`;

  // ── Copy blocks ────────────────────────────────────────────────────────────

  const greeting = isAr
    ? `مرحبًا ${student_name}،`
    : `Hi ${student_name},`;

  const intro = isAr
    ? `لديك نافذة زمنية لإعادة تقديم تسجيلك قبل أن تنتهي صلاحية المحاولة الثانية. الموعد النهائي يقترب — يُرجى اتخاذ إجراء في أقرب وقت.`
    : `You have a window to resubmit your recording before your second-try deadline passes. The deadline is approaching — please act promptly.`;

  const urgencyNote = isAr
    ? `إذا انتهى الموعد النهائي دون إعادة التقديم، سيتوقف مسارك التدريبي مؤقتاً. نريد لك النجاح، ونحن هنا للمساعدة.`
    : `If the deadline passes without a resubmission, your journey will be paused. We want you to succeed, and we are here to help.`;

  const deadlineRowLabel = isAr ? 'الموعد النهائي:' : 'Deadline:';
  const remainingLabel   = isAr ? 'الوقت المتبقي:' : 'Time remaining:';
  const remainingValue   = isAr
    ? `${days_remaining} ${days_remaining === 1 ? 'يوم' : 'أيام'}`
    : `${days_remaining} ${days_remaining === 1 ? 'day' : 'days'}`;

  const ctaLabel = isAr ? 'إعادة التقديم الآن' : 'Resubmit Now';

  const helpNote = isAr
    ? `هل تحتاج مساعدة؟ تواصل مع مرشدك أو راسلنا على <a href="mailto:support@kunacademy.com" style="color:#474099;">support@kunacademy.com</a>`
    : `Need help? Contact your mentor or reach us at <a href="mailto:support@kunacademy.com" style="color:#474099;">support@kunacademy.com</a>`;

  const footerNote = isAr
    ? 'هذا البريد أُرسل تلقائياً من أكاديمية كُن. للاستفسار: <a href="mailto:support@kunacademy.com" style="color:#7C73C0;">support@kunacademy.com</a>'
    : 'This email was sent automatically by Kun Academy. Questions? <a href="mailto:support@kunacademy.com" style="color:#7C73C0;">support@kunacademy.com</a>';

  // Urgency badge colour: red at T-1, amber at T-3, yellow at T-7
  const badgeBg   = days_remaining === 1 ? '#FEE2E2' : days_remaining === 3 ? '#FEF3C7' : '#FFF9C4';
  const badgeBorder = days_remaining === 1 ? '#FCA5A5' : days_remaining === 3 ? '#FCD34D' : '#FDE047';
  const badgeText = days_remaining === 1 ? '#991B1B' : days_remaining === 3 ? '#92400E' : '#713F12';
  const badgeLabel = isAr
    ? `${days_remaining} ${days_remaining === 1 ? 'يوم متبقٍ' : 'أيام متبقية'}`
    : `${days_remaining} ${days_remaining === 1 ? 'day remaining' : 'days remaining'}`;

  return `<!DOCTYPE html>
<html lang="${locale}" dir="${dir}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${buildSubject(locale, days_remaining)}</title>
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
                ${isAr ? 'تذكير: موعد المحاولة الثانية' : 'Reminder: Second-Try Deadline'}
              </h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px;text-align:${align};" dir="${dir}">

              <!-- Urgency badge -->
              <div style="display:inline-block;background:${badgeBg};border:1px solid ${badgeBorder};
                          border-radius:20px;padding:6px 16px;margin-bottom:24px;">
                <span style="color:${badgeText};font-size:14px;font-weight:700;">
                  ${badgeLabel}
                </span>
              </div>

              <!-- Greeting -->
              <p style="margin:0 0 16px;font-size:15px;color:#333333;font-weight:600;">
                ${greeting}
              </p>

              <!-- Intro -->
              <p style="margin:0 0 20px;font-size:15px;color:#333333;line-height:1.8;">
                ${intro}
              </p>

              <!-- Deadline box -->
              <div style="background:#FFF9F0;border-radius:8px;padding:20px 24px;
                          margin:0 0 20px;border:1px solid #FCD34D;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="font-size:14px;color:#555555;padding-bottom:10px;">
                      <strong>${deadlineRowLabel}</strong>
                      &nbsp;
                      <span style="color:#D97706;font-weight:700;">${deadlineLabel}</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="font-size:14px;color:#555555;">
                      <strong>${remainingLabel}</strong>
                      &nbsp;
                      <span style="color:${badgeText};font-weight:700;">${remainingValue}</span>
                    </td>
                  </tr>
                </table>
              </div>

              <!-- Urgency note -->
              <p style="margin:0 0 24px;font-size:14px;color:#555555;line-height:1.7;
                        background:#F9F7FF;border-inline-start:4px solid #7C73C0;
                        padding:14px 18px;border-radius:4px;">
                ${urgencyNote}
              </p>

              <!-- CTA button -->
              <div style="text-align:center;margin:28px 0;">
                <a href="${ctaUrl}"
                   style="display:inline-block;background:#474099;color:#ffffff;text-decoration:none;
                          padding:14px 36px;border-radius:8px;font-size:15px;font-weight:bold;">
                  ${ctaLabel}
                </a>
              </div>

              <!-- Help note -->
              <p style="margin:0 0 20px;font-size:14px;color:#555555;line-height:1.7;">
                ${helpNote}
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
 * Send the second-try deadline warning email to a student.
 * Non-throwing — call inside try/catch and log errors without blocking.
 */
export async function sendSecondTryDeadlineWarningEmail(
  to: string,
  params: SecondTryDeadlineWarningEmailParams,
): Promise<void> {
  const subject = buildSubject(params.locale, params.days_remaining);
  await sendEmail({ to, subject, html: buildHtml(params) });
}
