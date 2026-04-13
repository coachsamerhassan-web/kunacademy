'use client';

import { useState, useCallback } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { GraduateDirectory } from '../graduates/graduate-directory';
import { CommunityMembers } from './community-members';

type TabKey = 'graduates' | 'members';

interface DirectoryData {
  graduates: any[];
  total: number;
  totalPages: number;
  programCounts: Record<string, number>;
}

interface Props {
  locale: string;
  initialTab: TabKey;
  initialGraduateData: DirectoryData;
}

const TABS: { key: TabKey; labelAr: string; labelEn: string }[] = [
  { key: 'graduates', labelAr: 'الخريجون', labelEn: 'Graduates' },
  { key: 'members',   labelAr: 'الأعضاء',  labelEn: 'Members' },
];

export function CommunityTabs({ locale, initialTab, initialGraduateData }: Props) {
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);
  const router = useRouter();
  const pathname = usePathname();
  const isAr = locale === 'ar';

  const handleTabChange = useCallback(
    (tab: TabKey) => {
      setActiveTab(tab);
      // Update URL without full page reload
      const params = new URLSearchParams();
      if (tab !== 'graduates') {
        params.set('tab', tab);
      }
      const qs = params.toString();
      router.replace(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: false });
    },
    [router, pathname]
  );

  return (
    <div>
      {/* Tab bar */}
      <div className="flex items-center justify-center gap-2 mb-8">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => handleTabChange(tab.key)}
            className={`
              px-6 py-2.5 rounded-full text-sm font-semibold transition-all duration-200
              min-h-[44px]
              ${activeTab === tab.key
                ? 'bg-amber-500 text-white shadow-sm'
                : 'bg-transparent text-[var(--text-secondary)] hover:bg-amber-50 hover:text-amber-700'
              }
            `}
          >
            {isAr ? tab.labelAr : tab.labelEn}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'graduates' && (
        <GraduateDirectory locale={locale} initialData={initialGraduateData} />
      )}
      {activeTab === 'members' && (
        <CommunityMembers locale={locale} />
      )}
    </div>
  );
}
