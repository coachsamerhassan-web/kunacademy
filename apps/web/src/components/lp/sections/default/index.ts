/**
 * Wave 15 Phase 2 Session 1 — barrel for default-theme section components.
 *
 * The renderer dispatches via SECTION_COMPONENTS (built in `lp-renderer.tsx`).
 * Multiple section types share components (e.g. `benefits` + `who_for` +
 * `who_not_for` + `group_alumni` + `carry_out` all use DefaultListSection).
 */

export { DefaultHero } from './hero';
export { DefaultCtaSection } from './cta';
export { DefaultListSection } from './list-section';
export { DefaultGridSection } from './grid-section';
export { DefaultQaSection } from './qa-section';
export { DefaultCredibilitySection } from './credibility';
export { DefaultReframeSection } from './reframe';
export { DefaultProseSection } from './prose';
export { DefaultSectionShell, DefaultSectionBody } from './_shared';
export type { DefaultSectionProps } from './_shared';
