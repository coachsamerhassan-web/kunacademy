'use client';

import { use, useEffect, useState } from 'react';
import { Section } from '@kunacademy/ui/section';
import { Card } from '@kunacademy/ui/card';
import { LpForm, type LpFormState } from '@/components/lp/admin-lp-form';

interface LeadRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  message: string | null;
  locale: string;
  utm_source: string | null;
  utm_campaign: string | null;
  zoho_synced: boolean;
  created_at: string;
}

export default function AdminLpEditPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = use(params);
  const isAr = locale === 'ar';
  const headingFont = isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)';

  const [initial, setInitial] = useState<LpFormState | null>(null);
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/admin/lp/${id}`)
      .then(async (r) => {
        if (!r.ok) {
          const b = await r.json().catch(() => ({}));
          setError(b.error || `HTTP ${r.status}`);
          return;
        }
        const b = await r.json();
        const lp = b.landing_page;
        const stringify = (v: unknown) =>
          v == null ? '' : typeof v === 'string' ? v : JSON.stringify(v, null, 2);
        setInitial({
          id: lp.id,
          slug: lp.slug,
          page_type: lp.page_type,
          published: !!lp.published,
          launch_lock: !!lp.launch_lock,
          composition_json: stringify(lp.composition_json),
          lead_capture_config: stringify(lp.lead_capture_config),
          payment_config: stringify(lp.payment_config),
          analytics_config: stringify(lp.analytics_config),
          seo_meta_json: stringify(lp.seo_meta_json),
          program_slug: lp.program_slug ?? '',
        });
        setLeads(b.recent_leads ?? []);
      })
      .catch(() => setError(isAr ? 'فشل التحميل' : 'Failed to load'));
  }, [id, isAr]);

  if (error) {
    return (
      <Section variant="white">
        <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-red-800">{error}</div>
      </Section>
    );
  }
  if (!initial) {
    return (
      <Section variant="white">
        <p className="text-[var(--color-neutral-500)]">{isAr ? 'جارٍ التحميل…' : 'Loading…'}</p>
      </Section>
    );
  }

  return (
    <Section variant="white">
      <div dir={isAr ? 'rtl' : 'ltr'}>
        <div className="mb-6">
          <a
            href={`/${locale}/admin/lp`}
            className="text-sm text-[var(--color-neutral-500)] hover:text-[var(--color-primary)]"
          >
            {isAr ? '← القائمة' : '← Back to list'}
          </a>
        </div>
        <h1
          className="text-2xl md:text-3xl font-bold text-[var(--text-primary)] mb-2"
          style={{ fontFamily: headingFont }}
        >
          {isAr ? 'تعديل: ' : 'Edit: '}
          <span className="font-mono">{initial.slug}</span>
        </h1>
        <p className="text-[var(--color-neutral-600)] mb-8">
          /{locale}/lp/{initial.slug}
        </p>

        <LpForm locale={locale} mode="edit" initial={initial} />

        {/* Recent leads */}
        <div className="mt-12">
          <h2
            className="text-xl md:text-2xl font-bold text-[var(--text-primary)] mb-4"
            style={{ fontFamily: headingFont }}
          >
            {isAr ? 'العملاء الأخيرون' : 'Recent Leads'}{' '}
            <span className="text-sm text-[var(--color-neutral-500)] font-normal">
              ({leads.length})
            </span>
          </h2>
          {leads.length === 0 ? (
            <Card className="p-6 text-center text-[var(--color-neutral-500)]">
              {isAr ? 'لا توجد عملاء بعد.' : 'No leads yet.'}
            </Card>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-[var(--color-neutral-100)] bg-white">
              <table className="min-w-full text-sm">
                <thead className="bg-[var(--color-primary-50)]/50">
                  <tr>
                    <th className="px-4 py-3 text-start">{isAr ? 'الاسم' : 'Name'}</th>
                    <th className="px-4 py-3 text-start">{isAr ? 'البريد' : 'Email'}</th>
                    <th className="px-4 py-3 text-start">{isAr ? 'الهاتف' : 'Phone'}</th>
                    <th className="px-4 py-3 text-start">{isAr ? 'حملة' : 'Campaign'}</th>
                    <th className="px-4 py-3 text-start">{isAr ? 'Zoho' : 'Zoho'}</th>
                    <th className="px-4 py-3 text-start">{isAr ? 'متى' : 'When'}</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((l) => (
                    <tr
                      key={l.id}
                      className="border-t border-[var(--color-neutral-100)]"
                    >
                      <td className="px-4 py-3 font-medium">{l.name}</td>
                      <td className="px-4 py-3"><a href={`mailto:${l.email}`} className="text-[var(--color-primary)] hover:underline">{l.email}</a></td>
                      <td className="px-4 py-3">{l.phone || '—'}</td>
                      <td className="px-4 py-3 text-[var(--color-neutral-500)]">{l.utm_campaign || '—'}</td>
                      <td className="px-4 py-3">
                        {l.zoho_synced ? <span className="text-green-700">✓</span> : <span className="text-[var(--color-neutral-400)]">…</span>}
                      </td>
                      <td className="px-4 py-3 text-[var(--color-neutral-500)] text-xs whitespace-nowrap">
                        {new Date(l.created_at).toLocaleString(isAr ? 'ar-EG' : 'en-US', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Section>
  );
}
