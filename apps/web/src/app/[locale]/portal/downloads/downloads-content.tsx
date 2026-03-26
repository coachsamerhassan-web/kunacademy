'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@kunacademy/ui/button';

interface Download {
  id: string;
  product: {
    id: string;
    name_ar: string;
    name_en: string;
    slug: string;
    type: 'digital' | 'hybrid';
  };
  token: string;
  downloadLink: string;
  expiresAt: string;
  isExpired: boolean;
  isExhausted: boolean;
  downloadCount: number;
  maxDownloads: number;
  createdAt: string;
  orderCreatedAt: string;
}

interface DownloadsContentProps {
  locale: string;
}

export function DownloadsContent({ locale }: DownloadsContentProps) {
  const isAr = locale === 'ar';
  const [downloads, setDownloads] = useState<Download[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState<string | null>(null);

  useEffect(() => {
    async function fetchDownloads() {
      try {
        const res = await fetch('/api/user/downloads');
        if (!res.ok) {
          if (res.status === 401) {
            setError(isAr ? 'يرجى تسجيل الدخول' : 'Please log in');
          } else {
            setError(isAr ? 'خطأ في تحميل التحميلات' : 'Failed to load downloads');
          }
          return;
        }

        const data = await res.json();
        setDownloads(data.downloads || []);
      } catch (err) {
        console.error('Fetch error:', err);
        setError(isAr ? 'خطأ في الاتصال' : 'Connection error');
      } finally {
        setLoading(false);
      }
    }

    fetchDownloads();
  }, [isAr]);

  async function handleRegenerate(orderItemId: string) {
    setRegenerating(orderItemId);
    try {
      const res = await fetch('/api/downloads/regenerate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_item_id: orderItemId }),
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err.error || (isAr ? 'فشل التحديث' : 'Failed to regenerate'));
        return;
      }

      // Refresh the downloads list
      const refreshRes = await fetch('/api/user/downloads');
      const data = await refreshRes.json();
      setDownloads(data.downloads || []);
    } catch (err) {
      console.error('Regenerate error:', err);
      alert(isAr ? 'خطأ في الاتصال' : 'Connection error');
    } finally {
      setRegenerating(null);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="animate-pulse rounded-xl border border-[var(--color-neutral-200)] p-6"
          >
            <div className="h-5 bg-[var(--color-neutral-100)] rounded w-1/3 mb-3" />
            <div className="h-4 bg-[var(--color-neutral-100)] rounded w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-red-700">{error}</p>
        <Link href={`/${locale}/auth/login`} className="mt-4 inline-block">
          <Button>{isAr ? 'تسجيل الدخول' : 'Log In'}</Button>
        </Link>
      </div>
    );
  }

  if (downloads.length === 0) {
    return (
      <div className="rounded-2xl bg-[var(--color-surface-container)] p-12 text-center">
        <p className="text-lg text-[var(--color-neutral-600)] mb-4">
          {isAr ? 'لم تشتر أي منتجات رقمية بعد' : 'You haven\'t purchased any digital products yet'}
        </p>
        <Link href={`/${locale}/shop`}>
          <Button>{isAr ? 'استكشف المتجر' : 'Explore Shop'}</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {downloads.map((download) => {
        const expiresDate = new Date(download.expiresAt);
        const now = new Date();
        const hoursLeft = Math.ceil((expiresDate.getTime() - now.getTime()) / (1000 * 60 * 60));
        const productName = isAr ? download.product.name_ar : download.product.name_en;

        return (
          <div
            key={download.id}
            className="rounded-xl border border-[var(--color-neutral-200)] p-6 hover:shadow-md transition-shadow"
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              {/* Product info */}
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-[var(--color-neutral-900)] mb-2">
                  {productName}
                </h3>

                {/* Status badges */}
                <div className="flex flex-wrap gap-2 mb-3">
                  {download.isExpired && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-red-100 text-red-700 text-xs font-medium">
                      ⏰ {isAr ? 'انتهى الصلاح' : 'Expired'}
                    </span>
                  )}
                  {download.isExhausted && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-orange-100 text-orange-700 text-xs font-medium">
                      📥 {isAr ? 'تم استنفاد التحميلات' : 'Downloads Exhausted'}
                    </span>
                  )}
                  {!download.isExpired && !download.isExhausted && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-medium">
                      ✅ {isAr ? 'نشط' : 'Active'}
                    </span>
                  )}
                </div>

                {/* Details */}
                <p className="text-sm text-[var(--color-neutral-500)] space-y-1">
                  <div>
                    {isAr ? 'الصلاحية:' : 'Expires:'}{' '}
                    {expiresDate.toLocaleDateString(isAr ? 'ar-AE' : 'en-AE', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                    {!download.isExpired && hoursLeft > 0 && (
                      <span className="text-[var(--color-neutral-600)]">
                        {' '}
                        ({isAr ? `${hoursLeft} ساعة متبقية` : `${hoursLeft}h remaining`})
                      </span>
                    )}
                  </div>
                  <div>
                    {isAr ? 'التحميلات:' : 'Downloads:'} {download.downloadCount} /{' '}
                    {download.maxDownloads}
                  </div>
                </p>
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-2 min-w-fit">
                {!download.isExpired && !download.isExhausted && (
                  <a href={download.downloadLink} download>
                    <Button className="w-full min-h-[44px] bg-emerald-600 hover:bg-emerald-700 text-white">
                      {isAr ? '⬇️ تحميل' : '⬇️ Download'}
                    </Button>
                  </a>
                )}

                {(download.isExpired || download.isExhausted) && (
                  <Button
                    onClick={() => handleRegenerate(download.id)}
                    disabled={regenerating === download.id}
                    className="w-full min-h-[44px] bg-[#474099] hover:bg-[#3a3480] text-white"
                  >
                    {regenerating === download.id
                      ? (isAr ? 'جاري...' : 'Regenerating...')
                      : (isAr ? '🔄 إعادة توليد الرابط' : '🔄 Regenerate Link')}
                  </Button>
                )}

                <Link href={`/${locale}/shop/${download.product.slug}`} className="w-full">
                  <Button variant="secondary" className="w-full min-h-[44px]">
                    {isAr ? 'عرض المنتج' : 'View Product'}
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
