import { NextResponse, type NextRequest } from 'next/server';
import { sendEmail } from '@kunacademy/email';
import { sendTelegramAlert } from '@kunacademy/email';

// ── Rate limiting (in-memory, per-process) ──────────────────────────
// Map<ip, { count, resetAt }>
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }

  entry.count++;
  if (entry.count > RATE_LIMIT_MAX) return true;
  return false;
}

// Periodic cleanup to prevent unbounded growth (every 10 min)
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap) {
    if (now > entry.resetAt) rateLimitMap.delete(ip);
  }
}, 10 * 60 * 1000);

// ── Validation ──────────────────────────────────────────────────────
const VALID_SUBJECTS = ['programs', 'corporate', 'coaching', 'other'];

function sanitize(str: string): string {
  return str.trim().replace(/<[^>]*>/g, '');
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ── Subject labels for notification ─────────────────────────────────
const SUBJECT_LABELS: Record<string, { ar: string; en: string }> = {
  programs: { ar: 'استفسار عن البرامج', en: 'Program Inquiry' },
  corporate: { ar: 'حلول المؤسسات', en: 'Corporate Solutions' },
  coaching: { ar: 'حجز جلسة كوتشينج', en: 'Book a Coaching Session' },
  other: { ar: 'أخرى', en: 'Other' },
};

// ── POST handler ────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    // Rate limit by IP
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'unknown';

    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: 'Too many submissions. Please try again later.', error_ar: 'لقد أرسلت طلبات كثيرة. يرجى المحاولة لاحقًا.' },
        { status: 429 },
      );
    }

    const body = await request.json();
    const { name, email, phone, subject, message, locale, _hp } = body;

    // Honeypot check — if the hidden field has content, it's a bot
    if (_hp) {
      // Return success to bots so they don't retry
      return NextResponse.json({ success: true });
    }

    // Validate required fields
    if (!name || !email || !subject || !message) {
      return NextResponse.json(
        { error: 'Missing required fields', error_ar: 'يرجى ملء جميع الحقول المطلوبة' },
        { status: 400 },
      );
    }

    const cleanName = sanitize(name);
    const cleanEmail = sanitize(email).toLowerCase();
    const cleanPhone = phone ? sanitize(phone) : '';
    const cleanSubject = sanitize(subject);
    const cleanMessage = sanitize(message);

    if (!isValidEmail(cleanEmail)) {
      return NextResponse.json(
        { error: 'Invalid email address', error_ar: 'البريد الإلكتروني غير صالح' },
        { status: 400 },
      );
    }

    if (!VALID_SUBJECTS.includes(cleanSubject)) {
      return NextResponse.json(
        { error: 'Invalid subject', error_ar: 'الموضوع غير صالح' },
        { status: 400 },
      );
    }

    if (cleanName.length > 200 || cleanMessage.length > 5000) {
      return NextResponse.json(
        { error: 'Input too long', error_ar: 'النص طويل جدًا' },
        { status: 400 },
      );
    }

    const isAr = locale === 'ar';
    const subjectLabel = SUBJECT_LABELS[cleanSubject] || SUBJECT_LABELS.other;

    // 1. Send notification to info@kuncoaching.com (admin notification)
    try {
      await sendEmail({
        to: 'info@kuncoaching.com',
        subject: `[Kun Website] ${subjectLabel.en} — ${cleanName}`,
        html: `
          <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px;">
            <h2 style="color: #474099; margin-bottom: 24px;">New Contact Form Submission</h2>
            <table style="width: 100%; border-collapse: collapse;">
              <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 10px 0; font-weight: bold; color: #555; width: 120px;">Name</td>
                <td style="padding: 10px 0;">${cleanName}</td>
              </tr>
              <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 10px 0; font-weight: bold; color: #555;">Email</td>
                <td style="padding: 10px 0;"><a href="mailto:${cleanEmail}">${cleanEmail}</a></td>
              </tr>
              ${cleanPhone ? `
              <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 10px 0; font-weight: bold; color: #555;">Phone</td>
                <td style="padding: 10px 0;"><a href="tel:${cleanPhone}">${cleanPhone}</a></td>
              </tr>` : ''}
              <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 10px 0; font-weight: bold; color: #555;">Subject</td>
                <td style="padding: 10px 0;">${subjectLabel.en} / ${subjectLabel.ar}</td>
              </tr>
            </table>
            <div style="margin-top: 20px; padding: 16px; background: #f5f3ef; border-radius: 8px;">
              <p style="color: #333; white-space: pre-wrap; line-height: 1.7;">${cleanMessage}</p>
            </div>
            <p style="margin-top: 16px; color: #999; font-size: 12px;">Sent from kunacademy.com contact form</p>
          </div>
        `,
      });
    } catch (e) {
      console.error('[contact] Admin notification email failed:', e);
    }

    // 2. Send confirmation email to the user
    try {
      await sendEmail({
        to: cleanEmail,
        subject: isAr
          ? 'تم استلام رسالتك — أكاديمية كُن'
          : 'Message Received — Kun Academy',
        html: `
          <div dir="${isAr ? 'rtl' : 'ltr'}" style="font-family: system-ui, ${isAr ? "'Tajawal'," : ''} sans-serif; max-width: 600px; margin: 0 auto; padding: 32px;">
            <h1 style="color: #474099;">${isAr ? 'شكرًا لتواصلك معنا' : 'Thank You for Reaching Out'}</h1>
            <p style="color: #555; line-height: 1.8;">
              ${isAr
                ? `مرحبًا ${cleanName}، تم استلام رسالتك بنجاح. سنعود إليك في أقرب وقت ممكن.`
                : `Hi ${cleanName}, we have received your message. We will get back to you as soon as possible.`}
            </p>
            <div style="margin-top: 16px; padding: 16px; background: #f5f3ef; border-radius: 8px;">
              <p style="color: #888; font-size: 13px;"><strong>${isAr ? 'الموضوع:' : 'Subject:'}</strong> ${isAr ? subjectLabel.ar : subjectLabel.en}</p>
              <p style="color: #666; white-space: pre-wrap;">${cleanMessage.substring(0, 300)}${cleanMessage.length > 300 ? '...' : ''}</p>
            </div>
            <p style="margin-top: 24px; color: #888; font-size: 13px;">
              ${isAr
                ? 'إذا كان استفسارك عاجلًا، يمكنك التواصل عبر واتساب.'
                : 'If your inquiry is urgent, you can reach us via WhatsApp.'}
            </p>
            <div style="margin-top: 30px; text-align: center; color: #ccc; font-size: 12px;">
              <p>&copy; 2026 Kun Academy</p>
            </div>
          </div>
        `,
      });
    } catch (e) {
      console.error('[contact] User confirmation email failed:', e);
    }

    // 3. Telegram alert to Samer
    try {
      await sendTelegramAlert({
        to: 'samer',
        message: `<b>New Contact Form</b>\nName: ${cleanName}\nEmail: ${cleanEmail}${cleanPhone ? `\nPhone: ${cleanPhone}` : ''}\nSubject: ${subjectLabel.en}\n\n${cleanMessage.substring(0, 500)}`,
      });
    } catch (e) {
      console.error('[contact] Telegram alert failed:', e);
    }

    return NextResponse.json({
      success: true,
      message: isAr ? 'تم إرسال رسالتك بنجاح' : 'Your message has been sent successfully',
    });
  } catch (err: any) {
    console.error('[contact] Error:', err);
    return NextResponse.json(
      { error: 'Internal server error', error_ar: 'حدث خطأ. يرجى المحاولة لاحقًا.' },
      { status: 500 },
    );
  }
}
