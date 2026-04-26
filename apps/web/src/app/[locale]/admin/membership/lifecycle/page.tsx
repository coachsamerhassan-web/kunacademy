'use client';

/**
 * /[locale]/admin/membership/lifecycle — Wave F.6
 *
 * Admin observability for membership lifecycle:
 *   - Dunning queue (past_due members)
 *   - Upcoming cancellations (cancel_at set)
 *   - Recent grace sweeps
 *   - Recent reminders + dunning emails + win-back history
 *
 * CSV export per section.
 */

import { use, useEffect, useState } from 'react';
import { Section } from '@kunacademy/ui/section';

interface DunningRow {
  membership_id: string;
  email: string | null;
  full_name_ar: string | null;
  full_name_en: string | null;
  status: string;
  current_period_end: string | null;
  tier_slug: string;
}

interface UpcomingCancelRow {
  membership_id: string;
  email: string | null;
  full_name_ar: string | null;
  full_name_en: string | null;
  cancel_at: string;
  cancel_reason: string | null;
  tier_slug: string;
}

interface LifecycleEventRow {
  id: string;
  membership_id: string;
  user_id: string | null;
  event_type: string;
  send_key: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
  email: string | null;
}

interface ApiPayload {
  dunning: DunningRow[];
  upcoming_cancels: UpcomingCancelRow[];
  grace_sweeps: LifecycleEventRow[];
  recent_reminders: LifecycleEventRow[];
  counts: {
    dunning: number;
    upcoming_cancels: number;
    grace_sweeps: number;
    recent_reminders: number;
  };
}

