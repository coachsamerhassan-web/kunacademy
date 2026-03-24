// @ts-nocheck
/**
 * Student Data Merge Script
 * Merges 216 Excel records + 90 WordPress users, deduplicated by email
 *
 * Prerequisites:
 * 1. Export Excel as CSV → data/students/excel-export.csv
 * 2. Export WP users as JSON → data/students/wp-users.json
 * 3. Run: npx tsx scripts/migrate/merge-students.ts
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const DATA_DIR = join(__dirname, '../../data/students');

function parseCSV(content: string): Record<string, string>[] {
  const lines = content.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  return lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
    return Object.fromEntries(headers.map((h, i) => [h, values[i] || '']));
  });
}

async function main() {
  console.log('🚀 Starting student data merge...\n');
  const emailMap = new Map<string, any>();

  // Load Excel export
  const csvFile = join(DATA_DIR, 'excel-export.csv');
  if (existsSync(csvFile)) {
    const rows = parseCSV(readFileSync(csvFile, 'utf-8'));
    console.log(`📊 Excel: ${rows.length} records`);
    for (const row of rows) {
      const email = (row.email || row.Email || '').toLowerCase().trim();
      if (!email) continue;
      emailMap.set(email, {
        email,
        full_name_ar: row.name_ar || row['الاسم'] || null,
        full_name_en: row.name_en || row.Name || null,
        phone: row.phone || row.Phone || null,
        country: row.country || row.Country || null,
        source: 'excel',
      });
    }
  }

  // Load WP users (enrich existing, add new)
  const wpFile = join(DATA_DIR, 'wp-users.json');
  if (existsSync(wpFile)) {
    const wpUsers = JSON.parse(readFileSync(wpFile, 'utf-8'));
    console.log(`🌐 WordPress: ${wpUsers.length} users`);
    for (const u of wpUsers) {
      const email = (u.email || u.user_email || '').toLowerCase().trim();
      if (!email) continue;
      const existing = emailMap.get(email);
      emailMap.set(email, {
        email,
        full_name_ar: existing?.full_name_ar || u.display_name || null,
        full_name_en: existing?.full_name_en || u.display_name || null,
        phone: existing?.phone || u.phone || null,
        country: existing?.country || null,
        source: existing ? 'merged' : 'wordpress',
      });
    }
  }

  const unique = Array.from(emailMap.values());
  console.log(`\n📋 Total unique students: ${unique.length}`);
  console.log(`   From Excel only: ${unique.filter(s => s.source === 'excel').length}`);
  console.log(`   From WordPress only: ${unique.filter(s => s.source === 'wordpress').length}`);
  console.log(`   Merged (both sources): ${unique.filter(s => s.source === 'merged').length}`);

  // Create auth users + profiles via admin API
  let created = 0;
  for (const student of unique) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: student.email,
      email_confirm: true,
      user_metadata: { full_name: student.full_name_en || student.full_name_ar },
    });
    if (error) {
      if (error.message.includes('already been registered')) continue;
      console.error(`❌ ${student.email}:`, error.message);
    } else {
      created++;
      // Profile auto-created by trigger, update with full data
      await supabase.from('profiles').update({
        full_name_ar: student.full_name_ar,
        full_name_en: student.full_name_en,
        phone: student.phone,
        country: student.country,
      }).eq('id', data.user.id);
    }
  }

  console.log(`\n✅ Created ${created} new user accounts`);
}

main().catch(console.error);
