/**
 * Wave 15 Phase 2 Session 1 — extracted from gps-sales-renderer.tsx.
 * FAQ — fallback that uses objection card styling.
 */

import type { SectionProps } from './_shared';
import { GpsObjectionsSection } from './objections';

export function GpsFaqSection(props: SectionProps) {
  return <GpsObjectionsSection {...props} />;
}
