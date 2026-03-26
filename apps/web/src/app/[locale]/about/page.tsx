import { setRequestLocale } from 'next-intl/server';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';
import { Button } from '@kunacademy/ui/button';
import { Card } from '@kunacademy/ui/card';
import { FAQSection } from '@kunacademy/ui/faq-section';
import { faqJsonLd } from '@kunacademy/ui/faq-jsonld';
import { aboutFaqs } from '@/data/faqs';
import { GeometricPattern } from '@kunacademy/ui/patterns';
import type { Metadata } from 'next';
import { TimelineCardContent } from './timeline-card';

interface Props { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const isAr = locale === 'ar';
  return {
    title: isAr ? 'عن كُنْ | أكاديمية كُنْ كوتشينج' : 'About KUN | Kun Coaching Academy',
    description: isAr
      ? 'كُنْ ليست مؤسسة تعليمية تقليدية — إنها حركة تربوية معاصرة تُعيد تعريف التربية من الداخل'
      : 'KUN is not a traditional educational institution — it is a contemporary educational movement redefining education from within',
  };
}

// ── Timeline Data ─────────────────────────────────────────────────────
const timeline = [
  {
    year: '2000–2013',
    titleAr: 'قبل كُنْ: بحث وترحال',
    titleEn: 'Before KUN: Search & Travel',
    textAr: 'من الصين إلى كندا إلى أمريكا إلى أوروبا، تنقّل سامر بين مدارس الفنون القتالية والفنون الإستشفائية والكوتشينج، وأسّس في القاهرة "Dragon Academy" كأول مركز يجمع بين التدريب الجسدي والعقلي بغرض التوازن والنمو. كوّن خلالها رؤية تُجسّد الإنسان ككائن متكامل، لا كأداء وظيفي، وأسّس بها نواة منهجية "التفكير الحسي".',
    textEn: 'From China to Canada to America to Europe, Samer moved between schools of martial arts, healing arts, and coaching, and founded "Dragon Academy" in Cairo as the first center combining physical and mental training for balance and growth. During this time, he formed a vision that embodies the human as an integrated being, and established the nucleus of the "Somatic Thinking" methodology.',
    image: '/images/about/timeline/before-kun.jpg',
  },
  {
    year: '2014',
    titleAr: 'روما: التأسيس الرسمي لكُنْ',
    titleEn: 'Rome: Official Founding of KUN',
    textAr: 'افتُتح أول مقر رسمي لكُنْ في روما، حيث تلاقحت التجربة الشرقية والغربية. في هذه المرحلة، تأسست منهجية التفكير الحسي®، بوصفها فلسفة تربوية تُفعّل العلاقة بين الجسد، والنية، والوعي، وتعيد الإنسان إلى ذاته من خلال الحضور.',
    textEn: 'The first official headquarters of KUN was opened in Rome, where Eastern and Western experiences converged. The Somatic Thinking® methodology was established as an applied educational philosophy that activates the relationship between body, intention, and awareness.',
    image: '/images/about/timeline/roma-founding.jpg',
  },
  {
    year: '2017',
    titleAr: 'اعتماد MCC من ICF',
    titleEn: 'MCC Accreditation from ICF',
    textAr: 'حصل سامر على اعتماد Master Certified Coach (MCC) من الاتحاد الدولي للكوتشينج، ليصبح أول متحدّث بالعربية ينال هذا التصنيف الرفيع.',
    textEn: 'Samer obtained the Master Certified Coach (MCC) accreditation from the International Coaching Federation, becoming the first Arabic speaker to achieve this high classification.',
    image: '/images/about/timeline/mcc-accreditation.jpg',
  },
  {
    year: '2018',
    titleAr: 'إطلاق برنامجنا المعتمد',
    titleEn: 'Launch of Our Accredited Program',
    textAr: 'اعتماد برنامج التفكير الحسي كبرنامج تدريبي دولي من ICF، مما أسّس لأول مسار تدريبي عربي معتمد في الكوتشينج قائم على فلسفة عربية أصيلة.',
    textEn: 'Accreditation of the Somatic Thinking program as an international training program from ICF, establishing the first accredited Arab training path in coaching based on an authentic Arab philosophy.',
    image: '/images/about/timeline/stce-launch.jpg',
  },
  {
    year: '2019',
    titleAr: 'جائزة القائد الشاب من ICF',
    titleEn: 'ICF Young Leader Award',
    textAr: 'تتويجاً لرحلته الفكرية والتربوية، حصل سامر على جائزة "القائد الشاب في الكوتشينج" من ICF العالمية، اعترافاً برؤيته المتفرّدة.',
    textEn: 'Crowning his intellectual and educational journey, Samer received the "Young Leader in Coaching" award from ICF Global, in recognition of his unique vision.',
    image: '/images/about/timeline/2019-award.jpg',
  },
  {
    year: '2019',
    titleAr: 'مصر: الامتداد العربي الأول',
    titleEn: 'Egypt: First Arab Expansion',
    textAr: 'افتتاح فرع كُنْ في القاهرة، امتداداً لفرع روما، مع إطلاق برامج تدريبية متجذّرة في القيم واللغة والسياق العربي.',
    textEn: 'Opening of the KUN branch in Cairo, as an extension of the Rome branch, with the launch of training programs rooted in Arab values, language, and context.',
    image: '/images/about/timeline/2019-egypt.jpg',
  },
  {
    year: '2022',
    titleAr: 'العراق: شراكة مجتمعية',
    titleEn: 'Iraq: Community Partnership',
    textAr: 'شراكة مع د. خالد البصيصي، لإطلاق برامج تنموية في العراق، ترتكز على التوازن بين الفرد والمجتمع، والأصالة والإبداع.',
    textEn: 'Partnership with Dr. Khaled Al-Basisi, to launch developmental programs in Iraq, based on the balance between the individual and society, authenticity and creativity.',
    image: '/images/about/timeline/2022-iraq.jpg',
  },
  {
    year: '2022',
    titleAr: 'دبي: التمركز الاستراتيجي',
    titleEn: 'Dubai: Strategic Hub',
    textAr: 'نقل المقر الرئيسي إلى دبي، وإطلاق البوابة الرقمية الأكاديمية، مع تركيز على تجربة المتعلم، والتوسّع الخليجي والعالمي.',
    textEn: 'Moving the main headquarters to Dubai, and launching the digital academic portal, with a focus on the learner experience, and Gulf and global expansion.',
    image: '/images/about/timeline/dubai-base.jpg',
  },
  {
    year: '2024',
    titleAr: 'جدة: إطلاق المسارات التربوية',
    titleEn: 'Jeddah: Educational Paths Launch',
    textAr: 'بالشراكة مع كوتش ريم بخيت، أطلقت كُنْ أول مسارات تربوية متكاملة تُفعّل التفكير الحسي في بيئة سعودية أصيلة.',
    textEn: 'In partnership with Coach Reem Bakheet, KUN launched the first integrated educational paths that activate Somatic Thinking in an authentic Saudi environment.',
    image: '/images/about/timeline/jeddah-launch.jpg',
  },
  {
    year: '2024',
    titleAr: 'أبوظبي: إعلان التحوّل الفلسفي',
    titleEn: 'Abu Dhabi: Philosophical Transformation',
    textAr: 'في القمة العربية للكوتشينج، أطلق سامر دعوته لإحياء التربية بوصفها مسار حياة، لا مجرد وسيلة تعليم. دعوة لإعادة تعريف الكوتش كمربٍّ معاصر.',
    textEn: 'At the Arab Coaching Summit, Samer launched his call to revive education as a life path, not just a means of teaching. A call to redefine the coach as a contemporary educator.',
    image: '/images/about/timeline/abudhabi-announcement.jpg',
  },
  {
    year: '2025+',
    titleAr: 'نحو الأفق',
    titleEn: 'Towards the Horizon',
    textAr: 'تُطلق منصتنا التعليمية الكاملة، وتُعتمد "البركة الحركية" كمنهج تربوي مستقل، وتُترجم مناهجنا إلى لغات جديدة، ويُفتتح مركز كُنْ للتجربة التربوية الحضورية.',
    textEn: 'Launching our full educational platform, accrediting "Barakah Flows" as an independent methodology, translating our curricula to new languages, and opening the KUN Center for in-person educational experiences.',
    image: '',
  },
];

