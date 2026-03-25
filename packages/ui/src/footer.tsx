'use client';

import * as React from 'react';
import { cn } from './utils';
import { GeometricPattern } from './patterns';

interface FooterProps {
  locale: string;
  className?: string;
}

const footerLinks = {
  programs: {
    labelAr: 'البرامج',
    labelEn: 'Programs',
    items: [
      { labelAr: 'الشهادات المعتمدة', labelEn: 'Certifications', href: '/programs/certifications/' },
      { labelAr: 'الدورات والورش', labelEn: 'Courses & Workshops', href: '/programs/courses/' },
      { labelAr: 'الخلوات', labelEn: 'Retreats', href: '/programs/retreats/' },
      { labelAr: 'حلول المؤسسات', labelEn: 'Corporate', href: '/programs/corporate/' },
      { labelAr: 'الأسرة والشباب', labelEn: 'Family & Youth', href: '/programs/family/' },
      { labelAr: 'منصة الكوتشينج', labelEn: 'Coaching Platform', href: '/programs/coaching/' },
    ],
  },
  about: {
    labelAr: 'عن كُن',
    labelEn: 'About Kun',
    items: [
      { labelAr: 'من نحن', labelEn: 'About Us', href: '/about/' },
      { labelAr: 'سامر حسن', labelEn: 'Samer Hassan', href: '/about/founder/' },
      { labelAr: 'التفكير الحسّي®', labelEn: 'Somatic Thinking®', href: '/methodology/' },
      { labelAr: 'الكوتشز', labelEn: 'Our Coaches', href: '/coaches/' },
      { labelAr: 'المجتمع', labelEn: 'Community', href: '/community/' },
      { labelAr: 'المدونة', labelEn: 'Blog', href: '/blog/' },
    ],
  },
  resources: {
    labelAr: 'موارد',
    labelEn: 'Resources',
    items: [
      { labelAr: 'المُرشد', labelEn: 'Pathfinder', href: '/pathfinder/' },
      { labelAr: 'الفعاليات', labelEn: 'Events', href: '/events/' },
      { labelAr: 'موارد مجانية', labelEn: 'Free Resources', href: '/programs/free/' },
      { labelAr: 'الأسئلة الشائعة', labelEn: 'FAQ', href: '/faq/' },
      { labelAr: 'الشهادات', labelEn: 'Testimonials', href: '/testimonials/' },
    ],
  },
};

const socialLinks = [
  { name: 'Instagram', href: 'https://instagram.com/kunacademy', icon: 'M12 2.2c2.7 0 3 0 4.1.1 1 .1 1.5.2 1.9.4.5.2.8.4 1.2.8.3.3.6.7.8 1.2.2.4.3.9.4 1.9 0 1 .1 1.4.1 4.1s0 3-.1 4.1c-.1 1-.2 1.5-.4 1.9-.2.5-.4.8-.8 1.2-.3.3-.7.6-1.2.8-.4.2-.9.3-1.9.4-1 0-1.4.1-4.1.1s-3 0-4.1-.1c-1-.1-1.5-.2-1.9-.4-.5-.2-.8-.4-1.2-.8-.3-.3-.6-.7-.8-1.2-.2-.4-.3-.9-.4-1.9C2.2 15 2.2 14.7 2.2 12s0-3 .1-4.1c.1-1 .2-1.5.4-1.9.2-.5.4-.8.8-1.2.3-.3.7-.6 1.2-.8.4-.2.9-.3 1.9-.4C7 2.2 7.3 2.2 12 2.2M12 0C9.3 0 8.9 0 7.9.1 6.9.1 6.1.3 5.4.5c-.7.3-1.3.6-1.9 1.2C2.9 2.3 2.5 2.9 2.3 3.6 2 4.3 1.9 5 1.8 6 1.8 7 1.8 7.3 1.8 10s0 3 .1 4.1c0 1 .2 1.7.4 2.4.3.7.6 1.3 1.2 1.9.6.6 1.2 1 1.9 1.2.7.3 1.4.4 2.4.4 1 .1 1.4.1 4.1.1s3 0 4.1-.1c1 0 1.7-.2 2.4-.4.7-.3 1.3-.6 1.9-1.2.6-.6 1-1.2 1.2-1.9.3-.7.4-1.4.4-2.4.1-1 .1-1.4.1-4.1s0-3-.1-4.1c0-1-.2-1.7-.4-2.4-.3-.7-.6-1.3-1.2-1.9-.6-.6-1.2-1-1.9-1.2C17.9.3 17.1.1 16.1.1 15 0 14.7 0 12 0zm0 5.8a6.2 6.2 0 100 12.4 6.2 6.2 0 000-12.4zM12 16a4 4 0 110-8 4 4 0 010 8zm6.4-10.8a1.4 1.4 0 100 2.8 1.4 1.4 0 000-2.8z' },
  { name: 'LinkedIn', href: 'https://linkedin.com/company/kunacademy', icon: 'M20.5 2h-17A1.5 1.5 0 002 3.5v17A1.5 1.5 0 003.5 22h17a1.5 1.5 0 001.5-1.5v-17A1.5 1.5 0 0020.5 2zM8 19H5v-9h3zM6.5 8.25A1.75 1.75 0 118.3 6.5a1.78 1.78 0 01-1.8 1.75zM19 19h-3v-4.74c0-1.42-.6-1.93-1.38-1.93A1.74 1.74 0 0013 14.19V19h-3v-9h2.9v1.3a3.11 3.11 0 012.7-1.4c1.55 0 3.36.86 3.36 3.66z' },
  { name: 'YouTube', href: 'https://youtube.com/@kunacademy', icon: 'M23.5 6.2a3 3 0 00-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.5a3 3 0 00-2.1 2.1A31.3 31.3 0 000 12a31.3 31.3 0 00.5 5.8 3 3 0 002.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 002.1-2.1A31.3 31.3 0 0024 12a31.3 31.3 0 00-.5-5.8zM9.6 15.6V8.4l6.3 3.6z' },
  { name: 'WhatsApp', href: 'https://wa.me/971501234567', icon: 'M17.5 14.4l-2-1c-.3-.1-.5-.2-.7.1l-1 1.2c-.2.2-.3.2-.6.1-.3-.2-1.2-.4-2.2-1.4-.8-.8-1.4-1.7-1.5-2 0-.3 0-.4.2-.5l.4-.5.3-.4v-.5l-1-2.3c-.3-.6-.5-.5-.7-.5h-.6c-.2 0-.6.1-.9.4-.3.3-1.2 1.2-1.2 2.8s1.2 3.3 1.4 3.5c.2.2 2.4 3.6 5.8 5.1.8.3 1.5.5 2 .7.8.3 1.6.2 2.2.1.7-.1 2-.8 2.3-1.6.3-.8.3-1.4.2-1.6-.1-.1-.3-.2-.6-.3zM12 21.8A9.9 9.9 0 012.2 12 9.9 9.9 0 0112 2.2 9.9 9.9 0 0121.8 12 9.9 9.9 0 0112 21.8zM12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.6 0 12 0z' },
];

