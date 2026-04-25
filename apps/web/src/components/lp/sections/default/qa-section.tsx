/**
 * Wave 15 Phase 2 Session 1 — extracted from `lp-renderer.tsx`.
 *
 * `objections` + `faq` share the Q/A card stacking in the default theme.
 * Single component reused via the dispatch table.
 *
 * Behaviour-preserving copy of the original `isObjectionType || isFaqType`
 * branch inside `SectionBlock`.
 */

import {
  DefaultSectionShell,
  DefaultSectionBody,
  type DefaultSectionProps,
} from './_shared';

export function DefaultQaSection(props: DefaultSectionProps) {
  const { section, isAr, headingFont } = props;

  const items = section.items && section.items.length > 0 ? (
    <div className="mt-6 space-y-4">
      {section.items.map((item, i) => {
        const q = isAr ? item.label_ar : item.label_en;
        const a = isAr ? item.body_ar : item.body_en;
        return (
          <div
            key={i}
            className="rounded-2xl border border-[var(--color-primary-100)] bg-[var(--color-primary-50)]/40 p-5"
          >
            {q && (
              <p
                className="font-bold text-[var(--text-primary)] mb-2 text-base md:text-lg"
                style={{ fontFamily: headingFont }}
              >
                {q}
              </p>
            )}
            {a && (
              <p className="text-[var(--color-neutral-700)] leading-relaxed">{a}</p>
            )}
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
