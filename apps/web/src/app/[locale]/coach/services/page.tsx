'use client';

import { useAuth } from '@kunacademy/auth';
import { useEffect, useState, useCallback } from 'react';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';
import { useParams } from 'next/navigation';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CoachService {
  id: string;
  slug: string | null;
  name_ar: string;
  name_en: string;
  description_ar: string | null;
  description_en: string | null;
  duration_minutes: number;
  price_aed: number | null;
  price_egp: number | null;
  coach_control: string;
  allows_coach_pricing: boolean;
  min_price_aed: number;
  min_price_egp: number;
  min_price_eur: number;
  is_active: boolean;
  custom_price_aed: number | null;
  custom_price_egp: number | null;
  custom_price_eur: number | null;
  coach_service_id: string | null;
}

interface DiscountCode {
  id: string;
  code: string;
  discount_type: string;
  discount_value: number;
  currency: string | null;
  valid_from: string;
  valid_until: string;
  max_uses: number | null;
  current_uses: number;
  applicable_service_ids: string[] | null;
  is_active: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatPrice(minor: number | null, currency: string): string {
  if (minor === null || minor === 0) return '—';
  const major = minor / 100;
  return `${major.toLocaleString()} ${currency}`;
}

function formatDate(iso: string, locale: string): string {
  try {
    return new Date(iso).toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return iso.split('T')[0];
  }
}

// ─── Coach Control Badge ──────────────────────────────────────────────────────

function CoachControlBadge({ control, isAr }: { control: string; isAr: boolean }) {
  if (control === 'optional') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
        {isAr ? 'اختياري' : 'Optional'}
      </span>
    );
  }
  if (control === 'mandatory') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
        {isAr ? 'إلزامي' : 'Mandatory'}
      </span>
    );
  }
  // admin_only
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
      {isAr ? 'بواسطة الإدارة' : 'Admin Assigned'}
    </span>
  );
}

// ─── Toggle Switch ────────────────────────────────────────────────────────────

function Toggle({
  checked,
  onChange,
  disabled,
  ariaLabel,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] min-h-[44px] px-0 ${
        checked ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-neutral-300)]'
      } ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

// ─── Create Discount Code Modal ───────────────────────────────────────────────

interface CreateCodeModalProps {
  isAr: boolean;
  onClose: () => void;
  onCreated: (code: DiscountCode) => void;
}

