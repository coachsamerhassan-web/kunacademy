/**
 * Wave 15 Wave 3 canary v2 — Per-element background panel (Issue 3).
 *
 * Single shared component mounted in every section's side-panel form for
 * background controls. Mirrors WordPress's Group/Cover block "Color"+"Image"+
 * "Gradient" pattern (see `Workspace/CTO/output/2026-04-28-wp-ux-research.md` §6).
 *
 * Per dispatch Issue 3: "Apply consistently across the section vocabulary;
 * this is one shared component, not N copies." This file IS that component.
 *
 * Authoring contract:
 *   - Reads/writes `section.background` (typed as SectionBackground).
 *   - When `background === undefined` or `type === 'none'`, public render is
 *     byte-identical to today (no surface change for unmodified sections).
 *   - When admin sets a non-none background, public renderer applies it via
 *     a wrapping `<div style={...}>` around the section's existing markup.
 *
 * Mounted via composition in `side-panel.tsx`'s field-group section.
 */

'use client';

import { useState } from 'react';
import {
  type SectionBackground,
  type BackgroundType,
  type PaddingPreset,
  type GradientSpec,
  EMPTY_BACKGROUND,
  KUN_COLOR_PALETTE,
} from './styling-types';
import { OverlayControls } from './overlay-controls';
import { MediaPickerDialog, type MediaPickerSelection } from '../media-picker-dialog';

interface BackgroundPanelProps {
  value: SectionBackground | undefined;
  onChange: (next: SectionBackground | undefined) => void;
  isAr: boolean;
  /** Locale of the admin UI for the media picker. */
  uiLocale: 'ar' | 'en';
}

const PADDING_PRESETS: ReadonlyArray<{ id: PaddingPreset; label_ar: string; label_en: string }> = [
  { id: 'none', label_ar: 'بدون', label_en: 'None' },
  { id: 'small', label_ar: 'صغير', label_en: 'Small' },
  { id: 'medium', label_ar: 'متوسّط', label_en: 'Medium' },
  { id: 'large', label_ar: 'كبير', label_en: 'Large' },
];

