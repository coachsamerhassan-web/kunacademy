'use client';

import { useState } from 'react';
import { Button } from '@kunacademy/ui/button';

interface Question {
  ar: string;
  en: string;
  options: { ar: string; en: string; score: Record<string, number> }[];
}

const questions: Question[] = [
  {
    ar: 'ما هدفك الرئيسي؟',
    en: 'What is your main goal?',
    options: [
      { ar: 'أريد أن أصبح كوتش معتمد', en: 'I want to become a certified coach', score: { certification: 3, course: 1 } },
      { ar: 'أريد تطوير مهاراتي القيادية', en: 'I want to develop my leadership skills', score: { corporate: 3, course: 2 } },
      { ar: 'أبحث عن تجربة تحوّلية', en: 'I\'m looking for a transformative experience', score: { retreat: 3, coaching: 2 } },
      { ar: 'أريد مساعدة عائلتي', en: 'I want to help my family', score: { family: 3 } },
    ],
  },
  {
    ar: 'ما مستوى خبرتك في الكوتشينج؟',
    en: 'What is your coaching experience level?',
    options: [
      { ar: 'مبتدئ تمامًا', en: 'Complete beginner', score: { certification: 2, free: 2 } },
      { ar: 'لدي بعض الخبرة', en: 'Some experience', score: { certification: 2, course: 2 } },
      { ar: 'كوتش ممارس', en: 'Practicing coach', score: { certification: 3, coaching: 1 } },
      { ar: 'كوتش معتمد أريد التطوّر', en: 'Certified coach seeking growth', score: { retreat: 2, corporate: 2 } },
    ],
  },
  {
    ar: 'كم وقت يمكنك تخصيصه؟',
    en: 'How much time can you commit?',
    options: [
      { ar: 'بضع ساعات أسبوعيًا', en: 'A few hours per week', score: { free: 3, course: 2 } },
      { ar: '2-3 أيام مكثّفة', en: '2-3 intensive days', score: { retreat: 3, corporate: 2 } },
      { ar: 'برنامج طويل (شهور)', en: 'Long program (months)', score: { certification: 3 } },
      { ar: 'جلسة واحدة فقط', en: 'Just one session', score: { coaching: 3 } },
    ],
  },
  {
    ar: 'ما الميزانية التقريبية؟',
    en: 'What is your approximate budget?',
    options: [
      { ar: 'مجاني', en: 'Free', score: { free: 5 } },
      { ar: 'أقل من 2,000 درهم', en: 'Under 2,000 AED', score: { course: 3, coaching: 2 } },
      { ar: '2,000 - 10,000 درهم', en: '2,000 - 10,000 AED', score: { certification: 2, retreat: 2 } },
      { ar: 'أكثر من 10,000 درهم', en: 'Over 10,000 AED', score: { certification: 3, corporate: 3 } },
    ],
  },
  {
    ar: 'هل تفضّل التعلّم أونلاين أم حضوري؟',
    en: 'Do you prefer online or in-person learning?',
    options: [
      { ar: 'أونلاين بالكامل', en: 'Fully online', score: { course: 2, free: 2, certification: 1 } },
      { ar: 'حضوري', en: 'In-person', score: { retreat: 3, corporate: 2 } },
      { ar: 'مزيج من الاثنين', en: 'A mix of both', score: { certification: 2, retreat: 1 } },
      { ar: 'لا يهم', en: 'Doesn\'t matter', score: {} },
    ],
  },
];