function CreateCodeModal({ isAr, onClose, onCreated }: CreateCodeModalProps) {
  const [form, setForm] = useState({
    code: '',
    discount_type: 'percentage',
    discount_value: '',
    currency: 'AED',
    valid_from: new Date().toISOString().split('T')[0],
    valid_until: '',
    max_uses: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        code: form.code.toUpperCase().trim(),
        discount_type: form.discount_type,
        discount_value: Number(form.discount_value),
        valid_from: form.valid_from,
        valid_until: form.valid_until,
      };
      if (form.discount_type === 'fixed_amount') body.currency = form.currency;
      if (form.max_uses) body.max_uses = Number(form.max_uses);

      const res = await fetch('/api/coach/discount-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || (isAr ? 'حدث خطأ' : 'An error occurred'));
        return;
      }
      onCreated(data.discount_code);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        dir={isAr ? 'rtl' : 'ltr'}
      >
        <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
          {isAr ? 'إضافة كود خصم' : 'Add Discount Code'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Code */}
          <div>
            <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
              {isAr ? 'الكود' : 'Code'}
            </label>
            <input
              type="text"
              required
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
              placeholder="SUMMER20"
              className="w-full rounded-xl border border-[var(--color-neutral-200)] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] font-mono uppercase"
            />
            <p className="text-xs text-[var(--color-neutral-400)] mt-1">
              {isAr ? 'أحرف وأرقام وشرطات فقط' : 'Letters, numbers, and hyphens only'}
            </p>
          </div>

          {/* Type + Value */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
                {isAr ? 'نوع الخصم' : 'Type'}
              </label>
              <select
                value={form.discount_type}
                onChange={(e) => setForm((f) => ({ ...f, discount_type: e.target.value }))}
                className="w-full rounded-xl border border-[var(--color-neutral-200)] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              >
                <option value="percentage">{isAr ? 'نسبة مئوية' : 'Percentage'}</option>
                <option value="fixed_amount">{isAr ? 'مبلغ ثابت' : 'Fixed Amount'}</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
                {form.discount_type === 'percentage'
                  ? (isAr ? 'النسبة (%)' : 'Value (%)')
                  : (isAr ? 'المبلغ' : 'Amount')}
              </label>
              <input
                type="number"
                required
                min={1}
                max={form.discount_type === 'percentage' ? 100 : undefined}
                value={form.discount_value}
                onChange={(e) => setForm((f) => ({ ...f, discount_value: e.target.value }))}
                className="w-full rounded-xl border border-[var(--color-neutral-200)] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              />
            </div>
          </div>

          {/* Currency (fixed amount only) */}
          {form.discount_type === 'fixed_amount' && (
            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
                {isAr ? 'العملة' : 'Currency'}
              </label>
              <select
                value={form.currency}
                onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
                className="w-full rounded-xl border border-[var(--color-neutral-200)] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              >
                <option value="AED">AED</option>
                <option value="EGP">EGP</option>
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
              </select>
            </div>
          )}

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
                {isAr ? 'من تاريخ' : 'Valid From'}
              </label>
              <input
                type="date"
                value={form.valid_from}
                onChange={(e) => setForm((f) => ({ ...f, valid_from: e.target.value }))}
                className="w-full rounded-xl border border-[var(--color-neutral-200)] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
                {isAr ? 'حتى تاريخ' : 'Valid Until'}
              </label>
              <input
                type="date"
                required
                value={form.valid_until}
                onChange={(e) => setForm((f) => ({ ...f, valid_until: e.target.value }))}
                className="w-full rounded-xl border border-[var(--color-neutral-200)] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              />
            </div>
          </div>

          {/* Max Uses */}
          <div>
            <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
              {isAr ? 'الحد الأقصى للاستخدامات (اختياري)' : 'Max Uses (optional)'}
            </label>
            <input
              type="number"
              min={1}
              value={form.max_uses}
              onChange={(e) => setForm((f) => ({ ...f, max_uses: e.target.value }))}
              placeholder={isAr ? 'غير محدود' : 'Unlimited'}
              className="w-full rounded-xl border border-[var(--color-neutral-200)] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{error}</p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-xl bg-[var(--color-primary)] text-white py-2.5 text-sm font-medium hover:bg-[var(--color-primary-600)] disabled:opacity-50 transition-colors min-h-[44px]"
            >
              {saving ? '...' : (isAr ? 'حفظ' : 'Save')}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-[var(--color-neutral-200)] text-[var(--text-primary)] py-2.5 text-sm font-medium hover:bg-[var(--color-neutral-50)] transition-colors min-h-[44px]"
            >
              {isAr ? 'إلغاء' : 'Cancel'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Service Card ─────────────────────────────────────────────────────────────

interface ServiceCardProps {
  svc: CoachService;
  isAr: boolean;
  onToggle: (serviceId: string, isActive: boolean) => Promise<void>;
  onPriceSave: (serviceId: string, prices: { aed?: number | null; egp?: number | null; eur?: number | null }) => Promise<void>;
}

function ServiceCard({ svc, isAr, onToggle, onPriceSave }: ServiceCardProps) {
  const name = isAr ? svc.name_ar : svc.name_en;
  const description = isAr ? svc.description_ar : svc.description_en;

  const [toggling, setToggling] = useState(false);
  const [priceAed, setPriceAed] = useState(
    svc.custom_price_aed !== null ? String(svc.custom_price_aed) : ''
  );
  const [priceEgp, setPriceEgp] = useState(
    svc.custom_price_egp !== null ? String(svc.custom_price_egp) : ''
  );
  const [priceEur, setPriceEur] = useState(
    svc.custom_price_eur !== null ? String(svc.custom_price_eur) : ''
  );
  const [priceSaving, setPriceSaving] = useState(false);
  const [priceError, setPriceError] = useState('');
  const [priceSaved, setPriceSaved] = useState(false);

  const canToggle = svc.coach_control === 'optional';

  async function handleToggle(val: boolean) {
    setToggling(true);
    try {
      await onToggle(svc.id, val);
    } finally {
      setToggling(false);
    }
  }

  async function handlePriceSave() {
    setPriceError('');
    setPriceSaving(true);
    try {
      const payload: { aed?: number | null; egp?: number | null; eur?: number | null } = {};
      if (priceAed !== '') payload.aed = Number(priceAed);
      if (priceEgp !== '') payload.egp = Number(priceEgp);
      if (priceEur !== '') payload.eur = Number(priceEur);
      await onPriceSave(svc.id, payload);
      setPriceSaved(true);
      setTimeout(() => setPriceSaved(false), 2000);
    } catch (e: any) {
      setPriceError(e.message || (isAr ? 'حدث خطأ' : 'An error occurred'));
    } finally {
      setPriceSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-[var(--color-neutral-200)] p-4 hover:border-[var(--color-primary)]/30 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="font-medium text-[var(--text-primary)]">{name}</span>
            <CoachControlBadge control={svc.coach_control} isAr={isAr} />
          </div>
          {description && (
            <p className="text-sm text-[var(--color-neutral-500)] mb-2 line-clamp-2">{description}</p>
          )}
          <div className="flex flex-wrap gap-3 text-xs text-[var(--color-neutral-500)]">
            <span>
              {svc.duration_minutes} {isAr ? 'دقيقة' : 'min'}
            </span>
            {svc.price_aed !== null && svc.price_aed > 0 && (
              <span>{formatPrice(svc.price_aed, 'AED')}</span>
            )}
            {svc.price_egp !== null && svc.price_egp > 0 && (
              <span>{formatPrice(svc.price_egp, 'EGP')}</span>
            )}
          </div>
        </div>

        {/* Toggle */}
        <div className="shrink-0 flex flex-col items-end gap-1">
          <Toggle
            checked={svc.is_active}
            onChange={handleToggle}
            disabled={!canToggle || toggling}
            ariaLabel={
              isAr
                ? `${canToggle ? 'تفعيل' : 'الخدمة'} ${name}`
                : `${canToggle ? 'Toggle' : ''} ${name}`
            }
          />
          {toggling && (
            <span className="text-xs text-[var(--color-neutral-400)]">...</span>
          )}
        </div>
      </div>

      {/* Custom Pricing */}
      {svc.allows_coach_pricing && svc.is_active && (
        <div className="mt-4 pt-4 border-t border-[var(--color-neutral-100)]">
          <p className="text-xs font-medium text-[var(--color-neutral-600)] mb-3">
            {isAr ? 'السعر المخصص' : 'Custom Pricing'}
          </p>
          <div className="grid grid-cols-3 gap-2">
            {/* AED */}
            <div>
              <label className="block text-xs text-[var(--color-neutral-500)] mb-1">
                AED
                {svc.min_price_aed > 0 && (
                  <span className="text-[var(--color-neutral-400)]">
                    {' '}(min {svc.min_price_aed})
                  </span>
                )}
              </label>
              <input
                type="number"
                min={svc.min_price_aed}
                value={priceAed}
                onChange={(e) => setPriceAed(e.target.value)}
                placeholder={svc.price_aed ? String(svc.price_aed) : '—'}
                className="w-full rounded-lg border border-[var(--color-neutral-200)] px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
              />
            </div>
            {/* EGP */}
            <div>
              <label className="block text-xs text-[var(--color-neutral-500)] mb-1">
                EGP
                {svc.min_price_egp > 0 && (
                  <span className="text-[var(--color-neutral-400)]">
                    {' '}(min {svc.min_price_egp})
                  </span>
                )}
              </label>
              <input
                type="number"
                min={svc.min_price_egp}
                value={priceEgp}
                onChange={(e) => setPriceEgp(e.target.value)}
                placeholder={svc.price_egp ? String(svc.price_egp) : '—'}
                className="w-full rounded-lg border border-[var(--color-neutral-200)] px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
              />
            </div>
            {/* EUR */}
            <div>
              <label className="block text-xs text-[var(--color-neutral-500)] mb-1">
                EUR
                {svc.min_price_eur > 0 && (
                  <span className="text-[var(--color-neutral-400)]">
                    {' '}(min {svc.min_price_eur})
                  </span>
                )}
              </label>
              <input
                type="number"
                min={svc.min_price_eur}
                value={priceEur}
                onChange={(e) => setPriceEur(e.target.value)}
                placeholder="—"
                className="w-full rounded-lg border border-[var(--color-neutral-200)] px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
              />
            </div>
          </div>

          {priceError && (
            <p className="text-xs text-red-600 mt-2">{priceError}</p>
          )}

          <button
            type="button"
            onClick={handlePriceSave}
            disabled={priceSaving}
            className="mt-3 px-4 py-1.5 rounded-lg bg-[var(--color-primary)] text-white text-xs font-medium hover:bg-[var(--color-primary-600)] disabled:opacity-50 transition-colors min-h-[36px]"
          >
            {priceSaving
              ? '...'
              : priceSaved
              ? (isAr ? 'تم الحفظ' : 'Saved')
              : (isAr ? 'حفظ السعر' : 'Save Price')}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CoachServicesPage() {
  const { locale } = useParams<{ locale: string }>();
  const { user, loading: authLoading } = useAuth();
  const isAr = locale === 'ar';

  const [services, setServices] = useState<CoachService[]>([]);
  const [discountCodes, setDiscountCodes] = useState<DiscountCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [deactivating, setDeactivating] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [svcsRes, codesRes] = await Promise.all([
        fetch('/api/coach/services').then((r) => r.json()),
        fetch('/api/coach/discount-codes').then((r) => r.json()),
      ]);
      setServices((svcsRes.services || []) as CoachService[]);
      setDiscountCodes((codesRes.discount_codes || []) as DiscountCode[]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleToggle(serviceId: string, isActive: boolean) {
    const res = await fetch('/api/coach/services', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ service_id: serviceId, is_active: isActive }),
    });
    if (res.ok) {
      setServices((prev) =>
        prev.map((s) => (s.id === serviceId ? { ...s, is_active: isActive } : s)),
      );
    }
  }

  async function handlePriceSave(
    serviceId: string,
    prices: { aed?: number | null; egp?: number | null; eur?: number | null },
  ) {
    const body: Record<string, unknown> = { service_id: serviceId };
    if (prices.aed !== undefined) body.custom_price_aed = prices.aed;
    if (prices.egp !== undefined) body.custom_price_egp = prices.egp;
    if (prices.eur !== undefined) body.custom_price_eur = prices.eur;

    const res = await fetch('/api/coach/services', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || (isAr ? 'حدث خطأ' : 'An error occurred'));

    const cs = data.coach_service;
    setServices((prev) =>
      prev.map((s) =>
        s.id === serviceId
          ? {
              ...s,
              custom_price_aed: cs.custom_price_aed ?? s.custom_price_aed,
              custom_price_egp: cs.custom_price_egp ?? s.custom_price_egp,
              custom_price_eur: cs.custom_price_eur ?? s.custom_price_eur,
            }
          : s,
      ),
    );
  }

  async function handleDeactivateCode(codeId: string) {
    setDeactivating(codeId);
    try {
      const res = await fetch('/api/coach/discount-codes', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: codeId }),
      });
      if (res.ok) {
        setDiscountCodes((prev) =>
          prev.map((c) => (c.id === codeId ? { ...c, is_active: false } : c)),
        );
      }
    } finally {
      setDeactivating(null);
    }
  }

  // ─── Loading state ─────────────────────────────────────────────────────────

  if (authLoading || loading) {
    return (
      <Section variant="white">
        <div className="text-center py-12">
          <div className="h-8 w-8 mx-auto border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
          <p className="mt-3 text-sm text-[var(--color-neutral-500)]">
            {isAr ? 'جاري التحميل...' : 'Loading...'}
          </p>
        </div>
      </Section>
    );
  }

  if (!user) {
    return (
      <Section variant="white">
        <div className="text-center py-12">
          <p className="text-[var(--color-neutral-500)]">
            {isAr ? 'يرجى تسجيل الدخول' : 'Please sign in'}
          </p>
          <a
            href={`/${locale}/auth/login?redirect=/${locale}/coach/services`}
            className="mt-3 inline-block text-[var(--color-primary)] font-medium hover:underline"
          >
            {isAr ? 'تسجيل الدخول' : 'Sign in'}
          </a>
        </div>
      </Section>
    );
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  const activeCodes = discountCodes.filter((c) => c.is_active);
  const inactiveCodes = discountCodes.filter((c) => !c.is_active);

  return (
    <main dir={isAr ? 'rtl' : 'ltr'}>
      <Section variant="white">
        <Heading level={1} className="mb-8">
          {isAr ? 'خدماتي' : 'My Services'}
        </Heading>

        {/* ── Services Section ──────────────────────────────────────────────── */}
        <section className="mb-10">
          <h2 className="text-base font-semibold text-[var(--text-primary)] mb-4">
            {isAr ? 'الخدمات' : 'Services'}
          </h2>

          {services.length === 0 ? (
            <div className="text-center py-10 rounded-xl border border-dashed border-[var(--color-neutral-200)]">
              <p className="text-sm text-[var(--color-neutral-500)]">
                {isAr ? 'لا توجد خدمات متاحة لمستواك حاليًا' : 'No services available for your level yet'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {services.map((svc) => (
                <ServiceCard
                  key={svc.id}
                  svc={svc}
                  isAr={isAr}
                  onToggle={handleToggle}
                  onPriceSave={handlePriceSave}
                />
              ))}
            </div>
          )}
        </section>

        {/* ── Discount Codes Section ────────────────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-[var(--text-primary)]">
              {isAr ? 'أكواد الخصم' : 'Discount Codes'}
            </h2>
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--color-primary)] text-white text-sm font-medium hover:bg-[var(--color-primary-600)] transition-colors min-h-[44px]"
            >
              <span aria-hidden="true">+</span>
              {isAr ? 'إضافة كود' : 'Add Code'}
            </button>
          </div>

          {discountCodes.length === 0 ? (
            <div className="text-center py-10 rounded-xl border border-dashed border-[var(--color-neutral-200)]">
              <p className="text-sm text-[var(--color-neutral-500)]">
                {isAr ? 'لا توجد أكواد خصم بعد' : 'No discount codes yet'}
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Active codes */}
              {activeCodes.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-[var(--color-neutral-500)] uppercase tracking-wide mb-2">
                    {isAr ? 'نشطة' : 'Active'}
                  </p>
                  <div className="rounded-xl border border-[var(--color-neutral-200)] overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-[var(--color-neutral-50)] border-b border-[var(--color-neutral-100)]">
                          <th className="px-4 py-3 text-start text-xs font-medium text-[var(--color-neutral-500)] uppercase tracking-wide">
                            {isAr ? 'الكود' : 'Code'}
                          </th>
                          <th className="px-4 py-3 text-start text-xs font-medium text-[var(--color-neutral-500)] uppercase tracking-wide hidden sm:table-cell">
                            {isAr ? 'الخصم' : 'Discount'}
                          </th>
                          <th className="px-4 py-3 text-start text-xs font-medium text-[var(--color-neutral-500)] uppercase tracking-wide hidden md:table-cell">
                            {isAr ? 'الصلاحية' : 'Validity'}
                          </th>
                          <th className="px-4 py-3 text-start text-xs font-medium text-[var(--color-neutral-500)] uppercase tracking-wide hidden sm:table-cell">
                            {isAr ? 'الاستخدام' : 'Usage'}
                          </th>
                          <th className="px-4 py-3" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--color-neutral-100)]">
                        {activeCodes.map((code) => (
                          <tr key={code.id} className="hover:bg-[var(--color-neutral-50)] transition-colors">
                            <td className="px-4 py-3">
                              <span className="font-mono font-medium text-[var(--text-primary)]">
                                {code.code}
                              </span>
                            </td>
                            <td className="px-4 py-3 hidden sm:table-cell text-[var(--color-neutral-600)]">
                              {code.discount_type === 'percentage'
                                ? `${code.discount_value}%`
                                : `${code.discount_value} ${code.currency ?? ''}`}
                            </td>
                            <td className="px-4 py-3 hidden md:table-cell text-[var(--color-neutral-600)]">
                              {formatDate(code.valid_until, locale)}
                            </td>
                            <td className="px-4 py-3 hidden sm:table-cell text-[var(--color-neutral-600)]">
                              {code.current_uses}
                              {code.max_uses ? ` / ${code.max_uses}` : ''}
                            </td>
                            <td className="px-4 py-3 text-end">
                              <button
                                type="button"
                                onClick={() => handleDeactivateCode(code.id)}
                                disabled={deactivating === code.id}
                                className="px-3 py-1.5 rounded-lg text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 disabled:opacity-50 transition-colors min-h-[36px]"
                              >
                                {deactivating === code.id
                                  ? '...'
                                  : (isAr ? 'إلغاء التفعيل' : 'Deactivate')}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Inactive codes */}
              {inactiveCodes.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-[var(--color-neutral-500)] uppercase tracking-wide mb-2">
                    {isAr ? 'غير نشطة' : 'Inactive'}
                  </p>
                  <div className="rounded-xl border border-[var(--color-neutral-200)] overflow-hidden opacity-60">
                    <table className="w-full text-sm">
                      <tbody className="divide-y divide-[var(--color-neutral-100)]">
                        {inactiveCodes.map((code) => (
                          <tr key={code.id}>
                            <td className="px-4 py-3">
                              <span className="font-mono text-[var(--color-neutral-500)] line-through">
                                {code.code}
                              </span>
                            </td>
                            <td className="px-4 py-3 hidden sm:table-cell text-[var(--color-neutral-400)] text-xs">
                              {code.discount_type === 'percentage'
                                ? `${code.discount_value}%`
                                : `${code.discount_value} ${code.currency ?? ''}`}
                            </td>
                            <td className="px-4 py-3 hidden sm:table-cell text-[var(--color-neutral-400)] text-xs">
                              {code.current_uses} {isAr ? 'استخدام' : 'uses'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      </Section>

      {/* Create Code Modal */}
      {showCreateModal && (
        <CreateCodeModal
          isAr={isAr}
          onClose={() => setShowCreateModal(false)}
          onCreated={(code) => {
            setDiscountCodes((prev) => [code, ...prev]);
            setShowCreateModal(false);
          }}
        />
      )}
    </main>
  );
}
