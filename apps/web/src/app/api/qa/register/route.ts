/**
 * POST /api/qa/register — Wave F.4 (2026-04-26)
 *
 * Member registers for the upcoming monthly live Q&A session.
 *
 * Locked decisions:
 *   F-W10  Zoom + VPS storage; separate AR + EN monthly Q&A sessions
 *   M3     Paid-1 entitlement = monthly live Q&A
 *
 * Body: { language: 'ar' | 'en' }  — selects the session locale
 *
 * Auth: authenticated user with `live_qa_monthly` entitlement.
 *
 * Returns:
 *   200 { registered: true, language, message_ar, message_en }   — entitled, registration logged
 *   401 { error: 'auth_required' }                                — not signed in
 *   402 { error: 'entitlement_required', required_feature: 'live_qa_monthly' } — Free tier
 *   400 { error: 'language_invalid' }                              — bad locale
 *
 * SCOPE NOTE (F.4 vs Nashit's Q&A infra):
 *   F.4 owns the **entitlement seam** — verify the user has `live_qa_monthly`
 *   and persist a "registered for next monthly Q&A" signal. The actual
 *   scheduling, Zoom session creation, recording storage, and reminder
 *   emails are Nashit's domain (per spec §17.10) and ship in a separate wave.
 *
 *   At F.4 the registration is tracked via a metadata JSON column on the
 *   user's `memberships` row: `metadata.qa_registrations[]` with
 *   { language, registered_at } entries. This stays simple, idempotent, and
 *   doesn't require a new schema migration. When Nashit's infra lands, it
 *   reads from this signal to populate the actual Zoom registrant list.
 *
 * No payment, no order — Q&A is included in Paid-1 membership.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { sql } from 'drizzle-orm';
import { withAdminContext, hasFeature } from '@kunacademy/db';
import { getAuthUser } from '@kunacademy/auth/server';

export async function POST(req: NextRequest) {
  // 1. Auth
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: 'auth_required' }, { status: 401 });
  }

  // 2. Entitlement (Paid-1 only)
  const access = await hasFeature(user.id, 'live_qa_monthly', { cacheScope: req });
  if (!access.granted) {
    return NextResponse.json(
      {
        error: 'entitlement_required',
        required_feature: 'live_qa_monthly',
        upgrade_path: '/membership/upgrade',
        current_tier: 'current_tier_slug' in access ? access.current_tier_slug ?? null : null,
      },
      { status: 402 },
    );
  }

  // 3. Body
  let body: { language?: string };
  try {
    body = (await req.json()) as { language?: string };
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const language = body.language === 'ar' || body.language === 'en' ? body.language : null;
  if (!language) {
    return NextResponse.json({ error: 'language_invalid' }, { status: 400 });
  }

  // 4. Append registration signal to membership metadata.
  // Idempotent: same user re-calling for the same language updates the
  // most-recent timestamp but doesn't duplicate the entry. The membership
  // metadata JSONB merge pattern matches the webhook handler.
  await withAdminContext(async (db) => {
    const nowIso = new Date().toISOString();
    // Build a JSON payload that adds-or-replaces the language entry.
    // The merge expression below uses jsonb_set so we only ever store at
    // most one entry per language; replays just bump the timestamp.
    await db.execute(sql`
      UPDATE memberships
         SET metadata = jsonb_set(
                          COALESCE(metadata, '{}'::jsonb),
                          ARRAY['qa_registrations', ${language}]::text[],
                          to_jsonb(${nowIso}::text),
                          true
                        ),
             updated_at = now()
       WHERE user_id = ${user.id}::uuid
         AND ended_at IS NULL
         AND status IN ('active','past_due','paused','trialing')
    `);
  });

  return NextResponse.json({
    registered: true,
    language,
    message_ar:
      language === 'ar'
        ? 'تم تسجيلك في جلسة الأسئلة والأجوبة الشهريّة باللغة العربيّة. سترسل لك تفاصيل الجلسة بالبريد قبل الموعد.'
        : 'تم تسجيلك في الجلسة الإنجليزيّة. ستصلك التفاصيل بالبريد.',
    message_en:
      language === 'en'
        ? "You're registered for the monthly Q&A in English. Session details will be emailed ahead of the date."
        : "You're registered for the Arabic session. Details will be emailed.",
  });
}

export async function GET() {
  return NextResponse.json({ error: 'method_not_allowed' }, { status: 405 });
}
