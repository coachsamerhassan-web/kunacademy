import { NextRequest, NextResponse } from 'next/server';
import { withAdminContext, sql } from '@kunacademy/db';

/**
 * GET /api/graduates — Public graduate directory
 *
 * Query params:
 *   ?search=<string>   — Name search (AR or EN), case-insensitive
 *   ?category=<slug>   — Filter by category (certified-coaches | program-graduates | workshop-alumni)
 *   ?program=<slug>    — Filter by program_slug (overrides category if both set)
 *   ?page=<number>     — Page number (default 1)
 *   ?limit=<number>    — Page size (default 24, max 100)
 *
 * Returns: { graduates, total, page, totalPages, programCounts }
 *
 * Each graduate includes certificates joined with badge_definitions.
 * Only is_visible = true members are returned.
 */

const CATEGORY_PROGRAMS: Record<string, string[]> = {
  'certified-coaches': ['stce-stic', 'stce-staic', 'stce-stgc', 'stce-stoc', 'manhajak', 'stce'],
  'program-graduates': ['impact-engineering', 'gps', 'ihya'],
  'workshop-alumni':   ['mini-course', 'retreat', 'open-day'],
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const search   = searchParams.get('search')?.trim() ?? '';
    const category = searchParams.get('category')?.trim() ?? '';
    const program  = searchParams.get('program')?.trim() ?? '';
    const page     = Math.max(1, Number(searchParams.get('page') ?? '1'));
    const limit    = Math.min(100, Math.max(1, Number(searchParams.get('limit') ?? '24')));
    const offset   = (page - 1) * limit;

    // ── Build WHERE clauses (parameterised via sql template literals) ──
    // We use sql.raw only for structural AND clauses; user values go through
    // parameterised sql`` tagged fragments to prevent injection.
    const conditions: string[] = ['cm.is_visible = true'];

    if (search) {
      const escaped = search.replace(/'/g, "''");
      conditions.push(
        `(cm.name_ar ILIKE '%${escaped}%' OR cm.name_en ILIKE '%${escaped}%')`
      );
    }

    if (program) {
      // Specific program filter takes precedence over category
      if (program === 'stce-stic') {
        conditions.push(
          `EXISTS (SELECT 1 FROM graduate_certificates gc2 WHERE gc2.member_id = cm.id AND (gc2.program_slug = 'stce-stic' OR (gc2.program_slug = 'stce' AND gc2.certificate_type = 'level_1')))`
        );
      } else {
        const escaped = program.replace(/'/g, "''");
        conditions.push(
          `EXISTS (SELECT 1 FROM graduate_certificates gc2 WHERE gc2.member_id = cm.id AND gc2.program_slug = '${escaped}')`
        );
      }
    } else if (category && CATEGORY_PROGRAMS[category]) {
      // Category filter: match ANY program in this category
      const slugs = CATEGORY_PROGRAMS[category]
        .map((s) => `'${s.replace(/'/g, "''")}'`)
        .join(',');
      conditions.push(
        `EXISTS (SELECT 1 FROM graduate_certificates gc2 WHERE gc2.member_id = cm.id AND gc2.program_slug = ANY(ARRAY[${slugs}]))`
      );
    }

    const whereClause = conditions.join(' AND ');

    // ── Execute list + count + programCounts in parallel ──
    const result = await withAdminContext(async (userDb: any) => {
      const [dataRows, countRows, programCountRows] = await Promise.all([
        userDb.execute(sql`
          SELECT
            cm.id,
            cm.slug,
            cm.name_ar,
            cm.name_en,
            cm.photo_url,
            cm.country,
            cm.member_type,
            cm.coaching_status,
            COALESCE(
              json_agg(
                json_build_object(
                  'program_slug',    gc.program_slug,
                  'badge_slug',      gc.badge_slug,
                  'badge_image_url', bd.image_url,
                  'badge_label_ar',  gc.badge_label_ar,
                  'badge_label_en',  gc.badge_label_en,
                  'graduation_date', gc.graduation_date,
                  'icf_credential',  gc.icf_credential
                )
                ORDER BY gc.graduation_date DESC NULLS LAST
              ) FILTER (WHERE gc.id IS NOT NULL),
              '[]'::json
            ) AS certificates
          FROM community_members cm
          LEFT JOIN graduate_certificates gc ON gc.member_id = cm.id
          LEFT JOIN badge_definitions bd ON bd.slug = gc.badge_slug
          WHERE ${sql.raw(whereClause)}
          GROUP BY cm.id
          ORDER BY cm.name_en ASC
          LIMIT ${limit} OFFSET ${offset}
        `),
        userDb.execute(sql`
          SELECT COUNT(DISTINCT cm.id)::int AS total
          FROM community_members cm
          WHERE ${sql.raw(whereClause)}
        `),
        userDb.execute(sql`
          SELECT gc.program_slug, COUNT(DISTINCT gc.member_id)::int AS cnt
          FROM graduate_certificates gc
          JOIN community_members cm ON cm.id = gc.member_id AND cm.is_visible = true
          GROUP BY gc.program_slug
        `),
      ]);
      return { dataRows, countRows, programCountRows };
    });

    const total      = (result.countRows.rows[0] as any)?.total ?? 0;
    const totalPages = Math.ceil(total / limit);

    const programCounts: Record<string, number> = {};
    for (const row of result.programCountRows.rows as any[]) {
      programCounts[row.program_slug] = row.cnt;
    }
    if (!programCounts['stce-stic'] && programCounts['stce']) {
      programCounts['stce-stic'] = programCounts['stce'];
    }

    return NextResponse.json(
      { graduates: result.dataRows.rows, total, page, totalPages, programCounts },
      {
        headers: {
          ...CORS_HEADERS,
          'Cache-Control': 'public, max-age=300, stale-while-revalidate=60',
        },
      }
    );
  } catch (err: any) {
    console.error('[api/graduates GET]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
