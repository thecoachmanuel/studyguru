'use client';

import { useState, useMemo } from 'react';
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

  // Sample study partners matching Chatter
  const [studyPartners] = useState([
    {
      id: 'sp-1',
      name: 'Sarah Chen',
      username: 'sarah_c',
      avatar_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80',
      subject: 'Bioinformatics & Organic Chem',
      online: true,
      followersCount: 142,
    },
    {
      id: 'sp-2',
      name: 'David Kim',
      username: 'david_k',
      avatar_url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80',
      subject: 'Algorithms & Data Structures',
      online: true,
      followersCount: 98,
    },
    {
      id: 'sp-3',
      name: 'Alex Rivera',
      username: 'arivera',
      avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80',
      subject: 'Applied Physics & Calc III',
      online: false,
      followersCount: 56,
    },
    {
      id: 'sp-4',
      name: 'Elena Rostova',
      username: 'elena_r',
      avatar_url: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=100&auto=format&fit=crop&q=80',
      subject: 'Machine Learning & NLP',
      online: true,
      followersCount: 210,
    },
    {
      id: 'sp-5',
      name: 'Kenji Sato',
      username: 'kenji_s',
      avatar_url: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=100&auto=format&fit=crop&q=80',
      subject: 'Discrete Math & Logic',
      online: false,
      followersCount: 77,
    },
  ]);

  // Sample study posts
  const [posts] = useState([
    {
      id: 'post-s1',
      author: 'Sarah Chen',
      tag: '#Biology',
      text: 'Summary cheat sheet on cellular respiration and the Krebs cycle ready for review!',
      likes: 24,
      comments: 6,
    },
    {
      id: 'post-s2',
      author: 'David Kim',
      tag: '#Algorithms',
      text: 'Practicing Dijkstra vs Bellman-Ford shortest paths. Remember: Bellman handles negative weights!',
      likes: 42,
      comments: 11,
    },
    {
      id: 'post-s3',
      author: 'Elena Rostova',
      tag: '#ComputerScience',
      text: 'Transformer self-attention mechanism visualized step-by-step for the upcoming quiz.',
      likes: 67,
      comments: 19,
    },
  ]);

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

  const filteredPartners = useMemo(() => {
    if (!q) return studyPartners;
    return studyPartners.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.username.toLowerCase().includes(q) ||
        p.subject.toLowerCase().includes(q)
    );
  }, [studyPartners, q]);

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
        inset: 0,
        zIndex: 220,
        background: 'rgba(0, 0, 0, 0.8)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '16px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--chatter-black)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: 24,
          maxWidth: 620,
          width: '100%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 24px 64px rgba(0,0,0,0.8)',
          marginTop: 'env(safe-area-inset-top, 20px)',
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
              Partners ({filteredPartners.length})
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
              {filteredPartners.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 10px', color: 'var(--chatter-light-text)' }}>
                  No study partners found matching &quot;{searchQuery}&quot;
                </div>
              ) : (
                filteredPartners.map((partner) => {
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
                          <img
                            src={partner.avatar_url}
                            alt={partner.name}
                            style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover' }}
                          />
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
                          ) : (
                            <span
                              style={{
                                position: 'absolute',
                                bottom: 1,
                                right: 1,
                                width: 10,
                                height: 10,
                                borderRadius: '50%',
                                background: 'rgba(255, 255, 255, 0.25)',
                                border: '2px solid var(--chatter-sheet)',
                              }}
                              title="Offline"
                            />
                          )}
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
              {filteredPosts.length === 0 ? (
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
