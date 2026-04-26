/**
 * sendMembershipCancelEffectiveEmail — Wave F.6
 *
 * Sent by the grace-sweep cron at the moment a paid membership transitions
 * from "scheduled to cancel" → expired (tier reverts to Free). Dignity-framed
 * with a one-click resubscribe path.
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

export interface MembershipCancelEffectiveParams {
  to: string;
  recipient_name?: string | null;
  /** Full URL to /[locale]/membership for the resubscribe button. */
  resubscribe_url: string;
  preferred_language?: Lang;
}

function block(lang: Lang, params: MembershipCancelEffectiveParams) {
  const name = resolveDisplayName(params.recipient_name, params.to);
  const isAr = lang === 'ar';

  return buildLangBlock({
    lang,
    greeting: isAr ? `مرحبًا ${name}،` : `Hi ${name},`,
    paragraphs: isAr
      ? [
          `انتهت فترة عضويّتك المدفوعة، وحُوِّل حسابك إلى الباقة المجانيّة. نشكرك على وقتك معنا.`,
          `يبقى لك الوصول إلى محتوى الباقة المجانيّة، ونحفظ لك تقدّمك ومحادثاتك ومحتواك السابق.`,
          `متى أردت العودة، نحن هنا. باقتك في انتظارك.`,
        ]
      : [
          `Your paid membership period has ended, and your account has been moved to the Free tier. Thank you for the time you spent with us.`,
          `You still have access to Free-tier content, and we’ve preserved your progress, conversations, and prior content.`,
          `When you’re ready to return, we’re here. Your tier is waiting.`,
        ],
    cta: {
      label: isAr ? 'الانضمام مجدّدًا' : 'Resubscribe',
      href: params.resubscribe_url,
    },
    trailing: buildFooterNote(lang),
  });
}

export async function sendMembershipCancelEffectiveEmail(
  params: MembershipCancelEffectiveParams,
): Promise<void> {
  if (!params.to) {
    console.warn('[membership-cancel-effective] skipped: missing to');
    return;
  }
  const subject =
    params.preferred_language === 'en'
      ? 'Your membership has ended — Kun Academy'
      : 'انتهت عضويّتك — أكاديمية كُن';

  const html = buildBilingualEmail({
    headerTitle: {
      ar: 'انتهت عضويّتك',
      en: 'Membership Ended',
    },
    arBody: block('ar', params),
    enBody: block('en', params),
  });

  await sendEmail({ to: params.to, subject, html });
}
