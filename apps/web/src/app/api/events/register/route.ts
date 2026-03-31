import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  entry.count++;
  if (entry.count > RATE_LIMIT_MAX) return true;
  return false;
}

setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap) {
    if (now > entry.resetAt) rateLimitMap.delete(ip);
  }
}, 10 * 60 * 1000);

// XSS sanitize (same pattern as pathfinder)
function sanitize(str: string): string {
  return str.replace(/[<>"]/g, '').trim().slice(0, 500);
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';
  if (isRateLimited(ip)) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.', error_ar: 'طلبات كثيرة. يرجى المحاولة لاحقًا.' }, { status: 429 });
  }

  try {
    const body = await request.json();
    const { event_slug, name, email, phone, is_free, price_amount, price_currency, event_name, locale, user_id } = body;

    // Validate required fields
    if (!event_slug || !name || !email) {
      return NextResponse.json({ error: 'Missing required fields: event_slug, name, email' }, { status: 400 });
    }

    // Basic email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check for duplicate registration (same email + event)
    const { data: existing } = await supabase
      .from('event_registrations')
      .select('id, status')
      .eq('event_slug', event_slug)
      .eq('email', sanitize(email))
      .in('status', ['registered', 'confirmed', 'pending_payment'])
      .maybeSingle();

    if (existing) {
      return NextResponse.json({
        error: locale === 'ar' ? 'أنت مسجّل بالفعل في هذه الفعالية' : 'You are already registered for this event',
        registration_id: existing.id,
        status: existing.status
      }, { status: 409 });
    }

    // Check capacity (count current registrations for this event)
    // capacity check is optional — CMS event has capacity field, but we pass it from client
    // We'll do a count check server-side

    if (is_free) {
      // FREE event — register immediately
      const { data: registration, error } = await supabase
        .from('event_registrations')
        .insert({
          event_slug: sanitize(event_slug),
          name: sanitize(name),
          email: sanitize(email),
          phone: phone ? sanitize(phone) : null,
          user_id: user_id || null,
          status: 'registered',
        })
        .select()
        .single();

      if (error) {
        console.error('Event registration error:', error);
        return NextResponse.json({ error: 'Failed to register' }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        registration_id: registration.id,
        status: 'registered',
        message: locale === 'ar' ? 'تم تسجيلك بنجاح!' : 'Registration successful!'
      });
    } else {
      // PAID event — create pending registration + redirect to checkout
      const { data: registration, error } = await supabase
        .from('event_registrations')
        .insert({
          event_slug: sanitize(event_slug),
          name: sanitize(name),
          email: sanitize(email),
          phone: phone ? sanitize(phone) : null,
          user_id: user_id || null,
          status: 'pending_payment',
        })
        .select()
        .single();

      if (error) {
        console.error('Event registration error:', error);
        return NextResponse.json({ error: 'Failed to register' }, { status: 500 });
      }

      // Return checkout URL — client will redirect
      const checkoutUrl = `/${locale || 'ar'}/checkout?type=event&id=${registration.id}&name=${encodeURIComponent(event_name || event_slug)}`;

      return NextResponse.json({
        success: true,
        registration_id: registration.id,
        status: 'pending_payment',
        checkout_url: checkoutUrl,
      });
    }
  } catch (err: any) {
    console.error('Event registration error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET — check registration status (by email + event_slug)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const event_slug = searchParams.get('event_slug');
  const email = searchParams.get('email');

  if (!event_slug || !email) {
    return NextResponse.json({ registered: false });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const { data } = await supabase
    .from('event_registrations')
    .select('id, status')
    .eq('event_slug', sanitize(event_slug))
    .eq('email', sanitize(email))
    .in('status', ['registered', 'confirmed'])
    .maybeSingle();

  return NextResponse.json({ registered: !!data, status: data?.status || null });
}
