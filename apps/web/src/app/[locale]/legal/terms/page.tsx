import { setRequestLocale } from 'next-intl/server';
import { GeometricPattern } from '@kunacademy/ui/patterns';
import { Section } from '@kunacademy/ui/section';
import type { Metadata } from 'next';

interface Props { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return { title: locale === 'ar' ? 'شروط الاستخدام | أكاديمية كُن' : 'Terms of Service | Kun Academy' };
}

export default async function TermsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  return (
    <main>
      <section className="relative overflow-hidden py-12 md:py-20" style={{ background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-600) 100%)' }}>
        <GeometricPattern pattern="flower-of-life" opacity={0.06} fade="both" />
        <div className="relative z-10 mx-auto max-w-[var(--max-content-width)] px-4 md:px-6 text-center">
          <h1 className="text-[2rem] md:text-[3rem] font-bold text-[#FFF5E9] leading-[1.1]" style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}>
            {isAr ? 'شروط الاستخدام' : 'Terms of Service'}
          </h1>
          <p className="mt-3 text-white/60 text-sm">{isAr ? 'آخر تحديث: مارس ٢٠٢٦' : 'Last updated: March 2026'}</p>
        </div>
      </section>

      <Section variant="white">
        <div className="max-w-3xl mx-auto space-y-8" style={{ fontFamily: isAr ? 'var(--font-arabic-body)' : 'inherit' }}>
          {isAr ? (
            <>
              <LS t="١. القبول">باستخدامك لموقع أكاديمية كُن وخدماتها، فأنت توافق على هذه الشروط. إذا لم توافق، يرجى عدم استخدام الموقع.</LS>
              <LS t="٢. الخدمات">نقدم خدمات الكوتشينج الفردي والجماعي، برامج تدريبية واعتمادات مهنية (STCE)، ورش عمل وفعاليات، ومنتجات رقمية. جميع الخدمات تخضع لهذه الشروط.</LS>
              <LS t="٣. الحسابات">عند إنشاء حساب، أنت مسؤول عن الحفاظ على سرية معلومات تسجيل الدخول. أي نشاط يتم عبر حسابك يكون على مسؤوليتك.</LS>
              <LS t="٤. المدفوعات">الأسعار معروضة بالدرهم الإماراتي (AED) ما لم يُذكر خلاف ذلك. تُعالج المدفوعات عبر Stripe وTabby. جميع المدفوعات نهائية ما لم تنطبق سياسة الاسترداد.</LS>
              <LS t="٥. الملكية الفكرية">جميع محتويات الموقع والمواد التدريبية ومنهجية التفكير الحسّي® هي ملكية حصرية لأكاديمية كُن. يُحظر النسخ أو إعادة التوزيع بدون إذن مكتوب.</LS>
              <LS t="٦. إخلاء المسؤولية">خدمات الكوتشينج ليست بديلاً عن العلاج النفسي أو الطبي. نحن لا نقدم تشخيصات أو وصفات علاجية. إذا كنت تعاني من مشاكل صحية نفسية، يرجى استشارة متخصص.</LS>
              <LS t="٧. الإلغاء">يمكن إلغاء جلسات الكوتشينج قبل ٢٤ ساعة على الأقل. الإلغاء المتأخر قد يخضع لرسوم.</LS>
              <LS t="٨. القانون الحاكم">تخضع هذه الشروط لقوانين دولة الإمارات العربية المتحدة. أي نزاع يُحال إلى محاكم دبي.</LS>
              <LS t="٩. التواصل">لأي استفسار: info@kunacademy.com</LS>
            </>
          ) : (
            <>
              <LS t="1. Acceptance">By using Kun Academy's website and services, you agree to these terms. If you do not agree, please do not use the site.</LS>
              <LS t="2. Services">We provide individual and group coaching, training programs and professional certifications (STCE), workshops and events, and digital products. All services are subject to these terms.</LS>
              <LS t="3. Accounts">When creating an account, you are responsible for maintaining the confidentiality of your login credentials. Any activity through your account is your responsibility.</LS>
              <LS t="4. Payments">Prices are displayed in UAE Dirhams (AED) unless otherwise stated. Payments are processed via Stripe and Tabby. All payments are final unless the refund policy applies.</LS>
              <LS t="5. Intellectual Property">All website content, training materials, and the Somatic Thinking® methodology are the exclusive property of Kun Academy. Copying or redistribution without written permission is prohibited.</LS>
              <LS t="6. Disclaimer">Coaching services are not a substitute for psychological or medical treatment. We do not provide diagnoses or prescriptions. If you are experiencing mental health issues, please consult a qualified professional.</LS>
              <LS t="7. Cancellation">Coaching sessions may be cancelled at least 24 hours in advance. Late cancellations may be subject to fees.</LS>
              <LS t="8. Governing Law">These terms are governed by the laws of the United Arab Emirates. Any disputes shall be referred to the courts of Dubai.</LS>
              <LS t="9. Contact">For any inquiries: info@kunacademy.com</LS>
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
