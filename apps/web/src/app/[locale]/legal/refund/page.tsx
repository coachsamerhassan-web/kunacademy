import { setRequestLocale } from 'next-intl/server';
import { GeometricPattern } from '@kunacademy/ui/patterns';
import { Section } from '@kunacademy/ui/section';
import type { Metadata } from 'next';

interface Props { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return { title: locale === 'ar' ? 'سياسة الاسترجاع | أكاديمية كُن' : 'Refund Policy | Kun Academy' };
}

export default async function RefundPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  return (
    <main>
      <section className="relative overflow-hidden py-12 md:py-20" style={{ background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-600) 100%)' }}>
        <GeometricPattern pattern="flower-of-life" opacity={0.06} fade="both" />
        <div className="relative z-10 mx-auto max-w-[var(--max-content-width)] px-4 md:px-6 text-center">
          <h1 className="text-[2rem] md:text-[3rem] font-bold text-[#FFF5E9] leading-[1.1]" style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}>
            {isAr ? 'سياسة الاسترجاع' : 'Refund Policy'}
          </h1>
          <p className="mt-3 text-white/60 text-sm">{isAr ? 'آخر تحديث: مارس ٢٠٢٦' : 'Last updated: March 2026'}</p>
        </div>
      </section>

      <Section variant="white">
        <div className="max-w-3xl mx-auto space-y-8" style={{ fontFamily: isAr ? 'var(--font-arabic-body)' : 'inherit' }}>
          {isAr ? (
            <>
              <LS t="١. جلسات الكوتشينج الفردية">يمكن إلغاء الجلسة واسترداد المبلغ كاملاً إذا تم الإلغاء قبل ٢٤ ساعة من الموعد المحدد. الإلغاء خلال أقل من ٢٤ ساعة: لا يُسترد المبلغ ولكن يمكن إعادة جدولة الجلسة مرة واحدة. عدم الحضور: لا يُسترد المبلغ.</LS>
              <LS t="٢. البرامج التدريبية والشهادات">يمكن الانسحاب واسترداد المبلغ كاملاً (ناقص رسوم إدارية ١٠%) خلال ٧ أيام من التسجيل وقبل بدء البرنامج. بعد بدء البرنامج: لا يُسترد المبلغ، ولكن يمكن تحويل التسجيل إلى دورة لاحقة (مرة واحدة).</LS>
              <LS t="٣. المنتجات الرقمية">الكتب الإلكترونية والمحتوى الرقمي: لا يُسترد المبلغ بعد التحميل أو الوصول إلى المحتوى. إذا واجهت مشكلة تقنية تمنع الوصول، تواصل معنا خلال ٤٨ ساعة.</LS>
              <LS t="٤. الفعاليات وورش العمل">إلغاء قبل ٧ أيام: استرداد كامل. إلغاء قبل ٣ أيام: استرداد ٥٠%. أقل من ٣ أيام: لا يُسترد المبلغ. إلغاء الفعالية من قبلنا: استرداد كامل.</LS>
              <LS t="٥. التقسيط (Tabby)">عند الدفع بالتقسيط عبر Tabby، تخضع سياسة الاسترداد لنفس الشروط أعلاه. يتم معالجة الاسترداد عبر Tabby مباشرة.</LS>
              <LS t="٦. طريقة الاسترداد">يتم الاسترداد بنفس طريقة الدفع الأصلية خلال ٧-١٤ يوم عمل.</LS>
              <LS t="٧. التواصل">لطلب استرداد: info@kunacademy.com مع ذكر رقم الحجز أو الفاتورة.</LS>
            </>
          ) : (
            <>
              <LS t="1. Individual Coaching Sessions">Full refund if cancelled 24+ hours before the session. Less than 24 hours: no refund, but one reschedule allowed. No-show: no refund.</LS>
              <LS t="2. Training Programs & Certifications">Full refund (minus 10% admin fee) within 7 days of registration and before the program starts. After the program starts: no refund, but a one-time transfer to a future cohort is available.</LS>
              <LS t="3. Digital Products">eBooks and digital content: no refund after download or access. If you experience a technical issue preventing access, contact us within 48 hours.</LS>
              <LS t="4. Events & Workshops">Cancelled 7+ days before: full refund. 3-7 days before: 50% refund. Less than 3 days: no refund. Event cancelled by us: full refund.</LS>
              <LS t="5. Installments (Tabby)">For payments via Tabby installments, the same refund terms above apply. Refunds are processed through Tabby directly.</LS>
              <LS t="6. Refund Method">Refunds are issued to the original payment method within 7-14 business days.</LS>
              <LS t="7. Contact">To request a refund: info@kunacademy.com with your booking or invoice number.</LS>
            </>
          )}
        </div>
      </Section>
    </main>
  );
}

function LS({ t, children }: { t: string; children: React.ReactNode }) {
  return <div><h2 className="text-lg font-bold text-[var(--text-primary)] mb-3">{t}</h2><p className="text-[var(--color-neutral-700)] leading-relaxed">{children}</p></div>;
}
