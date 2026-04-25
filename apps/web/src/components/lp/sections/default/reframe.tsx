/**
 * Wave 15 Phase 2 Session 1 — extracted from `lp-renderer.tsx`.
 * Reframe — same shell as default but with the larger reframe-style title +
 * centered medium-weight body typography.
 *
 * Behaviour-preserving copy of the original `isReframeType` styling tweak
 * inside `SectionBlock`.
 */

import {
  DefaultSectionShell,
  DefaultSectionBody,
  type DefaultSectionProps,
} from './_shared';

export function DefaultReframeSection(props: DefaultSectionProps) {
  return (
    <DefaultSectionShell
      {...props}
      isReframeType
      body={<DefaultSectionBody section={props.section} isAr={props.isAr} isReframeType />}
    />
  );
}
