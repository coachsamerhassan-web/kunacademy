'use client';

import { useAuth } from '@kunacademy/auth';
import { useEffect, useState } from 'react';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Plus, X } from 'lucide-react';

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
  provider_id: string | null;
  is_active: boolean;
  created_at: string;
  owner_name: string | null;
}

interface Service {
  id: string;
  name_ar: string | null;
  name_en: string | null;
  duration_minutes: number;
}

function statusBadge(code: DiscountCode): { label: string; arLabel: string; color: string } {
  const now = new Date();
  if (!code.is_active) return { label: 'Inactive', arLabel: 'غير نشط', color: 'bg-red-100 text-red-700' };
  if (new Date(code.valid_until) < now) return { label: 'Expired', arLabel: 'منتهي', color: 'bg-amber-100 text-amber-700' };
  return { label: 'Active', arLabel: 'نشط', color: 'bg-green-100 text-green-700' };
}

function typeBadge(type: string): { label: string; color: string } {
  if (type === 'percentage') return { label: '%', color: 'bg-blue-100 text-blue-700' };
  return { label: 'Fixed', color: 'bg-emerald-100 text-emerald-700' };
}

function formatDate(dateStr: string, isAr: boolean): string {
  return new Date(dateStr).toLocaleDateString(isAr ? 'ar-SA' : 'en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function todayLocal(): string {
  const now = new Date();
  // Format as YYYY-MM-DDTHH:MM for datetime-local input
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

const CURRENCIES = ['AED', 'EGP', 'EUR'];

const inputClass = 'w-full rounded-lg border border-[var(--color-neutral-200)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent';

export default function AdminDiscountCodesPage() {
  const { locale } = useParams<{ locale: string }>();
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const isAr = locale === 'ar';

  const [codes, setCodes] = useState<DiscountCode[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    code: '',
    discount_type: 'percentage' as 'percentage' | 'fixed_amount',
    discount_value: '',
    currency: 'AED',
    valid_from: todayLocal(),
    valid_until: '',
    max_uses: '',
    applicable_service_ids: [] as string[],
    is_active: true,
  });

  async function fetchCodes() {
    const res = await fetch('/api/admin/discount-codes');
    const data = await res.json();
    setCodes(data.discount_codes ?? []);
    setLoading(false);
  }

  async function fetchServices() {
    const res = await fetch('/api/admin/services-list');
    const data = await res.json();
    setServices(data.services ?? []);
  }

  useEffect(() => {
    if (authLoading) return;
    if (!user || (profile?.role !== 'admin' && profile?.role !== 'super_admin')) {
      router.push('/' + locale + '/auth/login');
      return;
    }
    fetchCodes();
    fetchServices();
  }, [user, profile, authLoading]);

  function resetForm() {
    setForm({
      code: '',
      discount_type: 'percentage',
      discount_value: '',
      currency: 'AED',
      valid_from: todayLocal(),
      valid_until: '',
      max_uses: '',
      applicable_service_ids: [],
      is_active: true,
    });
    setError(null);
  }

  async function handleCreate() {
    setError(null);
    if (!form.code.trim()) { setError(isAr ? 'الكود مطلوب' : 'Code is required'); return; }
    if (!form.discount_value) { setError(isAr ? 'قيمة الخصم مطلوبة' : 'Discount value is required'); return; }
    if (!form.valid_until) { setError(isAr ? 'تاريخ الانتهاء مطلوب' : 'Valid until date is required'); return; }

    setSaving(true);
    try {
      const res = await fetch('/api/admin/discount-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: form.code.toUpperCase().trim(),
          discount_type: form.discount_type,
          discount_value: Number(form.discount_value),
          currency: form.discount_type === 'fixed_amount' ? form.currency : undefined,
          valid_from: new Date(form.valid_from).toISOString(),
          valid_until: new Date(form.valid_until).toISOString(),
          max_uses: form.max_uses ? Number(form.max_uses) : null,
          applicable_service_ids: form.applicable_service_ids.length ? form.applicable_service_ids : null,
          is_active: form.is_active,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || (isAr ? 'حدث خطأ' : 'An error occurred')); return; }
      setShowCreate(false);
      resetForm();
      await fetchCodes();
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(code: DiscountCode) {
    setActionId(code.id);
    try {
      await fetch('/api/admin/discount-codes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: code.id, is_active: !code.is_active }),
      });
      setCodes(prev => prev.map(c => c.id === code.id ? { ...c, is_active: !c.is_active } : c));
    } finally {
      setActionId(null);
    }
  }

  async function handleDeactivate(id: string) {
    if (!confirm(isAr ? 'هل أنت متأكد من إلغاء تفعيل هذا الكود؟' : 'Deactivate this discount code?')) return;
    setActionId(id);
    try {
      await fetch('/api/admin/discount-codes', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      setCodes(prev => prev.map(c => c.id === id ? { ...c, is_active: false } : c));
    } finally {
      setActionId(null);
    }
  }

  function toggleService(serviceId: string) {
    setForm(f => ({
      ...f,
      applicable_service_ids: f.applicable_service_ids.includes(serviceId)
        ? f.applicable_service_ids.filter(id => id !== serviceId)
        : [...f.applicable_service_ids, serviceId],
    }));
  }

  if (authLoading || loading) {
    return <Section><p className="text-center py-12">Loading...</p></Section>;
  }

  return (
    <main>
      <Section variant="white">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <Heading level={1}>{isAr ? 'كودات الخصم' : 'Discount Codes'}</Heading>
            <p className="mt-1 text-sm text-[var(--color-neutral-500)]">
              {codes.length} {isAr ? 'كود' : 'total codes'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => { resetForm(); setShowCreate(true); }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--color-primary)] text-white text-sm font-medium hover:bg-[var(--color-primary-600)] transition-colors"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              {isAr ? 'إنشاء كود' : 'Create Code'}
            </button>
            <a
              href={'/' + locale + '/admin'}
              className="text-[var(--color-primary)] text-sm hover:underline flex items-center gap-1"
            >
              <ArrowLeft className="w-4 h-4 rtl:rotate-180" aria-hidden="true" />
              {isAr ? 'لوحة الإدارة' : 'Dashboard'}
            </a>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-xl border border-[var(--color-neutral-200)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--color-neutral-50)] border-b border-[var(--color-neutral-200)]">
                <th className="px-4 py-3 text-start font-medium text-[var(--color-neutral-500)]">{isAr ? 'الكود' : 'Code'}</th>
                <th className="px-4 py-3 text-start font-medium text-[var(--color-neutral-500)]">{isAr ? 'النوع' : 'Type'}</th>
                <th className="px-4 py-3 text-start font-medium text-[var(--color-neutral-500)]">{isAr ? 'القيمة' : 'Value'}</th>
                <th className="px-4 py-3 text-start font-medium text-[var(--color-neutral-500)]">{isAr ? 'فترة الصلاحية' : 'Valid Period'}</th>
                <th className="px-4 py-3 text-start font-medium text-[var(--color-neutral-500)]">{isAr ? 'الاستخدام' : 'Usage'}</th>
                <th className="px-4 py-3 text-start font-medium text-[var(--color-neutral-500)]">{isAr ? 'الحالة' : 'Status'}</th>
                <th className="px-4 py-3 text-start font-medium text-[var(--color-neutral-500)]">{isAr ? 'المالك' : 'Owner'}</th>
                <th className="px-4 py-3 text-start font-medium text-[var(--color-neutral-500)]">{isAr ? 'إجراءات' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody>
              {codes.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-[var(--color-neutral-400)]">
                    {isAr ? 'لا توجد كودات خصم' : 'No discount codes found'}
                  </td>
                </tr>
              ) : codes.map(code => {
                const status = statusBadge(code);
                const type = typeBadge(code.discount_type);
                const usageStr = code.max_uses !== null
                  ? `${code.current_uses} / ${code.max_uses}`
                  : `${code.current_uses} / \u221e`;

                return (
                  <tr key={code.id} className="border-b border-[var(--color-neutral-100)] hover:bg-[var(--color-neutral-50)]">
                    <td className="px-4 py-3">
                      <span className="font-mono font-semibold text-[var(--text-primary)] tracking-wide">{code.code}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${type.color}`}>
                        {code.discount_type === 'percentage'
                          ? (isAr ? 'نسبة مئوية' : 'Percentage')
                          : (isAr ? 'مبلغ ثابت' : 'Fixed Amount')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[var(--text-primary)] font-medium">
                      {code.discount_type === 'percentage'
                        ? `${code.discount_value}%`
                        : `${code.discount_value} ${code.currency ?? ''}`}
                    </td>
                    <td className="px-4 py-3 text-[var(--color-neutral-600)] text-xs">
                      <div>{formatDate(code.valid_from, isAr)}</div>
                      <div className="text-[var(--color-neutral-400)]">{isAr ? 'حتى' : 'until'} {formatDate(code.valid_until, isAr)}</div>
                    </td>
                    <td className="px-4 py-3 text-[var(--color-neutral-600)] font-mono text-xs">
                      {usageStr}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${status.color}`}>
                        {isAr ? status.arLabel : status.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[var(--color-neutral-600)] text-xs">
                      {code.provider_id
                        ? (code.owner_name || (isAr ? 'كوتش' : 'Coach'))
                        : (isAr ? 'الإدارة' : 'Admin')}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleToggleActive(code)}
                          disabled={actionId === code.id}
                          className={`px-2 py-1 rounded text-xs font-medium disabled:opacity-50 ${
                            code.is_active
                              ? 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                              : 'bg-green-50 text-green-700 hover:bg-green-100'
                          }`}
                        >
                          {code.is_active ? (isAr ? 'إيقاف' : 'Pause') : (isAr ? 'تفعيل' : 'Enable')}
                        </button>
                        {code.is_active && (
                          <button
                            onClick={() => handleDeactivate(code.id)}
                            disabled={actionId === code.id}
                            className="px-2 py-1 rounded text-xs font-medium bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-50"
                          >
                            {isAr ? 'إلغاء' : 'Deactivate'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Create Modal */}
      {showCreate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => { setShowCreate(false); resetForm(); }}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-[var(--text-primary)]">
                {isAr ? 'إنشاء كود خصم' : 'Create Discount Code'}
              </h2>
              <button
                onClick={() => { setShowCreate(false); resetForm(); }}
                className="p-1 rounded-lg hover:bg-[var(--color-neutral-100)] text-[var(--color-neutral-500)]"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            {error && (
              <div className="mb-4 px-3 py-2 rounded-lg bg-red-50 text-red-700 text-sm">
                {error}
              </div>
            )}

            <div className="space-y-4">
              {/* Code */}
              <div>
                <label className="block text-sm font-medium text-[var(--color-neutral-600)] mb-1">
                  {isAr ? 'الكود' : 'Code'} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.code}
                  onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                  placeholder={isAr ? 'مثال: SUMMER25' : 'e.g. SUMMER25'}
                  className={inputClass}
                  dir="ltr"
                />
                <p className="mt-1 text-xs text-[var(--color-neutral-400)]">
                  {isAr ? 'أحرف كبيرة وأرقام وشرطات فقط' : 'Uppercase letters, numbers, and hyphens only'}
                </p>
              </div>

              {/* Type */}
              <div>
                <label className="block text-sm font-medium text-[var(--color-neutral-600)] mb-2">
                  {isAr ? 'نوع الخصم' : 'Discount Type'} <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-4">
                  {(['percentage', 'fixed_amount'] as const).map(type => (
                    <label key={type} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="discount_type"
                        value={type}
                        checked={form.discount_type === type}
                        onChange={() => setForm(f => ({ ...f, discount_type: type }))}
                        className="accent-[var(--color-primary)]"
                      />
                      <span className="text-sm text-[var(--text-primary)]">
                        {type === 'percentage'
                          ? (isAr ? 'نسبة مئوية' : 'Percentage')
                          : (isAr ? 'مبلغ ثابت' : 'Fixed Amount')}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Value + Currency */}
              <div className="flex gap-3">
                <div className={form.discount_type === 'fixed_amount' ? 'flex-1' : 'w-full'}>
                  <label className="block text-sm font-medium text-[var(--color-neutral-600)] mb-1">
                    {isAr ? 'القيمة' : 'Value'} <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={form.discount_value}
                      onChange={e => setForm(f => ({ ...f, discount_value: e.target.value }))}
                      min={1}
                      max={form.discount_type === 'percentage' ? 100 : undefined}
                      placeholder={form.discount_type === 'percentage' ? '10' : '100'}
                      className={inputClass + ' pe-8'}
                      dir="ltr"
                    />
                    {form.discount_type === 'percentage' && (
                      <span className="absolute end-3 top-1/2 -translate-y-1/2 text-[var(--color-neutral-400)] text-sm">%</span>
                    )}
                  </div>
                </div>
                {form.discount_type === 'fixed_amount' && (
                  <div className="w-28">
                    <label className="block text-sm font-medium text-[var(--color-neutral-600)] mb-1">
                      {isAr ? 'العملة' : 'Currency'}
                    </label>
                    <select
                      value={form.currency}
                      onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
                      className={inputClass}
                    >
                      {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                )}
              </div>

              {/* Valid From */}
              <div>
                <label className="block text-sm font-medium text-[var(--color-neutral-600)] mb-1">
                  {isAr ? 'صالح من' : 'Valid From'}
                </label>
                <input
                  type="datetime-local"
                  value={form.valid_from}
                  onChange={e => setForm(f => ({ ...f, valid_from: e.target.value }))}
                  className={inputClass}
                />
              </div>

              {/* Valid Until */}
              <div>
                <label className="block text-sm font-medium text-[var(--color-neutral-600)] mb-1">
                  {isAr ? 'صالح حتى' : 'Valid Until'} <span className="text-red-500">*</span>
                </label>
                <input
                  type="datetime-local"
                  value={form.valid_until}
                  onChange={e => setForm(f => ({ ...f, valid_until: e.target.value }))}
                  className={inputClass}
                />
              </div>

              {/* Max Uses */}
              <div>
                <label className="block text-sm font-medium text-[var(--color-neutral-600)] mb-1">
                  {isAr ? 'الحد الأقصى للاستخدام' : 'Max Uses'}
                </label>
                <input
                  type="number"
                  value={form.max_uses}
                  onChange={e => setForm(f => ({ ...f, max_uses: e.target.value }))}
                  min={1}
                  placeholder={isAr ? 'فارغ = غير محدود' : 'Leave blank for unlimited'}
                  className={inputClass}
                  dir="ltr"
                />
              </div>

              {/* Applicable Services */}
              <div>
                  <label className="block text-sm font-medium text-[var(--color-neutral-600)] mb-2">
                    {isAr ? 'الخدمات المشمولة' : 'Applicable Services'}
                  </label>
                  <p className="text-xs text-[var(--color-neutral-400)] mb-2">
                    {isAr ? 'لا شيء محدد = جميع الخدمات' : 'None selected = all services'}
                  </p>
                  <div className="max-h-40 overflow-y-auto border border-[var(--color-neutral-200)] rounded-lg divide-y divide-[var(--color-neutral-100)]">
                    {services.map(svc => {
                      const name = isAr ? svc.name_ar : svc.name_en;
                      const checked = form.applicable_service_ids.includes(svc.id);
                      return (
                        <label
                          key={svc.id}
                          className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-[var(--color-neutral-50)]"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleService(svc.id)}
                            className="accent-[var(--color-primary)]"
                          />
                          <span className="text-sm text-[var(--text-primary)]">
                            {name} <span className="text-[var(--color-neutral-400)]">({svc.duration_minutes} min)</span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  {services.length === 0 && (
                    <p className="text-xs text-[var(--color-neutral-400)] mt-2">{isAr ? 'جاري تحميل الخدمات...' : 'Loading services...'}</p>
                  )}
                </div>

              {/* Active Toggle */}
              <div className="flex items-center justify-between py-1">
                <span className="text-sm font-medium text-[var(--color-neutral-600)]">
                  {isAr ? 'نشط فور الإنشاء' : 'Active immediately'}
                </span>
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, is_active: !f.is_active }))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    form.is_active ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-neutral-300)]'
                  }`}
                  aria-pressed={form.is_active}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                      form.is_active ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => { setShowCreate(false); resetForm(); }}
                className="flex-1 px-4 py-2.5 rounded-xl border border-[var(--color-neutral-200)] text-sm font-medium text-[var(--color-neutral-600)] hover:bg-[var(--color-neutral-50)]"
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                onClick={handleCreate}
                disabled={saving}
                className="flex-1 px-4 py-2.5 rounded-xl bg-[var(--color-primary)] text-white text-sm font-medium hover:bg-[var(--color-primary-600)] disabled:opacity-50 transition-colors"
              >
                {saving ? (isAr ? 'جاري الحفظ...' : 'Saving...') : (isAr ? 'إنشاء' : 'Create')}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
