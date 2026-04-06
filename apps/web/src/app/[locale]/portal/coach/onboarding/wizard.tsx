'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@kunacademy/auth';
import { Button } from '@kunacademy/ui/button';
import {
  updateCoachProfile,
  uploadAvatar,
  saveSchedule,
  submitForApproval,
} from './actions';

const STEPS = [
  { id: 'welcome', labelAr: 'ترحيب', labelEn: 'Welcome' },
  { id: 'photo', labelAr: 'الصورة', labelEn: 'Photo' },
  { id: 'bio', labelAr: 'النبذة', labelEn: 'Bio' },
  { id: 'credentials', labelAr: 'المؤهلات', labelEn: 'Credentials' },
  { id: 'specialties', labelAr: 'التخصصات', labelEn: 'Specialties' },
  { id: 'schedule', labelAr: 'المواعيد', labelEn: 'Schedule' },
  { id: 'review', labelAr: 'مراجعة', labelEn: 'Review' },
];

const SPECIALTIES = [
  { value: 'life-coaching', labelAr: 'كوتشنج الحياة', labelEn: 'Life Coaching' },
  { value: 'executive-coaching', labelAr: 'كوتشنج تنفيذي', labelEn: 'Executive Coaching' },
  { value: 'team-coaching', labelAr: 'كوتشنج الفرق', labelEn: 'Team Coaching' },
  { value: 'career-coaching', labelAr: 'كوتشنج مهني', labelEn: 'Career Coaching' },
  { value: 'wellness-coaching', labelAr: 'كوتشنج العافية', labelEn: 'Wellness Coaching' },
  { value: 'relationship-coaching', labelAr: 'كوتشنج العلاقات', labelEn: 'Relationship Coaching' },
  { value: 'leadership-development', labelAr: 'تطوير القيادة', labelEn: 'Leadership Development' },
  { value: 'somatic-thinking', labelAr: 'التفكير الحسّي', labelEn: 'Somatic Thinking' },
];

const COACHING_STYLES = [
  { value: 'directive', labelAr: 'توجيهي', labelEn: 'Directive' },
  { value: 'non-directive', labelAr: 'غير توجيهي', labelEn: 'Non-Directive' },
  { value: 'solution-focused', labelAr: 'مركّز على الحلول', labelEn: 'Solution-Focused' },
  { value: 'somatic', labelAr: 'حسّي', labelEn: 'Somatic' },
  { value: 'transformative', labelAr: 'تحويلي', labelEn: 'Transformative' },
  { value: 'systemic', labelAr: 'نظامي', labelEn: 'Systemic' },
];

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
  day_of_week: number;
  start_time: string;
  end_time: string;
  timezone: string;
}

interface CoachData {
  id: string;
  profile_id: string;
  title_ar: string;
  title_en: string;
  bio_ar: string;
  bio_en: string;
  credentials: string;
  coach_level: string;
  specialties: string[];
  coaching_styles: string[];
  photo_url: string;
}

