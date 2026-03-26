import { setRequestLocale } from 'next-intl/server';
import { GeometricPattern } from '@kunacademy/ui/patterns';
import { Section } from '@kunacademy/ui/section';
import type { Metadata } from 'next';

interface Props { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return { title: locale === 'ar' ? 'الشروط والأحكام | أكاديمية كُن' : 'Terms & Conditions | Kun Academy' };
}

export default async function TermsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  return (
    <main>
      <section className="relative overflow-hidden py-12 md:py-20" style={{ background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-600) 100%)' }}>
        <GeometricPattern pattern="flower-of-life" opacity={0.06} fade="both" />
        <div className="relative z-10 mx-auto max-w-[var(--max-content-width)] px-4 md:px-6 text-center">
          <h1 className="text-[2rem] md:text-[3rem] font-bold text-[#FFF5E9] leading-[1.1]" style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}>
            {isAr ? 'الشروط والأحكام' : 'Terms & Conditions'}
          </h1>
          <p className="mt-3 text-white/60 text-sm">{isAr ? 'آخر تحديث: ٢٤ أكتوبر ٢٠٢٥' : 'Last updated: October 24, 2025'}</p>
        </div>
      </section>

      <Section variant="white">
        <div className="max-w-3xl mx-auto space-y-8" style={{ fontFamily: isAr ? 'var(--font-arabic-body)' : 'inherit' }}>
          {isAr ? (
            <>
              <LSPreamble>
                تحتفظ KUN COACHING ACADEMY L.L.C–FZ (أكاديمية كُن كوتشينج ش.ذ.م.م – منطقة حرّة) بإدارة وتشغيل موقعيّ KunCoaching.com وKunAcademy.com (ويُشار إليهما مجتمعَين بـ &laquo;الموقعين&raquo; أو &laquo;الموقع&raquo;).
                <br /><br />
                فيما يلي شروط الاستخدام التي تحكم دخولك إلى الموقع واستخدامك له، بالإضافة إلى أي خدمات تُقدَّم من خلاله (ويُشار إليها بـ &laquo;الخدمات&raquo;).
                <br /><br />
                باستخدامك للموقع أو الخدمات، فإنك تُقر بأنك قرأت هذه الشروط وفهمتها ووافقت على الالتزام بها وبسياسة الخصوصية.
                <br /><br />
                تحتفظ الأكاديمية بحقها في تعديل هذه الشروط في أي وقت دون إشعار مسبق، ويسري أي تعديل فور نشره على الموقعين. يُنصح بمراجعة هذه الصفحة دوريًا.
              </LSPreamble>

              <LS t="١. التعريف">
                <ul className="list-disc mr-6 mt-2 space-y-2">
                  <li><strong>الأكاديمية:</strong> تشير إلى KUN COACHING ACADEMY L.L.C–FZ، المسجّلة في منطقة ميدان الحرّة بدبي، الإمارات العربية المتحدة.</li>
                  <li><strong>المستخدم:</strong> أي فرد أو جهة تقوم بالدخول إلى الموقع أو استخدام أي من خدماته.</li>
                  <li><strong>المدربون (الكوتشز):</strong> الأفراد أو الجهات المتخصصة في التدريب والمرخَّص لهم بتقديم خدمات عبر الموقعين.</li>
                </ul>
              </LS>

              <LS t="٢. نطاق الاستخدام">
                تُقدِّم الأكاديمية عبر الموقعين منصّات إلكترونية للتدريب والتعليم والتطوير المهني، بما يشمل:
                <ul className="list-disc mr-6 mt-2 space-y-1">
                  <li>الجلسات الفردية والجماعية.</li>
                  <li>الدورات والبرامج المعتمدة.</li>
                  <li>الرحلات التعليمية والفعاليات التطويرية.</li>
                  <li>الخدمات المساندة كالحجوزات والدفع الإلكتروني.</li>
                </ul>
              </LS>

              <LS t="٣. الترخيص المحدود">
                يُمنح المستخدم ترخيصًا شخصيًا ومؤقتًا وغير حصري وغير قابل للتحويل لاستخدام الموقعين وفقًا لهذه الشروط.
                <br /><br />
                ويحظر على المستخدم القيام بأيٍّ مما يلي دون إذن خطي مسبق من الأكاديمية:
                <ul className="list-disc mr-6 mt-2 space-y-1">
                  <li>نسخ أو توزيع أو تعديل أي محتوى من الموقع.</li>
                  <li>إنشاء روابط عميقة أو استنساخ صفحات الموقع لأغراض تجارية.</li>
                  <li>استخدام العلامات التجارية أو الشعارات دون تصريح.</li>
                </ul>
                <br />
                تحتفظ الأكاديمية بحقها في تقييد أو تعليق أو إنهاء الوصول إلى أي جزء من الموقع في حال مخالفة هذه الشروط.
              </LS>

              <LS t="٤. حساب المستخدم">
                عند إنشاء حساب على الموقعين، يتحمل المستخدم المسؤولية الكاملة عن:
                <ul className="list-disc mr-6 mt-2 space-y-1">
                  <li>دقة وصحة البيانات المسجّلة.</li>
                  <li>الحفاظ على سرية اسم المستخدم وكلمة المرور.</li>
                  <li>جميع الأنشطة التي تتم عبر الحساب.</li>
                </ul>
                <br />
                يُمنع القُصَّر دون سن 18 عامًا من التسجيل أو استخدام الموقعين دون موافقة ولي الأمر.
                <br /><br />
                ولا تتحمّل الأكاديمية أي مسؤولية عن أضرار ناتجة عن استخدام غير مصرح به للحساب.
              </LS>

              <LS t="٥. المدربون (الكوتشز)">
                يعمل المدربون عبر الأكاديمية بصفتهم شركاء مستقلّين، وتقوم الأكاديمية بتسهيل الحجز والدفع فقط.
                <br /><br />
                لا تُعد الأكاديمية طرفًا في العلاقة التعاقدية بين العميل والمدرب، ولا تتحمل أي مسؤولية عن النتائج أو الاتفاقات الجانبية بين الطرفين.
                <br /><br />
                يُشجَّع المستخدمون على التحقق من خلفية المدرب قبل الحجز.
                <br /><br />
                في حال وقوع نزاع بين المستخدم والمدرب، فإن المستخدم يُعفي الأكاديمية وموظفيها من أي مطالبات أو تعويضات متعلقة بذلك النزاع.
              </LS>

              <LS t="٦. القانون المعمول به والاختصاص القضائي">
                تخضع هذه الاتفاقية وتفسيرها لقوانين دولة الإمارات العربية المتحدة.
                <br /><br />
                ويكون الاختصاص الحصري في أي نزاع للمحاكم المختصة في إمارة دبي.
              </LS>

              <LS t="٧. المعاملات الإلكترونية والدفع">
                <ul className="list-disc mr-6 mt-2 space-y-1">
                  <li>تُقبل المدفوعات عبر بطاقات فيزا وماستركارد بالدرهم الإماراتي.</li>
                  <li>المعاملة متعددة العملات تُظهر السعر بالعملة المختارة وتُخصم بنفس العملة.</li>
                  <li>يتم إرسال تأكيد الدفع إلى البريد الإلكتروني خلال 24 ساعة من إتمام العملية.</li>
                  <li>لا تحتفظ الأكاديمية ببيانات بطاقات الدفع على خوادمها.</li>
                  <li>يتحمّل حامل البطاقة مسؤولية حفظ إيصالات الدفع وسجلات المعاملات.</li>
                </ul>
              </LS>

              <LS t="٨. سياسة الاسترداد والإلغاء">
                <strong>١. الجلسات الفردية والجماعية والرحلات القصيرة</strong>
                <ul className="list-disc mr-6 mt-2 space-y-1">
                  <li>فترة السماح بطلب الاسترداد: 7 أيام تقويمية من تاريخ الشراء.</li>
                  <li>يمكن تحويل الرسوم إلى شخص آخر قبل بدء البرنامج.</li>
                  <li>تُعاد المبالغ المستحقة خلال 30 يومًا عبر وسيلة الدفع الأصلية فقط.</li>
                </ul>
                <br />
                <strong>٢. البرامج والدورات والرحلات التعليمية</strong>
                <ul className="list-disc mr-6 mt-2 space-y-1">
                  <li>استرداد كامل (100%) عند إلغاء البرنامج من قِبل الأكاديمية أو إلغاء المشارك قبل أسبوعين من البدء.</li>
                  <li>استرداد جزئي (75%) عند الإلغاء خلال أقل من أسبوعين، و50% عند الإلغاء خلال أسبوع.</li>
                  <li>لا استرداد بعد بدء البرنامج.</li>
                </ul>
                <br />
                <strong>٣. الخدمات الإضافية</strong>
                <br />
                الاستشارات الخاصة أو الدعم الفني أو التصاميم التنفيذية غير قابلة للاسترداد.
              </LS>

              <LS t="٩. الملكية الفكرية">
                جميع المحتويات والعلامات والمناهج والمستندات والبرامج المنشورة على الموقعين هي ملكية فكرية حصرية للأكاديمية.
                <br /><br />
                ويُحظر استخدامها أو إعادة إنتاجها دون إذن خطي مسبق.
                <br /><br />
                تشمل العلامات المحمية على سبيل المثال لا الحصر: Somatic Thinking – Kun Academy – Kun Coaching – Barakah Flows – منهجك – إحياء – KunSphere.
              </LS>

              <LS t="١٠. الروابط الخارجية والمحتوى التابع">
                قد تحتوي صفحات الموقعين على روابط لمواقع أخرى لا تملكها الأكاديمية.
                <br /><br />
                لا تتحمل الأكاديمية مسؤولية دقة أو أمان تلك المواقع. استخدامك لأي رابط خارجي يكون على مسؤوليتك الخاصة.
              </LS>

              <LS t="١١. إخلاء المسؤولية">
                تُقدَّم الخدمات والمحتوى &ldquo;كما هي&rdquo;، دون أي ضمان صريح أو ضمني، بما في ذلك ضمان الدقة أو الملاءمة أو التوفّر.
                <br /><br />
                ولا تتحمل الأكاديمية أي مسؤولية عن:
                <ul className="list-disc mr-6 mt-2 space-y-1">
                  <li>الأعطال التقنية أو فقدان البيانات.</li>
                  <li>القرارات أو التصرفات التي يتخذها المستخدم بناءً على المحتوى.</li>
                  <li>التعاملات التي تتم خارج المنصّة بين المستخدمين أو المدربين.</li>
                </ul>
                <br />
                في جميع الأحوال، تقتصر مسؤولية الأكاديمية على المبلغ المدفوع عن الخدمة محل النزاع.
              </LS>

              <LS t="١٢. التعويض">
                يُوافق المستخدم على تعويض الأكاديمية وموظفيها ووكلائها عن أي مطالبة أو خسارة تنشأ عن:
                <ul className="list-disc mr-6 mt-2 space-y-1">
                  <li>خرق الشروط أو القوانين المعمول بها.</li>
                  <li>إساءة استخدام الموقع أو محتواه.</li>
                </ul>
              </LS>

              <LS t="١٣. الإعلانات والمحتوى الترويجي">
                قد تعرض الأكاديمية إعلانات أو محتوى تسويقي من أطراف ثالثة.
                <br /><br />
                تُراجع تلك الأطراف محتواها وتتحمل مسؤوليته كاملة. ولا تُعد الأكاديمية مسؤولة عن أي ضرر أو تضليل ناتج عنه.
              </LS>

              <LS t="١٤. قابلية الفصل">
                إذا اعتُبر أي بند من هذه الاتفاقية غير صالح أو غير قابل للتنفيذ، تبقى البنود الأخرى سارية المفعول بكامل قوتها.
              </LS>

              <LS t="١٥. الاتصالات الرسمية">
                للتواصل مع الأكاديمية بخصوص هذه الشروط أو أي استفسار قانوني:
                <br /><br />
                info@kuncoaching.com
                <br />
                privacy@kunacademy.com
                <br /><br />
                العنوان الرسمي:
                <br />
                KUN COACHING ACADEMY L.L.C–FZ
                <br />
                Business Center 1, Mezzanine Floor, The Meydan Hotel, Nad Al Sheba, Dubai, U.A.E.
              </LS>

              <LS t="١٦. تاريخ السريان">
                تُعتبر هذه الاتفاقية سارية اعتبارًا من 24 أكتوبر 2025، وتُلغي أي نسخ سابقة من شروط الاستخدام.
              </LS>
            </>
          ) : (
            <>
              <LSPreamble>
                KUN COACHING ACADEMY L.L.C–FZ manages and operates KunCoaching.com and KunAcademy.com (collectively referred to as &ldquo;the Websites&rdquo; or &ldquo;the Website&rdquo;).
                <br /><br />
                The following terms of use govern your access to and use of the Website, as well as any services provided through it (referred to as &ldquo;the Services&rdquo;).
                <br /><br />
                By using the Website or Services, you acknowledge that you have read, understood, and agreed to abide by these terms and the Privacy Policy.
                <br /><br />
                The Academy reserves the right to modify these terms at any time without prior notice, and any modification shall take effect upon publication on the Websites. You are advised to review this page periodically.
              </LSPreamble>

              <LS t="1. Definitions">
                <ul className="list-disc ml-6 mt-2 space-y-2">
                  <li><strong>The Academy:</strong> Refers to KUN COACHING ACADEMY L.L.C–FZ, registered in the Meydan Free Zone, Dubai, United Arab Emirates.</li>
                  <li><strong>User:</strong> Any individual or entity that accesses the Website or uses any of its services.</li>
                  <li><strong>Coaches:</strong> Individuals or entities specializing in training and licensed to provide services through the Websites.</li>
                </ul>
              </LS>

              <LS t="2. Scope of Use">
                The Academy provides electronic platforms for training, education, and professional development through the Websites, including:
                <ul className="list-disc ml-6 mt-2 space-y-1">
                  <li>Individual and group sessions.</li>
                  <li>Accredited courses and programs.</li>
                  <li>Educational trips and development events.</li>
                  <li>Supporting services such as bookings and electronic payment.</li>
                </ul>
              </LS>

              <LS t="3. Limited License">
                The user is granted a personal, temporary, non-exclusive, and non-transferable license to use the Websites in accordance with these terms.
                <br /><br />
                The user is prohibited from doing any of the following without prior written permission from the Academy:
                <ul className="list-disc ml-6 mt-2 space-y-1">
                  <li>Copying, distributing, or modifying any content from the Website.</li>
                  <li>Creating deep links or cloning Website pages for commercial purposes.</li>
                  <li>Using trademarks or logos without authorization.</li>
                </ul>
                <br />
                The Academy reserves the right to restrict, suspend, or terminate access to any part of the Website in case of violation of these terms.
              </LS>

              <LS t="4. User Account">
                When creating an account on the Websites, the user bears full responsibility for:
                <ul className="list-disc ml-6 mt-2 space-y-1">
                  <li>The accuracy and correctness of registered information.</li>
                  <li>Maintaining the confidentiality of the username and password.</li>
                  <li>All activities conducted through the account.</li>
                </ul>
                <br />
                Minors under the age of 18 are prohibited from registering or using the Websites without parental consent.
                <br /><br />
                The Academy bears no responsibility for damages resulting from unauthorized use of the account.
              </LS>

              <LS t="5. Coaches">
                Coaches operate through the Academy as independent partners, and the Academy facilitates booking and payment only.
                <br /><br />
                The Academy is not a party to the contractual relationship between the client and the coach, and bears no responsibility for outcomes or side agreements between the two parties.
                <br /><br />
                Users are encouraged to verify the coach&apos;s background before booking.
                <br /><br />
                In the event of a dispute between a user and a coach, the user releases the Academy and its employees from any claims or compensation related to that dispute.
              </LS>

              <LS t="6. Governing Law and Jurisdiction">
                This agreement and its interpretation are governed by the laws of the United Arab Emirates.
                <br /><br />
                Exclusive jurisdiction for any dispute lies with the competent courts in the Emirate of Dubai.
              </LS>

              <LS t="7. Electronic Transactions and Payment">
                <ul className="list-disc ml-6 mt-2 space-y-1">
                  <li>Payments are accepted via Visa and Mastercard in UAE Dirhams.</li>
                  <li>Multi-currency transactions display the price in the selected currency and charge in the same currency.</li>
                  <li>Payment confirmation is sent to the email within 24 hours of completing the transaction.</li>
                  <li>The Academy does not retain payment card data on its servers.</li>
                  <li>The cardholder is responsible for keeping payment receipts and transaction records.</li>
                </ul>
              </LS>

              <LS t="8. Refund and Cancellation Policy">
                <strong>1. Individual Sessions, Group Sessions, and Short Trips</strong>
                <ul className="list-disc ml-6 mt-2 space-y-1">
                  <li>Refund request grace period: 7 calendar days from the date of purchase.</li>
                  <li>Fees may be transferred to another person before the program starts.</li>
                  <li>Eligible refunds are returned within 30 days via the original payment method only.</li>
                </ul>
                <br />
                <strong>2. Programs, Courses, and Educational Trips</strong>
                <ul className="list-disc ml-6 mt-2 space-y-1">
                  <li>Full refund (100%) if the program is cancelled by the Academy or the participant cancels 2+ weeks before the start date.</li>
                  <li>Partial refund (75%) if cancelled less than 2 weeks before, and 50% if cancelled within 1 week.</li>
                  <li>No refund after the program has started.</li>
                </ul>
                <br />
                <strong>3. Additional Services</strong>
                <br />
                Private consultations, technical support, or executive designs are non-refundable.
              </LS>

              <LS t="9. Intellectual Property">
                All content, trademarks, curricula, documents, and programs published on the Websites are the exclusive intellectual property of the Academy.
                <br /><br />
                Their use or reproduction without prior written permission is prohibited.
                <br /><br />
                Protected marks include, but are not limited to: Somatic Thinking – Kun Academy – Kun Coaching – Barakah Flows – KunSphere.
              </LS>

              <LS t="10. External Links and Third-Party Content">
                The Websites may contain links to other sites not owned by the Academy.
                <br /><br />
                The Academy is not responsible for the accuracy or security of those sites. Your use of any external link is at your own risk.
              </LS>

              <LS t="11. Disclaimer">
                Services and content are provided &ldquo;as is,&rdquo; without any express or implied warranty, including warranties of accuracy, suitability, or availability.
                <br /><br />
                The Academy bears no responsibility for:
                <ul className="list-disc ml-6 mt-2 space-y-1">
                  <li>Technical malfunctions or data loss.</li>
                  <li>Decisions or actions taken by the user based on the content.</li>
                  <li>Transactions conducted off-platform between users or coaches.</li>
                </ul>
                <br />
                In all cases, the Academy&apos;s liability is limited to the amount paid for the disputed service.
              </LS>

              <LS t="12. Indemnification">
                The user agrees to indemnify the Academy and its employees and agents against any claim or loss arising from:
                <ul className="list-disc ml-6 mt-2 space-y-1">
                  <li>Breach of these terms or applicable laws.</li>
                  <li>Misuse of the Website or its content.</li>
                </ul>
              </LS>

              <LS t="13. Advertising and Promotional Content">
                The Academy may display advertisements or marketing content from third parties.
                <br /><br />
                Those parties review their content and bear full responsibility for it. The Academy is not responsible for any harm or misinformation resulting from it.
              </LS>

              <LS t="14. Severability">
                If any provision of this agreement is deemed invalid or unenforceable, the remaining provisions shall remain in full force and effect.
              </LS>

              <LS t="15. Official Communications">
                To contact the Academy regarding these terms or any legal inquiry:
                <br /><br />
                info@kuncoaching.com
                <br />
                privacy@kunacademy.com
                <br /><br />
                Official address:
                <br />
                KUN COACHING ACADEMY L.L.C–FZ
                <br />
                Business Center 1, Mezzanine Floor, The Meydan Hotel, Nad Al Sheba, Dubai, U.A.E.
              </LS>

              <LS t="16. Effective Date">
                This agreement is effective as of October 24, 2025, and supersedes any previous versions of the terms of use.
              </LS>
            </>
          )}
        </div>
      </Section>
    </main>
  );
}

function LSPreamble({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[var(--color-neutral-700)] leading-relaxed">{children}</div>
  );
}

function LS({ t, children }: { t: string; children: React.ReactNode }) {
  return <div><h2 className="text-lg font-bold text-[var(--text-primary)] mb-3">{t}</h2><div className="text-[var(--color-neutral-700)] leading-relaxed">{children}</div></div>;
}
