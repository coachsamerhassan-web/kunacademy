/**
 * Pathfinder Recommendation Scorer
 *
 * Takes a user's answer trail (with category weights per answer) and produces
 * ranked program recommendations with match percentages and reasoning.
 */

import type { Program } from '@kunacademy/cms';

/** A single answer in the trail, as submitted by the pathfinder engine */
export interface ScoredAnswer {
  question_id: string;
  answer_id: string;
  answer_text?: string;
  category_weights?: Record<string, number>;
}

/** A scored recommendation with match strength and reasons */
export interface Recommendation {
  /** Program slug from CMS */
  slug: string;
  /** Display category: certification, course, retreat, corporate, family, coaching, free */
  category: string;
  /** Match percentage (0-100) */
  match_pct: number;
  /** Human-readable reason keys for the match */
  reasons: string[];
  /** Program title (bilingual) */
  title_ar?: string;
  title_en?: string;
  /** Price in AED (minor units) */
  price_aed?: number;
}

/** The 7 scoring categories mapped to program nav_groups / types */
const CATEGORY_TO_NAV_GROUP: Record<string, string[]> = {
  certification: ['certifications'],
  course: ['courses', 'micro-courses'],
  retreat: ['retreats'],
  corporate: ['corporate'],
  family: ['community'],
  coaching: [],       // Coaching services, not programs — handled via services
  free: ['free'],
};

/**
 * Slugs that are EXCLUDED from Pathfinder recommendations per board decision (2026-04-05).
 * - Barakah: removed from product portfolio
 * - Yaqazah: suspended until app is ready
 * - Islamic Coaching: removed from website
 */
const PATHFINDER_EXCLUDED_SLUGS = new Set([
  'barakah',
  'barakah-program',
  'yaqazah',
  'yaqazah-program',
  'islamic-coaching',
  'islamic-coaching-program',
]);

/**
 * Additional high-priority slugs to surface in Pathfinder per board decision (2026-04-05).
 * These supplement the nav_group matching for specific recommendation targets.
 *
 * GPS audience segments (gps, gps-accelerator, gps-professional) have nav_group "courses",
 * so they are prioritized under the "course" category.
 *
 * Mini-courses (nav_group "micro-courses") are also reachable via the "course" category
 * since CATEGORY_TO_NAV_GROUP maps "course" → ["courses", "micro-courses"].
 * The featured mini-course (mini-course-leadership) surfaces first for course matches.
 */
const PATHFINDER_PRIORITY_SLUGS: Record<string, string[]> = {
  // Manhajak 3 packages (individual path — coaching methodology)
  course: [
    'menhajak-training',
    'menhajak-organizational',
    'menhajak-leadership',
    // GPS audience segments (nav_group: courses) — board decision 2026-04-05
    'gps',
    'gps-accelerator',
    'gps-professional',
    // Mini-courses — featured one surfaces first (board decision 2026-04-05)
    'mini-course-leadership',
    'mini-course-communication',
    'mini-course-confidence',
    'mini-course-self-awareness',
    'mini-course-listening',
    'mini-course-presence',
    'mini-course-resilience',
    'mini-course-goals',
    'mini-course-emotion',
    'mini-course-team',
  ],
  // Impact Engineering segments (nav_group: courses + corporate) — board decision 2026-04-05
  corporate: [
    'impact-engineering',
    'impact-engineering-foundation',
    'impact-engineering-mastery',
  ],
};

/**
 * Score a user's answer trail against all programs and return top recommendations.
 *
 * @param answers - The user's answer trail with category_weights per answer
 * @param programs - All CMS programs to match against
 * @param type - 'individual' or 'corporate' — used to boost relevant categories
 * @returns Top 3 recommendations, sorted by match percentage
 */