// ── Values Data ─────────────────────────────────────────────────────
const values = [
  {
    nameAr: 'الحضور', nameEn: 'Presence',
    textAr: 'الحضور قدرة فطرية نمتلكها جميعا، وهو جذر كل مهارة نتعلّمها. لنعيش بوعي، نحتاج أن نُلاحظ أنفسنا وتفاعلاتنا مع الحياة في لحظتها، كما هي، دون مقاومة أو هروب.',
    textEn: 'Presence is an innate ability we all possess, and it is the root of every skill we learn. To live consciously, we need to observe ourselves and our interactions with life in its moment, as it is, without resistance or escape.',
    icon: '◉',
  },
  {
    nameAr: 'الأصالة', nameEn: 'Authenticity',
    textAr: 'الأصالة هي أن يعبر العقل والجسد عن نفس الرسالة بلا تناقض. أن نعيش بذاتنا لا بردود أفعال موروثة، وأن نتعامل مع أنفسنا ومجتمعاتنا بشفافية وصدق.',
    textEn: 'Authenticity is when the mind and body express the same message without contradiction. To live as ourselves, not with inherited reactions, and to deal with ourselves and our societies with transparency and honesty.',
    icon: '◈',
  },
  {
    nameAr: 'الإحسان', nameEn: 'Ihsan (Excellence)',
    textAr: 'أن تعمل بإتقان، من قلبك، لا من رغبتك في النتيجة. في كُنْ، نُقدّم ما نُحبّ، بإحسان، لأن القيمة في الفعل ذاته، لا في مردوده.',
    textEn: 'To work with perfection, from your heart, not from your desire for the result. At KUN, we offer what we love, with excellence, because the value is in the act itself, not in its return.',
    icon: '❋',
  },
  {
    nameAr: 'الصِلة', nameEn: 'Connection',
    textAr: 'لا يمكننا تجزئة الإنسان؛ الجسد، النفس، الروح، والسلوك… كلّها تتفاعل معًا. نؤمن أن الحياة تحكمها قوانين ترابط، وأن كل ما نعيشه يتأثر بما فينا وما حولنا.',
    textEn: 'We cannot fragment the human; body, soul, spirit, and behavior... all interact together. We believe that life is governed by laws of interconnection, and that everything we experience is affected by what is within us and around us.',
    icon: '∞',
  },
  {
    nameAr: 'الصُحبة', nameEn: 'Companionship',
    textAr: 'لتعيش هذه القيم، نحتاج إلى صحبة صادقة وآمنة. في كُنْ، لا نرشد ولا نحكم، بل نرافق… نتدرّب معًا على أن نكون على حقيقتنا في كل زمان ومكان.',
    textEn: 'To live these values, we need honest and safe companionship. At KUN, we don\'t guide or judge, but accompany... we train together to be true to ourselves in every time and place.',
    icon: '☾',
  },
];

