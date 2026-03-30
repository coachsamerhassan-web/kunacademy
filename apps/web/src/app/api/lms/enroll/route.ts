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

// POST /api/lms/enroll — self-enroll in a free course
export async function POST(request: NextRequest) {
  const user = await getUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { courseId } = await request.json();
  if (!courseId) return NextResponse.json({ error: 'courseId required' }, { status: 400 });

  // Verify the course exists, is published, and is free
  const { data: course, error: courseError } = await supabase
    .from('courses')
    .select('id, is_published, is_free, price_aed')
    .eq('id', courseId)
    .single();

  if (courseError || !course) {
    return NextResponse.json({ error: 'Course not found' }, { status: 404 });
  }

  if (!course.is_published) {
    return NextResponse.json({ error: 'Course not available' }, { status: 400 });
  }

  if (!course.is_free && (course.price_aed ?? 0) > 0) {
    return NextResponse.json({ error: 'Course requires payment' }, { status: 402 });
  }

  // Check if already enrolled
  const { data: existing } = await supabase
    .from('enrollments')
    .select('id, status')
    .eq('user_id', user.id)
    .eq('course_id', courseId)
    .single();

  if (existing) {
    return NextResponse.json({ enrollment: existing, message: 'Already enrolled' });
  }

  // Create enrollment
  const { data: enrollment, error: enrollError } = await supabase
    .from('enrollments')
    .insert({
      user_id: user.id,
      course_id: courseId,
      status: 'enrolled',
      enrollment_type: 'recorded',
    })
    .select()
    .single();

  if (enrollError) {
    return NextResponse.json({ error: enrollError.message }, { status: 500 });
  }

  return NextResponse.json({ enrollment }, { status: 201 });
}
