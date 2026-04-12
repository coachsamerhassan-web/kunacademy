import { NextRequest, NextResponse } from 'next/server';
import { db } from '@kunacademy/db';
import { and, eq, inArray } from 'drizzle-orm';
import { providers, instructors, services, coach_services } from '@kunacademy/db/schema';

/**
 * GET /api/booking/coaches — visible coaches for booking flow (public)
 * Query params:
 *   ?slug=<coach-slug>       — pre-filter to a single coach by instructor slug
 *   ?service_id=<uuid>       — filter coaches by service opt-in and eligible_kun_levels
 *                              Also returns coach's custom_price_aed if set in coach_services.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const slugFilter = searchParams.get('slug') ?? null;
  const serviceId = searchParams.get('service_id') ?? null;

  try {
    // ── Resolve service constraints if service_id is provided ──
    let coachControl: string | null = null;
    let eligibleKunLevels: string[] | null = null;

    if (serviceId) {
      const [svcRow] = await db
        .select({
          coach_control: services.coach_control,
          eligible_kun_levels: services.eligible_kun_levels,
        })
        .from(services)
        .where(eq(services.id, serviceId))
        .limit(1);

      if (svcRow) {
        coachControl = svcRow.coach_control;
        eligibleKunLevels = svcRow.eligible_kun_levels ?? null;
      }
    }

    // ── Fetch visible providers ──
    const providerRows = await db
      .select({ id: providers.id, profile_id: providers.profile_id })
      .from(providers)
      .where(eq(providers.is_visible, true));

    if (!providerRows.length) return NextResponse.json({ coaches: [] });

    const profileIds = providerRows.map((p) => p.profile_id).filter(Boolean) as string[];
    // ── Fetch instructor records ──
    const instructorRows = await db
      .select({
        id: instructors.id,
        slug: instructors.slug,
        profile_id: instructors.profile_id,
        title_ar: instructors.title_ar,
        title_en: instructors.title_en,
        photo_url: instructors.photo_url,
        coach_level: instructors.coach_level,
        kun_level: instructors.kun_level,
        specialties: instructors.specialties,
      })
      .from(instructors)
      .where(inArray(instructors.profile_id, profileIds));

    const instructorByProfile = Object.fromEntries(instructorRows.map((i) => [i.profile_id, i]));

    // ── Build base coach list ──
    type CoachEntry = {
      id: string;
      slug: string | null;
      provider_id: string;
      title_ar: string;
      title_en: string;
      photo_url: string | null;
      coach_level: string | null;
      kun_level: string | null;
      specialties: string[] | null;
      custom_price_aed: number | null;
    };

    let coaches: CoachEntry[] = providerRows
      .map((p) => {
        const inst = p.profile_id ? instructorByProfile[p.profile_id] : null;
        if (!inst) return null;
        return {
          id: inst.id,
          slug: inst.slug,
          provider_id: p.id,
          title_ar: inst.title_ar,
          title_en: inst.title_en,
          photo_url: inst.photo_url,
          coach_level: inst.coach_level,
          kun_level: inst.kun_level,
          specialties: inst.specialties,
          custom_price_aed: null as number | null,
        };
      })
      .filter((c): c is CoachEntry => c !== null);

    // ── Apply eligible_kun_levels filter ──
    if (eligibleKunLevels && eligibleKunLevels.length > 0) {
      coaches = coaches.filter(
        (c) => c.kun_level && eligibleKunLevels!.includes(c.kun_level)
      );
    }

    // ── Apply opt-in filter + attach custom prices ──
    if (serviceId && coachControl && coachControl !== 'mandatory') {
      // For 'optional' and 'admin_only': only show coaches with is_active = true in coach_services
      const providerIds = coaches.map((c) => c.provider_id);

      if (providerIds.length > 0) {
        const csRows = await db
          .select({
            provider_id: coach_services.provider_id,
            is_active: coach_services.is_active,
            custom_price_aed: coach_services.custom_price_aed,
          })
          .from(coach_services)
          .where(
            and(
              eq(coach_services.service_id, serviceId),
              inArray(coach_services.provider_id, providerIds)
            )
          );

        const csMap = Object.fromEntries(csRows.map((r) => [r.provider_id, r]));

        coaches = coaches.filter((c) => csMap[c.provider_id]?.is_active === true);
        coaches = coaches.map((c) => ({
          ...c,
          custom_price_aed: csMap[c.provider_id]?.custom_price_aed ?? null,
        }));
      } else {
        coaches = [];
      }
    } else if (serviceId && coachControl === 'mandatory') {
      // Mandatory: show all eligible coaches, still attach custom prices if any
      const providerIds = coaches.map((c) => c.provider_id);
      if (providerIds.length > 0) {
        const csRows = await db
          .select({
            provider_id: coach_services.provider_id,
            custom_price_aed: coach_services.custom_price_aed,
          })
          .from(coach_services)
          .where(
            and(
              eq(coach_services.service_id, serviceId),
              inArray(coach_services.provider_id, providerIds)
            )
          );

        const csMap = Object.fromEntries(csRows.map((r) => [r.provider_id, r]));
        coaches = coaches.map((c) => ({
          ...c,
          custom_price_aed: csMap[c.provider_id]?.custom_price_aed ?? null,
        }));
      }
    }

    // ── Apply slug filter ──
    const filtered = slugFilter
      ? coaches.filter((c) => c.slug === slugFilter)
      : coaches;

    return NextResponse.json({ coaches: filtered });
  } catch (err: any) {
    console.error('[api/booking/coaches]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
