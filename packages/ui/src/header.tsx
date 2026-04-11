'use client';

import * as React from 'react';
import { cn } from './utils';
import { ArrowRight } from 'lucide-react';

// ─── Navigation Structure ──────────────────────────────

interface NavGroup {
  groupLabelAr: string;
  groupLabelEn: string;
  items: { labelAr: string; labelEn: string; href: string }[];
}

interface NavItem {
  key: string;
  labelAr: string;
  labelEn: string;
  href: string;
  children?: { labelAr: string; labelEn: string; href: string; descAr?: string; descEn?: string }[];
  groups?: NavGroup[];
}

const primaryNav: NavItem[] = [
  {
    key: 'programs',
    labelAr: 'البرامج',
    labelEn: 'Programs',
    href: '/programs/',
    groups: [
      // Column 1: Start Here
      {
        groupLabelAr: 'ابدأ هنا',
        groupLabelEn: 'Start Here',
        items: [
          { labelAr: 'GPS الحياة', labelEn: 'GPS of Life', href: '/programs/gps-of-life/' },
          { labelAr: 'هندسة التأثير', labelEn: 'Impact Engineering', href: '/programs/impact-engineering/' },
          { labelAr: 'دورات مسجّلة', labelEn: 'Mini-Courses', href: '/programs/micro-courses/' },
          { labelAr: 'موارد مجانية', labelEn: 'Free Resources', href: '/programs/free/' },
          { labelAr: 'ويبينارات قادمة', labelEn: 'Upcoming Webinars', href: '/events/' },
        ],
      },
      // Column 2: Certifications
      {
        groupLabelAr: 'شهادات الكوتشينج',
        groupLabelEn: 'Certifications',
        items: [
          { labelAr: 'كوتش فردي (STIC)', labelEn: 'Individual Coach (STIC)', href: '/academy/certifications/stce/level-1/' },
          { labelAr: 'كوتش متقدم (STAIC)', labelEn: 'Advanced Coach (STAIC)', href: '/academy/certifications/stce/level-2/' },
          { labelAr: 'كوتش جمعي (STGC)', labelEn: 'Group Coach (STGC)', href: '/academy/certifications/stce/level-3/' },
          { labelAr: 'كوتش مؤسسات (STOC)', labelEn: 'Organisational Coach (STOC)', href: '/academy/certifications/stce/level-4/' },
          { labelAr: 'كوتش أسري (STFC)', labelEn: 'Family Coach (STFC)', href: '/academy/certifications/stce/level-5/' },
        ],
      },
      // Column 3: Pathway Packages (منهجك)
      {
        groupLabelAr: 'منهجك — الباقات',
        groupLabelEn: 'Pathway Packages',
        items: [
          { labelAr: 'منهجك التدريبي', labelEn: 'Training Package', href: '/academy/packages/training/' },
          { labelAr: 'منهجك المؤسسي', labelEn: 'Organizational Package', href: '/academy/packages/organizational/' },
          { labelAr: 'منهجك القيادي', labelEn: 'Leadership Package', href: '/academy/packages/leadership/' },
        ],
      },
      // Column 4: Other Experiences
      {
        groupLabelAr: 'تجارب أخرى',
        groupLabelEn: 'Other Experiences',
        items: [
          { labelAr: 'رحلات الإحياء', labelEn: 'Ihya Retreats', href: '/programs/retreats/' },
          { labelAr: 'هويّتك (YPI)', labelEn: 'Your Identity (YPI)', href: '/academy/courses/your-identity/' },
          { labelAr: 'مدخل التفكير الحسّي (STI)', labelEn: 'Somatic Thinking Intro (STI)', href: '/academy/intro/' },
          { labelAr: 'حلول المؤسسات', labelEn: 'Corporate', href: '/programs/corporate/' },
          { labelAr: 'الأسرة والشباب', labelEn: 'Family & Youth', href: '/programs/family/' },
        ],
      },
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

// ─── Helpers ──────────────────────────────────────────

function getInitials(name?: string | null): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0]!.charAt(0).toUpperCase();
  return (parts[0]!.charAt(0) + parts[parts.length - 1]!.charAt(0)).toUpperCase();
}

// ─── Header Component ──────────────────────────────────

export interface HeaderUser {
  name?: string | null;
  avatar_url?: string | null;
  role?: string | null;
}

/** Bilingual daily quote passed from the server layout */
export interface DailyQuoteData {
  content_ar: string;
  content_en: string;
  author_ar: string;
  author_en: string;
}

interface HeaderProps {
  locale: string;
  user?: HeaderUser | null;
  /** Optional daily rotating Samer Hassan quote shown as Row 0 in the mega-menu */
  dailyQuote?: DailyQuoteData | null;
}

export function Header({ locale, user, dailyQuote }: HeaderProps) {
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
          {primaryNav.map((item) => {
            const hasDropdown = item.children || item.groups;
            return (
              <div
                key={item.key}
                className="relative"
                onMouseEnter={() => hasDropdown && handleMouseEnter(item.key)}
                onMouseLeave={() => hasDropdown && handleMouseLeave()}
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
                  {hasDropdown && (
                    <svg
                      className={cn('w-3 h-3 transition-transform duration-300', activeDropdown === item.key && 'rotate-180')}
                      viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2"
                    >
                      <path d="M3 5l3 3 3-3" />
                    </svg>
                  )}
                </a>

                {/* Mega-menu for groups (Programs) */}
                {item.groups && activeDropdown === item.key && (
                  <div
                    className="absolute top-full start-0 mt-2 bg-white rounded-2xl shadow-[0_12px_48px_rgba(71,64,153,0.12)] border border-[var(--color-neutral-100)] py-6 px-8 z-50"
                    style={{ animation: 'fade-in-item 0.2s ease-out', width: 'max(860px, 68vw)', maxWidth: '1020px' }}
                  >
                    {/* Row 0 — Daily Samer Hassan quote */}
                    {dailyQuote && (
                      <div className="mb-5 pb-5 border-b border-[var(--color-neutral-100)]">
                        <p className="text-sm italic text-[var(--color-neutral-600)] leading-relaxed text-center">
                          <span className="text-[var(--color-accent)] opacity-60 text-lg leading-none align-top me-1">"</span>
                          {isAr ? dailyQuote.content_ar : dailyQuote.content_en}
                          <span className="text-[var(--color-accent)] opacity-60 text-lg leading-none align-bottom ms-1">"</span>
                        </p>
                        <p className="text-xs text-[var(--color-neutral-400)] text-center mt-1.5 font-medium">
                          — {isAr ? dailyQuote.author_ar : dailyQuote.author_en}
                        </p>
                      </div>
                    )}
                    <div className="grid grid-cols-4 gap-6 mb-6">
                      {/* Column 1: Start Here */}
                      <div className="space-y-3">
                        <h3 className="text-[10px] uppercase font-semibold tracking-wider text-[var(--color-neutral-400)] mb-3">
                          {isAr ? item.groups[0].groupLabelAr : item.groups[0].groupLabelEn}
                        </h3>
                        <ul className="space-y-2">
                          {item.groups[0].items.map((link) => (
                            <li key={link.href}>
                              <a
                                href={`/${locale}${link.href}`}
                                className="text-sm text-[var(--color-neutral-700)] hover:text-[var(--color-primary)] transition-colors duration-200"
                              >
                                {isAr ? link.labelAr : link.labelEn}
                              </a>
                            </li>
                          ))}
                        </ul>
                        {/* Authority signal */}
                        <p className="text-[10px] leading-snug text-[var(--color-neutral-400)] mt-4 pt-3 border-t border-[var(--color-neutral-100)]">
                          {isAr
                            ? 'انضم لـ ٥٠٠+ كوتش مدرَّب عبر ٤ قارات'
                            : 'Join 500+ coaches trained across 4 continents'}
                        </p>
                      </div>

                      {/* Column 2: Certifications */}
                      <div className="space-y-3">
                        <h3 className="text-[10px] uppercase font-semibold tracking-wider text-[var(--color-neutral-400)] mb-3">
                          {isAr ? item.groups[1].groupLabelAr : item.groups[1].groupLabelEn}
                        </h3>
                        <ul className="space-y-2">
                          {item.groups[1].items.map((link) => (
                            <li key={link.href}>
                              <a
                                href={`/${locale}${link.href}`}
                                className="text-sm text-[var(--color-neutral-700)] hover:text-[var(--color-primary)] transition-colors duration-200"
                              >
                                {isAr ? link.labelAr : link.labelEn}
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Column 3: Pathway Packages */}
                      <div className="space-y-3">
                        <h3 className="text-[10px] uppercase font-semibold tracking-wider text-[var(--color-neutral-400)] mb-3">
                          {isAr ? item.groups[2].groupLabelAr : item.groups[2].groupLabelEn}
                        </h3>
                        <ul className="space-y-2">
                          {item.groups[2].items.map((link) => (
                            <li key={link.href}>
                              <a
                                href={`/${locale}${link.href}`}
                                className="text-sm text-[var(--color-neutral-700)] hover:text-[var(--color-primary)] transition-colors duration-200"
                              >
                                {isAr ? link.labelAr : link.labelEn}
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Column 4: Other Experiences */}
                      <div className="space-y-3">
                        <h3 className="text-[10px] uppercase font-semibold tracking-wider text-[var(--color-neutral-400)] mb-3">
                          {isAr ? item.groups[3].groupLabelAr : item.groups[3].groupLabelEn}
                        </h3>
                        <ul className="space-y-2">
                          {item.groups[3].items.map((link) => (
                            <li key={link.href}>
                              <a
                                href={`/${locale}${link.href}`}
                                className="text-sm text-[var(--color-neutral-700)] hover:text-[var(--color-primary)] transition-colors duration-200"
                              >
                                {isAr ? link.labelAr : link.labelEn}
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {/* CTA Bar */}
                    <a
                      href={`/${locale}/pathfinder/`}
                      className="flex items-center justify-center w-full rounded-xl bg-[var(--color-accent)] px-4 py-3 text-sm font-semibold text-white hover:bg-[var(--color-accent-500)] transition-all duration-300 group/cta"
                    >
                      {isAr ? 'اكتشف المسار المناسب' : 'Find Your Path'}
                      <ArrowRight className="w-4 h-4 ms-2 transition-transform group-hover/cta:translate-x-1" />
                    </a>
                  </div>
                )}

                {/* Simple dropdown for children (About) */}
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
            );
          })}
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

          {/* Auth — avatar when logged in, login link when not */}
          {user ? (
            (() => {
              const dashboardPath =
                user.role === 'admin' || user.role === 'super_admin' ? `/${locale}/admin` :
                user.role === 'provider' ? `/${locale}/coach` :
                `/${locale}/dashboard`;
              return (
                <a
                  href={dashboardPath}
                  className="hidden sm:flex items-center justify-center w-9 h-9 rounded-full overflow-hidden ring-2 ring-[var(--color-primary-100)] hover:ring-[var(--color-primary)] transition-all duration-300 flex-shrink-0"
                  aria-label={t('لوحة التحكم', 'Dashboard')}
                  title={user.name ?? t('لوحة التحكم', 'Dashboard')}
                >
                  {user.avatar_url ? (
                    <img
                      src={user.avatar_url}
                      alt={user.name ?? ''}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="w-full h-full flex items-center justify-center bg-[var(--color-primary)] text-white text-xs font-semibold uppercase">
                      {getInitials(user.name)}
                    </span>
                  )}
                </a>
              );
            })()
          ) : (
            <a
              href={`/${locale}/auth/login`}
              className="hidden sm:flex text-sm font-medium text-[var(--color-primary)] hover:text-[var(--color-primary-600)] min-h-[44px] items-center px-3 transition-colors duration-300"
            >
              {t('دخول', 'Login')}
            </a>
          )}

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
            {primaryNav.map((item, idx) => {
              const hasDropdown = item.children || item.groups;
              return (
                <div
                  key={item.key}
                  className="mobile-menu-item"
                  style={{ animationDelay: menuOpen ? `${idx * 60}ms` : '0ms' }}
                >
                  {hasDropdown ? (
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
                          mobileExpanded === item.key ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'
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

                          {/* Groups (Programs) */}
                          {item.groups && item.groups.map((group) => (
                            <div key={group.groupLabelEn} className="pt-3 first:pt-0">
                              <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-neutral-400)] px-4 mb-2">
                                {isAr ? group.groupLabelAr : group.groupLabelEn}
                              </h3>
                              {group.items.map((link) => (
                                <a
                                  key={link.href}
                                  href={`/${locale}${link.href}`}
                                  className="block py-2 px-4 text-sm text-[var(--color-neutral-600)] hover:text-[var(--color-primary)] rounded-lg hover:bg-[var(--color-neutral-50)] transition-colors"
                                  onClick={() => setMenuOpen(false)}
                                >
                                  {isAr ? link.labelAr : link.labelEn}
                                </a>
                              ))}
                            </div>
                          ))}

                          {/* Children (About) */}
                          {item.children && item.children.map((child) => (
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
              );
            })}

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

            {/* Mobile auth — show user info or login */}
            {user ? (
              (() => {
                const dashboardPath =
                  user.role === 'admin' || user.role === 'super_admin' ? `/${locale}/admin` :
                  user.role === 'provider' ? `/${locale}/coach` :
                  `/${locale}/dashboard`;
                return (
                  <a
                    href={dashboardPath}
                    className="flex items-center gap-3 w-full rounded-xl border-2 border-[var(--color-primary)] px-4 py-3 text-base font-medium text-[var(--color-primary)] hover:bg-[var(--color-primary-50)] transition-colors duration-300"
                    onClick={() => setMenuOpen(false)}
                  >
                    <span className="flex items-center justify-center w-8 h-8 rounded-full overflow-hidden bg-[var(--color-primary)] text-white text-xs font-semibold uppercase flex-shrink-0">
                      {user.avatar_url ? (
                        <img src={user.avatar_url} alt={user.name ?? ''} className="w-full h-full object-cover" />
                      ) : (
                        getInitials(user.name)
                      )}
                    </span>
                    <span>{user.name ?? t('لوحة التحكم', 'Dashboard')}</span>
                  </a>
                );
              })()
            ) : (
              <a
                href={`/${locale}/auth/login`}
                className="block w-full text-center rounded-xl border-2 border-[var(--color-primary)] px-4 py-3 text-base font-medium text-[var(--color-primary)] hover:bg-[var(--color-primary-50)] transition-colors duration-300"
                onClick={() => setMenuOpen(false)}
              >
                {t('تسجيل الدخول', 'Login')}
              </a>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
