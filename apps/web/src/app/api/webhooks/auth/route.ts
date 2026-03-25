import { NextResponse } from 'next/server';

// Supabase Auth webhook — fires on new user signup
// TODO: Wire to Zoho CRM contact creation in Wave D
export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const event = payload.type; // 'INSERT' for new user
    const record = payload.record;

    if (event === 'INSERT' && record) {
      console.log('[auth-webhook] New user signup:', {
        id: record.id,
        email: record.email,
        created_at: record.created_at,
      });
      // TODO: Create Zoho CRM contact
      // TODO: Send welcome WhatsApp message
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error('[auth-webhook] Error:', err);
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }
}
