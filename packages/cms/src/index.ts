// @kunacademy/cms — Client-safe barrel
// Import from '@kunacademy/cms' in client components and shared utilities.
//
// Server-only exports (cms singleton, GoogleSheetsProvider, JsonFileProvider,
// fetchDocAsHtml, AsyncDocRenderer) are in '@kunacademy/cms/server'.

// ── Type exports ──────────────────────────────────────────────────────────────

export type {
  ContentProvider,
} from './content-provider';

export type {
  BilingualText,
  AuditFields,
  TheaterPricing,
  PageContent,
  PageSections,
  Program,
  ProgramType,
  ProgramFormat,
  NavGroup,
  Service,
  ServiceCategory,
  TeamMember,
  IcfCredential,
  KunLevel,
  ServiceRole,
  SiteSetting,
  SettingsMap,
  PathfinderQuestion,
  PathfinderAnswer,
  Testimonial,
  Event,
  EventLocationType,
  BlogPost,
  Quote,
  CorporateBenefit,
  CorporateBenefitDirection,
  CorporateBenefitsData,
  CorporateBenefitsMode,
  CorporateRoiCategory,
} from './types';

// ── Client-safe function exports ──────────────────────────────────────────────

export { contentGetter, localize } from './helpers';
export { applyDocStyles, DOC_CLASS_MAP, CALLOUT_CLASS_MAP } from './doc-styles';
export type { DocRendererProps } from './doc-renderer.client';
export { DocRenderer } from './doc-renderer.client';
// pathfinder-scorer relocated to apps/web/src/lib/pathfinder-scorer.ts
// (migration 0045, 2026-04-21). CMS package no longer owns scoring logic;
// it's pulled directly by the web app via @/lib/pathfinder-scorer.

export { calculateCorporateRoi } from './benefits-roi-calculator';
export type { CorporateRoiResult, BenefitSavings, CorporateSettings, SelectedBenefit } from './benefits-roi-calculator';
