'use client';

import { useState, useCallback, useRef, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { PathfinderQuestion, PathfinderAnswer, LightReport } from '@kunacademy/cms';
import { scoreAnswersLight } from '@kunacademy/cms';
import {
  DirectionSelectStep,
  SelfAssessmentStep,
  BenefitsQuizStep,
  SavingsAnalysisStep,
} from './corporate-steps';
import type { Direction, Benefit, SelfAssessmentRating, CorporateBenefitsData } from './corporate-steps';

// ── Types ────────────────────────────────────────────────────────────────────

type Step =
  | 'welcome'
  | 'type_select'
  | 'questions'             // individual path
  | 'direction_select'      // corporate: pick a direction
  | 'self_assessment'       // corporate: rate current state
  | 'benefits_quiz'         // corporate: pick priority benefits
  | 'roi_inputs'            // shared: individual ROI / corporate team data
  | 'savings_analysis'      // corporate only (Wave 2 placeholder)
  | 'light_results'         // TIER 1: instant light report (individual path, no gate)
  | 'lead_capture'          // TIER 2 opt-in: extended report (after Tier 1)
  | 'processing';

interface AnswerRecord {
  question_id: string;
  answer_id: string;
  answer_text: string;
  category_weights?: Record<string, number>;
}

interface RoiInputs {
  team_size: number;
  avg_salary: number;
  turnover_rate: number;
  absenteeism_days: number;
  engagement_score: number;
}

interface Props {
  locale: string;
  questions: PathfinderQuestion[];
  corporateBenefits?: CorporateBenefitsData;
}

// ── Component ────────────────────────────────────────────────────────────────

export function PathfinderEngine({ locale, questions, corporateBenefits }: Props) {
  const isAr = locale === 'ar';
  const router = useRouter();

  // State machine
  const [step, setStep] = useState<Step>('welcome');
  const [assessmentType, setAssessmentType] = useState<'individual' | 'corporate' | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<PathfinderQuestion | null>(null);
  const [answerTrail, setAnswerTrail] = useState<AnswerRecord[]>([]);
  const [questionHistory, setQuestionHistory] = useState<PathfinderQuestion[]>([]);
  const [roiInputs, setRoiInputs] = useState<RoiInputs>({
    team_size: 20, avg_salary: 25000, turnover_rate: 15, absenteeism_days: 8, engagement_score: 55,
  });
  const [contact, setContact] = useState({ name: '', email: '', phone: '', job_title: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [roiCollected, setRoiCollected] = useState(false);
  const [lightReport, setLightReport] = useState<LightReport | null>(null);

  // Corporate-path state
  const [direction, setDirection] = useState<string | null>(null);
  const [selectedBenefitIds, setSelectedBenefitIds] = useState<string[]>([]);
  const [selfAssessment, setSelfAssessment] = useState<Map<string, SelfAssessmentRating>>(new Map());
  const [customBenefitText, setCustomBenefitText] = useState('');

  const containerRef = useRef<HTMLDivElement>(null);

  // ── Auto-initialize on mount (fixes cache/hydration: no hard refresh needed) ──
  useEffect(() => {
    if (questions && questions.length > 0 && !currentQuestion) {
      const roots = questions.filter(q => !q.parent_answer_id);
      if (roots.length > 0) {
        setCurrentQuestion(roots[0]);
        setQuestionHistory([roots[0]]);
      }
    }
  }, [questions]);

  // Filter questions by type
  const getRoots = useCallback((type: 'individual' | 'corporate') => {
    return questions.filter(q => !q.parent_answer_id && q.type === type);
  }, [questions]);

  const getChildren = useCallback((parentAnswerId: string) => {
    return questions.filter(q => q.parent_answer_id === parentAnswerId);
  }, [questions]);

  // Returns benefits for the currently selected direction (flattens 'all' for custom_program)
  const getDirectionBenefits = useCallback((dirId?: string | null): Benefit[] => {
    const id = dirId ?? direction;
    if (!corporateBenefits || !id) return [];
    const dir = corporateBenefits.directions.find(d => d.id === id);
    if (!dir) return [];
    if (dir.benefits === 'all') {
      return corporateBenefits.directions
        .filter(d => d.benefits !== 'all')
        .flatMap(d => d.benefits as Benefit[]);
    }
    return dir.benefits;
  }, [corporateBenefits, direction]);

  // Returns the full Benefit objects for the currently selected benefit IDs
  const getSelectedBenefitObjects = useCallback((): Benefit[] => {
    const allBenefits = getDirectionBenefits();
    return allBenefits.filter(b => selectedBenefitIds.includes(b.id));
  }, [getDirectionBenefits, selectedBenefitIds]);

  // ── Transition helper ──────────────────────────────────────────────────────

  // useTransition avoids React 19 dev-mode Performance.measure errors
  // that occurred when setTimeout interleaved with concurrent fiber updates
  const [, startTransition] = useTransition();
  const animateTransition = useCallback((callback: () => void) => {
    setIsAnimating(true);
    setTimeout(() => {
      startTransition(() => {
        callback();
        setIsAnimating(false);
      });
    }, 250);
  }, [startTransition]);

  // ── Step handlers ──────────────────────────────────────────────────────────

  const handleStart = useCallback(() => {
    animateTransition(() => setStep('type_select'));
  }, [animateTransition]);

  const handleTypeSelect = useCallback((type: 'individual' | 'corporate') => {
    setAssessmentType(type);
    if (type === 'corporate') {
      animateTransition(() => setStep('direction_select'));
    } else {
      const roots = getRoots(type);
      if (roots.length > 0) {
        animateTransition(() => {
          setCurrentQuestion(roots[0]);
          setQuestionHistory([roots[0]]);
          setStep('questions');
        });
      }
    }
  }, [getRoots, animateTransition]);

  const handleAnswer = useCallback((question: PathfinderQuestion, answer: PathfinderAnswer) => {
    const record: AnswerRecord = {
      question_id: question.question_id,
      answer_id: answer.id,
      answer_text: isAr ? answer.text_ar : answer.text_en,
      category_weights: answer.category_weights,
    };

    const newTrail = [...answerTrail, record];
    setAnswerTrail(newTrail);

    // Check for children (branching)
    const children = getChildren(answer.id);

    animateTransition(() => {
      if (children.length > 0) {
        // More questions in this branch
        setCurrentQuestion(children[0]);
        setQuestionHistory(prev => [...prev, children[0]]);
      } else if (assessmentType === 'corporate' && !roiCollected) {
        // Corporate path: collect ROI inputs before lead capture (once)
        setStep('roi_inputs');
      } else if (assessmentType === 'individual') {
        // Individual path: compute Tier 1 light report instantly, no gate
        const report = scoreAnswersLight(newTrail, 'individual');
        setLightReport(report);
        setStep('light_results');
      } else {
        // Fallback (corporate without ROI already collected) → lead capture
        setStep('lead_capture');
      }
    });
  }, [answerTrail, getChildren, animateTransition, assessmentType, roiCollected, isAr]);

  // ── Corporate step handlers ────────────────────────────────────────────────

  const handleDirectionSelect = useCallback((dirId: string) => {
    setDirection(dirId);
    // Initialize self-assessment with defaults for all benefits in this direction
    const benefits = getDirectionBenefits(dirId);
    const initial = new Map<string, SelfAssessmentRating>();
    benefits.forEach(b => {
      initial.set(b.id, { benefit_id: b.id, current: 3, target_3m: 6, target_6m: 8 });
    });
    setSelfAssessment(initial);
    // Reset any prior selection when direction changes
    setSelectedBenefitIds([]);
    setCustomBenefitText('');
    animateTransition(() => setStep('self_assessment'));
  }, [getDirectionBenefits, animateTransition]);

  const handleSelfAssessmentUpdate = useCallback((
    benefitId: string,
    field: 'current' | 'target_3m' | 'target_6m',
    value: number,
  ) => {
    setSelfAssessment(prev => {
      const next = new Map(prev);
      const existing = next.get(benefitId) ?? { benefit_id: benefitId, current: 3, target_3m: 6, target_6m: 8 };
      next.set(benefitId, { ...existing, [field]: value });
      return next;
    });
  }, []);

  const handleBenefitToggle = useCallback((benefitId: string) => {
    setSelectedBenefitIds(prev => {
      if (prev.includes(benefitId)) return prev.filter(id => id !== benefitId);
      if (prev.length >= 5) return prev; // max 5
      return [...prev, benefitId];
    });
  }, []);

  const handleBack = useCallback(() => {
    // Tier 2 opt-in form → back to Tier 1 light results (individual) or savings (corporate)
    if (step === 'lead_capture') {
      if (assessmentType === 'corporate') {
        animateTransition(() => setStep('savings_analysis'));
      } else {
        animateTransition(() => setStep('light_results'));
      }
      return;
    }

    // Tier 1 light results → back to last question
    if (step === 'light_results') {
      animateTransition(() => {
        setStep('questions');
        if (questionHistory.length > 0) {
          setCurrentQuestion(questionHistory[questionHistory.length - 1]);
        }
      });
      return;
    }

    if (step === 'savings_analysis') {
      animateTransition(() => setStep('roi_inputs'));
      return;
    }

    if (step === 'roi_inputs') {
      if (assessmentType === 'corporate') {
        animateTransition(() => setStep('benefits_quiz'));
      } else {
        animateTransition(() => {
          setStep('questions');
          setCurrentQuestion(questionHistory[questionHistory.length - 1]);
        });
      }
      return;
    }

    if (step === 'benefits_quiz') {
      animateTransition(() => setStep('self_assessment'));
      return;
    }

    if (step === 'self_assessment') {
      animateTransition(() => setStep('direction_select'));
      return;
    }

    if (step === 'direction_select') {
      animateTransition(() => setStep('type_select'));
      return;
    }

    if (step === 'questions' && questionHistory.length > 1) {
      animateTransition(() => {
        const newHistory = questionHistory.slice(0, -1);
        const newTrail = answerTrail.slice(0, -1);
        setQuestionHistory(newHistory);
        setAnswerTrail(newTrail);
        setCurrentQuestion(newHistory[newHistory.length - 1]);
      });
    } else if (step === 'questions') {
      animateTransition(() => setStep('type_select'));
    } else if (step === 'type_select') {
      animateTransition(() => setStep('welcome'));
    }
  }, [step, questionHistory, answerTrail, animateTransition, assessmentType]);

  const handleSubmit = useCallback(async () => {
    // Validate
    const newErrors: Record<string, string> = {};
    if (!contact.name.trim()) newErrors.name = isAr ? 'الاسم مطلوب' : 'Name is required';
    if (!contact.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email)) {
      newErrors.email = isAr ? 'البريد الإلكتروني غير صالح' : 'Invalid email address';
    }
    if (assessmentType === 'corporate' && !contact.job_title.trim()) {
      newErrors.job_title = isAr ? 'المسمى الوظيفي مطلوب' : 'Job title is required';
    }
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      // UX-Pro: focus-management — auto-focus first invalid field after submit error
      setTimeout(() => {
        const firstError = document.querySelector('[aria-invalid="true"]') as HTMLElement | null;
        firstError?.focus();
      }, 50);
      return;
    }

    setSubmitError(null);
    setStep('processing');

    try {
      if (assessmentType === 'corporate') {
        const res = await fetch('/api/pathfinder/proposal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contact: {
              name: contact.name,
              email: contact.email,
              job_title: contact.job_title,
            },
            direction: direction,
            direction_label_ar: corporateBenefits?.directions.find(d => d.id === direction)?.title_ar ?? '',
            direction_label_en: corporateBenefits?.directions.find(d => d.id === direction)?.title_en ?? '',
            selected_benefits: getSelectedBenefitObjects(),
            self_assessment: Array.from(selfAssessment.entries()).map(([id, rating]) => ({
              benefit_id: id,
              current: rating.current,
              target_3m: rating.target_3m,
              target_6m: rating.target_6m,
            })),
            roi_inputs: roiInputs,
            custom_benefit_text: customBenefitText || undefined,
            locale,
          }),
        });

        if (!res.ok) throw new Error('Failed to submit');
        const data = await res.json();
        router.push(`/${locale}/pathfinder/results?id=${data.id}&pdf=${encodeURIComponent(data.proposal_pdf_url)}`);
      } else {
        const res = await fetch('/api/pathfinder', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            answers: answerTrail,
            contact,
            type: assessmentType,
            locale,
          }),
        });

        if (!res.ok) throw new Error('Failed to submit');
        const data = await res.json();
        router.push(`/${locale}/pathfinder/results?id=${data.id}`);
      }
    } catch {
      // UX-Pro: error-recovery — return to form AND show clear error message
      setStep('lead_capture');
      setSubmitError(isAr
        ? 'حدث خطأ أثناء الإرسال. تحقق من اتصالك وحاول مرة أخرى.'
        : 'Something went wrong. Check your connection and try again.'
      );
    }
  }, [contact, answerTrail, assessmentType, roiInputs, locale, router, isAr, direction, corporateBenefits, getSelectedBenefitObjects, selfAssessment, customBenefitText]);

  // ── Progress calculation ───────────────────────────────────────────────────

  const progressPct = (() => {
    if (step === 'welcome') return 0;
    if (step === 'type_select') return 10;
    // Corporate path
    if (step === 'direction_select') return 15;
    if (step === 'self_assessment') return 30;
    if (step === 'benefits_quiz') return 45;
    // Individual path
    if (step === 'questions') return 15 + Math.min(answerTrail.length * 15, 55);
    // Shared
    if (step === 'roi_inputs') return 60;
    if (step === 'savings_analysis') return 75;
    // Two-tier flow
    if (step === 'light_results') return 85;  // Tier 1 done
    if (step === 'lead_capture') return 92;   // Tier 2 opt-in
    return 100;
  })();

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <main
      ref={containerRef}
      className="min-h-screen flex flex-col"
      style={{ background: 'linear-gradient(180deg, #FFF5E9 0%, #FFFFFF 100%)' }}
    >
      {/* Progress bar */}
      {step !== 'welcome' && (
        <div className="fixed top-0 left-0 right-0 z-50 h-1 bg-[var(--color-neutral-100)]">
          <div
            className="h-full transition-all duration-500 ease-out rounded-r-full"
            style={{ width: `${progressPct}%`, background: 'linear-gradient(90deg, var(--color-primary), var(--color-accent))' }}
          />
        </div>
      )}

      {/* Back button */}
      {step !== 'welcome' && step !== 'processing' && (
        <button
          onClick={handleBack}
          className="fixed top-4 start-4 z-50 flex items-center gap-2 text-sm text-[var(--color-neutral-500)] hover:text-[var(--color-primary)] transition-colors min-h-[44px] px-3"
          aria-label={isAr ? 'رجوع' : 'Go back'}
        >
          <svg className="w-4 h-4 rtl:rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          {isAr ? 'رجوع' : 'Back'}
        </button>
      )}

      {/* UX-Pro: aria-live-errors — announce form errors to screen readers */}
      <div role="status" aria-live="polite" className="sr-only" aria-atomic="true">
        {Object.values(errors).filter(Boolean).join('. ')}
        {submitError}
      </div>

      {/* Content area */}
      <div className={`flex-1 flex justify-center px-4 py-20 transition-opacity duration-[250ms] ${isAnimating ? 'opacity-0' : 'opacity-100'} ${
          ['self_assessment', 'benefits_quiz', 'savings_analysis'].includes(step) ? 'items-start' : 'items-center'
        }`}>
        <div className="w-full max-w-xl">

          {/* ── Welcome ───────────────────────────────────────────────── */}
          {step === 'welcome' && (
            <div className="text-center animate-fade-up">
              <div className="mx-auto w-20 h-20 rounded-full flex items-center justify-center mb-8" style={{ background: 'var(--color-primary-50)' }}>
                <svg className="w-10 h-10 text-[var(--color-primary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                </svg>
              </div>
              <h1
                className="text-3xl md:text-4xl font-bold text-[var(--text-primary)] leading-tight mb-4"
                style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
              >
                {isAr ? 'مرحبًا بك في المُرشد' : 'Welcome to Pathfinder'}
              </h1>
              <p className="text-[var(--color-neutral-600)] text-lg leading-relaxed mb-10 max-w-md mx-auto">
                {isAr
                  ? 'سأطرح عليك بضعة أسئلة لأفهم وضعك وأهدافك — وبعدها سأُعدّ لك خارطة طريق شخصية'
                  : "I'll ask you a few questions to understand your situation and goals — then prepare a personalized roadmap for you"}
              </p>
              <button
                onClick={handleStart}
                className="rounded-2xl px-10 py-4 text-lg font-bold text-white min-h-[56px] transition-all duration-300 hover:scale-105"
                style={{ background: 'linear-gradient(135deg, var(--color-accent) 0%, #C44D12 100%)' }}
              >
                {isAr ? 'يلّا نبدأ' : "Let's Begin"}
              </button>
            </div>
          )}

          {/* ── Type Selection ─────────────────────────────────────────── */}
          {step === 'type_select' && (
            <div className="animate-fade-up is-visible">
              <h2
                className="text-2xl md:text-3xl font-bold text-[var(--text-primary)] text-center mb-3"
                style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
              >
                {isAr ? 'أخبرني عن نفسك' : 'Tell Me About Yourself'}
              </h2>
              <p className="text-[var(--color-neutral-500)] text-center mb-10">
                {isAr ? 'هل تبحث عن شيء لنفسك أم لمؤسستك؟' : 'Are you exploring for yourself or your organization?'}
              </p>
              <div className="space-y-4">
                <TypeCard
                  onClick={() => handleTypeSelect('individual')}
                  iconPath="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  title={isAr ? 'أبحث لنفسي' : "I'm exploring for myself"}
                  desc={isAr ? 'نمو شخصي، تطوير مهني، أو أفكر أصبح كوتش' : 'Personal growth, career development, or considering becoming a coach'}
                />
                <TypeCard
                  onClick={() => handleTypeSelect('corporate')}
                  iconPath="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                  title={isAr ? 'أبحث لمؤسستي' : "I'm exploring for my organization"}
                  desc={isAr ? 'تطوير القيادة، بناء الفرق، أو برامج تحوّل مؤسسي' : 'Leadership development, team building, or transformation programs'}
                />
              </div>
            </div>
          )}

          {/* ── Direction Select (Corporate) ───────────────────────────── */}
          {step === 'direction_select' && corporateBenefits && (
            <div className="animate-fade-up is-visible">
              <DirectionSelectStep
                directions={corporateBenefits.directions}
                isAr={isAr}
                onSelect={handleDirectionSelect}
              />
            </div>
          )}

          {/* ── Self Assessment (Corporate) ────────────────────────────── */}
          {step === 'self_assessment' && (
            <div className="animate-fade-up is-visible">
              <SelfAssessmentStep
                benefits={getDirectionBenefits()}
                selfAssessment={selfAssessment}
                onUpdate={handleSelfAssessmentUpdate}
                onContinue={() => animateTransition(() => setStep('benefits_quiz'))}
                isAr={isAr}
              />
            </div>
          )}

          {/* ── Benefits Quiz (Corporate) ──────────────────────────────── */}
          {step === 'benefits_quiz' && (
            <div className="animate-fade-up is-visible">
              <BenefitsQuizStep
                benefits={getDirectionBenefits()}
                selectedBenefits={selectedBenefitIds}
                onToggle={handleBenefitToggle}
                customText={customBenefitText}
                onCustomTextChange={setCustomBenefitText}
                onContinue={() => animateTransition(() => setStep('roi_inputs'))}
                isAr={isAr}
              />
            </div>
          )}

          {/* ── Savings Analysis (Corporate) ───────────────────────────── */}
          {step === 'savings_analysis' && (
            <div className="animate-fade-up is-visible">
              <SavingsAnalysisStep
                selectedBenefits={getSelectedBenefitObjects()}
                selfAssessment={selfAssessment}
                roiInputs={roiInputs}
                settings={{
                  corporate_multiplier: 2,
                  per_leader_session_rate: 2000,
                  per_leader_package_sessions: 6,
                  base_program_price_aed: 15000,
                }}
                onContinue={() => animateTransition(() => setStep('lead_capture'))}
                isAr={isAr}
              />
            </div>
          )}

          {/* ── Questions ──────────────────────────────────────────────── */}
          {step === 'questions' && currentQuestion && (
            <div className="animate-fade-up is-visible">
              <p className="text-sm text-[var(--color-primary)] font-medium text-center mb-2">
                {isAr ? `السؤال ${answerTrail.length + 1}` : `Question ${answerTrail.length + 1}`}
              </p>
              <h2
                className="text-2xl md:text-3xl font-bold text-[var(--text-primary)] text-center mb-10 leading-snug"
                style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
              >
                {isAr ? currentQuestion.question_ar : currentQuestion.question_en}
              </h2>
              <div className="space-y-3">
                {currentQuestion.answers.map((answer) => (
                  <AnswerCard
                    key={answer.id}
                    answer={answer}
                    isAr={isAr}
                    onClick={() => handleAnswer(currentQuestion, answer)}
                  />
                ))}
              </div>
              {currentQuestion.answers.length === 0 && (
                <div className="text-center mt-6">
                  {currentQuestion.recommendation_slug && (
                    <p className="text-[var(--color-neutral-500)] mb-4">
                      {isAr ? 'وجدنا لك التوصية المثالية!' : "We've found your ideal recommendation!"}
                    </p>
                  )}
                  <button
                    onClick={() => {
                      if (assessmentType === 'corporate') {
                        animateTransition(() => setStep('roi_inputs'));
                      } else {
                        // Compute Tier 1 light report instantly for individual path
                        const report = scoreAnswersLight(answerTrail, 'individual');
                        setLightReport(report);
                        animateTransition(() => setStep('light_results'));
                      }
                    }}
                    className="rounded-2xl px-10 py-4 text-lg font-bold text-white min-h-[56px] transition-all duration-300 hover:scale-105"
                    style={{ background: 'linear-gradient(135deg, var(--color-accent) 0%, #C44D12 100%)' }}
                  >
                    {isAr ? 'أكمل' : 'Continue'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── ROI Inputs (Corporate) ────────────────────────────────── */}
          {step === 'roi_inputs' && (
            <div className="animate-fade-up is-visible">
              <h2
                className="text-2xl md:text-3xl font-bold text-[var(--text-primary)] text-center mb-3"
                style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
              >
                {isAr ? 'خلّني أحسبلك العائد المتوقع' : "Let Me Calculate Your Expected ROI"}
              </h2>
              <p className="text-[var(--color-neutral-500)] text-center mb-8">
                {isAr ? 'أعطني بعض الأرقام التقريبية — سأضمّن التحليل في تقريرك' : "Give me some rough numbers — I'll include the analysis in your report"}
              </p>
              <div className="space-y-6">
                <RoiSlider label={isAr ? 'حجم الفريق' : 'Team Size'} value={roiInputs.team_size} min={1} max={500} step={1} unit="" onChange={v => setRoiInputs(p => ({ ...p, team_size: v }))} />
                <RoiSlider label={isAr ? 'متوسط الراتب الشهري' : 'Avg Monthly Salary'} value={roiInputs.avg_salary} min={3000} max={100000} step={1000} unit="AED" onChange={v => setRoiInputs(p => ({ ...p, avg_salary: v }))} />
                <RoiSlider label={isAr ? 'معدل دوران الموظفين السنوي' : 'Annual Turnover Rate'} value={roiInputs.turnover_rate} min={0} max={50} step={1} unit="%" onChange={v => setRoiInputs(p => ({ ...p, turnover_rate: v }))} />
                <RoiSlider label={isAr ? 'أيام الغياب سنويًا / شخص' : 'Absenteeism Days/Year/Person'} value={roiInputs.absenteeism_days} min={0} max={30} step={1} unit="" onChange={v => setRoiInputs(p => ({ ...p, absenteeism_days: v }))} />
                <RoiSlider label={isAr ? 'نسبة تفاعل الموظفين' : 'Employee Engagement Score'} value={roiInputs.engagement_score} min={10} max={100} step={1} unit="%" onChange={v => setRoiInputs(p => ({ ...p, engagement_score: v }))} />
              </div>
              <button
                onClick={() => {
                  setRoiCollected(true);
                  if (assessmentType === 'corporate') {
                    animateTransition(() => setStep('savings_analysis'));
                  } else {
                    // Individual path: go to Tier 1 light results
                    const report = scoreAnswersLight(answerTrail, 'individual');
                    setLightReport(report);
                    animateTransition(() => setStep('light_results'));
                  }
                }}
                className="mt-8 w-full rounded-2xl px-8 py-4 text-lg font-bold text-white min-h-[56px] transition-all duration-300 hover:scale-[1.02]"
                style={{ background: 'linear-gradient(135deg, var(--color-accent) 0%, #C44D12 100%)' }}
              >
                {isAr ? 'أكمل' : 'Continue'}
              </button>
            </div>
          )}

          {/* ── Tier 1: Light Results (instant, no gate) ──────────────── */}
          {step === 'light_results' && lightReport && (
            <LightResultsStep
              report={lightReport}
              isAr={isAr}
              locale={locale}
              onGetExtended={() => animateTransition(() => setStep('lead_capture'))}
            />
          )}

          {/* ── Lead Capture (Tier 2 Opt-In) ──────────────────────────── */}
          {step === 'lead_capture' && (
            <div className="animate-fade-up is-visible">
              {/* Tier 2 header — emphasises the upgrade, not a gate */}
              <div className="text-center mb-8">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider mb-4" style={{ background: 'rgba(228,96,30,.1)', color: '#E4601E' }}>
                  <span>✦</span>
                  {isAr ? 'التقرير الشامل' : 'Extended Report'}
                </div>
                <h2
                  className="text-2xl md:text-3xl font-bold text-[var(--text-primary)] mb-3"
                  style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
                >
                  {isAr ? 'احصل على الصورة الكاملة' : 'Get the Full Picture'}
                </h2>
                <p className="text-[var(--color-neutral-500)] max-w-sm mx-auto">
                  {isAr
                    ? 'وصف تفصيلي للبرامج، مسار التعلّم الكامل، ونظرة على الاستثمار — كل ذلك في تقرير خاص بك'
                    : 'Full program details, complete learning pathway, and investment overview — all in your personalized report'}
                </p>
              </div>
              {/* What you unlock */}
              <ul className="space-y-2 mb-6 rounded-2xl p-5 border" style={{ borderColor: '#E8E3DC', background: '#FFF5E9' }}>
                {(isAr ? [
                  'وصف تفصيلي للبرامج مع أبرز المحتوى',
                  'لماذا يناسبك هذا المدرب — تفاصيل كاملة',
                  'شهادات المتدربين (٢–٣ تجارب)',
                  'مسار التعلّم الكامل بصري',
                  'نظرة على الاستثمار مع خيارات الدفع',
                  'روابط حجز مباشرة للخطوة التالية',
                ] : [
                  'Full program descriptions with curriculum highlights',
                  'Why this coach — detailed match reasoning',
                  'Coach testimonials (2–3 real reviews)',
                  'Complete visual learning pathway',
                  'Investment overview with geo-based pricing',
                  'Direct booking CTAs for next steps',
                ]).map((item, i) => (
                  <li key={i} className="flex items-baseline gap-2 text-sm" style={{ color: '#6B6560' }}>
                    <span className="font-bold shrink-0 text-xs" style={{ color: '#E4601E' }}>✓</span>
                    {item}
                  </li>
                ))}
              </ul>
              <div className="space-y-4">
                <InputField
                  label={isAr ? 'الاسم' : 'Name'}
                  value={contact.name}
                  onChange={v => { setContact(p => ({ ...p, name: v })); setErrors(e => ({ ...e, name: '' })); }}
                  error={errors.name}
                  placeholder={isAr ? 'اسمك الكريم' : 'Your name'}
                />
                <InputField
                  label={isAr ? 'البريد الإلكتروني' : 'Email'}
                  type="email"
                  value={contact.email}
                  onChange={v => { setContact(p => ({ ...p, email: v })); setErrors(e => ({ ...e, email: '' })); }}
                  error={errors.email}
                  placeholder={isAr ? 'example@email.com' : 'example@email.com'}
                />
                {assessmentType === 'corporate' ? (
                  <InputField
                    label={isAr ? 'المسمى الوظيفي' : 'Job Title'}
                    value={contact.job_title}
                    onChange={v => { setContact(p => ({ ...p, job_title: v })); setErrors(e => ({ ...e, job_title: '' })); }}
                    error={errors.job_title}
                    placeholder={isAr ? 'مثال: مدير الموارد البشرية' : 'e.g. VP of People & Culture'}
                  />
                ) : (
                  <InputField
                    label={isAr ? 'رقم الهاتف (اختياري)' : 'Phone (optional)'}
                    type="tel"
                    value={contact.phone}
                    onChange={v => setContact(p => ({ ...p, phone: v }))}
                    placeholder={isAr ? '+971 50 123 4567' : '+971 50 123 4567'}
                  />
                )}
              </div>
              {/* UX-Pro: error-recovery — show submit error with retry guidance */}
              {submitError && (
                <p role="alert" className="mt-4 text-sm text-red-600 text-center rounded-lg bg-red-50 border border-red-200 px-4 py-2">
                  {submitError}
                </p>
              )}

              <button
                onClick={handleSubmit}
                className="mt-6 w-full rounded-2xl px-8 py-4 text-lg font-bold text-white min-h-[56px] transition-all duration-300 hover:scale-[1.02]"
                style={{ background: 'linear-gradient(135deg, var(--color-accent) 0%, #C44D12 100%)' }}
              >
                {isAr ? 'أرسل لي التقرير الشامل' : 'Send My Extended Report'}
              </button>
              <p className="mt-3 text-center text-xs" style={{ color: '#9B9591' }}>
                {isAr
                  ? 'لن نرسل إشعارات مزعجة — فقط تقريرك المخصص'
                  : "No spam — just your personalized report"}
              </p>
            </div>
          )}

          {/* ── Processing ─────────────────────────────────────────────── */}
          {step === 'processing' && (
            <div className="text-center animate-fade-up" role="status" aria-label={isAr ? 'جاري إعداد خارطة طريقك' : 'Preparing your roadmap'}>
              {/* UX-Pro: reduced-motion — spinner respects prefers-reduced-motion via motion-safe */}
              <div className="mx-auto w-16 h-16 mb-6">
                <svg className="motion-safe:animate-spin w-16 h-16 text-[var(--color-primary)]" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
              <h2
                className="text-2xl font-bold text-[var(--text-primary)] mb-2"
                style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
              >
                {isAr ? 'جاري إعداد خارطة طريقك...' : 'Preparing your roadmap...'}
              </h2>
              <p className="text-[var(--color-neutral-500)]">
                {isAr ? 'لحظات وتكون جاهزة' : 'Just a moment'}
              </p>
            </div>
          )}

        </div>
      </div>
    </main>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function TypeCard({ onClick, iconPath, title, desc }: {
  onClick: () => void; iconPath: string; title: string; desc: string;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full text-start rounded-2xl border-2 border-[var(--color-neutral-100)] bg-white p-6 transition-all duration-300 hover:border-[var(--color-primary)] hover:shadow-[0_8px_32px_rgba(71,64,153,0.08)] min-h-[88px] group"
    >
      <div className="flex items-center gap-5">
        <div className="shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center bg-[var(--color-primary-50)] group-hover:bg-[var(--color-primary)] transition-colors">
          <svg className="w-6 h-6 text-[var(--color-primary)] group-hover:text-white transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d={iconPath} />
          </svg>
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-bold text-[var(--text-primary)]">{title}</h3>
          <p className="text-sm text-[var(--color-neutral-500)] mt-0.5">{desc}</p>
        </div>
      </div>
    </button>
  );
}

function AnswerCard({ answer, isAr, onClick }: {
  answer: PathfinderAnswer; isAr: boolean; onClick: () => void;
}) {
  const text = isAr ? answer.text_ar : answer.text_en;
  const desc = isAr ? answer.description_ar : answer.description_en;

  return (
    <button
      onClick={onClick}
      className="w-full text-start rounded-2xl border-2 border-[var(--color-neutral-100)] bg-white px-6 py-5 transition-all duration-300 hover:border-[var(--color-primary)] hover:shadow-[0_4px_20px_rgba(71,64,153,0.08)] min-h-[56px] group"
    >
      <div className="flex items-center gap-4">
        {answer.icon && (
          <span className="text-2xl shrink-0">{answer.icon}</span>
        )}
        <div className="flex-1">
          <span className="text-base font-semibold text-[var(--text-primary)] group-hover:text-[var(--color-primary)] transition-colors">
            {text}
          </span>
          {desc && (
            <p className="text-sm text-[var(--color-neutral-500)] mt-0.5">{desc}</p>
          )}
        </div>
        <svg className="shrink-0 w-5 h-5 text-[var(--color-neutral-300)] group-hover:text-[var(--color-primary)] transition-colors rtl:rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 18l6-6-6-6" />
        </svg>
      </div>
    </button>
  );
}

function RoiSlider({ label, value, min, max, step, unit, onChange }: {
  label: string; value: number; min: number; max: number; step: number; unit: string; onChange: (v: number) => void;
}) {
  // UX-Pro: form-labels — wire id/htmlFor and aria-valuetext for accessibility
  const sliderId = `slider-${label.replace(/\s+/g, '-').toLowerCase()}`;
  const valueText = `${value.toLocaleString()}${unit ? ` ${unit}` : ''}`;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label htmlFor={sliderId} className="text-sm font-medium text-[var(--text-primary)]">{label}</label>
        <span className="text-sm font-bold text-[var(--color-primary)]" aria-hidden="true">
          {valueText}
        </span>
      </div>
      <input
        id={sliderId}
        type="range"
        min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        aria-valuetext={valueText}
        className="w-full h-2 rounded-full appearance-none cursor-pointer accent-[var(--color-primary)]"
        style={{ background: `linear-gradient(to right, var(--color-primary) 0%, var(--color-primary) ${((value - min) / (max - min)) * 100}%, var(--color-neutral-200) ${((value - min) / (max - min)) * 100}%, var(--color-neutral-200) 100%)` }}
      />
    </div>
  );
}

// ── Tier 1: Light Results Component ────────────────────────────────────────────

const STAGE_LABELS: Record<string, { en: string; ar: string }> = {
  explorer:     { en: 'Explorer',     ar: 'مستكشف' },
  seeker:       { en: 'Seeker',       ar: 'باحث' },
  practitioner: { en: 'Practitioner', ar: 'ممارس' },
  master:       { en: 'Master',       ar: 'متمكّن' },
};

const CATEGORY_LABELS: Record<string, { en: string; ar: string }> = {
  certification: { en: 'Professional Certification', ar: 'شهادة احترافية' },
  course:        { en: 'Manhajak Program',            ar: 'برنامج منهجك' },
  retreat:       { en: 'Transformational Retreat',    ar: 'ريتريت التحوّل' },
  corporate:     { en: 'Impact Engineering',          ar: 'هندسة الأثر' },
  coaching:      { en: 'Personal Coaching',           ar: 'كوتشينج شخصي' },
  family:        { en: 'Family Coaching',             ar: 'كوتشينج الأسرة' },
  free:          { en: 'Free Intro Program',          ar: 'برنامج تعريفي مجاني' },
};

function LightResultsStep({
  report,
  isAr,
  locale,
  onGetExtended,
}: {
  report: LightReport;
  isAr: boolean;
  locale: string;
  onGetExtended: () => void;
}) {
  const stageLabel = isAr
    ? (STAGE_LABELS[report.journey_stage]?.ar ?? report.journey_stage)
    : (STAGE_LABELS[report.journey_stage]?.en ?? report.journey_stage);

  const [primary, ...alts] = report.top_categories;
  const primaryLabel = isAr
    ? (CATEGORY_LABELS[primary.category]?.ar ?? primary.category)
    : (CATEGORY_LABELS[primary.category]?.en ?? primary.category);

  return (
    <div className="animate-fade-up is-visible space-y-5 w-full max-w-xl" dir={isAr ? 'rtl' : 'ltr'}>

      {/* Header */}
      <div className="text-center">
        <div
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full border-2 mb-3"
          style={{ borderColor: '#E4601E', background: 'rgba(228,96,30,.08)' }}
        >
          <span className="w-2 h-2 rounded-full" style={{ background: '#E4601E' }} />
          <span className="text-sm font-bold" style={{ color: '#E4601E' }}>{stageLabel}</span>
        </div>
        <h2
          className="text-2xl md:text-3xl font-bold text-[var(--text-primary)] leading-tight"
          style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
        >
          {isAr ? 'إليك خارطة طريقك الأولية' : 'Your Initial Roadmap'}
        </h2>
        <p className="text-sm mt-2" style={{ color: '#9B9591' }}>
          {isAr ? 'نتائج فورية — لا تسجيل مطلوب' : 'Instant results — no sign-up required'}
        </p>
      </div>

      {/* Top recommendation card */}
      <div className="rounded-2xl p-5 border-2" style={{ borderColor: '#E4601E', background: 'rgba(228,96,30,.03)' }}>
        <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full" style={{ background: '#E4601E', color: 'white' }}>
              {isAr ? 'الأنسب لك' : 'Best Match'}
            </span>
            <h3 className="text-xl font-bold mt-2" style={{ color: '#1F1B14' }}>{primaryLabel}</h3>
          </div>
          <span className="text-3xl font-black shrink-0" style={{ color: '#474099' }}>{primary.match_pct}%</span>
        </div>

        {/* Key benefits */}
        <ul className="space-y-1.5 mt-3">
          {report.key_benefits.map((b, i) => (
            <li key={i} className="flex items-baseline gap-2 text-sm" style={{ color: '#6B6560' }}>
              <span className="font-bold shrink-0" style={{ color: '#E4601E' }}>✓</span>
              {isAr ? b.ar : b.en}
            </li>
          ))}
        </ul>
      </div>

      {/* Alternative matches */}
      {alts.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#9B9591' }}>
            {isAr ? 'احتمالات أخرى' : 'Other Matches'}
          </p>
          <div className="grid grid-cols-2 gap-3">
            {alts.map((alt) => (
              <div
                key={alt.category}
                className="rounded-xl p-3 border"
                style={{ borderColor: '#E8E3DC', background: 'white' }}
              >
                <div className="flex items-start justify-between gap-1">
                  <p className="text-sm font-semibold" style={{ color: '#1F1B14' }}>
                    {isAr ? (CATEGORY_LABELS[alt.category]?.ar ?? alt.category) : (CATEGORY_LABELS[alt.category]?.en ?? alt.category)}
                  </p>
                  <span className="text-sm font-black shrink-0" style={{ color: '#474099' }}>{alt.match_pct}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Transformation timeline */}
      <div className="rounded-2xl p-5" style={{ background: 'white', border: '1px solid #E8E3DC' }}>
        <h3 className="text-sm font-bold mb-3" style={{ color: '#474099' }}>
          {isAr ? 'خارطة التحوّل' : 'Transformation Timeline'}
        </h3>
        <div className="space-y-3">
          {report.timeline.map((t, i) => (
            <div key={i} className="flex gap-3 items-start">
              <div
                className="shrink-0 mt-0.5 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
                style={{ background: i === 0 ? '#474099' : i === 1 ? '#E4601E' : '#22C55E' }}
              >
                {i + 1}
              </div>
              <div>
                <p className="text-xs font-bold" style={{ color: '#474099' }}>
                  {isAr ? t.period_ar : t.period}
                </p>
                <p className="text-sm" style={{ color: '#6B6560' }}>
                  {isAr ? t.milestone_ar : t.milestone}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tier 2 CTA */}
      <div
        className="rounded-2xl p-6 text-center"
        style={{ background: 'linear-gradient(135deg, #474099 0%, #1D1A3D 100%)' }}
      >
        <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#E4601E' }}>
          {isAr ? 'هل تريد الصورة الكاملة؟' : 'Want the full picture?'}
        </p>
        <h3 className="text-lg font-bold text-white mb-1">
          {isAr ? 'احصل على تقريرك الشامل' : 'Get Your Detailed Report'}
        </h3>
        <p className="text-white/65 text-sm mb-5">
          {isAr
            ? 'تفاصيل البرامج، مسار التعلم الكامل، ونظرة على الاستثمار'
            : 'Program details, full learning pathway, and investment overview'}
        </p>
        <button
          onClick={onGetExtended}
          className="inline-flex items-center justify-center gap-2 rounded-full font-bold px-8 py-3.5 min-h-[44px] transition-all duration-300 hover:scale-105 hover:shadow-[0_8px_24px_rgba(228,96,30,.4)]"
          style={{ background: '#E4601E', color: 'white' }}
        >
          {isAr ? 'احصل على التقرير الشامل' : 'Get My Extended Report'}
          <svg className="w-4 h-4 rtl:rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Secondary CTA: skip to WhatsApp */}
      <p className="text-center text-sm" style={{ color: '#9B9591' }}>
        {isAr ? 'تفضّل تتكلّم مع شخص؟' : 'Prefer to talk to someone?'}{' '}
        <a
          href="https://wa.me/971502587895"
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold underline"
          style={{ color: '#25D366' }}
        >
          {isAr ? 'تواصل عبر واتساب' : 'Chat on WhatsApp'}
        </a>
      </p>
    </div>
  );
}

function InputField({ label, value, onChange, error, placeholder, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; error?: string; placeholder?: string; type?: string;
}) {
  // UX-Pro: form-labels — wire id/htmlFor; aria-invalid + aria-describedby for accessibility
  const fieldId = `field-${type}-${label.replace(/\s+/g, '-').toLowerCase()}`;
  const errorId = error ? `${fieldId}-error` : undefined;

  return (
    <div>
      <label htmlFor={fieldId} className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">{label}</label>
      <input
        id={fieldId}
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        aria-invalid={!!error}
        aria-describedby={errorId}
        autoComplete={type === 'email' ? 'email' : type === 'tel' ? 'tel' : 'name'}
        className={`w-full rounded-xl border-2 px-4 py-3 text-base min-h-[48px] transition-colors outline-none focus:ring-2 focus:ring-offset-0 focus:ring-[var(--color-primary)]/30
          ${error ? 'border-red-400 bg-red-50/50' : 'border-[var(--color-neutral-200)] bg-white focus:border-[var(--color-primary)]'}
        `}
      />
      {/* UX-Pro: error-placement — error below field; aria-live handled at form level */}
      {error && <p id={errorId} role="alert" className="text-sm text-red-500 mt-1">{error}</p>}
    </div>
  );
}
