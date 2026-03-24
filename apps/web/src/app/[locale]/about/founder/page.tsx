import { setRequestLocale } from 'next-intl/server';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';

export default async function FounderPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  return (
    <main>
      <Section>
        <Heading level={1}>{isAr ? 'سامر حسن' : 'Samer Hassan'}</Heading>
        <p className="mt-2 text-lg font-medium text-[var(--color-primary)]">
          {isAr ? 'مؤسس أكاديمية كُن ومنهجية التفكير الحسّي®' : 'Founder of Kun Academy & Somatic Thinking®'}
        </p>
      </Section>

      <Section>
        <Heading level={2}>{isAr ? 'الإنجازات' : 'Credentials'}</Heading>
        <ul className="mt-4 space-y-3 text-[var(--color-neutral-700)]">
          <li>
            {isAr
              ? 'أول عربي يحصل على شهادة Master Certified Coach (MCC) من الاتحاد الدولي للكوتشنغ (ICF)'
              : 'ICF Master Certified Coach (MCC) — first Arab to hold this credential'}
          </li>
          <li>
            {isAr
              ? 'حائز على جائزة القائد الشاب من ICF لعام 2019'
              : 'ICF Young Leader Award 2019'}
          </li>
          <li>
            {isAr
              ? 'أكثر من 10,000 جلسة كوتشنغ فردية'
              : '10,000+ individual coaching sessions'}
          </li>
          <li>
            {isAr
              ? 'تخريج أكثر من 500 كوتش عبر 4 قارات'
              : '500+ coaches graduated across 4 continents'}
          </li>
          <li>
            {isAr
              ? 'مؤسس منهجية التفكير الحسّي® — إطار كوتشنغ يربط الفكر بالإشارات الحسّية الجسدية'
              : 'Creator of Somatic Thinking® — a coaching framework connecting thought to somatic bodily signals'}
          </li>
        </ul>
      </Section>

      <Section>
        <Heading level={2}>{isAr ? 'عن سامر' : 'About Samer'}</Heading>
        <div className="mt-4 space-y-4 text-[var(--color-neutral-700)]">
          <p>
            {isAr
              ? 'سامر حسن كوتش ومدرّب كوتشنغ إيطالي-مصري مقيم في دبي. طوّر منهجية التفكير الحسّي® من واقع آلاف الجلسات والتجارب العملية — منهجية تُعيد الجسد إلى مركز عملية التغيير، لأن التحوّل الحقيقي لا يبدأ بالفكرة بل بالإحساس.'
              : 'Samer Hassan is an Italian-Egyptian coach and coaching educator based in Dubai. He developed Somatic Thinking® from thousands of sessions and lived experience — a methodology that places the body at the center of the change process, because real transformation begins with sensation, not idea.'}
          </p>
          <p>
            {isAr
              ? 'يعمل سامر بثلاث لغات ويُدرّب كوتشز في الخليج والشرق الأوسط وأوروبا وأفريقيا. يقود من خلال أكاديمية كُن برامج معتمدة من ICF لتأهيل كوتشز يجسّدون الإحسان في ممارستهم المهنية.'
              : 'Working in three languages, Samer trains coaches across the Gulf, Middle East, Europe, and Africa. Through Kun Academy, he leads ICF-accredited programs that develop coaches who embody Ihsan in their professional practice.'}
          </p>
        </div>
      </Section>
    </main>
  );
}
