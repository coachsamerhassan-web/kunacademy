/**
 * sendScholarshipApplicationApprovedEmail — Wave E.5
 *
 * Sent when admin approves an application. Dignity-framed, mentions next
 * steps in general terms only — NO methodology, NO program session
 * structure, NO exercise prompts.
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

export interface ScholarshipApplicationApprovedParams {
  to: string;
  recipient_name?: string | null;
  /** Display title of the program (canon AR or EN). */
  program_title: string;
  /** Tier — 'partial' or 'full'. */
  scholarship_tier: 'partial' | 'full';
  /** Locale of the email + dashboard link. */
  preferred_language?: Lang;
  /** Optional CTA URL to the next-step landing (program page or apply-step). */
  next_step_url?: string | null;
}

function block(lang: Lang, params: ScholarshipApplicationApprovedParams) {
  const name = resolveDisplayName(params.recipient_name, params.to);
  const isAr = lang === 'ar';
  const tierWord = isAr
    ? params.scholarship_tier === 'full' ? 'كامل' : 'جزئي'
    : params.scholarship_tier === 'full' ? 'full' : 'partial';

  return buildLangBlock({
    lang,
    greeting: isAr ? `مبروك ${name}،` : `Congratulations, ${name},`,
    paragraphs: isAr
      ? [
          `يسعدنا إخبارك بأن طلبك للحصول على منحة <strong>${tierWord}ة</strong> في برنامج <strong>${params.program_title}</strong> قد تمت الموافقة عليه.`,
          `سيتواصل معك فريق كُن قريباً لإعطائك تفاصيل التسجيل والخطوات التالية للانضمام إلى أقرب دفعة متاحة.`,
          `نتطلّع لرؤيتك في الرحلة. كما نُذكّرك بالتزامك المتبادل: الحضور، التطبيق بين الجلسات، ومشاركة قصتك بعد التخرج لمساعدة من سيأتون بعدك.`,
        ]
      : [
          `We are glad to let you know that your application for a <strong>${tierWord}</strong> scholarship in <strong>${params.program_title}</strong> has been approved.`,
          `The Kun team will reach out shortly with registration details and next steps for joining the upcoming cohort.`,
          `We look forward to seeing you on the journey. As a reminder of your mutual commitment: attendance, between-session practice, and sharing your story after graduation to help future applicants.`,
        ],
    cta: params.next_step_url
      ? {
          label: isAr ? 'الخطوات التالية' : 'Next steps',
          href: params.next_step_url,
        }
      : undefined,
    trailing: buildFooterNote(lang),
  });
}

export async function sendScholarshipApplicationApprovedEmail(
  params: ScholarshipApplicationApprovedParams,
): Promise<void> {
  if (!params.to) {
    console.warn('[scholarship-application-approved] skipped: missing to');
    return;
  }
  const subject =
    params.preferred_language === 'en'
      ? `Your application has been approved — ${params.program_title}`
      : `تمت الموافقة على طلبك — ${params.program_title}`;

  const html = buildBilingualEmail({
    headerTitle: {
      ar: 'تمت الموافقة',
      en: 'Application Approved',
    },
    arBody: block('ar', params),
    enBody: block('en', params),
  });

  await sendEmail({ to: params.to, subject, html });
}
