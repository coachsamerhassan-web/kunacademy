/**
 * sendScholarshipAdminNotificationEmail — Wave E.5
 *
 * Internal alert sent to the admin distribution list when a new public
 * application lands in the queue. Contains identifying info for the admin
 * but NO methodology references and NO scoring details — just lands a
 * pointer to the admin queue.
 *
 * NOT sent to the applicant.
 */

import { sendEmail } from '../../sender';
import {
  buildBilingualEmail,
  buildLangBlock,
  buildFooterNote,
} from './_shared';

export interface ScholarshipAdminNotificationParams {
  /** Comma-separated admin email list (or single admin email). */
  to: string;
  /** Applicant display name (truncated/safe). */
  applicant_name: string;
  /** Applicant email (for traceability — not for outreach from this email). */
  applicant_email: string;
  /** Program slug requested. */
  program_slug: string;
  /** Tier requested ('partial' or 'full'). */
  scholarship_tier: 'partial' | 'full';
  /** Full URL to the admin queue detail page. */
  admin_queue_url: string;
}

export async function sendScholarshipAdminNotificationEmail(
  params: ScholarshipAdminNotificationParams,
): Promise<void> {
  if (!params.to) {
    console.warn('[scholarship-admin-notification] skipped: missing to');
    return;
  }

  const arBody = buildLangBlock({
    lang: 'ar',
    greeting: `طلب منحة جديد`,
    paragraphs: [
      `وصل طلب جديد لصندوق منح كُن.`,
      `<strong>المتقدّم:</strong> ${params.applicant_name}<br/>`
        + `<strong>البريد:</strong> ${params.applicant_email}<br/>`
        + `<strong>البرنامج:</strong> ${params.program_slug}<br/>`
        + `<strong>المسار:</strong> ${params.scholarship_tier === 'full' ? 'كامل' : 'جزئي'}`,
    ],
    cta: {
      label: 'مراجعة الطلب',
      href: params.admin_queue_url,
    },
    trailing: buildFooterNote('ar'),
  });

  const enBody = buildLangBlock({
    lang: 'en',
    greeting: `New scholarship application`,
    paragraphs: [
      `A new application landed in the Kun Scholarship Fund queue.`,
      `<strong>Applicant:</strong> ${params.applicant_name}<br/>`
        + `<strong>Email:</strong> ${params.applicant_email}<br/>`
        + `<strong>Program:</strong> ${params.program_slug}<br/>`
        + `<strong>Tier:</strong> ${params.scholarship_tier}`,
    ],
    cta: {
      label: 'Review application',
      href: params.admin_queue_url,
    },
    trailing: buildFooterNote('en'),
  });

  const html = buildBilingualEmail({
    headerTitle: {
      ar: 'طلب جديد في الانتظار',
      en: 'New application pending',
    },
    arBody,
    enBody,
  });

  await sendEmail({
    to: params.to,
    subject: '[Kun Fund] New scholarship application pending review',
    html,
  });
}
