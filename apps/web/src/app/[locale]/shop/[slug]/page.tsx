import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { db } from '@kunacademy/db';
import { products } from '@kunacademy/db/schema';
import { eq, and } from 'drizzle-orm';
import { Section } from '@kunacademy/ui/section';
import { ProductDetail } from './product-detail';

export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }): Promise<Metadata> {
  const { locale, slug } = await params;
  const isAr = locale === 'ar';
  const [data] = await db.select({
    name_ar: products.name_ar,
    name_en: products.name_en,
    description_ar: products.description_ar,
    description_en: products.description_en,
  })
    .from(products)
    .where(and(eq(products.slug, slug), eq(products.is_active, true)))
    .limit(1);
  if (!data) return {};
  return {
    title: `${isAr ? data.name_ar : data.name_en} | ${isAr ? 'أكاديمية كُن' : 'Kun Academy'}`,
    description: (isAr ? data.description_ar : data.description_en)?.substring(0, 160) || '',
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const [product] = await db.select()
    .from(products)
    .where(and(eq(products.slug, slug), eq(products.is_active, true)))
    .limit(1);

  if (!product) {
    notFound();
  }

  return (
    <main>
      <Section>
        <ProductDetail product={product} locale={locale} />
      </Section>
    </main>
  );
}
