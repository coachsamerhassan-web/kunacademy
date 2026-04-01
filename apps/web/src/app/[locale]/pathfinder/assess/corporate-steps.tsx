'use client';

import { useMemo } from 'react';
import { RadarChart } from '@/lib/pathfinder/radar-chart';

// ── Client-safe ROI types (copied from benefits-roi-calculator to avoid server-only barrel import) ──

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

// ── Client-safe ROI calculator (pure math, no server deps) ──────────────────

function calculateCorporateRoi(
  inputs: { team_size: number; avg_salary: number; turnover_rate: number; absenteeism_days: number; engagement_score: number },
  selectedBenefits: Array<{ id: string; label_ar: string; label_en: string; citation_ar: string; citation_en: string; benchmark_improvement_pct: number; roi_category: string }>,
  settings: { corporate_multiplier: number; per_leader_session_rate: number; per_leader_package_sessions: number; base_program_price_aed: number },
): CorporateRoiResult {
  const perBenefitSavings: BenefitSavings[] = selectedBenefits.map(benefit => {
    let savings = 0;
    let basisEn = '';
    let basisAr = '';
    const pct = benefit.benchmark_improvement_pct / 100;
    switch (benefit.roi_category) {
      case 'turnover': {
        savings = inputs.team_size * (inputs.turnover_rate / 100) * inputs.avg_salary * 1.5 * pct;
        basisEn = `Reduces turnover by ${benefit.benchmark_improvement_pct}% → saves replacement costs`;
        basisAr = `يخفض دوران الموظفين بنسبة ${benefit.benchmark_improvement_pct}% → يوفر تكاليف الاستبدال`;
        break;
      }
      case 'productivity': {
        const gap = Math.min(Math.max(0, 80 - inputs.engagement_score), 15);
        savings = inputs.team_size * inputs.avg_salary * (gap * 0.005) * pct;
        basisEn = `Lifts engagement ${benefit.benchmark_improvement_pct}% → boosts productivity`;
        basisAr = `يرفع التفاعل ${benefit.benchmark_improvement_pct}% → يعزز الإنتاجية`;
        break;
      }
      case 'absenteeism': {
        savings = inputs.team_size * inputs.absenteeism_days * (inputs.avg_salary / 22) * pct;
        basisEn = `Reduces absenteeism by ${benefit.benchmark_improvement_pct}% → saves absence costs`;
        basisAr = `يخفض الغياب بنسبة ${benefit.benchmark_improvement_pct}% → يوفر تكاليف الغياب`;
        break;
      }
      case 'engagement': {
        const engGap = Math.max(0, 80 - inputs.engagement_score);
        savings = inputs.team_size * inputs.avg_salary * (Math.min(engGap, 20) * 0.003) * pct;
        basisEn = `Improves engagement ${benefit.benchmark_improvement_pct}% → reduces disengagement costs`;
        basisAr = `يحسّن الارتباط بنسبة ${benefit.benchmark_improvement_pct}% → يخفض تكاليف عدم الارتباط`;
        break;
      }
      case 'conflict': {
        savings = inputs.team_size * inputs.avg_salary * 0.02 * pct;
        basisEn = `Reduces conflict costs by ${benefit.benchmark_improvement_pct}% → saves mediation & lost time`;
        basisAr = `يخفض تكاليف النزاعات بنسبة ${benefit.benchmark_improvement_pct}% → يوفر الوساطة والوقت الضائع`;
        break;
      }
      default: {
        savings = inputs.team_size * inputs.avg_salary * 0.01 * pct;
        basisEn = `Estimated ${benefit.benchmark_improvement_pct}% improvement`;
        basisAr = `تحسّن مقدر ${benefit.benchmark_improvement_pct}%`;
      }
    }
    return {
      benefit_id: benefit.id, label_ar: benefit.label_ar, label_en: benefit.label_en,
      annual_savings: Math.round(savings), calculation_basis_ar: basisAr, calculation_basis_en: basisEn,
      citation_ar: benefit.citation_ar, citation_en: benefit.citation_en,
      improvement_pct: benefit.benchmark_improvement_pct, roi_category: benefit.roi_category,
    };
  });
  const totalSavings = perBenefitSavings.reduce((sum, b) => sum + b.annual_savings, 0);
  const fullProgramCost = settings.base_program_price_aed * settings.corporate_multiplier;
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

// ── Types (exported so engine can import them) ────────────────────────────────

export interface Benefit {
  id: string;
  label_ar: string;
  label_en: string;
  description_ar: string;
  description_en: string;
  citation_ar: string;
  citation_en: string;
  benchmark_improvement_pct: number;
  roi_category: 'productivity' | 'turnover' | 'absenteeism' | 'engagement' | 'conflict';
  self_assessment_prompt_ar: string;
  self_assessment_prompt_en: string;
}

export interface Direction {
  id: string;
  title_ar: string;
  title_en: string;
  description_ar: string;
  description_en: string;
  icon: 'crown' | 'refresh' | 'target' | 'settings';
  benefits: Benefit[] | 'all';
}

export interface CorporateBenefitsData {
  version: string;
  directions: Direction[];
}

export interface SelfAssessmentRating {
  benefit_id: string;
  current: number;    // 0-10
  target_3m: number;  // 0-10
  target_6m: number;  // 0-10
}

// ── Icon SVGs ─────────────────────────────────────────────────────────────────

function DirectionIcon({ icon, className }: { icon: Direction['icon']; className?: string }) {
  const cls = `w-6 h-6 ${className ?? ''}`;
  switch (icon) {
    case 'crown':
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M2 20h20M4 20l2-10 6 5 6-5 2 10" />
          <circle cx="4" cy="9" r="1.5" fill="currentColor" stroke="none" />
          <circle cx="20" cy="9" r="1.5" fill="currentColor" stroke="none" />
          <circle cx="12" cy="5" r="1.5" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'refresh':
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      );
    case 'target':
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <circle cx="12" cy="12" r="6" />
          <circle cx="12" cy="12" r="2" />
        </svg>
      );
    case 'settings':
    default:
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
        </svg>
      );
  }
}

