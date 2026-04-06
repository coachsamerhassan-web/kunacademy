import { NextResponse, type NextRequest } from 'next/server';
import { withUserContext, withAdminContext } from '@kunacademy/db';
import { order_items, orders, digital_assets, download_tokens } from '@kunacademy/db/schema';
import { eq, desc } from 'drizzle-orm';
import { getAuthUser } from '@kunacademy/auth/server';
import { randomUUID } from 'crypto';
import { getBusinessConfig } from '@/lib/cms-config';

// Handler for POST /api/downloads/regenerate
// Generates a new download token for an expired/exhausted download
export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const user = await getAuthUser();

    if (!user) {
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
    const [orderItem] = await withUserContext(user.id, async (db) => {
      return db.select({
        id: order_items.id,
        product_id: order_items.product_id,
        order_id: order_items.order_id,
        customer_id: orders.customer_id,
      })
        .from(order_items)
        .innerJoin(orders, eq(orders.id, order_items.order_id))
        .where(eq(order_items.id, order_item_id || ''))
        .limit(1);
    });

    if (!orderItem) {
      return NextResponse.json(
        { error: 'Order item not found' },
        { status: 404 }
      );
    }

    if (orderItem.customer_id !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    // Get the digital asset for this product
    const actualProductId = product_id || orderItem.product_id;
    const [asset] = await withAdminContext(async (db) => {
      return db.select()
        .from(digital_assets)
        .where(eq(digital_assets.product_id, actualProductId))
        .orderBy(desc(digital_assets.created_at))
        .limit(1);
    });

    if (!asset) {
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
    );

    const [downloadToken] = await withAdminContext(async (db) => {
      return db.insert(download_tokens).values({
        order_item_id,
        user_id: user.id,
        asset_id: asset.id,
        token,
        expires_at,
        download_count: 0,
        max_downloads: config.download_max_count,
      }).returning();
    });

    if (!downloadToken) {
      console.error('[downloads/regenerate] Token creation failed');
      return NextResponse.json(
        { error: 'Failed to generate new download token' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      token,
      download_url: `/api/downloads/${token}`,
      expires_at: expires_at.toISOString(),
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
