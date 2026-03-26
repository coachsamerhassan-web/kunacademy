import { setRequestLocale } from 'next-intl/server';
import { Section } from '@kunacademy/ui/section';
import { GeometricPattern } from '@kunacademy/ui/patterns';

const certifications = {
  ar: {
    hero: {
      eyebrow: 'أكاديمية كُن',
      title: 'الشهادات المعتمدة',
      subtitle: 'برامج شهادات احترافية في التفكير الحسّي — معتمدة من ICF',
    },
    flagship: {
      label: 'الشهادة الرئيسية',
      title: 'شهادة التفكير الحسّي في الكوتشينج',
      abbr: 'STCE',
      desc: '٤ مستويات تأخذك من الأساسيات إلى الإشراف — ٢٥٦ ساعة تدريبية معتمدة من ICF',
      levels: '٤ مستويات',
      hours: '٢٥٦ ساعة',
      cta: 'استعرض المستويات',
      href: '/academy/certifications/stce',
    },
    specialized: [
      {
        title: 'منتورينج MCC',
        desc: 'جلسات منتورينج فردية مع سامر حسن (MCC) — ساعات مؤهّلة لتجديد شهادات ACC / PCC / MCC',
        tag: 'CCE',
        href: '/academy/certifications/mcc-mentoring',
        cta: 'التفاصيل',
      },
      {
        title: 'منهجك',
        desc: 'ابنِ منهجيتك الخاصة في الكوتشينج — إطار نظري متماسك وأدوات عملية فريدة',
        tag: 'متقدم',
        href: '/academy/certifications/menhajak',
        cta: 'التفاصيل',
      },
      {
        title: 'الكوتشينج الإسلامي',
        desc: 'إطار متكامل يجمع مفهوم النَّفْس في التراث الإسلامي والإشارات الحسّية الجسدية',
        tag: 'متخصص',
        href: '/academy/certifications/islamic-coaching',
        cta: 'التفاصيل',
      },
    ],
    specializedHeading: 'برامج متخصصة',
    specializedSubtitle: 'برامج تكميلية للكوتشز الذين يريدون التعمّق في مجالات محددة',
    ctaTitle: 'لا تعرف من أين تبدأ؟',
    ctaDesc: 'خذ اختبار المسار لاكتشاف البرنامج المناسب لك',
    ctaButton: 'اختبار المسار',
  },
  en: {
    hero: {
      eyebrow: 'Kun Academy',
      title: 'Certifications',
      subtitle: 'Professional certification programs in Somatic Thinking — ICF accredited',
    },
    flagship: {
      label: 'Flagship Certification',
      title: 'Somatic Thinking Coaching Education',
      abbr: 'STCE',
      desc: '4 levels from foundations to supervision — 256 ICF-accredited training hours',
      levels: '4 Levels',
      hours: '256 Hours',
      cta: 'Explore Levels',
      href: '/academy/certifications/stce',
    },
    specialized: [
      {
        title: 'MCC Mentoring',
        desc: 'One-on-one mentoring with Samer Hassan (MCC) — qualifying hours for ACC / PCC / MCC credential renewal',
        tag: 'CCE',
        href: '/academy/certifications/mcc-mentoring',
        cta: 'Learn More',
      },
      {
        title: 'Menhajak',
        desc: 'Build your own coaching methodology — a coherent framework with unique practical tools',
        tag: 'Advanced',
        href: '/academy/certifications/menhajak',
        cta: 'Learn More',
      },
      {
        title: 'Islamic Coaching',
        desc: 'An integrated framework combining al-nafs in Islamic tradition with somatic body signals',
        tag: 'Specialized',
        href: '/academy/certifications/islamic-coaching',
        cta: 'Learn More',
      },
    ],
    specializedHeading: 'Specialized Programs',
    specializedSubtitle: 'Complementary programs for coaches who want to deepen specific areas',
    ctaTitle: 'Not sure where to start?',
    ctaDesc: 'Take the Pathfinder quiz to discover the right program for you',
    ctaButton: 'Take the Quiz',
  },
};

