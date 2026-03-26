import { setRequestLocale } from 'next-intl/server';
import { GeometricPattern } from '@kunacademy/ui/patterns';
import { Section } from '@kunacademy/ui/section';
import type { Metadata } from 'next';

interface Props { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: locale === 'ar' ? 'سياسة الخصوصية | أكاديمية كُن' : 'Privacy Policy | Kun Academy',
  };
}

export default async function PrivacyPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  return (
    <main>
      <section className="relative overflow-hidden py-12 md:py-20" style={{ background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-600) 100%)' }}>
        <GeometricPattern pattern="flower-of-life" opacity={0.06} fade="both" />
        <div className="relative z-10 mx-auto max-w-[var(--max-content-width)] px-4 md:px-6 text-center">
          <h1 className="text-[2rem] md:text-[3rem] font-bold text-[#FFF5E9] leading-[1.1]" style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}>
            {isAr ? 'سياسة الخصوصية' : 'Privacy Policy'}
          </h1>
          <p className="mt-3 text-white/60 text-sm">{isAr ? 'آخر تحديث: مارس ٢٠٢٦' : 'Last updated: March 2026'}</p>
        </div>
      </section>

      <Section variant="white">
        <div className="max-w-3xl mx-auto space-y-8" style={{ fontFamily: isAr ? 'var(--font-arabic-body)' : 'inherit' }}>
          {isAr ? (
            <>
              <LegalSection title="١. من نحن">
                أكاديمية كُن للكوتشينج هي مؤسسة مسجّلة في منطقة ميدان الحرة، دبي، الإمارات العربية المتحدة. نحن نلتزم بحماية خصوصيتك ومعالجة بياناتك الشخصية بشكل آمن ومسؤول.
              </LegalSection>
              <LegalSection title="٢. البيانات التي نجمعها">
                نجمع البيانات التالية عند استخدامك لخدماتنا: الاسم وبيانات الاتصال (البريد الإلكتروني، رقم الهاتف)، معلومات الدفع (تُعالج عبر Stripe وTabby ولا نخزّنها لدينا)، بيانات الاستخدام وملفات تعريف الارتباط (Cookies) لتحسين تجربتك.
              </LegalSection>
              <LegalSection title="٣. كيف نستخدم بياناتك">
                نستخدم بياناتك لتقديم خدمات الكوتشينج والبرامج التدريبية، معالجة المدفوعات والحجوزات، إرسال إشعارات متعلقة بحسابك، وتحسين خدماتنا. لن نبيع بياناتك لأطراف ثالثة.
              </LegalSection>
              <LegalSection title="٤. الأطراف الثالثة">
                نشارك بياناتك مع: Stripe وTabby (معالجة المدفوعات)، Supabase (استضافة قاعدة البيانات)، Google Analytics (تحليلات الاستخدام)، Resend (إرسال البريد الإلكتروني). جميع هذه الأطراف ملتزمة بمعايير حماية البيانات.
              </LegalSection>
              <LegalSection title="٥. حقوقك">
                يحق لك طلب نسخة من بياناتك، تصحيح أي معلومات غير دقيقة، أو طلب حذف بياناتك. تواصل معنا عبر info@kunacademy.com.
              </LegalSection>
              <LegalSection title="٦. ملفات تعريف الارتباط">
                نستخدم ملفات تعريف الارتباط الضرورية لتشغيل الموقع وملفات تحليلية (Google Analytics) لفهم كيفية استخدام الموقع. يمكنك تعطيلها من إعدادات المتصفح.
              </LegalSection>
              <LegalSection title="٧. التواصل">
                لأي استفسار حول الخصوصية: info@kunacademy.com
              </LegalSection>
            </>
          ) : (
            <>
              <LegalSection title="1. Who We Are">
                Kun Coaching Academy is a registered establishment in Meydan Free Zone, Dubai, United Arab Emirates. We are committed to protecting your privacy and handling your personal data securely and responsibly.
              </LegalSection>
              <LegalSection title="2. Data We Collect">
                We collect the following data when you use our services: name and contact details (email, phone), payment information (processed via Stripe and Tabby — we do not store card details), and usage data and cookies to improve your experience.
              </LegalSection>
              <LegalSection title="3. How We Use Your Data">
                We use your data to deliver coaching services and training programs, process payments and bookings, send account-related notifications, and improve our services. We will never sell your data to third parties.
              </LegalSection>
              <LegalSection title="4. Third Parties">
                We share data with: Stripe and Tabby (payment processing), Supabase (database hosting), Google Analytics (usage analytics), and Resend (email delivery). All third parties comply with data protection standards.
              </LegalSection>
              <LegalSection title="5. Your Rights">
                You have the right to request a copy of your data, correct any inaccurate information, or request deletion of your data. Contact us at info@kunacademy.com.
              </LegalSection>
              <LegalSection title="6. Cookies">
                We use essential cookies for site functionality and analytical cookies (Google Analytics) to understand site usage. You can disable cookies in your browser settings.
              </LegalSection>
              <LegalSection title="7. Contact">
                For any privacy inquiries: info@kunacademy.com
              </LegalSection>
            </>
          )}
        </div>
      </Section>
    </main>
  );
}

function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-lg font-bold text-[var(--text-primary)] mb-3">{title}</h2>
      <p className="text-[var(--color-neutral-700)] leading-relaxed">{children}</p>
    </div>
  );
}
