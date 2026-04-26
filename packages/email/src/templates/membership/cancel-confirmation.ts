/**
 * sendMembershipCancelConfirmationEmail — Wave F.6
 *
 * Sent immediately after a member confirms cancellation. The membership remains
 * active until cancel_at; this email confirms the schedule and surfaces the
 * "resume membership" path.
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

export interface MembershipCancelConfirmationParams {
  to: string;
  recipient_name?: string | null;
  /** ISO timestamp of cancel_at (= current_period_end). */
  cancel_at: string;
  /** Locale of dashboard URL — used to build the resume button path. */
  preferred_language?: Lang;
  /** Full URL to /[locale]/dashboard/membership for the resume button. */
  dashboard_url: string;
}

function block(lang: Lang, params: MembershipCancelConfirmationParams) {
  const name = resolveDisplayName(params.recipient_name, params.to);
  const cancelAtFmt = formatDateLong(params.cancel_at, lang);
  const isAr = lang === 'ar';

  return buildLangBlock({
    lang,
    greeting: isAr ? `مرحبًا ${name}،` : `Hi ${name},`,
    paragraphs: isAr
      ? [
          `استلمنا طلب إلغاء عضويّتك. سنتأكّد ألا نُجدّدها في دورة الفواتير القادمة.`,
          `<strong>سيستمرّ وصولك حتى ${cancelAtFmt}</strong>. حتى ذلك التاريخ كل ما تتضمّنه باقتك متاحٌ لك بالكامل.`,
          `إذا غيّرت رأيك قبل التاريخ المذكور، يمكنك استئناف العضويّة بضغطة واحدة من لوحة التحكم — لن تُخصم عليك أي رسوم إضافيّة.`,
        ]
      : [
          `We received your cancellation request and will not renew your membership at the next billing cycle.`,
          `<strong>Your access continues until ${cancelAtFmt}</strong>. Everything in your tier remains available until then.`,
          `Change your mind? You can resume your membership in one click from your dashboard before that date — no extra charge.`,
      ],
    cta: {
      label: isAr ? 'استئناف العضويّة' : 'Resume membership',
      href: params.dashboard_url,
    },
    trailing: buildFooterNote(lang),
  });
}

export async function sendMembershipCancelConfirmationEmail(
  params: MembershipCancelConfirmationParams,
): Promise<void> {
  if (!params.to) {
    console.warn('[membership-cancel-confirmation] skipped: missing to');
    return;
  }
  const subject =
    params.preferred_language === 'en'
      ? 'Membership cancellation scheduled — Kun Academy'
      : 'تأكيد إلغاء العضويّة — أكاديمية كُن';

  const html = buildBilingualEmail({
    headerTitle: {
      ar: 'تأكيد إلغاء العضويّة',
      en: 'Cancellation Scheduled',
    },
    arBody: block('ar', params),
    enBody: block('en', params),
  });

  await sendEmail({ to: params.to, subject, html });
}
