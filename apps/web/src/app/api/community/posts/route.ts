import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@kunacademy/db';

/**
 * Community Posts API
 * GET — list posts for a board (with replies and reactions)
 * POST — create a new post or reply
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = createAdminClient();
    const { searchParams } = new URL(req.url);
    const boardId = searchParams.get('board_id');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = 20;

    if (!boardId) {
      return NextResponse.json({ error: 'board_id required' }, { status: 400 });
    }

    // Get top-level posts (not replies)
    const { data: posts, error, count } = await supabase
      .from('community_posts')
      .select(`
        id, content, is_pinned, created_at, updated_at,
        author:profiles!community_posts_author_id_fkey(id, full_name, avatar_url, role),
        reactions:community_reactions(id, reaction, user_id)
      `, { count: 'exact' })
      .eq('board_id', boardId)
      .is('parent_id', null)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    if (error) throw error;

    // Get reply counts for each post
    const postIds = (posts || []).map((p) => p.id);
    let replyCounts: Record<string, number> = {};
    if (postIds.length) {
      const { data: counts } = await supabase
        .from('community_posts')
        .select('parent_id')
        .in('parent_id', postIds);

      for (const c of counts || []) {
        if (c.parent_id) {
          replyCounts[c.parent_id] = (replyCounts[c.parent_id] || 0) + 1;
        }
      }
    }

    const enrichedPosts = (posts || []).map((p) => ({
      ...p,
      reply_count: replyCounts[p.id] || 0,
      reaction_summary: summarizeReactions(p.reactions || []),
    }));

    return NextResponse.json({
      posts: enrichedPosts,
      total: count || 0,
      page,
      has_more: (count || 0) > page * limit,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createAdminClient();
    const authHeader = req.headers.get('authorization');
    if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { board_id, content, parent_id } = body;

    if (!board_id || !content?.trim()) {
      return NextResponse.json({ error: 'board_id and content required' }, { status: 400 });
    }

    const { data: post, error } = await supabase
      .from('community_posts')
      .insert({
        board_id,
        author_id: user.id,
        content: content.trim(),
        parent_id: parent_id || null,
      })
      .select('id, content, created_at')
      .single();

    if (error) throw error;

    return NextResponse.json({ post }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

function summarizeReactions(reactions: Array<{ reaction: string; user_id: string }>) {
  const summary: Record<string, number> = {};
  for (const r of reactions) {
    summary[r.reaction] = (summary[r.reaction] || 0) + 1;
  }
  return summary;
}
