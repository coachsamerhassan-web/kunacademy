/**
 * Wave 15 Wave 3 canary v2 — Overlay controls (Issue 2 + 3 share).
 *
 * Mirrors WordPress Cover block's overlay layer (see WP UX research §3).
 * Used by:
 *   - BackgroundPanel (when background.type=image|gradient — Issue 3)
 *   - ImageStylingPanel (for full/wide-aligned images that act as covers — Issue 2)
 *
 * Shape:
 *   - Type segmented: none / color / gradient
 *   - Color picker (palette + hex) when type=color
 *   - Gradient editor when type=gradient
 *   - Opacity slider 0–100 (always visible when type ≠ none)
 */

'use client';

import {
  type OverlayConfig,
  type OverlayType,
  type GradientSpec,
} from './styling-types';
import { ColorPicker, GradientEditor } from './background-panel';

interface OverlayControlsProps {
  value: OverlayConfig | undefined;
  onChange: (next: OverlayConfig | undefined) => void;
  isAr: boolean;
}

export function OverlayControls({ value, onChange, isAr }: OverlayControlsProps) {
  const o = value ?? { type: 'none' as OverlayType };

  const setType = (t: OverlayType) => {
    if (t === 'none') {
      onChange(undefined);
      return;
    }
    onChange({ ...o, type: t, opacity: o.opacity ?? 50 });
  };

  return (
    <div className="space-y-2 rounded-lg border border-[var(--color-neutral-200)] p-2 bg-[var(--color-neutral-50)]/50">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-neutral-600)]">
        {isAr ? 'تغطية' : 'Overlay'}
      </div>
      <div className="flex items-center rounded-lg border border-[var(--color-neutral-200)] p-0.5 bg-white gap-0.5">
        {(['none', 'color', 'gradient'] as OverlayType[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setType(t)}
            className={`flex-1 rounded px-2 py-0.5 text-[11px] font-medium transition-colors ${
              o.type === t
                ? 'bg-[var(--color-neutral-100)] text-[var(--text-primary)]'
                : 'text-[var(--color-neutral-500)] hover:text-[var(--color-neutral-700)]'
            }`}
          >
            {isAr
              ? t === 'none'
                ? 'بدون'
                : t === 'color'
                ? 'لون'
                : 'تدرّج'
              : t === 'none'
              ? 'None'
              : t === 'color'
              ? 'Color'
              : 'Gradient'}
          </button>
        ))}
      </div>
      {o.type === 'color' && (
        <ColorPicker
          value={o.color ?? '#000000'}
          onChange={(c) => onChange({ ...o, type: 'color', color: c })}
          isAr={isAr}
        />
      )}
      {o.type === 'gradient' && (
        <GradientEditor
          value={o.gradient ?? defaultOverlayGradient()}
          onChange={(g: GradientSpec) => onChange({ ...o, type: 'gradient', gradient: g })}
          isAr={isAr}
        />
      )}
      {o.type !== 'none' && (
        <label className="flex items-center gap-2 text-xs">
          <span className="text-[var(--color-neutral-600)] shrink-0 w-12">
            {isAr ? 'العتامة' : 'Opacity'}
          </span>
          <input
            type="range"
            min={0}
            max={100}
            value={o.opacity ?? 50}
            onChange={(e) => onChange({ ...o, opacity: Number(e.target.value) })}
            className="flex-1"
            aria-label={isAr ? 'العتامة' : 'Opacity'}
          />
          <span className="font-mono w-10 text-end">{o.opacity ?? 50}%</span>
        </label>
      )}
    </div>
  );
}

function defaultOverlayGradient(): GradientSpec {
  return {
    angle: 180,
    stops: [
      { color: '#000000', position: 0 },
      { color: '#000000', position: 100 },
    ],
  };
}
