#!/usr/bin/env npx tsx
/**
 * CMS→DB final — Migrate apps/web/data/cms/pathfinder.json →
 *   pathfinder_tree_versions + pathfinder_questions + pathfinder_answers
 *   + pathfinder_outcomes.
 *
 * Produces two versions:
 *   v1 "v1-legacy-2026-04-21" — is_active=true, exact import of current JSON
 *                               (15 questions + 41 answers).
 *   v2 "v2-hakima-2026-04-21" — is_active=false (draft), clones v1 and adds
 *                               Hakima's Section 3 additions: Q2b (after seeker),
 *                               Q6 expansion (already in v1 as q2/a6), Q13b
 *                               (gender, optional), Q17b (team language), + 3
 *                               corporate sharpening qs.
 *
 * Idempotent: ON CONFLICT (version_id, code) for questions/outcomes, and
 *   (question_id, code) for answers. Re-runs replace content in place.
 *
 * Usage:
 *   DATABASE_URL=... npx tsx scripts/migrate-pathfinder.ts
 *   DRY_RUN=1        npx tsx scripts/migrate-pathfinder.ts
 *   EMIT_SQL=/tmp/seed.sql  npx tsx scripts/migrate-pathfinder.ts
 *     — no DB writes; emits an idempotent .sql seed safe for non-BYPASSRLS roles.
 *     Apply with: sudo -u postgres psql kunacademy -f <file>
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { Client } from 'pg';

const SOURCE = resolve(process.cwd(), 'apps/web/data/cms/pathfinder.json');

// ── JSON types (source) ─────────────────────────────────────────────────────
interface RawAnswer {
  id: string;
  text_ar: string;
  text_en: string;
  category_weights?: Record<string, number>;
  recommended_slugs?: string[];
}
interface RawQuestion {
  id: string;
  question_ar: string;
  question_en: string;
  type: 'individual' | 'corporate';
  parent_answer_id: string;
  answers: RawAnswer[];
  published: boolean;
}

// ── Hakima v2 additions (per proposal Section 3) ────────────────────────────
// Seven categories: certification, course, free, coaching, retreat, family, corporate
interface V2Addition {
  code: string;
  question_ar: string;
  question_en: string;
  type: 'individual' | 'corporate';
  parent_answer_code: string | null; // references v2's own answer codes
  is_terminal_gate?: boolean;
  answers: Array<{
    code: string;
    text_ar: string;
    text_en: string;
    category_weights?: Record<string, number>;
    recommended_slugs?: string[];
  }>;
}

// 4 seeker-branch + 3 corporate-sharpening questions.
// Codes are new and live only in v2.
const V2_ADDITIONS: V2Addition[] = [
  // Seeker branch (individual, parents existing v1 codes)
  {
    code: 'q2b',
    question_ar: 'متى حدث آخر موقف أحسست فيه أنك "في مكانك الصحيح"؟',
    question_en: 'When did you last feel "in your right place"?',
    type: 'individual',
    parent_answer_code: 'a3', // after Q1 → "personal growth"
    answers: [
      { code: 'a2b1', text_ar: 'مؤخراً', text_en: 'Recently', category_weights: { free: 3 } },
      { code: 'a2b2', text_ar: 'منذ زمن بعيد', text_en: 'A long time ago', category_weights: { retreat: 4, coaching: 3 } },
      { code: 'a2b3', text_ar: 'لم ألاحظ', text_en: 'Never really noticed', category_weights: { retreat: 5 } },
      { code: 'a2b4', text_ar: 'لست متأكداً', text_en: 'Not sure', category_weights: { free: 2, coaching: 2 } },
    ],
  },
  // Q6 first-step preference (after "start-fast" path, parent a6 in v1)
  {
    code: 'q6b',
    question_ar: 'من أين تفضّل أن تبدأ خطوتك الأولى؟',
    question_en: 'Where do you prefer your first step to start?',
    type: 'individual',
    parent_answer_code: 'a6', // after Q2 → "start practicing fast"
    answers: [
      { code: 'a6b1', text_ar: 'مورد مجاني', text_en: 'Free resource', category_weights: { free: 10 }, recommended_slugs: ['gps-of-life'] },
      { code: 'a6b2', text_ar: 'ورشة قصيرة مدفوعة', text_en: 'Short paid workshop', category_weights: { course: 8 } },
      { code: 'a6b3', text_ar: 'مكالمة تعريفية فردية', text_en: '1:1 intro call', category_weights: { coaching: 10 } },
    ],
  },
  // Seeker — life-area signal follow-up after "career" (a24)
  {
    code: 'q11b',
    question_ar: 'ما النمط الذي يأسرك أكثر في التعلّم الآن؟',
    question_en: 'Which learning pattern draws you most right now?',
    type: 'individual',
    parent_answer_code: 'a24', // after Q8 → "career growth"
    answers: [
      { code: 'a11b1', text_ar: 'تعلّم بوتيرة سريعة ومركّزة', text_en: 'Fast, focused pace', category_weights: { course: 6, free: 3 } },
      { code: 'a11b2', text_ar: 'تعلّم بتأنٍ وتأمل', text_en: 'Slow, reflective pace', category_weights: { retreat: 5, coaching: 4 } },
      { code: 'a11b3', text_ar: 'تعلّم بصحبة مجموعة', text_en: 'Group learning', category_weights: { course: 5, free: 3 } },
    ],
  },
  // Q13b — coach gender (optional) after "invest" answers
  {
    code: 'q13b',
    question_ar: 'هل تُفضّل أن يكون الكوتش رجلاً أم امرأة؟ (اختياري)',
    question_en: 'Coach gender preference? (optional)',
    type: 'individual',
    parent_answer_code: 'a30', // after Q10 → "ready to invest"
    answers: [
      { code: 'a13b1', text_ar: 'رجل', text_en: 'Man', category_weights: {} },
      { code: 'a13b2', text_ar: 'امرأة', text_en: 'Woman', category_weights: {} },
      { code: 'a13b3', text_ar: 'لا يهم', text_en: 'Doesn\'t matter', category_weights: {} },
    ],
  },
  // Corporate sharpening — parent a31 (C-suite/executive path)
  {
    code: 'q17b',
    question_ar: 'ما لغة العمل الأساسية في فريقك؟',
    question_en: 'What is the primary working language of your team?',
    type: 'corporate',
    parent_answer_code: 'a31',
    answers: [
      { code: 'a17b1', text_ar: 'العربية', text_en: 'Arabic', category_weights: { corporate: 3 } },
      { code: 'a17b2', text_ar: 'الإنجليزية', text_en: 'English', category_weights: { corporate: 3 } },
      { code: 'a17b3', text_ar: 'مزيج', text_en: 'Mixed', category_weights: { corporate: 4 } },
    ],
  },
  // Corporate sharpening — industry hint
  {
    code: 'q17c',
    question_ar: 'في أي قطاع تعمل مؤسستك؟',
    question_en: 'What industry is your organization in?',
    type: 'corporate',
    parent_answer_code: 'a32', // after "team culture"
    answers: [
      { code: 'a17c1', text_ar: 'تقنية / خدمات رقمية', text_en: 'Tech / digital services', category_weights: { corporate: 5 } },
      { code: 'a17c2', text_ar: 'تمويل / مصرفي', text_en: 'Finance / banking', category_weights: { corporate: 6 } },
      { code: 'a17c3', text_ar: 'صناعي / لوجستي', text_en: 'Industrial / logistics', category_weights: { corporate: 5 } },
      { code: 'a17c4', text_ar: 'خدمات عامة / غير ربحي', text_en: 'Public sector / non-profit', category_weights: { corporate: 4 } },
      { code: 'a17c5', text_ar: 'آخر', text_en: 'Other', category_weights: { corporate: 3 } },
    ],
  },
  // Corporate sharpening — horizon
  {
    code: 'q17d',
    question_ar: 'ما الأفق الزمني للتغيير الذي تستهدفه؟',
    question_en: 'What is the time horizon for the change you want?',
    type: 'corporate',
    parent_answer_code: 'a33', // after "train internal coaches"
    answers: [
      { code: 'a17d1', text_ar: '٣ أشهر — سريع ومركّز', text_en: '3 months — fast & focused', category_weights: { corporate: 4, course: 6 } },
      { code: 'a17d2', text_ar: '٦ أشهر — تحوّل متوسط', text_en: '6 months — moderate transformation', category_weights: { corporate: 6, course: 4 } },
      { code: 'a17d3', text_ar: '١٢ شهراً — تحوّل جذري', text_en: '12 months — deep shift', category_weights: { corporate: 8, certification: 4 } },
    ],
  },
  // Seeker Q2b follow-up placeholder — mark as terminal to avoid dead ends in scoring
  // (not needed — terminal_gate=false on Q2b lets scorer still produce top-3 from category trail)
];

// Default outcomes mapping — program_slug → category_affinity + cta. Uses the
// 7 canonical categories and CTA types from the enum.
// This is v1's outcome table; v2 inherits it and can override via admin UI.
const OUTCOME_SEEDS: Array<{
  program_slug: string;
  category_affinity: Record<string, number>;
  cta_type: 'book_call' | 'enroll' | 'explore' | 'free_signup';
  cta_label_ar?: string;
  cta_label_en?: string;
  min_score?: number;
}> = [
  {
    program_slug: 'stce-level-1-stic',
    category_affinity: { certification: 1.0, course: 0.5 },
    cta_type: 'enroll',
    cta_label_ar: 'ابدأ الاعتماد',
    cta_label_en: 'Start Certification',
  },
  {
    program_slug: 'impact-engineering',
    category_affinity: { course: 1.0, corporate: 0.7, certification: 0.3 },
    cta_type: 'book_call',
    cta_label_ar: 'احجز مكالمة',
    cta_label_en: 'Book a Call',
  },
  {
    program_slug: 'menhajak-training',
    category_affinity: { course: 1.0, certification: 0.8 },
    cta_type: 'book_call',
    cta_label_ar: 'احجز مكالمة منهجك',
    cta_label_en: 'Book Manhajak Call',
  },
  {
    program_slug: 'menhajak-organizational',
    category_affinity: { corporate: 1.0, course: 0.6 },
    cta_type: 'book_call',
    cta_label_ar: 'احجز مكالمة مؤسسية',
    cta_label_en: 'Book Corporate Call',
  },
  {
    program_slug: 'menhajak-leadership',
    category_affinity: { corporate: 0.9, course: 0.5 },
    cta_type: 'book_call',
    cta_label_ar: 'احجز مكالمة قيادية',
    cta_label_en: 'Book Leadership Call',
  },
  {
    program_slug: 'gps-of-life',
    category_affinity: { free: 1.0, course: 0.3 },
    cta_type: 'free_signup',
    cta_label_ar: 'ابدأ مجاناً',
    cta_label_en: 'Start Free',
  },
  {
    program_slug: 'somatic-thinking-intro',
    category_affinity: { course: 0.8, certification: 0.5, free: 0.4 },
    cta_type: 'enroll',
    cta_label_ar: 'سجّل في الورشة',
    cta_label_en: 'Enroll Now',
  },
  {
    program_slug: 'wisal',
    category_affinity: { family: 1.0, coaching: 0.4 },
    cta_type: 'explore',
    cta_label_ar: 'اكتشف وصال',
    cta_label_en: 'Explore Wisal',
  },
  {
    program_slug: 'seeds',
    category_affinity: { family: 0.8, coaching: 0.3 },
    cta_type: 'explore',
    cta_label_ar: 'اكتشف بذور',
    cta_label_en: 'Explore Seeds',
  },
  {
    program_slug: 'ihya-reviving-the-self',
    category_affinity: { retreat: 1.0, coaching: 0.4 },
    cta_type: 'book_call',
    cta_label_ar: 'احجز استشارة إحياء',
    cta_label_en: 'Book Ihya Consultation',
  },
  {
    program_slug: 'gm-playbook-briefing',
    category_affinity: { corporate: 1.0 },
    cta_type: 'book_call',
    cta_label_ar: 'احجز بريفينغ',
    cta_label_en: 'Book Briefing',
  },
];

interface NormQuestion {
  code: string;
  question_ar: string;
  question_en: string;
  type: 'individual' | 'corporate';
  parent_answer_code: string | null; // resolved to id at apply time
  sort_order: number;
  is_terminal_gate: boolean;
  published: boolean;
}
interface NormAnswer {
  question_code: string;
  code: string;
  text_ar: string;
  text_en: string;
  category_weights: Record<string, number>;
  recommended_slugs: string[];
  sort_order: number;
}

function normalizeJsonToV1(raw: RawQuestion[]): { questions: NormQuestion[]; answers: NormAnswer[] } {
  const questions: NormQuestion[] = [];
  const answers: NormAnswer[] = [];
  raw.forEach((q, qIdx) => {
    const parent = q.parent_answer_id && q.parent_answer_id.trim() !== '' ? q.parent_answer_id : null;
    questions.push({
      code: q.id,
      question_ar: q.question_ar,
      question_en: q.question_en,
      type: q.type,
      parent_answer_code: parent,
      sort_order: qIdx,
      is_terminal_gate: false,
      published: q.published !== false,
    });
    q.answers.forEach((a, aIdx) => {
      answers.push({
        question_code: q.id,
        code: a.id,
        text_ar: a.text_ar,
        text_en: a.text_en,
        category_weights: a.category_weights ?? {},
        recommended_slugs: a.recommended_slugs ?? [],
        sort_order: aIdx,
      });
    });
  });
  return { questions, answers };
}

function mergeV2(baseQ: NormQuestion[], baseA: NormAnswer[]): {
  questions: NormQuestion[];
  answers: NormAnswer[];
} {
  const questions = [...baseQ];
  const answers = [...baseA];
  let qOrder = questions.length;
  V2_ADDITIONS.forEach((add) => {
    questions.push({
      code: add.code,
      question_ar: add.question_ar,
      question_en: add.question_en,
      type: add.type,
      parent_answer_code: add.parent_answer_code,
      sort_order: qOrder++,
      is_terminal_gate: add.is_terminal_gate ?? false,
      published: true,
    });
    add.answers.forEach((a, aIdx) => {
      answers.push({
        question_code: add.code,
        code: a.code,
        text_ar: a.text_ar,
        text_en: a.text_en,
        category_weights: a.category_weights ?? {},
        recommended_slugs: a.recommended_slugs ?? [],
        sort_order: aIdx,
      });
    });
  });
  return { questions, answers };
}

function sqlLit(s: string): string {
  return `'${s.replace(/'/g, "''")}'`;
}
function sqlVal(v: unknown): string {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'number') return String(v);
  if (Array.isArray(v)) return `ARRAY[${v.map((x) => sqlLit(String(x))).join(', ')}]::text[]`;
  if (typeof v === 'object') return `${sqlLit(JSON.stringify(v))}::jsonb`;
  return sqlLit(String(v));
}

/**
 * Generate idempotent SQL for a single version (creates/updates the version
 * row and all its questions/answers/outcomes). Uses DO block + local variables
 * so re-runs don't need to know UUIDs ahead of time.
 */
