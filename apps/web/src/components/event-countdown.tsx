'use client';

import { useEffect, useState } from 'react';

interface EventCountdownProps {
  targetDate: string;
  locale: string;
  className?: string;
}

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

const LABELS = {
  ar: ['أيام', 'ساعات', 'دقائق', 'ثوانٍ'],
  en: ['Days', 'Hours', 'Minutes', 'Seconds'],
};

function calcTimeLeft(targetDate: string): TimeLeft | null {
  const diff = new Date(targetDate).getTime() - Date.now();
  if (diff <= 0) return null;
  const totalSeconds = Math.floor(diff / 1000);
  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
  };
}

export function EventCountdown({ targetDate, locale, className = '' }: EventCountdownProps) {
  const isAr = locale === 'ar';
  const labels = isAr ? LABELS.ar : LABELS.en;

  // Hydration-safe: start with null, populate on client
  const [timeLeft, setTimeLeft] = useState<TimeLeft | null | undefined>(undefined);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    const update = () => {
      const t = calcTimeLeft(targetDate);
      if (!t) {
        setExpired(true);
        setTimeLeft(null);
      } else {
        setTimeLeft(t);
      }
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [targetDate]);

  const isUrgent = timeLeft && timeLeft.days < 1;

  if (expired) {
    return (
      <div className={`flex items-center justify-center gap-2 text-[var(--color-primary)] font-semibold ${className}`}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-5 h-5 shrink-0" aria-hidden="true">
          <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
          <path d="M22 4L12 14.01l-3-3" />
        </svg>
        <span style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}>
          {isAr ? 'بدأت الفعالية' : 'Event has started'}
        </span>
      </div>
    );
  }

  const values = timeLeft
    ? [timeLeft.days, timeLeft.hours, timeLeft.minutes, timeLeft.seconds]
    : ['—', '—', '—', '—'];

  return (
    <div
      className={`${className} ${isUrgent ? 'animate-pulse' : ''}`}
      dir={isAr ? 'rtl' : 'ltr'}
    >
      <div className="flex items-stretch justify-center gap-3">
        {values.map((val, i) => (
          <div
            key={i}
            className="flex flex-col items-center justify-center rounded-xl border border-[var(--color-neutral-200)] bg-white px-4 py-3 shadow-sm min-w-[64px]"
            style={isUrgent ? { borderColor: 'var(--color-accent)', boxShadow: '0 0 0 1px var(--color-accent)' } : {}}
          >
            <span
              className="text-3xl font-bold leading-none tabular-nums"
              style={{
                color: isUrgent ? 'var(--color-accent)' : 'var(--color-primary)',
                fontFamily: 'var(--font-english-heading)',
              }}
            >
              {typeof val === 'number' ? String(val).padStart(2, '0') : val}
            </span>
            <span
              className="mt-1 text-xs text-[var(--color-neutral-600)]"
              style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
            >
              {labels[i]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
