// @ts-nocheck
'use client';

import { useEffect, useState } from 'react';
import { Button } from '@kunacademy/ui/button';
import { createBrowserClient } from '@kunacademy/db';

interface InstructorData {
  id: string;
  title_ar: string;
  title_en: string;
  bio_ar: string | null;
  bio_en: string | null;
  coach_level: string | null;
  credentials: string | null;
  specialties: string[] | null;
  coaching_styles: string[] | null;
  photo_url: string | null;
  is_visible: boolean;
}

export function InstructorReview({ locale, instructorId }: { locale: string; instructorId: string }) {
  const [instructor, setInstructor] = useState<InstructorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const isAr = locale === 'ar';

  useEffect(() => {
    const supabase = createBrowserClient();
    if (!supabase) return;
    supabase
      .from('instructors')
      .select('*')
      .eq('id', instructorId)
      .single()
      .then(({ data }: { data: any }) => {
        setInstructor(data as unknown as InstructorData);
        setLoading(false);
      });
  }, [instructorId]);

  async function handleApprove() {
    if (!instructor) return;
    setSaving(true);
    const supabase = createBrowserClient();
    if (!supabase) return;
    await supabase.from('instructors').update({ is_visible: true }).eq('id', instructor.id);
    await supabase.from('providers').update({ is_visible: true }).eq('profile_id', instructor.id);
    setInstructor({ ...instructor, is_visible: true });
    setSaving(false);
  }

  async function handleHide() {
    if (!instructor) return;
    setSaving(true);
    const supabase = createBrowserClient();
    if (!supabase) return;
    await supabase.from('instructors').update({ is_visible: false }).eq('id', instructor.id);
    setInstructor({ ...instructor, is_visible: false });
    setSaving(false);
  }

  if (loading) return <div className="py-8 text-center text-[var(--color-neutral-500)]">{isAr ? 'جاري التحميل...' : 'Loading...'}</div>;
  if (!instructor) return <div className="py-8 text-center text-[var(--color-neutral-500)]">{isAr ? 'لم يتم العثور على الكوتش' : 'Coach not found'}</div>;

  return (
    <div className="mt-6 space-y-6">
      {/* Status badge */}
      <div className={`inline-block rounded-full px-3 py-1 text-sm font-medium ${
        instructor.is_visible ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
      }`}>
        {instructor.is_visible ? (isAr ? 'مفعّل' : 'Active') : (isAr ? 'قيد المراجعة' : 'Pending Review')}
      </div>

      {/* Photo + Name */}
      <div className="flex items-center gap-4">
        <div className="w-20 h-20 rounded-full bg-[var(--color-neutral-200)] overflow-hidden">
          {instructor.photo_url ? (
            <img src={instructor.photo_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-2xl text-[var(--color-neutral-400)]">
              {instructor.title_en?.[0] || '?'}
            </div>
          )}
        </div>
        <div>
          <h2 className="text-lg font-medium">{instructor.title_ar}</h2>
          <p className="text-[var(--color-neutral-600)]">{instructor.title_en}</p>
          <p className="text-sm text-[var(--color-neutral-500)]">{instructor.coach_level || '-'}</p>
        </div>
      </div>

      {/* Bio */}
      <div className="rounded-lg border border-[var(--color-neutral-200)] p-4">
        <h3 className="font-medium mb-2">{isAr ? 'النبذة (عربي)' : 'Bio (Arabic)'}</h3>
        <p className="text-sm text-[var(--color-neutral-600)]" dir="rtl">{instructor.bio_ar || (isAr ? 'لا يوجد' : 'Not provided')}</p>
      </div>
      <div className="rounded-lg border border-[var(--color-neutral-200)] p-4">
        <h3 className="font-medium mb-2">{isAr ? 'النبذة (إنجليزي)' : 'Bio (English)'}</h3>
        <p className="text-sm text-[var(--color-neutral-600)]" dir="ltr">{instructor.bio_en || 'Not provided'}</p>
      </div>

      {/* Credentials */}
      <div className="rounded-lg border border-[var(--color-neutral-200)] p-4">
        <h3 className="font-medium mb-2">{isAr ? 'المؤهلات' : 'Credentials'}</h3>
        <p className="text-sm text-[var(--color-neutral-600)]">{instructor.credentials || '-'}</p>
      </div>

      {/* Specialties */}
      <div className="rounded-lg border border-[var(--color-neutral-200)] p-4">
        <h3 className="font-medium mb-2">{isAr ? 'التخصصات' : 'Specialties'}</h3>
        <div className="flex flex-wrap gap-1">
          {(instructor.specialties || []).map(s => (
            <span key={s} className="rounded-full bg-[var(--color-neutral-100)] px-2 py-0.5 text-xs">{s}</span>
          ))}
          {(!instructor.specialties || instructor.specialties.length === 0) && <span className="text-sm text-[var(--color-neutral-500)]">-</span>}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-4 border-t border-[var(--color-neutral-200)]">
        {!instructor.is_visible ? (
          <Button variant="primary" size="lg" onClick={handleApprove} disabled={saving}>
            {saving ? (isAr ? 'جاري التفعيل...' : 'Approving...') : (isAr ? 'تفعيل الملف' : 'Approve & Activate')}
          </Button>
        ) : (
          <Button variant="secondary" size="lg" onClick={handleHide} disabled={saving}>
            {isAr ? 'إخفاء الملف' : 'Hide Profile'}
          </Button>
        )}
      </div>
    </div>
  );
}
