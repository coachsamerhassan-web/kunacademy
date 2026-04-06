import Image from 'next/image';
import { setRequestLocale } from 'next-intl/server';
import { cms } from '@kunacademy/cms/server';
import { Section } from '@kunacademy/ui/section';
import { GeometricPattern } from '@kunacademy/ui/patterns';
import type { Metadata } from 'next';

interface Props {
  params: Promise<{ locale: string }>;
}

// Bilingual category label mapping
const CATEGORY_LABELS: Record<string, { en: string; ar: string }> = {
  methodology: { en: 'Methodology', ar: 'المنهجية' },
  coaching: { en: 'Coaching', ar: 'الكوتشينج' },
  certification: { en: 'Certification', ar: 'الشهادات' },
  retreats: { en: 'Retreats', ar: 'الخلوات' },
  'programs-and-events': { en: 'Programs & Events', ar: 'البرامج والفعاليات' },
};

// Category → subtle accent color mapping for imageless cards (lowercase keys to match CMS data)
const CATEGORY_COLORS: Record<string, string> = {
  methodology: '#474099',
  coaching: '#F47E42',
  certification: '#5B8DB8',
  retreats: '#6BAA75',
  'programs-and-events': '#B5783A',
  Default: '#9B8FBF',
};

function getCategoryColor(category?: string | null): string {
  if (!category) return CATEGORY_COLORS.Default;
  return CATEGORY_COLORS[category.toLowerCase()] ?? CATEGORY_COLORS.Default;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const isAr = locale === 'ar';
  return {
    title: isAr ? 'أفكار واستكشافات | أكاديمية كُن' : 'Ideas & Explorations | Kun Academy',
    description: isAr
      ? 'كتابات عن الحضور والكوتشينج ومعنى النمو'
      : 'Writings on presence, coaching, and what it means to grow',
  };
}

