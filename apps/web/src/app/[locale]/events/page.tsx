import { setRequestLocale } from 'next-intl/server';
import { cms } from '@kunacademy/cms/server';
import { Section } from '@kunacademy/ui/section';
import { GeometricPattern } from '@kunacademy/ui/patterns';
import { EventsGrid } from '@/components/events-grid';
import type { Metadata } from 'next';

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const isAr = locale === 'ar';
  return {
    title: isAr ? 'الفعاليات | أكاديمية كُن' : 'Events | Kun Academy',
    description: isAr
      ? 'ورش عمل، ندوات، ولقاءات مباشرة من أكاديمية كُن'
      : 'Workshops, webinars, and live gatherings from Kun Academy',
  };
}

export default async function EventsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  // ── Load events + programs (for logo resolution) ───────────────────────────
  const [allEvents, allPrograms] = await Promise.all([
    cms.getAllEvents(),
    cms.getAllPrograms(),
  ]);

  // Build a slug → program_logo lookup
  const logoBySlug: Record<string, string> = {};
  for (const prog of allPrograms) {
    if (prog.slug && prog.program_logo) {
      logoBySlug[prog.slug] = prog.program_logo;
    }
  }

  // Sort by date ascending
  const sorted = [...allEvents].sort((a, b) =>
    a.date_start.localeCompare(b.date_start)
  );

  const today = new Date().toISOString().split('T')[0]; // "2026-04-06"
  const upcoming = sorted.filter((e) => e.date_start >= today);
  const past = sorted
    .filter((e) => e.date_start < today)
    .reverse(); // most-recent first

  // Enrich events with resolved program_logo from the programs CMS
  function enrich(events: typeof sorted) {
    return events.map((e) => ({
      ...e,
      program_logo: e.program_slug ? (logoBySlug[e.program_slug] ?? undefined) : undefined,
    }));
  }

  const headingFont = isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)';
  const dir = isAr ? 'rtl' : 'ltr';

  return (
    <main dir={dir}>

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section
        className="relative py-20 md:py-28"
        style={{ background: 'var(--color-background)' }}
      >
        {/* Very faint geometric texture */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.06]" aria-hidden="true">
          <GeometricPattern pattern="flower-of-life" opacity={1} fade="both" />
        </div>

        {/* Warm horizontal rule */}
        <div
          className="absolute bottom-0 left-0 right-0 h-px"
          style={{
            background: 'linear-gradient(to right, transparent, var(--color-primary), transparent)',
            opacity: 0.25,
          }}
          aria-hidden="true"
        />

        <div className="relative z-10 mx-auto max-w-5xl px-6 text-center">
          {/* Overline */}
          <p
            className="text-xs tracking-[0.25em] uppercase mb-5 font-medium"
            style={{ color: 'var(--color-accent)' }}
          >
            {isAr ? 'كُن · أكاديمية الكوتشينج' : 'Kun Coaching Academy'}
          </p>

          <h1
            className="text-[2.5rem] md:text-[3.75rem] font-bold leading-[1.15] text-[var(--text-primary)]"
            style={{ fontFamily: headingFont }}
          >
            {isAr ? 'الفعاليات' : 'Events'}
          </h1>

          <p
            className="mt-5 text-lg md:text-xl max-w-xl mx-auto leading-relaxed"
            style={{ color: 'var(--text-muted)' }}
          >
            {isAr
              ? 'ورش عمل، ندوات، ولقاءات مباشرة من أكاديمية كُن'
              : 'Workshops, webinars, and live gatherings from Kun Academy'}
          </p>
        </div>
      </section>

      {/* ── EVENTS GRID ──────────────────────────────────────────────────── */}
      <Section variant="white">
        <div className="mx-auto max-w-5xl px-6">
          <EventsGrid
            upcoming={enrich(upcoming)}
            past={enrich(past)}
            locale={locale}
            isAr={isAr}
            headingFont={headingFont}
          />
        </div>
      </Section>

    </main>
  );
}
