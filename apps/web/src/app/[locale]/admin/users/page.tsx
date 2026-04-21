'use client';

import { useAuth } from '@kunacademy/auth';
import { useEffect, useState, useMemo } from 'react';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, UserPlus, Send, ExternalLink } from 'lucide-react';
import { KUN_LEVELS, ICF_CREDENTIALS } from '@kunacademy/db/enums';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface UserRow {
  id: string;
  email: string;
  full_name_ar: string | null;
  full_name_en: string | null;
  phone: string | null;
  role: string;
  status: string | null;
  preferred_language: string | null;
  created_at: string;
  has_provider: boolean;
  has_instructor: boolean;
  instructor_id: string | null;
  kun_level: string | null;
  icf_credential: string | null;
  is_bookable: boolean | null;
  provider_is_visible: boolean | null;
  instructor_is_visible: boolean | null;
}

interface CreateForm {
  email: string;
  full_name_ar: string;
  full_name_en: string;
  phone: string;
  role: string;
  preferred_language: 'ar' | 'en';
  send_activation: boolean;
}

interface EditForm {
  role: string;
  kun_level: string;
  icf_credential: string;
  is_visible: boolean;
  is_bookable: boolean;
  // Coach profile fields
  title_ar: string;
  title_en: string;
  bio_ar: string;
  bio_en: string;
  photo_url: string;
  credentials: string;
  specialties: string;
  coaching_styles: string;
  display_order: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const ROLE_BADGE: Record<string, string> = {
  student:     'bg-gray-100 text-gray-600',
  provider:    'bg-blue-100 text-blue-700',
  mentor:      'bg-indigo-100 text-indigo-700',
  apprentice:  'bg-teal-100 text-teal-700',
  assessor:    'bg-amber-100 text-amber-700',
  admin:       'bg-purple-100 text-purple-700',
  super_admin: 'bg-red-100 text-red-700',
};

const ROLE_LABELS: Record<string, { ar: string; en: string }> = {
  student:     { ar: 'طالب',      en: 'Student' },
  provider:    { ar: 'كوتش',      en: 'Coach' },
  mentor:      { ar: 'منتور',     en: 'Mentor' },
  apprentice:  { ar: 'مرشَّح',     en: 'Apprentice' },
  assessor:    { ar: 'مُقيِّم',     en: 'Assessor' },
  admin:       { ar: 'مدير',      en: 'Admin' },
  super_admin: { ar: 'مدير عام',  en: 'Super Admin' },
};

// Assignable via admin UI — 'super_admin' intentionally excluded.
// Must stay in sync with ASSIGNABLE_ROLES in /api/admin/users/route.ts.
const ASSIGNABLE_ROLES = [
  'student', 'provider', 'mentor', 'apprentice', 'assessor', 'admin',
] as const;

const STATUS_LABELS: Record<string, { ar: string; en: string; color: string }> = {
  active:      { ar: 'نشط',    en: 'Active',      color: 'bg-green-100 text-green-700' },
  invited:     { ar: 'مَدعوّ',  en: 'Invited',     color: 'bg-amber-100 text-amber-700' },
  deactivated: { ar: 'موقوف',   en: 'Deactivated', color: 'bg-gray-200 text-gray-500' },
};

// KUN_LEVELS and ICF_CREDENTIALS imported from @kunacademy/db/enums

const KUN_LEVEL_LABELS: Record<string, { ar: string; en: string }> = {
  basic: { ar: 'أساسي', en: 'Basic' },
  professional: { ar: 'محترف', en: 'Professional' },
  expert: { ar: 'خبير', en: 'Expert' },
  master: { ar: 'ماستر', en: 'Master' },
};

const ICF_LABELS: Record<string, { ar: string; en: string }> = {
  none: { ar: 'لا يوجد', en: 'None' },
  acc: { ar: 'ACC', en: 'ACC' },
  pcc: { ar: 'PCC', en: 'PCC' },
  mcc: { ar: 'MCC', en: 'MCC' },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function AdminUsersPage() {
  const { locale } = useParams<{ locale: string }>();
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const isAr = locale === 'ar';

  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  // Modal state
  const [editUser, setEditUser] = useState<UserRow | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({
    role: 'student',
    kun_level: '',
    icf_credential: '',
    is_visible: false,
    is_bookable: false,
    title_ar: '',
    title_en: '',
    bio_ar: '',
    bio_en: '',
    photo_url: '',
    credentials: '',
    specialties: '',
    coaching_styles: '',
    display_order: 0,
  });
  const [profileLoading, setProfileLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Create-user modal state
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<CreateForm>({
    email: '',
    full_name_ar: '',
    full_name_en: '',
    phone: '',
    role: 'student',
    preferred_language: 'ar',
    send_activation: true,
  });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createToast, setCreateToast] = useState<string | null>(null);

  // Per-row "Send activation" feedback (keyed by user_id)
  const [sendingActivation, setSendingActivation] = useState<string | null>(null);
  const [activationToast, setActivationToast] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Auth guard
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (authLoading) return;
    if (!user || profile?.role !== 'admin') {
      router.push('/' + locale + '/auth/login');
      return;
    }
    fetchUsers();
  }, [user, profile, authLoading]);

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------
  async function fetchUsers() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/users');
      const data = await res.json();
      setUsers(data.users ?? []);
    } finally {
      setLoading(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Filtering
  // ---------------------------------------------------------------------------
  const filtered = useMemo(() => {
    let list = users;

    // Tab filter
    if (filter === 'students') list = list.filter(u => u.role === 'student');
    else if (filter === 'coaches') list = list.filter(u => u.role === 'provider');
    else if (filter === 'admins') list = list.filter(u => u.role === 'admin' || u.role === 'super_admin');

    // Search filter
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        u =>
          (u.full_name_ar ?? '').toLowerCase().includes(q) ||
          (u.full_name_en ?? '').toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q)
      );
    }

    return list;
  }, [users, filter, search]);

  // ---------------------------------------------------------------------------
  // Tab counts (based on unfiltered list)
  // ---------------------------------------------------------------------------
  const counts = useMemo(
    () => ({
      all: users.length,
      students: users.filter(u => u.role === 'student').length,
      coaches: users.filter(u => u.role === 'provider').length,
      admins: users.filter(u => u.role === 'admin' || u.role === 'super_admin').length,
    }),
    [users]
  );

  // ---------------------------------------------------------------------------
  // Modal helpers
  // ---------------------------------------------------------------------------
  async function openEdit(u: UserRow) {
    setEditUser(u);
    setSaveError(null);
    setEditForm({
      role: u.role,
      kun_level: u.kun_level ?? '',
      icf_credential: u.icf_credential ?? '',
      is_visible: u.instructor_is_visible ?? u.provider_is_visible ?? false,
      is_bookable: u.is_bookable ?? false,
      title_ar: '',
      title_en: '',
      bio_ar: '',
      bio_en: '',
      photo_url: '',
      credentials: '',
      specialties: '',
      coaching_styles: '',
      display_order: 0,
    });

    // Fetch full instructor profile if this is a provider with an instructor record
    if (u.role === 'provider' && u.instructor_id) {
      setProfileLoading(true);
      try {
        const res = await fetch(`/api/admin/instructors/${u.instructor_id}`);
        if (res.ok) {
          const data = await res.json();
          const ins = data.instructor;
          if (ins) {
            setEditForm(f => ({
              ...f,
              title_ar: ins.title_ar ?? '',
              title_en: ins.title_en ?? '',
              bio_ar: ins.bio_ar ?? '',
              bio_en: ins.bio_en ?? '',
              photo_url: ins.photo_url ?? '',
              credentials: ins.credentials ?? '',
              specialties: Array.isArray(ins.specialties) ? ins.specialties.join(', ') : (ins.specialties ?? ''),
              coaching_styles: Array.isArray(ins.coaching_styles) ? ins.coaching_styles.join(', ') : (ins.coaching_styles ?? ''),
              display_order: ins.display_order ?? 0,
            }));
          }
        }
      } finally {
        setProfileLoading(false);
      }
    }
  }

  async function saveEdit() {
    if (!editUser) return;
    setSaving(true);
    setSaveError(null);

    const isProvider = editForm.role === 'provider';

    const body: Record<string, unknown> = {
      user_id: editUser.id,
      role: editForm.role,
    };

    if (isProvider) {
      body.kun_level = editForm.kun_level || null;
      body.icf_credential = editForm.icf_credential || null;
      body.is_visible = editForm.is_visible;
      body.is_bookable = editForm.is_bookable;
    }

    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setSaveError(data.error ?? 'Unknown error');
        return;
      }

      // If provider with an instructor record, also save coach profile fields
      if (isProvider && editUser.instructor_id) {
        const splitTrim = (s: string) =>
          s.split(',').map(v => v.trim()).filter(Boolean);

        const profileBody = {
          title_ar: editForm.title_ar || undefined,
          title_en: editForm.title_en || undefined,
          bio_ar: editForm.bio_ar,
          bio_en: editForm.bio_en,
          photo_url: editForm.photo_url,
          credentials: editForm.credentials,
          specialties: splitTrim(editForm.specialties),
          coaching_styles: splitTrim(editForm.coaching_styles),
          display_order: editForm.display_order,
        };

        const profileRes = await fetch(`/api/admin/instructors/${editUser.instructor_id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(profileBody),
        });
        if (!profileRes.ok) {
          const profileData = await profileRes.json();
          setSaveError(profileData.error ?? 'Failed to save coach profile');
          return;
        }
      }

      setEditUser(null);
      await fetchUsers();
    } catch (err: any) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Create-user handler
  // ---------------------------------------------------------------------------
  function resetCreateForm() {
    setCreateForm({
      email: '',
      full_name_ar: '',
      full_name_en: '',
      phone: '',
      role: 'student',
      preferred_language: 'ar',
      send_activation: true,
    });
    setCreateError(null);
  }

  async function submitCreate() {
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email:              createForm.email.trim().toLowerCase(),
          full_name_ar:       createForm.full_name_ar.trim() || undefined,
          full_name_en:       createForm.full_name_en.trim() || undefined,
          phone:              createForm.phone.trim() || undefined,
          role:               createForm.role,
          preferred_language: createForm.preferred_language,
          send_activation:    createForm.send_activation,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCreateError(data.error ?? 'Unknown error');
        return;
      }
      setCreateToast(
        data.activation_sent
          ? (isAr ? 'تم إنشاء المستخدم وإرسال رابط التفعيل' : 'User created and activation link sent')
          : (isAr ? 'تم إنشاء المستخدم' : 'User created')
      );
      setShowCreate(false);
      resetCreateForm();
      await fetchUsers();
      setTimeout(() => setCreateToast(null), 4000);
    } catch (err: any) {
      setCreateError(err.message);
    } finally {
      setCreating(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Per-row "Send activation link" handler
  // ---------------------------------------------------------------------------
  async function sendActivationLink(u: UserRow) {
    setSendingActivation(u.id);
    try {
      const res = await fetch(`/api/admin/users/${u.id}/send-activation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) {
        setActivationToast(
          (isAr ? 'فشل الإرسال: ' : 'Send failed: ') + (data.error ?? 'unknown')
        );
      } else {
        setActivationToast(
          isAr ? `تم إرسال رابط التفعيل إلى ${u.email}` : `Activation link sent to ${u.email}`
        );
        await fetchUsers();
      }
    } catch (err: any) {
      setActivationToast((isAr ? 'خطأ: ' : 'Error: ') + err.message);
    } finally {
      setSendingActivation(null);
      setTimeout(() => setActivationToast(null), 4000);
    }
  }

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------
  function roleBadge(role: string) {
    const color = ROLE_BADGE[role] ?? 'bg-gray-100 text-gray-500';
    const label = isAr ? ROLE_LABELS[role]?.ar : ROLE_LABELS[role]?.en;
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>
        {label ?? role}
      </span>
    );
  }

  function displayName(u: UserRow) {
    return (isAr ? u.full_name_ar : u.full_name_en) ?? u.email;
  }

  function statusBadge(status: string | null) {
    const s = status ?? 'active';
    const cfg = STATUS_LABELS[s] ?? STATUS_LABELS['active']!;
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
        {isAr ? cfg.ar : cfg.en}
      </span>
    );
  }

  // ---------------------------------------------------------------------------
  // Loading / guard
  // ---------------------------------------------------------------------------
  if (authLoading || loading) {
    return (
      <Section>
        <p className="text-center py-12 text-[var(--color-neutral-400)]">
          {isAr ? 'جاري التحميل...' : 'Loading...'}
        </p>
      </Section>
    );
  }

  // ---------------------------------------------------------------------------
  // Page render
  // ---------------------------------------------------------------------------
  const tabs = [
    { key: 'all', labelAr: 'الكل', labelEn: 'All', count: counts.all },
    { key: 'students', labelAr: 'الطلاب', labelEn: 'Students', count: counts.students },
    { key: 'coaches', labelAr: 'الكوتشز', labelEn: 'Coaches', count: counts.coaches },
    { key: 'admins', labelAr: 'المديرون', labelEn: 'Admins', count: counts.admins },
  ];

  return (
    <main>
      <Section variant="white">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <Heading level={1}>{isAr ? 'إدارة المستخدمين' : 'User Management'}</Heading>
            <p className="mt-1 text-sm text-[var(--color-neutral-500)]">
              {users.length} {isAr ? 'مستخدم' : 'total users'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => { resetCreateForm(); setShowCreate(true); }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--color-primary)] text-white text-sm font-medium hover:bg-[var(--color-primary-600)]"
            >
              <UserPlus className="w-4 h-4" aria-hidden="true" />
              {isAr ? 'إنشاء مستخدم' : 'Create User'}
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

        {/* Toasts */}
        {createToast && (
          <div className="mb-4 rounded-xl bg-green-50 border border-green-200 px-4 py-2.5 text-sm text-green-800">
            {createToast}
          </div>
        )}
        {activationToast && (
          <div className="mb-4 rounded-xl bg-blue-50 border border-blue-200 px-4 py-2.5 text-sm text-blue-800">
            {activationToast}
          </div>
        )}

        {/* Search */}
        <div className="mb-4">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={isAr ? 'بحث بالاسم أو البريد...' : 'Search by name or email...'}
            className="w-full max-w-sm rounded-lg border border-[var(--color-neutral-200)] px-3 py-2 text-sm placeholder:text-[var(--color-neutral-400)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            dir={isAr ? 'rtl' : 'ltr'}
          />
        </div>

        {/* Filter tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filter === tab.key
                  ? 'bg-[var(--color-primary)] text-white'
                  : 'bg-[var(--color-neutral-100)] text-[var(--color-neutral-600)] hover:bg-[var(--color-neutral-200)]'
              }`}
            >
              {isAr ? tab.labelAr : tab.labelEn} ({tab.count})
            </button>
          ))}
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
                  {isAr ? 'البريد' : 'Email'}
                </th>
                <th className="px-4 py-3 text-start font-medium text-[var(--color-neutral-500)]">
                  {isAr ? 'الدور' : 'Role'}
                </th>
                <th className="px-4 py-3 text-start font-medium text-[var(--color-neutral-500)]">
                  {isAr ? 'مستوى كن' : 'Kun Level'}
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
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-[var(--color-neutral-400)]">
                    {isAr ? 'لا توجد نتائج' : 'No users found'}
                  </td>
                </tr>
              ) : (
                filtered.map(u => (
                  <tr
                    key={u.id}
                    className="border-b border-[var(--color-neutral-100)] hover:bg-[var(--color-neutral-50)]"
                  >
                    {/* Name */}
                    <td className="px-4 py-3">
                      <div className="font-medium text-[var(--text-primary)]">{displayName(u)}</div>
                      {u.full_name_ar && u.full_name_en && (
                        <div className="text-xs text-[var(--color-neutral-400)]">
                          {isAr ? u.full_name_en : u.full_name_ar}
                        </div>
                      )}
                    </td>

                    {/* Email */}
                    <td className="px-4 py-3 text-[var(--color-neutral-600)] text-xs">{u.email}</td>

                    {/* Role */}
                    <td className="px-4 py-3">{roleBadge(u.role)}</td>

                    {/* Kun Level */}
                    <td className="px-4 py-3 text-[var(--color-neutral-600)]">
                      {u.kun_level
                        ? (isAr ? KUN_LEVEL_LABELS[u.kun_level]?.ar : KUN_LEVEL_LABELS[u.kun_level]?.en) ?? u.kun_level
                        : <span className="text-[var(--color-neutral-300)]">—</span>}
                    </td>

                    {/* Status — account lifecycle + provider visibility */}
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-0.5">
                        {statusBadge(u.status)}
                        {u.role === 'provider' && (
                          <>
                            {u.instructor_is_visible || u.provider_is_visible ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                                {isAr ? 'ظاهر' : 'Visible'}
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                                {isAr ? 'مخفي' : 'Hidden'}
                              </span>
                            )}
                            {u.is_bookable && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-600">
                                {isAr ? 'قابل للحجز' : 'Bookable'}
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          onClick={() => openEdit(u)}
                          className="px-2 py-1 rounded text-xs font-medium bg-[var(--color-neutral-100)] text-[var(--color-neutral-700)] hover:bg-[var(--color-neutral-200)]"
                        >
                          {isAr ? 'تعديل' : 'Edit'}
                        </button>
                        <button
                          onClick={() => sendActivationLink(u)}
                          disabled={sendingActivation === u.id}
                          title={isAr ? 'إرسال رابط التفعيل' : 'Send activation link'}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-amber-50 text-amber-700 hover:bg-amber-100 disabled:opacity-50"
                        >
                          <Send className="w-3 h-3" aria-hidden="true" />
                          {sendingActivation === u.id
                            ? (isAr ? 'جارٍ الإرسال...' : 'Sending...')
                            : (isAr ? 'تفعيل' : 'Activate')}
                        </button>
                        {(u.role === 'provider' || u.role === 'mentor') && u.instructor_id && (
                          <a
                            href={`/${locale}/admin/instructors/${u.instructor_id}`}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                            title={isAr ? 'إدارة الملف العام' : 'Manage public profile'}
                          >
                            <ExternalLink className="w-3 h-3" aria-hidden="true" />
                            {isAr ? 'الملف العام' : 'Public profile'}
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Role Management Modal */}
      {editUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setEditUser(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal header */}
            <h2 className="text-lg font-bold text-[var(--text-primary)] mb-1">
              {isAr ? 'إدارة الدور' : 'Manage Role'}
            </h2>
            <p className="text-sm text-[var(--color-neutral-400)] mb-5">
              {displayName(editUser)} · {editUser.email}
            </p>

            <div className="space-y-4">
              {/* Current role display */}
              <div className="flex items-center gap-2 p-3 bg-[var(--color-neutral-50)] rounded-xl">
                <span className="text-xs text-[var(--color-neutral-500)]">
                  {isAr ? 'الدور الحالي:' : 'Current role:'}
                </span>
                {roleBadge(editUser.role)}
              </div>

              {/* Role selector */}
              <div>
                <label className="block text-sm font-medium text-[var(--color-neutral-600)] mb-1">
                  {isAr ? 'الدور الجديد' : 'New Role'}
                </label>
                <select
                  value={editForm.role}
                  onChange={e => setEditForm(f => ({ ...f, role: e.target.value }))}
                  className="w-full rounded-lg border border-[var(--color-neutral-200)] px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                >
                  {ASSIGNABLE_ROLES.map(r => (
                    <option key={r} value={r}>
                      {isAr ? ROLE_LABELS[r]?.ar : ROLE_LABELS[r]?.en}
                    </option>
                  ))}
                </select>
              </div>

              {/* Coach-specific fields — shown when role is/becomes provider */}
              {editForm.role === 'provider' && (
                <>
                  {/* Kun Level */}
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-neutral-600)] mb-1">
                      {isAr ? 'مستوى كن' : 'Kun Level'}
                    </label>
                    <select
                      value={editForm.kun_level}
                      onChange={e => setEditForm(f => ({ ...f, kun_level: e.target.value }))}
                      className="w-full rounded-lg border border-[var(--color-neutral-200)] px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                    >
                      <option value="">{isAr ? 'اختر المستوى' : 'Select level'}</option>
                      {KUN_LEVELS.map(l => (
                        <option key={l} value={l}>
                          {isAr ? KUN_LEVEL_LABELS[l]?.ar : KUN_LEVEL_LABELS[l]?.en}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* ICF Credential */}
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-neutral-600)] mb-1">
                      {isAr ? 'اعتماد ICF' : 'ICF Credential'}
                    </label>
                    <select
                      value={editForm.icf_credential}
                      onChange={e => setEditForm(f => ({ ...f, icf_credential: e.target.value }))}
                      className="w-full rounded-lg border border-[var(--color-neutral-200)] px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                    >
                      <option value="">{isAr ? 'اختر الاعتماد' : 'Select credential'}</option>
                      {ICF_CREDENTIALS.map(c => (
                        <option key={c} value={c}>
                          {isAr ? ICF_LABELS[c]?.ar : ICF_LABELS[c]?.en}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Is Visible toggle */}
                  <div className="flex items-center justify-between p-3 rounded-xl border border-[var(--color-neutral-200)]">
                    <div>
                      <p className="text-sm font-medium text-[var(--text-primary)]">
                        {isAr ? 'ظاهر على الموقع' : 'Visible on platform'}
                      </p>
                      <p className="text-xs text-[var(--color-neutral-400)]">
                        {isAr ? 'يظهر في صفحة الكوتشز' : 'Appears in coaches directory'}
                      </p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={editForm.is_visible}
                      onClick={() => setEditForm(f => ({ ...f, is_visible: !f.is_visible }))}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2 ${
                        editForm.is_visible ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-neutral-200)]'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          editForm.is_visible ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Is Bookable toggle */}
                  <div className="flex items-center justify-between p-3 rounded-xl border border-[var(--color-neutral-200)]">
                    <div>
                      <p className="text-sm font-medium text-[var(--text-primary)]">
                        {isAr ? 'قابل للحجز' : 'Bookable'}
                      </p>
                      <p className="text-xs text-[var(--color-neutral-400)]">
                        {isAr ? 'يمكن للعملاء حجز جلسات' : 'Clients can book sessions'}
                      </p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={editForm.is_bookable}
                      onClick={() => setEditForm(f => ({ ...f, is_bookable: !f.is_bookable }))}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2 ${
                        editForm.is_bookable ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-neutral-200)]'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          editForm.is_bookable ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {/* ── Coach Profile Section ── */}
                  <div className="pt-1">
                    <div className="flex items-center gap-3 mb-4">
                      <hr className="flex-1 border-[var(--color-neutral-200)]" />
                      <span className="text-xs font-semibold text-[var(--color-neutral-500)] uppercase tracking-wide whitespace-nowrap">
                        {isAr ? 'ملف الكوتش' : 'Coach Profile'}
                      </span>
                      <hr className="flex-1 border-[var(--color-neutral-200)]" />
                    </div>

                    {profileLoading ? (
                      <p className="text-xs text-center text-[var(--color-neutral-400)] py-3">
                        {isAr ? 'جاري تحميل الملف...' : 'Loading profile...'}
                      </p>
                    ) : (
                      <div className="space-y-4">
                        {/* Title AR */}
                        <div>
                          <label className="block text-sm font-medium text-[var(--color-neutral-600)] mb-1">
                            {isAr ? 'اللقب (عربي)' : 'Title AR'}
                          </label>
                          <input
                            type="text"
                            dir="rtl"
                            value={editForm.title_ar}
                            onChange={e => setEditForm(f => ({ ...f, title_ar: e.target.value }))}
                            className="w-full rounded-lg border border-[var(--color-neutral-200)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                            placeholder="مثال: كوتش حياة معتمد"
                          />
                        </div>

                        {/* Title EN */}
                        <div>
                          <label className="block text-sm font-medium text-[var(--color-neutral-600)] mb-1">
                            {isAr ? 'اللقب (إنجليزي)' : 'Title EN'}
                          </label>
                          <input
                            type="text"
                            dir="ltr"
                            value={editForm.title_en}
                            onChange={e => setEditForm(f => ({ ...f, title_en: e.target.value }))}
                            className="w-full rounded-lg border border-[var(--color-neutral-200)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                            placeholder="e.g. Certified Life Coach"
                          />
                        </div>

                        {/* Bio AR */}
                        <div>
                          <label className="block text-sm font-medium text-[var(--color-neutral-600)] mb-1">
                            {isAr ? 'النبذة (عربي)' : 'Bio AR'}
                          </label>
                          <textarea
                            dir="rtl"
                            rows={3}
                            value={editForm.bio_ar}
                            onChange={e => setEditForm(f => ({ ...f, bio_ar: e.target.value }))}
                            className="w-full rounded-lg border border-[var(--color-neutral-200)] px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                            placeholder="نبذة تعريفية باللغة العربية"
                          />
                        </div>

                        {/* Bio EN */}
                        <div>
                          <label className="block text-sm font-medium text-[var(--color-neutral-600)] mb-1">
                            {isAr ? 'النبذة (إنجليزي)' : 'Bio EN'}
                          </label>
                          <textarea
                            dir="ltr"
                            rows={3}
                            value={editForm.bio_en}
                            onChange={e => setEditForm(f => ({ ...f, bio_en: e.target.value }))}
                            className="w-full rounded-lg border border-[var(--color-neutral-200)] px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                            placeholder="Short bio in English"
                          />
                        </div>

                        {/* Photo URL */}
                        <div>
                          <label className="block text-sm font-medium text-[var(--color-neutral-600)] mb-1">
                            {isAr ? 'رابط الصورة' : 'Photo URL'}
                          </label>
                          {editForm.photo_url && (
                            <div className="mb-2">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={editForm.photo_url}
                                alt="coach photo preview"
                                className="w-12 h-12 rounded-full object-cover border border-[var(--color-neutral-200)]"
                              />
                            </div>
                          )}
                          <input
                            type="url"
                            dir="ltr"
                            value={editForm.photo_url}
                            onChange={e => setEditForm(f => ({ ...f, photo_url: e.target.value }))}
                            className="w-full rounded-lg border border-[var(--color-neutral-200)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                            placeholder="https://..."
                          />
                        </div>

                        {/* Credentials */}
                        <div>
                          <label className="block text-sm font-medium text-[var(--color-neutral-600)] mb-1">
                            {isAr ? 'الشهادات والاعتمادات' : 'Credentials'}
                          </label>
                          <input
                            type="text"
                            dir="ltr"
                            value={editForm.credentials}
                            onChange={e => setEditForm(f => ({ ...f, credentials: e.target.value }))}
                            className="w-full rounded-lg border border-[var(--color-neutral-200)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                            placeholder="e.g. ICF PCC, NLP Practitioner"
                          />
                        </div>

                        {/* Specialties */}
                        <div>
                          <label className="block text-sm font-medium text-[var(--color-neutral-600)] mb-1">
                            {isAr ? 'التخصصات' : 'Specialties'}
                          </label>
                          <input
                            type="text"
                            dir={isAr ? 'rtl' : 'ltr'}
                            value={editForm.specialties}
                            onChange={e => setEditForm(f => ({ ...f, specialties: e.target.value }))}
                            className="w-full rounded-lg border border-[var(--color-neutral-200)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                            placeholder={isAr ? 'مفصولة بفاصلة، مثال: قيادة، علاقات' : 'Comma-separated, e.g. Leadership, Relationships'}
                          />
                          <p className="mt-1 text-xs text-[var(--color-neutral-400)]">
                            {isAr ? 'أدخل التخصصات مفصولة بفاصلة' : 'Enter specialties separated by commas'}
                          </p>
                        </div>

                        {/* Coaching Styles */}
                        <div>
                          <label className="block text-sm font-medium text-[var(--color-neutral-600)] mb-1">
                            {isAr ? 'أساليب الكوتشنج' : 'Coaching Styles'}
                          </label>
                          <input
                            type="text"
                            dir={isAr ? 'rtl' : 'ltr'}
                            value={editForm.coaching_styles}
                            onChange={e => setEditForm(f => ({ ...f, coaching_styles: e.target.value }))}
                            className="w-full rounded-lg border border-[var(--color-neutral-200)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                            placeholder={isAr ? 'مفصولة بفاصلة، مثال: جسدي، تحليلي' : 'Comma-separated, e.g. Somatic, Analytical'}
                          />
                          <p className="mt-1 text-xs text-[var(--color-neutral-400)]">
                            {isAr ? 'أدخل الأساليب مفصولة بفاصلة' : 'Enter coaching styles separated by commas'}
                          </p>
                        </div>

                        {/* Display Order */}
                        <div>
                          <label className="block text-sm font-medium text-[var(--color-neutral-600)] mb-1">
                            {isAr ? 'ترتيب العرض' : 'Display Order'}
                          </label>
                          <input
                            type="number"
                            min={0}
                            dir="ltr"
                            value={editForm.display_order}
                            onChange={e => setEditForm(f => ({ ...f, display_order: parseInt(e.target.value, 10) || 0 }))}
                            className="w-full rounded-lg border border-[var(--color-neutral-200)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Error */}
              {saveError && (
                <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{saveError}</p>
              )}
            </div>

            {/* Modal actions */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setEditUser(null)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-[var(--color-neutral-200)] text-sm font-medium text-[var(--color-neutral-600)] hover:bg-[var(--color-neutral-50)]"
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                onClick={saveEdit}
                disabled={saving}
                className="flex-1 px-4 py-2.5 rounded-xl bg-[var(--color-primary)] text-white text-sm font-medium hover:bg-[var(--color-primary-600)] disabled:opacity-50 transition-colors"
              >
                {saving
                  ? (isAr ? 'جاري الحفظ...' : 'Saving...')
                  : (isAr ? 'حفظ' : 'Save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────── Create User Modal ───────────────────── */}
      {showCreate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => { if (!creating) setShowCreate(false); }}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-[var(--text-primary)] mb-1">
              {isAr ? 'إنشاء مستخدم جديد' : 'Create New User'}
            </h2>
            <p className="text-sm text-[var(--color-neutral-400)] mb-5">
              {isAr
                ? 'سيُنشأ الحساب مباشرة ويُرسل رابط تفعيل إلى البريد'
                : 'The account is created immediately and an activation link is emailed'}
            </p>

            <div className="space-y-4">
              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-[var(--color-neutral-600)] mb-1">
                  {isAr ? 'البريد الإلكتروني' : 'Email'} <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  dir="ltr"
                  value={createForm.email}
                  onChange={e => setCreateForm(f => ({ ...f, email: e.target.value }))}
                  className="w-full rounded-lg border border-[var(--color-neutral-200)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                  placeholder="user@example.com"
                />
              </div>

              {/* Name AR */}
              <div>
                <label className="block text-sm font-medium text-[var(--color-neutral-600)] mb-1">
                  {isAr ? 'الاسم (عربي)' : 'Name (AR)'}
                </label>
                <input
                  type="text"
                  dir="rtl"
                  value={createForm.full_name_ar}
                  onChange={e => setCreateForm(f => ({ ...f, full_name_ar: e.target.value }))}
                  className="w-full rounded-lg border border-[var(--color-neutral-200)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                  placeholder="الاسم الكامل"
                />
              </div>

              {/* Name EN */}
              <div>
                <label className="block text-sm font-medium text-[var(--color-neutral-600)] mb-1">
                  {isAr ? 'الاسم (إنجليزي)' : 'Name (EN)'}
                </label>
                <input
                  type="text"
                  dir="ltr"
                  value={createForm.full_name_en}
                  onChange={e => setCreateForm(f => ({ ...f, full_name_en: e.target.value }))}
                  className="w-full rounded-lg border border-[var(--color-neutral-200)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                  placeholder="Full name"
                />
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-medium text-[var(--color-neutral-600)] mb-1">
                  {isAr ? 'الهاتف (اختياري)' : 'Phone (optional)'}
                </label>
                <input
                  type="tel"
                  dir="ltr"
                  value={createForm.phone}
                  onChange={e => setCreateForm(f => ({ ...f, phone: e.target.value }))}
                  className="w-full rounded-lg border border-[var(--color-neutral-200)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                  placeholder="+971…"
                />
              </div>

              {/* Role */}
              <div>
                <label className="block text-sm font-medium text-[var(--color-neutral-600)] mb-1">
                  {isAr ? 'الدور' : 'Role'} <span className="text-red-500">*</span>
                </label>
                <select
                  value={createForm.role}
                  onChange={e => setCreateForm(f => ({ ...f, role: e.target.value }))}
                  className="w-full rounded-lg border border-[var(--color-neutral-200)] px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                >
                  {ASSIGNABLE_ROLES.map(r => (
                    <option key={r} value={r}>
                      {isAr ? ROLE_LABELS[r]?.ar : ROLE_LABELS[r]?.en}
                    </option>
                  ))}
                </select>
              </div>

              {/* Preferred language */}
              <div>
                <label className="block text-sm font-medium text-[var(--color-neutral-600)] mb-1">
                  {isAr ? 'لغة الواجهة' : 'Interface Language'}
                </label>
                <select
                  value={createForm.preferred_language}
                  onChange={e => setCreateForm(f => ({ ...f, preferred_language: e.target.value as 'ar' | 'en' }))}
                  className="w-full rounded-lg border border-[var(--color-neutral-200)] px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                >
                  <option value="ar">العربية</option>
                  <option value="en">English</option>
                </select>
              </div>

              {/* Send activation toggle */}
              <div className="flex items-center justify-between p-3 rounded-xl border border-[var(--color-neutral-200)]">
                <div>
                  <p className="text-sm font-medium text-[var(--text-primary)]">
                    {isAr ? 'إرسال رابط تفعيل' : 'Send activation link'}
                  </p>
                  <p className="text-xs text-[var(--color-neutral-400)]">
                    {isAr
                      ? 'يتيح للمستخدم ضبط كلمة السر وتسجيل الدخول'
                      : 'Lets the user set their password and sign in'}
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={createForm.send_activation}
                  onClick={() => setCreateForm(f => ({ ...f, send_activation: !f.send_activation }))}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2 ${
                    createForm.send_activation ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-neutral-200)]'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      createForm.send_activation ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {createError && (
                <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{createError}</p>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => { if (!creating) { setShowCreate(false); resetCreateForm(); } }}
                disabled={creating}
                className="flex-1 px-4 py-2.5 rounded-xl border border-[var(--color-neutral-200)] text-sm font-medium text-[var(--color-neutral-600)] hover:bg-[var(--color-neutral-50)] disabled:opacity-50"
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                onClick={submitCreate}
                disabled={creating || !createForm.email.trim()}
                className="flex-1 px-4 py-2.5 rounded-xl bg-[var(--color-primary)] text-white text-sm font-medium hover:bg-[var(--color-primary-600)] disabled:opacity-50 transition-colors"
              >
                {creating
                  ? (isAr ? 'جارٍ الإنشاء...' : 'Creating...')
                  : (isAr ? 'إنشاء المستخدم' : 'Create User')}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
