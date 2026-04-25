/**
 * Wave 15 Phase 2 Session 1 — extracted from `lp-renderer.tsx`.
 * Default prose section — `mirror`, `description`, `custom`. Title + body
 * only, no items list, no special grid.
 *
 * Behaviour-preserving copy of the no-special-branch path inside the original
 * `SectionBlock` (i.e. anything that isn't list / grid / Q&A / credibility /
 * cta / reframe).
 */

import {
  DefaultSectionShell,
  DefaultSectionBody,
  type DefaultSectionProps,
} from './_shared';

export function DefaultProseSection(props: DefaultSectionProps) {
  return (
    <DefaultSectionShell
      {...props}
      body={<DefaultSectionBody section={props.section} isAr={props.isAr} />}
    />
  );
}
