// Coach portal layout (authenticated)
import { AuthProvider } from '@kunacademy/auth';
import { getAuthUser } from '@kunacademy/auth/server';
import { db } from '@kunacademy/db';
import { eq } from 'drizzle-orm';
import { providers } from '@kunacademy/db/schema';
import { PortalSidebar } from '@/components/portal-sidebar';
import { TierGrandfatherBanner } from '@/components/coach/TierGrandfatherBanner';

export const dynamic = 'force-dynamic';

export default async function CoachLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  // Fetch the provider record to determine which sidebar items to show.
  // Default to false (safest) if the user is not logged in or has no provider row.
  let canOfferCourses = false;
  try {
    const user = await getAuthUser();
    if (user) {
      const rows = await db
        .select({ can_offer_courses: providers.can_offer_courses })
        .from(providers)
        .where(eq(providers.profile_id, user.id))
        .limit(1);
      canOfferCourses = rows[0]?.can_offer_courses ?? false;
    }
  } catch {
    // Non-fatal: if DB is unavailable, sidebar defaults to courses hidden
  }

  return (
    <AuthProvider>
      <div className="min-h-screen bg-[var(--color-surface-dim)]">
        <div className="mx-auto max-w-[var(--max-content-width)] px-4 py-8">
          <div className="flex flex-col md:flex-row gap-6">
            <PortalSidebar locale={locale} variant="coach" canOfferCourses={canOfferCourses} />
            <div className="flex-1 min-w-0">
              {/* Canon Phase 2 grandfather banner — renders only for L3/L4
                  coaches during 2026-04-24 → 2026-05-24. Auto-expires via
                  date gate in coach-tier-labels.ts. L1+L2: returns null. */}
              <TierGrandfatherBanner locale={locale} />
              {children}
            </div>
          </div>
        </div>
      </div>
    </AuthProvider>
  );
}
