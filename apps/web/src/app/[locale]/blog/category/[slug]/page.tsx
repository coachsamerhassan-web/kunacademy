import Image from 'next/image';
import { setRequestLocale } from 'next-intl/server';
import { cms } from '@kunacademy/cms/server';
import { Section } from '@kunacademy/ui/section';
import { GeometricPattern } from '@kunacademy/ui/patterns';
import { Card } from '@kunacademy/ui/card';
import type { Metadata } from 'next';
import { ArrowLeft } from 'lucide-react';

// Bilingual category label mapping (shared with blog listing page)
const CATEGORY_LABELS: Record<string, { en: string; ar: string }> = {
  methodology: { en: 'Methodology', ar: 'المنهجية' },
  coaching: { en: 'Coaching', ar: 'الكوتشينج' },
  certification: { en: 'Certification', ar: 'الشهادات' },
  retreats: { en: 'Retreats', ar: 'الخلوات' },
  'programs-and-events': { en: 'Programs & Events', ar: 'البرامج والفعاليات' },
};

interface Props {
  params: Promise<{ locale: string; slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const categorySlug = decodeURIComponent(slug);
  const isAr = locale === 'ar';
  const categoryLabel =
    CATEGORY_LABELS[categorySlug.toLowerCase()]?.[isAr ? 'ar' : 'en'] || categorySlug;
  return {
    title: `${categoryLabel} | ${isAr ? 'المدوّنة — أكاديمية كُن' : 'Blog — Kun Academy'}`,
  };
}

export default async function BlogCategoryPage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';
  const category = decodeURIComponent(slug);
  const categoryLabel =
    CATEGORY_LABELS[category.toLowerCase()]?.[isAr ? 'ar' : 'en'] || category;

  const posts = await cms.getBlogPostsByCategory(category);

  return (
    <main>
      {/* Hero */}
      <section className="relative overflow-hidden py-12 md:py-20 bg-[var(--color-background)]">
        <GeometricPattern pattern="flower-of-life" opacity={0.3} fade="both" />
        <div className="relative z-10 mx-auto max-w-[var(--max-content-width)] px-4 md:px-6">
          <a href={`/${locale}/blog`} className="text-sm text-[var(--color-primary)] hover:underline mb-4 inline-block">
            <ArrowLeft className="w-4 h-4 inline-block rtl:rotate-180" aria-hidden="true" /> {isAr ? 'جميع المقالات' : 'All Articles'}
          </a>
          <h1
            className="text-[2rem] md:text-[3rem] font-bold text-[var(--text-primary)] leading-tight"
            style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
          >
            {categoryLabel}
          </h1>
          <p className="mt-3 text-[var(--text-muted)] text-lg">
            {isAr
              ? `${posts.length} مقال${posts.length !== 1 ? 'ات' : ''} في هذا التصنيف`
              : `${posts.length} article${posts.length !== 1 ? 's' : ''} in this category`}
          </p>
        </div>
      </section>

      {/* Posts Grid */}
      <Section variant="white">
        {posts.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {posts.map((post) => {
              const postTitle = isAr ? post.title_ar : post.title_en;
              const excerpt = isAr ? post.excerpt_ar : post.excerpt_en;

              return (
                <a key={post.slug} href={`/${locale}/blog/${post.slug}`} className="group">
                  <Card accent className="overflow-hidden h-full">
                    {post.featured_image_url && (
                      <div className="relative aspect-[16/10] overflow-hidden">
                        <Image src={post.featured_image_url} alt={postTitle} fill className="object-cover group-hover:scale-105 transition-transform duration-500" sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" />
                      </div>
                    )}
                    <div className="p-5">
                      <h3 className="text-lg font-bold text-[var(--text-primary)] group-hover:text-[var(--color-primary)] transition-colors line-clamp-2">
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
        ) : (
          <div className="text-center py-12">
            <p className="text-[var(--color-neutral-500)]">
              {isAr ? 'لا توجد مقالات في هذا التصنيف بعد' : 'No articles in this category yet'}
            </p>
            <a href={`/${locale}/blog`} className="mt-3 inline-block text-sm text-[var(--color-primary)] hover:underline">
              {isAr ? 'تصفّح جميع المقالات' : 'Browse all articles'}
            </a>
          </div>
        )}
      </Section>
    </main>
  );
}
