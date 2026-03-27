import { setRequestLocale } from 'next-intl/server';
import { Section } from '@kunacademy/ui/section';
import { GeometricPattern } from '@kunacademy/ui/patterns';
import { Card } from '@kunacademy/ui/card';
import { breadcrumbJsonLd } from '@kunacademy/ui/structured-data';
import type { Metadata } from 'next';

interface Props { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const isAr = locale === 'ar';
  return {
    title: isAr ? 'حلول المؤسسات | أكاديمية كُن' : 'Corporate Solutions | Kun Academy',
    description: isAr
      ? 'برامج كوتشينج مصمّمة للقادة والفرق والمؤسسات — لأن القيادة تبدأ من الجسد'
      : 'Coaching programs designed for leaders, teams, and organizations — because leadership begins in the body',
  };
}

const services = [
  {
    titleAr: 'كوتشينج تنفيذي',
    titleEn: 'Executive Coaching',
    descAr: 'جلسات ١:١ مع القيادات العليا — تطوير الحضور القيادي واتخاذ القرارات من عمق الوعي الجسدي والعقلي.',
    descEn: '1:1 sessions with senior leaders — developing leadership presence and decision-making from deep body-mind awareness.',
    iconPath: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
  },
  {
    titleAr: 'ورش الفرق',
    titleEn: 'Team Workshops',
    descAr: 'ورش تفاعلية لبناء الثقة والتواصل الفعّال داخل الفريق من خلال تمارين حسّية تطبيقية.',
    descEn: 'Interactive workshops to build trust and effective communication within teams through applied somatic exercises.',
    iconPath: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 7a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75',
  },
  {
    titleAr: 'برامج التحوّل المؤسسي',
    titleEn: 'Organizational Transformation',
    descAr: 'برامج مخصّصة تمتد لأشهر — تشمل تقييم الثقافة المؤسسية وتصميم رحلة تحوّل متكاملة.',
    descEn: 'Customized multi-month programs — including organizational culture assessment and a complete transformation journey design.',
    iconPath: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
  },
];

const clients = [
  { nameAr: 'شركات النفط والطاقة', nameEn: 'Oil & Energy Companies' },
  { nameAr: 'البنوك والمؤسسات المالية', nameEn: 'Banks & Financial Institutions' },
  { nameAr: 'الجهات الحكومية', nameEn: 'Government Entities' },
  { nameAr: 'شركات التكنولوجيا', nameEn: 'Technology Companies' },
  { nameAr: 'المستشفيات والرعاية الصحية', nameEn: 'Hospitals & Healthcare' },
  { nameAr: 'المؤسسات التعليمية', nameEn: 'Educational Institutions' },
];

export default async function CorporatePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd(locale, [
          { name: isAr ? 'الرئيسية' : 'Home', path: '' },
          { name: isAr ? 'الكوتشينج' : 'Coaching', path: '/coaching' },
          { name: isAr ? 'حلول المؤسسات' : 'Corporate Solutions', path: '/coaching/corporate' },
        ])) }}
      />
      {/* Hero */}
      <section className="relative overflow-hidden py-16 md:py-28">
        <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, #1D1A3D 0%, var(--color-primary) 100%)' }} />
        <GeometricPattern pattern="girih" opacity={0.08} fade="both" />
        <div className="relative z-10 mx-auto max-w-[var(--max-content-width)] px-4 md:px-6">
          <div className="max-w-2xl animate-fade-up">
            <a href={`/${locale}/coaching`} className="text-[var(--color-accent)] text-sm font-medium hover:underline mb-4 inline-block">
              ← {isAr ? 'الكوتشينج' : 'Coaching'}
            </a>
            <h1
              className="text-[2.25rem] md:text-[3.5rem] font-bold text-[#FFF5E9] leading-[1.05]"
              style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
            >
              {isAr ? 'حلول المؤسسات' : 'Corporate Solutions'}
            </h1>
            <p className="mt-4 text-white/70 text-lg md:text-xl leading-relaxed">
              {isAr
                ? 'برامج كوتشينج مصمّمة للقادة والفرق — لأن القيادة الحقيقية تبدأ من حضور القائد في جسده'
                : 'Coaching programs designed for leaders and teams — because real leadership starts with the leader\'s presence in their body'}
            </p>
            <a
              href="mailto:corporate@kuncoaching.com"
              className="inline-flex items-center justify-center rounded-xl bg-[var(--color-accent)] px-6 py-3 text-sm font-semibold text-white min-h-[48px] mt-8 hover:bg-[var(--color-accent-500)] transition-all duration-300 shadow-[0_4px_24px_rgba(228,96,30,0.35)]"
            >
              {isAr ? 'اطلب عرض سعر' : 'Request a Proposal'}
            </a>
          </div>
        </div>
      </section>

      {/* Services */}
      <Section variant="white">
        <div className="text-center mb-10">
          <h2
            className="text-2xl md:text-3xl font-bold text-[var(--text-primary)]"
            style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
          >
            {isAr ? 'خدماتنا للمؤسسات' : 'Our Corporate Services'}
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {services.map((service, i) => (
            <Card key={i} accent className="p-6 h-full">
              <div className="h-12 w-12 rounded-xl bg-[var(--color-primary-50)] flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-[var(--color-primary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d={service.iconPath} />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-[var(--text-primary)] mb-2">
                {isAr ? service.titleAr : service.titleEn}
              </h3>
              <p className="text-sm text-[var(--color-neutral-600)] leading-relaxed">
                {isAr ? service.descAr : service.descEn}
              </p>
            </Card>
          ))}
        </div>
      </Section>

      {/* Sectors */}
      <Section variant="surface">
        <div className="text-center mb-8">
          <h2
            className="text-xl md:text-2xl font-bold text-[var(--text-primary)]"
            style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
          >
            {isAr ? 'نعمل مع' : 'We Work With'}
          </h2>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3 max-w-3xl mx-auto">
          {clients.map((client, i) => (
            <span
              key={i}
              className="inline-flex items-center px-4 py-2 rounded-full text-sm bg-white text-[var(--color-neutral-700)] border border-[var(--color-neutral-200)]"
            >
              {isAr ? client.nameAr : client.nameEn}
            </span>
          ))}
        </div>
      </Section>

      {/* CTA */}
      <Section variant="white">
        <div className="text-center py-4">
          <h2
            className="text-xl md:text-2xl font-bold text-[var(--text-primary)] mb-3"
            style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
          >
            {isAr ? 'مستعد لتطوير فريقك؟' : 'Ready to Develop Your Team?'}
          </h2>
          <p className="text-[var(--color-neutral-600)] mb-6 max-w-xl mx-auto">
            {isAr
              ? 'تواصل معنا للحصول على عرض سعر مخصّص لاحتياجات مؤسستك'
              : 'Contact us for a custom proposal tailored to your organization\'s needs'}
          </p>
          <a
            href="mailto:corporate@kuncoaching.com"
            className="inline-flex items-center justify-center rounded-xl bg-[var(--color-primary)] px-8 py-3.5 text-base font-semibold text-white min-h-[52px] hover:bg-[var(--color-primary-600)] transition-all duration-300"
          >
            {isAr ? 'تواصل مع فريقنا' : 'Contact Our Team'}
          </a>
        </div>
      </Section>
    </main>
  );
}
