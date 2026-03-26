import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@kunacademy/db';
import { randomUUID } from 'crypto';
import { getBusinessConfig } from '@/lib/cms-config';

// Handler for POST /api/downloads/regenerate
// Generates a new download token for an expired/exhausted download
export async function POST(request: NextRequest) {
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

    const { order_item_id, product_id } = await request.json();

    if (!order_item_id && !product_id) {
      return NextResponse.json(
        { error: 'Missing order_item_id or product_id' },
        { status: 400 }
      );
    }

    // Verify the user owns this order_item
    const { data: orderItem, error: orderItemError } = await supabase
      .from('order_items')
      .select('id, orders(user_id)')
      .eq('id', order_item_id || '')
      .single();

    if (orderItemError || !orderItem) {
      return NextResponse.json(
        { error: 'Order item not found' },
        { status: 404 }
      );
    }

    const order = orderItem.orders as any;
    if (order.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    // Get the digital asset for this product
    const actualProductId = product_id || (orderItem as any).product_id;
    const { data: asset, error: assetError } = await supabase
      .from('digital_assets')
      .select('*')
      .eq('product_id', actualProductId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (assetError || !asset) {
      return NextResponse.json(
        { error: 'No digital asset found for this product' },
        { status: 404 }
      );
    }

    // Create a new download token
    const config = await getBusinessConfig();
    const token = randomUUID();
    const expires_at = new Date(
      Date.now() + config.download_token_expiry_hours * 60 * 60 * 1000
    ).toISOString();

    const { data: downloadToken, error: tokenError } = await supabase
      .from('download_tokens')
      .insert({
        order_item_id,
        user_id: user.id,
        asset_id: asset.id,
        token,
        expires_at,
        download_count: 0,
        max_downloads: config.download_max_count,
      } as any)
      .select()
      .single();

    if (tokenError) {
      console.error('[downloads/regenerate] Token creation error:', tokenError);
      return NextResponse.json(
        { error: 'Failed to generate new download token' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      token,
      download_url: `/api/downloads/${token}`,
      expires_at,
      max_downloads: config.download_max_count,
    });
  } catch (err: any) {
    console.error('[downloads/regenerate]', err);
    return NextResponse.json(
      { error: err.message },
      { status: 500 }
    );
  }
}
