/**
 * Mentor Prep Email — sendMentorPrepEmail()
 *
 * Bilingual (AR + EN) email notifying the assigned mentor that their
 * student's Beneficiary File prep materials are now accessible (48h gate
 * has opened). Ships in Phase 1.6; wired to cron #9 (`mentor_prep_release`)
 * in Phase 1.4.
 *
 * IMPORTANT: This function is NOT called by any cron yet. Phase 1.4 wires
 * the `mentor_prep_release` cron that calls this helper after confirming
 * the 48h gate is open (200 from GET /api/beneficiary-files/[id]/mentor-view).
 *
 * Usage (Phase 1.4 cron will do):
 *   await sendMentorPrepEmail({
 *     mentorEmail:    'mentor@example.com',
 *     studentAlias:   'Student A',
 *     packageName:    'STIC L1 Mentoring Bundle',
 *     sessionDate:    '2026-05-01',         // human-readable, already localised
 *     mentorViewUrl:  'https://app.kuncoaching.com/ar/dashboard/mentor/beneficiary-files/abc123',
 *     locale:         'ar',
 *   });
 *
 * Source: SPEC-mentoring-package-template.md §6.2 + §8 (notification map row "Mentoring session prep ready")
 * Sub-phase: S2-Layer-1 / 1.6
 */

import { sendEmail } from './sender';

export interface MentorPrepEmailParams {
  /** Recipient email address — the assigned mentor */
  mentorEmail:   string;
  /** Student alias (pseudonym, no real PII) */
  studentAlias:  string;
  /** Localised package name (use name_ar for locale=ar, name_en otherwise) */
  packageName:   string;
  /** Human-readable session date string, already localised for the mentor */
  sessionDate:   string;
  /** Full URL to GET /[locale]/dashboard/mentor/beneficiary-files/[id] */
  mentorViewUrl: string;
  /** 'ar' | 'en' — controls email direction and copy */
  locale:        'ar' | 'en';
}

const SUBJECT = {
  ar: (alias: string) => `مواد التحضير متاحة — جلستك مع ${alias}`,
  en: (alias: string) => `Prep Materials Available — Your Session with ${alias}`,
};

