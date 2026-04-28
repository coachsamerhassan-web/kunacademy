'use client';

import { useAuth } from '@kunacademy/auth';
import { useEffect, useState } from 'react';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';
import { useParams, useRouter, usePathname } from 'next/navigation';
import { ArrowLeft, Plus } from 'lucide-react';
import { KUN_LEVELS } from '@kunacademy/db/enums';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface ServiceCategory {
  id: string;
  slug: string;
  name_ar: string;
  name_en: string;
  display_order: number | null;
}

interface Service {
  id: string;
  slug: string | null;
  name_ar: string;
  name_en: string;
  description_ar: string | null;
  description_en: string | null;
  duration_minutes: number;
  price_aed: number | null;
  price_egp: number | null;
  price_usd: number | null;
  price_sar: number | null;
  is_active: boolean | null;
  category_id: string | null;
  sessions_count: number | null;
  validity_days: number | null;
  eligible_kun_levels: string[] | null;
  coach_control: string;
  allows_coach_pricing: boolean;
  min_price_aed: number;
  min_price_egp: number;
  min_price_eur: number;
  category: ServiceCategory | null;
}

interface ServiceForm {
  name_ar: string;
  name_en: string;
  slug: string;
  description_ar: string;
  description_en: string;
  duration_minutes: string;
  category_id: string;
  price_aed: string;
  price_egp: string;
  price_eur: string;
  sessions_count: string;
  validity_days: string;
  eligible_kun_levels: string[];
  coach_control: string;
  allows_coach_pricing: boolean;
  min_price_aed: string;
  min_price_egp: string;
  min_price_eur: string;
  is_active: boolean;
}

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

// KUN_LEVELS imported from @kunacademy/db/enums

const COACH_CONTROL_OPTIONS = [
  { value: 'optional', ar: 'اختياري', en: 'Optional' },
  { value: 'mandatory', ar: 'إلزامي', en: 'Mandatory' },
  { value: 'admin_only', ar: 'المشرف فقط', en: 'Admin Only' },
] as const;

const coachControlColors: Record<string, string> = {
  optional: 'bg-blue-100 text-blue-700',
  mandatory: 'bg-green-100 text-green-700',
  admin_only: 'bg-amber-100 text-amber-700',
};

const coachControlLabels: Record<string, { ar: string; en: string }> = {
  optional: { ar: 'اختياري', en: 'Optional' },
  mandatory: { ar: 'إلزامي', en: 'Mandatory' },
  admin_only: { ar: 'المشرف فقط', en: 'Admin Only' },
};

const EMPTY_FORM: ServiceForm = {
  name_ar: '',
  name_en: '',
  slug: '',
  description_ar: '',
  description_en: '',
  duration_minutes: '',
  category_id: '',
  price_aed: '',
  price_egp: '',
  price_eur: '',
  sessions_count: '',
  validity_days: '',
  eligible_kun_levels: [],
  coach_control: 'mandatory',
  allows_coach_pricing: false,
  min_price_aed: '',
  min_price_egp: '',
  min_price_eur: '',
  is_active: true,
};

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

/** Convert major units (display) to minor units (DB storage) */
function toMinor(val: string): number {
  const n = parseFloat(val);
  if (isNaN(n)) return 0;
  return Math.round(n * 100);
}