export function scoreAnswers(
  answers: ScoredAnswer[],
  programs: Program[],
  type: 'individual' | 'corporate'
): Recommendation[] {
  // 1. Accumulate category scores from all answers
  const categoryScores: Record<string, number> = {};
  const answerReasons: Record<string, string[]> = {};

  for (const answer of answers) {
    if (!answer.category_weights) continue;
    for (const [category, weight] of Object.entries(answer.category_weights)) {
      categoryScores[category] = (categoryScores[category] || 0) + weight;
      if (!answerReasons[category]) answerReasons[category] = [];
      if (answer.answer_text) {
        answerReasons[category].push(answer.answer_text);
      }
    }
  }

  // 2. Apply type boost: corporate gets +30% to corporate category, individual gets +30% to certification
  if (type === 'corporate') {
    categoryScores.corporate = (categoryScores.corporate || 0) * 1.3;
  } else {
    categoryScores.certification = (categoryScores.certification || 0) * 1.3;
  }

  // 3. Normalize scores to percentages (0-100)
  const maxScore = Math.max(...Object.values(categoryScores), 1);
  const normalizedScores: Record<string, number> = {};
  for (const [cat, score] of Object.entries(categoryScores)) {
    normalizedScores[cat] = Math.round((score / maxScore) * 100);
  }

  // 4. Rank categories
  const rankedCategories = Object.entries(normalizedScores)
    .sort((a, b) => b[1] - a[1]);

  // 5. Map top categories to best-matching programs
  const recommendations: Recommendation[] = [];
  const usedSlugs = new Set<string>();

  for (const [category, matchPct] of rankedCategories) {
    if (recommendations.length >= 3) break;

    // Find best program for this category
    const navGroups = CATEGORY_TO_NAV_GROUP[category] || [];

    // For "coaching" category, recommend booking a session (no program)
    if (category === 'coaching') {
      recommendations.push({
        slug: 'coaching-session',
        category: 'coaching',
        match_pct: matchPct,
        reasons: answerReasons[category] || ['personalized_guidance'],
        title_ar: 'جلسة كوتشينغ فردية',
        title_en: 'Individual Coaching Session',
      });
      continue;
    }

    // Find best program for this category — priority slugs first, then featured, then any
    const prioritySlugs = PATHFINDER_PRIORITY_SLUGS[category] ?? [];
    const matchingPrograms = programs.filter(
      (p) =>
        p.published &&
        !PATHFINDER_EXCLUDED_SLUGS.has(p.slug) &&
        navGroups.includes(p.nav_group) &&
        !usedSlugs.has(p.slug)
    );

    const bestProgram =
      matchingPrograms.find((p) => prioritySlugs.includes(p.slug)) ||
      matchingPrograms.find((p) => p.is_featured) ||
      matchingPrograms[0];

    if (bestProgram) {
      usedSlugs.add(bestProgram.slug);
      recommendations.push({
        slug: bestProgram.slug,
        category,
        match_pct: matchPct,
        reasons: answerReasons[category] || [],
        title_ar: bestProgram.title_ar,
        title_en: bestProgram.title_en,
        price_aed: bestProgram.price_aed,
      });
    }
  }

  // Ensure at least one recommendation
  if (recommendations.length === 0) {
    const featured = programs.find(
      (p) => p.is_featured && p.published && !PATHFINDER_EXCLUDED_SLUGS.has(p.slug)
    );
    if (featured) {
      recommendations.push({
        slug: featured.slug,
        category: 'certification',
        match_pct: 50,
        reasons: ['general_interest'],
        title_ar: featured.title_ar,
        title_en: featured.title_en,
        price_aed: featured.price_aed,
      });
    }
  }

  return recommendations;
}

/**
 * Lightweight client-side scoring: derives ranked category scores + a
 * Tier 1 light report without needing full Program objects from the CMS.
 *
 * Used to show instant results in the browser right after the last question,
 * before the user opts in for the full extended report.
 */
export interface LightRecommendation {
  /** Top scoring category slug */
  category: string;
  /** Match percentage (0-100) */
  match_pct: number;
  /** Human-readable reason keys */
  reasons: string[];
}

export interface LightReport {
  /** Journey stage derived from the answer trail */
  journey_stage: string;
  /** Top 1-3 category recommendations */
  top_categories: LightRecommendation[];
  /** Transformation timeline milestones keyed to the top category */
  timeline: Array<{ period: string; period_ar: string; milestone: string; milestone_ar: string }>;
  /** 3-5 key benefit bullets for the top recommendation */
  key_benefits: Array<{ en: string; ar: string }>;
}

