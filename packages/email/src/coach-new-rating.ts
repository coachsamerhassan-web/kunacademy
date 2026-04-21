/**
 * Coach New Rating Email — sendCoachNewRatingEmail()
 *
 * Bilingual (AR first, <hr> separator, EN second) email sent to the coach
 * when a client submits a new rating for a completed session.
 *
 * Subject AR: "تلقيت تقييماً جديداً — {stars}⭐"
 * Subject EN: "You received a new rating — {stars}⭐"
 *
 * Template key: 'coach-new-rating'
 * Enqueued by: POST /api/bookings/[id]/rate (fire-and-forget after INSERT)
 *
 * 2026-04-21: privacy column dropped from coach_ratings (never migrated).
 * All new ratings are 'public'. Template still supports 'private' for back-compat
 * with any queued emails that may still set privacy='private', but new emails
 * omit the field and it defaults to 'public'.
 */

import { sendEmail } from './sender';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CoachNewRatingEmailParams {
  /** Coach's display name */
  coach_name: string;
  /** Star rating 1–5 */
  stars: number;
  /** Whether the rating is public or private. Optional — defaults to 'public'
   *  (privacy column was dropped 2026-04-21; retained in template for legacy queued jobs). */
  privacy?: 'public' | 'private';
  /** Review text submitted by the client — may be null/undefined */
  review_text?: string | null;
  /** Controls which language block appears first. Defaults to 'ar'. */
  preferred_language?: 'ar' | 'en';
  /** Base URL for the portal, e.g. https://kuncoaching.me */
  portal_base_url: string;
}

// ── Subject ───────────────────────────────────────────────────────────────────

function buildSubject(locale: 'ar' | 'en', stars: number): string {
  return locale === 'ar'
    ? `تلقيت تقييماً جديداً — ${stars}⭐`
    : `You received a new rating — ${stars}⭐`;
}

// ── Star string helper ────────────────────────────────────────────────────────

function starString(stars: number): string {
  return '⭐'.repeat(Math.min(Math.max(stars, 1), 5));
}

// ── Section builders ──────────────────────────────────────────────────────────

function buildArSection(params: CoachNewRatingEmailParams): string {
  const { coach_name, stars, review_text, portal_base_url } = params;
  const privacy = params.privacy ?? 'public';
  const ratingsUrl = `${portal_base_url}/ar/coach/ratings`;
  const footerNote =
    'هذا البريد أُرسل تلقائياً من أكاديمية كُن. للاستفسار: <a href="mailto:support@kunacademy.com" style="color:#7C73C0;">support@kunacademy.com</a>';

  // Privacy pill
  const privacyLabel = privacy === 'public' ? 'عامة' : 'خاصة';
  const privacyBg    = privacy === 'public' ? '#ECFDF5' : '#FFF8F0';
  const privacyBorder = privacy === 'public' ? '#6EE7B7' : '#F59E0B';
  const privacyColor  = privacy === 'public' ? '#065F46' : '#92400E';

  // Review block
  let reviewBlock = '';
  if (privacy === 'public' && review_text) {
    reviewBlock = `
      <div style="background:#F9F7FF;border-inline-start:4px solid #7C73C0;
                  padding:14px 18px;border-radius:4px;margin-bottom:20px;">
        <p style="margin:0;font-size:14px;color:#333333;line-height:1.8;font-style:italic;">
          "${review_text}"
        </p>
      </div>`;
  } else if (privacy === 'private') {
    reviewBlock = `
      <div style="background:#FFF8F0;border-inline-start:4px solid #F59E0B;
                  padding:14px 18px;border-radius:4px;margin-bottom:20px;">
        <p style="margin:0;font-size:13px;color:#92400E;line-height:1.7;">
          هذا التقييم <strong>خاص</strong> — يظهر لك أنت والمشرفين فقط.
          نص التقييم مخفي بشكل افتراضي؛ راجع صفحة تقييماتك للاطلاع على التفاصيل.
        </p>
      </div>`;
  }

  return `<tr>
    <td style="padding:32px;text-align:right;" dir="rtl">

      <!-- Privacy pill -->
      <div style="display:inline-block;background:${privacyBg};border:1px solid ${privacyBorder};
                  border-radius:20px;padding:5px 16px;margin-bottom:24px;">
        <span style="color:${privacyColor};font-size:13px;font-weight:700;">${privacyLabel}</span>
      </div>

      <!-- Headline -->
      <p style="margin:0 0 16px;font-size:20px;font-weight:700;color:#2D2860;line-height:1.5;">
        مرحباً ${coach_name}،
      </p>

      <!-- Hero sentence -->
      <p style="margin:0 0 20px;font-size:15px;color:#333333;line-height:1.9;">
        تلقيت للتو تقييماً جديداً من أحد عملائك —
        <strong>${starString(stars)} (${stars} من 5)</strong>.
      </p>

      ${reviewBlock}

      <!-- CTA -->
      <div style="text-align:center;margin:0 0 20px;">
        <a href="${ratingsUrl}"
           style="display:inline-block;background:#474099;color:#ffffff;text-decoration:none;
                  padding:14px 36px;border-radius:8px;font-size:15px;font-weight:bold;">
          عرض تقييماتي
        </a>
      </div>

      <p style="margin:0;font-size:12px;color:#999999;border-top:1px solid #eeeeee;
                padding-top:16px;line-height:1.6;">
        ${footerNote}
      </p>
    </td>
  </tr>`;
}

