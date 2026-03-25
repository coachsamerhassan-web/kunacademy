#!/usr/bin/env npx tsx
/**
 * Migrate testimonials from CSV → Google Sheets CMS (Testimonials tab).
 * Source: /Users/samer/Claude Code/Workspace/CTO/output/testimonials-cms-data.csv
 * Target: Google Sheet "Testimonials" tab
 *
 * Usage: npx tsx scripts/migrate-testimonials.ts
 * Requires: GOOGLE_SERVICE_ACCOUNT_PATH env var (or credentials/google-service-account.json)
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { google } from 'googleapis';

const CSV_PATH = resolve('/Users/samer/Claude Code/Workspace/CTO/output/testimonials-cms-data.csv');
const SPREADSHEET_ID = '1CLChiKTXGvUDmPFHcjCpa3TmmC6F0KG5RnFCsCiBLIg';
const SHEET_NAME = 'Testimonials';

// CMS column order must match what sheets-provider.ts reads
const CMS_HEADERS = [
  'id', 'name_ar', 'name_en', 'content_ar', 'content_en',
  'program', 'role_ar', 'role_en', 'location_ar', 'location_en',
  'country_code', 'photo_url', 'video_url', 'is_featured',
  'display_order', 'published',
];

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
  console.log('=== Testimonial Migration → Google Sheets CMS ===\n');

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

  // 3. Auth with service account
  const saKeyPath = process.env.GOOGLE_SERVICE_ACCOUNT_PATH
    || resolve(__dirname, '../credentials/google-service-account.json');

  const auth = new google.auth.GoogleAuth({
    keyFile: saKeyPath,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth });

  // 4. Check existing data in Testimonials tab
  let existingRows = 0;
  try {
    const existing = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A:A`,
    });
    existingRows = (existing.data.values?.length ?? 1) - 1; // minus header
    console.log(`\nExisting testimonials in sheet: ${existingRows}`);
  } catch (err: any) {
    if (err.code === 400 || err.message?.includes('Unable to parse range')) {
      console.log('\nTestimonials tab not found — will create it.');
      // Create the sheet tab
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: {
          requests: [{
            addSheet: {
              properties: { title: SHEET_NAME },
            },
          }],
        },
      });
      console.log(`Created "${SHEET_NAME}" tab.`);
    } else {
      throw err;
    }
  }

  // 5. Prepare data rows (header + all testimonials)
  const dataRows = rows.map((row) => {
    return CMS_HEADERS.map(h => {
      if (h === 'published') return row[h] || 'TRUE';
      if (h === 'is_featured') return row[h] || 'FALSE';
      if (h === 'display_order') return row[h] || '';
      return row[h] || '';
    });
  });

  // 6. Write to sheet (clear + write header + data)
  const allValues = [CMS_HEADERS, ...dataRows];
  const range = `${SHEET_NAME}!A1`;

  // Clear existing data first
  await sheets.spreadsheets.values.clear({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A:P`,
  });

  // Write all data
  const result = await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range,
    valueInputOption: 'RAW',
    requestBody: {
      values: allValues,
    },
  });

  console.log(`\n✅ Migration complete!`);
  console.log(`   Wrote ${result.data.updatedRows} rows (1 header + ${rows.length} testimonials)`);
  console.log(`   Sheet: ${SHEET_NAME}`);
  console.log(`   Spreadsheet: https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}`);
}

main().catch(console.error);