// ── Team Data ─────────────────────────────────────────────────────
const team = [
  { nameAr: 'سامر حسن', nameEn: 'Samer Hassan', roleAr: 'مؤسس و CEO', roleEn: 'Founder & CEO', photo: '/images/about/team/samer-hassan.jpg' },
  { nameAr: 'مروى شريف', nameEn: 'Marwa Sherif', roleAr: 'شريك و PR', roleEn: 'Partner & PR', photo: '/images/about/team/marwa-sherif.jpg' },
  { nameAr: 'إيمان فريد', nameEn: 'Eman Farid', roleAr: 'مديرة المبيعات والتسويق', roleEn: 'Sales & Marketing Manager', photo: '/images/about/team/eman-farid.jpg' },
  { nameAr: 'ريم بخيت', nameEn: 'Reem Bakheet', roleAr: 'شريكتنا في جدة', roleEn: 'Our Partner in Jeddah', photo: '/images/about/team/reem-bakheet.jpg' },
  { nameAr: 'خالد البصيصي', nameEn: 'Khaled Al-Basisi', roleAr: 'شريكنا في العراق', roleEn: 'Our Partner in Iraq', photo: '/images/about/team/khaled-basisi.jpg' },
  { nameAr: 'ياسمين حسن', nameEn: 'Yasmin Hassan', roleAr: 'مديرة الحسابات', roleEn: 'Accounts Manager', photo: '/images/about/team/yasmin-hassan.jpg' },
];

