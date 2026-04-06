/**
 * Radar Chart SVG Generator — pure server-side, zero DOM dependencies.
 * Used to embed the self-assessment radar chart in the proposal PDF.
 *
 * Coordinate math:
 *   - Origin at center of square canvas (cx, cy)
 *   - n vertices evenly distributed around a circle
 *   - First vertex at top (angle = -π/2), rotating clockwise
 *   - Grid rings at values [2, 4, 6, 8, 10] on a 0–10 scale
 */

export interface RadarDataset {
  label: string;
  color: string;     // hex, e.g. '#474099'
  opacity: number;   // fill opacity 0–1
  dashed?: boolean;  // stroke-dasharray for outline
  values: number[];  // 0–10 scale, length must match labels
}

export interface RadarChartOptions {
  labels: string[];       // benefit names at each vertex
  datasets: RadarDataset[];
  size?: number;          // SVG viewport size in px (default 400)
  maxValue?: number;      // scale maximum (default 10)
  isAr?: boolean;         // RTL label placement hints
}

// ── Coordinate helpers ───────────────────────────────────────────────────────

/** Convert polar (radius, angleDeg from top, clockwise) to Cartesian. */
function polar(cx: number, cy: number, r: number, angleRad: number): [number, number] {
  return [
    cx + r * Math.sin(angleRad),
    cy - r * Math.cos(angleRad),
  ];
}

/** Round to 2 decimal places to keep SVG compact. */
function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Build a closed SVG polygon points string from an array of [x, y] pairs. */
function polyPoints(pts: [number, number][]): string {
  return pts.map(([x, y]) => `${r2(x)},${r2(y)}`).join(' ');
}

// ── Main generator ───────────────────────────────────────────────────────────

