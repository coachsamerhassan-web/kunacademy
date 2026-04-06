import { NextResponse, type NextRequest } from 'next/server';
import { withAdminContext } from '@kunacademy/db';
import { products, digital_assets, download_tokens } from '@kunacademy/db/schema';
import { eq, desc } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { getBusinessConfig } from '@/lib/cms-config';

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
    const [product] = await withAdminContext(async (db) => {
      return db.select({
        id: products.id,
        product_type: products.product_type,
        name_ar: products.name_ar,
        name_en: products.name_en,
      })
        .from(products)
        .where(eq(products.id, product_id))
        .limit(1);
    });

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    if (product.product_type === 'physical') {
      return NextResponse.json(
        { error: 'This product has no digital assets' },
        { status: 400 }
      );
    }

    // Find the digital asset for this product
    const [asset] = await withAdminContext(async (db) => {
      return db.select()
        .from(digital_assets)
        .where(eq(digital_assets.product_id, product_id))
        .orderBy(desc(digital_assets.created_at))
        .limit(1);
    });

    if (!asset) {
      return NextResponse.json(
        { error: 'No digital asset found for this product' },
        { status: 404 }
      );
    }

    // Generate download token with CMS-configurable expiry and limits
    const config = await getBusinessConfig();
    const token = randomUUID();
    const expires_at = new Date(Date.now() + config.download_token_expiry_hours * 60 * 60 * 1000);

    const [downloadToken] = await withAdminContext(async (db) => {
      return db.insert(download_tokens).values({
        order_item_id: product_id, // Using product_id as reference when no order exists
        user_id,
        asset_id: asset.id,
        token,
        expires_at,
        download_count: 0,
        max_downloads: config.download_max_count,
      }).returning();
    });

    if (!downloadToken) {
      console.error('[downloads] Token creation failed');
      return NextResponse.json(
        { error: 'Failed to generate download token' },
        { status: 500 }
      );
    }

    const download_url = `/api/downloads/${token}`;

    return NextResponse.json({
      token,
      download_url,
      expires_at: expires_at.toISOString(),
      max_downloads: config.download_max_count,
    });
  } catch (err: any) {
    console.error('[downloads]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
