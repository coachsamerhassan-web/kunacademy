'use client';

import { BookCover3D } from '@/components/book-cover-3d';

interface Book {
  slug: string;
  title: string;
  author: string;
  coverImage: string;
}

interface BookshelfGridProps {
  books: Book[];
  locale: string;
}

export function BookshelfGrid({ books, locale }: BookshelfGridProps) {
  const isAr = locale === 'ar';

  if (books.length === 0) {
    return (
      <div className="bg-[var(--color-surface-container,var(--color-surface-high))] rounded-2xl p-12 flex flex-col items-center justify-center min-h-[400px] text-center">
        {/* Empty bookshelf icon */}
        <svg
          width="64"
          height="64"
          viewBox="0 0 64 64"
          fill="none"
          className="mb-6 opacity-30"
        >
          <rect x="8" y="12" width="12" height="40" rx="2" stroke="currentColor" strokeWidth="2" />
          <rect x="24" y="8" width="12" height="44" rx="2" stroke="currentColor" strokeWidth="2" />
          <rect x="40" y="16" width="12" height="36" rx="2" stroke="currentColor" strokeWidth="2" />
          <line x1="4" y1="54" x2="60" y2="54" stroke="currentColor" strokeWidth="2" />
        </svg>

        <p
          className="text-[var(--color-neutral-500)] text-lg mb-2"
          style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
        >
          {isAr ? 'مكتبتك فارغة' : 'Your bookshelf is empty'}
        </p>
        <p
          className="text-[var(--color-neutral-400)] text-sm mb-6"
          style={{ fontFamily: isAr ? 'var(--font-arabic-body)' : 'var(--font-english-body)' }}
        >
          {isAr ? 'تصفّح متجرنا واكتشف الكتب المتاحة' : 'Explore our shop and discover available books'}
        </p>
        <a
          href={`/${locale}/shop`}
          className="inline-flex items-center px-6 py-3 rounded-xl text-sm font-medium min-h-[44px] transition-transform hover:scale-105"
          style={{
            backgroundColor: 'var(--color-primary)',
            color: '#fff',
            fontFamily: isAr ? 'var(--font-arabic-body)' : 'var(--font-english-body)',
          }}
        >
          {isAr ? 'تصفّح المتجر' : 'Browse Shop'}
        </a>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-8">
      {books.map((book) => (
        <BookCover3D
          key={book.slug}
          slug={book.slug}
          coverImage={book.coverImage}
          title={book.title}
          author={book.author}
          locale={locale}
        />
      ))}
    </div>
  );
}
