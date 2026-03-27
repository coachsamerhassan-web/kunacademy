import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createCheckoutSession, createTabbySession } from '@kunacademy/payments';
import type { Database } from '@kunacademy/db';

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// KUN Egypt coaching — CIB InstaPay
const INSTAPAY_CONFIG = {
  account_name: 'KUN Egypt coaching',
  iban: 'EG76001002260000100056685922',
  bank: 'CIB',
};

// Business rules
const TABBY_CURRENCIES = ['AED', 'SAR'];
const TABBY_COUNTRIES = ['AE', 'SA'];
const TABBY_MINIMUM = 250_000; // 2,500 AED/SAR in minor units

async function generateUniqueInstapayAmount(baseAmount: number): Promise<number> {
  const today = new Date().toISOString().split('T')[0];
  const { data: existing } = await supabase
    .from('payments')
    .select('amount')
    .eq('gateway', 'instapay' as any)
    .eq('status', 'pending')
    .gte('created_at', today + 'T00:00:00Z')
    .lte('created_at', today + 'T23:59:59Z');

  const usedSuffixes = new Set((existing || []).map((p) => p.amount % 100));
  let suffix: number;
  let attempts = 0;
  do {
    suffix = Math.floor(Math.random() * 99) + 1;
    attempts++;
  } while (usedSuffixes.has(suffix) && attempts < 200);

  return baseAmount + suffix;
}

