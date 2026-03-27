'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@kunacademy/auth';
import { Button } from '@kunacademy/ui/button';
import { createBrowserClient } from '@kunacademy/db';

const DAYS = [
  { value: 0, labelAr: 'الأحد', labelEn: 'Sunday' },
  { value: 1, labelAr: 'الإثنين', labelEn: 'Monday' },
  { value: 2, labelAr: 'الثلاثاء', labelEn: 'Tuesday' },
  { value: 3, labelAr: 'الأربعاء', labelEn: 'Wednesday' },
  { value: 4, labelAr: 'الخميس', labelEn: 'Thursday' },
  { value: 5, labelAr: 'الجمعة', labelEn: 'Friday' },
  { value: 6, labelAr: 'السبت', labelEn: 'Saturday' },
];

interface ScheduleBlock {
  id?: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_active: boolean | null;
}

interface TimeOff {
  id?: string;
  date: string;
  reason: string;
}

export function ScheduleManager({ locale }: { locale: string }) {
  const { user, loading: authLoading } = useAuth();
  const [instructorId, setInstructorId] = useState<string | null>(null);
  const [schedule, setSchedule] = useState<ScheduleBlock[]>([]);
  const [timeOffs, setTimeOffs] = useState<TimeOff[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [newTimeOff, setNewTimeOff] = useState({ date: '', reason: '' });
  const isAr = locale === 'ar';

  useEffect(() => {
    if (!user) return;
    const supabase = createBrowserClient();
    if (!supabase) return;

    supabase.from('instructors').select('id').eq('profile_id', user.id).single()
      .then(({ data: inst }) => {
        if (!inst) { setLoading(false); return; }
        setInstructorId(inst.id);

        Promise.all([
          supabase.from('coach_schedules').select('*').eq('coach_id', inst.id).order('day_of_week'),
          supabase.from('coach_time_off').select('*').eq('coach_id', inst.id).order('date'),
        ]).then(([schedRes, offRes]) => {
          setSchedule(schedRes.data || []);
          setTimeOffs((offRes.data || []).map((t: any) => ({ id: t.id, date: t.date, reason: t.reason || '' })));
          setLoading(false);
        });
      });
  }, [user]);

  function addBlock() {
    setSchedule(prev => [...prev, {
      day_of_week: 0,
      start_time: '09:00',
      end_time: '17:00',
      is_active: true,
    }]);
    setSaved(false);
  }

  function updateBlock(index: number, field: string, value: any) {
    setSchedule(prev => prev.map((b, i) => i === index ? { ...b, [field]: value } : b));
    setSaved(false);
  }

  function removeBlock(index: number) {
    setSchedule(prev => prev.filter((_, i) => i !== index));
    setSaved(false);
  }

  async function handleSave() {
    if (!instructorId) return;
    setSaving(true);
    const supabase = createBrowserClient();
    if (!supabase) return;

    // Delete existing and re-insert
    await supabase.from('coach_schedules').delete().eq('coach_id', instructorId);

    if (schedule.length > 0) {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const rows = schedule.map(s => ({
        coach_id: instructorId,
        day_of_week: s.day_of_week,
        start_time: s.start_time,
        end_time: s.end_time,
        timezone,
        is_active: s.is_active,
      }));
      await supabase.from('coach_schedules').insert(rows);
    }

    setSaving(false);
    setSaved(true);
  }

  async function addTimeOff() {
    if (!instructorId || !newTimeOff.date) return;
    const supabase = createBrowserClient();
    if (!supabase) return;
    const { data } = await supabase.from('coach_time_off').insert({
      coach_id: instructorId,
      start_date: newTimeOff.date,
      end_date: newTimeOff.date,
      reason: newTimeOff.reason,
    }).select().single();
    if (data) {
      setTimeOffs(prev => [...prev, { id: data.id, date: data.start_date, reason: data.reason || '' }]);
      setNewTimeOff({ date: '', reason: '' });
    }
  }

  async function removeTimeOff(id: string) {
    const supabase = createBrowserClient();
    if (!supabase) return;
    await supabase.from('coach_time_off').delete().eq('id', id);
    setTimeOffs(prev => prev.filter(t => t.id !== id));
  }

  if (authLoading || loading) {
    return <div className="py-8 text-center text-[var(--color-neutral-500)]">{isAr ? 'جاري التحميل...' : 'Loading...'}</div>;
  }

  if (!instructorId) {
    return <div className="py-8 text-center text-[var(--color-neutral-500)]">{isAr ? 'لم يتم العثور على ملف كوتش' : 'No coach profile found'}</div>;
  }

  return (
    <div className="mt-6 space-y-8">
      {/* Weekly Schedule */}
      <div>
        <h2 className="text-lg font-medium mb-4">{isAr ? 'المواعيد الأسبوعية' : 'Weekly Availability'}</h2>
        <div className="space-y-3">
          {schedule.map((block, i) => (
            <div key={i} className="flex items-center gap-2 flex-wrap rounded-lg border border-[var(--color-neutral-200)] p-3">
              <select
                value={block.day_of_week}
                onChange={(e) => updateBlock(i, 'day_of_week', Number(e.target.value))}
                className="rounded-lg border border-[var(--color-neutral-300)] px-3 py-2 min-h-[44px] bg-white text-sm"
              >
                {DAYS.map(d => (
                  <option key={d.value} value={d.value}>{isAr ? d.labelAr : d.labelEn}</option>
                ))}
              </select>
              <input
                type="time"
                value={block.start_time}
                onChange={(e) => updateBlock(i, 'start_time', e.target.value)}
                className="rounded-lg border border-[var(--color-neutral-300)] px-3 py-2 min-h-[44px] text-sm"
              />
              <span className="text-[var(--color-neutral-400)]">—</span>
              <input
                type="time"
                value={block.end_time}
                onChange={(e) => updateBlock(i, 'end_time', e.target.value)}
                className="rounded-lg border border-[var(--color-neutral-300)] px-3 py-2 min-h-[44px] text-sm"
              />
              <label className="flex items-center gap-1 text-sm cursor-pointer min-h-[44px] px-2">
                <input
                  type="checkbox"
                  checked={block.is_active ?? true}
                  onChange={(e) => updateBlock(i, 'is_active', e.target.checked)}
                  className="rounded"
                />
                {isAr ? 'مفعّل' : 'Active'}
              </label>
              <button
                type="button"
                onClick={() => removeBlock(i)}
                className="text-red-500 hover:text-red-700 text-sm min-h-[44px] px-2"
              >
                {isAr ? 'حذف' : 'Remove'}
              </button>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-3 mt-4">
          <button
            type="button"
            onClick={addBlock}
            className="text-[var(--color-primary)] hover:underline text-sm font-medium min-h-[44px]"
          >
            {isAr ? '+ إضافة فترة' : '+ Add time block'}
          </button>
        </div>
        <div className="flex items-center gap-3 mt-4">
          <Button variant="primary" onClick={handleSave} disabled={saving}>
            {saving ? (isAr ? 'جاري الحفظ...' : 'Saving...') : (isAr ? 'حفظ المواعيد' : 'Save Schedule')}
          </Button>
          {saved && <span className="text-green-600 text-sm">{isAr ? 'تم الحفظ' : 'Saved'}</span>}
        </div>
      </div>

      {/* Time Off */}
      <div>
        <h2 className="text-lg font-medium mb-4">{isAr ? 'أيام الإجازة' : 'Days Off'}</h2>
        <div className="space-y-2 mb-4">
          {timeOffs.map((t) => (
            <div key={t.id} className="flex items-center gap-3 rounded-lg border border-[var(--color-neutral-200)] p-3">
              <span className="text-sm font-medium">{t.date}</span>
              <span className="text-sm text-[var(--color-neutral-500)] flex-1">{t.reason}</span>
              <button
                type="button"
                onClick={() => t.id && removeTimeOff(t.id)}
                className="text-red-500 hover:text-red-700 text-sm min-h-[44px] px-2"
              >
                {isAr ? 'حذف' : 'Remove'}
              </button>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="date"
            value={newTimeOff.date}
            onChange={(e) => setNewTimeOff(prev => ({ ...prev, date: e.target.value }))}
            className="rounded-lg border border-[var(--color-neutral-300)] px-3 py-2 min-h-[44px] text-sm"
          />
          <input
            type="text"
            value={newTimeOff.reason}
            onChange={(e) => setNewTimeOff(prev => ({ ...prev, reason: e.target.value }))}
            placeholder={isAr ? 'السبب (اختياري)' : 'Reason (optional)'}
            className="rounded-lg border border-[var(--color-neutral-300)] px-3 py-2 min-h-[44px] text-sm flex-1"
          />
          <Button variant="secondary" size="sm" onClick={addTimeOff} disabled={!newTimeOff.date}>
            {isAr ? 'إضافة' : 'Add'}
          </Button>
        </div>
      </div>
    </div>
  );
}
