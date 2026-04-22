'use client';

/**
 * Course Builder — placement picker view.
 *
 * Lets an admin (or the course's assigned instructor) arrange lessons from
 * the Lesson Library into this course. Each placement is a
 * (course_id, section_id?, lesson_id, sort_order) row in `lesson_placements`.
 *
 * LESSON-BLOCKS Session B — 2026-04-22
 */

import { useAuth } from '@kunacademy/auth';
import { Section } from '@kunacademy/ui/section';
import { Card } from '@kunacademy/ui/card';
import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────
interface CourseRow {
  id: string;
  title_ar: string;
  title_en: string;
  slug: string;
}

interface SectionRow {
  id: string;
  title_ar: string;
  title_en: string;
  order: number;
}

interface Placement {
  placement_id: string;
  course_id: string;
  section_id: string | null;
  section_title_ar: string | null;
  section_title_en: string | null;
  section_order: number | null;
  sort_order: number;
  override_title_ar: string | null;
  override_title_en: string | null;
  lesson_id: string;
  lesson_title_ar: string;
  lesson_title_en: string;
  lesson_scope: 'private' | 'team_library';
  lesson_created_by: string | null;
  lesson_duration_minutes: number | null;
  block_count: number;
}

interface LessonOption {
  id: string;
  title_ar: string;
  title_en: string;
  scope: 'private' | 'team_library';
  block_count: number;
}

