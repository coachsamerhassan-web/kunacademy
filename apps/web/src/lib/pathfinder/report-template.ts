/**
 * Pathfinder Report HTML Generator
 *
 * Produces a fully self-contained HTML report that works offline.
 * No external dependencies except Google Fonts CDN and Chart.js CDN.
 */

import { generateJourneyMapSvg } from './journey-map-svg';

export interface ReportData {
  name: string;
  locale: 'ar' | 'en';
  type: 'individual' | 'corporate';
  journey_stage: string; // explorer | seeker | practitioner | master
  recommendations: Array<{
    slug: string;
    category: string;
    match_pct: number;
    reasons: string[];
    title_ar?: string;
    title_en?: string;
    price_aed?: number;
  }>;
  roi?: {
    turnover_savings: number;
    productivity_gains: number;
    absenteeism_savings: number;
    total_roi: number;
    investment_cost: number;
    net_return: number;
    roi_multiple: number;
  };
  answers_summary?: string[];
}

// ── Label maps ─────────────────────────────────────────────────────────────────

const STAGE_LABELS: Record<string, { ar: string; en: string }> = {
  explorer:     { ar: 'مستكشف', en: 'Explorer' },
  seeker:       { ar: 'باحث',   en: 'Seeker' },
  practitioner: { ar: 'ممارس',  en: 'Practitioner' },
  master:       { ar: 'متمكّن', en: 'Master' },
};

const STAGE_DESCRIPTIONS: Record<string, { ar: string; en: string }> = {
  explorer: {
    ar: 'أنت في بداية رحلتك — فضولك يقودك نحو اكتشاف ذاتك وفهم إمكاناتك.',
    en: 'You are at the beginning of your journey — curiosity is guiding you toward self-discovery.',
  },
  seeker: {
    ar: 'أنت تبحث بجدية عن مسار واضح — لديك أساس وتريد الانطلاق بثقة.',
    en: 'You are actively searching for a clear path — you have a foundation and are ready to move forward.',
  },
  practitioner: {
    ar: 'أنت ممارس يسعى للتعمّق — خبرتك حقيقية وطموحك أكبر.',
    en: 'You are a practitioner seeking to deepen your practice — your experience is real and your ambition is greater.',
  },
  master: {
    ar: 'أنت متمكّن يبحث عن الأثر الأوسع — وقت التأثير على الآخرين.',
    en: 'You are a master seeking broader impact — it is time to shape others.',
  },
};

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

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmt(num: number): string {
  return num.toLocaleString('en-US');
}

function fmtAed(num: number, isAr: boolean): string {
  return isAr ? `${fmt(num)} درهم` : `AED ${fmt(num)}`;
}

function getLabel(map: Record<string, { ar: string; en: string }>, key: string, isAr: boolean, fallback?: string): string {
  const entry = map[key];
  if (!entry) return fallback ?? key;
  return isAr ? entry.ar : entry.en;
}

// ── CSS ────────────────────────────────────────────────────────────────────────

