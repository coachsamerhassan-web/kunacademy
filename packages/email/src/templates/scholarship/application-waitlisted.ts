/**
 * sendScholarshipApplicationWaitlistedEmail — Wave E.5
 *
 * Sent when admin places an application on the waitlist (passed screening
 * but no fund capacity yet). Sets clear expectations: when capacity opens,
 * we will review again automatically.
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

export interface ScholarshipApplicationWaitlistedParams {
  to: string;
  recipient_name?: string | null;
  /** Display title of the program (canon AR or EN). */
  program_title: string;
  /** Locale of the email. */
  preferred_language?: Lang;
}

function block(lang: Lang, params: ScholarshipApplicationWaitlistedParams) {
  const name = resolveDisplayName(params.recipient_name, params.to);
  const isAr = lang === 'ar';

  return buildLangBlock({
    lang,
    greeting: isAr ? `أهلاً ${name}،` : `Hi ${name},`,
    paragraphs: isAr
      ? [
          `شكراً جزيلاً على طلبك للحصول على منحة في برنامج <strong>${params.program_title}</strong>.`,
          `بعد مراجعة طلبك، نرى أنّ سياقك واستعدادك يستحقان الفرصة. غير أن سعة الصندوق الحالية لا تسمح بالتخصيص في هذه الدورة. أُضيف طلبك إلى قائمة الانتظار.`,
          `حين تصبح هناك سعة جديدة في الصندوق، سنُراجع طلبك تلقائياً، وسنتواصل معك للتأكيد قبل تخصيص أي مقعد.`,
          `لست بحاجة لإعادة التقديم. إن تغيّر سياقك في الأثناء، يمكنك الكتابة إلينا.`,
        ]
      : [
          `Thank you for applying for a scholarship in <strong>${params.program_title}</strong>.`,
          `After reviewing your application, we see that your context and readiness merit the opportunity. However, current fund capacity does not allow allocation in this round. Your application has been placed on the waitlist.`,
          `When new capacity opens in the fund, we will review your application automatically and reach out to confirm before allocating any seat.`,
          `You do not need to reapply. If your context changes in the meantime, write to us anytime.`,
        ],
    trailing: buildFooterNote(lang),
  });
}

export async function sendScholarshipApplicationWaitlistedEmail(
  params: ScholarshipApplicationWaitlistedParams,
): Promise<void> {
  if (!params.to) {
    console.warn('[scholarship-application-waitlisted] skipped: missing to');
    return;
  }
  const subject =
    params.preferred_language === 'en'
      ? `Your application is on the waitlist — ${params.program_title}`
      : `طلبك في قائمة الانتظار — ${params.program_title}`;

  const html = buildBilingualEmail({
    headerTitle: {
      ar: 'في قائمة الانتظار',
      en: 'On the Waitlist',
    },
    arBody: block('ar', params),
    enBody: block('en', params),
  });

  await sendEmail({ to: params.to, subject, html });
}
