import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@kunacademy/db';
import { randomBytes } from 'crypto';

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

    const supabase = createServerClient();
    if (!supabase) {
      return NextResponse.json({ error: 'Auth not configured' }, { status: 500 });
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Sender must have access to the book
    const { data: senderAccess } = await supabase
      .from('book_access')
      .select('id')
      .eq('user_id', user.id)
      .eq('book_slug', slug)
      .single();

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
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    // Store share record
    const { data: share, error: insertError } = await supabase
      .from('book_shares')
      .insert({
        book_slug: slug,
        token,
        sender_user_id: user.id,
        recipient_email: recipientEmail,
        sender_name: senderName,
        message: message || null,
        expires_at: expiresAt.toISOString(),
        used: false,
      })
      .select('id')
      .single();

    if (insertError) {
      return NextResponse.json(
        { error: `Failed to create share: ${insertError.message}` },
        { status: 500 }
      );
    }

    const shareUrl = `${request.nextUrl.origin}/reader/${slug}/share?token=${token}`;

    // Emit email event (event bus will handle sending)
    try {
      const emailEvent = {
        type: 'book_share_invitation',
        timestamp: new Date().toISOString(),
        data: {
          shareId: share.id,
          token,
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
      shareToken: token,
      shareUrl,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (err) {
    console.error('Share API error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
