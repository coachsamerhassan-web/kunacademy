/**
 * sendScholarshipApplicationDeclinedEmail — Wave E.5
 *
 * Sent when admin declines an application. Warm, encouraging tone — NO
 * methodology, NO scoring details, NO reasons exposed (per spec §4.4: Nashit
 * writes a personal reply for any case where the applicant should hear
 * specifics; the system email is template-only and dignity-clean).
 *
 * Bilingual (AR + EN), brand-aligned, IP-clean.
 */

import { sendEmail } from '../../sender';
import {
  buildBilingualEmail,
  buildLangBlock,
  buildFooterNote,
  resolveDisplayName,
  type Lang,
} from './_shared';

export interface ScholarshipApplicationDeclinedParams {
  to: string;
  recipient_name?: string | null;
  /** Locale of the email. */
  preferred_language?: Lang;
}

function block(lang: Lang, params: ScholarshipApplicationDeclinedParams) {
  const name = resolveDisplayName(params.recipient_name, params.to);
  const isAr = lang === 'ar';

  return buildLangBlock({
    lang,
    greeting: isAr ? `أهلاً ${name}،` : `Hi ${name},`,
    paragraphs: isAr
      ? [
          `شكراً جزيلاً على وقتك في تقديم طلبك إلى صندوق منح كُن.`,
          `بعد مراجعة الطلبات الواصلة في هذه الدورة، اخترنا الاتجاه نحو متقدمين آخرين هذه المرة. هذا لا يعني أن رحلتك ليست في وقتها — كل دورة لها ظروفها، والتوقيت الأمثل قد يأتي لاحقاً.`,
          `نشجّعك على الاطلاع على باقي عروض كُن. وإن كنت ترغب لاحقاً في إعادة التقدّم في دورة قادمة، الباب يبقى مفتوحاً.`,
          `كل التوفيق في رحلتك القادمة.`,
        ]
      : [
          `Thank you sincerely for the time you took in submitting your application to the Kun Scholarship Fund.`,
          `After reviewing the applications in this round, we have chosen to direct support to other applicants this time. This is not a statement about your readiness — every cohort has its own context, and the right timing may come later.`,
          `We encourage you to explore the other Kun offerings. If you would like to apply again in a future round, the door remains open.`,
          `Wishing you well on your continued journey.`,
        ],
    trailing: buildFooterNote(lang),
  });
}

export async function sendScholarshipApplicationDeclinedEmail(
  params: ScholarshipApplicationDeclinedParams,
): Promise<void> {
  if (!params.to) {
    console.warn('[scholarship-application-declined] skipped: missing to');
    return;
  }
  const subject =
    params.preferred_language === 'en'
      ? 'Update on your application — Kun Scholarship Fund'
      : 'تحديث بشأن طلبك — صندوق منح كُن';

  const html = buildBilingualEmail({
    headerTitle: {
      ar: 'تحديث بشأن طلبك',
      en: 'Application Update',
    },
    arBody: block('ar', params),
    enBody: block('en', params),
  });

  await sendEmail({ to: params.to, subject, html });
}
