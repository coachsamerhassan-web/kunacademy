'use client';

/**
 * Shared create/edit form for /admin/programs.
 * CMS→DB Phase 2d (2026-04-21).
 *
 * Mirrors the Phase 2c landing-pages form shape. Exposes every CMS `Program`
 * column (bilingual identity, pricing, ICF, SEO, curriculum, FAQ). JSONB
 * fields (curriculum_json, faq_json) use textarea + JSON.parse validation.
 */

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@kunacademy/auth';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';
import { Button } from '@kunacademy/ui/button';
import Link from 'next/link';
import { ArrowLeft, ExternalLink } from 'lucide-react';

const NAV_GROUPS = [
  'certifications',
  'courses',
  'retreats',
  'micro-courses',
  'corporate',
  'free',
  'community',
] as const;
type NavGroup = typeof NAV_GROUPS[number];

const TYPES = [
  'certification',
  'diploma',
  'recorded-course',
  'live-course',
  'retreat',
  'micro-course',
  'workshop',
  'free-resource',
] as const;
type PType = typeof TYPES[number];

const FORMATS = ['online', 'in-person', 'hybrid'] as const;
type PFormat = typeof FORMATS[number];

const STATUSES = ['active', 'coming-soon', 'archived', 'paused'] as const;
type PStatus = typeof STATUSES[number];

interface FormValue {
  id?: string;
  // identity
  slug: string;
  title_ar: string;
  title_en: string;
  subtitle_ar: string;
  subtitle_en: string;
  description_ar: string;
  description_en: string;
  // taxonomy
  nav_group: NavGroup;
  type: PType;
  format: PFormat;
  status: PStatus;
  category: string;
  parent_code: string;
  // people + place + timing
  instructor_slug: string;
  location: string;
  duration: string;
  next_start_date: string;
  enrollment_deadline: string;
  access_duration_days: string;
  // pricing
  price_aed: string;
  price_egp: string;
  price_usd: string;
  price_eur: string;
  early_bird_price_aed: string;
  early_bird_deadline: string;
  discount_percentage: string;
  discount_valid_until: string;
  installment_enabled: boolean;
  bundle_id: string;
  // ICF
  is_icf_accredited: boolean;
  icf_details: string;
  cce_units: string;
  // visual
  hero_image_url: string;
  thumbnail_url: string;
  program_logo: string;
  promo_video_url: string;
  // pathways
  prerequisite_codes: string; // comma-separated
  pathway_codes: string;
  // rich
  curriculum_json: string;
  faq_json: string;
  journey_stages: string;
  materials_folder_url: string;
  content_doc_id: string;
  // SEO
  meta_title_ar: string;
  meta_title_en: string;
  meta_description_ar: string;
  meta_description_en: string;
  og_image_url: string;
  // flags
  is_featured: boolean;
  is_free: boolean;
  display_order: string;
  published: boolean;
}

const EMPTY: FormValue = {
  slug: '',
  title_ar: '',
  title_en: '',
  subtitle_ar: '',
  subtitle_en: '',
  description_ar: '',
  description_en: '',
  nav_group: 'courses',
  type: 'live-course',
  format: 'online',
  status: 'active',
  category: '',
  parent_code: '',
  instructor_slug: '',
  location: '',
  duration: '',
  next_start_date: '',
  enrollment_deadline: '',
  access_duration_days: '',
  price_aed: '',
  price_egp: '',
  price_usd: '',
  price_eur: '',
  early_bird_price_aed: '',
  early_bird_deadline: '',
  discount_percentage: '',
  discount_valid_until: '',
  installment_enabled: false,
  bundle_id: '',
  is_icf_accredited: false,
  icf_details: '',
  cce_units: '',
  hero_image_url: '',
  thumbnail_url: '',
  program_logo: '',
  promo_video_url: '',
  prerequisite_codes: '',
  pathway_codes: '',
  curriculum_json: '',
  faq_json: '',
  journey_stages: '',
  materials_folder_url: '',
  content_doc_id: '',
  meta_title_ar: '',
  meta_title_en: '',
  meta_description_ar: '',
  meta_description_en: '',
  og_image_url: '',
  is_featured: false,
  is_free: false,
  display_order: '0',
  published: true,
};

interface Props {
  programId?: string;
}

function arrToCsv(v: unknown): string {
  if (!v) return '';
  if (Array.isArray(v)) return v.join(', ');
  return String(v);
}

