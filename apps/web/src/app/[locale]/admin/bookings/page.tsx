'use client';

import { useAuth } from '@kunacademy/auth';
import { useEffect, useState } from 'react';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

interface Booking {
  id: string;
  customer_id: string;
  provider_id: string;
  service_id: string;
  start_time: string;
  end_time: string;
  status: string;
  created_at: string;
  customer?: { full_name_ar: string | null; full_name_en: string | null; email: string };
  coach?: { profile: { full_name_ar: string | null; full_name_en: string | null } | null } | null;
  service?: { name_en: string; name_ar: string };
}

interface Coach {
  id: string;
  full_name: string;
  provider_id: string | null;
  name_ar: string | null;
  name_en: string | null;
}

interface Service {
  id: string;
  name_ar: string | null;
  name_en: string | null;
  duration_minutes: number;
}

const statusColors: Record<string, string> = {
  confirmed: 'bg-green-100 text-green-700',
  pending: 'bg-yellow-100 text-yellow-700',
  cancelled: 'bg-red-100 text-red-700',
  completed: 'bg-blue-100 text-blue-700',
  'no-show': 'bg-gray-100 text-gray-600',
};

const statusLabels: Record<string, { ar: string; en: string }> = {
  confirmed: { ar: 'مؤكد', en: 'Confirmed' },
  pending: { ar: 'في الانتظار', en: 'Pending' },
  cancelled: { ar: 'ملغي', en: 'Cancelled' },
  completed: { ar: 'مكتمل', en: 'Completed' },
  'no-show': { ar: 'لم يحضر', en: 'No-Show' },
};