/** Category → friendly display info for Tier 1 light report */
const LIGHT_CATEGORY_META: Record<string, {
  title_en: string;
  title_ar: string;
  timeline: LightReport['timeline'];
  benefits: Array<{ en: string; ar: string }>;
}> = {
  certification: {
    title_en: 'Professional Certification',
    title_ar: 'شهادة احترافية',
    timeline: [
      { period: 'Month 1–3',  period_ar: 'الشهر ١–٣',  milestone: 'Foundation skills + ICF framework', milestone_ar: 'مهارات الأساس + إطار ICF' },
      { period: 'Month 4–6',  period_ar: 'الشهر ٤–٦',  milestone: 'Supervised coaching practice',       milestone_ar: 'ممارسة إشرافية للكوتشينغ' },
      { period: 'Month 9–12', period_ar: 'الشهر ٩–١٢', milestone: 'Certification + first clients',      milestone_ar: 'الشهادة + أول عملاء' },
    ],
    benefits: [
      { en: 'ICF-accredited curriculum',           ar: 'منهج معتمد من ICF' },
      { en: '500+ hours of coaching mastery',       ar: 'أكثر من ٥٠٠ ساعة إتقان للكوتشينج' },
      { en: 'Live supervision with Samer Hassan',   ar: 'إشراف مباشر مع سامر حسن' },
      { en: 'Arabic & bilingual delivery',          ar: 'تقديم باللغتين العربية والإنجليزية' },
      { en: 'Career pathway + alumni network',      ar: 'مسار مهني + شبكة الخريجين' },
    ],
  },
  course: {
    title_en: 'Manhajak Program',
    title_ar: 'برنامج منهجك',
    timeline: [
      { period: 'Month 1–3',  period_ar: 'الشهر ١–٣',  milestone: 'Clarity on coaching niche & style',     milestone_ar: 'وضوح في التخصص والأسلوب' },
      { period: 'Month 4–6',  period_ar: 'الشهر ٤–٦',  milestone: 'Build signature coaching methodology',  milestone_ar: 'بناء منهجية كوتشينج خاصة' },
      { period: 'Month 9–12', period_ar: 'الشهر ٩–١٢', milestone: 'Launch offers + attract clients',        milestone_ar: 'إطلاق العروض + استقطاب عملاء' },
    ],
    benefits: [
      { en: 'Design your personal coaching system',     ar: 'تصميم نظامك الكوتشينجي الشخصي' },
      { en: 'Proven business-building framework',       ar: 'إطار مُجرَّب لبناء عمل كوتشينج ناجح' },
      { en: 'Group mentoring with Samer Hassan',        ar: 'إرشاد جماعي مع سامر حسن' },
      { en: '3 package levels to match your stage',     ar: 'ثلاث حزم تناسب مرحلتك' },
      { en: 'Arabic + global community support',        ar: 'دعم مجتمعي عربي وعالمي' },
    ],
  },
  corporate: {
    title_en: 'Impact Engineering',
    title_ar: 'هندسة الأثر',
    timeline: [
      { period: 'Month 1–3',  period_ar: 'الشهر ١–٣',  milestone: 'Leadership diagnostic + coaching plan',  milestone_ar: 'تشخيص القيادة + خطة الكوتشينج' },
      { period: 'Month 4–6',  period_ar: 'الشهر ٤–٦',  milestone: 'Team culture & engagement shift',         milestone_ar: 'تحوّل الثقافة والمشاركة' },
      { period: 'Month 9–12', period_ar: 'الشهر ٩–١٢', milestone: 'Measurable ROI + sustainable results',    milestone_ar: 'عائد قابل للقياس + نتائج مستدامة' },
    ],
    benefits: [
      { en: 'Evidence-based leadership transformation', ar: 'تحوّل قيادي مبني على الأدلة' },
      { en: 'ROI-focused coaching methodology',         ar: 'منهجية كوتشينج مرتبطة بالعائد' },
      { en: 'Tailored to your organizational culture',  ar: 'مُصمَّم لثقافة مؤسستك' },
      { en: 'Available in Arabic & English',            ar: 'متاح بالعربية والإنجليزية' },
      { en: 'Certified ICF coaching team',              ar: 'فريق كوتشينج معتمد من ICF' },
    ],
  },
  retreat: {
    title_en: 'Transformational Retreat',
    title_ar: 'ريتريت التحوّل',
    timeline: [
      { period: 'Month 1–3',  period_ar: 'الشهر ١–٣',  milestone: 'Deep self-awareness breakthrough',        milestone_ar: 'اختراق الوعي الذاتي العميق' },
      { period: 'Month 4–6',  period_ar: 'الشهر ٤–٦',  milestone: 'Integration + daily practice',            milestone_ar: 'التكامل + الممارسة اليومية' },
      { period: 'Month 9–12', period_ar: 'الشهر ٩–١٢', milestone: 'Lasting identity shift + new habits',     milestone_ar: 'تحوّل هوية دائم + عادات جديدة' },
    ],
    benefits: [
      { en: 'Somatic Thinking® immersive experience', ar: 'تجربة مكثّفة في التفكير الحسّي' },
      { en: 'Small group for deep personal work',      ar: 'مجموعة صغيرة للعمل الشخصي العميق' },
      { en: 'Nature + silence + movement',             ar: 'طبيعة + صمت + حركة' },
      { en: 'Led by Master Certified Coach Samer',     ar: 'بقيادة المدرب المعتمد سامر حسن' },
      { en: 'Pre- and post-integration support',       ar: 'دعم قبل وبعد الريتريت' },
    ],
  },
  free: {
    title_en: 'Free Intro Program',
    title_ar: 'برنامج تعريفي مجاني',
    timeline: [
      { period: 'Month 1',   period_ar: 'الشهر ١',    milestone: 'Discover coaching fundamentals',           milestone_ar: 'استكشاف أسس الكوتشينج' },
      { period: 'Month 2–3', period_ar: 'الشهر ٢–٣',  milestone: 'First coaching skills + practice',          milestone_ar: 'أول مهارات وممارسة' },
      { period: 'Month 4+',  period_ar: 'الشهر ٤+',   milestone: 'Clear decision on next steps',              milestone_ar: 'قرار واضح للخطوات التالية' },
    ],
    benefits: [
      { en: 'Zero-risk entry point',            ar: 'نقطة انطلاق بلا مخاطرة' },
      { en: 'Live sessions with Kun coaches',   ar: 'جلسات مباشرة مع مدربي كُن' },
      { en: 'Arabic-first community',           ar: 'مجتمع عربي أولاً' },
      { en: 'No prior experience needed',       ar: 'لا يشترط خبرة سابقة' },
    ],
  },
  coaching: {
    title_en: 'Personal Coaching Sessions',
    title_ar: 'جلسات كوتشينج شخصية',
    timeline: [
      { period: 'Session 1–3',  period_ar: 'الجلسات ١–٣',  milestone: 'Goal clarity + inner obstacles map',     milestone_ar: 'وضوح الأهداف + خريطة العوائق' },
      { period: 'Session 4–6',  period_ar: 'الجلسات ٤–٦',  milestone: 'Breakthrough actions + momentum',         milestone_ar: 'خطوات اختراق + زخم' },
      { period: 'Session 7–12', period_ar: 'الجلسات ٧–١٢', milestone: 'Sustainable change + new patterns',       milestone_ar: 'تغيير مستدام + أنماط جديدة' },
    ],
    benefits: [
      { en: '1:1 with ICF-certified coaches',     ar: 'جلسات فردية مع مدربين معتمدين' },
      { en: 'Somatic Thinking® approach',          ar: 'نهج التفكير الحسّي' },
      { en: 'Arabic + multilingual availability',  ar: 'متاح بالعربية وعدة لغات' },
      { en: 'Flexible online + in-person',         ar: 'مرن — أونلاين أو حضوري' },
    ],
  },
  family: {
    title_en: 'Family Coaching',
    title_ar: 'كوتشينج الأسرة',
    timeline: [
      { period: 'Month 1–3',  period_ar: 'الشهر ١–٣',  milestone: 'Family dynamics assessment + goals',   milestone_ar: 'تقييم ديناميكيات الأسرة + الأهداف' },
      { period: 'Month 4–6',  period_ar: 'الشهر ٤–٦',  milestone: 'Communication breakthroughs',          milestone_ar: 'اختراقات في التواصل' },
      { period: 'Month 9–12', period_ar: 'الشهر ٩–١٢', milestone: 'Thriving family ecosystem',             milestone_ar: 'نظام أسري متجدد ومتطور' },
    ],
    benefits: [
      { en: 'Rooted in Islamic coaching values',    ar: 'مبني على قيم الكوتشينج الإسلامي' },
      { en: 'Parents + children together',          ar: 'الآباء والأبناء معاً' },
      { en: 'Arabic-first delivery',                ar: 'تقديم بالعربية أولاً' },
      { en: 'Confidential + respectful space',      ar: 'فضاء سري ومحترم' },
    ],
  },
};