// ── Component 1: DirectionSelectStep ─────────────────────────────────────────

interface DirectionSelectStepProps {
  directions: Direction[];
  isAr: boolean;
  onSelect: (directionId: string) => void;
}

export function DirectionSelectStep({ directions, isAr, onSelect }: DirectionSelectStepProps) {
  return (
    <div>
      <h2
        className="text-2xl md:text-3xl font-bold text-[var(--text-primary)] text-center mb-3"
        style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
      >
        {isAr ? 'ما المجال الذي ترغب في الاستثمار فيه؟' : 'What area are you investing in?'}
      </h2>
      <p className="text-[var(--color-neutral-500)] text-center mb-10">
        {isAr ? 'اختر المجال الأنسب لاحتياجات مؤسستك' : 'Choose the area that best fits your organization\'s needs'}
      </p>
      <div className="space-y-4">
        {directions.map((dir) => (
          <button
            key={dir.id}
            onClick={() => onSelect(dir.id)}
            className="w-full text-start rounded-2xl border-2 border-[var(--color-neutral-100)] bg-white p-6 transition-all duration-300 hover:border-[var(--color-primary)] hover:shadow-[0_8px_32px_rgba(71,64,153,0.08)] min-h-[88px] group"
          >
            <div className="flex items-center gap-5">
              <div className="shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center bg-[var(--color-primary-50)] group-hover:bg-[var(--color-primary)] transition-colors">
                <DirectionIcon
                  icon={dir.icon}
                  className="text-[var(--color-primary)] group-hover:text-white transition-colors"
                />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-[var(--text-primary)] group-hover:text-[var(--color-primary)] transition-colors">
                  {isAr ? dir.title_ar : dir.title_en}
                </h3>
                <p className="text-sm text-[var(--color-neutral-500)] mt-0.5">
                  {isAr ? dir.description_ar : dir.description_en}
                </p>
              </div>
              <svg
                className="shrink-0 w-5 h-5 text-[var(--color-neutral-300)] group-hover:text-[var(--color-primary)] transition-colors rtl:rotate-180"
                viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M9 18l6-6-6-6" />
              </svg>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Shared slider (same pattern as RoiSlider in engine) ──────────────────────

function AssessmentSlider({
  label, value, onChange, sliderId,
}: {
  label: string; value: number; onChange: (v: number) => void; sliderId: string;
}) {
  const valueText = `${value} / 10`;
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label htmlFor={sliderId} className="text-sm font-medium text-[var(--text-primary)]">{label}</label>
        <span className="text-sm font-bold text-[var(--color-primary)]" aria-hidden="true">{valueText}</span>
      </div>
      <input
        id={sliderId}
        type="range"
        min={0} max={10} step={1} value={value}
        onChange={e => onChange(Number(e.target.value))}
        aria-valuetext={valueText}
        className="w-full h-2 rounded-full appearance-none cursor-pointer accent-[var(--color-primary)] min-h-[44px]"
        style={{
          background: `linear-gradient(to right, var(--color-primary) 0%, var(--color-primary) ${value * 10}%, var(--color-neutral-200) ${value * 10}%, var(--color-neutral-200) 100%)`,
        }}
      />
    </div>
  );
}

// ── Component 2: SelfAssessmentStep ──────────────────────────────────────────

interface SelfAssessmentStepProps {
  benefits: Benefit[];
  selfAssessment: Map<string, SelfAssessmentRating>;
  onUpdate: (benefitId: string, field: 'current' | 'target_3m' | 'target_6m', value: number) => void;
  onContinue: () => void;
  isAr: boolean;
}

export function SelfAssessmentStep({
  benefits,
  selfAssessment,
  onUpdate,
  onContinue,
  isAr,
}: SelfAssessmentStepProps) {
  return (
    <div>
      <h2
        className="text-2xl md:text-3xl font-bold text-[var(--text-primary)] text-center mb-2"
        style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
      >
        {isAr ? 'قيّم وضعك الحالي وأهدافك' : 'Rate Your Current State & Goals'}
      </h2>
      <p className="text-[var(--color-neutral-500)] text-center mb-8">
        {isAr ? 'من ٠ (ضعيف) إلى ١٠ (ممتاز)' : 'From 0 (poor) to 10 (excellent)'}
      </p>

      <div className="space-y-5">
        {benefits.map((benefit) => {
          const rating = selfAssessment.get(benefit.id) ?? {
            benefit_id: benefit.id,
            current: 3,
            target_3m: 6,
            target_6m: 8,
          };

          return (
            <div
              key={benefit.id}
              className="rounded-2xl border-2 border-[var(--color-neutral-100)] bg-white p-5"
            >
              <p className="text-base font-semibold text-[var(--text-primary)] mb-4">
                {isAr ? benefit.self_assessment_prompt_ar : benefit.self_assessment_prompt_en}
              </p>
              <div className="space-y-4">
                <AssessmentSlider
                  sliderId={`${benefit.id}-current`}
                  label={isAr ? 'الآن' : 'Now'}
                  value={rating.current}
                  onChange={v => onUpdate(benefit.id, 'current', v)}
                />
                <AssessmentSlider
                  sliderId={`${benefit.id}-3m`}
                  label={isAr ? 'بعد ٣ أشهر' : 'In 3 months'}
                  value={rating.target_3m}
                  onChange={v => onUpdate(benefit.id, 'target_3m', v)}
                />
                <AssessmentSlider
                  sliderId={`${benefit.id}-6m`}
                  label={isAr ? 'بعد ٦ أشهر' : 'In 6 months'}
                  value={rating.target_6m}
                  onChange={v => onUpdate(benefit.id, 'target_6m', v)}
                />
              </div>
            </div>
          );
        })}
      </div>

      <button
        onClick={onContinue}
        className="mt-8 w-full rounded-2xl px-8 py-4 text-lg font-bold text-white min-h-[56px] transition-all duration-300 hover:scale-[1.02]"
        style={{ background: 'linear-gradient(135deg, var(--color-accent) 0%, #C44D12 100%)' }}
      >
        {isAr ? 'أكمل' : 'Continue'}
      </button>
    </div>
  );
}

// ── Component 3: BenefitsQuizStep ─────────────────────────────────────────────

interface BenefitsQuizStepProps {
  benefits: Benefit[];
  selectedBenefits: string[];
  onToggle: (benefitId: string) => void;
  customText: string;
  onCustomTextChange: (text: string) => void;
  onContinue: () => void;
  isAr: boolean;
}

export function BenefitsQuizStep({
  benefits,
  selectedBenefits,
  onToggle,
  customText,
  onCustomTextChange,
  onContinue,
  isAr,
}: BenefitsQuizStepProps) {
  const count = selectedBenefits.length;
  const canContinue = count >= 3;
  const atMax = count >= 5;

  // Counter badge label
  const counterLabel = isAr
    ? `${toArabicNumerals(count)}/${toArabicNumerals(5)} مختارة`
    : `${count}/5 selected`;

  return (
    <div>
      <h2
        className="text-2xl md:text-3xl font-bold text-[var(--text-primary)] text-center mb-2"
        style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
      >
        {isAr ? 'أي النتائج ستُحدث تحوّلاً في مؤسستك؟' : 'Which outcomes would transform your organization?'}
      </h2>
      <p className="text-[var(--color-neutral-500)] text-center mb-4">
        {isAr ? 'اختر ٣ إلى ٥' : 'Pick 3 to 5'}
      </p>

      {/* Counter badge */}
      <div className="flex justify-center mb-6">
        <span
          className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-bold transition-colors"
          style={{
            background: canContinue ? 'var(--color-primary)' : 'var(--color-neutral-100)',
            color: canContinue ? 'white' : 'var(--color-neutral-500)',
          }}
        >
          {counterLabel}
          {canContinue && (
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          )}
        </span>
      </div>

      <div className="space-y-3">
        {benefits.map((benefit) => {
          const isSelected = selectedBenefits.includes(benefit.id);
          const isDisabled = atMax && !isSelected;

          return (
            <button
              key={benefit.id}
              onClick={() => !isDisabled && onToggle(benefit.id)}
              disabled={isDisabled}
              aria-pressed={isSelected}
              className={`w-full text-start rounded-2xl border-2 p-5 transition-all duration-200 min-h-[72px] ${
                isSelected
                  ? 'border-[var(--color-primary)] bg-[var(--color-primary-50)]'
                  : isDisabled
                  ? 'border-[var(--color-neutral-100)] bg-[var(--color-neutral-50)] opacity-50 cursor-not-allowed'
                  : 'border-[var(--color-neutral-100)] bg-white hover:border-[var(--color-primary)] hover:shadow-[0_4px_20px_rgba(71,64,153,0.08)]'
              }`}
            >
              <div className="flex items-start gap-4">
                {/* Checkbox indicator */}
                <div
                  className={`shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors mt-0.5 ${
                    isSelected
                      ? 'border-[var(--color-primary)] bg-[var(--color-primary)]'
                      : 'border-[var(--color-neutral-300)] bg-white'
                  }`}
                  aria-hidden="true"
                >
                  {isSelected && (
                    <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  )}
                </div>
                <div className="flex-1">
                  <p className={`text-base font-bold ${isSelected ? 'text-[var(--color-primary)]' : 'text-[var(--text-primary)]'}`}>
                    {isAr ? benefit.label_ar : benefit.label_en}
                  </p>
                  <p className="text-xs text-[var(--color-neutral-400)] mt-0.5 leading-relaxed">
                    {isAr ? benefit.citation_ar : benefit.citation_en}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* "Other" section */}
      <div className="mt-6 rounded-2xl border-2 border-[var(--color-neutral-100)] bg-white p-5">
        <label
          htmlFor="custom-benefit"
          className="block text-sm font-semibold text-[var(--text-primary)] mb-2"
        >
          {isAr ? 'شيء آخر؟ أخبرنا' : 'Something else? Tell us'}
        </label>
        <textarea
          id="custom-benefit"
          rows={2}
          value={customText}
          onChange={e => onCustomTextChange(e.target.value)}
          placeholder={
            isAr
              ? 'صِف النتيجة التي تبحث عنها...'
              : 'Describe the outcome you are looking for...'
          }
          className="w-full rounded-xl border-2 border-[var(--color-neutral-200)] px-4 py-3 text-base resize-none transition-colors outline-none focus:ring-2 focus:ring-offset-0 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)] min-h-[44px]"
        />
      </div>

      <button
        onClick={onContinue}
        disabled={!canContinue}
        className="mt-6 w-full rounded-2xl px-8 py-4 text-lg font-bold text-white min-h-[56px] transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 hover:scale-[1.02]"
        style={{ background: 'linear-gradient(135deg, var(--color-accent) 0%, #C44D12 100%)' }}
      >
        {isAr ? 'أكمل' : 'Continue'}
      </button>
    </div>
  );
}

// ── Component 4: SavingsAnalysisStep ─────────────────────────────────────────

interface SavingsAnalysisStepProps {
  selectedBenefits: Benefit[];
  selfAssessment: Map<string, SelfAssessmentRating>;
  roiInputs: {
    team_size: number;
    avg_salary: number;
    turnover_rate: number;
    absenteeism_days: number;
    engagement_score: number;
  };
  settings: {
    corporate_multiplier: number;
    per_leader_session_rate: number;
    per_leader_package_sessions: number;
    base_program_price_aed: number;
  };
  onContinue: () => void;
  isAr: boolean;
}

export function SavingsAnalysisStep({
  selectedBenefits,
  selfAssessment,
  roiInputs,
  settings,
  onContinue,
  isAr,
}: SavingsAnalysisStepProps) {
  // Run the ROI calculation (memoized — only recalculates when inputs change)
  const roiResult: CorporateRoiResult = useMemo(() => {
    return calculateCorporateRoi(roiInputs, selectedBenefits, settings);
  }, [roiInputs, selectedBenefits, settings]);

  // Build radar chart data from self-assessment
  const radarBenefits = useMemo(() => {
    return selectedBenefits.map(b => {
      const rating = selfAssessment.get(b.id) ?? { current: 3, target_3m: 6, target_6m: 8 };
      return {
        label: isAr ? b.label_ar : b.label_en,
        current: rating.current,
        target_3m: rating.target_3m,
        target_6m: rating.target_6m,
      };
    });
  }, [selectedBenefits, selfAssessment, isAr]);

  const fmtCurrency = (n: number) =>
    isAr ? `${n.toLocaleString('ar-SA')} د.إ` : `AED ${n.toLocaleString()}`;

  const fmtMultiple = (n: number) =>
    isAr ? `${n}×` : `${n}×`;

  // Progress bar width for each benefit (% of total savings)
  const maxSavings = Math.max(...roiResult.per_benefit_savings.map(b => b.annual_savings), 1);

  return (
    <div>
      {/* Header */}
      <h2
        className="text-2xl md:text-3xl font-bold text-[var(--text-primary)] text-center mb-2"
        style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
      >
        {isAr ? 'تحليل العائد المتوقع' : 'Your Expected ROI'}
      </h2>
      <p className="text-[var(--color-neutral-500)] text-center mb-8">
        {isAr
          ? 'بناءً على بيانات فريقك وأبحاث السوق'
          : 'Based on your team data and market research'}
      </p>

      {/* Radar Chart */}
      {radarBenefits.length > 0 && (
        <div className="rounded-2xl border-2 border-[var(--color-neutral-100)] bg-white p-5 mb-6">
          <h3 className="text-base font-bold text-[var(--text-primary)] mb-4 text-center">
            {isAr ? 'خارطة التحسّن المتوقع' : 'Expected Improvement Map'}
          </h3>
          <RadarChart
            benefits={radarBenefits}
            locale={isAr ? 'ar' : 'en'}
            height={300}
          />
        </div>
      )}

      {/* Per-Benefit Savings Cards */}
      <div className="space-y-4 mb-6">
        {roiResult.per_benefit_savings.map((b: BenefitSavings) => {
          const barPct = maxSavings > 0 ? Math.round((b.annual_savings / maxSavings) * 100) : 0;
          return (
            <div
              key={b.benefit_id}
              className="rounded-2xl border-2 border-[var(--color-neutral-100)] bg-white p-5"
            >
              {/* Benefit name */}
              <p className="text-base font-bold text-[var(--text-primary)] mb-2">
                {isAr ? b.label_ar : b.label_en}
              </p>

              {/* Annual savings — big green number */}
              <p className="text-2xl font-bold mb-1" style={{ color: '#16a34a' }}>
                {fmtCurrency(b.annual_savings)}
                <span className="text-sm font-normal text-[var(--color-neutral-500)] ms-1">
                  {isAr ? '/ سنة' : '/ year'}
                </span>
              </p>

              {/* Progress bar */}
              <div className="w-full h-1.5 rounded-full bg-[var(--color-neutral-100)] mb-3">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${barPct}%`, background: 'linear-gradient(90deg, #16a34a, #22c55e)' }}
                />
              </div>

              {/* Calculation basis */}
              <p className="text-xs text-[var(--color-neutral-500)] mb-1">
                {isAr ? b.calculation_basis_ar : b.calculation_basis_en}
              </p>

              {/* Research citation */}
              <p className="text-xs italic text-[var(--color-neutral-400)]">
                {isAr ? b.citation_ar : b.citation_en}
              </p>
            </div>
          );
        })}
      </div>

      {/* Total Annual Savings — highlighted banner */}
      <div
        className="rounded-2xl p-6 mb-6 text-center"
        style={{ background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)', border: '2px solid #bbf7d0' }}
      >
        <p className="text-sm font-medium text-[#166534] mb-1">
          {isAr ? 'إجمالي التوفير السنوي المتوقع' : 'Total Expected Annual Savings'}
        </p>
        <p className="text-4xl font-bold" style={{ color: '#15803d' }}>
          {fmtCurrency(roiResult.total_annual_savings)}
        </p>
      </div>

      {/* Comparison Cards: Full Program vs Per Leader */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        {/* Full Program Card */}
        <div className="rounded-2xl border-2 border-[var(--color-primary)] bg-[var(--color-primary-50)] p-4">
          <p className="text-xs font-bold text-[var(--color-primary)] mb-3 uppercase tracking-wide">
            {isAr ? 'البرنامج الكامل' : 'Full Program'}
          </p>
          <div className="space-y-2">
            <div>
              <p className="text-xs text-[var(--color-neutral-500)]">{isAr ? 'التكلفة' : 'Cost'}</p>
              <p className="text-base font-bold text-[var(--text-primary)]">
                {fmtCurrency(roiResult.full_program_cost)}
              </p>
            </div>
            <div>
              <p className="text-xs text-[var(--color-neutral-500)]">{isAr ? 'معامل العائد' : 'ROI Multiple'}</p>
              <p className="text-2xl font-bold text-[var(--color-primary)]">
                {fmtMultiple(roiResult.full_program_roi_multiple)}
              </p>
            </div>
            <div>
              <p className="text-xs text-[var(--color-neutral-500)]">{isAr ? 'صافي العائد' : 'Net Return'}</p>
              <p className={`text-sm font-bold ${roiResult.net_return_full >= 0 ? 'text-[#16a34a]' : 'text-red-600'}`}>
                {roiResult.net_return_full >= 0 ? '+' : ''}{fmtCurrency(roiResult.net_return_full)}
              </p>
            </div>
          </div>
        </div>

        {/* Per Leader Card */}
        <div className="rounded-2xl border-2 border-[var(--color-neutral-100)] bg-white p-4">
          <p className="text-xs font-bold text-[var(--color-neutral-500)] mb-3 uppercase tracking-wide">
            {isAr ? 'لكل قائد' : 'Per Leader'}
          </p>
          <div className="space-y-2">
            <div>
              <p className="text-xs text-[var(--color-neutral-500)]">{isAr ? 'التكلفة' : 'Cost'}</p>
              <p className="text-base font-bold text-[var(--text-primary)]">
                {fmtCurrency(roiResult.per_leader_cost)}
              </p>
            </div>
            <div>
              <p className="text-xs text-[var(--color-neutral-500)]">{isAr ? 'معامل العائد' : 'ROI Multiple'}</p>
              <p className="text-2xl font-bold text-[var(--color-neutral-600)]">
                {fmtMultiple(roiResult.per_leader_roi_multiple)}
              </p>
            </div>
            <div>
              <p className="text-xs text-[var(--color-neutral-500)]">{isAr ? 'صافي العائد' : 'Net Return'}</p>
              <p className={`text-sm font-bold ${roiResult.net_return_per_leader >= 0 ? 'text-[#16a34a]' : 'text-red-600'}`}>
                {roiResult.net_return_per_leader >= 0 ? '+' : ''}{fmtCurrency(roiResult.net_return_per_leader)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* "Get a Proposal" CTA */}
      <button
        onClick={onContinue}
        className="w-full rounded-2xl px-8 py-4 text-lg font-bold text-white min-h-[56px] transition-all duration-300 hover:scale-[1.02]"
        style={{ background: 'linear-gradient(135deg, var(--color-accent) 0%, #C44D12 100%)' }}
      >
        {isAr ? 'احصل على عرض مخصص لمؤسستك' : 'Get a Proposal for Your Organization'}
      </button>
    </div>
  );
}

// ── Utility ───────────────────────────────────────────────────────────────────

function toArabicNumerals(n: number): string {
  return n.toString().replace(/[0-9]/g, d => '٠١٢٣٤٥٦٧٨٩'[Number(d)]);
}
