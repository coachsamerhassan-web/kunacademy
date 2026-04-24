import { NextRequest, NextResponse } from 'next/server';
import { db } from '@kunacademy/db';
import { eq } from 'drizzle-orm';
import { landing_pages, lp_leads } from '@kunacademy/db/schema';
import { sendEmail, sendTelegramAlert, createZohoCrmContact } from '@kunacademy/email';
import { isLpLeadCaptureConfig } from '@/lib/lp/composition-types';

/**
 * POST /api/lp/lead
 *
 * Lead capture endpoint for Wave 14 LP-INFRA. Distinct from /api/leads
 * (program-coupled). Required body:
 *   { slug, locale, name, email, phone?, message?, _hp?,
 *     utm_source?, utm_medium?, utm_campaign? }
 *
 * Sequence (DB-write FIRST so leads are never lost):
 *   1. Validate input + honeypot.
 *   2. Resolve landing_pages row by slug (must be published + lead_capture enabled).
 *   3. Validate against lead_capture_config.required_fields[] for the LP.
 *   4. INSERT lp_leads row.
 *   5. Fire admin notification email (best-effort).
 *   6. Fire Telegram alert (best-effort).
 *   7. Fire Zoho CRM contact creation (best-effort, async, updates lp_leads.zoho_*).
 *   8. Return success + optional redirect URL.
 *
 * Auth: anonymous. Rate-limited (5/hr per IP) + honeypot.
 *
 * Wave 14 LP-INFRA (2026-04-24)
 */

// ── Rate limiting (per-process) ─────────────────────────────────────────────
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT_MAX;
}

setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap) {
    if (now > entry.resetAt) rateLimitMap.delete(ip);
  }
}, 10 * 60 * 1000);

