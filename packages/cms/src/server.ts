// @kunacademy/cms/server — Server-only CMS exports
// Import from '@kunacademy/cms/server' in server components, API routes,
// and any file that runs exclusively on the Node.js runtime.
//
// ⚠️  DO NOT import this file from 'use client' components.
//     Use '@kunacademy/cms' for the client-safe barrel instead.

import { join } from 'path';
import type { ContentProvider } from './content-provider';
import { JsonFileProvider } from './json-provider';
import { GoogleSheetsProvider } from './sheets-provider';
import { DbContentProvider } from './db-provider';

// ── Re-export server-only modules ────────────────────────────────────────────

export { GoogleSheetsProvider } from './sheets-provider';
export { JsonFileProvider } from './json-provider';
export { DbContentProvider } from './db-provider';
export type { RegionPriceOverride } from './db-provider';
export { fetchDocAsHtml, invalidateDocCache } from './google-docs-fetcher';
export { AsyncDocRenderer } from './doc-renderer.server';

// ── Provider Factory ─────────────────────────────────────────────────────────

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
        quotes: process.env.CMS_SHEET_QUOTES ?? 'Quotes',
      },
    });
  }

  // Default: DB-backed provider (reads migrated entities from Postgres,
  // delegates un-migrated entities to JsonFileProvider).
  // Falls through to pure JSON if DATABASE_URL is also absent (local dev without DB).
  const dataDir = process.env.CMS_DATA_DIR ?? join(process.cwd(), 'data', 'cms');
  if (process.env.DATABASE_URL) {
    console.log(`[cms] Using DbContentProvider (DB + JSON fallback from ${dataDir})`);
    return new DbContentProvider(dataDir);
  }

  console.log(`[cms] Using JsonFileProvider from ${dataDir}`);
  return new JsonFileProvider(dataDir);
}

/** Singleton CMS provider — import this in server components and API routes */
export const cms: ContentProvider = createProvider();
