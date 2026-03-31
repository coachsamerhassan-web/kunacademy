import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@kunacademy/db';
import { jsPDF } from 'jspdf';

// POST /api/certificates/generate
// Body: { certificate_id: string }
// Auth: Bearer token required
export async function POST(request: NextRequest) {
  try {
    const supabase = createAdminClient();

    // --- Auth check ---
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const token = authHeader.slice(7);
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { certificate_id } = body as { certificate_id?: string };

    if (!certificate_id) {
      return NextResponse.json({ error: 'certificate_id required' }, { status: 400 });
    }

    // --- Fetch certificate ---
    const { data: cert, error: certErr } = await supabase
      .from('certificates')
      .select('id, user_id, enrollment_id, verification_code, issued_at, pdf_url, credential_type')
      .eq('id', certificate_id)
      .single();

    if (certErr || !cert) {
      return NextResponse.json({ error: 'Certificate not found' }, { status: 404 });
    }

    // --- Authorization: must own the certificate or be admin ---
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin';

    if (cert.user_id !== user.id && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // --- Fetch user profile for name ---
    const { data: ownerProfile } = await supabase
      .from('profiles')
      .select('full_name, full_name_ar')
      .eq('id', cert.user_id)
      .single() as unknown as { data: { full_name?: string; full_name_ar?: string } | null };

    const recipientName = ownerProfile?.full_name || ownerProfile?.full_name_ar || 'Participant';

    // --- Fetch course name via enrollment ---
    let courseTitle = 'Coaching Program';
    if (cert.enrollment_id) {
      const { data: enrollment } = await supabase
        .from('enrollments')
        .select('course_id')
        .eq('id', cert.enrollment_id)
        .single();

      if (enrollment?.course_id) {
        const { data: course } = await supabase
          .from('courses')
          .select('title_en, title_ar')
          .eq('id', enrollment.course_id)
          .single();

        courseTitle = course?.title_en || course?.title_ar || courseTitle;
      }
    }

    // --- Generate PDF ---
    const pdfBytes = generateCertificatePDF({
      recipientName,
      courseTitle,
      issuedAt: cert.issued_at ?? new Date().toISOString(),
      verificationCode: cert.verification_code ?? '',
    });

    // --- Upload to Supabase Storage ---
    const fileName = `cert_${certificate_id}.pdf`;
    const { error: uploadError } = await supabase.storage
      .from('certificates')
      .upload(fileName, pdfBytes, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (uploadError) {
      // Attempt to create bucket if it doesn't exist, then retry
      if (uploadError.message?.includes('not found') || uploadError.message?.includes('does not exist')) {
        await supabase.storage.createBucket('certificates', {
          public: true,
          fileSizeLimit: 10 * 1024 * 1024, // 10MB
        });

        const { error: retryError } = await supabase.storage
          .from('certificates')
          .upload(fileName, pdfBytes, {
            contentType: 'application/pdf',
            upsert: true,
          });

        if (retryError) {
          console.error('[cert-generate] Storage upload failed after bucket create:', retryError);
          return NextResponse.json({ error: 'Failed to store PDF' }, { status: 500 });
        }
      } else {
        console.error('[cert-generate] Storage upload failed:', uploadError);
        return NextResponse.json({ error: 'Failed to store PDF' }, { status: 500 });
      }
    }

    // --- Get public URL ---
    const { data: urlData } = supabase.storage
      .from('certificates')
      .getPublicUrl(fileName);

    const pdfUrl = urlData.publicUrl;

    // --- Update certificate record ---
    await supabase
      .from('certificates')
      .update({ pdf_url: pdfUrl })
      .eq('id', certificate_id);

    return NextResponse.json({ pdf_url: pdfUrl });
  } catch (err) {
    console.error('[cert-generate] Unhandled error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

interface CertData {
  recipientName: string;
  courseTitle: string;
  issuedAt: string;
  verificationCode: string;
}

function generateCertificatePDF(data: CertData): Uint8Array {
  const { recipientName, courseTitle, issuedAt, verificationCode } = data;

  // Landscape A4: 297mm x 210mm
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const W = 297;
  const H = 210;

  // --- Background: warm cream ---
  doc.setFillColor(255, 245, 233); // #FFF5E9
  doc.rect(0, 0, W, H, 'F');

  // --- Outer decorative border (primary #474099) ---
  doc.setDrawColor(71, 64, 153); // #474099
  doc.setLineWidth(2.5);
  doc.rect(8, 8, W - 16, H - 16);

  // --- Inner border (thinner, same color) ---
  doc.setLineWidth(0.8);
  doc.rect(12, 12, W - 24, H - 24);

  // --- Header: Academy name ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(71, 64, 153); // primary
  doc.text('Kun Coaching Academy', W / 2, 38, { align: 'center' });

  // Arabic subtitle below (using standard helvetica — no Arabic font needed for simple text)
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  doc.setTextColor(100, 100, 100);
  doc.text('كُن أكاديمية كوتشينج', W / 2, 47, { align: 'center' });

  // --- Divider line ---
  doc.setDrawColor(71, 64, 153);
  doc.setLineWidth(0.5);
  doc.line(40, 53, W - 40, 53);

  // --- "Certificate of Completion" title ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(50, 50, 50);
  doc.text('Certificate of Completion', W / 2, 68, { align: 'center' });

  // --- Body text ---
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  doc.setTextColor(80, 80, 80);
  doc.text('This certifies that', W / 2, 82, { align: 'center' });

  // --- Recipient name (prominent) ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(24);
  doc.setTextColor(71, 64, 153);
  doc.text(recipientName, W / 2, 98, { align: 'center' });

  // --- Underline name ---
  const nameWidth = doc.getTextWidth(recipientName);
  doc.setDrawColor(71, 64, 153);
  doc.setLineWidth(0.4);
  doc.line(W / 2 - nameWidth / 2, 101, W / 2 + nameWidth / 2, 101);

  // --- Course completion text ---
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  doc.setTextColor(80, 80, 80);
  doc.text('has successfully completed', W / 2, 113, { align: 'center' });

  // --- Course name ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(50, 50, 50);
  doc.text(courseTitle, W / 2, 125, { align: 'center' });

  // --- Completion date ---
  const completionDate = new Date(issuedAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(100, 100, 100);
  doc.text(`Issued on ${completionDate}`, W / 2, 140, { align: 'center' });

  // --- Divider ---
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(40, 152, W - 40, 152);

  // --- Verification code ---
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(130, 130, 130);
  doc.text(`Verification Code: ${verificationCode}`, W / 2, 161, { align: 'center' });

  // --- Verify URL footer ---
  doc.setFontSize(9);
  doc.setTextColor(71, 64, 153);
  doc.text(
    `Verify at: kunacademy.com/verify/${verificationCode}`,
    W / 2,
    169,
    { align: 'center' }
  );

  // --- Seal placeholder (circle) ---
  doc.setDrawColor(71, 64, 153);
  doc.setFillColor(71, 64, 153);
  doc.circle(W - 35, H - 35, 12, 'S');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(71, 64, 153);
  doc.text('KUN', W - 35, H - 33, { align: 'center' });
  doc.text('ACADEMY', W - 35, H - 29, { align: 'center' });

  return doc.output('arraybuffer') as unknown as Uint8Array;
}
