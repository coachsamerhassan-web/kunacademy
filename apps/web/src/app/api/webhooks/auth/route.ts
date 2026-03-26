import { NextResponse } from 'next/server';
import { sendWelcomeEmail, sendTelegramAlert } from '@kunacademy/email';

// Supabase Auth webhook — fires on new user signup
// Supabase sends database webhook payloads with { type: 'INSERT', record: {...}, ... }
export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const event = payload.type; // 'INSERT' for new user
    const record = payload.record;

    if (event === 'INSERT' && record) {
      const email = record.email as string | undefined;
      const rawMeta = record.raw_user_meta_data as Record<string, string> | undefined;
      const name = rawMeta?.full_name || rawMeta?.name || email?.split('@')[0] || '';
      const locale = rawMeta?.locale || 'ar';

      console.log('[auth-webhook] New user signup:', {
        id: record.id,
        email,
        name,
        created_at: record.created_at,
      });

      // 1. Send welcome email (non-blocking — don't fail the webhook)
      if (email) {
        try {
          await sendWelcomeEmail(email, name, locale);
          console.log('[auth-webhook] Welcome email sent to:', email);
        } catch (e) {
          console.error('[auth-webhook] Welcome email failed:', e);
        }
      }

      // 2. Telegram alert to Samer about new signup
      try {
        await sendTelegramAlert({
          to: 'samer',
          message: `<b>New Signup</b>\nName: ${name}\nEmail: ${email || 'N/A'}\nLocale: ${locale}\nTime: ${record.created_at}`,
        });
      } catch (e) {
        console.error('[auth-webhook] Telegram alert failed:', e);
      }

      // 3. Zoho CRM contact creation — deferred to Wave D
      // When implementing: use the Zoho Books zoho-client.py pattern
      // or create a direct Zoho CRM API call here.
      // Required fields: contact_name, email, source = 'Website Signup'
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error('[auth-webhook] Error:', err);
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }
}
