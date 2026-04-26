/**
 * sendMembershipWinback30DayEmail — Wave F.6
 *
 * Sent ~30 days after a paid membership expires (status='expired'). One-time
 * per membership; idempotency via membership_lifecycle_events(event_type=winback_30d, send_key=membership_id).
 *
 * Includes a single-use 20% return discount code (created by the cron caller via
 * the F.5 admin coupon API) — code passed in as a parameter.
 *
 * Bilingual (AR + EN), brand-aligned, IP-clean.
 *
 * NOTE: callers must skip sending for memberships whose `cancel_reason`
 * contains "no_longer_interested" / "not_interested" (case-insensitive).
 * The filter is enforced upstream — this template trusts its inputs.
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

export interface MembershipWinback30DayParams {
  to: string;
  recipient_name?: string | null;
  /** Discount code (e.g. 'WELCOME-BACK-XXXXXXXX'). */
  coupon_code: string;
  /** Discount value (e.g. 20 for 20%). */
  coupon_pct: number;
  /** ISO timestamp of coupon expiry. */
  coupon_valid_to: string;
  /** Resubscribe URL (Stripe Checkout). */
  resubscribe_url: string;
  preferred_language?: Lang;
}

function block(lang: Lang, params: MembershipWinback30DayParams) {
  const name = resolveDisplayName(params.recipient_name, params.to);
  const isAr = lang === 'ar';
  const validUntilFmt = formatDateLong(params.coupon_valid_to, lang);

  return buildLangBlock({
    lang,
    greeting: isAr ? `مرحبًا ${name}،` : `Hi ${name},`,
    paragraphs: isAr
      ? [
          `مرّ شهرٌ منذ انتهت عضويّتك. اشتقنا إليك.`,
          `لو شعرت بالميل للعودة، لدينا لك خصم ترحيبيٌّ بنسبة <strong>${params.coupon_pct}٪</strong> صالحٌ حتى ${validUntilFmt}.`,
          `استخدم الكود التالي عند الدفع:`,
        ]
      : [
          `It’s been a month since your membership ended. We’ve missed you.`,
          `If you’d like to return, here’s a welcome-back <strong>${params.coupon_pct}% discount</strong>, valid through ${validUntilFmt}.`,
          `Use this code at checkout:`,
      ],
    highlightBox: {
      tone: 'success',
      html: `<div style="text-align:center;font-family:monospace;font-size:18px;font-weight:bold;color:#474099;letter-spacing:1px;">${params.coupon_code}</div>`,
    },
    cta: {
      label: isAr ? 'استئناف العضويّة' : 'Resubscribe',
      href: params.resubscribe_url,
    },
    trailing: buildFooterNote(lang),
  });
}

export async function sendMembershipWinback30DayEmail(
  params: MembershipWinback30DayParams,
): Promise<void> {
  if (!params.to) {
    console.warn('[membership-winback-30-day] skipped: missing to');
    return;
  }
  const subject =
    params.preferred_language === 'en'
      ? `We miss you — ${params.coupon_pct}% off return — Kun Academy`
      : `نشتاق إليك — خصم ${params.coupon_pct}٪ — أكاديمية كُن`;

  const html = buildBilingualEmail({
    headerTitle: {
      ar: 'نشتاق إليك',
      en: 'We Miss You',
    },
    arBody: block('ar', params),
    enBody: block('en', params),
  });

  await sendEmail({ to: params.to, subject, html });
}
