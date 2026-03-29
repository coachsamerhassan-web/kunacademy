import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { GeometricPattern } from '@kunacademy/ui/patterns';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';
import { Button } from '@kunacademy/ui/button';
import { TrustBar } from '@kunacademy/ui/trust-bar';
import { cms, contentGetter } from '@kunacademy/cms';
import { FlipCard } from '@/components/flip-card';
import { HeroSection } from '@/components/hero-section';
import { StatsSection } from '@/components/stats-section';
import { ProgramPathway } from '@/components/program-pathway';
import { FounderSection } from '@/components/founder-section';
import { CTASection } from '@/components/cta-section';
import { TestimonialsShowcase } from '@/components/testimonials-showcase';

interface Props { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const isAr = locale === 'ar';
  return {
    title: isAr
      ? 'أكاديمية كُن للكوتشينج | التفكير الحسّي® والكوتشينج المعتمد من ICF'
      : 'Kun Coaching Academy | Somatic Thinking® & ICF-Accredited Coaching',
    description: isAr
      ? 'أول أكاديمية عربية للتفكير الحسّي® والكوتشينج المعتمد من ICF. أكثر من ٥٠٠ كوتش في ١٣ دولة.'
      : 'The first Arab academy for Somatic Thinking® and ICF-accredited coaching. 500+ coaches across 13 countries.',
    openGraph: {
      title: isAr ? 'أكاديمية كُن للكوتشينج' : 'Kun Coaching Academy',
      description: isAr
        ? 'أول أكاديمية عربية للتفكير الحسّي® — ٥٠٠+ كوتش في ١٣ دولة'
        : 'The first Arab academy for Somatic Thinking® — 500+ coaches across 13 countries',
      images: [{ url: '/api/og?title=Kun%20Coaching%20Academy&subtitle=%D8%A3%D9%83%D8%A7%D8%AF%D9%8A%D9%85%D9%8A%D8%A9%20%D9%83%D9%8F%D9%86%20%D9%84%D9%84%D9%83%D9%88%D8%AA%D8%B4%D9%8A%D9%86%D8%AC&type=default', width: 1200, height: 630 }],
    },
    twitter: { card: 'summary_large_image' },
  };
}

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  // CMS: fetch page content from Sheet
  const sections = await cms.getPageContent('home');
  const t = contentGetter(sections, locale);

  // Fetch testimonials from CMS (Sheet 7: Testimonials)
  let cmsTestimonials: { id: string; authorName: string; content: string; program: string; role?: string; location?: string; photoUrl?: string; videoUrl?: string }[] = [];
  try {
    const rawTestimonials = await cms.getFeaturedTestimonials();
    cmsTestimonials = rawTestimonials
      .filter((t) => isAr ? !!t.content_ar : !!t.content_en)
      .map((t) => ({
        id: t.id,
        authorName: isAr ? t.name_ar : t.name_en,
        content: isAr ? t.content_ar : t.content_en,
        program: t.program,
        role: isAr ? t.role_ar : t.role_en,
        location: isAr ? t.location_ar : t.location_en,
        photoUrl: t.photo_url || undefined,
        videoUrl: t.video_url || undefined,
        countryCode: t.country_code || undefined,
      }));
  } catch {
    // CMS not configured yet — fallback data in component handles this
  }

  return (
    <>
      {/* ── HERO — Full-viewport with dark gradient overlay ── */}
      <HeroSection locale={locale} />

      {/* ── TRUST BAR ── */}
      <TrustBar locale={locale} />

      {/* ── PROGRAM PATHWAY — Tonal stacking with scroll animations ── */}
      <ProgramPathway locale={locale} />

      {/* ── STATS — Social proof numbers ── */}
      <StatsSection locale={locale} />

      {/* ── TREE NARRATIVE — Four growth phases as flip cards ── */}
      <Section variant="dark" pattern="girih">
        <div className="text-center mb-12">
          <Heading level={2} className="!text-white !text-[2rem] md:!text-[2.5rem]">
            {isAr ? 'مراحل النمو' : 'Stages of Growth'}
          </Heading>
          <p className="mt-3 text-white/60 max-w-xl mx-auto">
            {isAr
              ? 'كل رحلة تبدأ بجذور... وتمتد نحو أثر'
              : 'Every journey begins with roots... and extends toward impact'}
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 max-w-5xl mx-auto">
          <FlipCard
            locale={locale}
            variant="dark"
            icon={<span className="text-2xl">🌱</span>}
            title={isAr ? 'الجذور — الحضور' : 'Roots — Presence'}
            description={isAr
              ? 'كل رحلة مؤثرة تبدأ من تربة وعيك، من جذور نيّتك، من رسالة تنتظر أن تنمو بصوتك أنت.'
              : 'Every impactful journey begins from the soil of your awareness, from the roots of your intention.'}
          />
          <FlipCard
            locale={locale}
            variant="dark"
            icon={<span className="text-2xl">🌿</span>}
            title={isAr ? 'النمو — الثبات' : 'Growth — Steadiness'}
            description={isAr
              ? 'في كُنْ، لا نقدّم لك مجرد محتوى، بل منهجية متكاملة تنبع من تراثنا وتلامس عمق تجربتك.'
              : 'At Kun, we offer not just content, but an integrated methodology rooted in our heritage.'}
          />
          <FlipCard
            locale={locale}
            variant="dark"
            icon={<span className="text-2xl">🌳</span>}
            title={isAr ? 'الصلة — الامتداد' : 'Connection — Reach'}
            description={isAr
              ? 'أكثر من 500 كوتش تخرّجوا من كُنْ في 13 دولة — كل واحد منهم يحمل منهجية أصيلة.'
              : 'Over 500 coaches graduated from Kun across 13 countries — each with an authentic methodology.'}
          />
          <FlipCard
            locale={locale}
            variant="dark"
            icon={<span className="text-2xl">✨</span>}
            title={isAr ? 'الأثر — الإرث' : 'Impact — Legacy'}
            description={isAr
              ? 'كُنْ ليست مجرد أكاديمية، بل حركة تربوية معاصرة تعيد تعريف التربية من الداخل.'
              : 'Kun is not just an academy, but a contemporary movement redefining growth from within.'}
            href={`/${locale}/pathfinder`}
            ctaLabel={isAr ? 'ابدأ رحلتك' : 'Start Your Journey'}
          />
        </div>
      </Section>

      {/* ── FOUNDER — Editorial layout with real photo ── */}
      <FounderSection locale={locale} />
      {/* ── SOCIAL PROOF — Testimonials Showcase ── */}
      <TestimonialsShowcase locale={locale} testimonials={cmsTestimonials.length > 0 ? cmsTestimonials : undefined} />


      {/* ── CTA FOOTER — Dark with community image ── */}
      <CTASection locale={locale} />
    </>
  );
}
