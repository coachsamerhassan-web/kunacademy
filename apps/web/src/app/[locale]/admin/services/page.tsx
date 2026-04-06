import { cms } from '@kunacademy/cms/server';
import { setRequestLocale } from 'next-intl/server';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';
import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import type { Service } from '@kunacademy/cms';
import { ServicesMatrix } from './services-matrix';
import servicesData from '@/../../data/cms/services.json';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Service × Coach Matrix | Admin',
};

export default async function AdminServicesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Load coaches from CMS (live source — Sheets or JSON fallback)
  const coaches = await cms.getBookableCoaches();

  // Load services directly from local JSON (static source of truth)
  const services = (servicesData as Service[]).filter(s => s.published);

  return (
    <main>
      <Section variant="white">
        {/* Header */}
        <div className="flex items-start justify-between mb-6 gap-4">
          <div>
            <Heading level={1}>Service × Coach Matrix</Heading>
            <p className="mt-1 text-sm text-[var(--color-neutral-500)]">
              {services.length} services · {coaches.length} bookable coaches
            </p>
          </div>
          <a
            href={`/${locale}/admin`}
            className="flex items-center gap-1 text-sm text-[var(--color-primary)] hover:underline whitespace-nowrap mt-1"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            Dashboard
          </a>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 mb-4 text-xs text-[var(--color-neutral-500)]">
          <span className="flex items-center gap-1.5">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-100 text-green-700 font-bold">✓</span>
            Eligible
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-50 text-red-400">—</span>
            Not eligible
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block rounded-full bg-purple-100 text-purple-700 px-2 py-0.5 font-medium">= level</span>
            Exact level required
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block rounded-full bg-sky-100 text-sky-700 px-2 py-0.5 font-medium">≥ level</span>
            Minimum level required
          </span>
        </div>

        {/* Matrix */}
        <ServicesMatrix coaches={coaches} services={services} />

        {/* Footer note */}
        <p className="mt-4 text-xs text-[var(--color-neutral-400)]">
          Qualification uses <strong>kun_level</strong> when set, falling back to <strong>coach_level</strong> (ICF credential).
          Kun levels: basic &lt; professional &lt; expert &lt; master.
          ICF levels: ACC &lt; PCC &lt; MCC.
        </p>
      </Section>
    </main>
  );
}
