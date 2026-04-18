import Image from 'next/image';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { cms, AsyncDocRenderer } from '@kunacademy/cms/server';
import { Section } from '@kunacademy/ui/section';
import { GeometricPattern } from '@kunacademy/ui/patterns';
import { MarkdownContent } from '@/components/markdown-content';
import type { Metadata } from 'next';
import { ArrowLeft } from 'lucide-react';
import { articleJsonLd } from '@kunacademy/ui/structured-data';
import { JsonLd } from '@/components/seo/JsonLd';

// Bilingual category label mapping
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
  const post = await cms.getBlogPost(slug);
  if (!post) return {};

  const title = locale === 'ar' ? (post.meta_title_ar || post.title_ar) : (post.meta_title_en || post.title_en);
  const description = locale === 'ar' ? (post.meta_description_ar || post.excerpt_ar) : (post.meta_description_en || post.excerpt_en);

  return {
    title: `${title} | ${locale === 'ar' ? 'أكاديمية كُن' : 'Kun Academy'}`,
    description: description?.slice(0, 160) || '',
    openGraph: {
      title,
      description: description?.slice(0, 160) || '',
      type: 'article',
      siteName: locale === 'ar' ? 'أكاديمية كُن' : 'Kun Academy',
      locale,
      ...(post.featured_image_url ? { images: [{ url: post.featured_image_url }] } : {}),
      ...(post.published_at ? { publishedTime: post.published_at } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: description?.slice(0, 160) || '',
      ...(post.featured_image_url ? { images: [post.featured_image_url] } : {}),
    },
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  const post = await cms.getBlogPost(slug);
  if (!post) notFound();

  const title = isAr ? post.title_ar : post.title_en;
  const content = isAr ? post.content_ar : post.content_en;
  const excerpt = isAr ? post.excerpt_ar : post.excerpt_en;

  // Check if the article exists in the OTHER locale (for language toggle)
  const otherLocale = isAr ? 'en' : 'ar';
  const otherTitle = isAr ? post.title_en : post.title_ar;
  const hasOtherLang = otherTitle && otherTitle.trim().length > 0;

  // Fetch author if present
  const author = post.author_slug ? await cms.getTeamMember(post.author_slug) : null;
  const authorName = author ? (isAr ? author.name_ar : author.name_en) : null;

  return (
    <main>
      <JsonLd
        data={articleJsonLd({
          locale,
          title,
          description: excerpt || '',
          slug,
          image: post.featured_image_url,
          publishedAt: post.published_at,
          modifiedAt: post.last_edited_at || post.published_at,
        })}
      />
      {/* Hero */}
      <section className="relative overflow-hidden py-12 md:py-20">
        {post.featured_image_url ? (
          <>
            <div className="absolute inset-0">
              <Image src={post.featured_image_url} alt="" fill className="object-cover" style={{ filter: 'brightness(0.25)' }} priority />
              <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[rgba(29,26,61,0.9)]" />
            </div>
          </>
        ) : (
          <div className="absolute inset-0 bg-[var(--color-background)]" />
        )}
        <GeometricPattern pattern="flower-of-life" opacity={0.05} fade="both" />
        <div className="relative z-10 mx-auto max-w-3xl px-4 md:px-6">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            {post.category && (
              <span className={`text-xs font-medium uppercase tracking-wider ${post.featured_image_url ? 'text-[var(--color-accent)]' : 'text-[var(--color-accent)]'}`}>
                {CATEGORY_LABELS[post.category.toLowerCase()]?.[isAr ? 'ar' : 'en'] || post.category}
              </span>
            )}
            {post.published_at && (
              <span className={`text-sm ${post.featured_image_url ? 'text-white/60' : 'text-[var(--color-neutral-500)]'}`}>
                {new Date(post.published_at + 'T00:00:00').toLocaleDateString(isAr ? 'ar-SA' : 'en-US', {
                  year: 'numeric', month: 'long', day: 'numeric',
                })}
              </span>
            )}
            {post.reading_time_minutes && (
              <span className={`text-sm ${post.featured_image_url ? 'text-white/60' : 'text-[var(--color-neutral-500)]'}`}>
                · {post.reading_time_minutes} {isAr ? 'دقائق قراءة' : 'min read'}
              </span>
            )}
          </div>
          <h1
            className={`text-[1.75rem] md:text-[2.5rem] font-bold leading-[1.15] ${post.featured_image_url ? 'text-[#FFF5E9]' : 'text-[var(--text-primary)]'}`}
            style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
          >
            {title}
          </h1>

          {/* Language toggle — same article in other language */}
          {hasOtherLang && (
            <a
              href={`/${otherLocale}/blog/${slug}`}
              className={`inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                post.featured_image_url
                  ? 'bg-white/10 text-white/80 hover:bg-white/20 hover:text-white'
                  : 'bg-[var(--color-neutral-100)] text-[var(--color-neutral-600)] hover:bg-[var(--color-neutral-200)]'
              }`}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>
              {isAr ? 'Read in English' : 'اقرأ بالعربية'}
            </a>
          )}

          {/* Author */}
          {author && (
            <div className="flex items-center gap-3 mt-6">
              <div className="h-10 w-10 rounded-full overflow-hidden bg-[var(--color-neutral-200)]">
                {author.photo_url ? (
                  <Image src={author.photo_url} alt={authorName || ''} fill className="object-cover" sizes="40px" />
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-lg font-bold text-white bg-[var(--color-primary)]">
                    {(authorName || '').charAt(0)}
                  </div>
                )}
              </div>
              <div>
                <a
                  href={`/${locale}/coaches/${author.slug}`}
                  className={`font-medium text-sm hover:underline ${post.featured_image_url ? 'text-white' : 'text-[var(--text-primary)]'}`}
                >
                  {authorName}
                </a>
                {(isAr ? author.title_ar : author.title_en) && (
                  <p className={`text-xs ${post.featured_image_url ? 'text-white/60' : 'text-[var(--color-neutral-500)]'}`}>
                    {isAr ? author.title_ar : author.title_en}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Content */}
      <Section variant="white">
        <article className="max-w-3xl mx-auto">
          {post.content_doc_id ? (
            <AsyncDocRenderer docId={post.content_doc_id} locale={locale as 'ar' | 'en'} />
          ) : content ? (
            <MarkdownContent content={content} isAr={isAr} />
          ) : excerpt ? (
            <div
              className="text-[var(--color-neutral-700)] leading-relaxed text-lg whitespace-pre-line"
              style={{ fontFamily: isAr ? 'var(--font-arabic-body)' : 'inherit' }}
            >
              {excerpt}
            </div>
          ) : (
            <p className="text-[var(--color-neutral-500)] text-center py-8">
              {isAr ? 'المحتوى قيد الإعداد' : 'Content is being prepared'}
            </p>
          )}

          {/* Tags */}
          {post.tags && (Array.isArray(post.tags) ? post.tags : String(post.tags).split(',').map(t => t.trim()).filter(Boolean)).length > 0 && (
            <div className="flex flex-wrap gap-2 mt-8 pt-6 border-t border-[var(--color-neutral-100)]">
              {(Array.isArray(post.tags) ? post.tags : String(post.tags).split(',').map(t => t.trim()).filter(Boolean)).map((tag) => (
                <span key={tag} className="inline-flex items-center px-3 py-1 rounded-full text-xs bg-[var(--color-neutral-100)] text-[var(--color-neutral-600)]">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </article>
      </Section>

      {/* Navigation */}
      <Section variant="surface">
        <div className="max-w-3xl mx-auto text-center">
          <a href={`/${locale}/blog`} className="text-sm text-[var(--color-primary)] hover:underline">
            <ArrowLeft className="w-4 h-4 inline-block rtl:rotate-180" aria-hidden="true" /> {isAr ? 'جميع المقالات' : 'All Articles'}
          </a>
        </div>
      </Section>
    </main>
  );
}
