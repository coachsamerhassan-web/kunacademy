'use client';

import { GeometricPattern } from '@kunacademy/ui/patterns';
import { Section } from '@kunacademy/ui/section';
import { Card } from '@kunacademy/ui/card';
import { useState, use } from 'react';
import { ArrowLeft } from 'lucide-react';

interface ROIInputs {
  teamSize: number;
  avgSalary: number;
  turnoverRate: number;
  absenteeismDays: number;
  engagementScore: number;
}

interface ROIResults {
  turnoverSavings: number;
  productivityGain: number;
  absenteeismSavings: number;
  totalROI: number;
  investmentCost: number;
  netReturn: number;
  roiMultiple: number;
}

const DEFAULT_INPUTS: ROIInputs = {
  teamSize: 20,
  avgSalary: 25000,
  turnoverRate: 15,
  absenteeismDays: 8,
  engagementScore: 55,
};

function calculateROI(inputs: ROIInputs): ROIResults {
  const { teamSize, avgSalary, turnoverRate, absenteeismDays, engagementScore } = inputs;

  // Industry benchmarks for coaching impact (conservative estimates from ICF studies)
  const turnoverReduction = 0.25; // coaching reduces turnover by ~25%
  const productivityIncrease = 0.20; // engagement improvement → productivity
  const absenteeismReduction = 0.30; // coaching reduces absenteeism by ~30%

  // Replacement cost = 1.5x annual salary (industry standard)
  const annualTurnoverCost = teamSize * (turnoverRate / 100) * avgSalary * 1.5;
  const turnoverSavings = annualTurnoverCost * turnoverReduction;

  // Productivity: each engagement point above baseline → 0.5% productivity
  const engagementGap = Math.max(0, 80 - engagementScore); // target: 80%
  const expectedEngagementLift = Math.min(engagementGap, 15); // coaching lifts ~15pts max
  const productivityGain = teamSize * avgSalary * (expectedEngagementLift * 0.005) * productivityIncrease;

  // Absenteeism: cost per day = salary/22 working days
  const dailyCost = avgSalary / 22;
  const totalAbsenteeismCost = teamSize * absenteeismDays * dailyCost;
  const absenteeismSavings = totalAbsenteeismCost * absenteeismReduction;

  const totalROI = turnoverSavings + productivityGain + absenteeismSavings;

  // Investment: group coaching at ~2,000 AED/person/month × 6 months
  const investmentCost = teamSize * 2000 * 6;
  const netReturn = totalROI - investmentCost;
  const roiMultiple = investmentCost > 0 ? totalROI / investmentCost : 0;

  return {
    turnoverSavings: Math.round(turnoverSavings),
    productivityGain: Math.round(productivityGain),
    absenteeismSavings: Math.round(absenteeismSavings),
    totalROI: Math.round(totalROI),
    investmentCost: Math.round(investmentCost),
    netReturn: Math.round(netReturn),
    roiMultiple: Math.round(roiMultiple * 10) / 10,
  };
}

