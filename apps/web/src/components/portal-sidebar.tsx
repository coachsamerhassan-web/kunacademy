'use client';

import { Fragment } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@kunacademy/auth';

interface NavItem {
  href: string;
  labelAr: string;
  labelEn: string;
  icon: string;
}

const dashboardNav: NavItem[] = [
  { href: '/dashboard', labelAr: 'الرئيسية', labelEn: 'Overview', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { href: '/dashboard/courses', labelAr: 'دوراتي', labelEn: 'My Courses', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
  { href: '/dashboard/bookings', labelAr: 'الحجوزات', labelEn: 'Bookings', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
  { href: '/dashboard/bookshelf', labelAr: 'المكتبة', labelEn: 'Library', icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10' },
  { href: '/dashboard/orders', labelAr: 'المشتريات', labelEn: 'Orders', icon: 'M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z' },
  { href: '/dashboard/certificates', labelAr: 'الشهادات', labelEn: 'Certificates', icon: 'M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z' },
  { href: '/dashboard/payments', labelAr: 'المدفوعات', labelEn: 'Payments', icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z' },
  { href: '/dashboard/referrals', labelAr: 'الإحالات', labelEn: 'Referrals', icon: 'M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z' },
  { href: '/dashboard/profile', labelAr: 'الملف الشخصي', labelEn: 'Profile', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
];

const coachNav: NavItem[] = [
  { href: '/coach', labelAr: 'الرئيسية', labelEn: 'Overview', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { href: '/coach/schedule', labelAr: 'المواعيد', labelEn: 'Schedule', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
  { href: '/coach/bookings', labelAr: 'الحجوزات', labelEn: 'Bookings', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z' },
  { href: '/coach/services', labelAr: 'خدماتي', labelEn: 'My Services', icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
  { href: '/coach/earnings', labelAr: 'الأرباح', labelEn: 'Earnings', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  { href: '/coach/ratings', labelAr: 'تقييماتي', labelEn: 'Ratings', icon: 'M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z' },
  { href: '/coach/payout', labelAr: 'السحب', labelEn: 'Payout', icon: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z' },
  { href: '/coach/referrals', labelAr: 'الإحالات', labelEn: 'Referrals', icon: 'M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z' },
  { href: '/coach/products', labelAr: 'المنتجات', labelEn: 'Products', icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4' },
  { href: '/coach/profile', labelAr: 'الملف الشخصي', labelEn: 'Profile', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
];

const adminNav: NavItem[] = [
  { href: '/admin', labelAr: 'الرئيسية', labelEn: 'Overview', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { href: '/admin/orders', labelAr: 'الطلبات', labelEn: 'Orders', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' },
  { href: '/admin/payouts', labelAr: 'المستحقات', labelEn: 'Payouts', icon: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z' },
  { href: '/admin/commissions', labelAr: 'العمولات', labelEn: 'Commissions', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  { href: '/admin/students', labelAr: 'الطلاب', labelEn: 'Students', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z' },
  { href: '/admin/instructors', labelAr: 'الكوتشز', labelEn: 'Coaches', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
  { href: '/admin/bookings', labelAr: 'الحجوزات', labelEn: 'Bookings', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
  { href: '/admin/users', labelAr: 'المستخدمين', labelEn: 'Users', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
  { href: '/admin/discount-codes', labelAr: 'أكواد الخصم', labelEn: 'Discount Codes', icon: 'M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z' },
  { href: '/admin/courses', labelAr: 'الدورات', labelEn: 'Courses', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
  { href: '/admin/products', labelAr: 'المنتجات', labelEn: 'Products', icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4' },
  { href: '/admin/services/manage', labelAr: 'الخدمات', labelEn: 'Services', icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
  { href: '/admin/referrals', labelAr: 'الإحالات', labelEn: 'Referrals', icon: 'M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z' },
  { href: '/admin/posts', labelAr: 'المقالات', labelEn: 'Posts', icon: 'M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z' },
  { href: '/admin/testimonials', labelAr: 'التوصيات', labelEn: 'Testimonials', icon: 'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z' },
  { href: '/admin/pathfinder', labelAr: 'كشف الطريق', labelEn: 'Pathfinder', icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z' },
  { href: '/admin/community', labelAr: 'المجتمع', labelEn: 'Community', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z' },
  { href: '/admin/graduates', labelAr: 'الخريجون', labelEn: 'Graduates', icon: 'M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z' },
  { href: '/admin/content', labelAr: 'المحتوى', labelEn: 'Content', icon: 'M4 6h16M4 10h16M4 14h16M4 18h16' },
  { href: '/admin/lp', labelAr: 'صفحات الهبوط', labelEn: 'Landing Pages', icon: 'M4 5a1 1 0 011-1h14a1 1 0 011 1v4H4V5zm0 6h16v8a1 1 0 01-1 1H5a1 1 0 01-1-1v-8zm3 3h4v2H7v-2z' },
  { href: '/admin/static-pages', labelAr: 'صفحات الموقع', labelEn: 'Site Pages', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
  { href: '/admin/programs', labelAr: 'البرامج', labelEn: 'Programs', icon: 'M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222' },
  { href: '/admin/events', labelAr: 'الفعاليات', labelEn: 'Events', icon: 'M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z' },
  { href: '/admin/corporate-benefits', labelAr: 'مزايا الشركات', labelEn: 'Corporate Benefits', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
  { href: '/admin/scholarships', labelAr: 'المنح', labelEn: 'Scholarships', icon: 'M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7' },
  { href: '/admin/membership', labelAr: 'الاشتراكات', labelEn: 'Membership', icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
  { href: '/admin/quick-access', labelAr: 'الوصول السريع', labelEn: 'Quick Access', icon: 'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z' },
];

/**
 * Mid-list dividers — split the nav into "operations" (top group) and
 * "content" (bottom group) for visual scannability. Per Stitch dashboard
 * pattern — a hairline border between distinct functional groups.
 *
 * Index = position AFTER which the divider appears.
 *  - dashboardNav:  divider after Bookings (index 2) — pre = personal, post = library/orders/etc
 *  - coachNav:      divider after Earnings (index 4) — pre = work intake, post = analytics/payouts/profile
 *  - adminNav:      divider after Discount Codes (index 8) — pre = operations, post = content
 */
const NAV_DIVIDERS: Record<'dashboard' | 'coach' | 'admin', number> = {
  dashboard: 2,
  coach: 4,
  admin: 8,
};

interface PortalSidebarProps {
  locale: string;
  variant: 'dashboard' | 'coach' | 'admin';
  /** Coach portal only: when false, the Products/Courses link is hidden */
  canOfferCourses?: boolean;
}

export function PortalSidebar({ locale, variant, canOfferCourses }: PortalSidebarProps) {
  const pathname = usePathname();
  const { signOut, user } = useAuth();
  const isAr = locale === 'ar';

  let baseItems = variant === 'dashboard' ? dashboardNav : variant === 'coach' ? coachNav : adminNav;

  // Gate the products/courses link for coaches: only show when explicitly enabled by admin
  if (variant === 'coach' && !canOfferCourses) {
    baseItems = baseItems.filter((item) => item.href !== '/coach/products');
  }

  const items = baseItems;
  const dividerAfter = NAV_DIVIDERS[variant];

  // Greeting — fall back gracefully if user/name not yet loaded
  const displayName = user?.name?.trim() || user?.email?.split('@')[0] || '';
  const greeting = isAr
    ? displayName
      ? `مرحباً، ${displayName}`
      : 'مرحباً'
    : displayName
      ? `Welcome, ${displayName}`
      : 'Welcome';

  // Avatar — first letter of name/email, fallback to a neutral glyph
  const avatarSeed = displayName || user?.email || '';
  const avatarChar = avatarSeed ? avatarSeed.charAt(0).toUpperCase() : '·';

  const variantLabel = isAr
    ? variant === 'admin'
      ? 'الإدارة'
      : variant === 'coach'
        ? 'الكوتش'
        : 'الطالب'
    : variant === 'admin'
      ? 'Admin'
      : variant === 'coach'
        ? 'Coach'
        : 'Student';

  return (
    <>
      {/* Mobile horizontal scroll bar — preserved from prior shell.
          Desktop sidebar (Stitch×Kun) below is hidden on small screens. */}
      <nav
        className="md:hidden w-full kun-shell-card mb-4 px-2 py-2"
        aria-label={isAr ? 'القائمة' : 'Navigation'}
      >
        <div className="flex gap-1 overflow-x-auto pb-1 -mx-1 px-1">
          {items.map((item) => {
            const fullHref = `/${locale}${item.href}`;
            const isActive = pathname === fullHref || (item.href !== '/dashboard' && item.href !== '/coach' && item.href !== '/admin' && pathname.startsWith(fullHref));
            return (
              <a
                key={item.href}
                href={fullHref}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors min-h-[44px] ${
                  isActive
                    ? 'bg-[var(--color-accent)] text-white'
                    : 'text-[var(--color-neutral-700)] hover:bg-[var(--color-surface-low)]'
                }`}
              >
                <svg aria-hidden="true" className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                </svg>
                <span>{isAr ? item.labelAr : item.labelEn}</span>
              </a>
            );
          })}
          <button
            type="button"
            onClick={signOut}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors min-h-[44px] text-[var(--color-neutral-700)] hover:bg-red-50 hover:text-red-600"
          >
            <svg aria-hidden="true" className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span>{isAr ? 'تسجيل الخروج' : 'Sign Out'}</span>
          </button>
        </div>
      </nav>

      {/* Desktop sidebar — Stitch layout, Kun palette */}
      <aside
        className="hidden md:flex kun-shell-sidebar w-64 shrink-0 flex-col h-screen sticky top-0 self-start"
        aria-label={isAr ? 'القائمة الجانبية' : 'Sidebar navigation'}
      >
        {/* User profile header */}
        <div className="px-6 py-5 flex items-center gap-3 kun-shell-sidebar-divider border-b">
          {user?.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.image}
              alt={displayName || 'User'}
              className="w-10 h-10 rounded-full object-cover bg-[var(--shell-tile-mandarin-bg)]"
            />
          ) : (
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white"
              style={{ background: 'var(--shell-sidebar-active-bg)' }}
              aria-hidden="true"
            >
              {avatarChar}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-white truncate">{greeting}</div>
            <div className="text-[11px] text-[var(--shell-sidebar-text)] opacity-80 truncate">{variantLabel}</div>
          </div>
        </div>

        {/* Nav list with mid-divider */}
        <nav className="flex-1 overflow-y-auto py-4 text-sm" aria-label={isAr ? 'القائمة' : 'Navigation'}>
          <ul className="space-y-1">
            {items.map((item, idx) => {
              const fullHref = `/${locale}${item.href}`;
              const isActive = pathname === fullHref || (item.href !== '/dashboard' && item.href !== '/coach' && item.href !== '/admin' && pathname.startsWith(fullHref));
              const node = (
                <li key={item.href}>
                  <a
                    href={fullHref}
                    aria-current={isActive ? 'page' : undefined}
                    className={`flex items-center gap-3 px-6 py-2.5 ${
                      isActive
                        ? 'kun-shell-sidebar-link-active rounded-e-full me-4'
                        : 'kun-shell-sidebar-link'
                    }`}
                  >
                    <svg aria-hidden="true" className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                      <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                    </svg>
                    <span>{isAr ? item.labelAr : item.labelEn}</span>
                  </a>
                </li>
              );
              // Inject divider AFTER the item at index `dividerAfter`.
              // Use Fragment with key — <span> cannot be a child of <ul>.
              if (idx === dividerAfter) {
                return (
                  <Fragment key={`${item.href}-with-divider`}>
                    {node}
                    <li className="pt-3 pb-2" aria-hidden="true">
                      <div className="kun-shell-sidebar-divider mx-6" />
                    </li>
                  </Fragment>
                );
              }
              return node;
            })}
          </ul>
        </nav>

        {/* Sign-out footer */}
        <div className="px-6 py-5 mt-auto kun-shell-sidebar-divider border-t">
          <button
            type="button"
            onClick={signOut}
            className="flex items-center gap-3 text-sm kun-shell-sidebar-link w-full text-start"
          >
            <svg aria-hidden="true" className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span>{isAr ? 'تسجيل الخروج' : 'Sign Out'}</span>
          </button>
        </div>
      </aside>
    </>
  );
}

// Test-only exports — used by structural regression tests to guard against
// accidental data deletion (per dispatch). NOT consumed by render code.
export const __testOnly = {
  dashboardNav,
  coachNav,
  adminNav,
  NAV_DIVIDERS,
};
