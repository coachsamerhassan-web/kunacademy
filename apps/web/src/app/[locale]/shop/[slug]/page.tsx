import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { createServerClient } from '@kunacademy/db';
import type { Product } from '@kunacademy/db';
import { Section } from '@kunacademy/ui/section';
import { ProductDetail } from './product-detail';

export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }): Promise<Metadata> {
  const { locale, slug } = await params;
  const isAr = locale === 'ar';
  const supabase = createServerClient();
  if (!supabase) return {};
  const { data } = await supabase.from('products').select('name_ar, name_en, description_ar, description_en').eq('slug', slug).eq('is_active', true).single();
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

  const supabase = createServerClient();
  let product: Product | null = null;

  if (supabase) {
    const { data } = await supabase
      .from('products')
      .select('*')
      .eq('slug', slug)
      .eq('is_active', true)
      .single();

    product = data as Product | null;
  }

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
