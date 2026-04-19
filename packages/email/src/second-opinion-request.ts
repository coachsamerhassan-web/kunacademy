/**
 * Second Opinion Request Email — sendSecondOpinionRequestEmail()
 *
 * Bilingual (AR + EN) email notifying mentor-managers that an assessor has
 * flagged an assessment and is requesting a second opinion.
 *
 * Usage:
 *   await sendSecondOpinionRequestEmail('manager@example.com', {
 *     recipient_name:   'Ahmad Saleh',
 *     locale:           'ar',
 *     requester_name:   'Sara Ali',
 *     student_name:     'Khalid Nasser',
 *     assessment_summary: 'ICF PCC — recording submitted 2026-04-19',
 *     escalation_url:   'https://kunacademy.com/ar/admin/escalations/abc123',
 *   });
 *
 * Source: POST /api/admin/assessments/[assessmentId]/request-second-opinion
 */

import { sendEmail } from './sender';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SecondOpinionRequestEmailParams {
  /** Mentor-manager's display name */
  recipient_name: string;
  /** 'ar' | 'en' — controls direction, subject, and copy */
  locale: 'ar' | 'en';
  /** Display name of the assessor who requested */
  requester_name: string;
  /** Student's display name */
  student_name: string;
  /** Short summary: program + submission date */
  assessment_summary: string;
  /** Full URL to the escalations page for this assessment */
  escalation_url: string;
}

// ── Subject lines ─────────────────────────────────────────────────────────────

function buildSubject(locale: 'ar' | 'en'): string {
  return locale === 'ar'
    ? 'طلب رأي ثانٍ جديد'
    : 'New second-opinion request';
}

// ── HTML builder ──────────────────────────────────────────────────────────────

function buildHtml(params: SecondOpinionRequestEmailParams): string {
  const { recipient_name, locale, requester_name, student_name, assessment_summary, escalation_url } = params;
  const isAr  = locale === 'ar';
  const dir   = isAr ? 'rtl' : 'ltr';
  const align = isAr ? 'right' : 'left';

  // ── Copy strings ─────────────────────────────────────────────────────────────

  const greeting = isAr
    ? `مرحبًا ${recipient_name}،`
    : `Hi ${recipient_name},`;

  const body1 = isAr
    ? `طلب المقيِّم <strong>${requester_name}</strong> رأيًا ثانيًا في تقييم الطالب <strong>${student_name}</strong>.`
    : `Assessor <strong>${requester_name}</strong> has requested a second opinion on the assessment for student <strong>${student_name}</strong>.`;

  const summaryLabel = isAr ? 'ملخص التقييم' : 'Assessment summary';

  const body2 = isAr
    ? 'يُرجى الاطلاع على التقييم واتخاذ الإجراء المناسب من لوحة التحكم.'
    : 'Please review the assessment and take the appropriate action from the admin panel.';

  const ctaLabel = isAr ? 'مراجعة التقييم' : 'Review Assessment';

  const footerNote = isAr
    ? 'هذا البريد أُرسل تلقائياً من أكاديمية كُن. للاستفسار: <a href="mailto:support@kunacademy.com" style="color:#7C73C0;">support@kunacademy.com</a>'
    : 'This email was sent automatically by Kun Academy. Questions? <a href="mailto:support@kunacademy.com" style="color:#7C73C0;">support@kunacademy.com</a>';

  const headerTitle = isAr ? 'طلب رأي ثانٍ' : 'Second-Opinion Request';
  const orgLabel    = isAr ? 'أكاديمية كُن للكوتشينج' : 'Kun Coaching Academy';
  const footerTag   = isAr ? 'أكاديمية كُن للكوتشينج — kunacademy.com' : 'Kun Coaching Academy — kunacademy.com';

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
                ${orgLabel}
              </p>
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;line-height:1.4;">
                ${headerTitle}
              </h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px;text-align:${align};" dir="${dir}">

              <!-- Greeting -->
              <p style="margin:0 0 16px;font-size:15px;color:#333333;line-height:1.8;">
                ${greeting}
              </p>

              <!-- Who requested + student -->
              <p style="margin:0 0 20px;font-size:15px;color:#333333;line-height:1.8;">
                ${body1}
              </p>

              <!-- Assessment summary box -->
              <div style="background:#F5F3FF;border:1px solid #C4B5FD;border-radius:8px;
                          padding:14px 18px;margin:0 0 24px;">
                <p style="margin:0 0 6px;font-size:12px;color:#7C3AED;font-weight:700;
                           letter-spacing:0.05em;text-transform:uppercase;">
                  ${summaryLabel}
                </p>
                <p style="margin:0;font-size:14px;color:#374151;line-height:1.6;">
                  ${assessment_summary}
                </p>
              </div>

              <!-- Action prompt -->
              <p style="margin:0 0 24px;font-size:14px;color:#555555;line-height:1.7;">
                ${body2}
              </p>

              <!-- CTA button -->
              <div style="text-align:center;margin:0 0 28px;">
                <a href="${escalation_url}"
                   style="display:inline-block;background:#474099;color:#ffffff;text-decoration:none;
                          padding:14px 36px;border-radius:8px;font-size:15px;font-weight:bold;">
                  ${ctaLabel}
                </a>
              </div>

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
                ${footerTag}
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
 * Send the second-opinion-request notification email to a mentor-manager.
 *
 * Called once per mentor-manager from the request-second-opinion endpoint.
 * Non-throwing — caller catches and logs without blocking the 200 response.
 */
export async function sendSecondOpinionRequestEmail(
  to: string,
  params: SecondOpinionRequestEmailParams,
): Promise<void> {
  const subject = buildSubject(params.locale);
  await sendEmail({ to, subject, html: buildHtml(params) });
}
