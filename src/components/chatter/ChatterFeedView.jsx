'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import ChatterNotesBar from './ChatterNotesBar';
import ChatterUserProfileModal from './ChatterUserProfileModal';
import ChatterCommentsSheet from './ChatterCommentsSheet';
import { getPusherClient } from '@/lib/pusherClient';

export function TwitterVerifiedBadge() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }} aria-label="Verified">
      <path
        d="M22.5 12.5c0-1.58-.875-2.95-2.148-3.6.154-.435.238-.905.238-1.4 0-2.21-1.79-4-4-4-.495 0-.965.084-1.4.238C14.55 2.475 13.18 1.6 11.6 1.6c-1.58 0-2.95.875-3.6 2.148-.435-.154-.905-.238-1.4-.238-2.21 0-4 1.79-4 4 0 .495.084.965.238 1.4C1.575 9.55.7 10.92.7 12.5c0 1.58.875 2.95 2.148 3.6-.154.435-.238.905-.238 1.4 0 2.21 1.79 4 4 4 .495 0 .965-.084 1.4-.238.65 1.273 2.02 2.148 3.6 2.148 1.58 0 2.95-.875 3.6-2.148.435.154.905.238 1.4.238 2.21 0 4-1.79 4-4 0-.495-.084-.965-.238-1.4 1.273-.65 2.148-2.02 2.148-3.6z"
        fill="#1D9BF0"
      />
      <path
        d="M10.2 16.2l-3.5-3.5 1.4-1.4 2.1 2.1 5.3-5.3 1.4 1.4-6.7 6.7z"
        fill="#FFFFFF"
      />
    </svg>
  );
}

