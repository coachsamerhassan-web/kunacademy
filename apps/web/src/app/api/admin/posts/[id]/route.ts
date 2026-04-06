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

/** PATCH /api/admin/posts/[id] — update blog post metadata */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAdmin();
    if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    const body = await request.json();
    const {
      slug, title_ar, title_en, category,
      excerpt_ar, excerpt_en,
      content_doc_id, featured_image,
      is_published, published_at,
      tags,
    } = body;

    const row = await withAdminContext(async (adminDb) => {
      // Compute published_at: set on publish, clear on unpublish
      const pubAt = is_published !== undefined
        ? (is_published ? (published_at ?? new Date().toISOString()) : null)
        : undefined;

      const result = await adminDb.execute(
        sql`
          UPDATE blog_posts SET
            slug            = COALESCE(${slug ?? null}, slug),
            title_ar        = COALESCE(${title_ar ?? null}, title_ar),
            title_en        = COALESCE(${title_en ?? null}, title_en),
            category        = COALESCE(${category ?? null}, category),
            excerpt_ar      = COALESCE(${excerpt_ar ?? null}, excerpt_ar),
            excerpt_en      = COALESCE(${excerpt_en ?? null}, excerpt_en),
            content_doc_id  = COALESCE(${content_doc_id ?? null}, content_doc_id),
            featured_image  = COALESCE(${featured_image ?? null}, featured_image),
            is_published    = COALESCE(${is_published ?? null}, is_published),
            published_at    = ${pubAt !== undefined ? pubAt : sql`published_at`},
            tags            = COALESCE(${tags !== undefined ? JSON.stringify(tags) : null}::text[], tags),
            updated_at      = NOW()
          WHERE id = ${id}
          RETURNING *
        `
      );
      return result.rows[0];
    });

    if (!row) return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    return NextResponse.json({ post: row });
  } catch (err: any) {
    console.error('[api/admin/posts/[id] PATCH]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/** DELETE /api/admin/posts/[id] — delete blog post */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAdmin();
    if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await params;

    await withAdminContext(async (adminDb) => {
      await adminDb.execute(sql`DELETE FROM blog_posts WHERE id = ${id}`);
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[api/admin/posts/[id] DELETE]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
