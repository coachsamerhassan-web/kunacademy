// @ts-nocheck
/**
 * WordPress → Supabase Migration Script
 *
 * Prerequisites:
 * 1. WordPress DB dump as SQL or JSON export
 * 2. SUPABASE_SERVICE_ROLE_KEY in .env.local
 * 3. Run: npx tsx scripts/migrate/wp-to-supabase.ts
 *
 * This script handles:
 * - 888 testimonials
 * - 39 instructors
 * - 6 courses
 * - 12 products
 * - 4 blog posts
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const DATA_DIR = join(__dirname, '../../data/wp-export');

async function migrateTestimonials() {
  const file = join(DATA_DIR, 'testimonials.json');
  if (!existsSync(file)) { console.log('⏭ testimonials.json not found, skipping'); return; }
  const raw = JSON.parse(readFileSync(file, 'utf-8'));
  console.log(`📝 Migrating ${raw.length} testimonials...`);

  const batch = raw.map((t: any) => ({
    author_name_ar: t.author_name || t.name,
    author_name_en: t.author_name_en || null,
    content_ar: t.content || t.text,
    content_en: t.content_en || null,
    program: t.program || t.course_name || null,
    rating: t.rating ? parseInt(t.rating) : null,
    video_url: t.video_url || null,
    is_featured: !!t.is_featured,
    source_type: 'wp_migration',
    migrated_at: new Date().toISOString(),
  }));

  const { error } = await supabase.from('testimonials').insert(batch);
  if (error) console.error('❌ Testimonials:', error.message);
  else console.log(`✅ ${batch.length} testimonials migrated`);
}

async function migrateInstructors() {
  const file = join(DATA_DIR, 'instructors.json');
  if (!existsSync(file)) { console.log('⏭ instructors.json not found, skipping'); return; }
  const raw = JSON.parse(readFileSync(file, 'utf-8'));
  console.log(`📝 Migrating ${raw.length} instructors...`);

  const batch = raw.map((i: any) => ({
    slug: i.slug || i.name?.toLowerCase().replace(/\s+/g, '-'),
    title_ar: i.title_ar || i.name,
    title_en: i.title_en || i.name_en || i.name,
    bio_ar: i.bio_ar || i.bio || null,
    bio_en: i.bio_en || null,
    photo_url: i.photo_url || i.avatar || null,
    credentials: i.credentials || null,
    specialties: i.specialties || [],
    is_visible: true,
  }));

  const { error } = await supabase.from('instructors').insert(batch);
  if (error) console.error('❌ Instructors:', error.message);
  else console.log(`✅ ${batch.length} instructors migrated`);
}

async function migrateCourses() {
  const file = join(DATA_DIR, 'courses.json');
  if (!existsSync(file)) { console.log('⏭ courses.json not found, skipping'); return; }
  const raw = JSON.parse(readFileSync(file, 'utf-8'));
  console.log(`📝 Migrating ${raw.length} courses...`);

  for (const c of raw) {
    const { error } = await supabase.from('courses').insert({
      title_ar: c.title_ar || c.title,
      title_en: c.title_en || c.title,
      slug: c.slug || c.title?.toLowerCase().replace(/\s+/g, '-'),
      description_ar: c.description_ar || c.description || null,
      description_en: c.description_en || null,
      price_aed: c.price_aed ? parseInt(c.price_aed) : 0,
      price_usd: c.price_usd ? parseInt(c.price_usd) : 0,
      duration_hours: c.duration_hours ? parseFloat(c.duration_hours) : null,
      type: c.type || 'course',
      nav_group: c.nav_group || 'courses',
      is_published: true,
    });
    if (error) console.error(`❌ Course ${c.title}:`, error.message);
  }
  console.log(`✅ ${raw.length} courses migrated`);
}

async function migrateProducts() {
  const file = join(DATA_DIR, 'products.json');
  if (!existsSync(file)) { console.log('⏭ products.json not found, skipping'); return; }
  const raw = JSON.parse(readFileSync(file, 'utf-8'));
  console.log(`📝 Migrating ${raw.length} products...`);

  const batch = raw.map((p: any) => ({
    name_ar: p.name_ar || p.name,
    name_en: p.name_en || p.name,
    slug: p.slug || p.name?.toLowerCase().replace(/\s+/g, '-'),
    description_ar: p.description_ar || p.description || null,
    description_en: p.description_en || null,
    price_aed: p.price_aed ? parseInt(p.price_aed) : 0,
    images: p.images || [],
    stock: p.stock ?? 999,
    is_active: true,
  }));

  const { error } = await supabase.from('products').insert(batch);
  if (error) console.error('❌ Products:', error.message);
  else console.log(`✅ ${batch.length} products migrated`);
}

async function migratePosts() {
  const file = join(DATA_DIR, 'posts.json');
  if (!existsSync(file)) { console.log('⏭ posts.json not found, skipping'); return; }
  const raw = JSON.parse(readFileSync(file, 'utf-8'));
  console.log(`📝 Migrating ${raw.length} posts...`);

  const batch = raw.map((p: any) => ({
    title_ar: p.title_ar || p.title,
    title_en: p.title_en || p.title,
    slug: p.slug,
    content_ar: p.content_ar || p.content || null,
    content_en: p.content_en || null,
    excerpt_ar: p.excerpt_ar || p.excerpt || null,
    category: p.category || null,
    featured_image: p.featured_image || null,
    is_published: true,
    published_at: p.date || new Date().toISOString(),
  }));

  const { error } = await supabase.from('posts').insert(batch);
  if (error) console.error('❌ Posts:', error.message);
  else console.log(`✅ ${batch.length} posts migrated`);
}

async function main() {
  console.log('🚀 Starting WordPress → Supabase migration...\n');
  await migrateTestimonials();
  await migrateInstructors();
  await migrateCourses();
  await migrateProducts();
  await migratePosts();
  console.log('\n✅ Migration complete!');
}

main().catch(console.error);