export default function ChatterFeedView({
  serverId,
  profile,
  userId,
  onOpenLiveSpaces,
  onStartDM,
  followingMap = {},
  onToggleFollow,
  targetPostId = null,
  filterTag = null,
  onSelectTag,
}) {
  const [posts, setPosts] = useState([]);
  const [loadingPosts, setLoadingPosts] = useState(true);

  const [localFollowing, setLocalFollowing] = useState({});
  const activeFollowing = { ...localFollowing, ...followingMap };
  const [profileModalUser, setProfileModalUser] = useState(null);
  const [activeCommentsPost, setActiveCommentsPost] = useState(null);

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newPostText, setNewPostText] = useState('');
  const [newPostTag, setNewPostTag] = useState('#GeneralStudy');
  const [attachedImage, setAttachedImage] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef(null);

  // Edit / Delete post states
  const [activeMenuPostId, setActiveMenuPostId] = useState(null);
  const [editingPost, setEditingPost] = useState(null);
  const [editText, setEditText] = useState('');
  const [editTag, setEditTag] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingPostId, setDeletingPostId] = useState(null);

  // Infinite Scroll Pagination (10 posts per batch)
  const [visibleCount, setVisibleCount] = useState(10);
  const loadMoreRef = useRef(null);

  // Filter by active trending topic / tag if selected, and prioritize followed users
  const sortedPosts = useMemo(() => {
    let list = [...posts];
    if (filterTag) {
      const cleanTag = filterTag.toLowerCase().replace(/^#/, '');
      list = list.filter((p) => {
        const postTag = (p.tag || '').toLowerCase().replace(/^#/, '');
        const text = (p.text || '').toLowerCase();
        return postTag === cleanTag || text.includes(`#${cleanTag}`) || text.includes(cleanTag);
      });
    }

    return list.sort((a, b) => {
      const aId = a.author?.id || a.author_id;
      const bId = b.author?.id || b.author_id;
      const aFollowing = Boolean(aId && activeFollowing[aId]);
      const bFollowing = Boolean(bId && activeFollowing[bId]);
      if (aFollowing && !bFollowing) return -1;
      if (!aFollowing && bFollowing) return 1;
      const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return timeB - timeA;
    });
  }, [posts, activeFollowing, filterTag]);

  // 10 posts at a time chunked loading
  const visiblePosts = useMemo(() => {
    return sortedPosts.slice(0, visibleCount);
  }, [sortedPosts, visibleCount]);

  const hasMore = visibleCount < sortedPosts.length;

  useEffect(() => {
    if (!loadMoreRef.current || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount((prev) => Math.min(prev + 10, sortedPosts.length));
        }
      },
      { rootMargin: '300px' }
    );

    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [hasMore, sortedPosts.length]);

  // Auto-scroll to target post when navigated from profile
  useEffect(() => {
    if (targetPostId && posts.length > 0) {
      const idx = sortedPosts.findIndex((p) => p.id === targetPostId);
      if (idx >= 0 && idx >= visibleCount) {
        setVisibleCount(idx + 5);
      }
      setTimeout(() => {
        const el = document.getElementById(`post-${targetPostId}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.style.borderColor = 'var(--chatter-primary)';
          setTimeout(() => {
            if (el) el.style.borderColor = 'rgba(255, 255, 255, 0.06)';
          }, 2400);
        }
      }, 200);
    }
  }, [targetPostId, posts, sortedPosts, visibleCount]);

  // 1. Fetch persistent posts from MongoDB
  useEffect(() => {
    let mounted = true;
    const fetchPosts = async () => {
      try {
        const res = await fetch('/api/posts');
        if (res.ok) {
          const data = await res.json();
          if (mounted && Array.isArray(data)) {
            setPosts(data);
          }
        }
      } catch (err) {
        console.warn('Could not load posts:', err);
      } finally {
        if (mounted) setLoadingPosts(false);
      }
    };

    fetchPosts();

    // 2. Real-time Pusher listener for feed updates
    let channel = null;
    try {
      const pusher = getPusherClient();
      if (pusher) {
        channel = pusher.subscribe('feed');

        channel.bind('new-post', (newP) => {
          if (!mounted || !newP) return;
          setPosts((prev) => {
            if (prev.some((p) => p.id === newP.id)) return prev;
            return [newP, ...prev];
          });
        });

        channel.bind('post-liked', ({ postId, likes, userId: likeUserId }) => {
          if (!mounted || !postId) return;
          setPosts((prev) =>
            prev.map((p) => {
              if (p.id === postId) {
                return {
                  ...p,
                  likes,
                  liked: likeUserId === String(userId) ? p.liked : p.liked,
                };
              }
              return p;
            })
          );
        });

        channel.bind('new-comment', ({ postId, comment, commentsCount }) => {
          if (!mounted || !postId) return;
          setPosts((prev) =>
            prev.map((p) => {
              if (p.id === postId) {
                const list = p.commentsList || [];
                const already = list.some((c) => c.id === comment.id);
                return {
                  ...p,
                  comments: commentsCount || p.comments + 1,
                  commentsList: already ? list : [...list, comment],
                };
              }
              return p;
            })
          );
        });
      }
    } catch {}

    return () => {
      mounted = false;
      if (channel) {
        try {
          channel.unbind_all();
        } catch {}
      }
    };
  }, [userId]);

  const handleLike = async (id) => {
    // Optimistic toggle
    setPosts((prev) =>
      prev.map((post) => {
        if (post.id === id) {
          const newLiked = !post.liked;
          return {
            ...post,
            liked: newLiked,
            likes: newLiked ? post.likes + 1 : Math.max(0, post.likes - 1),
          };
        }
        return post;
      })
    );

    // Persistent API call
    try {
      const res = await fetch(`/api/posts/${id}/like`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setPosts((prev) =>
          prev.map((post) =>
            post.id === id ? { ...post, liked: data.liked, likes: data.likes } : post
          )
        );
      }
    } catch (err) {
      console.warn('Like sync notice:', err);
    }
  };

  const handleToggleFollow = (authorId) => {
    if (onToggleFollow) {
      onToggleFollow(authorId);
    } else {
      setLocalFollowing((prev) => ({
        ...prev,
        [authorId]: !prev[authorId],
      }));
    }
  };

  const handleAddComment = async (postId, newComment) => {
    // Optimistic update
    setPosts((prev) =>
      prev.map((post) => {
        if (post.id === postId) {
          const list = post.commentsList || [];
          return {
            ...post,
            comments: (post.comments || 0) + 1,
            commentsList: [...list, newComment],
          };
        }
        return post;
      })
    );

    // Persistent API call
    try {
      const res = await fetch(`/api/posts/${postId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: newComment.text }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.comment) {
          setPosts((prev) =>
            prev.map((post) => {
              if (post.id === postId) {
                const list = (post.commentsList || []).filter((c) => c.id !== newComment.id);
                return {
                  ...post,
                  comments: data.commentsCount,
                  commentsList: [...list, data.comment],
                };
              }
              return post;
            })
          );
        }
      }
    } catch (err) {
      console.warn('Comment sync notice:', err);
    }
  };

  const [shareToast, setShareToast] = useState('');

  const handleSharePost = async (post) => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: `StudyCord: ${post.tag}`,
          text: `${post.author.name}: "${post.text}"`,
          url: window.location.href,
        });
        return;
      } catch {}
    }
    try {
      await navigator.clipboard.writeText(`${post.author.name}: "${post.text}" (${window.location.href})`);
      setShareToast('Link copied to clipboard!');
      setTimeout(() => setShareToast(''), 2500);
    } catch {
      setShareToast('Post link ready!');
      setTimeout(() => setShareToast(''), 2500);
    }
  };

  const handleStartEdit = (post) => {
    setEditingPost(post);
    setEditText(post.text);
    setEditTag(post.tag || '#GeneralStudy');
    setActiveMenuPostId(null);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingPost || !editText.trim()) return;
    setSavingEdit(true);
    const postId = editingPost.id;
    try {
      const res = await fetch(`/api/posts/${postId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: editText.trim(), tag: editTag }),
      });
      if (res.ok) {
        setPosts((prev) =>
          prev.map((p) => (p.id === postId ? { ...p, text: editText.trim(), tag: editTag } : p))
        );
        setEditingPost(null);
      }
    } catch (err) {
      console.warn('Failed to edit post:', err);
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeletePost = async (postId) => {
    if (!confirm('Are you sure you want to delete this study post?')) return;
    setDeletingPostId(postId);
    setActiveMenuPostId(null);
    try {
      const res = await fetch(`/api/posts/${postId}`, { method: 'DELETE' });
      if (res.ok) {
        setPosts((prev) => prev.filter((p) => p.id !== postId));
      }
    } catch (err) {
      console.warn('Failed to delete post:', err);
    } finally {
      setDeletingPostId(null);
    }
  };

  const handleImageFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        setAttachedImage(data.url);
      } else {
        const reader = new FileReader();
        reader.onload = () => setAttachedImage(reader.result);
        reader.readAsDataURL(file);
      }
    } catch {
      const reader = new FileReader();
      reader.onload = () => setAttachedImage(reader.result);
      reader.readAsDataURL(file);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleCreatePost = async (e) => {
    e.preventDefault();
    if (!newPostText.trim()) return;

    const postPayload = {
      text: newPostText.trim(),
      tag: newPostTag,
      attachmentUrl: attachedImage,
    };

    try {
      const res = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(postPayload),
      });

      if (res.ok) {
        const created = await res.json();
        setPosts((prev) => [created, ...prev.filter((p) => p.id !== created.id)]);
      } else {
        // Fallback optimistic post
        const fallbackPost = {
          id: `p-${Date.now()}`,
          author: {
            id: userId || 'me',
            name: profile?.name || 'You',
            username: profile?.username || 'scholar',
            avatar_url: profile?.avatar_url || null,
            followersCount: 1,
            bio: 'Study enthusiast',
          },
          tag: newPostTag.startsWith('#') ? newPostTag : `#${newPostTag}`,
          text: newPostText,
          attachmentUrl: attachedImage,
          timestamp: 'Just now',
          likes: 0,
          liked: false,
          comments: 0,
          commentsList: [],
        };
        setPosts((prev) => [fallbackPost, ...prev]);
      }
    } catch {
      const fallbackPost = {
        id: `p-${Date.now()}`,
        author: {
          id: userId || 'me',
          name: profile?.name || 'You',
          username: profile?.username || 'scholar',
          avatar_url: profile?.avatar_url || null,
          followersCount: 1,
          bio: 'Study enthusiast',
        },
        tag: newPostTag.startsWith('#') ? newPostTag : `#${newPostTag}`,
        text: newPostText,
        attachmentUrl: attachedImage,
        timestamp: 'Just now',
        likes: 0,
        liked: false,
        comments: 0,
        commentsList: [],
      };
      setPosts((prev) => [fallbackPost, ...prev]);
    }

    setNewPostText('');
    setAttachedImage(null);
    setCreateModalOpen(false);
  };

  return (
    <div style={{ paddingBottom: 'calc(84px + env(safe-area-inset-bottom))', width: '100%', position: 'relative' }}>
      {/* Share Toast Banner */}
      {shareToast && (
        <div
          style={{
            position: 'fixed',
            top: 64,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--chatter-sheet)',
            color: 'var(--chatter-primary)',
            border: '1px solid var(--chatter-primary)',
            padding: '8px 18px',
            borderRadius: 20,
            fontSize: 13,
            fontWeight: 700,
            boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <span>✓</span> {shareToast}
        </div>
      )}

      {/* ── 1. Top Chatter Study Notes & Stories Carousel ── */}
      <ChatterNotesBar user={{ id: userId }} profile={profile} followingMap={activeFollowing} onOpenLiveSpaces={onOpenLiveSpaces} />

      {/* Active Hashtag Filter Banner */}
      {filterTag && (
        <div
          style={{
            margin: '8px 16px 4px',
            padding: '8px 14px',
            background: 'rgba(64, 227, 120, 0.12)',
            border: '1px solid rgba(64, 227, 120, 0.3)',
            borderRadius: 14,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, color: 'var(--chatter-primary)' }}>
            <span>Filtered by {filterTag.startsWith('#') ? filterTag : `#${filterTag}`}</span>
            <span style={{ fontSize: 11, color: '#D4D4D4', fontWeight: 500 }}>({sortedPosts.length} {sortedPosts.length === 1 ? 'post' : 'posts'})</span>
          </div>
          <button
            type="button"
            onClick={() => onSelectTag?.(null)}
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              border: 'none',
              color: '#fff',
              borderRadius: 10,
              padding: '3px 9px',
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            ✕ Clear Filter
          </button>
        </div>
      )}

      {/* ── 2. Chatter Social Posts Stream (Chunked infinite scroll) ── */}
      <div style={{ marginTop: 8 }}>
        {visiblePosts.map((post) => {
          const isMe = post.author.id === userId || post.author.id === 'me';
          const isFollowing = !!(activeFollowing[post.author.id]);
          return (
            <article key={post.id} id={`post-${post.id}`} className="chatter-post-card">
              {/* Header: Author + Follow Button + Tag */}
              <div className="chatter-post-header">
                <div
                  className="chatter-post-author"
                  onClick={() => setProfileModalUser(post.author)}
                  style={{ cursor: 'pointer' }}
                >
                  {post.author.avatar_url ? (
                    <img
                      src={post.author.avatar_url}
                      alt={post.author.name}
                      className="chatter-post-avatar"
                    />
                  ) : (
                    <div
                      className="chatter-post-avatar"
                      style={{
                        background: '#2A2A2A',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        color: 'var(--chatter-primary)',
                        fontSize: 16,
                      }}
                    >
                      {post.author.name[0]}
                    </div>
                  )}
                  <div>
                    <div className="chatter-post-name" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>{post.author.name}</span>
                      <TwitterVerifiedBadge />
                    </div>
                    <div className="chatter-post-meta">
                      @{post.author.username} · {post.timestamp}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {/* Chatter Follow Button (Desktop only on card, mobile follows via Profile Sheet) */}
                  {!isMe && (
                    <button
                      type="button"
                      className="chatter-post-follow-desktop"
                      onClick={() => handleToggleFollow(post.author.id)}
                      style={{
                        padding: '5px 13px',
                        borderRadius: 16,
                        background: isFollowing ? 'transparent' : 'rgba(64, 227, 120, 0.12)',
                        border: isFollowing ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid rgba(64, 227, 120, 0.3)',
                        color: isFollowing ? 'var(--chatter-light-text)' : 'var(--chatter-primary)',
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {isFollowing ? '✓ Following' : '+ Follow'}
                    </button>
                  )}

                  {/* Tag Pill with Click-to-Filter */}
                  <span
                    className="chatter-hashtag"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectTag?.(post.tag);
                    }}
                    style={{ cursor: 'pointer' }}
                    title={`Filter by ${post.tag}`}
                  >
                    {post.tag}
                  </span>

                  {/* Author Post Options Menu (Edit / Delete) */}
                  {isMe && (
                    <div style={{ position: 'relative' }}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenuPostId(activeMenuPostId === post.id ? null : post.id);
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--chatter-light-text)',
                          cursor: 'pointer',
                          padding: '4px 6px',
                          fontSize: 16,
                          borderRadius: 8,
                          lineHeight: 1,
                        }}
                        title="Post options"
                      >
                        •••
                      </button>

                      {activeMenuPostId === post.id && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            position: 'absolute',
                            top: 26,
                            right: 0,
                            background: '#1c1c1c',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: 12,
                            padding: 4,
                            zIndex: 50,
                            minWidth: 125,
                            boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => handleStartEdit(post)}
                            style={{
                              width: '100%',
                              textAlign: 'left',
                              padding: '8px 12px',
                              background: 'none',
                              border: 'none',
                              color: '#fff',
                              fontSize: 12.5,
                              fontWeight: 600,
                              cursor: 'pointer',
                              borderRadius: 8,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                            }}
                          >
                            <span>✏️</span> Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeletePost(post.id)}
                            disabled={deletingPostId === post.id}
                            style={{
                              width: '100%',
                              textAlign: 'left',
                              padding: '8px 12px',
                              background: 'none',
                              border: 'none',
                              color: '#f87171',
                              fontSize: 12.5,
                              fontWeight: 600,
                              cursor: 'pointer',
                              borderRadius: 8,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                            }}
                          >
                            <span>🗑️</span> {deletingPostId === post.id ? 'Deleting…' : 'Delete'}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Post Content */}
              <p className="chatter-post-body">{post.text}</p>

              {/* Media Attachment (Image) */}
              {post.attachmentUrl && (
                <div style={{ marginBottom: 12, borderRadius: 14, overflow: 'hidden', maxHeight: 380, border: '1px solid rgba(255,255,255,0.06)' }}>
                  <img
                    src={post.attachmentUrl}
                    alt="Post attachment"
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                </div>
              )}

              {/* Bottom Actions Bar (Heart, Comment, Share) */}
              <div className="chatter-post-actions">
                <button
                  type="button"
                  className={`chatter-post-action-btn ${post.liked ? 'chatter-post-action-btn--liked' : ''}`}
                  onClick={() => handleLike(post.id)}
                  aria-label="Like post"
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill={post.liked ? 'currentColor' : 'none'}
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                  </svg>
                  <span>{post.likes}</span>
                </button>

                <button
                  type="button"
                  className="chatter-post-action-btn"
                  onClick={() => setActiveCommentsPost(post)}
                  aria-label="Comment"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                  <span>{post.comments}</span>
                </button>

                <button
                  type="button"
                  className="chatter-post-action-btn"
                  onClick={() => handleSharePost(post)}
                  aria-label="Share"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="18" cy="5" r="3" />
                    <circle cx="6" cy="12" r="3" />
                    <circle cx="18" cy="19" r="3" />
                    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                  </svg>
                </button>
              </div>
            </article>
          );
        })}

        {/* Sentinel loader for infinite scroll */}
        {hasMore && (
          <div
            ref={loadMoreRef}
            style={{
              padding: '24px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              color: 'var(--chatter-light-text)',
              fontSize: 13.5,
              fontWeight: 500,
            }}
          >
            <div
              style={{
                width: 18,
                height: 18,
                borderRadius: '50%',
                border: '2px solid rgba(255, 255, 255, 0.2)',
                borderTopColor: 'var(--chatter-primary)',
                animation: 'spin 0.8s linear infinite',
              }}
            />
            <span>Loading more posts…</span>
          </div>
        )}

        {!hasMore && sortedPosts.length > 5 && (
          <div
            style={{
              textAlign: 'center',
              padding: '28px 16px 16px',
              color: 'rgba(255, 255, 255, 0.35)',
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            You&apos;re all caught up ✨
          </div>
        )}
      </div>

      {/* ── 3. Chatter Floating Action Button (+) ── */}
      <button
        type="button"
        className="chatter-fab"
        onClick={() => setCreateModalOpen(true)}
        aria-label="Create study post"
        title="Create Study Post"
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>

      {/* ── 4. Create Post Modal with Image Upload ── */}
      {createModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(6px)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
          onClick={() => setCreateModalOpen(false)}
        >
          <div
            style={{
              background: 'var(--chatter-sheet)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: 22,
              padding: 24,
              maxWidth: 520,
              width: '100%',
              boxShadow: '0 16px 48px rgba(0,0,0,0.7)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: '#fff', margin: 0 }}>
                Share Study Post & Resources
              </h3>
              <button
                type="button"
                onClick={() => setCreateModalOpen(false)}
                style={{ background: 'transparent', border: 'none', color: '#979797', cursor: 'pointer', fontSize: 18 }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreatePost}>
              <div style={{ marginBottom: 14 }}>
                <input
                  type="text"
                  placeholder="Subject Tag (e.g. #OrganicChemistry)"
                  value={newPostTag}
                  onChange={(e) => setNewPostTag(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: 12,
                    background: '#141414',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: 'var(--chatter-primary)',
                    fontWeight: 600,
                    fontSize: 14,
                    outline: 'none',
                    marginBottom: 10,
                  }}
                />
                <textarea
                  rows={4}
                  placeholder="What notes, key takeaways, or study insights are you sharing?"
                  value={newPostText}
                  onChange={(e) => setNewPostText(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: 12,
                    background: '#141414',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: '#fff',
                    fontSize: 14,
                    outline: 'none',
                    resize: 'none',
                  }}
                />
              </div>

              {/* Image attachment preview or upload button */}
              {attachedImage ? (
                <div style={{ position: 'relative', marginBottom: 14, borderRadius: 12, overflow: 'hidden', maxHeight: 180 }}>
                  <img src={attachedImage} alt="Attachment" style={{ width: '100%', maxHeight: 180, objectFit: 'cover' }} />
                  <button
                    type="button"
                    onClick={() => setAttachedImage(null)}
                    style={{
                      position: 'absolute',
                      top: 8,
                      right: 8,
                      background: 'rgba(0,0,0,0.7)',
                      border: 'none',
                      color: '#fff',
                      borderRadius: '50%',
                      width: 28,
                      height: 28,
                      cursor: 'pointer',
                    }}
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <div style={{ marginBottom: 16 }}>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={handleImageFileChange}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '10px 16px',
                      borderRadius: 12,
                      background: 'rgba(255, 255, 255, 0.06)',
                      border: '1px dashed rgba(255, 255, 255, 0.2)',
                      color: 'var(--chatter-light-text)',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                      width: '100%',
                      justifyContent: 'center',
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <polyline points="21 15 16 10 5 21" />
                    </svg>
                    <span>{uploadingImage ? 'Loading Image...' : 'Attach Image or Notes Photo'}</span>
                  </button>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  style={{
                    padding: '10px 18px',
                    borderRadius: 12,
                    background: 'transparent',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    color: '#979797',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newPostText.trim() || uploadingImage}
                  style={{
                    padding: '10px 24px',
                    borderRadius: 12,
                    background: 'var(--chatter-primary)',
                    border: 'none',
                    color: '#0E0E0E',
                    fontWeight: 700,
                    cursor: newPostText.trim() ? 'pointer' : 'not-allowed',
                    opacity: newPostText.trim() ? 1 : 0.6,
                  }}
                >
                  Post to Feed
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── 5. User Profile Modal ── */}
      {profileModalUser && (
        <ChatterUserProfileModal
          targetUser={profileModalUser}
          currentUserId={userId}
          onClose={() => setProfileModalUser(null)}
          onStartDM={onStartDM}
          followingMap={activeFollowing}
          onToggleFollow={handleToggleFollow}
        />
      )}

      {/* ── 6. Chatter Comments Bottom Sheet ── */}
      {activeCommentsPost && (
        <ChatterCommentsSheet
          post={activeCommentsPost}
          onClose={() => setActiveCommentsPost(null)}
          onAddComment={handleAddComment}
          profile={profile}
          userId={userId}
        />
      )}

      {/* ── 7. Edit Post Modal ── */}
      {editingPost && (
        <div
          onClick={() => setEditingPost(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--chatter-sheet)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: 20,
              padding: 22,
              maxWidth: 480,
              width: '100%',
              boxShadow: '0 16px 40px rgba(0,0,0,0.8)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: '#fff', margin: 0 }}>Edit Study Post</h3>
              <button
                type="button"
                onClick={() => setEditingPost(null)}
                style={{ background: 'none', border: 'none', color: '#fff', fontSize: 16, cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEdit}>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, color: 'var(--chatter-light-text)', display: 'block', marginBottom: 6 }}>
                  Topic Tag
                </label>
                <input
                  type="text"
                  value={editTag}
                  onChange={(e) => setEditTag(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 12,
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: '#fff',
                    fontSize: 13,
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, color: 'var(--chatter-light-text)', display: 'block', marginBottom: 6 }}>
                  Post Content
                </label>
                <textarea
                  rows={4}
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: 12,
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: '#fff',
                    fontSize: 14,
                    outline: 'none',
                    boxSizing: 'border-box',
                    resize: 'vertical',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setEditingPost(null)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 14,
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: 'none',
                    color: '#fff',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!editText.trim() || savingEdit}
                  style={{
                    padding: '8px 20px',
                    borderRadius: 14,
                    background: 'var(--chatter-primary)',
                    border: 'none',
                    color: '#0E0E0E',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: editText.trim() ? 'pointer' : 'not-allowed',
                    opacity: editText.trim() ? 1 : 0.6,
                  }}
                >
                  {savingEdit ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