export function BackgroundPanel({ value, onChange, isAr, uiLocale }: BackgroundPanelProps) {
  const bg = value ?? EMPTY_BACKGROUND;
  const [mediaOpen, setMediaOpen] = useState(false);

  const setType = (next: BackgroundType) => {
    if (next === 'none') {
      // Strip everything; revert to undefined to preserve byte-identity.
      onChange(undefined);
      return;
    }
    onChange({ ...bg, type: next });
  };

  const setColor = (color: string) => onChange({ ...bg, type: 'color', color });

  const setImage = (sel: MediaPickerSelection) => {
    onChange({
      ...bg,
      type: 'image',
      image: {
        src: sel.src,
        alt_ar: sel.alt_ar ?? null,
        alt_en: sel.alt_en ?? null,
        mediaId: sel.mediaId ?? null,
        fit: bg.image?.fit ?? 'cover',
        parallax: bg.image?.parallax ?? false,
        focal_x: bg.image?.focal_x ?? 50,
        focal_y: bg.image?.focal_y ?? 50,
      },
    });
  };

  const setParallax = (v: boolean) => {
    if (!bg.image) return;
    onChange({ ...bg, image: { ...bg.image, parallax: v } });
  };

  const setGradient = (g: GradientSpec) => onChange({ ...bg, type: 'gradient', gradient: g });

  const setPadding = (key: 'padding_top' | 'padding_bottom', v: PaddingPreset) =>
    onChange({ ...bg, [key]: v });

  return (
    <div className="space-y-3 rounded-xl border border-[var(--color-neutral-200)] bg-white p-3">
      <div className="text-xs font-semibold uppercase tracking-wider text-[var(--color-neutral-600)]">
        {isAr ? 'الخلفية' : 'Background'}
      </div>

      {/* Type segmented control */}
      <div className="flex items-center rounded-lg border border-[var(--color-neutral-200)] p-1 bg-[var(--color-neutral-50)] gap-1">
        {(['none', 'color', 'image', 'gradient'] as BackgroundType[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setType(t)}
            className={`flex-1 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
              bg.type === t
                ? 'bg-white shadow-sm text-[var(--text-primary)]'
                : 'text-[var(--color-neutral-500)] hover:text-[var(--color-neutral-700)]'
            }`}
          >
            {isAr
              ? t === 'none'
                ? 'بدون'
                : t === 'color'
                ? 'لون'
                : t === 'image'
                ? 'صورة'
                : 'تدرّج'
              : t === 'none'
              ? 'None'
              : t === 'color'
              ? 'Color'
              : t === 'image'
              ? 'Image'
              : 'Gradient'}
          </button>
        ))}
      </div>

      {/* Color picker */}
      {bg.type === 'color' && (
        <ColorPicker value={bg.color ?? '#FFFFFF'} onChange={setColor} isAr={isAr} />
      )}

      {/* Image */}
      {bg.type === 'image' && (
        <div className="space-y-2">
          {bg.image?.src ? (
            <div className="flex items-start gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={bg.image.src}
                alt={(isAr ? bg.image.alt_ar : bg.image.alt_en) ?? ''}
                className="w-20 h-20 rounded-lg object-cover bg-[var(--color-neutral-100)] border border-[var(--color-neutral-200)]"
              />
              <div className="flex-1 min-w-0">
                <div className="text-[11px] text-[var(--color-neutral-500)] truncate">
                  {bg.image.src}
                </div>
                <div className="flex gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => setMediaOpen(true)}
                    className="rounded-lg border border-[var(--color-neutral-300)] px-2 py-1 text-xs hover:bg-[var(--color-neutral-50)]"
                  >
                    {isAr ? 'استبدال' : 'Replace'}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onChange({ ...bg, image: undefined, type: bg.gradient || bg.color ? bg.type : 'none' })
                    }
                    className="rounded-lg border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                  >
                    {isAr ? 'إزالة' : 'Remove'}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setMediaOpen(true)}
              className="w-full rounded-xl border-2 border-dashed border-[var(--color-neutral-300)] px-3 py-4 text-sm text-[var(--color-neutral-600)] hover:border-[var(--color-accent,#F47E42)] hover:bg-[var(--color-neutral-50)]"
            >
              {isAr ? '+ إضافة صورة' : '+ Add image'}
            </button>
          )}
          {bg.image?.src && (
            <label className="flex items-center gap-2 text-xs text-[var(--color-neutral-700)]">
              <input
                type="checkbox"
                checked={bg.image.parallax ?? false}
                onChange={(e) => setParallax(e.target.checked)}
              />
              <span>{isAr ? 'تأثير المنظر (parallax)' : 'Parallax (fixed background)'}</span>
            </label>
          )}
        </div>
      )}

      {/* Gradient */}
      {bg.type === 'gradient' && (
        <GradientEditor
          value={bg.gradient ?? defaultGradient()}
          onChange={setGradient}
          isAr={isAr}
        />
      )}

      {/* Overlay (works with image and gradient) */}
      {(bg.type === 'image' || bg.type === 'gradient') && (
        <OverlayControls
          value={bg.overlay}
          onChange={(o) => onChange({ ...bg, overlay: o })}
          isAr={isAr}
        />
      )}

      {/* Padding */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <div className="text-[11px] font-medium text-[var(--color-neutral-700)] mb-1">
            {isAr ? 'حشو علوي' : 'Padding top'}
          </div>
          <SegmentedPadding
            value={bg.padding_top ?? 'none'}
            onChange={(v) => setPadding('padding_top', v)}
            isAr={isAr}
          />
        </div>
        <div>
          <div className="text-[11px] font-medium text-[var(--color-neutral-700)] mb-1">
            {isAr ? 'حشو سفلي' : 'Padding bottom'}
          </div>
          <SegmentedPadding
            value={bg.padding_bottom ?? 'none'}
            onChange={(v) => setPadding('padding_bottom', v)}
            isAr={isAr}
          />
        </div>
      </div>

      <MediaPickerDialog
        open={mediaOpen}
        onClose={() => setMediaOpen(false)}
        onSelect={setImage}
        locale={uiLocale}
      />
    </div>
  );
}

