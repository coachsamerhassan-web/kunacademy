/**
 * sendScholarshipApplicationAllocatedEmail — Wave E.6
 *
 * Sent when admin allocates donations to an approved application
 * (status: approved → allocated).
 *
 * Dignity-framed: confirms allocation in general terms; mentions next-step
 * disbursement WITHOUT naming donors. Per spec §9.3 dignity boundary, donor
 * names + recipient pairing must NEVER be revealed to either party.
 *
 * IP-clean: no methodology, no scoring, no session structure, no exercise
 * prompts. Generic language about welcoming next steps + community support.
 *
 * Bilingual (AR + EN), brand-aligned.
 */

import { sendEmail } from '../../sender';
import {
  buildBilingualEmail,
  buildLangBlock,
  buildFooterNote,
  resolveDisplayName,
  type Lang,
} from './_shared';

export interface ScholarshipApplicationAllocatedParams {
  to: string;
  recipient_name?: string | null;
  /** Display title of the program (canon AR or EN). */
  program_title: string;
  /** Tier — 'partial' or 'full'. */
  scholarship_tier: 'partial' | 'full';
  /** Locale of the email. */
  preferred_language?: Lang;
}

function block(lang: Lang, params: ScholarshipApplicationAllocatedParams) {
  const name = resolveDisplayName(params.recipient_name, params.to);
  const isAr = lang === 'ar';
  const tierWord = isAr
    ? params.scholarship_tier === 'full' ? 'كاملة' : 'جزئيّة'
    : params.scholarship_tier === 'full' ? 'full' : 'partial';

  return buildLangBlock({
    lang,
    greeting: isAr ? `مرحباً ${name}،` : `Hello ${name},`,
    paragraphs: isAr
      ? [
          `تأكّدت منحتك <strong>${tierWord}</strong> في برنامج <strong>${params.program_title}</strong>. تمّ تخصيص التمويل وأنت الآن في الخطوة الأخيرة قبل الانضمام.`,
          `سيصلك خلال أيّام بريد منفصل يحتوي على رابط التسجيل المخصّص لك ورمز الاستفادة من المنحة. الرمز صالح لاستخدامك أنت فقط ولفترة محدودة.`,
          `إن كان لديك أيّ سؤال قبل ذلك، نحن هنا.`,
        ]
      : [
          `Your <strong>${tierWord}</strong> scholarship for <strong>${params.program_title}</strong> has been confirmed. Funding is now allocated, and you are at the final step before joining.`,
          `Within the next few days you will receive a separate email containing your personalized enrollment link and a one-time scholarship code. The code is for your use only and is valid for a limited time.`,
          `If you have any questions in the meantime, we are here.`,
        ],
    trailing: buildFooterNote(lang),
  });
}

export async function sendScholarshipApplicationAllocatedEmail(
  params: ScholarshipApplicationAllocatedParams,
): Promise<void> {
  if (!params.to) {
    console.warn('[scholarship-application-allocated] skipped: missing to');
    return;
  }
  const subject =
    params.preferred_language === 'en'
      ? `Your scholarship is confirmed — ${params.program_title}`
      : `تأكّدت منحتك — ${params.program_title}`;

  const html = buildBilingualEmail({
    headerTitle: {
      ar: 'منحة مؤكّدة',
      en: 'Scholarship Confirmed',
    },
    arBody: block('ar', params),
    enBody: block('en', params),
  });

  await sendEmail({ to: params.to, subject, html });
}
