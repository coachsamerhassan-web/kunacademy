/**
 * sendMembershipDunningBackInGoodStandingEmail — Wave F.6
 *
 * Sent when invoice.payment_succeeded fires after a past_due flip — i.e.,
 * the dunning retry worked and the membership is healthy again.
 *
 * Bilingual (AR + EN), brand-aligned, IP-clean.
 */

import { sendEmail } from '../../sender';
import {
  buildBilingualEmail,
  buildLangBlock,
  buildFooterNote,
  formatDateLong,
  resolveDisplayName,
  type Lang,
} from './_shared';

export interface MembershipDunningBackInGoodStandingParams {
  to: string;
  recipient_name?: string | null;
  /** Renewal date for the new period. */
  next_renewal: string | null;
  preferred_language?: Lang;
  dashboard_url: string;
}

function block(lang: Lang, params: MembershipDunningBackInGoodStandingParams) {
  const name = resolveDisplayName(params.recipient_name, params.to);
  const isAr = lang === 'ar';
  const renewalFmt = formatDateLong(params.next_renewal, lang);

  return buildLangBlock({
    lang,
    greeting: isAr ? `مرحبًا ${name}،` : `Hi ${name},`,
    paragraphs: isAr
      ? [
          `تم تحصيل قيمة التجديد بنجاح، وعادت عضويّتك إلى وضعها الطبيعي. شكرًا لصبرك.`,
          params.next_renewal ? `التجديد القادم: ${renewalFmt}.` : '',
        ].filter(Boolean)
      : [
          `Your payment went through successfully and your membership is back in good standing. Thanks for your patience.`,
          params.next_renewal ? `Next renewal: ${renewalFmt}.` : '',
      ].filter(Boolean),
    highlightBox: {
      tone: 'success',
      html: isAr ? '✓ وصولك مستمرٌّ بلا انقطاع.' : '✓ Your access continues without interruption.',
    },
    cta: {
      label: isAr ? 'فتح لوحة التحكم' : 'Open dashboard',
      href: params.dashboard_url,
    },
    trailing: buildFooterNote(lang),
  });
}

export async function sendMembershipDunningBackInGoodStandingEmail(
  params: MembershipDunningBackInGoodStandingParams,
): Promise<void> {
  if (!params.to) {
    console.warn('[membership-dunning-back-in-good-standing] skipped: missing to');
    return;
  }
  const subject =
    params.preferred_language === 'en'
      ? 'You’re back in good standing — Kun Academy'
      : 'عاد كل شيء إلى طبيعته — أكاديمية كُن';

  const html = buildBilingualEmail({
    headerTitle: {
      ar: 'استؤنفت العضويّة',
      en: 'Back in Good Standing',
    },
    arBody: block('ar', params),
    enBody: block('en', params),
  });

  await sendEmail({ to: params.to, subject, html });
}