// ─── Page ─────────────────────────────────────────────────────────────────
export default function CourseBuilderPage() {
  const { locale, id: courseId } = useParams<{ locale: string; id: string }>();
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const isAr = locale === 'ar';

  const [course, setCourse] = useState<CourseRow | null>(null);
  const [sections, setSections] = useState<SectionRow[]>([]);
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [loading, setLoading] = useState(true);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSectionId, setPickerSectionId] = useState<string | null>(null);
  const [pickerLessons, setPickerLessons] = useState<LessonOption[]>([]);
  const [pickerSearch, setPickerSearch] = useState('');

  // ─── Access gate + load ────────────────────────────────────────────────
  useEffect(() => {
    if (authLoading) return;
    const role: string = (profile?.role as string | undefined) ?? '';
    if (!user || !['admin', 'super_admin'].includes(role)) {
      router.push('/' + locale + '/auth/login');
      return;
    }
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, profile, authLoading, courseId]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [courseRes, placementRes] = await Promise.all([
      fetch('/api/admin/courses-list?view=detail&course_id=' + courseId),
      fetch('/api/admin/courses/' + courseId + '/placements'),
    ]);
    if (courseRes.ok) {
      const data = await courseRes.json();
      setCourse((data.courses?.[0] ?? data.course) ?? null);
      setSections(data.sections ?? []);
    }
    if (placementRes.ok) {
      const data = await placementRes.json();
      setPlacements(data.placements ?? []);
    }
    setLoading(false);
  }, [courseId]);

  // ─── Picker ────────────────────────────────────────────────────────────
  async function openPicker(sectionId: string | null) {
    setPickerSectionId(sectionId);
    setPickerOpen(true);
    const res = await fetch('/api/admin/lessons');
    if (res.ok) {
      const data = await res.json();
      setPickerLessons(data.lessons ?? []);
    }
  }

  async function addPlacement(lessonId: string) {
    const res = await fetch('/api/admin/courses/' + courseId + '/placements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lesson_id: lessonId, section_id: pickerSectionId }),
    });
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      alert((isAr ? 'خطأ: ' : 'Error: ') + (e.error ?? res.status));
      return;
    }
    setPickerOpen(false);
    await loadAll();
  }

  async function removePlacement(p: Placement) {
    if (!confirm(isAr ? 'إزالة هذا الدرس من الدورة؟' : 'Remove this lesson from the course?')) return;
    const res = await fetch('/api/admin/placements/' + p.placement_id, { method: 'DELETE' });
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      alert((isAr ? 'خطأ: ' : 'Error: ') + (e.error ?? res.status));
      return;
    }
    await loadAll();
  }

  async function movePlacement(p: Placement, direction: -1 | 1) {
    // Find siblings in same section, sorted by sort_order.
    const siblings = placements
      .filter((x) => x.section_id === p.section_id)
      .sort((a, b) => a.sort_order - b.sort_order);
    const idx = siblings.findIndex((x) => x.placement_id === p.placement_id);
    const otherIdx = idx + direction;
    if (otherIdx < 0 || otherIdx >= siblings.length) return;
    const other = siblings[otherIdx];
    await fetch('/api/admin/placements/' + p.placement_id, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sort_order: other.sort_order }),
    });
    await loadAll();
  }

  async function createLessonHere() {
    // Quick path: create a new private lesson and immediately place it.
    const title = prompt(isAr ? 'عنوان الدرس الجديد (عربي)' : 'New lesson title (Arabic)');
    if (!title) return;
    const titleEn = prompt(isAr ? 'Title (English)' : 'Title (English)') ?? title;
    const res = await fetch('/api/admin/lessons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title_ar: title, title_en: titleEn, scope: 'private' }),
    });
    if (!res.ok) {
      alert(isAr ? 'فشل إنشاء الدرس' : 'Lesson create failed');
      return;
    }
    const data = await res.json();
    const lessonId = data.lesson.id;
    await fetch('/api/admin/courses/' + courseId + '/placements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lesson_id: lessonId, section_id: pickerSectionId }),
    });
    await loadAll();
  }

  // ─── Rendering ─────────────────────────────────────────────────────────
  if (authLoading || loading) {
    return (
      <Section variant="white">
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-primary)] border-t-transparent" />
        </div>
      </Section>
    );
  }

  // Group placements by section.
  const placementsBySection: Record<string, Placement[]> = {};
  const noSectionKey = '__none';
  for (const p of placements) {
    const key = p.section_id ?? noSectionKey;
    placementsBySection[key] = placementsBySection[key] ?? [];
    placementsBySection[key].push(p);
  }
  for (const k of Object.keys(placementsBySection)) {
    placementsBySection[k].sort((a, b) => a.sort_order - b.sort_order);
  }

  const renderSection = (section: SectionRow | null) => {
    const key = section?.id ?? noSectionKey;
    const items = placementsBySection[key] ?? [];
    return (
      <div key={key} className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-bold text-[var(--color-neutral-500)] uppercase tracking-wider">
            {section ? (isAr ? section.title_ar : section.title_en) : (isAr ? 'بدون قسم' : 'No section')}
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => openPicker(section?.id ?? null)}
              className="text-xs text-[var(--color-primary)] hover:underline min-h-[36px] px-2"
            >
              + {isAr ? 'إضافة درس من المكتبة' : 'Add lesson from library'}
            </button>
            <button
              onClick={() => { setPickerSectionId(section?.id ?? null); createLessonHere(); }}
              className="text-xs text-[var(--color-neutral-600)] hover:underline min-h-[36px] px-2"
            >
              + {isAr ? 'درس جديد هنا' : 'New lesson here'}
            </button>
          </div>
        </div>
        <Card className="overflow-hidden">
          <div className="divide-y divide-[var(--color-neutral-100)]">
            {items.length === 0 ? (
              <div className="px-5 py-6 text-center text-xs text-[var(--color-neutral-500)]">
                {isAr ? 'لا توجد دروس في هذا القسم' : 'No lessons in this section'}
              </div>
            ) : (
              items.map((p, idx) => (
                <div key={p.placement_id} className="flex items-center gap-3 px-5 py-3 hover:bg-[var(--color-neutral-50)]">
                  <span className="text-xs font-mono text-[var(--color-neutral-400)] w-6">{String(idx + 1).padStart(2, '0')}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {isAr
                        ? (p.override_title_ar ?? p.lesson_title_ar)
                        : (p.override_title_en ?? p.lesson_title_en)}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                        p.lesson_scope === 'team_library' ? 'bg-blue-100 text-blue-700' : 'bg-[var(--color-neutral-100)] text-[var(--color-neutral-600)]'
                      }`}>
                        {p.lesson_scope === 'team_library' ? (isAr ? 'مكتبة' : 'Team') : (isAr ? 'خاص' : 'Private')}
                      </span>
                      <span className="text-[10px] text-[var(--color-neutral-400)]">
                        {p.block_count} {isAr ? 'كتلة' : 'blocks'}
                      </span>
                      {p.lesson_duration_minutes && (
                        <span className="text-[10px] text-[var(--color-neutral-400)]">{p.lesson_duration_minutes}min</span>
                      )}
                    </div>
                  </div>
                  <button onClick={() => movePlacement(p, -1)} className="text-xs px-2 py-1 min-h-[36px]" aria-label="move up" disabled={idx === 0}>↑</button>
                  <button onClick={() => movePlacement(p, 1)} className="text-xs px-2 py-1 min-h-[36px]" aria-label="move down" disabled={idx === items.length - 1}>↓</button>
                  <a
                    href={`/${locale}/admin/lessons?edit=${p.lesson_id}`}
                    className="text-xs text-[var(--color-primary)] hover:underline min-h-[36px] px-2 flex items-center"
                  >
                    {isAr ? 'تعديل' : 'Edit'}
                  </a>
                  <button
                    onClick={() => removePlacement(p)}
                    className="text-xs text-red-500 hover:underline min-h-[36px] px-2"
                  >
                    {isAr ? 'إزالة' : 'Remove'}
                  </button>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    );
  };

  const filteredPickerLessons = pickerSearch.trim()
    ? pickerLessons.filter((l) => {
        const s = pickerSearch.toLowerCase();
        return l.title_ar.toLowerCase().includes(s) || l.title_en.toLowerCase().includes(s);
      })
    : pickerLessons;

  return (
    <Section variant="white">
      <button
        onClick={() => router.push('/' + locale + '/admin/courses')}
        className="text-sm text-[var(--color-primary)] hover:underline mb-4"
      >
        <ArrowLeft className="w-4 h-4 inline-block rtl:rotate-180" aria-hidden="true" /> {isAr ? 'الدورات' : 'Courses'}
      </button>

      <div className="mb-6">
        <h1 className="text-xl font-bold">
          {isAr ? 'منشئ الدورة: ' : 'Course Builder: '}
          {course ? (isAr ? course.title_ar : course.title_en) : courseId}
        </h1>
        <p className="text-sm text-[var(--color-neutral-500)] mt-1">
          {placements.length} {isAr ? 'درس مُرتّب' : 'placements'} · {sections.length} {isAr ? 'قسم' : 'sections'}
        </p>
      </div>

      {sections.sort((a, b) => a.order - b.order).map((s) => renderSection(s))}
      {(placementsBySection[noSectionKey]?.length ?? 0) > 0 || sections.length === 0 ? renderSection(null) : null}

      {/* Picker modal */}
      {pickerOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
          onClick={() => setPickerOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="bg-white rounded-xl w-full max-w-xl max-h-[80vh] overflow-hidden shadow-xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-[var(--color-neutral-100)] flex items-center justify-between">
              <h2 className="text-base font-bold">{isAr ? 'اختر درسًا من المكتبة' : 'Pick a lesson from the library'}</h2>
              <button onClick={() => setPickerOpen(false)} className="text-sm text-[var(--color-neutral-400)] min-h-[36px] px-2">×</button>
            </div>
            <div className="px-5 py-3">
              <input
                type="text"
                placeholder={isAr ? 'بحث…' : 'Search…'}
                value={pickerSearch}
                onChange={(e) => setPickerSearch(e.target.value)}
                className="w-full rounded-lg border border-[var(--color-neutral-200)] px-3 py-2 text-sm"
              />
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-[var(--color-neutral-100)]">
              {filteredPickerLessons.length === 0 ? (
                <div className="px-5 py-8 text-center text-sm text-[var(--color-neutral-500)]">
                  {isAr ? 'لا توجد نتائج' : 'No results'}
                </div>
              ) : (
                filteredPickerLessons.map((l) => (
                  <button
                    key={l.id}
                    onClick={() => addPlacement(l.id)}
                    className="w-full text-start px-5 py-3 hover:bg-[var(--color-neutral-50)] flex items-center gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{isAr ? l.title_ar : l.title_en}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                          l.scope === 'team_library' ? 'bg-blue-100 text-blue-700' : 'bg-[var(--color-neutral-100)] text-[var(--color-neutral-600)]'
                        }`}>
                          {l.scope === 'team_library' ? (isAr ? 'مكتبة' : 'Team') : (isAr ? 'خاص' : 'Private')}
                        </span>
                        <span className="text-[10px] text-[var(--color-neutral-400)]">
                          {l.block_count} {isAr ? 'كتلة' : 'blocks'}
                        </span>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </Section>
  );
}