export default async function AboutPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  return (
    <main>
      {/* ── 1. HERO ── */}
      <section className="relative overflow-hidden py-20 md:py-28">
        <div className="absolute inset-0">
          <img
            src="/images/about/hero-islamic-window.webp"
            alt=""
            className="w-full h-full object-cover"
            style={{ filter: 'brightness(0.25)' }}
            loading="eager"
          />
          <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, rgba(71,64,153,0.85) 0%, rgba(29,26,61,0.9) 100%)' }} />
          <GeometricPattern pattern="flower-of-life" opacity={0.06} fade="both" />
        </div>
        <div className="relative z-10 mx-auto max-w-[var(--max-content-width)] px-4 md:px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div className="animate-fade-up">
              <h1
                className="text-[2.5rem] md:text-[4rem] font-bold text-[#FFF5E9] leading-[1.05]"
                style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
              >
                {isAr ? 'كُنْ' : 'KUN'}
              </h1>
              <p className="mt-2 text-xl md:text-2xl text-[var(--color-accent-200)] font-medium">
                {isAr ? 'من الداخل إلى التأثير' : 'From Inside to Impact'}
              </p>
              <p className="mt-6 text-white/70 text-base md:text-lg leading-relaxed max-w-xl" style={{ fontFamily: isAr ? 'var(--font-arabic-body)' : 'inherit' }}>
                {isAr
                  ? 'كُنْ ليست مؤسسة تعليمية تقليدية. إنها ثمرة رحلة امتدت عبر القارات، وتجربة روحية وجسدية نضجت بين الشرق والغرب، لتولد في روما عام 2014 كنقطة التقاء بين الفطرة والوعي، بين التراث والحداثة.'
                  : 'KUN is not a traditional educational institution. It is the fruit of a journey that spanned continents, a spiritual and physical experience that matured between East and West, born in Rome in 2014 as a meeting point between instinct and consciousness, heritage and modernity.'}
              </p>
            </div>
            <div className="hidden md:flex justify-center">
              <img
                src="/images/about/samer-hassan.png"
                alt="Samer Hassan"
                className="max-h-[400px] object-contain drop-shadow-2xl"
                loading="eager"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── 2. MISSION / VISION / VALUES ── */}
      <Section variant="white">
        <div className="text-center mb-12">
          <Heading level={2} className="!text-[2rem] md:!text-[2.5rem]">
            {isAr ? 'وِجهتُنا' : 'Our Destination'}
          </Heading>
        </div>

        {/* Mission & Vision */}
        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto mb-16">
          <Card accent className="p-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-full bg-[var(--color-primary)] flex items-center justify-center shrink-0">
                <span className="text-white text-lg">◎</span>
              </div>
              <Heading level={3} className="!mb-0">
                {isAr ? 'رُؤْيتُنا' : 'Our Vision'}
              </Heading>
            </div>
            <p className="text-[var(--color-neutral-700)] leading-relaxed" style={{ fontFamily: isAr ? 'var(--font-arabic-body)' : 'inherit' }}>
              {isAr
                ? 'أن نُعيد إحياء التربية كفنٍّ لتنمية الإنسان من الداخل، وبناء مجتمعات تتجذّر في الحضور، وتنمو من أصالتها نحو وعيٍ متجدد وأثر حيّ.'
                : 'To revive education as an art of developing the human from within, and building communities rooted in presence, growing from their authenticity towards renewed awareness and living impact.'}
            </p>
          </Card>
          <Card accent className="p-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-full bg-[var(--color-accent)] flex items-center justify-center shrink-0">
                <span className="text-white text-lg">↗</span>
              </div>
              <Heading level={3} className="!mb-0">
                {isAr ? 'مُهِمَتُنا' : 'Our Mission'}
              </Heading>
            </div>
            <p className="text-[var(--color-neutral-700)] leading-relaxed" style={{ fontFamily: isAr ? 'var(--font-arabic-body)' : 'inherit' }}>
              {isAr
                ? 'نُرافق الأفراد والمؤسسات في تجارب تربوية حيّة تُعيدهم إلى ذواتهم، وتُفعّل حضورهم، وتفتح أمامهم مسارات نموّ أصيلة، عبر منهجيات تربط الحكمة بالتطبيق.'
                : 'We accompany individuals and institutions in living educational experiences that return them to themselves, activate their presence, and open up authentic growth paths, through methodologies that link wisdom with application.'}
            </p>
          </Card>
        </div>

        {/* Values */}
        <div className="text-center mb-8">
          <Heading level={2} className="!text-[2rem] md:!text-[2.5rem]">{isAr ? 'قِيَمُنا' : 'Our Values'}</Heading>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 max-w-6xl mx-auto">
          {values.map((v) => (
            <Card key={v.nameEn} className="p-6 text-center">
              <div className="text-3xl mb-3 text-[var(--color-primary)]">{v.icon}</div>
              <h3 className="font-bold text-[var(--text-primary)] text-lg mb-2">
                {isAr ? v.nameAr : v.nameEn}
              </h3>
              <p className="text-sm text-[var(--color-neutral-600)] leading-relaxed" style={{ fontFamily: isAr ? 'var(--font-arabic-body)' : 'inherit' }}>
                {isAr ? v.textAr : v.textEn}
              </p>
            </Card>
          ))}
        </div>
      </Section>

      {/* ── 3. WHY KUN STARTED — Samer's Quote ── */}
      <Section variant="surface-high" pattern="girih">
        <div className="max-w-3xl mx-auto text-center">
          <Heading level={2} className="!text-[2rem] md:!text-[2.5rem]">
            {isAr ? 'لماذا بدأت كُنْ؟' : 'Why did KUN start?'}
          </Heading>
          <p className="text-sm text-[var(--color-neutral-500)] mt-2 mb-8">
            {isAr ? 'بكلمات سامر حسن' : "In Samer Hassan's words"}
          </p>
          <blockquote className="relative">
            <span className="absolute -top-4 start-0 text-6xl text-[var(--color-primary)]/10 font-serif leading-none">&ldquo;</span>
            <p className="text-lg md:text-xl text-[var(--color-neutral-700)] leading-relaxed italic" style={{ fontFamily: isAr ? 'var(--font-arabic-body)' : 'inherit' }}>
              {isAr
                ? 'حين بدأت رحلتي في مجال التدريب والتطوير الذاتي قبل عشرين عاماً، لم أكن أبحث عن أدوات أو تقنيات جاهزة. بل عن طريق يُعيدني إليّ، ولا يُطالبني أن أتخلى عن جذوري لأتطوّر، أو أن أُقلّد لأبدو ناضجاً. كُنْ وُلدت من رغبة صادقة في أن يكون هناك مسار تربوي أصيل، ينمو من أرضنا، يتحدث لغتنا، ويعانق قيمنا.'
                : "When I started my journey in training and self-development twenty years ago, I wasn't looking for ready-made tools or techniques. But for a way that would bring me back to myself, and not ask me to abandon my roots to develop. KUN was born from a sincere desire to have an authentic educational path, growing from our land, speaking our language, and embracing our values."}
            </p>
          </blockquote>
          <p className="mt-6 text-sm font-medium text-[var(--color-primary)]">
            {isAr ? 'سامر حسن — مؤسس كُنْ' : 'Samer Hassan — Founder of KUN'}
          </p>
          <p className="text-xs text-[var(--color-neutral-500)]">
            {isAr ? 'رفيق رحلة، لا قائد طريق' : 'A journey companion, not a path leader'}
          </p>
        </div>
      </Section>

      {/* ── 4. TIMELINE ── */}
      <Section variant="white">
        <div className="text-center mb-12">
          <Heading level={2} className="!text-[2rem] md:!text-[2.5rem]">
            {isAr ? 'من رحلتنا' : 'From Our Journey'}
          </Heading>
          <p className="mt-2 text-base text-[var(--color-neutral-600)]">
            {isAr ? 'محطات في المسيرة' : 'Milestones Along the Way'}
          </p>
          <p className="mt-4 text-[var(--color-neutral-600)] max-w-2xl mx-auto" style={{ fontFamily: isAr ? 'var(--font-arabic-body)' : 'inherit' }}>
            {isAr
              ? 'كُنْ ليست مؤسسة فقط، بل رحلة بدأت من الجسد والنية، وعَبَرت القارات لتُعيد تعريف التربية من الداخل.'
              : 'KUN is not just an institution, but a journey that began from body and intention, crossing continents to redefine education from within.'}
          </p>
        </div>

        <div className="relative max-w-4xl mx-auto">
          {/* Vertical line */}
          <div className="absolute top-0 bottom-0 start-6 md:start-1/2 w-px bg-[var(--color-primary)]/15 -translate-x-1/2" />

          <div className="space-y-12">
            {timeline.map((entry, i) => (
              <div key={entry.year + entry.titleEn} className={`relative flex items-start gap-6 md:gap-12 ${i % 2 === 0 ? 'md:flex-row' : 'md:flex-row-reverse'}`}>
                {/* Year dot */}
                <div className="absolute start-6 md:start-1/2 -translate-x-1/2 w-12 h-12 rounded-full bg-[var(--color-primary)] flex items-center justify-center z-10 shadow-[0_4px_16px_rgba(71,64,153,0.25)]">
                  <span className="text-white text-[10px] font-bold leading-tight text-center">{entry.year}</span>
                </div>

                {/* Content card */}
                <div className={`ms-20 md:ms-0 md:w-[calc(50%-3rem)] ${i % 2 === 0 ? '' : 'md:text-end'}`}>
                  <Card className="p-5">
                    <TimelineCardContent
                      image={entry.image}
                      title={isAr ? entry.titleAr : entry.titleEn}
                      text={isAr ? entry.textAr : entry.textEn}
                      isAr={isAr}
                      reverse={i % 2 !== 0}
                    />
                  </Card>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* ── 5. STATS ── */}
      <Section variant="primary" pattern="eight-star">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          {[
            { num: '٥٠٠+', numEn: '500+', ar: 'كوتش متخرّج', en: 'Coaches graduated' },
            { num: '١٣', numEn: '13', ar: 'دولة', en: 'Countries' },
            { num: '٥٠٠ ألف+', numEn: '500K+', ar: 'جلسة كوتشينج قُدّمت', en: 'Sessions delivered' },
            { num: '~مليون', numEn: '~1M', ar: 'حياة تأثّرت', en: 'Lives touched' },
          ].map((stat) => (
            <div key={stat.en} className="text-center">
              <p className="text-4xl md:text-5xl font-bold text-white">{isAr ? stat.num : stat.numEn}</p>
              <p className="mt-2 text-white/75 text-sm">{isAr ? stat.ar : stat.en}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* ── 6. TEAM ── */}
      <Section variant="surface">
        <div className="text-center mb-10">
          <Heading level={2} className="!text-[2rem] md:!text-[2.5rem]">{isAr ? 'فريقنا' : 'Our Team'}</Heading>
          <p className="mt-3 text-[var(--color-neutral-600)] max-w-2xl mx-auto" style={{ fontFamily: isAr ? 'var(--font-arabic-body)' : 'inherit' }}>
            {isAr
              ? 'في كُنْ، القيادة ليست فردية، بل جماعية ومتعاونة. ويعمل خلف هذه الوجوه فريق من الكوتشز والميسّرين من العالم العربي.'
              : 'At KUN, leadership is not individual, but collective and collaborative. Behind these faces works a team of coaches and facilitators from across the Arab world.'}
          </p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-6">
          {team.map((member) => (
            <div key={member.nameEn} className="text-center">
              <div className="mx-auto h-28 w-28 rounded-full overflow-hidden bg-[var(--color-neutral-100)] shadow-[0_4px_16px_rgba(71,64,153,0.1)]">
                <img
                  src={member.photo}
                  alt={isAr ? member.nameAr : member.nameEn}
                  className="h-full w-full object-cover"
                  style={{ objectPosition: 'center 15%' }}
                  loading="lazy"
                />
              </div>
              <h3 className="mt-3 font-bold text-sm text-[var(--text-primary)]">
                {isAr ? member.nameAr : member.nameEn}
              </h3>
              <p className="text-xs text-[var(--color-neutral-500)] mt-0.5">
                {isAr ? member.roleAr : member.roleEn}
              </p>
            </div>
          ))}
        </div>
      </Section>

      {/* ── 7. ICF ACCREDITATION ── */}
      <Section variant="white">
        <div className="text-center max-w-2xl mx-auto">
          <p className="text-[var(--color-neutral-700)] leading-relaxed" style={{ fontFamily: isAr ? 'var(--font-arabic-body)' : 'inherit' }}>
            {isAr
              ? 'كُنْ مدرسة تدريب معتمدة دوليًا من الاتحاد الدولي للكوتشينج (ICF)، تقدم برامج معتمدة Level 1 و Level 2، وفق أعلى معايير التدريب المهني.'
              : 'Kun is an internationally accredited training school by the International Coaching Federation (ICF), offering Level 1 and Level 2 accredited programs to the highest professional training standards.'}
          </p>
        </div>
      </Section>

      {/* ── 8. FAQ ── */}
      <Section variant="surface-high">
        <FAQSection items={aboutFaqs} locale={locale} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd(aboutFaqs, locale)) }}
        />
      </Section>

      {/* ── 9. CTA ── */}
      <Section variant="dark" pattern="girih">
        <div className="text-center py-8">
          <Heading level={2} className="!text-white">
            {isAr ? 'الرحلة لا تبدأ بالحماس، بل بلحظة حضور.' : "The journey doesn't begin with excitement — it begins with a moment of presence."}
          </Heading>
          <p className="mt-4 text-white/75 max-w-xl mx-auto">
            {isAr ? 'متى ما كنت مستعدًا، فـكُنْ معك.' : "Whenever you're ready, Kun is with you."}
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <a href={`/${locale}/pathfinder`}>
              <Button variant="primary" size="lg">
                {isAr ? 'ابدأ رحلتك' : 'Start Your Journey'}
              </Button>
            </a>
            <a href={`/${locale}/contact`}>
              <Button variant="white" size="lg">
                {isAr ? 'تواصل معنا' : 'Contact Us'}
              </Button>
            </a>
          </div>
        </div>
      </Section>
    </main>
  );
}
