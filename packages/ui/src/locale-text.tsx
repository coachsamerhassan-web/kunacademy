'use client';

interface LocaleTextProps {
  ar: string;
  en: string;
  locale: string;
  className?: string;
}

export function LocaleText({ ar, en, locale, className }: LocaleTextProps) {
  return <span className={className}>{locale === 'ar' ? ar : en}</span>;
}
