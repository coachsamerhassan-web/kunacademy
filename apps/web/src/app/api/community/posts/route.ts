import { NextRequest, NextResponse } from 'next/server';
import { db, withAdminContext } from '@kunacademy/db';
import { getAuthUser } from '@kunacademy/auth/server';
import {
  community_posts,
  community_reactions,
} from '@kunacademy/db/schema';
import { eq, isNull, inArray, desc, sql } from 'drizzle-orm';
import { profiles } from '@kunacademy/db/schema';

/**
 * Community Posts API
 * GET — list posts for a board (with replies and reactions)
 * POST — create a new post or reply
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const boardId = searchParams.get('board_id');
    const pageRaw = parseInt(searchParams.get('page') || '1');
    const page = Math.min(1000, Math.max(1, Number.isFinite(pageRaw) ? pageRaw : 1));
    const limit = 20;
    const offset = (page - 1) * limit;

    if (!boardId) {
      return NextResponse.json({ error: 'board_id required' }, { status: 400 });
    }

    // Get top-level posts (not replies) with author and reactions
    const postsRaw = await db
      .select({
        id: community_posts.id,
        content: community_posts.content,
        is_pinned: community_posts.is_pinned,
        created_at: community_posts.created_at,
        updated_at: community_posts.updated_at,
        author_id: community_posts.author_id,
        author_full_name_ar: profiles.full_name_ar,
        author_full_name_en: profiles.full_name_en,
        author_avatar_url: profiles.avatar_url,
        author_role: profiles.role,
      })
      .from(community_posts)
      .leftJoin(profiles, eq(community_posts.author_id, profiles.id))
      .where(
        sql`${community_posts.board_id} = ${boardId} AND ${community_posts.parent_id} IS NULL`
      )
      .orderBy(desc(community_posts.is_pinned), desc(community_posts.created_at))
      .limit(limit)
      .offset(offset);

    // Count total top-level posts for pagination
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(community_posts)
      .where(
        sql`${community_posts.board_id} = ${boardId} AND ${community_posts.parent_id} IS NULL`
      );
    const total = Number(countResult[0]?.count ?? 0);

    // Get reply counts for each post
    const postIds = postsRaw.map((p) => p.id);
    let replyCounts: Record<string, number> = {};
    if (postIds.length) {
      const repliesRaw = await db
        .select({ parent_id: community_posts.parent_id })
        .from(community_posts)
        .where(inArray(community_posts.parent_id, postIds));

      for (const r of repliesRaw) {
        if (r.parent_id) {
          replyCounts[r.parent_id] = (replyCounts[r.parent_id] || 0) + 1;
        }
      }
    }

    // Get reactions for each post
    let reactionsByPost: Record<string, Array<{ reaction: string; user_id: string }>> = {};
    if (postIds.length) {
      const reactionsRaw = await db
        .select({
          post_id: community_reactions.post_id,
          reaction: community_reactions.reaction,
          user_id: community_reactions.user_id,
        })
        .from(community_reactions)
        .where(inArray(community_reactions.post_id, postIds));

      for (const r of reactionsRaw) {
        if (!reactionsByPost[r.post_id]) reactionsByPost[r.post_id] = [];
        reactionsByPost[r.post_id].push({ reaction: r.reaction, user_id: r.user_id });
      }
    }

    const enrichedPosts = postsRaw.map((p) => ({
      id: p.id,
      content: p.content,
      is_pinned: p.is_pinned,
      created_at: p.created_at,
      updated_at: p.updated_at,
      author: {
        id: p.author_id,
        full_name: p.author_full_name_en,
        avatar_url: p.author_avatar_url,
        role: p.author_role,
      },
      reply_count: replyCounts[p.id] || 0,
      reaction_summary: summarizeReactions(reactionsByPost[p.id] || []),
    }));

    return NextResponse.json({
      posts: enrichedPosts,
      total,
      page,
      has_more: total > page * limit,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { board_id, content, parent_id } = body;

    if (!board_id || !content?.trim()) {
      return NextResponse.json({ error: 'board_id and content required' }, { status: 400 });
    }

    const [post] = await db
      .insert(community_posts)
      .values({
        board_id,
        author_id: user.id,
        content: content.trim(),
        parent_id: parent_id || null,
      })
      .returning({
        id: community_posts.id,
        content: community_posts.content,
        created_at: community_posts.created_at,
      });

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