export function Footer({ locale, className }: FooterProps) {
  const isAr = locale === 'ar';
  const t = (ar: string, en: string) => (isAr ? ar : en);
  const year = new Date().getFullYear();

  return (
    <footer
      className={cn(
        'relative overflow-hidden',
        'bg-[var(--color-primary-800)]',
        'text-[#FFF5E9]',
        className
      )}
    >
      {/* Subtle geometric pattern */}
      <GeometricPattern pattern="flower-of-life" opacity={0.06} fade="top" />

      {/* Main footer content */}
      <div className="relative z-10 mx-auto max-w-[var(--max-content-width)] px-4 md:px-6 pt-16 pb-8">
        {/* Top section: Logo + description */}
        <div className="flex flex-col md:flex-row gap-12 md:gap-8 pb-12 border-b border-white/10">
          {/* Brand column */}
          <div className="md:w-[30%] space-y-4">
            <a href={`/${locale}/`} className="inline-flex items-center gap-3">
              <img
                src="/images/logo/kun-logo.svg"
                alt="Kun Academy"
                className="h-10 w-10"
              />
              <div className="flex flex-col">
                <span className="text-xl font-bold text-white leading-none">كُنْ</span>
                <span className="text-[10px] font-light text-white/60 tracking-widest uppercase leading-none mt-1">Academy</span>
              </div>
            </a>
            <p className="text-sm text-white/65 leading-relaxed max-w-xs">
              {t(
                'أكاديمية كُن للكوتشينج — أول أكاديمية عربية للتفكير الحسّي® والكوتشينج المعتمد من ICF.',
                'Kun Coaching Academy — the first Arabic academy for Somatic Thinking® and ICF-accredited coaching.'
              )}
            </p>
            {/* Social icons */}
            <div className="flex gap-3 pt-2">
              {socialLinks.map((social) => (
                <a
                  key={social.name}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center w-10 h-10 rounded-full bg-white/8 hover:bg-white/15 transition-colors duration-300"
                  aria-label={social.name}
                >
                  <svg className="w-4 h-4 fill-current text-white/75" viewBox="0 0 24 24">
                    <path d={social.icon} />
                  </svg>
                </a>
              ))}
            </div>
          </div>

          {/* Link columns */}
          <div className="flex-1 grid grid-cols-2 md:grid-cols-3 gap-8 md:gap-6">
            {Object.values(footerLinks).map((column) => (
              <div key={column.labelEn}>
                <h4 className="text-sm font-semibold text-white/90 tracking-wide uppercase mb-4">
                  {isAr ? column.labelAr : column.labelEn}
                </h4>
                <ul className="space-y-2.5">
                  {column.items.map((item) => (
                    <li key={item.href}>
                      <a
                        href={`/${locale}${item.href}`}
                        className="text-sm text-white/55 hover:text-white transition-colors duration-300 leading-relaxed"
                      >
                        {isAr ? item.labelAr : item.labelEn}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom bar */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-8">
          <p className="text-xs text-white/40">
            © {year} {t('أكاديمية كُن للكوتشينج. جميع الحقوق محفوظة.', 'Kun Coaching Academy. All rights reserved.')}
          </p>
          <div className="flex gap-6 text-xs text-white/40">
            <a href={`/${locale}/privacy/`} className="hover:text-white/70 transition-colors">
              {t('سياسة الخصوصية', 'Privacy Policy')}
            </a>
            <a href={`/${locale}/terms/`} className="hover:text-white/70 transition-colors">
              {t('الشروط والأحكام', 'Terms of Service')}
            </a>
            <a href={`/${locale}/refund/`} className="hover:text-white/70 transition-colors">
              {t('سياسة الاسترداد', 'Refund Policy')}
            </a>
          </div>
        </div>

        {/* Kun logo watermark */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-[8rem] font-bold text-white/[0.02] pointer-events-none select-none leading-none" aria-hidden="true">
          كُن
        </div>
      </div>
    </footer>
  );
}
