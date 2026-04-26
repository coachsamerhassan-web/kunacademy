/**
 * sendMembershipReactivationConfirmationEmail — Wave F.6
 *
 * Sent when a member who had scheduled cancellation reactivates before
 * cancel_at. Confirms the membership is back on auto-renew.
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

export interface MembershipReactivationConfirmationParams {
  to: string;
  recipient_name?: string | null;
  /** ISO timestamp of next renewal (current_period_end). */
  next_renewal: string | null;
  preferred_language?: Lang;
  dashboard_url: string;
}

function block(lang: Lang, params: MembershipReactivationConfirmationParams) {
  const name = resolveDisplayName(params.recipient_name, params.to);
  const renewalFmt = formatDateLong(params.next_renewal, lang);
  const isAr = lang === 'ar';

  const renewalLine = isAr
    ? params.next_renewal
      ? `سيستمرّ التجديد التلقائي. التجديد القادم: ${renewalFmt}.`
      : `سيستمرّ التجديد التلقائي.`
    : params.next_renewal
      ? `Your membership will auto-renew as scheduled. Next renewal: ${renewalFmt}.`
      : `Your membership will auto-renew as scheduled.`;

  return buildLangBlock({
    lang,
    greeting: isAr ? `مرحبًا ${name}،` : `Hi ${name},`,
    paragraphs: isAr
      ? [
          `تم استئناف عضويّتك. لقد ألغينا طلب الإلغاء، ولا تغيير على باقتك.`,
          renewalLine,
          `يسعدنا استمرارك معنا.`,
        ]
      : [
          `Your membership is back on. We’ve cancelled the pending cancellation — your tier and benefits are unchanged.`,
          renewalLine,
          `Glad to have you continuing with us.`,
        ],
    cta: {
      label: isAr ? 'فتح لوحة التحكم' : 'Open dashboard',
      href: params.dashboard_url,
    },
    trailing: buildFooterNote(lang),
  });
}

export async function sendMembershipReactivationConfirmationEmail(
  params: MembershipReactivationConfirmationParams,
): Promise<void> {
  if (!params.to) {
    console.warn('[membership-reactivation-confirmation] skipped: missing to');
    return;
  }
  const subject =
    params.preferred_language === 'en'
      ? 'Membership resumed — Kun Academy'
      : 'تم استئناف عضويّتك — أكاديمية كُن';

  const html = buildBilingualEmail({
    headerTitle: {
      ar: 'تم استئناف عضويّتك',
      en: 'Membership Resumed',
    },
    arBody: block('ar', params),
    enBody: block('en', params),
  });

  await sendEmail({ to: params.to, subject, html });
}