export default function ROICalculatorPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = use(params);
  const isAr = locale === 'ar';
  const [inputs, setInputs] = useState<ROIInputs>(DEFAULT_INPUTS);
  const [showResults, setShowResults] = useState(false);

  const results = calculateROI(inputs);

  function updateInput(field: keyof ROIInputs, value: string) {
    const num = parseInt(value) || 0;
    setInputs((prev) => ({ ...prev, [field]: num }));
    if (showResults) setShowResults(true); // auto-recalculate
  }

  const formatCurrency = (amount: number) => {
    if (isAr) return `${amount.toLocaleString('ar-SA')} د.إ`;
    return `AED ${amount.toLocaleString()}`;
  };

  return (
    <main>
      {/* Hero */}
      <section
        className="relative overflow-hidden py-16 md:py-24"
        style={{ background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-600) 100%)' }}
      >
        <GeometricPattern pattern="eight-star" opacity={0.08} fade="both" />
        <div className="relative z-10 mx-auto max-w-[var(--max-content-width)] px-4 md:px-6 text-center">
          <a href={`/${locale}/programs/corporate`} className="text-sm text-white/60 hover:text-white/80 mb-4 inline-block">
            <ArrowLeft className="w-4 h-4 inline-block rtl:rotate-180" aria-hidden="true" /> {isAr ? 'الحلول المؤسسية' : 'Corporate Solutions'}
          </a>
          <h1
            className="text-[2.25rem] md:text-[3.5rem] font-bold text-[#FFF5E9] leading-[1.1]"
            style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
          >
            {isAr ? 'حاسبة العائد على الاستثمار' : 'Coaching ROI Calculator'}
          </h1>
          <p className="mt-4 text-white/65 max-w-2xl mx-auto text-lg">
            {isAr
              ? 'احسب العائد المتوقّع من الاستثمار في الكوتشينج المؤسسي لفريقك'
              : 'Estimate the expected return from investing in corporate coaching for your team'}
          </p>
        </div>
      </section>

      {/* Calculator */}
      <Section variant="white">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Input Panel */}
            <div>
              <h2 className="text-lg font-bold text-[var(--text-primary)] mb-6">
                {isAr ? 'بيانات فريقك' : 'Your Team Data'}
              </h2>

              <div className="space-y-5">
                <InputField
                  label={isAr ? 'عدد أعضاء الفريق' : 'Team Size'}
                  value={inputs.teamSize}
                  onChange={(v) => updateInput('teamSize', v)}
                  suffix={isAr ? 'شخص' : 'people'}
                  min={1}
                  max={500}
                />
                <InputField
                  label={isAr ? 'متوسط الراتب الشهري' : 'Average Monthly Salary'}
                  value={inputs.avgSalary}
                  onChange={(v) => updateInput('avgSalary', v)}
                  suffix={isAr ? 'د.إ' : 'AED'}
                  min={3000}
                  max={100000}
                  step={1000}
                />
                <InputField
                  label={isAr ? 'معدل دوران الموظفين السنوي' : 'Annual Turnover Rate'}
                  value={inputs.turnoverRate}
                  onChange={(v) => updateInput('turnoverRate', v)}
                  suffix="%"
                  min={0}
                  max={50}
                />
                <InputField
                  label={isAr ? 'أيام الغياب السنوية (لكل موظف)' : 'Absenteeism Days/Year (per employee)'}
                  value={inputs.absenteeismDays}
                  onChange={(v) => updateInput('absenteeismDays', v)}
                  suffix={isAr ? 'يوم' : 'days'}
                  min={0}
                  max={30}
                />
                <InputField
                  label={isAr ? 'درجة ارتباط الموظفين' : 'Employee Engagement Score'}
                  value={inputs.engagementScore}
                  onChange={(v) => updateInput('engagementScore', v)}
                  suffix="%"
                  min={10}
                  max={100}
                />
              </div>

              <button
                onClick={() => setShowResults(true)}
                className="mt-6 w-full rounded-xl bg-[var(--color-primary)] px-6 py-3.5 text-sm font-semibold text-white min-h-[48px] hover:opacity-90 transition-opacity"
              >
                {isAr ? 'احسب العائد' : 'Calculate ROI'}
              </button>
            </div>

            {/* Results Panel */}
            <div className={`transition-opacity duration-500 ${showResults ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
              <h2 className="text-lg font-bold text-[var(--text-primary)] mb-6">
                {isAr ? 'العائد المتوقّع (سنوي)' : 'Expected Annual Return'}
              </h2>

              {/* ROI Multiple */}
              <Card accent className="p-6 mb-6 text-center">
                <div className="text-4xl font-bold text-[var(--color-primary)]">
                  {results.roiMultiple}x
                </div>
                <p className="text-sm text-[var(--color-neutral-500)] mt-1">
                  {isAr ? 'مضاعف العائد على الاستثمار' : 'ROI Multiple'}
                </p>
              </Card>

              {/* Breakdown */}
              <div className="space-y-3">
                <ROIRow
                  label={isAr ? 'توفير تكلفة دوران الموظفين' : 'Turnover Cost Savings'}
                  value={formatCurrency(results.turnoverSavings)}
                  color="bg-green-500"
                  percent={results.totalROI > 0 ? (results.turnoverSavings / results.totalROI) * 100 : 0}
                />
                <ROIRow
                  label={isAr ? 'مكاسب الإنتاجية' : 'Productivity Gains'}
                  value={formatCurrency(results.productivityGain)}
                  color="bg-blue-500"
                  percent={results.totalROI > 0 ? (results.productivityGain / results.totalROI) * 100 : 0}
                />
                <ROIRow
                  label={isAr ? 'توفير تكلفة الغياب' : 'Absenteeism Savings'}
                  value={formatCurrency(results.absenteeismSavings)}
                  color="bg-purple-500"
                  percent={results.totalROI > 0 ? (results.absenteeismSavings / results.totalROI) * 100 : 0}
                />

                <div className="border-t border-[var(--color-neutral-200)] pt-3 mt-3">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-[var(--text-primary)]">{isAr ? 'إجمالي العائد' : 'Total Return'}</span>
                    <span className="font-bold text-[var(--color-primary)] text-lg">{formatCurrency(results.totalROI)}</span>
                  </div>
                  <div className="flex justify-between items-center mt-2 text-sm">
                    <span className="text-[var(--color-neutral-500)]">{isAr ? 'تكلفة الاستثمار (٦ أشهر)' : 'Investment Cost (6 months)'}</span>
                    <span className="text-[var(--color-neutral-600)]">{formatCurrency(results.investmentCost)}</span>
                  </div>
                  <div className="flex justify-between items-center mt-2 text-sm">
                    <span className="text-[var(--color-neutral-500)]">{isAr ? 'صافي العائد' : 'Net Return'}</span>
                    <span className={`font-semibold ${results.netReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(results.netReturn)}
                    </span>
                  </div>
                </div>
              </div>

              {/* CTA */}
              <a
                href={`/${locale}/contact?subject=corporate`}
                className="mt-6 block w-full text-center rounded-xl bg-[var(--color-accent)] px-6 py-3.5 text-sm font-semibold text-white min-h-[48px] hover:opacity-90 transition-opacity"
              >
                {isAr ? 'اطلب عرض أسعار' : 'Request a Proposal'}
              </a>
            </div>
          </div>

          {/* Methodology note */}
          <div className="mt-12 pt-8 border-t border-[var(--color-neutral-100)]">
            <p className="text-xs text-[var(--color-neutral-400)] max-w-2xl">
              {isAr
                ? 'تستند الحسابات إلى معايير صناعية محافظة من دراسات ICF وPwC حول تأثير الكوتشينج المؤسسي. النتائج الفعلية تختلف حسب السياق والتنفيذ. تكلفة الاستبدال = ١.٥× الراتب السنوي.'
                : 'Calculations based on conservative industry benchmarks from ICF and PwC studies on corporate coaching impact. Actual results vary by context and implementation. Replacement cost = 1.5× annual salary.'}
            </p>
          </div>
        </div>
      </Section>
    </main>
  );
}

