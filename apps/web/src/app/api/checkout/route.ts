// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { createCheckoutSession } from '@kunacademy/payments';
import { createAdminClient } from '@kunacademy/db';

export async function POST(request: NextRequest) {
  try {
    const { items, locale = 'ar' } = await request.json();
    const supabase = createAdminClient();

    // Validate products exist and get current prices
    const productIds = items.map((i: { productId: string }) => i.productId);
    const { data: products } = await supabase.from('products').select('*').in('id', productIds);

    if (!products || products.length === 0) {
      return NextResponse.json({ error: 'No valid products' }, { status: 400 });
    }

    const lineItems = products.map((p) => {
      const qty = items.find((i: { productId: string; quantity: number }) => i.productId === p.id)?.quantity ?? 1;
      return { name: locale === 'ar' ? p.name_ar : p.name_en, amount: p.price_aed, currency: 'aed', quantity: qty };
    });

    const origin = request.headers.get('origin') || 'http://localhost:3000';
    const session = await createCheckoutSession({
      lineItems,
      customerEmail: 'customer@placeholder.com', // Will be set from auth session
      successUrl: `${origin}/${locale}/shop/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${origin}/${locale}/shop/cart`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error('Checkout error:', err);
    return NextResponse.json({ error: 'Checkout failed' }, { status: 500 });
  }
}
