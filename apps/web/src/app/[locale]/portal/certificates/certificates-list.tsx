// @ts-nocheck — TODO: fix Supabase client types (types regenerated, needs 'as any' removal)
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@kunacademy/auth';
import { Button } from '@kunacademy/ui/button';
import { createBrowserClient } from '@kunacademy/db';

interface Certificate {
  id: string;
  credential_type: string | null;
  issued_at: string;
  pdf_url: string | null;
  verification_code: string;
  enrollment: {
    course: { title_ar: string; title_en: string } | null;
  } | null;
}

export function CertificatesList({ locale }: { locale: string }) {
  const { user, loading: authLoading } = useAuth();
  const [certs, setCerts] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<string | null>(null);
  const isAr = locale === 'ar';

  useEffect(() => {
    if (!user) return;
    const supabase = createBrowserClient();
    if (!supabase) return;

    supabase
      .from('certificates')
      .select('id, credential_type, issued_at, pdf_url, verification_code, enrollment:enrollments(course:courses(title_ar, title_en))')
      .eq('user_id', user.id)
      .order('issued_at', { ascending: false })
      .then(({ data }) => {
        setCerts((data || []) as Certificate[]);
        setLoading(false);
      });
  }, [user]);

  async function generatePdf(cert: Certificate) {
    setGenerating(cert.id);
    try {
      // Dynamic import jsPDF
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

      // Certificate design
      doc.setFillColor(71, 64, 153); // primary color
      doc.rect(0, 0, 297, 210, 'F');

      // White inner card
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(20, 20, 257, 170, 4, 4, 'F');

      // Title
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(28);
      doc.setTextColor(71, 64, 153);
      doc.text('Certificate of Completion', 148.5, 55, { align: 'center' });

      // Divider
      doc.setDrawColor(244, 126, 66); // accent
      doc.setLineWidth(1);
      doc.line(98.5, 62, 198.5, 62);

      // Student name
      doc.setFontSize(22);
      doc.setTextColor(44, 44, 45);
      const name = user?.user_metadata?.full_name || user?.email || '';
      doc.text(name, 148.5, 82, { align: 'center' });

      // Course name
      doc.setFontSize(14);
      doc.setTextColor(100, 100, 100);
      const courseName = isAr
        ? cert.enrollment?.course?.title_ar
        : cert.enrollment?.course?.title_en;
      doc.text(`For completing: ${courseName || 'Program'}`, 148.5, 98, { align: 'center' });

      // Date
      doc.setFontSize(10);
      doc.text(`Issued: ${new Date(cert.issued_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, 148.5, 112, { align: 'center' });

      // Verification code
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(`Verification: ${cert.verification_code}`, 148.5, 175, { align: 'center' });

      // Kun branding
      doc.setFontSize(12);
      doc.setTextColor(71, 64, 153);
      doc.text('KUN Coaching Academy', 148.5, 165, { align: 'center' });

      // Save
      doc.save(`kun-certificate-${cert.verification_code}.pdf`);
    } finally {
      setGenerating(null);
    }
  }

  if (authLoading || loading) {
    return <div className="py-8 text-center text-[var(--color-neutral-500)]">{isAr ? 'جاري التحميل...' : 'Loading...'}</div>;
  }

  if (certs.length === 0) {
    return (
      <div className="py-12 text-center mt-4">
        <p className="text-[var(--color-neutral-500)]">{isAr ? 'لا توجد شهادات بعد' : 'No certificates yet'}</p>
        <p className="text-sm text-[var(--color-neutral-400)] mt-1">
          {isAr ? 'أكمل برنامجًا للحصول على شهادتك' : 'Complete a program to earn your certificate'}
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-4">
      {certs.map((cert) => (
        <div key={cert.id} className="flex items-center gap-4 rounded-lg border border-[var(--color-neutral-200)] p-4">
          <div className="w-12 h-12 rounded-lg bg-[var(--color-primary)]/10 flex items-center justify-center flex-shrink-0">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[var(--color-primary)]">
              <path d="M12 15l-3 3m0 0l-3-3m3 3V9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">
              {isAr ? cert.enrollment?.course?.title_ar : cert.enrollment?.course?.title_en}
            </p>
            <p className="text-sm text-[var(--color-neutral-500)]">
              {new Date(cert.issued_at).toLocaleDateString(isAr ? 'ar-SA' : 'en-US')}
              {cert.credential_type && ` — ${cert.credential_type}`}
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => generatePdf(cert)}
            disabled={generating === cert.id}
          >
            {generating === cert.id ? (isAr ? 'جاري...' : 'Generating...') : (isAr ? 'تحميل PDF' : 'Download PDF')}
          </Button>
        </div>
      ))}
    </div>
  );
}
