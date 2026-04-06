import { NextRequest, NextResponse } from 'next/server';
import { withAdminContext } from '@kunacademy/db';
import { getAuthUser } from '@kunacademy/auth/server';
import { randomBytes } from 'crypto';
import { sql } from 'drizzle-orm';

/**
 * POST /api/books/[slug]/share
 * Create a shareable link to grant book access.
 *
 * Body:
 * {
 *   recipientEmail: string
 *   senderName: string
 *   message?: string (optional custom message)
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

    // Sender must have access to the book
    const senderAccess = await withAdminContext(async (db) => {
      const rows = await db.execute(
        sql`SELECT id FROM book_access WHERE user_id = ${user.id} AND book_slug = ${slug} LIMIT 1`
      );
      return rows.rows[0] as { id: string } | undefined;
    });

    if (!senderAccess) {
      return NextResponse.json({ error: 'You do not have access to this book' }, { status: 403 });
    }

    const body = await request.json();
    const { recipientEmail, senderName, message } = body;

    if (!recipientEmail || !senderName) {
      return NextResponse.json(
        { error: 'recipientEmail and senderName required' },
        { status: 400 }
      );
    }

    // Generate share token (32 bytes = 64 hex chars)
    const token2 = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    // Store share record
    const share = await withAdminContext(async (db) => {
      const rows = await db.execute(
        sql`
          INSERT INTO book_shares (book_slug, token, sender_user_id, recipient_email, sender_name, message, expires_at, used)
          VALUES (${slug}, ${token2}, ${user.id}, ${recipientEmail}, ${senderName}, ${message || null}, ${expiresAt.toISOString()}, false)
          RETURNING id
        `
      );
      return rows.rows[0] as { id: string } | undefined;
    });

    if (!share) {
      return NextResponse.json(
        { error: 'Failed to create share' },
        { status: 500 }
      );
    }

    const shareUrl = `${request.nextUrl.origin}/reader/${slug}/share?token=${token2}`;

    // Emit email event (event bus will handle sending)
    try {
      const emailEvent = {
        type: 'book_share_invitation',
        timestamp: new Date().toISOString(),
        data: {
          shareId: share.id,
          token: token2,
          bookSlug: slug,
          recipientEmail,
          senderName,
          senderEmail: user.email,
          shareUrl,
          customMessage: message,
          expiresAt: expiresAt.toISOString(),
        },
      };

      await fetch('http://localhost:3001/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(emailEvent),
      }).catch(err => console.error('Event bus error:', err));
    } catch (err) {
      console.error('Failed to emit email event:', err);
    }

    return NextResponse.json({
      shareToken: token2,
      shareUrl,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (err) {
    console.error('Share API error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
