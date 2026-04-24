'use client';

/**
 * TierForm — create / edit a membership tier row.
 *
 * Bilingual AR+EN. Maps 1:1 to the `tiers` schema:
 *   slug, name_ar, name_en, description_ar, description_en,
 *   price_monthly_cents, price_annual_cents, currency,
 *   sort_order, is_public, is_active,
 *   stripe_product_id + stripe_price_id_{monthly,annual} (read-only display).
 *
 * Stripe IDs are surfaced read-only — admin provisions them via the
 * one-time CLI `scripts/provision-membership-tiers-stripe.ts` (F.2). We
 * don't wire a "Provision Stripe" button in F.3 to keep Stripe ops out of
 * the UI until F.6 grants tighter controls.
 */

import { useState, type FormEvent } from 'react';
import { BilingualTextField } from './bilingual-text-field';

export interface TierFormState {
  id?: string;
  slug: string;
  name_ar: string;
  name_en: string;
  description_ar: string;
  description_en: string;
  price_monthly_cents: number;
  price_annual_cents: number;
  currency: string;
  sort_order: number;
  is_public: boolean;
  is_active: boolean;
  stripe_product_id?: string | null;
  stripe_price_id_monthly?: string | null;
  stripe_price_id_annual?: string | null;
}

interface TierFormProps {
  locale: string;
  mode: 'new' | 'edit';
  initial: TierFormState;
  onSaved?: (row: { id: string; slug: string }) => void;
}

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;
const CURRENCY_RE = /^(AED|EGP|EUR|USD)$/;

