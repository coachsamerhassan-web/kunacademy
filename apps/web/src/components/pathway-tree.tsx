interface TreeNode {
  codeAr: string;
  codeEn: string;
  nameAr: string;
  nameEn: string;
  hoursAr: string;
  hoursEn: string;
  href: string;
  category: 'foundation' | 'core' | 'specialization' | 'sector';
  children?: TreeNode[];
}

const TREE: TreeNode = {
  codeAr: 'STI',
  codeEn: 'STI',
  nameAr: 'مدخل التفكير الحسّي',
  nameEn: 'Somatic Thinking Intro',
  hoursAr: '٦ ساعات',
  hoursEn: '6 hours',
  href: '/academy/intro/',
  category: 'foundation',
  children: [
    {
      codeAr: 'STIC',
      codeEn: 'STIC',
      nameAr: 'أساسيات كوتشينج الأفراد',
      nameEn: 'Individual Coaching Foundations',
      hoursAr: '٦٩ ساعة',
      hoursEn: '69 hours',
      href: '/academy/certifications/stce/level-1/',
      category: 'core',
      children: [
        {
          codeAr: 'YPI',
          codeEn: 'YPI',
          nameAr: 'هويّتك',
          nameEn: 'Your Identity',
          hoursAr: '١٠ ساعات',
          hoursEn: '10 hours',
          href: '/academy/courses/your-identity/',
          category: 'core',
          children: [
            {
              codeAr: 'STL2',
              codeEn: 'STL2',
              nameAr: 'التفكير الحسّي المتقدّم',
              nameEn: 'Advanced Somatic Thinking',
              hoursAr: 'مسار MCC',
              hoursEn: 'MCC Pathway',
              href: '/academy/certifications/stce/level-2/',
              category: 'specialization',
            },
            {
              codeAr: 'STL3',
              codeEn: 'STL3',
              nameAr: 'كوتشينج المجموعات',
              nameEn: 'Group Coaching',
              hoursAr: 'تخصّص',
              hoursEn: 'Specialization',
              href: '/academy/certifications/stce/level-3/',
              category: 'specialization',
              children: [
                {
                  codeAr: 'STL5',
                  codeEn: 'STL5',
                  nameAr: 'الأسرة والأزواج',
                  nameEn: 'Family & Couples',
                  hoursAr: 'تخصّص',
                  hoursEn: 'Specialization',
                  href: '/academy/certifications/stce/level-5/',
                  category: 'specialization',
                },
              ],
            },
            {
              codeAr: 'STL4',
              codeEn: 'STL4',
              nameAr: 'الكوتشينج المؤسسي',
              nameEn: 'Organizational Coaching',
              hoursAr: 'تخصّص',
              hoursEn: 'Specialization',
              href: '/academy/certifications/stce/level-4/',
              category: 'specialization',
            },
          ],
        },
      ],
    },
    {
      codeAr: 'STDC',
      codeEn: 'STDC',
      nameAr: 'التفكير الحسّي للأطباء',
      nameEn: 'Somatic Thinking for Doctors',
      hoursAr: 'مسار مستقل',
      hoursEn: 'Standalone Track',
      href: '/academy/certifications/',
      category: 'sector',
    },
    {
      codeAr: 'STCM',
      codeEn: 'STCM',
      nameAr: 'التفكير الحسّي للمدراء',
      nameEn: 'Somatic Thinking for Managers',
      hoursAr: '٦٩ ساعة',
      hoursEn: '69 hours',
      href: '/academy/certifications/managers/',
      category: 'sector',
    },
  ],
};

const CATEGORY_STYLES: Record<string, { bg: string; border: string; text: string; badge: string }> = {
  foundation: {
    bg: 'bg-[var(--color-accent-50)]',
    border: 'border-[var(--color-accent)]',
    text: 'text-[var(--color-accent-700)]',
    badge: 'bg-[var(--color-accent)] text-white',
  },
  core: {
    bg: 'bg-[var(--color-primary-50)]',
    border: 'border-[var(--color-primary)]',
    text: 'text-[var(--color-primary-700)]',
    badge: 'bg-[var(--color-primary)] text-white',
  },
  specialization: {
    bg: 'bg-[var(--color-secondary-50,#f0f4ff)]',
    border: 'border-[var(--color-secondary)]',
    text: 'text-[var(--color-secondary-700,#374191)]',
    badge: 'bg-[var(--color-secondary)] text-white',
  },
  sector: {
    bg: 'bg-[var(--color-neutral-50)]',
    border: 'border-[var(--color-neutral-300)]',
    text: 'text-[var(--color-neutral-700)]',
    badge: 'bg-[var(--color-neutral-500)] text-white',
  },
};

