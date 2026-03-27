// @ts-nocheck — TODO: fix Supabase client types (types regenerated, needs 'as any' removal)
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@kunacademy/auth';
import { createBrowserClient } from '@kunacademy/db';
import type { OrderStatus } from '@kunacademy/db';

type TabKey = 'orders' | 'downloads';

interface OrderRow {
  id: string;
  customer_id: string;
  status: OrderStatus;
  total_amount: number;
  currency: string;
  payment_gateway: string | null;
  payment_id: string | null;
  shipping_address: Record<string, unknown> | null;
  created_at: string;
}

interface DownloadItem {
  id: string;
  token: string;
  expires_at: string;
  download_count: number;
  max_downloads: number;
  created_at: string;
  asset: {
    id: string;
    display_name: string | null;
    file_type: string;
    file_size_bytes: number | null;
  } | null;
}

interface OrderWithItems extends OrderRow {
  order_items?: {
    id: string;
    product_id: string;
    quantity: number;
    unit_price: number;
    product?: {
      name_ar: string;
      name_en: string;
      slug: string;
    };
  }[];
}

interface OrdersDashboardProps {
  locale: string;
}

export function OrdersDashboard({ locale }: OrdersDashboardProps) {
  const isAr = locale === 'ar';
  const { user, loading: authLoading } = useAuth();
  const [tab, setTab] = useState<TabKey>('orders');
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [downloads, setDownloads] = useState<DownloadItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading || !user) return;

    async function fetchData() {
      const supabase = createBrowserClient();
      if (!supabase) {
        setLoading(false);
        return;
      }

      try {
        // Fetch orders
        const { data: ordersData } = await supabase
          .from('orders')
          .select('*')
          .eq('customer_id', user!.id)
          .order('created_at', { ascending: false });

        if (ordersData) {
          setOrders(ordersData as OrderWithItems[]);
        }

        // Fetch download tokens
        const { data: tokensData } = await supabase
          .from('download_tokens')
          .select('*, digital_assets(*)')
          .eq('user_id', user!.id)
          .order('created_at', { ascending: false });

        if (tokensData) {
          setDownloads(
            (tokensData as any[]).map((t) => ({
              id: t.id,
              token: t.token,
              expires_at: t.expires_at,
              download_count: t.download_count,
              max_downloads: t.max_downloads,
              created_at: t.created_at,
              asset: t.digital_assets
                ? {
                    id: t.digital_assets.id,
                    display_name: t.digital_assets.display_name,
                    file_type: t.digital_assets.file_type,
                    file_size_bytes: t.digital_assets.file_size_bytes,
                  }
                : null,
            }))
          );
        }
      } catch (err) {
        console.error('[orders-dashboard]', err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [user, authLoading]);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#474099] border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="rounded-2xl bg-[var(--color-surface-container)] p-12 text-center min-h-[300px] flex flex-col items-center justify-center">
        <p className="text-[var(--color-neutral-600)] mb-4">
          {isAr ? 'سجّل الدخول لعرض طلباتك' : 'Sign in to view your orders'}
        </p>
        <a
          href={`/${locale}/auth/login?redirect=/${locale}/dashboard/orders`}
          className="inline-flex min-h-[44px] items-center px-6 py-2 rounded-xl bg-[#474099] text-white font-medium hover:bg-[#3a3480] transition-colors"
        >
          {isAr ? 'تسجيل الدخول' : 'Sign In'}
        </a>
      </div>
    );
  }

  const tabs: { key: TabKey; labelAr: string; labelEn: string }[] = [
    { key: 'orders', labelAr: 'طلباتي', labelEn: 'Orders' },
    { key: 'downloads', labelAr: 'تحميلاتي', labelEn: 'Downloads' },
  ];

  return (
    <div>
      {/* Tabs */}
      <div className="flex gap-2 mb-8" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`
              min-h-[44px] px-5 py-2 rounded-full text-sm font-medium transition-colors
              ${tab === t.key
                ? 'bg-[#474099] text-white'
                : 'bg-[var(--color-neutral-100)] text-[var(--color-neutral-600)] hover:bg-[var(--color-neutral-200)]'
              }
            `}
          >
            {isAr ? t.labelAr : t.labelEn}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse rounded-xl border border-[var(--color-neutral-200)] p-5">
              <div className="h-4 bg-[var(--color-neutral-100)] rounded w-1/3 mb-3" />
              <div className="h-3 bg-[var(--color-neutral-100)] rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : tab === 'orders' ? (
        <OrdersTab orders={orders} isAr={isAr} />
      ) : (
        <DownloadsTab downloads={downloads} isAr={isAr} />
      )}
    </div>
  );
}

