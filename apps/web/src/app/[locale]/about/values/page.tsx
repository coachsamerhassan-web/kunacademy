import { setRequestLocale } from 'next-intl/server';
import { Section } from '@kunacademy/ui/section';
import { GeometricPattern } from '@kunacademy/ui/patterns';
import { Card } from '@kunacademy/ui/card';
import type { Metadata } from 'next';

interface Props { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const isAr = locale === 'ar';
  return {
    title: isAr ? 'قيمنا | أكاديمية كُن' : 'Our Values | Kun Academy',
    description: isAr
      ? 'القيم التي تقود أكاديمية كُن — الإحسان والحضور والأمانة والشراكة'
      : 'The values that guide Kun Academy — Ihsan, Presence, Integrity, and Partnership',
  };
}

const values = [
  {
    titleAr: 'الإحسان',
    titleEn: 'Ihsan (الإحسان)',
    descAr: 'الإحسان هو معيار الجودة في كُن — ليس «جيد بما يكفي»، بل «إتقان بتفانٍ». كل برنامج، كل جلسة، كل تفاعل يحمل بصمة الإحسان: أن تُقدّم العمل كأن الله يراك.',
    descEn: 'Ihsan is the quality standard at Kun — not "good enough" but "devotion in action." Every program, every session, every interaction carries the mark of Ihsan: to deliver work as if the Divine is watching.',
    color: 'var(--color-primary)',
    bgColor: 'var(--color-primary-50)',
  },
  {
    titleAr: 'الحضور',
    titleEn: 'Presence',
    descAr: 'الحضور الكامل — مع النفس، مع الآخر، مع اللحظة. نؤمن أن التغيير الحقيقي لا يحدث من التفكير وحده، بل من الحضور الجسدي والعقلي والنفسي في آنٍ واحد.',
    descEn: 'Full presence — with self, with others, with the moment. We believe real change doesn\'t come from thinking alone, but from physical, mental, and psychological presence simultaneously.',
    color: 'var(--color-secondary)',
    bgColor: 'var(--color-secondary-50)',
  },
  {
    titleAr: 'الأمانة',
    titleEn: 'Integrity',
    descAr: 'نقول ما نعني ونفعل ما نقول. لا نعد بنتائج لا نستطيع تحقيقها. لا نتجاوز حدود الكوتشينج إلى العلاج النفسي. نحترم المساحة الآمنة التي يمنحنا إياها عملاؤنا.',
    descEn: 'We say what we mean and do what we say. We don\'t promise results we can\'t deliver. We don\'t cross from coaching into therapy. We respect the safe space our clients grant us.',
    color: 'var(--color-accent)',
    bgColor: 'rgba(244, 126, 66, 0.08)',
  },
  {
    titleAr: 'الشراكة',
    titleEn: 'Partnership',
    descAr: 'العلاقة بين الكوتش والعميل شراكة حقيقية — لا خبير ومتلقٍّ. والعلاقة بين الجسد والعقل شراكة أعمق — لا سيّد وتابع. نبني كل شيء على مبدأ الشراكة.',
    descEn: 'The coach-client relationship is a true partnership — not expert and receiver. And the body-mind relationship is a deeper partnership — not master and servant. We build everything on the principle of partnership.',
    color: '#2D8A6F',
    bgColor: 'rgba(45, 138, 111, 0.08)',
  },
  {
    titleAr: 'التكامل',
    titleEn: 'Integration',
    descAr: 'لا انفصال بين الشخصي والمهني، بين النظرية والتطبيق، بين الجسد والعقل. نؤمن أن الإنسان كيان واحد — وبرامجنا تعكس ذلك.',
    descEn: 'No separation between personal and professional, between theory and practice, between body and mind. We believe the human is one integrated being — and our programs reflect that.',
    color: 'var(--color-primary-400)',
    bgColor: 'var(--color-primary-50)',
  },
  {
    titleAr: 'الجرأة',
    titleEn: 'Courage',
    descAr: 'نُسمّي الأشياء بأسمائها. لا نُلطّف الحقائق ولا نخفيها خلف مصطلحات رنّانة. نؤمن أن النمو يبدأ من مواجهة الحقيقة — بلطف، لكن بصدق.',
    descEn: 'We call things by their names. We don\'t sugarcoat truths or hide them behind fancy terminology. We believe growth begins with facing reality — gently, but honestly.',
    color: 'var(--color-primary-600)',
    bgColor: 'var(--color-primary-50)',
  },
];

export default async function ValuesPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  return (
    <main>
      {/* Hero */}
      <section className="relative overflow-hidden py-16 md:py-24">
        <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, var(--color-primary) 0%, #1D1A3D 100%)' }} />
        <GeometricPattern pattern="girih" opacity={0.08} fade="both" />
        <div className="relative z-10 mx-auto max-w-[var(--max-content-width)] px-4 md:px-6 text-center animate-fade-up">
          <h1
            className="text-[2.25rem] md:text-[3.5rem] font-bold text-[#FFF5E9] leading-[1.1]"
            style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
          >
            {isAr ? 'قيمنا' : 'Our Values'}
          </h1>
          <p className="mt-4 text-white/65 max-w-2xl mx-auto text-lg md:text-xl">
            {isAr
              ? 'القيم التي تقود كل ما نفعله — في برامجنا وجلساتنا وعلاقاتنا'
              : 'The values that drive everything we do — in our programs, sessions, and relationships'}
          </p>
        </div>
      </section>

      {/* Values Grid */}
      <Section variant="white">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {values.map((value, i) => (
            <Card key={i} accent className="p-6 h-full">
              <div
                className="h-12 w-12 rounded-xl flex items-center justify-center mb-4 text-2xl font-bold"
                style={{ backgroundColor: value.bgColor, color: value.color }}
              >
                {(i + 1).toString().padStart(2, '0')}
              </div>
              <h3
                className="text-lg font-bold text-[var(--text-primary)] mb-3"
                style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
              >
                {isAr ? value.titleAr : value.titleEn}
              </h3>
              <p
                className="text-sm text-[var(--color-neutral-600)] leading-relaxed"
                style={{ fontFamily: isAr ? 'var(--font-arabic-body)' : 'inherit' }}
              >
                {isAr ? value.descAr : value.descEn}
              </p>
            </Card>
          ))}
        </div>
      </Section>

      {/* Quote */}
      <Section variant="surface">
        <blockquote className="max-w-2xl mx-auto text-center">
          <p
            className="text-xl md:text-2xl text-[var(--text-primary)] leading-relaxed font-medium italic"
            style={{ fontFamily: isAr ? 'var(--font-arabic-body)' : 'inherit' }}
          >
            {isAr
              ? '«إنَّ اللَّهَ كَتَبَ الإحسانَ على كلِّ شيءٍ»'
              : '"Allah has prescribed Ihsan (excellence) in everything."'}
          </p>
          <footer className="mt-4 text-sm text-[var(--color-neutral-500)]">
            {isAr ? '(صحيح مسلم ١٩٥٥)' : '(Sahih Muslim 1955)'}
          </footer>
        </blockquote>
      </Section>
    </main>
  );
}
