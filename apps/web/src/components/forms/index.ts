/**
 * Phase 3 (2026-04-30) — Unified admin form field components.
 *
 * These three components are the building blocks for Phase 4's sweep of
 * all admin editors. They are admin/dashboard/coach/portal scoped only —
 * public pages keep current branding (C2=b locked decision).
 *
 * Net new — nothing to delete from this barrel (first version).
 */

export { DescriptionRichText } from './DescriptionRichText';
export type { DescriptionRichTextProps, DescriptionRichTextLocale } from './DescriptionRichText';

export { MediaLibraryPicker } from './MediaLibraryPicker';
export type { MediaLibraryPickerProps, MediaPickResult } from './MediaLibraryPicker';

export { BilingualFormToggle } from './BilingualFormToggle';
export type { BilingualFormToggleProps, BilingualLocale } from './BilingualFormToggle';
