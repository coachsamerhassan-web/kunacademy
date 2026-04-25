/**
 * Wave 15 Phase 2 Session 1 — extracted from `lp-renderer.tsx`.
 * Credibility (trainer/host credentials) — pill row layout.
 *
 * Behaviour-preserving copy of the original `isCredibilityType` branch
 * inside `SectionBlock`.
 */

import {
  DefaultSectionShell,
  DefaultSectionBody,
  type DefaultSectionProps,
} from './_shared';

export function DefaultCredibilitySection(props: DefaultSectionProps) {
  const { section, isAr } = props;

  const items = section.items && section.items.length > 0 ? (
    <div className="mt-6 space-y-3">
      {section.items.map((item, i) => {
        const label = isAr ? item.label_ar : item.label_en;
        const itemBody = isAr ? item.body_ar : item.body_en;
        return (
          <div key={i} className="flex items-start gap-3">
            <span className="text-xl mt-0.5" aria-hidden>
              {item.icon || '🏅'}
            </span>
            <div>
              {label && (
                <p className="font-semibold text-[var(--text-primary)]">{label}</p>
              )}
              {itemBody && (
                <p className="text-[var(--color-neutral-600)] leading-relaxed">
                  {itemBody}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  ) : null;

  return (
    <DefaultSectionShell
      {...props}
      body={<DefaultSectionBody section={section} isAr={isAr} />}
      items={items}
    />
  );
}
