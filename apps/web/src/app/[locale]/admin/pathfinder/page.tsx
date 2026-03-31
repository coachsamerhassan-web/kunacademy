'use client';

import { useAuth } from '@kunacademy/auth';
import { useEffect, useState } from 'react';
import { createBrowserClient } from '@kunacademy/db';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

interface PathfinderResponse {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  type: 'individual' | 'corporate';
  journey_stage: string | null;
  locale: string | null;
  created_at: string;
  recommendations: Array<{ slug: string; category: string; match_pct: number }>;
}

const typeColors: Record<string, string> = {
  individual: 'bg-blue-100 text-blue-700',
  corporate: 'bg-purple-100 text-purple-700',
};

const stageColors: Record<string, string> = {
  explorer: 'bg-gray-100 text-gray-600',
  seeker: 'bg-yellow-100 text-yellow-700',
  practitioner: 'bg-orange-100 text-orange-700',
  master: 'bg-green-100 text-green-700',
};

const stageLabels: Record<string, { ar: string; en: string }> = {
  explorer: { ar: 'مستكشف', en: 'Explorer' },
  seeker: { ar: 'باحث', en: 'Seeker' },
  practitioner: { ar: 'ممارس', en: 'Practitioner' },
  master: { ar: 'متمكّن', en: 'Master' },
};

export default function AdminPathfinderPage() {
  const { locale } = useParams<{ locale: string }>();
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const [responses, setResponses] = useState<PathfinderResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const isAr = locale === 'ar';

  useEffect(() => {
    if (authLoading) return;
    if (!user || profile?.role !== 'admin') {
      router.push('/' + locale + '/auth/login');
      return;
    }
    const supabase = createBrowserClient() as any;
    (supabase
      .from('pathfinder_responses')
      .select('id, name, email, phone, type, journey_stage, locale, created_at, recommendations')
      .order('created_at', { ascending: false })
      .limit(500) as Promise<{ data: PathfinderResponse[] | null; error: unknown }>)
      .then(({ data }) => {
        setResponses(data ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [user, profile, authLoading, locale, router]);

  const filtered = responses.filter((r) => {
    if (filter !== 'all' && r.type !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        r.name.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q) ||
        (r.phone?.includes(search) ?? false)
      );
    }
    return true;
  });

  if (authLoading || loading) {
    return (
      <Section>
        <p className="text-center py-12">{isAr ? 'جارٍ التحميل...' : 'Loading...'}</p>
      </Section>
    );
  }

  return (
    <main>
      <Section variant="white">
        <div className="flex items-center justify-between mb-6">
          <div>
            <Heading level={1}>{isAr ? 'تقييمات المُرشد' : 'Pathfinder Leads'}</Heading>
            <p className="mt-1 text-sm text-[var(--color-neutral-500)]">
              {responses.length} {isAr ? 'تقييم' : 'assessments'}
            </p>
          </div>
          <a
            href={'/' + locale + '/admin'}
            className="text-[var(--color-primary)] text-sm hover:underline flex items-center gap-1"
          >
            <ArrowLeft className="w-4 h-4 rtl:rotate-180" aria-hidden="true" />
            {isAr ? 'لوحة الإدارة' : 'Dashboard'}
          </a>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6">
          <div className="flex gap-2">
            {(['all', 'individual', 'corporate'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setFilter(t)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  filter === t
                    ? 'bg-[var(--color-primary)] text-white'
                    : 'bg-[var(--color-neutral-100)] text-[var(--color-neutral-600)] hover:bg-[var(--color-neutral-200)]'
                }`}
              >
                {t === 'all'
                  ? (isAr ? 'الكل' : 'All')
                  : t === 'individual'
                  ? (isAr ? 'أفراد' : 'Individual')
                  : (isAr ? 'شركات' : 'Corporate')}
                {t !== 'all' && ` (${responses.filter((r) => r.type === t).length})`}
              </button>
            ))}
          </div>
          <input
            type="text"
            placeholder={isAr ? 'بحث بالاسم أو الإيميل...' : 'Search by name or email...'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 min-w-[200px] px-3 py-1.5 rounded-lg border border-[var(--color-neutral-200)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
          />
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-xl border border-[var(--color-neutral-200)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--color-neutral-50)] border-b border-[var(--color-neutral-200)]">
                <th className="px-4 py-3 text-start font-medium text-[var(--color-neutral-500)]">
                  {isAr ? 'الاسم' : 'Name'}
                </th>
                <th className="px-4 py-3 text-start font-medium text-[var(--color-neutral-500)]">
                  {isAr ? 'البريد' : 'Email'}
                </th>
                <th className="px-4 py-3 text-start font-medium text-[var(--color-neutral-500)]">
                  {isAr ? 'النوع' : 'Type'}
                </th>
                <th className="px-4 py-3 text-start font-medium text-[var(--color-neutral-500)]">
                  {isAr ? 'المرحلة' : 'Stage'}
                </th>
                <th className="px-4 py-3 text-start font-medium text-[var(--color-neutral-500)]">
                  {isAr ? 'التوصية الأولى' : 'Top Rec'}
                </th>
                <th className="px-4 py-3 text-start font-medium text-[var(--color-neutral-500)]">
                  {isAr ? 'التاريخ' : 'Date'}
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-[var(--color-neutral-400)]">
                    {isAr ? 'لا توجد تقييمات' : 'No assessments found'}
                  </td>
                </tr>
              ) : (
                filtered.map((r) => {
                  const topRec = r.recommendations?.[0];
                  const stage = r.journey_stage ?? 'explorer';
                  const stageColor = stageColors[stage] || stageColors.explorer;
                  const stageLabel = isAr
                    ? stageLabels[stage]?.ar ?? stage
                    : stageLabels[stage]?.en ?? stage;
                  const typeColor = typeColors[r.type] || 'bg-gray-100 text-gray-600';
                  const dateStr = new Date(r.created_at).toLocaleDateString(isAr ? 'ar-SA' : 'en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  });

                  return (
                    <tr
                      key={r.id}
                      className="border-b border-[var(--color-neutral-100)] hover:bg-[var(--color-neutral-50)]"
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-[var(--text-primary)]">{r.name}</div>
                        {r.phone && (
                          <div className="text-xs text-[var(--color-neutral-400)]">{r.phone}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[var(--color-neutral-600)] text-xs">{r.email}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${typeColor}`}>
                          {r.type === 'individual' ? (isAr ? 'فردي' : 'Individual') : (isAr ? 'مؤسسي' : 'Corporate')}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${stageColor}`}>
                          {stageLabel}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-[var(--color-neutral-600)]">
                        {topRec ? (
                          <span>
                            {topRec.slug}
                            <span className="ms-1 text-[var(--color-neutral-400)]">
                              ({topRec.match_pct}%)
                            </span>
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-[var(--color-neutral-500)]">{dateStr}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Section>
    </main>
  );
}
