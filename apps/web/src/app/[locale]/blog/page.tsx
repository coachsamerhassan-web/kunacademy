import { setRequestLocale } from 'next-intl/server';
import { cms } from '@kunacademy/cms';
import { Section } from '@kunacademy/ui/section';
import { GeometricPattern } from '@kunacademy/ui/patterns';
import { Card } from '@kunacademy/ui/card';
import type { Metadata } from 'next';

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const isAr = locale === 'ar';
  return {
    title: isAr ? 'المدوّنة | أكاديمية كُن' : 'Blog | Kun Academy',
    description: isAr
      ? 'مقالات في التفكير الحسّي والكوتشينج والنمو المهني'
      : 'Articles on Somatic Thinking, coaching, and professional growth',
  };
}

export default async function BlogPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  const posts = await cms.getAllBlogPosts();

  // Extract unique categories
  const categories = [...new Set(posts.map((p) => p.category).filter(Boolean))] as string[];

  return (
    <main>
      {/* Hero */}
      <section className="relative overflow-hidden py-16 md:py-24 bg-[var(--color-background)]">
        <GeometricPattern pattern="flower-of-life" opacity={0.3} fade="both" />
        <div className="relative z-10 mx-auto max-w-[var(--max-content-width)] px-4 md:px-6">
          <div className="max-w-2xl animate-fade-up">
            <p className="text-sm font-medium tracking-[0.15em] uppercase text-[var(--color-accent)] mb-3">
              {isAr ? 'المدوّنة' : 'Blog'}
            </p>
            <h1
              className="text-[2.25rem] md:text-[3.5rem] font-bold text-[var(--text-primary)] leading-tight"
              style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
            >
              {isAr ? 'أفكار ورؤى من أكاديمية كُن' : 'Ideas & Insights from Kun Academy'}
            </h1>
            <p className="mt-4 text-[var(--text-muted)] text-lg md:text-xl">
              {isAr
                ? 'مقالات في التفكير الحسّي والكوتشينج والنمو المهني.'
                : 'Articles on Somatic Thinking, coaching, and professional growth.'}
            </p>
          </div>
        </div>
      </section>

      {/* Articles */}
      <Section variant="white">
        {posts.length > 0 ? (
          <>
            {/* Category tabs */}
            {categories.length > 1 && (
              <div className="flex flex-wrap gap-2 mb-8">
                <span className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium bg-[var(--color-primary)] text-white">
                  {isAr ? 'الكل' : 'All'}
                </span>
                {categories.map((cat) => (
                  <span key={cat} className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium bg-[var(--color-neutral-100)] text-[var(--color-neutral-600)] hover:bg-[var(--color-primary-50)] hover:text-[var(--color-primary)] transition-colors cursor-pointer">
                    {cat}
                  </span>
                ))}
              </div>
            )}

            {/* Featured post */}
            {posts[0] && (
              <a href={`/${locale}/blog/${posts[0].slug}`} className="group block mb-8">
                <Card accent className="overflow-hidden">
                  <div className="grid grid-cols-1 md:grid-cols-2">
                    {posts[0].featured_image_url && (
                      <div className="relative aspect-[16/10] md:aspect-auto overflow-hidden">
                        <img
                          src={posts[0].featured_image_url}
                          alt={isAr ? posts[0].title_ar : posts[0].title_en}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          loading="eager"
                        />
                      </div>
                    )}
                    <div className="p-6 md:p-8 flex flex-col justify-center">
                      {posts[0].category && (
                        <span className="text-xs font-medium text-[var(--color-accent)] uppercase tracking-wider mb-2">
                          {posts[0].category}
                        </span>
                      )}
                      <h2 className="text-xl md:text-2xl font-bold text-[var(--text-primary)] group-hover:text-[var(--color-primary)] transition-colors line-clamp-2">
                        {isAr ? posts[0].title_ar : posts[0].title_en}
                      </h2>
                      {(isAr ? posts[0].excerpt_ar : posts[0].excerpt_en) && (
                        <p className="mt-3 text-[var(--color-neutral-600)] line-clamp-3">
                          {isAr ? posts[0].excerpt_ar : posts[0].excerpt_en}
                        </p>
                      )}
                      <div className="flex items-center gap-3 mt-4 text-sm text-[var(--color-neutral-500)]">
                        {posts[0].published_at && (
                          <span>
                            {new Date(posts[0].published_at + 'T00:00:00').toLocaleDateString(isAr ? 'ar-SA' : 'en-US', {
                              year: 'numeric', month: 'short', day: 'numeric',
                            })}
                          </span>
                        )}
                        {posts[0].reading_time_minutes && (
                          <>
                            <span>·</span>
                            <span>{posts[0].reading_time_minutes} {isAr ? 'د قراءة' : 'min read'}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              </a>
            )}

            {/* Grid of remaining posts */}
            {posts.length > 1 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {posts.slice(1).map((post) => {
                  const postTitle = isAr ? post.title_ar : post.title_en;
                  const excerpt = isAr ? post.excerpt_ar : post.excerpt_en;

                  return (
                    <a key={post.slug} href={`/${locale}/blog/${post.slug}`} className="group">
                      <Card accent className="overflow-hidden h-full">
                        {post.featured_image_url && (
                          <div className="relative aspect-[16/10] overflow-hidden">
                            <img src={post.featured_image_url} alt={postTitle} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
                          </div>
                        )}
                        <div className="p-5">
                          {post.category && (
                            <span className="text-xs font-medium text-[var(--color-accent)] uppercase tracking-wider">
                              {post.category}
                            </span>
                          )}
                          <h3 className="mt-1 text-lg font-bold text-[var(--text-primary)] group-hover:text-[var(--color-primary)] transition-colors line-clamp-2">
                            {postTitle}
                          </h3>
                          {excerpt && (
                            <p className="mt-2 text-sm text-[var(--color-neutral-600)] line-clamp-2">{excerpt}</p>
                          )}
                          <div className="flex items-center gap-2 mt-3 text-xs text-[var(--color-neutral-500)]">
                            {post.published_at && (
                              <span>
                                {new Date(post.published_at + 'T00:00:00').toLocaleDateString(isAr ? 'ar-SA' : 'en-US', {
                                  month: 'short', day: 'numeric',
                                })}
                              </span>
                            )}
                            {post.reading_time_minutes && (
                              <>
                                <span>·</span>
                                <span>{post.reading_time_minutes} {isAr ? 'د' : 'min'}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </Card>
                    </a>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-16">
            <div className="mx-auto mb-6 w-16 h-16 rounded-2xl bg-[var(--color-primary-50)] flex items-center justify-center">
              <svg className="w-7 h-7 text-[var(--color-primary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
            </div>
            <h2 className="text-lg md:text-xl font-bold text-[var(--text-primary)]">
              {isAr ? 'المقالات قيد الإعداد' : 'Articles Coming Soon'}
            </h2>
            <p className="mt-2 text-sm text-[var(--text-muted)] max-w-md mx-auto">
              {isAr
                ? 'نعمل على إعداد محتوى قيّم حول التفكير الحسّي والكوتشينج'
                : 'We\'re preparing valuable content on Somatic Thinking and coaching'}
            </p>
          </div>
        )}
      </Section>
    </main>
  );
}
