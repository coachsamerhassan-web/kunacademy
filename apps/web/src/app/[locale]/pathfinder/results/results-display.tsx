'use client';

import { useCallback } from 'react';
import Link from 'next/link';
import { JourneyMap } from '@/lib/pathfinder/journey-map';
import { RadarChart } from '@/lib/pathfinder/radar-chart';
import { generateReportHtml } from '@/lib/pathfinder/report-template';
import type { RoiResult } from '@/lib/pathfinder-scorer';
import type { CorporateRoiResult } from '@kunacademy/cms';

// ── Program URL Map ────────────────────────────────────────────────────────────
// Maps pathfinder recommendation slugs to their actual page URLs.
// Fallback: /${locale}/programs/${slug} (keeps backward-compat for unknown slugs)

const PROGRAM_URL_MAP: Record<string, string> = {
  'somatic-thinking-intro':    '/academy/intro',
  'stce-level-1-stic':         '/academy/certifications/stce/level-1',
  'stce-level-2-staic':        '/academy/certifications/stce/level-2',
  'stce-level-3-stgc':         '/academy/certifications/stce/level-3',
  'stce-level-4-stoc':         '/academy/certifications/stce/level-4',
  'stce-level-5-stfc':         '/academy/certifications/stce/level-5',
  'stdc-doctors':              '/academy/certifications/doctors',
  'stcm-managers':             '/academy/certifications/managers',
  // Manhajak 3 packages (board decision 2026-04-05)
  'menhajak-training':         '/academy/packages/training',
  'menhajak-organizational':   '/academy/packages/organizational',
  'menhajak-leadership':       '/academy/packages/leadership',
  'mcc-mentoring':             '/academy/certifications/mcc-mentoring',
  'your-identity':             '/academy/courses/your-identity',
  // Impact Engineering (board decision 2026-04-05)
  'impact-engineering':            '/academy/courses/impact-engineering',
  'impact-engineering-foundation': '/academy/courses/impact-engineering',
  'impact-engineering-mastery':    '/academy/courses/impact-engineering',
  // GPS audience segments (board decision 2026-04-05)
  'gps':                       '/academy/certifications/gps',
  'gps-accelerator':           '/academy/certifications/gps',
  'gps-professional':          '/academy/certifications/gps',
  // Corporate / GM Playbook
  'gm-playbook-briefing':      '/programs/corporate/gm-playbook',
  'gm-playbook-foundation':    '/programs/corporate/gm-playbook',
  'gm-playbook-mastery':       '/programs/corporate/gm-playbook',
  // Mini-courses (board decision 2026-04-05 — 10 mini-courses)
  'mini-course-communication': '/academy/mini-courses/communication',
  'mini-course-confidence':    '/academy/mini-courses/confidence',
  'mini-course-leadership':    '/academy/mini-courses/leadership',
  'mini-course-listening':     '/academy/mini-courses/listening',
  'mini-course-presence':      '/academy/mini-courses/presence',
  'mini-course-resilience':    '/academy/mini-courses/resilience',
  'mini-course-self-awareness':'/academy/mini-courses/self-awareness',
  'mini-course-goals':         '/academy/mini-courses/goals',
  'mini-course-emotion':       '/academy/mini-courses/emotion',
  'mini-course-team':          '/academy/mini-courses/team',
};

function getProgramUrl(locale: string, slug: string): string {
  return `/${locale}${PROGRAM_URL_MAP[slug] ?? `/programs/${slug}`}`;
}

// ── Types ──────────────────────────────────────────────────────────────────────

interface Recommendation {
  slug: string;
  category: string;
  match_pct: number;
  reasons: string[];
  title_ar?: string;
  title_en?: string;
  price_aed?: number;
}

interface SelfAssessmentEntry {
  benefit_id: string;
  current: number;
  target_3m: number;
  target_6m: number;
}

interface Props {
  name: string;
  locale: 'ar' | 'en';
  type: 'individual' | 'corporate';
  journeyStage: string;
  recommendations: Recommendation[];
  roi: RoiResult | null;
  // Corporate-specific props
  corporateRoi?: CorporateRoiResult | null;
  proposalPdfUrl?: string | null;
  direction?: string | null;
  selectedBenefits?: Array<{ id: string; label_ar: string; label_en: string }> | null;
  selfAssessment?: SelfAssessmentEntry[] | null;
}

