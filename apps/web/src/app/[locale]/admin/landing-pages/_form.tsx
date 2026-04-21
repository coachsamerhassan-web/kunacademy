'use client';

/**
 * Shared create/edit form for /admin/landing-pages.
 * CMS→DB Phase 2c (2026-04-21).
 *
 * JSONB fields (sections_json, hero_json, seo_meta_json) use pretty-printed
 * textareas with JSON.parse validation + bilingual-pair structural check for
 * sections_json. Matches the pattern used by Phase 2a/2b forms.
 */

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@kunacademy/auth';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';
import { Button } from '@kunacademy/ui/button';
import Link from 'next/link';
import { ArrowLeft, ExternalLink } from 'lucide-react';

const PAGE_TYPES = ['page', 'landing', 'legal'] as const;
type PageType = typeof PAGE_TYPES[number];

interface FormValue {
  id?: string;
  slug: string;
  page_type: PageType;
  program_slug: string;
  sections_json: string; // pretty-printed JSON
  hero_json: string;
  seo_meta_json: string;
  published: boolean;
}

const EMPTY: FormValue = {
  slug: '',
  page_type: 'landing',
  program_slug: '',
  sections_json: JSON.stringify(
    {
      hero: {
        title: { ar: '', en: '' },
        subtitle: { ar: '', en: '' },
      },
    },
    null,
    2,
  ),
  hero_json: JSON.stringify({}, null, 2),
  seo_meta_json: JSON.stringify(
    {
      meta_title_ar: '',
      meta_title_en: '',
      meta_description_ar: '',
      meta_description_en: '',
    },
    null,
    2,
  ),
  published: true,
};

interface Props {
  pageId?: string;
}