/** Get visitor country from Vercel headers (same source as /api/geo) */
function getCountry(request: NextRequest): string {
  return (
    request.headers.get('x-vercel-ip-country') ||
    request.headers.get('cf-ipcountry') ||
    'XX'
  ).toUpperCase();
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { item_type, item_id, item_name, user_id, user_email, currency, amount, gateway, locale } = body;

    if (!item_type || !item_id || !user_id || !currency || !amount || !gateway) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const country = getCountry(request);
    const origin = request.headers.get('origin') || '';

    // ── Server-side geo enforcement ─────────────────────────────────
    // EGP + InstaPay: Egypt only
    if (currency === 'EGP' && country !== 'EG') {
      return NextResponse.json({ error: 'EGP pricing is only available from Egypt' }, { status: 403 });
    }
    if (gateway === 'instapay' && country !== 'EG') {
      return NextResponse.json({ error: 'InstaPay is only available from Egypt' }, { status: 403 });
    }

    // Tabby: Gulf only + minimum enforcement
    if (gateway === 'tabby') {
      if (!TABBY_COUNTRIES.includes(country)) {
        return NextResponse.json({ error: 'Tabby is only available in UAE and Saudi Arabia' }, { status: 403 });
      }
      if (!TABBY_CURRENCIES.includes(currency)) {
        return NextResponse.json({ error: 'Tabby only supports AED and SAR' }, { status: 400 });
      }
      if (amount < TABBY_MINIMUM) {
        return NextResponse.json({
          error: locale === 'ar'
            ? 'التقسيط متاح للمبالغ من 2,500 وأكثر'
            : 'Installments available for orders 2,500+',
        }, { status: 400 });
      }
    }

    // ── InstaPay (Egypt) ──────────────────────────────────────────────
    if (gateway === 'instapay') {
      const uniqueAmount = await generateUniqueInstapayAmount(amount);

      const { data: payment, error } = await supabase.from('payments').insert({
        amount: uniqueAmount,
        currency: 'EGP',
        gateway: 'instapay' as any,
        status: 'pending',
        metadata: {
          item_type, item_id, item_name, user_id, user_email,
          base_amount: amount,
          unique_suffix: uniqueAmount % 100,
          verification_status: 'awaiting_transfer',
          country,
        },
      }).select().single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      return NextResponse.json({
        payment_id: payment.id,
        gateway: 'instapay',
        instructions: {
          account_name: INSTAPAY_CONFIG.account_name,
          iban: INSTAPAY_CONFIG.iban,
          bank: INSTAPAY_CONFIG.bank,
          amount: (uniqueAmount / 100).toFixed(2),
          amount_raw: uniqueAmount,
          currency: 'EGP',
          expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
        },
      });
    }

    // ── Stripe (International) ────────────────────────────────────────
    if (gateway === 'stripe') {
      const { data: payment, error } = await supabase.from('payments').insert({
        amount, currency,
        gateway: 'stripe',
        status: 'pending',
        metadata: { item_type, item_id, item_name, user_id, user_email, country },
      }).select().single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      if (!process.env.STRIPE_SECRET_KEY) {
        return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 });
      }

      const successUrl = `${origin}/${locale || 'ar'}/checkout/success?payment_id=${payment.id}`;
      const cancelUrl = `${origin}/${locale || 'ar'}/checkout?type=${item_type}&id=${item_id}`;

      const session = await createCheckoutSession({
        lineItems: [{
          name: item_name || `${item_type} - ${item_id}`,
          amount, currency, quantity: 1,
        }],
        customerEmail: user_email || '',
        successUrl, cancelUrl,
        metadata: { payment_id: payment.id, item_type, item_id, user_id },
      });

      await supabase.from('payments').update({
        gateway_payment_id: session.id,
      }).eq('id', payment.id);

      return NextResponse.json({ checkout_url: session.url, payment_id: payment.id, gateway: 'stripe' });
    }

    // ── Tabby (BNPL — Gulf) ───────────────────────────────────────────
    if (gateway === 'tabby') {
      if (!process.env.TABBY_SECRET_KEY) {
        return NextResponse.json({ error: 'Tabby not configured' }, { status: 503 });
      }

      const { data: payment, error } = await supabase.from('payments').insert({
        amount, currency,
        gateway: 'tabby' as any,
        status: 'pending',
        metadata: { item_type, item_id, item_name, user_id, user_email, country },
      }).select().single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      const successUrl = `${origin}/${locale || 'ar'}/checkout/success?payment_id=${payment.id}`;
      const cancelUrl = `${origin}/${locale || 'ar'}/checkout?type=${item_type}&id=${item_id}`;
      const failureUrl = `${origin}/${locale || 'ar'}/checkout?type=${item_type}&id=${item_id}&error=payment_failed`;

      const result = await createTabbySession({
        amount, currency: currency as 'AED' | 'SAR' | 'KWD',
        description: item_name || `${item_type} — Kun Academy`,
        buyer: {
          name: user_email?.split('@')[0] || 'Customer',
          email: user_email || '',
          phone: '+971500000000',
        },
        orderReferenceId: payment.id,
        items: [{
          title: item_name || `${item_type} - ${item_id}`,
          quantity: 1,
          unit_price: (amount / 100).toFixed(2),
          category: 'Education',
          reference_id: item_id,
        }],
        successUrl, cancelUrl, failureUrl,
        lang: (locale === 'ar' ? 'ar' : 'en') as 'ar' | 'en',
      });

      if ('rejected' in result) {
        await supabase.from('payments').update({ status: 'failed', metadata: { ...(payment.metadata as Record<string, unknown> ?? {}), tabby_rejection: result.reason } }).eq('id', payment.id);
        return NextResponse.json({
          error: locale === 'ar' ? 'عذرًا، التقسيط غير متاح لهذا الطلب' : 'Sorry, installments are not available for this order',
          rejection_reason: result.reason,
        }, { status: 422 });
      }

      await supabase.from('payments').update({
        gateway_payment_id: result.paymentId,
        metadata: { ...(payment.metadata as Record<string, unknown> ?? {}), tabby_session_id: result.sessionId },
      }).eq('id', payment.id);

      return NextResponse.json({ checkout_url: result.checkoutUrl, payment_id: payment.id, gateway: 'tabby' });
    }

    return NextResponse.json({ error: 'Invalid gateway' }, { status: 400 });
  } catch (err: any) {
    console.error('[checkout]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
