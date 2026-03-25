import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { createServerClient } from '@kunacademy/db';
import type { Product } from '@kunacademy/db';
import { Section } from '@kunacademy/ui/section';
import { ProductDetail } from './product-detail';

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
