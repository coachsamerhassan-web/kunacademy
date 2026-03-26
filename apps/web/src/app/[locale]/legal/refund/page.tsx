import { setRequestLocale } from 'next-intl/server';
import { GeometricPattern } from '@kunacademy/ui/patterns';
import { Section } from '@kunacademy/ui/section';
import type { Metadata } from 'next';

interface Props { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return { title: locale === 'ar' ? 'سياسة الاسترداد والإلغاء | أكاديمية كُن' : 'Refund & Cancellation Policy | Kun Academy' };
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
            {isAr ? 'سياسة الاسترداد والإلغاء' : 'Refund & Cancellation Policy'}
          </h1>
          <p className="mt-3 text-white/60 text-sm">{isAr ? 'آخر تحديث: ٢٤ أكتوبر ٢٠٢٥' : 'Last updated: October 24, 2025'}</p>
        </div>
      </section>

      <Section variant="white">
        <div className="max-w-3xl mx-auto space-y-8" style={{ fontFamily: isAr ? 'var(--font-arabic-body)' : 'inherit' }}>
          {isAr ? (
            <>
              <LSPreamble>
                تُحدد هذه السياسة شروط الاسترداد والإلغاء المطبّقة على جميع خدمات ومنتجات KUN COACHING ACADEMY L.L.C–FZ (أكاديمية كُن كوتشينج ش.ذ.م.م – منطقة حرّة). وتُعد هذه السياسة جزءًا لا يتجزأ من الشروط والأحكام العامة.
              </LSPreamble>

              <LS t="١. الجلسات الفردية والجماعية والرحلات القصيرة">
                <ul className="list-disc mr-6 mt-2 space-y-2">
                  <li>فترة السماح بطلب الاسترداد: <strong>7 أيام تقويمية</strong> من تاريخ الشراء.</li>
                  <li>يمكن تحويل الرسوم إلى شخص آخر قبل بدء البرنامج.</li>
                  <li>تُعاد المبالغ المستحقة خلال <strong>30 يومًا</strong> عبر وسيلة الدفع الأصلية فقط.</li>
                </ul>
              </LS>

              <LS t="٢. البرامج والدورات والرحلات التعليمية">
                <ul className="list-disc mr-6 mt-2 space-y-2">
                  <li>استرداد كامل (<strong>100%</strong>) عند إلغاء البرنامج من قِبل الأكاديمية أو إلغاء المشارك قبل <strong>أسبوعين</strong> من البدء.</li>
                  <li>استرداد جزئي (<strong>75%</strong>) عند الإلغاء خلال أقل من أسبوعين، و<strong>50%</strong> عند الإلغاء خلال أسبوع.</li>
                  <li>لا استرداد بعد بدء البرنامج.</li>
                </ul>
              </LS>

              <LS t="٣. الخدمات الإضافية">
                الاستشارات الخاصة أو الدعم الفني أو التصاميم التنفيذية <strong>غير قابلة للاسترداد</strong>.
              </LS>

              <LS t="٤. طريقة الاسترداد">
                يتم الاسترداد بنفس طريقة الدفع الأصلية خلال 30 يوم عمل. تُقبل المدفوعات عبر بطاقات فيزا وماستركارد بالدرهم الإماراتي. لا تحتفظ الأكاديمية ببيانات بطاقات الدفع على خوادمها.
              </LS>

              <LS t="٥. التواصل">
                لطلب استرداد أو استفسار حول سياسة الإلغاء:
                <br /><br />
                info@kuncoaching.com
                <br />
                privacy@kunacademy.com
                <br /><br />
                العنوان الرسمي:
                <br />
                KUN COACHING ACADEMY L.L.C–FZ
                <br />
                Business Center 1, Mezzanine Floor, The Meydan Hotel, Nad Al Sheba, Dubai, U.A.E.
              </LS>
            </>
          ) : (
            <>
              <LSPreamble>
                This policy sets out the refund and cancellation terms applicable to all services and products of KUN COACHING ACADEMY L.L.C–FZ. This policy is an integral part of the general Terms &amp; Conditions.
              </LSPreamble>

              <LS t="1. Individual Sessions, Group Sessions, and Short Trips">
                <ul className="list-disc ml-6 mt-2 space-y-2">
                  <li>Refund request grace period: <strong>7 calendar days</strong> from the date of purchase.</li>
                  <li>Fees may be transferred to another person before the program starts.</li>
                  <li>Eligible refunds are returned within <strong>30 days</strong> via the original payment method only.</li>
                </ul>
              </LS>

              <LS t="2. Programs, Courses, and Educational Trips">
                <ul className="list-disc ml-6 mt-2 space-y-2">
                  <li>Full refund (<strong>100%</strong>) if the program is cancelled by the Academy or the participant cancels <strong>2+ weeks</strong> before the start date.</li>
                  <li>Partial refund (<strong>75%</strong>) if cancelled less than 2 weeks before, and <strong>50%</strong> if cancelled within 1 week.</li>
                  <li>No refund after the program has started.</li>
                </ul>
              </LS>

              <LS t="3. Additional Services">
                Private consultations, technical support, or executive designs are <strong>non-refundable</strong>.
              </LS>

              <LS t="4. Refund Method">
                Refunds are issued to the original payment method within 30 business days. Payments are accepted via Visa and Mastercard in UAE Dirhams. The Academy does not retain payment card data on its servers.
              </LS>

              <LS t="5. Contact">
                To request a refund or inquire about the cancellation policy:
                <br /><br />
                info@kuncoaching.com
                <br />
                privacy@kunacademy.com
                <br /><br />
                Official address:
                <br />
                KUN COACHING ACADEMY L.L.C–FZ
                <br />
                Business Center 1, Mezzanine Floor, The Meydan Hotel, Nad Al Sheba, Dubai, U.A.E.
              </LS>
            </>
          )}
        </div>
      </Section>
    </main>
  );
}

function LSPreamble({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[var(--color-neutral-700)] leading-relaxed">{children}</div>
  );
}

function LS({ t, children }: { t: string; children: React.ReactNode }) {
  return <div><h2 className="text-lg font-bold text-[var(--text-primary)] mb-3">{t}</h2><div className="text-[var(--color-neutral-700)] leading-relaxed">{children}</div></div>;
}
