/**
 * Assessment Result — FAIL Email — sendAssessmentResultFailEmail()
 *
 * Bilingual (AR + EN, both in same body with <hr> separator) email sent to
 * the student when a Master Mentor finalises an assessment with verdict=fail
 * (including ethics_auto_failed).
 *
 * Tone: supportive, never shaming, coach-voice (mentor-to-mentee).
 * NEVER uses "failed" or "فشلت" as primary framing.
 * Uses "لم تحقق المعايير هذه المرة" / "didn't meet criteria this time" style.
 * Frames the result as a learning opportunity and surfaces the second-try pathway.
 *
 * Subject lines (per spec):
 *   AR: "ملاحظات على تقييمك - {package_title}"
 *   EN: "Feedback on your assessment — {package_title}"
 *
 * Template key: 'assessment-result-fail'
 * Enqueued by: POST /api/assessments/[assessmentId]/submit (Phase 2.7)
 */

import { sendEmail } from './sender';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AssessmentResultFailEmailParams {
  /** Student's display name (full_name_ar or full_name_en depending on locale) */
  student_name: string;
  /** 'ar' | 'en' — controls primary direction; both languages always appear */
  locale: 'ar' | 'en';
  /** Localised package/template title (name_ar when locale=ar, name_en otherwise) */
  package_title: string;
  /** Full URL to the assessment result page in the student portal */
  result_url: string;
  /** ISO 8601 — second-try deadline; shown when present (suppressed for ethics fails) */
  second_try_deadline?: string;
  /** Full URL to the assessor voice-message recording — optional */
  voice_message_url?: string;
  /**
   * When true, suppresses the second-try block and shows an ethics-review notice instead.
   * Pass `assessment.ethics_auto_failed === true` from the submit handler.
   */
  is_ethics_fail?: boolean;
}

// ── Subject ───────────────────────────────────────────────────────────────────

function buildSubject(locale: 'ar' | 'en', packageTitle: string): string {
  return locale === 'ar'
    ? `ملاحظات على تقييمك - ${packageTitle}`
    : `Feedback on your assessment — ${packageTitle}`;
}

// ── Deadline formatter ────────────────────────────────────────────────────────

function formatDeadline(iso: string, locale: 'ar' | 'en'): string {
  try {
    return new Date(iso).toLocaleDateString(locale === 'ar' ? 'ar-AE' : 'en-AE', {
      year: 'numeric', month: 'long', day: 'numeric',
    });
  } catch {
    return iso;
  }
}

// ── HTML builder ──────────────────────────────────────────────────────────────

// Contact address for ethics reviews — use env var when available, fall back to placeholder.
const ETHICS_CONTACT =
  (typeof process !== 'undefined' && process.env.ETHICS_CONTACT_EMAIL) ||
  'ethics@kuncoaching.com';

