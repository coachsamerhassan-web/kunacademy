// @ts-nocheck
'use client';

import { useAuth } from '@kunacademy/auth';
import { useEffect, useState } from 'react';
import { createBrowserClient } from '@kunacademy/db';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';
import { useParams, useRouter } from 'next/navigation';

export default function AdminInstructorsPage() {
  const { locale } = useParams<{ locale: string }>();
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const isAr = locale === 'ar';

  useEffect(() => {
    if (authLoading) return;
    if (!user || profile?.role !== 'admin') { router.push('/' + locale + '/auth/login'); return; }
    const s = createBrowserClient() as any;
    s.from('instructors').select('*').limit(100).then(({ data }: any) => {
      setItems(data ?? []);
      setLoading(false);
    });
  }, [user, profile, authLoading]);

  if (authLoading || loading) return <Section><p className="text-center py-12">Loading...</p></Section>;

  return (
    <main>
      <Section variant="white">
        <div className="flex items-center justify-between">
          <Heading level={1}>{isAr ? 'المدرّبون' : 'Instructors'}</Heading>
          <a href={'/' + locale + '/admin'} className="text-[var(--color-primary)] text-sm hover:underline">{isAr ? '← لوحة الإدارة' : '← Dashboard'}</a>
        </div>
        <p className="mt-2 text-[var(--color-neutral-500)]">{items.length} {isAr ? 'سجل' : 'records'}</p>
        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-neutral-200)]">
                {items.length > 0 && Object.keys(items[0]).slice(0, 6).map((key) => (
                  <th key={key} className="px-3 py-2 text-start font-medium text-[var(--color-neutral-500)]">{key}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item: any) => (
                <tr key={item.id} className="border-b border-[var(--color-neutral-100)] hover:bg-[var(--color-neutral-50)]">
                  {Object.values(item).slice(0, 6).map((val: any, i: number) => (
                    <td key={i} className="px-3 py-2 max-w-[200px] truncate">{typeof val === 'object' ? JSON.stringify(val).slice(0, 50) : String(val ?? '').slice(0, 50)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </main>
  );
}