// ── Label helpers ──────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, { ar: string; en: string }> = {
  certification: { ar: 'شهادة احترافية', en: 'Professional Certification' },
  course:        { ar: 'دورة تدريبية',   en: 'Training Course' },
  retreat:       { ar: 'ريتريت تحوّلي',  en: 'Transformational Retreat' },
  corporate:     { ar: 'للمؤسسات',       en: 'Corporate' },
  family:        { ar: 'للأسرة',         en: 'Family' },
  coaching:      { ar: 'جلسات كوتشينج',  en: 'Coaching Sessions' },
  free:          { ar: 'مجاني',          en: 'Free' },
};

const REASON_LABELS: Record<string, { ar: string; en: string }> = {
  general_interest:    { ar: 'اهتمام عام بالتطوير', en: 'General development interest' },
  certification:       { ar: 'مناسب لمسار الشهادات', en: 'Fits your certification path' },
  course:              { ar: 'يتوافق مع احتياجاتك التدريبية', en: 'Matches your training needs' },
  corporate:           { ar: 'مصمم للبيئة المؤسسية', en: 'Designed for corporate environment' },
  retreat:             { ar: 'يدعم تحوّلك الشخصي', en: 'Supports your personal transformation' },
  family:              { ar: 'يساعد في تطوير الأسرة', en: 'Supports family development' },
  free:                { ar: 'نقطة انطلاق مثالية', en: 'Perfect starting point' },
};

const STAGE_LABELS: Record<string, { ar: string; en: string }> = {
  explorer:     { ar: 'مستكشف', en: 'Explorer' },
  seeker:       { ar: 'باحث',   en: 'Seeker' },
  practitioner: { ar: 'ممارس',  en: 'Practitioner' },
  master:       { ar: 'متمكّن', en: 'Master' },
};

function getCat(cat: string, isAr: boolean) {
  return isAr ? (CATEGORY_LABELS[cat]?.ar ?? cat) : (CATEGORY_LABELS[cat]?.en ?? cat);
}

function getReason(r: string, isAr: boolean) {
  return isAr ? (REASON_LABELS[r]?.ar ?? r) : (REASON_LABELS[r]?.en ?? r);
}

function fmtAed(n: number) {
  return `AED ${n.toLocaleString('en-US')}`;
}

// ── Component ──────────────────────────────────────────────────────────────────

