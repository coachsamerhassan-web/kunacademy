// @ts-nocheck
'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@kunacademy/auth';
import { Button } from '@kunacademy/ui/button';
import { createBrowserClient } from '@kunacademy/db';

interface Post {
  id: string;
  content: string;
  is_pinned: boolean;
  created_at: string;
  author: { full_name_ar: string | null; full_name_en: string | null; avatar_url: string | null } | null;
  replies?: Post[];
  reaction_counts?: Record<string, number>;
}

export function BoardDetail({ locale, boardId }: { locale: string; boardId: string }) {
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [boardName, setBoardName] = useState('');
  const [loading, setLoading] = useState(true);
  const [newPost, setNewPost] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [posting, setPosting] = useState(false);
  const isAr = locale === 'ar';
  const supabaseRef = useRef(createBrowserClient());

  useEffect(() => {
    const supabase = supabaseRef.current;
    if (!supabase) return;

    // Load board info
    supabase.from('community_boards').select('name_ar, name_en').eq('id', boardId).single()
      .then(({ data }) => { if (data) setBoardName(isAr ? data.name_ar : data.name_en); });

    // Load posts
    loadPosts();

    // Realtime subscription
    const channel = supabase.channel(`board-${boardId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'community_posts',
        filter: `board_id=eq.${boardId}`,
      }, () => { loadPosts(); })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [boardId]);

  async function loadPosts() {
    const supabase = supabaseRef.current;
    if (!supabase) return;

    const { data } = await supabase
      .from('community_posts')
      .select('id, content, is_pinned, created_at, parent_id, author:profiles(full_name_ar, full_name_en, avatar_url)')
      .eq('board_id', boardId)
      .is('parent_id', null)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(50);

    if (data) {
      // Load replies for each post
      const postIds = data.map(p => p.id);
      const { data: replies } = await supabase
        .from('community_posts')
        .select('id, content, created_at, parent_id, author:profiles(full_name_ar, full_name_en, avatar_url)')
        .in('parent_id', postIds)
        .order('created_at');

      const postsWithReplies = data.map(post => ({
        ...post,
        replies: (replies || []).filter(r => r.parent_id === post.id),
      }));

      setPosts(postsWithReplies as Post[]);
    }
    setLoading(false);
  }

  async function handlePost() {
    if (!newPost.trim() || !user) return;
    setPosting(true);
    const supabase = supabaseRef.current;
    if (!supabase) return;

    await supabase.from('community_posts').insert({
      board_id: boardId,
      author_id: user.id,
      content: newPost.trim(),
    });

    setNewPost('');
    setPosting(false);
  }

  async function handleReply(parentId: string) {
    if (!replyContent.trim() || !user) return;
    setPosting(true);
    const supabase = supabaseRef.current;
    if (!supabase) return;

    await supabase.from('community_posts').insert({
      board_id: boardId,
      author_id: user.id,
      parent_id: parentId,
      content: replyContent.trim(),
    });

    setReplyContent('');
    setReplyTo(null);
    setPosting(false);
    loadPosts();
  }

  async function handleReaction(postId: string, emoji: string) {
    if (!user) return;
    const supabase = supabaseRef.current;
    if (!supabase) return;
    await supabase.from('community_reactions').upsert({
      post_id: postId,
      user_id: user.id,
      reaction: emoji,
    }, { onConflict: 'post_id,user_id,reaction' });
  }

  if (loading) return <div className="py-8 text-center text-[var(--color-neutral-500)]">{isAr ? 'جاري التحميل...' : 'Loading...'}</div>;

  return (
    <div>
      <a href={`/${locale}/community/boards`} className="text-sm text-[var(--color-primary)] hover:underline">
        {isAr ? '← العودة للمنتديات' : '← Back to boards'}
      </a>
      <h1 className="text-xl font-bold mt-2 mb-6">{boardName}</h1>

      {/* New post form */}
      {user && (
        <div className="mb-6">
          <textarea
            value={newPost}
            onChange={(e) => setNewPost(e.target.value)}
            placeholder={isAr ? 'شارك أفكارك...' : 'Share your thoughts...'}
            rows={3}
            className="block w-full rounded-lg border border-[var(--color-neutral-300)] px-4 py-3 focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-opacity-20"
          />
          <Button variant="primary" size="sm" className="mt-2" onClick={handlePost} disabled={posting || !newPost.trim()}>
            {posting ? (isAr ? 'جاري النشر...' : 'Posting...') : (isAr ? 'نشر' : 'Post')}
          </Button>
        </div>
      )}

      {/* Posts */}
      <div className="space-y-4">
        {posts.map(post => (
          <div key={post.id} className={`rounded-lg border p-4 ${post.is_pinned ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5' : 'border-[var(--color-neutral-200)]'}`}>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-full bg-[var(--color-neutral-200)] overflow-hidden">
                {post.author?.avatar_url ? <img src={post.author.avatar_url} alt="" className="w-full h-full object-cover" /> :
                  <div className="w-full h-full flex items-center justify-center text-xs">{(post.author?.full_name_en || '?')[0]}</div>}
              </div>
              <span className="font-medium text-sm">{isAr ? post.author?.full_name_ar : post.author?.full_name_en}</span>
              {post.is_pinned && <span className="text-xs text-[var(--color-primary)] font-medium">{isAr ? 'مثبّت' : 'Pinned'}</span>}
              <span className="text-xs text-[var(--color-neutral-400)] ml-auto">{new Date(post.created_at).toLocaleDateString(isAr ? 'ar-SA' : 'en-US')}</span>
            </div>
            <p className="text-sm text-[var(--color-neutral-700)] whitespace-pre-wrap">{post.content}</p>

            {/* Reactions */}
            <div className="flex items-center gap-2 mt-3">
              {['❤️', '🤲', '💡'].map(emoji => (
                <button key={emoji} type="button" onClick={() => handleReaction(post.id, emoji)}
                  className="text-sm hover:bg-[var(--color-neutral-100)] rounded px-1 min-h-[32px]">{emoji}</button>
              ))}
              <button type="button" onClick={() => setReplyTo(replyTo === post.id ? null : post.id)}
                className="text-xs text-[var(--color-primary)] hover:underline min-h-[32px] px-2">
                {isAr ? 'رد' : 'Reply'}
              </button>
            </div>

            {/* Reply form */}
            {replyTo === post.id && user && (
              <div className="mt-3 flex gap-2">
                <input
                  type="text"
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                  placeholder={isAr ? 'اكتب ردًا...' : 'Write a reply...'}
                  className="flex-1 rounded-lg border border-[var(--color-neutral-300)] px-3 py-2 text-sm min-h-[44px]"
                  onKeyDown={(e) => { if (e.key === 'Enter') handleReply(post.id); }}
                />
                <Button variant="primary" size="sm" onClick={() => handleReply(post.id)} disabled={posting}>
                  {isAr ? 'إرسال' : 'Send'}
                </Button>
              </div>
            )}

            {/* Replies */}
            {post.replies && post.replies.length > 0 && (
              <div className="mt-3 space-y-2 border-s-2 border-[var(--color-neutral-200)] ps-3">
                {post.replies.map(reply => (
                  <div key={reply.id} className="text-sm">
                    <span className="font-medium">{isAr ? reply.author?.full_name_ar : reply.author?.full_name_en}</span>
                    <span className="text-[var(--color-neutral-400)] mx-1">·</span>
                    <span className="text-xs text-[var(--color-neutral-400)]">{new Date(reply.created_at).toLocaleDateString(isAr ? 'ar-SA' : 'en-US')}</span>
                    <p className="text-[var(--color-neutral-600)] mt-0.5">{reply.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
