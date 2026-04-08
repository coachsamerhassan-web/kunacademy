import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { Section } from '@kunacademy/ui/section';
import { breadcrumbJsonLd } from '@kunacademy/ui/structured-data';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const isAr = locale === 'ar';
  return {
    title: isAr
      ? 'العلم وراء التفكير الحسّي® | كُن للكوتشينج'
      : 'The Science Behind Somatic Thinking® | Kun Coaching',
    description: isAr
      ? 'كيف يدعم علم الأعصاب ونظرية العصب المُبهَم والأبحاث المتجسّدة منهجية التفكير الحسّي® — الأساس العلمي لكوتشينج كُن.'
      : 'How neuroscience, polyvagal theory, and embodied cognition research underpin the Somatic Thinking® methodology — the scientific foundation of Kun Coaching.',
    alternates: {
      canonical: `/${locale}/about/methodology/science`,
    },
  };
}

export default async function SciencePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';
  const dir = isAr ? 'rtl' : 'ltr';

  const headingFont = isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)';
  const bodyFont = isAr ? 'var(--font-arabic-body)' : 'inherit';

  return (
    <main dir={dir}>
      {/* ── Structured Data ── */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            breadcrumbJsonLd(locale, [
              { name: isAr ? 'الرئيسية' : 'Home', path: '' },
              { name: isAr ? 'عنّا' : 'About', path: '/about' },
              { name: isAr ? 'التفكير الحسّي' : 'Somatic Thinking', path: '/about/methodology' },
              {
                name: isAr ? 'العلم وراء التفكير الحسّي' : 'The Science Behind Somatic Thinking',
                path: '/about/methodology/science',
              },
            ])
          ),
        }}
      />

      {/* ═══════════════════════════════════════
          HERO
      ═══════════════════════════════════════ */}
      <section
        className="relative overflow-hidden py-20 md:py-32"
        aria-label={isAr ? 'مقدمة' : 'Hero'}
      >
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(135deg, var(--color-primary) 0%, #1D1A3D 60%, #0D0B1E 100%)' }}
        />
        <div className="relative z-10 mx-auto max-w-[var(--max-content-width)] px-4 md:px-8">
          <div className="max-w-3xl mx-auto text-center animate-fade-up">
            <p className="text-xs font-semibold tracking-[0.2em] uppercase text-[var(--color-accent)] mb-4">
              {isAr ? 'الأساس العلمي' : 'Scientific Foundation'}
            </p>
            <h1
              className="text-[2.25rem] md:text-[3.75rem] font-bold text-[#FFF5E9] leading-[1.1] mb-6"
              style={{ fontFamily: headingFont }}
            >
              {isAr ? 'العلم وراء التفكير الحسّي®' : 'The Science Behind Somatic Thinking®'}
            </h1>
            <p
              className="text-white/75 text-base md:text-lg leading-relaxed max-w-2xl mx-auto"
              style={{ fontFamily: bodyFont }}
            >
              {isAr
                ? 'التفكير الحسّي® ليس فلسفة مجرّدة — إنه مبني على عقود من الأبحاث في علم الأعصاب، والتجسيد المعرفي، وتنظيم الجهاز العصبي. هنا نستعرض الأسس العلمية التي تجعل هذا النهج فعّالاً.'
                : 'Somatic Thinking® is not abstract philosophy — it is built on decades of research in neuroscience, embodied cognition, and nervous system regulation. Here we explore the scientific foundations that make this approach work.'}
            </p>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════
          SECTION 1 — NEUROSCIENCE OF EMBODIED COGNITION
      ═══════════════════════════════════════ */}
      <Section variant="white">
        <div className="max-w-3xl mx-auto">
          <p className="text-xs font-semibold tracking-[0.18em] uppercase text-[var(--color-accent)] mb-3">
            {isAr ? '١' : '01'}
          </p>
          <h2
            className="text-2xl md:text-3xl font-bold text-[var(--text-primary)] mb-8"
            style={{ fontFamily: headingFont }}
          >
            {isAr ? 'علم الأعصاب والإدراك المتجسّد' : 'Neuroscience of Embodied Cognition'}
          </h2>

          <div
            className="space-y-6 text-[var(--color-neutral-700)] text-base md:text-lg leading-relaxed"
            style={{ fontFamily: bodyFont, lineHeight: '1.9' }}
          >
            {isAr ? (
              <>
                <p>
                  لعقود طويلة، سيطر تصوّر خاطئ على علم النفس والتعليم: أن الدماغ هو مركز التفكير، وأن الجسد مجرد أداة تنفيذ. الأبحاث الحديثة في علم الأعصاب قلبت هذه الصورة رأساً على عقب. ما يُعرف الآن بـ&quot;الإدراك المتجسّد&quot; يؤكد أن العمليات المعرفية — القرارات، العواطف، الفهم — لا تحدث في الدماغ وحده، بل في شبكة حيّة تمتد عبر الجسم بأكمله.
                </p>
                <p>
                  عصبيات أمعائنا تحتوي على أكثر من مئة مليون خلية عصبية — ما يُعادل دماغ قطة كاملة. القلب يرسل إلى الدماغ أضعاف ما يتلقاه منه. وعضلات الوجه والوقفة الجسدية لا تعكس مشاعرنا فحسب — بل تُشكّلها وتُغيّرها. هذه ليست استعارات شعرية؛ إنها حقائق تشريحية موثّقة في الأبحاث.
                </p>
                <p>
                  التفكير الحسّي® يترجم هذه الأبحاث إلى أدوات كوتشينج عملية. حين يتعلّم الكوتش كيفية قراءة الإشارات الجسدية في الجلسة — توتر الكتفين، ضيق الصدر، الإيقاع في التنفس — فإنه لا يفسّر &quot;لغة الجسد&quot; بالمعنى التقليدي. إنه يقرأ بيانات معرفية حقيقية تسبق التعبير اللفظي وتتجاوزه.
                </p>
              </>
            ) : (
              <>
                <p>
                  For decades, a false assumption dominated psychology and education: that the brain is the center of thought, and the body merely executes its commands. Contemporary neuroscience has overturned this picture entirely. What is now called &quot;embodied cognition&quot; confirms that cognitive processes — decisions, emotions, understanding — do not happen in the brain alone, but in a living network that extends through the entire body.
                </p>
                <p>
                  Our gut contains more than one hundred million neurons — the equivalent of a cat&apos;s complete brain. The heart sends more signals to the brain than it receives back. Facial muscles and physical posture do not merely reflect our emotions — they shape and alter them. These are not poetic metaphors; they are anatomical facts documented in peer-reviewed research.
                </p>
                <p>
                  Somatic Thinking® translates this research into practical coaching tools. When a coach learns to read somatic signals in session — shoulder tension, chest constriction, breathing rhythm — they are not interpreting &quot;body language&quot; in the conventional sense. They are reading genuine cognitive data that precedes and transcends verbal expression.
                </p>
              </>
            )}
          </div>
        </div>
      </Section>

      {/* ═══════════════════════════════════════
          SECTION 2 — POLYVAGAL THEORY
      ═══════════════════════════════════════ */}
      <section
        className="py-16 md:py-24"
        style={{ background: 'var(--color-surface, #F8F7FC)' }}
        aria-label={isAr ? 'نظرية العصب المُبهَم' : 'Polyvagal Theory'}
      >
        <div className="mx-auto max-w-[var(--max-content-width)] px-4 md:px-8">
          <div className="max-w-3xl mx-auto">
            <p className="text-xs font-semibold tracking-[0.18em] uppercase text-[var(--color-accent)] mb-3">
              {isAr ? '٢' : '02'}
            </p>
            <h2
              className="text-2xl md:text-3xl font-bold text-[var(--text-primary)] mb-8"
              style={{ fontFamily: headingFont }}
            >
              {isAr ? 'نظرية العصب المُبهَم والكوتشينج' : 'Polyvagal Theory & Coaching'}
            </h2>

            <div
              className="space-y-6 text-[var(--color-neutral-700)] text-base md:text-lg leading-relaxed"
              style={{ fontFamily: bodyFont, lineHeight: '1.9' }}
            >
              {isAr ? (
                <>
                  <p>
                    طوّر عالم الأعصاب ستيفن بورجس نظرية العصب المُبهَم في تسعينيات القرن الماضي، وأحدثت ثورة في فهمنا لكيفية استجابة الجهاز العصبي للبيئة. النظرية تصف ثلاث حالات فسيولوجية رئيسية: حالة الأمان الاجتماعي، وحالة التعبئة (قتال أو هروب)، وحالة الانهيار والتجمّد. لا يحدث تعلّم حقيقي أو تحوّل فعلي إلا في الحالة الأولى.
                  </p>
                  <p>
                    في الكوتشينج التقليدي، كثيراً ما يدفع الكوتش العميل نحو مواجهة تحديات جديدة — دون الانتباه إلى الحالة الفسيولوجية التي يوجد فيها العميل. النتيجة: حالة من الاستثارة التي تُقفل التفكير بدلاً من أن تفتحه. التفكير الحسّي® يبني ممارسة الكوتشينج على قراءة هذه الحالات والتعامل معها — ليس كمهارة ثانوية، بل كأساس كل تدخّل.
                  </p>
                  <p>
                    حين يكون العميل في حالة أمان عصبي، تنشط مناطق الدماغ المسؤولة عن التفكير المتكامل، والتعلّم، والتواصل الاجتماعي العميق. الكوتش المدرَّب على التفكير الحسّي يعرف كيف يقرأ علامات الحالة في الجلسة، وكيف يدير الوتيرة بما يُبقي العميل في النافذة المثلى للتحوّل.
                  </p>
                </>
              ) : (
                <>
                  <p>
                    Neuroscientist Stephen Porges developed polyvagal theory in the 1990s, revolutionizing our understanding of how the nervous system responds to its environment. The theory describes three primary physiological states: social safety, mobilization (fight or flight), and collapse/freeze. Genuine learning and transformation only occur in the first state.
                  </p>
                  <p>
                    In conventional coaching, practitioners often push clients toward new challenges without attending to the client&apos;s current physiological state. The result is an arousal level that closes down thinking rather than opening it. Somatic Thinking® builds coaching practice on reading and working with these states — not as a secondary skill, but as the foundation of every intervention.
                  </p>
                  <p>
                    When a client is in a state of neural safety, the brain regions responsible for integrative thinking, learning, and deep social connection become active. A coach trained in Somatic Thinking® knows how to read state signals in session, and how to pace the work in ways that keep the client in the optimal window for transformation.
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════
          SECTION 3 — RESEARCH FOUNDATIONS
      ═══════════════════════════════════════ */}
      <Section variant="white">
        <div className="max-w-3xl mx-auto">
          <p className="text-xs font-semibold tracking-[0.18em] uppercase text-[var(--color-accent)] mb-3">
            {isAr ? '٣' : '03'}
          </p>
          <h2
            className="text-2xl md:text-3xl font-bold text-[var(--text-primary)] mb-8"
            style={{ fontFamily: headingFont }}
          >
            {isAr ? 'الأسس البحثية' : 'Research Foundations'}
          </h2>

          <div
            className="space-y-6 text-[var(--color-neutral-700)] text-base md:text-lg leading-relaxed"
            style={{ fontFamily: bodyFont, lineHeight: '1.9' }}
          >
            {isAr ? (
              <>
                <p>
                  يستند التفكير الحسّي® إلى تراكم بحثي ممتد عبر عدة حقول معرفية: نظرية التجسيد في الفلسفة المعرفية (ميرلو-بونتي، فاريلا، تومبسون، روش)، وأبحاث التنظيم الذاتي في علم النفس التنموي، وأبحاث التعلّم الحركي والذاكرة الجسدية في علم الأعصاب. ليس التفكير الحسّي® حقلاً واحداً — إنه تقاطع بين حقول متعددة يجمعها قناعة مشتركة: الجسد ليس أداةً، بل معرفة.
                </p>
                <p>
                  الأبحاث تُظهر باستمرار أن الأساليب المتجسّدة — تلك التي تدمج الوعي الجسدي مع التدخّل المعرفي — تُحقق نتائج أعمق وأكثر استدامة في التحوّل السلوكي مقارنة بالأساليب المعرفية وحدها. وهذا ما تحتمه طبيعة الذاكرة: التجارب المتجسّدة تُرسّخ نفسها في أنماط عصبية أعمق مما تفعله التجارب التأمّلية المجرّدة.
                </p>
                <p>
                  في كُن، لا نطرح هذه الأبحاث لإضفاء شرعية أكاديمية على ما نفعله. نطرحها لأنها تُفسّر ما يلاحظه المدرّبون والعملاء مرة بعد مرة: أن اللحظات الأعمق في الكوتشينج هي اللحظات التي يلتقي فيها الجسد والعقل معاً — وأن هذا الالتقاء لا يكون بالصدفة، بل بالممارسة المتعمّدة.
                </p>
              </>
            ) : (
              <>
                <p>
                  Somatic Thinking® draws on a cumulative research base spanning several fields: embodiment theory in cognitive philosophy (Merleau-Ponty, Varela, Thompson, Rosch), self-regulation research in developmental psychology, and studies of motor learning and somatic memory in neuroscience. Somatic Thinking® is not a single discipline — it is the intersection of multiple fields united by a shared conviction: the body is not a tool; it is knowledge.
                </p>
                <p>
                  Research consistently shows that embodied approaches — those that integrate somatic awareness with cognitive intervention — produce deeper and more durable outcomes in behavioral change compared to cognitive approaches alone. This is demanded by the nature of memory itself: embodied experiences encode themselves in deeper neural patterns than purely reflective ones.
                </p>
                <p>
                  At Kun, we do not present this research to lend academic legitimacy to what we do. We present it because it explains what coaches and clients observe again and again: that the deepest moments in coaching are the moments where body and mind meet together — and that this meeting is not accidental, but the product of deliberate practice.
                </p>
              </>
            )}
          </div>
        </div>
      </Section>

      {/* ═══════════════════════════════════════
          CTA — BACK TO METHODOLOGY
      ═══════════════════════════════════════ */}
      <section
        className="py-16 md:py-20"
        style={{ background: 'var(--color-surface, #F8F7FC)' }}
        aria-label={isAr ? 'الخطوة التالية' : 'Next Step'}
      >
        <div className="mx-auto max-w-[var(--max-content-width)] px-4 md:px-8 text-center">
          <p
            className="text-[var(--color-neutral-600)] text-base mb-8"
            style={{ fontFamily: bodyFont }}
          >
            {isAr
              ? 'هل أنت مستعد لاستكشاف كيف تصبح كوتش تفكير حسّي؟'
              : 'Ready to explore how to become a Somatic Thinking coach?'}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href={`/${locale}/about/methodology/coach-pathway`}
              className="inline-flex items-center justify-center min-h-[44px] px-8 py-3 rounded-full bg-[var(--color-primary)] text-white font-semibold text-sm transition-opacity hover:opacity-90"
              style={{ fontFamily: headingFont }}
            >
              {isAr ? 'مسار الكوتش' : 'Coach Pathway'}
            </a>
            <a
              href={`/${locale}/about/methodology`}
              className="inline-flex items-center justify-center min-h-[44px] px-8 py-3 rounded-full border border-[var(--color-primary)] text-[var(--color-primary)] font-semibold text-sm transition-colors hover:bg-[var(--color-primary)] hover:text-white"
              style={{ fontFamily: headingFont }}
            >
              {isAr ? 'العودة إلى المنهجية' : 'Back to Methodology'}
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
