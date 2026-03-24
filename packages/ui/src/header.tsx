'use client';

import * as React from 'react';
import { cn } from './utils';

// ─── Navigation Structure (matches SITE-TREE-V2) ──────────────────

interface NavItem {
  key: string;
  labelAr: string;
  labelEn: string;
  href: string;
  children?: { labelAr: string; labelEn: string; href: string }[];
}

const primaryNav: NavItem[] = [
  {
    key: 'coaching',
    labelAr: 'الكوتشينج',
    labelEn: 'Coaching',
    href: '/coaching/',
    children: [
      { labelAr: 'كوتشينج فردي', labelEn: 'Individual Coaching', href: '/coaching/individual/' },
      { labelAr: 'ورش جماعية', labelEn: 'Group Workshops', href: '/coaching/group/' },
      { labelAr: 'حلول المؤسسات', labelEn: 'Corporate Solutions', href: '/coaching/corporate/' },
    ],
  },
  {
    key: 'academy',
    labelAr: 'الأكاديمية',
    labelEn: 'Academy',
    href: '/academy/',
    children: [
      { labelAr: 'الشهادات المعتمدة', labelEn: 'Certifications', href: '/academy/certifications/' },
      { labelAr: 'الدورات الحية', labelEn: 'Live Courses', href: '/academy/courses/' },
      { labelAr: 'دورات مسجّلة', labelEn: 'Recorded Courses', href: '/academy/recorded/' },
      { labelAr: 'مجاني', labelEn: 'Free Resources', href: '/academy/free/' },
    ],
  },
  {
    key: 'events',
    labelAr: 'الفعاليات',
    labelEn: 'Events',
    href: '/events/',
  },
  {
    key: 'pathfinder',
    labelAr: 'المُرشد',
    labelEn: 'Pathfinder',
    href: '/pathfinder/',
  },
  {
    key: 'coaches',
    labelAr: 'الكوتشز',
    labelEn: 'Coaches',
    href: '/coaches/',
  },
  {
    key: 'blog',
    labelAr: 'المدونة',
    labelEn: 'Blog',
    href: '/blog/',
  },
  {
    key: 'about',
    labelAr: 'من نحن',
    labelEn: 'About',
    href: '/about/',
    children: [
      { labelAr: 'سامر حسن', labelEn: 'Samer Hassan', href: '/about/samer/' },
      { labelAr: 'التفكير الحسّي', labelEn: 'Somatic Thinking', href: '/about/methodology/' },
      { labelAr: 'قيمنا', labelEn: 'Our Values', href: '/about/values/' },
      { labelAr: 'فريقنا', labelEn: 'Our Team', href: '/about/team/' },
    ],
  },
];

// ─── Header Component ──────────────────────────────────────────────

interface HeaderProps {
  locale: string;
}

