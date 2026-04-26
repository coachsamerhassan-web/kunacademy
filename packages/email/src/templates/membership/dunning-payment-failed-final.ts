/**
 * sendMembershipDunningPaymentFailedFinalEmail — Wave F.6
 *
 * Sent when Stripe smart-retry is exhausted and the subscription is deleted.
 * Membership tier reverts to Free; this email surfaces the one-click
 * resubscribe path with dignity-preserving copy.
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

export interface MembershipDunningPaymentFailedFinalParams {
  to: string;
  recipient_name?: string | null;
  /** URL to the resubscribe (Stripe Checkout) flow. */
  resubscribe_url: string;
  preferred_language?: Lang;
}

function block(lang: Lang, params: MembershipDunningPaymentFailedFinalParams) {
  const name = resolveDisplayName(params.recipient_name, params.to);
  const isAr = lang === 'ar';

  return buildLangBlock({
    lang,
    greeting: isAr ? `مرحبًا ${name}،` : `Hi ${name},`,
    paragraphs: isAr
      ? [
          `بعد عدّة محاولات لم نتمكّن من تحصيل قيمة تجديد العضويّة. لذلك انتهت العضويّة المدفوعة، وحُوِّل حسابك إلى الباقة المجانيّة.`,
          `نحفظ كامل تقدّمك وتاريخك. متى أردت العودة، فالباب مفتوح.`,
        ]
      : [
          `After several attempts we couldn’t process your payment, so your paid membership has ended and your account moved to the Free tier.`,
          `Your full progress and history is preserved. Whenever you’re ready, you can come back in one click.`,
      ],
    cta: {
      label: isAr ? 'استئناف العضويّة' : 'Resubscribe',
      href: params.resubscribe_url,
    },
    trailing: buildFooterNote(lang),
  });
}

export async function sendMembershipDunningPaymentFailedFinalEmail(
  params: MembershipDunningPaymentFailedFinalParams,
): Promise<void> {
  if (!params.to) {
    console.warn('[membership-dunning-payment-failed-final] skipped: missing to');
    return;
  }
  const subject =
    params.preferred_language === 'en'
      ? 'Your membership has ended — Kun Academy'
      : 'انتهت عضويّتك — أكاديمية كُن';

  const html = buildBilingualEmail({
    headerTitle: {
      ar: 'انتهت العضويّة',
      en: 'Membership Ended',
    },
    arBody: block('ar', params),
    enBody: block('en', params),
  });

  await sendEmail({ to: params.to, subject, html });
}
