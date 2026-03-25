import { setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { createServerClient } from '@kunacademy/db';
import { BookReader } from './book-reader';

// Book metadata (hardcoded for now — will move to CMS/DB)
const BOOKS: Record<string, {
  title_ar: string;
  title_en: string;
  author_ar: string;
  author_en: string;
  coverImage: string;
  isPaid: boolean;
  hasSample: boolean;
}> = {
  'balance-to-barakah': {
    title_ar: 'من التوازن إلى البركة',
    title_en: 'Balance to Barakah',
    author_ar: 'سامر حسن',
    author_en: 'Samer Hassan',
    coverImage: '/images/products/books/balance-to-barakah-front.jpg',
    isPaid: true,
    hasSample: true,
  },
};

export default async function ReaderPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const book = BOOKS[slug];
  if (!book) {
    redirect(`/${locale}/shop`);
  }

  const isAr = locale === 'ar';
  let hasAccess = false;
  let userId: string | null = null;

  // Check auth + book access
  const supabase = createServerClient();
  if (supabase) {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      userId = user.id;
      const { data: access } = await supabase
        .from('book_access')
        .select('id')
        .eq('user_id', user.id)
        .eq('book_slug', slug)
        .single();
      hasAccess = !!access;
    }
  }

  // If paid book and no access, allow sample reading
  const mode = book.isPaid && !hasAccess ? 'sample' : 'full';

  return (
    <div className="min-h-screen bg-[var(--color-background)]">
      <BookReader
        slug={slug}
        title={isAr ? book.title_ar : book.title_en}
        author={isAr ? book.author_ar : book.author_en}
        coverImage={book.coverImage}
        locale={locale}
        mode={mode}
        hasSample={book.hasSample}
      />
    </div>
  );
}
