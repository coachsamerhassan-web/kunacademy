'use client';

/**
 * Shared create/edit form for /admin/instructors.
 * Phase 2b (CMS→DB migration, 2026-04-21) — surfaces the full TeamMember shape:
 *   name_ar/en, title_ar/en, bio_ar/en, bio_doc_id, photo_url, credentials,
 *   icf_credential, kun_level, service_roles[], specialties[], coaching_styles[],
 *   development_types[], languages[], is_visible, is_bookable, is_platform_coach,
 *   display_order, published, profile_id (searchable coach dropdown — BRIDGE
 *   for public coach-ratings display).
 *
 * Mirrors the Phase 2a services _form.tsx + Phase 1c testimonials _form.tsx.
 */

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@kunacademy/auth';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';
import { Button } from '@kunacademy/ui/button';
import Link from 'next/link';
import { ArrowLeft, Search } from 'lucide-react';

const ICF_CREDENTIALS = ['ACC', 'PCC', 'MCC'] as const;
const KUN_LEVELS = ['basic', 'professional', 'expert', 'master'] as const;
const SERVICE_ROLES = ['mentor_coach', 'advanced_mentor'] as const;

export interface InstructorFormValue {
  id?: string;
  profile_id: string;
  slug: string;
  title_ar: string;
  title_en: string;
  name_ar: string;
  name_en: string;
  bio_ar: string;
  bio_en: string;
  bio_doc_id: string;
  photo_url: string;
  credentials: string;
  icf_credential: string;
  kun_level: string;
  coach_level_legacy: string;
  service_roles: string[];
  specialties: string; // csv in form, split on save
  coaching_styles: string; // csv
  development_types: string; // csv
  languages: string; // csv
  is_visible: boolean;
  is_bookable: boolean;
  is_platform_coach: boolean;
  published: boolean;
  display_order: string;
}

const EMPTY: InstructorFormValue = {
  profile_id: '',
  slug: '',
  title_ar: '',
  title_en: '',
  name_ar: '',
  name_en: '',
  bio_ar: '',
  bio_en: '',
  bio_doc_id: '',
  photo_url: '',
  credentials: '',
  icf_credential: '',
  kun_level: '',
  coach_level_legacy: '',
  service_roles: [],
  specialties: '',
  coaching_styles: '',
  development_types: '',
  languages: '',
  is_visible: true,
  is_bookable: true,
  is_platform_coach: false,
  published: true,
  display_order: '0',
};

interface CoachProfile {
  id: string;
  email: string;
  full_name_ar: string | null;
  full_name_en: string | null;
  role: string | null;
}

interface Props {
  instructorId?: string;
}

function csvToArray(v: string | null | undefined): string[] {
  if (!v) return [];
  return v.split(',').map((s) => s.trim()).filter(Boolean);
}

