import { setRequestLocale } from 'next-intl/server';
import { GeometricPattern } from '@kunacademy/ui/patterns';
import type { Metadata } from 'next';
import { cms } from '@kunacademy/cms/server';
import { TestimonialsGrid } from './testimonials-grid';

interface Props { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const isAr = locale === 'ar';
  return {
    title: isAr ? 'آراء المتدربين | أكاديمية كُن' : 'Testimonials | Kun Academy',
    description: isAr
      ? 'تجارب حقيقية من أكثر من ٥٠٠ كوتش تخرّجوا من أكاديمية كُن عبر منهجية التفكير الحسّي®'
      : 'Real experiences from 500+ coaches who transformed their practice through Somatic Thinking®.',
  };
}

export default async function TestimonialsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  // Fetch all testimonials from CMS, filtered by language
  let testimonials: {
    id: string;
    authorName: string;
    content: string;
    program: string;
    role?: string;
    videoUrl?: string;
    countryCode?: string;
  }[] = [];

  try {
    const raw = await cms.getAllTestimonials();
    testimonials = raw
      .filter((t) => isAr ? !!t.content_ar : !!t.content_en)
      .map((t) => ({
        id: t.id,
        authorName: isAr ? t.name_ar : t.name_en,
        content: isAr ? t.content_ar : t.content_en,
        program: t.program,
        role: isAr ? t.role_ar : t.role_en,
        videoUrl: t.video_url || undefined,
        countryCode: t.country_code || undefined,
      }));
  } catch {
    // CMS not available — empty state handled in component
  }

  return (
    <main>
      {/* Hero */}
      <section
        className="relative overflow-hidden py-16 md:py-24"
        style={{ background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-600) 100%)' }}
      >
        <GeometricPattern pattern="girih" opacity={0.08} fade="both" />
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[20rem] leading-none text-white/[0.04] font-serif pointer-events-none select-none"
          aria-hidden="true"
        >
          &ldquo;
        </div>
        <div className="relative z-10 mx-auto max-w-[var(--max-content-width)] px-4 md:px-6 text-center animate-fade-up">
          <h1
            className="text-[2.25rem] md:text-[3.5rem] font-bold text-[#FFF5E9] leading-[1.1]"
            style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
          >
            {isAr ? 'الأثر لا يُقال... يُعاش' : "Impact isn't told. It's lived."}
          </h1>
          <p className="mt-4 text-white/65 max-w-lg mx-auto text-lg md:text-xl">
            {isAr ? 'تجارب حقيقية من خرّيجي أكاديمية كُن' : 'Real experiences from Kun Academy graduates'}
          </p>
          {/* Authority stats */}
          <div className="flex flex-wrap items-center justify-center gap-4 md:gap-6 mt-6 text-sm">
            <span>
              <strong className="text-[#FFF5E9]">{isAr ? '٥٠٠+' : '500+'}</strong>{' '}
              <span className="text-white/60">{isAr ? 'كوتش' : 'coaches'}</span>
            </span>
            <span className="w-px h-4 bg-white/20" aria-hidden="true" />
            <span>
              <strong className="text-[#FFF5E9]">{isAr ? '١٣' : '13'}</strong>{' '}
              <span className="text-white/60">{isAr ? 'دولة' : 'countries'}</span>
            </span>
            <span className="w-px h-4 bg-white/20" aria-hidden="true" />
            <span>
              <strong className="text-[#FFF5E9]">ICF</strong>{' '}
              <span className="text-white/60">{isAr ? 'اعتماد دولي' : 'accredited'}</span>
            </span>
          </div>
        </div>
      </section>

      {/* Testimonials grid with Load More */}
      <section
        className="py-[var(--section-padding-mobile)] md:py-[var(--section-padding)]"
        style={{ background: 'var(--color-surface-high, #f0e7db)' }}
      >
        <div className="mx-auto max-w-[var(--max-content-width)] px-4 md:px-6">
          <TestimonialsGrid testimonials={testimonials} locale={locale} />
        </div>
      </section>
    </main>
  );
}
