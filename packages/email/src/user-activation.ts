/**
 * User Activation Email — sendUserActivationEmail()
 *
 * Sent when an admin creates a user through /admin/users (or re-sends an
 * activation link via the per-user "Send activation" button). Mirrors the
 * password-reset template structurally so both render consistently in clients;
 * copy is adapted for a first-login/invite flow.
 *
 * Reuses the password-reset-confirm endpoint (`/auth/reset-password/confirm`)
 * because "set initial password" and "reset existing password" are the same
 * server-side operation — update auth_users.password_hash by verified email.
 *
 * Template key: 'user-activation'
 * Enqueued by: POST /api/admin/users, POST /api/admin/users/[id]/send-activation
 * Subject AR: "مرحباً بك في كُن — فعّل حسابك"
 * Subject EN: "Welcome to Kun — activate your account"
 */

import { sendEmail } from './sender';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface UserActivationEmailParams {
  /** Recipient email */
  email: string;
  /** Display name (AR or EN, whichever was set first at create time) */
  name?: string;
  /** Full signed activation URL — expires in 7 days */
  activation_url: string;
  /** Role the admin assigned at create time — shown in body for clarity */
  role: string;
  /** Controls which language block is shown first. Defaults to 'ar'. */
  preferred_language?: 'ar' | 'en';
}

// ── Subject ───────────────────────────────────────────────────────────────────

function buildSubject(locale: 'ar' | 'en'): string {
  return locale === 'ar'
    ? 'مرحباً بك في كُن — فعّل حسابك'
    : 'Welcome to Kun — activate your account';
}

// ── Role labels (bilingual) ───────────────────────────────────────────────────

const ROLE_LABELS_AR: Record<string, string> = {
  student:     'طالب',
  provider:    'كوتش',
  mentor:      'منتور',
  apprentice:  'مرشَّح',
  assessor:    'مُقيِّم',
  admin:       'مسؤول',
  super_admin: 'مسؤول عام',
};

const ROLE_LABELS_EN: Record<string, string> = {
  student:     'Student',
  provider:    'Coach',
  mentor:      'Mentor',
  apprentice:  'Apprentice',
  assessor:    'Assessor',
  admin:       'Admin',
  super_admin: 'Super Admin',
};

function roleLabel(role: string, locale: 'ar' | 'en'): string {
  return (locale === 'ar' ? ROLE_LABELS_AR : ROLE_LABELS_EN)[role] ?? role;
}

// ── Section builders ──────────────────────────────────────────────────────────

function buildArSection(params: UserActivationEmailParams): string {
  const greeting = params.name ? `مرحباً ${params.name}،` : 'مرحباً،';
  return `<tr>
    <td style="padding:32px;text-align:right;" dir="rtl">
      <p style="margin:0 0 16px;font-size:20px;font-weight:700;color:#2D2860;line-height:1.5;">
        ${greeting}
      </p>
      <p style="margin:0 0 20px;font-size:15px;color:#333333;line-height:1.9;">
        تم إنشاء حساب لك في <strong>أكاديمية كُن</strong> بصفة
        <strong>${roleLabel(params.role, 'ar')}</strong>.
        لإكمال التفعيل وتعيين كلمة السر، اضغط على الزر أدناه.
        <br/><strong>الرابط صالح لمدة 7 أيام.</strong>
      </p>

      <div style="text-align:center;margin:0 0 20px;">
        <a href="${params.activation_url}"
           style="display:inline-block;background:#474099;color:#ffffff;text-decoration:none;
                  padding:14px 36px;border-radius:8px;font-size:15px;font-weight:bold;">
          تفعيل الحساب
        </a>
      </div>

      <p style="margin:0 0 8px;font-size:13px;color:#555555;line-height:1.7;">
        إن لم يعمل الزر، انسخ الرابط التالي والصقه في متصفحك:
      </p>
      <p style="margin:0 0 20px;font-size:12px;color:#7C73C0;word-break:break-all;line-height:1.6;">
        ${params.activation_url}
      </p>

      <p style="margin:24px 0 0;font-size:12px;color:#999999;border-top:1px solid #eeeeee;
                padding-top:16px;line-height:1.6;">
        أُرسل هذا البريد من أكاديمية كُن. إن لم يكن الحساب مخصصاً لك، تجاهل الرسالة.
        للاستفسار: <a href="mailto:support@kunacademy.com" style="color:#7C73C0;">support@kunacademy.com</a>
      </p>
    </td>
  </tr>`;
}

