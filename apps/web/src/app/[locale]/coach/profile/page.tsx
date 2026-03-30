'use client';

import { useAuth } from '@kunacademy/auth';
import { createBrowserClient } from '@kunacademy/db';
import { Section } from '@kunacademy/ui/section';
import { Card } from '@kunacademy/ui/card';
import { useState, useEffect, use } from 'react';
import { ArrowRight } from 'lucide-react';

export default function CoachProfilePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = use(params);
  const isAr = locale === 'ar';
  const { user } = useAuth();
  const [profile, setProfile] = useState<{ full_name_ar?: string; full_name_en?: string; email: string; phone?: string; country?: string; avatar_url?: string; role?: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const supabase = createBrowserClient();
    supabase.from('profiles').select('*').eq('id', user.id).single().then(({ data }: { data: any }) => {
      setProfile(data as typeof profile);
      setLoading(false);
    });
  }, [user]);

  if (loading) return <Section variant="white"><div className="flex items-center justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-primary)] border-t-transparent" /></div></Section>;

  const name = profile ? (isAr ? profile.full_name_ar : profile.full_name_en) : '';

  return (
    <Section variant="white">
      <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-6">{isAr ? 'ملفي الشخصي' : 'My Profile'}</h1>
      <Card accent className="p-6">
        <div className="flex items-center gap-5 mb-8 pb-6 border-b border-[var(--color-neutral-100)]">
          <div className="h-20 w-20 rounded-full overflow-hidden bg-[var(--color-primary-50)] flex items-center justify-center shrink-0">
            {profile?.avatar_url ? <img src={profile.avatar_url} alt={name || ''} className="h-full w-full object-cover" /> : <span className="text-3xl font-bold text-[var(--color-primary)]">{(name || '?').charAt(0)}</span>}
          </div>
          <div>
            <h2 className="text-xl font-bold text-[var(--text-primary)]">{name}</h2>
            <p className="text-sm text-[var(--color-neutral-500)]">{profile?.email}</p>
            {profile?.role && <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 mt-1">{profile.role}</span>}
          </div>
        </div>
        <div className="space-y-4">
          {[
            { l: isAr ? 'الهاتف' : 'Phone', v: profile?.phone },
            { l: isAr ? 'الدولة' : 'Country', v: profile?.country ? (new Intl.DisplayNames([isAr ? 'ar' : 'en'], { type: 'region' }).of(profile.country) ?? profile.country) : undefined },
          ].map((f) => (
            <div key={f.l}>
              <label className="text-xs font-medium text-[var(--color-neutral-500)] uppercase tracking-wider">{f.l}</label>
              <p className="mt-1 text-[var(--text-primary)]">{f.v || <span className="text-[var(--color-neutral-400)] italic">{isAr ? 'غير محدد' : 'Not set'}</span>}</p>
            </div>
          ))}
        </div>
        <div className="mt-8 pt-6 border-t border-[var(--color-neutral-100)]">
          <a href={`/${locale}/coaches/${profile?.full_name_en?.toLowerCase().replace(/\s+/g, '-') || 'me'}`} className="text-sm text-[var(--color-primary)] hover:underline">
            {isAr ? 'عرض الملف العام' : 'View Public Profile'} <ArrowRight className="w-4 h-4 inline-block rtl:rotate-180" aria-hidden="true" />
          </a>
        </div>
      </Card>
    </Section>
  );
}
