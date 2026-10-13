'use client';

import { useState, useRef } from 'react';
import SnapshotRail from '@/components/SnapshotRail';
import ChatterUserProfileModal from './ChatterUserProfileModal';
import ChatterCommentsSheet from './ChatterCommentsSheet';

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
}) {
  const [posts, setPosts] = useState([
    {
      id: 'p1',
      author: {
        id: 'u-sarah',
        name: 'Sarah Chen',
        username: 'schen_ai',
        avatar_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&auto=format&fit=crop&q=80',
        followersCount: 42,
        bio: 'Senior studying AI & Computational Neuroscience · Passionate about vector calculus & transformers.',
      },
      tag: '#CalculusIII',
      text: 'Just finished deriving Stokes’ Theorem with vector line integrals! 📐 Remember: boundary orientation must always match the surface normal by the right-hand rule.',
      timestamp: '25m ago',
      likes: 14,
      liked: false,
      comments: 3,
      attachmentUrl: 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=600&auto=format&fit=crop&q=80',
    },
    {
      id: 'p2',
      author: {
        id: 'u-alex',
        name: 'Alex Rivera',
        username: 'arivera_cs',
        avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80',
        followersCount: 31,
        bio: 'Computer Science Major · Building open-source machine learning tooling.',
      },
      tag: '#DeepLearning',
      text: 'Quick tip for training Transformers: Always normalize your layer inputs before Multi-Head Attention (Pre-LN) for smoother gradients and no warmup spikes! 🚀',
      timestamp: '1h ago',
      likes: 29,
      liked: true,
      comments: 7,
    },
    {
      id: 'p3',
      author: {
        id: 'u-emily',
        name: 'Emily Watson',
        username: 'em_bio',
        avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
        followersCount: 56,
        bio: 'Pre-Med Scholar · Biochemistry & Cellular Biology study groups.',
      },
      tag: '#Biochemistry',
      text: 'Citric Acid Cycle study group starting in 15 minutes in the Live Audio Space! Jump in if you need a quick review for tomorrow’s midterm. 🧬🔬',
      timestamp: '2h ago',
      likes: 18,
      liked: false,
      comments: 5,
    },
  ]);

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

  const handleLike = (id) => {
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

  const handleAddComment = (postId, newComment) => {
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

  const handleImageFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    const reader = new FileReader();
    reader.onload = () => {
      setAttachedImage(reader.result);
      setUploadingImage(false);
    };
    reader.readAsDataURL(file);
  };

  const handleCreatePost = (e) => {
    e.preventDefault();
    if (!newPostText.trim()) return;

    const newPost = {
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
    };

    setPosts([newPost, ...posts]);
    setNewPostText('');
    setAttachedImage(null);
    setCreateModalOpen(false);
  };

  return (
    <div style={{ paddingBottom: 80, maxWidth: 680, margin: '0 auto', width: '100%', position: 'relative' }}>
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

      {/* ── 1. Top Snapshots Story Rail (Chatter circular stories) ── */}
      <div style={{ padding: '8px 12px 14px', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
        <SnapshotRail serverId={serverId} currentUserId={userId} />
      </div>

      {/* ── 2. Chatter Social Posts Stream ── */}
      <div style={{ marginTop: 8 }}>
        {posts.map((post) => {
          const isMe = post.author.id === userId || post.author.id === 'me';
          const isFollowing = !!(activeFollowing[post.author.id]);
          return (
            <article key={post.id} className="chatter-post-card">
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

                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
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
                  {/* Tag Pill */}
                  <span className="chatter-hashtag">{post.tag}</span>
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
    </div>
  );
}
