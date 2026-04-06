'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@kunacademy/auth';
import { Button } from '@kunacademy/ui/button';
import { ArrowLeft } from 'lucide-react';

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
  const { user, session } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [boardName, setBoardName] = useState('');
  const [loading, setLoading] = useState(true);
  const [newPost, setNewPost] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [posting, setPosting] = useState(false);
  const isAr = locale === 'ar';
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load board info on mount
  useEffect(() => {
    fetch(`/api/community/boards?boardId=${boardId}`)
      .then((r) => r.json())
      .then((data) => {
        const board = data.boards?.find((b: { id: string; name_ar: string; name_en: string }) => b.id === boardId);
        if (board) setBoardName(isAr ? board.name_ar : board.name_en);
      })
      .catch(() => {});
  }, [boardId, isAr]);

  // Load posts initially and set up polling every 8 seconds
  // Note: replaces Supabase realtime subscription per Wave 6.75d plan
  useEffect(() => {
    loadPosts();

    pollIntervalRef.current = setInterval(() => {
      loadPosts();
    }, 8000);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [boardId]);

  async function loadPosts() {
    try {
      const res = await fetch(`/api/community/posts?board_id=${boardId}&page=1`);
      if (!res.ok) return;
      const data = await res.json();

      if (data.posts) {
        // Load replies for each top-level post
        const postIds = data.posts.map((p: Post) => p.id);
        const repliesRes = await fetch(`/api/community/posts/replies?post_ids=${postIds.join(',')}`);
        let replies: Post[] = [];
        if (repliesRes.ok) {
          const repliesData = await repliesRes.json();
          replies = repliesData.replies || [];
        }

        const postsWithReplies = data.posts.map((post: Post) => ({
          ...post,
          replies: replies.filter((r: Post & { parent_id?: string }) => (r as any).parent_id === post.id),
        }));

        setPosts(postsWithReplies);
      }
    } catch {
      // non-fatal polling error
    } finally {
      setLoading(false);
    }
  }

  async function handlePost() {
    if (!newPost.trim() || !user) return;
    setPosting(true);

    await fetch('/api/community/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        board_id: boardId,
        content: newPost.trim(),
      }),
    });

    setNewPost('');
    setPosting(false);
    await loadPosts();
  }

  async function handleReply(parentId: string) {
    if (!replyContent.trim() || !user) return;
    setPosting(true);

    await fetch('/api/community/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        board_id: boardId,
        parent_id: parentId,
        content: replyContent.trim(),
      }),
    });

    setReplyContent('');
    setReplyTo(null);
    setPosting(false);
    await loadPosts();
  }

  async function handleReaction(postId: string, emoji: string) {
    if (!user) return;

    await fetch('/api/community/reactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        post_id: postId,
        reaction: emoji,
      }),
    });
  }

  if (loading) return <div className="py-8 text-center text-[var(--color-neutral-500)]">{isAr ? 'جاري التحميل...' : 'Loading...'}</div>;

  return (
    <div>
      <a href={`/${locale}/community/boards`} className="text-sm text-[var(--color-primary)] hover:underline">
        {isAr ? <><ArrowLeft className="w-4 h-4 inline-block rtl:rotate-180" aria-hidden="true" /> العودة للمنتديات</> : <><ArrowLeft className="w-4 h-4 inline-block rtl:rotate-180" aria-hidden="true" /> Back to boards</>}
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
