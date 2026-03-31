/**
 * Journey Map SVG — pure string generator (no React dependency).
 * Safe to import from both server and client contexts.
 */

export type JourneyStage = 'explorer' | 'seeker' | 'practitioner' | 'master';

const STAGES: { id: JourneyStage; labelEn: string; labelAr: string }[] = [
  { id: 'explorer',     labelEn: 'Explorer',     labelAr: 'مستكشف' },
  { id: 'seeker',       labelEn: 'Seeker',       labelAr: 'باحث' },
  { id: 'practitioner', labelEn: 'Practitioner', labelAr: 'ممارس' },
  { id: 'master',       labelEn: 'Master',       labelAr: 'متمكّن' },
];

const PRIMARY = '#474099';
const ACCENT  = '#E4601E';
const GRAY    = '#C9C5C0';
const TEXT    = '#1F1B14';

/**
 * Returns a self-contained SVG string for the journey map.
 *
 * @param currentStage - The user's current journey stage
 * @param locale       - 'ar' | 'en'
 * @param animated     - Whether to include CSS pulse animation (default true)
 */
export function generateJourneyMapSvg(
  currentStage: JourneyStage | string,
  locale: 'ar' | 'en' = 'ar',
  animated = true
): string {
  const isAr  = locale === 'ar';
  const count = STAGES.length;
  const svgW  = 560;
  const svgH  = 110;
  const cy    = 46;
  const r     = 18;
  const rPulse = 26;

  const pad  = 60;
  const step = (svgW - pad * 2) / (count - 1);
  const xs   = STAGES.map((_, i) => pad + i * step);

  const displayOrder = isAr ? [...STAGES].reverse() : STAGES;
  const displayXs    = isAr ? [...xs].reverse() : xs;

  const gradientId = 'jm-line-grad';

  const activeIdx = displayOrder.findIndex((s) => s.id === currentStage);
  const lineX1    = displayXs[0];
  const lineX2    = displayXs[count - 1];
  const filledPct = activeIdx >= 0 ? (activeIdx / (count - 1)) * 100 : 0;

  const defs = `
  <defs>
    <linearGradient id="${gradientId}" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%"          stop-color="${PRIMARY}" />
      <stop offset="${filledPct}%" stop-color="${PRIMARY}" />
      <stop offset="${filledPct}%" stop-color="${GRAY}" />
      <stop offset="100%"        stop-color="${GRAY}" />
    </linearGradient>
    ${animated ? `
    <style>
      @keyframes jm-pulse-anim {
        0%   { r: ${rPulse};     opacity: 0.5; }
        70%  { r: ${rPulse + 8}; opacity: 0; }
        100% { r: ${rPulse + 8}; opacity: 0; }
      }
      .jm-pulse { animation: jm-pulse-anim 2s ease-out infinite; }
    </style>` : ''}
  </defs>`;

  const line = `<line x1="${lineX1}" y1="${cy}" x2="${lineX2}" y2="${cy}" stroke="url(#${gradientId})" stroke-width="3" stroke-linecap="round" />`;

  const milestones = displayOrder.map((stage, i) => {
    const x = displayXs[i];
    const isActive       = stage.id === currentStage;
    const stageIdx       = STAGES.findIndex((s) => s.id === stage.id);
    const activeStageIdx = STAGES.findIndex((s) => s.id === currentStage);
    const isPast         = stageIdx < activeStageIdx;
    const isFuture       = stageIdx > activeStageIdx;

    const fill        = isActive ? ACCENT : isPast ? PRIMARY : 'none';
    const stroke      = isFuture ? GRAY : isActive ? ACCENT : PRIMARY;
    const strokeWidth = isFuture ? '2' : '2.5';
    const textColor   = isFuture ? GRAY : TEXT;
    const label       = isAr ? stage.labelAr : stage.labelEn;
    const fontFamily  = isAr
      ? "'Tajawal', 'Cairo', 'Arial', sans-serif"
      : "'Inter', 'Arial', sans-serif";
    const fontSize    = isAr ? 13 : 11;
    const labelY      = cy + r + 22;

    return `
    ${isActive && animated ? `<circle class="jm-pulse" cx="${x}" cy="${cy}" r="${rPulse}" fill="${ACCENT}" fill-opacity="0.18" stroke="none" />` : ''}
    <circle cx="${x}" cy="${cy}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />
    ${isActive ? `<circle cx="${x}" cy="${cy}" r="7" fill="white" />` : ''}
    ${isPast ? `
    <polyline points="${x - 6},${cy} ${x - 1},${cy + 5} ${x + 7},${cy - 5}"
      fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />` : ''}
    <text x="${x}" y="${labelY}" text-anchor="middle" font-family="${fontFamily}"
      font-size="${fontSize}" fill="${textColor}" font-weight="${isActive ? '700' : '500'}">${label}</text>`;
  }).join('\n');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgW} ${svgH}" width="100%" style="max-width:560px;display:block;margin:0 auto;direction:ltr" role="img" aria-label="Journey stage map">
  ${defs}
  ${line}
  ${milestones}
</svg>`;
}
