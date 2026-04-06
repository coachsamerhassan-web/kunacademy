/**
 * Pathfinder Corporate Proposal PDF Generator
 *
 * Produces an A4 portrait PDF using jsPDF.
 * Pages:
 *   1. Cover — gradient header, recipient, date
 *   2. Radar Chart — self-assessment overview
 *   3. Benefits Table — per-benefit metrics + citations
 *   4. Financial Summary — Full Program vs Per-Leader ROI
 *   5. Testimonial (optional) — quote + attribution
 *   6. Next Steps — booking CTA
 *
 * Arabic support via embedded Tajawal Regular Base64 font.
 */

import { jsPDF } from 'jspdf';
import { TAJAWAL_REGULAR_BASE64 } from './fonts/tajawal-regular';

// ── Types ────────────────────────────────────────────────────────────────────

export interface ProposalBenefit {
  label_ar: string;
  label_en: string;
  annual_savings: number;
  improvement_pct: number;
  citation_ar: string;
  citation_en: string;
}

export interface ProposalAssessment {
  benefit_id: string;
  current: number;
  target_3m: number;
  target_6m: number;
}

export interface ProposalTestimonial {
  text_ar?: string;
  text_en?: string;
  author?: string;
}

export interface ProposalData {
  name: string;
  email: string;
  jobTitle: string;
  direction: string;         // direction label (English)
  directionAr: string;       // direction label (Arabic)
  selectedBenefits: ProposalBenefit[];
  selfAssessment: ProposalAssessment[];
  totalAnnualSavings: number;
  fullProgramCost: number;
  perLeaderCost: number;
  fullProgramRoiMultiple: number;
  perLeaderRoiMultiple: number;
  radarSvg: string;          // SVG string from radar-chart-svg.ts
  testimonial?: ProposalTestimonial;
  locale: 'ar' | 'en';
}

// ── Brand constants ──────────────────────────────────────────────────────────

const COLORS = {
  primary:    [71, 64, 153]  as [number, number, number],   // #474099
  accent:     [228, 96, 30]  as [number, number, number],   // #E4601E
  cream:      [255, 245, 233] as [number, number, number],  // #FFF5E9
  darkPurple: [29, 26, 61]   as [number, number, number],   // #1D1A3D
  white:      [255, 255, 255] as [number, number, number],
  text:       [31, 27, 20]   as [number, number, number],   // #1F1B14
  muted:      [107, 101, 96] as [number, number, number],   // #6B6560
  border:     [232, 227, 220] as [number, number, number],  // #E8E3DC
  rowAlt:     [248, 245, 240] as [number, number, number],  // light cream row
  green:      [34, 197, 94]  as [number, number, number],   // #22C55E
};

// A4 portrait dimensions in mm
const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 18;
const CONTENT_W = PAGE_W - MARGIN * 2;

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return n.toLocaleString('en-US');
}

function fmtAed(n: number, isAr: boolean): string {
  return isAr ? `${fmt(n)} درهم` : `AED ${fmt(n)}`;
}