function buildCss(isAr: boolean): string {
  const fontImport = isAr
    ? `@import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;900&display=swap');`
    : `@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');`;
  const fontFamily = isAr
    ? `'Tajawal', 'Cairo', Arial, sans-serif`
    : `'Inter', -apple-system, Arial, sans-serif`;

  return `
${fontImport}

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --primary: #474099;
  --accent:  #E4601E;
  --bg:      #FFF5E9;
  --surface: #FFFFFF;
  --text:    #1F1B14;
  --muted:   #6B6560;
  --border:  #E8E3DC;
  --radius:  12px;
}

/* UX-Pro: readable-font-size — minimum 16px base to prevent iOS auto-zoom and improve readability */
html { font-size: 16px; }

body {
  font-family: ${fontFamily};
  background: var(--bg);
  color: var(--text);
  direction: ${isAr ? 'rtl' : 'ltr'};
  line-height: 1.65;
  -webkit-font-smoothing: antialiased;
}

/* ── Layout ── */
.page { max-width: 820px; margin: 0 auto; padding: 0 24px 48px; }

/* ── Header ── */
.header {
  background: linear-gradient(135deg, var(--primary) 0%, #1D1A3D 100%);
  padding: 36px 40px 32px;
  color: white;
  position: relative;
  overflow: hidden;
}
.header::before {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at 80% 50%, rgba(228,96,30,.18) 0%, transparent 60%);
}
.header-inner { position: relative; z-index: 1; display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 16px; }
.logo-mark { font-size: 2.8rem; font-weight: 900; color: var(--accent); letter-spacing: -1px; line-height: 1; }
.report-meta { text-align: ${isAr ? 'left' : 'right'}; }
.report-meta .label { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.08em; color: rgba(255,255,255,.6); margin-bottom: 4px; }
.report-meta .date  { font-size: 0.85rem; color: rgba(255,255,255,.9); }
.report-title { margin-top: 20px; }
.report-title h1 { font-size: 1.55rem; font-weight: 700; color: white; margin-bottom: 6px; }
.report-title .subtitle { font-size: 1rem; color: rgba(255,255,255,.75); }

/* ── Sections ── */
.section { background: var(--surface); border-radius: var(--radius); padding: 28px 32px; margin: 20px 0; border: 1px solid var(--border); }
.section-title { font-size: 1.05rem; font-weight: 700; color: var(--primary); margin-bottom: 18px; padding-bottom: 10px; border-bottom: 2px solid var(--border); }

/* ── Summary ── */
.summary-text { font-size: 1rem; color: var(--text); line-height: 1.7; }
.stage-badge {
  display: inline-flex; align-items: center; gap: 8px;
  background: var(--bg); border: 2px solid var(--accent);
  border-radius: 100px; padding: 6px 16px; margin-top: 14px;
}
.stage-badge .dot { width: 10px; height: 10px; border-radius: 50%; background: var(--accent); }
.stage-badge .stage-name { font-size: 0.9rem; font-weight: 700; color: var(--accent); }

/* ── Journey Map ── */
.journey-map-wrap { padding: 8px 0 4px; }

/* ── Recommendations ── */
.rec-primary {
  border: 2px solid var(--accent);
  border-radius: var(--radius);
  padding: 22px 24px;
  margin-bottom: 16px;
  background: linear-gradient(135deg, rgba(228,96,30,.04) 0%, var(--surface) 100%);
  position: relative;
}
.rec-primary::before {
  content: attr(data-badge);
  position: absolute;
  top: -12px;
  ${isAr ? 'right' : 'left'}: 20px;
  background: var(--accent);
  color: white;
  font-size: 0.72rem;
  font-weight: 700;
  padding: 3px 12px;
  border-radius: 100px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.rec-alt {
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 18px 22px;
  margin-bottom: 12px;
  transition: border-color .2s;
}
.rec-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 10px; flex-wrap: wrap; }
.rec-title { font-size: 1.05rem; font-weight: 700; color: var(--text); }
.rec-match { font-size: 1.3rem; font-weight: 900; color: var(--primary); white-space: nowrap; }
.rec-alt .rec-match { font-size: 1.1rem; }
.rec-category { display: inline-block; font-size: 0.73rem; font-weight: 600; color: var(--primary); background: rgba(71,64,153,.1); padding: 3px 10px; border-radius: 100px; margin-bottom: 10px; }
.rec-reasons { list-style: none; padding: 0; margin: 0; }
.rec-reasons li { font-size: 0.88rem; color: var(--muted); padding: 3px 0; display: flex; align-items: baseline; gap: 8px; }
.rec-reasons li::before { content: '✓'; color: var(--accent); font-weight: 700; flex-shrink: 0; }
.rec-price { font-size: 0.83rem; color: var(--muted); margin-top: 10px; }
.rec-alts-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
@media (max-width: 560px) { .rec-alts-grid { grid-template-columns: 1fr; } }

/* ── ROI ── */
.roi-chart-wrap { height: 240px; margin-bottom: 24px; }
.roi-metrics { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; }
@media (max-width: 560px) { .roi-metrics { grid-template-columns: 1fr; } }
.roi-metric { background: var(--bg); border-radius: 10px; padding: 14px 18px; }
.roi-metric .roi-label { font-size: 0.78rem; color: var(--muted); margin-bottom: 4px; }
.roi-metric .roi-value { font-size: 1.25rem; font-weight: 800; color: var(--primary); }
.roi-metric.highlight .roi-value { color: var(--accent); }

/* ── Next Steps ── */
.cta-block { background: linear-gradient(135deg, var(--primary) 0%, #1D1A3D 100%); border-radius: var(--radius); padding: 28px 32px; color: white; text-align: center; }
.cta-block h3 { font-size: 1.2rem; font-weight: 700; margin-bottom: 10px; }
.cta-block p { font-size: 0.95rem; color: rgba(255,255,255,.8); margin-bottom: 20px; }
.cta-link { display: inline-block; background: var(--accent); color: white; text-decoration: none; padding: 12px 28px; border-radius: 100px; font-weight: 700; font-size: 0.95rem; }

/* ── Footer ── */
.footer { text-align: center; padding: 24px 0 8px; color: var(--muted); font-size: 0.82rem; }
.footer strong { color: var(--primary); }

/* ── Print ── */
@media print {
  body { background: white; }
  .page { padding: 0; max-width: 210mm; }
  .header { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .rec-primary { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .cta-block { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .roi-chart-wrap { height: 200px; }
}
`.trim();
}

