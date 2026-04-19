/**
 * Assessor Reassigned Email — sendAssessorReassignedEmail()
 *
 * Bilingual (AR + EN) notice sent to the PREVIOUS assessor when an admin or
 * mentor_manager has reassigned their pending assessment to another assessor.
 *
 * Tone: neutral, no negative implication. "No action required."
 *
 * Usage:
 *   void (async () => {
 *     try {
 *       await sendAssessorReassignedEmail('old.assessor@example.com', {
 *         assessor_name: 'Mona Khalil',
 *         locale:        'ar',
 *       });
 *     } catch (err) {
 *       console.error('[assessor-reassigned email] failed:', err);
 *     }
 *   })();
 *
 * Wired via outbox: template_key 'assessor-reassigned'
 * Source: POST /api/admin/assessments/[assessmentId]/reassign — Phase M5-ext
 */

import { sendEmail } from './sender';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AssessorReassignedEmailParams {
  /** Assessor's display name */
  assessor_name: string;
  /** 'ar' | 'en' — controls direction, subject, and copy */
  locale: 'ar' | 'en';
}

// ── Subject lines ─────────────────────────────────────────────────────────────

function buildSubject(locale: 'ar' | 'en'): string {
  return locale === 'ar'
    ? 'تم إعادة تعيين التقييم — لا يلزم اتخاذ أي إجراء'
    : 'Assessment reassigned — no action required';
}

// ── HTML builder ──────────────────────────────────────────────────────────────

function buildHtml(params: AssessorReassignedEmailParams): string {
  const { assessor_name, locale } = params;

  const isAr  = locale === 'ar';
  const dir   = isAr ? 'rtl' : 'ltr';
  const align = isAr ? 'right' : 'left';

  const greeting = isAr
    ? `مرحبًا ${assessor_name}،`
    : `Hi ${assessor_name},`;

  const para1 = isAr
    ? 'نودّ إعلامك بأن التقييم الذي كان مُعيَّنًا لك قد أُعيد تعيينه إلى مُقيِّم آخر من قِبَل فريق الإدارة.'
    : 'We wanted to let you know that the assessment previously assigned to you has been reassigned to another assessor by the management team.';

  const para2 = isAr
    ? 'لا يلزمك اتخاذ أي إجراء. إذا كانت لديك أي استفسارات، فلا تتردد في التواصل مع فريق الدعم.'
    : 'No action is required on your part. If you have any questions, please feel free to reach out to the support team.';

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
                ${isAr ? 'إشعار: إعادة تعيين تقييم' : 'Notice: Assessment Reassigned'}
              </h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px;text-align:${align};" dir="${dir}">

              <!-- Greeting -->
              <p style="margin:0 0 16px;font-size:16px;color:#333333;font-weight:600;line-height:1.6;">
                ${greeting}
              </p>

              <!-- Paragraph 1 -->
              <p style="margin:0 0 16px;font-size:15px;color:#333333;line-height:1.8;">
                ${para1}
              </p>

              <!-- Paragraph 2 — no action required -->
              <p style="margin:0 0 24px;font-size:15px;color:#333333;line-height:1.8;">
                ${para2}
              </p>

              <!-- Info badge -->
              <div style="background:#F8F7FF;border:1px solid #DDD8F7;border-radius:8px;
                          padding:16px 20px;margin-bottom:28px;text-align:${align};">
                <p style="margin:0;font-size:14px;color:#474099;font-weight:600;">
                  ${isAr ? 'لا يلزم اتخاذ أي إجراء' : 'No action required'}
                </p>
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
 * Send the assessor-reassigned notice to the previous assessor.
 *
 * Non-throwing — call inside try/catch; log errors without blocking the
 * reassignment response.
 */
export async function sendAssessorReassignedEmail(
  to: string | null | undefined,
  params: AssessorReassignedEmailParams,
): Promise<void> {
  if (!to) {
    console.warn('[assessor-reassigned email] skipped: assessor email is null/empty');
    return;
  }
  const subject = buildSubject(params.locale);
  await sendEmail({ to, subject, html: buildHtml(params) });
}
