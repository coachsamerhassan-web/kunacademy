#!/usr/bin/env npx tsx
/**
 * Migrate testimonials from CSV → Supabase testimonials table.
 * Source: /Users/samer/Claude Code/Workspace/CTO/output/testimonials-cms-data.csv
 * Target: Supabase `testimonials` table
 *
 * Also updates Google Sheets CMS if GOOGLE_SHEETS_API_KEY is set.
 *
 * Usage: npx tsx scripts/migrate-testimonials.ts
 * Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const CSV_PATH = resolve('/Users/samer/Claude Code/Workspace/CTO/output/testimonials-cms-data.csv');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function parseCSV(content: string): Record<string, string>[] {
  const lines = content.split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim());
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (const char of lines[i]) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());

    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] || '';
    });
    rows.push(row);
  }

  return rows;
}

async function main() {
  console.log('=== Testimonial Migration ===\n');

  // 1. Read CSV
  const csvContent = readFileSync(CSV_PATH, 'utf-8');
  const rows = parseCSV(csvContent);
  console.log(`Parsed ${rows.length} testimonials from CSV`);

  // 2. Classify testimonials
  const stats = { arabic: 0, english: 0, bilingual: 0, video: 0, featured: 0, byProgram: {} as Record<string, number> };

  for (const row of rows) {
    if (row.content_ar && row.content_en) stats.bilingual++;
    else if (row.content_ar) stats.arabic++;
    else if (row.content_en) stats.english++;
    if (row.video_url) stats.video++;
    if (row.is_featured?.toUpperCase() === 'TRUE') stats.featured++;
    const prog = row.program || 'General';
    stats.byProgram[prog] = (stats.byProgram[prog] || 0) + 1;
  }

  console.log(`\nClassification:`);
  console.log(`  Arabic only: ${stats.arabic}`);
  console.log(`  English only: ${stats.english}`);
  console.log(`  Bilingual: ${stats.bilingual}`);
  console.log(`  With video: ${stats.video}`);
  console.log(`  Featured: ${stats.featured}`);
  console.log(`  By program:`, stats.byProgram);

  // 3. Migrate to Supabase
  if (!supabaseUrl || !supabaseKey) {
    console.log('\n⚠️  Supabase not configured. Skipping DB migration.');
    console.log('   Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to migrate.');
    console.log('\n✅ CSV parsed and classified successfully. Data ready for migration.');
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Check existing testimonials
  const { count: existingCount } = await supabase
    .from('testimonials')
    .select('id', { count: 'exact', head: true });

  console.log(`\nExisting testimonials in Supabase: ${existingCount || 0}`);

  if (existingCount && existingCount > 0) {
    console.log('Testimonials already exist. Running upsert (update existing, add new)...');
  }

  // Prepare records
  const records = rows.map((row, i) => ({
    slug: row.id || `testimonial-${i + 1}`,
    name_ar: row.name_ar || '',
    name_en: row.name_en || '',
    content_ar: row.content_ar || '',
    content_en: row.content_en || '',
    program: row.program || null,
    role_ar: row.role_ar || null,
    role_en: row.role_en || null,
    location_ar: row.location_ar || null,
    location_en: row.location_en || null,
    country_code: row.country_code || null,
    photo_url: row.photo_url || null,
    video_url: row.video_url || null,
    is_featured: row.is_featured?.toUpperCase() === 'TRUE',
    display_order: parseInt(row.display_order) || i + 1,
    is_published: row.published?.toUpperCase() !== 'FALSE',
  }));

  // Upsert in batches of 20
  let inserted = 0;
  let errors = 0;

  for (let i = 0; i < records.length; i += 20) {
    const batch = records.slice(i, i + 20);
    const { error } = await supabase
      .from('testimonials')
      .upsert(batch as any, { onConflict: 'slug' });

    if (error) {
      console.error(`Batch ${Math.floor(i / 20) + 1} error:`, error.message);
      errors += batch.length;
    } else {
      inserted += batch.length;
    }
  }

  console.log(`\n✅ Migration complete: ${inserted} upserted, ${errors} errors`);
}

main().catch(console.error);
