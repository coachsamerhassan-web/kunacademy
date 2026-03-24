interface EmailParams {
  to: string;
  subject: string;
  html: string;
}

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const FROM_EMAIL = 'Kun Academy <noreply@kunacademy.com>';

/** Send an email via Resend */
export async function sendEmail({ to, subject, html }: EmailParams) {
  if (!RESEND_API_KEY) {
    console.warn('[email] RESEND_API_KEY not set, skipping email to:', to);
    return { id: 'mock', success: true };
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${RESEND_API_KEY}` },
    body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
  });

  if (!res.ok) throw new Error(`Email failed: ${res.statusText}`);
  return res.json();
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
