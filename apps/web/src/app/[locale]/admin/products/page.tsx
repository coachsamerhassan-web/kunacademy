'use client';

import { useAuth } from '@kunacademy/auth';
import { useEffect, useState } from 'react';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

interface Product {
  id: string;
  name_ar: string;
  name_en: string;
  slug: string;
  product_type: string | null;
  price_aed: number | null;
  price_egp: number | null;
  is_active: boolean | null;
}

const typeLabels: Record<string, { ar: string; en: string; className: string }> = {
  digital: { ar: 'رقمي', en: 'Digital', className: 'bg-blue-100 text-blue-700' },
  physical: { ar: 'مادي', en: 'Physical', className: 'bg-green-100 text-green-700' },
  subscription: { ar: 'اشتراك', en: 'Subscription', className: 'bg-purple-100 text-purple-700' },
};

export default function AdminProductsPage() {
  const { locale } = useParams<{ locale: string }>();
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const isAr = locale === 'ar';

  useEffect(() => {
    if (authLoading) return;
    if (!user || profile?.role !== 'admin') { router.push('/' + locale + '/auth/login'); return; }

    fetch('/api/admin/products')
      .then(r => r.json())
      .then(({ products }) => {
        setProducts(products ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [user, profile, authLoading]);

  if (authLoading || loading) return <Section><p className="text-center py-12">Loading...</p></Section>;

  return (
    <main>
      <Section variant="white">
        <div className="flex items-center justify-between mb-6">
          <div>
            <Heading level={1}>{isAr ? 'المنتجات' : 'Products'}</Heading>
            <p className="mt-1 text-sm text-[var(--color-neutral-500)]">
              {products.length} {isAr ? 'منتج' : 'products'}
              {' · '}
              {products.filter(p => p.is_active).length} {isAr ? 'نشط' : 'active'}
            </p>
          </div>
          <a href={'/' + locale + '/admin'} className="text-[var(--color-primary)] text-sm hover:underline flex items-center gap-1">
            <ArrowLeft className="w-4 h-4 rtl:rotate-180" aria-hidden="true" />
            {isAr ? 'لوحة الإدارة' : 'Dashboard'}
          </a>
        </div>

        <div className="overflow-x-auto rounded-xl border border-[var(--color-neutral-200)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--color-neutral-50)] border-b border-[var(--color-neutral-200)]">
                <th className="px-4 py-3 text-start font-medium text-[var(--color-neutral-500)]">{isAr ? 'المنتج' : 'Product'}</th>
                <th className="px-4 py-3 text-start font-medium text-[var(--color-neutral-500)]">{isAr ? 'النوع' : 'Type'}</th>
                <th className="px-4 py-3 text-start font-medium text-[var(--color-neutral-500)]">{isAr ? 'السعر' : 'Price'}</th>
                <th className="px-4 py-3 text-start font-medium text-[var(--color-neutral-500)]">{isAr ? 'الحالة' : 'Status'}</th>
              </tr>
            </thead>
            <tbody>
              {products.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-[var(--color-neutral-400)]">{isAr ? 'لا توجد منتجات' : 'No products yet'}</td></tr>
              ) : products.map(product => {
                const name = isAr ? product.name_ar : product.name_en;
                const typeMeta = typeLabels[product.product_type || ''] || { ar: product.product_type || '', en: product.product_type || '', className: 'bg-gray-100 text-gray-600' };

                return (
                  <tr key={product.id} className="border-b border-[var(--color-neutral-100)] hover:bg-[var(--color-neutral-50)]">
                    <td className="px-4 py-3">
                      <div>
                        <div className="font-medium text-[var(--text-primary)]">{name || product.slug}</div>
                        <div className="text-xs text-[var(--color-neutral-400)]">/{product.slug}</div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${typeMeta.className}`}>
                        {isAr ? typeMeta.ar : typeMeta.en}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-[var(--text-primary)]">
                      {product.price_aed ? `${product.price_aed} AED` : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${product.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                        {product.is_active ? (isAr ? 'نشط' : 'Active') : (isAr ? 'معطّل' : 'Inactive')}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>
    </main>
  );
}
