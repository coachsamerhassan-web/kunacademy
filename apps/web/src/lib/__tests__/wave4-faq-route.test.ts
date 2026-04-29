/**
 * Wave 15 Wave 4 Route 1 (2026-04-29) — /faq route migration tests.
 *
 * Coverage:
 *   1. Migration script (`scripts/migrate-static-page-faq.ts`):
 *      - is idempotent (UPSERT via ON CONFLICT (slug))
 *      - emits the expected 32 items (8 collections concatenated) using the
 *        faq_accordion default-payload shape (q_ar/q_en/a_ar/a_en flat fields)
 *      - populates hero_json with PageHero-compatible field names
 *      - populates seo_meta_json with bilingual title + description
 *      - sets status='published' on first insert; preserves existing status on
 *        re-run if already past draft (admin workflow protection)
 *
 *   2. Route renderer (`apps/web/src/app/[locale]/faq/page.tsx`):
 *      - imports from @kunacademy/db (slug fetch via Drizzle eq)
 *      - calls notFound() on missing row + on unpublished-for-non-admin
 *      - calls preloadStaticSectionData() (server-only data loader)
 *      - dispatches all 7 static-specific section types + 6 universal types
 *      - has NO imports from @/data/faqs (data now lives on the DB row)
 *
 *   3. next.config.ts (commit 5b5b75e):
 *      - the /:locale/faq → /:locale/contact 308 redirect is GONE
 *      - the transitional Cache-Control: no-cache header for /:locale/faq
 *        is present (TTL ~30 days post-deploy)
 *
 * NOTE: rendered verify (curl 200, JSON-LD presence, Q&A markers in body)
 * runs at the deploy-verify step in the deploy report — NOT in this test
 * suite. This file validates structure, not runtime HTML.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const REPO_ROOT = resolve(__dirname, '../../../../..');
const MIGRATION_SCRIPT_PATH = resolve(REPO_ROOT, 'scripts/migrate-static-page-faq.ts');
const ROUTE_PATH = resolve(__dirname, '../../app/[locale]/faq/page.tsx');
const NEXT_CONFIG_PATH = resolve(__dirname, '../../../next.config.ts');

describe('Wave 15 W4 R1 / migration script (scripts/migrate-static-page-faq.ts)', () => {
  test('script file exists and is executable-shaped (npx tsx shebang)', () => {
    const src = readFileSync(MIGRATION_SCRIPT_PATH, 'utf8');
    assert.match(src.split('\n')[0], /^#!\/usr\/bin\/env npx tsx/, 'expected npx tsx shebang on line 1');
  });

  test('script supports DRY_RUN, EMIT_SQL, and DATABASE_URL paths', () => {
    const src = readFileSync(MIGRATION_SCRIPT_PATH, 'utf8');
    assert.match(src, /DRY_RUN/, 'script must support DRY_RUN env var');
    assert.match(src, /EMIT_SQL/, 'script must support EMIT_SQL env var');
    assert.match(src, /DATABASE_URL/, 'script must support DATABASE_URL env var');
  });

  test('script is idempotent — UPSERT via ON CONFLICT (slug)', () => {
    const src = readFileSync(MIGRATION_SCRIPT_PATH, 'utf8');
    assert.match(
      src,
      /ON CONFLICT \(slug\) DO UPDATE/,
      'script must include ON CONFLICT (slug) DO UPDATE for idempotency',
    );
  });

  test('script INSERTs slug=faq + kind=static + status=published + published=true', () => {
    const src = readFileSync(MIGRATION_SCRIPT_PATH, 'utf8');
    assert.match(src, /'faq'/, 'must seed slug=faq');
    assert.match(src, /'static'/, 'must seed kind=static');
    assert.match(src, /'published'/, 'must seed status=published');
    assert.match(src, /\btrue\b/, 'must seed published=true');
  });

  test('script preserves admin workflow on re-run (does not force-publish if past draft)', () => {
    // The CASE expression on UPDATE prevents accidentally overwriting a
    // hard-won review/published/archived status on an admin's row when
    // the seed is re-run (defence in depth — once the editor canvas
    // owns the row, the seed must not regress workflow state).
    const src = readFileSync(MIGRATION_SCRIPT_PATH, 'utf8');
    assert.match(
      src,
      /CASE\s+WHEN static_pages\.status = 'draft'/,
      'UPSERT must guard status flip behind a status=draft CASE',
    );
  });

  test('script emits flat faq_accordion items (q_ar/q_en/a_ar/a_en field shape)', () => {
    const src = readFileSync(MIGRATION_SCRIPT_PATH, 'utf8');
    assert.match(src, /q_ar/, 'must use flat q_ar field');
    assert.match(src, /q_en/, 'must use flat q_en field');
    assert.match(src, /a_ar/, 'must use flat a_ar field');
    assert.match(src, /a_en/, 'must use flat a_en field');
  });

  test('script source contains 32 source items (8 collections concatenated)', () => {
    const src = readFileSync(MIGRATION_SCRIPT_PATH, 'utf8');
    // Each FAQ row in the source has the literal "ar: { q:" pattern.
    const matches = src.match(/ar:\s*\{\s*q:/g);
    const count = matches ? matches.length : 0;
    assert.ok(
      count >= 32,
      `expected at least 32 source FAQ items in script (found ${count})`,
    );
  });

  test('script populates hero_json with PageHero-compatible fields', () => {
    const src = readFileSync(MIGRATION_SCRIPT_PATH, 'utf8');
    assert.match(src, /title_ar:.*'الأسئلة الشائعة'/, 'hero must carry AR title');
    assert.match(src, /title_en:.*'Frequently Asked Questions'/, 'hero must carry EN title');
    assert.match(src, /eyebrow_ar:.*'الدعم'/, 'hero must carry AR eyebrow');
    assert.match(src, /pattern:.*'flower-of-life'/, 'hero must carry pattern=flower-of-life');
  });

  test('script populates seo_meta_json with bilingual title + description', () => {
    const src = readFileSync(MIGRATION_SCRIPT_PATH, 'utf8');
    assert.match(src, /meta_title_ar/, 'seo must include meta_title_ar');
    assert.match(src, /meta_title_en/, 'seo must include meta_title_en');
    assert.match(src, /meta_description_ar/, 'seo must include meta_description_ar');
    assert.match(src, /meta_description_en/, 'seo must include meta_description_en');
  });
});

describe('Wave 15 W4 R1 / route renderer (apps/web/src/app/[locale]/faq/page.tsx)', () => {
  test('route file fetches via @kunacademy/db static_pages slug=faq', () => {
    const src = readFileSync(ROUTE_PATH, 'utf8');
    assert.match(
      src,
      /from\s+['"]@kunacademy\/db['"]/,
      'route must import from @kunacademy/db (Drizzle ORM client)',
    );
    assert.match(
      src,
      /static_pages/,
      'route must reference the static_pages schema',
    );
    assert.match(
      src,
      /eq\(static_pages\.slug,\s*'faq'\)/,
      'route must filter by slug=faq via Drizzle eq()',
    );
  });

  test('route file calls notFound() (404 path)', () => {
    const src = readFileSync(ROUTE_PATH, 'utf8');
    assert.match(src, /notFound\s*\(\s*\)/, 'route must call notFound() on missing row');
  });

  test('route file gates drafts behind admin role check', () => {
    const src = readFileSync(ROUTE_PATH, 'utf8');
    assert.match(src, /super_admin|content_editor|isAdmin/, 'route must check admin role for draft visibility');
    assert.match(
      src,
      /withAdminContext/,
      'route must use withAdminContext for the draft-preview path',
    );
  });

  test('route file preloads DB-reading sections via preloadStaticSectionData', () => {
    const src = readFileSync(ROUTE_PATH, 'utf8');
    assert.match(
      src,
      /preloadStaticSectionData/,
      'route must call preloadStaticSectionData() for DB-reading sections',
    );
  });

  test('route file dispatches all 7 static-specific section types', () => {
    const src = readFileSync(ROUTE_PATH, 'utf8');
    const required = [
      'StaticFaqAccordionSection',
      'StaticMethodologyPillarSection',
      'StaticPhilosophyStatementSection',
      'StaticContactFormSection',
      'StaticTeamGridSection',
      'StaticTestimonialGridSection',
      'StaticProgramCardStripSection',
    ];
    for (const name of required) {
      assert.match(src, new RegExp(`\\b${name}\\b`), `route must reference ${name}`);
    }
  });

  test('route file dispatches all 6 universal section types', () => {
    const src = readFileSync(ROUTE_PATH, 'utf8');
    const required = [
      'UniversalImageSection',
      'UniversalVideoSection',
      'UniversalHeaderSection',
      'UniversalBodySection',
      'UniversalQuoteSection',
      'UniversalDividerSection',
    ];
    for (const name of required) {
      assert.match(src, new RegExp(`\\b${name}\\b`), `route must reference ${name}`);
    }
  });

  test('route file generates SEO metadata from seo_meta_json', () => {
    const src = readFileSync(ROUTE_PATH, 'utf8');
    assert.match(src, /generateMetadata/, 'route must export generateMetadata');
    assert.match(src, /seo_meta_json/, 'metadata must read from seo_meta_json');
  });

  test('route file does NOT import legacy @/data/faqs collections', () => {
    const src = readFileSync(ROUTE_PATH, 'utf8');
    assert.doesNotMatch(
      src,
      /from\s+['"]@\/data\/faqs['"]/,
      'route must NOT import from @/data/faqs (data now lives on the DB row)',
    );
    // Stronger: none of the 8 named imports should appear at all
    const legacyImports = [
      'aboutFaqs',
      'methodologyFaqs',
      'programsFaqs',
      'stceFaqs',
      'coachingFaqs',
      'corporateFaqs',
      'familyFaqs',
      'bookingFaqs',
    ];
    for (const name of legacyImports) {
      assert.doesNotMatch(
        src,
        new RegExp(`\\b${name}\\b`),
        `route must NOT reference legacy collection ${name}`,
      );
    }
  });

  test('route file does NOT import @kunacademy/ui FAQSection or faqJsonLd directly (renderer handles it)', () => {
    const src = readFileSync(ROUTE_PATH, 'utf8');
    assert.doesNotMatch(
      src,
      /from\s+['"]@kunacademy\/ui\/faq-section['"]/,
      'route must NOT import FAQSection — the static-section renderer wraps it',
    );
    assert.doesNotMatch(
      src,
      /from\s+['"]@kunacademy\/ui\/faq-jsonld['"]/,
      'route must NOT import faqJsonLd — the renderer auto-emits JSON-LD',
    );
  });

  test('route file uses PageHero from hero_json (Open Q 7.7 design decision)', () => {
    const src = readFileSync(ROUTE_PATH, 'utf8');
    assert.match(src, /PageHero/, 'route must render PageHero');
    assert.match(src, /hero_json/, 'route must read hero from hero_json');
    assert.match(src, /hero\.title_ar|hero\.title_en/, 'route must read hero.title_ar/en');
  });
});

describe('Wave 15 W4 R1 / next.config.ts (redirect-removal + cache-clearing)', () => {
  test('next.config.ts no longer redirects /:locale/faq → /:locale/contact (308)', () => {
    const src = readFileSync(NEXT_CONFIG_PATH, 'utf8');
    // The legacy redirect line was:
    //   { source: '/:locale/faq', destination: '/:locale/contact', permanent: true },
    // After Step 1 (commit 5b5b75e) this line is gone.
    // We assert NO active `redirects()` rule maps /:locale/faq → /contact.
    // Match the full structural shape (handles spacing variations).
    assert.doesNotMatch(
      src,
      /\{\s*source:\s*['"]\/:locale\/faq['"]\s*,\s*destination:\s*['"]\/:locale\/contact['"]/,
      '/:locale/faq → /:locale/contact 308 redirect must be removed',
    );
  });

  test('next.config.ts emits a transitional no-cache header for /:locale/faq', () => {
    const src = readFileSync(NEXT_CONFIG_PATH, 'utf8');
    // The headers() rule we added in commit 5b5b75e — Cache-Control: no-cache,
    // no-store, must-revalidate on /:locale/faq for ~30 days post-deploy.
    assert.match(
      src,
      /source:\s*['"]\/:locale\/faq['"]/,
      'next.config.ts must have a headers() rule scoped to /:locale/faq',
    );
    assert.match(
      src,
      /Cache-Control[\s\S]*no-cache/,
      'the /:locale/faq headers() rule must include Cache-Control: no-cache',
    );
  });

  test('next.config.ts cache-control rule has a TTL marker comment', () => {
    // The dispatch instructed adding a TODO comment marking the 30-day TTL
    // (2026-05-29). The verifier reads this so the pre-commit CI catches a
    // forgotten clean-up after the cache window expires.
    const src = readFileSync(NEXT_CONFIG_PATH, 'utf8');
    assert.match(
      src,
      /2026-05-29|TTL|30\s*days/i,
      'next.config.ts cache-control rule must have a TTL marker (date or "TTL")',
    );
  });
});
