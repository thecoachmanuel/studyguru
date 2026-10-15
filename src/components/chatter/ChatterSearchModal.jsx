'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { TwitterVerifiedBadge } from './ChatterFeedView';

export default function ChatterSearchModal({
  isOpen,
  onClose,
  servers = [],
  onSelectServer,
  onStartDM,
  onSelectTopic,
  followingMap = {},
  onToggleFollow,
}) {
  const [activeTab, setActiveTab] = useState('top'); // 'top' | 'people' | 'posts' | 'rooms'
  const [searchQuery, setSearchQuery] = useState('');
  const [studyPartners, setStudyPartners] = useState([]);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);

  // Auto-focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 80);
    } else {
      setSearchQuery('');
      setActiveTab('top');
    }
  }, [isOpen]);

  // Handle ESC key to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Fetch real scholars dynamically
  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    setLoading(true);

    const timer = setTimeout(() => {
      fetch(`/api/user/search?q=${encodeURIComponent(searchQuery.trim())}`)
        .then((res) => (res.ok ? res.json() : []))
        .then((data) => {
          if (active) {
            setStudyPartners(Array.isArray(data) ? data : []);
            setLoading(false);
          }
        })
        .catch(() => {
          if (active) {
            setStudyPartners([]);
            setLoading(false);
          }
        });
    }, searchQuery ? 200 : 0);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [isOpen, searchQuery]);

  // Fetch real posts
  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    fetch('/api/posts?limit=50')
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (active) {
          const formatted = (Array.isArray(data) ? data : []).map((p) => ({
            id: p.id || p._id,
            author: p.author_name || p.author?.name || 'Scholar',
            username: p.author_username || p.author?.username || 'scholar',
            avatar_url: p.author_avatar || p.author?.avatar_url || null,
            tag: p.topic_tag || (p.tags?.[0] ? `#${p.tags[0]}` : '#GeneralStudy'),
            text: p.content || p.text || '',
            likes: p.likes_count || (Array.isArray(p.likes) ? p.likes.length : 0),
            comments: p.comments_count || (Array.isArray(p.comments) ? p.comments.length : 0),
          }));
          setPosts(formatted);
        }
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [isOpen]);

  // Curated trending topics for instant tap
  const trendingTopics = [
    { name: 'Computer Science', tag: '#ComputerScience' },
    { name: 'Mathematics', tag: '#Mathematics' },
    { name: 'Exam Prep', tag: '#ExamPrep' },
    { name: 'Biology & Med', tag: '#Biology' },
    { name: 'Machine Learning', tag: '#MachineLearning' },
    { name: 'Physics', tag: '#Physics' },
    { name: 'Law', tag: '#Law' },
  ];

  const q = searchQuery.toLowerCase().trim();

  const filteredPosts = useMemo(() => {
    if (!q) return posts;
    return posts.filter(
      (p) =>
        p.text.toLowerCase().includes(q) ||
        p.author.toLowerCase().includes(q) ||
        p.tag.toLowerCase().includes(q) ||
        p.username.toLowerCase().includes(q)
    );
  }, [posts, q]);

  const filteredRooms = useMemo(() => {
    if (!q) return servers;
    return servers.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.channels && s.channels.some((c) => c.name.toLowerCase().includes(q)))
    );
  }, [servers, q]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 90,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '16px',
        paddingBottom: 'calc(80px + env(safe-area-inset-bottom))',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--chatter-black)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: 22,
          maxWidth: 580,
          width: '100%',
          maxHeight: 'calc(100vh - 100px - env(safe-area-inset-bottom))',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 24px 64px rgba(0,0,0,0.85)',
          marginTop: 'max(16px, env(safe-area-inset-top, 16px))',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── 1. Twitter/X Simple Search Bar ── */}
        <div style={{ padding: '14px 16px 0', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                background: 'rgba(255, 255, 255, 0.06)',
                borderRadius: 24,
                padding: '9px 16px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
              }}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--chatter-light-text)' }}>
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                ref={inputRef}
                type="text"
                placeholder="Search StudyCord..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#fff',
                  fontSize: 15,
                  outline: 'none',
                  width: '100%',
                  fontFamily: 'inherit',
                }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  style={{
                    background: 'rgba(255, 255, 255, 0.12)',
                    border: 'none',
                    color: '#fff',
                    borderRadius: '50%',
                    width: 20,
                    height: 20,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    fontSize: 11,
                  }}
                  title="Clear search"
                >
                  ✕
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--chatter-light-text)',
                fontSize: 14.5,
                fontWeight: 600,
                cursor: 'pointer',
                padding: '4px 8px',
              }}
            >
              Cancel
            </button>
          </div>

          {/* ── 2. Twitter/X Navigation Tabs ── */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', borderTop: '1px solid rgba(255, 255, 255, 0.04)' }}>
            {[
              { id: 'top', label: 'Top' },
              { id: 'people', label: 'People' },
              { id: 'posts', label: 'Posts' },
              { id: 'rooms', label: 'Rooms' },
            ].map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    flex: 1,
                    padding: '12px 8px',
                    background: 'transparent',
                    border: 'none',
                    color: isActive ? '#fff' : 'var(--chatter-light-text)',
                    fontSize: 14.5,
                    fontWeight: isActive ? 750 : 500,
                    cursor: 'pointer',
                    position: 'relative',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <span>{tab.label}</span>
                  {isActive && (
                    <span
                      style={{
                        position: 'absolute',
                        bottom: 0,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        width: 36,
                        height: 3,
                        borderRadius: 3,
                        background: 'var(--chatter-primary)',
                      }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── 3. Search Results & Discovery Feed ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Empty Query Discovery State */}
          {!q && (
            <div>
              {/* Trending Topics Pills */}
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--chatter-light-text)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 10 }}>
                  Trending Study Topics
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {trendingTopics.map((topic) => (
                    <button
                      key={topic.tag}
                      type="button"
                      onClick={() => {
                        setSearchQuery(topic.tag);
                        setActiveTab('top');
                      }}
                      style={{
                        padding: '6px 14px',
                        borderRadius: 20,
                        background: 'rgba(255, 255, 255, 0.06)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        color: 'var(--chatter-primary)',
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {topic.tag}
                    </button>
                  ))}
                </div>
              </div>

              {/* Suggested Scholars */}
              {studyPartners.length > 0 && (
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--chatter-light-text)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 10 }}>
                    Scholars You May Know
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {studyPartners.slice(0, 4).map((partner) => {
                      const isFollowing = !!followingMap[partner.id];
                      return (
                        <div
                          key={partner.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '10px 12px',
                            background: 'var(--chatter-sheet)',
                            borderRadius: 14,
                            border: '1px solid rgba(255, 255, 255, 0.05)',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                            <img
                              src={partner.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80'}
                              alt={partner.name}
                              style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                            />
                            <div style={{ minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <span style={{ fontSize: 14.5, fontWeight: 700, color: '#fff' }}>{partner.name}</span>
                                <TwitterVerifiedBadge />
                              </div>
                              <div style={{ fontSize: 12.5, color: 'var(--chatter-light-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                @{partner.username} · {partner.subject || 'Study Partner'}
                              </div>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => onToggleFollow?.(partner.id)}
                            style={{
                              padding: '6px 14px',
                              borderRadius: 16,
                              background: isFollowing ? 'transparent' : 'var(--chatter-primary)',
                              border: isFollowing ? '1px solid rgba(255, 255, 255, 0.15)' : 'none',
                              color: isFollowing ? '#D4D4D4' : '#0E0E0E',
                              fontSize: 12.5,
                              fontWeight: 700,
                              cursor: 'pointer',
                              flexShrink: 0,
                            }}
                          >
                            {isFollowing ? 'Following' : '+ Follow'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Active Query: Top Tab */}
          {q && activeTab === 'top' && (
            <>
              {/* Matching Scholars preview */}
              {studyPartners.length > 0 && (
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--chatter-light-text)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>
                    People
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {studyPartners.slice(0, 3).map((partner) => {
                      const isFollowing = !!followingMap[partner.id];
                      return (
                        <div
                          key={partner.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '10px 12px',
                            background: 'var(--chatter-sheet)',
                            borderRadius: 14,
                            border: '1px solid rgba(255, 255, 255, 0.05)',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                            <img
                              src={partner.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80'}
                              alt={partner.name}
                              style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                            />
                            <div style={{ minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <span style={{ fontSize: 14.5, fontWeight: 700, color: '#fff' }}>{partner.name}</span>
                                <TwitterVerifiedBadge />
                              </div>
                              <div style={{ fontSize: 12.5, color: 'var(--chatter-light-text)' }}>
                                @{partner.username} · {partner.subject || 'Scholar'}
                              </div>
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <button
                              type="button"
                              onClick={() => onToggleFollow?.(partner.id)}
                              style={{
                                padding: '5px 12px',
                                borderRadius: 14,
                                background: isFollowing ? 'transparent' : 'rgba(64, 227, 120, 0.12)',
                                border: isFollowing ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid rgba(64, 227, 120, 0.3)',
                                color: isFollowing ? '#D4D4D4' : 'var(--chatter-primary)',
                                fontSize: 12,
                                fontWeight: 700,
                                cursor: 'pointer',
                              }}
                            >
                              {isFollowing ? 'Following' : '+ Follow'}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                onClose();
                                onStartDM?.(partner);
                              }}
                              style={{
                                padding: '5px 12px',
                                borderRadius: 14,
                                background: 'var(--chatter-primary)',
                                border: 'none',
                                color: '#0E0E0E',
                                fontSize: 12,
                                fontWeight: 700,
                                cursor: 'pointer',
                              }}
                            >
                              Chat
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Matching Posts preview */}
              {filteredPosts.length > 0 && (
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--chatter-light-text)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8, marginTop: 6 }}>
                    Posts
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {filteredPosts.slice(0, 4).map((post) => (
                      <div
                        key={post.id}
                        style={{
                          background: 'var(--chatter-sheet)',
                          borderRadius: 14,
                          padding: '12px 14px',
                          border: '1px solid rgba(255, 255, 255, 0.06)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{post.author}</span>
                          <span style={{ fontSize: 12.5, color: 'var(--chatter-primary)', fontWeight: 600 }}>{post.tag}</span>
                        </div>
                        <p style={{ fontSize: 14, color: '#e7e9ea', lineHeight: 1.5, margin: '0 0 8px 0' }}>
                          {post.text}
                        </p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 12, color: '#71767b' }}>
                          <span>❤️ {post.likes}</span>
                          <span>💬 {post.comments} replies</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Matching Rooms preview */}
              {filteredRooms.length > 0 && (
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--chatter-light-text)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8, marginTop: 6 }}>
                    Study Rooms
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {filteredRooms.slice(0, 3).map((server) => (
                      <div
                        key={server.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 14px',
                          background: 'var(--chatter-sheet)',
                          borderRadius: 14,
                          border: '1px solid rgba(255, 255, 255, 0.06)',
                        }}
                      >
                        <div>
                          <div style={{ fontSize: 14.5, fontWeight: 700, color: '#fff' }}>{server.name}</div>
                          <div style={{ fontSize: 12, color: 'var(--chatter-light-text)' }}>
                            {server.member_count || 1} members · {server.channels?.length || 0} channels
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onSelectServer?.(server.id);
                          }}
                          style={{
                            padding: '6px 14px',
                            borderRadius: 14,
                            background: 'var(--chatter-primary)',
                            border: 'none',
                            color: '#0E0E0E',
                            fontSize: 12.5,
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          Join
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {studyPartners.length === 0 && filteredPosts.length === 0 && filteredRooms.length === 0 && !loading && (
                <div style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--chatter-light-text)' }}>
                  <div style={{ fontSize: 24, marginBottom: 8 }}>🔍</div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: '#fff', marginBottom: 4 }}>No results for &quot;{searchQuery}&quot;</div>
                  <div style={{ fontSize: 13 }}>Try searching for people, topics, or course groups</div>
                </div>
              )}
            </>
          )}

          {/* Active Query: People Tab */}
          {q && activeTab === 'people' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {studyPartners.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--chatter-light-text)' }}>
                  No scholars found matching &quot;{searchQuery}&quot;
                </div>
              ) : (
                studyPartners.map((partner) => {
                  const isFollowing = !!followingMap[partner.id];
                  return (
                    <div
                      key={partner.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '12px 14px',
                        background: 'var(--chatter-sheet)',
                        borderRadius: 16,
                        border: '1px solid rgba(255, 255, 255, 0.05)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                        <img
                          src={partner.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80'}
                          alt={partner.name}
                          style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                        />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <span style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>{partner.name}</span>
                            <TwitterVerifiedBadge />
                          </div>
                          <div style={{ fontSize: 13, color: 'var(--chatter-light-text)' }}>
                            @{partner.username} · {partner.subject || 'Scholar'}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <button
                          type="button"
                          onClick={() => onToggleFollow?.(partner.id)}
                          style={{
                            padding: '6px 14px',
                            borderRadius: 16,
                            background: isFollowing ? 'transparent' : 'rgba(64, 227, 120, 0.12)',
                            border: isFollowing ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid rgba(64, 227, 120, 0.3)',
                            color: isFollowing ? '#D4D4D4' : 'var(--chatter-primary)',
                            fontSize: 12.5,
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          {isFollowing ? 'Following' : '+ Follow'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onStartDM?.(partner);
                          }}
                          style={{
                            padding: '6px 14px',
                            borderRadius: 16,
                            background: 'var(--chatter-primary)',
                            border: 'none',
                            color: '#0E0E0E',
                            fontSize: 12.5,
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          Chat
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* Active Query: Posts Tab */}
          {q && activeTab === 'posts' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filteredPosts.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--chatter-light-text)' }}>
                  No posts found matching &quot;{searchQuery}&quot;
                </div>
              ) : (
                filteredPosts.map((post) => (
                  <div
                    key={post.id}
                    style={{
                      background: 'var(--chatter-sheet)',
                      borderRadius: 16,
                      padding: '14px 16px',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 14.5, fontWeight: 700, color: '#fff' }}>{post.author}</span>
                      <span style={{ fontSize: 13, color: 'var(--chatter-primary)', fontWeight: 600 }}>{post.tag}</span>
                    </div>
                    <p style={{ fontSize: 15, color: '#e7e9ea', lineHeight: 1.55, margin: '0 0 10px 0' }}>
                      {post.text}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 13, color: '#71767b' }}>
                      <span>❤️ {post.likes} likes</span>
                      <span>💬 {post.comments} replies</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Active Query: Rooms Tab */}
          {q && activeTab === 'rooms' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filteredRooms.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--chatter-light-text)' }}>
                  No study rooms found matching &quot;{searchQuery}&quot;
                </div>
              ) : (
                filteredRooms.map((server) => (
                  <div
                    key={server.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '14px 16px',
                      background: 'var(--chatter-sheet)',
                      borderRadius: 16,
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 2 }}>{server.name}</div>
                      <div style={{ fontSize: 13, color: 'var(--chatter-light-text)' }}>
                        {server.member_count || 1} members · {server.channels?.length || 0} channels
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onSelectServer?.(server.id);
                      }}
                      style={{
                        padding: '7px 16px',
                        borderRadius: 14,
                        background: 'var(--chatter-primary)',
                        border: 'none',
                        color: '#0E0E0E',
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      Enter Room
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