// ─── Color picker (palette + custom hex) ──────────────────────────────────
export function ColorPicker({
  value,
  onChange,
  isAr,
}: {
  value: string;
  onChange: (v: string) => void;
  isAr: boolean;
}) {
  const safe = /^#[0-9A-Fa-f]{3,8}$/.test(value) ? value : '#FFFFFF';
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {KUN_COLOR_PALETTE.map((c) => (
          <button
            key={c.hex}
            type="button"
            onClick={() => onChange(c.hex)}
            title={c.name}
            aria-label={c.name}
            className={`w-7 h-7 rounded-lg border-2 transition-transform hover:scale-110 ${
              safe.toLowerCase() === c.hex.toLowerCase()
                ? 'border-[var(--color-neutral-700)] ring-2 ring-offset-1 ring-[var(--color-accent,#F47E42)]'
                : 'border-[var(--color-neutral-300)]'
            }`}
            style={{ background: c.hex }}
          />
        ))}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={safe.length === 7 ? safe : '#FFFFFF'}
          onChange={(e) => onChange(e.target.value)}
          aria-label={isAr ? 'لون مخصّص' : 'Custom color'}
          className="w-9 h-9 rounded border border-[var(--color-neutral-300)] cursor-pointer"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => {
            const v = e.target.value.trim();
            // Accept #RGB, #RRGGBB, #RRGGBBAA only — sanitize anything else
            if (/^#?[0-9A-Fa-f]{0,8}$/.test(v) || v === '') {
              onChange(v.startsWith('#') ? v : v ? `#${v}` : '');
            }
          }}
          placeholder="#RRGGBB"
          dir="ltr"
          className="flex-1 rounded-lg border border-[var(--color-neutral-200)] px-2 py-1 text-xs font-mono focus:border-[var(--color-primary)] focus:outline-none"
          maxLength={9}
        />
      </div>
    </div>
  );
}

// ─── Gradient editor (2-stop minimum) ─────────────────────────────────────
export function GradientEditor({
  value,
  onChange,
  isAr,
}: {
  value: GradientSpec;
  onChange: (v: GradientSpec) => void;
  isAr: boolean;
}) {
  // Always present minimum of 2 stops; setting 0/100 if only 1 stop somehow.
  const stops = value.stops.length >= 2 ? value.stops : [
    { color: value.stops[0]?.color ?? '#FFF5E9', position: 0 },
    { color: '#F47E42', position: 100 },
  ];
  const updateStop = (i: number, patch: Partial<GradientSpec['stops'][number]>) => {
    const next = stops.slice();
    next[i] = { ...next[i], ...patch };
    onChange({ ...value, stops: next });
  };
  const cssPreview = `linear-gradient(${value.angle}deg, ${stops
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((s) => `${s.color} ${s.position}%`)
    .join(', ')})`;

  return (
    <div className="space-y-2">
      <div
        className="h-12 rounded-lg border border-[var(--color-neutral-300)]"
        style={{ background: cssPreview }}
        aria-label={isAr ? 'معاينة التدرّج' : 'Gradient preview'}
      />
      <div className="space-y-2">
        {stops.map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              type="color"
              value={s.color}
              onChange={(e) => updateStop(i, { color: e.target.value })}
              className="w-8 h-8 rounded border border-[var(--color-neutral-300)] cursor-pointer"
              aria-label={`Stop ${i + 1} color`}
            />
            <input
              type="range"
              min={0}
              max={100}
              value={s.position}
              onChange={(e) => updateStop(i, { position: Number(e.target.value) })}
              className="flex-1"
              aria-label={`Stop ${i + 1} position`}
            />
            <span className="text-[11px] font-mono w-9 text-end">{s.position}%</span>
          </div>
        ))}
      </div>
      <label className="flex items-center gap-2 text-xs">
        <span className="text-[var(--color-neutral-600)]">{isAr ? 'الزاوية' : 'Angle'}</span>
        <input
          type="range"
          min={0}
          max={360}
          value={value.angle}
          onChange={(e) => onChange({ ...value, angle: Number(e.target.value) })}
          className="flex-1"
        />
        <span className="font-mono w-10 text-end">{value.angle}°</span>
      </label>
    </div>
  );
}

// ─── Padding segmented control ────────────────────────────────────────────
function SegmentedPadding({
  value,
  onChange,
  isAr,
}: {
  value: PaddingPreset;
  onChange: (v: PaddingPreset) => void;
  isAr: boolean;
}) {
  return (
    <div className="flex items-center rounded-lg border border-[var(--color-neutral-200)] p-0.5 bg-[var(--color-neutral-50)] gap-0.5">
      {PADDING_PRESETS.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => onChange(p.id)}
          className={`flex-1 rounded px-1 py-1 text-[11px] font-medium transition-colors ${
            value === p.id
              ? 'bg-white shadow-sm text-[var(--text-primary)]'
              : 'text-[var(--color-neutral-500)] hover:text-[var(--color-neutral-700)]'
          }`}
        >
          {isAr ? p.label_ar : p.label_en}
        </button>
      ))}
    </div>
  );
}

function defaultGradient(): GradientSpec {
  return {
    angle: 180,
    stops: [
      { color: '#FFF5E9', position: 0 },
      { color: '#F47E42', position: 100 },
    ],
  };
}
