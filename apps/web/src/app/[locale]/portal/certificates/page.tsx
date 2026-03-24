// @ts-nocheck
'use client';

import { useAuth } from '@kunacademy/auth';
import { useEffect, useState } from 'react';
import { createBrowserClient } from '@kunacademy/db';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';
import { Button } from '@kunacademy/ui/button';
import { useParams } from 'next/navigation';

interface Certificate {
  id: string;
  enrolled_at: string;
  completed_at: string;
  course: { id: string; title_ar: string; title_en: string; is_icf_accredited: boolean; duration_hours: number | null };
}

export default function MyCertificates() {
  const { locale } = useParams<{ locale: string }>();
  const { user, profile, loading: authLoading } = useAuth();
  const [certs, setCerts] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const isAr = locale === 'ar';

  useEffect(() => {
    if (!user) return;
    const supabase = createBrowserClient() as any;
    supabase
      .from('enrollments')
      .select('id, enrolled_at, completed_at, course:courses(id, title_ar, title_en, is_icf_accredited, duration_hours)')
      .eq('user_id', user.id)
      .not('completed_at', 'is', null)
      .order('completed_at', { ascending: false })
      .then(({ data }) => {
        setCerts((data as unknown as Certificate[]) ?? []);
        setLoading(false);
      });
  }, [user]);

  async function downloadCertificate(cert: Certificate) {
    // Dynamic import of jsPDF to keep bundle small
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

    const width = doc.internal.pageSize.getWidth();
    const height = doc.internal.pageSize.getHeight();

    // Background
    doc.setFillColor(249, 247, 243); // cream background
    doc.rect(0, 0, width, height, 'F');

    // Border
    doc.setDrawColor(71, 64, 153); // primary color
    doc.setLineWidth(2);
    doc.rect(10, 10, width - 20, height - 20);

    // Title
    doc.setFontSize(28);
    doc.setTextColor(71, 64, 153);
    doc.text(isAr ? 'شهادة إتمام' : 'Certificate of Completion', width / 2, 50, { align: 'center' });

    // Subtitle
    doc.setFontSize(14);
    doc.setTextColor(100, 100, 100);
    doc.text(isAr ? 'أكاديمية كُن للكوتشينج' : 'Kun Coaching Academy', width / 2, 62, { align: 'center' });

    // Student name
    doc.setFontSize(22);
    doc.setTextColor(33, 33, 33);
    const name = (isAr ? (profile?.full_name_ar as string) : (profile?.full_name_en as string)) || user?.email || '';
    doc.text(name, width / 2, 90, { align: 'center' });

    // Course name
    doc.setFontSize(16);
    doc.setTextColor(71, 64, 153);
    const courseName = isAr ? cert.course.title_ar : cert.course.title_en;
    doc.text(courseName, width / 2, 110, { align: 'center' });

    // Details
    doc.setFontSize(11);
    doc.setTextColor(100, 100, 100);
    const completedDate = new Date(cert.completed_at).toLocaleDateString(isAr ? 'ar-AE' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    doc.text(`${isAr ? 'تاريخ الإتمام:' : 'Date:'} ${completedDate}`, width / 2, 130, { align: 'center' });

    if (cert.course.duration_hours) {
      doc.text(`${cert.course.duration_hours} ${isAr ? 'ساعة تدريب' : 'training hours'}`, width / 2, 138, { align: 'center' });
    }
    if (cert.course.is_icf_accredited) {
      doc.text(isAr ? 'معتمد من ICF' : 'ICF Accredited', width / 2, 146, { align: 'center' });
    }

    // Certificate ID
    doc.setFontSize(8);
    doc.text(`ID: ${cert.id.slice(0, 8).toUpperCase()}`, width / 2, height - 20, { align: 'center' });

    doc.save(`kun-certificate-${cert.id.slice(0, 8)}.pdf`);
  }

  if (authLoading || loading) return <Section><p className="text-center py-12">{isAr ? 'جاري التحميل...' : 'Loading...'}</p></Section>;

  return (
    <main>
      <Section variant="white">
        <Heading level={1}>{isAr ? 'شهاداتي' : 'My Certificates'}</Heading>
        {certs.length === 0 ? (
          <div className="mt-8 text-center py-12 rounded-lg border-2 border-dashed border-[var(--color-neutral-200)]">
            <p className="text-[var(--color-neutral-500)]">{isAr ? 'لا توجد شهادات بعد. أكمل برنامجًا للحصول على شهادتك.' : 'No certificates yet. Complete a program to earn yours.'}</p>
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            {certs.map((c) => (
              <div key={c.id} className="rounded-lg border border-[var(--color-neutral-200)] p-6">
                <div className="text-2xl mb-2">🎓</div>
                <h3 className="font-bold">{isAr ? c.course.title_ar : c.course.title_en}</h3>
                <p className="text-sm text-[var(--color-neutral-500)] mt-1">
                  {new Date(c.completed_at).toLocaleDateString(isAr ? 'ar-AE' : 'en-US', { year: 'numeric', month: 'long' })}
                </p>
                {c.course.is_icf_accredited && <span className="inline-block mt-2 px-2 py-0.5 bg-green-100 text-green-800 rounded text-xs">ICF</span>}
                <Button variant="secondary" size="sm" className="mt-4 w-full" onClick={() => downloadCertificate(c)}>
                  {isAr ? 'تحميل الشهادة (PDF)' : 'Download Certificate (PDF)'}
                </Button>
              </div>
            ))}
          </div>
        )}
      </Section>
    </main>
  );
}