function buildEnSection(params: CoachNewRatingEmailParams): string {
  const { coach_name, stars, review_text, portal_base_url } = params;
  const privacy = params.privacy ?? 'public';
  const ratingsUrl = `${portal_base_url}/en/coach/ratings`;
  const footerNote =
    'This email was sent automatically by Kun Academy. Questions? <a href="mailto:support@kunacademy.com" style="color:#7C73C0;">support@kunacademy.com</a>';

  // Privacy pill
  const privacyLabel  = privacy === 'public' ? 'Public' : 'Private';
  const privacyBg     = privacy === 'public' ? '#ECFDF5' : '#FFF8F0';
  const privacyBorder = privacy === 'public' ? '#6EE7B7' : '#F59E0B';
  const privacyColor  = privacy === 'public' ? '#065F46' : '#92400E';

  // Review block
  let reviewBlock = '';
  if (privacy === 'public' && review_text) {
    reviewBlock = `
      <div style="background:#F9F7FF;border-left:4px solid #7C73C0;
                  padding:14px 18px;border-radius:4px;margin-bottom:20px;">
        <p style="margin:0;font-size:14px;color:#333333;line-height:1.8;font-style:italic;">
          "${review_text}"
        </p>
      </div>`;
  } else if (privacy === 'private') {
    reviewBlock = `
      <div style="background:#FFF8F0;border-left:4px solid #F59E0B;
                  padding:14px 18px;border-radius:4px;margin-bottom:20px;">
        <p style="margin:0;font-size:13px;color:#92400E;line-height:1.7;">
          This rating is <strong>private</strong> — visible only to you and admins.
          Review text is hidden by default; see your ratings page for details.
        </p>
      </div>`;
  }

  return `<tr>
    <td style="padding:32px;text-align:left;" dir="ltr">

      <!-- Privacy pill -->
      <div style="display:inline-block;background:${privacyBg};border:1px solid ${privacyBorder};
                  border-radius:20px;padding:5px 16px;margin-bottom:24px;">
        <span style="color:${privacyColor};font-size:13px;font-weight:700;">${privacyLabel}</span>
      </div>

      <!-- Headline -->
      <p style="margin:0 0 16px;font-size:20px;font-weight:700;color:#2D2860;line-height:1.5;">
        Hi ${coach_name},
      </p>

      <!-- Hero sentence -->
      <p style="margin:0 0 20px;font-size:15px;color:#333333;line-height:1.9;">
        You just received a new rating from a client —
        <strong>${starString(stars)} (${stars} out of 5)</strong>.
      </p>

      ${reviewBlock}

      <!-- CTA -->
      <div style="text-align:center;margin:0 0 20px;">
        <a href="${ratingsUrl}"
           style="display:inline-block;background:#474099;color:#ffffff;text-decoration:none;
                  padding:14px 36px;border-radius:8px;font-size:15px;font-weight:bold;">
          View my ratings
        </a>
      </div>

      <p style="margin:0;font-size:12px;color:#999999;border-top:1px solid #eeeeee;
                padding-top:16px;line-height:1.6;">
        ${footerNote}
      </p>
    </td>
  </tr>`;
}

// ── HTML builder ──────────────────────────────────────────────────────────────

function buildHtml(params: CoachNewRatingEmailParams): string {
  const locale = params.preferred_language ?? 'ar';
  const isAr   = locale === 'ar';
  const dir    = isAr ? 'rtl' : 'ltr';
  const align  = isAr ? 'right' : 'left';
  const font   = isAr ? 'Tahoma,Arial' : 'system-ui,Arial';

  const primarySection   = isAr ? buildArSection(params) : buildEnSection(params);
  const secondarySection = isAr ? buildEnSection(params) : buildArSection(params);

  return `<!DOCTYPE html>
<html lang="${locale}" dir="${dir}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${buildSubject(locale, params.stars)}</title>
</head>
<body style="margin:0;padding:0;background:#f5f3ef;font-family:${font},sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
         style="background:#f5f3ef;padding:32px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0"
               style="background:#ffffff;border-radius:12px;overflow:hidden;max-width:600px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background:#2D2860;padding:28px 32px;text-align:${align};">
              <p style="margin:0 0 4px;color:rgba(255,255,255,0.7);font-size:13px;">
                ${isAr ? 'أكاديمية كُن للكوتشينج' : 'Kun Coaching Academy'}
              </p>
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;line-height:1.4;">
                ${isAr ? 'تقييم جديد ⭐' : 'New Rating ⭐'}
              </h1>
            </td>
          </tr>

          <!-- Primary language section -->
          ${primarySection}

          <!-- Divider between languages -->
          <tr>
            <td style="padding:0 32px;">
              <hr style="border:none;border-top:2px solid #f5f3ef;margin:0;" />
            </td>
          </tr>

          <!-- Secondary language section -->
          ${secondarySection}

          <!-- Footer bar -->
          <tr>
            <td style="background:#2D2860;padding:18px 32px;text-align:center;">
              <p style="margin:0;color:rgba(255,255,255,0.5);font-size:11px;">
                ${isAr ? 'أكاديمية كُن للكوتشينج — kunacademy.com' : 'Kun Coaching Academy — kunacademy.com'}
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Send the coach-new-rating notification to a coach.
 *
 * Template key: 'coach-new-rating'
 * Non-throwing in the rate handler — call inside try/catch and log errors
 * without blocking the 201 response.
 */
export async function sendCoachNewRatingEmail(
  to: string,
  params: CoachNewRatingEmailParams,
): Promise<void> {
  const locale  = params.preferred_language ?? 'ar';
  const subject = buildSubject(locale, params.stars);
  await sendEmail({ to, subject, html: buildHtml(params) });
}
