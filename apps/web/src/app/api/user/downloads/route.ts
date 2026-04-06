import { NextResponse, type NextRequest } from 'next/server';
import { withUserContext } from '@kunacademy/db';
import { orders, order_items, products, download_tokens } from '@kunacademy/db/schema';
import { eq, desc } from 'drizzle-orm';
import { getAuthUser } from '@kunacademy/auth/server';

// Handler for GET /api/user/downloads
// Returns the authenticated user's purchase history with active download tokens
export async function GET(_request: NextRequest) {
  try {
    // Get authenticated user
    const user = await getAuthUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Query: user's orders with order_items and products
    // orders table uses customer_id (not user_id)
    const userOrders = await withUserContext(user.id, async (db) => {
      return db.select({
        orderId: orders.id,
        orderCreatedAt: orders.created_at,
        total_amount: orders.total_amount,
        currency: orders.currency,
        orderItemId: order_items.id,
        productId: order_items.product_id,
        quantity: order_items.quantity,
        unit_price: order_items.unit_price,
        productNameAr: products.name_ar,
        productNameEn: products.name_en,
        productType: products.product_type,
        productSlug: products.slug,
      })
        .from(orders)
        .innerJoin(order_items, eq(order_items.order_id, orders.id))
        .innerJoin(products, eq(products.id, order_items.product_id))
        .where(eq(orders.customer_id, user.id))
        .orderBy(desc(orders.created_at));
    });

    if (!userOrders || userOrders.length === 0) {
      return NextResponse.json({ downloads: [], count: 0 });
    }

    // For each order item that is digital/hybrid, fetch download tokens
    const downloads: any[] = [];

    for (const row of userOrders) {
      // Only include digital or hybrid products
      if (!row.productType || (row.productType !== 'digital' && row.productType !== 'hybrid')) {
        continue;
      }

      // Get download tokens for this order item
      const tokens = await withUserContext(user.id, async (db) => {
        return db.select()
          .from(download_tokens)
          .where(eq(download_tokens.order_item_id, row.orderItemId))
          .orderBy(desc(download_tokens.created_at));
      });

      if (tokens && tokens.length > 0) {
        for (const token of tokens) {
          const isExpired = new Date(token.expires_at) < new Date();
          const isExhausted = (token.download_count ?? 0) >= (token.max_downloads ?? Infinity);

          downloads.push({
            id: token.id,
            product: {
              id: row.productId,
              name_ar: row.productNameAr,
              name_en: row.productNameEn,
              slug: row.productSlug,
              type: row.productType,
            },
            token: token.token,
            downloadLink: `/api/downloads/${token.token}`,
            expiresAt: token.expires_at,
            isExpired,
            isExhausted,
            downloadCount: token.download_count,
            maxDownloads: token.max_downloads,
            createdAt: token.created_at,
            orderCreatedAt: row.orderCreatedAt,
          });
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
