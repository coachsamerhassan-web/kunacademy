'use client';

import { useAuth } from '@kunacademy/auth';
import { useEffect } from 'react';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';
import { useParams, useRouter, usePathname } from 'next/navigation';
import { ArrowLeft, ExternalLink } from 'lucide-react';

const CMS_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1CLChiKTXGvUDmPFHcjCpa3TmmC6F0KG5RnFCsCiBLIg/edit';

const contentSections = [
  {
    key: 'programs',
    labelAr: 'البرامج',
    labelEn: 'Programs',
    descAr: 'بيانات البرامج: الأسعار، الساعات، الأوصاف، المتطلبات',
    descEn: 'Program data: pricing, hours, descriptions, prerequisites',
    tab: '#gid=0',
    icon: '🎓',
  },
  {
    key: 'team',
    labelAr: 'فريق الكوتشز',
    labelEn: 'Team / Coaches',
    descAr: 'ملفات الكوتشز: الأسماء، التخصصات، الصور، السيرة',
    descEn: 'Coach profiles: names, specialties, photos, bios',
    tab: '#gid=1',
    icon: '👤',
  },
  {
    key: 'testimonials',
    labelAr: 'التوصيات',
    labelEn: 'Testimonials',
    descAr: 'شهادات العملاء والخريجين',
    descEn: 'Client and graduate testimonials',
    tab: '#gid=2',
    icon: '⭐',
  },
  {
    key: 'blog',
    labelAr: 'المدونة',
    labelEn: 'Blog',
    descAr: 'المقالات: العناوين، المحتوى، الفئات، التواريخ',
    descEn: 'Articles: titles, content, categories, dates',
    tab: '#gid=3',
    icon: '📝',
  },
  {
    key: 'events',
    labelAr: 'الفعاليات',
    labelEn: 'Events',
    descAr: 'الفعاليات القادمة: التواريخ، المواقع، التسجيل',
    descEn: 'Upcoming events: dates, locations, registration',
    tab: '#gid=4',
    icon: '📅',
  },
  {
    key: 'faq',
    labelAr: 'الأسئلة الشائعة',
    labelEn: 'FAQ',
    descAr: 'الأسئلة المتكررة وإجاباتها',
    descEn: 'Frequently asked questions and answers',
    tab: '#gid=5',
    icon: '❓',
  },
  {
    key: 'products',
    labelAr: 'المنتجات',
    labelEn: 'Products',
    descAr: 'منتجات المتجر: الكتب، الأدوات، الملحقات',
    descEn: 'Shop products: books, tools, accessories',
    tab: '#gid=6',
    icon: '📦',
  },
];

export default function AdminContentPage() {
  const { locale } = useParams<{ locale: string }>();
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const isAr = locale === 'ar';

  useEffect(() => {
    if (authLoading) return;
    if (!user || (profile?.role !== 'admin' && profile?.role !== 'super_admin')) { router.push('/' + locale + '/auth/login?redirect=' + encodeURIComponent(pathname)); return; }
  }, [user, profile, authLoading]);

  if (authLoading) return <Section><p className="text-center py-12">Loading...</p></Section>;

  return (
    <main>
      <Section variant="white">
        <div className="flex items-center justify-between mb-6">
          <div>
            <Heading level={1}>{isAr ? 'إدارة المحتوى' : 'Content Management'}</Heading>
            <p className="mt-1 text-sm text-[var(--color-neutral-500)]">
              {isAr ? 'جميع المحتوى يُدار عبر Google Sheets — عدّل البيانات وسيتم تحديث الموقع تلقائيًا' : 'All content is managed via Google Sheets — edit data and the site updates automatically'}
            </p>
          </div>
          <a href={'/' + locale + '/admin'} className="text-[var(--color-primary)] text-sm hover:underline flex items-center gap-1">
            <ArrowLeft className="w-4 h-4 rtl:rotate-180" aria-hidden="true" />
            {isAr ? 'لوحة الإدارة' : 'Dashboard'}
          </a>
        </div>

        {/* CMS Link */}
        <a
          href={CMS_SHEET_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 mb-8 px-4 py-3 rounded-lg bg-[var(--color-primary)] text-white hover:opacity-90 transition-opacity w-fit"
        >
          <ExternalLink className="w-4 h-4" aria-hidden="true" />
          {isAr ? 'فتح جدول البيانات الرئيسي' : 'Open Master CMS Spreadsheet'}
        </a>

        {/* Content Sections Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {contentSections.map(section => (
            <a
              key={section.key}
              href={`${CMS_SHEET_URL}${section.tab}`}
              target="_blank"
              rel="noopener noreferrer"
              className="group rounded-xl border border-[var(--color-neutral-200)] p-5 hover:border-[var(--color-primary)] hover:shadow-sm transition"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-2xl mb-2">{section.icon}</div>
                  <h3 className="font-medium text-[var(--text-primary)]">
                    {isAr ? section.labelAr : section.labelEn}
                  </h3>
                  <p className="text-xs text-[var(--color-neutral-500)] mt-1">
                    {isAr ? section.descAr : section.descEn}
                  </p>
                </div>
                <ExternalLink className="w-4 h-4 text-[var(--color-neutral-300)] group-hover:text-[var(--color-primary)] transition-colors shrink-0 mt-1" aria-hidden="true" />
              </div>
            </a>
          ))}
        </div>

        {/* Instructions */}
        <div className="mt-8 rounded-xl bg-[var(--color-neutral-50)] p-6">
          <h3 className="font-medium text-[var(--text-primary)] mb-2">
            {isAr ? 'كيفية تحديث المحتوى' : 'How to Update Content'}
          </h3>
          <ol className="text-sm text-[var(--color-neutral-600)] space-y-2 list-decimal list-inside">
            <li>{isAr ? 'افتح الجدول المطلوب من الروابط أعلاه' : 'Open the relevant sheet tab from the links above'}</li>
            <li>{isAr ? 'عدّل البيانات مباشرة في الجدول' : 'Edit the data directly in the spreadsheet'}</li>
            <li>{isAr ? 'الموقع يحدّث تلقائيًا — لا حاجة لنشر يدوي' : 'The site updates automatically — no manual deploy needed'}</li>
          </ol>
        </div>
      </Section>
    </main>
  );
}
