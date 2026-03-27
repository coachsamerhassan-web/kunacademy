'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@kunacademy/auth';
import { Button } from '@kunacademy/ui/button';
import type { Product, ProductType } from '@kunacademy/db';
import { ProductGallery } from './product-gallery';

interface ProductDetailProps {
  product: Product;
  locale: string;
}

export function ProductDetail({ product, locale }: ProductDetailProps) {
  const isAr = locale === 'ar';
  const { user } = useAuth();
  const [purchasing, setPurchasing] = useState(false);

  const name = isAr ? product.name_ar : product.name_en;
  const description = isAr ? product.description_ar : product.description_en;
  const price = ((product.price_aed ?? 0) / 100).toLocaleString(isAr ? 'ar-AE' : 'en-AE', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

  const typeLabel: Record<ProductType, { ar: string; en: string }> = {
    digital: { ar: 'منتج رقمي', en: 'Digital Product' },
    physical: { ar: 'منتج مادي', en: 'Physical Product' },
    subscription: { ar: 'اشتراك', en: 'Subscription' },
  };

  const typeBadgeColor: Record<ProductType, string> = {
    digital: 'bg-emerald-100 text-emerald-700',
    physical: 'bg-blue-100 text-blue-700',
    subscription: 'bg-purple-100 text-purple-700',
  };

  const imageUrl = Array.isArray(product.images) && product.images.length > 0
    ? String(product.images[0])
    : null;

  const isDigital = product.product_type === 'digital' || product.product_type === 'subscription';

  async function handlePurchase() {
    if (!user) {
      window.location.href = `/${locale}/auth/login?redirect=/${locale}/shop/${product.slug}`;
      return;
    }

    setPurchasing(true);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_type: 'product',
          item_id: product.id,
          item_name: isAr ? product.name_ar : product.name_en,
          user_id: user.id,
          user_email: user.email,
          currency: 'AED',
          amount: product.price_aed,
          gateway: 'stripe',
          locale,
        }),
      });

      const data = await res.json();
      if (data.checkout_url) {
        window.location.href = data.checkout_url;
      }
    } catch (err) {
      console.error('[shop] Purchase error:', err);
    } finally {
      setPurchasing(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Breadcrumb */}
      <nav className="mb-6 text-sm text-[var(--color-neutral-500)]">
        <Link href={`/${locale}/shop`} className="hover:text-[#474099] transition-colors">
          {isAr ? 'المتجر' : 'Shop'}
        </Link>
        <span className="mx-2">/</span>
        <span className="text-[var(--color-neutral-900)]">{name}</span>
      </nav>

      <div className="grid gap-10 lg:grid-cols-2">
        {/* Gallery */}
        <ProductGallery product={product} isAr={isAr} />

        {/* Details */}
        <div>
          {/* Type badge */}
          <span
            className={`inline-block px-3 py-1 rounded-full text-xs font-medium mb-4 ${typeBadgeColor[(product.product_type ?? 'digital') as ProductType]}`}
          >
            {isAr ? typeLabel[(product.product_type ?? 'digital') as ProductType].ar : typeLabel[(product.product_type ?? 'digital') as ProductType].en}
          </span>

          {/* Name */}
          <h1
            className="text-3xl font-bold text-[var(--color-neutral-900)] mb-4"
            style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : undefined }}
          >
            {name}
          </h1>

          {/* Price */}
          <p className="text-2xl font-bold text-[#474099] mb-6">
            {price} {isAr ? 'د.إ' : 'AED'}
          </p>

          {/* Description */}
          {description && (
            <div className="prose prose-neutral max-w-none mb-8">
              <p className="text-[var(--color-neutral-600)] leading-relaxed whitespace-pre-line">
                {description}
              </p>
            </div>
          )}

          {/* Bilingual names */}
          <div className="mb-8 p-4 rounded-xl bg-[var(--color-surface-container)]">
            <p className="text-sm text-[var(--color-neutral-500)] mb-1">
              {isAr ? 'الاسم بالإنجليزية' : 'Arabic name'}
            </p>
            <p className="font-medium text-[var(--color-neutral-800)]">
              {isAr ? product.name_en : product.name_ar}
            </p>
          </div>

          {/* Action button */}
          <Button
            onClick={handlePurchase}
            disabled={purchasing}
            className="w-full min-h-[44px] bg-[#474099] hover:bg-[#3a3480] text-white rounded-xl text-base font-medium"
          >
            {purchasing
              ? (isAr ? 'جارٍ المعالجة...' : 'Processing...')
              : isDigital
                ? (isAr ? 'اشترِ وحمّل' : 'Buy & Download')
                : (isAr ? 'أضف للسلة' : 'Add to Cart')
            }
          </Button>

          {/* Digital notice */}
          {isDigital && (
            <p className="mt-3 text-xs text-[var(--color-neutral-500)] text-center">
              {isAr
                ? 'ستحصل على رابط تحميل فوري بعد إتمام الدفع (صالح لمدة 72 ساعة، 3 تحميلات)'
                : 'You will receive an instant download link after payment (valid 72 hours, 3 downloads)'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
