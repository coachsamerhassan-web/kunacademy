import { setRequestLocale } from 'next-intl/server';
import { Section } from '@kunacademy/ui/section';
import { GeometricPattern } from '@kunacademy/ui/patterns';
import { Card } from '@kunacademy/ui/card';
import type { Metadata } from 'next';

interface Props { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const isAr = locale === 'ar';
  return {
    title: isAr ? 'المُرشد | أكاديمية كُن' : 'Pathfinder | Kun Academy',
    description: isAr
      ? 'اكتشف المسار الأنسب لك في أكاديمية كُن — أجب على أسئلة بسيطة واحصل على توصية مخصصة'
      : 'Discover your ideal path at Kun Academy — answer simple questions and get a personalized recommendation',
  };
}

const paths = [
  {
    slug: 'coaching/individual',
    titleAr: 'أبحث عن كوتشينج شخصي',
    titleEn: 'I\'m looking for personal coaching',
    descAr: 'جلسة فردية مع كوتش معتمد — لحل تحدٍّ محدد أو لاكتشاف الذات',
    descEn: 'A 1:1 session with a certified coach — to solve a specific challenge or explore yourself',
    iconPath: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
    color: 'var(--color-accent)',
    bgColor: 'rgba(244, 126, 66, 0.08)',
  },
  {
    slug: 'academy/certifications/stce',
    titleAr: 'أريد أن أصبح كوتشًا معتمدًا',
    titleEn: 'I want to become a certified coach',
    descAr: 'برنامج STCE — ٥ مستويات من ٢٤٠ ساعة تدريبية معتمدة من ICF',
    descEn: 'STCE Program — 5 levels of 240 accredited hours approved by ICF',
    iconPath: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
    color: 'var(--color-primary)',
    bgColor: 'var(--color-primary-50)',
  },
  {
    slug: 'academy/intro',
    titleAr: 'أريد تجربة التفكير الحسّي أولاً',
    titleEn: 'I want to try Somatic Thinking first',
    descAr: 'الدورة التمهيدية STI — ٦ ساعات مسجّلة بسعر رمزي كنقطة بداية',
    descEn: 'STI Introductory Course — 6 recorded hours at an accessible price as a starting point',
    iconPath: 'M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    color: '#2D8A6F',
    bgColor: 'rgba(45, 138, 111, 0.08)',
  },
  {
    slug: 'coaching/corporate',
    titleAr: 'أبحث عن حلول لمؤسستي',
    titleEn: 'I\'m looking for corporate solutions',
    descAr: 'كوتشينج تنفيذي وورش فرق وبرامج تحوّل مؤسسي',
    descEn: 'Executive coaching, team workshops, and organizational transformation programs',
    iconPath: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
    color: 'var(--color-primary-600)',
    bgColor: 'var(--color-primary-50)',
  },
  {
    slug: 'academy/certifications',
    titleAr: 'أنا كوتش وأريد شهادة متخصصة',
    titleEn: 'I\'m a coach seeking a specialized certification',
    descAr: 'شهادات في الأطباء والمدراء والعائلات — تبني على أساس STCE',
    descEn: 'Certifications for doctors, managers, and families — building on STCE',
    iconPath: 'M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z',
    color: 'var(--color-secondary)',
    bgColor: 'var(--color-secondary-50)',
  },
  {
    slug: 'blog',
    titleAr: 'أريد أن أتعلّم وأقرأ أولاً',
    titleEn: 'I just want to learn and read first',
    descAr: 'مقالات مجانية في التفكير الحسّي والكوتشينج والنمو المهني',
    descEn: 'Free articles on Somatic Thinking, coaching, and professional growth',
    iconPath: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
    color: 'var(--color-neutral-600)',
    bgColor: 'var(--color-neutral-50)',
  },
];

export default async function PathfinderPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  return (
    <main>
      {/* Hero */}
      <section className="relative overflow-hidden py-16 md:py-28">
        <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, var(--color-primary) 0%, #1D1A3D 100%)' }} />
        <GeometricPattern pattern="flower-of-life" opacity={0.06} fade="both" />
        <div className="relative z-10 mx-auto max-w-[var(--max-content-width)] px-4 md:px-6 text-center animate-fade-up">
          <p className="text-[var(--color-accent)] font-medium text-sm uppercase tracking-wider mb-4">
            {isAr ? 'المُرشد' : 'Pathfinder'}
          </p>
          <h1
            className="text-[2.5rem] md:text-[4rem] font-bold text-[#FFF5E9] leading-[1.05]"
            style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
          >
            {isAr ? 'من وين تبدأ؟' : 'Where Do You Start?'}
          </h1>
          <p className="mt-6 text-white/70 max-w-xl mx-auto text-lg md:text-xl leading-relaxed">
            {isAr
              ? 'اختر ما يصف حالتك — وسنوجّهك للمسار الأنسب'
              : 'Choose what describes your situation — and we\'ll guide you to the right path'}
          </p>
        </div>
      </section>

      {/* Paths */}
      <Section variant="white">
        <div className="max-w-3xl mx-auto space-y-4">
          {paths.map((path) => (
            <a key={path.slug} href={`/${locale}/${path.slug}`} className="group block">
              <Card accent className="p-5 transition-all duration-300 group-hover:shadow-[0_8px_32px_rgba(71,64,153,0.1)] group-hover:-translate-y-0.5">
                <div className="flex items-center gap-5">
                  <div
                    className="shrink-0 h-14 w-14 rounded-2xl flex items-center justify-center"
                    style={{ backgroundColor: path.bgColor }}
                  >
                    <svg className="w-6 h-6" style={{ color: path.color }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d={path.iconPath} />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-base md:text-lg font-bold text-[var(--text-primary)] group-hover:text-[var(--color-primary)] transition-colors">
                      {isAr ? path.titleAr : path.titleEn}
                    </h2>
                    <p className="text-sm text-[var(--color-neutral-600)] mt-0.5 line-clamp-1">
                      {isAr ? path.descAr : path.descEn}
                    </p>
                  </div>
                  <svg className="shrink-0 w-5 h-5 text-[var(--color-neutral-400)] group-hover:text-[var(--color-primary)] transition-colors rtl:rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </div>
              </Card>
            </a>
          ))}
        </div>
      </Section>

      {/* Help */}
      <Section variant="surface">
        <div className="text-center py-4">
          <p className="text-[var(--color-neutral-600)] mb-4">
            {isAr
              ? 'لسّا مش متأكد؟ تواصل معنا وسنساعدك نختار'
              : 'Still not sure? Contact us and we\'ll help you choose'}
          </p>
          <a
            href="https://wa.me/971501234567"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-xl bg-green-600 px-6 py-3 text-sm font-semibold text-white min-h-[48px] hover:bg-green-700 transition-all duration-300"
          >
            {isAr ? 'تواصل عبر واتساب' : 'Chat on WhatsApp'}
          </a>
        </div>
      </Section>
    </main>
  );
}
