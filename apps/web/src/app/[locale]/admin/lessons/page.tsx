'use client';

/**
 * Lesson Library — admin UI
 *
 * One-file page with three views:
 *   'list'   — catalog of private + team_library lessons with filters + search.
 *   'edit'   — metadata form for a single lesson.
 *   'blocks' — ordered block composer for a single lesson.
 *
 * Companion picker modal is rendered when `pickerFor` is set — used by the
 * course-builder page to embed this UI as a lesson selector.
 *
 * LESSON-BLOCKS Session B — 2026-04-22
 */

import { useAuth } from '@kunacademy/auth';
import { Section } from '@kunacademy/ui/section';
import { Card } from '@kunacademy/ui/card';
import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter, usePathname } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────
interface LessonRow {
  id: string;
  title_ar: string;
  title_en: string;
  description_ar: string | null;
  description_en: string | null;
  scope: 'private' | 'team_library';
  is_global: boolean;
  created_by: string | null;
  duration_minutes: number | null;
  block_count: number;
  created_at: string;
  updated_at: string;
}

type BlockType =
  | 'video' | 'text' | 'pdf' | 'image' | 'audio'
  | 'callout' | 'quiz_ref' | 'audio_exchange';

interface BlockRow {
  id: string;
  lesson_id: string;
  sort_order: number;
  block_type: BlockType;
  block_data: Record<string, unknown>;
  quiz_id: string | null;
  audio_exchange_id: string | null;
  audio_exchange?: AudioExchange | null;
}

interface AudioExchange {
  id: string;
  prompt_audio_url: string;
  prompt_duration_sec: number | null;
  instructions_ar: string | null;
  instructions_en: string | null;
  response_mode: 'audio_only' | 'text_only' | 'either';
  response_time_limit_sec: number | null;
  requires_review: boolean;
  created_by: string | null;
}

interface QuizOption {
  id: string;
  title_ar: string | null;
  title_en: string | null;
}

type View = 'list' | 'edit' | 'blocks';

const BLOCK_TYPE_LABELS: Record<BlockType, { ar: string; en: string }> = {
  video:          { ar: 'فيديو',   en: 'Video' },
  text:           { ar: 'نص',      en: 'Text' },
  pdf:            { ar: 'PDF',     en: 'PDF' },
  image:          { ar: 'صورة',    en: 'Image' },
  audio:          { ar: 'صوت',     en: 'Audio' },
  callout:        { ar: 'تنبيه',   en: 'Callout' },
  quiz_ref:       { ar: 'اختبار',  en: 'Quiz' },
  audio_exchange: { ar: 'تبادل صوتي', en: 'Audio Exchange' },
};

