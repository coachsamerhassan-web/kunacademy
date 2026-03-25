// @ts-nocheck
'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@kunacademy/db';

interface Board {
  id: string;
  name_ar: string;
  name_en: string;
  description_ar: string | null;
  description_en: string | null;
  post_count?: number;
}

export function BoardsList({ locale }: { locale: string }) {
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);
  const isAr = locale === 'ar';

  useEffect(() => {
    const supabase = createBrowserClient();
    if (!supabase) return;
    supabase.from('community_boards').select('*').order('created_at')
      .then(({ data }) => { setBoards(data || []); setLoading(false); });
  }, []);

  if (loading) return <div className="py-8 text-center text-[var(--color-neutral-500)]">{isAr ? 'جاري التحميل...' : 'Loading...'}</div>;

  return (
    <div className="mt-6 space-y-3">
      {boards.map(board => (
        <a
          key={board.id}
          href={`/${locale}/community/boards/${board.id}`}
          className="block rounded-lg border border-[var(--color-neutral-200)] p-4 hover:shadow-sm transition"
        >
          <h2 className="font-medium text-lg">{isAr ? board.name_ar : board.name_en}</h2>
          {(isAr ? board.description_ar : board.description_en) && (
            <p className="text-sm text-[var(--color-neutral-500)] mt-1">{isAr ? board.description_ar : board.description_en}</p>
          )}
        </a>
      ))}
      {boards.length === 0 && (
        <p className="text-center text-[var(--color-neutral-500)]">{isAr ? 'لا توجد منتديات بعد' : 'No boards yet'}</p>
      )}
    </div>
  );
}
