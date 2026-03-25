import { setRequestLocale } from 'next-intl/server';
import { GeometricPattern } from '@kunacademy/ui/patterns';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';
import { Button } from '@kunacademy/ui/button';
import { TrustBar } from '@kunacademy/ui/trust-bar';
import { cms, contentGetter } from '@kunacademy/cms';
import { TreeNarrative, TreePhase } from '@/components/tree-narrative';
import { HeroSection } from '@/components/hero-section';
import { StatsSection } from '@/components/stats-section';
import { ProgramPathway } from '@/components/program-pathway';
import { FounderSection } from '@/components/founder-section';
import { CTASection } from '@/components/cta-section';
import { TestimonialsShowcase } from '@/components/testimonials-showcase';

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
    cmsTestimonials = rawTestimonials.map((t) => ({
      id: t.id,
      authorName: isAr ? t.name_ar : t.name_en,
      content: isAr ? t.content_ar : t.content_en,
      program: t.program,
      role: isAr ? t.role_ar : t.role_en,
      location: isAr ? t.location_ar : t.location_en,
      photoUrl: t.photo_url || undefined,
      videoUrl: t.video_url || undefined,
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

      {/* ── TREE NARRATIVE — Growing through sections ── */}
      <TreeNarrative imageSrc="/images/tree/olive-tree.jpg">
        <TreePhase phase="roots" align="start">
          <p className="text-sm font-semibold text-white/70 mb-2 tracking-wider uppercase">
            {isAr ? 'الجذور — الحضور' : 'Roots — Presence'}
          </p>
          <h2 className="text-[1.75rem] md:text-[2.5rem] font-bold text-white leading-tight">
            {isAr ? 'الحضور يبدأ من الداخل' : 'Presence begins within'}
          </h2>
          <p className="mt-4 text-white/80 leading-relaxed">
            {isAr
              ? 'كل رحلة مؤثرة تبدأ من تربة وعيك، من جذور نيّتك، من رسالة تنتظر أن تنمو بصوتك أنت.'
              : 'Every impactful journey begins from the soil of your awareness, from the roots of your intention.'}
          </p>
        </TreePhase>

        <TreePhase phase="trunk" align="end">
          <p className="text-sm font-semibold text-white/70 mb-2 tracking-wider uppercase">
            {isAr ? 'النمو — الثبات' : 'Growth — Steadiness'}
          </p>
          <h2 className="text-[1.75rem] md:text-[2.5rem] font-bold text-white leading-tight">
            {isAr ? 'بالثبات تنمو الشجرة' : 'With steadiness, the tree grows'}
          </h2>
          <p className="mt-4 text-white/80 leading-relaxed">
            {isAr
              ? 'في كُنْ، لا نقدّم لك مجرد محتوى، بل منهجية متكاملة تنبع من تراثنا وتلامس عمق تجربتك.'
              : 'At Kun, we offer not just content, but an integrated methodology rooted in our heritage.'}
          </p>
        </TreePhase>

        <TreePhase phase="branches" align="start">
          <p className="text-sm font-semibold text-white/70 mb-2 tracking-wider uppercase">
            {isAr ? 'الصلة — الامتداد' : 'Connection — Reach'}
          </p>
          <h2 className="text-[1.75rem] md:text-[2.5rem] font-bold text-white leading-tight">
            {isAr ? 'يمتد أثرك ليلامس من حولك' : 'Your impact extends to those around you'}
          </h2>
          <p className="mt-4 text-white/80 leading-relaxed">
            {isAr
              ? 'أكثر من 500 كوتش تخرّجوا من كُنْ عبر 4 قارات — كل واحد منهم يحمل منهجية أصيلة.'
              : 'Over 500 coaches graduated from Kun across 4 continents — each with an authentic methodology.'}
          </p>
        </TreePhase>

        <TreePhase phase="canopy" align="end">
          <p className="text-sm font-semibold text-white/70 mb-2 tracking-wider uppercase">
            {isAr ? 'الأثر — الإرث' : 'Impact — Legacy'}
          </p>
          <h2 className="text-[1.75rem] md:text-[2.5rem] font-bold text-white leading-tight">
            {isAr ? 'إزرع جذورك... لتنمو بلا حدود' : 'Plant your roots... to grow without limits'}
          </h2>
          <p className="mt-4 text-white/80 leading-relaxed">
            {isAr
              ? 'كُنْ ليست مجرد أكاديمية، بل حركة تربوية معاصرة تعيد تعريف التربية من الداخل.'
              : 'Kun is not just an academy, but a contemporary movement redefining growth from within.'}
          </p>
          <div className="mt-6">
            <a
              href={`/${locale}/pathfinder/`}
              className="inline-flex items-center justify-center rounded-xl bg-[var(--color-accent)] px-8 py-3.5 text-base font-semibold text-white min-h-[44px] hover:bg-[var(--color-accent-500)] transition-all duration-300 hover:shadow-[0_8px_24px_rgba(244,126,66,0.35)] hover:scale-[1.02] active:scale-[0.98]"
            >
              {isAr ? 'ابدأ رحلتك' : 'Start Your Journey'}
            </a>
          </div>
        </TreePhase>
      </TreeNarrative>

      {/* ── FOUNDER — Editorial layout with real photo ── */}
      <FounderSection locale={locale} />
      {/* ── SOCIAL PROOF — Testimonials Showcase ── */}
      <TestimonialsShowcase locale={locale} testimonials={cmsTestimonials.length > 0 ? cmsTestimonials : undefined} />


      {/* ── CTA FOOTER — Dark with community image ── */}
      <CTASection locale={locale} />
    </>
  );
}