function today(isAr: boolean): string {
  return new Date().toLocaleDateString(isAr ? 'ar-AE' : 'en-GB', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
}

/** Set fill + draw colour in one call. */
function setColor(
  doc: jsPDF,
  rgb: [number, number, number],
  mode: 'fill' | 'draw' | 'both' = 'both'
): void {
  if (mode === 'fill' || mode === 'both') doc.setFillColor(rgb[0], rgb[1], rgb[2]);
  if (mode === 'draw' || mode === 'both') doc.setDrawColor(rgb[0], rgb[1], rgb[2]);
}

/** Draw a filled rounded rectangle (jsPDF uses 'roundedRect'). */
function filledRoundRect(
  doc: jsPDF,
  x: number, y: number, w: number, h: number,
  r: number,
  fillRgb: [number, number, number]
): void {
  setColor(doc, fillRgb, 'fill');
  doc.roundedRect(x, y, w, h, r, r, 'F');
}

/**
 * Wrap and draw text, returning the new Y position after the last line.
 * Handles basic line-length wrapping for left/right/center alignment.
 */
function drawWrappedText(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  align: 'left' | 'right' | 'center' = 'left'
): number {
  const lines = doc.splitTextToSize(text, maxWidth) as string[];
  lines.forEach((line: string, i: number) => {
    const ly = y + i * lineHeight;
    if (align === 'center') {
      doc.text(line, x + maxWidth / 2, ly, { align: 'center' });
    } else if (align === 'right') {
      doc.text(line, x + maxWidth, ly, { align: 'right' });
    } else {
      doc.text(line, x, ly);
    }
  });
  return y + lines.length * lineHeight;
}

/**
 * Convert an SVG string to a base64 data URL suitable for doc.addImage().
 */
function svgToDataUrl(svg: string): string {
  // Buffer / btoa safe in Node.js (Next.js server context)
  const b64 = Buffer.from(svg).toString('base64');
  return `data:image/svg+xml;base64,${b64}`;
}

// ── Font setup ────────────────────────────────────────────────────────────────

function registerFont(doc: jsPDF): void {
  doc.addFileToVFS('Tajawal-Regular.ttf', TAJAWAL_REGULAR_BASE64);
  doc.addFont('Tajawal-Regular.ttf', 'Tajawal', 'normal');
}

function useArabic(doc: jsPDF): void {
  doc.setFont('Tajawal', 'normal');
}

function useLatin(doc: jsPDF): void {
  doc.setFont('helvetica', 'normal');
}

function useBoldLatin(doc: jsPDF): void {
  doc.setFont('helvetica', 'bold');
}

// ── Page: Cover ───────────────────────────────────────────────────────────────

function drawCoverPage(doc: jsPDF, data: ProposalData): void {
  const isAr = data.locale === 'ar';

  // -- Gradient-style header (two-rect approximation) --
  setColor(doc, COLORS.darkPurple, 'fill');
  doc.rect(0, 0, PAGE_W, 90, 'F');
  setColor(doc, COLORS.primary, 'fill');
  doc.rect(0, 60, PAGE_W, 30, 'F');

  // Subtle accent bar on left/right edge
  setColor(doc, COLORS.accent, 'fill');
  doc.rect(isAr ? PAGE_W - 5 : 0, 0, 5, 90, 'F');

  // Academy name (bilingual)
  doc.setTextColor(255, 255, 255);
  useArabic(doc);
  doc.setFontSize(14);
  doc.text('أكاديمية كُن للكوتشينج', PAGE_W / 2, 28, { align: 'center' });

  useLatin(doc);
  doc.setFontSize(10);
  doc.setTextColor(200, 195, 255);
  doc.text('Kun Coaching Academy', PAGE_W / 2, 36, { align: 'center' });

  // Divider
  setColor(doc, [255, 255, 255], 'draw');
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.3);
  doc.setGState(doc.GState({ opacity: 0.3 }));
  doc.line(MARGIN + 20, 42, PAGE_W - MARGIN - 20, 42);
  doc.setGState(doc.GState({ opacity: 1 }));

  // Main title
  doc.setTextColor(255, 255, 255);
  useBoldLatin(doc);
  doc.setFontSize(18);
  doc.text('Corporate Development Proposal', PAGE_W / 2, 55, { align: 'center' });

  useArabic(doc);
  doc.setFontSize(13);
  doc.setTextColor(220, 215, 255);
  doc.text('عرض التطوير المؤسسي', PAGE_W / 2, 64, { align: 'center' });

  // Cream background below header
  setColor(doc, COLORS.cream, 'fill');
  doc.rect(0, 90, PAGE_W, PAGE_H - 90, 'F');

  // Recipient card
  filledRoundRect(doc, MARGIN, 108, CONTENT_W, 60, 4, COLORS.white);
  setColor(doc, COLORS.border, 'draw');
  doc.setLineWidth(0.4);
  doc.roundedRect(MARGIN, 108, CONTENT_W, 60, 4, 4, 'S');

  const cardCx = MARGIN + CONTENT_W / 2;

  // "Prepared for" label
  doc.setTextColor(COLORS.muted[0], COLORS.muted[1], COLORS.muted[2]);
  useLatin(doc);
  doc.setFontSize(9);
  doc.text(isAr ? 'مُعَدٌّ لـ' : 'Prepared for', cardCx, 122, { align: 'center' });

  // Recipient name
  doc.setTextColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
  useBoldLatin(doc);
  doc.setFontSize(20);
  doc.text(data.name, cardCx, 136, { align: 'center' });

  // Job title
  doc.setTextColor(COLORS.muted[0], COLORS.muted[1], COLORS.muted[2]);
  useLatin(doc);
  doc.setFontSize(10);
  doc.text(data.jobTitle, cardCx, 147, { align: 'center' });

  // Direction badge
  filledRoundRect(doc, cardCx - 28, 152, 56, 9, 4, COLORS.primary);
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  const dirLabel = isAr ? data.directionAr : data.direction;
  doc.text(dirLabel, cardCx, 157.5, { align: 'center' });

  // Date
  doc.setTextColor(COLORS.muted[0], COLORS.muted[1], COLORS.muted[2]);
  useLatin(doc);
  doc.setFontSize(9);
  doc.text(today(isAr), PAGE_W / 2, 182, { align: 'center' });

  // Footer bar
  setColor(doc, COLORS.primary, 'fill');
  doc.rect(0, PAGE_H - 16, PAGE_W, 16, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.text('kunacademy.com  |  info@kunacademy.com', PAGE_W / 2, PAGE_H - 6, { align: 'center' });
}

// ── Page: Radar Chart ─────────────────────────────────────────────────────────

function drawRadarPage(doc: jsPDF, data: ProposalData): void {
  const isAr = data.locale === 'ar';

  // Cream background
  setColor(doc, COLORS.cream, 'fill');
  doc.rect(0, 0, PAGE_W, PAGE_H, 'F');

  // Page header bar
  setColor(doc, COLORS.primary, 'fill');
  doc.rect(0, 0, PAGE_W, 22, 'F');
  doc.setTextColor(255, 255, 255);
  useBoldLatin(doc);
  doc.setFontSize(11);
  doc.text(
    isAr ? 'نظرة عامة على التقييم الذاتي  |  Self-Assessment Overview' : 'Self-Assessment Overview  |  نظرة عامة على التقييم الذاتي',
    PAGE_W / 2, 14, { align: 'center' }
  );

  // White card for chart
  filledRoundRect(doc, MARGIN, 30, CONTENT_W, 170, 4, COLORS.white);

  // Embed radar SVG as image
  const svgDataUrl = svgToDataUrl(data.radarSvg);
  const chartSize = 130; // mm
  const chartX = (PAGE_W - chartSize) / 2;
  const chartY = 36;
  try {
    doc.addImage(svgDataUrl, 'SVG', chartX, chartY, chartSize, chartSize);
  } catch {
    // SVG rendering fallback — draw a placeholder box
    setColor(doc, COLORS.border, 'draw');
    doc.setLineWidth(0.5);
    doc.rect(chartX, chartY, chartSize, chartSize, 'S');
    doc.setTextColor(COLORS.muted[0], COLORS.muted[1], COLORS.muted[2]);
    useLatin(doc);
    doc.setFontSize(9);
    doc.text('[Radar Chart]', PAGE_W / 2, chartY + chartSize / 2, { align: 'center' });
  }

  // Legend
  const legendDatasets = [
    { label: isAr ? 'الوضع الحالي' : 'Current', color: COLORS.primary, dashed: true },
    { label: isAr ? 'هدف 3 أشهر' : '3-Month Target', color: COLORS.accent, dashed: false },
    { label: isAr ? 'هدف 6 أشهر' : '6-Month Target', color: COLORS.green, dashed: false },
  ];
  const legendY = 174;
  const colW = CONTENT_W / 3;
  legendDatasets.forEach((ds, i) => {
    const lx = MARGIN + i * colW + colW / 2;
    // Colour swatch
    setColor(doc, ds.color, 'fill');
    doc.rect(lx - 12, legendY - 2, 10, 3, 'F');
    // Label
    doc.setTextColor(COLORS.muted[0], COLORS.muted[1], COLORS.muted[2]);
    useLatin(doc);
    doc.setFontSize(8);
    doc.text(ds.label, lx + 1, legendY + 1);
  });

  // Description text below
  doc.setTextColor(COLORS.muted[0], COLORS.muted[1], COLORS.muted[2]);
  useLatin(doc);
  doc.setFontSize(8.5);
  const desc = isAr
    ? 'يُظهر الرسم البياني تقييمك الذاتي الحالي مقارنةً بالأهداف المتوقعة بعد 3 و6 أشهر من البرنامج.'
    : 'The chart shows your current self-assessment vs. projected targets after 3 and 6 months of the program.';
  drawWrappedText(doc, desc, MARGIN, 192, CONTENT_W, 5, 'center');

  // Footer
  setColor(doc, COLORS.primary, 'fill');
  doc.rect(0, PAGE_H - 16, PAGE_W, 16, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.text('kunacademy.com  |  info@kunacademy.com', PAGE_W / 2, PAGE_H - 6, { align: 'center' });
}

// ── Page: Benefits Table ──────────────────────────────────────────────────────

function drawBenefitsPage(doc: jsPDF, data: ProposalData): void {
  const isAr = data.locale === 'ar';

  setColor(doc, COLORS.cream, 'fill');
  doc.rect(0, 0, PAGE_W, PAGE_H, 'F');

  // Header bar
  setColor(doc, COLORS.primary, 'fill');
  doc.rect(0, 0, PAGE_W, 22, 'F');
  doc.setTextColor(255, 255, 255);
  useBoldLatin(doc);
  doc.setFontSize(11);
  doc.text(
    isAr ? 'الفوائد المؤسسية  |  Corporate Benefits' : 'Corporate Benefits  |  الفوائد المؤسسية',
    PAGE_W / 2, 14, { align: 'center' }
  );

  // Table header row
  const tableTop = 28;
  const rowH = 12;
  const cols = isAr
    ? [
        { label: 'الفائدة',      x: MARGIN,              w: 52 },
        { label: 'الحالي',       x: MARGIN + 52,         w: 16 },
        { label: '3 أشهر',       x: MARGIN + 68,         w: 16 },
        { label: '6 أشهر',       x: MARGIN + 84,         w: 16 },
        { label: 'التوفير السنوي', x: MARGIN + 100,       w: 38 },
        { label: 'المرجع',       x: MARGIN + 138,        w: 36 },
      ]
    : [
        { label: 'Benefit',          x: MARGIN,          w: 52 },
        { label: 'Current',          x: MARGIN + 52,     w: 16 },
        { label: '3M',               x: MARGIN + 68,     w: 16 },
        { label: '6M',               x: MARGIN + 84,     w: 16 },
        { label: 'Annual Savings',   x: MARGIN + 100,    w: 38 },
        { label: 'Citation',         x: MARGIN + 138,    w: 36 },
      ];

  // Header bg
  setColor(doc, COLORS.primary, 'fill');
  doc.rect(MARGIN, tableTop, CONTENT_W, rowH, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  cols.forEach((col) => {
    if (isAr) {
      useArabic(doc);
    } else {
      useBoldLatin(doc);
    }
    doc.text(col.label, col.x + 2, tableTop + 8);
  });

  // Data rows
  const benefits = data.selectedBenefits;
  let curY = tableTop + rowH;

  benefits.forEach((b, i) => {
    const assessment = data.selfAssessment.find(
      (a) => a.benefit_id === b.label_en.toLowerCase().replace(/\s+/g, '_')
    ) ?? { current: 0, target_3m: 0, target_6m: 0 };

    // Alternate row background
    if (i % 2 === 1) {
      setColor(doc, COLORS.rowAlt, 'fill');
      doc.rect(MARGIN, curY, CONTENT_W, rowH, 'F');
    } else {
      setColor(doc, COLORS.white, 'fill');
      doc.rect(MARGIN, curY, CONTENT_W, rowH, 'F');
    }

    doc.setTextColor(COLORS.text[0], COLORS.text[1], COLORS.text[2]);
    doc.setFontSize(7.5);

    // Benefit label
    if (isAr) {
      useArabic(doc);
      doc.text(b.label_ar, cols[0].x + 2, curY + 8);
    } else {
      useLatin(doc);
      const shortLabel = b.label_en.length > 26 ? b.label_en.slice(0, 24) + '…' : b.label_en;
      doc.text(shortLabel, cols[0].x + 2, curY + 8);
    }

    // Current / 3m / 6m scores
    useLatin(doc);
    doc.setFontSize(8);
    doc.text(String(assessment.current),   cols[1].x + 2, curY + 8);
    doc.text(String(assessment.target_3m), cols[2].x + 2, curY + 8);
    doc.text(String(assessment.target_6m), cols[3].x + 2, curY + 8);

    // Annual savings
    doc.setTextColor(COLORS.accent[0], COLORS.accent[1], COLORS.accent[2]);
    doc.setFontSize(7.5);
    doc.text(`AED ${fmt(b.annual_savings)}`, cols[4].x + 2, curY + 8);

    // Citation (truncated)
    doc.setTextColor(COLORS.muted[0], COLORS.muted[1], COLORS.muted[2]);
    doc.setFontSize(6.5);
    const cite = isAr ? b.citation_ar : b.citation_en;
    const shortCite = cite.length > 28 ? cite.slice(0, 26) + '…' : cite;
    doc.text(shortCite, cols[5].x + 2, curY + 8);

    // Bottom border
    setColor(doc, COLORS.border, 'draw');
    doc.setLineWidth(0.2);
    doc.line(MARGIN, curY + rowH, MARGIN + CONTENT_W, curY + rowH);

    curY += rowH;
  });

  // Total row
  setColor(doc, COLORS.darkPurple, 'fill');
  doc.rect(MARGIN, curY, CONTENT_W, rowH, 'F');
  doc.setTextColor(255, 255, 255);
  useBoldLatin(doc);
  doc.setFontSize(8.5);
  doc.text(isAr ? 'إجمالي التوفير السنوي' : 'Total Annual Savings', cols[0].x + 2, curY + 8);
  doc.text(`AED ${fmt(data.totalAnnualSavings)}`, cols[4].x + 2, curY + 8);

  // Footer
  setColor(doc, COLORS.primary, 'fill');
  doc.rect(0, PAGE_H - 16, PAGE_W, 16, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.text('kunacademy.com  |  info@kunacademy.com', PAGE_W / 2, PAGE_H - 6, { align: 'center' });
}

// ── Page: Financial Summary ───────────────────────────────────────────────────

function drawFinancialPage(doc: jsPDF, data: ProposalData): void {
  const isAr = data.locale === 'ar';

  setColor(doc, COLORS.cream, 'fill');
  doc.rect(0, 0, PAGE_W, PAGE_H, 'F');

  // Header
  setColor(doc, COLORS.primary, 'fill');
  doc.rect(0, 0, PAGE_W, 22, 'F');
  doc.setTextColor(255, 255, 255);
  useBoldLatin(doc);
  doc.setFontSize(11);
  doc.text(
    isAr ? 'الملخص المالي  |  Financial Summary' : 'Financial Summary  |  الملخص المالي',
    PAGE_W / 2, 14, { align: 'center' }
  );

  // Total savings hero number
  const heroY = 32;
  setColor(doc, COLORS.white, 'fill');
  doc.roundedRect(MARGIN, heroY, CONTENT_W, 26, 4, 4, 'F');
  setColor(doc, COLORS.accent, 'draw');
  doc.setLineWidth(1);
  doc.roundedRect(MARGIN, heroY, CONTENT_W, 26, 4, 4, 'S');

  doc.setTextColor(COLORS.muted[0], COLORS.muted[1], COLORS.muted[2]);
  useLatin(doc);
  doc.setFontSize(8.5);
  doc.text(
    isAr ? 'إجمالي التوفير السنوي المتوقع' : 'Total Projected Annual Savings',
    PAGE_W / 2, heroY + 9, { align: 'center' }
  );
  doc.setTextColor(COLORS.accent[0], COLORS.accent[1], COLORS.accent[2]);
  useBoldLatin(doc);
  doc.setFontSize(20);
  doc.text(`AED ${fmt(data.totalAnnualSavings)}`, PAGE_W / 2, heroY + 22, { align: 'center' });

  // Two comparison boxes
  const boxTop = 68;
  const boxW = (CONTENT_W - 8) / 2;
  const boxH = 100;

  // -- Full Program box --
  const box1X = MARGIN;
  filledRoundRect(doc, box1X, boxTop, boxW, boxH, 4, COLORS.white);
  setColor(doc, COLORS.primary, 'draw');
  doc.setLineWidth(1);
  doc.roundedRect(box1X, boxTop, boxW, boxH, 4, 4, 'S');

  // Box header
  setColor(doc, COLORS.primary, 'fill');
  doc.roundedRect(box1X, boxTop, boxW, 14, 4, 4, 'F');
  doc.rect(box1X, boxTop + 7, boxW, 7, 'F'); // square bottom corners
  doc.setTextColor(255, 255, 255);
  useBoldLatin(doc);
  doc.setFontSize(9);
  doc.text(isAr ? 'البرنامج الكامل' : 'Full Program', box1X + boxW / 2, boxTop + 9.5, { align: 'center' });

  const box1Items = [
    { label: isAr ? 'تكلفة البرنامج' : 'Program Cost',    value: fmtAed(data.fullProgramCost, isAr) },
    { label: isAr ? 'مضاعف العائد' : 'ROI Multiple',       value: `${data.fullProgramRoiMultiple}×` },
    { label: isAr ? 'صافي العائد' : 'Net Return',          value: fmtAed(data.totalAnnualSavings - data.fullProgramCost, isAr) },
  ];
  box1Items.forEach((item, i) => {
    const iy = boxTop + 22 + i * 24;
    doc.setTextColor(COLORS.muted[0], COLORS.muted[1], COLORS.muted[2]);
    useLatin(doc);
    doc.setFontSize(8);
    doc.text(item.label, box1X + 8, iy);
    doc.setTextColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
    useBoldLatin(doc);
    doc.setFontSize(11);
    doc.text(item.value, box1X + 8, iy + 10);
  });

  // -- Per-Leader box --
  const box2X = MARGIN + boxW + 8;
  filledRoundRect(doc, box2X, boxTop, boxW, boxH, 4, COLORS.white);
  setColor(doc, COLORS.accent, 'draw');
  doc.setLineWidth(1);
  doc.roundedRect(box2X, boxTop, boxW, boxH, 4, 4, 'S');

  setColor(doc, COLORS.accent, 'fill');
  doc.roundedRect(box2X, boxTop, boxW, 14, 4, 4, 'F');
  doc.rect(box2X, boxTop + 7, boxW, 7, 'F');
  doc.setTextColor(255, 255, 255);
  useBoldLatin(doc);
  doc.setFontSize(9);
  doc.text(isAr ? 'حزمة لكل قائد' : 'Per-Leader Package', box2X + boxW / 2, boxTop + 9.5, { align: 'center' });

  const box2Items = [
    { label: isAr ? 'التكلفة لكل قائد' : 'Cost per Leader',    value: fmtAed(data.perLeaderCost, isAr) },
    { label: isAr ? 'مضاعف العائد' : 'ROI Multiple',           value: `${data.perLeaderRoiMultiple}×` },
    { label: isAr ? 'صافي العائد لكل قائد' : 'Net per Leader', value: fmtAed(data.totalAnnualSavings - data.perLeaderCost, isAr) },
  ];
  box2Items.forEach((item, i) => {
    const iy = boxTop + 22 + i * 24;
    doc.setTextColor(COLORS.muted[0], COLORS.muted[1], COLORS.muted[2]);
    useLatin(doc);
    doc.setFontSize(8);
    doc.text(item.label, box2X + 8, iy);
    doc.setTextColor(COLORS.accent[0], COLORS.accent[1], COLORS.accent[2]);
    useBoldLatin(doc);
    doc.setFontSize(11);
    doc.text(item.value, box2X + 8, iy + 10);
  });

  // Note
  doc.setTextColor(COLORS.muted[0], COLORS.muted[1], COLORS.muted[2]);
  useLatin(doc);
  doc.setFontSize(7.5);
  const note = isAr
    ? '* الأرقام مبنية على متوسطات صناعية موثقة. النتائج الفعلية قد تتفاوت حسب الحجم والقطاع.'
    : '* Figures based on documented industry averages. Actual results may vary by organization size and sector.';
  drawWrappedText(doc, note, MARGIN, 182, CONTENT_W, 4.5, 'left');

  // Footer
  setColor(doc, COLORS.primary, 'fill');
  doc.rect(0, PAGE_H - 16, PAGE_W, 16, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.text('kunacademy.com  |  info@kunacademy.com', PAGE_W / 2, PAGE_H - 6, { align: 'center' });
}

// ── Page: Testimonial ─────────────────────────────────────────────────────────

function drawTestimonialPage(doc: jsPDF, data: ProposalData): void {
  const isAr = data.locale === 'ar';
  const t = data.testimonial!;

  setColor(doc, COLORS.cream, 'fill');
  doc.rect(0, 0, PAGE_W, PAGE_H, 'F');

  setColor(doc, COLORS.primary, 'fill');
  doc.rect(0, 0, PAGE_W, 22, 'F');
  doc.setTextColor(255, 255, 255);
  useBoldLatin(doc);
  doc.setFontSize(11);
  doc.text(
    isAr ? 'شهادة خريج  |  Graduate Testimonial' : 'Graduate Testimonial  |  شهادة خريج',
    PAGE_W / 2, 14, { align: 'center' }
  );

  // Quote card
  filledRoundRect(doc, MARGIN, 36, CONTENT_W, 120, 6, COLORS.white);
  setColor(doc, COLORS.border, 'draw');
  doc.setLineWidth(0.4);
  doc.roundedRect(MARGIN, 36, CONTENT_W, 120, 6, 6, 'S');

  // Accent left bar
  setColor(doc, COLORS.accent, 'fill');
  doc.rect(MARGIN, 36, 4, 120, 'F');

  // Large quotation mark
  doc.setTextColor(COLORS.accent[0], COLORS.accent[1], COLORS.accent[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(48);
  doc.setGState(doc.GState({ opacity: 0.15 }));
  doc.text('"', MARGIN + 12, 68);
  doc.setGState(doc.GState({ opacity: 1 }));

  // Quote text
  const quoteText = isAr ? (t.text_ar ?? t.text_en ?? '') : (t.text_en ?? t.text_ar ?? '');
  doc.setTextColor(COLORS.text[0], COLORS.text[1], COLORS.text[2]);
  if (isAr) {
    useArabic(doc);
    doc.setFontSize(11);
  } else {
    useLatin(doc);
    doc.setFontSize(10.5);
  }
  drawWrappedText(doc, quoteText, MARGIN + 12, 58, CONTENT_W - 20, 7, isAr ? 'right' : 'left');

  // Author
  if (t.author) {
    doc.setTextColor(COLORS.muted[0], COLORS.muted[1], COLORS.muted[2]);
    useLatin(doc);
    doc.setFontSize(9);
    doc.text(`— ${t.author}`, PAGE_W - MARGIN - 4, 148, { align: 'right' });
  }

  setColor(doc, COLORS.primary, 'fill');
  doc.rect(0, PAGE_H - 16, PAGE_W, 16, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.text('kunacademy.com  |  info@kunacademy.com', PAGE_W / 2, PAGE_H - 6, { align: 'center' });
}

// ── Page: Next Steps ──────────────────────────────────────────────────────────

function drawNextStepsPage(doc: jsPDF, data: ProposalData): void {
  const isAr = data.locale === 'ar';

  setColor(doc, COLORS.cream, 'fill');
  doc.rect(0, 0, PAGE_W, PAGE_H, 'F');

  // Header
  setColor(doc, COLORS.primary, 'fill');
  doc.rect(0, 0, PAGE_W, 22, 'F');
  doc.setTextColor(255, 255, 255);
  useBoldLatin(doc);
  doc.setFontSize(11);
  doc.text(
    isAr ? 'الخطوات التالية  |  Next Steps' : 'Next Steps  |  الخطوات التالية',
    PAGE_W / 2, 14, { align: 'center' }
  );

  // CTA card
  setColor(doc, COLORS.primary, 'fill');
  doc.roundedRect(MARGIN, 34, CONTENT_W, 80, 6, 6, 'F');

  // Accent strip
  setColor(doc, COLORS.accent, 'fill');
  doc.rect(MARGIN, 34, CONTENT_W, 3, 'F');

  doc.setTextColor(255, 255, 255);
  useBoldLatin(doc);
  doc.setFontSize(15);
  doc.text(isAr ? 'هل أنت مستعد للخطوة التالية؟' : 'Ready for the next step?', PAGE_W / 2, 56, { align: 'center' });

  if (isAr) useArabic(doc); else useLatin(doc);
  doc.setFontSize(10);
  doc.setTextColor(220, 215, 255);
  const subtext = isAr
    ? 'احجز استشارة مجانية مع فريقنا المتخصص لمناقشة احتياجات مؤسستك'
    : 'Book a free consultation with our specialist team to discuss your organization\'s needs';
  drawWrappedText(doc, subtext, MARGIN + 10, 65, CONTENT_W - 20, 6, 'center');

  // Book button simulation
  filledRoundRect(doc, PAGE_W / 2 - 30, 84, 60, 12, 6, COLORS.accent);
  doc.setTextColor(255, 255, 255);
  useBoldLatin(doc);
  doc.setFontSize(9);
  doc.text(isAr ? 'احجز الآن' : 'Book Now', PAGE_W / 2, 91.5, { align: 'center' });

  // Contact details
  const contactY = 130;
  const contacts = [
    { icon: '🌐', label: 'kunacademy.com/coaching/book' },
    { icon: '✉', label: 'info@kunacademy.com' },
  ];

  contacts.forEach((c, i) => {
    const cy = contactY + i * 20;
    filledRoundRect(doc, MARGIN, cy, CONTENT_W, 14, 3, COLORS.white);
    doc.setTextColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
    useLatin(doc);
    doc.setFontSize(9);
    doc.text(c.icon + '  ' + c.label, PAGE_W / 2, cy + 9, { align: 'center' });
  });

  // Footer
  setColor(doc, COLORS.primary, 'fill');
  doc.rect(0, PAGE_H - 16, PAGE_W, 16, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.text('kunacademy.com  |  info@kunacademy.com', PAGE_W / 2, PAGE_H - 6, { align: 'center' });
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function generateProposalPdf(data: ProposalData): Promise<Uint8Array> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  // Register Tajawal font for Arabic text
  registerFont(doc);

  // Page 1: Cover
  drawCoverPage(doc, data);

  // Page 2: Radar Chart
  doc.addPage();
  drawRadarPage(doc, data);

  // Page 3: Benefits Table
  doc.addPage();
  drawBenefitsPage(doc, data);

  // Page 4: Financial Summary
  doc.addPage();
  drawFinancialPage(doc, data);

  // Page 5: Testimonial (optional)
  if (data.testimonial && (data.testimonial.text_en || data.testimonial.text_ar)) {
    doc.addPage();
    drawTestimonialPage(doc, data);
  }

  // Page 6: Next Steps
  doc.addPage();
  drawNextStepsPage(doc, data);

  return doc.output('arraybuffer') as unknown as Uint8Array;
}
