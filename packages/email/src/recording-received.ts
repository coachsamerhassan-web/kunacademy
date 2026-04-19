/**
 * Recording Received Email — sendRecordingReceivedEmail()
 *
 * Bilingual (AR + EN) confirmation sent to the student immediately after
 * their coaching recording + transcript have been successfully stored.
 *
 * Sets clear expectations:
 *   - Acknowledges the submission
 *   - States the SLA (up to 10 business days)
 *   - Promises a follow-up email once the assessment is complete
 *
 * Usage:
 *   void (async () => {
 *     try {
 *       await sendRecordingReceivedEmail('student@example.com', {
 *         student_name: 'Sara Ahmed',
 *         locale:       'ar',
 *         portal_url:   'https://kunacademy.com/ar/portal/packages/abc123',
 *       });
 *     } catch (err) {
 *       console.error('[recording-received email] failed:', err);
 *     }
 *   })();
 *
 * Source: POST /api/packages/[instanceId]/recordings — Phase 2 notification hook
 */

import { sendEmail } from './sender';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RecordingReceivedEmailParams {
  /** Student's display name — full_name_ar for ar, full_name_en for en */
  student_name: string;
  /** 'ar' | 'en' — controls direction, subject, and copy */
  locale: 'ar' | 'en';
  /** Full URL to the student's portal page for this package instance */
  portal_url: string;
}

// ── Subject lines ─────────────────────────────────────────────────────────────

function buildSubject(locale: 'ar' | 'en'): string {
  return locale === 'ar'
    ? 'استلمنا تسجيلك — التالي: مراجعة المقيّم'
    : 'We received your recording — next: assessor review';
}

// ── HTML builder ──────────────────────────────────────────────────────────────

function buildHtml(params: RecordingReceivedEmailParams): string {
  const { student_name, locale, portal_url } = params;
  const isAr  = locale === 'ar';
  const dir   = isAr ? 'rtl' : 'ltr';
  const align = isAr ? 'right' : 'left';

  // Greeting
  const greeting = isAr
    ? `مرحبًا ${student_name}،`
    : `Hi ${student_name},`;

  // Paragraph 1 — confirmation
  const para1 = isAr
    ? 'وصلنا تسجيلك بنجاح، وقد انطلق المقيّم المعيّن لك في مراجعته.'
    : 'Your recording has been successfully received and your assigned assessor has been notified.';

  // Paragraph 2 — SLA
  const para2 = isAr
    ? 'تستغرق عملية التقييم ما يصل إلى <strong>10 أيام عمل</strong>. ستصلك رسالة بريدية أخرى فور اكتمال التقييم ونشر النتيجة.'
    : 'The assessment process takes <strong>up to 10 business days</strong>. You will receive another email as soon as your assessment is complete and the result is published.';

  // Paragraph 3 — reassurance
  const para3 = isAr
    ? 'في غضون ذلك يمكنك متابعة حالة تسجيلك من بوابتك الشخصية.'
    : 'In the meantime, you can track the status of your submission from your portal.';

  // CTA button
  const ctaLabel = isAr ? 'عرض بوابتي' : 'View My Portal';

  // Footer
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
                ${isAr ? 'استلمنا تسجيلك' : 'Recording Received'}
              </h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px;text-align:${align};" dir="${dir}">

              <!-- Confirmation icon row -->
              <div style="text-align:center;margin-bottom:24px;">
                <div style="display:inline-block;background:#ECFDF5;border:1px solid #6EE7B7;
                            border-radius:50%;width:56px;height:56px;line-height:56px;
                            font-size:28px;text-align:center;">
                  &#10003;
                </div>
              </div>

              <!-- Greeting -->
              <p style="margin:0 0 16px;font-size:16px;color:#333333;font-weight:600;line-height:1.6;">
                ${greeting}
              </p>

              <!-- Paragraph 1: confirmation -->
              <p style="margin:0 0 20px;font-size:15px;color:#333333;line-height:1.8;">
                ${para1}
              </p>

              <!-- SLA box -->
              <div style="background:#EFF6FF;border:1px solid #BFDBFE;border-radius:8px;
                          padding:16px 20px;margin-bottom:20px;">
                <p style="margin:0;font-size:14px;color:#1E40AF;line-height:1.7;">
                  ${para2}
                </p>
              </div>

              <!-- Paragraph 3: portal nudge -->
              <p style="margin:0 0 28px;font-size:14px;color:#555555;line-height:1.7;">
                ${para3}
              </p>

              <!-- CTA button -->
              <div style="text-align:center;margin-bottom:28px;">
                <a href="${portal_url}"
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
 * Send the recording-received confirmation email to the student.
 *
 * Guards against null/empty `to` — if the student email is missing the call
 * is a no-op (logs a warning) so the upload handler is never blocked.
 *
 * Non-throwing in the upload handler — call inside try/catch and log errors
 * without blocking the 201 response.
 */
export async function sendRecordingReceivedEmail(
  to: string | null | undefined,
  params: RecordingReceivedEmailParams,
): Promise<void> {
  if (!to) {
    console.warn('[recording-received email] skipped: student email is null/empty');
    return;
  }
  const subject = buildSubject(params.locale);
  await sendEmail({ to, subject, html: buildHtml(params) });
}
