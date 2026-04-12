import { NextRequest, NextResponse } from 'next/server';
import { db, withAdminContext } from '@kunacademy/db';
import { getAuthUser } from '@kunacademy/auth/server';
import { eq, and } from 'drizzle-orm';
import { services, coach_services, providers, instructors } from '@kunacademy/db/schema';

/** Resolve provider_id + kun_level for the authenticated coach */
async function resolveCoach(userId: string) {
  const instructorRows = await db
    .select({ id: instructors.id, kun_level: instructors.kun_level })
    .from(instructors)
    .where(eq(instructors.profile_id, userId))
    .limit(1);

  const instructor = instructorRows[0] ?? null;
  if (!instructor) return null;

  const providerRows = await db
    .select({ id: providers.id })
    .from(providers)
    .where(eq(providers.profile_id, userId))
    .limit(1);

  const provider = providerRows[0] ?? null;
  if (!provider) return null;

  return { instructor, provider_id: provider.id };
}

/**
 * GET /api/coach/services
 * Returns services eligible for this coach (by kun_level) with opt-in status.
 * - mandatory: always active, no toggle
 * - optional: shown with toggle
 * - admin_only: only shown if a coach_services row exists (admin-assigned)
 */
export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const coach = await resolveCoach(user.id);
    if (!coach) return NextResponse.json({ services: [], provider_id: null });

    const { instructor, provider_id } = coach;
    const kunLevel = instructor.kun_level;

    // Fetch all services
    const allServices = await db
      .select()
      .from(services) as Array<typeof services.$inferSelect>;

    // Fetch this coach's coach_services rows
    const coachServiceRows = await db
      .select()
      .from(coach_services)
      .where(eq(coach_services.provider_id, provider_id)) as Array<typeof coach_services.$inferSelect>;

    const coachServiceMap = Object.fromEntries(coachServiceRows.map((cs) => [cs.service_id, cs]));

    const result = allServices
      .filter((svc) => {
        if (!svc.is_active) return false;

        // Eligibility: null means all levels, otherwise check if coach level is in array
        const eligible =
          !svc.eligible_kun_levels ||
          svc.eligible_kun_levels.length === 0 ||
          (kunLevel !== null && svc.eligible_kun_levels.includes(kunLevel));

        if (!eligible) return false;

        // admin_only: only show if admin assigned a row
        if (svc.coach_control === 'admin_only') {
          return Boolean(coachServiceMap[svc.id]);
        }

        // mandatory + optional: always show
        return true;
      })
      .map((svc) => {
        const cs = coachServiceMap[svc.id] ?? null;
        // mandatory is always active regardless of cs row
        const is_active =
          svc.coach_control === 'mandatory'
            ? true
            : cs?.is_active ?? false;

        return {
          id: svc.id,
          slug: svc.slug,
          name_ar: svc.name_ar,
          name_en: svc.name_en,
          description_ar: svc.description_ar,
          description_en: svc.description_en,
          duration_minutes: svc.duration_minutes,
          price_aed: svc.price_aed,
          price_egp: svc.price_egp,
          coach_control: svc.coach_control,
          allows_coach_pricing: svc.allows_coach_pricing,
          min_price_aed: svc.min_price_aed,
          min_price_egp: svc.min_price_egp,
          min_price_eur: svc.min_price_eur,
          // coach-specific
          is_active,
          custom_price_aed: cs?.custom_price_aed ?? null,
          custom_price_egp: cs?.custom_price_egp ?? null,
          custom_price_eur: cs?.custom_price_eur ?? null,
          coach_service_id: cs?.id ?? null,
        };
      });

    return NextResponse.json({ services: result, provider_id });
  } catch (err: any) {
    console.error('[api/coach/services GET]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * PATCH /api/coach/services
 * Toggle opt-in or set custom price for an optional service.
 * Body: { service_id, is_active?, custom_price_aed?, custom_price_egp?, custom_price_eur? }
 */
export async function PATCH(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    let body: {
      service_id?: string;
      is_active?: boolean;
      custom_price_aed?: number | null;
      custom_price_egp?: number | null;
      custom_price_eur?: number | null;
    };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const { service_id, is_active, custom_price_aed, custom_price_egp, custom_price_eur } = body;

    if (!service_id) {
      return NextResponse.json({ error: 'service_id is required' }, { status: 400 });
    }

    const coach = await resolveCoach(user.id);
    if (!coach) return NextResponse.json({ error: 'Coach record not found' }, { status: 403 });

    const { provider_id } = coach;

    // Fetch the service
    const [svc] = await db
      .select()
      .from(services)
      .where(eq(services.id, service_id))
      .limit(1) as Array<typeof services.$inferSelect>;

    if (!svc) return NextResponse.json({ error: 'Service not found' }, { status: 404 });

    // Only optional services can be toggled by the coach
    if (svc.coach_control !== 'optional') {
      return NextResponse.json(
        { error: `Cannot modify service with coach_control='${svc.coach_control}'` },
        { status: 403 },
      );
    }

    // Validate custom prices against minimums
    if (custom_price_aed !== undefined && custom_price_aed !== null) {
      if (!svc.allows_coach_pricing) {
        return NextResponse.json({ error: 'Custom pricing not allowed for this service' }, { status: 400 });
      }
      if (custom_price_aed < svc.min_price_aed) {
        return NextResponse.json(
          { error: `custom_price_aed must be >= ${svc.min_price_aed}` },
          { status: 400 },
        );
      }
    }
    if (custom_price_egp !== undefined && custom_price_egp !== null) {
      if (!svc.allows_coach_pricing) {
        return NextResponse.json({ error: 'Custom pricing not allowed for this service' }, { status: 400 });
      }
      if (custom_price_egp < svc.min_price_egp) {
        return NextResponse.json(
          { error: `custom_price_egp must be >= ${svc.min_price_egp}` },
          { status: 400 },
        );
      }
    }
    if (custom_price_eur !== undefined && custom_price_eur !== null) {
      if (!svc.allows_coach_pricing) {
        return NextResponse.json({ error: 'Custom pricing not allowed for this service' }, { status: 400 });
      }
      if (custom_price_eur < svc.min_price_eur) {
        return NextResponse.json(
          { error: `custom_price_eur must be >= ${svc.min_price_eur}` },
          { status: 400 },
        );
      }
    }

    // Upsert coach_services row
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (is_active !== undefined) updates.is_active = Boolean(is_active);
    if (custom_price_aed !== undefined) updates.custom_price_aed = custom_price_aed;
    if (custom_price_egp !== undefined) updates.custom_price_egp = custom_price_egp;
    if (custom_price_eur !== undefined) updates.custom_price_eur = custom_price_eur;

    // Check for existing row
    const [existing] = await db
      .select({ id: coach_services.id })
      .from(coach_services)
      .where(and(eq(coach_services.provider_id, provider_id), eq(coach_services.service_id, service_id)))
      .limit(1);

    const [result] = await withAdminContext(async (adminDb) => {
      if (existing) {
        return adminDb
          .update(coach_services)
          .set(updates as Parameters<ReturnType<typeof adminDb.update>['set']>[0])
          .where(and(eq(coach_services.provider_id, provider_id), eq(coach_services.service_id, service_id)))
          .returning();
      } else {
        return adminDb
          .insert(coach_services)
          .values({
            provider_id,
            service_id,
            is_active: is_active !== undefined ? Boolean(is_active) : false,
            assigned_by: 'coach',
            custom_price_aed: custom_price_aed ?? null,
            custom_price_egp: custom_price_egp ?? null,
            custom_price_eur: custom_price_eur ?? null,
          })
          .returning();
      }
    }) as Array<typeof coach_services.$inferSelect>;

    return NextResponse.json({ coach_service: result });
  } catch (err: any) {
    console.error('[api/coach/services PATCH]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
