import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@kunacademy/db';

// Handler for GET /api/user/downloads
// Returns the authenticated user's purchase history with active download tokens
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient();
    if (!supabase) {
      return NextResponse.json(
        { error: 'Database unavailable' },
        { status: 503 }
      );
    }

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Query: user's order_items + product details + download tokens
    // This gets all purchases and their associated download tokens
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select(
        `
        id,
        created_at,
        total_amount,
        currency,
        order_items (
          id,
          product_id,
          quantity,
          unit_price,
          products (
            id,
            name_ar,
            name_en,
            product_type,
            slug
          )
        ),
        payments (
          id,
          status,
          gateway,
          created_at
        )
      `
      )
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (ordersError) {
      console.error('[user/downloads]', ordersError);
      return NextResponse.json(
        { error: 'Failed to fetch orders' },
        { status: 500 }
      );
    }

    // For each order item that is digital/hybrid, fetch download tokens
    const downloads: any[] = [];

    if (orders && orders.length > 0) {
      for (const order of orders) {
        if (!order.order_items) continue;

        for (const item of order.order_items) {
          const product = item.products as any;

          // Only include digital or hybrid products
          if (!product || (product.product_type !== 'digital' && product.product_type !== 'hybrid')) {
            continue;
          }

          // Get download tokens for this order item
          const { data: tokens, error: tokenError } = await supabase
            .from('download_tokens')
            .select('*')
            .eq('order_item_id', item.id)
            .order('created_at', { ascending: false });

          if (!tokenError && tokens && tokens.length > 0) {
            for (const token of tokens) {
              const isExpired = new Date(token.expires_at) < new Date();
              const isExhausted = token.download_count >= token.max_downloads;

              downloads.push({
                id: token.id,
                product: {
                  id: product.id,
                  name_ar: product.name_ar,
                  name_en: product.name_en,
                  slug: product.slug,
                  type: product.product_type,
                },
                token: token.token,
                downloadLink: `/api/downloads/${token.token}`,
                expiresAt: token.expires_at,
                isExpired,
                isExhausted,
                downloadCount: token.download_count,
                maxDownloads: token.max_downloads,
                createdAt: token.created_at,
                orderCreatedAt: order.created_at,
              });
            }
          }
        }
      }
    }

    return NextResponse.json({
      downloads,
      count: downloads.length,
    });
  } catch (err: any) {
    console.error('[api/user/downloads]', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
