'use client';

import * as React from 'react';
import { cn } from './utils';
import { ArrowRight } from 'lucide-react';

// ─── Navigation Structure ──────────────────────────────

interface NavItem {
  key: string;
  labelAr: string;
  labelEn: string;
  href: string;
  children?: { labelAr: string; labelEn: string; href: string; descAr?: string; descEn?: string }[];
}

const primaryNav: NavItem[] = [
  {
    key: 'programs',
    labelAr: 'البرامج',
    labelEn: 'Programs',
    href: '/programs/',
    children: [
      { labelAr: 'الشهادات المعتمدة', labelEn: 'Certifications', href: '/programs/certifications/', descAr: 'STCE — اعتماد ICF', descEn: 'STCE — ICF Accredited' },
      { labelAr: 'الدورات والورش', labelEn: 'Courses & Workshops', href: '/programs/courses/', descAr: 'تعلّم المهارات', descEn: 'Learn the skills' },
      { labelAr: 'الخلوات', labelEn: 'Retreats', href: '/programs/retreats/', descAr: 'تجارب تحويلية', descEn: 'Transformative experiences' },
      { labelAr: 'حلول المؤسسات', labelEn: 'Corporate', href: '/programs/corporate/', descAr: 'للقادة والفرق', descEn: 'For leaders & teams' },
      { labelAr: 'الأسرة والشباب', labelEn: 'Family & Youth', href: '/programs/family/', descAr: 'SEEDS وويصال', descEn: 'SEEDS & Wisal' },
      { labelAr: 'منصة الكوتشينج', labelEn: 'Coaching Platform', href: '/programs/coaching/', descAr: 'احجز جلسة', descEn: 'Book a session' },
    ],
  },
  {
    key: 'methodology',
    labelAr: 'التفكير الحسّي',
    labelEn: 'Somatic Thinking',
    href: '/methodology/',
  },
  {
    key: 'about',
    labelAr: 'من نحن',
    labelEn: 'About',
    href: '/about/',
    children: [
      { labelAr: 'عن الأكاديمية', labelEn: 'About Kun', href: '/about/' },
      { labelAr: 'سامر حسن', labelEn: 'Samer Hassan', href: '/about/founder/' },
      { labelAr: 'الكوتشز', labelEn: 'Our Coaches', href: '/coaches/' },
      { labelAr: 'المجتمع', labelEn: 'Community', href: '/community/' },
    ],
  },
  {
    key: 'events',
    labelAr: 'الفعاليات',
    labelEn: 'Events',
    href: '/events/',
  },
  {
    key: 'blog',
    labelAr: 'المدونة',
    labelEn: 'Blog',
    href: '/blog/',
  },
];

// ─── Header Component ──────────────────────────────────

interface HeaderProps {
  locale: string;
}