function buildHtml(params: MentorPrepEmailParams): string {
  const { studentAlias, packageName, sessionDate, mentorViewUrl, locale } = params;
  const isAr = locale === 'ar';
  const dir  = isAr ? 'rtl' : 'ltr';

  if (isAr) {
    return `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${SUBJECT.ar(studentAlias)}</title>
</head>
<body style="margin:0;padding:0;background:#f5f3ef;font-family:Tahoma,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f3ef;padding:32px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0"
               style="background:#ffffff;border-radius:12px;overflow:hidden;max-width:600px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background:#1a3c5e;padding:28px 32px;text-align:right;" dir="${dir}">
              <p style="margin:0;color:#ffffff;font-size:20px;font-weight:bold;">
                أكاديمية كن
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px;text-align:right;" dir="${dir}">
              <h1 style="margin:0 0 12px;font-size:22px;color:#1a3c5e;line-height:1.4;">
                مواد التحضير متاحة الآن
              </h1>
              <p style="margin:0 0 20px;font-size:15px;color:#444444;line-height:1.7;">
                أصبح بإمكانك الاطلاع على ملف المستفيد الخاص بجلستك القادمة مع
                <strong>${studentAlias}</strong>.
              </p>

              <!-- Details box -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
                     style="background:#f5f3ef;border-radius:8px;padding:16px;margin-bottom:24px;">
                <tr>
                  <td style="text-align:right;padding:6px 0;font-size:14px;color:#666666;">
                    <strong style="color:#1a3c5e;">الحزمة:</strong> ${packageName}
                  </td>
                </tr>
                <tr>
                  <td style="text-align:right;padding:6px 0;font-size:14px;color:#666666;">
                    <strong style="color:#1a3c5e;">موعد الجلسة:</strong> ${sessionDate}
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 24px;font-size:14px;color:#666666;line-height:1.7;">
                يمكنك الاطلاع على تأملات الطالب قبل الجلسة وبعدها، وخريطة الوعي،
                والاستعارات — كل ما تحتاجه للتحضير الجيد.
              </p>

              <!-- CTA button -->
              <div style="text-align:center;margin-bottom:32px;">
                <a href="${mentorViewUrl}"
                   style="display:inline-block;background:#1a3c5e;color:#ffffff;text-decoration:none;
                          padding:14px 32px;border-radius:8px;font-size:15px;font-weight:bold;">
                  عرض ملف المستفيد
                </a>
              </div>

              <p style="margin:0;font-size:12px;color:#999999;border-top:1px solid #eeeeee;padding-top:16px;">
                هذا البريد أُرسل تلقائياً من منصة كن. إذا كنت تعتقد أنه وصلك بالخطأ، يُرجى تجاهله.
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

  // English
  return `
<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${SUBJECT.en(studentAlias)}</title>
</head>
<body style="margin:0;padding:0;background:#f5f3ef;font-family:system-ui,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f3ef;padding:32px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0"
               style="background:#ffffff;border-radius:12px;overflow:hidden;max-width:600px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background:#1a3c5e;padding:28px 32px;text-align:left;" dir="${dir}">
              <p style="margin:0;color:#ffffff;font-size:20px;font-weight:bold;">
                Kun Academy
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px;text-align:left;" dir="${dir}">
              <h1 style="margin:0 0 12px;font-size:22px;color:#1a3c5e;line-height:1.4;">
                Prep Materials Are Now Available
              </h1>
              <p style="margin:0 0 20px;font-size:15px;color:#444444;line-height:1.7;">
                The Beneficiary File for your upcoming session with
                <strong>${studentAlias}</strong> is now accessible.
              </p>

              <!-- Details box -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
                     style="background:#f5f3ef;border-radius:8px;padding:16px;margin-bottom:24px;">
                <tr>
                  <td style="text-align:left;padding:6px 0;font-size:14px;color:#666666;">
                    <strong style="color:#1a3c5e;">Package:</strong> ${packageName}
                  </td>
                </tr>
                <tr>
                  <td style="text-align:left;padding:6px 0;font-size:14px;color:#666666;">
                    <strong style="color:#1a3c5e;">Session Date:</strong> ${sessionDate}
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 24px;font-size:14px;color:#666666;line-height:1.7;">
                Review the student's pre- and post-session reflections, Awareness Map,
                and metaphors — everything you need for a well-prepared session.
              </p>

              <!-- CTA button -->
              <div style="text-align:center;margin-bottom:32px;">
                <a href="${mentorViewUrl}"
                   style="display:inline-block;background:#1a3c5e;color:#ffffff;text-decoration:none;
                          padding:14px 32px;border-radius:8px;font-size:15px;font-weight:bold;">
                  View Beneficiary File
                </a>
              </div>

              <p style="margin:0;font-size:12px;color:#999999;border-top:1px solid #eeeeee;padding-top:16px;">
                This email was sent automatically by Kun Academy. If you received it in error, please disregard it.
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

/**
 * Send a prep-material availability email to the assigned mentor.
 *
 * This function is intentionally NOT wired to any cron in Phase 1.6.
 * Phase 1.4 (`mentor_prep_release` cron job) will import and call it.
 *
 * @throws If the underlying sendEmail transport fails.
 */
export async function sendMentorPrepEmail(params: MentorPrepEmailParams): Promise<void> {
  const { mentorEmail, studentAlias, locale } = params;
  const isAr = locale === 'ar';

  await sendEmail({
    to:      mentorEmail,
    subject: isAr ? SUBJECT.ar(studentAlias) : SUBJECT.en(studentAlias),
    html:    buildHtml(params),
  });
}
