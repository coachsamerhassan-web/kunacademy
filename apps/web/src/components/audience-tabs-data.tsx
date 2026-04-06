// Audience tab data for GPS of Life and Impact Engineering program pages.
// This module exports React nodes as tab content — must be imported in server components.
// The AudienceTabs component is a client component; this data file is NOT 'use client'.

import type { TabData } from './audience-tabs';

// ── GPS of Life ──────────────────────────────────────────────────────────────

const GpsStudentsContent = ({ isAr }: { isAr: boolean }) => (
  <div className="space-y-5">
    <div>
      <h3 className="text-lg font-bold text-[var(--text-primary)] mb-2">
        {isAr ? 'لماذا GPS الحياة للطلاب؟' : 'Why GPS of Life for Students?'}
      </h3>
      <p className="text-[var(--color-neutral-700)] leading-relaxed">
        {isAr
          ? 'مرحلة التخرج أو انتهاء الدراسة تفتح أسئلة حقيقية: ماذا أريد؟ ما الذي يناسبني فعلاً؟ هذه الورشة تُساعدك على بناء بوصلة داخلية قبل أن تتخذ قرارات تُحدّد سنوات قادمة.'
          : 'Graduation or the end of studies opens real questions: What do I want? What truly fits me? This workshop helps you build an inner compass before making decisions that shape the years ahead.'}
      </p>
    </div>

    <div>
      <h4 className="text-sm font-semibold text-[var(--color-primary)] uppercase tracking-wide mb-3">
        {isAr ? 'ما الذي ستخرج به' : 'What You Will Leave With'}
      </h4>
      <ul className="space-y-2.5">
        {(isAr
          ? [
              'وضوح حول قيمك وما يحرّكك فعلاً',
              'خريطة ذاتية تُظهر نقاط قوتك الحقيقية',
              'خطوة أولى محددة نحو مسارك المهني أو الشخصي',
              'أدوات لاتخاذ قرارات من مكان الوعي لا الضغط',
            ]
          : [
              'Clarity around your values and what truly drives you',
              'A personal map showing your real strengths',
              'A defined first step toward your career or personal path',
              'Tools to make decisions from awareness, not pressure',
            ]
        ).map((item, i) => (
          <li key={i} className="flex items-start gap-2.5 text-[var(--color-neutral-700)]">
            <span className="text-[var(--color-accent)] mt-0.5 shrink-0 font-bold">✓</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  </div>
);

const GpsCouplesContent = ({ isAr }: { isAr: boolean }) => (
  <div className="space-y-5">
    <div>
      <h3 className="text-lg font-bold text-[var(--text-primary)] mb-2">
        {isAr ? 'لماذا GPS الحياة للأزواج؟' : 'Why GPS of Life for Couples?'}
      </h3>
      <p className="text-[var(--color-neutral-700)] leading-relaxed">
        {isAr
          ? 'الحياة المشتركة تحتاج اتجاهاً مشتركاً. GPS الحياة يُتيح لكل شريك أن يستكشف بوصلته الفردية، ثم يلتقيا في رؤية واضحة تخدم الشراكة وليس فقط الفرد.'
          : 'Shared life needs a shared direction. GPS of Life allows each partner to explore their individual compass, then meet in a clear vision that serves the partnership, not just the individual.'}
      </p>
    </div>

    <div>
      <h4 className="text-sm font-semibold text-[var(--color-primary)] uppercase tracking-wide mb-3">
        {isAr ? 'ما الذي ستخرجون به' : 'What You Will Leave With'}
      </h4>
      <ul className="space-y-2.5">
        {(isAr
          ? [
              'فهم أعمق لما يحرّك كل شريك في الحياة',
              'رؤية مشتركة للأولويات والقرارات المصيرية',
              'لغة مشتركة للتعبير عن الاحتياجات والتوقعات',
              'خارطة طريق للنمو معاً بوضوح ونية',
            ]
          : [
              'Deeper understanding of what drives each partner',
              'A shared vision for priorities and key decisions',
              'A shared language for expressing needs and expectations',
              'A roadmap for growing together with clarity and intention',
            ]
        ).map((item, i) => (
          <li key={i} className="flex items-start gap-2.5 text-[var(--color-neutral-700)]">
            <span className="text-[var(--color-accent)] mt-0.5 shrink-0 font-bold">✓</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  </div>
);

const GpsEntrepreneursContent = ({ isAr }: { isAr: boolean }) => (
  <div className="space-y-5">
    <div>
      <h3 className="text-lg font-bold text-[var(--text-primary)] mb-2">
        {isAr ? 'لماذا GPS الحياة لرياديي الأعمال؟' : 'Why GPS of Life for Entrepreneurs?'}
      </h3>
      <p className="text-[var(--color-neutral-700)] leading-relaxed">
        {isAr
          ? 'الريادي الناجح يعرف وجهته قبل أن يتحرك. GPS الحياة يُساعدك على مواءمة مشروعك مع قيمك وطاقتك الحقيقية — لأن المشاريع التي تُبنى على وضوح ذاتي تدوم.'
          : 'The successful entrepreneur knows their direction before moving. GPS of Life helps you align your venture with your real values and energy — because ventures built on self-clarity last.'}
      </p>
    </div>

    <div>
      <h4 className="text-sm font-semibold text-[var(--color-primary)] uppercase tracking-wide mb-3">
        {isAr ? 'ما الذي ستخرج به' : 'What You Will Leave With'}
      </h4>
      <ul className="space-y-2.5">
        {(isAr
          ? [
              'وضوح حول قيمك وكيف تُغذّي رؤيتك الريادية',
              'القدرة على اتخاذ قرارات استراتيجية من مكان القوة',
              'أدوات لتحديد ما يستحق طاقتك وما لا يستحق',
              'زخم حقيقي ونقطة انطلاق لمرحلة قادمة',
            ]
          : [
              'Clarity around your values and how they fuel your entrepreneurial vision',
              'Ability to make strategic decisions from a place of strength',
              'Tools to identify what deserves your energy and what does not',
              'Real momentum and a launch point for the next phase',
            ]
        ).map((item, i) => (
          <li key={i} className="flex items-start gap-2.5 text-[var(--color-neutral-700)]">
            <span className="text-[var(--color-accent)] mt-0.5 shrink-0 font-bold">✓</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>

    <div className="mt-4 p-4 rounded-xl bg-white/60 border border-[var(--color-primary-200)]">
      <p className="text-sm text-[var(--color-neutral-600)]">
        <span className="font-semibold text-[var(--color-primary)]">
          {isAr ? 'الخطوة التالية:' : 'Next step:'}
        </span>{' '}
        {isAr
          ? 'بعد GPS الحياة، يُكمل منهجك القيادي رحلتك بأدوات ريادية متعمّقة.'
          : 'After GPS of Life, Menhajak القيادي completes your journey with in-depth leadership tools.'}
      </p>
    </div>
  </div>
);

export function buildGpsTabs(locale: string): TabData[] {
  const isAr = locale === 'ar';
  return [
    {
      id: 'students',
      labelAr: 'طلاب',
      labelEn: 'Students',
      content: <GpsStudentsContent isAr={isAr} />,
      ctaHref: `/${locale}/programs/stce-level-1-stic/`,
      ctaLabelAr: 'اكتشف STIC',
      ctaLabelEn: 'Explore STIC',
    },
    {
      id: 'couples',
      labelAr: 'أزواج',
      labelEn: 'Couples',
      content: <GpsCouplesContent isAr={isAr} />,
      ctaHref: `/${locale}/programs/stce-level-5-stfc/`,
      ctaLabelAr: 'اكتشف STFC',
      ctaLabelEn: 'Explore STFC',
    },
    {
      id: 'entrepreneurs',
      labelAr: 'رياديون',
      labelEn: 'Entrepreneurs',
      content: <GpsEntrepreneursContent isAr={isAr} />,
      ctaHref: `/${locale}/programs/menhajak-leadership/`,
      ctaLabelAr: 'اكتشف منهجك القيادي',
      ctaLabelEn: 'Explore Menhajak القيادي',
    },
  ];
}

// ── Impact Engineering ───────────────────────────────────────────────────────

const IeCoachesContent = ({ isAr }: { isAr: boolean }) => (
  <div className="space-y-5">
    <div>
      <h3 className="text-lg font-bold text-[var(--text-primary)] mb-2">
        {isAr ? 'للمدرّبين والكوتشيز' : 'For Coaches & Trainers'}
      </h3>
      <p className="text-[var(--color-neutral-700)] leading-relaxed">
        {isAr
          ? 'هندسة الأثر تُعطيك إطاراً واضحاً لتصميم تدخّلاتك: كيف تصنع أثراً حقيقياً في جلسة، في برنامج، في علاقة تدريبية. تُضاف فوق أي منهجية تعمل بها.'
          : 'Impact Engineering gives you a clear framework for designing your interventions: how to create real impact in a session, a program, a coaching relationship. It layers on top of any methodology you already use.'}
      </p>
    </div>

    <div>
      <h4 className="text-sm font-semibold text-[var(--color-primary)] uppercase tracking-wide mb-3">
        {isAr ? 'ما الذي ستُطبّقه مباشرة' : 'What You Will Apply Immediately'}
      </h4>
      <ul className="space-y-2.5">
        {(isAr
          ? [
              'نموذج هندسة الأثر: من النية إلى النتيجة القابلة للقياس',
              'كيف تُصمّم جلسات وبرامج تُغيّر مسارات حياة',
              'أدوات لقياس الأثر الحقيقي لعملك التدريبي',
              'مسار واضح نحو منهجيتك التدريبية الخاصة',
            ]
          : [
              'The Impact Engineering model: from intention to measurable outcome',
              'How to design sessions and programs that shift life trajectories',
              'Tools for measuring the real impact of your coaching work',
              'A clear pathway toward your own training methodology',
            ]
        ).map((item, i) => (
          <li key={i} className="flex items-start gap-2.5 text-[var(--color-neutral-700)]">
            <span className="text-[var(--color-accent)] mt-0.5 shrink-0 font-bold">✓</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>

    <div className="mt-4 p-4 rounded-xl bg-white/60 border border-[var(--color-primary-200)]">
      <p className="text-sm text-[var(--color-neutral-600)]">
        <span className="font-semibold text-[var(--color-primary)]">
          {isAr ? 'الخطوة التالية:' : 'Next step:'}
        </span>{' '}
        {isAr
          ? 'منهجك التدريبي يُعمّق هذا الإطار ويُحوّله إلى منهجية كاملة.'
          : 'Menhajak التدريبي deepens this framework into a full training methodology.'}
      </p>
    </div>
  </div>
);

const IeLeadersContent = ({ isAr }: { isAr: boolean }) => (
  <div className="space-y-5">
    <div>
      <h3 className="text-lg font-bold text-[var(--text-primary)] mb-2">
        {isAr ? 'للقادة والمديرين التنفيذيين' : 'For Leaders & Executives'}
      </h3>
      <p className="text-[var(--color-neutral-700)] leading-relaxed">
        {isAr
          ? 'القيادة الحقيقية تُصنع أثراً — في الفريق، في المنظمة، في الصناعة. هندسة الأثر تُعطيك المفاهيم والأدوات لتُحوّل نيّتك القيادية إلى تأثير ملموس وقابل للاستدامة.'
          : 'Real leadership creates impact — in the team, the organization, the industry. Impact Engineering gives you the concepts and tools to translate your leadership intention into tangible, sustainable influence.'}
      </p>
    </div>

    <div>
      <h4 className="text-sm font-semibold text-[var(--color-primary)] uppercase tracking-wide mb-3">
        {isAr ? 'ما الذي ستُطبّقه مباشرة' : 'What You Will Apply Immediately'}
      </h4>
      <ul className="space-y-2.5">
        {(isAr
          ? [
              'إطار لتصميم القرارات القيادية بأثر مدروس',
              'كيف تُحوّل ثقافة الفريق نحو النتائج الحقيقية',
              'أدوات لقياس تأثيرك كقائد على المدى البعيد',
              'مسار لبناء إرثك القيادي داخل المنظمة',
            ]
          : [
              'A framework for designing leadership decisions with intentional impact',
              'How to shift team culture toward real results',
              'Tools for measuring your long-term influence as a leader',
              'A path for building your leadership legacy within the organization',
            ]
        ).map((item, i) => (
          <li key={i} className="flex items-start gap-2.5 text-[var(--color-neutral-700)]">
            <span className="text-[var(--color-accent)] mt-0.5 shrink-0 font-bold">✓</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>

    <div className="mt-4 p-4 rounded-xl bg-white/60 border border-[var(--color-primary-200)]">
      <p className="text-sm text-[var(--color-neutral-600)]">
        <span className="font-semibold text-[var(--color-primary)]">
          {isAr ? 'الخطوة التالية:' : 'Next step:'}
        </span>{' '}
        {isAr
          ? 'منهجك المؤسسي يُحوّل هذه الأدوات إلى تحوّل منظومي حقيقي.'
          : 'Menhajak المؤسسي turns these tools into real systemic transformation.'}
      </p>
    </div>
  </div>
);

const IeEntrepreneursContent = ({ isAr }: { isAr: boolean }) => (
  <div className="space-y-5">
    <div>
      <h3 className="text-lg font-bold text-[var(--text-primary)] mb-2">
        {isAr ? 'لرياديي الأعمال' : 'For Entrepreneurs'}
      </h3>
      <p className="text-[var(--color-neutral-700)] leading-relaxed">
        {isAr
          ? 'المشاريع التي تدوم تُبنى على أثر مُصمَّم لا على فرص عشوائية. هندسة الأثر تُساعدك على تعريف ما تريد أن يُقال عن مشروعك بعد 10 سنوات، وتعمل بشكل عكسي لبناء الطريق إلى هناك.'
          : 'Ventures that last are built on designed impact, not random opportunities. Impact Engineering helps you define what you want said about your venture in 10 years, then works backward to build the path there.'}
      </p>
    </div>

    <div>
      <h4 className="text-sm font-semibold text-[var(--color-primary)] uppercase tracking-wide mb-3">
        {isAr ? 'ما الذي ستُطبّقه مباشرة' : 'What You Will Apply Immediately'}
      </h4>
      <ul className="space-y-2.5">
        {(isAr
          ? [
              'تعريف أثر مشروعك بلغة واضحة وقابلة للتواصل',
              'إطار لاتخاذ القرارات الريادية بناءً على الأثر المطلوب',
              'كيف تقيس ما يهمّ فعلاً وليس فقط الأرقام',
              'مسار لبناء مشروع يُلهم ويُغيّر على المدى البعيد',
            ]
          : [
              'Define your venture\'s impact in clear, communicable language',
              'A framework for entrepreneurial decisions based on desired impact',
              'How to measure what truly matters, not just numbers',
              'A path for building a venture that inspires and changes things long-term',
            ]
        ).map((item, i) => (
          <li key={i} className="flex items-start gap-2.5 text-[var(--color-neutral-700)]">
            <span className="text-[var(--color-accent)] mt-0.5 shrink-0 font-bold">✓</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>

    <div className="mt-4 p-4 rounded-xl bg-white/60 border border-[var(--color-primary-200)]">
      <p className="text-sm text-[var(--color-neutral-600)]">
        <span className="font-semibold text-[var(--color-primary)]">
          {isAr ? 'الخطوة التالية:' : 'Next step:'}
        </span>{' '}
        {isAr
          ? 'منهجك القيادي يُعمّق هذا المسار ويُجهّزك لقيادة مشروعك بوضوح ريادي حقيقي.'
          : 'Menhajak القيادي deepens this path and prepares you to lead your venture with real entrepreneurial clarity.'}
      </p>
    </div>
  </div>
);

export function buildIeTabs(locale: string): TabData[] {
  const isAr = locale === 'ar';
  return [
    {
      id: 'coaches',
      labelAr: 'مدرّبون وكوتشيز',
      labelEn: 'Coaches & Trainers',
      content: <IeCoachesContent isAr={isAr} />,
      ctaHref: `/${locale}/programs/menhajak-training/`,
      ctaLabelAr: 'اكتشف منهجك التدريبي',
      ctaLabelEn: 'Explore Menhajak التدريبي',
    },
    {
      id: 'leaders',
      labelAr: 'قادة ومديرون',
      labelEn: 'Leaders & Executives',
      content: <IeLeadersContent isAr={isAr} />,
      ctaHref: `/${locale}/programs/menhajak-organizational/`,
      ctaLabelAr: 'اكتشف منهجك المؤسسي',
      ctaLabelEn: 'Explore Menhajak المؤسسي',
    },
    {
      id: 'entrepreneurs',
      labelAr: 'رياديون',
      labelEn: 'Entrepreneurs',
      content: <IeEntrepreneursContent isAr={isAr} />,
      ctaHref: `/${locale}/programs/menhajak-leadership/`,
      ctaLabelAr: 'اكتشف منهجك القيادي',
      ctaLabelEn: 'Explore Menhajak القيادي',
    },
  ];
}
