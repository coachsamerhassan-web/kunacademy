// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@kunacademy/db';

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getUser(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  const { data: { user } } = await supabase.auth.getUser(token);
  return user;
}

// GET /api/lms/certificate?enrollmentId=xxx — get certificate for an enrollment
export async function GET(request: NextRequest) {
  const user = await getUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const enrollmentId = request.nextUrl.searchParams.get('enrollmentId');
  if (!enrollmentId) return NextResponse.json({ error: 'enrollmentId required' }, { status: 400 });

  // Check enrollment belongs to user and is completed
  const { data: enrollment } = await supabase
    .from('enrollments')
    .select('id, user_id, course_id, status, completed_at')
    .eq('id', enrollmentId)
    .single();

  if (!enrollment || enrollment.user_id !== user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (enrollment.status !== 'completed') {
    return NextResponse.json({ error: 'Course not completed' }, { status: 400 });
  }

  // Check if certificate already exists
  let { data: certificate } = await supabase
    .from('certificates')
    .select('*')
    .eq('enrollment_id', enrollmentId)
    .single();

  if (!certificate) {
    // Create certificate
    const { data: newCert, error } = await supabase
      .from('certificates')
      .insert({
        user_id: user.id,
        enrollment_id: enrollmentId,
        credential_type: 'completion',
        issued_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    certificate = newCert;
  }

  // Get course + user info for certificate display
  const [{ data: course }, { data: profile }] = await Promise.all([
    supabase.from('courses').select('title_ar, title_en, duration_hours').eq('id', enrollment.course_id).single(),
    supabase.from('profiles').select('full_name_ar, full_name_en, email').eq('id', user.id).single(),
  ]);

  return NextResponse.json({
    certificate,
    course,
    profile,
    enrollment: { completed_at: enrollment.completed_at },
  });
}

// POST /api/lms/certificate/verify — public verification
export async function POST(request: NextRequest) {
  const { code } = await request.json();
  if (!code) return NextResponse.json({ error: 'code required' }, { status: 400 });

  const { data: certificate } = await supabase
    .from('certificates')
    .select('*, enrollments(course_id, completed_at), profiles(full_name_ar, full_name_en)')
    .eq('verification_code', code)
    .single();

  if (!certificate) {
    return NextResponse.json({ valid: false });
  }

  const enrollment = (certificate as any).enrollments;
  const profile = (certificate as any).profiles;

  let courseName = null;
  if (enrollment?.course_id) {
    const { data: course } = await supabase
      .from('courses')
      .select('title_ar, title_en')
      .eq('id', enrollment.course_id)
      .single();
    courseName = course;
  }

  return NextResponse.json({
    valid: true,
    name_ar: profile?.full_name_ar,
    name_en: profile?.full_name_en,
    course_ar: courseName?.title_ar,
    course_en: courseName?.title_en,
    issued_at: certificate.issued_at,
    verification_code: certificate.verification_code,
  });
}