export default async function CertificationsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';
  const t = isAr ? certifications.ar : certifications.en;

  return (
    <main>
      {/* Hero */}
      <section
        className="relative overflow-hidden py-20 md:py-28"
        style={{ background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-700) 100%)' }}
      >
        <GeometricPattern pattern="girih" opacity={0.1} fade="both" />
        <div className="relative z-10 mx-auto max-w-[var(--max-content-width)] px-4 md:px-6 text-center animate-fade-up">
          <p className="text-sm font-medium tracking-[0.15em] uppercase text-[var(--color-accent-200)] mb-4">
            {t.hero.eyebrow}
          </p>
          <h1
            className="text-[2.25rem] md:text-[3.5rem] font-bold text-[#FFF5E9] leading-[1.1]"
            style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
          >
            {t.hero.title}
          </h1>
          <p className="mt-4 text-white/65 max-w-2xl mx-auto text-lg md:text-xl">
            {t.hero.subtitle}
          </p>
        </div>
      </section>

      {/* Flagship — STCE */}
      <Section variant="surface">
        <div className="animate-fade-up">
          <p className="text-sm font-semibold text-[var(--color-primary)] tracking-wide uppercase mb-3">
            {t.flagship.label}
          </p>
          <a
            href={`/${locale}${t.flagship.href}`}
            className="group block rounded-2xl bg-white p-6 md:p-8 shadow-[0_4px_24px_rgba(71,64,153,0.06)] hover:shadow-[0_12px_40px_rgba(71,64,153,0.12)] hover:-translate-y-1 transition-all duration-500"
          >
            <div className="flex flex-col md:flex-row md:items-center gap-6">
              {/* STCE badge */}
              <div
                className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl text-white font-bold text-2xl"
                style={{ background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-600) 100%)' }}
              >
                STCE
              </div>
              <div className="flex-1">
                <h2
                  className="text-xl md:text-2xl font-bold text-[var(--text-accent)]"
                  style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
                >
                  {t.flagship.title}
                </h2>
                <p className="mt-2 text-[var(--color-neutral-700)] leading-relaxed">
                  {t.flagship.desc}
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-4 text-sm">
                  <span className="flex items-center gap-1.5 text-[var(--color-neutral-500)]">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><path d="M22 4L12 14.01l-3-3" /></svg>
                    ICF Accredited
                  </span>
                  <span className="text-[var(--color-neutral-500)]">{t.flagship.levels}</span>
                  <span className="text-[var(--color-neutral-500)]">{t.flagship.hours}</span>
                  <span className="text-[var(--color-primary)] font-medium group-hover:underline">
                    {t.flagship.cta} →
                  </span>
                </div>
              </div>
            </div>
          </a>
        </div>
      </Section>

      {/* Specialized programs */}
      <Section variant="white">
        <div className="text-center mb-10 animate-fade-up">
          <h2
            className="text-[1.75rem] md:text-[2.5rem] font-bold text-[var(--text-accent)]"
            style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
          >
            {t.specializedHeading}
          </h2>
          <p className="mt-3 text-[var(--text-muted)] max-w-lg mx-auto">
            {t.specializedSubtitle}
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-6 stagger-children">
          {t.specialized.map((prog) => (
            <a
              key={prog.href}
              href={`/${locale}${prog.href}`}
              className="group rounded-2xl bg-[var(--color-neutral-50)] p-6 hover:shadow-[0_12px_40px_rgba(71,64,153,0.10)] hover:-translate-y-1 transition-all duration-500 block"
            >
              <span className="inline-block text-[10px] font-semibold px-2.5 py-1 rounded-full bg-[var(--color-primary-50)] text-[var(--color-primary)] mb-4">
                {prog.tag}
              </span>
              <h3 className="text-lg font-bold text-[var(--text-accent)] mb-2">{prog.title}</h3>
              <p className="text-sm text-[var(--text-muted)] leading-relaxed mb-4">{prog.desc}</p>
              <span className="text-sm text-[var(--color-primary)] font-medium group-hover:underline">
                {prog.cta} →
              </span>
            </a>
          ))}
        </div>
      </Section>

      {/* Pathfinder CTA */}
      <section
        className="relative overflow-hidden py-16 md:py-20"
        style={{ background: 'linear-gradient(160deg, var(--color-primary-800) 0%, var(--color-primary-900) 100%)' }}
      >
        <GeometricPattern pattern="flower-of-life" opacity={0.06} fade="both" />
        <div className="relative z-10 mx-auto max-w-[var(--max-content-width)] px-4 md:px-6 text-center">
          <h2
            className="text-[1.75rem] md:text-[2.5rem] font-bold text-white"
            style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
          >
            {t.ctaTitle}
          </h2>
          <p className="mt-4 text-white/65 max-w-xl mx-auto">
            {t.ctaDesc}
          </p>
          <a
            href={`/${locale}/pathfinder/`}
            className="inline-flex items-center justify-center mt-8 rounded-xl bg-[var(--color-accent)] px-8 py-3.5 text-base font-semibold text-white min-h-[52px] hover:bg-[var(--color-accent-500)] transition-all duration-300 shadow-[0_4px_24px_rgba(244,126,66,0.35)]"
          >
            {t.ctaButton}
          </a>
        </div>
      </section>
    </main>
  );
}
