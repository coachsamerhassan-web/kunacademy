'use client';

import * as React from 'react';
import { cn } from './utils';

interface NavGroup {
  key: string;
  labelAr: string;
  labelEn: string;
  icon: string;
  href: string;
  children?: { labelAr: string; labelEn: string; href: string; desc?: string }[];
}

const navGroups: NavGroup[] = [
  {
    key: 'certifications',
    labelAr: 'الشهادات',
    labelEn: 'Certifications',
    icon: '🎓',
    href: '/programs/certifications/',
    children: [
      { labelAr: 'شهادة التفكير الحسّي STCE', labelEn: 'STCE Certification', href: '/programs/certifications/stce/' },
      { labelAr: 'المستوى ١ — STIC', labelEn: 'Level 1 — STIC (79h)', href: '/programs/certifications/stce/level-1/' },
      { labelAr: 'المستوى ٢ — STAIC', labelEn: 'Level 2 — STAIC (106h)', href: '/programs/certifications/stce/level-2/' },
      { labelAr: 'المستوى ٣ — STGC', labelEn: 'Level 3 — STGC (34h)', href: '/programs/certifications/stce/level-3/' },
      { labelAr: 'المستوى ٤ — STOC', labelEn: 'Level 4 — STOC (37h)', href: '/programs/certifications/stce/level-4/' },
      { labelAr: 'الباقات', labelEn: 'Packages', href: '/programs/certifications/stce/packages/' },
      { labelAr: 'الكوتشينج الإسلامي', labelEn: 'Islamic Coaching Mastery', href: '/programs/certifications/islamic-coaching/' },
      { labelAr: 'منهجك', labelEn: 'Menhajak', href: '/programs/certifications/menhajak/' },
      { labelAr: 'إرشاد MCC', labelEn: 'MCC Mentoring', href: '/programs/certifications/mcc-mentoring/' },
    ],
  },
  {
    key: 'courses',
    labelAr: 'الدورات والورش',
    labelEn: 'Courses & Workshops',
    icon: '📚',
    href: '/programs/courses/',
    children: [
      { labelAr: 'جميع الدورات', labelEn: 'All Courses', href: '/programs/courses/' },
    ],
  },
  {
    key: 'retreats',
    labelAr: 'الخلوات',
    labelEn: 'Retreats',
    icon: '🏔️',
    href: '/programs/retreats/',
    children: [
      { labelAr: 'جميع الخلوات', labelEn: 'All Retreats', href: '/programs/retreats/' },
    ],
  },
  {
    key: 'corporate',
    labelAr: 'المؤسسات',
    labelEn: 'Corporate',
    icon: '🏢',
    href: '/programs/corporate/',
    children: [
      { labelAr: 'كتاب مدير عام', labelEn: 'GM Playbook', href: '/programs/corporate/gm-playbook/' },
      { labelAr: 'الكوتشينج التنفيذي', labelEn: 'Executive Coaching', href: '/programs/corporate/executive-coaching/' },
      { labelAr: 'تحويل الثقافة', labelEn: 'Culture Transformation', href: '/programs/corporate/culture-transformation/' },
      { labelAr: 'التيسير المؤسسي', labelEn: 'Corporate Facilitation', href: '/programs/corporate/facilitation/' },
    ],
  },
  {
    key: 'family',
    labelAr: 'الأسرة والشباب',
    labelEn: 'Family & Youth',
    icon: '👨‍👩‍👧‍👦',
    href: '/programs/family/',
    children: [
      { labelAr: 'بذور — الشباب', labelEn: 'SEEDS Youth', href: '/programs/family/seeds/' },
      { labelAr: 'بذور ١٠١ — الكبار', labelEn: 'SEEDS Adults', href: '/programs/family/seeds-adults/' },
      { labelAr: 'وِصال', labelEn: 'Wisal — Family Coaching', href: '/programs/family/wisal/' },
    ],
  },
  {
    key: 'coaching',
    labelAr: 'منصة الكوتشينج',
    labelEn: 'Coaching Platform',
    icon: '💬',
    href: '/programs/coaching/',
  },
  {
    key: 'free',
    labelAr: 'مصادر مجانية',
    labelEn: 'Free Resources',
    icon: '🎁',
    href: '/programs/free/',
  },
];