export function Header({ locale }: HeaderProps) {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [activeDropdown, setActiveDropdown] = React.useState<string | null>(null);
  const [mobileExpanded, setMobileExpanded] = React.useState<string | null>(null);
  const isAr = locale === 'ar';
  const t = (ar: string, en: string) => (isAr ? ar : en);
  const closeTimeoutRef = React.useRef<ReturnType<typeof setTimeout>>(null);

  const handleMouseEnter = (key: string) => {
    if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    setActiveDropdown(key);
  };
  const handleMouseLeave = () => {
    closeTimeoutRef.current = setTimeout(() => setActiveDropdown(null), 150);
  };

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-[var(--color-neutral)]">
      <div className="mx-auto max-w-[var(--max-content-width)] px-4 flex items-center justify-between h-16">
        {/* Logo */}
        <a href={`/${locale}/`} className="font-bold text-xl text-[var(--color-primary)]">
          كُن <span className="text-sm font-normal text-[var(--color-neutral-600)]">KUN</span>
        </a>

        {/* Desktop Nav */}
        <nav className="hidden lg:flex items-center gap-1">
          {primaryNav.map((item) => (
            <div
              key={item.key}
              className="relative"
              onMouseEnter={() => item.children && handleMouseEnter(item.key)}
              onMouseLeave={() => item.children && handleMouseLeave()}
            >
              <a
                href={`/${locale}${item.href}`}
                className={cn(
                  'flex items-center gap-1 px-3 py-2 text-sm font-medium rounded-lg transition-colors min-h-[44px]',
                  activeDropdown === item.key
                    ? 'text-[var(--color-primary)] bg-[var(--color-primary-50)]'
                    : 'hover:text-[var(--color-primary)]',
                )}
              >
                {isAr ? item.labelAr : item.labelEn}
                {item.children && <span className={cn('text-[10px] ms-0.5 transition-transform', activeDropdown === item.key && 'rotate-180')}>▾</span>}
              </a>

              {/* Dropdown */}
              {item.children && activeDropdown === item.key && (
                <div className="absolute top-full start-0 mt-1 w-56 bg-white rounded-xl shadow-[0_8px_32px_rgba(71,64,153,0.12)] border border-[var(--color-neutral)] py-2 z-50">
                  {item.children.map((child) => (
                    <a
                      key={child.href}
                      href={`/${locale}${child.href}`}
                      className="block px-4 py-2.5 text-sm hover:bg-[var(--color-primary-50)] hover:text-[var(--color-primary)] transition-colors"
                    >
                      {isAr ? child.labelAr : child.labelEn}
                    </a>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>

        {/* Right actions */}
        <div className="flex items-center gap-3">
          <a
            href={`/${locale === 'ar' ? 'en' : 'ar'}/`}
            className="text-xs font-medium text-[var(--color-neutral-600)] hover:text-[var(--color-primary)] min-h-[44px] flex items-center"
          >
            {t('EN', 'عربي')}
          </a>
          <a
            href={`/${locale}/dashboard/`}
            className="hidden sm:flex text-sm text-[var(--color-primary)] hover:underline min-h-[44px] items-center"
          >
            {t('دخول', 'Login')}
          </a>
          <a
            href={`/${locale}/pathfinder/`}
            className="hidden sm:inline-flex items-center justify-center rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white min-h-[44px] hover:bg-[var(--color-accent-500)] transition-colors"
          >
            {t('ابدأ رحلتك', 'Start Your Journey')}
          </a>
          {/* Mobile hamburger */}
          <button
            onClick={() => { setMenuOpen(!menuOpen); setActiveDropdown(null); }}
            className="lg:hidden flex items-center justify-center w-11 h-11"
            aria-label="Menu"
          >
            <span className="text-2xl">{menuOpen ? '✕' : '☰'}</span>
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {menuOpen && (
        <div className="lg:hidden fixed inset-0 top-16 bg-white z-40 overflow-y-auto">
          <div className="p-4 space-y-1">
            {primaryNav.map((item) => (
              <div key={item.key}>
                {item.children ? (
                  <>
                    <button
                      onClick={() => setMobileExpanded(mobileExpanded === item.key ? null : item.key)}
                      className="w-full flex items-center justify-between py-3 px-3 text-base font-medium rounded-lg hover:bg-[var(--color-neutral-50)]"
                    >
                      {isAr ? item.labelAr : item.labelEn}
                      <span className={cn('text-xs transition-transform', mobileExpanded === item.key && 'rotate-180')}>▾</span>
                    </button>
                    {mobileExpanded === item.key && (
                      <div className="ps-4 space-y-1">
                        <a
                          href={`/${locale}${item.href}`}
                          className="block py-2.5 px-3 text-sm font-medium text-[var(--color-primary)] rounded-lg hover:bg-[var(--color-neutral-50)]"
                          onClick={() => setMenuOpen(false)}
                        >
                          {t('عرض الكل', 'View All')} →
                        </a>
                        {item.children.map((child) => (
                          <a
                            key={child.href}
                            href={`/${locale}${child.href}`}
                            className="block py-2.5 px-3 text-sm text-[var(--color-neutral-700)] hover:text-[var(--color-primary)] rounded-lg hover:bg-[var(--color-neutral-50)]"
                            onClick={() => setMenuOpen(false)}
                          >
                            {isAr ? child.labelAr : child.labelEn}
                          </a>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <a
                    href={`/${locale}${item.href}`}
                    className="block py-3 px-3 text-base rounded-lg hover:bg-[var(--color-neutral-50)]"
                    onClick={() => setMenuOpen(false)}
                  >
                    {isAr ? item.labelAr : item.labelEn}
                  </a>
                )}
              </div>
            ))}

            <hr className="my-3 border-[var(--color-neutral)]" />

            <a
              href={`/${locale}/pathfinder/`}
              className="block w-full text-center rounded-lg bg-[var(--color-accent)] px-4 py-3 text-base font-medium text-white"
              onClick={() => setMenuOpen(false)}
            >
              {t('ابدأ رحلتك', 'Start Your Journey')}
            </a>
            <a
              href={`/${locale}/dashboard/`}
              className="block w-full text-center rounded-lg border border-[var(--color-primary)] px-4 py-3 text-base font-medium text-[var(--color-primary)]"
              onClick={() => setMenuOpen(false)}
            >
              {t('تسجيل الدخول', 'Login')}
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
