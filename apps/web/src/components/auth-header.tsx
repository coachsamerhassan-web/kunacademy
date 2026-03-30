'use client';

import { Header, type HeaderUser } from '@kunacademy/ui/header';
import { useEffect, useState } from 'react';
import { createBrowserClient } from '@kunacademy/db';

export function AuthHeader({ locale }: { locale: string }) {
  const [headerUser, setHeaderUser] = useState<HeaderUser | null>(null);

  useEffect(() => {
    const supabase = createBrowserClient();
    if (!supabase) return;

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase
        .from('profiles')
        .select('full_name_ar, full_name_en, avatar_url')
        .eq('id', user.id)
        .single()
        .then(({ data: p }) => {
          const name =
            (locale === 'ar'
              ? (p?.full_name_ar || p?.full_name_en)
              : (p?.full_name_en || p?.full_name_ar)) ||
            user.email ||
            null;
          setHeaderUser({ name, avatar_url: p?.avatar_url ?? null });
        });
    });
  }, [locale]);

  return <Header locale={locale} user={headerUser} />;
}
