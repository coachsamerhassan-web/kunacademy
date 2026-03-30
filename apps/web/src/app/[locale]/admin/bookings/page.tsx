'use client';

import { useAuth } from '@kunacademy/auth';
import { useEffect, useState } from 'react';
import { createBrowserClient } from '@kunacademy/db';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

interface Booking {
  id: string;
  customer_id: string;
  provider_id: string;
  service_id: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  status: string;
  created_at: string;
  customer?: { full_name: string; email: string };
  provider?: { full_name: string };
  service?: { name_en: string; name_ar: string };
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

  const supabase = createBrowserClient();

  async function fetchBookings() {
    const { data } = await supabase
      .from('bookings')
      .select(`
        *,
        customer:profiles!bookings_customer_id_fkey(full_name, email),
        provider:profiles!bookings_provider_id_fkey(full_name),
        service:services(name_en, name_ar)
      `)
      .order('booking_date', { ascending: false })
      .limit(200);
    setBookings((data as any) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    if (authLoading) return;
    if (!user || profile?.role !== 'admin') { router.push('/' + locale + '/auth/login'); return; }
    fetchBookings();
  }, [user, profile, authLoading]);

  async function updateStatus(id: string, newStatus: string) {
    setUpdating(id);
    await supabase.from('bookings').update({ status: newStatus }).eq('id', id);
    setBookings(prev => prev.map(b => b.id === id ? { ...b, status: newStatus } : b));
    setUpdating(null);
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
                const customerName = booking.customer?.full_name || booking.customer_id?.slice(0, 8);
                const coachName = booking.provider?.full_name || booking.provider_id?.slice(0, 8);
                const serviceName = isAr ? booking.service?.name_ar : booking.service?.name_en;
                const dateStr = booking.booking_date
                  ? new Date(booking.booking_date + 'T00:00:00').toLocaleDateString(isAr ? 'ar-SA' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                  : '-';
                const timeStr = booking.start_time && booking.end_time
                  ? `${booking.start_time.slice(0, 5)} – ${booking.end_time.slice(0, 5)}`
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
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>
    </main>
  );
}
