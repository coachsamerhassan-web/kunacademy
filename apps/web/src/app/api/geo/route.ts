import { NextResponse, type NextRequest } from 'next/server';

/**
 * GET /api/geo — Returns the visitor's country code.
 *
 * On Vercel: reads x-vercel-ip-country (free, zero-latency).
 * Fallback: returns 'XX' (unknown) — client uses timezone detection.
 */
export async function GET(request: NextRequest) {
  const country =
    request.headers.get('x-vercel-ip-country') || // Vercel edge header
    request.headers.get('cf-ipcountry') ||         // Cloudflare fallback
    'XX';

  return NextResponse.json({
    country: country.toUpperCase(),
    // Derived flags the client needs
    is_egypt: country.toUpperCase() === 'EG',
    is_gulf: ['AE', 'SA', 'KW', 'QA', 'BH', 'OM'].includes(country.toUpperCase()),
  });
}