export default function ProgramForm({ programId }: Props) {
  const { locale } = useParams<{ locale: string }>();
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const isAr = locale === 'ar';
  const isEdit = Boolean(programId);

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
          const res = await fetch(`/api/admin/programs/${programId}`);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();
          if (cancelled) return;
          const p = data.program;
          setForm({
            id: p.id,
            slug: p.slug ?? '',
            title_ar: p.title_ar ?? '',
            title_en: p.title_en ?? '',
            subtitle_ar: p.subtitle_ar ?? '',
            subtitle_en: p.subtitle_en ?? '',
            description_ar: p.description_ar ?? '',
            description_en: p.description_en ?? '',
            nav_group: (p.nav_group ?? 'courses') as NavGroup,
            type: (p.type ?? 'live-course') as PType,
            format: (p.format ?? 'online') as PFormat,
            status: (p.status ?? 'active') as PStatus,
            category: p.category ?? '',
            parent_code: p.parent_code ?? '',
            instructor_slug: p.instructor_slug ?? '',
            location: p.location ?? '',
            duration: p.duration ?? '',
            next_start_date: p.next_start_date ?? '',
            enrollment_deadline: p.enrollment_deadline ?? '',
            access_duration_days: p.access_duration_days?.toString() ?? '',
            price_aed: p.price_aed?.toString() ?? '',
            price_egp: p.price_egp?.toString() ?? '',
            price_usd: p.price_usd?.toString() ?? '',
            price_eur: p.price_eur?.toString() ?? '',
            early_bird_price_aed: p.early_bird_price_aed?.toString() ?? '',
            early_bird_deadline: p.early_bird_deadline ?? '',
            discount_percentage: p.discount_percentage?.toString() ?? '',
            discount_valid_until: p.discount_valid_until ?? '',
            installment_enabled: Boolean(p.installment_enabled),
            bundle_id: p.bundle_id ?? '',
            is_icf_accredited: Boolean(p.is_icf_accredited),
            icf_details: p.icf_details ?? '',
            cce_units: p.cce_units?.toString() ?? '',
            hero_image_url: p.hero_image_url ?? '',
            thumbnail_url: p.thumbnail_url ?? '',
            program_logo: p.program_logo ?? '',
            promo_video_url: p.promo_video_url ?? '',
            prerequisite_codes: arrToCsv(p.prerequisite_codes),
            pathway_codes: arrToCsv(p.pathway_codes),
            curriculum_json:
              p.curriculum_json == null
                ? ''
                : typeof p.curriculum_json === 'string'
                  ? p.curriculum_json
                  : JSON.stringify(p.curriculum_json, null, 2),
            faq_json:
              p.faq_json == null
                ? ''
                : typeof p.faq_json === 'string'
                  ? p.faq_json
                  : JSON.stringify(p.faq_json, null, 2),
            journey_stages: p.journey_stages ?? '',
            materials_folder_url: p.materials_folder_url ?? '',
            content_doc_id: p.content_doc_id ?? '',
            meta_title_ar: p.meta_title_ar ?? '',
            meta_title_en: p.meta_title_en ?? '',
            meta_description_ar: p.meta_description_ar ?? '',
            meta_description_en: p.meta_description_en ?? '',
            og_image_url: p.og_image_url ?? '',
            is_featured: Boolean(p.is_featured),
            is_free: Boolean(p.is_free),
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
  }, [isEdit, programId, authLoading]);

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
    for (const field of ['curriculum_json', 'faq_json'] as const) {
      const raw = form[field].trim();
      if (!raw) continue;
      try {
        JSON.parse(raw);
      } catch (e: unknown) {
        return `${field}: ${e instanceof Error ? e.message : 'invalid JSON'}`;
      }
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
      // Build body — empty strings become null on backend via API validator; numerics coerced there
      const body: Record<string, unknown> = {
        slug: form.slug.trim(),
        title_ar: form.title_ar.trim(),
        title_en: form.title_en.trim(),
        subtitle_ar: form.subtitle_ar,
        subtitle_en: form.subtitle_en,
        description_ar: form.description_ar,
        description_en: form.description_en,
        nav_group: form.nav_group,
        type: form.type,
        format: form.format,
        status: form.status,
        category: form.category,
        parent_code: form.parent_code,
        instructor_slug: form.instructor_slug,
        location: form.location,
        duration: form.duration,
        next_start_date: form.next_start_date,
        enrollment_deadline: form.enrollment_deadline,
        access_duration_days: form.access_duration_days,
        price_aed: form.price_aed,
        price_egp: form.price_egp,
        price_usd: form.price_usd,
        price_eur: form.price_eur,
        early_bird_price_aed: form.early_bird_price_aed,
        early_bird_deadline: form.early_bird_deadline,
        discount_percentage: form.discount_percentage,
        discount_valid_until: form.discount_valid_until,
        installment_enabled: form.installment_enabled,
        bundle_id: form.bundle_id,
        is_icf_accredited: form.is_icf_accredited,
        icf_details: form.icf_details,
        cce_units: form.cce_units,
        hero_image_url: form.hero_image_url,
        thumbnail_url: form.thumbnail_url,
        program_logo: form.program_logo,
        promo_video_url: form.promo_video_url,
        prerequisite_codes: form.prerequisite_codes,
        pathway_codes: form.pathway_codes,
        curriculum_json: form.curriculum_json || null,
        faq_json: form.faq_json || null,
        journey_stages: form.journey_stages,
        materials_folder_url: form.materials_folder_url,
        content_doc_id: form.content_doc_id,
        meta_title_ar: form.meta_title_ar,
        meta_title_en: form.meta_title_en,
        meta_description_ar: form.meta_description_ar,
        meta_description_en: form.meta_description_en,
        og_image_url: form.og_image_url,
        is_featured: form.is_featured,
        is_free: form.is_free,
        display_order: form.display_order,
        published: form.published,
      };
      const url = isEdit ? `/api/admin/programs/${programId}` : '/api/admin/programs';
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
      router.push(`/${locale}/admin/programs`);
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

  const previewHref = form.slug ? `/${locale}/programs/${form.slug}` : null;

  return (
    <main>
      <Section variant="white">
        <div className="flex items-center justify-between">
          <Heading level={1}>
            {isEdit
              ? isAr
                ? 'تعديل برنامج'
                : 'Edit Program'
              : isAr
                ? 'إضافة برنامج'
                : 'New Program'}
          </Heading>
          <Link
            href={`/${locale}/admin/programs`}
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
              <Field label={isAr ? 'الفئة (category)' : 'Category'}>
                <input
                  value={form.category}
                  onChange={(e) => set('category', e.target.value)}
                  className={inputCls}
                  placeholder="certification | specialization | ..."
                />
              </Field>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <Field label="Title (AR)">
                <input value={form.title_ar} onChange={(e) => set('title_ar', e.target.value)} className={inputCls} required dir="rtl" />
              </Field>
              <Field label="Title (EN)">
                <input value={form.title_en} onChange={(e) => set('title_en', e.target.value)} className={inputCls} required />
              </Field>
              <Field label="Subtitle (AR)">
                <input value={form.subtitle_ar} onChange={(e) => set('subtitle_ar', e.target.value)} className={inputCls} dir="rtl" />
              </Field>
              <Field label="Subtitle (EN)">
                <input value={form.subtitle_en} onChange={(e) => set('subtitle_en', e.target.value)} className={inputCls} />
              </Field>
              <Field label="Description (AR)">
                <textarea value={form.description_ar} onChange={(e) => set('description_ar', e.target.value)} className={`${inputCls} min-h-[80px]`} dir="rtl" />
              </Field>
              <Field label="Description (EN)">
                <textarea value={form.description_en} onChange={(e) => set('description_en', e.target.value)} className={`${inputCls} min-h-[80px]`} />
              </Field>
            </div>
          </fieldset>

          {/* Taxonomy */}
          <fieldset className="grid gap-4 rounded-xl border border-[var(--color-neutral-200)] p-4">
            <legend className="px-2 text-sm font-semibold">{isAr ? 'التصنيف' : 'Taxonomy'}</legend>
            <div className="grid md:grid-cols-4 gap-4">
              <Field label="Nav group">
                <select value={form.nav_group} onChange={(e) => set('nav_group', e.target.value as NavGroup)} className={inputCls}>
                  {NAV_GROUPS.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </Field>
              <Field label="Type">
                <select value={form.type} onChange={(e) => set('type', e.target.value as PType)} className={inputCls}>
                  {TYPES.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </Field>
              <Field label="Format">
                <select value={form.format} onChange={(e) => set('format', e.target.value as PFormat)} className={inputCls}>
                  {FORMATS.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </Field>
              <Field label="Status">
                <select value={form.status} onChange={(e) => set('status', e.target.value as PStatus)} className={inputCls}>
                  {STATUSES.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </Field>
              <Field label="Parent code"><input value={form.parent_code} onChange={(e) => set('parent_code', e.target.value)} className={inputCls} /></Field>
              <Field label="Prerequisite codes (csv)"><input value={form.prerequisite_codes} onChange={(e) => set('prerequisite_codes', e.target.value)} className={inputCls} /></Field>
              <Field label="Pathway codes (csv)"><input value={form.pathway_codes} onChange={(e) => set('pathway_codes', e.target.value)} className={inputCls} /></Field>
              <Field label="Bundle id"><input value={form.bundle_id} onChange={(e) => set('bundle_id', e.target.value)} className={inputCls} /></Field>
            </div>
          </fieldset>

          {/* People + Place + Timing */}
          <fieldset className="grid gap-4 rounded-xl border border-[var(--color-neutral-200)] p-4">
            <legend className="px-2 text-sm font-semibold">{isAr ? 'المكان والجدول' : 'People + Place + Timing'}</legend>
            <div className="grid md:grid-cols-3 gap-4">
              <Field label="Instructor slug"><input value={form.instructor_slug} onChange={(e) => set('instructor_slug', e.target.value)} className={inputCls} /></Field>
              <Field label="Location"><input value={form.location} onChange={(e) => set('location', e.target.value)} className={inputCls} /></Field>
              <Field label="Duration (free text)"><input value={form.duration} onChange={(e) => set('duration', e.target.value)} className={inputCls} placeholder="e.g. 40 hours / 3 days" /></Field>
              <Field label="Next start date (YYYY-MM-DD)"><input value={form.next_start_date} onChange={(e) => set('next_start_date', e.target.value)} className={inputCls} /></Field>
              <Field label="Enrollment deadline"><input value={form.enrollment_deadline} onChange={(e) => set('enrollment_deadline', e.target.value)} className={inputCls} /></Field>
              <Field label="Access duration (days)"><input type="number" value={form.access_duration_days} onChange={(e) => set('access_duration_days', e.target.value)} className={inputCls} /></Field>
            </div>
          </fieldset>

          {/* Pricing */}
          <fieldset className="grid gap-4 rounded-xl border border-[var(--color-neutral-200)] p-4">
            <legend className="px-2 text-sm font-semibold">{isAr ? 'التسعير' : 'Pricing'}</legend>
            <div className="grid md:grid-cols-4 gap-4">
              <Field label="AED"><input value={form.price_aed} onChange={(e) => set('price_aed', e.target.value)} className={inputCls} /></Field>
              <Field label="EGP"><input value={form.price_egp} onChange={(e) => set('price_egp', e.target.value)} className={inputCls} /></Field>
              <Field label="USD"><input value={form.price_usd} onChange={(e) => set('price_usd', e.target.value)} className={inputCls} /></Field>
              <Field label="EUR"><input value={form.price_eur} onChange={(e) => set('price_eur', e.target.value)} className={inputCls} /></Field>
              <Field label="Early bird AED"><input value={form.early_bird_price_aed} onChange={(e) => set('early_bird_price_aed', e.target.value)} className={inputCls} /></Field>
              <Field label="Early bird deadline"><input value={form.early_bird_deadline} onChange={(e) => set('early_bird_deadline', e.target.value)} className={inputCls} /></Field>
              <Field label="Discount %"><input value={form.discount_percentage} onChange={(e) => set('discount_percentage', e.target.value)} className={inputCls} /></Field>
              <Field label="Discount valid until"><input value={form.discount_valid_until} onChange={(e) => set('discount_valid_until', e.target.value)} className={inputCls} /></Field>
            </div>
            <label className="inline-flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.installment_enabled} onChange={(e) => set('installment_enabled', e.target.checked)} className="rounded" />
              {isAr ? 'تقسيط مفعَّل' : 'Installments enabled'}
            </label>
          </fieldset>

          {/* ICF */}
          <fieldset className="grid gap-4 rounded-xl border border-[var(--color-neutral-200)] p-4">
            <legend className="px-2 text-sm font-semibold">ICF</legend>
            <div className="grid md:grid-cols-3 gap-4">
              <label className="inline-flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.is_icf_accredited} onChange={(e) => set('is_icf_accredited', e.target.checked)} className="rounded" />
                {isAr ? 'معتمد من ICF' : 'ICF-accredited'}
              </label>
              <Field label="ICF details"><input value={form.icf_details} onChange={(e) => set('icf_details', e.target.value)} className={inputCls} /></Field>
              <Field label="CCE units"><input value={form.cce_units} onChange={(e) => set('cce_units', e.target.value)} className={inputCls} /></Field>
            </div>
          </fieldset>

          {/* Visual */}
          <fieldset className="grid gap-4 rounded-xl border border-[var(--color-neutral-200)] p-4">
            <legend className="px-2 text-sm font-semibold">{isAr ? 'الصور' : 'Visual'}</legend>
            <div className="grid md:grid-cols-2 gap-4">
              <Field label="Hero image URL"><input value={form.hero_image_url} onChange={(e) => set('hero_image_url', e.target.value)} className={inputCls} /></Field>
              <Field label="Thumbnail URL"><input value={form.thumbnail_url} onChange={(e) => set('thumbnail_url', e.target.value)} className={inputCls} /></Field>
              <Field label="Program logo URL"><input value={form.program_logo} onChange={(e) => set('program_logo', e.target.value)} className={inputCls} /></Field>
              <Field label="Promo video URL"><input value={form.promo_video_url} onChange={(e) => set('promo_video_url', e.target.value)} className={inputCls} /></Field>
            </div>
          </fieldset>

          {/* Rich content */}
          <fieldset className="grid gap-3 rounded-xl border border-[var(--color-neutral-200)] p-4">
            <legend className="px-2 text-sm font-semibold">{isAr ? 'المحتوى المفصَّل' : 'Rich content'}</legend>
            <Field label="Journey stages (free text)">
              <textarea value={form.journey_stages} onChange={(e) => set('journey_stages', e.target.value)} className={`${inputCls} min-h-[80px]`} />
            </Field>
            <Field label="Materials folder URL">
              <input value={form.materials_folder_url} onChange={(e) => set('materials_folder_url', e.target.value)} className={inputCls} />
            </Field>
            <Field label="Content doc id (Google Doc)">
              <input value={form.content_doc_id} onChange={(e) => set('content_doc_id', e.target.value)} className={inputCls} />
            </Field>
            <Field label="curriculum_json (array of modules)">
              <textarea
                value={form.curriculum_json}
                onChange={(e) => set('curriculum_json', e.target.value)}
                className={`${inputCls} font-mono text-xs min-h-[140px]`}
                spellCheck={false}
              />
            </Field>
            <Field label="faq_json (array of Q&A)">
              <textarea
                value={form.faq_json}
                onChange={(e) => set('faq_json', e.target.value)}
                className={`${inputCls} font-mono text-xs min-h-[140px]`}
                spellCheck={false}
              />
            </Field>
          </fieldset>

          {/* SEO */}
          <fieldset className="grid gap-4 rounded-xl border border-[var(--color-neutral-200)] p-4">
            <legend className="px-2 text-sm font-semibold">SEO</legend>
            <div className="grid md:grid-cols-2 gap-4">
              <Field label="Meta title AR"><input value={form.meta_title_ar} onChange={(e) => set('meta_title_ar', e.target.value)} className={inputCls} dir="rtl" /></Field>
              <Field label="Meta title EN"><input value={form.meta_title_en} onChange={(e) => set('meta_title_en', e.target.value)} className={inputCls} /></Field>
              <Field label="Meta description AR"><textarea value={form.meta_description_ar} onChange={(e) => set('meta_description_ar', e.target.value)} className={`${inputCls} min-h-[60px]`} dir="rtl" /></Field>
              <Field label="Meta description EN"><textarea value={form.meta_description_en} onChange={(e) => set('meta_description_en', e.target.value)} className={`${inputCls} min-h-[60px]`} /></Field>
              <Field label="OG image URL"><input value={form.og_image_url} onChange={(e) => set('og_image_url', e.target.value)} className={inputCls} /></Field>
            </div>
          </fieldset>

          {/* Flags + submit */}
          <fieldset className="grid gap-4 rounded-xl border border-[var(--color-neutral-200)] p-4">
            <legend className="px-2 text-sm font-semibold">{isAr ? 'حالة النشر' : 'Flags'}</legend>
            <div className="flex flex-wrap items-center gap-6 text-sm">
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={form.published} onChange={(e) => set('published', e.target.checked)} className="rounded" />
                {isAr ? 'منشور' : 'Published'}
              </label>
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={form.is_featured} onChange={(e) => set('is_featured', e.target.checked)} className="rounded" />
                {isAr ? 'مُميَّز' : 'Featured'}
              </label>
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={form.is_free} onChange={(e) => set('is_free', e.target.checked)} className="rounded" />
                {isAr ? 'مجاني' : 'Free'}
              </label>
              {previewHref && (
                <a href={previewHref} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[var(--color-primary)] hover:underline">
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
              href={`/${locale}/admin/programs`}
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
