// SamerQuote — Server Component
// Fetches the daily rotating quote from the CMS and returns a typed quote object.
// Usage: pass the returned DailyQuoteData to Header (dailyQuote prop) and Footer (dailyQuote prop).
//
// Algorithm:
//   Step 1: Count days since the first quote's date (the epoch)
//   Step 2: Modulo total quotes → loops indefinitely after exhausting all 200
//   header quote → index for today
//   footer quote → index + 1 (always the next quote, guaranteeing a different one)
//
// Source of truth: @kunacademy/cms singleton (DbContentProvider in production,
// JsonFileProvider in local dev without DATABASE_URL). Previously bypassed the
// CMS abstraction by reading quotes.json directly from disk — rewired in
// Phase 1b-Step3 so quotes flow through the provider layer like all other CMS
// entities and stay DB-driven after Phase 1b-Step1 migration.

import { cms } from '@kunacademy/cms/server';
import type { Quote } from '@kunacademy/cms';

export interface DailyQuoteData {
  content_ar: string;
  content_en: string;
  author_ar: string;
  author_en: string;
}

/** First quote's scheduled date — the epoch for rotation. */
const QUOTE_EPOCH = '2026-04-07';

/**
 * Pick a quote index. Days since epoch mod total = infinite loop.
 * `offset` shifts the index (footer = +1 so it's always a different quote).
 */
function pickQuote(
  quotes: Array<Pick<Quote, 'date'>>,
  offset: number
): number {
  if (quotes.length === 0) return 0;

  const today = new Date();
  const epoch = new Date(QUOTE_EPOCH);
  const daysSinceEpoch = Math.floor((today.getTime() - epoch.getTime()) / 86_400_000);

  // Modulo ensures infinite looping: day 200 → index 0, day 201 → index 1, etc.
  return ((daysSinceEpoch + offset) % quotes.length + quotes.length) % quotes.length;
}

/**
 * Fetch both quotes (header + footer) in one CMS call.
 * Returns null for each slot if no quotes are available.
 */
export async function getDailyQuotes(): Promise<{
  header: DailyQuoteData | null;
  footer: DailyQuoteData | null;
}> {
  try {
    const quotes = await cms.getAllQuotes();
    if (!quotes || quotes.length === 0) {
      return { header: null, footer: null };
    }

    const headerIdx = pickQuote(quotes, 0);
    const footerIdx = pickQuote(quotes, 1);

    const toData = (q: Quote): DailyQuoteData => ({
      content_ar: q.content_ar,
      content_en: q.content_en,
      author_ar: q.author_ar,
      author_en: q.author_en,
    });

    return {
      header: toData(quotes[headerIdx]),
      footer: toData(quotes[footerIdx]),
    };
  } catch (err) {
    console.error('[samer-quote] Failed to load quotes:', err);
    return { header: null, footer: null };
  }
}
