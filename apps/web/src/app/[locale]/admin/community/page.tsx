'use client';

import { useAuth } from '@kunacademy/auth';
import { useEffect, useState } from 'react';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

// Schema uses: name_ar, name_en, is_admin_only (NOT title_ar/title_en/is_public)
interface Board {
  id: string;
  name_ar: string;
  name_en: string;
  slug: string;
  description_ar: string | null;
  description_en: string | null;
  is_admin_only: boolean;
  type: string;
  created_at: string;
}

export default function AdminCommunityPage() {
  const { locale } = useParams<{ locale: string }>();
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const [boards, setBoards] = useState<Board[]>([]);
  const [postCount, setPostCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const isAr = locale === 'ar';

  useEffect(() => {
    if (authLoading) return;
    if (!user || (profile?.role !== 'admin' && profile?.role !== 'super_admin')) { router.push('/' + locale + '/auth/login'); return; }

    Promise.all([
      fetch('/api/admin/community-boards'),
      fetch('/api/admin/community-post-count'),
    ]).then(async ([boardsRes, postsRes]) => {
      if (boardsRes.ok) {
        const data = await boardsRes.json();
        setBoards(data.boards ?? []);
      }
      if (postsRes.ok) {
        const data = await postsRes.json();
        setPostCount(data.count ?? 0);
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [user, profile, authLoading]);

  if (authLoading || loading) return <Section><p className="text-center py-12">Loading...</p></Section>;

  return (
    <main>
      <Section variant="white">
        <div className="flex items-center justify-between mb-6">
          <div>
            <Heading level={1}>{isAr ? 'المجتمع' : 'Community'}</Heading>
            <p className="mt-1 text-sm text-[var(--color-neutral-500)]">
              {boards.length} {isAr ? 'لوحة' : 'boards'} · {postCount} {isAr ? 'منشور' : 'posts'}
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
                <th className="px-4 py-3 text-start font-medium text-[var(--color-neutral-500)]">{isAr ? 'اللوحة' : 'Board'}</th>
                <th className="px-4 py-3 text-start font-medium text-[var(--color-neutral-500)]">{isAr ? 'الوصف' : 'Description'}</th>
                <th className="px-4 py-3 text-start font-medium text-[var(--color-neutral-500)]">{isAr ? 'الحالة' : 'Visibility'}</th>
              </tr>
            </thead>
            <tbody>
              {boards.length === 0 ? (
                <tr><td colSpan={3} className="px-4 py-8 text-center text-[var(--color-neutral-400)]">{isAr ? 'لا توجد لوحات' : 'No community boards yet'}</td></tr>
              ) : boards.map(board => (
                <tr key={board.id} className="border-b border-[var(--color-neutral-100)] hover:bg-[var(--color-neutral-50)]">
                  <td className="px-4 py-3">
                    <div className="font-medium text-[var(--text-primary)]">{isAr ? board.name_ar : board.name_en}</div>
                    <div className="text-xs text-[var(--color-neutral-400)]">/{board.slug}</div>
                  </td>
                  <td className="px-4 py-3 text-[var(--color-neutral-600)] text-sm max-w-xs truncate">
                    {(isAr ? board.description_ar : board.description_en) || '-'}
                  </td>
                  <td className="px-4 py-3">
                    {/* is_admin_only=false means public; true means admin/members only */}
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${!board.is_admin_only ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                      {!board.is_admin_only ? (isAr ? 'عام' : 'Public') : (isAr ? 'خاص' : 'Private')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </main>
  );
}
