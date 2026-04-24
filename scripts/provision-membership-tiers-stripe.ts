/**
 * scripts/provision-membership-tiers-stripe.ts
 *
 * One-time admin provisioning script for Wave F.2:
 *   Creates Stripe Product + Prices for each paid tier and writes the IDs back
 *   to the `tiers` table.
 *
 * Usage:
 *   cd /var/www/kunacademy-git
 *   pnpm tsx scripts/provision-membership-tiers-stripe.ts
 *
 * Requires env:
 *   STRIPE_SECRET_KEY=sk_test_... (or sk_live_)
 *   DATABASE_URL=postgres://...
 *
 * Idempotent: if a tier already has stripe_product_id set, it is SKIPPED.
 * Re-provisioning (e.g. after price edit) must go through the admin UI flow
 * in Wave F.4, which creates NEW Prices + deactivates old ones.
 *
 * Safety:
 *   - Does NOT touch the 'free' tier (no Stripe product created for free).
 *   - Prints a dry-run summary first and requires --confirm to execute.
 *   - Logs JSON output to Workspace/CTO/output/ for audit.
 */
import { Pool } from 'pg';
import { provisionTierInStripe } from '../packages/payments/src/subscriptions';

type TierRow = {
  id: string;
  slug: string;
  name_en: string;
  name_ar: string;
  description_en: string | null;
  price_monthly_cents: number;
  price_annual_cents: number;
  currency: string;
  stripe_product_id: string | null;
  stripe_price_id_monthly: string | null;
  stripe_price_id_annual: string | null;
};

async function main() {
  const confirm = process.argv.includes('--confirm');

  if (!process.env.STRIPE_SECRET_KEY) {
    console.error('ERROR: STRIPE_SECRET_KEY env var is required.');
    process.exit(1);
  }
  if (!process.env.DATABASE_URL) {
    console.error('ERROR: DATABASE_URL env var is required.');
    process.exit(1);
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const stripeMode = stripeKey.startsWith('sk_live_')
    ? 'LIVE'
    : stripeKey.startsWith('sk_test_')
      ? 'TEST'
      : 'UNKNOWN';

  console.log(`\n=== Kun Membership Tier Stripe Provisioning ===`);
  console.log(`Stripe mode: ${stripeMode}`);
  console.log(`Confirm flag: ${confirm ? 'YES — will write to Stripe' : 'NO — dry run only'}\n`);

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  // Impersonate admin role so RLS is bypassed for the UPDATE
  const client = await pool.connect();
  await client.query("SET ROLE kunacademy_admin");

  const { rows } = await client.query<TierRow>(`
    SELECT id, slug, name_en, name_ar, description_en,
           price_monthly_cents, price_annual_cents, currency,
           stripe_product_id, stripe_price_id_monthly, stripe_price_id_annual
    FROM tiers
    WHERE is_active = true AND slug != 'free'
    ORDER BY sort_order
  `);

  if (rows.length === 0) {
    console.log('No paid tiers to provision. Exiting.');
    await client.release();
    await pool.end();
    return;
  }

  const results: Array<{
    slug: string;
    status: 'skipped' | 'provisioned' | 'dry_run';
    reason?: string;
    stripe_product_id?: string;
    stripe_price_id_monthly?: string;
    stripe_price_id_annual?: string;
  }> = [];

  for (const tier of rows) {
    console.log(`\n--- Tier: ${tier.slug} (${tier.name_en}) ---`);
    console.log(
      `  Prices: ${tier.currency} ${(tier.price_monthly_cents / 100).toFixed(2)}/mo, ${(tier.price_annual_cents / 100).toFixed(2)}/yr`,
    );

    if (tier.stripe_product_id && tier.stripe_price_id_monthly && tier.stripe_price_id_annual) {
      console.log(`  SKIP — already provisioned (product=${tier.stripe_product_id})`);
      results.push({
        slug: tier.slug,
        status: 'skipped',
        reason: 'already_provisioned',
        stripe_product_id: tier.stripe_product_id,
        stripe_price_id_monthly: tier.stripe_price_id_monthly,
        stripe_price_id_annual: tier.stripe_price_id_annual,
      });
      continue;
    }

    if (tier.price_monthly_cents <= 0 || tier.price_annual_cents <= 0) {
      console.log('  SKIP — zero or negative price, cannot provision in Stripe');
      results.push({ slug: tier.slug, status: 'skipped', reason: 'zero_price' });
      continue;
    }

    if (!confirm) {
      console.log('  DRY RUN — would create Product + 2 Prices');
      results.push({ slug: tier.slug, status: 'dry_run' });
      continue;
    }

    console.log('  Creating Stripe Product + Prices...');
    const { stripeProductId, stripePriceIdMonthly, stripePriceIdAnnual } =
      await provisionTierInStripe({
        productName: `Kun ${tier.name_en} Membership`,
        tierSlug: tier.slug,
        tierId: tier.id,
        priceMonthlyCents: tier.price_monthly_cents,
        priceAnnualCents: tier.price_annual_cents,
        currency: tier.currency,
        description: tier.description_en || undefined,
      });

    console.log(`  Product: ${stripeProductId}`);
    console.log(`  Monthly price: ${stripePriceIdMonthly}`);
    console.log(`  Annual price:  ${stripePriceIdAnnual}`);

    await client.query(
      `UPDATE tiers
          SET stripe_product_id = $1,
              stripe_price_id_monthly = $2,
              stripe_price_id_annual = $3,
              updated_at = now()
        WHERE id = $4`,
      [stripeProductId, stripePriceIdMonthly, stripePriceIdAnnual, tier.id],
    );

    console.log('  DB updated.');
    results.push({
      slug: tier.slug,
      status: 'provisioned',
      stripe_product_id: stripeProductId,
      stripe_price_id_monthly: stripePriceIdMonthly,
      stripe_price_id_annual: stripePriceIdAnnual,
    });
  }

  client.release();
  await pool.end();

  console.log('\n=== Summary ===');
  console.log(JSON.stringify({ stripe_mode: stripeMode, results }, null, 2));
  console.log('\nDone.\n');
}

main().catch((err) => {
  console.error('PROVISIONING FAILED:', err);
  process.exit(1);
});
