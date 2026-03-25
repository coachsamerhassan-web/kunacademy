// @ts-nocheck — Supabase types resolve to `never` for community tables. Fix with: supabase gen types
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@kunacademy/db';

/**
 * Community Boards API
 * GET — list boards visible to the user
 * POST — create a cohort board (admin only) and auto-add enrolled students
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = createAdminClient();
    const authHeader = req.headers.get('authorization');

    // Try to get user for filtered results
    let userId: string | null = null;
    if (authHeader?.startsWith('Bearer ')) {
      const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
      userId = user?.id || null;
    }

    // Get general + announcement boards (visible to all)
    const { data: publicBoards } = await supabase
      .from('community_boards')
      .select('id, slug, name_ar, name_en, description_ar, description_en, type, is_admin_only, created_at')
      .in('type', ['general', 'announcements'])
      .order('created_at', { ascending: true });

    // Get cohort boards for this user
    let cohortBoards: any[] = [];
    if (userId) {
      const { data } = await supabase
        .from('board_members')
        .select('board:community_boards(id, slug, name_ar, name_en, description_ar, description_en, type, course_id, created_at)')
        .eq('user_id', userId);
      cohortBoards = (data || []).map((bm: any) => bm.board).filter(Boolean);
    }

    return NextResponse.json({
      boards: [...(publicBoards || []), ...cohortBoards],
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

/**
 * POST — Auto-create a cohort board for a course.
 * Body: { course_id, name_ar?, name_en? }
 *
 * Creates the board and automatically adds all enrolled students as members.
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = createAdminClient();

    // Verify admin
    const authHeader = req.headers.get('authorization');
    if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 });
    }

    const body = await req.json();
    const { course_id, name_ar, name_en } = body;

    if (!course_id) {
      return NextResponse.json({ error: 'course_id required' }, { status: 400 });
    }

    // Check if cohort board already exists for this course
    const { data: existing } = await supabase
      .from('community_boards')
      .select('id')
      .eq('course_id', course_id)
      .eq('type', 'cohort')
      .single();

    if (existing) {
      return NextResponse.json({
        error: 'Cohort board already exists for this course',
        board_id: existing.id,
      }, { status: 409 });
    }

    // Get course info for default naming
    const { data: course } = await supabase
      .from('courses')
      .select('name_ar, name_en, slug')
      .eq('id', course_id)
      .single();

    if (!course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    // Create the board
    const slug = `cohort-${course.slug}-${Date.now().toString(36)}`;
    const { data: board, error: boardErr } = await supabase
      .from('community_boards')
      .insert({
        slug,
        name_ar: name_ar || `مجموعة ${course.name_ar}`,
        name_en: name_en || `${course.name_en} Cohort`,
        description_ar: `مساحة خاصة لطلاب ${course.name_ar}`,
        description_en: `Private space for ${course.name_en} students`,
        type: 'cohort',
        course_id,
        is_admin_only: false,
      })
      .select('id, slug')
      .single();

    if (boardErr) throw boardErr;

    // Auto-add all enrolled students as board members
    const { data: enrollments } = await supabase
      .from('enrollments')
      .select('user_id')
      .eq('course_id', course_id)
      .in('status', ['active', 'completed']);

    if (enrollments?.length) {
      const members = enrollments.map((e) => ({
        board_id: board!.id,
        user_id: e.user_id,
        role: 'member' as const,
      }));

      const { error: memberErr } = await supabase
        .from('board_members')
        .upsert(members, { onConflict: 'board_id,user_id' });

      if (memberErr) {
        console.error('[community/boards] Member insert error:', memberErr);
      }
    }

    return NextResponse.json({
      board_id: board!.id,
      slug: board!.slug,
      members_added: enrollments?.length || 0,
    }, { status: 201 });
  } catch (e) {
    console.error('[community/boards]', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