// ── Helpers ────────────────────────────────────────────────────────────────
function sanitize(s: string): string {
  return s.trim().replace(/<[^>]*>/g, '');
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function clampString(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null;
  const s = sanitize(v);
  if (s.length === 0) return null;
  if (s.length > max) return s.slice(0, max);
  return s;
}

function safeRedirectUrl(raw: unknown, request: NextRequest): string | null {
  if (typeof raw !== 'string' || raw.length === 0) return null;
  try {
    // Same-origin only. Cross-origin redirects on a public lead-capture
    // endpoint are an open-redirect / phishing vector — even https-anywhere.
    // Operators who need cross-origin success_redirect can host a same-origin
    // /lp/[slug]/thank-you page and redirect from there.
    if (raw.startsWith('/') && !raw.startsWith('//')) return raw;
    const u = new URL(raw, request.url);
    const requestOrigin = new URL(request.url).origin;
    if (u.origin === requestOrigin) return u.pathname + u.search;
    return null;
  } catch {
    return null;
  }
}

/** HTML-escape user-supplied text before interpolating into email templates.
 *  `sanitize()` strips tags but leaves attribute-breaking characters intact;
 *  this escapes the 5 dangerous chars so name/email/message can't break out
 *  of an HTML attribute or open a script context in the admin email client. */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ── POST handler ────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    // Prefer x-real-ip (set by trusted nginx on this VPS) over x-forwarded-for
    // (which a client can spoof). Fall back to x-forwarded-for first hop only
    // if x-real-ip isn't present (e.g. dev environment without nginx).
    const ip =
      request.headers.get('x-real-ip')?.trim() ||
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      'unknown';

    if (isRateLimited(ip)) {
      return NextResponse.json(
        {
          error: 'Too many submissions. Please try again later.',
          error_ar: 'لقد أرسلت طلبات كثيرة. يرجى المحاولة لاحقًا.',
        },
        { status: 429 },
      );
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

    // Honeypot — silent success for bots
    if (body._hp) {
      return NextResponse.json({ success: true });
    }

    const slug = clampString(body.slug, 200);
    const locale = clampString(body.locale, 8) || 'ar';
    const name = clampString(body.name, 200);
    const email = clampString(body.email, 320);
    const phone = clampString(body.phone, 30);
    const message = clampString(body.message, 2000);
    const company = clampString(body.company, 200);
    const role = clampString(body.role, 200);

    if (!slug) {
      return NextResponse.json({ error: 'Missing slug' }, { status: 400 });
    }
    if (!name) {
      return NextResponse.json({ error: 'Missing name' }, { status: 400 });
    }
    if (!email) {
      return NextResponse.json({ error: 'Missing email' }, { status: 400 });
    }
    if (!isValidEmail(email)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
    }

    // ── Resolve LP row ─────────────────────────────────────────────────────
    const [lp] = await db
      .select({
        id: landing_pages.id,
        slug: landing_pages.slug,
        published: landing_pages.published,
        lead_capture_config: landing_pages.lead_capture_config,
      })
      .from(landing_pages)
      .where(eq(landing_pages.slug, slug))
      .limit(1);

    if (!lp || !lp.published) {
      return NextResponse.json({ error: 'Landing page not found' }, { status: 404 });
    }

    const leadConfig = lp.lead_capture_config;
    if (!isLpLeadCaptureConfig(leadConfig) || !leadConfig.enabled) {
      return NextResponse.json(
        { error: 'Lead capture is not enabled on this landing page' },
        { status: 409 },
      );
    }

    // Required-field gate per LP config
    const required = leadConfig.required_fields ?? [];
    const provided: Record<string, string | null> = { name, email, phone, message, company, role };
    for (const r of required) {
      if (!provided[r]) {
        return NextResponse.json(
          { error: `Missing required field: ${r}` },
          { status: 400 },
        );
      }
    }

    // ── Insert lp_leads row (single source of truth — fan-out comes after) ──
    const userAgent = request.headers.get('user-agent')?.slice(0, 500) || null;
    const utm_source = clampString(body.utm_source, 200);
    const utm_medium = clampString(body.utm_medium, 200);
    const utm_campaign = clampString(body.utm_campaign, 200);

    const metadata: Record<string, string> = {};
    if (company) metadata.company = company;
    if (role) metadata.role = role;

    let inserted: { id: string } | null = null;
    try {
      const [row] = await db
        .insert(lp_leads)
        .values({
          landing_page_id: lp.id,
          slug,
          locale,
          name,
          email: email.toLowerCase(),
          phone,
          message,
          metadata: Object.keys(metadata).length > 0 ? metadata : null,
          ip_address: ip === 'unknown' ? null : ip,
          user_agent: userAgent,
          utm_source,
          utm_medium,
          utm_campaign,
        })
        .returning({ id: lp_leads.id });
      inserted = row;
    } catch (e) {
      console.error('[api/lp/lead] DB insert failed:', e);
      return NextResponse.json(
        { error: 'Could not save lead', error_ar: 'فشل حفظ بياناتك. يرجى المحاولة لاحقًا.' },
        { status: 500 },
      );
    }

    const isAr = locale === 'ar';
    const zohoLeadSource = leadConfig.zoho_lead_source || 'Landing Page';

    // ── Fan-out (best-effort, never blocks success response) ───────────────
    // Email admin — all user-supplied values HTML-escaped to prevent stored
    // XSS in the admin's email client (DeepSeek C-2 fix, 2026-04-24 wave 14).
    const eName = escapeHtml(name);
    const eEmail = escapeHtml(email);
    const eSlug = escapeHtml(slug);
    const eLocale = escapeHtml(locale);
    const ePhone = phone ? escapeHtml(phone) : null;
    const eMessage = message ? escapeHtml(message) : null;
    const eUtmSource = utm_source ? escapeHtml(utm_source) : null;
    const eUtmCampaign = utm_campaign ? escapeHtml(utm_campaign) : null;
    sendEmail({
      to: 'info@kuncoaching.com',
      subject: `[Kun LP Lead] ${eSlug} — ${eName}`,
      html: `
        <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px;">
          <h2 style="color: #474099; margin-bottom: 24px;">New Landing-Page Lead</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 10px 0; font-weight: bold; color: #555; width: 140px;">Landing Page</td><td style="padding: 10px 0;">${eSlug}</td></tr>
            <tr><td style="padding: 10px 0; font-weight: bold; color: #555;">Locale</td><td style="padding: 10px 0;">${eLocale}</td></tr>
            <tr><td style="padding: 10px 0; font-weight: bold; color: #555;">Name</td><td style="padding: 10px 0;">${eName}</td></tr>
            <tr><td style="padding: 10px 0; font-weight: bold; color: #555;">Email</td><td style="padding: 10px 0;"><a href="mailto:${eEmail}">${eEmail}</a></td></tr>
            ${ePhone ? `<tr><td style="padding: 10px 0; font-weight: bold; color: #555;">Phone</td><td style="padding: 10px 0;"><a href="tel:${ePhone}">${ePhone}</a></td></tr>` : ''}
            ${eUtmSource ? `<tr><td style="padding: 10px 0; font-weight: bold; color: #555;">UTM Source</td><td style="padding: 10px 0;">${eUtmSource}</td></tr>` : ''}
            ${eUtmCampaign ? `<tr><td style="padding: 10px 0; font-weight: bold; color: #555;">UTM Campaign</td><td style="padding: 10px 0;">${eUtmCampaign}</td></tr>` : ''}
          </table>
          ${eMessage ? `<div style="margin-top: 20px; padding: 16px; background: #f5f3ef; border-radius: 8px;"><p style="color: #333; white-space: pre-wrap; line-height: 1.7;">${eMessage}</p></div>` : ''}
          <p style="margin-top: 16px; color: #999; font-size: 12px;">Lead ID: ${inserted!.id}</p>
        </div>
      `,
    }).catch((e) => console.error('[api/lp/lead] Admin email failed:', e));

    // Telegram alert
    sendTelegramAlert({
      to: 'samer',
      message: `🎯 New LP Lead — ${slug}\n👤 ${name}\n📧 ${email}${phone ? `\n📱 ${phone}` : ''}${message ? `\n💬 ${message.slice(0, 200)}` : ''}`,
    }).catch((e) => console.error('[api/lp/lead] Telegram failed:', e));

    // Zoho CRM contact (async, updates lp_leads.zoho_synced when done)
    createZohoCrmContact(name, email, phone || undefined, zohoLeadSource)
      .then(async (result) => {
        try {
          await db
            .update(lp_leads)
            .set({
              zoho_synced: true,
              zoho_synced_at: new Date().toISOString(),
              zoho_contact_id:
                result && typeof result === 'object' && 'id' in result
                  ? String((result as { id: unknown }).id)
                  : null,
            })
            .where(eq(lp_leads.id, inserted!.id));
        } catch (e) {
          console.error('[api/lp/lead] Zoho sync DB update failed:', e);
        }
      })
      .catch((e) => console.error('[api/lp/lead] Zoho contact failed:', e));

    // ── Success response ───────────────────────────────────────────────────
    const redirectUrl =
      safeRedirectUrl(leadConfig.success_redirect, request) ||
      `/${locale}/lp/${slug}/thank-you`;

    return NextResponse.json({
      success: true,
      lead_id: inserted.id,
      redirect_to: redirectUrl,
      message: isAr
        ? 'شكرًا لك. سنتواصل معك قريبًا.'
        : 'Thank you. We will be in touch shortly.',
    });
  } catch (err) {
    console.error('[api/lp/lead] Unhandled error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
