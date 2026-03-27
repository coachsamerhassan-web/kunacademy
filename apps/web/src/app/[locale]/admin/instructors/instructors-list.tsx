'use client';

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@kunacademy/db';

interface Instructor {
  id: string;
  slug: string;
  title_ar: string;
  title_en: string;
  coach_level: string | null;
  is_visible: boolean;
  photo_url: string | null;
  profile_id: string | null;
}

export function InstructorsList({ locale }: { locale: string }) {
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [loading, setLoading] = useState(true);
  const isAr = locale === 'ar';

  useEffect(() => {
    const supabase = createBrowserClient();
    if (!supabase) return;
    supabase
      .from('instructors')
      .select('id, slug, title_ar, title_en, coach_level, is_visible, photo_url, profile_id')
      .order('title_en')
      .then(({ data }: { data: any }) => {
        setInstructors(data || []);
        setLoading(false);
      });
  }, []);

  async function toggleVisibility(id: string, currentState: boolean) {
    const supabase = createBrowserClient();
    if (!supabase) return;
    await supabase.from('instructors').update({ is_visible: !currentState }).eq('id', id);
    setInstructors(prev => prev.map(i => i.id === id ? { ...i, is_visible: !currentState } : i));
  }

  if (loading) {
    return <p className="text-center py-8 text-[var(--color-neutral-500)]">{isAr ? 'جاري التحميل...' : 'Loading...'}</p>;
  }

  if (instructors.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-[var(--color-neutral-500)]">{isAr ? 'لا يوجد كوتشز بعد' : 'No coaches yet'}</p>
        <a
          href={`/${locale}/admin/instructors/invite`}
          className="inline-block mt-4 text-[var(--color-primary)] font-medium hover:underline"
        >
          {isAr ? 'دعوة أول كوتش' : 'Invite your first coach'}
        </a>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--color-neutral-200)]">
            <th className="text-start py-3 px-2 font-medium text-[var(--color-neutral-600)]">{isAr ? 'الاسم' : 'Name'}</th>
            <th className="text-start py-3 px-2 font-medium text-[var(--color-neutral-600)]">{isAr ? 'المستوى' : 'Level'}</th>
            <th className="text-start py-3 px-2 font-medium text-[var(--color-neutral-600)]">{isAr ? 'الحالة' : 'Status'}</th>
            <th className="text-start py-3 px-2 font-medium text-[var(--color-neutral-600)]">{isAr ? 'إجراءات' : 'Actions'}</th>
          </tr>
        </thead>
        <tbody>
          {instructors.map((inst) => (
            <tr key={inst.id} className="border-b border-[var(--color-neutral-100)] hover:bg-[var(--color-neutral-50)]">
              <td className="py-3 px-2">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[var(--color-neutral-200)] flex items-center justify-center text-xs font-medium text-[var(--color-neutral-600)] overflow-hidden">
                    {inst.photo_url
                      ? <img src={inst.photo_url} alt="" className="w-full h-full object-cover" />
                      : (inst.title_en?.[0] || '?')}
                  </div>
                  <div>
                    <div className="font-medium">{isAr ? inst.title_ar : inst.title_en}</div>
                    <div className="text-xs text-[var(--color-neutral-500)]">{isAr ? inst.title_en : inst.title_ar}</div>
                  </div>
                </div>
              </td>
              <td className="py-3 px-2">
                <span className="inline-block rounded-full bg-[var(--color-neutral-100)] px-2 py-0.5 text-xs">
                  {inst.coach_level || '-'}
                </span>
              </td>
              <td className="py-3 px-2">
                <span className={`inline-block rounded-full px-2 py-0.5 text-xs ${inst.is_visible ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                  {inst.is_visible ? (isAr ? 'مرئي' : 'Active') : (isAr ? 'مخفي' : 'Hidden')}
                </span>
              </td>
              <td className="py-3 px-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleVisibility(inst.id, inst.is_visible)}
                    className="text-xs text-[var(--color-primary)] hover:underline min-h-[44px] px-2"
                  >
                    {inst.is_visible ? (isAr ? 'إخفاء' : 'Hide') : (isAr ? 'إظهار' : 'Show')}
                  </button>
                  <a
                    href={`/${locale}/admin/instructors/${inst.id}`}
                    className="text-xs text-[var(--color-neutral-600)] hover:underline min-h-[44px] px-2 flex items-center"
                  >
                    {isAr ? 'مراجعة' : 'Review'}
                  </a>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
