/**
 * sendScholarshipApplicationConfirmationEmail — Wave E.5
 *
 * Sent immediately after a public application submission. Confirms receipt,
 * sets expectations for review window, dignity-framed throughout.
 *
 * Bilingual (AR + EN), brand-aligned, IP-clean — no methodology references.
 */

import { sendEmail } from '../../sender';
import {
  buildBilingualEmail,
  buildLangBlock,
  buildFooterNote,
  resolveDisplayName,
  type Lang,
} from './_shared';

export interface ScholarshipApplicationConfirmationParams {
  to: string;
  recipient_name?: string | null;
  /** Locale of the application — used for both the greeting language priority
   *  AND the dashboard URL inside CTAs. */
  preferred_language?: Lang;
}

function block(lang: Lang, params: ScholarshipApplicationConfirmationParams) {
  const name = resolveDisplayName(params.recipient_name, params.to);
  const isAr = lang === 'ar';

  return buildLangBlock({
    lang,
    greeting: isAr ? `أهلاً ${name}،` : `Hi ${name},`,
    paragraphs: isAr
      ? [
          `استلمنا طلب التقدّم إلى صندوق منح كُن. شكراً على ثقتك ومشاركتك سياقك معنا.`,
          `سنراجع طلبك بعناية خلال الأسابيع القادمة. الفريق يدرس كل طلب فردياً مع مراعاة السياق المالي والاستعداد للرحلة. ستصلك رسالة منّا عند اتخاذ القرار.`,
          `إذا احتجنا توضيحاً إضافياً سنتواصل معك على نفس البريد. لا حاجة لإرسال أي مستندات الآن.`,
        ]
      : [
          `We received your application to the Kun Scholarship Fund. Thank you for trusting us with your context.`,
          `Our team reviews each application individually — considering both the financial situation you described and the readiness signals you shared. You will hear back from us once a decision is reached.`,
          `If we need any clarification, we will reach out to you at this same email. No documents are required at this stage.`,
        ],
    trailing: buildFooterNote(lang),
  });
}

export async function sendScholarshipApplicationConfirmationEmail(
  params: ScholarshipApplicationConfirmationParams,
): Promise<void> {
  if (!params.to) {
    console.warn('[scholarship-application-confirmation] skipped: missing to');
    return;
  }
  const subject =
    params.preferred_language === 'en'
      ? 'Application received — Kun Scholarship Fund'
      : 'استلمنا طلبك — صندوق منح كُن';

  const html = buildBilingualEmail({
    headerTitle: {
      ar: 'استلمنا طلبك',
      en: 'Application Received',
    },
    arBody: block('ar', params),
    enBody: block('en', params),
  });

  await sendEmail({ to: params.to, subject, html });
}