export default function AdminBookingsPage() {
  const { locale } = useParams<{ locale: string }>();
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [updating, setUpdating] = useState<string | null>(null);
  const isAr = locale === 'ar';

  // Edit modal state
  const [editBooking, setEditBooking] = useState<Booking | null>(null);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [servicesList, setServicesList] = useState<Service[]>([]);
  const [editForm, setEditForm] = useState({ provider_id: '', service_id: '', start_time: '', end_time: '', status: '', notes: '' });
  const [saving, setSaving] = useState(false);

  async function fetchBookings() {
    const res = await fetch('/api/admin/bookings-list');
    const data = await res.json();
    setBookings((data.bookings as any) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    if (authLoading) return;
    if (!user || (profile?.role !== 'admin' && profile?.role !== 'super_admin')) { router.push('/' + locale + '/auth/login'); return; }
    fetchBookings();
  }, [user, profile, authLoading]);

  async function updateStatus(id: string, newStatus: string) {
    setUpdating(id);
    await fetch('/api/admin/bookings-list', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ booking_id: id, status: newStatus }),
    });
    setBookings(prev => prev.map(b => b.id === id ? { ...b, status: newStatus } : b));

    // Notify customer when booking is confirmed (non-blocking)
    if (newStatus === 'confirmed') {
      fetch('/api/notifications/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId: id }),
      }).catch(() => {});
    }

    // Calculate earnings when booking is completed (non-blocking)
    if (newStatus === 'completed') {
      fetch('/api/earnings/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ booking_id: id }),
      }).catch(() => {});
    }

    setUpdating(null);
  }

  async function openEditModal(booking: Booking) {
    setEditBooking(booking);
    setEditForm({
      provider_id: booking.provider_id || '',
      service_id: booking.service_id || '',
      start_time: booking.start_time ? new Date(booking.start_time).toISOString().slice(0, 16) : '',
      end_time: booking.end_time ? new Date(booking.end_time).toISOString().slice(0, 16) : '',
      status: booking.status || '',
      notes: '',
    });
    const [coachRes, svcRes] = await Promise.all([
      fetch('/api/admin/coaches-list').then(r => r.json()),
      fetch('/api/admin/services-list').then(r => r.json()),
    ]);
    setCoaches(coachRes.coaches || []);
    setServicesList(svcRes.services || []);
  }

  async function saveEdit() {
    if (!editBooking) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/bookings-list', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          booking_id: editBooking.id,
          provider_id: editForm.provider_id || undefined,
          service_id: editForm.service_id || undefined,
          start_time: editForm.start_time ? new Date(editForm.start_time).toISOString() : undefined,
          end_time: editForm.end_time ? new Date(editForm.end_time).toISOString() : undefined,
          status: editForm.status || undefined,
          notes: editForm.notes || undefined,
        }),
      });
      if (res.ok) {
        setEditBooking(null);
        await fetchBookings();
      }
    } finally {
      setSaving(false);
    }
  }

  const filtered = filter === 'all' ? bookings : bookings.filter(b => b.status === filter);

  if (authLoading || loading) return <Section><p className="text-center py-12">Loading...</p></Section>;

  return (
    <main>
      <Section variant="white">
        <div className="flex items-center justify-between mb-6">
          <div>
            <Heading level={1}>{isAr ? 'الحجوزات' : 'Bookings'}</Heading>
            <p className="mt-1 text-sm text-[var(--color-neutral-500)]">{bookings.length} {isAr ? 'حجز' : 'total bookings'}</p>
          </div>
          <a href={'/' + locale + '/admin'} className="text-[var(--color-primary)] text-sm hover:underline flex items-center gap-1">
            <ArrowLeft className="w-4 h-4 rtl:rotate-180" aria-hidden="true" />
            {isAr ? 'لوحة الإدارة' : 'Dashboard'}
          </a>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-6">
          {['all', 'pending', 'confirmed', 'completed', 'cancelled', 'no-show'].map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filter === s
                  ? 'bg-[var(--color-primary)] text-white'
                  : 'bg-[var(--color-neutral-100)] text-[var(--color-neutral-600)] hover:bg-[var(--color-neutral-200)]'
              }`}
            >
              {s === 'all' ? (isAr ? 'الكل' : 'All') : (isAr ? statusLabels[s]?.ar : statusLabels[s]?.en) || s}
              {s !== 'all' && ` (${bookings.filter(b => b.status === s).length})`}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-xl border border-[var(--color-neutral-200)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--color-neutral-50)] border-b border-[var(--color-neutral-200)]">
                <th className="px-4 py-3 text-start font-medium text-[var(--color-neutral-500)]">{isAr ? 'العميل' : 'Client'}</th>
                <th className="px-4 py-3 text-start font-medium text-[var(--color-neutral-500)]">{isAr ? 'الكوتش' : 'Coach'}</th>
                <th className="px-4 py-3 text-start font-medium text-[var(--color-neutral-500)]">{isAr ? 'الخدمة' : 'Service'}</th>
                <th className="px-4 py-3 text-start font-medium text-[var(--color-neutral-500)]">{isAr ? 'التاريخ' : 'Date'}</th>
                <th className="px-4 py-3 text-start font-medium text-[var(--color-neutral-500)]">{isAr ? 'الوقت' : 'Time'}</th>
                <th className="px-4 py-3 text-start font-medium text-[var(--color-neutral-500)]">{isAr ? 'الحالة' : 'Status'}</th>
                <th className="px-4 py-3 text-start font-medium text-[var(--color-neutral-500)]">{isAr ? 'إجراءات' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-[var(--color-neutral-400)]">{isAr ? 'لا توجد حجوزات' : 'No bookings found'}</td></tr>
              ) : filtered.map(booking => {
                const customerName = (isAr ? booking.customer?.full_name_ar : booking.customer?.full_name_en) || booking.customer?.email || booking.customer_id?.slice(0, 8);
                const coachName = (isAr ? booking.coach?.profile?.full_name_ar : booking.coach?.profile?.full_name_en) || booking.provider_id?.slice(0, 8);
                const serviceName = isAr ? booking.service?.name_ar : booking.service?.name_en;
                const startDate = booking.start_time ? new Date(booking.start_time) : null;
                const dateStr = startDate
                  ? startDate.toLocaleDateString(isAr ? 'ar-SA' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                  : '-';
                const timeStr = booking.start_time && booking.end_time
                  ? `${new Date(booking.start_time).toLocaleTimeString(isAr ? 'ar-SA' : 'en-US', { hour: '2-digit', minute: '2-digit' })} – ${new Date(booking.end_time).toLocaleTimeString(isAr ? 'ar-SA' : 'en-US', { hour: '2-digit', minute: '2-digit' })}`
                  : '-';
                const statusColor = statusColors[booking.status] || 'bg-gray-100 text-gray-600';
                const statusLabel = isAr ? statusLabels[booking.status]?.ar : statusLabels[booking.status]?.en;

                return (
                  <tr key={booking.id} className="border-b border-[var(--color-neutral-100)] hover:bg-[var(--color-neutral-50)]">
                    <td className="px-4 py-3">
                      <div className="font-medium text-[var(--text-primary)]">{customerName}</div>
                      {booking.customer?.email && (
                        <div className="text-xs text-[var(--color-neutral-400)]">{booking.customer.email}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[var(--text-primary)]">{coachName}</td>
                    <td className="px-4 py-3 text-[var(--color-neutral-600)]">{serviceName || '-'}</td>
                    <td className="px-4 py-3 text-[var(--color-neutral-600)]">{dateStr}</td>
                    <td className="px-4 py-3 text-[var(--color-neutral-600)] font-mono text-xs">{timeStr}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColor}`}>
                        {statusLabel || booking.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        {booking.status === 'pending' && (
                          <button
                            onClick={() => updateStatus(booking.id, 'confirmed')}
                            disabled={updating === booking.id}
                            className="px-2 py-1 rounded text-xs font-medium bg-green-50 text-green-700 hover:bg-green-100 disabled:opacity-50"
                          >
                            {isAr ? 'تأكيد' : 'Confirm'}
                          </button>
                        )}
                        {(booking.status === 'pending' || booking.status === 'confirmed') && (
                          <button
                            onClick={() => updateStatus(booking.id, 'cancelled')}
                            disabled={updating === booking.id}
                            className="px-2 py-1 rounded text-xs font-medium bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-50"
                          >
                            {isAr ? 'إلغاء' : 'Cancel'}
                          </button>
                        )}
                        {booking.status === 'confirmed' && (
                          <button
                            onClick={() => updateStatus(booking.id, 'completed')}
                            disabled={updating === booking.id}
                            className="px-2 py-1 rounded text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                          >
                            {isAr ? 'اكتمل' : 'Complete'}
                          </button>
                        )}
                        <button
                          onClick={() => openEditModal(booking)}
                          className="px-2 py-1 rounded text-xs font-medium bg-[var(--color-neutral-100)] text-[var(--color-neutral-700)] hover:bg-[var(--color-neutral-200)]"
                        >
                          {isAr ? 'تعديل' : 'Edit'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Edit Modal */}
      {editBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setEditBooking(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-[var(--text-primary)] mb-4">
              {isAr ? 'تعديل الحجز' : 'Edit Booking'}
            </h2>

            <div className="space-y-4">
              {/* Coach */}
              <div>
                <label className="block text-sm font-medium text-[var(--color-neutral-600)] mb-1">{isAr ? 'الكوتش' : 'Coach'}</label>
                <select
                  value={editForm.provider_id}
                  onChange={e => setEditForm(f => ({ ...f, provider_id: e.target.value }))}
                  className="w-full rounded-lg border border-[var(--color-neutral-200)] px-3 py-2 text-sm"
                >
                  <option value="">{isAr ? 'اختر كوتش' : 'Select coach'}</option>
                  {coaches.filter(c => c.provider_id).map(c => (
                    <option key={c.provider_id!} value={c.provider_id!}>
                      {isAr ? c.name_ar || c.full_name : c.name_en || c.full_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Service */}
              <div>
                <label className="block text-sm font-medium text-[var(--color-neutral-600)] mb-1">{isAr ? 'الخدمة' : 'Service'}</label>
                <select
                  value={editForm.service_id}
                  onChange={e => setEditForm(f => ({ ...f, service_id: e.target.value }))}
                  className="w-full rounded-lg border border-[var(--color-neutral-200)] px-3 py-2 text-sm"
                >
                  <option value="">{isAr ? 'اختر خدمة' : 'Select service'}</option>
                  {servicesList.map(s => (
                    <option key={s.id} value={s.id}>
                      {isAr ? s.name_ar : s.name_en} ({s.duration_minutes} min)
                    </option>
                  ))}
                </select>
              </div>

              {/* Start Time */}
              <div>
                <label className="block text-sm font-medium text-[var(--color-neutral-600)] mb-1">{isAr ? 'وقت البدء' : 'Start Time'}</label>
                <input
                  type="datetime-local"
                  value={editForm.start_time}
                  onChange={e => setEditForm(f => ({ ...f, start_time: e.target.value }))}
                  className="w-full rounded-lg border border-[var(--color-neutral-200)] px-3 py-2 text-sm"
                />
              </div>

              {/* End Time */}
              <div>
                <label className="block text-sm font-medium text-[var(--color-neutral-600)] mb-1">{isAr ? 'وقت الانتهاء' : 'End Time'}</label>
                <input
                  type="datetime-local"
                  value={editForm.end_time}
                  onChange={e => setEditForm(f => ({ ...f, end_time: e.target.value }))}
                  className="w-full rounded-lg border border-[var(--color-neutral-200)] px-3 py-2 text-sm"
                />
              </div>

              {/* Status */}
              <div>
                <label className="block text-sm font-medium text-[var(--color-neutral-600)] mb-1">{isAr ? 'الحالة' : 'Status'}</label>
                <select
                  value={editForm.status}
                  onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}
                  className="w-full rounded-lg border border-[var(--color-neutral-200)] px-3 py-2 text-sm"
                >
                  {['pending', 'confirmed', 'completed', 'cancelled', 'no-show'].map(s => (
                    <option key={s} value={s}>{isAr ? statusLabels[s]?.ar : statusLabels[s]?.en}</option>
                  ))}
                </select>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-[var(--color-neutral-600)] mb-1">{isAr ? 'ملاحظات' : 'Notes'}</label>
                <textarea
                  value={editForm.notes}
                  onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                  rows={3}
                  className="w-full rounded-lg border border-[var(--color-neutral-200)] px-3 py-2 text-sm"
                  placeholder={isAr ? 'ملاحظات اختيارية...' : 'Optional notes...'}
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setEditBooking(null)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-[var(--color-neutral-200)] text-sm font-medium text-[var(--color-neutral-600)] hover:bg-[var(--color-neutral-50)]"
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                onClick={saveEdit}
                disabled={saving}
                className="flex-1 px-4 py-2.5 rounded-xl bg-[var(--color-primary)] text-white text-sm font-medium hover:bg-[var(--color-primary-600)] disabled:opacity-50"
              >
                {saving ? (isAr ? 'جاري الحفظ...' : 'Saving...') : (isAr ? 'حفظ' : 'Save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
