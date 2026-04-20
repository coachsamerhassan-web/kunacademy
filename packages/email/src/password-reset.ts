/**
 * Password Reset Email — sendPasswordResetEmail()
 *
 * Bilingual (AR + EN, both in same body with <hr> separator) email sent when a
 * user requests a password reset. The link expires in 1 hour.
 *
 * Subject AR: "إعادة تعيين كلمة السر - كُن أكاديمي"
 * Subject EN: "Reset your password — Kun Academy"
 *
 * Template key: 'password-reset'
 * Enqueued by: POST /api/auth/reset-password
 *
 * Security note:
 * - Always return 200 from the calling route regardless of send success.
 * - The template itself is plain HTML; never include the token outside the URL.
 */

import { sendEmail } from './sender';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PasswordResetEmailParams {
  /** The recipient email (used for personalisation / display) */
  email: string;
  /** Full signed reset URL — expires in 1 hour */
  reset_url: string;
  /** Controls which language block is shown first. Defaults to 'ar'. */
  preferred_language?: 'ar' | 'en';
}

// ── Subject ───────────────────────────────────────────────────────────────────

function buildSubject(locale: 'ar' | 'en'): string {
  return locale === 'ar'
    ? 'إعادة تعيين كلمة السر - كُن أكاديمي'
    : 'Reset your password — Kun Academy';
}

// ── Section builders ──────────────────────────────────────────────────────────

function buildArSection(resetUrl: string): string {
  const footerNote =
    'هذا البريد أُرسل تلقائياً من أكاديمية كُن. إن لم تطلب إعادة التعيين، تجاهل هذا البريد. للاستفسار: <a href="mailto:support@kunacademy.com" style="color:#7C73C0;">support@kunacademy.com</a>';

  return `<tr>
    <td style="padding:32px;text-align:right;" dir="rtl">

      <!-- Headline -->
      <p style="margin:0 0 16px;font-size:20px;font-weight:700;color:#2D2860;line-height:1.5;">
        إعادة تعيين كلمة السر
      </p>

      <!-- Main paragraph -->
      <p style="margin:0 0 20px;font-size:15px;color:#333333;line-height:1.9;">
        تلقّينا طلباً لإعادة تعيين كلمة السر لحسابك في أكاديمية كُن.
        اضغط على الزر أدناه لاختيار كلمة سر جديدة.
        <strong>الرابط صالح لمدة ساعة واحدة فقط.</strong>
      </p>

      <!-- CTA button -->
      <div style="text-align:center;margin:0 0 20px;">
        <a href="${resetUrl}"
           style="display:inline-block;background:#474099;color:#ffffff;text-decoration:none;
                  padding:14px 36px;border-radius:8px;font-size:15px;font-weight:bold;">
          إعادة تعيين كلمة السر
        </a>
      </div>

      <!-- Plain-text fallback -->
      <p style="margin:0 0 8px;font-size:13px;color:#555555;line-height:1.7;">
        إن لم يعمل الزر، انسخ الرابط التالي والصقه في متصفحك:
      </p>
      <p style="margin:0 0 20px;font-size:12px;color:#7C73C0;word-break:break-all;line-height:1.6;">
        ${resetUrl}
      </p>

      <!-- Ignore notice -->
      <p style="margin:0 0 0;font-size:13px;color:#888888;
                background:#FFF8F0;border-inline-start:4px solid #F59E0B;
                padding:12px 16px;border-radius:4px;line-height:1.7;">
        إن لم تكن أنت من طلب إعادة التعيين، تجاهل هذا البريد. حسابك بأمان تام.
      </p>

      <p style="margin:24px 0 0;font-size:12px;color:#999999;border-top:1px solid #eeeeee;
                padding-top:16px;line-height:1.6;">
        ${footerNote}
      </p>
    </td>
  </tr>`;
}

function buildEnSection(resetUrl: string): string {
  const footerNote =
    'This email was sent automatically by Kun Academy. If you did not request a password reset, you can safely ignore it. Questions? <a href="mailto:support@kunacademy.com" style="color:#7C73C0;">support@kunacademy.com</a>';

  return `<tr>
    <td style="padding:32px;text-align:left;" dir="ltr">

      <!-- Headline -->
      <p style="margin:0 0 16px;font-size:20px;font-weight:700;color:#2D2860;line-height:1.5;">
        Reset your password
      </p>

      <!-- Main paragraph -->
      <p style="margin:0 0 20px;font-size:15px;color:#333333;line-height:1.9;">
        We received a request to reset the password for your Kun Academy account.
        Click the button below to choose a new password.
        <strong>This link expires in one hour.</strong>
      </p>

      <!-- CTA button -->
      <div style="text-align:center;margin:0 0 20px;">
        <a href="${resetUrl}"
           style="display:inline-block;background:#474099;color:#ffffff;text-decoration:none;
                  padding:14px 36px;border-radius:8px;font-size:15px;font-weight:bold;">
          Reset Password
        </a>
      </div>

      <!-- Plain-text fallback -->
      <p style="margin:0 0 8px;font-size:13px;color:#555555;line-height:1.7;">
        If the button does not work, copy and paste this link into your browser:
      </p>
      <p style="margin:0 0 20px;font-size:12px;color:#7C73C0;word-break:break-all;line-height:1.6;">
        ${resetUrl}
      </p>

      <!-- Ignore notice -->
      <p style="margin:0 0 0;font-size:13px;color:#888888;
                background:#FFF8F0;border-left:4px solid #F59E0B;
                padding:12px 16px;border-radius:4px;line-height:1.7;">
        If you did not request a password reset, you can safely ignore this email. Your account is secure.
      </p>

      <p style="margin:24px 0 0;font-size:12px;color:#999999;border-top:1px solid #eeeeee;
                padding-top:16px;line-height:1.6;">
        ${footerNote}
      </p>
    </td>
  </tr>`;
}

// ── HTML builder ──────────────────────────────────────────────────────────────

function buildHtml(params: PasswordResetEmailParams): string {
  const locale = params.preferred_language ?? 'ar';
  const isAr   = locale === 'ar';
  const dir    = isAr ? 'rtl' : 'ltr';
  const align  = isAr ? 'right' : 'left';
  const font   = isAr ? 'Tahoma,Arial' : 'system-ui,Arial';

  const primarySection   = isAr ? buildArSection(params.reset_url) : buildEnSection(params.reset_url);
  const secondarySection = isAr ? buildEnSection(params.reset_url) : buildArSection(params.reset_url);

  return `<!DOCTYPE html>
<html lang="${locale}" dir="${dir}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${buildSubject(locale)}</title>
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
                ${isAr ? 'إعادة تعيين كلمة السر' : 'Password Reset'}
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
 * Send the password-reset email to the requesting user.
 *
 * Template key: 'password-reset'
 * Non-throwing in the route handler — call inside try/catch and log errors
 * without blocking the 200 response.
 */
export async function sendPasswordResetEmail(
  to: string,
  params: PasswordResetEmailParams,
): Promise<void> {
  const locale = params.preferred_language ?? 'ar';
  const subject = buildSubject(locale);
  await sendEmail({ to, subject, html: buildHtml(params) });
}
