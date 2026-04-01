// ── Benefits ROI Calculator ───────────────────────────────────────────────────
// Calculates per-benefit financial projections using team data + research benchmarks.

export interface BenefitSavings {
  benefit_id: string;
  label_ar: string;
  label_en: string;
  annual_savings: number;
  calculation_basis_ar: string;
  calculation_basis_en: string;
  citation_ar: string;
  citation_en: string;
  improvement_pct: number;
  roi_category: string;
}

export interface CorporateRoiResult {
  per_benefit_savings: BenefitSavings[];
  total_annual_savings: number;
  full_program_cost: number;
  per_leader_cost: number;
  full_program_roi_multiple: number;
  per_leader_roi_multiple: number;
  net_return_full: number;
  net_return_per_leader: number;
}

export interface RoiInputs {
  team_size: number;
  avg_salary: number;
  turnover_rate: number;
  absenteeism_days: number;
  engagement_score: number;
}

export interface CorporateSettings {
  corporate_multiplier: number;
  per_leader_session_rate: number;
  per_leader_package_sessions: number;
  base_program_price_aed: number;
}

export interface SelectedBenefit {
  id: string;
  label_ar: string;
  label_en: string;
  citation_ar: string;
  citation_en: string;
  benchmark_improvement_pct: number;
  roi_category: string;
}

export function calculateCorporateRoi(
  inputs: RoiInputs,
  selectedBenefits: SelectedBenefit[],
  settings: CorporateSettings,
): CorporateRoiResult {
  const perBenefitSavings: BenefitSavings[] = selectedBenefits.map(benefit => {
    let savings = 0;
    let basisEn = '';
    let basisAr = '';
    const pct = benefit.benchmark_improvement_pct / 100;

    switch (benefit.roi_category) {
      case 'turnover': {
        // Turnover: team × turnoverRate × salary × 1.5 (replacement cost) × improvement%
        savings = inputs.team_size * (inputs.turnover_rate / 100) * inputs.avg_salary * 1.5 * pct;
        basisEn = `Reduces turnover by ${benefit.benchmark_improvement_pct}% → saves ${benefit.benchmark_improvement_pct}% of replacement costs`;
        basisAr = `يخفض دوران الموظفين بنسبة ${benefit.benchmark_improvement_pct}% → يوفر ${benefit.benchmark_improvement_pct}% من تكاليف الاستبدال`;
        break;
      }
      case 'productivity': {
        // Productivity: team × salary × engagement gap (max 15pts) × 0.005 × improvement%
        const gap = Math.min(Math.max(0, 80 - inputs.engagement_score), 15);
        savings = inputs.team_size * inputs.avg_salary * (gap * 0.005) * pct;
        basisEn = `Lifts engagement ${benefit.benchmark_improvement_pct}% → boosts productivity`;
        basisAr = `يرفع التفاعل ${benefit.benchmark_improvement_pct}% → يعزز الإنتاجية`;
        break;
      }
      case 'absenteeism': {
        // Absenteeism: team × days × (salary/22) × improvement%
        savings = inputs.team_size * inputs.absenteeism_days * (inputs.avg_salary / 22) * pct;
        basisEn = `Reduces absenteeism by ${benefit.benchmark_improvement_pct}% → saves absence costs`;
        basisAr = `يخفض الغياب بنسبة ${benefit.benchmark_improvement_pct}% → يوفر تكاليف الغياب`;
        break;
      }
      case 'engagement': {
        // Similar to productivity but focused on engagement ROI
        const engGap = Math.max(0, 80 - inputs.engagement_score);
        savings = inputs.team_size * inputs.avg_salary * (Math.min(engGap, 20) * 0.003) * pct;
        basisEn = `Improves engagement by ${benefit.benchmark_improvement_pct}% → reduces disengagement costs`;
        basisAr = `يحسّن الارتباط بنسبة ${benefit.benchmark_improvement_pct}% → يخفض تكاليف عدم الارتباط`;
        break;
      }
      case 'conflict': {
        // Conflict: estimate 2% of payroll lost to workplace conflict × improvement%
        savings = inputs.team_size * inputs.avg_salary * 0.02 * pct;
        basisEn = `Reduces conflict costs by ${benefit.benchmark_improvement_pct}% → saves mediation & lost time`;
        basisAr = `يخفض تكاليف النزاعات بنسبة ${benefit.benchmark_improvement_pct}% → يوفر الوساطة والوقت الضائع`;
        break;
      }
      default: {
        // Fallback: small percentage of total payroll
        savings = inputs.team_size * inputs.avg_salary * 0.01 * pct;
        basisEn = `Estimated ${benefit.benchmark_improvement_pct}% improvement in team performance`;
        basisAr = `تحسّن مقدر ${benefit.benchmark_improvement_pct}% في أداء الفريق`;
      }
    }

    return {
      benefit_id: benefit.id,
      label_ar: benefit.label_ar,
      label_en: benefit.label_en,
      annual_savings: Math.round(savings),
      calculation_basis_ar: basisAr,
      calculation_basis_en: basisEn,
      citation_ar: benefit.citation_ar,
      citation_en: benefit.citation_en,
      improvement_pct: benefit.benchmark_improvement_pct,
      roi_category: benefit.roi_category,
    };
  });

  const totalSavings = perBenefitSavings.reduce((sum, b) => sum + b.annual_savings, 0);

  // Full program cost: base price × corporate multiplier
  const fullProgramCost = settings.base_program_price_aed * settings.corporate_multiplier;

  // Per leader cost: session_rate × sessions × team_size
  const perLeaderCost = settings.per_leader_session_rate * settings.per_leader_package_sessions * inputs.team_size;

  return {
    per_benefit_savings: perBenefitSavings,
    total_annual_savings: Math.round(totalSavings),
    full_program_cost: Math.round(fullProgramCost),
    per_leader_cost: Math.round(perLeaderCost),
    full_program_roi_multiple: fullProgramCost > 0 ? Math.round((totalSavings / fullProgramCost) * 10) / 10 : 0,
    per_leader_roi_multiple: perLeaderCost > 0 ? Math.round((totalSavings / perLeaderCost) * 10) / 10 : 0,
    net_return_full: Math.round(totalSavings - fullProgramCost),
    net_return_per_leader: Math.round(totalSavings - perLeaderCost),
  };
}
