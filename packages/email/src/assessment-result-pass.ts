/**
 * Assessment Result — PASS Email — sendAssessmentResultPassEmail()
 *
 * Bilingual (AR + EN, both in same body with <hr> separator) email sent to
 * the student when a Master Mentor finalises an assessment with verdict=pass.
 *
 * Tone: celebration, forward momentum, mentor-to-mentee warmth.
 * Never frames it as "passing an exam" — uses growth milestone framing.
 *
 * Subject lines (per spec):
 *   AR: "مبروك! نجحت في التقييم - {package_title}"
 *   EN: "Congratulations — you passed the assessment for {package_title}"
 *
 * Template key: 'assessment-result-pass'
 * Enqueued by: POST /api/assessments/[assessmentId]/submit (Phase 2.7)
 */

import { sendEmail } from './sender';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AssessmentResultPassEmailParams {
  /** Student's display name (full_name_ar or full_name_en depending on locale) */
  student_name: string;
  /** 'ar' | 'en' — controls primary direction; both languages always appear */
  locale: 'ar' | 'en';
  /** Localised package/template title (name_ar when locale=ar, name_en otherwise) */
  package_title: string;
  /** Full URL to the assessment result page in the student portal */
  result_url: string;
  /** Full URL to the next lesson / next step in the portal — optional */
  next_step_url?: string;
  /** Full URL to the assessor voice-message recording — optional */
  voice_message_url?: string;
}

// ── Subject ───────────────────────────────────────────────────────────────────

function buildSubject(locale: 'ar' | 'en', packageTitle: string): string {
  return locale === 'ar'
    ? `مبروك! نجحت في التقييم - ${packageTitle}`
    : `Congratulations — you passed the assessment for ${packageTitle}`;
}

// ── Section builders ─────────────────────────────────────────────────────────

function buildArSection(params: AssessmentResultPassEmailParams): string {
  const { student_name, package_title, result_url, next_step_url, voice_message_url } = params;

  const footerNote = 'هذا البريد أُرسل تلقائياً من أكاديمية كُن. للاستفسار: <a href="mailto:support@kunacademy.com" style="color:#7C73C0;">support@kunacademy.com</a>';

  const voiceBlock = voice_message_url
    ? `<div style="background:#F0F4FF;border:1px solid #C7D2FE;border-radius:8px;
                  padding:14px 18px;margin-bottom:20px;">
        <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#3730A3;">
          🎙 رسالة صوتية من مقيّمك
        </p>
        <a href="${voice_message_url}"
           style="font-size:14px;color:#474099;text-decoration:underline;">
          اضغط هنا للاستماع
        </a>
      </div>`
    : '';

  const nextStepBlock = next_step_url
    ? `<div style="text-align:center;margin:0 0 20px;">
        <a href="${next_step_url}"
           style="display:inline-block;background:#065F46;color:#ffffff;text-decoration:none;
                  padding:13px 28px;border-radius:8px;font-size:14px;font-weight:bold;">
          الانتقال إلى الخطوة التالية
        </a>
      </div>`
    : '';

  return `<tr>
      <td style="padding:32px;text-align:right;" dir="rtl">

        <!-- Celebration badge -->
        <div style="display:inline-block;background:#ECFDF5;border:1px solid #6EE7B7;
                    border-radius:20px;padding:6px 18px;margin-bottom:24px;">
          <span style="color:#065F46;font-size:15px;font-weight:700;">✓ ناجح</span>
        </div>

        <!-- Headline -->
        <p style="margin:0 0 16px;font-size:20px;font-weight:700;color:#065F46;line-height:1.5;">
          مبروك ${student_name}! 🎉
        </p>

        <!-- Main paragraph -->
        <p style="margin:0 0 20px;font-size:15px;color:#333333;line-height:1.9;">
          أكمل مقيّمك مراجعة جلستك التدريبية، ويسعدنا إخبارك أنك
          <strong>اجتزت تقييم "${package_title}"</strong> بنجاح.
          هذا انعكاس حقيقي للجهد الذي بذلته والنمو الذي أحدثته في ممارستك التدريبية.
        </p>

        <!-- Growth framing -->
        <p style="margin:0 0 20px;font-size:14px;color:#555555;line-height:1.8;
                  background:#F9F7FF;border-inline-start:4px solid #7C73C0;padding:14px 18px;border-radius:4px;">
          كل تقييم هو مرآة — ليس للحكم، بل للتوضيح.
          ما حقّقته اليوم يفتح أمامك أفقاً جديداً في مسيرتك كمدرّب.
        </p>

        <!-- CTA: view result -->
        <p style="margin:0 0 12px;font-size:14px;color:#555555;line-height:1.7;">
          يمكنك مطالعة التقرير الكامل والتغذية الراجعة التفصيلية من الرابط أدناه.
        </p>

        <div style="text-align:center;margin:0 0 20px;">
          <a href="${result_url}"
             style="display:inline-block;background:#474099;color:#ffffff;text-decoration:none;
                    padding:14px 36px;border-radius:8px;font-size:15px;font-weight:bold;">
            عرض نتيجة التقييم
          </a>
        </div>

        ${nextStepBlock}
        ${voiceBlock}

        <p style="margin:0;font-size:12px;color:#999999;border-top:1px solid #eeeeee;
                  padding-top:16px;line-height:1.6;">
          ${footerNote}
        </p>
      </td>
    </tr>`;
}

