'use client';

import { useAuth } from '@kunacademy/auth';
import { createBrowserClient } from '@kunacademy/db';
import { Section } from '@kunacademy/ui/section';
import { Card } from '@kunacademy/ui/card';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight } from 'lucide-react';

interface CourseRow {
  id: string;
  title_ar: string;
  title_en: string;
  slug: string;
  is_published: boolean | null;
  total_lessons: number | null;
  total_video_minutes: number | null;
  type: string | null;
  format: string | null;
  price_aed: number | null;
  created_at: string | null;
}

interface LessonRow {
  id: string;
  course_id: string;
  section_id: string | null;
  title_ar: string;
  title_en: string;
  video_url: string | null;
  order: number;
  duration_minutes: number | null;
  is_preview: boolean | null;
}

interface SectionRow {
  id: string;
  course_id: string;
  title_ar: string;
  title_en: string;
  order: number;
}

type View = 'list' | 'detail' | 'lesson-edit';

export default function AdminCoursesPage() {
  const { locale } = useParams<{ locale: string }>();
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const isAr = locale === 'ar';

  const [view, setView] = useState<View>('list');
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<CourseRow | null>(null);
  const [sections, setSections] = useState<SectionRow[]>([]);
  const [lessons, setLessons] = useState<LessonRow[]>([]);
  const [enrollmentCounts, setEnrollmentCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Lesson edit form state
  const [editLesson, setEditLesson] = useState<Partial<LessonRow> & { section_id_new?: string }>({});
  const [editSection, setEditSection] = useState<Partial<SectionRow>>({});
  const [showSectionForm, setShowSectionForm] = useState(false);

  const supabase = createBrowserClient();

  useEffect(() => {
    if (authLoading) return;
    if (!user || profile?.role !== 'admin') { router.push('/' + locale + '/auth/login'); return; }
    loadCourses();
  }, [user, profile, authLoading]);

  async function loadCourses() {
    setLoading(true);
    const { data } = await supabase
      .from('courses')
      .select('id, title_ar, title_en, slug, is_published, total_lessons, total_video_minutes, type, format, price_aed, created_at')
      .order('created_at', { ascending: false });

    setCourses(data ?? []);

    // Get enrollment counts
    if (data?.length) {
      const counts: Record<string, number> = {};
      for (const c of data) {
        const { count } = await supabase
          .from('enrollments')
          .select('*', { count: 'exact', head: true })
          .eq('course_id', c.id);
        counts[c.id] = count ?? 0;
      }
      setEnrollmentCounts(counts);
    }

    setLoading(false);
  }

  async function loadCourseDetail(course: CourseRow) {
    setSelectedCourse(course);
    setView('detail');

    const [{ data: secData }, { data: lesData }] = await Promise.all([
      supabase.from('course_sections').select('*').eq('course_id', course.id).order('order'),
      supabase.from('lessons').select('*').eq('course_id', course.id).order('order'),
    ]);

    setSections(secData ?? []);
    setLessons(lesData ?? []);
  }

  async function saveLesson() {
    setSaving(true);
    const base = {
      title_ar: editLesson.title_ar ?? '',
      title_en: editLesson.title_en ?? '',
      video_url: editLesson.video_url || null,
      duration_minutes: editLesson.duration_minutes || null,
      is_preview: editLesson.is_preview ?? false,
      section_id: editLesson.section_id_new || editLesson.section_id || null,
    };

    if (editLesson.id) {
      await supabase.from('lessons').update(base).eq('id', editLesson.id);
    } else {
      await supabase.from('lessons').insert({
        ...base,
        course_id: selectedCourse!.id,
        order: lessons.length,
      });
    }

    // Refresh
    await loadCourseDetail(selectedCourse!);
    await updateCourseTotals(selectedCourse!.id);
    setView('detail');
    setSaving(false);
  }

  async function deleteLesson(id: string) {
    if (!confirm(isAr ? 'حذف هذا الدرس؟' : 'Delete this lesson?')) return;
    await supabase.from('lessons').delete().eq('id', id);
    await loadCourseDetail(selectedCourse!);
    await updateCourseTotals(selectedCourse!.id);
  }

  async function saveSection() {
    setSaving(true);
    const data = {
      title_ar: editSection.title_ar!,
      title_en: editSection.title_en!,
    };

    if (editSection.id) {
      await supabase.from('course_sections').update(data).eq('id', editSection.id);
    } else {
      await supabase.from('course_sections').insert({
        ...data,
        course_id: selectedCourse!.id,
        order: sections.length,
      });
    }

    await loadCourseDetail(selectedCourse!);
    setShowSectionForm(false);
    setEditSection({});
    setSaving(false);
  }

  async function togglePublish(course: CourseRow) {
    await supabase.from('courses').update({ is_published: !course.is_published }).eq('id', course.id);
    await loadCourses();
  }

  async function updateCourseTotals(courseId: string) {
    const { data: allLessons } = await supabase
      .from('lessons')
      .select('duration_minutes')
      .eq('course_id', courseId);

    if (allLessons) {
      await supabase.from('courses').update({
        total_lessons: allLessons.length,
        total_video_minutes: allLessons.reduce((sum: number, l: { duration_minutes: number | null }) => sum + (l.duration_minutes ?? 0), 0),
      }).eq('id', courseId);
    }
  }

  if (authLoading || loading) {
    return (
      <Section variant="white">
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-primary)] border-t-transparent" />
        </div>
      </Section>
    );
  }

  // ── Lesson Editor View ──
  if (view === 'lesson-edit') {
    return (
      <Section variant="white">
        <button onClick={() => setView('detail')} className="text-sm text-[var(--color-primary)] hover:underline mb-4">
          <ArrowLeft className="w-4 h-4 inline-block rtl:rotate-180" aria-hidden="true" /> {isAr ? 'العودة' : 'Back'}
        </button>
        <h1 className="text-xl font-bold mb-6">
          {editLesson.id ? (isAr ? 'تعديل الدرس' : 'Edit Lesson') : (isAr ? 'درس جديد' : 'New Lesson')}
        </h1>

        <div className="max-w-xl space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">{isAr ? 'العنوان (عربي)' : 'Title (Arabic)'}</label>
            <input
              type="text" dir="rtl"
              value={editLesson.title_ar ?? ''}
              onChange={(e) => setEditLesson({ ...editLesson, title_ar: e.target.value })}
              className="w-full rounded-lg border border-[var(--color-neutral-200)] px-3 py-2.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{isAr ? 'العنوان (إنجليزي)' : 'Title (English)'}</label>
            <input
              type="text"
              value={editLesson.title_en ?? ''}
              onChange={(e) => setEditLesson({ ...editLesson, title_en: e.target.value })}
              className="w-full rounded-lg border border-[var(--color-neutral-200)] px-3 py-2.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{isAr ? 'رابط الفيديو' : 'Video URL'}</label>
            <input
              type="url"
              value={editLesson.video_url ?? ''}
              onChange={(e) => setEditLesson({ ...editLesson, video_url: e.target.value })}
              className="w-full rounded-lg border border-[var(--color-neutral-200)] px-3 py-2.5 text-sm"
              placeholder="https://..."
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">{isAr ? 'المدة (دقيقة)' : 'Duration (min)'}</label>
              <input
                type="number"
                value={editLesson.duration_minutes ?? ''}
                onChange={(e) => setEditLesson({ ...editLesson, duration_minutes: parseInt(e.target.value) || null })}
                className="w-full rounded-lg border border-[var(--color-neutral-200)] px-3 py-2.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{isAr ? 'القسم' : 'Section'}</label>
              <select
                value={editLesson.section_id_new ?? editLesson.section_id ?? ''}
                onChange={(e) => setEditLesson({ ...editLesson, section_id_new: e.target.value || undefined })}
                className="w-full rounded-lg border border-[var(--color-neutral-200)] px-3 py-2.5 text-sm"
              >
                <option value="">{isAr ? 'بدون قسم' : 'No section'}</option>
                {sections.map((s) => (
                  <option key={s.id} value={s.id}>{isAr ? s.title_ar : s.title_en}</option>
                ))}
              </select>
            </div>
          </div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={editLesson.is_preview ?? false}
              onChange={(e) => setEditLesson({ ...editLesson, is_preview: e.target.checked })}
              className="rounded"
            />
            <span className="text-sm">{isAr ? 'معاينة مجانية (مرئي للجميع)' : 'Free preview (visible to all)'}</span>
          </label>

          <div className="flex gap-3 pt-4">
            <button
              onClick={saveLesson}
              disabled={saving || !editLesson.title_ar || !editLesson.title_en}
              className="rounded-lg bg-[var(--color-primary)] px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-50 min-h-[44px]"
            >
              {saving ? '...' : (isAr ? 'حفظ' : 'Save')}
            </button>
            <button
              onClick={() => setView('detail')}
              className="rounded-lg border border-[var(--color-neutral-200)] px-6 py-2.5 text-sm min-h-[44px]"
            >
              {isAr ? 'إلغاء' : 'Cancel'}
            </button>
          </div>
        </div>
      </Section>
    );
  }

  // ── Course Detail View ──
  if (view === 'detail' && selectedCourse) {
    return (
      <Section variant="white">
        <button onClick={() => { setView('list'); setSelectedCourse(null); }} className="text-sm text-[var(--color-primary)] hover:underline mb-4">
          <ArrowLeft className="w-4 h-4 inline-block rtl:rotate-180" aria-hidden="true" /> {isAr ? 'كل الدورات' : 'All Courses'}
        </button>

        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold">{isAr ? selectedCourse.title_ar : selectedCourse.title_en}</h1>
            <p className="text-sm text-[var(--color-neutral-500)] mt-1">
              {lessons.length} {isAr ? 'درس' : 'lessons'} · {enrollmentCounts[selectedCourse.id] ?? 0} {isAr ? 'مسجّل' : 'enrolled'}
            </p>
          </div>
          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
            selectedCourse.is_published ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
          }`}>
            {selectedCourse.is_published ? (isAr ? 'منشور' : 'Published') : (isAr ? 'مسودة' : 'Draft')}
          </span>
        </div>

        {/* Section management */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-[var(--color-neutral-500)] uppercase tracking-wider">
              {isAr ? 'الأقسام' : 'Sections'}
            </h2>
            <button
              onClick={() => { setEditSection({}); setShowSectionForm(true); }}
              className="text-xs text-[var(--color-primary)] hover:underline"
            >
              + {isAr ? 'قسم جديد' : 'New Section'}
            </button>
          </div>

          {showSectionForm && (
            <Card className="p-4 mb-3">
              <div className="flex gap-3 items-end">
                <div className="flex-1">
                  <input
                    type="text" dir="rtl" placeholder={isAr ? 'العنوان بالعربي' : 'Arabic title'}
                    value={editSection.title_ar ?? ''}
                    onChange={(e) => setEditSection({ ...editSection, title_ar: e.target.value })}
                    className="w-full rounded-lg border border-[var(--color-neutral-200)] px-3 py-2 text-sm"
                  />
                </div>
                <div className="flex-1">
                  <input
                    type="text" placeholder={isAr ? 'العنوان بالإنجليزي' : 'English title'}
                    value={editSection.title_en ?? ''}
                    onChange={(e) => setEditSection({ ...editSection, title_en: e.target.value })}
                    className="w-full rounded-lg border border-[var(--color-neutral-200)] px-3 py-2 text-sm"
                  />
                </div>
                <button onClick={saveSection} disabled={saving} className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm text-white min-h-[40px]">
                  {saving ? '...' : (isAr ? 'حفظ' : 'Save')}
                </button>
                <button onClick={() => setShowSectionForm(false)} className="text-sm text-[var(--color-neutral-500)]">
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
              </div>
            </Card>
          )}

          {sections.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {sections.map((s) => (
                <span key={s.id} className="px-3 py-1.5 rounded-lg bg-[var(--color-neutral-100)] text-xs font-medium">
                  {isAr ? s.title_ar : s.title_en}
                  <span className="text-[var(--color-neutral-400)] ltr:ml-1 rtl:mr-1">
                    ({lessons.filter((l) => l.section_id === s.id).length})
                  </span>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Lessons list */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-bold text-[var(--color-neutral-500)] uppercase tracking-wider">
            {isAr ? 'الدروس' : 'Lessons'}
          </h2>
          <button
            onClick={() => { setEditLesson({ course_id: selectedCourse.id }); setView('lesson-edit'); }}
            className="text-xs bg-[var(--color-primary)] text-white px-3 py-1.5 rounded-lg hover:opacity-90"
          >
            + {isAr ? 'درس جديد' : 'New Lesson'}
          </button>
        </div>

        <Card className="overflow-hidden">
          <div className="divide-y divide-[var(--color-neutral-100)]">
            {lessons.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-[var(--color-neutral-500)]">
                {isAr ? 'لا توجد دروس — أضف أول درس' : 'No lessons — add the first lesson'}
              </div>
            ) : (
              lessons.map((l, idx) => {
                const section = sections.find((s) => s.id === l.section_id);
                return (
                  <div key={l.id} className="flex items-center gap-3 px-5 py-3 hover:bg-[var(--color-neutral-50)]">
                    <span className="text-xs font-mono text-[var(--color-neutral-400)] w-6">{String(idx + 1).padStart(2, '0')}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{isAr ? l.title_ar : l.title_en}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {section && (
                          <span className="text-[10px] text-[var(--color-neutral-400)]">{isAr ? section.title_ar : section.title_en}</span>
                        )}
                        {l.duration_minutes && (
                          <span className="text-[10px] text-[var(--color-neutral-400)]">{l.duration_minutes}min</span>
                        )}
                        {l.is_preview && (
                          <span className="text-[10px] px-1 rounded bg-blue-100 text-blue-600">preview</span>
                        )}
                        {l.video_url && (
                          <span className="text-[10px] px-1 rounded bg-green-100 text-green-600">video</span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => { setEditLesson(l); setView('lesson-edit'); }}
                      className="text-xs text-[var(--color-primary)] hover:underline px-2 py-1 min-h-[44px] flex items-center"
                    >
                      {isAr ? 'تعديل' : 'Edit'}
                    </button>
                    <button
                      onClick={() => deleteLesson(l.id)}
                      className="text-xs text-red-500 hover:underline px-2 py-1 min-h-[44px] flex items-center"
                    >
                      {isAr ? 'حذف' : 'Delete'}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </Card>
      </Section>
    );
  }

  // ── Course List View ──
  return (
    <Section variant="white">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold">{isAr ? 'إدارة الدورات' : 'Course Management'}</h1>
          <p className="text-sm text-[var(--color-neutral-500)]">{courses.length} {isAr ? 'دورة' : 'courses'}</p>
        </div>
        <a href={'/' + locale + '/admin'} className="text-sm text-[var(--color-primary)] hover:underline">
          <ArrowLeft className="w-4 h-4 inline-block rtl:rotate-180" aria-hidden="true" /> {isAr ? 'لوحة الإدارة' : 'Dashboard'}
        </a>
      </div>

      <div className="space-y-3">
        {courses.map((c) => (
          <Card key={c.id} className="p-4">
            <div className="flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <button
                  onClick={() => loadCourseDetail(c)}
                  className="text-sm font-bold text-[var(--text-primary)] hover:text-[var(--color-primary)] transition-colors text-start"
                >
                  {isAr ? c.title_ar : c.title_en}
                </button>
                <div className="flex items-center gap-3 mt-1 text-xs text-[var(--color-neutral-500)]">
                  <span>{c.slug}</span>
                  <span>{c.total_lessons} {isAr ? 'درس' : 'lessons'}</span>
                  <span>{enrollmentCounts[c.id] ?? 0} {isAr ? 'مسجّل' : 'enrolled'}</span>
                  {(c.price_aed ?? 0) > 0 && <span>{((c.price_aed ?? 0) / 100).toLocaleString()} AED</span>}
                </div>
              </div>
              <button
                onClick={() => togglePublish(c)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors min-h-[36px] ${
                  c.is_published
                    ? 'bg-green-100 text-green-700 hover:bg-green-200'
                    : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                }`}
              >
                {c.is_published ? (isAr ? 'منشور' : 'Published') : (isAr ? 'مسودة' : 'Draft')}
              </button>
              <button
                onClick={() => loadCourseDetail(c)}
                className="text-sm text-[var(--color-primary)] hover:underline min-h-[44px] flex items-center"
              >
                {isAr ? 'إدارة' : 'Manage'} <ArrowRight className="w-4 h-4 inline-block rtl:rotate-180" aria-hidden="true" />
              </button>
            </div>
          </Card>
        ))}

        {courses.length === 0 && (
          <div className="text-center py-12 text-[var(--color-neutral-500)]">
            {isAr ? 'لا توجد دورات — أنشئ أول دورة من Supabase' : 'No courses — create your first course in Supabase'}
          </div>
        )}
      </div>
    </Section>
  );
}
