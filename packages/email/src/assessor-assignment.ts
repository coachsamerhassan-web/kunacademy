/**
 * Assessor Assignment Email — sendAssessorAssignmentEmail()
 *
 * Bilingual (AR + EN) notification sent to the assessor immediately after
 * they are round-robin assigned to a new student recording.
 *
 * Surfaces:
 *   - Student name (full_name_ar / full_name_en; COALESCE-safe fallback)
 *   - Recording metadata (filename, duration, submitted_at)
 *   - Deep link to the assessor queue in the portal
 *
 * Usage:
 *   void (async () => {
 *     try {
 *       await sendAssessorAssignmentEmail('assessor@example.com', {
 *         assessor_name:      'Mona Khalil',
 *         locale:             'ar',
 *         student_name:       'Sara Ahmed',
 *         recording_filename: 'session-1.m4a',
 *         duration_seconds:   3720,
 *         submitted_at:       '2026-04-19T10:30:00Z',
 *         queue_url:          'https://kunacademy.com/ar/portal/assessor',
 *       });
 *     } catch (err) {
 *       console.error('[assessor-assignment email] failed:', err);
 *     }
 *   })();
 *
 * Source: apps/web/src/lib/mentoring/assign-assessor.ts — Phase 2 notification hook
 */

import { sendEmail } from './sender';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AssessorAssignmentEmailParams {
  /** Assessor's display name */
  assessor_name: string;
  /** 'ar' | 'en' — controls direction, subject, and copy */
  locale: 'ar' | 'en';
  /**
   * Student's display name.
   * Safe to pass null/undefined — falls back to a generic label so the
   * email always sends even if the profile row had no name columns filled.
   */
  student_name: string | null | undefined;
  /** Original filename of the uploaded recording */
  recording_filename: string;
  /** Recording duration in seconds; null if ffprobe could not determine it */
  duration_seconds: number | null | undefined;
  /** ISO 8601 — when the student submitted the recording */
  submitted_at: string;
  /** Full URL to the assessor's queue page */
  queue_url: string;
}

// ── Subject lines ─────────────────────────────────────────────────────────────

function buildSubject(locale: 'ar' | 'en'): string {
  return locale === 'ar'
    ? 'تقييم جديد في قائمة عملك'
    : 'New assessment queued for you';
}

// ── Formatters ────────────────────────────────────────────────────────────────

/** Format seconds into a human-readable duration string e.g. "1h 02m" or "45m". */
function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || seconds <= 0) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  return `${m}m`;
}

/** Format ISO 8601 date to locale-aware human string. */
function formatDate(iso: string, locale: 'ar' | 'en'): string {
  try {
    const date = new Date(iso);
    return date.toLocaleDateString(locale === 'ar' ? 'ar-AE' : 'en-AE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

// ── HTML builder ──────────────────────────────────────────────────────────────

function buildHtml(params: AssessorAssignmentEmailParams): string {
  const {
    assessor_name,
    locale,
    student_name,
    recording_filename,
    duration_seconds,
    submitted_at,
    queue_url,
  } = params;

  const isAr  = locale === 'ar';
  const dir   = isAr ? 'rtl' : 'ltr';
  const align = isAr ? 'right' : 'left';

  // COALESCE with NULLIF pattern — never renders "null" or empty string
  const safeStudentName = (student_name && student_name.trim())
    ? student_name.trim()
    : (isAr ? 'طالب' : 'Student');

  // Greeting
  const greeting = isAr
    ? `مرحبًا ${assessor_name}،`
    : `Hi ${assessor_name},`;

  // Paragraph 1 — assignment notice
  const para1 = isAr
    ? `تم تعيينك مقيِّمًا لتسجيل الجلسة المقدَّم من الطالب <strong>${safeStudentName}</strong>. يرجى الاطلاع على التسجيل وإتمام التقييم في أقرب وقت ممكن.`
    : `You have been assigned as assessor for the session recording submitted by student <strong>${safeStudentName}</strong>. Please review the recording and complete your assessment at your earliest convenience.`;

  // Recording metadata block
  const metaFilename  = isAr ? 'اسم الملف'   : 'Filename';
  const metaDuration  = isAr ? 'المدة'        : 'Duration';
  const metaSubmitted = isAr ? 'تاريخ الرفع'  : 'Submitted';

  // CTA button
  const ctaLabel = isAr ? 'فتح قائمة التقييمات' : 'Open Assessment Queue';

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
                ${isAr ? 'تقييم جديد بانتظارك' : 'New Assessment Assigned'}
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

              <!-- Paragraph 1: assignment notice -->
              <p style="margin:0 0 24px;font-size:15px;color:#333333;line-height:1.8;">
                ${para1}
              </p>

              <!-- Recording metadata card -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
                     style="background:#F8F7FF;border:1px solid #DDD8F7;border-radius:8px;
                            margin-bottom:28px;padding:0;">
                <tr>
                  <td style="padding:20px 24px;" dir="${dir}">
                    <p style="margin:0 0 4px;font-size:11px;font-weight:700;
                               color:#7C73C0;text-transform:uppercase;letter-spacing:0.5px;">
                      ${isAr ? 'تفاصيل التسجيل' : 'Recording Details'}
                    </p>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
                           style="margin-top:12px;">
                      <tr>
                        <td style="padding:4px 0;font-size:13px;color:#888888;width:35%;
                                   text-align:${align};">${metaFilename}</td>
                        <td style="padding:4px 0;font-size:13px;color:#333333;font-weight:600;
                                   text-align:${align};">${recording_filename}</td>
                      </tr>
                      <tr>
                        <td style="padding:4px 0;font-size:13px;color:#888888;
                                   text-align:${align};">${metaDuration}</td>
                        <td style="padding:4px 0;font-size:13px;color:#333333;font-weight:600;
                                   text-align:${align};">${formatDuration(duration_seconds)}</td>
                      </tr>
                      <tr>
                        <td style="padding:4px 0;font-size:13px;color:#888888;
                                   text-align:${align};">${metaSubmitted}</td>
                        <td style="padding:4px 0;font-size:13px;color:#333333;font-weight:600;
                                   text-align:${align};">${formatDate(submitted_at, locale)}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- CTA button -->
              <div style="text-align:center;margin-bottom:28px;">
                <a href="${queue_url}"
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
 * Send the assessor-assignment notification email.
 *
 * Guards against null/empty `to` — if the assessor email is missing the call
 * is a no-op (logs a warning) so the assignment handler is never blocked.
 *
 * Non-throwing in the assignment handler — call inside try/catch and log errors
 * without blocking the assignment response.
 */
export async function sendAssessorAssignmentEmail(
  to: string | null | undefined,
  params: AssessorAssignmentEmailParams,
): Promise<void> {
  if (!to) {
    console.warn('[assessor-assignment email] skipped: assessor email is null/empty');
    return;
  }
  const subject = buildSubject(params.locale);
  await sendEmail({ to, subject, html: buildHtml(params) });
}
