import { setRequestLocale } from 'next-intl/server';
import { GeometricPattern } from '@kunacademy/ui/patterns';
import { Section } from '@kunacademy/ui/section';
import type { Metadata } from 'next';

interface Props { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: locale === 'ar' ? 'سياسة الخصوصية | أكاديمية كُن' : 'Privacy Policy | Kun Academy',
  };
}

export default async function PrivacyPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  return (
    <main>
      <section className="relative overflow-hidden py-12 md:py-20" style={{ background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-600) 100%)' }}>
        <GeometricPattern pattern="flower-of-life" opacity={0.06} fade="both" />
        <div className="relative z-10 mx-auto max-w-[var(--max-content-width)] px-4 md:px-6 text-center">
          <h1 className="text-[2rem] md:text-[3rem] font-bold text-[#FFF5E9] leading-[1.1]" style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}>
            {isAr ? 'سياسة الخصوصية' : 'Privacy Policy'}
          </h1>
          <p className="mt-3 text-white/60 text-sm">{isAr ? 'آخر تحديث: ٢٤ أكتوبر ٢٠٢٥' : 'Last updated: October 24, 2025'}</p>
        </div>
      </section>

      <Section variant="white">
        <div className="max-w-3xl mx-auto space-y-8" style={{ fontFamily: isAr ? 'var(--font-arabic-body)' : 'inherit' }}>
          {isAr ? (
            <>
              <LegalPreamble>
                تُوضح هذه السياسة كيفية جمع واستخدام وحماية البيانات الشخصية (&ldquo;المعلومات الشخصية&rdquo;) التي يتم جمعها عند زيارتك لموقعي KunCoaching.com وKunAcademy.com (ويُشار إليهما معًا بـ &ldquo;الموقعين&rdquo; أو &ldquo;الخدمة&rdquo;) أو عند استفادتك من أيٍّ من المنتجات أو البرامج أو الخدمات التي تُقدِّمها KUN COACHING ACADEMY L.L.C–FZ (أكاديمية كُن كوتشينج ش.ذ.م.م – منطقة حرّة)، ويُشار إليها في هذه الوثيقة بـ &ldquo;الأكاديمية&rdquo; أو &ldquo;نحن&rdquo; أو &ldquo;لنا&rdquo;.
                <br /><br />
                من خلال دخولك إلى الموقعين أو استخدامك لأي من خدماتنا، فإنك تُقرّ بأنك قرأت هذه السياسة وفهمتها ووافقت على الالتزام بها.
                <br /><br />
                تلتزم الأكاديمية بحماية بياناتك وفق أحكام المرسوم الاتحادي رقم (45) لسنة 2021 بشأن حماية البيانات الشخصية (PDPL)، وجميع الأنظمة والقوانين المعمول بها في دولة الإمارات العربية المتحدة.
              </LegalPreamble>

              <LegalSection title="١. نطاق السياسة">
                تنطبق هذه السياسة على جميع زوار ومستخدمي الموقعين وخدمات الأكاديمية، وتشمل ما يلي:
                <ul className="list-disc mr-6 mt-2 space-y-1">
                  <li>إنشاء الحسابات والمراسلات الإلكترونية.</li>
                  <li>التسجيل في البرامج التدريبية والرحلات والجلسات.</li>
                  <li>المعاملات المالية عبر الموقع.</li>
                  <li>التفاعل مع النماذج أو النشرات البريدية أو أدوات الدعم.</li>
                </ul>
                <br />
                ولا تنطبق هذه السياسة على المواقع أو الخدمات التي لا تملكها الأكاديمية أو لا تتحكم بها.
              </LegalSection>

              <LegalSection title="٢. المعلومات التي يتم جمعها">
                <strong>أ) معلومات تُجمع تلقائيًا</strong>
                <br />
                عند زيارة الموقعين، قد تُجمَع بعض البيانات التقنية لأغراض الأمان وتحسين الأداء، مثل:
                <ul className="list-disc mr-6 mt-2 space-y-1">
                  <li>عنوان بروتوكول الإنترنت (IP).</li>
                  <li>نوع المتصفح ونظام التشغيل والجهاز المستخدم.</li>
                  <li>الصفحات التي تمت زيارتها ومدّة الجلسة.</li>
                </ul>
                <br />
                تُستخدم هذه البيانات لتحليل حركة المرور واكتشاف أي استخدام ضار للموقعين، ولا تُستخدم لتحديد هوية المستخدمين.
                <br /><br />
                <strong>ب) المعلومات التي تقدمها طوعًا</strong>
                <br />
                عند التسجيل أو التواصل معنا أو شراء الخدمات، قد نطلب منك بيانات مثل:
                <ul className="list-disc mr-6 mt-2 space-y-1">
                  <li>الاسم الكامل، الدولة، والمهنة.</li>
                  <li>عنوان البريد الإلكتروني ورقم الهاتف.</li>
                  <li>تفاصيل الفواتير ووسائل الدفع (تُعالَج آمنًا عبر مزوّد خارجي معتمد).</li>
                  <li>الرسائل أو النماذج أو الملفات التي ترسلها إلينا.</li>
                </ul>
                <br />
                يمكنك اختيار عدم تقديم بعض هذه المعلومات، ولكن قد يحدّ ذلك من قدرتك على استخدام بعض الميزات أو الخدمات.
              </LegalSection>

              <LegalSection title="٣. استخدام المعلومات">
                تُستخدم البيانات الشخصية للأغراض التالية:
                <ul className="list-disc mr-6 mt-2 space-y-1">
                  <li>إنشاء حساب المستخدم وإدارة العضوية.</li>
                  <li>تنفيذ الطلبات وتأكيد الحجز.</li>
                  <li>التواصل الإداري وخدمة العملاء.</li>
                  <li>تطوير وتحسين البرامج والخدمات التدريبية.</li>
                  <li>إرسال إشعارات وتنبيهات أو دعوات أو نشرات تسويقية (بعد موافقتك).</li>
                  <li>حماية الأنظمة من الاحتيال أو إساءة الاستخدام.</li>
                  <li>الامتثال للالتزامات القانونية والتنظيمية في دولة الإمارات.</li>
                </ul>
                <br />
                لن تُستخدم معلوماتك لأي غرض آخر دون موافقتك الصريحة.
              </LegalSection>

              <LegalSection title="٤. الأساس القانوني للمعالجة">
                تستند الأكاديمية في جمع ومعالجة بياناتك إلى أحد الأسس القانونية التالية:
                <ul className="list-disc mr-6 mt-2 space-y-1">
                  <li>موافقتك المسبقة على المعالجة.</li>
                  <li>تنفيذ عقد أو اتفاق خدمة بينك وبين الأكاديمية.</li>
                  <li>التزام قانوني تخضع له الأكاديمية بموجب قوانين الدولة.</li>
                  <li>مصلحة مشروعة تتعلق بتطوير الخدمات وضمان الأمن الإلكتروني، مع احترام حقوقك الأساسية.</li>
                </ul>
              </LegalSection>

              <LegalSection title="٥. الفواتير والدفع">
                تستخدم الأكاديمية أنظمة دفع إلكترونية آمنة مقدّمة من جهات خارجية معتمدة في دولة الإمارات مثل Stripe أو PayTabs أو غيرها.
                <br /><br />
                يُرجى مراجعة سياسة الخصوصية الخاصة بمزود الخدمة المستخدم عند إتمام عملية الدفع.
                <br /><br />
                لا تحتفظ الأكاديمية ببيانات بطاقات الدفع على خوادمها، وتُشفّر جميع المعاملات عبر بروتوكولات SSL/TLS الآمنة.
              </LegalSection>

              <LegalSection title="٦. مشاركة المعلومات">
                قد تُشارك بياناتك الشخصية مع جهات محددة فقط، منها:
                <ul className="list-disc mr-6 mt-2 space-y-1">
                  <li>مزودو الخدمات المتعاقدون معنا (الدفع الإلكتروني، الدعم التقني، التسويق المحدود).</li>
                  <li>المدربون المعتمدون وشركاء التنفيذ عندما يكون ذلك ضروريًا لتقديم الخدمة التي اخترتها.</li>
                  <li>الجهات الحكومية أو القضائية عند وجود التزام قانوني بالإفصاح.</li>
                </ul>
                <br />
                تتأكد الأكاديمية من أن جميع هذه الجهات تلتزم باتفاقيات سرية ومعايير حماية بيانات تعادل أو تفوق معايير الأكاديمية، ولا يُسمح لها باستخدام المعلومات لأي أغراض أخرى.
              </LegalSection>

              <LegalSection title="٧. أمن المعلومات">
                تتخذ الأكاديمية تدابير تقنية وتنظيمية مناسبة لضمان أمن بياناتك، بما في ذلك:
                <ul className="list-disc mr-6 mt-2 space-y-1">
                  <li>تخزين البيانات في خوادم آمنة داخل مراكز بيانات معتمدة في الإمارات.</li>
                  <li>تطبيق التشفير أثناء النقل والتخزين.</li>
                  <li>مراجعات أمنية دورية وتحديثات للنظام.</li>
                </ul>
                <br />
                ومع ذلك، فإن نقل البيانات عبر الإنترنت قد لا يكون آمنًا تمامًا، وتقرّ بأن أي اتصال إلكتروني يتم على مسؤوليتك الخاصة.
              </LegalSection>

              <LegalSection title="٨. ملفات تعريف الارتباط (الكوكيز)">
                تستخدم الأكاديمية ملفات تعريف الارتباط لتحسين تجربة المستخدم، وتحليل التفاعل مع الموقع، وتخصيص المحتوى.
                <br /><br />
                يمكنك التحكم في إعدادات ملفات تعريف الارتباط من خلال متصفحك، علمًا بأن تعطيلها قد يحدّ من بعض ميزات الموقع.
              </LegalSection>

              <LegalSection title="٩. الاحتفاظ بالبيانات">
                تحتفظ الأكاديمية ببياناتك الشخصية فقط طالما كان ذلك ضروريًا لتحقيق الأغراض التي جُمعت من أجلها أو للامتثال للقوانين واللوائح ذات الصلة.
                <br /><br />
                بعد انتهاء الغرض، تُحذف البيانات أو تُحوّل إلى صيغة مجهولة الهوية (Anonymized) بحيث لا يمكن ربطها بك.
              </LegalSection>

              <LegalSection title="١٠. نقل المعلومات عبر الحدود">
                قد تُخزَّن بياناتك الشخصية أو تُعالج في خوادم تقع داخل دولة الإمارات العربية المتحدة أو خارجها، وذلك حسب موقع مزودي الخدمات الذين تعتمد عليهم الأكاديمية.
                <br /><br />
                تلتزم الأكاديمية بضمان أن أي نقل للبيانات خارج الدولة يتم وفق أحكام المرسوم الاتحادي رقم (45) لسنة 2021، وأن الجهات المستقبلة للبيانات تُقدّم مستوى حماية يعادل أو يفوق مستوى الحماية المطبّق في الإمارات.
                <br /><br />
                يمكنك التواصل معنا في أي وقت لمعرفة الدول أو مزودي الخدمات الذين تُنقل إليهم بياناتك.
              </LegalSection>

              <LegalSection title="١١. حقوق المستخدم">
                يحق لك في أي وقت ممارسة الحقوق التالية فيما يتعلق ببياناتك الشخصية:
                <ul className="list-disc mr-6 mt-2 space-y-1">
                  <li>الحق في الوصول إلى البيانات التي نحتفظ بها عنك.</li>
                  <li>الحق في التصحيح إذا كانت المعلومات غير دقيقة أو غير محدثة.</li>
                  <li>الحق في المحو (النسيان) عند زوال الغرض من الاحتفاظ بالبيانات أو عند سحب موافقتك.</li>
                  <li>الحق في تقييد المعالجة في حالات محددة مثل الاعتراض على الدقة أو الغرض من الاستخدام.</li>
                  <li>الحق في الاعتراض على المعالجة إذا تمّت لأغراض تسويقية أو بناءً على مصلحة مشروعة.</li>
                  <li>الحق في نقل البيانات إلى جهة أخرى عند الطلب، إذا كان ذلك ممكنًا تقنيًا.</li>
                </ul>
                <br />
                لممارسة أي من هذه الحقوق، يُرجى التواصل معنا عبر البريد الإلكتروني أدناه مع تقديم إثبات هوية واضح لضمان حماية خصوصيتك.
              </LegalSection>

              <LegalSection title="١٢. خصوصية الأطفال">
                لا تستهدف الأكاديمية الأطفال دون سن 18 عامًا، ولا تجمع عن علم أي بيانات شخصية تخصهم.
                <br /><br />
                إذا تبيّن أن طفلًا قدّم بياناته دون موافقة وليّ أمره، فستُحذف تلك البيانات فورًا عند الإخطار.
                <br /><br />
                يُشجَّع الآباء والأوصياء على مراقبة استخدام أبنائهم للإنترنت وتوجيههم بعدم تقديم بياناتهم الشخصية دون إذن.
              </LegalSection>

              <LegalSection title="١٣. التسويق والبريد الإلكتروني">
                قد تُرسل الأكاديمية نشرات أو عروضًا تسويقية إلى المستخدمين الذين اختاروا الاشتراك طوعًا في قائمتنا البريدية.
                <br /><br />
                يمكنك في أي وقت إلغاء الاشتراك عبر الرابط الموجود في أسفل الرسالة أو بالتواصل معنا.
                <br /><br />
                لن نشارك بريدك الإلكتروني مع أي جهة خارجية لأغراض تسويقية، ويقتصر استخدامه على التواصل المباشر من قبل الأكاديمية.
              </LegalSection>

              <LegalSection title="١٤. ملفات الارتباط التابعة والإعلانات">
                قد تتضمن صفحات الموقعين روابط أو ملفات ارتباط تابعة (Affiliate Links) لمزودي خدمات وشركاء مختارين.
                <br /><br />
                إذا نقرت على أحد هذه الروابط، فقد تُوضع ملفات تعريف ارتباط على متصفحك لتتبع عملية الشراء أو التسجيل لأغراض حساب العمولات فقط.
                <br /><br />
                لا يتحمل الموقعان مسؤولية سياسات الخصوصية أو محتوى تلك المواقع الخارجية.
              </LegalSection>

              <LegalSection title="١٥. الأمان والإبلاغ عن الخروقات">
                تتخذ الأكاديمية جميع التدابير المعقولة لحماية بياناتك من الوصول أو التعديل أو الإفصاح غير المصرّح به.
                <br /><br />
                وفي حالة وقوع خرق أمني قد يؤثر في بياناتك الشخصية، فسيتم:
                <ul className="list-disc mr-6 mt-2 space-y-1">
                  <li>إخطارك خلال فترة زمنية معقولة.</li>
                  <li>إبلاغ السلطات المختصة في الدولة عند الاقتضاء.</li>
                  <li>اتخاذ الخطوات التصحيحية العاجلة للحد من الأثر.</li>
                </ul>
              </LegalSection>

              <LegalSection title="١٦. الروابط إلى مواقع أخرى">
                قد يحتوي الموقعان على روابط إلى مواقع أو موارد خارجية لا تخضع لسيطرة الأكاديمية.
                <br /><br />
                لا تتحمل الأكاديمية مسؤولية ممارسات الخصوصية أو محتوى هذه المواقع، وتُشجّع المستخدمين على مراجعة سياسات الخصوصية الخاصة بها قبل تقديم أي بيانات.
              </LegalSection>

              <LegalSection title="١٧. التغييرات في السياسة">
                تحتفظ الأكاديمية بالحق في تعديل هذه السياسة من وقتٍ إلى آخر بما يتماشى مع التغييرات القانونية أو التقنية أو التشغيلية.
                <br /><br />
                سيتم الإعلان عن أي تعديل جوهري عبر تحديث تاريخ النشر في أسفل الصفحة أو عبر إشعار بالبريد الإلكتروني.
                <br /><br />
                يُعتبر استمرارك في استخدام الموقعين بعد نشر النسخة المعدّلة موافقة ضمنية منك على التعديلات.
              </LegalSection>

              <LegalSection title="١٨. الاتصال بنا">
                لأي استفسار أو طلب متعلق بالبيانات الشخصية أو لتفعيل حقوقك، يُرجى التواصل معنا عبر البريد الإلكتروني:
                <br /><br />
                privacy@kunacademy.com
                <br />
                أو
                <br />
                info@kuncoaching.com
                <br /><br />
                العنوان الرسمي:
                <br />
                KUN COACHING ACADEMY L.L.C–FZ
                <br />
                Business Center 1, Mezzanine Floor, The Meydan Hotel, Nad Al Sheba, Dubai, U.A.E.
              </LegalSection>

              <LegalSection title="١٩. تاريخ النفاذ">
                تسري هذه السياسة اعتبارًا من 24 أكتوبر 2025، وتُلغي أي إصدارات سابقة من سياسات الخصوصية الخاصة بالأكاديمية.
              </LegalSection>
            </>
          ) : (
            <>
              <LegalPreamble>
                This policy explains how we collect, use, and protect personal data (&ldquo;Personal Information&rdquo;) gathered when you visit KunCoaching.com and KunAcademy.com (collectively referred to as &ldquo;the Websites&rdquo; or &ldquo;the Service&rdquo;) or when you use any products, programs, or services offered by KUN COACHING ACADEMY L.L.C–FZ, referred to herein as &ldquo;the Academy,&rdquo; &ldquo;we,&rdquo; or &ldquo;us.&rdquo;
                <br /><br />
                By accessing the Websites or using any of our services, you acknowledge that you have read, understood, and agreed to abide by this policy.
                <br /><br />
                The Academy is committed to protecting your data in accordance with Federal Decree-Law No. (45) of 2021 on the Protection of Personal Data (PDPL) and all applicable laws and regulations in the United Arab Emirates.
              </LegalPreamble>

              <LegalSection title="1. Scope of Policy">
                This policy applies to all visitors and users of the Websites and Academy services, including:
                <ul className="list-disc ml-6 mt-2 space-y-1">
                  <li>Account creation and electronic correspondence.</li>
                  <li>Registration for training programs, trips, and sessions.</li>
                  <li>Financial transactions through the website.</li>
                  <li>Interaction with forms, newsletters, or support tools.</li>
                </ul>
                <br />
                This policy does not apply to websites or services not owned or controlled by the Academy.
              </LegalSection>

              <LegalSection title="2. Information We Collect">
                <strong>a) Automatically Collected Information</strong>
                <br />
                When you visit the Websites, certain technical data may be collected for security and performance purposes, such as:
                <ul className="list-disc ml-6 mt-2 space-y-1">
                  <li>Internet Protocol (IP) address.</li>
                  <li>Browser type, operating system, and device used.</li>
                  <li>Pages visited and session duration.</li>
                </ul>
                <br />
                This data is used to analyze traffic and detect any harmful use of the Websites, and is not used to identify individual users.
                <br /><br />
                <strong>b) Voluntarily Provided Information</strong>
                <br />
                When registering, contacting us, or purchasing services, we may request data such as:
                <ul className="list-disc ml-6 mt-2 space-y-1">
                  <li>Full name, country, and profession.</li>
                  <li>Email address and phone number.</li>
                  <li>Billing details and payment methods (securely processed through an approved external provider).</li>
                  <li>Messages, forms, or files you send us.</li>
                </ul>
                <br />
                You may choose not to provide some of this information, but doing so may limit your ability to use certain features or services.
              </LegalSection>

              <LegalSection title="3. Use of Information">
                Personal data is used for the following purposes:
                <ul className="list-disc ml-6 mt-2 space-y-1">
                  <li>Creating and managing user accounts and memberships.</li>
                  <li>Processing orders and confirming bookings.</li>
                  <li>Administrative communication and customer service.</li>
                  <li>Developing and improving training programs and services.</li>
                  <li>Sending notifications, alerts, invitations, or marketing newsletters (with your consent).</li>
                  <li>Protecting systems from fraud or misuse.</li>
                  <li>Compliance with legal and regulatory obligations in the UAE.</li>
                </ul>
                <br />
                Your information will not be used for any other purpose without your explicit consent.
              </LegalSection>

              <LegalSection title="4. Legal Basis for Processing">
                The Academy processes your data based on one of the following legal bases:
                <ul className="list-disc ml-6 mt-2 space-y-1">
                  <li>Your prior consent to data processing.</li>
                  <li>Execution of a contract or service agreement between you and the Academy.</li>
                  <li>A legal obligation the Academy is subject to under national law.</li>
                  <li>A legitimate interest related to service development and cybersecurity, while respecting your fundamental rights.</li>
                </ul>
              </LegalSection>

              <LegalSection title="5. Billing and Payment">
                The Academy uses secure electronic payment systems provided by approved third parties in the UAE, such as Stripe, PayTabs, or others.
                <br /><br />
                Please review the privacy policy of the payment provider used when completing a transaction.
                <br /><br />
                The Academy does not store payment card data on its servers, and all transactions are encrypted using SSL/TLS protocols.
              </LegalSection>

              <LegalSection title="6. Information Sharing">
                Your personal data may be shared with specific parties only, including:
                <ul className="list-disc ml-6 mt-2 space-y-1">
                  <li>Contracted service providers (electronic payment, technical support, limited marketing).</li>
                  <li>Certified coaches and implementation partners when necessary to deliver the service you selected.</li>
                  <li>Government or judicial authorities when a legal obligation to disclose exists.</li>
                </ul>
                <br />
                The Academy ensures that all such parties are bound by confidentiality agreements and data protection standards that meet or exceed the Academy&apos;s own standards, and they are not permitted to use the information for any other purposes.
              </LegalSection>

              <LegalSection title="7. Information Security">
                The Academy takes appropriate technical and organizational measures to ensure the security of your data, including:
                <ul className="list-disc ml-6 mt-2 space-y-1">
                  <li>Storing data on secure servers within certified data centers in the UAE.</li>
                  <li>Applying encryption during transit and storage.</li>
                  <li>Periodic security reviews and system updates.</li>
                </ul>
                <br />
                However, data transmission over the internet may not be completely secure, and you acknowledge that any electronic communication is at your own risk.
              </LegalSection>

              <LegalSection title="8. Cookies">
                The Academy uses cookies to improve user experience, analyze site interaction, and customize content.
                <br /><br />
                You can control cookie settings through your browser, noting that disabling them may limit some site features.
              </LegalSection>

              <LegalSection title="9. Data Retention">
                The Academy retains your personal data only as long as necessary to fulfill the purposes for which it was collected or to comply with applicable laws and regulations.
                <br /><br />
                After the purpose expires, data is deleted or anonymized so that it can no longer be linked to you.
              </LegalSection>

              <LegalSection title="10. Cross-Border Data Transfer">
                Your personal data may be stored or processed on servers located within or outside the United Arab Emirates, depending on the location of service providers the Academy relies on.
                <br /><br />
                The Academy ensures that any data transfer outside the country complies with Federal Decree-Law No. (45) of 2021, and that receiving parties provide a level of protection equal to or exceeding that applied in the UAE.
                <br /><br />
                You may contact us at any time to learn about the countries or service providers to which your data is transferred.
              </LegalSection>

              <LegalSection title="11. User Rights">
                You have the right at any time to exercise the following rights regarding your personal data:
                <ul className="list-disc ml-6 mt-2 space-y-1">
                  <li>The right to access data we hold about you.</li>
                  <li>The right to correction if information is inaccurate or outdated.</li>
                  <li>The right to erasure (right to be forgotten) when the purpose of retention ceases or when you withdraw consent.</li>
                  <li>The right to restrict processing in specific cases such as objecting to accuracy or purpose of use.</li>
                  <li>The right to object to processing if done for marketing purposes or based on legitimate interest.</li>
                  <li>The right to data portability to another entity upon request, where technically feasible.</li>
                </ul>
                <br />
                To exercise any of these rights, please contact us via the email below with clear proof of identity to ensure the protection of your privacy.
              </LegalSection>

              <LegalSection title="12. Children&apos;s Privacy">
                The Academy does not target children under the age of 18 and does not knowingly collect any personal data concerning them.
                <br /><br />
                If it becomes apparent that a child has provided their data without parental consent, that data will be immediately deleted upon notification.
                <br /><br />
                Parents and guardians are encouraged to monitor their children&apos;s internet use and direct them not to provide personal data without permission.
              </LegalSection>

              <LegalSection title="13. Marketing and Email">
                The Academy may send newsletters or marketing offers to users who have voluntarily subscribed to our mailing list.
                <br /><br />
                You may unsubscribe at any time via the link at the bottom of the message or by contacting us.
                <br /><br />
                We will not share your email with any third party for marketing purposes; its use is limited to direct communication by the Academy.
              </LegalSection>

              <LegalSection title="14. Affiliate Cookies and Advertising">
                The Websites may contain affiliate links or cookies from selected service providers and partners.
                <br /><br />
                If you click on one of these links, cookies may be placed on your browser to track purchases or registrations for commission calculation purposes only.
                <br /><br />
                The Websites are not responsible for the privacy policies or content of those external sites.
              </LegalSection>

              <LegalSection title="15. Security and Breach Reporting">
                The Academy takes all reasonable measures to protect your data from unauthorized access, modification, or disclosure.
                <br /><br />
                In the event of a security breach that may affect your personal data:
                <ul className="list-disc ml-6 mt-2 space-y-1">
                  <li>You will be notified within a reasonable time period.</li>
                  <li>The relevant authorities in the country will be informed as required.</li>
                  <li>Urgent corrective steps will be taken to minimize the impact.</li>
                </ul>
              </LegalSection>

              <LegalSection title="16. Links to Other Websites">
                The Websites may contain links to external sites or resources not under the Academy&apos;s control.
                <br /><br />
                The Academy is not responsible for the privacy practices or content of these sites and encourages users to review their privacy policies before providing any data.
              </LegalSection>

              <LegalSection title="17. Changes to This Policy">
                The Academy reserves the right to modify this policy from time to time in line with legal, technical, or operational changes.
                <br /><br />
                Any material change will be announced by updating the publication date at the bottom of the page or via email notification.
                <br /><br />
                Your continued use of the Websites after the amended version is published constitutes your implicit consent to the modifications.
              </LegalSection>

              <LegalSection title="18. Contact Us">
                For any inquiry or request related to personal data or to exercise your rights, please contact us via email:
                <br /><br />
                privacy@kunacademy.com
                <br />
                or
                <br />
                info@kuncoaching.com
                <br /><br />
                Official address:
                <br />
                KUN COACHING ACADEMY L.L.C–FZ
                <br />
                Business Center 1, Mezzanine Floor, The Meydan Hotel, Nad Al Sheba, Dubai, U.A.E.
              </LegalSection>

              <LegalSection title="19. Effective Date">
                This policy is effective as of October 24, 2025, and supersedes any previous versions of the Academy&apos;s privacy policies.
              </LegalSection>
            </>
          )}
        </div>
      </Section>
    </main>
  );
}

function LegalPreamble({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[var(--color-neutral-700)] leading-relaxed">{children}</div>
  );
}

function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-lg font-bold text-[var(--text-primary)] mb-3">{title}</h2>
      <div className="text-[var(--color-neutral-700)] leading-relaxed">{children}</div>
    </div>
  );
}
