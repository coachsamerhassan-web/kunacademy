/**
 * Wave 15 Phase 2 Session 1 — extracted from `lp-renderer.tsx`.
 *
 * `format` + `price` share the 2-3 col card grid in the default theme.
 * Single component reused via the dispatch table.
 *
 * Behaviour-preserving copy of the original `isFormatType || isPriceType`
 * branch inside `SectionBlock`.
 */

import {
  DefaultSectionShell,
  DefaultSectionBody,
  type DefaultSectionProps,
} from './_shared';

export function DefaultGridSection(props: DefaultSectionProps) {
  const { section, isAr } = props;
  const isPriceType = section.type === 'price';

  const items = section.items && section.items.length > 0 ? (
    <div
      className={`mt-6 grid gap-4 ${section.items.length > 2 ? 'sm:grid-cols-2 md:grid-cols-3' : 'sm:grid-cols-2'}`}
    >
      {section.items.map((item, i) => {
        const label = isAr ? item.label_ar : item.label_en;
        const itemBody = isAr ? item.body_ar : item.body_en;
        const meta = isAr ? item.meta_ar : item.meta_en;
        return (
          <div
            key={i}
            className="rounded-2xl border border-[var(--color-primary-100)] bg-white p-5"
          >
            {item.icon && (
              <div className="text-3xl mb-3" aria-hidden>
                {item.icon}
              </div>
            )}
            {label && (
              <p className="text-sm font-semibold text-[var(--color-neutral-500)] uppercase tracking-wide mb-1">
                {label}
              </p>
            )}
            {itemBody && (
              <p
                className={`text-[var(--text-primary)] ${isPriceType ? 'text-2xl md:text-3xl font-bold' : 'text-lg font-medium'}`}
              >
                {itemBody}
              </p>
            )}
            {meta && (
              <p className="text-sm text-[var(--color-neutral-500)] mt-1">{meta}</p>
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
