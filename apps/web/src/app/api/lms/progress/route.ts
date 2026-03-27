// @ts-nocheck — TODO: fix Supabase client types (types regenerated, needs 'as any' removal)
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

// GET /api/lms/progress?courseId=xxx — get all lesson progress for a course
export async function GET(request: NextRequest) {
  const user = await getUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const courseId = request.nextUrl.searchParams.get('courseId');
  if (!courseId) return NextResponse.json({ error: 'courseId required' }, { status: 400 });

  // Verify enrollment
  const { data: enrollment } = await supabase
    .from('enrollments')
    .select('id, status')
    .eq('user_id', user.id)
    .eq('course_id', courseId)
    .in('status', ['enrolled', 'in_progress', 'completed'])
    .single();

  if (!enrollment) {
    return NextResponse.json({ error: 'Not enrolled' }, { status: 403 });
  }

  // Get all lesson IDs for this course
  const { data: lessons } = await supabase
    .from('lessons')
    .select('id')
    .eq('course_id', courseId);

  if (!lessons?.length) {
    return NextResponse.json({ progress: [], enrollment });
  }

  const lessonIds = lessons.map((l: { id: string }) => l.id);

  // Get progress for all lessons
  const { data: progress } = await supabase
    .from('lesson_progress')
    .select('*')
    .eq('user_id', user.id)
    .in('lesson_id', lessonIds);

  return NextResponse.json({ progress: progress ?? [], enrollment });
}

// POST /api/lms/progress — update lesson progress
export async function POST(request: NextRequest) {
  const user = await getUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { lessonId, courseId, playbackPosition, completed } = body;

  if (!lessonId || !courseId) {
    return NextResponse.json({ error: 'lessonId and courseId required' }, { status: 400 });
  }

  // Verify enrollment
  const { data: enrollment } = await supabase
    .from('enrollments')
    .select('id, status')
    .eq('user_id', user.id)
    .eq('course_id', courseId)
    .in('status', ['enrolled', 'in_progress', 'completed'])
    .single();

  if (!enrollment) {
    return NextResponse.json({ error: 'Not enrolled' }, { status: 403 });
  }

  // Update enrollment status to in_progress if still 'enrolled'
  if (enrollment.status === 'enrolled') {
    await supabase
      .from('enrollments')
      .update({ status: 'in_progress' })
      .eq('id', enrollment.id);
  }

  // Upsert lesson progress
  const updateData: Record<string, unknown> = {
    user_id: user.id,
    lesson_id: lessonId,
    updated_at: new Date().toISOString(),
  };

  if (typeof playbackPosition === 'number') {
    updateData.playback_position_seconds = Math.floor(playbackPosition);
  }

  if (completed === true) {
    updateData.completed = true;
    updateData.completed_at = new Date().toISOString();
  }

  const { data: progress, error } = await supabase
    .from('lesson_progress')
    .upsert(updateData, { onConflict: 'user_id,lesson_id' })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Check if ALL lessons are completed → mark enrollment as completed
  if (completed) {
    const { data: allLessons } = await supabase
      .from('lessons')
      .select('id')
      .eq('course_id', courseId);

    const { data: completedLessons } = await supabase
      .from('lesson_progress')
      .select('lesson_id')
      .eq('user_id', user.id)
      .eq('completed', true)
      .in('lesson_id', (allLessons ?? []).map((l: { id: string }) => l.id));

    if (allLessons && completedLessons && completedLessons.length >= allLessons.length) {
      await supabase
        .from('enrollments')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', enrollment.id);

      // Auto-generate certificate
      const { data: existingCert } = await supabase
        .from('certificates')
        .select('id')
        .eq('enrollment_id', enrollment.id)
        .single();

      if (!existingCert) {
        await supabase.from('certificates').insert({
          user_id: user.id,
          enrollment_id: enrollment.id,
          credential_type: 'completion',
          issued_at: new Date().toISOString(),
        });
      }
    }
  }

  return NextResponse.json({ progress });
}
