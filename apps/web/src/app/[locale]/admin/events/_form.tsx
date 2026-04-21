'use client';

/**
 * Shared create/edit form for /admin/events.
 * CMS→DB Phase 2e (2026-04-21).
 *
 * Exposes every CMS `Event` column (bilingual identity, dates, location,
 * pricing AED/EGP/USD, speakers, registration, flags).
 */

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@kunacademy/auth';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';
import { Button } from '@kunacademy/ui/button';
import Link from 'next/link';
import { ArrowLeft, ExternalLink } from 'lucide-react';

const LOCATION_TYPES = ['in-person', 'online', 'hybrid'] as const;
type LocationType = typeof LOCATION_TYPES[number];

const STATUSES = ['open', 'sold_out', 'completed'] as const;
type EStatus = typeof STATUSES[number];

interface FormValue {
  id?: string;
  // identity
  slug: string;
  title_ar: string;
  title_en: string;
  description_ar: string;
  description_en: string;
  // dates
  date_start: string;
  date_end: string;
  registration_deadline: string;
  // location
  location_ar: string;
  location_en: string;
  location_type: LocationType;
  // capacity + pricing
  capacity: string;
  price_aed: string;
  price_egp: string;
  price_usd: string;
  // visual
  image_url: string;
  promo_video_url: string;
  // cross-refs
  program_slug: string;
  speaker_slugs: string; // comma-separated
  // registration
  registration_url: string;
  status: EStatus;
  // flags
  is_featured: boolean;
  display_order: string;
  published: boolean;
}

const EMPTY: FormValue = {
  slug: '',
  title_ar: '',
  title_en: '',
  description_ar: '',
  description_en: '',
  date_start: '',
  date_end: '',
  registration_deadline: '',
  location_ar: '',
  location_en: '',
  location_type: 'online',
  capacity: '',
  price_aed: '',
  price_egp: '',
  price_usd: '',
  image_url: '',
  promo_video_url: '',
  program_slug: '',
  speaker_slugs: '',
  registration_url: '',
  status: 'open',
  is_featured: false,
  display_order: '0',
  published: true,
};

interface Props {
  eventId?: string;
}

function arrToCsv(v: unknown): string {
  if (!v) return '';
  if (Array.isArray(v)) return v.join(', ');
  return String(v);
}

