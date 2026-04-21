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

/** PATCH /api/admin/posts/[id] — update blog post */
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
      content_ar, content_en,
      content_doc_id, featured_image_url,
      published, published_at,
      tags, author_slug,
      reading_time_minutes, is_featured, display_order,
      meta_title_ar, meta_title_en, meta_description_ar, meta_description_en,
    } = body;

    const row = await withAdminContext(async (adminDb) => {
      // Compute published_at: set on publish, clear on unpublish, preserve on no-change
      const pubAt = published !== undefined
        ? (published ? (published_at ?? new Date().toISOString()) : null)
        : undefined;

      const result = await adminDb.execute(
        sql`
          UPDATE blog_posts SET
            slug                 = COALESCE(${slug ?? null}, slug),
            title_ar             = COALESCE(${title_ar ?? null}, title_ar),
            title_en             = COALESCE(${title_en ?? null}, title_en),
            category             = COALESCE(${category ?? null}, category),
            excerpt_ar           = COALESCE(${excerpt_ar ?? null}, excerpt_ar),
            excerpt_en           = COALESCE(${excerpt_en ?? null}, excerpt_en),
            content_ar           = COALESCE(${content_ar ?? null}, content_ar),
            content_en           = COALESCE(${content_en ?? null}, content_en),
            content_doc_id       = COALESCE(${content_doc_id ?? null}, content_doc_id),
            featured_image_url   = COALESCE(${featured_image_url ?? null}, featured_image_url),
            published            = COALESCE(${published ?? null}, published),
            published_at         = ${pubAt !== undefined ? pubAt : sql`published_at`},
            tags                 = COALESCE(${tags !== undefined ? JSON.stringify(tags) : null}::text[], tags),
            author_slug          = COALESCE(${author_slug ?? null}, author_slug),
            reading_time_minutes = COALESCE(${reading_time_minutes ?? null}, reading_time_minutes),
            is_featured          = COALESCE(${is_featured ?? null}, is_featured),
            display_order        = COALESCE(${display_order ?? null}, display_order),
            meta_title_ar        = COALESCE(${meta_title_ar ?? null}, meta_title_ar),
            meta_title_en        = COALESCE(${meta_title_en ?? null}, meta_title_en),
            meta_description_ar  = COALESCE(${meta_description_ar ?? null}, meta_description_ar),
            meta_description_en  = COALESCE(${meta_description_en ?? null}, meta_description_en),
            last_edited_by       = ${user.id},
            last_edited_at       = NOW(),
            updated_at           = NOW()
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
