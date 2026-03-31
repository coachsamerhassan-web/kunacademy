// @kunacademy/cms — Content Management System
// Singleton provider instance, chosen by environment.
//
// Production: GoogleSheetsProvider (reads from Google Sheets API)
// Development: JsonFileProvider (reads from /data/cms/*.json)
//
// Usage in pages:
//   import { cms } from '@kunacademy/cms';
//   const programs = await cms.getAllPrograms();

import { join } from 'path';
import type { ContentProvider } from './content-provider';
import { JsonFileProvider } from './json-provider';
import { GoogleSheetsProvider } from './sheets-provider';

// Re-export all types and interfaces
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
  CoachLevel,
  SiteSetting,
  SettingsMap,
  PathfinderQuestion,
  PathfinderAnswer,
  Testimonial,
  Event,
  EventLocationType,
  BlogPost,
} from './types';

export { JsonFileProvider } from './json-provider';
export { GoogleSheetsProvider } from './sheets-provider';
export { contentGetter, localize } from './helpers';
export { fetchDocAsHtml, invalidateDocCache } from './google-docs-fetcher';
export { scoreAnswers, calculateRoi } from './pathfinder-scorer';
export type { ScoredAnswer, Recommendation, RoiInputs, RoiResult } from './pathfinder-scorer';

// ── Provider Factory ────────────────────────────────────────────────────────

function createProvider(): ContentProvider {
  const apiKey = process.env.GOOGLE_SHEETS_API_KEY;
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;

  if (apiKey && spreadsheetId) {
    console.log('[cms] Using GoogleSheetsProvider');
    return new GoogleSheetsProvider({
      spreadsheetId,
      apiKey,
      sheetNames: {
        pageContent: process.env.CMS_SHEET_PAGE_CONTENT ?? 'Page Content',
        programs: process.env.CMS_SHEET_PROGRAMS ?? 'Programs',
        services: process.env.CMS_SHEET_SERVICES ?? 'Services',
        team: process.env.CMS_SHEET_TEAM ?? 'Team',
        settings: process.env.CMS_SHEET_SETTINGS ?? 'Settings',
        pathfinder: process.env.CMS_SHEET_PATHFINDER ?? 'Pathfinder',
        testimonials: process.env.CMS_SHEET_TESTIMONIALS ?? 'Testimonials',
        events: process.env.CMS_SHEET_EVENTS ?? 'Events',
        blog: process.env.CMS_SHEET_BLOG ?? 'Blog',
      },
    });
  }

  // Fallback: local JSON files
  const dataDir = process.env.CMS_DATA_DIR ?? join(process.cwd(), 'data', 'cms');
  console.log(`[cms] Using JsonFileProvider from ${dataDir}`);
  return new JsonFileProvider(dataDir);
}

/** Singleton CMS provider — import this in page components */
export const cms: ContentProvider = createProvider();
