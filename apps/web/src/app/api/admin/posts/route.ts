import { NextRequest, NextResponse } from 'next/server';
import { db, withAdminContext } from '@kunacademy/db';
import { getAuthUser } from '@kunacademy/auth/server';
import { eq } from 'drizzle-orm';
import { profiles } from '@kunacademy/db/schema';
import { sql } from 'drizzle-orm';

async function requireAdmin() {
  const user = await getAuthUser();
  if (!user) return null;
  const rows = await db.select({ role: profiles.role }).from(profiles).where(eq(profiles.id, user.id)).limit(1);
  const role = rows[0]?.role;
  if (role !== 'admin' && role !== 'super_admin') return null;
  return user;
}

/** GET /api/admin/posts — list all blog posts with filters */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAdmin();
    if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get('status'); // 'published' | 'draft' | ''
    const categoryParam = searchParams.get('category');
    const searchParam = searchParams.get('search');
    const sortBy = searchParams.get('sortBy') || 'created_at';
    const sortDir = searchParams.get('sortDir') || 'desc';

    const validSortCols: Record<string, string> = {
      created_at: 'created_at',
      published_at: 'published_at',
      title_en: 'title_en',
      title_ar: 'title_ar',
      display_order: 'display_order',
    };
    const col = validSortCols[sortBy] ?? 'created_at';
    const dir = sortDir === 'asc' ? 'ASC' : 'DESC';

    const rows = await withAdminContext(async (adminDb) => {
      // Use drizzle sql`` template for parameter safety; dynamic ORDER BY via sql.raw (whitelisted).
      const statusFilter =
        statusParam === 'published'
          ? sql` AND published = true`
          : statusParam === 'draft'
            ? sql` AND published = false`
            : sql``;
      const categoryFilter = categoryParam
        ? sql` AND category = ${categoryParam}`
        : sql``;
      const searchFilter = searchParam
        ? sql` AND (title_ar ILIKE ${'%' + searchParam + '%'} OR title_en ILIKE ${'%' + searchParam + '%'})`
        : sql``;

      const result = await adminDb.execute(sql`
        SELECT
          id, slug, title_ar, title_en, category, tags,
          published, published_at, created_at, updated_at,
          content_ar, content_en,
          content_doc_id, excerpt_ar, excerpt_en,
          meta_title_ar, meta_title_en, meta_description_ar, meta_description_en,
          featured_image_url, author_id, author_slug,
          reading_time_minutes, is_featured, display_order
        FROM blog_posts
        WHERE 1=1
        ${statusFilter}
        ${categoryFilter}
        ${searchFilter}
        ORDER BY ${sql.raw(col)} ${sql.raw(dir)} NULLS LAST
        LIMIT 500
      `);
      return result.rows as any[];
    });

    return NextResponse.json({ posts: rows });
  } catch (err: any) {
    console.error('[api/admin/posts GET]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/** POST /api/admin/posts — create new blog post */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAdmin();
    if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await request.json();
    const {
      slug, title_ar, title_en, category,
      excerpt_ar, excerpt_en,
      content_ar, content_en,
      content_doc_id, featured_image_url,
      published, published_at,
      tags, author_slug,
      reading_time_minutes, is_featured, display_order,
      meta_title_ar, meta_title_en, meta_description_ar, meta_description_en,
    } = body;

    if (!slug || !title_ar) {
      return NextResponse.json({ error: 'slug and title_ar are required' }, { status: 400 });
    }

    const row = await withAdminContext(async (adminDb) => {
      const result = await adminDb.execute(
        sql`
          INSERT INTO blog_posts
            (slug, title_ar, title_en, category,
             excerpt_ar, excerpt_en,
             content_ar, content_en,
             content_doc_id, featured_image_url,
             published, published_at,
             tags, author_id, author_slug,
             reading_time_minutes, is_featured, display_order,
             meta_title_ar, meta_title_en, meta_description_ar, meta_description_en,
             last_edited_by, last_edited_at,
             created_at, updated_at)
          VALUES
            (${slug}, ${title_ar}, ${title_en ?? null}, ${category ?? null},
             ${excerpt_ar ?? null}, ${excerpt_en ?? null},
             ${content_ar ?? null}, ${content_en ?? null},
             ${content_doc_id ?? null}, ${featured_image_url ?? null},
             ${published ?? false},
             ${published && published_at ? published_at : published ? new Date().toISOString() : null},
             ${tags ? JSON.stringify(tags) : null}::text[],
             ${user.id},
             ${author_slug ?? null},
             ${reading_time_minutes ?? null},
             ${is_featured ?? false},
             ${display_order ?? 0},
             ${meta_title_ar ?? null}, ${meta_title_en ?? null},
             ${meta_description_ar ?? null}, ${meta_description_en ?? null},
             ${user.id}, NOW(),
             NOW(), NOW())
          RETURNING *
        `
      );
      return result.rows[0];
    });

    return NextResponse.json({ post: row }, { status: 201 });
  } catch (err: any) {
    console.error('[api/admin/posts POST]', err);
    if (err.message?.includes('unique') || err.message?.includes('duplicate')) {
      return NextResponse.json({ error: 'Slug already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
