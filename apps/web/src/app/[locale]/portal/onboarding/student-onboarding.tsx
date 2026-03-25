// @ts-nocheck
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@kunacademy/auth';
import { Button } from '@kunacademy/ui/button';
import { completeOnboarding } from './actions';

const INTENTS = [
  { value: 'personal_growth', labelAr: 'نمو شخصي', labelEn: 'Personal Growth', descAr: 'أريد تطوير نفسي والعمل مع كوتش', descEn: 'I want to grow and work with a coach' },
  { value: 'become_coach', labelAr: 'أصبح كوتش', labelEn: 'Become a Coach', descAr: 'أريد التدرب على الكوتشنج والحصول على اعتماد', descEn: 'I want to train as a coach and get certified' },
  { value: 'get_coaching', labelAr: 'أحتاج كوتشنج', labelEn: 'Get Coaching', descAr: 'أبحث عن كوتش لمساعدتي في تحدٍّ محدد', descEn: 'I\'m looking for a coach for a specific challenge' },
  { value: 'corporate', labelAr: 'مؤسسي', labelEn: 'Corporate', descAr: 'أمثّل مؤسسة تبحث عن حلول كوتشنج', descEn: 'I represent an organization looking for coaching solutions' },
];

export function StudentOnboarding({ locale }: { locale: string }) {
  const router = useRouter();
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [intent, setIntent] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [saving, setSaving] = useState(false);
  const isAr = locale === 'ar';

  async function handleComplete() {
    if (!user) return;
    setSaving(true);
    try {
      await completeOnboarding(user.id, {
        full_name_ar: nameAr || undefined,
        full_name_en: nameEn || undefined,
        intent,
      });

      // Redirect based on intent
      const paths: Record<string, string> = {
        personal_growth: `/${locale}/portal`,
        become_coach: `/${locale}/academy`,
        get_coaching: `/${locale}/coaching/book`,
        corporate: `/${locale}/coaching/corporate`,
      };
      router.push(paths[intent] || `/${locale}/portal`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-8">
      {step === 0 && (
        <div className="space-y-3">
          <p className="text-sm font-medium text-[var(--color-neutral-700)] mb-4 text-center">
            {isAr ? 'ما الذي يجلبك إلى كُن؟' : 'What brings you to Kun?'}
          </p>
          {INTENTS.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => { setIntent(item.value); setStep(1); }}
              className={`w-full text-start rounded-lg border p-4 transition-colors min-h-[44px] ${
                intent === item.value
                  ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5'
                  : 'border-[var(--color-neutral-200)] hover:border-[var(--color-neutral-300)]'
              }`}
            >
              <div className="font-medium">{isAr ? item.labelAr : item.labelEn}</div>
              <div className="text-sm text-[var(--color-neutral-500)] mt-0.5">{isAr ? item.descAr : item.descEn}</div>
            </button>
          ))}
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <p className="text-sm font-medium text-[var(--color-neutral-700)] mb-4 text-center">
            {isAr ? 'ما اسمك؟' : 'What is your name?'}
          </p>
          <div>
            <label className="block text-sm text-[var(--color-neutral-600)] mb-1">
              {isAr ? 'الاسم بالعربية (اختياري)' : 'Name in Arabic (optional)'}
            </label>
            <input
              type="text"
              value={nameAr}
              onChange={(e) => setNameAr(e.target.value)}
              dir="rtl"
              className="block w-full rounded-lg border border-[var(--color-neutral-300)] px-4 py-3 min-h-[44px] focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-opacity-20"
            />
          </div>
          <div>
            <label className="block text-sm text-[var(--color-neutral-600)] mb-1">
              {isAr ? 'الاسم بالإنجليزية (اختياري)' : 'Name in English (optional)'}
            </label>
            <input
              type="text"
              value={nameEn}
              onChange={(e) => setNameEn(e.target.value)}
              dir="ltr"
              className="block w-full rounded-lg border border-[var(--color-neutral-300)] px-4 py-3 min-h-[44px] focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-opacity-20"
            />
          </div>
          <div className="flex gap-3 pt-4">
            <Button variant="ghost" size="lg" onClick={() => setStep(0)}>
              {isAr ? 'السابق' : 'Back'}
            </Button>
            <Button variant="primary" size="lg" className="flex-1" onClick={handleComplete} disabled={saving}>
              {saving ? (isAr ? 'جاري الحفظ...' : 'Saving...') : (isAr ? 'ابدأ رحلتك' : 'Start Your Journey')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
