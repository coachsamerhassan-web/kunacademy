// @ts-nocheck — DB types resolve to `never` for digital_assets/download_tokens. Fix with: supabase gen types
import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@kunacademy/db';
import { randomUUID } from 'crypto';
import { getBusinessConfig } from '@/lib/cms-config';

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { product_id, user_id } = await request.json();

    if (!product_id || !user_id) {
      return NextResponse.json(
        { error: 'Missing required fields: product_id, user_id' },
        { status: 400 }
      );
    }

    // Verify the product exists and is digital
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('id, product_type, name_ar, name_en')
      .eq('id', product_id)
      .single();

    if (productError || !product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    if (product.product_type === 'physical') {
      return NextResponse.json(
        { error: 'This product has no digital assets' },
        { status: 400 }
      );
    }

    // Find the digital asset for this product
    const { data: asset, error: assetError } = await supabase
      .from('digital_assets')
      .select('*')
      .eq('product_id', product_id)
      .order('created_at' as any, { ascending: false })
      .limit(1)
      .single();

    if (assetError || !asset) {
      return NextResponse.json(
        { error: 'No digital asset found for this product' },
        { status: 404 }
      );
    }

    // Generate download token with CMS-configurable expiry and limits
    const config = await getBusinessConfig();
    const token = randomUUID();
    const expires_at = new Date(Date.now() + config.download_token_expiry_hours * 60 * 60 * 1000).toISOString();

    const { data: downloadToken, error: tokenError } = await supabase
      .from('download_tokens')
      .insert({
        order_item_id: product_id, // Using product_id as reference when no order exists
        user_id,
        asset_id: asset.id,
        token,
        expires_at,
        download_count: 0,
        max_downloads: config.download_max_count,
      } as any)
      .select()
      .single();

    if (tokenError) {
      console.error('[downloads] Token creation error:', tokenError);
      return NextResponse.json(
        { error: 'Failed to generate download token' },
        { status: 500 }
      );
    }

    const download_url = `/api/downloads/${token}`;

    return NextResponse.json({
      token,
      download_url,
      expires_at,
      max_downloads: 3,
    });
  } catch (err: any) {
    console.error('[downloads]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
