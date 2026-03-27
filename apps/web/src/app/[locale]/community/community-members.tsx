// @ts-nocheck — TODO: fix Supabase client types (types regenerated, needs 'as any' removal)
'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@kunacademy/db';

interface Member {
  id: string;
  full_name_ar: string | null;
  full_name_en: string | null;
  avatar_url: string | null;
  role: string;
  country: string | null;
}

const ROLE_BADGES: Record<string, { labelAr: string; labelEn: string; className: string }> = {
  admin: { labelAr: 'مدير', labelEn: 'Admin', className: 'bg-purple-100 text-purple-700' },
  provider: { labelAr: 'كوتش', labelEn: 'Coach', className: 'bg-blue-100 text-blue-700' },
  student: { labelAr: 'متدرب', labelEn: 'Student', className: 'bg-green-100 text-green-700' },
};

export function CommunityMembers({ locale }: { locale: string }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const isAr = locale === 'ar';

  useEffect(() => {
    const supabase = createBrowserClient();
    if (!supabase) return;
    supabase.from('profiles').select('id, full_name_ar, full_name_en, avatar_url, role, country')
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => { setMembers(data || []); setLoading(false); });
  }, []);

  if (loading) return <div className="py-8 text-center text-[var(--color-neutral-500)]">{isAr ? 'جاري التحميل...' : 'Loading...'}</div>;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {members.map(member => {
        const badge = ROLE_BADGES[member.role] || ROLE_BADGES.student;
        return (
          <a
            key={member.id}
            href={`/${locale}/community/${member.id}`}
            className="rounded-lg border border-[var(--color-neutral-200)] p-4 text-center hover:shadow-sm transition"
          >
            <div className="w-16 h-16 rounded-full bg-[var(--color-neutral-200)] mx-auto overflow-hidden">
              {member.avatar_url ? (
                <img src={member.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xl text-[var(--color-neutral-400)]">
                  {(member.full_name_en || '?')[0]}
                </div>
              )}
            </div>
            <p className="font-medium mt-2 truncate">{isAr ? member.full_name_ar : member.full_name_en}</p>
            <span className={`inline-block mt-1 rounded-full px-2 py-0.5 text-xs ${badge.className}`}>
              {isAr ? badge.labelAr : badge.labelEn}
            </span>
          </a>
        );
      })}
    </div>
  );
}