export function Header({ locale }: HeaderProps) {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [activeDropdown, setActiveDropdown] = React.useState<string | null>(null);
  const [mobileExpanded, setMobileExpanded] = React.useState<string | null>(null);
  const [scrolled, setScrolled] = React.useState(false);
  const isAr = locale === 'ar';
  const t = (ar: string, en: string) => (isAr ? ar : en);
  const closeTimeoutRef = React.useRef<ReturnType<typeof setTimeout>>(null);

  // Track scroll for header background change
  React.useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Lock body scroll when mobile menu open
  React.useEffect(() => {
    if (menuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  const handleMouseEnter = (key: string) => {
    if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    setActiveDropdown(key);
  };
  const handleMouseLeave = () => {
    closeTimeoutRef.current = setTimeout(() => setActiveDropdown(null), 200);
  };

  return (
    <header
      className={cn(
        'sticky top-0 z-50 transition-all duration-500',
        scrolled
          ? 'bg-white/95 backdrop-blur-md shadow-[0_1px_12px_rgba(71,64,153,0.08)]'
          : 'bg-white/80 backdrop-blur-sm',
      )}
    >
      <div className="mx-auto max-w-[var(--max-content-width)] px-4 md:px-6 flex items-center justify-between h-16 md:h-[72px]">
        {/* Logo */}
        <a href={`/${locale}/`} className="flex items-center gap-2.5 group">
          <img
            src="/images/logo/kun-logo-black.svg"
            alt="Kun Academy"
            className="h-9 w-9 md:h-10 md:w-10 transition-transform duration-300 group-hover:scale-105"
          />
          <div className="flex flex-col">
            <span className="text-lg font-bold text-[var(--color-primary)] leading-none">
              كُنْ
            </span>
            <span className="text-[9px] font-medium tracking-[0.2em] uppercase text-[var(--color-neutral-500)] leading-none mt-0.5">
              Academy
            </span>
          </div>
        </a>

        {/* Desktop Nav */}
        <nav className="hidden lg:flex items-center gap-0.5">
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
                  'flex items-center gap-1 px-3 py-2 text-[var(--text-nav)] font-medium rounded-lg transition-all duration-300 min-h-[44px]',
                  activeDropdown === item.key
                    ? 'text-[var(--color-primary)] bg-[var(--color-primary-50)]'
                    : 'text-[var(--color-neutral-700)] hover:text-[var(--color-primary)]',
                )}
              >
                {isAr ? item.labelAr : item.labelEn}
                {item.children && (
                  <svg
                    className={cn('w-3 h-3 transition-transform duration-300', activeDropdown === item.key && 'rotate-180')}
                    viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2"
                  >
                    <path d="M3 5l3 3 3-3" />
                  </svg>
                )}
              </a>

              {/* Dropdown — mega-menu style */}
              {item.children && activeDropdown === item.key && (
                <div
                  className="absolute top-full start-0 mt-2 w-72 bg-white rounded-2xl shadow-[0_12px_48px_rgba(71,64,153,0.12)] border border-[var(--color-neutral-100)] py-2 z-50"
                  style={{ animation: 'fade-in-item 0.2s ease-out' }}
                >
                  {item.children.map((child) => (
                    <a
                      key={child.href}
                      href={`/${locale}${child.href}`}
                      className="flex flex-col px-4 py-3 hover:bg-[var(--color-primary-50)] transition-colors duration-200 group/item"
                    >
                      <span className="text-sm font-medium text-[var(--color-neutral-800)] group-hover/item:text-[var(--color-primary)]">
                        {isAr ? child.labelAr : child.labelEn}
                      </span>
                      {child.descAr && (
                        <span className="text-xs text-[var(--color-neutral-500)] mt-0.5">
                          {isAr ? child.descAr : child.descEn}
                        </span>
                      )}
                    </a>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>

        {/* Right actions */}
        <div className="flex items-center gap-2">
          {/* Language toggle — preserves current page path and scroll position */}
          <button
            onClick={() => {
              const otherLocale = locale === 'ar' ? 'en' : 'ar';
              const path = window.location.pathname;
              // Replace current locale prefix with the other one
              const newPath = path.replace(new RegExp(`^/${locale}(/|$)`), `/${otherLocale}$1`);
              // Store scroll position keyed by the target path
              sessionStorage.setItem('kun-scroll-restore', JSON.stringify({
                path: newPath,
                scrollY: window.scrollY,
              }));
              window.location.href = newPath + window.location.search + window.location.hash;
            }}
            className="flex items-center justify-center w-9 h-9 rounded-full text-xs font-semibold text-[var(--color-neutral-600)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary-50)] transition-all duration-300"
          >
            {t('EN', 'ع')}
          </button>
          {/* Login */}
          <a
            href={`/${locale}/dashboard/`}
            className="hidden sm:flex text-sm font-medium text-[var(--color-primary)] hover:text-[var(--color-primary-600)] min-h-[44px] items-center px-3 transition-colors duration-300"
          >
            {t('دخول', 'Login')}
          </a>
          {/* CTA */}
          <a
            href={`/${locale}/pathfinder/`}
            className="hidden sm:inline-flex items-center justify-center rounded-xl bg-[var(--color-accent)] px-5 py-2.5 text-sm font-semibold text-white min-h-[44px] hover:bg-[var(--color-accent-500)] transition-all duration-300 hover:shadow-[0_4px_16px_rgba(244,126,66,0.3)] hover:scale-[1.02] active:scale-[0.98]"
          >
            {t('ابدأ رحلتك', 'Start Your Journey')}
          </a>
          {/* Hamburger — animated */}
          <button
            onClick={() => { setMenuOpen(!menuOpen); setActiveDropdown(null); setMobileExpanded(null); }}
            className="lg:hidden flex items-center justify-center w-11 h-11 rounded-lg hover:bg-[var(--color-neutral-50)] transition-colors"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
          >
            <div className="relative w-5 h-4 flex flex-col justify-between">
              <span className={cn(
                'block h-0.5 w-5 bg-[var(--color-neutral-700)] rounded-full transition-all duration-300 origin-center',
                menuOpen && 'rotate-45 translate-y-[7px]'
              )} />
              <span className={cn(
                'block h-0.5 w-5 bg-[var(--color-neutral-700)] rounded-full transition-all duration-300',
                menuOpen && 'opacity-0 scale-x-0'
              )} />
              <span className={cn(
                'block h-0.5 w-5 bg-[var(--color-neutral-700)] rounded-full transition-all duration-300 origin-center',
                menuOpen && '-rotate-45 -translate-y-[7px]'
              )} />
            </div>
          </button>
        </div>
      </div>

      {/* ─── Mobile Menu Drawer ─── */}
      <div
        className={cn(
          'lg:hidden fixed inset-0 top-16 md:top-[72px] z-40 transition-all duration-500',
          menuOpen ? 'visible' : 'invisible pointer-events-none'
        )}
      >
        {/* Backdrop */}
        <div
          className={cn(
            'absolute inset-0 bg-black/20 backdrop-blur-sm transition-opacity duration-500',
            menuOpen ? 'opacity-100' : 'opacity-0'
          )}
          onClick={() => setMenuOpen(false)}
        />

        {/* Menu panel */}
        <div
          className={cn(
            'absolute inset-x-0 top-0 bg-white shadow-2xl transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] overflow-y-auto max-h-[calc(100vh-4rem)]',
            menuOpen ? 'translate-y-0 opacity-100' : '-translate-y-4 opacity-0'
          )}
        >
          <div className="p-5 space-y-1">
            {primaryNav.map((item, idx) => (
              <div
                key={item.key}
                className="mobile-menu-item"
                style={{ animationDelay: menuOpen ? `${idx * 60}ms` : '0ms' }}
              >
                {item.children ? (
                  <>
                    <button
                      onClick={() => setMobileExpanded(mobileExpanded === item.key ? null : item.key)}
                      className="w-full flex items-center justify-between py-3.5 px-4 text-base font-medium rounded-xl hover:bg-[var(--color-neutral-50)] transition-colors duration-200"
                    >
                      <span>{isAr ? item.labelAr : item.labelEn}</span>
                      <svg
                        className={cn('w-4 h-4 text-[var(--color-neutral-400)] transition-transform duration-300', mobileExpanded === item.key && 'rotate-180')}
                        viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2"
                      >
                        <path d="M3 5l3 3 3-3" />
                      </svg>
                    </button>
                    <div
                      className={cn(
                        'overflow-hidden transition-all duration-300 ease-out',
                        mobileExpanded === item.key ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                      )}
                    >
                      <div className="ps-4 pb-2 space-y-0.5">
                        <a
                          href={`/${locale}${item.href}`}
                          className="block py-2.5 px-4 text-sm font-medium text-[var(--color-primary)] rounded-lg hover:bg-[var(--color-primary-50)] transition-colors"
                          onClick={() => setMenuOpen(false)}
                        >
                          {t('عرض الكل', 'View All')} <ArrowRight className="w-3.5 h-3.5 inline-block rtl:rotate-180" aria-hidden="true" />
                        </a>
                        {item.children.map((child) => (
                          <a
                            key={child.href}
                            href={`/${locale}${child.href}`}
                            className="block py-2.5 px-4 text-sm text-[var(--color-neutral-600)] hover:text-[var(--color-primary)] rounded-lg hover:bg-[var(--color-neutral-50)] transition-colors"
                            onClick={() => setMenuOpen(false)}
                          >
                            {isAr ? child.labelAr : child.labelEn}
                          </a>
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  <a
                    href={`/${locale}${item.href}`}
                    className="block py-3.5 px-4 text-base font-medium rounded-xl hover:bg-[var(--color-neutral-50)] transition-colors"
                    onClick={() => setMenuOpen(false)}
                  >
                    {isAr ? item.labelAr : item.labelEn}
                  </a>
                )}
              </div>
            ))}

            {/* Divider */}
            <div className="py-3">
              <div className="h-px bg-[var(--color-neutral-100)]" />
            </div>

            {/* Mobile CTAs */}
            <a
              href={`/${locale}/pathfinder/`}
              className="block w-full text-center rounded-xl bg-[var(--color-accent)] px-4 py-3.5 text-base font-semibold text-white shadow-[0_4px_16px_rgba(244,126,66,0.2)] hover:shadow-[0_8px_24px_rgba(244,126,66,0.3)] transition-all duration-300"
              onClick={() => setMenuOpen(false)}
            >
              {t('ابدأ رحلتك', 'Start Your Journey')}
            </a>
            <a
              href={`/${locale}/dashboard/`}
              className="block w-full text-center rounded-xl border-2 border-[var(--color-primary)] px-4 py-3 text-base font-medium text-[var(--color-primary)] hover:bg-[var(--color-primary-50)] transition-colors duration-300"
              onClick={() => setMenuOpen(false)}
            >
              {t('تسجيل الدخول', 'Login')}
            </a>
          </div>
        </div>
      </div>
    </header>
  );
}
