import { NextResponse } from 'next/server';
import { sendWelcomeEmail, sendTelegramAlert, createZohoCrmContact } from '@kunacademy/email';
import { createClient } from '@supabase/supabase-js';

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

      // 3. Zoho CRM contact creation — non-blocking fire-and-forget
      if (email) {
        createZohoCrmContact(name, email, undefined, 'Website Signup').catch((e) => {
          console.error('[auth-webhook] Zoho CRM contact creation failed:', e);
        });
      }

      // 4. Link any prior pathfinder_responses by email → new user_id (non-blocking)
      if (email && record.id) {
        const supabaseAdmin = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        );
        supabaseAdmin
          .from('pathfinder_responses')
          .update({ user_id: record.id as string })
          .eq('email', email)
          .is('user_id', null)
          .then(({ error }) => {
            if (error) {
              console.error('[auth-webhook] Pathfinder linking failed:', error);
            } else {
              console.log('[auth-webhook] Pathfinder responses linked for:', email);
            }
          });
      }
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error('[auth-webhook] Error:', err);
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }
}
