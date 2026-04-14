#!/usr/bin/env npx tsx
/**
 * F.1: Migrate instructors from Tutor LMS API → CMS Team sheet + Supabase profiles.
 *
 * Data sources:
 * 1. Tutor LMS REST API (kunacademy.com/wp-json/tutor/v1/)
 * 2. Cross-reference with existing CMS data
 *
 * Outputs:
 * - JSON file for CMS Team sheet population
 * - Supabase profile records (when configured)
 *
 * Usage: npx tsx scripts/migrate-instructors.ts
 */
import { writeFileSync } from 'fs';
import { resolve } from 'path';

const TUTOR_API_BASE = 'https://kunacademy.com/wp-json/tutor/v1';
const TUTOR_API_KEY = 'key_1139e70f4a1775bd070f9a2097952d9b';
const TUTOR_API_SECRET = 'secret_137ce033ad2c13e6d393c43142ddaae639d9e14e94bf95b08d6781b72c7fc239';
const AUTH_HEADER = 'Basic ' + Buffer.from(`${TUTOR_API_KEY}:${TUTOR_API_SECRET}`).toString('base64');

const OUTPUT_DIR = resolve('/Users/samer/Claude Code/Workspace/CTO/output/migration');

interface TutorInstructor {
  ID: number;
  display_name: string;
  user_email: string;
  user_login: string;
  avatar_url?: string;
  bio?: string;
  course_count?: number;
  student_count?: number;
  rating?: { rating: number; count: number };
}

interface TutorCourse {
  ID: number;
  post_title: string;
  post_name: string;
  post_content?: string;
  post_status: string;
  course_duration?: string;
  course_level?: string;
  course_categories?: Array<{ name: string; slug: string }>;
  topics?: Array<{
    ID: number;
    post_title: string;
    lessons?: Array<{
      ID: number;
      post_title: string;
      video?: { source: string; source_video_id: string };
    }>;
  }>;
}

async function fetchTutor(endpoint: string): Promise<any> {
  const url = `${TUTOR_API_BASE}${endpoint}`;
  console.log(`  Fetching: ${url}`);

  const res = await fetch(url, {
    headers: { Authorization: AUTH_HEADER },
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`  ❌ ${res.status}: ${text.slice(0, 200)}`);
    return null;
  }

  return res.json();
}

async function main() {
  console.log('=== F.1: WordPress Data Migration ===\n');

  // 1. Fetch instructors
  console.log('1. Fetching instructors from Tutor LMS...');
  const instructorsData = await fetchTutor('/instructors?per_page=100');

  if (!instructorsData) {
    console.log('   Trying alternative endpoint...');
    // Some Tutor LMS versions use different endpoints
    const alt = await fetchTutor('/instructor-list?per_page=100');
    if (!alt) {
      console.error('   ❌ Could not fetch instructors. Trying courses for instructor data...');
    }
  }

  const instructors: TutorInstructor[] = Array.isArray(instructorsData)
    ? instructorsData
    : instructorsData?.data || instructorsData?.instructors || [];

  console.log(`   Found ${instructors.length} instructors\n`);

  // 2. Fetch courses
  console.log('2. Fetching courses from Tutor LMS...');
  const coursesData = await fetchTutor('/courses?per_page=100');

  const courses: TutorCourse[] = Array.isArray(coursesData)
    ? coursesData
    : coursesData?.data || coursesData?.posts || [];

  console.log(`   Found ${courses.length} courses\n`);

  // 3. Extract lessons from courses
  console.log('3. Extracting lessons from course curriculum...');
  let totalLessons = 0;
  const allLessons: Array<{
    course_id: number;
    course_name: string;
    topic_name: string;
    lesson_id: number;
    lesson_title: string;
    video_source?: string;
    video_id?: string;
  }> = [];

  for (const course of courses) {
    // Fetch full course with curriculum
    const fullCourse = await fetchTutor(`/courses/${course.ID}`);
    const topics = fullCourse?.topics || fullCourse?.data?.topics || course.topics || [];

    for (const topic of topics) {
      for (const lesson of topic.lessons || []) {
        allLessons.push({
          course_id: course.ID,
          course_name: course.post_title,
          topic_name: topic.post_title,
          lesson_id: lesson.ID,
          lesson_title: lesson.post_title,
          video_source: lesson.video?.source,
          video_id: lesson.video?.source_video_id,
        });
        totalLessons++;
      }
    }
  }

  console.log(`   Extracted ${totalLessons} lessons\n`);

  // 4. Map instructors to CMS Team format
  const teamMembers = instructors.map((inst, i) => ({
    slug: inst.user_login || `instructor-${inst.ID}`,
    name_ar: inst.display_name, // Will need manual Arabic translation
    name_en: inst.display_name,
    title_ar: '',
    title_en: '',
    bio_ar: inst.bio || '',
    bio_en: inst.bio || '',
    photo_url: inst.avatar_url || '',
    icf_credential: '',
    kun_level: '',
    credentials: '',
    specialties: [],
    languages: ['ar'],
    is_visible: true,
    is_bookable: false,
    display_order: i + 1,
    email: inst.user_email,
    tutor_id: inst.ID,
    course_count: inst.course_count || 0,
    student_count: inst.student_count || 0,
    rating: inst.rating?.rating || 0,
    rating_count: inst.rating?.count || 0,
  }));

  // 5. Map courses to Programs format
  const programs = courses.map((course, i) => ({
    slug: course.post_name,
    title_ar: course.post_title,
    title_en: course.post_title, // Needs EN translation
    type: course.course_level === 'beginner' ? 'recorded-course' : 'live-course',
    format: 'online',
    duration: course.course_duration || '',
    categories: course.course_categories?.map(c => c.name) || [],
    lesson_count: allLessons.filter(l => l.course_id === course.ID).length,
    status: course.post_status,
    tutor_id: course.ID,
  }));

  // 6. Save outputs
  console.log('4. Saving migration data...\n');

  const output = {
    meta: {
      exported_at: new Date().toISOString(),
      source: 'Tutor LMS REST API',
      site: 'kunacademy.com',
    },
    instructors: teamMembers,
    courses: programs,
    lessons: allLessons,
    stats: {
      instructors: instructors.length,
      courses: courses.length,
      lessons: totalLessons,
    },
  };

  // Ensure output dir exists
  const { mkdirSync } = require('fs');
  mkdirSync(OUTPUT_DIR, { recursive: true });

  writeFileSync(
    resolve(OUTPUT_DIR, 'tutor-lms-export.json'),
    JSON.stringify(output, null, 2)
  );

  // Separate files for each entity
  writeFileSync(
    resolve(OUTPUT_DIR, 'instructors.json'),
    JSON.stringify(teamMembers, null, 2)
  );

  writeFileSync(
    resolve(OUTPUT_DIR, 'courses.json'),
    JSON.stringify(programs, null, 2)
  );

  writeFileSync(
    resolve(OUTPUT_DIR, 'lessons.json'),
    JSON.stringify(allLessons, null, 2)
  );

  console.log(`✅ Migration data saved to ${OUTPUT_DIR}/`);
  console.log(`   - tutor-lms-export.json (full export)`);
  console.log(`   - instructors.json (${teamMembers.length} records)`);
  console.log(`   - courses.json (${programs.length} records)`);
  console.log(`   - lessons.json (${allLessons.length} records)`);
  console.log(`\nNext steps:`);
  console.log(`   1. Review instructors.json — add Arabic names, coach levels`);
  console.log(`   2. Cross-reference with Amelia booking data for service info`);
  console.log(`   3. Push to CMS Team sheet + Supabase profiles`);
}

main().catch(console.error);
