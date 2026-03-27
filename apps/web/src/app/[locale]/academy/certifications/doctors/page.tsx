import { setRequestLocale } from 'next-intl/server';
import { cms } from '@kunacademy/cms';
import { ProgramDetail } from '@/components/program-detail';
import { notFound } from 'next/navigation';

export default async function DoctorsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const program = await cms.getProgram('stdc-doctors');
  if (!program) notFound();

  return (
    <ProgramDetail
      program={program}
      locale={locale}
      urlPath="academy/certifications/doctors"
      outcomesAr={[
        'تطبيق التفكير الحسّي في السياق الطبي',
        'تقنيات الاستخلاص العميق مع المرضى',
        'إدارة مشاعر المرضى والأهالي بحضور جسدي',
        'تحسين التشخيص عبر الإصغاء الجسدي',
        'بناء علاقة علاجية أعمق مع المريض',
        'القيادة الطبية بوعي حسّي',
      ]}
      outcomesEn={[
        'Applying Somatic Thinking in medical contexts',
        'Deep debriefing techniques with patients',
        'Managing patient and family emotions with somatic presence',
        'Improving diagnostics through somatic listening',
        'Building deeper therapeutic relationships with patients',
        'Medical leadership with somatic awareness',
      ]}
      audienceAr="أطباء، جرّاحون، مديرو مستشفيات، قيادات طبية"
      audienceEn="Physicians, surgeons, medical directors, hospital leaders"
    />
  );
}
