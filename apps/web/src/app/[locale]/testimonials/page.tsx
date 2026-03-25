import { setRequestLocale } from 'next-intl/server';
import { Section } from '@kunacademy/ui/section';
import { TestimonialCard } from '@kunacademy/ui/card';
import { GeometricPattern } from '@kunacademy/ui/patterns';

export default async function TestimonialsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  // Placeholder testimonials — will be replaced with DB data in Phase 3
  const testimonials = isAr ? [
    { name: 'أحمد الشمري', content: 'التفكير الحسّي غيّر طريقة ممارستي للكوتشينج بالكامل. أصبحت أستمع لجسدي قبل عقلي.', program: 'STCE Level 2' },
    { name: 'نورة القحطاني', content: 'شهادة معتمدة من ICF وتجربة تعليمية لا مثيل لها. أنصح بها كل كوتش طموح.', program: 'STCE Level 1' },
    { name: 'خالد المنصوري', content: 'برنامج الكوتشينج الإسلامي فتح لي آفاقًا جديدة في دمج القيم مع المنهجية العلمية.', program: 'الكوتشينج الإسلامي' },
    { name: 'فاطمة الحربي', content: 'خلوة إحياء كانت نقطة تحوّل حقيقية. لم أتخيّل أن 5 أيام ستغيّر نظرتي لكل شيء.', program: 'خلوة إحياء' },
    { name: 'عبدالله الزهراني', content: 'المنهجية مختلفة تمامًا عن أي شيء درسته. الجسد يعرف قبل العقل — وهذا ما تعلّمته هنا.', program: 'STCE Level 3' },
    { name: 'سارة العتيبي', content: 'سامر حسن كوتش استثنائي. جلسة واحدة معه تساوي عشر جلسات عادية.', program: 'كوتشينج فردي' },
  ] : [
    { name: 'Ahmed Al-Shamri', content: 'Somatic Thinking completely changed how I practice coaching. I now listen to my body before my mind.', program: 'STCE Level 2' },
    { name: 'Noura Al-Qahtani', content: 'ICF-accredited certification with an unmatched learning experience. I recommend it to every aspiring coach.', program: 'STCE Level 1' },
    { name: 'Khaled Al-Mansoori', content: 'The Islamic Coaching program opened new horizons in integrating values with scientific methodology.', program: 'Islamic Coaching' },
    { name: 'Fatima Al-Harbi', content: 'The Ihya retreat was a real turning point. I never imagined 5 days could change my perspective on everything.', program: 'Ihya Retreat' },
    { name: 'Abdullah Al-Zahrani', content: 'The methodology is completely different from anything I\'ve studied. The body knows before the mind.', program: 'STCE Level 3' },
    { name: 'Sarah Al-Otaibi', content: 'Samer Hassan is an exceptional coach. One session with him equals ten regular sessions.', program: 'Individual Coaching' },
  ];

  return (
    <main>
      {/* Hero with decorative quote mark */}
      <section className="relative overflow-hidden py-16 md:py-24" style={{ background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-600) 100%)' }}>
        <GeometricPattern pattern="girih" opacity={0.08} fade="both" />
        {/* Large decorative quote */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[20rem] leading-none text-white/[0.04] font-serif pointer-events-none select-none" aria-hidden="true">
          &ldquo;
        </div>
        <div className="relative z-10 mx-auto max-w-[var(--max-content-width)] px-4 md:px-6 text-center animate-fade-up">
          <h1
            className="text-[2.25rem] md:text-[3.5rem] font-bold text-[#FFF5E9] leading-[1.1]"
            style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
          >
            {isAr ? 'قالوا عن كُن' : 'What They Say About Kun'}
          </h1>
          <p className="mt-4 text-white/65 max-w-lg mx-auto text-lg md:text-xl">
            {isAr ? 'تجارب حقيقية من خرّيجي أكاديمية كُن' : 'Real experiences from Kun Academy graduates'}
          </p>
        </div>
      </section>

      {/* Testimonials grid */}
      <Section variant="surface">
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 stagger-children">
          {testimonials.map((t, i) => (
            <TestimonialCard
              key={i}
              authorName={t.name}
              content={t.content}
              program={t.program}
              rating={5}
            />
          ))}
        </div>
      </Section>
    </main>
  );
}
