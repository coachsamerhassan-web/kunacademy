/**
 * @kunacademy/email — Wave E.5 scholarship email templates / shared helpers.
 *
 * Bilingual envelope same as membership/_shared.ts but:
 *   - Different brand subtitle wording specific to the scholarship fund
 *   - Strict dignity-framing — methodology-clean copy enforced by lint hook
 *
 * IP-clean: NO methodology references, NO scoring, NO interview structure.
 * Per dispatch §"IP protection": copy describes philosophy + impressions only.
 */

export type Lang = 'ar' | 'en';

/** Brand palette + styling consistent with membership templates. */
export const BRAND = {
  primary: '#474099',
  primaryDark: '#2D2860',
  background: '#f5f3ef',
  cardBackground: '#ffffff',
  textBody: '#333333',
  textMuted: '#555555',
  textDim: '#999999',
  accentGreen: '#ECFDF5',
  accentGreenBorder: '#6EE7B7',
  accentGreenText: '#065F46',
  accentBlue: '#EFF6FF',
  accentBlueBorder: '#BFDBFE',
  accentBlueText: '#1E40AF',
  accentAmber: '#FEF3C7',
  accentAmberBorder: '#FCD34D',
  accentAmberText: '#92400E',
  accentRed: '#FEE2E2',
  accentRedBorder: '#FCA5A5',
  accentRedText: '#991B1B',
} as const;

/** Standard footer note (bilingual). */
export function buildFooterNote(lang: Lang): string {
  return lang === 'ar'
    ? 'هذا البريد أُرسل تلقائياً من أكاديمية كُن. للاستفسار: <a href="mailto:support@kunacademy.com" style="color:#7C73C0;">support@kunacademy.com</a>'
    : 'This email was sent automatically by Kun Academy. Questions? <a href="mailto:support@kunacademy.com" style="color:#7C73C0;">support@kunacademy.com</a>';
}

/** Format ISO date in locale-appropriate long form. */
export function formatDateLong(iso: string | null | undefined, lang: Lang): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString(lang === 'ar' ? 'ar-AE' : 'en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

/** Escape HTML special characters. */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/** Resolve display name with safe fallback. */
export function resolveDisplayName(
  recipient_name: string | null | undefined,
  to: string,
): string {
  if (recipient_name && recipient_name.trim().length > 0) return recipient_name.trim();
  const local = (to || '').split('@')[0];
  return local || (to || '');
}

interface EnvelopeOpts {
  /** Plain-text title for the colored header bar. */
  headerTitle: { ar: string; en: string };
  /** Plain-text Kun Academy subtitle (default: "Kun Coaching Academy"). */
  brandSubtitle?: { ar: string; en: string };
  /** AR + EN body content (full HTML for each language block). */
  arBody: string;
  enBody: string;
}

/**
 * Build a complete bilingual email document (HTML).
 * Mirrors membership/_shared.buildBilingualEmail so brand consistency holds.
 */
export function buildBilingualEmail(opts: EnvelopeOpts): string {
  const brandSubtitleAr = opts.brandSubtitle?.ar ?? 'صندوق منح كُن';
  const brandSubtitleEn = opts.brandSubtitle?.en ?? 'Kun Scholarship Fund';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background:${BRAND.background};font-family:system-ui,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
         style="background:${BRAND.background};padding:32px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0"
               style="background:${BRAND.cardBackground};border-radius:12px;overflow:hidden;max-width:600px;width:100%;">
          <!-- Bilingual header (AR/EN side-by-side) -->
          <tr>
            <td style="background:${BRAND.primary};padding:28px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td dir="rtl" style="text-align:right;color:#ffffff;font-family:Tahoma,Arial,sans-serif;">
                    <p style="margin:0 0 4px;color:rgba(255,255,255,0.7);font-size:13px;">${brandSubtitleAr}</p>
                    <h1 style="margin:0;color:#ffffff;font-size:18px;font-weight:700;line-height:1.4;">${opts.headerTitle.ar}</h1>
                  </td>
                  <td dir="ltr" style="text-align:left;color:#ffffff;">
                    <p style="margin:0 0 4px;color:rgba(255,255,255,0.7);font-size:13px;">${brandSubtitleEn}</p>
                    <h1 style="margin:0;color:#ffffff;font-size:18px;font-weight:700;line-height:1.4;">${opts.headerTitle.en}</h1>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Arabic body -->
          ${opts.arBody}

          <!-- Divider -->
          <tr><td style="padding:0 32px;"><hr style="border:none;border-top:1px solid #eeeeee;margin:8px 0 8px 0;" /></td></tr>

          <!-- English body -->
          ${opts.enBody}

          <!-- Footer bar -->
          <tr>
            <td style="background:${BRAND.primaryDark};padding:18px 32px;text-align:center;">
              <p style="margin:0;color:rgba(255,255,255,0.5);font-size:11px;">
                Kun Coaching Academy — kunacademy.com
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

/** Build a single-language body block. dir=rtl|ltr. */
export function buildLangBlock(args: {
  lang: Lang;
  greeting: string;
  paragraphs: string[];
  cta?: { label: string; href: string };
  highlightBox?: { html: string; tone?: 'info' | 'warn' | 'danger' | 'success' };
  trailing?: string;
}): string {
  const { lang, greeting, paragraphs, cta, highlightBox, trailing } = args;
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  const align = lang === 'ar' ? 'right' : 'left';

  const tone = highlightBox?.tone ?? 'info';
  const toneStyle = (() => {
    switch (tone) {
      case 'warn':
        return `background:${BRAND.accentAmber};border:1px solid ${BRAND.accentAmberBorder};color:${BRAND.accentAmberText};`;
      case 'danger':
        return `background:${BRAND.accentRed};border:1px solid ${BRAND.accentRedBorder};color:${BRAND.accentRedText};`;
      case 'success':
        return `background:${BRAND.accentGreen};border:1px solid ${BRAND.accentGreenBorder};color:${BRAND.accentGreenText};`;
      default:
        return `background:${BRAND.accentBlue};border:1px solid ${BRAND.accentBlueBorder};color:${BRAND.accentBlueText};`;
    }
  })();

  const ctaHtml = cta
    ? `<div style="text-align:center;margin-bottom:24px;">
        <a href="${cta.href}"
           style="display:inline-block;background:${BRAND.primary};color:#ffffff;text-decoration:none;
                  padding:14px 32px;border-radius:8px;font-size:15px;font-weight:bold;">
          ${cta.label}
        </a>
      </div>`
    : '';

  const highlightHtml = highlightBox
    ? `<div style="${toneStyle}border-radius:8px;padding:14px 18px;margin-bottom:18px;font-size:14px;line-height:1.7;">${highlightBox.html}</div>`
    : '';

  const paraHtml = paragraphs
    .map(
      (p) =>
        `<p style="margin:0 0 16px;font-size:15px;color:${BRAND.textBody};line-height:1.8;">${p}</p>`,
    )
    .join('\n');

  return `<tr>
    <td style="padding:24px 32px;text-align:${align};" dir="${dir}">
      <p style="margin:0 0 14px;font-size:16px;color:${BRAND.textBody};font-weight:600;line-height:1.6;">${greeting}</p>
      ${paraHtml}
      ${highlightHtml}
      ${ctaHtml}
      ${trailing ? `<p style="margin:0;font-size:12px;color:${BRAND.textDim};line-height:1.6;">${trailing}</p>` : ''}
    </td>
  </tr>`;
}
