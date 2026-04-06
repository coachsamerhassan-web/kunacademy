import { NextRequest, NextResponse } from 'next/server';
import { withAdminContext } from '@kunacademy/db';
import { getAuthUser } from '@kunacademy/auth/server';
import { sql } from 'drizzle-orm';

/**
 * POST /api/books/[slug]/share/accept
 * Accept a share token and grant book access to the authenticated user.
 *
 * Body:
 * {
 *   token: string
 * }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    // Auth via Auth.js session (cookie-based)
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const { token: shareToken } = body;

    if (!shareToken) {
      return NextResponse.json({ error: 'Token required' }, { status: 400 });
    }

    // Verify token exists, is not expired, and not yet used
    const shareRecord = await withAdminContext(async (db) => {
      const rows = await db.execute(
        sql`SELECT id, expires_at, used, book_slug FROM book_shares WHERE token = ${shareToken} AND book_slug = ${slug} LIMIT 1`
      );
      return rows.rows[0] as { id: string; expires_at: string; used: boolean; book_slug: string } | undefined;
    });

    if (!shareRecord) {
      return NextResponse.json(
        { error: 'Invalid or expired share token' },
        { status: 400 }
      );
    }

    if (shareRecord.used) {
      return NextResponse.json(
        { error: 'Share token has already been used' },
        { status: 400 }
      );
    }

    const expiresAt = new Date(shareRecord.expires_at);
    if (expiresAt < new Date()) {
      return NextResponse.json(
        { error: 'Share token has expired' },
        { status: 400 }
      );
    }

    // Check if user already has access
    const existingAccess = await withAdminContext(async (db) => {
      const rows = await db.execute(
        sql`SELECT id FROM book_access WHERE user_id = ${user.id} AND book_slug = ${slug} LIMIT 1`
      );
      return rows.rows[0] as { id: string } | undefined;
    });

    if (existingAccess) {
      // Already has access — just mark share as used and return success
      await withAdminContext(async (db) => {
        await db.execute(
          sql`UPDATE book_shares SET used = true WHERE id = ${shareRecord.id}`
        );
      });

      return NextResponse.json({
        success: true,
        message: 'You already have access to this book',
      });
    }

    // Grant access — insert new book_access record
    const grantError = await withAdminContext(async (db) => {
      try {
        await db.execute(
          sql`INSERT INTO book_access (user_id, book_slug, granted_at) VALUES (${user.id}, ${slug}, NOW())`
        );
        return null;
      } catch (e) {
        return e;
      }
    });

    if (grantError) {
      return NextResponse.json(
        { error: `Failed to grant access: ${String(grantError)}` },
        { status: 500 }
      );
    }

    // Mark share as used
    try {
      await withAdminContext(async (db) => {
        await db.execute(
          sql`UPDATE book_shares SET used = true WHERE id = ${shareRecord.id}`
        );
      });
    } catch (updateError) {
      console.error('Failed to mark share as used:', updateError);
      // Don't fail the request — access was granted successfully
    }

    return NextResponse.json({
      success: true,
      message: 'Book access granted successfully',
    });
  } catch (err) {
    console.error('Accept share error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