function fmt(iso: string | null, lang: 'ar' | 'en'): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString(lang === 'ar' ? 'ar-AE' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function name(row: { full_name_ar?: string | null; full_name_en?: string | null }, lang: 'ar' | 'en'): string {
  if (lang === 'ar') return row.full_name_ar || row.full_name_en || '—';
  return row.full_name_en || row.full_name_ar || '—';
}

const EVENT_LABELS: Record<string, { ar: string; en: string }> = {
  cancel_requested: { ar: 'طلب إلغاء', en: 'Cancel requested' },
  cancel_effective_grace_swept: { ar: 'انتهت العضويّة', en: 'Cancel effective' },
  reactivated: { ar: 'استؤنفت', en: 'Reactivated' },
  dunning_payment_failed: { ar: 'فشل الدفع', en: 'Payment failed' },
  dunning_back_in_good_standing: { ar: 'استؤنف الدفع', en: 'Back in good standing' },
  dunning_payment_failed_final: { ar: 'انتهت محاولات الدفع', en: 'Payment retries exhausted' },
  renewal_reminder_t7: { ar: 'تذكير تجديد T-7', en: 'Renewal reminder T-7' },
  renewal_reminder_t1: { ar: 'تذكير تجديد T-1', en: 'Renewal reminder T-1' },
  winback_30d: { ar: 'إعادة استقطاب', en: 'Win-back' },
};

export default function AdminMembershipLifecyclePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = use(params);
  const isAr = locale === 'ar';
  const dir = isAr ? 'rtl' : 'ltr';
  const headingFont = isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)';

  const [data, setData] = useState<ApiPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/membership/lifecycle')
      .then((r) => {
        if (r.status === 401 || r.status === 403) {
          throw new Error(isAr ? 'غير مخوّل' : 'Not authorised');
        }
        if (!r.ok) throw new Error(`status ${r.status}`);
        return r.json();
      })
      .then((j) => setData(j as ApiPayload))
      .catch((e) => setError(e.message || 'load_failed'));
  }, [isAr]);

  if (error) {
    return (
      <Section variant="white">
        <div dir={dir}>
          <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-red-800">{error}</div>
        </div>
      </Section>
    );
  }

  if (!data) {
    return (
      <Section variant="white">
        <div dir={dir} className="text-[var(--color-neutral-500)]">
          {isAr ? '...جارٍ التحميل' : 'Loading…'}
        </div>
      </Section>
    );
  }

  const exportHref = (section: string) => `/api/admin/membership/lifecycle?format=csv&section=${section}`;

  return (
    <Section variant="white">
      <div dir={dir}>
        <div className="mb-8">
          <h1
            className="text-2xl md:text-3xl font-bold text-[var(--text-primary)] mb-2"
            style={{ fontFamily: headingFont }}
          >
            {isAr ? 'دورة حياة العضويّات' : 'Membership Lifecycle'}
          </h1>
          <p className="text-[var(--color-neutral-600)]">
            {isAr
              ? 'لوحة المراقبة الكاملة: التحصيل الفاشل، الإلغاءات القادمة، والمسح الزمني، والتذكيرات.'
              : 'Full observability: dunning queue, upcoming cancellations, grace sweeps, reminders.'}
          </p>
          <p className="text-xs text-[var(--color-neutral-400)] mt-1">
            {isAr ? 'الموجة F.6' : 'Wave F.6'}
          </p>
        </div>

        {/* Summary tiles */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          <div className="rounded-xl border border-rose-100 bg-rose-50/40 p-4">
            <p className="text-2xl font-bold text-rose-700">{data.counts.dunning}</p>
            <p className="text-xs text-rose-900">{isAr ? 'فواتير متأخّرة' : 'Past due'}</p>
          </div>
          <div className="rounded-xl border border-amber-100 bg-amber-50/40 p-4">
            <p className="text-2xl font-bold text-amber-700">{data.counts.upcoming_cancels}</p>
            <p className="text-xs text-amber-900">{isAr ? 'إلغاءات قادمة' : 'Pending cancels'}</p>
          </div>
          <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-4">
            <p className="text-2xl font-bold text-emerald-700">{data.counts.grace_sweeps}</p>
            <p className="text-xs text-emerald-900">{isAr ? 'مسوحات أخيرة' : 'Recent sweeps'}</p>
          </div>
          <div className="rounded-xl border border-[var(--color-primary-100)] bg-[var(--color-primary-50)]/40 p-4">
            <p className="text-2xl font-bold text-[var(--color-primary)]">{data.counts.recent_reminders}</p>
            <p className="text-xs text-[var(--color-primary)]">{isAr ? 'أحداث أخيرة' : 'Recent events'}</p>
          </div>
        </div>

        {/* 1. Dunning queue */}
        <section className="mb-10">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-[var(--text-primary)]" style={{ fontFamily: headingFont }}>
              {isAr ? 'صفّ التحصيل (Past due)' : 'Dunning queue (past_due)'}
            </h2>
            <a
              href={exportHref('dunning')}
              className="text-xs text-[var(--color-primary)] hover:underline"
            >
              {isAr ? 'تنزيل CSV' : 'Download CSV'}
            </a>
          </div>
          {data.dunning.length === 0 ? (
            <p className="text-sm text-[var(--color-neutral-500)]">{isAr ? 'لا أعضاء متأخّرون.' : 'No past-due members.'}</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-[var(--color-neutral-100)]">
              <table className="w-full text-sm">
                <thead className="bg-[var(--color-neutral-50)]">
                  <tr className="text-start">
                    <th className="px-4 py-2 text-start">{isAr ? 'البريد' : 'Email'}</th>
                    <th className="px-4 py-2 text-start">{isAr ? 'الاسم' : 'Name'}</th>
                    <th className="px-4 py-2 text-start">{isAr ? 'المرتبة' : 'Tier'}</th>
                    <th className="px-4 py-2 text-start">{isAr ? 'نهاية الفترة' : 'Period end'}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.dunning.map((r) => (
                    <tr key={r.membership_id} className="border-t border-[var(--color-neutral-100)]">
                      <td className="px-4 py-2 font-mono text-xs">{r.email || '—'}</td>
                      <td className="px-4 py-2">{name(r, locale as 'ar' | 'en')}</td>
                      <td className="px-4 py-2 font-mono text-xs">{r.tier_slug}</td>
                      <td className="px-4 py-2 text-xs">{fmt(r.current_period_end, locale as 'ar' | 'en')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* 2. Upcoming cancels */}
        <section className="mb-10">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-[var(--text-primary)]" style={{ fontFamily: headingFont }}>
              {isAr ? 'إلغاءات قادمة' : 'Upcoming cancellations'}
            </h2>
            <a
              href={exportHref('upcoming_cancels')}
              className="text-xs text-[var(--color-primary)] hover:underline"
            >
              {isAr ? 'تنزيل CSV' : 'Download CSV'}
            </a>
          </div>
          {data.upcoming_cancels.length === 0 ? (
            <p className="text-sm text-[var(--color-neutral-500)]">{isAr ? 'لا توجد إلغاءات قادمة.' : 'No pending cancellations.'}</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-[var(--color-neutral-100)]">
              <table className="w-full text-sm">
                <thead className="bg-[var(--color-neutral-50)]">
                  <tr>
                    <th className="px-4 py-2 text-start">{isAr ? 'البريد' : 'Email'}</th>
                    <th className="px-4 py-2 text-start">{isAr ? 'الاسم' : 'Name'}</th>
                    <th className="px-4 py-2 text-start">{isAr ? 'المرتبة' : 'Tier'}</th>
                    <th className="px-4 py-2 text-start">{isAr ? 'موعد الإلغاء' : 'Cancel at'}</th>
                    <th className="px-4 py-2 text-start">{isAr ? 'السبب' : 'Reason'}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.upcoming_cancels.map((r) => (
                    <tr key={r.membership_id} className="border-t border-[var(--color-neutral-100)]">
                      <td className="px-4 py-2 font-mono text-xs">{r.email || '—'}</td>
                      <td className="px-4 py-2">{name(r, locale as 'ar' | 'en')}</td>
                      <td className="px-4 py-2 font-mono text-xs">{r.tier_slug}</td>
                      <td className="px-4 py-2 text-xs">{fmt(r.cancel_at, locale as 'ar' | 'en')}</td>
                      <td className="px-4 py-2 text-xs text-[var(--color-neutral-600)]">{r.cancel_reason || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* 3. Grace sweeps */}
        <section className="mb-10">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-[var(--text-primary)]" style={{ fontFamily: headingFont }}>
              {isAr ? 'سجلّ المسح الزمني' : 'Grace-sweep history'}
            </h2>
            <a
              href={exportHref('grace_sweeps')}
              className="text-xs text-[var(--color-primary)] hover:underline"
            >
              {isAr ? 'تنزيل CSV' : 'Download CSV'}
            </a>
          </div>
          {data.grace_sweeps.length === 0 ? (
            <p className="text-sm text-[var(--color-neutral-500)]">{isAr ? 'لا مسوحات بعد.' : 'No sweeps yet.'}</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-[var(--color-neutral-100)]">
              <table className="w-full text-sm">
                <thead className="bg-[var(--color-neutral-50)]">
                  <tr>
                    <th className="px-4 py-2 text-start">{isAr ? 'البريد' : 'Email'}</th>
                    <th className="px-4 py-2 text-start">{isAr ? 'الموعد' : 'When'}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.grace_sweeps.map((r) => (
                    <tr key={r.id} className="border-t border-[var(--color-neutral-100)]">
                      <td className="px-4 py-2 font-mono text-xs">{r.email || '—'}</td>
                      <td className="px-4 py-2 text-xs">{fmt(r.created_at, locale as 'ar' | 'en')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* 4. Recent reminder/dunning/winback log */}
        <section className="mb-10">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-[var(--text-primary)]" style={{ fontFamily: headingFont }}>
              {isAr ? 'سجلّ الأحداث الأخيرة' : 'Recent lifecycle events'}
            </h2>
            <a
              href={exportHref('reminders')}
              className="text-xs text-[var(--color-primary)] hover:underline"
            >
              {isAr ? 'تنزيل CSV' : 'Download CSV'}
            </a>
          </div>
          {data.recent_reminders.length === 0 ? (
            <p className="text-sm text-[var(--color-neutral-500)]">{isAr ? 'لا أحداث بعد.' : 'No events yet.'}</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-[var(--color-neutral-100)]">
              <table className="w-full text-sm">
                <thead className="bg-[var(--color-neutral-50)]">
                  <tr>
                    <th className="px-4 py-2 text-start">{isAr ? 'البريد' : 'Email'}</th>
                    <th className="px-4 py-2 text-start">{isAr ? 'النوع' : 'Type'}</th>
                    <th className="px-4 py-2 text-start">{isAr ? 'الموعد' : 'When'}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recent_reminders.map((r) => (
                    <tr key={r.id} className="border-t border-[var(--color-neutral-100)]">
                      <td className="px-4 py-2 font-mono text-xs">{r.email || '—'}</td>
                      <td className="px-4 py-2 text-xs">
                        {EVENT_LABELS[r.event_type]
                          ? isAr
                            ? EVENT_LABELS[r.event_type].ar
                            : EVENT_LABELS[r.event_type].en
                          : r.event_type}
                      </td>
                      <td className="px-4 py-2 text-xs">{fmt(r.created_at, locale as 'ar' | 'en')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </Section>
  );
}
