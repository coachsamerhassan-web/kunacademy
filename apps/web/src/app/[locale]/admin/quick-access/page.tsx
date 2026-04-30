import { setRequestLocale } from 'next-intl/server';
import { QuickAccessManager } from './quick-access-manager';

/**
 * Phase 1d-B (2026-04-30) — admin Quick Access management
 *
 * Server entry. Resolves locale, then delegates to the client manager.
 */
export default async function AdminQuickAccessPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  return (
    <div className="space-y-6 max-w-[1100px]">
      <header className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-3">
        <div>
          <h1
            className="text-2xl md:text-3xl font-bold text-[var(--text-primary)]"
            style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
          >
            {isAr ? 'الوصول السريع' : 'Quick Access'}
          </h1>
          <p className="text-sm text-[var(--color-neutral-600)] mt-1">
            {isAr
              ? 'إدارة لوحة الاختصارات على الصفحة الرئيسية للوحة التحكم'
              : 'Manage the shortcut tiles shown on the admin overview page.'}
          </p>
        </div>
      </header>
      <QuickAccessManager locale={locale} />
    </div>
  );
}
