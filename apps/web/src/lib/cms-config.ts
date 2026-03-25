// CMS-driven business configuration
// Reads from CMS Settings sheet (category: "business")
// Falls back to sensible defaults when CMS is unavailable.
//
// Usage:
//   import { getBusinessConfig } from '@/lib/cms-config';
//   const config = await getBusinessConfig();
//   console.log(config.referral_reward_amount); // 5000 (minor units)

import { cms } from '@kunacademy/cms';

export interface BusinessConfig {
  /** Referral reward in minor units (default: 5000 = 50 AED) */
  referral_reward_amount: number;
  /** Referral reward currency */
  referral_reward_currency: string;
  /** Download token expiry in hours (default: 72) */
  download_token_expiry_hours: number;
  /** Max downloads per token (default: 3) */
  download_max_count: number;
  /** Deposit percentage for installment plans (default: 30) */
  deposit_percentage: number;
  /** Payout holding period in days (default: 7) */
  payout_holding_days: number;
  /** Default commission rate for services (default: 30) */
  default_commission_services: number;
  /** Default commission rate for products (default: 20) */
  default_commission_products: number;
  /** WhatsApp quiet hours start (24h format, default: 22) */
  whatsapp_quiet_start: number;
  /** WhatsApp quiet hours end (24h format, default: 8) */
  whatsapp_quiet_end: number;
}

const DEFAULTS: BusinessConfig = {
  referral_reward_amount: 5000,
  referral_reward_currency: 'AED',
  download_token_expiry_hours: 72,
  download_max_count: 3,
  deposit_percentage: 30,
  payout_holding_days: 7,
  default_commission_services: 30,
  default_commission_products: 20,
  whatsapp_quiet_start: 22,
  whatsapp_quiet_end: 8,
};

let cachedConfig: BusinessConfig | null = null;
let cacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 min — aligned with CMS ISR

export async function getBusinessConfig(): Promise<BusinessConfig> {
  if (cachedConfig && Date.now() - cacheTime < CACHE_TTL) {
    return cachedConfig;
  }

  try {
    const settings = await cms.getAllSettings();
    const biz = settings['business'] || {};

    cachedConfig = {
      referral_reward_amount: parseInt(biz['referral_reward_amount'] || '') || DEFAULTS.referral_reward_amount,
      referral_reward_currency: biz['referral_reward_currency'] || DEFAULTS.referral_reward_currency,
      download_token_expiry_hours: parseInt(biz['download_token_expiry_hours'] || '') || DEFAULTS.download_token_expiry_hours,
      download_max_count: parseInt(biz['download_max_count'] || '') || DEFAULTS.download_max_count,
      deposit_percentage: parseInt(biz['deposit_percentage'] || '') || DEFAULTS.deposit_percentage,
      payout_holding_days: parseInt(biz['payout_holding_days'] || '') || DEFAULTS.payout_holding_days,
      default_commission_services: parseInt(biz['default_commission_services'] || '') || DEFAULTS.default_commission_services,
      default_commission_products: parseInt(biz['default_commission_products'] || '') || DEFAULTS.default_commission_products,
      whatsapp_quiet_start: parseInt(biz['whatsapp_quiet_start'] || '') || DEFAULTS.whatsapp_quiet_start,
      whatsapp_quiet_end: parseInt(biz['whatsapp_quiet_end'] || '') || DEFAULTS.whatsapp_quiet_end,
    };
    cacheTime = Date.now();
  } catch {
    cachedConfig = { ...DEFAULTS };
    cacheTime = Date.now();
  }

  return cachedConfig;
}

/** Invalidate config cache (called by revalidation webhook) */
export function invalidateBusinessConfig() {
  cachedConfig = null;
  cacheTime = 0;
}
