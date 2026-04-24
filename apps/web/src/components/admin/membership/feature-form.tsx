'use client';

/**
 * FeatureForm — create / edit a feature catalog row.
 *
 * Maps 1:1 to shipped `features` schema:
 *   feature_key, name_ar, name_en, description_ar, description_en,
 *   feature_type ('access' | 'action' | 'quota').
 *
 * Spec §8.3 listed category, icon_name, display_label_{ar,en}, sort_order,
 * is_active — these columns were NOT shipped in F.1 migration 0055. F.3
 * binds only to shipped columns; category/icon/sort_order/is_active are
 * deferred to a potential F.3.1 sub-wave. Flagged in session log.
 */

import { useState, type FormEvent } from 'react';
import { BilingualTextField } from './bilingual-text-field';

export interface FeatureFormState {
  id?: string;
  feature_key: string;
  name_ar: string;
  name_en: string;
  description_ar: string;
  description_en: string;
  feature_type: string; // 'access' | 'action' | 'quota'
}

interface FeatureFormProps {
  locale: string;
  mode: 'new' | 'edit';
  initial: FeatureFormState;
  onSaved?: (row: { id: string; feature_key: string }) => void;
}

const FEATURE_KEY_RE = /^[a-z][a-z0-9_]{1,63}$/;

export function FeatureForm({ locale, mode, initial, onSaved }: FeatureFormProps) {
  const isAr = locale === 'ar';
  const dir = isAr ? 'rtl' : 'ltr';

  const [state, setState] = useState<FeatureFormState>(initial);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function set<K extends keyof FeatureFormState>(key: K, val: FeatureFormState[K]) {
    setState((s) => ({ ...s, [key]: val }));
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!FEATURE_KEY_RE.test(state.feature_key)) {
      setError(isAr
        ? 'المفتاح يجب أن يبدأ بحرف صغير ويتكوّن من أحرف وأرقام وشرطات سفلية فقط'
        : 'feature_key must be lowercase letters, digits, underscores (start with letter)');
      return;
    }
    if (!['access', 'action', 'quota'].includes(state.feature_type)) {
      setError(isAr ? 'نوع الميزة غير صالح' : 'Invalid feature_type');
      return;
    }
    if (!state.name_ar.trim() || !state.name_en.trim()) {
      setError(isAr ? 'الاسم العربي والإنجليزي مطلوبان' : 'Both Arabic and English names required');
      return;
    }

    setSubmitting(true);
    try {
      const url = mode === 'new'
        ? '/api/admin/membership/features'
        : `/api/admin/membership/features/${state.id}`;
      const method = mode === 'new' ? 'POST' : 'PATCH';
      const body = {
        feature_key: state.feature_key,
        name_ar: state.name_ar,
        name_en: state.name_en,
        description_ar: state.description_ar || null,
        description_en: state.description_en || null,
        feature_type: state.feature_type,
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
      const saved = data.feature as { id: string; feature_key: string } | undefined;
      if (saved && onSaved) onSaved(saved);
      if (mode === 'new' && saved) {
        window.location.href = `/${locale}/admin/membership/features/${saved.id}`;
      }
    } catch {
      setError(isAr ? 'تعذّر الاتصال' : 'Connection error');
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!state.id) return;
    const msg = isAr
      ? 'هل تريد حذف هذه الميزة؟ سيتم إزالتها من جميع المراتب.'
      : 'Delete this feature? It will be removed from all tier mappings.';
    if (!confirm(msg)) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/membership/features/${state.id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || `HTTP ${res.status}`);
        setSubmitting(false);
        return;
      }
      window.location.href = `/${locale}/admin/membership/features`;
    } catch {
      setError(isAr ? 'تعذّر الاتصال' : 'Connection error');
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} dir={dir} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-semibold text-[var(--text-primary)]">
            {isAr ? 'مفتاح الميزة (feature_key)' : 'Feature key'}
            <span className="text-red-600 ms-1">*</span>
          </label>
          <input
            type="text"
            value={state.feature_key}
            onChange={(e) => set('feature_key', e.target.value.toLowerCase().trim())}
            required
            disabled={mode === 'edit'}
            className="rounded-xl border border-[var(--color-neutral-200)] px-3 py-2 font-mono focus:outline-none focus:border-[var(--color-primary)] disabled:bg-[var(--color-neutral-50)] disabled:text-[var(--color-neutral-500)]"
            dir="ltr"
          />
          <span className="text-xs text-[var(--color-neutral-500)]">
            {mode === 'edit'
              ? (isAr ? 'لا يمكن تغيير المفتاح بعد الإنشاء — يُستخدم في الكود.' : 'Key is immutable — referenced by hasFeature() calls.')
              : (isAr ? 'snake_case، حرف ثم أحرف/أرقام/شرطات سفلية' : 'snake_case, letter then letters/digits/underscores')}
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-semibold text-[var(--text-primary)]">
            {isAr ? 'النوع' : 'Type'}
            <span className="text-red-600 ms-1">*</span>
          </label>
          <select
            value={state.feature_type}
            onChange={(e) => set('feature_type', e.target.value)}
            className="rounded-xl border border-[var(--color-neutral-200)] px-3 py-2 bg-white focus:outline-none focus:border-[var(--color-primary)]"
            dir="ltr"
          >
            <option value="access">access</option>
            <option value="action">action</option>
            <option value="quota">quota</option>
          </select>
          <span className="text-xs text-[var(--color-neutral-500)]">
            {isAr
              ? 'access = حق قراءة؛ action = حق كتابة؛ quota = حد استخدام'
              : 'access = read right; action = write right; quota = usage cap'}
          </span>
        </div>
      </div>

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
            : (mode === 'new' ? (isAr ? 'إنشاء الميزة' : 'Create feature') : (isAr ? 'حفظ التغييرات' : 'Save changes'))}
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
