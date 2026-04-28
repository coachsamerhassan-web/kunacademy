/**
 * Wave 15 Wave 3 canary v2 — Image styling panel (Issue 2).
 *
 * WP-UX-grade controls for image sections (see WP UX research §2 + §3):
 *   - Alignment: left / center / right / wide / full (5-state)
 *   - Object-fit: cover / contain / fill (mapped to CSS object-fit)
 *   - Aspect-ratio lock: 16/9 · 4/3 · 3/2 · 1/1 · 9/16 · free
 *   - Width %: 25/50/75/100 (only meaningful for non-full alignments)
 *   - Overlay: shared OverlayControls (color / gradient + opacity)
 *
 * Mounted from the image-section side panel branch in universal-section-form.
 * Reads/writes `section.styling` (typed as ImageStyling).
 *
 * Public render: LpRenderer's image dispatcher reads these fields when
 * present and applies CSS accordingly. When `section.styling` is undefined,
 * render is byte-identical to today (boundary contract).
 */

'use client';

import {
  type ImageStyling,
  type ImageAlign,
  type ImageObjectFit,
  type AspectRatio,
} from './styling-types';
import { OverlayControls } from './overlay-controls';

interface ImageStylingPanelProps {
  value: ImageStyling | undefined;
  onChange: (next: ImageStyling | undefined) => void;
  isAr: boolean;
}

const ALIGNMENTS: ReadonlyArray<{ id: ImageAlign; label_ar: string; label_en: string; icon: string }> = [
  { id: 'left', label_ar: 'يسار', label_en: 'Left', icon: '⬅' },
  { id: 'center', label_ar: 'وسط', label_en: 'Center', icon: '⇅' },
  { id: 'right', label_ar: 'يمين', label_en: 'Right', icon: '➡' },
  { id: 'wide', label_ar: 'عريض', label_en: 'Wide', icon: '↔' },
  { id: 'full', label_ar: 'كامل', label_en: 'Full', icon: '⇿' },
];

const FITS: ReadonlyArray<{ id: ImageObjectFit; label_ar: string; label_en: string }> = [
  { id: 'cover', label_ar: 'تغطية', label_en: 'Cover' },
  { id: 'contain', label_ar: 'احتواء', label_en: 'Contain' },
  { id: 'fill', label_ar: 'تمدّد', label_en: 'Fill' },
];

const ASPECTS: ReadonlyArray<{ id: AspectRatio; label: string }> = [
  { id: 'free', label: 'Free' },
  { id: '16/9', label: '16:9' },
  { id: '4/3', label: '4:3' },
  { id: '3/2', label: '3:2' },
  { id: '1/1', label: '1:1' },
  { id: '9/16', label: '9:16' },
];

const WIDTHS: ReadonlyArray<25 | 50 | 75 | 100> = [25, 50, 75, 100];

export function ImageStylingPanel({ value, onChange, isAr }: ImageStylingPanelProps) {
  const s = value ?? {};
  const patch = (p: Partial<ImageStyling>) => {
    const next = { ...s, ...p };
    // If everything is empty/default, revert to undefined to keep byte-identity.
    const allEmpty =
      !next.align && !next.fit && !next.aspect && !next.overlay && !next.width_pct;
    onChange(allEmpty ? undefined : next);
  };

  return (
    <div className="space-y-3 rounded-xl border border-[var(--color-neutral-200)] bg-white p-3">
      <div className="text-xs font-semibold uppercase tracking-wider text-[var(--color-neutral-600)]">
        {isAr ? 'تنسيق الصورة' : 'Image styling'}
      </div>

      {/* Alignment — 5-state per WP convention */}
      <div>
        <div className="text-[11px] font-medium text-[var(--color-neutral-700)] mb-1">
          {isAr ? 'المحاذاة' : 'Alignment'}
        </div>
        <div className="flex items-center rounded-lg border border-[var(--color-neutral-200)] p-0.5 bg-[var(--color-neutral-50)] gap-0.5">
          {ALIGNMENTS.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => patch({ align: s.align === a.id ? undefined : a.id })}
              title={isAr ? a.label_ar : a.label_en}
              aria-label={isAr ? a.label_ar : a.label_en}
              aria-pressed={s.align === a.id}
              className={`flex-1 rounded px-1 py-1 text-xs font-medium transition-colors ${
                s.align === a.id
                  ? 'bg-white shadow-sm text-[var(--text-primary)]'
                  : 'text-[var(--color-neutral-500)] hover:text-[var(--color-neutral-700)]'
              }`}
            >
              {a.icon}
            </button>
          ))}
        </div>
      </div>

      {/* Width % — only when align is left/right/center */}
      {(!s.align || s.align === 'left' || s.align === 'center' || s.align === 'right') && (
        <div>
          <div className="text-[11px] font-medium text-[var(--color-neutral-700)] mb-1">
            {isAr ? 'العرض' : 'Width'}
          </div>
          <div className="flex items-center rounded-lg border border-[var(--color-neutral-200)] p-0.5 bg-[var(--color-neutral-50)] gap-0.5">
            {WIDTHS.map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => patch({ width_pct: s.width_pct === w ? undefined : w })}
                aria-pressed={s.width_pct === w}
                className={`flex-1 rounded px-1 py-1 text-[11px] font-medium transition-colors ${
                  s.width_pct === w
                    ? 'bg-white shadow-sm text-[var(--text-primary)]'
                    : 'text-[var(--color-neutral-500)] hover:text-[var(--color-neutral-700)]'
                }`}
              >
                {w}%
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Object-fit */}
      <div>
        <div className="text-[11px] font-medium text-[var(--color-neutral-700)] mb-1">
          {isAr ? 'وضع الاحتواء' : 'Fit'}
        </div>
        <div className="flex items-center rounded-lg border border-[var(--color-neutral-200)] p-0.5 bg-[var(--color-neutral-50)] gap-0.5">
          {FITS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => patch({ fit: s.fit === f.id ? undefined : f.id })}
              aria-pressed={s.fit === f.id}
              className={`flex-1 rounded px-2 py-1 text-[11px] font-medium transition-colors ${
                s.fit === f.id
                  ? 'bg-white shadow-sm text-[var(--text-primary)]'
                  : 'text-[var(--color-neutral-500)] hover:text-[var(--color-neutral-700)]'
              }`}
            >
              {isAr ? f.label_ar : f.label_en}
            </button>
          ))}
        </div>
      </div>

      {/* Aspect ratio */}
      <div>
        <div className="text-[11px] font-medium text-[var(--color-neutral-700)] mb-1">
          {isAr ? 'نسبة الأبعاد' : 'Aspect ratio'}
        </div>
        <div className="grid grid-cols-3 gap-1">
          {ASPECTS.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => patch({ aspect: s.aspect === a.id ? undefined : a.id })}
              aria-pressed={s.aspect === a.id}
              className={`rounded-lg border px-2 py-1 text-[11px] font-medium transition-colors ${
                s.aspect === a.id
                  ? 'border-[var(--color-accent,#F47E42)] bg-[var(--color-accent,#F47E42)]/5 text-[var(--text-primary)]'
                  : 'border-[var(--color-neutral-200)] text-[var(--color-neutral-700)] hover:border-[var(--color-neutral-400)]'
              }`}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>

      {/* Overlay (only meaningful for full/wide-aligned cover-style images) */}
      {(s.align === 'full' || s.align === 'wide') && (
        <OverlayControls
          value={s.overlay}
          onChange={(o) => patch({ overlay: o })}
          isAr={isAr}
        />
      )}
    </div>
  );
}
