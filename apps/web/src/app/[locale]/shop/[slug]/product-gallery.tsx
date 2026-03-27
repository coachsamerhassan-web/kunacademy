// @ts-nocheck — TODO: fix Supabase client types (types regenerated, needs 'as any' removal)
'use client';

import { useState } from 'react';
import Image from 'next/image';
import type { Product, ProductType } from '@kunacademy/db';

interface ProductGalleryProps {
  product: Product;
  isAr: boolean;
}

export function ProductGallery({ product, isAr }: ProductGalleryProps) {
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  const images = Array.isArray(product.images) ? product.images.filter(Boolean) : [];
  const selectedImage = images.length > 0 ? images[selectedImageIndex] : null;

  const typeIcon: Record<ProductType, string> = {
    digital: '📥',
    physical: '📦',
    hybrid: '📦📥',
  };

  return (
    <div className="space-y-4">
      {/* Main image */}
      <div className="rounded-2xl overflow-hidden bg-gradient-to-br from-[#474099]/10 to-[#474099]/5 aspect-square flex items-center justify-center min-h-[400px]">
        {selectedImage ? (
          <Image
            src={String(selectedImage)}
            alt={isAr ? product.name_ar : product.name_en}
            width={600}
            height={600}
            className="h-full w-full object-cover"
            priority={selectedImageIndex === 0}
          />
        ) : (
          <div className="text-center">
            <span className="text-6xl block mb-4" aria-hidden="true">
              {typeIcon[product.product_type]}
            </span>
            <p className="text-sm text-[var(--color-neutral-400)]">
              {isAr ? 'صورة المنتج' : 'Product image'}
            </p>
          </div>
        )}
      </div>

      {/* Thumbnail gallery */}
      {images.length > 1 && (
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-5 md:grid-cols-6">
          {images.map((image, index) => (
            <button
              key={index}
              onClick={() => setSelectedImageIndex(index)}
              className={`
                relative aspect-square rounded-lg overflow-hidden
                border-2 transition-all
                ${selectedImageIndex === index
                  ? 'border-[#474099] ring-2 ring-[#474099]/50'
                  : 'border-[var(--color-neutral-200)] hover:border-[var(--color-neutral-300)]'
                }
              `}
              aria-label={`View image ${index + 1}`}
              aria-current={selectedImageIndex === index}
            >
              <Image
                src={String(image)}
                alt={`Thumbnail ${index + 1}`}
                width={100}
                height={100}
                className="h-full w-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
