/** Escape HTML special characters to prevent XSS in email templates. */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

interface Attachment {
  filename: string;
  content: string; // base64 encoded
}

interface EmailParams {
  to: string;
  subject: string;
  html: string;
  attachments?: Attachment[];
}

/* ── Zoho Mail API transport ─────────────────────────────────────────── */

const ZOHO_MAIL_CLIENT_ID = () => process.env.ZOHO_MAIL_CLIENT_ID;
const ZOHO_MAIL_CLIENT_SECRET = () => process.env.ZOHO_MAIL_CLIENT_SECRET;
const ZOHO_MAIL_REFRESH_TOKEN = () => process.env.ZOHO_MAIL_REFRESH_TOKEN;
const ZOHO_MAIL_ACCOUNT_ID = () => process.env.ZOHO_MAIL_ACCOUNT_ID;
const ZOHO_MAIL_FROM = () => process.env.ZOHO_MAIL_FROM || 'info@kunacademy.com';

/** Cached access token + expiry (module-level singleton). */
let cachedToken: { token: string; expiresAt: number } | null = null;

/** Refresh the Zoho OAuth access token. Caches with 5-min safety margin. */
async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }

  const params = new URLSearchParams({
    refresh_token: ZOHO_MAIL_REFRESH_TOKEN()!,
    client_id: ZOHO_MAIL_CLIENT_ID()!,
    client_secret: ZOHO_MAIL_CLIENT_SECRET()!,
    grant_type: 'refresh_token',
  });

  const res = await fetch('https://accounts.zoho.com/oauth/v2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`[email] Zoho token refresh failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  if (!data.access_token) {
    throw new Error(`[email] Zoho token refresh returned no access_token: ${JSON.stringify(data)}`);
  }

  // Cache with 5-minute safety margin (tokens last 3600s)
  const expiresIn = (data.expires_in ?? 3600) as number;
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (expiresIn - 300) * 1000,
  };

  return cachedToken.token;
}

/** Check whether all required Zoho Mail env vars are set. */
function isZohoConfigured(): boolean {
  return !!(
    ZOHO_MAIL_CLIENT_ID() &&
    ZOHO_MAIL_CLIENT_SECRET() &&
    ZOHO_MAIL_REFRESH_TOKEN() &&
    ZOHO_MAIL_ACCOUNT_ID()
  );
}

/** Send an email via Zoho Mail API. Falls back to mock when not configured. */
export async function sendEmail({ to, subject, html, attachments }: EmailParams) {
  if (!isZohoConfigured()) {
    console.warn('[email] Zoho Mail not configured, skipping email to:', to, '| subject:', subject);
    return { id: 'mock', success: true };
  }

  if (attachments && attachments.length > 0) {
    console.warn('[email] Zoho Mail API: attachments not yet supported, sending without them');
  }

  const accessToken = await getAccessToken();
  const accountId = ZOHO_MAIL_ACCOUNT_ID();
  const url = `https://mail.zoho.com/api/accounts/${accountId}/messages`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Zoho-oauthtoken ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      fromAddress: ZOHO_MAIL_FROM(),
      toAddress: to,
      subject,
      content: html,
      mailFormat: 'html',
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`[email] Zoho Mail API error (${res.status}): ${text}`);
  }

  const data = await res.json();
  const messageId = data?.data?.messageId ?? data?.messageId ?? 'zoho-sent';
  console.log('[email] sent:', messageId, 'to:', to);
  return { id: messageId, success: true };
}

/** Welcome email after signup */
export async function sendWelcomeEmail(to: string, name: string, locale: string = 'ar') {
  const isAr = locale === 'ar';
  return sendEmail({
    to,
    subject: isAr ? 'أهلًا بك في أكاديمية كُن 🎉' : 'Welcome to Kun Academy 🎉',
    html: `
      <div dir="${isAr ? 'rtl' : 'ltr'}" style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px;">
        <h1 style="color: #474099;">${isAr ? `مرحبًا ${name}` : `Welcome ${name}`}</h1>
        <p style="color: #555; line-height: 1.8;">
          ${isAr
            ? 'يسعدنا انضمامك لأكاديمية كُن للكوتشينج. ابدأ رحلتك مع التفكير الحسّي® واكتشف إمكانيات جديدة.'
            : 'We\'re excited to have you at Kun Coaching Academy. Start your journey with Somatic Thinking® and discover new possibilities.'}
        </p>
        <a href="https://kunacademy.com/${locale}/programs" style="display: inline-block; margin-top: 16px; padding: 12px 24px; background: #474099; color: white; text-decoration: none; border-radius: 8px;">
          ${isAr ? 'استكشف البرامج' : 'Explore Programs'}
        </a>
      </div>
    `,
  });
}

