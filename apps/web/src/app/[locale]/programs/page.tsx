import { setRequestLocale } from 'next-intl/server';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';
import { Button } from '@kunacademy/ui/button';

const pathways = {
  ar: [
    { title: 'مجاني', desc: 'اكتشف منهجية التفكير الحسّي', href: '/programs/free', color: 'var(--color-secondary)' },
    { title: 'دورات قصيرة', desc: 'طوّر مهاراتك', href: '/programs/courses', color: 'var(--color-accent)' },
    { title: 'شهادات معتمدة', desc: 'اعتماد ICF دولي', href: '/programs/certifications/stce', color: 'var(--color-primary)' },
    { title: 'كوتشينج مؤسسي', desc: 'حلول للمؤسسات', href: '/programs/corporate', color: 'var(--color-primary-700)' },
    { title: 'الأسرة والشباب', desc: 'برامج الأسرة', href: '/programs/family', color: 'var(--color-accent)' },
    { title: 'منصة الكوتشينج', desc: 'احجز جلستك', href: '/programs/coaching', color: 'var(--color-primary)' },
  ],
  en: [
    { title: 'Free', desc: 'Discover Somatic Thinking', href: '/programs/free', color: 'var(--color-secondary)' },
    { title: 'Short Courses', desc: 'Build your skills', href: '/programs/courses', color: 'var(--color-accent)' },
    { title: 'Certifications', desc: 'ICF-accredited paths', href: '/programs/certifications/stce', color: 'var(--color-primary)' },
    { title: 'Corporate', desc: 'Enterprise solutions', href: '/programs/corporate', color: 'var(--color-primary-700)' },
    { title: 'Family & Youth', desc: 'Family programs', href: '/programs/family', color: 'var(--color-accent)' },
    { title: 'Coaching Platform', desc: 'Book a session', href: '/programs/coaching', color: 'var(--color-primary)' },
  ],
};

export default async function ProgramsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';
  const items = isAr ? pathways.ar : pathways.en;

  return (
    <main>
      <Section variant="default" className="min-h-[60vh] flex items-center">
        <div className="text-center max-w-3xl mx-auto">
          <Heading level={1}>
            {isAr ? 'برامجنا' : 'Our Programs'}
          </Heading>
          <p className="mt-4 text-lg text-[var(--color-neutral-700)]">
            {isAr
              ? 'من الاكتشاف المجاني إلى الشهادات المعتمدة دوليًا — اختر المسار الذي يناسب رحلتك'
              : 'From free discovery to internationally accredited certifications — choose the path that fits your journey'}
          </p>
          <Button variant="secondary" size="lg" className="mt-6">
            {isAr ? 'اكتشف برنامجك المناسب' : 'Find Your Program'}
          </Button>
        </div>
      </Section>

      <Section variant="white">
        <div className="text-center mb-12">
          <Heading level={2}>
            {isAr ? 'مسارات التعلّم' : 'Learning Pathways'}
          </Heading>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((item, i) => (
            <div
              key={i}
              className="rounded-[var(--card-radius)] bg-white p-6 shadow-sm hover:shadow-md transition-shadow border-t-4"
              style={{ borderTopColor: item.color }}
            >
              <h3 className="font-bold text-xl">{item.title}</h3>
              <p className="text-[var(--color-neutral-600)] mt-2">{item.desc}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section variant="dark" pattern>
        <div className="text-center py-8">
          <Heading level={2} className="!text-white">
            {isAr ? 'لا تعرف من أين تبدأ؟' : 'Not sure where to start?'}
          </Heading>
          <p className="mt-4 text-white/80 max-w-xl mx-auto">
            {isAr
              ? 'أجب على بضعة أسئلة وسنرشدك إلى البرنامج المناسب لك'
              : 'Answer a few questions and we\'ll guide you to the right program'}
          </p>
          <Button variant="primary" size="lg" className="mt-6">
            {isAr ? 'ابدأ اختبار تحديد المسار' : 'Take the Program Quiz'}
          </Button>
        </div>
      </Section>
    </main>
  );
}
