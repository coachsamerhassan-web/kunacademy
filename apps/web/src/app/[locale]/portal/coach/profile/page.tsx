'use client';

import { useAuth } from '@kunacademy/auth';
import { useEffect, useState } from 'react';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';
import { Button } from '@kunacademy/ui/button';
import { useParams } from 'next/navigation';
import { Check } from 'lucide-react';

export default function CoachProfileEdit() {
  const { locale } = useParams<{ locale: string }>();
  const { user } = useAuth();
  const isAr = locale === 'ar';
  const [instructor, setInstructor] = useState<Record<string, unknown> | null>(null);
  const [bio, setBio] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!user) return;
    fetch('/api/coach/profile')
      .then(r => r.ok ? r.json() : { instructor: null })
      .then(data => {
        if (data.instructor) {
          setInstructor(data.instructor);
          setBio((isAr ? data.instructor.bio_ar : data.instructor.bio_en) || '');
        }
      });
  }, [user, isAr]);

  async function handleSubmitDraft() {
    if (!instructor) return;
    setSaving(true);
    await fetch('/api/coach/profile/draft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instructor_id: instructor.id,
        field_name: isAr ? 'bio_ar' : 'bio_en',
        old_value: isAr ? instructor.bio_ar : instructor.bio_en,
        new_value: bio,
      }),
    });
    setSaving(false);
    setSaved(true);
  }

  return (
    <main>
      <Section variant="white">
        <Heading level={1}>{isAr ? 'تعديل الملف الشخصي' : 'Edit Profile'}</Heading>
        <p className="mt-2 text-sm text-[var(--color-neutral-500)]">
          {isAr ? 'التعديلات تخضع لمراجعة الإدارة قبل النشر' : 'Edits are subject to admin review before publishing'}
        </p>

        <div className="mt-6 max-w-xl">
          <label className="block text-sm font-medium mb-1">{isAr ? 'السيرة الذاتية' : 'Bio'}</label>
          <textarea
            value={bio}
            onChange={(e) => { setBio(e.target.value); setSaved(false); }}
            rows={6}
            className="w-full rounded-lg border border-[var(--color-neutral-300)] px-4 py-3 min-h-[120px]"
            dir={isAr ? 'rtl' : 'ltr'}
          />
          <div className="mt-4 flex gap-3">
            <Button variant="primary" onClick={handleSubmitDraft} disabled={saving || saved}>
              {saved ? (<>{isAr ? 'تم الإرسال' : 'Submitted'} <Check className="w-4 h-4 inline-block" aria-hidden="true" /></>) : saving ? (isAr ? 'جاري الإرسال...' : 'Submitting...') : (isAr ? 'إرسال للمراجعة' : 'Submit for Review')}
            </Button>
          </div>
        </div>
      </Section>
    </main>
  );
}
