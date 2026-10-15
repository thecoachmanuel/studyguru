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

export function ChatterPostSkeleton() {
  return (
    <div className="chatter-post-card" style={{ opacity: 0.8, pointerEvents: 'none' }}>
      <div className="chatter-post-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.08)',
              animation: 'chatterPulse 1.4s ease-in-out infinite',
            }}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div
              style={{
                width: 120,
                height: 14,
                borderRadius: 6,
                background: 'rgba(255, 255, 255, 0.1)',
                animation: 'chatterPulse 1.4s ease-in-out infinite',
              }}
            />
            <div
              style={{
                width: 75,
                height: 11,
                borderRadius: 6,
                background: 'rgba(255, 255, 255, 0.06)',
                animation: 'chatterPulse 1.4s ease-in-out infinite',
              }}
            />
          </div>
        </div>
        <div
          style={{
            width: 70,
            height: 26,
            borderRadius: 14,
            background: 'rgba(255, 255, 255, 0.06)',
            animation: 'chatterPulse 1.4s ease-in-out infinite',
          }}
        />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, margin: '14px 0 16px' }}>
        <div
          style={{
            width: '95%',
            height: 13,
            borderRadius: 6,
            background: 'rgba(255, 255, 255, 0.08)',
            animation: 'chatterPulse 1.4s ease-in-out infinite',
          }}
        />
        <div
          style={{
            width: '80%',
            height: 13,
            borderRadius: 6,
            background: 'rgba(255, 255, 255, 0.06)',
            animation: 'chatterPulse 1.4s ease-in-out infinite',
          }}
        />
      </div>
      <div style={{ display: 'flex', gap: 24, paddingTop: 6, borderTop: '1px solid rgba(255, 255, 255, 0.04)' }}>
        <div
          style={{
            width: 40,
            height: 16,
            borderRadius: 6,
            background: 'rgba(255, 255, 255, 0.06)',
            animation: 'chatterPulse 1.4s ease-in-out infinite',
          }}
        />
        <div
          style={{
            width: 40,
            height: 16,
            borderRadius: 6,
            background: 'rgba(255, 255, 255, 0.06)',
            animation: 'chatterPulse 1.4s ease-in-out infinite',
          }}
        />
      </div>
    </div>
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
  feedTab = 'forYou',
  onSelectFeedTab,
}) {
  const [internalFeedTab, setInternalFeedTab] = useState('forYou');
  const activeFeedTab = feedTab || internalFeedTab;
  const setTab = onSelectFeedTab || setInternalFeedTab;

  const [posts, setPosts] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = sessionStorage.getItem('chatter_cached_feed');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch {}
    }
    return [];
  });
  const [loadingPosts, setLoadingPosts] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = sessionStorage.getItem('chatter_cached_feed');
        if (cached && JSON.parse(cached)?.length > 0) return false;
      } catch {}
    }
    return true;
  });

  const [localFollowing, setLocalFollowing] = useState({});
  const activeFollowing = { ...localFollowing, ...followingMap };
  const [profileModalUser, setProfileModalUser] = useState(null);
  const [activeCommentsPost, setActiveCommentsPost] = useState(null);

  const PREMADE_TAGS = [
    '#GeneralStudy',
    '#ComputerScience',
    '#Mathematics',
    '#Biology',
    '#Medicine',
    '#Physics',
    '#ExamPrep',
    '#Engineering',
    '#Law',
    '#Psychology',
  ];

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newPostText, setNewPostText] = useState('');
  const [newPostTag, setNewPostTag] = useState('#GeneralStudy');
  const [tagDropdownOpen, setTagDropdownOpen] = useState(false);
  const [customTagInput, setCustomTagInput] = useState('');
  const tagDropdownRef = useRef(null);
  const [attachedImage, setAttachedImage] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (tagDropdownRef.current && !tagDropdownRef.current.contains(event.target)) {
        setTagDropdownOpen(false);
      }
    }
    if (tagDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [tagDropdownOpen]);

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

  // Standard reverse-chronological social feed (Twitter / Facebook timeline)
  // When following a user from a post, the feed maintains its stable position and does NOT jump to the top.
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
      const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return timeB - timeA;
    });
  }, [posts, filterTag]);

  // Filter by For you (all posts) vs Following (only followed scholars)
  const tabFilteredPosts = useMemo(() => {
    if (activeFeedTab === 'following') {
      return sortedPosts.filter((p) => {
        const authorId = p.author?.id || p.author_id;
        return Boolean(activeFollowing[authorId]);
      });
    }
    return sortedPosts;
  }, [sortedPosts, activeFeedTab, activeFollowing]);

  // 10 posts at a time chunked loading
  const visiblePosts = useMemo(() => {
    return tabFilteredPosts.slice(0, visibleCount);
  }, [tabFilteredPosts, visibleCount]);

  const hasMore = visibleCount < tabFilteredPosts.length;

  useEffect(() => {
    if (!loadMoreRef.current || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount((prev) => Math.min(prev + 10, tabFilteredPosts.length));
        }
      },
      { rootMargin: '300px' }
    );

    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [hasMore, tabFilteredPosts.length]);

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
            try {
              sessionStorage.setItem('chatter_cached_feed', JSON.stringify(data));
            } catch {}
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
            fontSize: 14,
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

      {/* ── Twitter / X Style Inline Quick Compose Box (Desktop Only) ── */}
      <div
        className="chatter-desktop-compose-box"
        style={{
          padding: '14px 16px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          gap: 12,
          background: 'transparent',
        }}
      >
        {profile?.avatar_url ? (
          <img
            src={profile.avatar_url}
            alt={profile.name || 'Scholar'}
            style={{ width: 42, height: 42, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
          />
        ) : (
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: '50%',
              background: '#2A2A2A',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              color: 'var(--chatter-primary)',
              fontSize: 16,
              flexShrink: 0,
            }}
          >
            {profile?.name?.[0] || 'U'}
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <textarea
            value={newPostText}
            onChange={(e) => setNewPostText(e.target.value)}
            placeholder="What's happening in your studies?"
            rows={2}
            style={{
              width: '100%',
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: '#fff',
              fontSize: 16,
              lineHeight: 1.45,
              resize: 'none',
              fontFamily: 'inherit',
              padding: '4px 0',
            }}
          />
          {attachedImage && (
            <div style={{ position: 'relative', display: 'inline-block', marginBottom: 10 }}>
              <img src={attachedImage} alt="Preview" style={{ maxHeight: 200, maxWidth: '100%', borderRadius: 14, border: '1px solid rgba(255, 255, 255, 0.1)' }} />
              <button
                type="button"
                onClick={() => setAttachedImage(null)}
                style={{
                  position: 'absolute',
                  top: 6,
                  right: 6,
                  background: 'rgba(0,0,0,0.75)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '50%',
                  width: 24,
                  height: 24,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                }}
              >
                ✕
              </button>
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8, borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {/* Image Picker */}
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
                disabled={uploadingImage}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--chatter-primary)',
                  cursor: uploadingImage ? 'not-allowed' : 'pointer',
                  padding: '4px 6px',
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'background 0.15s ease',
                }}
                title="Add Image"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
              </button>

              {/* Modern Interactive Tag selector */}
              <div ref={tagDropdownRef} style={{ position: 'relative' }}>
                <button
                  type="button"
                  onClick={() => setTagDropdownOpen((prev) => !prev)}
                  style={{
                    background: 'rgba(64, 227, 120, 0.12)',
                    border: '1px solid rgba(64, 227, 120, 0.3)',
                    borderRadius: 14,
                    color: 'var(--chatter-primary)',
                    fontSize: 13.5,
                    fontWeight: 700,
                    padding: '4px 10px',
                    outline: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    transition: 'all 0.15s ease',
                  }}
                  title="Select or enter topic tag"
                >
                  <span>🏷️</span>
                  <span>{newPostTag || '#GeneralStudy'}</span>
                  <span style={{ fontSize: 12, opacity: 0.8 }}>▾</span>
                </button>

                {tagDropdownOpen && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 6px)',
                      left: 0,
                      zIndex: 90,
                      background: 'var(--chatter-sheet)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      borderRadius: 16,
                      padding: 12,
                      width: 280,
                      boxShadow: '0 12px 36px rgba(0,0,0,0.7)',
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--chatter-light-text)', textTransform: 'uppercase', marginBottom: 8, letterSpacing: '0.04em' }}>
                      Topic Hashtag
                    </div>

                    {/* Custom Tag Input */}
                    <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                      <input
                        type="text"
                        placeholder="Type custom #tag..."
                        value={customTagInput}
                        onChange={(e) => setCustomTagInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            if (customTagInput.trim()) {
                              const formatted = customTagInput.trim().startsWith('#') ? customTagInput.trim() : `#${customTagInput.trim()}`;
                              setNewPostTag(formatted);
                              setCustomTagInput('');
                              setTagDropdownOpen(false);
                            }
                          }
                        }}
                        style={{
                          flex: 1,
                          padding: '6px 10px',
                          background: 'rgba(255, 255, 255, 0.06)',
                          border: '1px solid rgba(255, 255, 255, 0.12)',
                          borderRadius: 10,
                          color: '#fff',
                          fontSize: 14,
                          outline: 'none',
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (customTagInput.trim()) {
                            const formatted = customTagInput.trim().startsWith('#') ? customTagInput.trim() : `#${customTagInput.trim()}`;
                            setNewPostTag(formatted);
                            setCustomTagInput('');
                            setTagDropdownOpen(false);
                          }
                        }}
                        style={{
                          padding: '6px 12px',
                          borderRadius: 10,
                          background: 'var(--chatter-primary)',
                          border: 'none',
                          color: '#0E0E0E',
                          fontSize: 13.5,
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        Add
                      </button>
                    </div>

                    {/* Pre-made tags grid */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: 150, overflowY: 'auto' }}>
                      {PREMADE_TAGS.map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => {
                            setNewPostTag(tag);
                            setTagDropdownOpen(false);
                          }}
                          style={{
                            padding: '4px 9px',
                            borderRadius: 10,
                            background: newPostTag === tag ? 'var(--chatter-primary)' : 'rgba(255, 255, 255, 0.06)',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                            color: newPostTag === tag ? '#0E0E0E' : '#E5E5E5',
                            fontSize: 13,
                            fontWeight: newPostTag === tag ? 750 : 500,
                            cursor: 'pointer',
                            transition: 'all 0.12s ease',
                          }}
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={handleCreatePost}
              disabled={!newPostText.trim() && !attachedImage}
              style={{
                background: (newPostText.trim() || attachedImage) ? 'var(--chatter-primary)' : 'rgba(64, 227, 120, 0.25)',
                color: '#0E0E0E',
                border: 'none',
                borderRadius: 20,
                padding: '6px 18px',
                fontSize: 14.5,
                fontWeight: 750,
                cursor: (newPostText.trim() || attachedImage) ? 'pointer' : 'not-allowed',
                transition: 'all 0.15s ease',
              }}
            >
              Post
            </button>
          </div>
        </div>
      </div>

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
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700, color: 'var(--chatter-primary)' }}>
            <span>Filtered by {filterTag.startsWith('#') ? filterTag : `#${filterTag}`}</span>
            <span style={{ fontSize: 12.5, color: '#D4D4D4', fontWeight: 500 }}>({tabFilteredPosts.length} {tabFilteredPosts.length === 1 ? 'post' : 'posts'})</span>
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
              fontSize: 12.5,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            ✕ Clear Filter
          </button>
        </div>
      )}

      {/* ── 2. Chatter Social Posts Stream (Chunked infinite scroll) ── */}
      <div style={{ marginTop: 2 }}>
        {loadingPosts && visiblePosts.length === 0 ? (
          <>
            <ChatterPostSkeleton />
            <ChatterPostSkeleton />
            <ChatterPostSkeleton />
          </>
        ) : visiblePosts.length > 0 ? (
          visiblePosts.map((post) => {
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
                          fontSize: 13.5,
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
                                fontSize: 14,
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
                                fontSize: 14,
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
          })
        ) : activeFeedTab === 'following' ? (
          <div
            style={{
              padding: '60px 20px',
              textAlign: 'center',
              color: '#71767b',
            }}
          >
            <div style={{ fontSize: 36, marginBottom: 10 }}>👥</div>
            <div style={{ fontSize: 19, fontWeight: 700, color: '#fff', marginBottom: 6 }}>
              Welcome to your Following feed!
            </div>
            <div style={{ fontSize: 14.5, color: '#71767b', maxWidth: 360, margin: '0 auto 18px', lineHeight: 1.5 }}>
              You aren't following anyone yet, or scholars you follow haven't posted yet. Follow scholars to see their updates here.
            </div>
            <button
              type="button"
              onClick={() => setTab('forYou')}
              style={{
                padding: '8px 22px',
                borderRadius: 20,
                background: 'var(--chatter-primary)',
                color: '#0E0E0E',
                border: 'none',
                fontWeight: 750,
                fontSize: 15,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              Discover Posts in For you
            </button>
          </div>
        ) : (
          <div
            style={{
              padding: '60px 20px',
              textAlign: 'center',
              color: 'var(--chatter-light-text)',
            }}
          >
            <div style={{ fontSize: 32, marginBottom: 8 }}>🌱</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>No study posts yet</div>
            <div style={{ fontSize: 14, marginTop: 4, color: 'var(--chatter-light-text)' }}>
              Be the first scholar to share notes, flashcards, or study tips!
            </div>
          </div>
        )}

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
              fontSize: 14,
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
              fontSize: 14,
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
              <h3 style={{ fontSize: 20, fontWeight: 700, color: '#fff', margin: 0 }}>
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
                <div style={{ marginBottom: 8 }}>
                  <label style={{ fontSize: 13.5, color: 'var(--chatter-light-text)', display: 'block', marginBottom: 6, fontWeight: 600 }}>
                    Select Topic or Type Custom Hashtag
                  </label>
                  <input
                    type="text"
                    placeholder="Hashtag (e.g. #OrganicChemistry)"
                    value={newPostTag}
                    onChange={(e) => {
                      const v = e.target.value;
                      setNewPostTag(v ? (v.startsWith('#') ? v : `#${v}`) : '');
                    }}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: 12,
                      background: '#141414',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      color: 'var(--chatter-primary)',
                      fontWeight: 700,
                      fontSize: 16,
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                {/* Quick Pre-made Hashtag Pills */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                  {PREMADE_TAGS.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setNewPostTag(tag)}
                      style={{
                        padding: '4px 10px',
                        borderRadius: 12,
                        background: newPostTag === tag ? 'var(--chatter-primary)' : 'rgba(255, 255, 255, 0.06)',
                        border: newPostTag === tag ? '1px solid var(--chatter-primary)' : '1px solid rgba(255, 255, 255, 0.08)',
                        color: newPostTag === tag ? '#0E0E0E' : '#D4D4D4',
                        fontSize: 13,
                        fontWeight: newPostTag === tag ? 750 : 500,
                        cursor: 'pointer',
                        transition: 'all 0.12s ease',
                      }}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
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
                    fontSize: 16,
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
                      fontSize: 14,
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
                    fontSize: 15,
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
                    fontSize: 15.5,
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
              <h3 style={{ fontSize: 20, fontWeight: 700, color: '#fff', margin: 0 }}>Edit Study Post</h3>
              <button
                type="button"
                onClick={() => setEditingPost(null)}
                style={{ background: 'none', border: 'none', color: '#fff', fontSize: 18, cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEdit}>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 13.5, color: 'var(--chatter-light-text)', display: 'block', marginBottom: 6 }}>
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
                    fontSize: 16,
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 13.5, color: 'var(--chatter-light-text)', display: 'block', marginBottom: 6 }}>
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
                    fontSize: 16,
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
                    fontSize: 14.5,
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
                    fontSize: 14.5,
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
