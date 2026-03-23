import {setRequestLocale} from 'next-intl/server';

export default async function HomePage({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  setRequestLocale(locale);

  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold">Kun Academy</h1>
        <p className="text-lg mt-4">أكاديمية كُن للكوتشينج</p>
        <p className="text-sm mt-2 text-gray-500">Wave 0 — Infrastructure Complete</p>
      </div>
    </main>
  );
}
