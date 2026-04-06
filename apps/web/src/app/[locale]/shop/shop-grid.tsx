'use client';

import { useState, useEffect, type ReactNode } from 'react';
import Link from 'next/link';
import type { ProductType } from '@kunacademy/db';
import { Download, Package, RefreshCw } from 'lucide-react';

type FilterTab = 'all' | 'physical' | 'digital';

interface Product {
  id: string;
  name_ar: string;
  name_en: string;
  slug: string;
  description_ar: string | null;
  description_en: string | null;
  price_aed: number | null;
  product_type: string | null;
  images: unknown;
}

const SAMPLE_PRODUCTS: Product[] = [
  {
    id: '1',
    name_ar: 'دليل التفكير الحسّي',
    name_en: 'Somatic Thinking Guide',
    slug: 'somatic-thinking-guide',
    description_ar: 'دليل شامل لممارسة التفكير الحسّي',
    description_en: 'A comprehensive guide to Somatic Thinking practice',
    price_aed: 15000,
    product_type: 'digital',
    images: [],
  },
  {
    id: '2',
    name_ar: 'بطاقات التأمّل الحسّي',
    name_en: 'Somatic Reflection Cards',
    slug: 'somatic-reflection-cards',
    description_ar: 'مجموعة بطاقات للتأمّل والممارسة اليومية',
    description_en: 'A card set for daily reflection and practice',
    price_aed: 25000,
    product_type: 'physical',
    images: [],
  },
  {
    id: '3',
    name_ar: 'مجموعة أدوات المدرّب',
    name_en: 'Coach Toolkit Bundle',
    slug: 'coach-toolkit-bundle',
    description_ar: 'حقيبة أدوات رقمية ومادية للمدرّبين المعتمدين',
    description_en: 'Digital and physical toolkit for certified coaches',
    price_aed: 45000,
    product_type: 'subscription',
    images: [],
  },
];

const TYPE_ICONS: Record<ProductType, ReactNode> = {
  digital: <Download className="w-8 h-8" aria-hidden="true" />,
  physical: <Package className="w-8 h-8" aria-hidden="true" />,
  subscription: <RefreshCw className="w-8 h-8" aria-hidden="true" />,
};

interface ShopGridProps {
  locale: string;
}

export function ShopGrid({ locale }: ShopGridProps) {
  const isAr = locale === 'ar';
  const [products, setProducts] = useState<Product[]>([]);
  const [filter, setFilter] = useState<FilterTab>('all');
  const [loading, setLoading] = useState(true);
  const [usingSample, setUsingSample] = useState(false);

  useEffect(() => {
    async function fetchProducts() {
      try {
        const res = await fetch('/api/products');
        if (!res.ok) throw new Error('Failed to fetch products');
        const json = await res.json();

        if (!json.products || json.products.length === 0) {
          setProducts(SAMPLE_PRODUCTS);
          setUsingSample(true);
        } else {
          setProducts(json.products as Product[]);
        }
      } catch {
        setProducts(SAMPLE_PRODUCTS);
        setUsingSample(true);
      } finally {
        setLoading(false);
      }
    }

    fetchProducts();
  }, []);

  const filtered = filter === 'all'
    ? products
    : products.filter((p) => p.product_type === filter);

  const tabs: { key: FilterTab; labelAr: string; labelEn: string }[] = [
    { key: 'all', labelAr: 'الكل', labelEn: 'All' },
    { key: 'physical', labelAr: 'مادي', labelEn: 'Physical' },
    { key: 'digital', labelAr: 'رقمي', labelEn: 'Digital' },
  ];

  if (loading) {
    return (
      <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse rounded-xl border border-[var(--color-neutral-200)] overflow-hidden">
            <div className="h-48 bg-[var(--color-neutral-100)]" />
            <div className="p-5 space-y-3">
              <div className="h-5 bg-[var(--color-neutral-100)] rounded w-3/4" />
              <div className="h-4 bg-[var(--color-neutral-100)] rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div>
      {/* Filter tabs */}
      <div className="flex gap-2 mb-8" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            role="tab"
            aria-selected={filter === tab.key}
            onClick={() => setFilter(tab.key)}
            className={`
              min-h-[44px] px-5 py-2 rounded-full text-sm font-medium transition-colors
              ${filter === tab.key
                ? 'bg-[#474099] text-white'
                : 'bg-[var(--color-neutral-100)] text-[var(--color-neutral-600)] hover:bg-[var(--color-neutral-200)]'
              }
            `}
          >
            {isAr ? tab.labelAr : tab.labelEn}
          </button>
        ))}
      </div>

      {/* Product grid */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl bg-[var(--color-surface-container)] p-12 text-center">
          <p className="text-[var(--color-neutral-500)]">
            {isAr ? 'لا توجد منتجات في هذا التصنيف' : 'No products in this category'}
          </p>
        </div>
      ) : (
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((product) => (
            <ProductCard key={product.id} product={product} locale={locale} usingSample={usingSample} />
          ))}
        </div>
      )}
    </div>
  );
}

function ProductCard({
  product,
  locale,
  usingSample,
}: {
  product: Product;
  locale: string;
  usingSample: boolean;
}) {
  const isAr = locale === 'ar';
  const name = isAr ? product.name_ar : product.name_en;
  const price = ((product.price_aed ?? 0) / 100).toLocaleString(isAr ? 'ar-AE' : 'en-AE', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

  const typeLabel: Record<ProductType, { ar: string; en: string }> = {
    digital: { ar: 'رقمي', en: 'Digital' },
    physical: { ar: 'مادي', en: 'Physical' },
    subscription: { ar: 'اشتراك', en: 'Subscription' },
  };

  const typeBadgeColor: Record<ProductType, string> = {
    digital: 'bg-emerald-100 text-emerald-700',
    physical: 'bg-blue-100 text-blue-700',
    subscription: 'bg-purple-100 text-purple-700',
  };

  const productType = (product.product_type ?? 'digital') as ProductType;
  const imageUrl = Array.isArray(product.images) && product.images.length > 0
    ? String(product.images[0])
    : null;

  const href = usingSample ? `/${locale}/shop` : `/${locale}/shop/${product.slug}`;

  return (
    <Link
      href={href}
      className="group rounded-xl border border-[var(--color-neutral-200)] overflow-hidden hover:shadow-md transition-shadow bg-white"
    >
      {/* Image / Placeholder */}
      <div className="relative h-48 bg-gradient-to-br from-[#474099]/10 to-[#474099]/5 flex items-center justify-center overflow-hidden">
        {imageUrl ? (
          <img src={imageUrl} alt={name} className="h-full w-full object-cover" />
        ) : (
          <span className="text-[var(--color-neutral-400)]" aria-hidden="true">
            {TYPE_ICONS[productType]}
          </span>
        )}
        {/* Type badge */}
        <span
          className={`absolute top-3 start-3 px-2.5 py-1 rounded-full text-xs font-medium ${typeBadgeColor[productType]}`}
        >
          {isAr ? typeLabel[productType].ar : typeLabel[productType].en}
        </span>
      </div>

      {/* Content */}
      <div className="p-5">
        <h3
          className="font-semibold text-[var(--color-neutral-900)] group-hover:text-[#474099] transition-colors line-clamp-2"
          style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : undefined }}
        >
          {name}
        </h3>
        <p className="mt-2 text-lg font-bold text-[#474099]">
          {price} {isAr ? 'د.إ' : 'AED'}
        </p>
      </div>
    </Link>
  );
}