export function TierForm({ locale, mode, initial, onSaved }: TierFormProps) {
  const isAr = locale === 'ar';
  const dir = isAr ? 'rtl' : 'ltr';

  const [state, setState] = useState<TierFormState>(initial);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function set<K extends keyof TierFormState>(key: K, val: TierFormState[K]) {
    setState((s) => ({ ...s, [key]: val }));
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!SLUG_RE.test(state.slug)) {
      setError(isAr ? 'الرابط يجب أن يكون حروفاً صغيرة وأرقاماً وشرطات فقط' : 'Slug must be lowercase letters, digits, hyphens');
      return;
    }
    if (!CURRENCY_RE.test(state.currency)) {
      setError(isAr ? 'العملة يجب أن تكون AED, EGP, EUR, أو USD' : 'Currency must be AED, EGP, EUR, or USD');
      return;
    }
    if (!Number.isFinite(state.price_monthly_cents) || state.price_monthly_cents < 0) {
      setError(isAr ? 'السعر الشهري غير صالح' : 'Monthly price invalid');
      return;
    }
    if (!Number.isFinite(state.price_annual_cents) || state.price_annual_cents < 0) {
      setError(isAr ? 'السعر السنوي غير صالح' : 'Annual price invalid');
      return;
    }
    if (!state.name_ar.trim() || !state.name_en.trim()) {
      setError(isAr ? 'الاسم العربي والإنجليزي مطلوبان' : 'Both Arabic and English names required');
      return;
    }

    setSubmitting(true);
    try {
      const url = mode === 'new' ? '/api/admin/membership/tiers' : `/api/admin/membership/tiers/${state.id}`;
      const method = mode === 'new' ? 'POST' : 'PATCH';
      const body = {
        slug: state.slug,
        name_ar: state.name_ar,
        name_en: state.name_en,
        description_ar: state.description_ar || null,
        description_en: state.description_en || null,
        price_monthly_cents: state.price_monthly_cents,
        price_annual_cents: state.price_annual_cents,
        currency: state.currency,
        sort_order: state.sort_order,
        is_public: state.is_public,
        is_active: state.is_active,
      };
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || `HTTP ${res.status}`);
        setSubmitting(false);
        return;
      }
      setSuccess(isAr ? 'تم الحفظ' : 'Saved');
      setSubmitting(false);
      const saved = data.tier as { id: string; slug: string } | undefined;
      if (saved && onSaved) onSaved(saved);
      if (mode === 'new' && saved) {
        window.location.href = `/${locale}/admin/membership/tiers/${saved.id}`;
      }
    } catch {
      setError(isAr ? 'تعذّر الاتصال' : 'Connection error');
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!state.id) return;
    const msg = isAr
      ? 'هل تريد حذف هذه المرتبة؟ لا يمكن التراجع عن هذه العملية.'
      : 'Delete this tier? This cannot be undone.';
    if (!confirm(msg)) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/membership/tiers/${state.id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || `HTTP ${res.status}`);
        setSubmitting(false);
        return;
      }
      window.location.href = `/${locale}/admin/membership/tiers`;
    } catch {
      setError(isAr ? 'تعذّر الاتصال' : 'Connection error');
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} dir={dir} className="space-y-6">
      {/* Slug + core identity */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-semibold text-[var(--text-primary)]">
            {isAr ? 'الرابط (slug)' : 'Slug'}
            <span className="text-red-600 ms-1">*</span>
          </label>
          <input
            type="text"
            value={state.slug}
            onChange={(e) => set('slug', e.target.value.toLowerCase().trim())}
            required
            pattern="[a-z0-9][a-z0-9\-]*"
            className="rounded-xl border border-[var(--color-neutral-200)] px-3 py-2 font-mono focus:outline-none focus:border-[var(--color-primary)]"
            dir="ltr"
          />
          <span className="text-xs text-[var(--color-neutral-500)]">
            {isAr ? 'حروف صغيرة، أرقام، وشرطات فقط' : 'Lowercase, digits, hyphens only'}
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-semibold text-[var(--text-primary)]">
            {isAr ? 'العملة' : 'Currency'}
            <span className="text-red-600 ms-1">*</span>
          </label>
          <select
            value={state.currency}
            onChange={(e) => set('currency', e.target.value)}
            className="rounded-xl border border-[var(--color-neutral-200)] px-3 py-2 bg-white focus:outline-none focus:border-[var(--color-primary)]"
            dir="ltr"
          >
            <option value="AED">AED</option>
            <option value="EGP">EGP</option>
            <option value="EUR">EUR</option>
            <option value="USD">USD</option>
          </select>
        </div>
      </div>

      {/* Bilingual name */}
      <BilingualTextField
        labelAr="الاسم"
        labelEn="Name"
        valueAr={state.name_ar}
        valueEn={state.name_en}
        onChangeAr={(v) => set('name_ar', v)}
        onChangeEn={(v) => set('name_en', v)}
        required
        maxLength={120}
        locale={locale}
      />

      {/* Bilingual description */}
      <BilingualTextField
        labelAr="الوصف"
        labelEn="Description"
        valueAr={state.description_ar}
        valueEn={state.description_en}
        onChangeAr={(v) => set('description_ar', v)}
        onChangeEn={(v) => set('description_en', v)}
        multiline
        maxLength={1000}
        locale={locale}
      />

      {/* Prices */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-semibold text-[var(--text-primary)]">
            {isAr ? 'السعر الشهري (بالسنت)' : 'Monthly price (cents / minor units)'}
          </label>
          <input
            type="number"
            min={0}
            step={1}
            value={state.price_monthly_cents}
            onChange={(e) => set('price_monthly_cents', parseInt(e.target.value, 10) || 0)}
            className="rounded-xl border border-[var(--color-neutral-200)] px-3 py-2 focus:outline-none focus:border-[var(--color-primary)]"
            dir="ltr"
          />
          <span className="text-xs text-[var(--color-neutral-500)]">
            {isAr ? `= ${(state.price_monthly_cents / 100).toFixed(2)} ${state.currency}` : `= ${(state.price_monthly_cents / 100).toFixed(2)} ${state.currency}`}
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-semibold text-[var(--text-primary)]">
            {isAr ? 'السعر السنوي (بالسنت)' : 'Annual price (cents / minor units)'}
          </label>
          <input
            type="number"
            min={0}
            step={1}
            value={state.price_annual_cents}
            onChange={(e) => set('price_annual_cents', parseInt(e.target.value, 10) || 0)}
            className="rounded-xl border border-[var(--color-neutral-200)] px-3 py-2 focus:outline-none focus:border-[var(--color-primary)]"
            dir="ltr"
          />
          <span className="text-xs text-[var(--color-neutral-500)]">
            {`= ${(state.price_annual_cents / 100).toFixed(2)} ${state.currency}`}
          </span>
        </div>
      </div>

      <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900">
        {isAr
          ? 'تغيير السعر لا يُحدّث اشتراكات Stripe القائمة. المشتركون الحاليون يحتفظون بالسعر القديم حتى التجديد. يجب تنفيذ إعادة التزويد من واجهة الأوامر في سكربت Stripe الخاص بالوايف F.2.'
          : 'Price edits do NOT migrate existing Stripe subscribers. They keep the old price until renewal. Re-provisioning Stripe is a CLI operation (see F.2 provision-membership-tiers-stripe.ts).'}
      </div>

      {/* Sort + flags */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-semibold text-[var(--text-primary)]">
            {isAr ? 'ترتيب العرض' : 'Sort order'}
          </label>
          <input
            type="number"
            step={1}
            value={state.sort_order}
            onChange={(e) => set('sort_order', parseInt(e.target.value, 10) || 0)}
            className="rounded-xl border border-[var(--color-neutral-200)] px-3 py-2 focus:outline-none focus:border-[var(--color-primary)]"
            dir="ltr"
          />
        </div>
        <label className="flex items-center gap-2 cursor-pointer select-none mt-6">
          <input
            type="checkbox"
            checked={state.is_public}
            onChange={(e) => set('is_public', e.target.checked)}
            className="w-4 h-4"
          />
          <span className="text-sm text-[var(--text-primary)]">
            {isAr ? 'مرئية للعامة' : 'Public-visible'}
          </span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer select-none mt-6">
          <input
            type="checkbox"
            checked={state.is_active}
            onChange={(e) => set('is_active', e.target.checked)}
            className="w-4 h-4"
          />
          <span className="text-sm text-[var(--text-primary)]">
            {isAr ? 'فعّالة' : 'Active'}
          </span>
        </label>
      </div>

      {/* Stripe IDs (read-only) */}
      {mode === 'edit' && (
        <div className="rounded-xl border border-[var(--color-neutral-100)] bg-[var(--color-neutral-50)]/40 p-4">
          <p className="text-sm font-semibold text-[var(--text-primary)] mb-2">
            {isAr ? 'معرّفات Stripe (قراءة فقط)' : 'Stripe identifiers (read-only)'}
          </p>
          <dl className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs font-mono">
            <div>
              <dt className="text-[var(--color-neutral-500)]">Product</dt>
              <dd dir="ltr" className="break-all">{state.stripe_product_id || '—'}</dd>
            </div>
            <div>
              <dt className="text-[var(--color-neutral-500)]">Price (monthly)</dt>
              <dd dir="ltr" className="break-all">{state.stripe_price_id_monthly || '—'}</dd>
            </div>
            <div>
              <dt className="text-[var(--color-neutral-500)]">Price (annual)</dt>
              <dd dir="ltr" className="break-all">{state.stripe_price_id_annual || '—'}</dd>
            </div>
          </dl>
        </div>
      )}

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-800" role="alert">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-xl bg-green-50 border border-green-200 p-3 text-sm text-green-800" role="status">
          {success}
        </div>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-xl bg-[var(--color-accent)] px-5 py-2.5 font-semibold text-white hover:bg-[var(--color-accent-500)] disabled:opacity-60"
        >
          {submitting
            ? (isAr ? 'جارٍ الحفظ…' : 'Saving…')
            : (mode === 'new' ? (isAr ? 'إنشاء المرتبة' : 'Create tier') : (isAr ? 'حفظ التغييرات' : 'Save changes'))}
        </button>
        {mode === 'edit' && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={submitting}
            className="rounded-xl border border-red-300 bg-white px-5 py-2.5 font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
          >
            {isAr ? 'حذف' : 'Delete'}
          </button>
        )}
      </div>
    </form>
  );
}
