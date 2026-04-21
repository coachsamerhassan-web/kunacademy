/**
 * /api/admin/testimonials/[id]
 *
 * Single-item read + full-field update + delete.
 * Phase 1c (2026-04-21) — supports CMS-migrated fields (role_*, location_*,
 * country_code, display_order).
 */

import { NextRequest, NextResponse } from 'next/server';
import { db, withAdminContext } from '@kunacademy/db';
import { getAuthUser } from '@kunacademy/auth/server';
import { eq } from 'drizzle-orm';
import { profiles } from '@kunacademy/db/schema';
import { sql } from 'drizzle-orm';
import { validateTestimonialInput } from '../route';

async function requireAdmin() {
  const user = await getAuthUser();
  if (!user) return null;
  const rows = await db.select({ role: profiles.role }).from(profiles).where(eq(profiles.id, user.id)).limit(1);
  const role = rows[0]?.role;
  if (role !== 'admin' && role !== 'super_admin') return null;
  return user;
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAdmin();
    if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { id } = await context.params;

    const row = await withAdminContext(async (adminDb) => {
      const result = await adminDb.execute(
        sql`SELECT * FROM testimonials WHERE id = ${id} LIMIT 1`
      );
      return result.rows[0];
    });

    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ testimonial: row });
  } catch (err: any) {
    console.error('[api/admin/testimonials/[id] GET]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAdmin();
    if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { id } = await context.params;

    const body = await request.json();
    const validated = validateTestimonialInput(body);
    if ('error' in validated) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }
    const v = validated.value;

    const row = await withAdminContext(async (adminDb) => {
      const result = await adminDb.execute(sql`
        UPDATE testimonials SET
          author_name_ar = ${v.author_name_ar},
          author_name_en = ${v.author_name_en},
          content_ar     = ${v.content_ar},
          content_en     = ${v.content_en},
          role_ar        = ${v.role_ar},
          role_en        = ${v.role_en},
          location_ar    = ${v.location_ar},
          location_en    = ${v.location_en},
          country_code   = ${v.country_code},
          program        = ${v.program},
          rating         = ${v.rating},
          video_url      = ${v.video_url},
          display_order  = ${v.display_order},
          is_featured    = ${v.is_featured},
          source_type    = ${v.source_type}
        WHERE id = ${id}
        RETURNING *
      `);
      return result.rows[0];
    });

    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ testimonial: row });
  } catch (err: any) {
    console.error('[api/admin/testimonials/[id] PATCH]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAdmin();
    if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { id } = await context.params;

    const row = await withAdminContext(async (adminDb) => {
      const result = await adminDb.execute(
        sql`DELETE FROM testimonials WHERE id = ${id} RETURNING id`
      );
      return result.rows[0];
    });

    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[api/admin/testimonials/[id] DELETE]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