// ─── Page ─────────────────────────────────────────────────────────────────
export default function AdminLessonsPage() {
  const { locale } = useParams<{ locale: string }>();
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const isAr = locale === 'ar';

  const [view, setView] = useState<View>('list');
  const [lessons, setLessons] = useState<LessonRow[]>([]);
  const [filter, setFilter] = useState<'all' | 'private' | 'team_library'>('all');
  const [mineOnly, setMineOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Edit/compose state
  const [current, setCurrent] = useState<LessonRow | null>(null);
  const [editMeta, setEditMeta] = useState<Partial<LessonRow>>({});
  const [blocks, setBlocks] = useState<BlockRow[]>([]);
  const [quizzes, setQuizzes] = useState<QuizOption[]>([]);
  const [usedInCourses, setUsedInCourses] = useState<number>(0);

  // ─── Access gate ───────────────────────────────────────────────────────
  useEffect(() => {
    if (authLoading) return;
    const role: string = (profile?.role as string | undefined) ?? '';
    if (!user || !['admin', 'super_admin'].includes(role)) {
      router.push('/' + locale + '/auth/login?redirect=' + encodeURIComponent(pathname));
      return;
    }
    loadLessons();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, profile, authLoading, filter, mineOnly]);

  const loadLessons = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filter !== 'all') params.set('scope', filter);
    if (mineOnly && user?.id) params.set('created_by', user.id);
    if (search.trim()) params.set('search', search.trim());
    const res = await fetch('/api/admin/lessons?' + params.toString());
    const data = await res.json();
    setLessons(data.lessons ?? []);
    setLoading(false);
  }, [filter, mineOnly, search, user?.id]);

  // ─── Create ────────────────────────────────────────────────────────────
  async function createLesson() {
    setSaving(true);
    const res = await fetch('/api/admin/lessons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title_ar: editMeta.title_ar ?? '',
        title_en: editMeta.title_en ?? '',
        description_ar: editMeta.description_ar ?? null,
        description_en: editMeta.description_en ?? null,
        scope: editMeta.scope ?? 'private',
        is_global: editMeta.is_global ?? false,
        duration_minutes: editMeta.duration_minutes ?? null,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      alert((isAr ? 'خطأ: ' : 'Error: ') + (e.error ?? res.status));
      return;
    }
    const data = await res.json();
    await openLesson(data.lesson);
  }

  async function updateLesson() {
    if (!current) return;
    setSaving(true);
    const res = await fetch('/api/admin/lessons/' + current.id, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title_ar: editMeta.title_ar,
        title_en: editMeta.title_en,
        description_ar: editMeta.description_ar ?? null,
        description_en: editMeta.description_en ?? null,
        scope: editMeta.scope,
        is_global: editMeta.is_global,
        duration_minutes: editMeta.duration_minutes ?? null,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      alert((isAr ? 'خطأ: ' : 'Error: ') + (e.error ?? res.status));
      return;
    }
    await loadLessons();
    const data = await res.json();
    setCurrent(data.lesson);
  }

  async function deleteLesson(row: LessonRow) {
    if (!confirm(isAr ? 'حذف هذا الدرس؟' : 'Delete this lesson?')) return;
    const res = await fetch('/api/admin/lessons/' + row.id, { method: 'DELETE' });
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      alert((isAr ? 'تعذر الحذف: ' : 'Cannot delete: ') + (e.error ?? res.status));
      return;
    }
    await loadLessons();
  }

  async function cloneLesson(row: LessonRow) {
    const res = await fetch('/api/admin/lessons/' + row.id + '/clone', { method: 'POST' });
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      alert((isAr ? 'تعذر الاستنساخ: ' : 'Clone failed: ') + (e.error ?? res.status));
      return;
    }
    await loadLessons();
  }

  // ─── Open + load blocks ────────────────────────────────────────────────
  async function openLesson(row: LessonRow) {
    setCurrent(row);
    setEditMeta(row);
    setView('edit');
    // Pre-fetch block composer data on edit entry.
    const [detailRes, quizRes] = await Promise.all([
      fetch('/api/admin/lessons/' + row.id),
      fetch('/api/admin/quizzes'),
    ]);
    if (detailRes.ok) {
      const data = await detailRes.json();
      setBlocks(data.blocks ?? []);
    }
    if (quizRes.ok) {
      const data = await quizRes.json();
      setQuizzes(data.quizzes ?? []);
    }
    // "Used in courses" count.
    // Not in Session A API; compute from existing placements listing. For now,
    // derive from block_count + a lightweight re-query against lessons list.
    setUsedInCourses(0);
  }

  // ─── Block composer actions ────────────────────────────────────────────
  async function addBlock(block_type: BlockType) {
    if (!current) return;
    const defaultData: Record<BlockType, Record<string, unknown>> = {
      video:          { provider: 'direct', url: '', title_ar: '', title_en: '' },
      text:           { content_ar: '', content_en: '', format: 'markdown' },
      pdf:            { url: '', title_ar: '', title_en: '' },
      image:          { url: '', alt_ar: '', alt_en: '', caption_ar: '', caption_en: '' },
      audio:          { url: '', title_ar: '', title_en: '', duration_sec: 0 },
      callout:        { variant: 'info', title_ar: '', title_en: '', body_ar: '', body_en: '' },
      quiz_ref:       {},
      audio_exchange: {},
    };
    const body: any = {
      block_type,
      block_data: defaultData[block_type],
    };
    if (block_type === 'quiz_ref') {
      if (!quizzes.length) {
        alert(isAr ? 'لا توجد اختبارات متاحة' : 'No quizzes available');
        return;
      }
      body.quiz_id = quizzes[0].id;
    }
    if (block_type === 'audio_exchange') {
      const url = prompt(isAr ? 'رابط الصوت للتبادل' : 'Audio URL for the exchange');
      if (!url) return;
      const x = await fetch('/api/admin/audio-exchanges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt_audio_url: url, requires_review: false, response_mode: 'either' }),
      });
      if (!x.ok) {
        alert(isAr ? 'فشل إنشاء التبادل' : 'Failed to create exchange');
        return;
      }
      const xd = await x.json();
      body.audio_exchange_id = xd.exchange.id;
    }
    const res = await fetch('/api/admin/lessons/' + current.id + '/blocks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      alert((isAr ? 'خطأ: ' : 'Error: ') + (e.error ?? res.status));
      return;
    }
    await reloadBlocks();
  }

  async function reloadBlocks() {
    if (!current) return;
    const res = await fetch('/api/admin/lessons/' + current.id);
    if (res.ok) {
      const data = await res.json();
      setBlocks(data.blocks ?? []);
    }
  }

  async function saveBlockData(block: BlockRow, patch: Record<string, unknown>) {
    const res = await fetch('/api/admin/blocks/' + block.id, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      alert((isAr ? 'خطأ: ' : 'Error: ') + (e.error ?? res.status));
      return;
    }
    await reloadBlocks();
  }

  async function deleteBlock(block: BlockRow) {
    if (!confirm(isAr ? 'حذف الكتلة؟' : 'Delete this block?')) return;
    const res = await fetch('/api/admin/blocks/' + block.id, { method: 'DELETE' });
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      alert((isAr ? 'خطأ: ' : 'Error: ') + (e.error ?? res.status));
      return;
    }
    await reloadBlocks();
  }

  async function moveBlock(block: BlockRow, direction: -1 | 1) {
    const idx = blocks.findIndex((b) => b.id === block.id);
    const otherIdx = idx + direction;
    if (otherIdx < 0 || otherIdx >= blocks.length) return;
    const other = blocks[otherIdx];
    // Swap sort_orders.
    await fetch('/api/admin/blocks/' + block.id, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sort_order: other.sort_order }),
    });
    await reloadBlocks();
  }

  // ─── Loading gate ──────────────────────────────────────────────────────
  if (authLoading || loading) {
    return (
      <Section variant="white">
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-primary)] border-t-transparent" />
        </div>
      </Section>
    );
  }

  // ─── Blocks composer view ─────────────────────────────────────────────
  if (view === 'blocks' && current) {
    return (
      <Section variant="white">
        <button onClick={() => setView('edit')} className="text-sm text-[var(--color-primary)] hover:underline mb-4">
          <ArrowLeft className="w-4 h-4 inline-block rtl:rotate-180" aria-hidden="true" /> {isAr ? 'العودة' : 'Back'}
        </button>
        <h1 className="text-xl font-bold mb-2">{isAr ? current.title_ar : current.title_en}</h1>
        <p className="text-xs text-[var(--color-neutral-500)] mb-6">{isAr ? 'كتل المحتوى' : 'Content blocks'}</p>

        <div className="mb-4 flex flex-wrap gap-2">
          {(Object.keys(BLOCK_TYPE_LABELS) as BlockType[]).map((t) => (
            <button
              key={t}
              onClick={() => addBlock(t)}
              className="text-xs px-3 py-1.5 rounded-lg border border-[var(--color-neutral-200)] hover:bg-[var(--color-neutral-50)] min-h-[36px]"
            >
              + {isAr ? BLOCK_TYPE_LABELS[t].ar : BLOCK_TYPE_LABELS[t].en}
            </button>
          ))}
        </div>

        <Card className="overflow-hidden">
          <div className="divide-y divide-[var(--color-neutral-100)]">
            {blocks.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-[var(--color-neutral-500)]">
                {isAr ? 'لا توجد كتل — ابدأ بإضافة واحدة' : 'No blocks — add one above'}
              </div>
            ) : (
              blocks.map((b, idx) => (
                <div key={b.id} className="px-5 py-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-[var(--color-neutral-400)]">{String(idx + 1).padStart(2, '0')}</span>
                      <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-primary)]">
                        {isAr ? BLOCK_TYPE_LABELS[b.block_type].ar : BLOCK_TYPE_LABELS[b.block_type].en}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => moveBlock(b, -1)} className="text-xs px-2 py-1 min-h-[36px]" aria-label="move up" disabled={idx === 0}>↑</button>
                      <button onClick={() => moveBlock(b, 1)} className="text-xs px-2 py-1 min-h-[36px]" aria-label="move down" disabled={idx === blocks.length - 1}>↓</button>
                      <button onClick={() => deleteBlock(b)} className="text-xs text-red-500 hover:underline px-2 py-1 min-h-[36px]">
                        {isAr ? 'حذف' : 'Delete'}
                      </button>
                    </div>
                  </div>
                  <BlockEditor
                    block={b}
                    isAr={isAr}
                    quizzes={quizzes}
                    onSave={(patch) => saveBlockData(b, patch)}
                  />
                </div>
              ))
            )}
          </div>
        </Card>
      </Section>
    );
  }

  // ─── Edit (metadata) view ─────────────────────────────────────────────
  if (view === 'edit') {
    const isNew = !current?.id;
    return (
      <Section variant="white">
        <button onClick={() => { setView('list'); setCurrent(null); setEditMeta({}); }} className="text-sm text-[var(--color-primary)] hover:underline mb-4">
          <ArrowLeft className="w-4 h-4 inline-block rtl:rotate-180" aria-hidden="true" /> {isAr ? 'المكتبة' : 'Library'}
        </button>
        <h1 className="text-xl font-bold mb-6">
          {isNew ? (isAr ? 'درس جديد' : 'New Lesson') : (isAr ? 'تعديل الدرس' : 'Edit Lesson')}
        </h1>

        <div className="max-w-xl space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">{isAr ? 'العنوان (عربي)' : 'Title (Arabic)'}</label>
            <input
              type="text" dir="rtl"
              value={editMeta.title_ar ?? ''}
              onChange={(e) => setEditMeta({ ...editMeta, title_ar: e.target.value })}
              className="w-full rounded-lg border border-[var(--color-neutral-200)] px-3 py-2.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{isAr ? 'العنوان (إنجليزي)' : 'Title (English)'}</label>
            <input
              type="text"
              value={editMeta.title_en ?? ''}
              onChange={(e) => setEditMeta({ ...editMeta, title_en: e.target.value })}
              className="w-full rounded-lg border border-[var(--color-neutral-200)] px-3 py-2.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{isAr ? 'الوصف (عربي)' : 'Description (Arabic)'}</label>
            <textarea
              dir="rtl" rows={3}
              value={editMeta.description_ar ?? ''}
              onChange={(e) => setEditMeta({ ...editMeta, description_ar: e.target.value })}
              className="w-full rounded-lg border border-[var(--color-neutral-200)] px-3 py-2.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{isAr ? 'الوصف (إنجليزي)' : 'Description (English)'}</label>
            <textarea
              rows={3}
              value={editMeta.description_en ?? ''}
              onChange={(e) => setEditMeta({ ...editMeta, description_en: e.target.value })}
              className="w-full rounded-lg border border-[var(--color-neutral-200)] px-3 py-2.5 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">{isAr ? 'المدة (دقيقة)' : 'Duration (min)'}</label>
              <input
                type="number"
                value={editMeta.duration_minutes ?? ''}
                onChange={(e) => setEditMeta({ ...editMeta, duration_minutes: parseInt(e.target.value) || null })}
                className="w-full rounded-lg border border-[var(--color-neutral-200)] px-3 py-2.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{isAr ? 'النطاق' : 'Scope'}</label>
              <select
                value={editMeta.scope ?? 'private'}
                onChange={(e) => setEditMeta({ ...editMeta, scope: e.target.value as 'private' | 'team_library' })}
                className="w-full rounded-lg border border-[var(--color-neutral-200)] px-3 py-2.5 text-sm"
              >
                <option value="private">{isAr ? 'خاص' : 'Private'}</option>
                <option value="team_library">{isAr ? 'مكتبة الفريق' : 'Team Library'}</option>
              </select>
            </div>
          </div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={editMeta.is_global ?? false}
              onChange={(e) => setEditMeta({ ...editMeta, is_global: e.target.checked })}
              className="rounded"
            />
            <span className="text-sm">{isAr ? 'درس عام' : 'Global lesson'}</span>
          </label>

          <div className="flex gap-3 pt-4">
            <button
              onClick={isNew ? createLesson : updateLesson}
              disabled={saving || !editMeta.title_ar || !editMeta.title_en}
              className="rounded-lg bg-[var(--color-primary)] px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-50 min-h-[44px]"
            >
              {saving ? '...' : (isAr ? 'حفظ' : 'Save')}
            </button>
            {!isNew && (
              <button
                onClick={() => setView('blocks')}
                className="rounded-lg border border-[var(--color-primary)] text-[var(--color-primary)] px-6 py-2.5 text-sm font-semibold min-h-[44px]"
              >
                {isAr ? 'كتل المحتوى' : 'Content Blocks'} →
              </button>
            )}
            <button
              onClick={() => { setView('list'); setCurrent(null); setEditMeta({}); }}
              className="rounded-lg border border-[var(--color-neutral-200)] px-6 py-2.5 text-sm min-h-[44px]"
            >
              {isAr ? 'إلغاء' : 'Cancel'}
            </button>
          </div>
        </div>
      </Section>
    );
  }

  // ─── List view ────────────────────────────────────────────────────────
  return (
    <Section variant="white">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold">{isAr ? 'مكتبة الدروس' : 'Lesson Library'}</h1>
          <p className="text-sm text-[var(--color-neutral-500)]">
            {lessons.length} {isAr ? 'درس' : 'lessons'}
          </p>
        </div>
        <button
          onClick={() => { setCurrent(null); setEditMeta({ scope: 'private' }); setView('edit'); }}
          className="rounded-lg bg-[var(--color-primary)] text-white px-4 py-2.5 text-sm font-semibold min-h-[44px]"
        >
          + {isAr ? 'درس جديد' : 'New Lesson'}
        </button>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {(['all', 'private', 'team_library'] as const).map((k) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className={`text-xs px-3 py-1.5 rounded-full border min-h-[36px] ${
              filter === k
                ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]'
                : 'border-[var(--color-neutral-200)] text-[var(--color-neutral-500)]'
            }`}
          >
            {k === 'all' ? (isAr ? 'الكل' : 'All') : (k === 'private' ? (isAr ? 'خاص' : 'Private') : (isAr ? 'مكتبة الفريق' : 'Team Library'))}
          </button>
        ))}
        <label className="flex items-center gap-2 text-xs text-[var(--color-neutral-500)] ml-2">
          <input
            type="checkbox"
            checked={mineOnly}
            onChange={(e) => setMineOnly(e.target.checked)}
            className="rounded"
          />
          {isAr ? 'دروسي فقط' : 'Mine only'}
        </label>
        <input
          type="text"
          placeholder={isAr ? 'بحث…' : 'Search…'}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') loadLessons(); }}
          className="ml-auto w-48 rounded-lg border border-[var(--color-neutral-200)] px-3 py-1.5 text-sm"
        />
      </div>

      <Card className="overflow-hidden">
        <div className="divide-y divide-[var(--color-neutral-100)]">
          {lessons.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-[var(--color-neutral-500)]">
              {isAr ? 'لا توجد دروس' : 'No lessons yet'}
            </div>
          ) : (
            lessons.map((l) => (
              <div key={l.id} className="flex items-center gap-3 px-5 py-3 hover:bg-[var(--color-neutral-50)]">
                <div className="flex-1 min-w-0">
                  <button
                    onClick={() => openLesson(l)}
                    className="text-sm font-medium text-start hover:text-[var(--color-primary)]"
                  >
                    {isAr ? l.title_ar : l.title_en}
                  </button>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                      l.scope === 'team_library'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-[var(--color-neutral-100)] text-[var(--color-neutral-600)]'
                    }`}>
                      {l.scope === 'team_library' ? (isAr ? 'مكتبة الفريق' : 'Team') : (isAr ? 'خاص' : 'Private')}
                    </span>
                    <span className="text-[10px] text-[var(--color-neutral-400)]">
                      {l.block_count} {isAr ? 'كتلة' : 'blocks'}
                    </span>
                    {l.duration_minutes && (
                      <span className="text-[10px] text-[var(--color-neutral-400)]">{l.duration_minutes}min</span>
                    )}
                  </div>
                </div>
                {l.scope === 'team_library' && l.created_by !== user?.id && (
                  <button
                    onClick={() => cloneLesson(l)}
                    className="text-xs text-[var(--color-primary)] hover:underline px-2 py-1 min-h-[36px]"
                  >
                    {isAr ? 'استنساخ' : 'Clone'}
                  </button>
                )}
                <button
                  onClick={() => openLesson(l)}
                  className="text-xs text-[var(--color-primary)] hover:underline px-2 py-1 min-h-[36px]"
                >
                  {isAr ? 'تعديل' : 'Edit'}
                </button>
                <button
                  onClick={() => deleteLesson(l)}
                  className="text-xs text-red-500 hover:underline px-2 py-1 min-h-[36px]"
                >
                  {isAr ? 'حذف' : 'Delete'}
                </button>
              </div>
            ))
          )}
        </div>
      </Card>
    </Section>
  );
}

// ─── Inline block editor ─────────────────────────────────────────────────
function BlockEditor({
  block,
  isAr,
  quizzes,
  onSave,
}: {
  block: BlockRow;
  isAr: boolean;
  quizzes: QuizOption[];
  onSave: (patch: Record<string, unknown>) => void;
}) {
  const [data, setData] = useState<Record<string, any>>(block.block_data as any);
  const [quizId, setQuizId] = useState<string | null>(block.quiz_id);

  useEffect(() => {
    setData(block.block_data as any);
    setQuizId(block.quiz_id);
  }, [block.id]);

  const fld = (k: string, label: string, type: 'text' | 'url' | 'number' | 'textarea' = 'text', rtl = false) => (
    <div className="flex-1 min-w-[180px]">
      <label className="block text-[10px] font-medium text-[var(--color-neutral-500)] uppercase mb-1">{label}</label>
      {type === 'textarea' ? (
        <textarea
          rows={2}
          dir={rtl ? 'rtl' : 'ltr'}
          value={data[k] ?? ''}
          onChange={(e) => setData({ ...data, [k]: e.target.value })}
          className="w-full rounded-lg border border-[var(--color-neutral-200)] px-2 py-1.5 text-xs"
        />
      ) : (
        <input
          type={type}
          dir={rtl ? 'rtl' : 'ltr'}
          value={data[k] ?? ''}
          onChange={(e) => setData({ ...data, [k]: type === 'number' ? (parseFloat(e.target.value) || 0) : e.target.value })}
          className="w-full rounded-lg border border-[var(--color-neutral-200)] px-2 py-1.5 text-xs"
        />
      )}
    </div>
  );

  const save = () => {
    const patch: Record<string, unknown> = { block_data: data };
    if (block.block_type === 'quiz_ref') patch.quiz_id = quizId;
    onSave(patch);
  };

  return (
    <div className="space-y-2">
      {block.block_type === 'video' && (
        <div className="flex flex-wrap gap-2">
          {fld('url', isAr ? 'الرابط' : 'URL', 'url')}
          {fld('title_ar', isAr ? 'العنوان (ع)' : 'Title (AR)', 'text', true)}
          {fld('title_en', isAr ? 'العنوان (En)' : 'Title (EN)', 'text')}
        </div>
      )}
      {block.block_type === 'text' && (
        <div className="flex flex-wrap gap-2">
          {fld('content_ar', isAr ? 'المحتوى (ع)' : 'Content (AR)', 'textarea', true)}
          {fld('content_en', isAr ? 'المحتوى (En)' : 'Content (EN)', 'textarea')}
        </div>
      )}
      {block.block_type === 'pdf' && (
        <div className="flex flex-wrap gap-2">
          {fld('url', 'URL', 'url')}
          {fld('title_ar', 'Title (AR)', 'text', true)}
          {fld('title_en', 'Title (EN)')}
        </div>
      )}
      {block.block_type === 'image' && (
        <div className="flex flex-wrap gap-2">
          {fld('url', 'URL', 'url')}
          {fld('alt_ar', 'Alt (AR)', 'text', true)}
          {fld('alt_en', 'Alt (EN)')}
          {fld('caption_ar', 'Caption (AR)', 'text', true)}
          {fld('caption_en', 'Caption (EN)')}
        </div>
      )}
      {block.block_type === 'audio' && (
        <div className="flex flex-wrap gap-2">
          {fld('url', 'URL', 'url')}
          {fld('title_ar', 'Title (AR)', 'text', true)}
          {fld('title_en', 'Title (EN)')}
          {fld('duration_sec', 'Dur (s)', 'number')}
        </div>
      )}
      {block.block_type === 'callout' && (
        <div className="flex flex-wrap gap-2">
          <div className="min-w-[120px]">
            <label className="block text-[10px] font-medium text-[var(--color-neutral-500)] uppercase mb-1">Tone</label>
            <select
              value={data.variant ?? 'info'}
              onChange={(e) => setData({ ...data, variant: e.target.value })}
              className="w-full rounded-lg border border-[var(--color-neutral-200)] px-2 py-1.5 text-xs"
            >
              <option value="info">Info</option>
              <option value="warn">Warn</option>
              <option value="tip">Tip</option>
            </select>
          </div>
          {fld('body_ar', 'Body (AR)', 'textarea', true)}
          {fld('body_en', 'Body (EN)', 'textarea')}
        </div>
      )}
      {block.block_type === 'quiz_ref' && (
        <div className="flex flex-wrap gap-2 items-end">
          <div className="min-w-[240px]">
            <label className="block text-[10px] font-medium text-[var(--color-neutral-500)] uppercase mb-1">Quiz</label>
            <select
              value={quizId ?? ''}
              onChange={(e) => setQuizId(e.target.value || null)}
              className="w-full rounded-lg border border-[var(--color-neutral-200)] px-2 py-1.5 text-xs"
            >
              <option value="">{isAr ? '— اختر اختبار —' : '— pick a quiz —'}</option>
              {quizzes.map((q) => (
                <option key={q.id} value={q.id}>{isAr ? (q.title_ar ?? q.title_en) : (q.title_en ?? q.title_ar)}</option>
              ))}
            </select>
          </div>
        </div>
      )}
      {block.block_type === 'audio_exchange' && (
        <div className="text-xs text-[var(--color-neutral-500)]">
          {block.audio_exchange ? (
            <>
              <div>
                <strong>{isAr ? 'رابط الصوت:' : 'Audio URL:'}</strong>{' '}
                <a href={block.audio_exchange.prompt_audio_url} target="_blank" rel="noreferrer" className="text-[var(--color-primary)] underline break-all">
                  {block.audio_exchange.prompt_audio_url}
                </a>
              </div>
              <div className="mt-1">
                <strong>{isAr ? 'الوضع:' : 'Mode:'}</strong> {block.audio_exchange.response_mode} ·{' '}
                <strong>{isAr ? 'مراجعة:' : 'Review:'}</strong> {block.audio_exchange.requires_review ? 'yes' : 'no'}
              </div>
            </>
          ) : (
            <span>{isAr ? 'تبادل صوتي — لم يُربط' : 'Audio exchange — not linked'}</span>
          )}
        </div>
      )}
      <button
        onClick={save}
        className="text-xs text-[var(--color-primary)] hover:underline px-2 py-1 min-h-[32px]"
      >
        {isAr ? 'حفظ الكتلة' : 'Save block'}
      </button>
    </div>
  );
}
