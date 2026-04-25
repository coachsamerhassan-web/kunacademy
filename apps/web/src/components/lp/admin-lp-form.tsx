'use client';

import { useState, type FormEvent } from 'react';
import { SectionsTab } from '@/components/admin/lp-editor';
import type { LpComposition } from '@/lib/lp/composition-types';

export interface LpFormState {
  id?: string;
  slug: string;
  page_type: string;
  published: boolean;
  launch_lock: boolean;
  composition_json: string;
  lead_capture_config: string;
  payment_config: string;
  analytics_config: string;
  seo_meta_json: string;
  program_slug: string;
}

interface LpFormProps {
  locale: string;
  mode: 'new' | 'edit';
  initial: LpFormState;
}

export function LpForm({ locale, mode, initial }: LpFormProps) {
  const isAr = locale === 'ar';
  const dir = isAr ? 'rtl' : 'ltr';

  const [state, setState] = useState<LpFormState>(initial);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Wave 14b LP-ADMIN-UX: composition view tab toggle. 'sections' = the new
  // per-section editor (drag-reorder + per-type forms); 'json' = the legacy
  // raw-JSON textarea (escape hatch / fallback during transition per Q1
  // co-existence lock). Both views read/write the same composition_json
  // string in `state` — toggling is non-destructive.
  const [compositionView, setCompositionView] = useState<'sections' | 'json'>('sections');
  const [compositionParseError, setCompositionParseError] = useState<string | null>(null);

  function set<K extends keyof LpFormState>(key: K, val: LpFormState[K]) {
    setState((s) => ({ ...s, [key]: val }));
  }

  // Parse current composition JSON string into a typed object for the new
  // editor. Returns null if the string is empty OR invalid JSON OR the
  // parsed object fails the runtime shape guard. Adds a defensive shape
  // check so a malformed JSON tab edit (e.g. `sections: "not-an-array"`)
  // surfaces a clear recovery banner instead of crashing the Sections tab
  // with `sections.map is not a function`. (DeepSeek MEDIUM 2026-04-25.)
  function parseComposition(): LpComposition | null {
    const raw = state.composition_json.trim();
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        return null;
      }
      // Shape guard: `sections` (if present) MUST be an array, and every
      // entry MUST be an object with a non-empty string `type`. If anything
      // is off, return null so the recovery banner renders instead of the
      // Sections tab attempting to .map() a non-array.
      const obj = parsed as Record<string, unknown>;
      if ('sections' in obj && obj.sections !== null && obj.sections !== undefined) {
        if (!Array.isArray(obj.sections)) return null;
        for (const item of obj.sections) {
          if (typeof item !== 'object' || item === null) return null;
          const typeField = (item as Record<string, unknown>).type;
          if (typeof typeField !== 'string' || typeField.length === 0) return null;
        }
      }
      // hero / thank_you (if present) must be plain objects
      for (const key of ['hero', 'thank_you'] as const) {
        if (key in obj && obj[key] !== null && obj[key] !== undefined) {
          if (typeof obj[key] !== 'object' || Array.isArray(obj[key])) return null;
        }
      }
      return parsed as LpComposition;
    } catch {
      return null;
    }
  }

  function handleSectionsChange(next: LpComposition) {
    setCompositionParseError(null);
    set('composition_json', JSON.stringify(next, null, 2));
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const url = mode === 'new' ? '/api/admin/lp' : `/api/admin/lp/${state.id}`;
      const method = mode === 'new' ? 'POST' : 'PATCH';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: state.slug,
          page_type: state.page_type,
          published: state.published,
          launch_lock: state.launch_lock,
          composition_json: state.composition_json || null,
          lead_capture_config: state.lead_capture_config || null,
          payment_config: state.payment_config || null,
          analytics_config: state.analytics_config || null,
          seo_meta_json: state.seo_meta_json || null,
          program_slug: state.program_slug || null,
        }),
      });
      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(body.error || `HTTP ${res.status}`);
        setSubmitting(false);
        return;
      }

      setSuccess(isAr ? 'تم الحفظ' : 'Saved');
      setSubmitting(false);

      if (mode === 'new' && body.landing_page?.id) {
        // Redirect to edit view of the newly created LP
        window.location.href = `/${locale}/admin/lp/${body.landing_page.id}`;
      }
    } catch {
      setError(isAr ? 'تعذّر الاتصال' : 'Connection error');
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!state.id) return;
    if (
      !confirm(
        isAr
          ? `حذف صفحة الهبوط ${state.slug}؟ هذا سيحذف أيضًا جميع العملاء المسجّلين عليها.`
          : `Delete landing page ${state.slug}? This will also delete all leads attached to it.`,
      )
    ) {
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/lp/${state.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        setError(b.error || `HTTP ${res.status}`);
        setSubmitting(false);
        return;
      }
      window.location.href = `/${locale}/admin/lp`;
    } catch {
      setError(isAr ? 'تعذّر الحذف' : 'Delete failed');
      setSubmitting(false);
    }
  }

  const inputClasses =
    'block w-full rounded-xl border border-[var(--color-neutral-200)] bg-white px-4 py-2.5 text-[var(--color-neutral-800)] focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary-50)] focus:outline-none';
  const textareaClasses = inputClasses + ' font-mono text-xs resize-y';
  const labelClasses = 'block text-sm font-semibold text-[var(--color-neutral-700)] mb-1.5';

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl" dir={dir}>
      {/* Identity */}
      <div className="rounded-2xl bg-white border border-[var(--color-neutral-100)] p-5 space-y-4">
        <h3 className="font-semibold text-[var(--text-primary)]">
          {isAr ? 'الهوية' : 'Identity'}
        </h3>
        <div>
          <label className={labelClasses}>{isAr ? 'الرابط (slug)' : 'Slug'}</label>
          <input
            type="text"
            value={state.slug}
            onChange={(e) => set('slug', e.target.value)}
            required
            pattern="[a-z0-9][a-z0-9-]{0,200}"
            className={inputClasses}
            dir="ltr"
          />
          <p className="text-xs text-[var(--color-neutral-500)] mt-1">
            {isAr
              ? 'حروف صغيرة وأرقام وشرطات. الرابط النهائي: /{locale}/lp/{slug}'
              : 'lowercase, digits, hyphens. Final URL: /{locale}/lp/{slug}'}
          </p>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClasses}>{isAr ? 'النوع' : 'Type'}</label>
            <select
              value={state.page_type}
              onChange={(e) => set('page_type', e.target.value)}
              className={inputClasses}
            >
              <option value="landing">landing</option>
              <option value="page">page</option>
              <option value="legal">legal</option>
            </select>
          </div>
          <div>
            <label className={labelClasses}>{isAr ? 'برنامج مرتبط' : 'Program slug (optional)'}</label>
            <input
              type="text"
              value={state.program_slug}
              onChange={(e) => set('program_slug', e.target.value)}
              className={inputClasses}
              dir="ltr"
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-6">
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={state.published}
              onChange={(e) => set('published', e.target.checked)}
              className="w-4 h-4"
            />
            <span className="text-sm font-medium">{isAr ? 'منشورة' : 'Published'}</span>
          </label>
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={state.launch_lock}
              onChange={(e) => set('launch_lock', e.target.checked)}
              className="w-4 h-4"
            />
            <span className="text-sm font-medium">
              {isAr ? 'تجاوز قفل الإطلاق' : 'Bypass launch gate (always reachable)'}
            </span>
          </label>
        </div>
      </div>

      {/* Composition — tabbed view (Wave 14b LP-ADMIN-UX Session 1 LIVE) */}
      <div className="rounded-2xl bg-white border border-[var(--color-neutral-100)] p-5 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <span className={labelClasses}>
              {isAr ? 'تركيب المحتوى' : 'Composition'}
            </span>
            <p className="text-xs text-[var(--color-neutral-500)] mt-0.5">
              {isAr
                ? 'محرّر الأقسام للتحرير اليومي. تبويب JSON متاح كحلّ بديل للأنواع التي لم تُشحن نماذجها بعد.'
                : 'Sections editor for day-to-day authoring. JSON tab is available as fallback for types whose forms haven’t shipped yet.'}
            </p>
          </div>
          <div role="tablist" aria-label="Composition view" className="inline-flex rounded-xl border border-[var(--color-neutral-200)] bg-[var(--color-neutral-50)] p-1">
            <button
              type="button"
              role="tab"
              aria-selected={compositionView === 'sections'}
              onClick={() => setCompositionView('sections')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                compositionView === 'sections'
                  ? 'bg-white text-[var(--text-primary)] shadow-sm'
                  : 'text-[var(--color-neutral-600)] hover:text-[var(--color-neutral-800)]'
              }`}
            >
              {isAr ? 'الأقسام' : 'Sections'}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={compositionView === 'json'}
              onClick={() => setCompositionView('json')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                compositionView === 'json'
                  ? 'bg-white text-[var(--text-primary)] shadow-sm'
                  : 'text-[var(--color-neutral-600)] hover:text-[var(--color-neutral-800)]'
              }`}
            >
              JSON
            </button>
          </div>
        </div>

        {compositionView === 'sections' ? (
          (() => {
            const parsed = parseComposition();
            const rawNonEmpty = state.composition_json.trim().length > 0;
            if (rawNonEmpty && parsed === null) {
              return (
                <div className="rounded-xl border border-[var(--color-warning-200,#fbbf24)] bg-[var(--color-warning-50,#fffbeb)] p-4">
                  <p className="text-sm font-semibold text-[var(--color-warning-900,#78350f)] mb-1">
                    {isAr ? 'تعذّر تحليل composition_json' : 'composition_json failed to parse'}
                  </p>
                  <p className="text-xs text-[var(--color-warning-800,#92400e)] mb-3">
                    {isAr
                      ? 'افتح تبويب JSON لإصلاح الصياغة، ثم عُد إلى الأقسام.'
                      : 'Open the JSON tab to fix the syntax, then return to Sections.'}
                  </p>
                  <button
                    type="button"
                    onClick={() => setCompositionView('json')}
                    className="rounded-lg border border-[var(--color-warning-300,#f59e0b)] bg-white px-3 py-1.5 text-sm font-medium text-[var(--color-warning-900,#78350f)]"
                  >
                    {isAr ? 'فتح تبويب JSON ←' : 'Open JSON tab →'}
                  </button>
                </div>
              );
            }
            return (
              <SectionsTab
                value={parsed}
                onChange={handleSectionsChange}
                onSwitchToJsonTab={() => setCompositionView('json')}
                locale={locale}
              />
            );
          })()
        ) : (
          <textarea
            value={state.composition_json}
            onChange={(e) => set('composition_json', e.target.value)}
            rows={14}
            className={textareaClasses}
            dir="ltr"
            placeholder='{ "hero": { "headline_ar": "...", "headline_en": "..." }, "sections": [] }'
          />
        )}
        {compositionParseError && (
          <p className="text-xs text-red-700">{compositionParseError}</p>
        )}
      </div>

      {/* Lead capture config */}
      <div className="rounded-2xl bg-white border border-[var(--color-neutral-100)] p-5 space-y-2">
        <label className={labelClasses}>
          {isAr ? 'إعدادات النموذج (lead_capture_config)' : 'Lead Capture Config JSON'}
        </label>
        <textarea
          value={state.lead_capture_config}
          onChange={(e) => set('lead_capture_config', e.target.value)}
          rows={6}
          className={textareaClasses}
          dir="ltr"
          placeholder='{ "enabled": true, "fields": ["name","email","phone","message"], "required_fields": ["name","email","phone"], "zoho_lead_source": "Landing Page" }'
        />
      </div>

      {/* Payment config */}
      <div className="rounded-2xl bg-white border border-[var(--color-neutral-100)] p-5 space-y-2">
        <label className={labelClasses}>
          {isAr ? 'إعدادات الدفع (payment_config) — مخطّط فقط' : 'Payment Config JSON — schema only this wave'}
        </label>
        <p className="text-xs text-[var(--color-neutral-500)]">
          {isAr
            ? 'سيُربط بـ Stripe في LP-INFRA-B. يمكنك تعبئته الآن للمحتوى المعروض.'
            : 'Stripe wiring lands in LP-INFRA-B. You can populate it now for display copy.'}
        </p>
        <textarea
          value={state.payment_config}
          onChange={(e) => set('payment_config', e.target.value)}
          rows={6}
          className={textareaClasses}
          dir="ltr"
          placeholder='{ "enabled": false, "currencies": ["EGP"], "tiers": [] }'
        />
      </div>

      {/* Analytics config */}
      <div className="rounded-2xl bg-white border border-[var(--color-neutral-100)] p-5 space-y-2">
        <label className={labelClasses}>
          {isAr ? 'إعدادات التحليلات (analytics_config)' : 'Analytics Config JSON'}
        </label>
        <textarea
          value={state.analytics_config}
          onChange={(e) => set('analytics_config', e.target.value)}
          rows={4}
          className={textareaClasses}
          dir="ltr"
          placeholder='{ "meta_pixel_id": "", "tiktok_pixel_id": "", "conversion_event_name": "lp_lead_submit" }'
        />
      </div>

      {/* SEO */}
      <div className="rounded-2xl bg-white border border-[var(--color-neutral-100)] p-5 space-y-2">
        <label className={labelClasses}>
          {isAr ? 'SEO (seo_meta_json)' : 'SEO JSON'}
        </label>
        <textarea
          value={state.seo_meta_json}
          onChange={(e) => set('seo_meta_json', e.target.value)}
          rows={5}
          className={textareaClasses}
          dir="ltr"
          placeholder='{ "meta_title_ar": "", "meta_title_en": "", "meta_description_ar": "", "meta_description_en": "", "og_image_url": "" }'
        />
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-red-800 text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-xl bg-green-50 border border-green-200 p-4 text-green-800 text-sm">
          {success}
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-xl bg-[var(--color-accent)] px-6 py-3 font-semibold text-white hover:bg-[var(--color-accent-500)] disabled:opacity-60"
        >
          {submitting
            ? isAr ? 'جارٍ الحفظ…' : 'Saving…'
            : mode === 'new'
              ? isAr ? 'إنشاء' : 'Create'
              : isAr ? 'حفظ' : 'Save'}
        </button>
        {mode === 'edit' && state.id && (
          <>
            <a
              href={`/${locale}/lp/${state.slug}`}
              target="_blank"
              rel="noopener"
              className="rounded-xl border border-[var(--color-neutral-300)] px-6 py-3 font-medium text-[var(--color-neutral-700)] hover:border-[var(--color-primary)]"
            >
              {isAr ? 'معاينة ↗' : 'Preview ↗'}
            </a>
            <button
              type="button"
              onClick={handleDelete}
              disabled={submitting}
              className="rounded-xl border border-red-200 px-6 py-3 font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
            >
              {isAr ? 'حذف' : 'Delete'}
            </button>
          </>
        )}
      </div>
    </form>
  );
}
