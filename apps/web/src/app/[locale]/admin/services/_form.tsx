'use client';

/**
 * Shared create/edit form for /admin/services.
 * Phase 2a (CMS→DB migration, 2026-04-21) — surfaces the extension columns:
 *   bundle_id, discount_percentage, discount_valid_until, installment_enabled,
 *   coach_level_min/exact, icf_credential_target, coach_slug, display_order,
 *   is_free, student_only, program_slug, published, price_eur.
 *
 * Mirrors the shape of the testimonials _form.tsx (Phase 1c).
 */

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@kunacademy/auth';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';
import { Button } from '@kunacademy/ui/button';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

const COACH_CONTROLS = ['optional', 'mandatory', 'admin_only'] as const;
const COACH_LEVELS = ['basic', 'professional', 'expert', 'master'] as const;
const ICF_CREDENTIALS = ['ACC', 'PCC', 'MCC'] as const;
const KUN_LEVELS = ['basic', 'professional', 'expert', 'master'] as const;

export interface ServiceFormValue {
  id?: string;
  slug: string;
  name_ar: string;
  name_en: string;
  description_ar: string;
  description_en: string;
  duration_minutes: string;
  price_aed: string;
  price_egp: string;
  price_usd: string;
  price_eur: string;
  price_sar: string;
  category_id: string;
  sessions_count: string;
  validity_days: string;
  coach_control: typeof COACH_CONTROLS[number];
  allows_coach_pricing: boolean;
  is_active: boolean;
  min_price_aed: string;
  min_price_egp: string;
  min_price_eur: string;
  eligible_kun_levels: string[];
  // Phase 2a
  bundle_id: string;
  discount_percentage: string;
  discount_valid_until: string;
  installment_enabled: boolean;
  coach_level_min: string;
  coach_level_exact: string;
  icf_credential_target: string;
  coach_slug: string;
  display_order: string;
  is_free: boolean;
  student_only: boolean;
  program_slug: string;
  published: boolean;
}

const EMPTY: ServiceFormValue = {
  slug: '',
  name_ar: '',
  name_en: '',
  description_ar: '',
  description_en: '',
  duration_minutes: '60',
  price_aed: '0',
  price_egp: '0',
  price_usd: '0',
  price_eur: '0',
  price_sar: '0',
  category_id: '',
  sessions_count: '',
  validity_days: '',
  coach_control: 'mandatory',
  allows_coach_pricing: false,
  is_active: true,
  min_price_aed: '0',
  min_price_egp: '0',
  min_price_eur: '0',
  eligible_kun_levels: [],
  bundle_id: '',
  discount_percentage: '',
  discount_valid_until: '',
  installment_enabled: false,
  coach_level_min: '',
  coach_level_exact: '',
  icf_credential_target: '',
  coach_slug: '',
  display_order: '0',
  is_free: false,
  student_only: false,
  program_slug: '',
  published: true,
};

interface Category {
  id: string;
  slug: string | null;
  name_ar: string;
  name_en: string;
}

interface Props {
  serviceId?: string;
}

