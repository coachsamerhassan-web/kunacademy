#!/usr/bin/env npx tsx
/**
 * Seed products into Supabase.
 * Usage: npx tsx scripts/seed-products.ts
 */
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(__dirname, '../apps/web/.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const products = [
  {
    name_ar: 'كتاب من التوازن إلى البركة — نسخة إلكترونية',
    name_en: 'From Balance to Barakah — eBook',
    slug: 'balance-to-barakah-ebook',
    description_ar: 'النسخة الإلكترونية الكاملة من كتاب "من التوازن إلى البركة" للكوتش سامر حسن',
    description_en: 'Full digital edition of "From Balance to Barakah" by Coach Samer Hassan',
    price_aed: 7500,   // 75 AED
    price_egp: 45000,  // 450 EGP
    price_usd: 2000,   // ~20 USD
    images: [],
    stock: -1,         // unlimited (digital)
    is_active: true,
  },
  {
    name_ar: 'كتاب من التوازن إلى البركة — نسخة ورقية (مصر فقط)',
    name_en: 'From Balance to Barakah — Hard Copy (Egypt Only)',
    slug: 'balance-to-barakah-hardcopy',
    description_ar: 'النسخة الورقية من كتاب "من التوازن إلى البركة" — التوصيل داخل مصر فقط (٦٠٠ ج.م + ١٥٠ ج.م توصيل)',
    description_en: 'Printed edition of "From Balance to Barakah" — Egypt delivery only (600 EGP + 150 EGP shipping)',
    price_aed: 0,
    price_egp: 75000,  // 750 EGP (600 + 150 delivery)
    price_usd: 0,
    images: [],
    stock: 50,
    is_active: true,
  },
  {
    name_ar: 'كتاب من التوازن إلى البركة — عينة مجانية',
    name_en: 'From Balance to Barakah — Free Sample',
    slug: 'balance-to-barakah-sample',
    description_ar: 'عينة مجانية من كتاب "من التوازن إلى البركة"',
    description_en: 'Free sample from "From Balance to Barakah"',
    price_aed: 0,
    price_egp: 0,
    price_usd: 0,
    images: [],
    stock: -1,
    is_active: true,
  },
];

async function main() {
  console.log('=== Product Seeding ===\n');

  // Check existing
  const { data: existing } = await supabase.from('products').select('slug');
  const existingSlugs = new Set((existing || []).map((p: any) => p.slug));
  console.log(`Existing products: ${existingSlugs.size}`);

  for (const p of products) {
    if (existingSlugs.has(p.slug)) {
      const { error } = await supabase.from('products').update(p).eq('slug', p.slug);
      console.log(error ? `❌ ${p.slug}: ${error.message}` : `✅ Updated: ${p.slug}`);
    } else {
      const { error } = await supabase.from('products').insert(p);
      console.log(error ? `❌ ${p.slug}: ${error.message}` : `✅ Inserted: ${p.slug}`);
    }
  }

  // Verify
  const { data: all } = await supabase.from('products').select('slug, name_ar, price_aed, price_egp, is_active');
  console.log('\nAll products:');
  for (const p of all || []) {
    console.log(`  ${p.slug}: ${p.name_ar} — ${p.price_aed/100} AED / ${p.price_egp/100} EGP`);
  }
}

main().catch(console.error);
