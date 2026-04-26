/**
 * GET /api/programs/[slug]/access — Wave F.4 (2026-04-26)
 *
 * Membership-gated program access seam.
 *
 * Behavior:
 *   - Lookup the program by slug.
 *   - Programs without `membership_tier_required` (or 'free') are open to anyone.
 *   - Programs with `membership_tier_required = 'paid_1'` require the
 *     corresponding feature in the user's tier matrix:
 *       slug = self-paced-body-foundations  →  feature_key = body_foundations_full
 *       slug = self-paced-compass-work      →  feature_key = compass_work_full
 *       slug = somatic-thinking-intro       →  feature_key = somatic_thinking_intro_full
 *   - Other (future) program slugs that map to features can be wired here.
 *
 * Returns:
 *   200 { granted: true,  program: { slug, title_ar, title_en, type } }
 *   200 { granted: false, reason, current_tier_slug?, upgrade_path }
 *   404 { error: 'program_not_found' }
 *   401 { error: 'auth_required' }   — only if program is gated
 *
 * Per F-W9 the user is auto-provisioned on signup, so anonymous users hit
 * 401 here for gated content. Free users hit 403-equivalent (granted=false).
 *
 * Spec d-canon-phase2-f5: NO Free preview of Paid content. We don't
 * return any partial body — the marketing-page render handles its own
 * teaser metadata.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { sql } from 'drizzle-orm';
import { withAdminContext, hasFeature } from '@kunacademy/db';
import { getAuthUser } from '@kunacademy/auth/server';

// Map program slugs → required feature_key. The mapping is intentionally
// explicit (rather than encoded in the programs table) so that adding a
// new feature_key to a program is a code review checkpoint, not a
// silent admin edit.
const SLUG_TO_FEATURE: Record<string, string> = {
  'self-paced-body-foundations': 'body_foundations_full',
  'self-paced-compass-work': 'compass_work_full',
  'somatic-thinking-intro': 'somatic_thinking_intro_full',
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  // 1. Lookup program
  type ProgramRow =
    | {
        slug: string;
        title_ar: string;
        title_en: string;
        type: string;
        membership_tier_required: 'free' | 'paid_1' | null;
      }
    | undefined;

  const program = await withAdminContext(async (db) => {
    const rows = await db.execute(sql`
      SELECT slug, title_ar, title_en, type, membership_tier_required
      FROM programs
      WHERE slug = ${slug}
        AND status IN ('active','coming-soon')
      LIMIT 1
    `);
    return rows.rows[0] as ProgramRow;
  });

  if (!program) {
    return NextResponse.json({ error: 'program_not_found' }, { status: 404 });
  }

  const isGated = program.type === 'membership_gated' || program.membership_tier_required != null;
  if (!isGated) {
    // Open program — no entitlement required.
    return NextResponse.json({
      granted: true,
      program: {
        slug: program.slug,
        title_ar: program.title_ar,
        title_en: program.title_en,
        type: program.type,
      },
    });
  }

  // 2. Auth required
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json(
      {
        error: 'auth_required',
        upgrade_path: '/membership/upgrade',
      },
      { status: 401 },
    );
  }

  // 3. Map to feature_key
  const featureKey = SLUG_TO_FEATURE[slug];
  if (!featureKey) {
    // Defensive: a gated program with no feature mapping is a config error.
    // Fall closed (deny) to avoid silently-open content.
    console.error(`[programs/access] No feature mapping for gated program slug=${slug}`);
    return NextResponse.json(
      {
        granted: false,
        reason: 'feature_mapping_missing',
        upgrade_path: '/membership/upgrade',
      },
      { status: 200 },
    );
  }

  // 4. Entitlement check
  const access = await hasFeature(user.id, featureKey, { cacheScope: req });

  if (access.granted) {
    return NextResponse.json({
      granted: true,
      program: {
        slug: program.slug,
        title_ar: program.title_ar,
        title_en: program.title_en,
        type: program.type,
      },
      tier_slug: access.tier_slug,
    });
  }

  return NextResponse.json({
    granted: false,
    reason: access.reason,
    current_tier_slug: access.current_tier_slug ?? null,
    required_feature: featureKey,
    upgrade_path: '/membership/upgrade',
  });
}