function buildHtml(params: AssessmentResultFailEmailParams): string {
  const { student_name, locale, package_title, result_url, second_try_deadline, voice_message_url, is_ethics_fail } = params;
  const isAr  = locale === 'ar';
  const dir   = isAr ? 'rtl' : 'ltr';
  const align = isAr ? 'right' : 'left';
  const font  = isAr ? 'Tahoma,Arial' : 'system-ui,Arial';

  const footerNote = isAr
    ? 'هذا البريد أُرسل تلقائياً من أكاديمية كُن. للاستفسار: <a href="mailto:support@kunacademy.com" style="color:#7C73C0;">support@kunacademy.com</a>'
    : 'This email was sent automatically by Kun Academy. Questions? <a href="mailto:support@kunacademy.com" style="color:#7C73C0;">support@kunacademy.com</a>';

  // ── Arabic deadline / ethics-review block ───────────────────────────────

  const arDeadlineBlock = is_ethics_fail
    ? `<div style="background:#FFF1F2;border:1px solid #FECDD3;border-radius:8px;
                  padding:14px 18px;margin-bottom:20px;text-align:right;" dir="rtl">
        <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:#9F1239;">
          مراجعة أخلاقيات التدريب
        </p>
        <p style="margin:0;font-size:14px;color:#881337;line-height:1.7;">
          نتيجة هذا التقييم تستوجب مراجعة مع فريق أخلاقيات التدريب.
          يرجى التواصل معنا على
          <a href="mailto:${ETHICS_CONTACT}" style="color:#9F1239;">${ETHICS_CONTACT}</a>
          لمناقشة الخطوات التالية بشكل داعم وسري.
        </p>
      </div>`
    : second_try_deadline
    ? `<div style="background:#FFFBEB;border:1px solid #FCD34D;border-radius:8px;
                  padding:14px 18px;margin-bottom:20px;text-align:right;" dir="rtl">
        <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:#92400E;">
          🔄 مسار المحاولة الثانية
        </p>
        <p style="margin:0;font-size:14px;color:#78350F;line-height:1.7;">
          لديك حتى <strong>${formatDeadline(second_try_deadline, 'ar')}</strong> لتقديم جلسة جديدة.
          تواصل مع مرشدك لجدولة جلسة تحضيرية قبل هذا الموعد.
        </p>
      </div>`
    : '';

  // ── Arabic voice block ───────────────────────────────────────────────────

  const arVoiceBlock = voice_message_url
    ? `<div style="background:#F0F4FF;border:1px solid #C7D2FE;border-radius:8px;
                  padding:14px 18px;margin-bottom:20px;text-align:right;" dir="rtl">
        <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#3730A3;">
          🎙 رسالة صوتية من مقيّمك
        </p>
        <a href="${voice_message_url}"
           style="font-size:14px;color:#474099;text-decoration:underline;">
          اضغط هنا للاستماع
        </a>
      </div>`
    : '';

  // ── Arabic body ────────────────────────────────────────────────────────────

  const arBody = `
    <!-- AR Section -->
    <tr>
      <td style="padding:32px;text-align:right;" dir="rtl">

        <!-- Status badge -->
        <div style="display:inline-block;background:#FEF3C7;border:1px solid #FCD34D;
                    border-radius:20px;padding:6px 18px;margin-bottom:24px;">
          <span style="color:#92400E;font-size:14px;font-weight:700;">ملاحظات للتطوير</span>
        </div>

        <!-- Greeting -->
        <p style="margin:0 0 16px;font-size:17px;font-weight:700;color:#1F2937;line-height:1.5;">
          مرحبًا ${student_name}،
        </p>

        <!-- Main paragraph — no shame framing -->
        <p style="margin:0 0 20px;font-size:15px;color:#333333;line-height:1.9;">
          أكمل مقيّمك مراجعة جلستك التدريبية في حزمة "<strong>${package_title}</strong>".
          في هذه المرة، <strong>لم تتحقق بعض المعايير المطلوبة</strong> على المستوى المطلوب —
          وهذا جزء طبيعي من مسيرة أي مدرّب يسعى للتميّز.
        </p>

        <!-- Reframe as growth -->
        <p style="margin:0 0 20px;font-size:14px;color:#555555;line-height:1.8;
                  background:#F9F7FF;border-inline-start:4px solid #7C73C0;padding:14px 18px;border-radius:4px;">
          الكوتشينج الحقيقي لا يُبنى في لحظة — بل يتشكّل عبر طبقات من التغذية الراجعة والتأمّل.
          كل ملاحظة في التقرير هي دعوة للعمق، لا حكم على قيمتك.
        </p>

        <!-- Next steps intro -->
        <p style="margin:0 0 12px;font-size:14px;font-weight:600;color:#333333;">
          خطواتك التالية:
        </p>
        <ul style="margin:0 0 20px;padding-inline-start:20px;font-size:14px;color:#374151;line-height:2.1;">
          <li>راجع التغذية الراجعة التفصيلية في تقرير التقييم</li>
          <li>تواصل مع مرشدك لجلسة استيعاب وتطوير</li>
          <li>حدّد منطقة عمل واحدة تريد تعزيزها قبل الجلسة القادمة</li>
        </ul>

        <!-- CTA: view result -->
        <div style="text-align:center;margin:0 0 20px;">
          <a href="${result_url}"
             style="display:inline-block;background:#474099;color:#ffffff;text-decoration:none;
                    padding:14px 36px;border-radius:8px;font-size:15px;font-weight:bold;">
            عرض تقرير التقييم
          </a>
        </div>

        ${arDeadlineBlock}
        ${arVoiceBlock}

        <!-- Closing encouragement -->
        <p style="margin:0 0 20px;font-size:14px;color:#555555;line-height:1.7;">
          نحن هنا لدعمك في كل خطوة. لأي سؤال تواصل معنا على
          <a href="mailto:support@kunacademy.com" style="color:#474099;">support@kunacademy.com</a>.
        </p>

        <p style="margin:0;font-size:12px;color:#999999;border-top:1px solid #eeeeee;
                  padding-top:16px;line-height:1.6;">
          ${footerNote}
        </p>
      </td>
    </tr>`;

  // ── English deadline / ethics-review block ──────────────────────────────

  const enDeadlineBlock = is_ethics_fail
    ? `<div style="background:#FFF1F2;border:1px solid #FECDD3;border-radius:8px;
                  padding:14px 18px;margin-bottom:20px;text-align:left;">
        <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:#9F1239;">
          Ethics review
        </p>
        <p style="margin:0;font-size:14px;color:#881337;line-height:1.7;">
          The outcome of this assessment requires a review with our coaching ethics team.
          Please reach out at
          <a href="mailto:${ETHICS_CONTACT}" style="color:#9F1239;">${ETHICS_CONTACT}</a>
          to discuss next steps in a supportive and confidential conversation.
        </p>
      </div>`
    : second_try_deadline
    ? `<div style="background:#FFFBEB;border:1px solid #FCD34D;border-radius:8px;
                  padding:14px 18px;margin-bottom:20px;text-align:left;">
        <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:#92400E;">
          🔄 Second-try pathway
        </p>
        <p style="margin:0;font-size:14px;color:#78350F;line-height:1.7;">
          You have until <strong>${formatDeadline(second_try_deadline, 'en')}</strong> to submit a new session.
          Reach out to your mentor to schedule a preparation session before this date.
        </p>
      </div>`
    : '';

  // ── English voice block ──────────────────────────────────────────────────

  const enVoiceBlock = voice_message_url
    ? `<div style="background:#F0F4FF;border:1px solid #C7D2FE;border-radius:8px;
                  padding:14px 18px;margin-bottom:20px;text-align:left;">
        <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#3730A3;">
          🎙 Voice message from your assessor
        </p>
        <a href="${voice_message_url}"
           style="font-size:14px;color:#474099;text-decoration:underline;">
          Click here to listen
        </a>
      </div>`
    : '';

  // ── English body ────────────────────────────────────────────────────────────

  const enBody = `
    <!-- EN Section -->
    <tr>
      <td style="padding:32px;text-align:left;" dir="ltr">

        <!-- Status badge -->
        <div style="display:inline-block;background:#FEF3C7;border:1px solid #FCD34D;
                    border-radius:20px;padding:6px 18px;margin-bottom:24px;">
          <span style="color:#92400E;font-size:14px;font-weight:700;">Feedback &amp; Development Notes</span>
        </div>

        <!-- Greeting -->
        <p style="margin:0 0 16px;font-size:17px;font-weight:700;color:#1F2937;line-height:1.5;">
          Hi ${student_name},
        </p>

        <!-- Main paragraph — no shame framing -->
        <p style="margin:0 0 20px;font-size:15px;color:#333333;line-height:1.9;">
          Your assessor has completed their review of your coaching session for
          "<strong>${package_title}</strong>".
          This time, <strong>some of the required criteria were not yet met</strong> at the
          standard needed — and that is a normal part of the journey for any coach striving
          for excellence.
        </p>

        <!-- Reframe as growth -->
        <p style="margin:0 0 20px;font-size:14px;color:#555555;line-height:1.8;
                  background:#F9F7FF;border-left:4px solid #7C73C0;padding:14px 18px;border-radius:4px;">
          Coaching mastery is not built in a moment — it is shaped through layers of feedback and
          reflection. Every observation in your report is an invitation to go deeper, not a judgment
          of your worth.
        </p>

        <!-- Next steps -->
        <p style="margin:0 0 12px;font-size:14px;font-weight:600;color:#333333;">
          Your next steps:
        </p>
        <ul style="margin:0 0 20px;padding-left:20px;font-size:14px;color:#374151;line-height:2.1;">
          <li>Review the detailed feedback in your assessment report</li>
          <li>Connect with your mentor for a debrief and development session</li>
          <li>Identify one focus area to strengthen before your next session</li>
        </ul>

        <!-- CTA: view result -->
        <div style="text-align:center;margin:0 0 20px;">
          <a href="${result_url}"
             style="display:inline-block;background:#474099;color:#ffffff;text-decoration:none;
                    padding:14px 36px;border-radius:8px;font-size:15px;font-weight:bold;">
            View Assessment Report
          </a>
        </div>

        ${enDeadlineBlock}
        ${enVoiceBlock}

        <!-- Closing encouragement -->
        <p style="margin:0 0 20px;font-size:14px;color:#555555;line-height:1.7;">
          We are here to support you at every step. For any questions, reach out at
          <a href="mailto:support@kunacademy.com" style="color:#474099;">support@kunacademy.com</a>.
        </p>

        <p style="margin:0;font-size:12px;color:#999999;border-top:1px solid #eeeeee;
                  padding-top:16px;line-height:1.6;">
          ${footerNote}
        </p>
      </td>
    </tr>`;

  // Render: primary locale first, then divider, then secondary
  const primaryBody  = isAr ? arBody  : enBody;
  const secondaryBody = isAr ? enBody : arBody;

  return `<!DOCTYPE html>
<html lang="${locale}" dir="${dir}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${buildSubject(locale, package_title)}</title>
</head>
<body style="margin:0;padding:0;background:#f5f3ef;font-family:${font},sans-serif;">
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
                ${isAr ? 'تقرير التقييم — ملاحظات للتطوير' : 'Assessment Report — Development Feedback'}
              </h1>
            </td>
          </tr>

          ${primaryBody}

          <!-- Divider between languages -->
          <tr>
            <td style="padding:0 32px;">
              <hr style="border:none;border-top:2px solid #f5f3ef;margin:0;" />
            </td>
          </tr>

          ${secondaryBody}

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
 * Send the assessment-result FAIL notification to a student.
 *
 * Template key: 'assessment-result-fail'
 * Non-throwing in the submit handler — call inside try/catch and log errors
 * without blocking the 200 response.
 */
export async function sendAssessmentResultFailEmail(
  to: string,
  params: AssessmentResultFailEmailParams,
): Promise<void> {
  const subject = buildSubject(params.locale, params.package_title);
  await sendEmail({ to, subject, html: buildHtml(params) });
}
