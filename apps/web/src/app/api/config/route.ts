import { NextResponse } from 'next/server';
import { getBusinessConfig } from '@/lib/cms-config';

/**
 * Public API for CMS business config.
 * Client components fetch this to get configurable values.
 * Cached via ISR (5 min) + CDN.
 */
export async function GET() {
  const config = await getBusinessConfig();

  // Only expose client-safe values (no internal operational settings)
  return NextResponse.json({
    referral_reward_amount: config.referral_reward_amount,
    referral_reward_currency: config.referral_reward_currency,
    download_max_count: config.download_max_count,
    download_token_expiry_hours: config.download_token_expiry_hours,
    deposit_percentage: config.deposit_percentage,
  }, {
    headers: {
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60',
    },
  });
}
