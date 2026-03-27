'use client';

import { useState, useEffect } from 'react';
import { Button } from '@kunacademy/ui/button';
import { createBrowserClient } from '@kunacademy/db';

interface Enrollment {
  id: string;
  status: string;
  enrollment_type: string;
  enrolled_at: string;
  completed_at: string | null;
  user: { full_name_ar: string | null; full_name_en: string | null; email: string } | null;
  course: { title_ar: string; title_en: string } | null;
}

export function EnrollmentManager({ locale }: { locale: string }) {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [students, setStudents] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [formData, setFormData] = useState({ user_id: '', course_id: '', enrollment_type: 'recorded' });
  const isAr = locale === 'ar';

  useEffect(() => {
    const supabase = createBrowserClient();
    if (!supabase) return;

    Promise.all([
      supabase.from('enrollments')
        .select('id, status, enrollment_type, enrolled_at, completed_at, user:profiles(full_name_ar, full_name_en, email), course:courses(title_ar, title_en)')
        .order('enrolled_at', { ascending: false })
        .limit(50),
      supabase.from('profiles').select('id, full_name_ar, full_name_en, email').order('email'),
      supabase.from('courses').select('id, title_ar, title_en').eq('is_published', true).order('title_en'),
    ]).then(([enrRes, studRes, courseRes]) => {
      setEnrollments((enrRes.data || []) as Enrollment[]);
      setStudents(studRes.data || []);
      setCourses(courseRes.data || []);
      setLoading(false);
    });
  }, []);

  async function handleEnroll() {
    if (!formData.user_id || !formData.course_id) return;
    const supabase = createBrowserClient();
    if (!supabase) return;

    const { data, error } = await supabase.from('enrollments').insert({
      user_id: formData.user_id,
      course_id: formData.course_id,
      enrollment_type: formData.enrollment_type,
      status: 'enrolled',
    }).select('id, status, enrollment_type, enrolled_at, completed_at, user:profiles(full_name_ar, full_name_en, email), course:courses(title_ar, title_en)').single();

    if (data) {
      setEnrollments(prev => [data as Enrollment, ...prev]);
      setShowForm(false);
      setFormData({ user_id: '', course_id: '', enrollment_type: 'recorded' });
    }
  }

  async function markComplete(enrollmentId: string) {
    const supabase = createBrowserClient();
    if (!supabase) return;
    await supabase.from('enrollments').update({
      status: 'completed',
      completed_at: new Date().toISOString(),
    }).eq('id', enrollmentId);
    setEnrollments(prev => prev.map(e => e.id === enrollmentId ? { ...e, status: 'completed', completed_at: new Date().toISOString() } : e));
  }

  if (loading) return <div className="py-8 text-center text-[var(--color-neutral-500)]">{isAr ? 'جاري التحميل...' : 'Loading...'}</div>;

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm text-[var(--color-neutral-500)]">{enrollments.length} {isAr ? 'تسجيل' : 'enrollments'}</p>
        <Button variant="primary" size="sm" onClick={() => setShowForm(!showForm)}>
          {showForm ? (isAr ? 'إلغاء' : 'Cancel') : (isAr ? '+ تسجيل يدوي' : '+ Manual Enroll')}
        </Button>
      </div>

      {showForm && (
        <div className="rounded-lg border border-[var(--color-neutral-200)] p-4 mb-6 space-y-3">
          <select
            value={formData.user_id}
            onChange={(e) => setFormData(prev => ({ ...prev, user_id: e.target.value }))}
            className="block w-full rounded-lg border border-[var(--color-neutral-300)] px-4 py-3 min-h-[44px] bg-white text-sm"
          >
            <option value="">{isAr ? 'اختر الطالب' : 'Select student'}</option>
            {students.map(s => (
              <option key={s.id} value={s.id}>{s.email} ({s.full_name_en || s.full_name_ar || '-'})</option>
            ))}
          </select>
          <select
            value={formData.course_id}
            onChange={(e) => setFormData(prev => ({ ...prev, course_id: e.target.value }))}
            className="block w-full rounded-lg border border-[var(--color-neutral-300)] px-4 py-3 min-h-[44px] bg-white text-sm"
          >
            <option value="">{isAr ? 'اختر البرنامج' : 'Select program'}</option>
            {courses.map(c => (
              <option key={c.id} value={c.id}>{isAr ? c.title_ar : c.title_en}</option>
            ))}
          </select>
          <select
            value={formData.enrollment_type}
            onChange={(e) => setFormData(prev => ({ ...prev, enrollment_type: e.target.value }))}
            className="block w-full rounded-lg border border-[var(--color-neutral-300)] px-4 py-3 min-h-[44px] bg-white text-sm"
          >
            <option value="recorded">{isAr ? 'مسجّل' : 'Recorded'}</option>
            <option value="live">{isAr ? 'مباشر' : 'Live'}</option>
            <option value="retreat">{isAr ? 'خلوة' : 'Retreat'}</option>
            <option value="coaching_package">{isAr ? 'حزمة كوتشنج' : 'Coaching Package'}</option>
          </select>
          <Button variant="primary" onClick={handleEnroll}>
            {isAr ? 'تسجيل' : 'Enroll'}
          </Button>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-neutral-200)]">
              <th className="text-start py-3 px-2 font-medium text-[var(--color-neutral-600)]">{isAr ? 'الطالب' : 'Student'}</th>
              <th className="text-start py-3 px-2 font-medium text-[var(--color-neutral-600)]">{isAr ? 'البرنامج' : 'Program'}</th>
              <th className="text-start py-3 px-2 font-medium text-[var(--color-neutral-600)]">{isAr ? 'النوع' : 'Type'}</th>
              <th className="text-start py-3 px-2 font-medium text-[var(--color-neutral-600)]">{isAr ? 'الحالة' : 'Status'}</th>
              <th className="text-start py-3 px-2 font-medium text-[var(--color-neutral-600)]">{isAr ? 'إجراءات' : 'Actions'}</th>
            </tr>
          </thead>
          <tbody>
            {enrollments.map((e) => (
              <tr key={e.id} className="border-b border-[var(--color-neutral-100)]">
                <td className="py-3 px-2">{e.user?.email || '-'}</td>
                <td className="py-3 px-2">{isAr ? e.course?.title_ar : e.course?.title_en}</td>
                <td className="py-3 px-2"><span className="text-xs">{e.enrollment_type}</span></td>
                <td className="py-3 px-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${
                    e.status === 'completed' ? 'bg-green-100 text-green-700'
                    : e.status === 'in_progress' ? 'bg-amber-100 text-amber-700'
                    : 'bg-blue-100 text-blue-700'
                  }`}>{e.status}</span>
                </td>
                <td className="py-3 px-2">
                  {e.status !== 'completed' && (
                    <button
                      onClick={() => markComplete(e.id)}
                      className="text-xs text-[var(--color-primary)] hover:underline min-h-[44px]"
                    >
                      {isAr ? 'إكمال' : 'Complete'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
