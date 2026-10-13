'use client';

import { useState, useRef, useEffect } from 'react';

export default function ChatterCommentsSheet({
  post,
  onClose,
  onAddComment,
  profile,
  userId,
}) {
  const [comments, setComments] = useState(post?.commentsList || [
    {
      id: 'c1',
      author: {
        id: 'u-user1',
        name: 'Jordan Lee',
        avatar_url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80',
      },
      text: 'This breakdown is so helpful! Can you also share your cheat sheet for polar coordinates?',
      timestamp: '15m ago',
      likes: 3,
      liked: false,
    },
    {
      id: 'c2',
      author: {
        id: 'u-user2',
        name: 'Maya Patel',
        avatar_url: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=100&auto=format&fit=crop&q=80',
      },
      text: 'Agreed! We covered this exact proof in lecture yesterday. Good catch on the surface orientation.',
      timestamp: '8m ago',
      likes: 1,
      liked: false,
    },
  ]);

  const [newCommentText, setNewCommentText] = useState('');
  const commentsEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSendComment = (e) => {
    e.preventDefault();
    if (!newCommentText.trim()) return;

    const newComment = {
      id: `c-${Date.now()}`,
      author: {
        id: userId || 'u-me',
        name: profile?.name || 'You',
        avatar_url: profile?.avatar_url || null,
      },
      text: newCommentText.trim(),
      timestamp: 'Just now',
      likes: 0,
      liked: false,
    };

    setComments((prev) => [...prev, newComment]);
    onAddComment?.(post.id, newComment);
    setNewCommentText('');

    setTimeout(() => {
      commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleToggleCommentLike = (commentId) => {
    setComments((prev) =>
      prev.map((c) => {
        if (c.id === commentId) {
          const nextLiked = !c.liked;
          return {
            ...c,
            liked: nextLiked,
            likes: nextLiked ? c.likes + 1 : Math.max(0, c.likes - 1),
          };
        }
        return c;
      })
    );
  };

  if (!post) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 150,
        background: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 620,
          background: 'var(--chatter-sheet)',
          borderRadius: '24px 24px 0 0',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderBottom: 'none',
          maxHeight: '82vh',
          height: '75vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 -10px 40px rgba(0, 0, 0, 0.8)',
          animation: 'chatterSheetSlideUp 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag Handle & Header */}
        <div
          style={{
            padding: '12px 18px 14px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            position: 'relative',
          }}
        >
          <div
            style={{
              width: 38,
              height: 4,
              borderRadius: 3,
              background: 'rgba(255, 255, 255, 0.25)',
              marginBottom: 10,
            }}
          />
          <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>Comments</span>
              <span
                style={{
                  background: 'rgba(64, 227, 120, 0.15)',
                  color: 'var(--chatter-primary)',
                  fontSize: 12,
                  fontWeight: 700,
                  borderRadius: 12,
                  padding: '2px 8px',
                }}
              >
                {comments.length}
              </span>
            </h3>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                border: 'none',
                color: '#D4D4D4',
                width: 30,
                height: 30,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                fontSize: 14,
              }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Original Post Snippet */}
        <div
          style={{
            padding: '10px 18px',
            background: 'rgba(0, 0, 0, 0.25)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <img
            src={post.author?.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80'}
            alt={post.author?.name}
            style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }}
          />
          <div style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: '#AEAEAE', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            <strong style={{ color: '#fff' }}>{post.author?.name}</strong>: {post.text}
          </div>
        </div>

        {/* Comments Stream */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px 18px',
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          {comments.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--chatter-light-text)' }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>💬</div>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>No comments yet</p>
              <p style={{ margin: '4px 0 0', fontSize: 12.5 }}>Be the first study partner to share a thought!</p>
            </div>
          ) : (
            comments.map((comment) => (
              <div key={comment.id} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <img
                  src={comment.author?.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80'}
                  alt={comment.author?.name}
                  style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, marginTop: 2 }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 13.5, fontWeight: 700, color: '#fff' }}>
                        {comment.author?.name}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--chatter-light-text)' }}>
                        {comment.timestamp}
                      </span>
                    </div>

                    {/* Comment like heart */}
                    <button
                      type="button"
                      onClick={() => handleToggleCommentLike(comment.id)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: comment.liked ? 'var(--chatter-red)' : 'var(--chatter-light-text)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        fontSize: 11,
                        padding: '2px 4px',
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill={comment.liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                      </svg>
                      {comment.likes > 0 && <span>{comment.likes}</span>}
                    </button>
                  </div>

                  <p style={{ margin: 0, fontSize: 13.5, color: '#E0E0E0', lineHeight: 1.45, wordBreak: 'break-word' }}>
                    {comment.text}
                  </p>
                </div>
              </div>
            ))
          )}
          <div ref={commentsEndRef} />
        </div>

        {/* Sticky Compose Input */}
        <div
          style={{
            padding: '12px 16px calc(14px + env(safe-area-inset-bottom))',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            background: 'var(--chatter-black)',
          }}
        >
          <form
            onSubmit={handleSendComment}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              background: 'var(--chatter-sheet)',
              borderRadius: 22,
              padding: '6px 8px 6px 14px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            <input
              ref={inputRef}
              type="text"
              placeholder="Add a study reply..."
              value={newCommentText}
              onChange={(e) => setNewCommentText(e.target.value)}
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                color: '#fff',
                fontSize: 14,
                outline: 'none',
              }}
            />
            <button
              type="submit"
              disabled={!newCommentText.trim()}
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: 'var(--chatter-primary)',
                border: 'none',
                color: '#0E0E0E',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: newCommentText.trim() ? 'pointer' : 'not-allowed',
                opacity: newCommentText.trim() ? 1 : 0.5,
                transition: 'all 0.15s ease',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
