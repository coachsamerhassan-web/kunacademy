'use client';

import { GeometricPattern } from '@kunacademy/ui/patterns';

interface CTASectionProps {
  locale: string;
}

export function CTASection({ locale }: CTASectionProps) {
  const isAr = locale === 'ar';

  return (
    <section className="relative overflow-hidden py-20 md:py-28">
      {/* Background image */}
      <div className="absolute inset-0">
        <img
          src="/images/community/hands-circle-gulf.png"
          alt=""
          className="w-full h-full object-cover"
          style={{ filter: 'saturate(0.5) brightness(0.3)' }}
          loading="lazy"
        />
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(160deg, rgba(29,26,61,0.92) 0%, rgba(71,64,153,0.85) 100%)',
          }}
        />
        <GeometricPattern pattern="eight-star" opacity={0.1} fade="both" />
      </div>

      {/* Content */}
      <div className="relative z-10 mx-auto max-w-[var(--max-content-width)] px-4 md:px-6 text-center">
        <h2
          className="text-[1.75rem] md:text-[2.5rem] font-bold text-white leading-tight"
          style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
        >
          {isAr ? 'مستعد لبدء رحلتك؟' : 'Ready to Start Your Journey?'}
        </h2>
        <p className="mt-4 text-white/65 max-w-xl mx-auto text-lg md:text-xl">
          {isAr
            ? 'انضم إلى أكثر من ٥٠٠ كوتش تدرّبوا في أكاديمية كُن عبر ١٣ دولة'
            : 'Join 500+ coaches trained at Kun Academy across 13 countries'}
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-4">
          <a
            href={`/${locale}/pathfinder/`}
            className="inline-flex items-center justify-center rounded-xl bg-[var(--color-accent)] px-8 py-3.5 text-base font-semibold text-white min-h-[52px] hover:bg-[var(--color-accent-500)] transition-all duration-300 shadow-[0_4px_24px_rgba(244,126,66,0.35)] hover:shadow-[0_8px_32px_rgba(244,126,66,0.5)] hover:scale-[1.02] active:scale-[0.98]"
          >
            {isAr ? 'سجّل الآن' : 'Register Now'}
          </a>
          <a
            href="https://wa.me/971501234567"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 px-8 py-3.5 text-base font-medium text-white min-h-[52px] hover:bg-white/20 transition-all duration-300"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.5 14.4l-2-1c-.3-.1-.5-.2-.7.1l-1 1.2c-.2.2-.3.2-.6.1-.3-.2-1.2-.4-2.2-1.4-.8-.8-1.4-1.7-1.5-2 0-.3 0-.4.2-.5l.4-.5.3-.4v-.5l-1-2.3c-.3-.6-.5-.5-.7-.5h-.6c-.2 0-.6.1-.9.4-.3.3-1.2 1.2-1.2 2.8s1.2 3.3 1.4 3.5c.2.2 2.4 3.6 5.8 5.1.8.3 1.5.5 2 .7.8.3 1.6.2 2.2.1.7-.1 2-.8 2.3-1.6.3-.8.3-1.4.2-1.6-.1-.1-.3-.2-.6-.3z" />
            </svg>
            {isAr ? 'تواصل عبر واتساب' : 'Chat on WhatsApp'}
          </a>
        </div>
      </div>
    </section>
  );
}
