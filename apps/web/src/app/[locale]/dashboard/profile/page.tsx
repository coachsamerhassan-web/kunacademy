'use client';

import { useAuth } from '@kunacademy/auth';
import { Section } from '@kunacademy/ui/section';
import { Card } from '@kunacademy/ui/card';
import { useState, useEffect, use } from 'react';

interface Profile {
  full_name_ar: string | null;
  full_name_en: string | null;
  email: string;
  phone: string | null;
  country: string | null;
  avatar_url: string | null;
}

export default function ProfilePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = use(params);
  const isAr = locale === 'ar';
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    fetch('/api/user/profile')
      .then(r => r.ok ? r.json() : { profile: null })
      .then(data => {
        setProfile(data.profile as Profile | null);
        setLoading(false);
      });
  }, [user]);

  if (loading) {
    return (
      <Section variant="white">
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-primary)] border-t-transparent" />
        </div>
      </Section>
    );
  }

  const name = profile ? (isAr ? profile.full_name_ar : profile.full_name_en) : '';

  const fields = [
    { labelAr: 'الاسم بالعربية', labelEn: 'Name (Arabic)', value: profile?.full_name_ar },
    { labelAr: 'الاسم بالإنجليزية', labelEn: 'Name (English)', value: profile?.full_name_en },
    { labelAr: 'البريد الإلكتروني', labelEn: 'Email', value: profile?.email },
    { labelAr: 'الهاتف', labelEn: 'Phone', value: profile?.phone },
    { labelAr: 'الدولة', labelEn: 'Country', value: profile?.country ? (new Intl.DisplayNames([isAr ? 'ar' : 'en'], { type: 'region' }).of(profile.country) ?? profile.country) : null },
  ];

  return (
    <Section variant="white">
      <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-6">
        {isAr ? 'ملفي الشخصي' : 'My Profile'}
      </h1>

      <Card accent className="p-6">
        {/* Avatar + Name */}
        <div className="flex items-center gap-5 mb-8 pb-6 border-b border-[var(--color-neutral-100)]">
          <div className="h-20 w-20 rounded-full overflow-hidden bg-[var(--color-primary-50)] flex items-center justify-center shrink-0">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt={name || ''} className="h-full w-full object-cover" />
            ) : (
              <span className="text-3xl font-bold text-[var(--color-primary)]">{(name || '?').charAt(0)}</span>
            )}
          </div>
          <div>
            <h2 className="text-xl font-bold text-[var(--text-primary)]">{name || (isAr ? 'مستخدم' : 'User')}</h2>
            <p className="text-sm text-[var(--color-neutral-500)]">{profile?.email}</p>
          </div>
        </div>

        {/* Fields */}
        <div className="space-y-5">
          {fields.map((field) => (
            <div key={field.labelEn}>
              <label className="text-xs font-medium text-[var(--color-neutral-500)] uppercase tracking-wider">
                {isAr ? field.labelAr : field.labelEn}
              </label>
              <p className="mt-1 text-[var(--text-primary)]">
                {field.value || <span className="text-[var(--color-neutral-400)] italic">{isAr ? 'غير محدد' : 'Not set'}</span>}
              </p>
            </div>
          ))}
        </div>

        {/* Edit note */}
        <div className="mt-8 pt-6 border-t border-[var(--color-neutral-100)]">
          <p className="text-sm text-[var(--color-neutral-500)]">
            {isAr ? 'لتعديل بياناتك تواصل معنا عبر info@kuncoaching.com' : 'To update your details contact us at info@kuncoaching.com'}
          </p>
        </div>
      </Card>
    </Section>
  );
}
