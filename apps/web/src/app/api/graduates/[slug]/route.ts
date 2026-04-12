import { NextRequest, NextResponse } from 'next/server';
import { withUserContext } from '../../../../../../../packages/db/src/pool';
import { sql } from 'drizzle-orm';

/**
 * GET /api/graduates/[slug] — Public graduate profile
 *
 * Returns a single graduate's full profile with all certificates and
 * badge info joined from badge_definitions.
 *
 * Returns 404 if not found or is_visible = false.
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    const graduate = await withUserContext(async (userDb: any) => {
      const rows = await userDb.execute(sql`
        SELECT
          cm.id,
          cm.slug,
          cm.name_ar,
          cm.name_en,
          cm.photo_url,
          cm.bio_ar,
          cm.bio_en,
          cm.country,
          cm.languages,
          cm.member_type,
          cm.coaching_status,
          COALESCE(
            json_agg(
              json_build_object(
                'program_slug',    gc.program_slug,
                'program_name_ar', gc.program_name_ar,
                'program_name_en', gc.program_name_en,
                'badge_slug',      gc.badge_slug,
                'badge_image_url', bd.image_url,
                'badge_label_ar',  gc.badge_label_ar,
                'badge_label_en',  gc.badge_label_en,
                'graduation_date', gc.graduation_date,
                'icf_credential',  gc.icf_credential,
                'certificate_type', gc.certificate_type,
                'cohort_name',     gc.cohort_name,
                'verified',        gc.verified
              )
              ORDER BY gc.graduation_date DESC NULLS LAST
            ) FILTER (WHERE gc.id IS NOT NULL),
            '[]'::json
          ) AS certificates
        FROM community_members cm
        LEFT JOIN graduate_certificates gc ON gc.member_id = cm.id
        LEFT JOIN badge_definitions bd ON bd.slug = gc.badge_slug
        WHERE cm.slug = ${slug}
          AND cm.is_visible = true
        GROUP BY cm.id
      `);
      return rows.rows[0] ?? null;
    });

    if (!graduate) {
      return NextResponse.json(
        { error: 'Not found' },
        {
          status: 404,
          headers: CORS_HEADERS,
        }
      );
    }

    return NextResponse.json(
      { graduate },
      {
        headers: {
          ...CORS_HEADERS,
          'Cache-Control': 'public, max-age=60, stale-while-revalidate=30',
        },
      }
    );
  } catch (err: any) {
    console.error('[api/graduates/[slug] GET]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