/**
 * Score answers on the client side (no Program data needed).
 * Returns a LightReport for instant Tier 1 display.
 */
export function scoreAnswersLight(
  answers: ScoredAnswer[],
  type: 'individual' | 'corporate'
): LightReport {
  // 1. Accumulate category scores
  const categoryScores: Record<string, number> = {};
  const answerReasons: Record<string, string[]> = {};

  for (const answer of answers) {
    if (!answer.category_weights) continue;
    for (const [category, weight] of Object.entries(answer.category_weights)) {
      categoryScores[category] = (categoryScores[category] || 0) + weight;
      if (!answerReasons[category]) answerReasons[category] = [];
      if (answer.answer_text) answerReasons[category].push(answer.answer_text);
    }
  }

  // 2. Type boost
  if (type === 'corporate') {
    categoryScores.corporate = (categoryScores.corporate || 0) * 1.3;
  } else {
    categoryScores.certification = (categoryScores.certification || 0) * 1.3;
  }

  // 3. Normalize
  const maxScore = Math.max(...Object.values(categoryScores), 1);
  const rankedCategories = Object.entries(categoryScores)
    .map(([cat, score]) => ({ category: cat, match_pct: Math.round((score / maxScore) * 100) }))
    .sort((a, b) => b.match_pct - a.match_pct)
    .slice(0, 3);

  // 4. Journey stage
  const totalWeight = Object.values(categoryScores).reduce((s, v) => s + v, 0);
  const certScore = categoryScores.certification ?? 0;
  const freeScore = categoryScores.free ?? 0;
  let journey_stage = 'explorer';
  if (totalWeight > 0) {
    const certRatio = certScore / totalWeight;
    if (freeScore > certScore) journey_stage = 'explorer';
    else if (certRatio < 0.3) journey_stage = 'seeker';
    else if (certRatio < 0.6) journey_stage = 'practitioner';
    else journey_stage = 'master';
  }

  // 5. Build top_categories
  const top_categories: LightRecommendation[] = rankedCategories.map(({ category, match_pct }) => ({
    category,
    match_pct,
    reasons: (answerReasons[category] ?? []).slice(0, 3),
  }));

  // Default to certification if no scores
  if (top_categories.length === 0) {
    top_categories.push({ category: 'certification', match_pct: 60, reasons: ['general_interest'] });
  }

  // 6. Timeline + benefits from top category
  const topCategory = top_categories[0].category;
  const meta = LIGHT_CATEGORY_META[topCategory] ?? LIGHT_CATEGORY_META['certification'];

  return {
    journey_stage,
    top_categories,
    timeline: meta.timeline,
    key_benefits: meta.benefits,
  };
}

