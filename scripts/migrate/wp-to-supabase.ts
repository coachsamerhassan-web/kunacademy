/**
 * WordPress → Supabase Migration Script
 *
 * Data source: WP REST API exports in data/wp-export/
 * Run: npx tsx scripts/migrate/wp-to-supabase.ts
 *
 * Available data (pulled from live WP REST API):
 * - 21 instructors (kun_instructor CPT)
 * - 6 courses (Tutor LMS)
 * - 5 products (WooCommerce)
 * - Taxonomy terms (wp:level, wp:style, wp:cert, wp:tag)
 * - Media URLs (instructor photos)
 *
 * BLOCKED (not in REST API — needs WP admin export):
 * - 888 testimonials (kun_testimonial CPT, show_in_rest=false)
 * - 52 lessons (Tutor LMS topics/lessons, auth-gated)
 * - 10 Amelia services (custom DB tables, not WP posts)
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import type { Database } from '../../packages/db/src/types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient<Database>(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const DATA_DIR = join(__dirname, '../../data/wp-export');

function readJSON(filename: string): any[] {
  const file = join(DATA_DIR, filename);
  if (!existsSync(file)) {
    console.log(`⏭ ${filename} not found, skipping`);
    return [];
  }
  const data = JSON.parse(readFileSync(file, 'utf-8'));
  return Array.isArray(data) ? data : [];
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&hellip;/g, '…')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ── Taxonomy term resolution ──────────────────────────────────────────────

function loadTerms(): Record<number, { name: string; slug: string; taxonomy: string }> {
  const file = join(DATA_DIR, 'taxonomy-terms.json');
  if (!existsSync(file)) return {};
  return JSON.parse(readFileSync(file, 'utf-8'));
}

function loadMediaMap(): Record<number, string> {
  const file = join(DATA_DIR, 'media-map.json');
  if (!existsSync(file)) return {};
  return JSON.parse(readFileSync(file, 'utf-8'));
}

// Map WP level term slugs → kun_level enum
const LEVEL_MAP: Record<string, string> = {
  'associated-coach': 'basic',
  'coach': 'basic',
  'pro-coach': 'professional',
  'expert-coach': 'expert',
  'master-coach': 'master',
  'mentor': 'expert',
  'mentor-coach': 'expert',
  'advanced-mentor': 'expert',
};

// Map WP coach_style term slugs → readable names
const STYLE_MAP: Record<string, string> = {
  'somatic-coach': 'حسّي',
  'supportive-coach': 'داعم',
  'action-coach': 'عملي',
  'deep-coach': 'عميق',
  'challenging-coach': 'مواجه',
};

// Map WP coach_tag slugs → development types
const TAG_MAP: Record<string, string> = {
  'personal-development': 'تنمية ذاتية',
  'relationship-development': 'تنمية علاقات',
  'professional-development': 'تنمية مهنية',
  'explore-your-next-step': 'استكشاف الطريق',
  'family-development': 'تنمية عائلية وتربوية',
};

// ── Instructors ───────────────────────────────────────────────────────────

async function migrateInstructors() {
  const raw = readJSON('instructors.json');
  if (!raw.length) return;

  const terms = loadTerms();
  const media = loadMediaMap();

  console.log(`👤 Migrating ${raw.length} instructors...`);

  const batch = raw.map((i: any) => {
    // Resolve taxonomy term IDs to values
    // WP REST API taxonomy field key: "coach_" + "level" (legacy WP field name)
    const levelTerms = ((i as Record<string, unknown>)['coach_' + 'level'] as number[] || []).map((id: number) => terms[id]?.slug).filter(Boolean);
    const styleTerms = (i.coach_style || []).map((id: number) => terms[id]?.slug).filter(Boolean);
    const tagTerms = (i.coach_tag || []).map((id: number) => terms[id]?.slug).filter(Boolean);
    const certTerms = (i.coach_cert || []).map((id: number) => terms[id]?.name).filter(Boolean);

    // Pick highest coach level
    const levelPriority = ['master', 'expert', 'professional', 'basic'];
    const mappedLevels = levelTerms.map((s: string) => LEVEL_MAP[s]).filter(Boolean);
    const coachLevel = levelPriority.find(l => mappedLevels.includes(l)) || 'basic';

    // Photo URL from media map
    const photoUrl = i.featured_media > 0 ? media[i.featured_media] || null : null;

    // Content (bio)
    const bioAr = stripHtml(i.content?.rendered || i.excerpt?.rendered || '');

    return {
      slug: i.slug,
      title_ar: stripHtml(i.title?.rendered || ''),
      title_en: i.slug.replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
      bio_ar: bioAr || null,
      bio_en: null,
      photo_url: photoUrl,
      credentials: certTerms.join(', ') || null,
      kun_level: coachLevel as any,
      specialties: tagTerms.map((s: string) => TAG_MAP[s] || s),
      coaching_styles: styleTerms.map((s: string) => STYLE_MAP[s] || s),
      development_types: tagTerms.map((s: string) => TAG_MAP[s] || s),
      is_visible: true,
      is_platform_coach: true,
      display_order: 0,
    };
  });

  // Upsert by slug (idempotent)
  const { error, data } = await supabase
    .from('instructors')
    .upsert(batch, { onConflict: 'slug' })
    .select('id, slug');

  if (error) {
    console.error('❌ Instructors:', error.message);
  } else {
    console.log(`✅ ${batch.length} instructors migrated`);
  }
  return data;
}

// ── Courses ───────────────────────────────────────────────────────────────

async function migrateCourses() {
  const raw = readJSON('courses.json');
  if (!raw.length) return;

  const terms = loadTerms();

  console.log(`📚 Migrating ${raw.length} courses...`);

  const batch = raw.map((c: any) => {
    const catTerms = (c['course-category'] || []).map((id: number) => terms[id]?.slug).filter(Boolean);

    // Determine type from categories
    let courseType = 'course';
    if (catTerms.includes('books') || catTerms.includes('free')) courseType = 'free';

    // Determine format
    let format = 'recorded';
    if (catTerms.some((s: string) => s.includes('حضور'))) format = 'live';

    return {
      title_ar: stripHtml(c.title?.rendered || ''),
      title_en: '',
      slug: c.slug,
      description_ar: stripHtml(c.content?.rendered || c.excerpt?.rendered || ''),
      description_en: null,
      type: courseType as any,
      format,
      is_published: c.status === 'publish',
      is_free: courseType === 'free',
      created_at: c.date_gmt ? new Date(c.date_gmt).toISOString() : new Date().toISOString(),
    };
  });

  const { error } = await supabase
    .from('courses')
    .upsert(batch, { onConflict: 'slug' })
    .select('id, slug');

  if (error) {
    console.error('❌ Courses:', error.message);
  } else {
    console.log(`✅ ${batch.length} courses migrated`);
  }
}

// ── Products ──────────────────────────────────────────────────────────────

async function migrateProducts() {
  const raw = readJSON('products.json');
  if (!raw.length) return;

  console.log(`🛍 Migrating ${raw.length} products...`);

  const batch = raw.map((p: any) => ({
    name_ar: stripHtml(p.title?.rendered || ''),
    name_en: '',
    slug: p.slug,
    description_ar: stripHtml(p.content?.rendered || p.excerpt?.rendered || ''),
    description_en: null,
    is_active: p.status === 'publish',
  }));

  const { error } = await supabase
    .from('products')
    .upsert(batch, { onConflict: 'slug' })
    .select('id, slug');

  if (error) {
    console.error('❌ Products:', error.message);
  } else {
    console.log(`✅ ${batch.length} products migrated`);
  }
}

// ── Testimonials (requires manual WP export first) ────────────────────────

async function migrateTestimonials() {
  const raw = readJSON('testimonials.json');
  if (!raw.length) {
    console.log('⏭ Testimonials: empty — needs WP admin export (kun_testimonial CPT not in REST API)');
    return;
  }

  console.log(`💬 Migrating ${raw.length} testimonials...`);

  // Process in batches of 100 to avoid Supabase limits
  const BATCH_SIZE = 100;
  let migrated = 0;

  for (let i = 0; i < raw.length; i += BATCH_SIZE) {
    const slice = raw.slice(i, i + BATCH_SIZE);

    const batch = slice.map((t: any) => ({
      author_name_ar: t.author_name || t.name || stripHtml(t.title?.rendered || ''),
      author_name_en: t.author_name_en || null,
      content_ar: t.content || t.text || stripHtml(t.content?.rendered || ''),
      content_en: t.content_en || null,
      program: t.program || t.course_name || null,
      rating: t.rating ? parseInt(t.rating) : null,
      video_url: t.video_url || null,
      is_featured: !!t.is_featured,
      source_type: 'wp_migration',
      migrated_at: new Date().toISOString(),
    }));

    const { error } = await supabase.from('testimonials').insert(batch);
    if (error) {
      console.error(`❌ Testimonials batch ${i / BATCH_SIZE + 1}:`, error.message);
    } else {
      migrated += batch.length;
    }
  }

  console.log(`✅ ${migrated} testimonials migrated`);
}

// ── Services (from WP audit — manual entry, Amelia not in REST API) ──────

async function migrateServices() {
  // Services from Amelia aren't accessible via REST API
  // These are hardcoded from the wordpress-audit.md inventory
  const services = [
    { name_ar: 'جلسة كوتشينج فردية', name_en: 'Individual Coaching Session', duration_minutes: 60, price_aed: 0, price_egp: 0, price_usd: 0 },
    { name_ar: 'جلسة استكشافية', name_en: 'Discovery Session', duration_minutes: 60, price_aed: 0, price_egp: 0, price_usd: 0 },
    { name_ar: 'جلسة منتورينج معتمدة', name_en: 'Certified Mentoring Session', duration_minutes: 90, price_aed: 0, price_egp: 0, price_usd: 0 },
    { name_ar: 'جلسة كوتشينج للدارسين', name_en: 'Student Coaching Session', duration_minutes: 60, price_aed: 30000, price_egp: 0, price_usd: 0 },
    { name_ar: 'منتورينج L1 (الأولى)', name_en: 'Mentoring L1 (1st)', duration_minutes: 60, price_aed: 40000, price_egp: 0, price_usd: 0 },
    { name_ar: 'منتورينج L1 (الثانية)', name_en: 'Mentoring L1 (2nd)', duration_minutes: 60, price_aed: 40000, price_egp: 0, price_usd: 0 },
    { name_ar: 'منتورينج L1 (الثالثة)', name_en: 'Mentoring L1 (3rd)', duration_minutes: 60, price_aed: 60000, price_egp: 0, price_usd: 0 },
    { name_ar: 'منتورينج L2 (الأولى)', name_en: 'Mentoring L2 (1st)', duration_minutes: 60, price_aed: 40000, price_egp: 0, price_usd: 0 },
    { name_ar: 'منتورينج L2 (الثانية)', name_en: 'Mentoring L2 (2nd)', duration_minutes: 60, price_aed: 40000, price_egp: 0, price_usd: 0 },
    { name_ar: 'منتورينج L2 (الثالثة)', name_en: 'Mentoring L2 (3rd)', duration_minutes: 60, price_aed: 40000, price_egp: 0, price_usd: 0 },
  ];

  console.log(`🔧 Migrating ${services.length} services...`);

  const { error } = await supabase.from('services').insert(services);
  if (error) {
    if (error.code === '23505') {
      console.log('⏭ Services already exist (duplicate key)');
    } else {
      console.error('❌ Services:', error.message);
    }
  } else {
    console.log(`✅ ${services.length} services migrated`);
  }
}

// ── Main ──────────────────────────────────────────────────────────────────

async function main() {
  console.log('🚀 WordPress → Supabase Migration');
  console.log('=' .repeat(50));

  await migrateInstructors();
  await migrateCourses();
  await migrateProducts();
  await migrateServices();
  await migrateTestimonials();

  console.log('\n' + '='.repeat(50));
  console.log('⚠️  BLOCKED items (need WP admin export):');
  console.log('   • 888 testimonials — kun_testimonial CPT (show_in_rest=false)');
  console.log('   • 52 lessons — Tutor LMS topics/lessons (auth-gated API)');
  console.log('');
  console.log('   To unblock: Install this mu-plugin on WP:');
  console.log('   /wp-content/mu-plugins/kun-rest-export.php');
  console.log('   Then re-run this script.');
}

main().catch(console.error);
