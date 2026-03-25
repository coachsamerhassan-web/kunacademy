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
