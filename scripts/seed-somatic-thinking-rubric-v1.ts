#!/usr/bin/env tsx
/**
 * Seed the Somatic Thinking Coaching Assessment — Level 1 rubric template.
 *
 * Inserts ONE row into `rubric_templates`:
 *   id      = 'somatic_thinking_level_1'
 *   version = 1
 *   published = true
 *
 * Content source: تقييم جلسة كوتشينج تفكير حسي.pdf (17 pages, Microsoft Forms export)
 * Extracted verbatim from all 17 pages of the form.
 *
 * Items flagged with _opus_translated: true had no English label in the PDF;
 * translation was produced by the seeding agent — spot-check before going live.
 *
 * Idempotent: ON CONFLICT (id, version) DO NOTHING — safe to re-run.
 *
 * Usage (from repo root):
 *   pnpm tsx scripts/seed-somatic-thinking-rubric-v1.ts
 *
 * Or on VPS:
 *   cd /var/www/kunacademy-git && pnpm tsx scripts/seed-somatic-thinking-rubric-v1.ts
 */
import { withAdminContext } from '@kunacademy/db';
import { sql } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// Rubric structure — verbatim from PDF
// ---------------------------------------------------------------------------

const STRUCTURE = {
  parts: [
    // -------------------------------------------------------------------------
    // Part 0 — Session Metadata
    // -------------------------------------------------------------------------
    {
      id: 'part-0',
      type: 'metadata',
      label_ar: 'معلومات خاصة بالجلسة',
      label_en: 'Session Information',
      fields: [
        {
          id: 'coach_name',
          label_ar: 'اسم الكوتش',
          label_en: 'Coach Name',
          type: 'text',
        },
        {
          id: 'mentor_name',
          label_ar: 'اسم المنتور',
          label_en: 'Mentor Name',
          type: 'text',
        },
        {
          id: 'mentor_credential',
          label_ar: 'درجة إعتماد المنتور',
          label_en: 'Mentor Credential Level',
          type: 'radio',
          options: ['PCC', 'MCC'],
        },
        {
          id: 'session_date',
          label_ar: 'تاريخ الجلسة المقدمة',
          label_en: 'Session Date',
          type: 'date',
        },
        {
          id: 'session_number',
          label_ar: 'رقم الجلسة',
          label_en: 'Session Number',
          type: 'text',
        },
        {
          id: 'assessment_date',
          label_ar: 'تاريخ التقييم',
          label_en: 'Assessment Date',
          type: 'date',
        },
        {
          id: 'session_level',
          label_ar: 'مستوى الجلسة المطلوب تقييمها',
          label_en: 'Session Level Being Assessed',
          type: 'radio',
          options: [
            'المستوى الأول من برنامج التفكير الحسي',
            'المستوى الثاني من برنامج التفكير الحسي',
          ],
        },
      ],
    },

    // -------------------------------------------------------------------------
    // Part 1 — Verbal Observations (ملاحظات لفظية)
    // Items 1–21 of the 32 total observation items
    // Sub-sections: الاتفاقية (1-6), منطقة الفضول (7-9),
    //   التدريب الحسجسدي بغرض رفع الوعي (10-13),
    //   التشبيه الآني (14-17), التشبيه التنموي (18-21)
    // -------------------------------------------------------------------------
    {
      id: 'part-1',
      type: 'observations',
      label_ar: 'الجزء الأول: الملاحظات اللفظية',
      label_en: 'Part One: Verbal Observations',
      description_ar: 'ملاحظات لاحظها المنتور من خلال استماعه لإستجابات و أسئلة الكوتش اللفظية',
      description_en: 'Observations noted by the mentor by listening to the coach\'s verbal responses and questions',
      subsections: [
        // --- الاتفاقية ---
        {
          id: '1-1',
          label_ar: 'الاتفاقية',
          label_en: 'The Agreement',
          conditional: false,
          items: [
            {
              id: 1,
              label_ar: 'سؤال الربط',
              label_en: 'Linking Question',
              requires_evidence: true,
            },
            {
              id: 2,
              label_ar: 'الاتفاقية: الكوتشينج',
              label_en: 'Agreement: Coaching',
              requires_evidence: true,
            },
            {
              id: 3,
              label_ar: 'الاتفاقية: الهدف',
              label_en: 'Agreement: Goal',
              requires_evidence: true,
            },
            {
              id: 4,
              label_ar: 'الاتفاقية: الأهمية',
              label_en: 'Agreement: Importance',
              requires_evidence: true,
            },
            {
              id: 5,
              label_ar: 'الاتفاقية: علامات الحركة',
              label_en: 'Agreement: Movement Markers',
              requires_evidence: true,
            },
            {
              id: 6,
              label_ar: 'الاتفاقية: تحديد الإحتياج',
              label_en: 'Agreement: Identifying the Need (Gateway to the Coachee\'s World)',
              requires_evidence: true,
              note_ar: 'باب دخول عالم المستفيد',
              note_en: 'Gateway to the coachee\'s world',
            },
          ],
        },
        // --- منطقة الفضول ---
        {
          id: '1-2',
          label_ar: 'منطقة الفضول',
          label_en: 'Zone of Curiosity',
          conditional: false,
          items: [
            {
              id: 7,
              label_ar: 'أسئلة الفضول',
              label_en: 'Curiosity Questions',
              requires_evidence: true,
            },
            {
              id: 8,
              label_ar: 'الإستجابات اللفظية المبنية على الملاحظة',
              label_en: 'Verbal Responses Based on Observation',
              requires_evidence: true,
            },
            {
              id: 9,
              label_ar: 'الإستجابات غير اللفظية المبنية على الملاحظة',
              label_en: 'Non-Verbal Responses Based on Observation',
              requires_evidence: true,
            },
          ],
        },
        // --- التدريب الحسجسدي بغرض رفع الوعي ---
        {
          id: '1-3',
          label_ar: 'التدريب الحسجسدي بغرض رفع الوعي',
          label_en: 'Somatic Training for Awareness Elevation',
          conditional: true,
          condition_label_ar: 'تم عمل التدريب / لم يتم',
          condition_label_en: 'Training was conducted / Not conducted',
          items: [
            {
              id: 10,
              label_ar: 'المحفز',
              label_en: 'The Trigger / Stimulus',
              requires_evidence: true,
            },
            {
              id: 11,
              label_ar: 'الملاحظات',
              label_en: 'Observations',
              requires_evidence: true,
            },
            {
              id: 12,
              label_ar: 'المعنى',
              label_en: 'The Meaning',
              requires_evidence: true,
            },
            {
              id: 13,
              label_ar: 'الربط بالهدف',
              label_en: 'Linking to the Goal',
              requires_evidence: true,
            },
          ],
        },
        // --- التشبيه الآني ---
        {
          id: '1-4',
          label_ar: 'التشبيه الآني',
          label_en: 'The Present-Moment Analogy',
          conditional: true,
          condition_label_ar: 'تم عمل التشبيه / لم يتم',
          condition_label_en: 'Analogy was conducted / Not conducted',
          items: [
            {
              id: 14,
              label_ar: 'الاسم والوصف',
              label_en: 'Name and Description',
              requires_evidence: true,
            },
            {
              id: 15,
              label_ar: 'التسكين',
              label_en: 'Settledness / Embodiment',
              requires_evidence: true,
            },
            {
              id: 16,
              label_ar: 'الإيجابيات',
              label_en: 'Positives',
              requires_evidence: true,
            },
            {
              id: 17,
              label_ar: 'السلبيات',
              label_en: 'Negatives',
              requires_evidence: true,
            },
          ],
        },
        // --- التشبيه التنموي ---
        {
          id: '1-5',
          label_ar: 'التشبيه التنموي',
          label_en: 'The Developmental Analogy',
          conditional: true,
          condition_label_ar: 'تم عمل التشبيه / لم يتم',
          condition_label_en: 'Analogy was conducted / Not conducted',
          items: [
            {
              id: 18,
              label_ar: 'الاسم والوصف',
              label_en: 'Name and Description',
              _opus_translated: true,
              requires_evidence: true,
            },
            {
              id: 19,
              label_ar: 'التسكين',
              label_en: 'Settledness / Embodiment',
              _opus_translated: true,
              requires_evidence: true,
            },
            {
              id: 20,
              label_ar: 'الإيجابيات',
              label_en: 'Positives',
              _opus_translated: true,
              requires_evidence: true,
            },
            {
              id: 21,
              label_ar: 'السلبيات',
              label_en: 'Negatives',
              _opus_translated: true,
              requires_evidence: true,
            },
          ],
        },
      ],
    },

    // -------------------------------------------------------------------------
    // Part 2 — Behavioral Pattern Observations (ملاحظات الأنماط السلوكية)
    // Items 22–32 of the 32 total observation items (labeled 1-11 in the PDF)
    // -------------------------------------------------------------------------
    {
      id: 'part-2',
      type: 'observations',
      label_ar: 'الجزء الثاني: ملاحظات الأنماط السلوكية',
      label_en: 'Part Two: Behavioral Pattern Observations',
      description_ar: 'ملاحظات لاحظها المنتور من خلال طاقة الجلسة بشكل عام',
      description_en: 'Observations noted by the mentor from the overall energy of the session',
      subsections: [
        {
          id: '2-1',
          label_ar: 'الأنماط السلوكية',
          label_en: 'Behavioral Patterns',
          conditional: false,
          items: [
            {
              id: 22,
              pdf_label_id: 1,
              label_ar: 'مراجعة حركة الجلسة',
              label_en: 'Review of Session Movement',
              note_ar: 'هل نتحرك في هذه الجلسة',
              note_en: 'Did we move in this session?',
              requires_evidence: true,
            },
            {
              id: 23,
              pdf_label_id: 2,
              label_ar: 'الحضور',
              label_en: 'Presence',
              requires_evidence: true,
            },
            {
              id: 24,
              pdf_label_id: 3,
              label_ar: 'مساحات الصمت والاستماع',
              label_en: 'Spaces of Silence and Deep Listening',
              requires_evidence: true,
            },
            {
              id: 25,
              pdf_label_id: 4,
              label_ar: 'إيقاع الكوتش',
              label_en: 'Coach\'s Rhythm / Pacing',
              requires_evidence: true,
            },
            {
              id: 26,
              pdf_label_id: 5,
              label_ar: 'نسبة كلام الكوتش إلى كلام المستفيد معتدلة',
              label_en: 'Coach-to-Coachee Speaking Ratio is Moderate (25%–30%)',
              note_ar: 'من ٢٥ ٪ الى ٣٠',
              note_en: '25% to 30%',
              requires_evidence: true,
            },
            {
              id: 27,
              pdf_label_id: 6,
              label_ar: 'إستخدام اللغة النظيفة',
              label_en: 'Use of Clean Language',
              requires_evidence: true,
            },
            {
              id: 28,
              pdf_label_id: 7,
              label_ar: 'أريحية الكوتش في التعامل بدون تكلف',
              label_en: 'Coach\'s Ease and Naturalness in Interaction',
              requires_evidence: true,
            },
            {
              id: 29,
              pdf_label_id: 8,
              label_ar: 'انعدام التوجيه',
              label_en: 'Absence of Directing / Advice-Giving',
              requires_evidence: true,
            },
            {
              id: 30,
              pdf_label_id: 9,
              label_ar: 'فضول تجاه الإنسان أكبر من الهدف',
              label_en: 'Curiosity Toward the Person Greater Than Toward the Goal',
              requires_evidence: true,
            },
            {
              id: 31,
              pdf_label_id: 10,
              label_ar: 'استخدام أسئلة مبسوطة وغير مركبة',
              label_en: 'Use of Simple and Non-Compound Questions',
              requires_evidence: true,
            },
            {
              id: 32,
              pdf_label_id: 11,
              label_ar: 'التقدير المسبب',
              label_en: 'Reasoned Appreciation / Grounded Acknowledgement',
              requires_evidence: true,
            },
          ],
        },
      ],
    },

    // -------------------------------------------------------------------------
    // Part Ethics — Ethics Gates (auto-fail if not confirmed)
    // Source: الجزء الثالث: إشكاليات أخلاقية أو مهنية (page 15)
    // -------------------------------------------------------------------------
    {
      id: 'part-ethics',
      type: 'ethics_gates',
      label_ar: 'الجزء الثالث: إشكاليات أخلاقية أو مهنية',
      label_en: 'Part Three: Ethical or Professional Issues',
      description_ar: 'في حالة اختيار عدم الموافقة لا يعتد بتقييم هذه الجلسة وتعتبر الجلسة غير ناجحة',
      description_en: 'If "Disagree" is selected, this session assessment is void and the session is considered unsuccessful',
      items: [
        {
          id: 'e1',
          label_ar: 'لا يوجد إشكالية أخلاقية',
          label_en: 'No Ethical Issue Present',
          auto_fail: true,
        },
        {
          id: 'e2',
          label_ar: 'لا يوجد خلط أدوار أخرى بالإضافة إلى الكوتشينج',
          label_en: 'No Mixing of Other Roles Alongside Coaching',
          auto_fail: true,
        },
        {
          id: 'e3',
          label_ar: 'لا يوجد خلط منهجيات أخرى بالإضافة إلى التفكير الحسي',
          label_en: 'No Mixing of Other Methodologies Alongside Somatic Thinking',
          auto_fail: true,
        },
      ],
    },

    // -------------------------------------------------------------------------
    // Part 3 — Final Assessment Result (الجزء الأخير: نتيجة التقييم)
    // Source: pages 16-17
    // -------------------------------------------------------------------------
    {
      id: 'part-3',
      type: 'summary',
      label_ar: 'الجزء الأخير: نتيجة التقييم',
      label_en: 'Final Part: Assessment Result',
      fields: [
        {
          id: 'verdict',
          label_ar: 'في رأيك هل إجتازت هذه الجلسة المستوى المطلوب؟',
          label_en: 'In your opinion, did this session pass the required level?',
          type: 'select',
          options: ['pass', 'fail'],
          options_ar: ['نعم', 'لا'],
        },
        {
          id: 'strongest_competencies',
          label_ar: 'كفاءات اكتسبها الكوتش بشكل جيد',
          label_en: 'Competencies the Coach Has Acquired Well',
          description_ar: 'اكتب في نقاط أهم ثلاث مناطق متطورة عند الكوتش',
          description_en: 'Write in bullet points the top 3 most developed areas of the coach',
          type: 'textarea',
        },
        {
          id: 'development_areas',
          label_ar: 'كفاءات تحتاج المزيد من التطوير',
          label_en: 'Competencies That Need Further Development',
          description_ar: 'اكتب في نقاط أهم ثلاث مناطق تحتاج التطوير عند الكوتش',
          description_en: 'Write in bullet points the top 3 areas needing development for the coach',
          type: 'textarea',
        },
      ],
    },

    // -------------------------------------------------------------------------
    // Part 4 — Mentor Guidance
    // Source: توجيهات و نصائح المنتور (page 17)
    // -------------------------------------------------------------------------
    {
      id: 'part-4',
      type: 'mentor_guidance',
      label_ar: 'توجيهات و نصائح المنتور',
      label_en: 'Mentor Directions and Guidance',
      fields: [
        {
          id: 'mentor_guidance',
          label_ar: 'توجيهات و نصائح المنتور',
          label_en: 'Mentor Directions and Guidance',
          type: 'textarea',
        },
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

async function main() {
  console.log('[seed-somatic-thinking-rubric-v1] Starting...');

  await withAdminContext(async (db) => {
    await db.execute(
      sql`
        INSERT INTO rubric_templates (
          id,
          version,
          published,
          title_ar,
          title_en,
          description_ar,
          description_en,
          structure
        )
        VALUES (
          ${'somatic_thinking_level_1'},
          ${1},
          ${true},
          ${'تقييم جلسة كوتشينج تفكير حسي — المستوى الأول'},
          ${'Somatic Thinking Coaching Session Assessment — Level 1'},
          ${'نموذج تقييم شامل لجلسة كوتشينج وفق منهجية التفكير الحسي — المستوى الأول'},
          ${'Comprehensive assessment form for a coaching session using the Somatic Thinking methodology — Level 1'},
          ${JSON.stringify(STRUCTURE)}::jsonb
        )
        ON CONFLICT (id, version) DO NOTHING
      `
    );
  });

  console.log('[seed-somatic-thinking-rubric-v1] Inserted (or skipped existing): somatic_thinking_level_1 v1');
  console.log('[seed-somatic-thinking-rubric-v1] Done.');
  process.exit(0);
}

main().catch((err) => {
  console.error('[seed-somatic-thinking-rubric-v1] Error:', err);
  process.exit(1);
});