/**
 * Calculate ROI for corporate path — ported from roi-calculator.tsx.
 * All assumptions come from CMS settings (with defaults).
 */
export interface RoiInputs {
  team_size: number;
  avg_salary: number;
  turnover_rate: number;
  absenteeism_days: number;
  engagement_score: number;
}

export interface RoiResult {
  turnover_savings: number;
  productivity_gains: number;
  absenteeism_savings: number;
  total_roi: number;
  investment_cost: number;
  net_return: number;
  roi_multiple: number;
}

export function calculateRoi(
  inputs: RoiInputs,
  settings?: {
    turnover_reduction_pct?: number;
    productivity_increase_pct?: number;
    absenteeism_reduction_pct?: number;
    replacement_cost_multiplier?: number;
    coaching_cost_per_person_month?: number;
    program_duration_months?: number;
  }
): RoiResult {
  const s = {
    turnover_reduction_pct: settings?.turnover_reduction_pct ?? 25,
    productivity_increase_pct: settings?.productivity_increase_pct ?? 20,
    absenteeism_reduction_pct: settings?.absenteeism_reduction_pct ?? 30,
    replacement_cost_multiplier: settings?.replacement_cost_multiplier ?? 1.5,
    coaching_cost_per_person_month: settings?.coaching_cost_per_person_month ?? 2000,
    program_duration_months: settings?.program_duration_months ?? 6,
  };

  const turnover_savings =
    inputs.team_size *
    (inputs.turnover_rate / 100) *
    inputs.avg_salary *
    s.replacement_cost_multiplier *
    (s.turnover_reduction_pct / 100);

  const engagementGap = Math.min(80 - inputs.engagement_score, 15);
  const productivity_gains =
    engagementGap > 0
      ? inputs.team_size *
        inputs.avg_salary *
        (engagementGap * 0.005) *
        (s.productivity_increase_pct / 100)
      : 0;

  const absenteeism_savings =
    inputs.team_size *
    inputs.absenteeism_days *
    (inputs.avg_salary / 22) *
    (s.absenteeism_reduction_pct / 100);

  const total_roi = turnover_savings + productivity_gains + absenteeism_savings;
  const investment_cost =
    inputs.team_size * s.coaching_cost_per_person_month * s.program_duration_months;
  const net_return = total_roi - investment_cost;
  const roi_multiple = investment_cost > 0 ? total_roi / investment_cost : 0;

  return {
    turnover_savings: Math.round(turnover_savings),
    productivity_gains: Math.round(productivity_gains),
    absenteeism_savings: Math.round(absenteeism_savings),
    total_roi: Math.round(total_roi),
    investment_cost: Math.round(investment_cost),
    net_return: Math.round(net_return),
    roi_multiple: Math.round(roi_multiple * 100) / 100,
  };
}
