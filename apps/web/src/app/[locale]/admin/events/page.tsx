'use client';

/**
 * /admin/events — list + CRUD entry point.
 * CMS→DB Phase 2e (2026-04-21).
 *
 * Filter by location_type + status + program_slug. Sort by display_order (server side).
 */

import { useAuth } from '@kunacademy/auth';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, Pencil, Trash2, Check, X, ExternalLink } from 'lucide-react';

interface EventRow {
  id: string;
  slug: string;
  title_ar: string;
  title_en: string;
  date_start: string;
  date_end: string | null;
  location_type: string;
  status: string;
  program_slug: string | null;
  price_aed: string | number | null;
  capacity: number | null;
  display_order: number;
  is_featured: boolean;
  published: boolean;
  published_at: string | null;
  last_edited_at: string | null;
}

const LOCATION_TYPE_FILTERS = ['', 'in-person', 'online', 'hybrid'];
const STATUS_FILTERS = ['', 'open', 'sold_out', 'completed'];

export default function AdminEventsPage() {
  const { locale } = useParams<{ locale: string }>();
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const isAr = locale === 'ar';

  const [items, setItems] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [locationFilter, setLocationFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [programFilter, setProgramFilter] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<EventRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (locationFilter) params.set('location_type', locationFilter);
    if (statusFilter) params.set('status', statusFilter);
    if (programFilter) params.set('program_slug', programFilter);
    const qs = params.toString();
    const res = await fetch(`/api/admin/events${qs ? '?' + qs : ''}`);
    if (!res.ok) {
      setLoading(false);
      return;
    }
    const data = await res.json();
    setItems(data.events ?? []);
    setLoading(false);
  }, [locationFilter, statusFilter, programFilter]);

  useEffect(() => {
    if (authLoading) return;
    const role = (profile as { role?: string } | null)?.role;
    if (!user || (role !== 'admin' && role !== 'super_admin')) {
      router.push(`/${locale}/auth/login`);
      return;
    }
    load();
  }, [user, profile, authLoading, load, locale, router]);

  async function togglePublished(p: EventRow) {
    await fetch(`/api/admin/events/${p.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ published: !p.published }),
    });
    await load();
  }

  async function doDelete() {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/events/${confirmDelete.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || `HTTP ${res.status}`);
        return;
      }
      setConfirmDelete(null);
      await load();
    } finally {
      setDeleting(false);
    }
  }

  const programSlugs = useMemo(() => {
    const set = new Set<string>();
    for (const p of items) if (p.program_slug) set.add(p.program_slug);
    return ['', ...Array.from(set).sort()];
  }, [items]);

  if (authLoading || loading) {
    return (
      <Section>
        <p className="text-center py-12">Loading...</p>
      </Section>
    );
  }

  return (
    <main>
      <Section variant="white">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <Link
              href={`/${locale}/admin`}
              className="text-[var(--color-primary)] text-sm hover:underline inline-flex items-center gap-1 mb-2"
            >
              <ArrowLeft className="w-4 h-4 rtl:rotate-180" /> {isAr ? 'لوحة الإدارة' : 'Admin'}
            </Link>
            <Heading level={1}>{isAr ? 'الفعاليات' : 'Events'}</Heading>
            <p className="text-sm text-[var(--color-neutral-500)] mt-1">
              {items.length} {isAr ? 'فعالية' : 'events'}
            </p>
          </div>
          <Link
            href={`/${locale}/admin/events/new`}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-primary)] text-white text-sm px-3 py-2"
          >
            <Plus className="w-4 h-4" /> {isAr ? 'فعالية جديدة' : 'New event'}
          </Link>
        </div>

        <div className="mt-6 flex gap-3 flex-wrap">
          <label className="text-sm">
            <span className="block text-xs text-[var(--color-neutral-500)] mb-1">
              {isAr ? 'النوع' : 'Location type'}
            </span>
            <select
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              className="rounded border px-2 py-1 text-sm"
            >
              {LOCATION_TYPE_FILTERS.map((g) => (
                <option key={g} value={g}>
                  {g || (isAr ? 'الكل' : 'all')}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="block text-xs text-[var(--color-neutral-500)] mb-1">
              {isAr ? 'الحالة' : 'Status'}
            </span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded border px-2 py-1 text-sm"
            >
              {STATUS_FILTERS.map((g) => (
                <option key={g} value={g}>
                  {g || (isAr ? 'الكل' : 'all')}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="block text-xs text-[var(--color-neutral-500)] mb-1">
              {isAr ? 'البرنامج' : 'Program slug'}
            </span>
            <select
              value={programFilter}
              onChange={(e) => setProgramFilter(e.target.value)}
              className="rounded border px-2 py-1 text-sm"
            >
              {programSlugs.map((c) => (
                <option key={c} value={c}>
                  {c || (isAr ? 'الكل' : 'all')}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-[var(--color-neutral-500)] uppercase">
              <tr className="text-left">
                <th className="py-2 pr-3">Order</th>
                <th className="py-2 pr-3">Slug</th>
                <th className="py-2 pr-3">{isAr ? 'العنوان' : 'Title'}</th>
                <th className="py-2 pr-3">{isAr ? 'البداية' : 'Start'}</th>
                <th className="py-2 pr-3">{isAr ? 'النوع' : 'Type'}</th>
                <th className="py-2 pr-3">{isAr ? 'الحالة' : 'Status'}</th>
                <th className="py-2 pr-3">{isAr ? 'السعر' : 'Price'}</th>
                <th className="py-2 pr-3">{isAr ? 'منشور' : 'Published'}</th>
                <th className="py-2 pr-3" />
              </tr>
            </thead>
            <tbody>
              {items.map((p) => (
                <tr key={p.id} className="border-t border-[var(--color-neutral-100)]">
                  <td className="py-2 pr-3 text-xs text-[var(--color-neutral-500)]">{p.display_order}</td>
                  <td className="py-2 pr-3 font-mono text-xs">{p.slug}</td>
                  <td className="py-2 pr-3">
                    <div className="font-medium">{isAr ? p.title_ar : p.title_en}</div>
                    <div className="text-xs text-[var(--color-neutral-500)]">
                      {isAr ? p.title_en : p.title_ar}
                    </div>
                  </td>
                  <td className="py-2 pr-3 text-xs">{p.date_start}</td>
                  <td className="py-2 pr-3 text-xs">{p.location_type}</td>
                  <td className="py-2 pr-3 text-xs">{p.status}</td>
                  <td className="py-2 pr-3 text-xs">
                    {p.price_aed && Number(p.price_aed) > 0 ? `${p.price_aed} AED` : '—'}
                  </td>
                  <td className="py-2 pr-3">
                    <button
                      onClick={() => togglePublished(p)}
                      className={`inline-flex items-center justify-center w-7 h-7 rounded ${
                        p.published
                          ? 'bg-green-50 text-green-700'
                          : 'bg-[var(--color-neutral-100)] text-[var(--color-neutral-500)]'
                      }`}
                      title={p.published ? 'Unpublish' : 'Publish'}
                    >
                      {p.published ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                    </button>
                  </td>
                  <td className="py-2 pr-3">
                    <div className="flex gap-2">
                      <Link
                        href={`/${locale}/admin/events/${p.id}`}
                        className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-[var(--color-neutral-200)] hover:bg-[var(--color-neutral-50)]"
                      >
                        <Pencil className="w-3.5 h-3.5" /> {isAr ? 'تعديل' : 'Edit'}
                      </Link>
                      <a
                        href={`/${locale}/events/${p.slug}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-[var(--color-neutral-200)] hover:bg-[var(--color-neutral-50)]"
                      >
                        <ExternalLink className="w-3.5 h-3.5" /> {isAr ? 'معاينة' : 'View'}
                      </a>
                      <button
                        onClick={() => setConfirmDelete(p)}
                        className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-red-200 text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> {isAr ? 'حذف' : 'Delete'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-[var(--color-neutral-500)]">
                    {isAr ? 'لا توجد فعاليات' : 'No events found'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {confirmDelete && (
          <div
            className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
            onClick={() => setConfirmDelete(null)}
          >
            <div
              className="bg-white rounded-xl max-w-md w-full mx-4 p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <Heading level={3}>{isAr ? 'تأكيد الحذف' : 'Confirm delete'}</Heading>
              <p className="mt-2 text-sm">
                {isAr ? 'هل تريد حذف الفعالية' : 'Delete event'}{' '}
                <span className="font-mono">{confirmDelete.slug}</span>؟
              </p>
              <div className="mt-5 flex gap-3 justify-end">
                <button
                  onClick={() => setConfirmDelete(null)}
                  className="rounded-lg border border-[var(--color-neutral-200)] px-3 py-2 text-sm"
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  onClick={doDelete}
                  disabled={deleting}
                  className="rounded-lg bg-red-600 text-white px-3 py-2 text-sm disabled:opacity-60"
                >
                  {deleting ? (isAr ? 'جارٍ الحذف...' : 'Deleting...') : isAr ? 'حذف' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}
      </Section>
    </main>
  );
}