export function ResultsDisplay({ name, locale, type, journeyStage, recommendations, roi, corporateRoi, proposalPdfUrl, direction: _direction, selectedBenefits, selfAssessment }: Props) {
  const isAr = locale === 'ar';

  const stageLabel = isAr
    ? (STAGE_LABELS[journeyStage]?.ar ?? journeyStage)
    : (STAGE_LABELS[journeyStage]?.en ?? journeyStage);

  const [primary, ...alternatives] = recommendations.slice(0, 3);

  // ── Download handler ──────────────────────────────────────────────────────

  const handleDownload = useCallback(() => {
    const html = generateReportHtml({
      name,
      locale,
      type,
      journey_stage: journeyStage,
      recommendations,
      roi: roi ?? undefined,
    });
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = 'kun-pathfinder-report.html';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, [name, locale, type, journeyStage, recommendations, roi]);

  // ── WhatsApp share ────────────────────────────────────────────────────────

  const whatsappText = isAr
    ? `أكملت تقييم المُرشد في أكاديمية كُن وحصلت على خارطة طريقي للنمو! 🌱\nاكتشف مسارك: https://kunacademy.com/pathfinder`
    : `I just completed the Kun Academy Pathfinder assessment and got my personalized growth roadmap! 🌱\nDiscover yours: https://kunacademy.com/pathfinder`;
  const waUrl = `https://wa.me/?text=${encodeURIComponent(whatsappText)}`;

  return (
    <main
      dir={isAr ? 'rtl' : 'ltr'}
      lang={isAr ? 'ar' : 'en'}
      className="min-h-screen"
      style={{ background: 'var(--color-cosmic-latte, #FFF5E9)' }}
    >
      {/* Hero header */}
      <section
        className="relative overflow-hidden py-16 md:py-20"
        style={{ background: 'linear-gradient(135deg, var(--color-primary, #474099) 0%, #1D1A3D 100%)' }}
      >
        <div className="relative z-10 mx-auto max-w-3xl px-4 text-center animate-fade-up">
          <p className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: '#E4601E' }}>
            {isAr ? 'تقريرك الشامل' : 'Your Extended Report'}
          </p>
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">
            {isAr ? `أهلاً ${name}،` : `Welcome, ${name},`}
          </h1>
          <p className="text-white/75 text-base">
            {isAr
              ? 'إليك خارطة طريقك الشخصية الكاملة نحو النمو'
              : 'Here is your complete personalized growth roadmap'}
          </p>
          {/* Stage badge */}
          <div className="inline-flex items-center gap-2 mt-5 px-4 py-2 rounded-full border-2" style={{ borderColor: '#E4601E', background: 'rgba(228,96,30,.12)' }}>
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: '#E4601E' }} />
            <span className="text-sm font-bold" style={{ color: '#E4601E' }}>{stageLabel}</span>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-3xl px-4 py-8 space-y-6">

        {/* Journey Map */}
        <Card title={isAr ? 'موقعك في خارطة الرحلة' : 'Your Position on the Journey Map'}>
          <JourneyMap
            currentStage={journeyStage}
            locale={locale}
            animated
            className="py-4"
          />
        </Card>

        {/* Primary recommendation */}
        {primary && (
          <Card title={isAr ? 'توصيتك الأولى' : 'Your Top Recommendation'}>
            <PrimaryRec rec={primary} isAr={isAr} locale={locale} />
          </Card>
        )}

        {/* Alternative recommendations */}
        {alternatives.length > 0 && (
          <Card title={isAr ? 'توصيات إضافية' : 'Alternative Recommendations'}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {alternatives.map((rec) => (
                <AltRec key={rec.slug} rec={rec} isAr={isAr} locale={locale} />
              ))}
            </div>
          </Card>
        )}

        {/* ROI card (corporate only — legacy individual roi_inputs) */}
        {type === 'corporate' && roi && (
          <Card title={isAr ? 'العائد على الاستثمار' : 'Return on Investment'}>
            <RoiCard roi={roi} isAr={isAr} />
          </Card>
        )}

        {/* ── Corporate savings overview (new benefits-based flow) ───────────── */}
        {type === 'corporate' && corporateRoi && (
          <>
            {/* Total savings + per-benefit breakdown */}
            <Card title={isAr ? 'توفيرات متوقعة لفريقك' : 'Projected Savings for Your Team'}>
              <CorporateSavingsCard corporateRoi={corporateRoi} isAr={isAr} />
            </Card>

            {/* Full program vs per-leader financial comparison */}
            <Card title={isAr ? 'مقارنة خيارات الاستثمار' : 'Investment Options Comparison'}>
              <CorporateFinancialCard corporateRoi={corporateRoi} isAr={isAr} />
            </Card>

            {/* Self-assessment radar chart — shows if we have the data */}
            {selfAssessment && selfAssessment.length > 0 && selectedBenefits && selectedBenefits.length > 0 && (
              <Card title={isAr ? 'خارطة التطوير الذاتي' : 'Self-Assessment Growth Map'}>
                <CorporateRadarCard
                  selfAssessment={selfAssessment}
                  selectedBenefits={selectedBenefits}
                  locale={locale}
                />
              </Card>
            )}
          </>
        )}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          {/* Proposal download (corporate with PDF) — primary CTA */}
          {type === 'corporate' && proposalPdfUrl ? (
            <>
              <a
                href={proposalPdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-2 rounded-full font-semibold py-3.5 px-6 transition-opacity hover:opacity-90 active:opacity-75 min-h-[44px]"
                style={{ background: 'var(--color-primary, #474099)', color: 'white' }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                {isAr ? 'تحميل عرضك المخصص' : 'Download Your Proposal'}
              </a>
              {/* Secondary: HTML report download */}
              <button
                onClick={handleDownload}
                className="flex items-center justify-center gap-2 rounded-full font-semibold py-3.5 px-5 transition-opacity hover:opacity-90 active:opacity-75 min-h-[44px] border-2"
                style={{ borderColor: '#474099', color: '#474099', background: 'transparent' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                {isAr ? 'تقرير HTML' : 'HTML Report'}
              </button>
            </>
          ) : (
            /* Standard download for individual / corporate without PDF */
            <button
              onClick={handleDownload}
              className="flex-1 flex items-center justify-center gap-2 rounded-full font-semibold py-3.5 px-6 transition-opacity hover:opacity-90 active:opacity-75 min-h-[44px]"
              style={{ background: 'var(--color-primary, #474099)', color: 'white' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              {isAr ? 'تحميل التقرير' : 'Download Report'}
            </button>
          )}

          {/* WhatsApp */}
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-2 rounded-full font-semibold py-3.5 px-6 transition-opacity hover:opacity-90 min-h-[44px]"
            style={{ background: '#25D366', color: 'white' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
              <path d="M12 0C5.373 0 0 5.373 0 12c0 2.125.557 4.122 1.528 5.856L0 24l6.335-1.506A11.956 11.956 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.924 0-3.721-.5-5.28-1.376l-.38-.226-3.759.894.942-3.657-.247-.393A9.954 9.954 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z" />
            </svg>
            {isAr ? 'مشاركة عبر واتساب' : 'Share via WhatsApp'}
          </a>
        </div>

        {/* CTA */}
        <div
          className="rounded-2xl p-8 text-center text-white"
          style={{ background: 'linear-gradient(135deg, #474099 0%, #1D1A3D 100%)' }}
        >
          <h2 className="text-xl font-bold mb-2">
            {isAr ? 'هل أنت مستعد للخطوة التالية؟' : 'Ready for the next step?'}
          </h2>
          <p className="text-white/75 mb-5 text-sm">
            {isAr
              ? 'احجز استشارة مجانية مع فريق أكاديمية كُن وابدأ رحلتك'
              : 'Book a free consultation with the Kun Academy team and start your journey'}
          </p>
          {/* UX-Pro: touch-target-size — inline-flex for proper centering at 44px */}
          <Link
            href={`/${locale}/coaching/book?service=free-consultation`}
            className="inline-flex items-center justify-center rounded-full font-bold px-8 py-3.5 transition-opacity hover:opacity-90 min-h-[44px]"
            style={{ background: '#E4601E', color: 'white' }}
          >
            {isAr ? 'احجز مجاناً' : 'Book Free Consultation'}
          </Link>
        </div>

      </div>
    </main>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl p-6 md:p-7 border" style={{ background: 'white', borderColor: '#E8E3DC' }}>
      <h2 className="text-base font-bold mb-4 pb-3 border-b" style={{ color: '#474099', borderColor: '#E8E3DC' }}>
        {title}
      </h2>
      {children}
    </div>
  );
}

function PrimaryRec({ rec, isAr, locale }: { rec: Recommendation; isAr: boolean; locale: string }) {
  const title     = isAr ? (rec.title_ar ?? rec.slug) : (rec.title_en ?? rec.slug);
  const catLabel  = getCat(rec.category, isAr);
  const reasons   = rec.reasons.slice(0, 3).map((r) => getReason(r, isAr));
  const programUrl = getProgramUrl(locale, rec.slug);

  return (
    <div className="rounded-xl p-5 border-2" style={{ borderColor: '#E4601E', background: 'rgba(228,96,30,.03)' }}>
      {/* Badge */}
      <div className="inline-block text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full mb-3" style={{ background: '#E4601E', color: 'white' }}>
        {isAr ? 'الأنسب لك' : 'Best Match'}
      </div>
      <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
        <h3 className="font-bold text-lg" style={{ color: '#1F1B14' }}>{title}</h3>
        <span className="font-black text-2xl shrink-0" style={{ color: '#474099' }}>{rec.match_pct}%</span>
      </div>
      <span className="inline-block text-xs font-semibold px-3 py-1 rounded-full mb-3" style={{ background: 'rgba(71,64,153,.1)', color: '#474099' }}>
        {catLabel}
      </span>
      <ul className="space-y-1.5 mb-3">
        {reasons.map((r, i) => (
          <li key={i} className="flex items-baseline gap-2 text-sm" style={{ color: '#6B6560' }}>
            <span className="font-bold shrink-0" style={{ color: '#E4601E' }}>✓</span>
            {r}
          </li>
        ))}
      </ul>
      {rec.price_aed && (
        <p className="text-sm" style={{ color: '#6B6560' }}>
          {isAr ? 'الرسوم:' : 'Fee:'} <strong>{fmtAed(rec.price_aed)}</strong>
        </p>
      )}
      {/* UX-Pro: touch-target-size — inline-flex for correct 44px centering */}
      <Link
        href={programUrl}
        className="inline-flex items-center justify-center mt-4 text-sm font-semibold rounded-full px-5 py-2.5 min-h-[44px] transition-opacity hover:opacity-80"
        style={{ background: '#474099', color: 'white' }}
      >
        {isAr ? 'اعرف أكثر' : 'Learn More'}
      </Link>
    </div>
  );
}

function AltRec({ rec, isAr, locale }: { rec: Recommendation; isAr: boolean; locale: string }) {
  const title    = isAr ? (rec.title_ar ?? rec.slug) : (rec.title_en ?? rec.slug);
  const catLabel = getCat(rec.category, isAr);
  const reasons  = rec.reasons.slice(0, 2).map((r) => getReason(r, isAr));
  const programUrl = getProgramUrl(locale, rec.slug);

  return (
    <div className="rounded-xl p-4 border flex flex-col" style={{ borderColor: '#E8E3DC', background: 'white' }}>
      <div className="flex items-start justify-between gap-2 mb-1.5 flex-wrap">
        <h3 className="font-bold text-base" style={{ color: '#1F1B14' }}>{title}</h3>
        <span className="font-black text-lg shrink-0" style={{ color: '#474099' }}>{rec.match_pct}%</span>
      </div>
      <span className="inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full mb-2 self-start" style={{ background: 'rgba(71,64,153,.1)', color: '#474099' }}>
        {catLabel}
      </span>
      <ul className="space-y-1 mb-3 flex-1">
        {reasons.map((r, i) => (
          <li key={i} className="flex items-baseline gap-2 text-xs" style={{ color: '#6B6560' }}>
            <span className="font-bold shrink-0" style={{ color: '#E4601E' }}>✓</span>
            {r}
          </li>
        ))}
      </ul>
      <Link
        href={programUrl}
        className="text-xs font-semibold text-center rounded-full px-4 py-2.5 transition-opacity hover:opacity-80 mt-auto"
        style={{ background: 'rgba(71,64,153,.1)', color: '#474099', minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        {isAr ? 'اعرف أكثر' : 'Learn More'}
      </Link>
    </div>
  );
}

// ── Corporate sub-components ───────────────────────────────────────────────────

function CorporateSavingsCard({ corporateRoi, isAr }: { corporateRoi: CorporateRoiResult; isAr: boolean }) {
  return (
    <div className="space-y-4">
      {/* Total savings hero number */}
      <div
        className="rounded-xl p-5 text-center"
        style={{ background: 'linear-gradient(135deg, #474099 0%, #1D1A3D 100%)' }}
      >
        <p className="text-sm text-white/70 mb-1">
          {isAr ? 'إجمالي التوفير السنوي المتوقع' : 'Total Projected Annual Savings'}
        </p>
        <p className="text-3xl font-black text-white">
          {fmtAed(corporateRoi.total_annual_savings)}
        </p>
      </div>

      {/* Per-benefit breakdown grid */}
      {corporateRoi.per_benefit_savings.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {corporateRoi.per_benefit_savings.map((b) => (
            <div
              key={b.benefit_id}
              className="rounded-xl p-4 border"
              style={{ borderColor: '#E8E3DC', background: '#FFF5E9' }}
            >
              <p className="text-sm font-semibold mb-1" style={{ color: '#1F1B14' }}>
                {isAr ? b.label_ar : b.label_en}
              </p>
              <p className="text-lg font-black" style={{ color: '#E4601E' }}>
                {fmtAed(b.annual_savings)}
              </p>
              <p className="text-xs mt-0.5" style={{ color: '#6B6560' }}>
                {isAr
                  ? `تحسين ${b.improvement_pct}%`
                  : `${b.improvement_pct}% improvement`}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CorporateFinancialCard({ corporateRoi, isAr }: { corporateRoi: CorporateRoiResult; isAr: boolean }) {
  // Highlight the better ROI option
  const fullIsBetter = corporateRoi.full_program_roi_multiple >= corporateRoi.per_leader_roi_multiple;

  const columns = [
    {
      key: 'full',
      label: isAr ? 'البرنامج الكامل' : 'Full Program',
      cost: corporateRoi.full_program_cost,
      roi: corporateRoi.full_program_roi_multiple,
      net: corporateRoi.net_return_full,
      isBest: fullIsBetter,
    },
    {
      key: 'per-leader',
      label: isAr ? 'حزمة كل قائد' : 'Per-Leader Package',
      cost: corporateRoi.per_leader_cost,
      roi: corporateRoi.per_leader_roi_multiple,
      net: corporateRoi.net_return_per_leader,
      isBest: !fullIsBetter,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {columns.map((col) => (
        <div
          key={col.key}
          className="rounded-xl p-5 border-2 relative"
          style={{
            borderColor: col.isBest ? '#E4601E' : '#E8E3DC',
            background: col.isBest ? 'rgba(228,96,30,.04)' : 'white',
          }}
        >
          {col.isBest && (
            <div
              className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-bold px-3 py-1 rounded-full"
              style={{ background: '#E4601E', color: 'white' }}
            >
              {isAr ? 'الأعلى عائداً' : 'Best ROI'}
            </div>
          )}
          <p className="font-bold text-base mb-3 text-center" style={{ color: '#1F1B14' }}>
            {col.label}
          </p>
          <div className="space-y-2">
            <div className="flex justify-between items-center text-sm">
              <span style={{ color: '#6B6560' }}>{isAr ? 'التكلفة' : 'Cost'}</span>
              <span className="font-bold" style={{ color: '#474099' }}>{fmtAed(col.cost)}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span style={{ color: '#6B6560' }}>{isAr ? 'مضاعف العائد' : 'ROI Multiple'}</span>
              <span className="font-black text-base" style={{ color: '#E4601E' }}>{col.roi}×</span>
            </div>
            <div className="flex justify-between items-center text-sm border-t pt-2" style={{ borderColor: '#E8E3DC' }}>
              <span style={{ color: '#6B6560' }}>{isAr ? 'صافي العائد' : 'Net Return'}</span>
              <span className="font-bold" style={{ color: col.net >= 0 ? '#474099' : '#dc2626' }}>
                {fmtAed(col.net)}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function CorporateRadarCard({
  selfAssessment,
  selectedBenefits,
  locale,
}: {
  selfAssessment: SelfAssessmentEntry[];
  selectedBenefits: Array<{ id: string; label_ar: string; label_en: string }>;
  locale: 'ar' | 'en';
}) {
  const isAr = locale === 'ar';

  // Map self-assessment entries to RadarChart format, joining with benefit labels
  const benefitLabelMap = new Map(selectedBenefits.map((b) => [b.id, isAr ? b.label_ar : b.label_en]));

  const radarBenefits = selfAssessment
    .filter((entry) => benefitLabelMap.has(entry.benefit_id))
    .map((entry) => ({
      label: benefitLabelMap.get(entry.benefit_id) ?? entry.benefit_id,
      current: entry.current,
      target_3m: entry.target_3m,
      target_6m: entry.target_6m,
    }));

  if (radarBenefits.length === 0) return null;

  return (
    <div>
      <p className="text-xs mb-3" style={{ color: '#6B6560' }}>
        {isAr
          ? 'تقييمك الذاتي للحالة الراهنة مقابل الأهداف المستقبلية'
          : 'Your self-assessment: current state vs. future targets'}
      </p>
      <RadarChart benefits={radarBenefits} locale={locale} height={300} />
    </div>
  );
}

function RoiCard({ roi, isAr }: { roi: RoiResult; isAr: boolean }) {
  const metrics = [
    { label: isAr ? 'إجمالي العائد'  : 'Total ROI',       value: fmtAed(roi.total_roi),       highlight: false },
    { label: isAr ? 'صافي العائد'    : 'Net Return',      value: fmtAed(roi.net_return),      highlight: true  },
    { label: isAr ? 'تكلفة الاستثمار': 'Investment Cost', value: fmtAed(roi.investment_cost), highlight: false },
    { label: isAr ? 'مضاعف العائد'   : 'ROI Multiple',    value: `${roi.roi_multiple}×`,      highlight: true  },
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {metrics.map((m) => (
        <div key={m.label} className="rounded-xl p-4" style={{ background: '#FFF5E9' }}>
          <p className="text-xs mb-1" style={{ color: '#6B6560' }}>{m.label}</p>
          <p className="text-xl font-black" style={{ color: m.highlight ? '#E4601E' : '#474099' }}>{m.value}</p>
        </div>
      ))}
    </div>
  );
}
