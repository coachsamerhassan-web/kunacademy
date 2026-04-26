/**
 * sendMembershipDunningPaymentFailedEmail — Wave F.6
 *
 * Sent the first time a recurring charge fails (status flips to past_due).
 * Stripe smart-retry continues attempting the card; this email asks the
 * member to update payment details. We do NOT cut access until smart-retry
 * is exhausted (Stripe sends customer.subscription.deleted then).
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

export interface MembershipDunningPaymentFailedParams {
  to: string;
  recipient_name?: string | null;
  /** ISO timestamp of current_period_end (when access ends if dunning fails). */
  period_end: string | null;
  /** Direct URL to Stripe billing portal or our update-card surface. */
  update_payment_url: string;
  preferred_language?: Lang;
}

function block(lang: Lang, params: MembershipDunningPaymentFailedParams) {
  const name = resolveDisplayName(params.recipient_name, params.to);
  const isAr = lang === 'ar';
  const periodEndFmt = formatDateLong(params.period_end, lang);

  const periodLine = params.period_end
    ? isAr
      ? `إذا لم يكتمل السداد، ستنتهي صلاحية وصولك في ${periodEndFmt}.`
      : `If we can’t collect the payment, your access will end on ${periodEndFmt}.`
    : '';

  return buildLangBlock({
    lang,
    greeting: isAr ? `مرحبًا ${name}،` : `Hi ${name},`,
    paragraphs: isAr
      ? [
          `لم نتمكّن من تحصيل قيمة تجديد عضويّتك من بطاقتك. ستحاول البوابة تلقائيًّا مرّتين خلال الأيام القادمة.`,
          `لتفادي انقطاع الوصول، يرجى تحديث بيانات البطاقة من بوابة الدفع الآمنة.`,
          periodLine,
        ].filter(Boolean)
      : [
          `We were unable to charge your card for the membership renewal. Stripe will automatically retry over the next few days.`,
          `To avoid interrupting access, please update your card details in the secure billing portal.`,
          periodLine,
      ].filter(Boolean),
    cta: {
      label: isAr ? 'تحديث بيانات الدفع' : 'Update payment details',
      href: params.update_payment_url,
    },
    highlightBox: {
      tone: 'warn',
      html: isAr
        ? '🔔 وصولك مستمرٌّ مؤقّتًا حتى تكتمل المحاولات الآليّة.'
        : '🔔 Your access continues during automatic retries.',
    },
    trailing: buildFooterNote(lang),
  });
}

export async function sendMembershipDunningPaymentFailedEmail(
  params: MembershipDunningPaymentFailedParams,
): Promise<void> {
  if (!params.to) {
    console.warn('[membership-dunning-payment-failed] skipped: missing to');
    return;
  }
  const subject =
    params.preferred_language === 'en'
      ? 'Action needed: please update your card — Kun Academy'
      : 'مطلوب: تحديث بيانات بطاقتك — أكاديمية كُن';

  const html = buildBilingualEmail({
    headerTitle: {
      ar: 'تحديث بيانات الدفع',
      en: 'Payment Update Needed',
    },
    arBody: block('ar', params),
    enBody: block('en', params),
  });

  await sendEmail({ to: params.to, subject, html });
}
