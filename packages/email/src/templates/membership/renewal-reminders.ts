/**
 * Renewal reminder emails — Wave F.6
 *
 * Three variants per F-W6 cadence:
 *   - Annual T-7: 7 days before annual renewal
 *   - Annual T-1: 1 day before annual renewal
 *   - Monthly T-1: 1 day before monthly renewal
 *
 * Cadence locked in DECISIONS-LEDGER (d-canon-phase2-fw6).
 *
 * Bilingual (AR + EN), brand-aligned, IP-clean.
 */

import { sendEmail } from '../../sender';
import {
  buildBilingualEmail,
  buildLangBlock,
  buildFooterNote,
  formatDateLong,
  formatMoneyMinor,
  resolveDisplayName,
  type Lang,
} from './_shared';

export type RenewalCadence = 'annual_t7' | 'annual_t1' | 'monthly_t1';

export interface MembershipRenewalReminderParams {
  to: string;
  recipient_name?: string | null;
  /** Renewal date (current_period_end). */
  renewal_date: string;
  /** Renewal amount in minor units (e.g. 1500 for AED 15.00). */
  renewal_amount_minor: number;
  /** Currency code (e.g. 'AED'). */
  currency: string;
  /** Direct URL to membership dashboard for cancel/manage. */
  dashboard_url: string;
  /** Cadence determines copy + subject. */
  cadence: RenewalCadence;
  preferred_language?: Lang;
}

function copyForCadence(lang: Lang, cadence: RenewalCadence) {
  const isAr = lang === 'ar';
  switch (cadence) {
    case 'annual_t7':
      return {
        title: isAr ? 'تجديد العضويّة السنويّة قريبًا' : 'Annual renewal coming up',
        subject: isAr ? 'تذكير بتجديد العضويّة بعد ٧ أيام — أكاديمية كُن' : 'Annual renewal in 7 days — Kun Academy',
        intro: isAr
          ? 'نُعلمك مسبقًا بأنّ عضويّتك السنويّة ستُجدَّد آليًّا بعد سبعة أيّام.'
          : 'A heads-up: your annual membership will auto-renew in 7 days.',
        ctaCancel: isAr
          ? 'إذا كنت لا ترغب في التجديد، يمكنك الإلغاء بسهولة من لوحة التحكّم — وسيستمرّ وصولك حتى نهاية فترتك المدفوعة الحاليّة.'
          : 'If you’d prefer not to renew, you can cancel from your dashboard — your access continues through the end of your current paid period.',
      };
    case 'annual_t1':
      return {
        title: isAr ? 'سيُجدَّد اشتراكك غدًا' : 'Renews tomorrow',
        subject: isAr ? 'تجديد العضويّة غدًا — أكاديمية كُن' : 'Annual renewal tomorrow — Kun Academy',
        intro: isAr
          ? 'تذكير ودّيّ: ستُجدَّد عضويّتك السنويّة غدًا.'
          : 'Friendly reminder: your annual membership renews tomorrow.',
        ctaCancel: isAr
          ? 'إن أردت إيقاف التجديد، الزر أدناه ينقلك مباشرة إلى لوحة التحكّم.'
          : 'If you’d like to stop the renewal, the button below takes you directly to your dashboard.',
      };
    case 'monthly_t1':
      return {
        title: isAr ? 'سيُجدَّد اشتراكك غدًا' : 'Monthly renewal tomorrow',
        subject: isAr ? 'تجديد العضويّة الشهريّة غدًا — أكاديمية كُن' : 'Monthly renewal tomorrow — Kun Academy',
        intro: isAr
          ? 'تذكير ودّيّ: ستُجدَّد عضويّتك الشهريّة غدًا.'
          : 'Friendly reminder: your monthly membership renews tomorrow.',
        ctaCancel: isAr
          ? 'يمكنك إدارة عضويّتك أو إيقاف التجديد من لوحة التحكّم في أي وقت.'
          : 'You can manage your membership or stop renewal from your dashboard any time.',
      };
  }
}

function block(lang: Lang, params: MembershipRenewalReminderParams) {
  const name = resolveDisplayName(params.recipient_name, params.to);
  const isAr = lang === 'ar';
  const renewalFmt = formatDateLong(params.renewal_date, lang);
  const amountFmt = formatMoneyMinor(params.renewal_amount_minor, params.currency, lang);
  const c = copyForCadence(lang, params.cadence);

  return buildLangBlock({
    lang,
    greeting: isAr ? `مرحبًا ${name}،` : `Hi ${name},`,
    paragraphs: [
      c.intro,
      isAr ? `تاريخ التجديد: <strong>${renewalFmt}</strong>` : `Renewal date: <strong>${renewalFmt}</strong>`,
      isAr ? `المبلغ: <strong>${amountFmt}</strong>` : `Amount: <strong>${amountFmt}</strong>`,
      c.ctaCancel,
    ],
    cta: {
      label: isAr ? 'فتح لوحة التحكم' : 'Open dashboard',
      href: params.dashboard_url,
    },
    trailing: buildFooterNote(lang),
  });
}

export async function sendMembershipRenewalReminderEmail(
  params: MembershipRenewalReminderParams,
): Promise<void> {
  if (!params.to) {
    console.warn('[membership-renewal-reminder] skipped: missing to');
    return;
  }
  const lang: Lang = params.preferred_language === 'en' ? 'en' : 'ar';
  const c = copyForCadence(lang, params.cadence);

  const html = buildBilingualEmail({
    headerTitle: {
      ar: copyForCadence('ar', params.cadence).title,
      en: copyForCadence('en', params.cadence).title,
    },
    arBody: block('ar', params),
    enBody: block('en', params),
  });

  await sendEmail({ to: params.to, subject: c.subject, html });
}