function InputField({
  label, value, onChange, suffix, min, max, step,
}: {
  label: string; value: number; onChange: (v: string) => void;
  suffix: string; min?: number; max?: number; step?: number;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-[var(--color-neutral-700)] mb-1.5">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="range"
          min={min ?? 0}
          max={max ?? 100}
          step={step ?? 1}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label={label}
          className="flex-1 h-2 rounded-full appearance-none bg-[var(--color-neutral-200)] accent-[var(--color-primary)]"
        />
        <div className="flex items-center gap-1 text-sm font-semibold text-[var(--text-primary)] w-24 justify-end">
          <input
            type="number"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            min={min}
            max={max}
            step={step}
            className="w-16 text-end rounded border border-[var(--color-neutral-200)] px-2 py-1 text-sm"
          />
          <span className="text-xs text-[var(--color-neutral-500)]">{suffix}</span>
        </div>
      </div>
    </div>
  );
}

function ROIRow({ label, value, color, percent }: { label: string; value: string; color: string; percent: number }) {
  return (
    <div>
      <div className="flex justify-between items-center text-sm mb-1">
        <span className="text-[var(--color-neutral-600)]">{label}</span>
        <span className="font-semibold text-[var(--text-primary)]">{value}</span>
      </div>
      <div className="w-full h-2 rounded-full bg-[var(--color-neutral-100)] overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all duration-500`} style={{ width: `${Math.min(percent, 100)}%` }} />
      </div>
    </div>
  );
}