export default async function BlogPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  const allPosts = await cms.getAllBlogPosts();

  // Include posts that have a title in either locale.
  // Articles not yet translated to the current locale still appear using the
  // other locale's title/excerpt, so the listing page is never artificially empty.
  const posts = allPosts.filter((p) => {
    const primary = isAr ? p.title_ar : p.title_en;
    const fallback = isAr ? p.title_en : p.title_ar;
    return (primary && primary.trim().length > 0) || (fallback && fallback.trim().length > 0);
  });

  // Extract unique categories
  const categories = [...new Set(posts.map((p) => p.category).filter(Boolean))] as string[];

  const headingFont = isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)';
  const bodyFont = isAr ? 'var(--font-arabic-body)' : undefined;
  const dir = isAr ? 'rtl' : 'ltr';

  // Bilingual fallback helpers — prefer current locale, fall back to the other.
  // Used so English-only articles still appear on /ar/blog (and vice-versa).
  const getTitle = (p: { title_ar?: string | null; title_en?: string | null }) =>
    (isAr ? p.title_ar : p.title_en) || (isAr ? p.title_en : p.title_ar) || '';
  const getExcerpt = (p: { excerpt_ar?: string | null; excerpt_en?: string | null }) =>
    (isAr ? p.excerpt_ar : p.excerpt_en) || (isAr ? p.excerpt_en : p.excerpt_ar) || undefined;

  return (
    <main dir={dir} style={bodyFont ? { fontFamily: bodyFont } : undefined}>

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section
        className="relative py-20 md:py-28"
        style={{ background: 'var(--color-background)' }}
      >
        {/* Very faint geometric texture — kept but barely visible */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.06]" aria-hidden="true">
          <GeometricPattern pattern="flower-of-life" opacity={1} fade="both" />
        </div>

        {/* Warm horizontal rule at the very bottom of the hero */}
        <div
          className="absolute bottom-0 left-0 right-0 h-px"
          style={{ background: 'linear-gradient(to right, transparent, var(--color-primary), transparent)', opacity: 0.25 }}
          aria-hidden="true"
        />

        <div className="relative z-10 mx-auto max-w-5xl px-6 text-center">
          {/* Overline / label */}
          <p
            className="text-xs tracking-[0.25em] uppercase mb-5 font-medium"
            style={{ color: 'var(--color-accent)' }}
          >
            {isAr ? 'كُن · أكاديمية الكوتشينج' : 'Kun Coaching Academy'}
          </p>

          <h1
            className="text-[2.5rem] md:text-[3.75rem] font-bold leading-[1.15] text-[var(--text-primary)]"
            style={{ fontFamily: headingFont }}
          >
            {isAr ? 'أفكار واستكشافات' : 'Ideas & Explorations'}
          </h1>

          <p
            className="mt-5 text-lg md:text-xl max-w-xl mx-auto leading-relaxed"
            style={{ color: 'var(--text-muted)' }}
          >
            {isAr
              ? 'كتابات عن الحضور والكوتشينج ومعنى النمو'
              : 'Writings on presence, coaching, and what it means to grow'}
          </p>
        </div>
      </section>

      {/* ── CONTENT ──────────────────────────────────────────────────────── */}
      <Section variant="white">
        <div className="mx-auto max-w-5xl px-6">

          {posts.length > 0 ? (
            <>

              {/* ── CATEGORY TABS ─────────────────────────────────────────── */}
              {categories.length > 1 && (
                <nav
                  aria-label={isAr ? 'تصفية المقالات' : 'Filter articles'}
                  className="flex flex-wrap gap-x-7 gap-y-2 mb-14 border-b"
                  style={{ borderColor: 'var(--color-neutral-200)' }}
                >
                  {/* "All" tab — active by default (static, no JS filter needed) */}
                  <span
                    className="relative pb-3 text-sm font-medium cursor-pointer select-none"
                    style={{ color: 'var(--color-primary)' }}
                  >
                    {isAr ? 'الكل' : 'All'}
                    {/* Active underline */}
                    <span
                      className="absolute bottom-[-1px] left-0 right-0 h-[2px] rounded-full"
                      style={{ background: 'var(--color-primary)' }}
                      aria-hidden="true"
                    />
                  </span>

                  {categories.map((cat) => {
                    const catKey = cat.toLowerCase();
                    const label = CATEGORY_LABELS[catKey]?.[isAr ? 'ar' : 'en'] || cat;
                    return (
                      <a
                        key={cat}
                        href={`/${locale}/blog/category/${encodeURIComponent(cat)}`}
                        className="relative pb-3 text-sm font-medium transition-colors duration-200 group"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        {label}
                        {/* Hover underline */}
                        <span
                          className="absolute bottom-[-1px] left-0 right-0 h-[2px] rounded-full scale-x-0 group-hover:scale-x-100 transition-transform duration-200 origin-left"
                          style={{ background: 'var(--color-primary)' }}
                          aria-hidden="true"
                        />
                      </a>
                    );
                  })}
                </nav>
              )}

              {/* ── FEATURED POST ─────────────────────────────────────────── */}
              {posts[0] && (
                <a
                  href={`/${locale}/blog/${posts[0].slug}`}
                  className="group block mb-16"
                  aria-label={getTitle(posts[0])}
                >
                  {posts[0].featured_image_url ? (
                    /* WITH IMAGE — full-width image card, title/excerpt overlaid */
                    <div
                      className="relative w-full overflow-hidden rounded-2xl"
                      style={{ aspectRatio: '21/9' }}
                    >
                      <img
                        src={posts[0].featured_image_url}
                        alt=""
                        aria-hidden="true"
                        className="absolute inset-0 w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-700 ease-out"
                        loading="eager"
                      />
                      {/* Dark gradient overlay from bottom */}
                      <div
                        className="absolute inset-0"
                        style={{
                          background: 'linear-gradient(to top, rgba(15,12,30,0.85) 0%, rgba(15,12,30,0.35) 55%, transparent 100%)',
                        }}
                        aria-hidden="true"
                      />

                      {/* Text content sitting on the gradient */}
                      <div className="absolute bottom-0 left-0 right-0 p-8 md:p-10">
                        {posts[0].category && (
                          <span
                            className="inline-block text-xs tracking-[0.2em] uppercase font-semibold mb-3 px-3 py-1 rounded-full"
                            style={{ background: 'var(--color-accent)', color: '#fff' }}
                          >
                            {posts[0].category}
                          </span>
                        )}

                        <h2
                          className="text-2xl md:text-4xl font-bold text-white leading-snug max-w-3xl"
                          style={{ fontFamily: headingFont }}
                        >
                          {getTitle(posts[0])}
                        </h2>

                        {getExcerpt(posts[0]) && (
                          <p className="mt-3 text-white/75 text-base md:text-lg leading-relaxed line-clamp-2 max-w-2xl">
                            {getExcerpt(posts[0])}
                          </p>
                        )}

                        <FeaturedMeta post={posts[0]} isAr={isAr} light />
                      </div>
                    </div>
                  ) : (
                    /* NO IMAGE — elegant typography-only card */
                    <div
                      className="relative rounded-2xl overflow-hidden p-10 md:p-14 transition-shadow duration-300 group-hover:shadow-xl"
                      style={{
                        background: 'linear-gradient(135deg, #f9f5ff 0%, var(--color-background) 100%)',
                        borderLeft: `5px solid var(--color-primary)`,
                        border: `1px solid rgba(71,64,153,0.12)`,
                        borderLeftWidth: '5px',
                        borderLeftColor: 'var(--color-primary)',
                      }}
                    >
                      {posts[0].category && (
                        <span
                          className="inline-block text-xs tracking-[0.2em] uppercase font-semibold mb-4"
                          style={{ color: 'var(--color-accent)' }}
                        >
                          {posts[0].category}
                        </span>
                      )}

                      <h2
                        className="text-3xl md:text-5xl font-bold leading-[1.2] max-w-3xl text-[var(--text-primary)] group-hover:text-[var(--color-primary)] transition-colors duration-300"
                        style={{ fontFamily: headingFont }}
                      >
                        {getTitle(posts[0])}
                      </h2>

                      {getExcerpt(posts[0]) && (
                        <p
                          className="mt-5 text-lg leading-[1.75] max-w-2xl line-clamp-4"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          {getExcerpt(posts[0])}
                        </p>
                      )}

                      <FeaturedMeta post={posts[0]} isAr={isAr} />

                      {/* Decorative large quote mark */}
                      <span
                        className="absolute top-6 end-10 text-[7rem] leading-none font-serif select-none pointer-events-none"
                        style={{ color: 'var(--color-primary)', opacity: 0.07 }}
                        aria-hidden="true"
                      >
                        "
                      </span>
                    </div>
                  )}
                </a>
              )}

              {/* ── ARTICLES SECTION DIVIDER ──────────────────────────────── */}
              {posts.length > 1 && (
                <>
                  <div
                    className="flex items-center gap-4 mb-10"
                    style={{ borderTop: '1px solid var(--color-neutral-200)', paddingTop: '2.5rem' }}
                  >
                    <h2
                      className="text-xs tracking-[0.25em] uppercase font-semibold shrink-0"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {isAr ? 'المزيد من المقالات' : 'More Articles'}
                    </h2>
                    <div
                      className="flex-1 h-px"
                      style={{ background: 'var(--color-neutral-100)' }}
                      aria-hidden="true"
                    />
                  </div>

                  {/* ── 2-COLUMN ARTICLE GRID ──────────────────────────────── */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-10">
                    {posts.slice(1).map((post) => {
                      const postTitle = getTitle(post);
                      const excerpt = getExcerpt(post);
                      const catColor = getCategoryColor(post.category);

                      return (
                        <a
                          key={post.slug}
                          href={`/${locale}/blog/${post.slug}`}
                          className="group flex flex-col rounded-xl overflow-hidden transition-shadow duration-300 hover:shadow-lg cursor-pointer"
                          style={{
                            background: '#fff',
                            border: '1px solid var(--color-neutral-100)',
                          }}
                          aria-label={postTitle}
                        >
                          {post.featured_image_url ? (
                            /* WITH IMAGE */
                            <div className="relative aspect-[16/9] overflow-hidden">
                              <Image
                                src={post.featured_image_url}
                                alt=""
                                aria-hidden="true"
                                fill
                                className="object-cover group-hover:scale-[1.04] transition-transform duration-500 ease-out"
                                sizes="(max-width: 640px) 100vw, 50vw"
                              />
                            </div>
                          ) : (
                            /* NO IMAGE — category accent bar */
                            <div
                              className="h-1 w-full"
                              style={{ background: catColor }}
                              aria-hidden="true"
                            />
                          )}

                          <div className="p-6 flex flex-col flex-1">
                            {post.category && (
                              <span
                                className="text-[0.65rem] tracking-[0.2em] uppercase font-semibold mb-2"
                                style={{ color: catColor }}
                              >
                                {post.category}
                              </span>
                            )}

                            <h3
                              className="text-lg font-bold leading-snug text-[var(--text-primary)] group-hover:text-[var(--color-primary)] transition-colors duration-200 line-clamp-2"
                              style={{ fontFamily: headingFont }}
                            >
                              {postTitle}
                            </h3>

                            {excerpt && (
                              <p
                                className="mt-2 text-sm leading-[1.7] line-clamp-3 flex-1"
                                style={{ color: 'var(--text-muted)' }}
                              >
                                {excerpt}
                              </p>
                            )}

                            <ArticleMeta post={post} isAr={isAr} />
                          </div>
                        </a>
                      );
                    })}
                  </div>
                </>
              )}
            </>
          ) : (
            /* ── EMPTY STATE ──────────────────────────────────────────────── */
            <div className="text-center py-24">
              <div
                className="mx-auto mb-7 w-14 h-14 rounded-2xl flex items-center justify-center"
                style={{ background: 'rgba(71,64,153,0.08)' }}
              >
                <svg
                  className="w-6 h-6"
                  style={{ color: 'var(--color-primary)' }}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
                </svg>
              </div>

              <h2
                className="text-xl font-bold text-[var(--text-primary)] mb-2"
                style={{ fontFamily: headingFont }}
              >
                {isAr ? 'المقالات قيد الإعداد' : 'Articles Coming Soon'}
              </h2>
              <p
                className="text-sm max-w-sm mx-auto leading-relaxed"
                style={{ color: 'var(--text-muted)' }}
              >
                {isAr
                  ? 'نعمل على إعداد محتوى قيّم حول التفكير الحسّي والكوتشينج'
                  : "We're preparing valuable content on Somatic Thinking and coaching"}
              </p>
            </div>
          )}

        </div>
      </Section>
    </main>
  );
}

