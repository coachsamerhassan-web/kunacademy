import { NextRequest, NextResponse } from 'next/server';
import { db } from '@kunacademy/db';
import { eq, inArray } from 'drizzle-orm';
import { providers, instructors } from '@kunacademy/db/schema';

/**
 * GET /api/booking/coaches — visible coaches for booking flow (public)
 * Query params:
 *   ?slug=<coach-slug>  — pre-filter to a single coach by instructor slug
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const slugFilter = searchParams.get('slug') ?? null;

  try {
    const providerRows = await db
      .select({ id: providers.id, profile_id: providers.profile_id })
      .from(providers)
      .where(eq(providers.is_visible, true));

    if (!providerRows.length) return NextResponse.json({ coaches: [] });

    const profileIds = providerRows.map((p) => p.profile_id).filter(Boolean) as string[];

    const instructorRows = await db
      .select({
        id: instructors.id,
        slug: instructors.slug,
        profile_id: instructors.profile_id,
        title_ar: instructors.title_ar,
        title_en: instructors.title_en,
        photo_url: instructors.photo_url,
        coach_level: instructors.coach_level,
        specialties: instructors.specialties,
      })
      .from(instructors)
      .where(inArray(instructors.profile_id, profileIds));

    const instructorByProfile = Object.fromEntries(instructorRows.map((i) => [i.profile_id, i]));

    const coaches = providerRows
      .map((p) => {
        const inst = p.profile_id ? instructorByProfile[p.profile_id] : null;
        if (!inst) return null;
        return {
          id: inst.id,           // instructors.id
          slug: inst.slug,       // for URL pre-selection
          provider_id: p.id,     // providers.id (for availability API)
          title_ar: inst.title_ar,
          title_en: inst.title_en,
          photo_url: inst.photo_url,
          coach_level: inst.coach_level,
          specialties: inst.specialties,
        };
      })
      .filter(Boolean);

    // Apply slug filter if provided (e.g. ?coach=slug in booking URL)
    const filtered = slugFilter
      ? coaches.filter((c) => c!.slug === slugFilter)
      : coaches;

    return NextResponse.json({ coaches: filtered });
  } catch (err: any) {
    console.error('[api/booking/coaches]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