function emitVersionSql(
  opts: {
    versionNumber: number;
    label: string;
    isActive: boolean;
    publish: boolean;
  },
  questions: NormQuestion[],
  answers: NormAnswer[],
  outcomes: typeof OUTCOME_SEEDS,
): string {
  const lines: string[] = [];
  lines.push(`-- ── Version ${opts.versionNumber}: ${opts.label} ─────────────`);
  lines.push(`DO $do$`);
  lines.push(`DECLARE`);
  lines.push(`  v_id uuid;`);
  lines.push(`  q_id uuid;`);
  lines.push(`  a_id uuid;`);
  lines.push(`BEGIN`);
  // Upsert version
  lines.push(`  INSERT INTO pathfinder_tree_versions (version_number, label, is_active, published_at)`);
  lines.push(
    `  VALUES (${opts.versionNumber}, ${sqlLit(opts.label)}, ${opts.isActive}, ${opts.publish ? 'NOW()' : 'NULL'})`,
  );
  lines.push(`  ON CONFLICT (version_number) DO UPDATE SET`);
  lines.push(`    label = EXCLUDED.label,`);
  lines.push(`    is_active = EXCLUDED.is_active,`);
  lines.push(`    published_at = COALESCE(pathfinder_tree_versions.published_at, EXCLUDED.published_at),`);
  lines.push(`    updated_at = NOW()`);
  lines.push(`  RETURNING id INTO v_id;`);
  lines.push(``);

  // Pass 1: upsert all questions with parent_answer_id = NULL (resolved later)
  for (const q of questions) {
    lines.push(
      `  INSERT INTO pathfinder_questions ` +
        `(version_id, code, question_ar, question_en, type, parent_answer_id, sort_order, is_terminal_gate, published)`,
    );
    lines.push(
      `  VALUES (v_id, ${sqlLit(q.code)}, ${sqlLit(q.question_ar)}, ${sqlLit(q.question_en)}, ` +
        `${sqlLit(q.type)}::pathfinder_question_type, NULL, ${q.sort_order}, ${q.is_terminal_gate}, ${q.published})`,
    );
    lines.push(`  ON CONFLICT (version_id, code) DO UPDATE SET`);
    lines.push(`    question_ar = EXCLUDED.question_ar,`);
    lines.push(`    question_en = EXCLUDED.question_en,`);
    lines.push(`    type = EXCLUDED.type,`);
    lines.push(`    sort_order = EXCLUDED.sort_order,`);
    lines.push(`    is_terminal_gate = EXCLUDED.is_terminal_gate,`);
    lines.push(`    published = EXCLUDED.published,`);
    lines.push(`    updated_at = NOW();`);
  }
  lines.push(``);

  // Pass 2: upsert all answers
  for (const a of answers) {
    lines.push(
      `  SELECT id INTO q_id FROM pathfinder_questions WHERE version_id = v_id AND code = ${sqlLit(a.question_code)};`,
    );
    lines.push(
      `  INSERT INTO pathfinder_answers ` +
        `(question_id, code, text_ar, text_en, category_weights, recommended_slugs, sort_order)`,
    );
    lines.push(
      `  VALUES (q_id, ${sqlLit(a.code)}, ${sqlLit(a.text_ar)}, ${sqlLit(a.text_en)}, ` +
        `${sqlVal(a.category_weights)}, ${sqlVal(a.recommended_slugs)}, ${a.sort_order})`,
    );
    lines.push(`  ON CONFLICT (question_id, code) DO UPDATE SET`);
    lines.push(`    text_ar = EXCLUDED.text_ar,`);
    lines.push(`    text_en = EXCLUDED.text_en,`);
    lines.push(`    category_weights = EXCLUDED.category_weights,`);
    lines.push(`    recommended_slugs = EXCLUDED.recommended_slugs,`);
    lines.push(`    sort_order = EXCLUDED.sort_order,`);
    lines.push(`    updated_at = NOW();`);
  }
  lines.push(``);

  // Pass 3: resolve parent_answer_id for non-root questions
  for (const q of questions) {
    if (!q.parent_answer_code) continue;
    lines.push(`  UPDATE pathfinder_questions`);
    lines.push(`     SET parent_answer_id = (`);
    lines.push(`       SELECT a.id FROM pathfinder_answers a`);
    lines.push(`        JOIN pathfinder_questions q2 ON q2.id = a.question_id`);
    lines.push(`        WHERE q2.version_id = v_id AND a.code = ${sqlLit(q.parent_answer_code)}`);
    lines.push(`        LIMIT 1`);
    lines.push(`     )`);
    lines.push(`   WHERE version_id = v_id AND code = ${sqlLit(q.code)};`);
  }
  lines.push(``);

  // Pass 4: outcomes
  for (const o of outcomes) {
    lines.push(
      `  INSERT INTO pathfinder_outcomes ` +
        `(version_id, program_slug, category_affinity, min_score, cta_label_ar, cta_label_en, cta_type)`,
    );
    lines.push(
      `  VALUES (v_id, ${sqlLit(o.program_slug)}, ${sqlVal(o.category_affinity)}, ` +
        `${o.min_score ?? 0}, ${o.cta_label_ar ? sqlLit(o.cta_label_ar) : 'NULL'}, ` +
        `${o.cta_label_en ? sqlLit(o.cta_label_en) : 'NULL'}, ${sqlLit(o.cta_type)}::pathfinder_outcome_cta_type)`,
    );
    lines.push(`  ON CONFLICT (version_id, program_slug) DO UPDATE SET`);
    lines.push(`    category_affinity = EXCLUDED.category_affinity,`);
    lines.push(`    min_score = EXCLUDED.min_score,`);
    lines.push(`    cta_label_ar = EXCLUDED.cta_label_ar,`);
    lines.push(`    cta_label_en = EXCLUDED.cta_label_en,`);
    lines.push(`    cta_type = EXCLUDED.cta_type,`);
    lines.push(`    updated_at = NOW();`);
  }

  lines.push(`END $do$;`);
  lines.push(``);
  return lines.join('\n');
}