// ── Helper: meta line for the featured post ───────────────────────────────────

function FeaturedMeta({
  post,
  isAr,
  light = false,
}: {
  post: { published_at?: string | null; reading_time_minutes?: number | null; author_slug?: string | null };
  isAr: boolean;
  light?: boolean;
}) {
  const mutedColor = light ? 'rgba(255,255,255,0.65)' : 'var(--text-muted)';
  const dotColor = light ? 'rgba(255,255,255,0.4)' : 'var(--color-neutral-300)';

  const hasDate = Boolean(post.published_at);
  const hasTime = Boolean(post.reading_time_minutes);
  const hasAuthor = Boolean(post.author_slug);

  if (!hasDate && !hasTime && !hasAuthor) return null;

  return (
    <div
      className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-5 text-sm"
      style={{ color: mutedColor }}
    >
      {hasDate && (
        <span>
          {new Date(post.published_at! + 'T00:00:00').toLocaleDateString(isAr ? 'ar-SA' : 'en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </span>
      )}
      {hasDate && (hasTime || hasAuthor) && (
        <span aria-hidden="true" style={{ color: dotColor }}>·</span>
      )}
      {hasTime && (
        <span>
          {post.reading_time_minutes} {isAr ? 'دقائق قراءة' : 'min read'}
        </span>
      )}
      {hasTime && hasAuthor && (
        <span aria-hidden="true" style={{ color: dotColor }}>·</span>
      )}
      {hasAuthor && (
        <span style={{ textTransform: 'capitalize' }}>
          {post.author_slug!.replace(/-/g, ' ')}
        </span>
      )}
    </div>
  );
}

// ── Helper: compact meta line for grid cards ──────────────────────────────────

function ArticleMeta({
  post,
  isAr,
}: {
  post: { published_at?: string | null; reading_time_minutes?: number | null };
  isAr: boolean;
}) {
  const hasDate = Boolean(post.published_at);
  const hasTime = Boolean(post.reading_time_minutes);

  if (!hasDate && !hasTime) return null;

  return (
    <div
      className="flex items-center gap-x-2 mt-4 text-xs"
      style={{ color: 'var(--text-muted)', opacity: 0.8 }}
    >
      {hasDate && (
        <span>
          {new Date(post.published_at! + 'T00:00:00').toLocaleDateString(isAr ? 'ar-SA' : 'en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })}
        </span>
      )}
      {hasDate && hasTime && (
        <span aria-hidden="true" style={{ color: 'var(--color-neutral-300)' }}>·</span>
      )}
      {hasTime && (
        <span>
          {post.reading_time_minutes} {isAr ? 'د' : 'min'}
        </span>
      )}
    </div>
  );
}