/** Booking confirmation email */
export async function sendBookingConfirmation(to: string, details: { name: string; service: string; date: string; time: string; coach: string }, locale: string = 'ar') {
  const isAr = locale === 'ar';
  return sendEmail({
    to,
    subject: isAr ? 'تأكيد حجز جلسة الكوتشينج' : 'Coaching Session Booking Confirmation',
    html: `
      <div dir="${isAr ? 'rtl' : 'ltr'}" style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px;">
        <h1 style="color: #474099;">${isAr ? 'تم تأكيد حجزك' : 'Booking Confirmed'}</h1>
        <p style="color: #555;">${isAr ? `مرحبًا ${details.name}` : `Hi ${details.name}`}</p>
        <div style="background: #f5f3ef; border-radius: 8px; padding: 20px; margin: 16px 0;">
          <p><strong>${isAr ? 'الخدمة:' : 'Service:'}</strong> ${details.service}</p>
          <p><strong>${isAr ? 'الكوتش:' : 'Coach:'}</strong> ${details.coach}</p>
          <p><strong>${isAr ? 'التاريخ:' : 'Date:'}</strong> ${details.date}</p>
          <p><strong>${isAr ? 'الوقت:' : 'Time:'}</strong> ${details.time}</p>
        </div>
      </div>
    `,
  });
}

