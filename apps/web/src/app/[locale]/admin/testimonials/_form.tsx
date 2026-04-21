'use client';

/**
 * Shared create/edit form for /admin/testimonials.
 * Phase 1c (CMS→DB migration) — surfaces new columns: role_ar/en, location_ar/en,
 * country_code (ISO-3166 2-letter), display_order.
 */

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@kunacademy/auth';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';
import { Button } from '@kunacademy/ui/button';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export interface TestimonialFormValue {
  id?: string;
  author_name_ar: string;
  author_name_en: string;
  content_ar: string;
  content_en: string;
  role_ar: string;
  role_en: string;
  location_ar: string;
  location_en: string;
  country_code: string;
  program: string;
  rating: string; // stored as text in form; coerced to int on submit
  video_url: string;
  display_order: string; // stored as text in form; coerced to int on submit
  is_featured: boolean;
  source_type: string;
}

const EMPTY: TestimonialFormValue = {
  author_name_ar: '',
  author_name_en: '',
  content_ar: '',
  content_en: '',
  role_ar: '',
  role_en: '',
  location_ar: '',
  location_en: '',
  country_code: '',
  program: '',
  rating: '',
  video_url: '',
  display_order: '0',
  is_featured: false,
  source_type: 'admin',
};

interface Props {
  /** If provided, form edits that record. If absent, creates a new one. */
  testimonialId?: string;
}

