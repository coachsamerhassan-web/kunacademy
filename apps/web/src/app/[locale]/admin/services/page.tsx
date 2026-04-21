import { cms } from '@kunacademy/cms/server';
import { setRequestLocale } from 'next-intl/server';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';
import { ArrowLeft, Pencil, Plus } from 'lucide-react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { ServicesMatrix } from './services-matrix';

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
  const isAr = locale === 'ar';

  // Load coaches + services from CMS (DbContentProvider when DATABASE_URL set, JSON fallback otherwise).
  // Phase 2a (CMS→DB): services is now DB-backed; dropped the direct services.json import.
  const [coaches, services] = await Promise.all([
    cms.getBookableCoaches(),
    cms.getAllServices(),
  ]);

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
          <div className="flex items-center gap-3">
            <Link
              href={`/${locale}/admin/services/list`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-neutral-200)] px-3 py-1.5 text-sm text-[var(--text-primary)] hover:bg-[var(--color-neutral-50)]"
            >
              <Pencil className="w-4 h-4" aria-hidden="true" />
              {isAr ? 'تعديل الخدمات' : 'Edit Services'}
            </Link>
            <Link
              href={`/${locale}/admin/services/new`}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-primary)] text-white px-3 py-1.5 text-sm hover:opacity-90"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              {isAr ? 'إضافة خدمة' : 'New Service'}
            </Link>
            <a
              href={`/${locale}/admin`}
              className="flex items-center gap-1 text-sm text-[var(--color-primary)] hover:underline whitespace-nowrap"
            >
              <ArrowLeft className="w-4 h-4" aria-hidden="true" />
              {isAr ? 'لوحة الإدارة' : 'Dashboard'}
            </a>
          </div>
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
          Qualification uses <strong>kun_level</strong>.
          Kun levels: basic &lt; professional &lt; expert &lt; master.
          ICF credential tracked separately in <strong>icf_credential</strong>.
        </p>
      </Section>
    </main>
  );
}