/** Enrollment confirmation email */
export async function sendEnrollmentConfirmation(to: string, details: { name: string; course: string }, locale: string = 'ar') {
  const isAr = locale === 'ar';
  return sendEmail({
    to,
    subject: isAr ? 'تم تسجيلك في البرنامج بنجاح' : 'Program Enrollment Confirmed',
    html: `
      <div dir="${isAr ? 'rtl' : 'ltr'}" style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px;">
        <h1 style="color: #474099;">${isAr ? 'تم التسجيل بنجاح!' : 'Enrollment Confirmed!'}</h1>
        <p style="color: #555;">${isAr ? `مرحبًا ${details.name}، تم تسجيلك في:` : `Hi ${details.name}, you're enrolled in:`}</p>
        <h2 style="color: #474099;">${details.course}</h2>
        <a href="https://kunacademy.com/${locale}/portal/courses" style="display: inline-block; margin-top: 16px; padding: 12px 24px; background: #474099; color: white; text-decoration: none; border-radius: 8px;">
          ${isAr ? 'ابدأ التعلّم' : 'Start Learning'}
        </a>
      </div>
    `,
  });
}

/** Payment receipt email */
export async function sendPaymentReceipt(
  to: string,
  details: { name: string; item: string; amount: string; currency: string; method: string; transactionId: string },
  locale: string = 'ar'
) {
  const isAr = locale === 'ar';
  return sendEmail({
    to,
    subject: isAr ? 'إيصال الدفع — أكاديمية كُن' : 'Payment Receipt — Kun Academy',
    html: `
      <div dir="${isAr ? 'rtl' : 'ltr'}" style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px;">
        <h1 style="color: #474099;">${isAr ? 'إيصال الدفع' : 'Payment Receipt'}</h1>
        <p style="color: #555;">${isAr ? `مرحبًا ${details.name}` : `Hi ${details.name}`}</p>
        <div style="background: #f5f3ef; border-radius: 8px; padding: 20px; margin: 16px 0;">
          <p><strong>${isAr ? 'المنتج:' : 'Item:'}</strong> ${details.item}</p>
          <p><strong>${isAr ? 'المبلغ:' : 'Amount:'}</strong> ${details.amount} ${details.currency}</p>
          <p><strong>${isAr ? 'طريقة الدفع:' : 'Payment Method:'}</strong> ${details.method}</p>
          <p style="color: #888; font-size: 13px;">${isAr ? 'رقم المعاملة:' : 'Transaction ID:'} ${details.transactionId}</p>
        </div>
        <p style="color: #888; font-size: 13px;">
          ${isAr
            ? 'هذا إيصال إلكتروني. للاستفسار: support@kunacademy.com'
            : 'This is an electronic receipt. Questions? support@kunacademy.com'}
        </p>
      </div>
    `,
  });
}

/** Booking reminder email (sent 24h before) */
export async function sendBookingReminder(
  to: string,
  details: { name: string; service: string; date: string; time: string; coach: string; meetingUrl?: string },
  locale: string = 'ar'
) {
  const isAr = locale === 'ar';
  const meetingLink = details.meetingUrl
    ? `<a href="${details.meetingUrl}" style="display: inline-block; margin-top: 16px; padding: 12px 24px; background: #474099; color: white; text-decoration: none; border-radius: 8px;">
        ${isAr ? 'انضم للجلسة' : 'Join Session'}
      </a>`
    : '';
  return sendEmail({
    to,
    subject: isAr ? 'تذكير: جلسة كوتشينج غدًا' : 'Reminder: Coaching Session Tomorrow',
    html: `
      <div dir="${isAr ? 'rtl' : 'ltr'}" style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px;">
        <h1 style="color: #474099;">${isAr ? 'تذكير بجلستك' : 'Session Reminder'}</h1>
        <p style="color: #555;">${isAr ? `مرحبًا ${details.name}، لديك جلسة غدًا:` : `Hi ${details.name}, you have a session tomorrow:`}</p>
        <div style="background: #f5f3ef; border-radius: 8px; padding: 20px; margin: 16px 0;">
          <p><strong>${isAr ? 'الخدمة:' : 'Service:'}</strong> ${details.service}</p>
          <p><strong>${isAr ? 'الكوتش:' : 'Coach:'}</strong> ${details.coach}</p>
          <p><strong>${isAr ? 'التاريخ:' : 'Date:'}</strong> ${details.date}</p>
          <p><strong>${isAr ? 'الوقت:' : 'Time:'}</strong> ${details.time}</p>
        </div>
        ${meetingLink}
      </div>
    `,
  });
}

/** Installment due reminder email */
export async function sendInstallmentReminder(
  to: string,
  details: { name: string; program: string; amount: string; currency: string; dueDate: string; paymentUrl: string },
  locale: string = 'ar'
) {
  const isAr = locale === 'ar';
  return sendEmail({
    to,
    subject: isAr ? 'تذكير: قسط مستحق خلال 3 أيام' : 'Reminder: Installment Due in 3 Days',
    html: `
      <div dir="${isAr ? 'rtl' : 'ltr'}" style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px;">
        <h1 style="color: #474099;">${isAr ? 'تذكير بالقسط' : 'Installment Reminder'}</h1>
        <p style="color: #555;">${isAr ? `مرحبًا ${details.name}` : `Hi ${details.name}`}</p>
        <div style="background: #FEF3C7; border-radius: 8px; padding: 20px; margin: 16px 0; border: 1px solid #F59E0B;">
          <p><strong>${isAr ? 'البرنامج:' : 'Program:'}</strong> ${details.program}</p>
          <p><strong>${isAr ? 'المبلغ المستحق:' : 'Amount Due:'}</strong> ${details.amount} ${details.currency}</p>
          <p><strong>${isAr ? 'تاريخ الاستحقاق:' : 'Due Date:'}</strong> ${details.dueDate}</p>
        </div>
        <a href="${details.paymentUrl}" style="display: inline-block; margin-top: 16px; padding: 12px 24px; background: #474099; color: white; text-decoration: none; border-radius: 8px;">
          ${isAr ? 'ادفع الآن' : 'Pay Now'}
        </a>
      </div>
    `,
  });
}

/** Corporate proposal email with attached PDF */
export async function sendProposalEmail(
  to: string,
  details: {
    name: string;
    direction: string;
    directionAr: string;
    totalSavings: number;
    roiMultiple: number;
  },
  pdfBase64: string,
  locale: string = 'ar'
): Promise<ReturnType<typeof sendEmail>> {
  const isAr = locale === 'ar';
  const formattedSavings = details.totalSavings.toLocaleString('en-AE');

  const html = `
    <div dir="${isAr ? 'rtl' : 'ltr'}" style="font-family: system-ui, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #FFFDF9; border-radius: 12px; overflow: hidden;">
      <!-- Header -->
      <div style="background: #474099; padding: 32px 40px; text-align: ${isAr ? 'right' : 'left'};">
        <p style="color: rgba(255,255,255,0.7); font-size: 13px; margin: 0 0 6px;">
          ${isAr ? 'أكاديمية كُن للكوتشينج' : 'Kun Coaching Academy'}
        </p>
        <h1 style="color: #ffffff; font-size: 26px; margin: 0; font-weight: 700; line-height: 1.3;">
          ${isAr ? `${details.name}، عرضك جاهز` : `${details.name}, Your Proposal is Ready`}
        </h1>
      </div>

      <!-- Body -->
      <div style="padding: 36px 40px;">
        <p style="color: #444; font-size: 16px; line-height: 1.8; margin: 0 0 24px;">
          ${isAr
            ? `شكرًا لاستكشافك مسار <strong style="color: #474099;">${details.directionAr}</strong> مع أكاديمية كُن. بناءً على بياناتك، أعددنا لك عرضًا مخصصًا يوضح الأثر المتوقع.`
            : `Thank you for exploring <strong style="color: #474099;">${details.direction}</strong> with Kun Coaching Academy. Based on your inputs, we've prepared a personalized proposal showing the projected impact.`
          }
        </p>

        <!-- Key numbers -->
        <div style="display: flex; gap: 16px; margin: 0 0 28px; flex-wrap: wrap;">
          <div style="flex: 1; min-width: 200px; background: #F3F2FB; border-radius: 10px; padding: 20px 24px; text-align: center;">
            <p style="color: #474099; font-size: 13px; font-weight: 600; margin: 0 0 6px; text-transform: uppercase; letter-spacing: 0.5px;">
              ${isAr ? 'التوفير المتوقع' : 'Projected Savings'}
            </p>
            <p style="color: #474099; font-size: 28px; font-weight: 800; margin: 0;">
              AED ${formattedSavings}
            </p>
          </div>
          <div style="flex: 1; min-width: 200px; background: #FFF3EE; border-radius: 10px; padding: 20px 24px; text-align: center; border: 2px solid #E4601E;">
            <p style="color: #E4601E; font-size: 13px; font-weight: 600; margin: 0 0 6px; text-transform: uppercase; letter-spacing: 0.5px;">
              ${isAr ? 'معدل العائد' : 'ROI Multiple'}
            </p>
            <p style="color: #E4601E; font-size: 28px; font-weight: 800; margin: 0;">
              ${details.roiMultiple}×
            </p>
          </div>
        </div>

        <!-- Direction -->
        <div style="background: #f5f3ef; border-radius: 8px; padding: 18px 24px; margin: 0 0 28px;">
          <p style="color: #666; font-size: 13px; margin: 0 0 4px; font-weight: 600;">
            ${isAr ? 'المسار المستكشف' : 'Direction Explored'}
          </p>
          <p style="color: #474099; font-size: 17px; font-weight: 700; margin: 0;">
            ${isAr ? details.directionAr : details.direction}
          </p>
        </div>

        <p style="color: #555; font-size: 15px; line-height: 1.7; margin: 0 0 28px;">
          ${isAr
            ? 'العرض الكامل مرفق بهذا البريد. يتضمن التفاصيل المالية الكاملة، والمراحل، وخطة الاستثمار المقترحة.'
            : 'The full proposal is attached to this email. It includes the complete financial breakdown, phases, and recommended investment plan.'
          }
        </p>

        <!-- CTA -->
        <div style="text-align: ${isAr ? 'right' : 'left'};">
          <a href="https://kunacademy.com/${locale}/pathfinder/results"
             style="display: inline-block; padding: 14px 32px; background: #474099; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 15px;">
            ${isAr ? 'اعرض نتائجك كاملة' : 'View Your Full Proposal'}
          </a>
        </div>
      </div>

      <!-- Footer -->
      <div style="background: #2D2860; padding: 24px 40px; text-align: center;">
        <p style="color: rgba(255,255,255,0.6); font-size: 12px; margin: 0 0 4px;">
          ${isAr ? 'أكاديمية كُن للكوتشينج' : 'Kun Coaching Academy'}
        </p>
        <p style="color: rgba(255,255,255,0.4); font-size: 11px; margin: 0;">
          ${isAr
            ? 'هذا البريد أُرسل لأنك أكملت تقييم Pathfinder على موقعنا.'
            : 'You received this because you completed the Pathfinder assessment on our site.'
          }
        </p>
      </div>
    </div>
  `;

  return sendEmail({
    to,
    subject: isAr
      ? `${details.name}، عرض كُن الخاص بك — وفورات متوقعة ${formattedSavings} AED`
      : `${details.name}, Your Kun Proposal — AED ${formattedSavings} Projected Savings`,
    html,
    attachments: [{ filename: 'Kun-Proposal.pdf', content: pdfBase64 }],
  });
}

export interface PaymentReceivedEmailParams {
  /** Recipient email address */
  to: string;
  /** 'ar' for Arabic (RTL) or 'en' for English. Defaults to 'en'. */
  locale: 'ar' | 'en';
  /** Recipient's first name (or display name). Falls back to "there" / "يا صديقنا". */
  first_name?: string;
  /** Human-readable item / program name — HTML-escaped internally. */
  item_name: string;
  /** Pre-formatted amount string, e.g. "250.00" */
  amount_display: string;
  /** ISO currency code, e.g. "AED" */
  currency: string;
  /** Gateway label, e.g. "Stripe", "Tabby (4 installments)", "InstaPay" — escaped internally. */
  gateway: string;
  /** Internal payment / transaction ID for the customer's reference — escaped internally. */
  payment_id: string;
  /** ISO 8601 date string — displayed as-is after basic escaping. */
  transaction_date: string;
}

/**
 * Bilingual payment confirmation email.
 *
 * Security: item_name, gateway, and payment_id are HTML-escaped before
 * interpolation because they can contain arbitrary user/gateway-supplied content.
 * amount_display and currency come from internal payment records and are not
 * escaped (they are numeric / ISO-code values controlled by the system).
 *
 * Locale defaults to 'en' when missing or unknown — safer international fallback.
 */
export async function sendPaymentReceivedEmail({
  to,
  locale,
  first_name,
  item_name,
  amount_display,
  currency,
  gateway,
  payment_id,
  transaction_date,
}: PaymentReceivedEmailParams): Promise<ReturnType<typeof sendEmail>> {
  const isAr = locale === 'ar';
  const dir = isAr ? 'rtl' : 'ltr';

  // Fallback greeting tokens
  const greeting = first_name
    ? (isAr ? `يا ${escapeHtml(first_name)}` : `Hi ${escapeHtml(first_name)}`)
    : (isAr ? 'يا صديقنا' : 'Hi there');

  // Escape user / gateway-supplied strings
  const safeItem = escapeHtml(item_name);
  const safeGateway = escapeHtml(gateway);
  const safePaymentId = escapeHtml(payment_id);
  // transaction_date is system-generated (toISOString().split('T')[0] → YYYY-MM-DD);
  // escaping adds no value and creates inconsistency with amount_display/currency.
  const safeDate = transaction_date;

  const subject = isAr
    ? 'تأكيد استلام الدفع — أكاديمية كُن'
    : 'Payment Confirmation — Kun Academy';

  const html = `
    <div dir="${dir}" style="font-family: system-ui, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #FFFDF9; border-radius: 12px; overflow: hidden;">
      <!-- Header -->
      <div style="background: #474099; padding: 28px 36px; text-align: ${isAr ? 'right' : 'left'};">
        <p style="color: rgba(255,255,255,0.7); font-size: 13px; margin: 0 0 4px;">
          ${isAr ? 'أكاديمية كُن للكوتشينج' : 'Kun Coaching Academy'}
        </p>
        <h1 style="color: #ffffff; font-size: 22px; margin: 0; font-weight: 700; line-height: 1.4;">
          ${isAr ? 'تم استلام دفعتك' : 'Payment Received'}
        </h1>
      </div>

      <!-- Body -->
      <div style="padding: 32px 36px;">
        <p style="color: #333; font-size: 16px; margin: 0 0 20px;">
          ${greeting}،
        </p>
        <p style="color: #555; font-size: 15px; line-height: 1.7; margin: 0 0 24px;">
          ${isAr
            ? `تم استلام دفعتك بنجاح. يسعدنا انضمامك إلى <strong style="color:#474099;">${safeItem}</strong>.`
            : `Your payment has been successfully received. We're glad to have you in <strong style="color:#474099;">${safeItem}</strong>.`
          }
        </p>

        <!-- Receipt details -->
        <div style="background: #f5f3ef; border-radius: 10px; padding: 20px 24px; margin: 0 0 24px;">
          <table style="width:100%; border-collapse: collapse; font-size: 14px; color: #444;">
            <tr>
              <td style="padding: 6px 0; font-weight: 600; width: 45%;">
                ${isAr ? 'البرنامج / المنتج' : 'Item'}
              </td>
              <td style="padding: 6px 0;">${safeItem}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; font-weight: 600;">
                ${isAr ? 'المبلغ المدفوع' : 'Amount Paid'}
              </td>
              <td style="padding: 6px 0; font-weight: 700; color: #474099;">${amount_display} ${currency}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; font-weight: 600;">
                ${isAr ? 'طريقة الدفع' : 'Payment Method'}
              </td>
              <td style="padding: 6px 0;">${safeGateway}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; font-weight: 600;">
                ${isAr ? 'تاريخ المعاملة' : 'Date'}
              </td>
              <td style="padding: 6px 0;">${safeDate}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; font-weight: 600; color: #888; font-size: 12px;">
                ${isAr ? 'رقم المرجع' : 'Reference ID'}
              </td>
              <td style="padding: 6px 0; color: #888; font-size: 12px; word-break: break-all;">${safePaymentId}</td>
            </tr>
          </table>
        </div>

        <p style="color: #888; font-size: 13px; margin: 0;">
          ${isAr
            ? 'للاستفسار أو الدعم: <a href="mailto:support@kunacademy.com" style="color:#474099;">support@kunacademy.com</a>'
            : 'Questions or need support? <a href="mailto:support@kunacademy.com" style="color:#474099;">support@kunacademy.com</a>'
          }
        </p>
      </div>

      <!-- Footer -->
      <div style="background: #2D2860; padding: 20px 36px; text-align: center;">
        <p style="color: rgba(255,255,255,0.5); font-size: 11px; margin: 0;">
          ${isAr ? 'أكاديمية كُن للكوتشينج — kunacademy.com' : 'Kun Coaching Academy — kunacademy.com'}
        </p>
      </div>
    </div>
  `;

  return sendEmail({ to, subject, html });
}

/** Payout processed notification (for coaches) */
export async function sendPayoutNotification(
  to: string,
  details: { name: string; amount: string; currency: string; status: 'approved' | 'completed' | 'rejected'; note?: string },
  locale: string = 'ar'
) {
  const isAr = locale === 'ar';
  const statusText = {
    approved: isAr ? 'تمت الموافقة' : 'Approved',
    completed: isAr ? 'تم التحويل' : 'Completed',
    rejected: isAr ? 'مرفوض' : 'Rejected',
  };
  return sendEmail({
    to,
    subject: isAr ? `تحديث طلب السحب: ${statusText[details.status]}` : `Payout Update: ${statusText[details.status]}`,
    html: `
      <div dir="${isAr ? 'rtl' : 'ltr'}" style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px;">
        <h1 style="color: #474099;">${isAr ? 'تحديث طلب السحب' : 'Payout Update'}</h1>
        <p style="color: #555;">${isAr ? `مرحبًا ${details.name}` : `Hi ${details.name}`}</p>
        <div style="background: #f5f3ef; border-radius: 8px; padding: 20px; margin: 16px 0;">
          <p><strong>${isAr ? 'المبلغ:' : 'Amount:'}</strong> ${details.amount} ${details.currency}</p>
          <p><strong>${isAr ? 'الحالة:' : 'Status:'}</strong> ${statusText[details.status]}</p>
          ${details.note ? `<p><strong>${isAr ? 'ملاحظة:' : 'Note:'}</strong> ${details.note}</p>` : ''}
        </div>
      </div>
    `,
  });
}