interface HeaderProps {
  locale: string;
}

export function Header({ locale }: HeaderProps) {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [megaOpen, setMegaOpen] = React.useState(false);
  const [activeGroup, setActiveGroup] = React.useState<string | null>(null);
  const isAr = locale === 'ar';

  const t = (ar: string, en: string) => (isAr ? ar : en);

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-[var(--color-neutral)]">
      <div className="mx-auto max-w-[var(--max-content-width)] px-4 flex items-center justify-between h-16">
        {/* Logo */}
        <a href={`/${locale}/`} className="font-bold text-xl text-[var(--color-primary)]">
          كُن <span className="text-sm font-normal text-[var(--color-neutral-600)]">KUN</span>
        </a>

        {/* Desktop Nav */}
        <nav className="hidden lg:flex items-center gap-6">
          <button
            onClick={() => setMegaOpen(!megaOpen)}
            className="flex items-center gap-1 text-sm font-medium hover:text-[var(--color-primary)] transition-colors min-h-[44px]"
          >
            {t('البرامج', 'Programs')}
            <span className={cn('text-xs transition-transform', megaOpen && 'rotate-180')}>▾</span>
          </button>
          <a href={`/${locale}/methodology/`} className="text-sm hover:text-[var(--color-primary)] transition-colors">
            {t('المنهجية', 'Methodology')}
          </a>
          <a href={`/${locale}/about/`} className="text-sm hover:text-[var(--color-primary)] transition-colors">
            {t('عن كُن', 'About')}
          </a>
          <a href={`/${locale}/blog/`} className="text-sm hover:text-[var(--color-primary)] transition-colors">
            {t('المقالات', 'Blog')}
          </a>
          <a href={`/${locale}/events/`} className="text-sm hover:text-[var(--color-primary)] transition-colors">
            {t('الفعاليات', 'Events')}
          </a>
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
            href={`/${locale}/portal/`}
            className="hidden sm:flex text-sm text-[var(--color-primary)] hover:underline min-h-[44px] items-center"
          >
            {t('دخول', 'Login')}
          </a>
          <a
            href={`/${locale}/programs/`}
            className="hidden sm:inline-flex items-center justify-center rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white min-h-[44px] hover:bg-[var(--color-accent-500)] transition-colors"
          >
            {t('ابدأ رحلتك', 'Start Your Journey')}
          </a>
          {/* Mobile hamburger */}
          <button
            onClick={() => { setMenuOpen(!menuOpen); setMegaOpen(false); }}
            className="lg:hidden flex items-center justify-center w-11 h-11"
            aria-label="Menu"
          >
            <span className="text-2xl">{menuOpen ? '✕' : '☰'}</span>
          </button>
        </div>
      </div>

      {/* Desktop Mega Menu */}
      {megaOpen && (
        <div className="hidden lg:block absolute top-full inset-x-0 bg-white shadow-lg border-t border-[var(--color-neutral)]">
          <div className="mx-auto max-w-[var(--max-content-width)] px-4 py-6 flex gap-0">
            {/* Left sidebar: 7 groups */}
            <div className="w-56 shrink-0 border-e border-[var(--color-neutral)] pe-4">
              {navGroups.map((g) => (
                <button
                  key={g.key}
                  onMouseEnter={() => setActiveGroup(g.key)}
                  onClick={() => setActiveGroup(activeGroup === g.key ? null : g.key)}
                  className={cn(
                    'w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-start transition-colors',
                    activeGroup === g.key
                      ? 'bg-[var(--color-primary-50)] text-[var(--color-primary)] font-medium'
                      : 'hover:bg-[var(--color-neutral-50)]'
                  )}
                >
                  <span>{g.icon}</span>
                  <span>{isAr ? g.labelAr : g.labelEn}</span>
                </button>
              ))}
              <hr className="my-3 border-[var(--color-neutral)]" />
              <a
                href={`/${locale}/programs/`}
                className="flex items-center gap-2 px-3 py-2 text-sm text-[var(--color-accent)] font-medium hover:underline"
              >
                🧭 {t('اكتشف البرنامج المناسب', 'Find Your Program')}
              </a>
            </div>
            {/* Right panel: children of active group */}
            <div className="flex-1 ps-6">
              {activeGroup && navGroups.find((g) => g.key === activeGroup)?.children ? (
                <div className="grid grid-cols-2 gap-3">
                  {navGroups
                    .find((g) => g.key === activeGroup)!
                    .children!.map((child) => (
                      <a
                        key={child.href}
                        href={`/${locale}${child.href}`}
                        className="block rounded-lg p-3 hover:bg-[var(--color-neutral-50)] transition-colors"
                      >
                        <span className="text-sm font-medium">{isAr ? child.labelAr : child.labelEn}</span>
                      </a>
                    ))}
                </div>
              ) : activeGroup ? (
                <div className="flex items-center justify-center h-full text-[var(--color-neutral-500)]">
                  <a
                    href={`/${locale}${navGroups.find((g) => g.key === activeGroup)?.href}`}
                    className="text-[var(--color-primary)] font-medium hover:underline"
                  >
                    {t('عرض الكل', 'View All')} →
                  </a>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-[var(--color-neutral-400)] text-sm">
                  {t('حرّك المؤشر على القسم لعرض التفاصيل', 'Hover on a section to see details')}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Mobile Menu (full-screen accordion) */}
      {menuOpen && (
        <div className="lg:hidden fixed inset-0 top-16 bg-white z-40 overflow-y-auto">
          <div className="p-4 space-y-1">
            {/* Programs accordion */}
            <button
              onClick={() => setMegaOpen(!megaOpen)}
              className="w-full flex items-center justify-between py-3 px-3 text-base font-medium rounded-lg hover:bg-[var(--color-neutral-50)]"
            >
              {t('البرامج', 'Programs')}
              <span className={cn('text-xs transition-transform', megaOpen && 'rotate-180')}>▾</span>
            </button>
            {megaOpen && (
              <div className="ps-4 space-y-1">
                {navGroups.map((g) => (
                  <div key={g.key}>
                    <button
                      onClick={() => setActiveGroup(activeGroup === g.key ? null : g.key)}
                      className="w-full flex items-center gap-2 py-2.5 px-3 text-sm rounded-lg hover:bg-[var(--color-neutral-50)]"
                    >
                      <span>{g.icon}</span>
                      <span>{isAr ? g.labelAr : g.labelEn}</span>
                      {g.children && (
                        <span className={cn('ms-auto text-xs transition-transform', activeGroup === g.key && 'rotate-180')}>▾</span>
                      )}
                    </button>
                    {activeGroup === g.key && g.children && (
                      <div className="ps-8 space-y-1">
                        {g.children.map((child) => (
                          <a
                            key={child.href}
                            href={`/${locale}${child.href}`}
                            className="block py-2 px-3 text-sm text-[var(--color-neutral-700)] hover:text-[var(--color-primary)] rounded-lg hover:bg-[var(--color-neutral-50)]"
                            onClick={() => setMenuOpen(false)}
                          >
                            {isAr ? child.labelAr : child.labelEn}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <a href={`/${locale}/methodology/`} className="block py-3 px-3 text-base rounded-lg hover:bg-[var(--color-neutral-50)]">
              {t('المنهجية', 'Methodology')}
            </a>
            <a href={`/${locale}/about/`} className="block py-3 px-3 text-base rounded-lg hover:bg-[var(--color-neutral-50)]">
              {t('عن كُن', 'About')}
            </a>
            <a href={`/${locale}/blog/`} className="block py-3 px-3 text-base rounded-lg hover:bg-[var(--color-neutral-50)]">
              {t('المقالات', 'Blog')}
            </a>
            <a href={`/${locale}/events/`} className="block py-3 px-3 text-base rounded-lg hover:bg-[var(--color-neutral-50)]">
              {t('الفعاليات', 'Events')}
            </a>

            <hr className="my-3 border-[var(--color-neutral)]" />

            <a
              href={`/${locale}/programs/`}
              className="block w-full text-center rounded-lg bg-[var(--color-accent)] px-4 py-3 text-base font-medium text-white"
            >
              {t('ابدأ رحلتك', 'Start Your Journey')}
            </a>
            <a
              href={`/${locale}/portal/`}
              className="block w-full text-center rounded-lg border border-[var(--color-primary)] px-4 py-3 text-base font-medium text-[var(--color-primary)]"
            >
              {t('تسجيل الدخول', 'Login')}
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