function TreeNodeCard({ node, locale }: { node: TreeNode; locale: string }) {
  const isAr = locale === 'ar';
  const styles = CATEGORY_STYLES[node.category];

  return (
    <a
      href={`/${locale}${node.href}`}
      className={`
        inline-flex flex-col items-center text-center
        rounded-xl border-2 px-4 py-3 min-w-[140px] max-w-[160px]
        shadow-sm transition-all duration-200
        hover:shadow-md hover:-translate-y-0.5
        ${styles.bg} ${styles.border}
      `}
    >
      <span className={`text-xs font-bold px-2 py-0.5 rounded-full mb-2 ${styles.badge}`}>
        {node.codeAr}
      </span>
      <span className={`text-xs font-semibold leading-tight ${styles.text}`}>
        {isAr ? node.nameAr : node.nameEn}
      </span>
      <span className="text-xs text-[var(--color-neutral-400)] mt-1">
        {isAr ? node.hoursAr : node.hoursEn}
      </span>
    </a>
  );
}

function VerticalBranch({ node, locale, depth = 0 }: { node: TreeNode; locale: string; depth?: number }) {
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div className="flex flex-col items-center">
      <TreeNodeCard node={node} locale={locale} />
      {hasChildren && (
        <>
          {/* Vertical connector */}
          <div className="w-0.5 h-6 bg-[var(--color-neutral-200)]" />
          {/* Horizontal rail for siblings */}
          {node.children!.length > 1 && (
            <div className="relative flex items-start justify-center gap-4 md:gap-6">
              {/* Horizontal line across all siblings */}
              <div
                className="absolute top-0 left-4 right-4 h-0.5 bg-[var(--color-neutral-200)]"
                style={{ left: '2rem', right: '2rem' }}
              />
              {node.children!.map((child) => (
                <div key={child.codeAr} className="flex flex-col items-center pt-0">
                  {/* Vertical drop per child */}
                  <div className="w-0.5 h-6 bg-[var(--color-neutral-200)]" />
                  <VerticalBranch node={child} locale={locale} depth={depth + 1} />
                </div>
              ))}
            </div>
          )}
          {node.children!.length === 1 && (
            <VerticalBranch node={node.children![0]} locale={locale} depth={depth + 1} />
          )}
        </>
      )}
    </div>
  );
}

interface PathwayTreeProps {
  locale: string;
}

export function PathwayTree({ locale }: PathwayTreeProps) {
  const isAr = locale === 'ar';

  return (
    <div>
      {/* Legend */}
      <div className="flex flex-wrap justify-center gap-3 mb-10">
        {(Object.entries(CATEGORY_STYLES) as [string, { bg: string; border: string; text: string; badge: string }][]).map(([key, s]) => {
          const labels: Record<string, { ar: string; en: string }> = {
            foundation: { ar: 'المدخل', en: 'Foundation' },
            core: { ar: 'المسار الأساسي', en: 'Core Path' },
            specialization: { ar: 'التخصّصات', en: 'Specializations' },
            sector: { ar: 'المسارات القطاعية', en: 'Sector Tracks' },
          };
          return (
            <span key={key} className="flex items-center gap-1.5 text-xs text-[var(--color-neutral-600)]">
              <span className={`w-3 h-3 rounded-sm border-2 ${s.bg} ${s.border}`} />
              {isAr ? labels[key].ar : labels[key].en}
            </span>
          );
        })}
      </div>

      {/* Mobile: stacked vertical list */}
      <div className="block md:hidden space-y-4">
        <MobileTreeList node={TREE} locale={locale} depth={0} />
      </div>

      {/* Desktop: visual tree */}
      <div className="hidden md:flex justify-center overflow-x-auto pb-4">
        <VerticalBranch node={TREE} locale={locale} />
      </div>
    </div>
  );
}

function MobileTreeList({ node, locale, depth }: { node: TreeNode; locale: string; depth: number }) {
  const isAr = locale === 'ar';
  const styles = CATEGORY_STYLES[node.category];

  return (
    <div>
      <a
        href={`/${locale}${node.href}`}
        className={`flex items-center gap-3 rounded-xl border-2 px-4 py-3 ${styles.bg} ${styles.border} hover:shadow-sm transition-shadow duration-150`}
        style={{ marginInlineStart: `${depth * 1.25}rem` }}
      >
        <span className={`shrink-0 text-xs font-bold px-2 py-0.5 rounded-full ${styles.badge}`}>
          {node.codeAr}
        </span>
        <span className={`text-sm font-semibold leading-tight flex-1 ${styles.text}`}>
          {isAr ? node.nameAr : node.nameEn}
        </span>
        <span className="text-xs text-[var(--color-neutral-400)] shrink-0">
          {isAr ? node.hoursAr : node.hoursEn}
        </span>
      </a>
      {node.children?.map((child) => (
        <div key={child.codeAr} className="mt-2 relative">
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-[var(--color-neutral-200)]"
            style={{ insetInlineStart: `${depth * 1.25 + 0.75}rem` }}
          />
          <MobileTreeList node={child} locale={locale} depth={depth + 1} />
        </div>
      ))}
    </div>
  );
}
