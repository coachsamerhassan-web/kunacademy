import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { sendWelcomeEmail, sendTelegramAlert, createZohoCrmContact } from '@kunacademy/email';
import { withAdminContext } from '@kunacademy/db';
import { sql } from 'drizzle-orm';

// Auth webhook — fires on new user signup (triggered by database event or direct POST)
// Payload format: { type: 'INSERT', record: {...}, ... }
export async function POST(request: Request) {
  // ── Shared-secret guard (RS-04 HIGH) ──────────────────────────────────────
  // Matches the Tabby pattern in /api/webhooks/payment/route.ts:
  //   • literal secret sent as x-auth-webhook-secret header value
  //   • timingSafeEqual after equal-length check (prevents length oracle + timing attacks)
  //   • NEVER log the received header value
  const expectedSecret = process.env.AUTH_WEBHOOK_SECRET;
  if (!expectedSecret) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[auth-webhook] AUTH_WEBHOOK_SECRET is not set — rejecting webhook in production');
      return NextResponse.json({ error: 'Webhook misconfigured' }, { status: 500 });
    }
    console.error('[auth-webhook] AUTH_WEBHOOK_SECRET is not set. Add it to .env.local to process auth webhooks locally.');
    return NextResponse.json({ error: 'AUTH_WEBHOOK_SECRET env var is not set — cannot verify signature' }, { status: 500 });
  }
  const receivedSecret = request.headers.get('x-auth-webhook-secret');
  // NEVER log receivedSecret — prevents leaking received secret in error logs.
  let secretValid = false;
  if (receivedSecret) {
    try {
      const receivedBuf = Buffer.from(receivedSecret, 'utf8');
      const expectedBuf = Buffer.from(expectedSecret, 'utf8');
      // timingSafeEqual requires equal-length buffers — mismatched length = invalid.
      secretValid = receivedBuf.length === expectedBuf.length && timingSafeEqual(receivedBuf, expectedBuf);
    } catch { /* fail closed — do not log, receivedSecret is attacker-controlled */ }
  }
  if (!secretValid) {
    console.error('[auth-webhook] Invalid or missing x-auth-webhook-secret header');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // ── End guard ─────────────────────────────────────────────────────────────

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
        withAdminContext(async (db) => {
          await db.execute(
            sql`UPDATE pathfinder_responses SET user_id = ${record.id as string} WHERE email = ${email} AND user_id IS NULL`
          );
        }).then(() => {
          console.log('[auth-webhook] Pathfinder responses linked for:', email);
        }).catch((error) => {
          console.error('[auth-webhook] Pathfinder linking failed:', error);
        });
      }
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error('[auth-webhook] Error:', err);
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }
}