function buildEnSection(params: AssessmentResultPassEmailParams): string {
  const { student_name, package_title, result_url, next_step_url, voice_message_url } = params;

  const footerNote = 'This email was sent automatically by Kun Academy. Questions? <a href="mailto:support@kunacademy.com" style="color:#7C73C0;">support@kunacademy.com</a>';

  const voiceBlock = voice_message_url
    ? `<div style="background:#F0F4FF;border:1px solid #C7D2FE;border-radius:8px;
                  padding:14px 18px;margin-bottom:20px;">
        <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#3730A3;">
          🎙 Voice message from your assessor
        </p>
        <a href="${voice_message_url}"
           style="font-size:14px;color:#474099;text-decoration:underline;">
          Click here to listen
        </a>
      </div>`
    : '';

  const nextStepBlock = next_step_url
    ? `<div style="text-align:center;margin:0 0 20px;">
        <a href="${next_step_url}"
           style="display:inline-block;background:#065F46;color:#ffffff;text-decoration:none;
                  padding:13px 28px;border-radius:8px;font-size:14px;font-weight:bold;">
          Go to Your Next Step
        </a>
      </div>`
    : '';

  return `<tr>
      <td style="padding:32px;text-align:left;" dir="ltr">

        <!-- Celebration badge -->
        <div style="display:inline-block;background:#ECFDF5;border:1px solid #6EE7B7;
                    border-radius:20px;padding:6px 18px;margin-bottom:24px;">
          <span style="color:#065F46;font-size:15px;font-weight:700;">✓ Passed</span>
        </div>

        <!-- Headline -->
        <p style="margin:0 0 16px;font-size:20px;font-weight:700;color:#065F46;line-height:1.5;">
          Congratulations, ${student_name}! 🎉
        </p>

        <!-- Main paragraph -->
        <p style="margin:0 0 20px;font-size:15px;color:#333333;line-height:1.9;">
          Your assessor has completed their review of your coaching session, and we are delighted
          to let you know that you have <strong>passed the assessment for "${package_title}"</strong>.
          This is a genuine reflection of the effort and growth you brought to your practice.
        </p>

        <!-- Growth framing -->
        <p style="margin:0 0 20px;font-size:14px;color:#555555;line-height:1.8;
                  background:#F9F7FF;border-left:4px solid #7C73C0;padding:14px 18px;border-radius:4px;">
          Every assessment is a mirror — not for judgment, but for clarity.
          What you achieved today opens new horizons in your coaching journey.
        </p>

        <!-- CTA: view result -->
        <p style="margin:0 0 12px;font-size:14px;color:#555555;line-height:1.7;">
          View the full assessment report and detailed feedback by following the link below.
        </p>

        <div style="text-align:center;margin:0 0 20px;">
          <a href="${result_url}"
             style="display:inline-block;background:#474099;color:#ffffff;text-decoration:none;
                    padding:14px 36px;border-radius:8px;font-size:15px;font-weight:bold;">
            View Assessment Result
          </a>
        </div>

        ${nextStepBlock}
        ${voiceBlock}

        <p style="margin:0;font-size:12px;color:#999999;border-top:1px solid #eeeeee;
                  padding-top:16px;line-height:1.6;">
          ${footerNote}
        </p>
      </td>
    </tr>`;
}

// ── HTML builder ──────────────────────────────────────────────────────────────

function buildHtml(params: AssessmentResultPassEmailParams): string {
  const { locale, package_title } = params;
  const isAr  = locale === 'ar';
  const dir   = isAr ? 'rtl' : 'ltr';
  const align = isAr ? 'right' : 'left';
  const font  = isAr ? 'Tahoma,Arial' : 'system-ui,Arial';

  // Primary locale first, then secondary after divider
  const primarySection   = isAr ? buildArSection(params) : buildEnSection(params);
  const secondarySection = isAr ? buildEnSection(params) : buildArSection(params);

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
            <td style="background:#065F46;padding:28px 32px;text-align:${align};">
              <p style="margin:0 0 4px;color:rgba(255,255,255,0.7);font-size:13px;">
                ${isAr ? 'أكاديمية كُن للكوتشينج' : 'Kun Coaching Academy'}
              </p>
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;line-height:1.4;">
                ${isAr ? 'نتيجة التقييم — ناجح ✓' : 'Assessment Result — Passed ✓'}
              </h1>
            </td>
          </tr>

          <!-- Primary language section -->
          ${primarySection}

          <!-- Divider between languages -->
          <tr>
            <td style="padding:0 32px;">
              <hr style="border:none;border-top:2px solid #f5f3ef;margin:0;" />
            </td>
          </tr>

          <!-- Secondary language section -->
          ${secondarySection}

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
 * Send the assessment-result PASS notification to a student.
 *
 * Template key: 'assessment-result-pass'
 * Non-throwing in the submit handler — call inside try/catch and log errors
 * without blocking the 200 response.
 */
export async function sendAssessmentResultPassEmail(
  to: string,
  params: AssessmentResultPassEmailParams,
): Promise<void> {
  const subject = buildSubject(params.locale, params.package_title);
  await sendEmail({ to, subject, html: buildHtml(params) });
}