const recommendations: Record<string, { ar: { title: string; desc: string }; en: { title: string; desc: string }; href: string }> = {
  certification: { ar: { title: 'شهادة STCE المعتمدة', desc: 'برنامج شامل للحصول على شهادة كوتشينج معتمدة من ICF مع منهجية التفكير الحسّي®' }, en: { title: 'STCE Certification', desc: 'Comprehensive ICF-accredited coaching certification with Somatic Thinking® methodology' }, href: '/academy/certifications/stce' },
  course: { ar: { title: 'دورات قصيرة', desc: 'طوّر مهارات محدّدة في الكوتشينج والتفكير الحسّي' }, en: { title: 'Short Courses', desc: 'Develop specific skills in coaching and Somatic Thinking' }, href: '/academy/courses' },
  retreat: { ar: { title: 'خلوة تحوّلية', desc: 'تجربة غمر كاملة مع التفكير الحسّي في بيئة هادئة' }, en: { title: 'Transformative Retreat', desc: 'Full immersion experience with Somatic Thinking in a serene setting' }, href: '/programs' },
  corporate: { ar: { title: 'برامج مؤسسية', desc: 'حلول كوتشينج مصمّمة لمؤسستك وفريقك' }, en: { title: 'Corporate Programs', desc: 'Coaching solutions designed for your organization and team' }, href: '/programs/corporate' },
  family: { ar: { title: 'برامج الأسرة والشباب', desc: 'أدوات كوتشينج للوالدين والشباب' }, en: { title: 'Family & Youth Programs', desc: 'Coaching tools for parents and young adults' }, href: '/programs/family' },
  coaching: { ar: { title: 'جلسة كوتشينج فردية', desc: 'احجز جلسة مع كوتش متخصّص من أكاديمية كُن' }, en: { title: 'Individual Coaching Session', desc: 'Book a session with a specialized Kun Academy coach' }, href: '/book' },
  free: { ar: { title: 'محتوى مجاني', desc: 'ابدأ مجانًا — اكتشف التفكير الحسّي بدون التزام' }, en: { title: 'Free Content', desc: 'Start free — discover Somatic Thinking with no commitment' }, href: '/programs/free' },
};

export function QuizWidget({ locale }: { locale: string }) {
  const isAr = locale === 'ar';
  const [currentQ, setCurrentQ] = useState(0);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [done, setDone] = useState(false);

  function answer(optionScore: Record<string, number>) {
    const newScores = { ...scores };
    for (const [key, val] of Object.entries(optionScore)) {
      newScores[key] = (newScores[key] || 0) + val;
    }
    setScores(newScores);

    if (currentQ < questions.length - 1) {
      setCurrentQ(currentQ + 1);
    } else {
      setDone(true);
    }
  }

  if (done) {
    const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    const top = sorted.slice(0, 3).map(([key]) => key);

    return (
      <div className="max-w-2xl mx-auto">
        <h2 className="text-xl font-bold mb-6 text-center">{isAr ? 'نتيجتك' : 'Your Results'}</h2>
        <div className="space-y-4">
          {top.map((key, i) => {
            const rec = recommendations[key];
            if (!rec) return null;
            const data = isAr ? rec.ar : rec.en;
            return (
              <a key={key} href={`/${locale}${rec.href}`} className={`block rounded-lg border p-6 hover:shadow-md transition-shadow ${i === 0 ? 'border-[var(--color-primary)] bg-[var(--color-primary-100)]' : 'border-[var(--color-neutral-200)]'}`}>
                {i === 0 && <span className="text-xs font-bold text-[var(--color-primary)] uppercase mb-2 block">{isAr ? 'الأنسب لك' : 'Best Match'}</span>}
                <h3 className="font-bold text-lg">{data.title}</h3>
                <p className="text-[var(--color-neutral-600)] mt-1">{data.desc}</p>
              </a>
            );
          })}
        </div>
        <div className="mt-6 text-center">
          <Button variant="secondary" onClick={() => { setCurrentQ(0); setScores({}); setDone(false); }}>
            {isAr ? 'إعادة الاختبار' : 'Retake Quiz'}
          </Button>
        </div>
      </div>
    );
  }

  const q = questions[currentQ];
  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <span className="text-sm text-[var(--color-neutral-500)]">{currentQ + 1} / {questions.length}</span>
        <div className="h-1.5 flex-1 mx-4 rounded-full bg-[var(--color-neutral-100)] overflow-hidden">
          <div className="h-full bg-[var(--color-primary)] rounded-full transition-all" style={{ width: `${((currentQ + 1) / questions.length) * 100}%` }} />
        </div>
      </div>
      <h2 className="text-xl font-bold mb-6">{isAr ? q.ar : q.en}</h2>
      <div className="space-y-3">
        {q.options.map((opt, i) => (
          <button
            key={i}
            onClick={() => answer(opt.score)}
            className="w-full text-start rounded-lg border border-[var(--color-neutral-200)] p-4 hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-100)] transition-colors min-h-[44px]"
          >
            {isAr ? opt.ar : opt.en}
          </button>
        ))}
      </div>
    </div>
  );
}
