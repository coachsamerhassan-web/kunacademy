/**
 * sendScholarshipApplicationDisbursedEmail — Wave E.6
 *
 * Sent when admin marks an allocated scholarship as 'disbursed'. Contains:
 *   - The plaintext scholarship_token (one-time send; never recoverable
 *     after this email; never stored in DB)
 *   - Personalized enrollment URL
 *   - 30-day expiry notice
 *
 * Dignity-framed, IP-clean: no methodology, no donor names. Welcoming + warm
 * but operational.
 *
 * Bilingual (AR + EN), brand-aligned.
 *
 * SECURITY: this email contains a sensitive secret (the plaintext token).
 * The token is logged ONLY at the SMTP send moment in the email body; the
 * sender backend MUST not log the body to disk in plaintext. Per existing
 * email infra (`packages/email/src/sender.ts`), `sendEmail()` does not
 * persist message bodies — only delivery status.
 */

import { sendEmail } from '../../sender';
import {
  buildBilingualEmail,
  buildLangBlock,
  buildFooterNote,
  resolveDisplayName,
  formatDateLong,
  escapeHtml,
  type Lang,
} from './_shared';

export interface ScholarshipApplicationDisbursedParams {
  to: string;
  recipient_name?: string | null;
  /** Display title of the program (canon AR or EN). */
  program_title: string;
  /** Tier — 'partial' or 'full'. */
  scholarship_tier: 'partial' | 'full';
  /** Locale. */
  preferred_language?: Lang;
  /** Full URL to the enrollment landing page with `?scholarship_token=...` query. */
  enrollment_url: string;
  /** ISO timestamp the token expires at (30 days from now). */
  expires_at: string;
  /** Plaintext token (presented in email so recipient can copy if URL doesn't work). */
  plaintext_token: string;
}

function block(lang: Lang, params: ScholarshipApplicationDisbursedParams) {
  const name = resolveDisplayName(params.recipient_name, params.to);
  const isAr = lang === 'ar';
  const tierWord = isAr
    ? params.scholarship_tier === 'full' ? 'الكاملة' : 'الجزئيّة'
    : params.scholarship_tier === 'full' ? 'full' : 'partial';
  const expiresLong = formatDateLong(params.expires_at, lang);
  const safeToken = escapeHtml(params.plaintext_token);
  const safeUrl = escapeHtml(params.enrollment_url);

  // The token is shown inline in a tinted box so the recipient can copy/paste
  // if their email client breaks the URL.
  const tokenBoxAr = `<div style="background:#F5F3EF;border:1px solid #DAD7CE;border-radius:8px;padding:14px 18px;margin:16px 0;font-family:monospace;font-size:13px;line-height:1.6;color:#2D2860;direction:ltr;text-align:center;word-break:break-all;">
    ${safeToken}
  </div>`;
  const tokenBoxEn = tokenBoxAr;

  return buildLangBlock({
    lang,
    greeting: isAr ? `${name}،` : `${name},`,
    paragraphs: isAr
      ? [
          `وصلت اللحظة. منحتك ${tierWord} لبرنامج <strong>${params.program_title}</strong> جاهزة للاستخدام.`,
          `اضغطي على الزرّ أدناه لإكمال التسجيل. الرابط مخصّص لك ولن ينفع غيرك. صلاحيّته تنتهي في <strong>${expiresLong}</strong>.`,
          isAr
            ? `إن لم يعمل الزرّ، انسخي هذا الرمز يدويّاً في صفحة التسجيل:${tokenBoxAr}`
            : '',
          `بعد التسجيل، سيُغلق الرمز تلقائيّاً لاستخدامه مرّة واحدة فقط.`,
        ].filter((p) => p.length > 0)
      : [
          `The moment has arrived. Your ${tierWord} scholarship for <strong>${params.program_title}</strong> is ready to use.`,
          `Click the button below to complete enrollment. The link is personalized for you and will not work for anyone else. It expires on <strong>${expiresLong}</strong>.`,
          `If the button does not work, you can copy the code manually into the enrollment page:${tokenBoxEn}`,
          `After enrollment, the code will close automatically — it can only be used once.`,
        ],
    cta: {
      label: isAr ? 'إكمال التسجيل' : 'Complete enrollment',
      href: safeUrl,
    },
    trailing: buildFooterNote(lang),
  });
}

export async function sendScholarshipApplicationDisbursedEmail(
  params: ScholarshipApplicationDisbursedParams,
): Promise<void> {
  if (!params.to) {
    console.warn('[scholarship-application-disbursed] skipped: missing to');
    return;
  }
  if (!params.plaintext_token) {
    console.warn('[scholarship-application-disbursed] skipped: missing plaintext_token');
    return;
  }
  const subject =
    params.preferred_language === 'en'
      ? `Complete your enrollment — ${params.program_title}`
      : `أكملي تسجيلك — ${params.program_title}`;

  const html = buildBilingualEmail({
    headerTitle: {
      ar: 'الخطوة الأخيرة',
      en: 'Final Step',
    },
    arBody: block('ar', params),
    enBody: block('en', params),
  });

  await sendEmail({ to: params.to, subject, html });
}
