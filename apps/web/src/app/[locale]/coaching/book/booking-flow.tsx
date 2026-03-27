'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@kunacademy/auth';
import { Button } from '@kunacademy/ui/button';
import { createBrowserClient } from '@kunacademy/db';

interface ServiceCategory {
  id: string;
  slug: string;
  name_ar: string;
  name_en: string;
  audience: string;
}

interface Service {
  id: string;
  name_ar: string;
  name_en: string;
  duration_minutes: number;
  price_aed: number;
  category_id: string;
}

interface Coach {
  id: string;
  title_ar: string;
  title_en: string;
  photo_url: string | null;
  coach_level: string | null;
  specialties: string[] | null;
  bio_ar: string | null;
  bio_en: string | null;
}

interface Slot {
  date: string;
  start_time: string;
  end_time: string;
}

type Step = 'category' | 'service' | 'coach' | 'time' | 'confirm';

export function BookingFlow({ locale }: { locale: string }) {
  const { user } = useAuth();
  const [step, setStep] = useState<Step>('category');
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [booking, setBooking] = useState(false);
  const [booked, setBooked] = useState(false);

  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedCoach, setSelectedCoach] = useState<Coach | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);

  const isAr = locale === 'ar';

  useEffect(() => {
    const supabase = createBrowserClient();
    if (!supabase) return;

    Promise.all([
      supabase.from('service_categories').select('*').order('display_order'),
      supabase.from('services').select('*').eq('is_active', true),
      supabase.from('instructors').select('id, title_ar, title_en, photo_url, coach_level, specialties, bio_ar, bio_en').eq('is_visible', true),
    ]).then(([catRes, svcRes, coachRes]) => {
      setCategories(catRes.data || []);
      setServices(svcRes.data || []);
      setCoaches(coachRes.data || []);
      setLoading(false);
    });
  }, []);

  async function loadSlots(coachId: string, duration: number) {
    setSlotsLoading(true);
    const start = new Date().toISOString().split('T')[0];
    const end = new Date(Date.now() + 28 * 86400000).toISOString().split('T')[0];
    try {
      const res = await fetch(`/api/availability?coach_id=${coachId}&start=${start}&end=${end}&duration=${duration}`);
      const data = await res.json();
      setSlots(data.slots || []);
    } finally {
      setSlotsLoading(false);
    }
  }

  function selectCategory(catId: string) {
    setSelectedCategory(catId);
    setStep('service');
  }

  function selectService(svc: Service) {
    setSelectedService(svc);
    setStep('coach');
  }

  function selectCoach(coach: Coach) {
    setSelectedCoach(coach);
    if (selectedService) {
      loadSlots(coach.id, selectedService.duration_minutes);
    }
    setStep('time');
  }

  function selectSlot(slot: Slot) {
    setSelectedSlot(slot);
    setStep('confirm');
  }

  async function handleBook() {
    if (!user || !selectedCoach || !selectedService || !selectedSlot) return;
    setBooking(true);

    const supabase = createBrowserClient();
    if (!supabase) return;

    // Find provider ID for the coach
    const { data: provider } = await supabase.from('providers').select('id').eq('profile_id', selectedCoach.id).single();

    await supabase.from('bookings').insert({
      customer_id: user.id,
      provider_id: provider?.id || selectedCoach.id,
      service_id: selectedService.id,
      booking_date: selectedSlot.date,
      start_time: selectedSlot.start_time,
      end_time: selectedSlot.end_time,
      status: selectedService.price_aed === 0 ? 'confirmed' : 'pending',
    });

    setBooking(false);
    setBooked(true);
  }

  if (loading) return <div className="py-8 text-center text-[var(--color-neutral-500)]">{isAr ? 'جاري التحميل...' : 'Loading...'}</div>;

  if (booked) {
    return (
      <div className="mt-8 rounded-lg bg-green-50 p-8 text-center">
        <p className="text-green-800 font-medium text-lg">
          {selectedService?.price_aed === 0
            ? (isAr ? 'تم تأكيد الحجز!' : 'Booking confirmed!')
            : (isAr ? 'تم إنشاء الحجز — في انتظار الدفع' : 'Booking created — awaiting payment')}
        </p>
        <p className="mt-2 text-green-700 text-sm">
          {selectedSlot?.date} — {selectedSlot?.start_time}
        </p>
        <a href={`/${locale}/portal/bookings`} className="inline-block mt-4 text-[var(--color-primary)] font-medium hover:underline">
          {isAr ? 'عرض حجوزاتي' : 'View my bookings'}
        </a>
      </div>
    );
  }

  // Step breadcrumbs
  const steps: { id: Step; labelAr: string; labelEn: string }[] = [
    { id: 'category', labelAr: 'الفئة', labelEn: 'Category' },
    { id: 'service', labelAr: 'الخدمة', labelEn: 'Service' },
    { id: 'coach', labelAr: 'الكوتش', labelEn: 'Coach' },
    { id: 'time', labelAr: 'الموعد', labelEn: 'Time' },
    { id: 'confirm', labelAr: 'تأكيد', labelEn: 'Confirm' },
  ];

  const currentIndex = steps.findIndex(s => s.id === step);

  return (
    <div className="mt-6">
      {/* Step indicator */}
      <div className="flex items-center justify-center gap-2 mb-8 text-sm">
        {steps.map((s, i) => (
          <span key={s.id} className="flex items-center gap-1">
            <span className={`${i <= currentIndex ? 'text-[var(--color-primary)] font-medium' : 'text-[var(--color-neutral-400)]'}`}>
              {isAr ? s.labelAr : s.labelEn}
            </span>
            {i < steps.length - 1 && <span className="text-[var(--color-neutral-300)] mx-1">/</span>}
          </span>
        ))}
      </div>

      {/* Category selection */}
      {step === 'category' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {categories.map(cat => (
            <button
              key={cat.id}
              type="button"
              onClick={() => selectCategory(cat.id)}
              className="text-start rounded-lg border border-[var(--color-neutral-200)] p-6 hover:border-[var(--color-primary)] hover:shadow-sm transition min-h-[44px]"
            >
              <div className="font-medium text-lg">{isAr ? cat.name_ar : cat.name_en}</div>
              <div className="text-sm text-[var(--color-neutral-500)] mt-1 capitalize">{cat.audience}</div>
            </button>
          ))}
          {categories.length === 0 && (
            <p className="col-span-2 text-center text-[var(--color-neutral-500)]">{isAr ? 'لا توجد فئات متاحة' : 'No categories available'}</p>
          )}
        </div>
      )}

      {/* Service selection */}
      {step === 'service' && (
        <div>
          <button type="button" onClick={() => setStep('category')} className="text-sm text-[var(--color-primary)] hover:underline mb-4 min-h-[44px]">
            {isAr ? '← تغيير الفئة' : '← Change category'}
          </button>
          <div className="space-y-3">
            {services.filter(s => s.category_id === selectedCategory).map(svc => (
              <button
                key={svc.id}
                type="button"
                onClick={() => selectService(svc)}
                className="w-full text-start flex items-center justify-between rounded-lg border border-[var(--color-neutral-200)] p-4 hover:border-[var(--color-primary)] transition min-h-[44px]"
              >
                <div>
                  <div className="font-medium">{isAr ? svc.name_ar : svc.name_en}</div>
                  <div className="text-sm text-[var(--color-neutral-500)]">{svc.duration_minutes} {isAr ? 'دقيقة' : 'min'}</div>
                </div>
                <div className="text-[var(--color-primary)] font-medium">
                  {svc.price_aed === 0 ? (isAr ? 'مجاني' : 'Free') : `${(svc.price_aed / 100).toFixed(0)} AED`}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Coach selection */}
      {step === 'coach' && (
        <div>
          <button type="button" onClick={() => setStep('service')} className="text-sm text-[var(--color-primary)] hover:underline mb-4 min-h-[44px]">
            {isAr ? '← تغيير الخدمة' : '← Change service'}
          </button>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {coaches.map(coach => (
              <button
                key={coach.id}
                type="button"
                onClick={() => selectCoach(coach)}
                className="text-start rounded-lg border border-[var(--color-neutral-200)] p-4 hover:border-[var(--color-primary)] transition min-h-[44px]"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-12 h-12 rounded-full bg-[var(--color-neutral-200)] overflow-hidden flex-shrink-0">
                    {coach.photo_url ? <img src={coach.photo_url} alt="" className="w-full h-full object-cover" /> : (
                      <div className="w-full h-full flex items-center justify-center text-[var(--color-neutral-400)]">{coach.title_en?.[0]}</div>
                    )}
                  </div>
                  <div>
                    <div className="font-medium">{isAr ? coach.title_ar : coach.title_en}</div>
                    {coach.coach_level && <span className="text-xs text-[var(--color-neutral-500)]">{coach.coach_level}</span>}
                  </div>
                </div>
                {coach.specialties && coach.specialties.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {coach.specialties.slice(0, 3).map(s => (
                      <span key={s} className="rounded-full bg-[var(--color-neutral-100)] px-2 py-0.5 text-xs">{s}</span>
                    ))}
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Time selection */}
      {step === 'time' && (
        <div>
          <button type="button" onClick={() => setStep('coach')} className="text-sm text-[var(--color-primary)] hover:underline mb-4 min-h-[44px]">
            {isAr ? '← تغيير الكوتش' : '← Change coach'}
          </button>
          {slotsLoading ? (
            <div className="py-8 text-center text-[var(--color-neutral-500)]">{isAr ? 'جاري تحميل المواعيد...' : 'Loading available times...'}</div>
          ) : slots.length === 0 ? (
            <div className="py-8 text-center text-[var(--color-neutral-500)]">{isAr ? 'لا توجد مواعيد متاحة في الأسابيع القادمة' : 'No available slots in the next 4 weeks'}</div>
          ) : (
            <div>
              {/* Group by date */}
              {Object.entries(
                slots.reduce<Record<string, Slot[]>>((acc, slot) => {
                  (acc[slot.date] ||= []).push(slot);
                  return acc;
                }, {})
              ).map(([date, daySlots]) => (
                <div key={date} className="mb-4">
                  <h3 className="font-medium text-sm mb-2">
                    {new Date(date).toLocaleDateString(isAr ? 'ar-SA' : 'en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {daySlots.map((slot, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => selectSlot(slot)}
                        className="rounded-lg border border-[var(--color-neutral-200)] px-3 py-2 text-sm hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition min-h-[44px]"
                      >
                        {slot.start_time}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Confirmation */}
      {step === 'confirm' && selectedService && selectedCoach && selectedSlot && (
        <div>
          <button type="button" onClick={() => setStep('time')} className="text-sm text-[var(--color-primary)] hover:underline mb-4 min-h-[44px]">
            {isAr ? '← تغيير الموعد' : '← Change time'}
          </button>
          <div className="rounded-lg border border-[var(--color-neutral-200)] p-6 space-y-4">
            <div className="flex justify-between">
              <span className="text-[var(--color-neutral-600)]">{isAr ? 'الخدمة' : 'Service'}</span>
              <span className="font-medium">{isAr ? selectedService.name_ar : selectedService.name_en}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--color-neutral-600)]">{isAr ? 'الكوتش' : 'Coach'}</span>
              <span className="font-medium">{isAr ? selectedCoach.title_ar : selectedCoach.title_en}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--color-neutral-600)]">{isAr ? 'التاريخ' : 'Date'}</span>
              <span className="font-medium">{new Date(selectedSlot.date).toLocaleDateString(isAr ? 'ar-SA' : 'en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--color-neutral-600)]">{isAr ? 'الوقت' : 'Time'}</span>
              <span className="font-medium">{selectedSlot.start_time} - {selectedSlot.end_time}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--color-neutral-600)]">{isAr ? 'المدة' : 'Duration'}</span>
              <span className="font-medium">{selectedService.duration_minutes} {isAr ? 'دقيقة' : 'min'}</span>
            </div>
            <div className="flex justify-between border-t border-[var(--color-neutral-200)] pt-4">
              <span className="text-[var(--color-neutral-600)] font-medium">{isAr ? 'المبلغ' : 'Amount'}</span>
              <span className="font-bold text-lg text-[var(--color-primary)]">
                {selectedService.price_aed === 0 ? (isAr ? 'مجاني' : 'Free') : `${(selectedService.price_aed / 100).toFixed(0)} AED`}
              </span>
            </div>
          </div>

          {!user ? (
            <div className="mt-4 text-center">
              <p className="text-[var(--color-neutral-600)] mb-2">{isAr ? 'يرجى تسجيل الدخول لإتمام الحجز' : 'Please sign in to complete booking'}</p>
              <a href={`/${locale}/auth/login?redirect=/${locale}/coaching/book`} className="text-[var(--color-primary)] font-medium hover:underline">
                {isAr ? 'تسجيل الدخول' : 'Sign In'}
              </a>
            </div>
          ) : (
            <Button variant="primary" size="lg" className="w-full mt-4" onClick={handleBook} disabled={booking}>
              {booking
                ? (isAr ? 'جاري الحجز...' : 'Booking...')
                : selectedService.price_aed === 0
                  ? (isAr ? 'تأكيد الحجز' : 'Confirm Booking')
                  : (isAr ? 'المتابعة للدفع' : 'Proceed to Payment')}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
