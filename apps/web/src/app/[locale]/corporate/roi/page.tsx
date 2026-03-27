import type { Metadata } from 'next';
import ROICalculatorPage from './roi-calculator';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const isAr = locale === 'ar';
  return {
    title: isAr ? 'حاسبة العائد على الاستثمار | أكاديمية كُن' : 'ROI Calculator | Kun Academy',
    description: isAr ? 'احسب العائد المتوقع من برامج الكوتشينج المؤسسي — أرقام حقيقية لقرارات واعية' : 'Calculate the expected return from corporate coaching programs — real numbers for informed decisions',
  };
}

export default function ROIPage({ params }: { params: Promise<{ locale: string }> }) {
  return <ROICalculatorPage params={params} />;
}
