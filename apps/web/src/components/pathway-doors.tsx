'use client';

import { useState } from 'react';

interface Step {
  ar: string;
  en: string;
  href?: string;
  isLabel?: boolean;
}

interface DoorConfig {
  id: string;
  titleAr: string;
  titleEn: string;
  subtitleAr: string;
  subtitleEn: string;
  icon: string;
  accentColor: string;
  steps: Step[];
}

const DOORS: DoorConfig[] = [
  {
    id: 'career',
    titleAr: 'أريد أن أصبح كوتش',
    titleEn: 'I want to become a coach',
    subtitleAr: 'مسار الكوتشينج المهني',
    subtitleEn: 'Professional Coaching Career',
    icon: '◎',
    accentColor: 'var(--color-accent)',
    steps: [
      { ar: 'STI — مدخل التفكير الحسّي (٦ ساعات مسجّلة)', en: 'STI — Somatic Thinking Intro (6 recorded hours)', href: '/academy/intro/' },
      { ar: 'STIC — المستوى الأول (٦٩ ساعة)', en: 'STIC — Level One (69 hours)', href: '/academy/certifications/stce/level-1/' },
      { ar: 'YPI — هويّتك (١٠ ساعات)', en: 'YPI — Your Identity (10 hours)', href: '/academy/courses/your-identity/' },
      { ar: 'اختر تخصّصك:', en: 'Choose your specialization:', isLabel: true },
      { ar: 'STL2 — مسار MCC', en: 'STL2 — MCC Pathway', href: '/academy/certifications/stce/level-2/' },
      { ar: 'STL3 — كوتشينج المجموعات', en: 'STL3 — Group Coaching', href: '/academy/certifications/stce/level-3/' },
      { ar: 'STL4 — الكوتشينج المؤسسي', en: 'STL4 — Organizational Coaching', href: '/academy/certifications/stce/level-4/' },
      { ar: 'أو: اكتشف الباقة المناسبة', en: 'Or: discover the right package', href: '/academy/packages/' },
    ],
  },
  {
    id: 'corporate',
    titleAr: 'أريد تطوير فريقي',
    titleEn: 'I want to develop my team',
    subtitleAr: 'مسار المدراء والمؤسسات',
    subtitleEn: 'Managers & Corporate Track',
    icon: '⬡',
    accentColor: 'var(--color-primary)',
    steps: [
      { ar: 'المسار أ — الكوتشينج للمدراء:', en: 'Track A — Coaching for Managers:', isLabel: true },
      { ar: 'STI (المدخل) ← STCM (المدراء، ٦٩ ساعة)', en: 'STI (Intro) → STCM (Managers, 69hrs)', href: '/academy/certifications/managers/' },
      { ar: 'المسار ب — التدخلات التنظيمية:', en: 'Track B — Organizational Interventions:', isLabel: true },
      { ar: 'GM Playbook (٣ مراحل)', en: 'GM Playbook (3 milestones)', href: '/coaching/corporate/' },
      { ar: 'التيسير المؤسسي', en: 'Corporate Facilitation', href: '/coaching/corporate/' },
    ],
  },
  {
    id: 'personal',
    titleAr: 'أريد تطوير ذاتي',
    titleEn: 'I want to grow personally',
    subtitleAr: 'مسار التطوير الشخصي',
    subtitleEn: 'Personal Growth Track',
    icon: '✦',
    accentColor: 'var(--color-secondary)',
    steps: [
      { ar: 'STI — المدخل (الأساس)', en: 'STI — Intro (the foundation)', href: '/academy/intro/' },
      { ar: 'يقظة — ٣ مراحل', en: 'Yaqatha — 3 phases', href: '/coaching/individual/' },
      { ar: 'Impact Engineering', en: 'Impact Engineering', href: '/academy/courses/' },
      { ar: 'الخلوات والفعاليات', en: 'Retreats & Events', href: '/events/' },
    ],
  },
];

interface PathwayDoorsProps {
  locale: string;
}

export function PathwayDoors({ locale }: PathwayDoorsProps) {
  const [openId, setOpenId] = useState<string | null>(null);
  const isAr = locale === 'ar';

  const toggle = (id: string) => setOpenId(prev => (prev === id ? null : id));

  return (
    <div className="space-y-4">
      {DOORS.map((door) => {
        const isOpen = openId === door.id;
        return (
          <div
            key={door.id}
            className="rounded-2xl overflow-hidden border border-[var(--color-neutral-100)] bg-white shadow-[0_2px_16px_rgba(71,64,153,0.06)] transition-all duration-300"
          >
            {/* Door header — always visible */}
            <button
              onClick={() => toggle(door.id)}
              className="w-full flex items-center gap-4 px-6 py-5 text-start cursor-pointer min-h-[72px] hover:bg-[var(--color-primary-50)] transition-colors duration-200"
              aria-expanded={isOpen}
            >
              <span
                className="text-2xl shrink-0 w-10 h-10 flex items-center justify-center rounded-full text-white font-bold"
                style={{ backgroundColor: door.accentColor }}
                aria-hidden="true"
              >
                {door.icon}
              </span>
              <div className="flex-1 min-w-0">
                <p
                  className="text-lg font-bold text-[var(--color-neutral-900)]"
                  style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
                >
                  {isAr ? door.titleAr : door.titleEn}
                </p>
                <p className="text-sm text-[var(--color-neutral-500)] mt-0.5">
                  {isAr ? door.subtitleAr : door.subtitleEn}
                </p>
              </div>
              <span
                className="shrink-0 text-[var(--color-neutral-400)] text-xl transition-transform duration-300"
                style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
                aria-hidden="true"
              >
                ▾
              </span>
            </button>

            {/* Door content — expands on click */}
            <div
              style={{
                maxHeight: isOpen ? '600px' : '0',
                overflow: 'hidden',
                transition: 'max-height 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
              }}
            >
              <div className="px-6 pb-6 pt-2 border-t border-[var(--color-neutral-100)]">
                <ol className="space-y-3 mt-4">
                  {door.steps.map((step, i) => {
                    if (step.isLabel) {
                      return (
                        <li key={i} className="text-xs font-semibold uppercase tracking-widest text-[var(--color-neutral-400)] mt-4 mb-1">
                          {isAr ? step.ar : step.en}
                        </li>
                      );
                    }
                    const content = isAr ? step.ar : step.en;
                    const inner = (
                      <span className="flex items-start gap-3">
                        <span
                          className="shrink-0 mt-0.5 w-5 h-5 rounded-full text-white text-xs flex items-center justify-center font-bold"
                          style={{ backgroundColor: door.accentColor }}
                          aria-hidden="true"
                        >
                          {i + 1}
                        </span>
                        <span className="text-[var(--color-neutral-700)] text-sm leading-relaxed">{content}</span>
                      </span>
                    );

                    return step.href ? (
                      <li key={i}>
                        <a
                          href={`/${locale}${step.href}`}
                          className="block hover:text-[var(--color-primary)] transition-colors duration-150 group"
                        >
                          {inner}
                        </a>
                      </li>
                    ) : (
                      <li key={i}>{inner}</li>
                    );
                  })}
                </ol>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
