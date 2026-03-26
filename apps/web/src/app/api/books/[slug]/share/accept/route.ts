import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@kunacademy/db';

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

    const supabase = createServerClient();
    if (!supabase) {
      return NextResponse.json({ error: 'Auth not configured' }, { status: 500 });
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json({ error: 'Token required' }, { status: 400 });
    }

    // Verify token exists, is not expired, and not yet used
    const { data: shareRecord, error: selectError } = await supabase
      .from('book_shares')
      .select('id, expires_at, used, book_slug')
      .eq('token', token)
      .eq('book_slug', slug)
      .single();

    if (selectError || !shareRecord) {
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
    const { data: existingAccess } = await supabase
      .from('book_access')
      .select('id')
      .eq('user_id', user.id)
      .eq('book_slug', slug)
      .single();

    if (existingAccess) {
      // Already has access — just mark share as used and return success
      await supabase
        .from('book_shares')
        .update({ used: true })
        .eq('id', shareRecord.id);

      return NextResponse.json({
        success: true,
        message: 'You already have access to this book',
      });
    }

    // Grant access — insert new book_access record
    const { error: grantError } = await supabase
      .from('book_access')
      .insert({
        user_id: user.id,
        book_slug: slug,
        granted_at: new Date().toISOString(),
      });

    if (grantError) {
      return NextResponse.json(
        { error: `Failed to grant access: ${grantError.message}` },
        { status: 500 }
      );
    }

    // Mark share as used
    const { error: updateError } = await supabase
      .from('book_shares')
      .update({ used: true })
      .eq('id', shareRecord.id);

    if (updateError) {
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
