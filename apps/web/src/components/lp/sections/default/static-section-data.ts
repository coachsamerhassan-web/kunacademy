/**
 * Wave 15 Wave 4 PRECURSOR — Server-only data loader for static sections.
 *
 * The DB-reading static section types (team_grid, testimonial_grid,
 * program_card_strip) need data resolved before they render. This module
 * is THE single point where the cms helpers are called for those sections.
 *
 * Why a separate file: lp-renderer.tsx is reachable from a client component
 * (canvas.tsx in the editor) by Next.js's bundler-trace. If the renderer file
 * itself imported `@kunacademy/cms/server`, the entire `googleapis` /
 * `node-fetch` / `node:net` chain would be pulled into the client bundle,
 * which fails to chunk. By gating that import behind `import 'server-only'`
 * in this dedicated file, we get a clean error if anything client-bound
 * tries to traverse it.
 *
 * Contract:
 *   - lp-renderer.tsx is itself a Server Component. When rendered as part
 *     of a server tree (the public route), it CAN call this module's
 *     loader functions and resolve real data.
 *   - When canvas.tsx (client) wants to preview a static_pages composition,
 *     the editor's preview path uses lp-renderer rendered with EMPTY
 *     pre-resolved data (no DB calls) → DB-reading sections render their
 *     empty/placeholder state.
 *
 * The lp-renderer's `loadStaticSectionData` helper traverses
 * composition.sections and returns a Map keyed by section index whose
 * values are the resolved data for that section type.
 */

import 'server-only';
import { cms } from '@kunacademy/cms/server';

export interface ResolvedTestimonial {
  id: string;
  name_ar: string;
  name_en: string;
  content_ar: string;
  content_en: string;
  role_ar?: string;
  role_en?: string;
  photo_url?: string;
  program: string;
  display_order: number;
}

export interface ResolvedCoach {
  slug: string;
  name_ar: string;
  name_en: string;
  title_ar?: string;
  title_en?: string;
  photo_url?: string;
  bio_ar?: string;
  bio_en?: string;
}

export interface ResolvedProgram {
  slug: string;
  title_ar: string;
  title_en: string;
  subtitle_ar?: string;
  subtitle_en?: string;
  duration?: string;
  thumbnail_url?: string;
  is_free: boolean;
}

export type StaticSectionData =
  | { kind: 'testimonial_grid'; testimonials: ResolvedTestimonial[] }
  | { kind: 'team_grid'; coaches: ResolvedCoach[] }
  | { kind: 'program_card_strip'; programs: ResolvedProgram[] };

/** Load testimonials for a testimonial_grid section payload. */
export async function loadTestimonialGridData(section: Record<string, unknown>): Promise<ResolvedTestimonial[]> {
  const programFilter = section.program_filter as string | null | undefined;
  const featuredOnly = section.featured_only !== false;
  const maxCount =
    typeof section.max_count === 'number' && section.max_count > 0 ? section.max_count : 6;

  try {
    const all = featuredOnly ? await cms.getFeaturedTestimonials() : await cms.getAllTestimonials();
    let filtered = all;
    if (programFilter && typeof programFilter === 'string' && programFilter.length > 0) {
      const needle = programFilter.toLowerCase();
      filtered = all.filter((t) => (t.program || '').toLowerCase().includes(needle));
    }
    filtered = [...filtered].sort((a, b) => a.display_order - b.display_order);
    return filtered.slice(0, maxCount).map((t) => ({
      id: t.id,
      name_ar: t.name_ar,
      name_en: t.name_en,
      content_ar: t.content_ar,
      content_en: t.content_en,
      role_ar: t.role_ar,
      role_en: t.role_en,
      photo_url: t.photo_url,
      program: t.program,
      display_order: t.display_order,
    }));
  } catch (err) {
    console.error('[static-section-data.loadTestimonialGridData] load failed:', err);
    return [];
  }
}