/** Convert minor units (DB) to major units (display) */
function toMajor(val: number | null | undefined): string {
  if (val === null || val === undefined || val === 0) return '';
  return (val / 100).toString();
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

export default function AdminServicesManagePage() {
  const { locale } = useParams<{ locale: string }>();
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const isAr = locale === 'ar';

  const [services, setServices] = useState<Service[]>([]);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [form, setForm] = useState<ServiceForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // ── Data fetch ──

  async function fetchData() {
    const res = await fetch('/api/admin/services');
    const data = await res.json();
    setServices(data.services ?? []);
    setCategories(data.categories ?? []);
    setLoading(false);
  }

  useEffect(() => {
    if (authLoading) return;
    if (!user || (profile?.role !== 'admin' && profile?.role !== 'super_admin')) {
      router.push('/' + locale + '/auth/login?redirect=' + encodeURIComponent(pathname));
      return;
    }
    fetchData();
  }, [user, profile, authLoading]);

  // ── Modal helpers ──

  function openAddModal() {
    setEditingService(null);
    setForm(EMPTY_FORM);
    setModalError(null);
    setModalOpen(true);
  }

  function openEditModal(service: Service) {
    setEditingService(service);
    setForm({
      name_ar: service.name_ar,
      name_en: service.name_en,
      slug: service.slug ?? '',
      description_ar: service.description_ar ?? '',
      description_en: service.description_en ?? '',
      duration_minutes: service.duration_minutes.toString(),
      category_id: service.category_id ?? '',
      price_aed: toMajor(service.price_aed),
      price_egp: toMajor(service.price_egp),
      price_eur: '',
      sessions_count: service.sessions_count?.toString() ?? '',
      validity_days: service.validity_days?.toString() ?? '',
      eligible_kun_levels: service.eligible_kun_levels ?? [],
      coach_control: service.coach_control ?? 'mandatory',
      allows_coach_pricing: service.allows_coach_pricing,
      min_price_aed: toMajor(service.min_price_aed),
      min_price_egp: toMajor(service.min_price_egp),
      min_price_eur: toMajor(service.min_price_eur),
      is_active: service.is_active !== false,
    });
    setModalError(null);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingService(null);
    setModalError(null);
  }

  // Auto-generate slug from name_en when adding new
  function handleNameEnChange(val: string) {
    setForm(f => ({
      ...f,
      name_en: val,
      slug: editingService ? f.slug : slugify(val),
    }));
  }

  function toggleKunLevel(level: string) {
    setForm(f => ({
      ...f,
      eligible_kun_levels: f.eligible_kun_levels.includes(level)
        ? f.eligible_kun_levels.filter(l => l !== level)
        : [...f.eligible_kun_levels, level],
    }));
  }

  // ── Save (create or update) ──

  async function saveService() {
    setModalError(null);
    if (!form.name_ar.trim() || !form.name_en.trim()) {
      setModalError(isAr ? 'الاسم بالعربي والإنجليزي مطلوبان' : 'Arabic and English names are required');
      return;
    }
    if (!form.duration_minutes || Number(form.duration_minutes) <= 0) {
      setModalError(isAr ? 'المدة يجب أن تكون أكبر من صفر' : 'Duration must be greater than 0');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name_ar: form.name_ar.trim(),
        name_en: form.name_en.trim(),
        slug: form.slug.trim() || null,
        description_ar: form.description_ar.trim() || null,
        description_en: form.description_en.trim() || null,
        duration_minutes: Number(form.duration_minutes),
        category_id: form.category_id || null,
        price_aed: toMinor(form.price_aed),
        price_egp: toMinor(form.price_egp),
        sessions_count: form.sessions_count ? Number(form.sessions_count) : null,
        validity_days: form.validity_days ? Number(form.validity_days) : null,
        eligible_kun_levels: form.eligible_kun_levels.length > 0 ? form.eligible_kun_levels : null,
        coach_control: form.coach_control,
        allows_coach_pricing: form.allows_coach_pricing,
        min_price_aed: toMinor(form.min_price_aed),
        min_price_egp: toMinor(form.min_price_egp),
        min_price_eur: toMinor(form.min_price_eur),
        is_active: form.is_active,
      };

      let res: Response;
      if (editingService) {
        res = await fetch('/api/admin/services', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingService.id, ...payload }),
        });
      } else {
        res = await fetch('/api/admin/services', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      const data = await res.json();
      if (!res.ok) {
        setModalError(data.error || (isAr ? 'حدث خطأ' : 'An error occurred'));
        return;
      }

      closeModal();
      await fetchData();
    } finally {
      setSaving(false);
    }
  }

  // ── Toggle active status ──

  async function toggleActive(service: Service) {
    const newStatus = !service.is_active;
    await fetch('/api/admin/services', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: service.id, is_active: newStatus }),
    });
    setServices(prev =>
      prev.map(s => s.id === service.id ? { ...s, is_active: newStatus } : s)
    );
  }

  // ─────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────

  if (authLoading || loading) {
    return <Section><p className="text-center py-12">Loading...</p></Section>;
  }

  return (
    <main>
      <Section variant="white">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <Heading level={1}>{isAr ? 'إدارة الخدمات' : 'Manage Services'}</Heading>
            <p className="mt-1 text-sm text-[var(--color-neutral-500)]">
              {services.length} {isAr ? 'خدمة' : 'total services'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={openAddModal}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[var(--color-primary)] text-white text-sm font-medium hover:bg-[var(--color-primary-600)] transition-colors"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              {isAr ? 'إضافة خدمة' : 'Add Service'}
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
                <th className="px-4 py-3 text-start font-medium text-[var(--color-neutral-500)]">
                  {isAr ? 'الاسم' : 'Name'}
                </th>
                <th className="px-4 py-3 text-start font-medium text-[var(--color-neutral-500)]">
                  {isAr ? 'الفئة' : 'Category'}
                </th>
                <th className="px-4 py-3 text-start font-medium text-[var(--color-neutral-500)]">
                  {isAr ? 'المدة' : 'Duration'}
                </th>
                <th className="px-4 py-3 text-start font-medium text-[var(--color-neutral-500)]">
                  {isAr ? 'السعر (درهم)' : 'Price (AED)'}
                </th>
                <th className="px-4 py-3 text-start font-medium text-[var(--color-neutral-500)]">
                  {isAr ? 'تحكم الكوتش' : 'Coach Control'}
                </th>
                <th className="px-4 py-3 text-start font-medium text-[var(--color-neutral-500)]">
                  {isAr ? 'الحالة' : 'Status'}
                </th>
                <th className="px-4 py-3 text-start font-medium text-[var(--color-neutral-500)]">
                  {isAr ? 'إجراءات' : 'Actions'}
                </th>
              </tr>
            </thead>
            <tbody>
              {services.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-[var(--color-neutral-400)]">
                    {isAr ? 'لا توجد خدمات' : 'No services found'}
                  </td>
                </tr>
              ) : (
                services.map(service => {
                  const name = isAr ? service.name_ar : service.name_en;
                  const categoryName = service.category
                    ? (isAr ? service.category.name_ar : service.category.name_en)
                    : '—';
                  const priceDisplay = service.price_aed
                    ? (service.price_aed / 100).toFixed(0)
                    : '—';
                  const ccLabel = isAr
                    ? coachControlLabels[service.coach_control]?.ar
                    : coachControlLabels[service.coach_control]?.en;
                  const ccColor = coachControlColors[service.coach_control] ?? 'bg-gray-100 text-gray-600';
                  const isActive = service.is_active !== false;

                  return (
                    <tr
                      key={service.id}
                      className="border-b border-[var(--color-neutral-100)] hover:bg-[var(--color-neutral-50)]"
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-[var(--text-primary)]">{name}</div>
                        {service.slug && (
                          <div className="text-xs text-[var(--color-neutral-400)] font-mono">{service.slug}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[var(--color-neutral-600)]">{categoryName}</td>
                      <td className="px-4 py-3 text-[var(--color-neutral-600)]">
                        {service.duration_minutes} {isAr ? 'د' : 'min'}
                      </td>
                      <td className="px-4 py-3 text-[var(--color-neutral-600)]">{priceDisplay}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${ccColor}`}>
                          {ccLabel || service.coach_control}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {isActive ? (isAr ? 'نشط' : 'Active') : (isAr ? 'غير نشط' : 'Inactive')}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <button
                            onClick={() => openEditModal(service)}
                            className="px-2 py-1 rounded text-xs font-medium bg-[var(--color-neutral-100)] text-[var(--color-neutral-700)] hover:bg-[var(--color-neutral-200)]"
                          >
                            {isAr ? 'تعديل' : 'Edit'}
                          </button>
                          <button
                            onClick={() => toggleActive(service)}
                            className={`px-2 py-1 rounded text-xs font-medium ${
                              isActive
                                ? 'bg-red-50 text-red-700 hover:bg-red-100'
                                : 'bg-green-50 text-green-700 hover:bg-green-100'
                            }`}
                          >
                            {isActive
                              ? (isAr ? 'تعطيل' : 'Deactivate')
                              : (isAr ? 'تفعيل' : 'Activate')}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Add / Edit Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={closeModal}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 p-6 max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-[var(--text-primary)] mb-4">
              {editingService
                ? (isAr ? 'تعديل الخدمة' : 'Edit Service')
                : (isAr ? 'إضافة خدمة جديدة' : 'Add New Service')}
            </h2>

            {modalError && (
              <div className="mb-4 px-4 py-2.5 rounded-lg bg-red-50 text-red-700 text-sm">
                {modalError}
              </div>
            )}

            <div className="space-y-4">
              {/* Names */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--color-neutral-600)] mb-1">
                    {isAr ? 'الاسم بالعربي' : 'Name (Arabic)'} *
                  </label>
                  <input
                    type="text"
                    dir="rtl"
                    value={form.name_ar}
                    onChange={e => setForm(f => ({ ...f, name_ar: e.target.value }))}
                    className="w-full rounded-lg border border-[var(--color-neutral-200)] px-3 py-2 text-sm"
                    placeholder="مثال: جلسة اكتشاف"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--color-neutral-600)] mb-1">
                    {isAr ? 'الاسم بالإنجليزي' : 'Name (English)'} *
                  </label>
                  <input
                    type="text"
                    value={form.name_en}
                    onChange={e => handleNameEnChange(e.target.value)}
                    className="w-full rounded-lg border border-[var(--color-neutral-200)] px-3 py-2 text-sm"
                    placeholder="e.g. Discovery Session"
                  />
                </div>
              </div>

              {/* Slug */}
              <div>
                <label className="block text-sm font-medium text-[var(--color-neutral-600)] mb-1">
                  {isAr ? 'المعرف (Slug)' : 'Slug'}
                </label>
                <input
                  type="text"
                  value={form.slug}
                  onChange={e => setForm(f => ({ ...f, slug: slugify(e.target.value) }))}
                  className="w-full rounded-lg border border-[var(--color-neutral-200)] px-3 py-2 text-sm font-mono"
                  placeholder="discovery-session"
                />
              </div>

              {/* Descriptions */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--color-neutral-600)] mb-1">
                    {isAr ? 'الوصف بالعربي' : 'Description (Arabic)'}
                  </label>
                  <textarea
                    dir="rtl"
                    value={form.description_ar}
                    onChange={e => setForm(f => ({ ...f, description_ar: e.target.value }))}
                    rows={3}
                    className="w-full rounded-lg border border-[var(--color-neutral-200)] px-3 py-2 text-sm"
                    placeholder={isAr ? 'وصف اختياري...' : 'Optional description...'}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--color-neutral-600)] mb-1">
                    {isAr ? 'الوصف بالإنجليزي' : 'Description (English)'}
                  </label>
                  <textarea
                    value={form.description_en}
                    onChange={e => setForm(f => ({ ...f, description_en: e.target.value }))}
                    rows={3}
                    className="w-full rounded-lg border border-[var(--color-neutral-200)] px-3 py-2 text-sm"
                    placeholder="Optional description..."
                  />
                </div>
              </div>

              {/* Duration + Category */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--color-neutral-600)] mb-1">
                    {isAr ? 'المدة (بالدقائق)' : 'Duration (minutes)'} *
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={form.duration_minutes}
                    onChange={e => setForm(f => ({ ...f, duration_minutes: e.target.value }))}
                    className="w-full rounded-lg border border-[var(--color-neutral-200)] px-3 py-2 text-sm"
                    placeholder="60"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--color-neutral-600)] mb-1">
                    {isAr ? 'الفئة' : 'Category'}
                  </label>
                  <select
                    value={form.category_id}
                    onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}
                    className="w-full rounded-lg border border-[var(--color-neutral-200)] px-3 py-2 text-sm"
                  >
                    <option value="">{isAr ? 'بدون فئة' : 'No category'}</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>
                        {isAr ? cat.name_ar : cat.name_en}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Prices */}
              <div>
                <p className="text-sm font-medium text-[var(--color-neutral-600)] mb-2">
                  {isAr ? 'الأسعار (بالوحدات الرئيسية)' : 'Prices (major units — stored ×100 in DB)'}
                </p>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-[var(--color-neutral-500)] mb-1">AED</label>
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={form.price_aed}
                      onChange={e => setForm(f => ({ ...f, price_aed: e.target.value }))}
                      className="w-full rounded-lg border border-[var(--color-neutral-200)] px-3 py-2 text-sm"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[var(--color-neutral-500)] mb-1">EGP</label>
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={form.price_egp}
                      onChange={e => setForm(f => ({ ...f, price_egp: e.target.value }))}
                      className="w-full rounded-lg border border-[var(--color-neutral-200)] px-3 py-2 text-sm"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[var(--color-neutral-500)] mb-1">EUR</label>
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={form.price_eur}
                      onChange={e => setForm(f => ({ ...f, price_eur: e.target.value }))}
                      className="w-full rounded-lg border border-[var(--color-neutral-200)] px-3 py-2 text-sm"
                      placeholder="0"
                    />
                  </div>
                </div>
              </div>

              {/* Sessions count + Validity days */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--color-neutral-600)] mb-1">
                    {isAr ? 'عدد الجلسات (للباقات)' : 'Sessions count (packages)'}
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={form.sessions_count}
                    onChange={e => setForm(f => ({ ...f, sessions_count: e.target.value }))}
                    className="w-full rounded-lg border border-[var(--color-neutral-200)] px-3 py-2 text-sm"
                    placeholder={isAr ? 'اتركه فارغاً إذا لم يكن باقة' : 'Leave empty if not a package'}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--color-neutral-600)] mb-1">
                    {isAr ? 'أيام الصلاحية (للباقات)' : 'Validity days (packages)'}
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={form.validity_days}
                    onChange={e => setForm(f => ({ ...f, validity_days: e.target.value }))}
                    className="w-full rounded-lg border border-[var(--color-neutral-200)] px-3 py-2 text-sm"
                    placeholder={isAr ? 'اتركه فارغاً إذا لم يكن باقة' : 'Leave empty if not a package'}
                  />
                </div>
              </div>

              {/* Eligible Kun Levels */}
              <div>
                <p className="text-sm font-medium text-[var(--color-neutral-600)] mb-2">
                  {isAr ? 'المستويات المؤهلة' : 'Eligible Kun Levels'}
                  <span className="text-xs text-[var(--color-neutral-400)] ms-1">
                    {isAr ? '(فارغ = جميع المستويات)' : '(empty = all levels)'}
                  </span>
                </p>
                <div className="flex flex-wrap gap-2">
                  {KUN_LEVELS.map(level => (
                    <label
                      key={level}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border cursor-pointer text-sm transition-colors ${
                        form.eligible_kun_levels.includes(level)
                          ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-white'
                          : 'border-[var(--color-neutral-200)] text-[var(--color-neutral-600)] hover:border-[var(--color-primary)]'
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={form.eligible_kun_levels.includes(level)}
                        onChange={() => toggleKunLevel(level)}
                      />
                      {level.charAt(0).toUpperCase() + level.slice(1)}
                    </label>
                  ))}
                </div>
              </div>

              {/* Coach Control */}
              <div>
                <p className="text-sm font-medium text-[var(--color-neutral-600)] mb-2">
                  {isAr ? 'تحكم الكوتش' : 'Coach Control'} *
                </p>
                <div className="flex flex-wrap gap-3">
                  {COACH_CONTROL_OPTIONS.map(opt => (
                    <label
                      key={opt.value}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border cursor-pointer text-sm transition-colors ${
                        form.coach_control === opt.value
                          ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-white'
                          : 'border-[var(--color-neutral-200)] text-[var(--color-neutral-600)] hover:border-[var(--color-primary)]'
                      }`}
                    >
                      <input
                        type="radio"
                        className="sr-only"
                        name="coach_control"
                        value={opt.value}
                        checked={form.coach_control === opt.value}
                        onChange={() => setForm(f => ({ ...f, coach_control: opt.value }))}
                      />
                      {isAr ? opt.ar : opt.en}
                    </label>
                  ))}
                </div>
              </div>

              {/* Allows Coach Pricing toggle */}
              <div className="flex items-center justify-between py-3 border-t border-[var(--color-neutral-100)]">
                <div>
                  <p className="text-sm font-medium text-[var(--text-primary)]">
                    {isAr ? 'السماح للكوتش بتحديد السعر' : 'Allow Coach Pricing'}
                  </p>
                  <p className="text-xs text-[var(--color-neutral-400)] mt-0.5">
                    {isAr
                      ? 'يتيح للكوتش تحديد سعره الخاص ضمن الحد الأدنى'
                      : 'Lets the coach set their own price within the minimum'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, allows_coach_pricing: !f.allows_coach_pricing }))}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none ${
                    form.allows_coach_pricing ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-neutral-200)]'
                  }`}
                  role="switch"
                  aria-checked={form.allows_coach_pricing}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ease-in-out ${
                      form.allows_coach_pricing ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Min prices — only visible when allows_coach_pricing is true */}
              {form.allows_coach_pricing && (
                <div>
                  <p className="text-sm font-medium text-[var(--color-neutral-600)] mb-2">
                    {isAr ? 'الحد الأدنى للسعر' : 'Minimum Prices'}
                  </p>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs text-[var(--color-neutral-500)] mb-1">Min AED</label>
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={form.min_price_aed}
                        onChange={e => setForm(f => ({ ...f, min_price_aed: e.target.value }))}
                        className="w-full rounded-lg border border-[var(--color-neutral-200)] px-3 py-2 text-sm"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-[var(--color-neutral-500)] mb-1">Min EGP</label>
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={form.min_price_egp}
                        onChange={e => setForm(f => ({ ...f, min_price_egp: e.target.value }))}
                        className="w-full rounded-lg border border-[var(--color-neutral-200)] px-3 py-2 text-sm"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-[var(--color-neutral-500)] mb-1">Min EUR</label>
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={form.min_price_eur}
                        onChange={e => setForm(f => ({ ...f, min_price_eur: e.target.value }))}
                        className="w-full rounded-lg border border-[var(--color-neutral-200)] px-3 py-2 text-sm"
                        placeholder="0"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Is Active toggle */}
              <div className="flex items-center justify-between py-3 border-t border-[var(--color-neutral-100)]">
                <div>
                  <p className="text-sm font-medium text-[var(--text-primary)]">
                    {isAr ? 'الخدمة نشطة' : 'Service Active'}
                  </p>
                  <p className="text-xs text-[var(--color-neutral-400)] mt-0.5">
                    {isAr
                      ? 'الخدمات غير النشطة لا تظهر للعملاء'
                      : 'Inactive services are hidden from clients'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, is_active: !f.is_active }))}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none ${
                    form.is_active ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-neutral-200)]'
                  }`}
                  role="switch"
                  aria-checked={form.is_active}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ease-in-out ${
                      form.is_active ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Modal footer */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={closeModal}
                className="flex-1 px-4 py-2.5 rounded-xl border border-[var(--color-neutral-200)] text-sm font-medium text-[var(--color-neutral-600)] hover:bg-[var(--color-neutral-50)]"
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                onClick={saveService}
                disabled={saving}
                className="flex-1 px-4 py-2.5 rounded-xl bg-[var(--color-primary)] text-white text-sm font-medium hover:bg-[var(--color-primary-600)] disabled:opacity-50"
              >
                {saving
                  ? (isAr ? 'جاري الحفظ...' : 'Saving...')
                  : (isAr ? 'حفظ' : 'Save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
