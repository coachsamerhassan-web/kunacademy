'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@kunacademy/db';
import { Button } from '@kunacademy/ui/button';
import { CheckCircle } from 'lucide-react';

type Step = 'service' | 'provider' | 'time' | 'confirm';

interface Service { id: string; name_ar: string; name_en: string; duration_minutes: number; price_aed: number }
interface Provider { id: string; bio_ar: string | null; bio_en: string | null; profile: { full_name_ar: string | null; full_name_en: string | null } | null }

export function BookingWizard({ locale }: { locale: string }) {
  const isAr = locale === 'ar';
  const [step, setStep] = useState<Step>('service');
  const [services, setServices] = useState<Service[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const supabase = createBrowserClient();

  useEffect(() => {
    supabase.from('services').select('*').eq('is_active', true).then(({ data }) => setServices((data ?? []) as Service[]));
    supabase.from('providers').select('id, bio_ar, bio_en, profile:profiles(full_name_ar, full_name_en)').eq('is_visible', true).then(({ data }) => setProviders((data as unknown as Provider[]) ?? []));
  }, []);

  async function handleConfirm() {
    setSubmitting(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { window.location.href = `/${locale}/auth/login`; return; }

    const startTime = new Date(`${selectedDate}T${selectedTime}`);
    const endTime = new Date(startTime.getTime() + (selectedService?.duration_minutes ?? 60) * 60 * 1000);

    const { data: inserted } = await supabase.from('bookings').insert({
      customer_id: user.id,
      service_id: selectedService?.id,
      provider_id: selectedProvider?.id,
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
    }).select('id').single();

    // Trigger booking confirmation notification (non-blocking)
    if (inserted?.id) {
      const { data: { session } } = await supabase.auth.getSession();
      fetch('/api/notifications/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ bookingId: inserted.id }),
      }).catch(() => {});
    }

    setDone(true);
    setSubmitting(false);
  }

  if (done) {
    return (
      <div className="text-center py-12">
        <CheckCircle className="w-10 h-10 mx-auto mb-4 text-green-600" aria-hidden="true" />
        <h2 className="text-xl font-bold">{isAr ? 'تم الحجز بنجاح!' : 'Booking Confirmed!'}</h2>
        <p className="mt-2 text-[var(--color-neutral-600)]">{isAr ? 'ستصلك رسالة تأكيد عبر البريد الإلكتروني' : 'You\'ll receive a confirmation email shortly'}</p>
        <Button variant="primary" className="mt-6" onClick={() => window.location.href = `/${locale}/dashboard/bookings`}>
          {isAr ? 'عرض حجوزاتي' : 'View My Bookings'}
        </Button>
      </div>
    );
  }

  const steps = [
    { key: 'service', label: isAr ? 'الخدمة' : 'Service' },
    { key: 'provider', label: isAr ? 'الكوتش' : 'Coach' },
    { key: 'time', label: isAr ? 'الموعد' : 'Time' },
    { key: 'confirm', label: isAr ? 'تأكيد' : 'Confirm' },
  ];

  return (
    <div className="max-w-2xl mx-auto">
      {/* Step indicator */}
      <div className="flex justify-between mb-8">
        {steps.map((s, i) => (
          <div key={s.key} className={`flex items-center gap-2 ${step === s.key ? 'text-[var(--color-primary)] font-bold' : 'text-[var(--color-neutral-400)]'}`}>
            <span className={`flex h-8 w-8 items-center justify-center rounded-full text-sm ${step === s.key ? 'bg-[var(--color-primary)] text-white' : 'bg-[var(--color-neutral-100)]'}`}>
              {i + 1}
            </span>
            <span className="hidden sm:inline text-sm">{s.label}</span>
          </div>
        ))}
      </div>

      {/* Step 1: Service */}
      {step === 'service' && (
        <div className="space-y-3">
          {services.length === 0 && <p className="text-center text-[var(--color-neutral-500)] py-8">{isAr ? 'لا توجد خدمات متاحة حاليًا' : 'No services available at the moment'}</p>}
          {services.map((s) => (
            <button
              key={s.id}
              onClick={() => { setSelectedService(s); setStep('provider'); }}
              className={`w-full text-start rounded-lg border p-4 hover:border-[var(--color-primary)] transition-colors ${selectedService?.id === s.id ? 'border-[var(--color-primary)] bg-[var(--color-primary-100)]' : 'border-[var(--color-neutral-200)]'}`}
            >
              <div className="font-medium">{isAr ? s.name_ar : s.name_en}</div>
              <div className="text-sm text-[var(--color-neutral-500)] mt-1">{s.duration_minutes} {isAr ? 'دقيقة' : 'min'} — {(s.price_aed / 100).toFixed(0)} AED</div>
            </button>
          ))}
        </div>
      )}

      {/* Step 2: Provider */}
      {step === 'provider' && (
        <div className="space-y-3">
          {providers.map((p) => (
            <button
              key={p.id}
              onClick={() => { setSelectedProvider(p); setStep('time'); }}
              className={`w-full text-start rounded-lg border p-4 hover:border-[var(--color-primary)] transition-colors ${selectedProvider?.id === p.id ? 'border-[var(--color-primary)] bg-[var(--color-primary-100)]' : 'border-[var(--color-neutral-200)]'}`}
            >
              <div className="font-medium">{isAr ? p.profile?.full_name_ar : p.profile?.full_name_en}</div>
              <div className="text-sm text-[var(--color-neutral-500)] mt-1 line-clamp-2">{isAr ? p.bio_ar : p.bio_en}</div>
            </button>
          ))}
          <Button variant="secondary" onClick={() => setStep('service')}>{isAr ? 'رجوع' : 'Back'}</Button>
        </div>
      )}

      {/* Step 3: Date & Time */}
      {step === 'time' && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">{isAr ? 'التاريخ' : 'Date'}</label>
            <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} min={new Date().toISOString().split('T')[0]} className="w-full rounded-lg border border-[var(--color-neutral-300)] px-4 py-3 min-h-[44px]" dir="ltr" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{isAr ? 'الوقت' : 'Time'}</label>
            <select value={selectedTime} onChange={(e) => setSelectedTime(e.target.value)} className="w-full rounded-lg border border-[var(--color-neutral-300)] px-4 py-3 min-h-[44px]" dir="ltr">
              <option value="">{isAr ? 'اختر الوقت' : 'Select time'}</option>
              {['09:00', '10:00', '11:00', '12:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00'].map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setStep('provider')}>{isAr ? 'رجوع' : 'Back'}</Button>
            <Button variant="primary" onClick={() => setStep('confirm')} disabled={!selectedDate || !selectedTime}>
              {isAr ? 'متابعة' : 'Continue'}
            </Button>
          </div>
        </div>
      )}

      {/* Step 4: Confirm */}
      {step === 'confirm' && (
        <div className="space-y-4">
          <div className="rounded-lg bg-[var(--color-neutral-50)] p-6 space-y-3">
            <div className="flex justify-between"><span className="text-[var(--color-neutral-500)]">{isAr ? 'الخدمة' : 'Service'}</span><span className="font-medium">{isAr ? selectedService?.name_ar : selectedService?.name_en}</span></div>
            <div className="flex justify-between"><span className="text-[var(--color-neutral-500)]">{isAr ? 'الكوتش' : 'Coach'}</span><span className="font-medium">{isAr ? selectedProvider?.profile?.full_name_ar : selectedProvider?.profile?.full_name_en}</span></div>
            <div className="flex justify-between"><span className="text-[var(--color-neutral-500)]">{isAr ? 'التاريخ' : 'Date'}</span><span className="font-medium" dir="ltr">{selectedDate}</span></div>
            <div className="flex justify-between"><span className="text-[var(--color-neutral-500)]">{isAr ? 'الوقت' : 'Time'}</span><span className="font-medium" dir="ltr">{selectedTime}</span></div>
            <hr className="border-[var(--color-neutral-200)]" />
            <div className="flex justify-between text-lg"><span className="font-bold">{isAr ? 'المجموع' : 'Total'}</span><span className="font-bold text-[var(--color-primary)]">{((selectedService?.price_aed ?? 0) / 100).toFixed(0)} AED</span></div>
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setStep('time')}>{isAr ? 'رجوع' : 'Back'}</Button>
            <Button variant="primary" onClick={handleConfirm} disabled={submitting} className="flex-1">
              {submitting ? (isAr ? 'جاري الحجز...' : 'Booking...') : (isAr ? 'تأكيد الحجز' : 'Confirm Booking')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
