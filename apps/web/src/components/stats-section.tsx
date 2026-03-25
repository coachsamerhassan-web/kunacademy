'use client';

import { useEffect, useRef, useState } from 'react';
import { GeometricPattern } from '@kunacademy/ui/patterns';

interface StatsSectionProps {
  locale: string;
}

const stats = [
  { valueAr: '١٠,٠٠٠+', valueEn: '10,000+', labelAr: 'جلسة كوتشينج', labelEn: 'Coaching Sessions' },
  { valueAr: '٥٠٠+', valueEn: '500+', labelAr: 'كوتش تخرّجوا', labelEn: 'Coaches Graduated' },
  { valueAr: '٤', valueEn: '4', labelAr: 'قارات', labelEn: 'Continents' },
  { valueAr: '١٥+', valueEn: '15+', labelAr: 'سنة خبرة', labelEn: 'Years of Experience' },
];

function AnimatedNumber({ value, visible }: { value: string; visible: boolean }) {
  return (
    <span
      className={`block transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`}
    >
      {value}
    </span>
  );
}

export function StatsSection({ locale }: StatsSectionProps) {
  const isAr = locale === 'ar';
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!ref.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect(); } },
      { threshold: 0.3 }
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={ref}
      className="relative overflow-hidden py-16 md:py-20"
      style={{
        background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-600) 100%)',
      }}
    >
      <GeometricPattern pattern="eight-star" opacity={0.12} fade="both" />
      <div className="relative z-10 mx-auto max-w-[var(--max-content-width)] px-4 md:px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-4">
          {stats.map((stat, i) => (
            <div
              key={stat.labelEn}
              className="text-center"
              style={{ transitionDelay: `${i * 150}ms` }}
            >
              <div className="text-3xl md:text-4xl font-bold text-white mb-1">
                <AnimatedNumber value={isAr ? stat.valueAr : stat.valueEn} visible={visible} />
              </div>
              <p className="text-sm text-white/60 font-medium">
                {isAr ? stat.labelAr : stat.labelEn}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
