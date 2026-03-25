import { setRequestLocale } from 'next-intl/server';
import { GeometricPattern } from '@kunacademy/ui/patterns';
import { Section } from '@kunacademy/ui/section';
import { BoardDetail } from './board-detail';

export default async function BoardPage({ params }: { params: Promise<{ locale: string; boardId: string }> }) {
  const { locale, boardId } = await params;
  setRequestLocale(locale);

  return (
    <main>
      <Section variant="white">
        <BoardDetail locale={locale} boardId={boardId} />
      </Section>
    </main>
  );
}
