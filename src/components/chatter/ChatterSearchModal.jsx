'use client';

import { useState, useEffect, useMemo } from 'react';
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
  const [activeSegment, setActiveSegment] = useState(0); // 0: Partners, 1: Posts, 2: Study Rooms, 3: Topics
  const [searchQuery, setSearchQuery] = useState('');
  const [studyPartners, setStudyPartners] = useState([]);
  const [posts, setPosts] = useState([]);
  const [loadingPartners, setLoadingPartners] = useState(false);
  const [loadingPosts, setLoadingPosts] = useState(false);

  // Fetch real study partners dynamically
  useEffect(() => {
    if (!isOpen) return;

    let active = true;
    setLoadingPartners(true);
    const timer = setTimeout(() => {
      fetch(`/api/user/search?q=${encodeURIComponent(searchQuery.trim())}`)
        .then((res) => (res.ok ? res.json() : []))
        .then((data) => {
          if (active) {
            setStudyPartners(Array.isArray(data) ? data : []);
            setLoadingPartners(false);
          }
        })
        .catch(() => {
          if (active) {
            setStudyPartners([]);
            setLoadingPartners(false);
          }
        });
    }, searchQuery ? 250 : 0);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [isOpen, searchQuery]);

  // Fetch real posts
  useEffect(() => {
    if (!isOpen) return;

    let active = true;
    setLoadingPosts(true);
    fetch('/api/posts?limit=50')
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (active) {
          const formatted = (Array.isArray(data) ? data : []).map((p) => ({
            id: p.id || p._id,
            author: p.author_name || p.author?.name || 'Scholar',
            tag: p.topic_tag || (p.tags?.[0] ? `#${p.tags[0]}` : '#General'),
            text: p.content || '',
            likes: p.likes_count || (Array.isArray(p.likes) ? p.likes.length : 0),
            comments: p.comments_count || (Array.isArray(p.comments) ? p.comments.length : 0),
          }));
          setPosts(formatted);
          setLoadingPosts(false);
        }
      })
      .catch(() => {
        if (active) {
          setPosts([]);
          setLoadingPosts(false);
        }
      });

    return () => {
      active = false;
    };
  }, [isOpen]);

  // Topic tags matching Chatter
  const topics = [
    { name: 'Computer Science', tag: '#ComputerScience', postsCount: 382 },
    { name: 'Mathematics', tag: '#Mathematics', postsCount: 294 },
    { name: 'Algorithms', tag: '#Algorithms', postsCount: 185 },
    { name: 'Biology & Medicine', tag: '#Biology', postsCount: 142 },
    { name: 'Physics', tag: '#Physics', postsCount: 97 },
    { name: 'Machine Learning', tag: '#MachineLearning', postsCount: 228 },
    { name: 'Chemistry', tag: '#Chemistry', postsCount: 84 },
    { name: 'Law', tag: '#Law', postsCount: 61 },
  ];

  const q = searchQuery.toLowerCase().trim();

  const filteredPosts = useMemo(() => {
    if (!q) return posts;
    return posts.filter(
      (p) =>
        p.text.toLowerCase().includes(q) ||
        p.author.toLowerCase().includes(q) ||
        p.tag.toLowerCase().includes(q)
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

  const filteredTopics = useMemo(() => {
    if (!q) return topics;
    return topics.filter(
      (t) => t.name.toLowerCase().includes(q) || t.tag.toLowerCase().includes(q)
    );
  }, [topics, q]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 65,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '16px',
        paddingBottom: 'calc(74px + env(safe-area-inset-bottom))',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--chatter-black)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: 24,
          maxWidth: 620,
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
        {/* Header with Search Input */}
        <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                background: 'var(--chatter-sheet)',
                borderRadius: 16,
                padding: '10px 14px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--chatter-light-text)' }}>
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                autoFocus
                placeholder="Search partners, topics, study rooms..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#fff',
                  fontSize: 14.5,
                  outline: 'none',
                  width: '100%',
                }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  style={{ background: 'none', border: 'none', color: '#979797', cursor: 'pointer', padding: 2 }}
                >
                  ✕
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                border: 'none',
                color: '#fff',
                width: 36,
                height: 36,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              ✕
            </button>
          </div>

          {/* Cupertino Segmented Tabs */}
          <div className="chatter-segment-control">
            <button
              type="button"
              className={`chatter-segment-btn ${activeSegment === 0 ? 'chatter-segment-btn--active' : ''}`}
              onClick={() => setActiveSegment(0)}
            >
              Partners ({studyPartners.length})
            </button>
            <button
              type="button"
              className={`chatter-segment-btn ${activeSegment === 1 ? 'chatter-segment-btn--active' : ''}`}
              onClick={() => setActiveSegment(1)}
            >
              Posts ({filteredPosts.length})
            </button>
            <button
              type="button"
              className={`chatter-segment-btn ${activeSegment === 2 ? 'chatter-segment-btn--active' : ''}`}
              onClick={() => setActiveSegment(2)}
            >
              Rooms ({filteredRooms.length})
            </button>
            <button
              type="button"
              className={`chatter-segment-btn ${activeSegment === 3 ? 'chatter-segment-btn--active' : ''}`}
              onClick={() => setActiveSegment(3)}
            >
              Topics
            </button>
          </div>
        </div>

        {/* Scrollable Results Area */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Segment 0: Partners */}
          {activeSegment === 0 && (
            <>
              {loadingPartners ? (
                <div style={{ textAlign: 'center', padding: '40px 10px', color: 'var(--chatter-light-text)', fontSize: 13 }}>
                  Searching partners...
                </div>
              ) : studyPartners.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 10px', color: 'var(--chatter-light-text)' }}>
                  No study partners found matching &quot;{searchQuery}&quot;
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
                        background: 'var(--chatter-sheet)',
                        borderRadius: 16,
                        padding: '12px 14px',
                        border: '1px solid rgba(255, 255, 255, 0.05)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ position: 'relative' }}>
                          {partner.avatar_url ? (
                            <img
                              src={partner.avatar_url}
                              alt={partner.name}
                              style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover' }}
                            />
                          ) : (
                            <div
                              style={{
                                width: 44,
                                height: 44,
                                borderRadius: '50%',
                                background: 'linear-gradient(135deg, var(--chatter-primary) 0%, #16a34a 100%)',
                                color: '#0E0E0E',
                                fontWeight: 800,
                                fontSize: 16,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              {(partner.name || 'U').charAt(0).toUpperCase()}
                            </div>
                          )}
                          {partner.online ? (
                            <span
                              style={{
                                position: 'absolute',
                                bottom: 1,
                                right: 1,
                                width: 10,
                                height: 10,
                                borderRadius: '50%',
                                background: 'var(--chatter-primary)',
                                border: '2px solid var(--chatter-sheet)',
                              }}
                              title="Online"
                            />
                          ) : null}
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 14.5, fontWeight: 700, color: '#fff' }}>{partner.name}</span>
                            <TwitterVerifiedBadge />
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--chatter-light-text)' }}>
                            @{partner.username} · {partner.subject}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <button
                          type="button"
                          onClick={() => onToggleFollow?.(partner.id)}
                          style={{
                            padding: '6px 12px',
                            borderRadius: 14,
                            background: isFollowing ? 'transparent' : 'rgba(64, 227, 120, 0.12)',
                            border: isFollowing ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid rgba(64, 227, 120, 0.3)',
                            color: isFollowing ? 'var(--chatter-light-text)' : 'var(--chatter-primary)',
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
                            padding: '6px 14px',
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
                })
              )}
            </>
          )}

          {/* Segment 1: Posts */}
          {activeSegment === 1 && (
            <>
              {loadingPosts ? (
                <div style={{ textAlign: 'center', padding: '40px 10px', color: 'var(--chatter-light-text)', fontSize: 13 }}>
                  Loading posts...
                </div>
              ) : filteredPosts.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 10px', color: 'var(--chatter-light-text)' }}>
                  No study posts found matching &quot;{searchQuery}&quot;
                </div>
              ) : (
                filteredPosts.map((post) => (
                  <div
                    key={post.id}
                    style={{
                      background: 'var(--chatter-sheet)',
                      borderRadius: 16,
                      padding: 14,
                      border: '1px solid rgba(255, 255, 255, 0.05)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 13.5, fontWeight: 700, color: '#fff' }}>{post.author}</span>
                      <span className="chatter-hashtag">{post.tag}</span>
                    </div>
                    <p style={{ fontSize: 13.5, color: '#D4D4D4', lineHeight: 1.5, margin: '0 0 10px 0' }}>
                      {post.text}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 12, color: 'var(--chatter-light-text)' }}>
                      <span>❤️ {post.likes}</span>
                      <span>💬 {post.comments} comments</span>
                    </div>
                  </div>
                ))
              )}
            </>
          )}

          {/* Segment 2: Study Rooms */}
          {activeSegment === 2 && (
            <>
              {filteredRooms.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 10px', color: 'var(--chatter-light-text)' }}>
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
                      background: 'var(--chatter-sheet)',
                      borderRadius: 16,
                      padding: '12px 14px',
                      border: '1px solid rgba(255, 255, 255, 0.05)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div
                        style={{
                          width: 42,
                          height: 42,
                          borderRadius: 12,
                          background: '#242424',
                          color: 'var(--chatter-primary)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          fontSize: 16,
                        }}
                      >
                        {server.name?.[0]?.toUpperCase() || 'S'}
                      </div>
                      <div>
                        <div style={{ fontSize: 14.5, fontWeight: 700, color: '#fff' }}>{server.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--chatter-light-text)' }}>
                          {server.channels?.length || 0} channels · {server.member_count || 1} members
                        </div>
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
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      Join Room
                    </button>
                  </div>
                ))
              )}
            </>
          )}

          {/* Segment 3: Topics */}
          {activeSegment === 3 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
              {filteredTopics.map((topic) => (
                <div
                  key={topic.tag}
                  onClick={() => {
                    onClose();
                    onSelectTopic?.(topic.name);
                  }}
                  style={{
                    background: 'var(--chatter-sheet)',
                    borderRadius: 16,
                    padding: 14,
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    transition: 'border-color 0.15s ease',
                  }}
                >
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--chatter-primary)' }}>{topic.tag}</div>
                    <div style={{ fontSize: 12, color: 'var(--chatter-light-text)' }}>{topic.name}</div>
                  </div>
                  <span style={{ fontSize: 11.5, background: 'rgba(255, 255, 255, 0.06)', padding: '4px 8px', borderRadius: 10, color: '#D4D4D4' }}>
                    {topic.postsCount} posts
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