// ── Orders Tab ──────────────────────────────────────────────────────────

function OrdersTab({ orders, isAr }: { orders: OrderWithItems[]; isAr: boolean }) {
  if (orders.length === 0) {
    return (
      <div className="rounded-2xl bg-[var(--color-surface-container)] p-12 text-center min-h-[300px] flex flex-col items-center justify-center">
        <span className="text-4xl mb-4" aria-hidden="true">🛒</span>
        <p className="text-[var(--color-neutral-600)] mb-2 font-medium">
          {isAr ? 'لا توجد طلبات بعد' : 'No orders yet'}
        </p>
        <p className="text-sm text-[var(--color-neutral-500)]">
          {isAr ? 'ستظهر طلباتك هنا بعد أول عملية شراء' : 'Your orders will appear here after your first purchase'}
        </p>
      </div>
    );
  }

  const statusLabel: Record<OrderStatus, { ar: string; en: string; color: string }> = {
    pending: { ar: 'قيد المعالجة', en: 'Pending', color: 'bg-amber-100 text-amber-700' },
    paid: { ar: 'مدفوع', en: 'Paid', color: 'bg-emerald-100 text-emerald-700' },
    shipped: { ar: 'تم الشحن', en: 'Shipped', color: 'bg-blue-100 text-blue-700' },
    delivered: { ar: 'تم التوصيل', en: 'Delivered', color: 'bg-emerald-100 text-emerald-700' },
    cancelled: { ar: 'ملغى', en: 'Cancelled', color: 'bg-red-100 text-red-700' },
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-start">
        <thead>
          <tr className="border-b border-[var(--color-neutral-200)]">
            <th className="py-3 px-4 text-start text-xs font-medium text-[var(--color-neutral-500)] uppercase tracking-wider">
              {isAr ? 'التاريخ' : 'Date'}
            </th>
            <th className="py-3 px-4 text-start text-xs font-medium text-[var(--color-neutral-500)] uppercase tracking-wider">
              {isAr ? 'رقم الطلب' : 'Order #'}
            </th>
            <th className="py-3 px-4 text-start text-xs font-medium text-[var(--color-neutral-500)] uppercase tracking-wider">
              {isAr ? 'المبلغ' : 'Amount'}
            </th>
            <th className="py-3 px-4 text-start text-xs font-medium text-[var(--color-neutral-500)] uppercase tracking-wider">
              {isAr ? 'الحالة' : 'Status'}
            </th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => {
            const status = statusLabel[order.status] || statusLabel.pending;
            const amount = (order.total_amount / 100).toLocaleString(isAr ? 'ar-AE' : 'en-AE', {
              minimumFractionDigits: 0,
              maximumFractionDigits: 0,
            });
            const date = new Date(order.created_at).toLocaleDateString(
              isAr ? 'ar-AE' : 'en-AE',
              { year: 'numeric', month: 'short', day: 'numeric' }
            );

            return (
              <tr key={order.id} className="border-b border-[var(--color-neutral-100)] hover:bg-[var(--color-neutral-50)] transition-colors">
                <td className="py-4 px-4 text-sm text-[var(--color-neutral-700)]">{date}</td>
                <td className="py-4 px-4 text-sm font-mono text-[var(--color-neutral-600)]">
                  {order.id.slice(0, 8)}
                </td>
                <td className="py-4 px-4 text-sm font-medium text-[var(--color-neutral-900)]">
                  {amount} {order.currency}
                </td>
                <td className="py-4 px-4">
                  <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${status.color}`}>
                    {isAr ? status.ar : status.en}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Downloads Tab ───────────────────────────────────────────────────────

function DownloadsTab({ downloads, isAr }: { downloads: DownloadItem[]; isAr: boolean }) {
  if (downloads.length === 0) {
    return (
      <div className="rounded-2xl bg-[var(--color-surface-container)] p-12 text-center min-h-[300px] flex flex-col items-center justify-center">
        <span className="text-4xl mb-4" aria-hidden="true">📥</span>
        <p className="text-[var(--color-neutral-600)] mb-2 font-medium">
          {isAr ? 'لا توجد تحميلات بعد' : 'No downloads yet'}
        </p>
        <p className="text-sm text-[var(--color-neutral-500)]">
          {isAr ? 'ستظهر المنتجات الرقمية هنا بعد الشراء' : 'Your digital products will appear here after purchase'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {downloads.map((dl) => {
        const expired = new Date(dl.expires_at) < new Date();
        const exhausted = dl.download_count >= dl.max_downloads;
        const disabled = expired || exhausted;
        const remaining = dl.max_downloads - dl.download_count;

        const expiresDate = new Date(dl.expires_at).toLocaleDateString(
          isAr ? 'ar-AE' : 'en-AE',
          { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }
        );

        const fileSize = dl.asset?.file_size_bytes
          ? dl.asset.file_size_bytes > 1024 * 1024
            ? `${(dl.asset.file_size_bytes / (1024 * 1024)).toFixed(1)} MB`
            : `${(dl.asset.file_size_bytes / 1024).toFixed(0)} KB`
          : null;

        return (
          <div
            key={dl.id}
            className={`rounded-xl border p-5 transition-colors ${
              disabled
                ? 'border-[var(--color-neutral-200)] bg-[var(--color-neutral-50)] opacity-60'
                : 'border-[var(--color-neutral-200)] bg-white hover:border-[#474099]/30'
            }`}
          >
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-[var(--color-neutral-900)] truncate">
                  {dl.asset?.display_name || (isAr ? 'ملف رقمي' : 'Digital file')}
                </h3>
                <div className="mt-1 flex items-center gap-3 text-xs text-[var(--color-neutral-500)]">
                  {dl.asset?.file_type && (
                    <span className="uppercase">{dl.asset.file_type}</span>
                  )}
                  {fileSize && <span>{fileSize}</span>}
                  <span>
                    {isAr ? `${remaining} تحميلات متبقية` : `${remaining} downloads remaining`}
                  </span>
                </div>
                <p className="mt-1 text-xs text-[var(--color-neutral-400)]">
                  {expired
                    ? (isAr ? 'انتهت الصلاحية' : 'Expired')
                    : (isAr ? `ينتهي: ${expiresDate}` : `Expires: ${expiresDate}`)
                  }
                </p>
              </div>

              <a
                href={disabled ? undefined : `/api/downloads/${dl.token}`}
                className={`
                  inline-flex min-h-[44px] items-center px-5 py-2 rounded-xl text-sm font-medium transition-colors
                  ${disabled
                    ? 'bg-[var(--color-neutral-200)] text-[var(--color-neutral-400)] cursor-not-allowed pointer-events-none'
                    : 'bg-[#474099] text-white hover:bg-[#3a3480]'
                  }
                `}
                {...(disabled ? { 'aria-disabled': true } : {})}
              >
                {isAr ? 'تحميل' : 'Download'}
              </a>
            </div>
          </div>
        );
      })}
    </div>
  );
}
