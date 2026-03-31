import { NextResponse, type NextRequest } from 'next/server';
import { sendEmail } from '@kunacademy/email';
import { sendTelegramAlert } from '@kunacademy/email';

// ── Rate limiting (in-memory, per-process) ──────────────────────────
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 5;
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

setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap) {
    if (now > entry.resetAt) rateLimitMap.delete(ip);
  }
}, 10 * 60 * 1000);

// ── Helpers ──────────────────────────────────────────────────────────
function sanitize(str: string): string {
  return str.trim().replace(/<[^>]*>/g, '');
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ── POST handler ─────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
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
    const { name, email, phone, programCode, programName, message, locale, _hp } = body;

    // Honeypot — silent success for bots
    if (_hp) {
      return NextResponse.json({ success: true });
    }

    // Validate required fields
    if (!name || !email || !phone || !programCode) {
      return NextResponse.json(
        { error: 'Missing required fields', error_ar: 'يرجى ملء جميع الحقول المطلوبة' },
        { status: 400 },
      );
    }

    const cleanName = sanitize(name);
    const cleanEmail = sanitize(email).toLowerCase();
    const cleanPhone = sanitize(phone);
    const cleanProgram = sanitize(programCode);
    const cleanProgramName = programName ? sanitize(programName) : cleanProgram;
    const cleanMessage = message ? sanitize(message) : '';

    if (!isValidEmail(cleanEmail)) {
      return NextResponse.json(
        { error: 'Invalid email address', error_ar: 'البريد الإلكتروني غير صالح' },
        { status: 400 },
      );
    }

    if (cleanName.length > 200 || cleanMessage.length > 2000 || cleanPhone.length > 30 || cleanProgram.length > 100) {
      return NextResponse.json(
        { error: 'Input too long', error_ar: 'النص طويل جدًا' },
        { status: 400 },
      );
    }

    const isAr = locale === 'ar';

    // 1. Admin notification email
    try {
      await sendEmail({
        to: 'info@kuncoaching.com',
        subject: `[Kun Leads] استشارة — ${cleanProgramName} — ${cleanName}`,
        html: `
          <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px;">
            <h2 style="color: #474099; margin-bottom: 24px;">New Lead — Program Inquiry</h2>
            <table style="width: 100%; border-collapse: collapse;">
              <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 10px 0; font-weight: bold; color: #555; width: 140px;">Name</td>
                <td style="padding: 10px 0;">${cleanName}</td>
              </tr>
              <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 10px 0; font-weight: bold; color: #555;">Email</td>
                <td style="padding: 10px 0;"><a href="mailto:${cleanEmail}">${cleanEmail}</a></td>
              </tr>
              <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 10px 0; font-weight: bold; color: #555;">Phone</td>
                <td style="padding: 10px 0;"><a href="tel:${cleanPhone}">${cleanPhone}</a></td>
              </tr>
              <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 10px 0; font-weight: bold; color: #555;">Program</td>
                <td style="padding: 10px 0;">${cleanProgramName} <span style="color:#999">(${cleanProgram})</span></td>
              </tr>
            </table>
            ${cleanMessage ? `
            <div style="margin-top: 20px; padding: 16px; background: #f5f3ef; border-radius: 8px;">
              <p style="color: #333; white-space: pre-wrap; line-height: 1.7;">${cleanMessage}</p>
            </div>` : ''}
            <p style="margin-top: 16px; color: #999; font-size: 12px;">Sent from kunacademy.com program page — ${cleanProgram}</p>
          </div>
        `,
      });
    } catch (e) {
      console.error('[leads] Admin notification email failed:', e);
    }

    // 2. Auto-reply to lead
    try {
      await sendEmail({
        to: cleanEmail,
        subject: isAr
          ? `شكرًا لاهتمامك بـ ${cleanProgramName} — أكاديمية كُن`
          : `Thanks for your interest in ${cleanProgramName} — Kun Academy`,
        html: `
          <div dir="${isAr ? 'rtl' : 'ltr'}" style="font-family: system-ui, ${isAr ? "'Tajawal'," : ''} sans-serif; max-width: 600px; margin: 0 auto; padding: 32px;">
            <h1 style="color: #474099;">
              ${isAr ? `شكرًا لاهتمامك بـ ${cleanProgramName}!` : `Thanks for your interest in ${cleanProgramName}!`}
            </h1>
            <p style="color: #555; line-height: 1.8;">
              ${isAr
                ? `مرحبًا ${cleanName}، سيتواصل معك مرشد كُن خلال ٢٤ ساعة.`
                : `Hi ${cleanName}, a Kun guide will contact you within 24 hours.`}
            </p>
            <div style="margin-top: 30px; text-align: center; color: #ccc; font-size: 12px;">
              <p>&copy; 2026 Kun Academy</p>
            </div>
          </div>
        `,
      });
    } catch (e) {
      console.error('[leads] Auto-reply email failed:', e);
    }

    // 3. Telegram alert
    try {
      await sendTelegramAlert({
        to: 'samer',
        message: `🎯 طلب استشارة جديد\n👤 ${cleanName}\n📧 ${cleanEmail}\n📱 ${cleanPhone}\n📚 ${cleanProgramName}\n💬 ${cleanMessage || 'لا توجد رسالة'}`,
      });
    } catch (e) {
      console.error('[leads] Telegram alert failed:', e);
    }

    return NextResponse.json({
      success: true,
      message: isAr ? 'سيتواصل معك أحد مرشدي كُن قريبًا' : 'A Kun guide will contact you soon',
    });
  } catch (err: any) {
    console.error('[leads] Error:', err);
    return NextResponse.json(
      { error: 'Internal server error', error_ar: 'حدث خطأ. يرجى المحاولة لاحقًا.' },
      { status: 500 },
    );
  }
}
