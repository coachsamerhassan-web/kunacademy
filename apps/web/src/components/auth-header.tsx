'use client';

import { Header, type HeaderUser, type DailyQuoteData } from '@kunacademy/ui/header';
import { useAuth } from '@kunacademy/auth';

interface AuthHeaderProps {
  locale: string;
  dailyQuote?: DailyQuoteData | null;
}

export function AuthHeader({ locale, dailyQuote }: AuthHeaderProps) {
  const { user, loading } = useAuth();

  const headerUser: HeaderUser | null = user
    ? {
        name: user.name || user.email || null,
        avatar_url: user.image ?? null,
      }
    : null;

  return <Header locale={locale} user={headerUser} dailyQuote={dailyQuote} />;
}