export function generateRadarChartSvg(options: RadarChartOptions): string {
  const {
    labels,
    datasets,
    size = 400,
    maxValue = 10,
    isAr = false,
  } = options;

  const n = labels.length;
  if (n < 3) throw new Error('Radar chart requires at least 3 labels');

  const cx = size / 2;
  const cy = size / 2;

  // Radar radius — leave margin for labels
  const labelMargin = 48;
  const radarR = cx - labelMargin;

  // Angles for each vertex (starting top, clockwise)
  const angles = Array.from({ length: n }, (_, i) => (2 * Math.PI * i) / n);

  // Grid ring values
  const gridRings = [2, 4, 6, 8, 10].filter((v) => v <= maxValue);

  // ── Build SVG pieces ──────────────────────────────────────────────────────

  // 1. Grid rings (concentric polygons)
  const gridPolygons = gridRings.map((val) => {
    const ringR = (val / maxValue) * radarR;
    const pts = angles.map((a) => polar(cx, cy, ringR, a)) as [number, number][];
    return `<polygon points="${polyPoints(pts)}" fill="none" stroke="#E8E3DC" stroke-width="1" />`;
  }).join('\n  ');

  // 2. Axis spokes (from center to each vertex)
  const spokes = angles.map((a) => {
    const [x, y] = polar(cx, cy, radarR, a);
    return `<line x1="${r2(cx)}" y1="${r2(cy)}" x2="${r2(x)}" y2="${r2(y)}" stroke="#E8E3DC" stroke-width="1" />`;
  }).join('\n  ');

  // 3. Scale labels along the first axis (top vertex, slightly offset right)
  const scaleLabels = gridRings.map((val) => {
    const ringR = (val / maxValue) * radarR;
    // Place slightly to the right of the top spoke
    const offsetAngle = angles[0] + 0.18; // small clockwise offset
    const [lx, ly] = polar(cx, cy, ringR, offsetAngle);
    return `<text x="${r2(lx + 3)}" y="${r2(ly + 4)}" font-family="'Tajawal','Cairo',Arial,sans-serif" font-size="9" fill="#9CA3AF" text-anchor="start">${val}</text>`;
  }).join('\n  ');

  // 4. Dataset polygons
  const datasetPolygons = datasets.map((ds) => {
    if (ds.values.length !== n) return '';
    const pts = ds.values.map((val, i) => {
      const r = (Math.min(Math.max(val, 0), maxValue) / maxValue) * radarR;
      return polar(cx, cy, r, angles[i]) as [number, number];
    });
    const dashAttr = ds.dashed ? ' stroke-dasharray="6 3"' : '';
    return `<polygon points="${polyPoints(pts)}" fill="${ds.color}" fill-opacity="${ds.opacity}" stroke="${ds.color}" stroke-width="1.5" stroke-linejoin="round"${dashAttr} />`;
  }).join('\n  ');

  // 5. Vertex labels
  const vertexLabels = labels.map((label, i) => {
    const angle = angles[i];
    // Push labels further out beyond the radar
    const labelR = radarR + (labelMargin - 8);
    const [lx, ly] = polar(cx, cy, labelR, angle);

    // Anchor based on position around the circle
    let anchor = 'middle';
    const sinA = Math.sin(angle);
    if (sinA > 0.2) anchor = isAr ? 'end' : 'start';
    else if (sinA < -0.2) anchor = isAr ? 'start' : 'end';

    // Vertical baseline nudge
    const cosA = Math.cos(angle);
    const dy = cosA > 0.3 ? -4 : cosA < -0.3 ? 10 : 5;

    // Wrap long labels at ~14 chars
    const words = label.split(' ');
    if (words.length === 1 || label.length <= 14) {
      return `<text x="${r2(lx)}" y="${r2(ly + dy)}" font-family="'Tajawal','Cairo',Arial,sans-serif" font-size="10" fill="#374151" text-anchor="${anchor}" font-weight="500">${label}</text>`;
    }
    // Two-line label
    const mid = Math.ceil(words.length / 2);
    const line1 = words.slice(0, mid).join(' ');
    const line2 = words.slice(mid).join(' ');
    return `<text x="${r2(lx)}" y="${r2(ly + dy - 6)}" font-family="'Tajawal','Cairo',Arial,sans-serif" font-size="10" fill="#374151" text-anchor="${anchor}" font-weight="500">
    <tspan x="${r2(lx)}" dy="0">${line1}</tspan>
    <tspan x="${r2(lx)}" dy="13">${line2}</tspan>
  </text>`;
  }).join('\n  ');

  // 6. Dataset dot markers at each vertex
  const dots = datasets.map((ds) => {
    if (ds.values.length !== n) return '';
    return ds.values.map((val, i) => {
      const r = (Math.min(Math.max(val, 0), maxValue) / maxValue) * radarR;
      const [dx, dy] = polar(cx, cy, r, angles[i]);
      return `<circle cx="${r2(dx)}" cy="${r2(dy)}" r="3" fill="${ds.color}" fill-opacity="0.9" stroke="white" stroke-width="1" />`;
    }).join('\n  ');
  }).join('\n  ');

  // ── Legend ────────────────────────────────────────────────────────────────
  // Position legend at the bottom, centered
  const legendY = size - 14;
  const legendItems = datasets.map((ds, i) => {
    const itemW = size / datasets.length;
    const itemX = i * itemW + itemW / 2;
    const dashAttr = ds.dashed ? ' stroke-dasharray="4 2"' : '';
    return `
  <line x1="${r2(itemX - 16)}" y1="${r2(legendY - 1)}" x2="${r2(itemX - 4)}" y2="${r2(legendY - 1)}" stroke="${ds.color}" stroke-width="2"${dashAttr} />
  <circle cx="${r2(itemX - 10)}" cy="${r2(legendY - 1)}" r="3" fill="${ds.color}" fill-opacity="0.9" />
  <text x="${r2(itemX - 1)}" y="${r2(legendY + 3)}" font-family="'Tajawal','Cairo',Arial,sans-serif" font-size="9" fill="#6B7280" text-anchor="start">${ds.label}</text>`;
  }).join('');

  // ── Assemble SVG ──────────────────────────────────────────────────────────
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" direction="ltr">
  <!-- Grid rings -->
  ${gridPolygons}
  <!-- Axis spokes -->
  ${spokes}
  <!-- Scale labels -->
  ${scaleLabels}
  <!-- Data polygons -->
  ${datasetPolygons}
  <!-- Vertex dot markers -->
  ${dots}
  <!-- Vertex labels -->
  ${vertexLabels}
  <!-- Legend -->
  ${legendItems}
</svg>`;
}