// ── Main generator ─────────────────────────────────────────────────────────────

export function generateReportHtml(data: ReportData): string {
  const isAr = data.locale === 'ar';
  const today = new Date().toLocaleDateString(isAr ? 'ar-AE' : 'en-GB', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  const stageLabel = getLabel(STAGE_LABELS, data.journey_stage, isAr, data.journey_stage);
  const stageDesc  = getLabel(STAGE_DESCRIPTIONS, data.journey_stage, isAr, '');

  const journeyMapSvg = generateJourneyMapSvg(
    data.journey_stage as 'explorer' | 'seeker' | 'practitioner' | 'master',
    data.locale,
    false // no animation in static HTML — simpler for print
  );

  // Top 3 recommendations
  const [top, ...alts] = data.recommendations.slice(0, 3);

  function renderRec(
    rec: ReportData['recommendations'][0],
    isPrimary: boolean
  ): string {
    const title = isAr ? (rec.title_ar ?? rec.slug) : (rec.title_en ?? rec.slug);
    const catLabel = getLabel(CATEGORY_LABELS, rec.category, isAr, rec.category);
    const reasons = rec.reasons.slice(0, 3).map((r) =>
      getLabel(REASON_LABELS, r, isAr, r)
    );
    const priceStr = rec.price_aed ? fmtAed(rec.price_aed, isAr) : '';
    const badge = isAr ? 'الأنسب لك' : 'Best Match';

    const reasonItems = reasons.map((r) => `<li>${r}</li>`).join('\n');
    const priceHtml = priceStr
      ? `<p class="rec-price">${isAr ? 'الرسوم:' : 'Fee:'} <strong>${priceStr}</strong></p>`
      : '';

    if (isPrimary) {
      return `
      <div class="rec-primary" data-badge="${badge}">
        <div class="rec-header">
          <span class="rec-title">${title}</span>
          <span class="rec-match">${rec.match_pct}%</span>
        </div>
        <span class="rec-category">${catLabel}</span>
        <ul class="rec-reasons">${reasonItems}</ul>
        ${priceHtml}
      </div>`;
    }

    return `
    <div class="rec-alt">
      <div class="rec-header">
        <span class="rec-title">${title}</span>
        <span class="rec-match">${rec.match_pct}%</span>
      </div>
      <span class="rec-category">${catLabel}</span>
      <ul class="rec-reasons">${reasonItems}</ul>
      ${priceHtml}
    </div>`;
  }

  // ROI section (corporate only)
  let roiSection = '';
  if (data.type === 'corporate' && data.roi) {
    const r = data.roi;
    const chartLabels = isAr
      ? ['توفير معدّل الدوران', 'مكاسب الإنتاجية', 'توفير الغياب']
      : ['Turnover Savings', 'Productivity Gains', 'Absenteeism Savings'];
    const chartData = [r.turnover_savings, r.productivity_gains, r.absenteeism_savings];
    const chartColors = ['#474099', '#E4601E', '#C9A96E'];
    const chartId = 'roi-bar-chart';

    const labelsJson = JSON.stringify(chartLabels);
    const dataJson   = JSON.stringify(chartData);
    const colorsJson = JSON.stringify(chartColors);

    roiSection = `
    <section class="section">
      <h2 class="section-title">${isAr ? 'تحليل العائد على الاستثمار' : 'Return on Investment Analysis'}</h2>
      <div class="roi-chart-wrap">
        <canvas id="${chartId}"></canvas>
      </div>
      <div class="roi-metrics">
        <div class="roi-metric">
          <div class="roi-label">${isAr ? 'إجمالي العائد' : 'Total ROI'}</div>
          <div class="roi-value">${fmtAed(r.total_roi, isAr)}</div>
        </div>
        <div class="roi-metric highlight">
          <div class="roi-label">${isAr ? 'صافي العائد' : 'Net Return'}</div>
          <div class="roi-value">${fmtAed(r.net_return, isAr)}</div>
        </div>
        <div class="roi-metric">
          <div class="roi-label">${isAr ? 'تكلفة الاستثمار' : 'Investment Cost'}</div>
          <div class="roi-value">${fmtAed(r.investment_cost, isAr)}</div>
        </div>
        <div class="roi-metric highlight">
          <div class="roi-label">${isAr ? 'مضاعف العائد' : 'ROI Multiple'}</div>
          <div class="roi-value">${r.roi_multiple}×</div>
        </div>
      </div>
    </section>

    <script>
    (function() {
      var ctx = document.getElementById('${chartId}');
      if (!ctx || typeof Chart === 'undefined') return;
      new Chart(ctx, {
        type: 'bar',
        data: {
          labels: ${labelsJson},
          datasets: [{
            label: '${isAr ? 'درهم إماراتي' : 'AED'}',
            data: ${dataJson},
            backgroundColor: ${colorsJson},
            borderRadius: 8,
            borderSkipped: false,
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: function(ctx) {
                  return ' AED ' + ctx.raw.toLocaleString();
                }
              }
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: {
                callback: function(v) { return 'AED ' + (v/1000).toFixed(0) + 'K'; }
              },
              grid: { color: 'rgba(0,0,0,.07)' }
            },
            x: { grid: { display: false } }
          }
        }
      });
    })();
    </script>`;
  }

  const altRecHtml = alts.length > 0
    ? `<div class="rec-alts-grid">${alts.map((r) => renderRec(r, false)).join('\n')}</div>`
    : '';

  const css = buildCss(isAr);

  const ctaText = isAr
    ? { h: 'هل أنت مستعد للخطوة التالية؟', p: 'احجز استشارة مجانية مع فريق أكاديمية كُن', btn: 'احجز الآن' }
    : { h: 'Ready for the next step?', p: 'Book a free consultation with the Kun Academy team', btn: 'Book Now' };

  return `<!DOCTYPE html>
<html lang="${isAr ? 'ar' : 'en'}" dir="${isAr ? 'rtl' : 'ltr'}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${isAr ? `تقرير المُرشد — ${data.name}` : `Pathfinder Report — ${data.name}`}</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js"></script>
  <style>${css}</style>
</head>
<body>
  <!-- HEADER -->
  <header class="header">
    <div class="page">
      <div class="header-inner">
        <div class="logo-mark">كُن</div>
        <div class="report-meta">
          <div class="label">${isAr ? 'تاريخ التقرير' : 'Report Date'}</div>
          <div class="date">${today}</div>
        </div>
      </div>
      <div class="report-title">
        <h1>${isAr ? `تقرير المُرشد — ${data.name}` : `Pathfinder Report — ${data.name}`}</h1>
        <p class="subtitle">${isAr ? 'خارطة طريقك الشخصية نحو النمو' : 'Your personalized growth roadmap'}</p>
      </div>
    </div>
  </header>

  <div class="page">

    <!-- PERSONAL SUMMARY -->
    <section class="section">
      <h2 class="section-title">${isAr ? 'ملخصك الشخصي' : 'Your Personal Summary'}</h2>
      <p class="summary-text">
        ${isAr
          ? `بناءً على ما شاركته، ${data.name}، ${stageDesc}`
          : `Based on what you shared, ${data.name}, ${stageDesc}`}
      </p>
      <div class="stage-badge">
        <span class="dot"></span>
        <span class="stage-name">${stageLabel}</span>
      </div>
    </section>

    <!-- JOURNEY MAP -->
    <section class="section">
      <h2 class="section-title">${isAr ? 'موقعك في خارطة الرحلة' : 'Your Position on the Journey Map'}</h2>
      <div class="journey-map-wrap">
        ${journeyMapSvg}
      </div>
    </section>

    <!-- RECOMMENDATIONS -->
    <section class="section">
      <h2 class="section-title">${isAr ? 'توصياتك المخصصة' : 'Your Personalized Recommendations'}</h2>
      ${top ? renderRec(top, true) : ''}
      ${altRecHtml}
    </section>

    <!-- ROI (corporate) -->
    ${roiSection}

    <!-- NEXT STEPS -->
    <div class="cta-block">
      <h3>${ctaText.h}</h3>
      <p>${ctaText.p}</p>
      <a class="cta-link" href="https://kunacademy.com/coaching/book" target="_blank">${ctaText.btn}</a>
    </div>

  </div>

  <!-- FOOTER -->
  <footer class="footer">
    <p>${isAr
      ? `أُعِدَّ هذا التقرير بواسطة <strong>المُرشد — أكاديمية كُن</strong> | ${today}`
      : `Prepared by <strong>Pathfinder — Kun Academy</strong> | ${today}`}</p>
  </footer>

</body>
</html>`;
}