function buildEnSection(params: UserActivationEmailParams): string {
  const greeting = params.name ? `Hello ${params.name},` : 'Hello,';
  return `<tr>
    <td style="padding:32px;text-align:left;" dir="ltr">
      <p style="margin:0 0 16px;font-size:20px;font-weight:700;color:#2D2860;line-height:1.5;">
        ${greeting}
      </p>
      <p style="margin:0 0 20px;font-size:15px;color:#333333;line-height:1.9;">
        An account has been created for you at <strong>Kun Coaching Academy</strong>
        as <strong>${roleLabel(params.role, 'en')}</strong>.
        Click the button below to set your password and complete activation.
        <br/><strong>This link expires in 7 days.</strong>
      </p>

      <div style="text-align:center;margin:0 0 20px;">
        <a href="${params.activation_url}"
           style="display:inline-block;background:#474099;color:#ffffff;text-decoration:none;
                  padding:14px 36px;border-radius:8px;font-size:15px;font-weight:bold;">
          Activate Account
        </a>
      </div>

      <p style="margin:0 0 8px;font-size:13px;color:#555555;line-height:1.7;">
        If the button does not work, copy and paste this link into your browser:
      </p>
      <p style="margin:0 0 20px;font-size:12px;color:#7C73C0;word-break:break-all;line-height:1.6;">
        ${params.activation_url}
      </p>

      <p style="margin:24px 0 0;font-size:12px;color:#999999;border-top:1px solid #eeeeee;
                padding-top:16px;line-height:1.6;">
        This email was sent by Kun Coaching Academy. If this account is not for you, ignore this
        message. Questions? <a href="mailto:support@kunacademy.com" style="color:#7C73C0;">support@kunacademy.com</a>
      </p>
    </td>
  </tr>`;
}

// ── HTML builder ──────────────────────────────────────────────────────────────

function buildHtml(params: UserActivationEmailParams): string {
  const locale = params.preferred_language ?? 'ar';
  const isAr   = locale === 'ar';
  const dir    = isAr ? 'rtl' : 'ltr';
  const align  = isAr ? 'right' : 'left';
  const font   = isAr ? 'Tahoma,Arial' : 'system-ui,Arial';

  const primary   = isAr ? buildArSection(params) : buildEnSection(params);
  const secondary = isAr ? buildEnSection(params) : buildArSection(params);

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
          <tr>
            <td style="background:#2D2860;padding:28px 32px;text-align:${align};">
              <p style="margin:0 0 4px;color:rgba(255,255,255,0.7);font-size:13px;">
                ${isAr ? 'أكاديمية كُن للكوتشينج' : 'Kun Coaching Academy'}
              </p>
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;line-height:1.4;">
                ${isAr ? 'مرحباً بك' : 'Welcome'}
              </h1>
            </td>
          </tr>
          ${primary}
          <tr>
            <td style="padding:0 32px;">
              <hr style="border:none;border-top:2px solid #f5f3ef;margin:0;" />
            </td>
          </tr>
          ${secondary}
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

export async function sendUserActivationEmail(
  to: string,
  params: UserActivationEmailParams,
): Promise<void> {
  const locale = params.preferred_language ?? 'ar';
  const subject = buildSubject(locale);
  await sendEmail({ to, subject, html: buildHtml(params) });
}