export function OnboardingWizard({ locale }: { locale: string }) {
  const { user, loading: authLoading } = useAuth();
  const [step, setStep] = useState(0);
  const [coach, setCoach] = useState<CoachData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [schedule, setSchedule] = useState<ScheduleBlock[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const isAr = locale === 'ar';

  // Form state
  const [bioAr, setBioAr] = useState('');
  const [bioEn, setBioEn] = useState('');
  const [credentials, setCredentials] = useState('');
  const [coachLevel, setCoachLevel] = useState('');
  const [selectedSpecialties, setSelectedSpecialties] = useState<string[]>([]);
  const [selectedStyles, setSelectedStyles] = useState<string[]>([]);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    fetch('/api/coach/profile')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.instructor) {
          const inst = data.instructor;
          setCoach(inst as CoachData);
          setBioAr(inst.bio_ar || '');
          setBioEn(inst.bio_en || '');
          setCredentials(inst.credentials || '');
          setCoachLevel(inst.coach_level || '');
          setSelectedSpecialties(inst.specialties || []);
          setSelectedStyles(inst.coaching_styles || []);
          setAvatarPreview(inst.photo_url || null);
        }
        setLoading(false);
      });
  }, [user]);

  if (authLoading || loading) {
    return <div className="py-12 text-center text-[var(--color-neutral-500)]">{isAr ? 'جاري التحميل...' : 'Loading...'}</div>;
  }

  if (!coach) {
    return (
      <div className="py-12 text-center">
        <p className="text-[var(--color-neutral-600)]">
          {isAr ? 'لم يتم العثور على ملف كوتش. تواصل مع الإدارة.' : 'No coach profile found. Contact admin.'}
        </p>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="mt-8 rounded-lg bg-green-50 p-8 text-center">
        <p className="text-green-800 font-medium text-lg">
          {isAr ? 'تم إرسال ملفك للمراجعة!' : 'Your profile has been submitted for review!'}
        </p>
        <p className="mt-2 text-green-700">
          {isAr ? 'سيراجع الفريق ملفك ويفعّله قريبًا' : 'The team will review and activate your profile shortly'}
        </p>
        <a
          href={`/${locale}/portal/coach`}
          className="inline-block mt-4 text-[var(--color-primary)] font-medium hover:underline"
        >
          {isAr ? 'الذهاب إلى لوحة التحكم' : 'Go to Dashboard'}
        </a>
      </div>
    );
  }

  const currentStep = STEPS[step];
  const canGoBack = step > 0;
  const canGoForward = step < STEPS.length - 1;

  async function handleSaveAndNext() {
    setSaving(true);
    try {
      if (currentStep.id === 'bio') {
        await updateCoachProfile(coach!.id, { bio_ar: bioAr, bio_en: bioEn });
      } else if (currentStep.id === 'credentials') {
        await updateCoachProfile(coach!.id, { credentials, coach_level: coachLevel });
      } else if (currentStep.id === 'specialties') {
        await updateCoachProfile(coach!.id, { specialties: selectedSpecialties, coaching_styles: selectedStyles });
      } else if (currentStep.id === 'schedule') {
        await saveSchedule(coach!.id, schedule);
      }
      if (canGoForward) setStep(step + 1);
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit() {
    setSaving(true);
    try {
      await submitForApproval(coach!.id);
      setSubmitted(true);
    } finally {
      setSaving(false);
    }
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !coach) return;
    setAvatarPreview(URL.createObjectURL(file));
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('avatar', file);
      await uploadAvatar(coach.id, coach.profile_id, fd);
    } finally {
      setSaving(false);
    }
  }

  function toggleSpecialty(value: string) {
    setSelectedSpecialties(prev =>
      prev.includes(value) ? prev.filter(s => s !== value) : [...prev, value]
    );
  }

  function toggleStyle(value: string) {
    setSelectedStyles(prev =>
      prev.includes(value) ? prev.filter(s => s !== value) : [...prev, value]
    );
  }

  function addScheduleBlock() {
    setSchedule(prev => [...prev, {
      day_of_week: 0,
      start_time: '09:00',
      end_time: '17:00',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    }]);
  }

  function updateScheduleBlock(index: number, field: keyof ScheduleBlock, value: string | number) {
    setSchedule(prev => prev.map((block, i) =>
      i === index ? { ...block, [field]: value } : block
    ));
  }

  function removeScheduleBlock(index: number) {
    setSchedule(prev => prev.filter((_, i) => i !== index));
  }

  return (
    <div className="mt-8">
      {/* Progress bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-colors ${
                i <= step
                  ? 'bg-[var(--color-primary)] text-white'
                  : 'bg-[var(--color-neutral-200)] text-[var(--color-neutral-500)]'
              }`}>
                {i + 1}
              </div>
              {i < STEPS.length - 1 && (
                <div className={`hidden sm:block w-8 h-0.5 mx-1 ${
                  i < step ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-neutral-200)]'
                }`} />
              )}
            </div>
          ))}
        </div>
        <p className="text-center text-sm text-[var(--color-neutral-600)]">
          {isAr ? currentStep.labelAr : currentStep.labelEn} ({step + 1}/{STEPS.length})
        </p>
      </div>

      {/* Step content */}
      <div className="min-h-[300px]">
        {currentStep.id === 'welcome' && (
          <div className="text-center py-8">
            <p className="text-lg text-[var(--color-neutral-700)]">
              {isAr
                ? `مرحبًا ${coach.title_ar}! سنساعدك في إعداد ملفك الشخصي على منصة كُن.`
                : `Welcome ${coach.title_en}! We'll help you set up your coach profile on the Kun platform.`}
            </p>
            <p className="mt-4 text-[var(--color-neutral-500)]">
              {isAr
                ? 'سيستغرق الأمر بضع دقائق فقط. يمكنك العودة وتعديل أي خطوة لاحقًا.'
                : 'This will only take a few minutes. You can come back and edit any step later.'}
            </p>
          </div>
        )}

        {currentStep.id === 'photo' && (
          <div className="text-center py-4">
            <div className="mx-auto w-32 h-32 rounded-full bg-[var(--color-neutral-200)] overflow-hidden mb-4">
              {avatarPreview ? (
                <img src={avatarPreview} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-4xl text-[var(--color-neutral-400)]">
                  {coach.title_en?.[0] || '?'}
                </div>
              )}
            </div>
            <label className="inline-flex items-center gap-2 cursor-pointer rounded-lg border border-[var(--color-neutral-300)] px-4 py-3 text-sm font-medium text-[var(--color-neutral-700)] hover:bg-[var(--color-neutral-50)] transition-colors min-h-[44px]">
              {isAr ? 'اختر صورة' : 'Choose Photo'}
              <input type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
            </label>
            {saving && <p className="mt-2 text-sm text-[var(--color-neutral-500)]">{isAr ? 'جاري الرفع...' : 'Uploading...'}</p>}
          </div>
        )}

        {currentStep.id === 'bio' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[var(--color-neutral-700)] mb-1">
                {isAr ? 'النبذة بالعربية' : 'Bio (Arabic)'}
              </label>
              <textarea
                value={bioAr}
                onChange={(e) => setBioAr(e.target.value)}
                dir="rtl"
                rows={4}
                className="block w-full rounded-lg border border-[var(--color-neutral-300)] px-4 py-3 focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-opacity-20"
                placeholder={isAr ? 'اكتب نبذة عنك كمدرب...' : 'Write a bio about yourself as a coach...'}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-neutral-700)] mb-1">
                {isAr ? 'النبذة بالإنجليزية' : 'Bio (English)'}
              </label>
              <textarea
                value={bioEn}
                onChange={(e) => setBioEn(e.target.value)}
                dir="ltr"
                rows={4}
                className="block w-full rounded-lg border border-[var(--color-neutral-300)] px-4 py-3 focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-opacity-20"
                placeholder="Write a bio about yourself as a coach..."
              />
            </div>
          </div>
        )}

        {currentStep.id === 'credentials' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[var(--color-neutral-700)] mb-1">
                {isAr ? 'مستوى الاعتماد' : 'Credential Level'}
              </label>
              <select
                value={coachLevel}
                onChange={(e) => setCoachLevel(e.target.value)}
                className="block w-full rounded-lg border border-[var(--color-neutral-300)] px-4 py-3 min-h-[44px] bg-white focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-opacity-20"
              >
                <option value="">{isAr ? 'اختر' : 'Select'}</option>
                <option value="student_coach">{isAr ? 'كوتش متدرب' : 'Student Coach'}</option>
                <option value="ACC">ACC</option>
                <option value="PCC">PCC</option>
                <option value="MCC">MCC</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-neutral-700)] mb-1">
                {isAr ? 'المؤهلات والشهادات' : 'Credentials & Certifications'}
              </label>
              <textarea
                value={credentials}
                onChange={(e) => setCredentials(e.target.value)}
                rows={3}
                className="block w-full rounded-lg border border-[var(--color-neutral-300)] px-4 py-3 focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-opacity-20"
                placeholder={isAr ? 'مثال: PCC من ICF، ماجستير في...' : 'e.g., PCC from ICF, Master\'s in...'}
              />
            </div>
          </div>
        )}

        {currentStep.id === 'specialties' && (
          <div className="space-y-6">
            <div>
              <p className="text-sm font-medium text-[var(--color-neutral-700)] mb-3">
                {isAr ? 'مجالات التخصص' : 'Specialties'}
              </p>
              <div className="flex flex-wrap gap-2">
                {SPECIALTIES.map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => toggleSpecialty(s.value)}
                    className={`rounded-full px-4 py-2 text-sm font-medium transition-colors min-h-[44px] ${
                      selectedSpecialties.includes(s.value)
                        ? 'bg-[var(--color-primary)] text-white'
                        : 'bg-[var(--color-neutral-100)] text-[var(--color-neutral-700)] hover:bg-[var(--color-neutral-200)]'
                    }`}
                  >
                    {isAr ? s.labelAr : s.labelEn}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-[var(--color-neutral-700)] mb-3">
                {isAr ? 'أسلوب الكوتشنج' : 'Coaching Styles'}
              </p>
              <div className="flex flex-wrap gap-2">
                {COACHING_STYLES.map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => toggleStyle(s.value)}
                    className={`rounded-full px-4 py-2 text-sm font-medium transition-colors min-h-[44px] ${
                      selectedStyles.includes(s.value)
                        ? 'bg-[var(--color-accent)] text-white'
                        : 'bg-[var(--color-neutral-100)] text-[var(--color-neutral-700)] hover:bg-[var(--color-neutral-200)]'
                    }`}
                  >
                    {isAr ? s.labelAr : s.labelEn}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {currentStep.id === 'schedule' && (
          <div className="space-y-4">
            <p className="text-sm text-[var(--color-neutral-600)]">
              {isAr
                ? 'أضف الأوقات التي تكون متاحًا فيها للجلسات'
                : 'Add the times you are available for sessions'}
            </p>
            {schedule.map((block, i) => (
              <div key={i} className="flex items-center gap-2 flex-wrap">
                <select
                  value={block.day_of_week}
                  onChange={(e) => updateScheduleBlock(i, 'day_of_week', Number(e.target.value))}
                  className="rounded-lg border border-[var(--color-neutral-300)] px-3 py-2 min-h-[44px] bg-white text-sm"
                >
                  {DAYS.map(d => (
                    <option key={d.value} value={d.value}>{isAr ? d.labelAr : d.labelEn}</option>
                  ))}
                </select>
                <input
                  type="time"
                  value={block.start_time}
                  onChange={(e) => updateScheduleBlock(i, 'start_time', e.target.value)}
                  className="rounded-lg border border-[var(--color-neutral-300)] px-3 py-2 min-h-[44px] text-sm"
                />
                <span className="text-[var(--color-neutral-500)]">-</span>
                <input
                  type="time"
                  value={block.end_time}
                  onChange={(e) => updateScheduleBlock(i, 'end_time', e.target.value)}
                  className="rounded-lg border border-[var(--color-neutral-300)] px-3 py-2 min-h-[44px] text-sm"
                />
                <button
                  type="button"
                  onClick={() => removeScheduleBlock(i)}
                  className="text-red-500 hover:text-red-700 min-h-[44px] px-2 text-sm"
                >
                  {isAr ? 'حذف' : 'Remove'}
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addScheduleBlock}
              className="text-[var(--color-primary)] hover:underline text-sm font-medium min-h-[44px]"
            >
              {isAr ? '+ إضافة فترة متاحة' : '+ Add time block'}
            </button>
          </div>
        )}

        {currentStep.id === 'review' && (
          <div className="space-y-4 py-4">
            <div className="rounded-lg border border-[var(--color-neutral-200)] p-4">
              <h3 className="font-medium text-[var(--color-neutral-700)] mb-2">{isAr ? 'النبذة' : 'Bio'}</h3>
              <p className="text-sm text-[var(--color-neutral-600)]" dir="rtl">{bioAr || (isAr ? 'لم يتم إدخال نبذة' : 'No bio entered')}</p>
            </div>
            <div className="rounded-lg border border-[var(--color-neutral-200)] p-4">
              <h3 className="font-medium text-[var(--color-neutral-700)] mb-2">{isAr ? 'المؤهلات' : 'Credentials'}</h3>
              <p className="text-sm text-[var(--color-neutral-600)]">{coachLevel || '-'} — {credentials || '-'}</p>
            </div>
            <div className="rounded-lg border border-[var(--color-neutral-200)] p-4">
              <h3 className="font-medium text-[var(--color-neutral-700)] mb-2">{isAr ? 'التخصصات' : 'Specialties'}</h3>
              <div className="flex flex-wrap gap-1">
                {selectedSpecialties.map(s => {
                  const spec = SPECIALTIES.find(sp => sp.value === s);
                  return <span key={s} className="rounded-full bg-[var(--color-neutral-100)] px-2 py-0.5 text-xs">{isAr ? spec?.labelAr : spec?.labelEn}</span>;
                })}
                {selectedSpecialties.length === 0 && <span className="text-sm text-[var(--color-neutral-500)]">-</span>}
              </div>
            </div>
            <div className="rounded-lg border border-[var(--color-neutral-200)] p-4">
              <h3 className="font-medium text-[var(--color-neutral-700)] mb-2">{isAr ? 'المواعيد' : 'Schedule'}</h3>
              {schedule.length > 0 ? schedule.map((block, i) => {
                const day = DAYS.find(d => d.value === block.day_of_week);
                return <p key={i} className="text-sm text-[var(--color-neutral-600)]">{isAr ? day?.labelAr : day?.labelEn}: {block.start_time} - {block.end_time}</p>;
              }) : <span className="text-sm text-[var(--color-neutral-500)]">{isAr ? 'لم تتم إضافة مواعيد' : 'No schedule added'}</span>}
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between mt-8 pt-6 border-t border-[var(--color-neutral-200)]">
        <Button
          variant="ghost"
          size="lg"
          onClick={() => setStep(step - 1)}
          disabled={!canGoBack || saving}
          className={canGoBack ? '' : 'invisible'}
        >
          {isAr ? 'السابق' : 'Back'}
        </Button>

        {currentStep.id === 'review' ? (
          <Button variant="primary" size="lg" onClick={handleSubmit} disabled={saving}>
            {saving ? (isAr ? 'جاري الإرسال...' : 'Submitting...') : (isAr ? 'إرسال للمراجعة' : 'Submit for Review')}
          </Button>
        ) : (
          <Button variant="primary" size="lg" onClick={handleSaveAndNext} disabled={saving}>
            {saving ? (isAr ? 'جاري الحفظ...' : 'Saving...') : (isAr ? 'التالي' : 'Next')}
          </Button>
        )}
      </div>
    </div>
  );
}
