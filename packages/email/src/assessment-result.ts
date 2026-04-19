/**
 * Assessment Result Email — sendAssessmentResultEmail()
 *
 * Bilingual (AR + EN) email notifying the student that their assessor has
 * submitted their assessment and the result is now viewable.
 *
 * Handles both pass and fail outcomes; optionally surfaces a second-try
 * deadline when locale='ar' or locale='en'.
 *
 * Usage:
 *   await sendAssessmentResultEmail('student@example.com', {
 *     student_name:        'Sara Ahmed',
 *     locale:              'ar',
 *     decision:            'pass',
 *     result_url:          'https://kunacademy.com/ar/portal/packages/abc123/assessment',
 *     is_fail:             false,
 *   });
 *
 * Source: POST /api/assessments/[assessmentId]/submit — Phase 2.7 notification hook
 */

import { sendEmail } from './sender';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AssessmentResultEmailParams {
  /** Student's display name (full_name_ar for ar, full_name_en for en) */
  student_name: string;
  /** 'ar' | 'en' — controls direction, subject, and copy */
  locale: 'ar' | 'en';
  /** Assessor's final verdict */
  decision: 'pass' | 'fail';
  /** Full URL to the result page */
  result_url: string;
  /** true when verdict is fail (or ethics_auto_failed) */
  is_fail: boolean;
  /** ISO 8601 — shown only when is_fail=true and present */
  second_try_deadline?: string;
}

// ── Subject lines ─────────────────────────────────────────────────────────────

function buildSubject(locale: 'ar' | 'en', isFail: boolean): string {
  if (locale === 'ar') {
    return isFail
      ? 'تقييمك — المراجعة والخطوات التالية'
      : 'نتيجة التقييم الخاص بك جاهزة';
  }
  return isFail
    ? 'Your assessment — review and next steps'
    : 'Your assessment result is ready';
}

// ── Deadline formatter ────────────────────────────────────────────────────────

function formatDeadline(iso: string, locale: 'ar' | 'en'): string {
  try {
    const date = new Date(iso);
    return date.toLocaleDateString(locale === 'ar' ? 'ar-AE' : 'en-AE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

// ── HTML builder ──────────────────────────────────────────────────────────────

function buildHtml(params: AssessmentResultEmailParams): string {
  const { student_name, locale, is_fail, result_url, second_try_deadline } = params;
  const isAr = locale === 'ar';
  const dir  = isAr ? 'rtl' : 'ltr';
  const align = isAr ? 'right' : 'left';

  // Verdict badge
  const badgeBg    = is_fail ? '#FEF2F2' : '#ECFDF5';
  const badgeBorder = is_fail ? '#FCA5A5' : '#6EE7B7';
  const badgeColor = is_fail ? '#B91C1C' : '#065F46';
  const badgeText  = isAr
    ? (is_fail ? 'تحتاج إلى مراجعة' : 'ناجح')
    : (is_fail ? 'Needs Review' : 'Passed');

  // Paragraph 1 — verdict statement
  const verdictPara = isAr
    ? (is_fail
        ? `مرحبًا ${student_name}، أكمل المقيِّم مراجعة جلستك. النتيجة تحتاج إلى مراجعة وتطوير قبل المضي قُدُمًا.`
        : `مبروك ${student_name}! أكمل المقيِّم مراجعة جلستك، وسعداء بإخبارك أنك اجتزت التقييم بنجاح.`)
    : (is_fail
        ? `Hi ${student_name}, your assessor has completed their review of your session. The result indicates some areas that need attention before moving forward.`
        : `Congratulations ${student_name}! Your assessor has completed their review, and we're pleased to let you know that you have passed your assessment.`);

  // Paragraph 2 — CTA intro
  const ctaIntro = isAr
    ? 'يمكنك الاطلاع على التغذية الراجعة التفصيلية، وأبرز كفاءاتك، ومجالات التطوير من خلال الرابط أدناه.'
    : 'You can view the detailed feedback, your strongest competencies, and development areas by following the link below.';

  // CTA button label
  const ctaLabel = isAr ? 'عرض نتيجة التقييم' : 'View Assessment Result';

  // Optional deadline paragraph (fail + deadline only)
  let deadlinePara = '';
  if (is_fail && second_try_deadline) {
    const formatted = formatDeadline(second_try_deadline, locale);
    deadlinePara = isAr
      ? `<p style="margin:0 0 20px;font-size:14px;color:#92400E;background:#FFFBEB;border:1px solid #FCD34D;border-radius:8px;padding:14px 18px;line-height:1.7;">
          لديك حتى <strong>${formatted}</strong> لإعادة تقديم جلستك. تواصل مع مرشدك للاستعداد.
        </p>`
      : `<p style="margin:0 0 20px;font-size:14px;color:#92400E;background:#FFFBEB;border:1px solid #FCD34D;border-radius:8px;padding:14px 18px;line-height:1.7;">
          You have until <strong>${formatted}</strong> to re-submit your session. Reach out to your mentor to prepare.
        </p>`;
  }

  // Footer note
  const footerNote = isAr
    ? 'هذا البريد أُرسل تلقائياً من أكاديمية كُن. للاستفسار: <a href="mailto:support@kunacademy.com" style="color:#7C73C0;">support@kunacademy.com</a>'
    : 'This email was sent automatically by Kun Academy. Questions? <a href="mailto:support@kunacademy.com" style="color:#7C73C0;">support@kunacademy.com</a>';

  return `<!DOCTYPE html>
<html lang="${locale}" dir="${dir}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${buildSubject(locale, is_fail)}</title>
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
                ${isAr ? 'نتيجة تقييمك' : 'Your Assessment Result'}
              </h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px;text-align:${align};" dir="${dir}">

              <!-- Verdict badge -->
              <div style="display:inline-block;background:${badgeBg};border:1px solid ${badgeBorder};
                          border-radius:20px;padding:6px 16px;margin-bottom:24px;">
                <span style="color:${badgeColor};font-size:14px;font-weight:700;">${badgeText}</span>
              </div>

              <!-- Paragraph 1: verdict -->
              <p style="margin:0 0 20px;font-size:15px;color:#333333;line-height:1.8;">
                ${verdictPara}
              </p>

              <!-- Paragraph 2: CTA intro -->
              <p style="margin:0 0 20px;font-size:14px;color:#555555;line-height:1.7;">
                ${ctaIntro}
              </p>

              <!-- CTA button -->
              <div style="text-align:center;margin:0 0 28px;">
                <a href="${result_url}"
                   style="display:inline-block;background:#474099;color:#ffffff;text-decoration:none;
                          padding:14px 36px;border-radius:8px;font-size:15px;font-weight:bold;">
                  ${ctaLabel}
                </a>
              </div>

              ${deadlinePara}

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
 * Send the assessment-result notification email to a student.
 *
 * Non-throwing in the submit handler — call inside try/catch and log errors
 * without blocking the 200 response.
 */
export async function sendAssessmentResultEmail(
  to: string,
  params: AssessmentResultEmailParams,
): Promise<void> {
  const subject = buildSubject(params.locale, params.is_fail);
  await sendEmail({ to, subject, html: buildHtml(params) });
}