/** Load coaches for a team_grid section payload. */
export async function loadTeamGridData(section: Record<string, unknown>): Promise<ResolvedCoach[]> {
  const coachSlugsRaw = section.coach_slugs;
  const coachSlugs: string[] = Array.isArray(coachSlugsRaw)
    ? (coachSlugsRaw as string[]).filter((s) => typeof s === 'string' && s.length > 0)
    : [];
  const maxCount =
    typeof section.max_count === 'number' && section.max_count > 0 ? section.max_count : null;

  try {
    if (coachSlugs.length > 0) {
      const fetched = await Promise.all(
        coachSlugs.map((slug) => cms.getTeamMember(slug).catch(() => null)),
      );
      return fetched
        .filter((c): c is NonNullable<typeof c> => c !== null)
        .map((c) => ({
          slug: c.slug,
          name_ar: c.name_ar,
          name_en: c.name_en,
          title_ar: c.title_ar,
          title_en: c.title_en,
          photo_url: c.photo_url,
          bio_ar: c.bio_ar,
          bio_en: c.bio_en,
        }));
    }
    const all = await cms.getBookableCoaches();
    const sliced = maxCount ? all.slice(0, maxCount) : all;
    return sliced.map((c) => ({
      slug: c.slug,
      name_ar: c.name_ar,
      name_en: c.name_en,
      title_ar: c.title_ar,
      title_en: c.title_en,
      photo_url: c.photo_url,
      bio_ar: c.bio_ar,
      bio_en: c.bio_en,
    }));
  } catch (err) {
    console.error('[static-section-data.loadTeamGridData] load failed:', err);
    return [];
  }
}

/** Load programs for a program_card_strip section payload.
 *  Always reads from PROGRAM-CANON.md source-of-truth via cms.getProgram /
 *  cms.getFeaturedPrograms. Never returns hardcoded metadata. */
export async function loadProgramCardStripData(section: Record<string, unknown>): Promise<ResolvedProgram[]> {
  const programSlugsRaw = section.program_slugs;
  const programSlugs: string[] = Array.isArray(programSlugsRaw)
    ? (programSlugsRaw as string[]).filter((s) => typeof s === 'string' && s.length > 0)
    : [];
  const maxCount =
    typeof section.max_count === 'number' && section.max_count > 0 ? section.max_count : 4;

  try {
    let programs;
    if (programSlugs.length > 0) {
      const fetched = await Promise.all(
        programSlugs.map((slug) => cms.getProgram(slug).catch(() => null)),
      );
      programs = fetched.filter((p): p is NonNullable<typeof p> => p !== null);
    } else {
      const allFeatured = await cms.getFeaturedPrograms();
      programs = allFeatured.slice(0, maxCount);
    }
    return programs.map((p) => ({
      slug: p.slug,
      title_ar: p.title_ar,
      title_en: p.title_en,
      subtitle_ar: p.subtitle_ar,
      subtitle_en: p.subtitle_en,
      duration: p.duration,
      thumbnail_url: p.thumbnail_url,
      is_free: p.is_free,
    }));
  } catch (err) {
    console.error('[static-section-data.loadProgramCardStripData] load failed:', err);
    return [];
  }
}

/** Pre-resolve data for all DB-reading sections in a composition.
 *  Returns a Map keyed by section index → kind-tagged data. */
export async function preloadStaticSectionData(
  sections: Array<Record<string, unknown>>,
): Promise<Map<number, StaticSectionData>> {
  const out = new Map<number, StaticSectionData>();
  await Promise.all(
    sections.map(async (s, idx) => {
      const t = s.type as string;
      if (t === 'testimonial_grid') {
        const testimonials = await loadTestimonialGridData(s);
        out.set(idx, { kind: 'testimonial_grid', testimonials });
      } else if (t === 'team_grid') {
        const coaches = await loadTeamGridData(s);
        out.set(idx, { kind: 'team_grid', coaches });
      } else if (t === 'program_card_strip') {
        const programs = await loadProgramCardStripData(s);
        out.set(idx, { kind: 'program_card_strip', programs });
      }
    }),
  );
  return out;
}
