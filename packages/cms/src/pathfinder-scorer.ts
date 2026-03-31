/**
 * Pathfinder Recommendation Scorer
 *
 * Takes a user's answer trail (with category weights per answer) and produces
 * ranked program recommendations with match percentages and reasoning.
 */

import type { Program } from './types';

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

    // Find featured program first, then any published program in the nav group
    const matchingPrograms = programs.filter(
      (p) => p.published && navGroups.includes(p.nav_group) && !usedSlugs.has(p.slug)
    );

    const bestProgram =
      matchingPrograms.find((p) => p.is_featured) || matchingPrograms[0];

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
    const featured = programs.find((p) => p.is_featured && p.published);
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
