import { setRequestLocale } from 'next-intl/server';
import { createServerClient } from '@kunacademy/db';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';
import { BookshelfGrid } from './bookshelf-grid';

// Book catalog (hardcoded — will move to CMS/DB)
const BOOK_CATALOG: Record<string, {
  title_ar: string;
  title_en: string;
  author_ar: string;
  author_en: string;
  coverImage: string;
}> = {
  'balance-to-barakah': {
    title_ar: 'من التوازن إلى البركة',
    title_en: 'Balance to Barakah',
    author_ar: 'سامر حسن',
    author_en: 'Samer Hassan',
    coverImage: '/images/products/books/balance-to-barakah-front.jpg',
  },
};

export default async function BookshelfPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  // Fetch user's book access
  let ownedBooks: { slug: string; title: string; author: string; coverImage: string }[] = [];

  const supabase = createServerClient();
  if (supabase) {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: access } = await supabase
        .from('book_access')
        .select('book_slug, granted_at')
        .eq('user_id', user.id)
        .order('granted_at', { ascending: false });

      if (access) {
        ownedBooks = access
          .map((a: { book_slug: string }) => {
            const book = BOOK_CATALOG[a.book_slug];
            if (!book) return null;
            return {
              slug: a.book_slug,
              title: isAr ? book.title_ar : book.title_en,
              author: isAr ? book.author_ar : book.author_en,
              coverImage: book.coverImage,
            };
          })
          .filter(Boolean) as typeof ownedBooks;
      }
    }
  }

  return (
    <main>
      <Section variant="white">
        <Heading level={1} className="mb-8">
          {isAr ? 'مكتبتي' : 'My Bookshelf'}
        </Heading>
        <BookshelfGrid books={ownedBooks} locale={locale} />
      </Section>
    </main>
  );
}
