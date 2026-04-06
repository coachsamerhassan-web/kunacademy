import { NextRequest, NextResponse } from 'next/server';
import { db, withAdminContext } from '@kunacademy/db';
import { getAuthUser } from '@kunacademy/auth/server';
import { eq, desc, asc } from 'drizzle-orm';
import { profiles, blog_posts } from '@kunacademy/db/schema';
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
    const status = searchParams.get('status'); // 'published' | 'draft'
    const category = searchParams.get('category');
    const sortBy = searchParams.get('sortBy') || 'created_at'; // 'created_at' | 'title_en'
    const sortDir = searchParams.get('sortDir') || 'desc';

    const rows = await withAdminContext(async (adminDb) => {
      let query = `
        SELECT
          id, slug, title_ar, title_en, category, tags,
          is_published, published_at, created_at, updated_at,
          content_doc_id, excerpt_ar, excerpt_en,
          meta_title_ar, meta_title_en, meta_description_ar, meta_description_en,
          featured_image, author_id
        FROM blog_posts
        WHERE 1=1
      `;
      const params: any[] = [];

      if (status === 'published') {
        query += ` AND is_published = true`;
      } else if (status === 'draft') {
        query += ` AND is_published = false`;
      }

      if (category) {
        params.push(category);
        query += ` AND category = $${params.length}`;
      }

      const validSortCols: Record<string, string> = {
        created_at: 'created_at',
        published_at: 'published_at',
        title_en: 'title_en',
        title_ar: 'title_ar',
      };
      const col = validSortCols[sortBy] ?? 'created_at';
      const dir = sortDir === 'asc' ? 'ASC' : 'DESC';
      query += ` ORDER BY ${col} ${dir} NULLS LAST LIMIT 200`;

      const result = await adminDb.execute(sql.raw(query));
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
      content_doc_id, featured_image,
      is_published, published_at,
      tags,
    } = body;

    if (!slug || !title_ar) {
      return NextResponse.json({ error: 'slug and title_ar are required' }, { status: 400 });
    }

    const row = await withAdminContext(async (adminDb) => {
      const result = await adminDb.execute(
        sql`
          INSERT INTO blog_posts
            (slug, title_ar, title_en, category, excerpt_ar, excerpt_en,
             content_doc_id, featured_image, is_published, published_at, tags, author_id,
             created_at, updated_at)
          VALUES
            (${slug}, ${title_ar}, ${title_en ?? null}, ${category ?? null},
             ${excerpt_ar ?? null}, ${excerpt_en ?? null},
             ${content_doc_id ?? null}, ${featured_image ?? null},
             ${is_published ?? false},
             ${is_published && published_at ? published_at : is_published ? new Date().toISOString() : null},
             ${tags ? JSON.stringify(tags) : null}::text[],
             ${user.id},
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