export default function EventForm({ eventId }: Props) {
  const { locale } = useParams<{ locale: string }>();
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const isAr = locale === 'ar';
  const isEdit = Boolean(eventId);

  const [form, setForm] = useState<FormValue>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    const role = (profile as { role?: string } | null)?.role;
    if (!user || (role !== 'admin' && role !== 'super_admin')) {
      router.replace(`/${locale}/auth/login`);
    }
  }, [user, profile, authLoading, locale, router]);

  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;
    (async () => {
      try {
        if (isEdit) {
          const res = await fetch(`/api/admin/events/${eventId}`);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();
          if (cancelled) return;
          const p = data.event;
          setForm({
            id: p.id,
            slug: p.slug ?? '',
            title_ar: p.title_ar ?? '',
            title_en: p.title_en ?? '',
            description_ar: p.description_ar ?? '',
            description_en: p.description_en ?? '',
            date_start: p.date_start ?? '',
            date_end: p.date_end ?? '',
            registration_deadline: p.registration_deadline ?? '',
            location_ar: p.location_ar ?? '',
            location_en: p.location_en ?? '',
            location_type: (p.location_type ?? 'online') as LocationType,
            capacity: p.capacity?.toString() ?? '',
            price_aed: p.price_aed?.toString() ?? '',
            price_egp: p.price_egp?.toString() ?? '',
            price_usd: p.price_usd?.toString() ?? '',
            image_url: p.image_url ?? '',
            promo_video_url: p.promo_video_url ?? '',
            program_slug: p.program_slug ?? '',
            speaker_slugs: arrToCsv(p.speaker_slugs),
            registration_url: p.registration_url ?? '',
            status: (p.status ?? 'open') as EStatus,
            is_featured: Boolean(p.is_featured),
            display_order: (p.display_order ?? 0).toString(),
            published: p.published !== false,
          });
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isEdit, eventId, authLoading]);

  function set<K extends keyof FormValue>(k: K, v: FormValue[K]) {
    setForm((prev) => ({ ...prev, [k]: v }));
  }

  function validate(): string | null {
    if (!form.slug.trim()) return isAr ? 'المعرّف (slug) مطلوب' : 'slug is required';
    if (!/^[a-z0-9][a-z0-9-]*$/.test(form.slug.trim())) {
      return isAr
        ? 'المعرّف يجب أن يحتوي فقط على حروف إنجليزية صغيرة وأرقام وشرطات'
        : 'slug must be lowercase alphanumeric with hyphens';
    }
    if (!form.title_ar.trim() || !form.title_en.trim()) {
      return isAr ? 'العنوان (ar + en) مطلوب' : 'title (ar + en) are required';
    }
    if (!form.date_start.trim() || !/^\d{4}-\d{2}-\d{2}/.test(form.date_start.trim())) {
      return isAr ? 'تاريخ البداية مطلوب (YYYY-MM-DD)' : 'date_start is required (YYYY-MM-DD)';
    }
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const v = validate();
    if (v) {
      setError(v);
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        slug: form.slug.trim(),
        title_ar: form.title_ar.trim(),
        title_en: form.title_en.trim(),
        description_ar: form.description_ar,
        description_en: form.description_en,
        date_start: form.date_start,
        date_end: form.date_end,
        registration_deadline: form.registration_deadline,
        location_ar: form.location_ar,
        location_en: form.location_en,
        location_type: form.location_type,
        capacity: form.capacity,
        price_aed: form.price_aed,
        price_egp: form.price_egp,
        price_usd: form.price_usd,
        image_url: form.image_url,
        promo_video_url: form.promo_video_url,
        program_slug: form.program_slug,
        speaker_slugs: form.speaker_slugs,
        registration_url: form.registration_url,
        status: form.status,
        is_featured: form.is_featured,
        display_order: form.display_order,
        published: form.published,
      };
      const url = isEdit ? `/api/admin/events/${eventId}` : '/api/admin/events';
      const method = isEdit ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      router.push(`/${locale}/admin/events`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSubmitting(false);
    }
  }

  if (authLoading || loading) {
    return (
      <Section>
        <p className="text-center py-12">Loading...</p>
      </Section>
    );
  }

  const previewHref = form.slug ? `/${locale}/events/${form.slug}` : null;

  return (
    <main>
      <Section variant="white">
        <div className="flex items-center justify-between">
          <Heading level={1}>
            {isEdit
              ? isAr
                ? 'تعديل فعالية'
                : 'Edit Event'
              : isAr
                ? 'إضافة فعالية'
                : 'New Event'}
          </Heading>
          <Link
            href={`/${locale}/admin/events`}
            className="text-[var(--color-primary)] text-sm hover:underline"
          >
            <ArrowLeft className="w-4 h-4 inline-block rtl:rotate-180" />{' '}
            {isAr ? 'العودة للقائمة' : 'Back to list'}
          </Link>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 grid gap-5 max-w-5xl">
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-3 py-2 text-sm whitespace-pre-wrap">
              {error}
            </div>
          )}

          {/* Identity */}
          <fieldset className="grid gap-4 rounded-xl border border-[var(--color-neutral-200)] p-4">
            <legend className="px-2 text-sm font-semibold">{isAr ? 'الهوية' : 'Identity'}</legend>
            <div className="grid md:grid-cols-3 gap-4">
              <Field label={isAr ? 'المعرّف (slug)' : 'Slug'}>
                <input
                  value={form.slug}
                  onChange={(e) => set('slug', e.target.value)}
                  className={inputCls}
                  required
                />
              </Field>
              <Field label={isAr ? 'ترتيب العرض' : 'Display order'}>
                <input
                  type="number"
                  value={form.display_order}
                  onChange={(e) => set('display_order', e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="Status">
                <select
                  value={form.status}
                  onChange={(e) => set('status', e.target.value as EStatus)}
                  className={inputCls}
                >
                  {STATUSES.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <Field label="Title (AR)">
                <input
                  value={form.title_ar}
                  onChange={(e) => set('title_ar', e.target.value)}
                  className={inputCls}
                  required
                  dir="rtl"
                />
              </Field>
              <Field label="Title (EN)">
                <input
                  value={form.title_en}
                  onChange={(e) => set('title_en', e.target.value)}
                  className={inputCls}
                  required
                />
              </Field>
              <Field label="Description (AR)">
                <textarea
                  value={form.description_ar}
                  onChange={(e) => set('description_ar', e.target.value)}
                  className={`${inputCls} min-h-[80px]`}
                  dir="rtl"
                />
              </Field>
              <Field label="Description (EN)">
                <textarea
                  value={form.description_en}
                  onChange={(e) => set('description_en', e.target.value)}
                  className={`${inputCls} min-h-[80px]`}
                />
              </Field>
            </div>
          </fieldset>

          {/* Dates */}
          <fieldset className="grid gap-4 rounded-xl border border-[var(--color-neutral-200)] p-4">
            <legend className="px-2 text-sm font-semibold">{isAr ? 'التواريخ' : 'Dates'}</legend>
            <div className="grid md:grid-cols-3 gap-4">
              <Field label="Date start (YYYY-MM-DD)">
                <input
                  value={form.date_start}
                  onChange={(e) => set('date_start', e.target.value)}
                  className={inputCls}
                  required
                />
              </Field>
              <Field label="Date end (optional)">
                <input
                  value={form.date_end}
                  onChange={(e) => set('date_end', e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="Registration deadline">
                <input
                  value={form.registration_deadline}
                  onChange={(e) => set('registration_deadline', e.target.value)}
                  className={inputCls}
                />
              </Field>
            </div>
          </fieldset>

          {/* Location */}
          <fieldset className="grid gap-4 rounded-xl border border-[var(--color-neutral-200)] p-4">
            <legend className="px-2 text-sm font-semibold">
              {isAr ? 'المكان' : 'Location'}
            </legend>
            <div className="grid md:grid-cols-3 gap-4">
              <Field label="Location type">
                <select
                  value={form.location_type}
                  onChange={(e) => set('location_type', e.target.value as LocationType)}
                  className={inputCls}
                >
                  {LOCATION_TYPES.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Location (AR)">
                <input
                  value={form.location_ar}
                  onChange={(e) => set('location_ar', e.target.value)}
                  className={inputCls}
                  dir="rtl"
                />
              </Field>
              <Field label="Location (EN)">
                <input
                  value={form.location_en}
                  onChange={(e) => set('location_en', e.target.value)}
                  className={inputCls}
                />
              </Field>
            </div>
          </fieldset>

          {/* Capacity + Pricing */}
          <fieldset className="grid gap-4 rounded-xl border border-[var(--color-neutral-200)] p-4">
            <legend className="px-2 text-sm font-semibold">
              {isAr ? 'السعة والتسعير' : 'Capacity + Pricing'}
            </legend>
            <div className="grid md:grid-cols-4 gap-4">
              <Field label="Capacity">
                <input
                  type="number"
                  value={form.capacity}
                  onChange={(e) => set('capacity', e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="Price AED">
                <input
                  value={form.price_aed}
                  onChange={(e) => set('price_aed', e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="Price EGP">
                <input
                  value={form.price_egp}
                  onChange={(e) => set('price_egp', e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="Price USD">
                <input
                  value={form.price_usd}
                  onChange={(e) => set('price_usd', e.target.value)}
                  className={inputCls}
                />
              </Field>
            </div>
          </fieldset>

          {/* Visual */}
          <fieldset className="grid gap-4 rounded-xl border border-[var(--color-neutral-200)] p-4">
            <legend className="px-2 text-sm font-semibold">{isAr ? 'الصور' : 'Visual'}</legend>
            <div className="grid md:grid-cols-2 gap-4">
              <Field label="Image URL">
                <input
                  value={form.image_url}
                  onChange={(e) => set('image_url', e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="Promo video URL">
                <input
                  value={form.promo_video_url}
                  onChange={(e) => set('promo_video_url', e.target.value)}
                  className={inputCls}
                />
              </Field>
            </div>
          </fieldset>

          {/* Cross-refs + Registration */}
          <fieldset className="grid gap-4 rounded-xl border border-[var(--color-neutral-200)] p-4">
            <legend className="px-2 text-sm font-semibold">
              {isAr ? 'الربط والتسجيل' : 'Cross-refs + Registration'}
            </legend>
            <div className="grid md:grid-cols-2 gap-4">
              <Field label="Program slug">
                <input
                  value={form.program_slug}
                  onChange={(e) => set('program_slug', e.target.value)}
                  className={inputCls}
                  placeholder="e.g. somatic-thinking-intro"
                />
              </Field>
              <Field label="Speaker slugs (csv)">
                <input
                  value={form.speaker_slugs}
                  onChange={(e) => set('speaker_slugs', e.target.value)}
                  className={inputCls}
                  placeholder="samer-hassan, marwa-sherife"
                />
              </Field>
              <Field label="Registration URL">
                <input
                  value={form.registration_url}
                  onChange={(e) => set('registration_url', e.target.value)}
                  className={inputCls}
                />
              </Field>
            </div>
          </fieldset>

          {/* Flags + submit */}
          <fieldset className="grid gap-4 rounded-xl border border-[var(--color-neutral-200)] p-4">
            <legend className="px-2 text-sm font-semibold">{isAr ? 'حالة النشر' : 'Flags'}</legend>
            <div className="flex flex-wrap items-center gap-6 text-sm">
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.published}
                  onChange={(e) => set('published', e.target.checked)}
                  className="rounded"
                />
                {isAr ? 'منشور' : 'Published'}
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.is_featured}
                  onChange={(e) => set('is_featured', e.target.checked)}
                  className="rounded"
                />
                {isAr ? 'مُميَّز' : 'Featured'}
              </label>
              {previewHref && (
                <a
                  href={previewHref}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[var(--color-primary)] hover:underline"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> {isAr ? 'معاينة' : 'Preview'}
                </a>
              )}
            </div>
          </fieldset>

          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={submitting}>
              {submitting
                ? isAr
                  ? 'جارٍ الحفظ...'
                  : 'Saving...'
                : isEdit
                  ? isAr
                    ? 'حفظ التغييرات'
                    : 'Save Changes'
                  : isAr
                    ? 'إنشاء'
                    : 'Create'}
            </Button>
            <Link
              href={`/${locale}/admin/events`}
              className="inline-flex items-center rounded-lg px-4 py-2 text-sm border border-[var(--color-neutral-200)] hover:bg-[var(--color-neutral-50)]"
            >
              {isAr ? 'إلغاء' : 'Cancel'}
            </Link>
          </div>
        </form>
      </Section>
    </main>
  );
}

const inputCls =
  'w-full rounded-lg border border-[var(--color-neutral-200)] px-3 py-2 text-sm min-h-[40px] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30';

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-sm font-medium text-[var(--text-primary)]">{label}</span>
      {children}
      {hint && <span className="text-xs text-[var(--color-neutral-400)]">{hint}</span>}
    </label>
  );
}