export default function LandingPageForm({ pageId }: Props) {
  const { locale } = useParams<{ locale: string }>();
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const isAr = locale === 'ar';
  const isEdit = Boolean(pageId);

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
          const res = await fetch(`/api/admin/landing-pages/${pageId}`);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();
          if (cancelled) return;
          const p = data.page;
          setForm({
            id: p.id,
            slug: p.slug ?? '',
            page_type: (p.page_type ?? 'page') as PageType,
            program_slug: p.program_slug ?? '',
            sections_json: JSON.stringify(p.sections_json ?? {}, null, 2),
            hero_json: JSON.stringify(p.hero_json ?? {}, null, 2),
            seo_meta_json: JSON.stringify(p.seo_meta_json ?? {}, null, 2),
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
  }, [isEdit, pageId, authLoading]);

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
    // JSON structural check (server repeats it, but catch early)
    for (const field of ['sections_json', 'hero_json', 'seo_meta_json'] as const) {
      const raw = form[field].trim();
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw);
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
          return `${field}: must be a JSON object`;
        }
        if (field === 'sections_json') {
          for (const [section, keys] of Object.entries(parsed as Record<string, unknown>)) {
            if (!keys || typeof keys !== 'object' || Array.isArray(keys)) {
              return `sections_json.${section}: must be { key: { ar, en } }`;
            }
            for (const [key, bi] of Object.entries(keys as Record<string, unknown>)) {
              const pair = bi as Record<string, unknown>;
              if (!pair || typeof pair !== 'object' || typeof pair.ar !== 'string' || typeof pair.en !== 'string') {
                return `sections_json.${section}.${key}: must have string ar + en`;
              }
            }
          }
        }
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
      const body: Record<string, unknown> = {
        slug: form.slug.trim(),
        page_type: form.page_type,
        program_slug: form.program_slug.trim() || null,
        sections_json: JSON.parse(form.sections_json),
        hero_json: JSON.parse(form.hero_json || '{}'),
        seo_meta_json: JSON.parse(form.seo_meta_json || '{}'),
        published: form.published,
      };
      const url = isEdit ? `/api/admin/landing-pages/${pageId}` : '/api/admin/landing-pages';
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
      router.push(`/${locale}/admin/landing-pages`);
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

  const previewHref = form.slug
    ? form.page_type === 'landing'
      ? `/${locale}/landing/${form.slug}`
      : `/${locale}/${form.slug}`
    : null;

  return (
    <main>
      <Section variant="white">
        <div className="flex items-center justify-between">
          <Heading level={1}>
            {isEdit
              ? isAr
                ? 'تعديل صفحة'
                : 'Edit Landing Page'
              : isAr
                ? 'إضافة صفحة'
                : 'New Landing Page'}
          </Heading>
          <Link
            href={`/${locale}/admin/landing-pages`}
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
              <Field
                label={isAr ? 'المعرّف (slug)' : 'Slug'}
                hint={
                  isAr
                    ? 'URL-آمن، فريد — مثال: spring-campaign-2026'
                    : 'URL-safe, unique — e.g. spring-campaign-2026'
                }
              >
                <input
                  value={form.slug}
                  onChange={(e) => set('slug', e.target.value)}
                  className={inputCls}
                  placeholder="spring-campaign-2026"
                  required
                />
              </Field>
              <Field label={isAr ? 'نوع الصفحة' : 'Page Type'}>
                <select
                  value={form.page_type}
                  onChange={(e) => set('page_type', e.target.value as PageType)}
                  className={inputCls}
                >
                  {PAGE_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </Field>
              <Field
                label={isAr ? 'برنامج مرتبط (slug)' : 'Program slug'}
                hint={isAr ? 'اختياري — للربط ببرنامج محدد' : 'Optional — link to a program'}
              >
                <input
                  value={form.program_slug}
                  onChange={(e) => set('program_slug', e.target.value)}
                  className={inputCls}
                  placeholder="manhajak"
                />
              </Field>
            </div>
            <div className="flex items-center gap-6 text-sm flex-wrap">
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.published}
                  onChange={(e) => set('published', e.target.checked)}
                  className="rounded"
                />
                <span>{isAr ? 'منشور' : 'Published'}</span>
              </label>
              {previewHref && (
                <a
                  href={previewHref}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[var(--color-primary)] hover:underline"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  {isAr ? 'معاينة الصفحة' : 'Preview page'}
                </a>
              )}
            </div>
          </fieldset>

          {/* Sections JSONB */}
          <fieldset className="grid gap-3 rounded-xl border border-[var(--color-neutral-200)] p-4">
            <legend className="px-2 text-sm font-semibold">{isAr ? 'محتوى الصفحة' : 'Page Sections'}</legend>
            <p className="text-xs text-[var(--color-neutral-500)]">
              {isAr
                ? 'JSON بصيغة: { "section": { "key": { "ar": "...", "en": "..." } } }'
                : 'JSON shape: { "section": { "key": { "ar": "...", "en": "..." } } }'}
            </p>
            <textarea
              value={form.sections_json}
              onChange={(e) => set('sections_json', e.target.value)}
              className={`${inputCls} font-mono text-xs min-h-[260px] leading-relaxed`}
              spellCheck={false}
            />
          </fieldset>

          {/* Hero JSONB (landing-only) */}
          <fieldset className="grid gap-3 rounded-xl border border-[var(--color-neutral-200)] p-4">
            <legend className="px-2 text-sm font-semibold">
              {isAr ? 'البطل والنداء (Landing)' : 'Hero & CTA (landing-only)'}
            </legend>
            <p className="text-xs text-[var(--color-neutral-500)]">
              {isAr
                ? 'JSON اختياري: { "hero_image_url", "cta_text_ar/en", "cta_url", "form_embed" }'
                : 'Optional JSON: { "hero_image_url", "cta_text_ar/en", "cta_url", "form_embed" }'}
            </p>
            <textarea
              value={form.hero_json}
              onChange={(e) => set('hero_json', e.target.value)}
              className={`${inputCls} font-mono text-xs min-h-[140px] leading-relaxed`}
              spellCheck={false}
            />
          </fieldset>

          {/* SEO JSONB */}
          <fieldset className="grid gap-3 rounded-xl border border-[var(--color-neutral-200)] p-4">
            <legend className="px-2 text-sm font-semibold">{isAr ? 'SEO' : 'SEO'}</legend>
            <p className="text-xs text-[var(--color-neutral-500)]">
              {isAr
                ? 'JSON: { "meta_title_ar/en", "meta_description_ar/en", "og_image_url", "canonical_url" }'
                : 'JSON: { "meta_title_ar/en", "meta_description_ar/en", "og_image_url", "canonical_url" }'}
            </p>
            <textarea
              value={form.seo_meta_json}
              onChange={(e) => set('seo_meta_json', e.target.value)}
              className={`${inputCls} font-mono text-xs min-h-[180px] leading-relaxed`}
              spellCheck={false}
            />
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
              href={`/${locale}/admin/landing-pages`}
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
