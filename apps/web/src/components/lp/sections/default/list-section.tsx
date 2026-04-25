/**
 * Wave 15 Phase 2 Session 1 — extracted from `lp-renderer.tsx`.
 *
 * `benefits`, `who_for`, `who_not_for`, `group_alumni`, `carry_out` all
 * share the same dot/icon list rendering in the default theme. Single
 * component reused via the dispatch table.
 *
 * Behaviour-preserving copy of the original `isListType` branch inside
 * `SectionBlock`.
 */

import {
  DefaultSectionShell,
  DefaultSectionBody,
  type DefaultSectionProps,
} from './_shared';

export function DefaultListSection(props: DefaultSectionProps) {
  const { section, isAr } = props;

  const items = section.items && section.items.length > 0 ? (
    <ul className="mt-6 space-y-3">
      {section.items.map((item, i) => {
        const label = isAr ? item.label_ar : item.label_en;
        const itemBody = isAr ? item.body_ar : item.body_en;
        const meta = isAr ? item.meta_ar : item.meta_en;
        const dotColor =
          section.type === 'who_not_for'
            ? 'bg-[var(--color-neutral-400)]'
            : 'bg-[var(--color-accent)]';
        return (
          <li
            key={i}
            className="flex items-start gap-3 text-[var(--color-neutral-700)] leading-relaxed text-base md:text-lg"
          >
            {item.icon ? (
              <span className="text-2xl mt-0.5 flex-shrink-0" aria-hidden>
                {item.icon}
              </span>
            ) : (
              <span
                className={`mt-2.5 w-2 h-2 rounded-full ${dotColor} flex-shrink-0`}
                aria-hidden
              />
            )}
            <div>
              {label && (
                <span className="font-semibold text-[var(--text-primary)]">
                  {label}
                  {itemBody ? ' — ' : ''}
                </span>
              )}
              {itemBody && <span>{itemBody}</span>}
              {meta && (
                <span className="block text-sm text-[var(--color-neutral-500)] mt-1">
                  {meta}
                </span>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  ) : null;

  return (
    <DefaultSectionShell
      {...props}
      body={<DefaultSectionBody section={section} isAr={isAr} />}
      items={items}
    />
  );
}