export default function TestimonialForm({ testimonialId }: Props) {
  const { locale } = useParams<{ locale: string }>();
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const isAr = locale === 'ar';
  const isEdit = Boolean(testimonialId);

  const [form, setForm] = useState<TestimonialFormValue>(EMPTY);
  const [loading, setLoading] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auth guard
  useEffect(() => {
    if (authLoading) return;
    const role = (profile as { role?: string } | null)?.role;
    if (!user || (role !== 'admin' && role !== 'super_admin')) {
      router.replace(`/${locale}/auth/login`);
    }
  }, [user, profile, authLoading, locale, router]);

  // Hydrate form in edit mode
  useEffect(() => {
    if (!isEdit || authLoading) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/admin/testimonials/${testimonialId}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (cancelled) return;
        const t = data.testimonial;
        setForm({
          id: t.id,
          author_name_ar: t.author_name_ar ?? '',
          author_name_en: t.author_name_en ?? '',
          content_ar: t.content_ar ?? '',
          content_en: t.content_en ?? '',
          role_ar: t.role_ar ?? '',
          role_en: t.role_en ?? '',
          location_ar: t.location_ar ?? '',
          location_en: t.location_en ?? '',
          country_code: t.country_code ?? '',
          program: t.program ?? '',
          rating: t.rating != null ? String(t.rating) : '',
          video_url: t.video_url ?? '',
          display_order: String(t.display_order ?? 0),
          is_featured: Boolean(t.is_featured),
          source_type: t.source_type ?? 'admin',
        });
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isEdit, testimonialId, authLoading]);

  function set<K extends keyof TestimonialFormValue>(k: K, v: TestimonialFormValue[K]) {
    setForm(prev => ({ ...prev, [k]: v }));
  }

  function validate(): string | null {
    if (!form.content_ar.trim() && !form.content_en.trim()) {
      return isAr ? 'يجب إدخال نص الشهادة بالعربية أو الإنجليزية' : 'Content required (AR or EN)';
    }
    if (!form.author_name_ar.trim() && !form.author_name_en.trim()) {
      return isAr ? 'يجب إدخال اسم الشاهد' : 'Author name required';
    }
    if (form.country_code && !/^[A-Za-z]{2}$/.test(form.country_code.trim())) {
      return isAr ? 'رمز الدولة يجب أن يكون حرفين (ISO-3166)' : 'country_code must be 2 letters (ISO-3166)';
    }
    if (form.rating && (Number.isNaN(Number(form.rating)) || Number(form.rating) < 1 || Number(form.rating) > 5)) {
      return isAr ? 'التقييم يجب أن يكون بين 1 و 5' : 'rating must be 1–5';
    }
    if (form.display_order && Number.isNaN(Number(form.display_order))) {
      return isAr ? 'ترتيب العرض يجب أن يكون رقمًا' : 'display_order must be a number';
    }
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const v = validate();
    if (v) { setError(v); return; }
    setError(null);
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        author_name_ar: form.author_name_ar.trim() || null,
        author_name_en: form.author_name_en.trim() || null,
        content_ar: form.content_ar.trim() || null,
        content_en: form.content_en.trim() || null,
        role_ar: form.role_ar.trim() || null,
        role_en: form.role_en.trim() || null,
        location_ar: form.location_ar.trim() || null,
        location_en: form.location_en.trim() || null,
        country_code: form.country_code.trim() ? form.country_code.trim().toUpperCase() : null,
        program: form.program.trim() || null,
        rating: form.rating ? Number(form.rating) : null,
        video_url: form.video_url.trim() || null,
        display_order: form.display_order ? Number(form.display_order) : 0,
        is_featured: form.is_featured,
        source_type: form.source_type.trim() || 'admin',
      };

      const url = isEdit ? `/api/admin/testimonials/${testimonialId}` : '/api/admin/testimonials';
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
      router.push(`/${locale}/admin/testimonials`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSubmitting(false);
    }
  }

  if (authLoading || loading) return <Section><p className="text-center py-12">Loading...</p></Section>;

  return (
    <main>
      <Section variant="white">
        <div className="flex items-center justify-between">
          <Heading level={1}>
            {isEdit
              ? (isAr ? 'تعديل شهادة' : 'Edit Testimonial')
              : (isAr ? 'إضافة شهادة' : 'New Testimonial')}
          </Heading>
          <Link href={`/${locale}/admin/testimonials`} className="text-[var(--color-primary)] text-sm hover:underline">
            <ArrowLeft className="w-4 h-4 inline-block rtl:rotate-180" /> {isAr ? 'قائمة الشهادات' : 'Back to list'}
          </Link>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 grid gap-5 max-w-3xl">
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-3 py-2 text-sm">{error}</div>
          )}

          <div className="grid md:grid-cols-2 gap-4">
            <Field label={isAr ? 'الاسم (عربي)' : 'Name (Arabic)'}>
              <input value={form.author_name_ar} onChange={e => set('author_name_ar', e.target.value)} className={inputCls} dir="rtl" />
            </Field>
            <Field label={isAr ? 'الاسم (إنجليزي)' : 'Name (English)'}>
              <input value={form.author_name_en} onChange={e => set('author_name_en', e.target.value)} className={inputCls} />
            </Field>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <Field label={isAr ? 'الدور (عربي)' : 'Role (Arabic)'} hint={isAr ? 'مثال: مدير تنفيذي، مدرب محترف' : 'e.g. CEO, Professional Coach'}>
              <input value={form.role_ar} onChange={e => set('role_ar', e.target.value)} className={inputCls} dir="rtl" />
            </Field>
            <Field label={isAr ? 'الدور (إنجليزي)' : 'Role (English)'}>
              <input value={form.role_en} onChange={e => set('role_en', e.target.value)} className={inputCls} />
            </Field>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <Field label={isAr ? 'الموقع (عربي)' : 'Location (Arabic)'} hint={isAr ? 'مثال: القاهرة، مصر' : 'e.g. Cairo, Egypt'}>
              <input value={form.location_ar} onChange={e => set('location_ar', e.target.value)} className={inputCls} dir="rtl" />
            </Field>
            <Field label={isAr ? 'الموقع (إنجليزي)' : 'Location (English)'}>
              <input value={form.location_en} onChange={e => set('location_en', e.target.value)} className={inputCls} />
            </Field>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <Field label={isAr ? 'رمز الدولة (ISO-3166)' : 'Country Code (ISO-3166)'} hint={isAr ? 'حرفان — مثال: EG، SA، AE' : '2 letters — e.g. EG, SA, AE'}>
              <input
                value={form.country_code}
                onChange={e => set('country_code', e.target.value.toUpperCase().slice(0, 2))}
                className={inputCls}
                maxLength={2}
                placeholder="EG"
              />
            </Field>
            <Field label={isAr ? 'ترتيب العرض' : 'Display Order'} hint={isAr ? 'الأرقام الأصغر تظهر أولاً' : 'Lower numbers appear first'}>
              <input
                type="number"
                value={form.display_order}
                onChange={e => set('display_order', e.target.value)}
                className={inputCls}
                step={1}
              />
            </Field>
            <Field label={isAr ? 'التقييم' : 'Rating'} hint={isAr ? '1-5 (اختياري)' : '1–5 (optional)'}>
              <input
                type="number"
                value={form.rating}
                onChange={e => set('rating', e.target.value)}
                className={inputCls}
                min={1}
                max={5}
                step={1}
              />
            </Field>
          </div>

          <Field label={isAr ? 'البرنامج' : 'Program'} hint={isAr ? 'اسم البرنامج المرتبط بالشهادة' : 'Program associated with this testimonial'}>
            <input value={form.program} onChange={e => set('program', e.target.value)} className={inputCls} />
          </Field>

          <div className="grid md:grid-cols-2 gap-4">
            <Field label={isAr ? 'نص الشهادة (عربي)' : 'Content (Arabic)'}>
              <textarea value={form.content_ar} onChange={e => set('content_ar', e.target.value)} className={`${inputCls} min-h-[160px]`} dir="rtl" />
            </Field>
            <Field label={isAr ? 'نص الشهادة (إنجليزي)' : 'Content (English)'}>
              <textarea value={form.content_en} onChange={e => set('content_en', e.target.value)} className={`${inputCls} min-h-[160px]`} />
            </Field>
          </div>

          <Field label={isAr ? 'رابط الفيديو' : 'Video URL'} hint={isAr ? 'اختياري — YouTube أو Vimeo' : 'Optional — YouTube or Vimeo'}>
            <input type="url" value={form.video_url} onChange={e => set('video_url', e.target.value)} className={inputCls} placeholder="https://" />
          </Field>

          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.is_featured} onChange={e => set('is_featured', e.target.checked)} className="rounded" />
            <span>{isAr ? 'مميّز (يظهر في القوائم الرئيسية)' : 'Featured (shown on prominent listings)'}</span>
          </label>

          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={submitting}>
              {submitting
                ? (isAr ? 'جارٍ الحفظ...' : 'Saving...')
                : isEdit ? (isAr ? 'حفظ التغييرات' : 'Save Changes') : (isAr ? 'إنشاء' : 'Create')}
            </Button>
            <Link href={`/${locale}/admin/testimonials`} className="inline-flex items-center rounded-lg px-4 py-2 text-sm border border-[var(--color-neutral-200)] hover:bg-[var(--color-neutral-50)]">
              {isAr ? 'إلغاء' : 'Cancel'}
            </Link>
          </div>
        </form>
      </Section>
    </main>
  );
}

const inputCls = 'w-full rounded-lg border border-[var(--color-neutral-200)] px-3 py-2 text-sm min-h-[40px] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30';

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5">
      <span className="text-sm font-medium text-[var(--text-primary)]">{label}</span>
      {children}
      {hint && <span className="text-xs text-[var(--color-neutral-400)]">{hint}</span>}
    </label>
  );
}