function emitSql(
  v1q: NormQuestion[],
  v1a: NormAnswer[],
  v2q: NormQuestion[],
  v2a: NormAnswer[],
): string {
  const lines: string[] = [];
  lines.push('-- Generated by scripts/migrate-pathfinder.ts — idempotent seed');
  lines.push('-- Apply via: sudo -u postgres psql kunacademy -f <this-file>');
  lines.push('BEGIN;');
  lines.push('');
  lines.push(emitVersionSql(
    { versionNumber: 1, label: 'v1-legacy-2026-04-21', isActive: true, publish: true },
    v1q, v1a, OUTCOME_SEEDS,
  ));
  lines.push(emitVersionSql(
    { versionNumber: 2, label: 'v2-hakima-2026-04-21', isActive: false, publish: false },
    v2q, v2a, OUTCOME_SEEDS,
  ));
  lines.push('COMMIT;');
  return lines.join('\n') + '\n';
}

async function applyViaDb(
  dbUrl: string,
  v1q: NormQuestion[], v1a: NormAnswer[],
  v2q: NormQuestion[], v2a: NormAnswer[],
): Promise<{ versions: number; questions: number; answers: number; outcomes: number }> {
  const client = new Client({ connectionString: dbUrl });
  await client.connect();
  try {
    await client.query('BEGIN');
    // Generate and execute the same SQL the EMIT_SQL path produces. Keeps
    // apply-paths identical and avoids duplicating logic.
    const sql = emitSql(v1q, v1a, v2q, v2a);
    // psql runs at a time as a single script; pg.Client.query accepts a
    // multi-statement string and executes them in the same implicit transaction.
    // We already have BEGIN/COMMIT in the emit, but pg.Client's query batches
    // statements — to avoid nested txn errors we strip the outer BEGIN/COMMIT.
    const body = sql.replace(/^BEGIN;\n/m, '').replace(/\nCOMMIT;\n?$/m, '');
    await client.query(body);
    const versionRows = await client.query('SELECT count(*) FROM pathfinder_tree_versions');
    const questionRows = await client.query('SELECT count(*) FROM pathfinder_questions');
    const answerRows = await client.query('SELECT count(*) FROM pathfinder_answers');
    const outcomeRows = await client.query('SELECT count(*) FROM pathfinder_outcomes');
    await client.query('COMMIT');
    return {
      versions: Number(versionRows.rows[0].count),
      questions: Number(questionRows.rows[0].count),
      answers: Number(answerRows.rows[0].count),
      outcomes: Number(outcomeRows.rows[0].count),
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    await client.end();
  }
}

async function main() {
  const dryRun = process.env.DRY_RUN === '1';
  const emitSqlPath = process.env.EMIT_SQL;
  const dbUrl = process.env.DATABASE_URL;
  if (!dryRun && !emitSqlPath && !dbUrl) {
    console.error('ERROR: DATABASE_URL required (or DRY_RUN=1 / EMIT_SQL=<path>)');
    process.exit(1);
  }

  console.log(`Reading ${SOURCE}...`);
  const raw = JSON.parse(readFileSync(SOURCE, 'utf-8')) as RawQuestion[];
  console.log(`  ${raw.length} raw questions, ${raw.reduce((s, q) => s + q.answers.length, 0)} answers`);

  const v1 = normalizeJsonToV1(raw);
  const v2 = mergeV2(v1.questions, v1.answers);

  console.log(`\nv1: ${v1.questions.length} questions, ${v1.answers.length} answers (legacy/active)`);
  console.log(`v2: ${v2.questions.length} questions, ${v2.answers.length} answers (draft, Hakima additions)`);
  console.log(`outcomes seed: ${OUTCOME_SEEDS.length} program slugs`);

  if (emitSqlPath) {
    const sql = emitSql(v1.questions, v1.answers, v2.questions, v2.answers);
    writeFileSync(emitSqlPath, sql, 'utf-8');
    console.log(`\nEMIT_SQL -> wrote seed to ${emitSqlPath}`);
    console.log(`Apply with: sudo -u postgres psql kunacademy -f ${emitSqlPath}`);
    return;
  }

  if (dryRun) {
    console.log('\nDRY_RUN=1 — skipping DB writes.');
    console.log('\nSample v1 questions:');
    v1.questions.slice(0, 3).forEach((q) => {
      console.log(`  [${q.code}] parent=${q.parent_answer_code ?? 'ROOT'} ${q.type} — ${q.question_ar.slice(0, 60)}`);
    });
    console.log('\nSample v2 additions:');
    v2.questions.filter((q) => V2_ADDITIONS.some((a) => a.code === q.code)).forEach((q) => {
      console.log(`  [${q.code}] parent=${q.parent_answer_code ?? 'ROOT'} ${q.type} — ${q.question_ar.slice(0, 60)}`);
    });
    return;
  }

  if (dbUrl) {
    console.log('\nConnecting to DB...');
    const counts = await applyViaDb(dbUrl, v1.questions, v1.answers, v2.questions, v2.answers);
    console.log(`\nMigration complete. Totals after apply:`);
    console.log(`  versions:  ${counts.versions}`);
    console.log(`  questions: ${counts.questions}`);
    console.log(`  answers:   ${counts.answers}`);
    console.log(`  outcomes:  ${counts.outcomes}`);
  }
}

main().catch((err) => {
  console.error('FAILED:', err);
  process.exit(1);
});