export default function InstructorForm({ instructorId }: Props) {
  const { locale } = useParams<{ locale: string }>();
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const isAr = locale === 'ar';
  const isEdit = Boolean(instructorId);

  const [form, setForm] = useState<InstructorFormValue>(EMPTY);
  const [coaches, setCoaches] = useState<CoachProfile[]>([]);
  const [coachSearch, setCoachSearch] = useState('');
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

  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;
    (async () => {
      try {
        // Load coaches for the profile dropdown (bridge).
        const coachesRes = await fetch('/api/admin/profiles/coaches');
        if (coachesRes.ok) {
          const data = await coachesRes.json();
          if (!cancelled) setCoaches(data.coaches ?? []);
        }

        if (isEdit) {
          const res = await fetch(`/api/admin/instructors/${instructorId}`);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();
          if (cancelled) return;
          const r = data.instructor;
          setForm({
            id: r.id,
            profile_id: r.profile_id ?? '',
            slug: r.slug ?? '',
            title_ar: r.title_ar ?? '',
            title_en: r.title_en ?? '',
            name_ar: r.name_ar ?? '',
            name_en: r.name_en ?? '',
            bio_ar: r.bio_ar ?? '',
            bio_en: r.bio_en ?? '',
            bio_doc_id: r.bio_doc_id ?? '',
            photo_url: r.photo_url ?? '',
            credentials: r.credentials ?? '',
            icf_credential: r.icf_credential ?? '',
            kun_level: r.kun_level ?? '',
            coach_level_legacy: r.coach_level_legacy ?? '',
            service_roles: Array.isArray(r.service_roles) ? r.service_roles : [],
            specialties: Array.isArray(r.specialties) ? r.specialties.join(', ') : '',
            coaching_styles: Array.isArray(r.coaching_styles) ? r.coaching_styles.join(', ') : '',
            development_types: Array.isArray(r.development_types) ? r.development_types.join(', ') : '',
            languages: Array.isArray(r.languages) ? r.languages.join(', ') : '',
            is_visible: r.is_visible !== false,
            is_bookable: r.is_bookable !== false,
            is_platform_coach: Boolean(r.is_platform_coach),
            published: r.published !== false,
            display_order: String(r.display_order ?? 0),
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
  }, [isEdit, instructorId, authLoading]);

  const filteredCoaches = useMemo(() => {
    if (!coachSearch.trim()) return coaches.slice(0, 20);
    const q = coachSearch.toLowerCase();
    return coaches
      .filter(
        (c) =>
          (c.full_name_en ?? '').toLowerCase().includes(q) ||
          (c.full_name_ar ?? '').includes(coachSearch) ||
          c.email.toLowerCase().includes(q)
      )
      .slice(0, 20);
  }, [coaches, coachSearch]);

  const selectedCoach = coaches.find((c) => c.id === form.profile_id) ?? null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      // Client-side validation — required fields
      if (!form.slug.trim()) throw new Error(isAr ? 'المعرّف (slug) مطلوب' : 'Slug is required');
      if (!form.title_ar.trim() || !form.title_en.trim()) {
        throw new Error(isAr ? 'العنوان بالعربية والإنجليزية مطلوب' : 'Title (AR + EN) required');
      }

      const payload = {
        profile_id: form.profile_id || null,
        slug: form.slug.trim(),
        title_ar: form.title_ar.trim(),
        title_en: form.title_en.trim(),
        name_ar: form.name_ar.trim() || null,
        name_en: form.name_en.trim() || null,
        bio_ar: form.bio_ar || null,
        bio_en: form.bio_en || null,
        bio_doc_id: form.bio_doc_id.trim() || null,
        photo_url: form.photo_url.trim() || null,
        credentials: form.credentials.trim() || null,
        icf_credential: form.icf_credential || null,
        kun_level: form.kun_level || null,
        coach_level_legacy: form.coach_level_legacy.trim() || null,
        service_roles: form.service_roles,
        specialties: csvToArray(form.specialties),
        coaching_styles: csvToArray(form.coaching_styles),
        development_types: csvToArray(form.development_types),
        languages: csvToArray(form.languages),
        is_visible: form.is_visible,
        is_bookable: form.is_bookable,
        is_platform_coach: form.is_platform_coach,
        published: form.published,
        display_order: Number(form.display_order) || 0,
      };

      const url = isEdit ? `/api/admin/instructors/${instructorId}` : '/api/admin/instructors';
      const method = isEdit ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      router.push(`/${locale}/admin/instructors/list`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSubmitting(false);
    }
  }

  if (authLoading || loading) {
    return (
      <Section>
        <p className="text-center py-12">{isAr ? 'جاري التحميل...' : 'Loading...'}</p>
      </Section>
    );
  }

  return (
    <main>
      <Section variant="white">
        <div className="mx-auto max-w-4xl">
          <Link href={`/${locale}/admin/instructors/list`} className="text-sm text-[var(--color-primary)] hover:underline mb-4 inline-flex items-center gap-1">
            <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
            {isAr ? 'العودة لقائمة الكوتشز' : 'Back to coaches'}
          </Link>
          <Heading level={1}>
            {isEdit
              ? isAr
                ? 'تعديل ملف الكوتش'
                : 'Edit Coach'
              : isAr
                ? 'إضافة كوتش جديد'
                : 'New Coach'}
          </Heading>

          {error && (
            <div className="mt-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={submit} className="mt-6 space-y-8">
            {/* ── Identity ─────────────────────────────────────────── */}
            <fieldset className="rounded-xl border border-[var(--color-neutral-200)] p-5">
              <legend className="px-2 text-sm font-semibold text-[var(--color-neutral-600)]">
                {isAr ? 'الهوية' : 'Identity'}
              </legend>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="block">
                  <span className="text-xs font-medium text-[var(--color-neutral-600)]">
                    {isAr ? 'المعرّف (slug) *' : 'Slug *'}
                  </span>
                  <input
                    type="text"
                    required
                    value={form.slug}
                    onChange={(e) => setForm({ ...form, slug: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-[var(--color-neutral-200)] px-3 py-2 text-sm min-h-[44px] font-mono"
                    placeholder="e.g. samer-hassan"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-[var(--color-neutral-600)]">
                    {isAr ? 'ترتيب العرض' : 'Display order'}
                  </span>
                  <input
                    type="number"
                    value={form.display_order}
                    onChange={(e) => setForm({ ...form, display_order: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-[var(--color-neutral-200)] px-3 py-2 text-sm min-h-[44px]"
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-medium text-[var(--color-neutral-600)]">
                    {isAr ? 'الاسم (بالعربية)' : 'Name (Arabic)'}
                  </span>
                  <input
                    type="text"
                    value={form.name_ar}
                    onChange={(e) => setForm({ ...form, name_ar: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-[var(--color-neutral-200)] px-3 py-2 text-sm min-h-[44px]"
                    dir="rtl"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-[var(--color-neutral-600)]">
                    {isAr ? 'الاسم (بالإنجليزية)' : 'Name (English)'}
                  </span>
                  <input
                    type="text"
                    value={form.name_en}
                    onChange={(e) => setForm({ ...form, name_en: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-[var(--color-neutral-200)] px-3 py-2 text-sm min-h-[44px]"
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-medium text-[var(--color-neutral-600)]">
                    {isAr ? 'اللقب الوظيفي (بالعربية) *' : 'Title (Arabic) *'}
                  </span>
                  <input
                    type="text"
                    required
                    value={form.title_ar}
                    onChange={(e) => setForm({ ...form, title_ar: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-[var(--color-neutral-200)] px-3 py-2 text-sm min-h-[44px]"
                    dir="rtl"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-[var(--color-neutral-600)]">
                    {isAr ? 'اللقب الوظيفي (بالإنجليزية) *' : 'Title (English) *'}
                  </span>
                  <input
                    type="text"
                    required
                    value={form.title_en}
                    onChange={(e) => setForm({ ...form, title_en: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-[var(--color-neutral-200)] px-3 py-2 text-sm min-h-[44px]"
                  />
                </label>
              </div>
            </fieldset>

            {/* ── Profile bridge (BRIDGE for public coach-ratings) ─── */}
            <fieldset className="rounded-xl border border-[var(--color-primary)]/40 bg-[var(--color-primary)]/5 p-5">
              <legend className="px-2 text-sm font-semibold text-[var(--color-primary)]">
                {isAr ? 'الربط بالحساب (لعرض التقييمات العامة)' : 'Profile Link (Public Ratings Bridge)'}
              </legend>
              <p className="text-xs text-[var(--color-neutral-500)] mb-3">
                {isAr
                  ? 'اربط هذا الكوتش بحساب في النظام لعرض تقييمات جلساته على صفحته العامة.'
                  : 'Link this coach to a platform account so session ratings aggregate onto their public profile.'}
              </p>
              <div className="relative">
                <div className="flex items-center gap-2 rounded-lg border border-[var(--color-neutral-200)] bg-white px-3 py-2">
                  <Search className="w-4 h-4 text-[var(--color-neutral-400)]" />
                  <input
                    type="text"
                    value={coachSearch}
                    onChange={(e) => setCoachSearch(e.target.value)}
                    placeholder={isAr ? 'ابحث بالاسم أو البريد...' : 'Search by name or email...'}
                    className="flex-1 bg-transparent text-sm outline-none min-h-[36px]"
                  />
                  {form.profile_id && (
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, profile_id: '' })}
                      className="text-xs text-red-600 hover:underline"
                    >
                      {isAr ? 'إلغاء الربط' : 'Unlink'}
                    </button>
                  )}
                </div>

                {selectedCoach && (
                  <div className="mt-2 rounded-lg bg-white border border-[var(--color-primary)]/30 px-3 py-2 text-sm">
                    <span className="font-medium">
                      {isAr ? selectedCoach.full_name_ar || selectedCoach.full_name_en : selectedCoach.full_name_en || selectedCoach.full_name_ar}
                    </span>
                    <span className="text-[var(--color-neutral-500)] ms-2 text-xs">{selectedCoach.email}</span>
                    <span className="ms-2 text-xs px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700">
                      {isAr ? 'مربوط' : 'linked'}
                    </span>
                  </div>
                )}

                {coachSearch && !selectedCoach && (
                  <div className="mt-2 max-h-56 overflow-y-auto rounded-lg border border-[var(--color-neutral-200)] bg-white">
                    {filteredCoaches.length === 0 ? (
                      <p className="p-3 text-xs text-[var(--color-neutral-500)]">
                        {isAr ? 'لا توجد نتائج' : 'No matches'}
                      </p>
                    ) : (
                      filteredCoaches.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setForm({ ...form, profile_id: c.id });
                            setCoachSearch('');
                          }}
                          className="block w-full text-start px-3 py-2 text-sm hover:bg-[var(--color-neutral-50)] border-b border-[var(--color-neutral-100)] last:border-b-0"
                        >
                          <div className="font-medium">
                            {isAr ? c.full_name_ar || c.full_name_en : c.full_name_en || c.full_name_ar}
                          </div>
                          <div className="text-xs text-[var(--color-neutral-500)]">
                            {c.email} · {c.role}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            </fieldset>

            {/* ── Bio + photo ──────────────────────────────────────── */}
            <fieldset className="rounded-xl border border-[var(--color-neutral-200)] p-5">
              <legend className="px-2 text-sm font-semibold text-[var(--color-neutral-600)]">
                {isAr ? 'السيرة والصورة' : 'Bio & photo'}
              </legend>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="block md:col-span-2">
                  <span className="text-xs font-medium text-[var(--color-neutral-600)]">
                    {isAr ? 'رابط الصورة' : 'Photo URL'}
                  </span>
                  <input
                    type="url"
                    value={form.photo_url}
                    onChange={(e) => setForm({ ...form, photo_url: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-[var(--color-neutral-200)] px-3 py-2 text-sm min-h-[44px] font-mono"
                    placeholder="https://..."
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-[var(--color-neutral-600)]">
                    {isAr ? 'السيرة (بالعربية)' : 'Bio (Arabic)'}
                  </span>
                  <textarea
                    value={form.bio_ar}
                    onChange={(e) => setForm({ ...form, bio_ar: e.target.value })}
                    rows={5}
                    className="mt-1 w-full rounded-lg border border-[var(--color-neutral-200)] px-3 py-2 text-sm"
                    dir="rtl"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-[var(--color-neutral-600)]">
                    {isAr ? 'السيرة (بالإنجليزية)' : 'Bio (English)'}
                  </span>
                  <textarea
                    value={form.bio_en}
                    onChange={(e) => setForm({ ...form, bio_en: e.target.value })}
                    rows={5}
                    className="mt-1 w-full rounded-lg border border-[var(--color-neutral-200)] px-3 py-2 text-sm"
                  />
                </label>
                <label className="block md:col-span-2">
                  <span className="text-xs font-medium text-[var(--color-neutral-600)]">
                    {isAr ? 'معرّف Google Doc للسيرة الكاملة' : 'Google Doc ID (rich bio)'}
                  </span>
                  <input
                    type="text"
                    value={form.bio_doc_id}
                    onChange={(e) => setForm({ ...form, bio_doc_id: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-[var(--color-neutral-200)] px-3 py-2 text-sm min-h-[44px] font-mono"
                  />
                </label>
              </div>
            </fieldset>

            {/* ── Credentials & levels ─────────────────────────────── */}
            <fieldset className="rounded-xl border border-[var(--color-neutral-200)] p-5">
              <legend className="px-2 text-sm font-semibold text-[var(--color-neutral-600)]">
                {isAr ? 'الشهادات والمستويات' : 'Credentials & levels'}
              </legend>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="block">
                  <span className="text-xs font-medium text-[var(--color-neutral-600)]">
                    {isAr ? 'شهادة ICF' : 'ICF credential'}
                  </span>
                  <select
                    value={form.icf_credential}
                    onChange={(e) => setForm({ ...form, icf_credential: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-[var(--color-neutral-200)] px-3 py-2 text-sm min-h-[44px]"
                  >
                    <option value="">—</option>
                    {ICF_CREDENTIALS.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-[var(--color-neutral-600)]">
                    {isAr ? 'مستوى كُن الداخلي' : 'Kun internal level'}
                  </span>
                  <select
                    value={form.kun_level}
                    onChange={(e) => setForm({ ...form, kun_level: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-[var(--color-neutral-200)] px-3 py-2 text-sm min-h-[44px]"
                  >
                    <option value="">—</option>
                    {KUN_LEVELS.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block md:col-span-2">
                  <span className="text-xs font-medium text-[var(--color-neutral-600)]">
                    {isAr ? 'تفاصيل الشهادات' : 'Credential details'}
                  </span>
                  <input
                    type="text"
                    value={form.credentials}
                    onChange={(e) => setForm({ ...form, credentials: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-[var(--color-neutral-200)] px-3 py-2 text-sm min-h-[44px]"
                    placeholder={isAr ? 'مثلاً: ICF ACC, 2024' : 'e.g. ICF ACC, 2024'}
                  />
                </label>
              </div>

              <div className="mt-4">
                <span className="text-xs font-medium text-[var(--color-neutral-600)] block mb-2">
                  {isAr ? 'أدوار الخدمة' : 'Service roles'}
                </span>
                <div className="flex flex-wrap gap-2">
                  {SERVICE_ROLES.map((role) => {
                    const checked = form.service_roles.includes(role);
                    return (
                      <label
                        key={role}
                        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs cursor-pointer border ${
                          checked
                            ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]'
                            : 'bg-white border-[var(--color-neutral-200)] text-[var(--color-neutral-600)]'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            const next = e.target.checked
                              ? [...form.service_roles, role]
                              : form.service_roles.filter((r) => r !== role);
                            setForm({ ...form, service_roles: next });
                          }}
                          className="sr-only"
                        />
                        {role}
                      </label>
                    );
                  })}
                </div>
              </div>
            </fieldset>

            {/* ── Specialties, languages, styles ───────────────────── */}
            <fieldset className="rounded-xl border border-[var(--color-neutral-200)] p-5">
              <legend className="px-2 text-sm font-semibold text-[var(--color-neutral-600)]">
                {isAr ? 'التخصصات واللغات' : 'Specialties & languages'}
              </legend>
              <p className="text-xs text-[var(--color-neutral-500)] mb-3">
                {isAr ? 'افصل القيم بفاصلة (,)' : 'Comma-separated values'}
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="block">
                  <span className="text-xs font-medium text-[var(--color-neutral-600)]">
                    {isAr ? 'التخصصات' : 'Specialties'}
                  </span>
                  <input
                    type="text"
                    value={form.specialties}
                    onChange={(e) => setForm({ ...form, specialties: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-[var(--color-neutral-200)] px-3 py-2 text-sm min-h-[44px]"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-[var(--color-neutral-600)]">
                    {isAr ? 'أساليب الكوتشينج' : 'Coaching styles'}
                  </span>
                  <input
                    type="text"
                    value={form.coaching_styles}
                    onChange={(e) => setForm({ ...form, coaching_styles: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-[var(--color-neutral-200)] px-3 py-2 text-sm min-h-[44px]"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-[var(--color-neutral-600)]">
                    {isAr ? 'أنواع التطوير' : 'Development types'}
                  </span>
                  <input
                    type="text"
                    value={form.development_types}
                    onChange={(e) => setForm({ ...form, development_types: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-[var(--color-neutral-200)] px-3 py-2 text-sm min-h-[44px]"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-[var(--color-neutral-600)]">
                    {isAr ? 'اللغات' : 'Languages'}
                  </span>
                  <input
                    type="text"
                    value={form.languages}
                    onChange={(e) => setForm({ ...form, languages: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-[var(--color-neutral-200)] px-3 py-2 text-sm min-h-[44px]"
                    placeholder="Arabic, English, French"
                  />
                </label>
              </div>
            </fieldset>

            {/* ── Flags ────────────────────────────────────────────── */}
            <fieldset className="rounded-xl border border-[var(--color-neutral-200)] p-5">
              <legend className="px-2 text-sm font-semibold text-[var(--color-neutral-600)]">
                {isAr ? 'الحالة والنشر' : 'Status & publish'}
              </legend>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <label className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.published}
                    onChange={(e) => setForm({ ...form, published: e.target.checked })}
                  />
                  {isAr ? 'منشور' : 'Published'}
                </label>
                <label className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.is_visible}
                    onChange={(e) => setForm({ ...form, is_visible: e.target.checked })}
                  />
                  {isAr ? 'مرئي للعامة' : 'Visible'}
                </label>
                <label className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.is_bookable}
                    onChange={(e) => setForm({ ...form, is_bookable: e.target.checked })}
                  />
                  {isAr ? 'قابل للحجز' : 'Bookable'}
                </label>
                <label className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.is_platform_coach}
                    onChange={(e) => setForm({ ...form, is_platform_coach: e.target.checked })}
                  />
                  {isAr ? 'كوتش منصة' : 'Platform coach'}
                </label>
              </div>
            </fieldset>

            <div className="flex items-center justify-end gap-3">
              <Link
                href={`/${locale}/admin/instructors/list`}
                className="rounded-lg border border-[var(--color-neutral-200)] px-4 py-2 text-sm"
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </Link>
              <Button type="submit" disabled={submitting}>
                {submitting ? (isAr ? 'جاري الحفظ...' : 'Saving...') : isAr ? 'حفظ' : 'Save'}
              </Button>
            </div>
          </form>
        </div>
      </Section>
    </main>
  );
}