export default function ServiceForm({ serviceId }: Props) {
  const { locale } = useParams<{ locale: string }>();
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const isAr = locale === 'ar';
  const isEdit = Boolean(serviceId);

  const [form, setForm] = useState<ServiceFormValue>(EMPTY);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
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

  // Load categories (always) + hydrate form (if edit)
  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;
    (async () => {
      try {
        if (isEdit) {
          const res = await fetch(`/api/admin/services/${serviceId}`);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();
          if (cancelled) return;
          const s = data.service;
          setCategories(data.categories ?? []);
          setForm({
            id: s.id,
            slug: s.slug ?? '',
            name_ar: s.name_ar ?? '',
            name_en: s.name_en ?? '',
            description_ar: s.description_ar ?? '',
            description_en: s.description_en ?? '',
            duration_minutes: String(s.duration_minutes ?? 60),
            price_aed: String(s.price_aed ?? 0),
            price_egp: String(s.price_egp ?? 0),
            price_usd: String(s.price_usd ?? 0),
            price_eur: String(s.price_eur ?? 0),
            price_sar: String(s.price_sar ?? 0),
            category_id: s.category_id ?? '',
            sessions_count: s.sessions_count != null ? String(s.sessions_count) : '',
            validity_days: s.validity_days != null ? String(s.validity_days) : '',
            coach_control: (s.coach_control ?? 'mandatory') as typeof COACH_CONTROLS[number],
            allows_coach_pricing: Boolean(s.allows_coach_pricing),
            is_active: s.is_active !== false,
            min_price_aed: String(s.min_price_aed ?? 0),
            min_price_egp: String(s.min_price_egp ?? 0),
            min_price_eur: String(s.min_price_eur ?? 0),
            eligible_kun_levels: Array.isArray(s.eligible_kun_levels) ? s.eligible_kun_levels : [],
            bundle_id: s.bundle_id ?? '',
            discount_percentage: s.discount_percentage != null ? String(s.discount_percentage) : '',
            discount_valid_until: s.discount_valid_until ?? '',
            installment_enabled: Boolean(s.installment_enabled),
            coach_level_min: s.coach_level_min ?? '',
            coach_level_exact: s.coach_level_exact ?? '',
            icf_credential_target: s.icf_credential_target ?? '',
            coach_slug: s.coach_slug ?? '',
            display_order: String(s.display_order ?? 0),
            is_free: Boolean(s.is_free),
            student_only: Boolean(s.student_only),
            program_slug: s.program_slug ?? '',
            published: s.published !== false,
          });
        } else {
          const res = await fetch('/api/admin/services');
          if (res.ok) {
            const data = await res.json();
            if (!cancelled) setCategories(data.categories ?? []);
          }
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isEdit, serviceId, authLoading]);

  function set<K extends keyof ServiceFormValue>(k: K, v: ServiceFormValue[K]) {
    setForm(prev => ({ ...prev, [k]: v }));
  }

  function toggleLevel(level: string) {
    setForm(prev => ({
      ...prev,
      eligible_kun_levels: prev.eligible_kun_levels.includes(level)
        ? prev.eligible_kun_levels.filter(l => l !== level)
        : [...prev.eligible_kun_levels, level],
    }));
  }

  function validate(): string | null {
    if (!form.name_ar.trim() || !form.name_en.trim()) {
      return isAr ? 'الاسم مطلوب بالعربية والإنجليزية' : 'name_ar and name_en are required';
    }
    const dur = Number(form.duration_minutes);
    if (!Number.isFinite(dur) || dur <= 0) {
      return isAr ? 'مدة الجلسة يجب أن تكون أكبر من صفر' : 'duration_minutes must be > 0';
    }
    if (form.discount_percentage) {
      const n = Number(form.discount_percentage);
      if (!Number.isFinite(n) || n < 0 || n > 100) {
        return isAr ? 'نسبة الخصم يجب أن تكون بين 0 و 100' : 'discount_percentage must be 0–100';
      }
    }
    if (form.discount_valid_until && !/^\d{4}-\d{2}-\d{2}$/.test(form.discount_valid_until)) {
      return isAr ? 'تاريخ انتهاء الخصم يجب أن يكون بصيغة YYYY-MM-DD' : 'discount_valid_until must be YYYY-MM-DD';
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
        slug: form.slug.trim() || null,
        name_ar: form.name_ar.trim(),
        name_en: form.name_en.trim(),
        description_ar: form.description_ar.trim() || null,
        description_en: form.description_en.trim() || null,
        duration_minutes: Number(form.duration_minutes),
        price_aed: Number(form.price_aed) || 0,
        price_egp: Number(form.price_egp) || 0,
        price_usd: Number(form.price_usd) || 0,
        price_eur: Number(form.price_eur) || 0,
        price_sar: Number(form.price_sar) || 0,
        category_id: form.category_id || null,
        sessions_count: form.sessions_count ? Number(form.sessions_count) : null,
        validity_days: form.validity_days ? Number(form.validity_days) : null,
        coach_control: form.coach_control,
        allows_coach_pricing: form.allows_coach_pricing,
        is_active: form.is_active,
        min_price_aed: Number(form.min_price_aed) || 0,
        min_price_egp: Number(form.min_price_egp) || 0,
        min_price_eur: Number(form.min_price_eur) || 0,
        eligible_kun_levels: form.eligible_kun_levels,
        // Phase 2a
        bundle_id: form.bundle_id.trim() || null,
        discount_percentage: form.discount_percentage ? Number(form.discount_percentage) : null,
        discount_valid_until: form.discount_valid_until || null,
        installment_enabled: form.installment_enabled,
        coach_level_min: form.coach_level_min || null,
        coach_level_exact: form.coach_level_exact || null,
        icf_credential_target: form.icf_credential_target || null,
        coach_slug: form.coach_slug.trim() || null,
        display_order: Number(form.display_order) || 0,
        is_free: form.is_free,
        student_only: form.student_only,
        program_slug: form.program_slug.trim() || null,
        published: form.published,
      };

      const url = isEdit ? `/api/admin/services/${serviceId}` : '/api/admin/services';
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
      router.push(`/${locale}/admin/services/list`);
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
              ? (isAr ? 'تعديل خدمة' : 'Edit Service')
              : (isAr ? 'إضافة خدمة' : 'New Service')}
          </Heading>
          <Link href={`/${locale}/admin/services/list`} className="text-[var(--color-primary)] text-sm hover:underline">
            <ArrowLeft className="w-4 h-4 inline-block rtl:rotate-180" /> {isAr ? 'قائمة الخدمات' : 'Back to list'}
          </Link>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 grid gap-5 max-w-4xl">
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-3 py-2 text-sm">{error}</div>
          )}

          {/* Identity */}
          <fieldset className="grid gap-4 rounded-xl border border-[var(--color-neutral-200)] p-4">
            <legend className="px-2 text-sm font-semibold">{isAr ? 'الهوية' : 'Identity'}</legend>
            <div className="grid md:grid-cols-2 gap-4">
              <Field label={isAr ? 'الاسم (عربي)' : 'Name (Arabic)'}>
                <input value={form.name_ar} onChange={e => set('name_ar', e.target.value)} className={inputCls} dir="rtl" required />
              </Field>
              <Field label={isAr ? 'الاسم (إنجليزي)' : 'Name (English)'}>
                <input value={form.name_en} onChange={e => set('name_en', e.target.value)} className={inputCls} required />
              </Field>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <Field label={isAr ? 'المعرّف (slug)' : 'Slug'} hint={isAr ? 'URL-آمن، فريد — مثال: individual-coaching-basic' : 'URL-safe, unique — e.g. individual-coaching-basic'}>
                <input value={form.slug} onChange={e => set('slug', e.target.value)} className={inputCls} placeholder="individual-coaching-basic" />
              </Field>
              <Field label={isAr ? 'الفئة' : 'Category'}>
                <select value={form.category_id} onChange={e => set('category_id', e.target.value)} className={inputCls}>
                  <option value="">—</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{isAr ? c.name_ar : c.name_en}</option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <Field label={isAr ? 'الوصف (عربي)' : 'Description (Arabic)'}>
                <textarea value={form.description_ar} onChange={e => set('description_ar', e.target.value)} className={`${inputCls} min-h-[80px]`} dir="rtl" />
              </Field>
              <Field label={isAr ? 'الوصف (إنجليزي)' : 'Description (English)'}>
                <textarea value={form.description_en} onChange={e => set('description_en', e.target.value)} className={`${inputCls} min-h-[80px]`} />
              </Field>
            </div>
          </fieldset>

          {/* Pricing */}
          <fieldset className="grid gap-4 rounded-xl border border-[var(--color-neutral-200)] p-4">
            <legend className="px-2 text-sm font-semibold">{isAr ? 'التسعير' : 'Pricing'}</legend>
            <div className="grid md:grid-cols-5 gap-3">
              <Field label="AED"><input type="number" value={form.price_aed} onChange={e => set('price_aed', e.target.value)} className={inputCls} min={0} /></Field>
              <Field label="EGP"><input type="number" value={form.price_egp} onChange={e => set('price_egp', e.target.value)} className={inputCls} min={0} /></Field>
              <Field label="USD"><input type="number" value={form.price_usd} onChange={e => set('price_usd', e.target.value)} className={inputCls} min={0} /></Field>
              <Field label="EUR"><input type="number" value={form.price_eur} onChange={e => set('price_eur', e.target.value)} className={inputCls} min={0} /></Field>
              <Field label="SAR"><input type="number" value={form.price_sar} onChange={e => set('price_sar', e.target.value)} className={inputCls} min={0} /></Field>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <Field label={isAr ? 'نسبة الخصم (%)' : 'Discount %'} hint="0–100">
                <input type="number" value={form.discount_percentage} onChange={e => set('discount_percentage', e.target.value)} className={inputCls} min={0} max={100} />
              </Field>
              <Field label={isAr ? 'تاريخ انتهاء الخصم' : 'Discount valid until'} hint="YYYY-MM-DD">
                <input type="date" value={form.discount_valid_until} onChange={e => set('discount_valid_until', e.target.value)} className={inputCls} />
              </Field>
            </div>
            <label className="inline-flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.installment_enabled} onChange={e => set('installment_enabled', e.target.checked)} className="rounded" />
              <span>{isAr ? 'السماح بالتقسيط' : 'Installments enabled'}</span>
            </label>
            <label className="inline-flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.is_free} onChange={e => set('is_free', e.target.checked)} className="rounded" />
              <span>{isAr ? 'خدمة مجانية' : 'Free service'}</span>
            </label>
          </fieldset>

          {/* Package / duration */}
          <fieldset className="grid gap-4 rounded-xl border border-[var(--color-neutral-200)] p-4">
            <legend className="px-2 text-sm font-semibold">{isAr ? 'الجلسة والباقة' : 'Session & Package'}</legend>
            <div className="grid md:grid-cols-4 gap-3">
              <Field label={isAr ? 'مدة الجلسة (د)' : 'Duration (min)'}>
                <input type="number" value={form.duration_minutes} onChange={e => set('duration_minutes', e.target.value)} className={inputCls} min={1} required />
              </Field>
              <Field label={isAr ? 'عدد الجلسات' : 'Sessions count'} hint={isAr ? 'اختياري' : 'Optional'}>
                <input type="number" value={form.sessions_count} onChange={e => set('sessions_count', e.target.value)} className={inputCls} min={1} />
              </Field>
              <Field label={isAr ? 'مدة الصلاحية (يوم)' : 'Validity (days)'}>
                <input type="number" value={form.validity_days} onChange={e => set('validity_days', e.target.value)} className={inputCls} min={1} />
              </Field>
              <Field label={isAr ? 'معرّف الباقة' : 'Bundle ID'} hint={isAr ? 'لربط الخدمات معًا' : 'Group with other services'}>
                <input value={form.bundle_id} onChange={e => set('bundle_id', e.target.value)} className={inputCls} />
              </Field>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <Field label={isAr ? 'برنامج مرتبط (slug)' : 'Program slug'} hint="e.g. manhajak">
                <input value={form.program_slug} onChange={e => set('program_slug', e.target.value)} className={inputCls} />
              </Field>
              <Field label={isAr ? 'كوتش محدد (slug)' : 'Pinned coach slug'} hint={isAr ? 'فارغ = أي كوتش مؤهل' : 'Empty = any eligible coach'}>
                <input value={form.coach_slug} onChange={e => set('coach_slug', e.target.value)} className={inputCls} />
              </Field>
            </div>
          </fieldset>

          {/* Coach eligibility */}
          <fieldset className="grid gap-4 rounded-xl border border-[var(--color-neutral-200)] p-4">
            <legend className="px-2 text-sm font-semibold">{isAr ? 'متطلبات الكوتش' : 'Coach Requirements'}</legend>
            <div className="grid md:grid-cols-3 gap-4">
              <Field label={isAr ? 'الحد الأدنى لمستوى Kun' : 'Min Kun level'}>
                <select value={form.coach_level_min} onChange={e => set('coach_level_min', e.target.value)} className={inputCls}>
                  <option value="">—</option>
                  {COACH_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </Field>
              <Field label={isAr ? 'مستوى Kun المطلوب (حصري)' : 'Exact Kun level'}>
                <select value={form.coach_level_exact} onChange={e => set('coach_level_exact', e.target.value)} className={inputCls}>
                  <option value="">—</option>
                  {COACH_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </Field>
              <Field label={isAr ? 'اعتماد ICF المستهدف' : 'ICF credential target'}>
                <select value={form.icf_credential_target} onChange={e => set('icf_credential_target', e.target.value)} className={inputCls}>
                  <option value="">—</option>
                  {ICF_CREDENTIALS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
            </div>
            <Field label={isAr ? 'المستويات المؤهّلة (مصفوفة)' : 'Eligible Kun levels (array)'} hint={isAr ? 'تحديد متعدد — فارغ = كل المستويات' : 'Multi-select — empty = all levels'}>
              <div className="flex flex-wrap gap-2">
                {KUN_LEVELS.map(level => (
                  <label key={level} className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-neutral-200)] px-3 py-1.5 text-sm cursor-pointer hover:bg-[var(--color-neutral-50)]">
                    <input
                      type="checkbox"
                      checked={form.eligible_kun_levels.includes(level)}
                      onChange={() => toggleLevel(level)}
                      className="rounded"
                    />
                    <span>{level}</span>
                  </label>
                ))}
              </div>
            </Field>
          </fieldset>

          {/* Operational controls */}
          <fieldset className="grid gap-4 rounded-xl border border-[var(--color-neutral-200)] p-4">
            <legend className="px-2 text-sm font-semibold">{isAr ? 'إعدادات التشغيل' : 'Operational Controls'}</legend>
            <div className="grid md:grid-cols-2 gap-4">
              <Field label={isAr ? 'تحكّم الكوتش' : 'Coach control'}>
                <select value={form.coach_control} onChange={e => set('coach_control', e.target.value as typeof COACH_CONTROLS[number])} className={inputCls}>
                  {COACH_CONTROLS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
              <Field label={isAr ? 'ترتيب العرض' : 'Display order'} hint={isAr ? 'الأرقام الأصغر تظهر أولاً' : 'Lower numbers appear first'}>
                <input type="number" value={form.display_order} onChange={e => set('display_order', e.target.value)} className={inputCls} step={1} />
              </Field>
            </div>
            <div className="grid md:grid-cols-3 gap-3">
              <Field label={isAr ? 'الحد الأدنى للسعر (AED)' : 'Min price (AED)'}>
                <input type="number" value={form.min_price_aed} onChange={e => set('min_price_aed', e.target.value)} className={inputCls} min={0} />
              </Field>
              <Field label={isAr ? 'الحد الأدنى للسعر (EGP)' : 'Min price (EGP)'}>
                <input type="number" value={form.min_price_egp} onChange={e => set('min_price_egp', e.target.value)} className={inputCls} min={0} />
              </Field>
              <Field label={isAr ? 'الحد الأدنى للسعر (EUR)' : 'Min price (EUR)'}>
                <input type="number" value={form.min_price_eur} onChange={e => set('min_price_eur', e.target.value)} className={inputCls} min={0} />
              </Field>
            </div>
            <div className="grid md:grid-cols-2 gap-3 text-sm">
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={form.allows_coach_pricing} onChange={e => set('allows_coach_pricing', e.target.checked)} className="rounded" />
                <span>{isAr ? 'السماح للكوتش بتعديل السعر' : 'Allow coach custom pricing'}</span>
              </label>
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={form.student_only} onChange={e => set('student_only', e.target.checked)} className="rounded" />
                <span>{isAr ? 'مرئي فقط للطلاب' : 'Student-only visibility'}</span>
              </label>
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={form.is_active} onChange={e => set('is_active', e.target.checked)} className="rounded" />
                <span>{isAr ? 'نشط' : 'Active'}</span>
              </label>
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={form.published} onChange={e => set('published', e.target.checked)} className="rounded" />
                <span>{isAr ? 'منشور' : 'Published'}</span>
              </label>
            </div>
          </fieldset>

          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={submitting}>
              {submitting
                ? (isAr ? 'جارٍ الحفظ...' : 'Saving...')
                : isEdit ? (isAr ? 'حفظ التغييرات' : 'Save Changes') : (isAr ? 'إنشاء' : 'Create')}
            </Button>
            <Link href={`/${locale}/admin/services/list`} className="inline-flex items-center rounded-lg px-4 py-2 text-sm border border-[var(--color-neutral-200)] hover:bg-[var(--color-neutral-50)]">
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
