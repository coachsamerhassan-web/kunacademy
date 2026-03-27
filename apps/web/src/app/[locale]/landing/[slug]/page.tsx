import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { GeometricPattern } from '@kunacademy/ui/patterns';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';
import { Button } from '@kunacademy/ui/button';
import { notFound } from 'next/navigation';

// Import CMS provider
async function getLandingPage(slug: string, locale: string) {
  try {
    const { cms } = await import('@kunacademy/cms');
    const sections = await cms.getPageContent(slug);
    if (!sections || Object.keys(sections).length === 0) return null;

    const content: Record<string, string> = {};
    for (const [sectionKey, sectionData] of Object.entries(sections)) {
      const data = sectionData as Record<string, any>;
      for (const [key, val] of Object.entries(data)) {
        if (typeof val === 'object' && val !== null && ('ar' in val || 'en' in val)) {
          content[key] = locale === 'ar' ? (val.ar || val.en || '') : (val.en || val.ar || '');
        } else if (typeof val === 'string') {
          content[key] = val;
        }
      }
    }
    return {
      content,
      meta_title: content.meta_title || content.title || slug,
      meta_description: content.meta_description || '',
      og_image: content.og_image_url || '',
    };
  } catch {
    return null;
  }
}

interface Props { params: Promise<{ locale: string; slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const page = await getLandingPage(slug, locale);
  if (!page) {
    return { title: 'Kun Academy' };
  }
  return {
    title: page.meta_title ? `${page.meta_title} | ${locale === 'ar' ? 'أكاديمية كُن' : 'Kun Academy'}` : (locale === 'ar' ? 'أكاديمية كُن' : 'Kun Academy'),
    description: page.meta_description || (locale === 'ar'
      ? 'صفحة خاصة من أكاديمية كُن للكوتشينج والتفكير الحسّي®'
      : 'A special page from Kun Coaching Academy for Somatic Thinking®.'),
  };
}

export default async function LandingPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';
  const page = await getLandingPage(slug, locale);

  if (!page) notFound();

  return (
    <main>
      {/* Hero */}
      <Section variant="primary" className="py-20 text-center">
        {page.content.hero_image && (
          <img src={page.content.hero_image} alt="" className="mx-auto max-h-64 mb-8 rounded-lg" />
        )}
        <Heading level={1} className="text-white text-3xl sm:text-4xl">
          {page.content.headline || page.content.title || slug}
        </Heading>
        {page.content.subheadline && (
          <p className="mt-4 text-white/80 text-lg max-w-2xl mx-auto">{page.content.subheadline}</p>
        )}
        {page.content.cta_url && (
          <a href={page.content.cta_url} className="inline-block mt-6">
            <Button variant="primary" size="lg" className="bg-[var(--color-accent)] hover:bg-[var(--color-accent)]/90">
              {page.content.cta_text || (isAr ? 'سجّل الآن' : 'Register Now')}
            </Button>
          </a>
        )}
      </Section>

      {/* Body content */}
      {page.content.body && (
        <Section variant="white">
          <div className="mx-auto max-w-3xl prose prose-lg" dir={isAr ? 'rtl' : 'ltr'}
            dangerouslySetInnerHTML={{ __html: page.content.body }} />
        </Section>
      )}

      {/* Features / highlights */}
      {page.content.features && (
        <Section variant="surface">
          <div className="mx-auto max-w-3xl">
            <div className="prose prose-lg" dir={isAr ? 'rtl' : 'ltr'}
              dangerouslySetInnerHTML={{ __html: page.content.features }} />
          </div>
        </Section>
      )}

      {/* Bottom CTA */}
      {page.content.cta_url && (
        <Section variant="dark" className="text-center py-16">
          <h2 className="text-white text-2xl font-bold mb-4">
            {page.content.bottom_cta_headline || page.content.headline}
          </h2>
          <a href={page.content.cta_url}>
            <Button variant="primary" size="lg" className="bg-[var(--color-accent)]">
              {page.content.cta_text || (isAr ? 'سجّل الآن' : 'Register Now')}
            </Button>
          </a>
        </Section>
      )}
    </main>
  );
}
