import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { GeometricPattern } from '@kunacademy/ui/patterns';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';
import { BoardsList } from './boards-list';

interface Props { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const isAr = locale === 'ar';
  return {
    title: isAr ? 'منتديات النقاش | أكاديمية كُن' : 'Discussion Boards | Kun Academy',
    description: isAr
      ? 'شارك في منتديات النقاش مع مجتمع كُن — تبادل الخبرات والأفكار مع الكوتشز'
      : 'Join discussion boards with the Kun community — exchange insights with fellow coaches.',
  };
}

export default async function BoardsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  return (
    <main>
      <Section variant="white">
        <Heading level={1}>{isAr ? 'منتديات النقاش' : 'Discussion Boards'}</Heading>
        <BoardsList locale={locale} />
      </Section>
    </main>
  );
}
