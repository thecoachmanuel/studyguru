'use client';

import { useState, useEffect } from 'react';
import { TwitterVerifiedBadge } from './ChatterFeedView';

export default function ChatterRightSidebar({
  onOpenSearch,
  onOpenRooms,
  onOpenGuru,
  onSelectTag,
  followingMap = {},
  onToggleFollow,
  onOpenUserProfile,
  onJoinVoiceChannel,
  currentUserId,
}) {
  const [suggestedScholars, setSuggestedScholars] = useState([]);
  const [trendingTopics, setTrendingTopics] = useState([]);

  // 1. Fetch real scholars from the database
  useEffect(() => {
    let active = true;
    fetch('/api/user/search?q=')
      .then((r) => (r.ok ? r.json() : []))
      .then((users) => {
        if (!active || !Array.isArray(users)) return;
        const others = users
          .filter((u) => u.id !== currentUserId && u._id !== currentUserId)
          .slice(0, 5)
          .map((u) => ({
            id: u.id || u._id,
            name: u.name || 'Scholar',
            username: u.username || 'scholar',
            avatar_url: u.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80',
            major: u.subject || u.major || 'Study Partner',
            followers_count: typeof u.followersCount === 'number' ? u.followersCount : (u.followers_count || 0),
          }));

        if (others.length > 0) {
          setSuggestedScholars(others);
        } else {
          // Fallback to active demo scholars if database is completely empty
          setSuggestedScholars([
            {
              id: 'u-sarah',
              name: 'Sarah Chen',
              username: 'schen_ai',
              avatar_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&auto=format&fit=crop&q=80',
              major: 'AI & Neuroscience',
              followers_count: 42,
            },
            {
              id: 'u-alex',
              name: 'Alex Rivera',
              username: 'arivera_cs',
              avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80',
              major: 'Computer Systems',
              followers_count: 31,
            },
            {
              id: 'u-jordan',
              name: 'Jordan Lee',
              username: 'jlee_stats',
              avatar_url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80',
              major: 'Applied Statistics',
              followers_count: 27,
            },
          ]);
        }
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [currentUserId]);

  // 2. Fetch real posts to extract live trending study hashtags
  useEffect(() => {
    let active = true;
    fetch('/api/posts')
      .then((r) => (r.ok ? r.json() : []))
      .then((posts) => {
        if (!active || !Array.isArray(posts)) return;
        const tagCounts = {};
        posts.forEach((p) => {
          if (p.tag) {
            const cleanTag = p.tag.startsWith('#') ? p.tag : `#${p.tag}`;
            tagCounts[cleanTag] = (tagCounts[cleanTag] || 0) + 1;
          }
          // Also match hashtags in text
          const matches = (p.text || '').match(/#[a-zA-Z0-9_]+/g);
          if (matches) {
            matches.forEach((t) => {
              tagCounts[t] = (tagCounts[t] || 0) + 1;
            });
          }
        });

        const sortedTags = Object.entries(tagCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([tag, count]) => ({
            tag,
            category: 'Active Discussions',
            postsCount: `${count} ${count === 1 ? 'post' : 'posts'}`,
          }));

        if (sortedTags.length > 0) {
          setTrendingTopics(sortedTags);
        } else {
          setTrendingTopics([
            { tag: '#ComputerScience', category: 'Algorithms & AI', postsCount: '1.4k posts' },
            { tag: '#LinearAlgebra', category: 'Mathematics', postsCount: '920 posts' },
            { tag: '#MCATPrep', category: 'Biochem & Med', postsCount: '780 posts' },
            { tag: '#MachineLearning', category: 'Deep Learning', postsCount: '650 posts' },
            { tag: '#OrganicChemistry', category: 'Reaction Mechanisms', postsCount: '510 posts' },
          ]);
        }
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, []);

  return (
    <aside className="chatter-desktop-right-sidebar" aria-label="Desktop Right Sidebar">
      {/* ── 1. Search Bar ── */}
      <div
        onClick={onOpenSearch}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          background: 'var(--chatter-sheet)',
          borderRadius: 24,
          padding: '10px 16px',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          cursor: 'pointer',
          transition: 'all 0.15s ease',
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--chatter-light-text)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <span style={{ fontSize: 14, color: 'var(--chatter-light-text)', fontWeight: 500 }}>
          Search StudyCord...
        </span>
      </div>

      {/* ── 2. Trending Study Topics (Twitter/X style) ── */}
      <div
        style={{
          background: 'var(--chatter-sheet)',
          borderRadius: 18,
          padding: '16px 18px',
          border: '1px solid rgba(255, 255, 255, 0.06)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <h3 style={{ fontSize: 17, fontWeight: 800, color: '#fff', margin: 0, letterSpacing: '-0.01em' }}>
            Trending for You
          </h3>
          <span style={{ fontSize: 12.5, color: 'var(--chatter-primary)', fontWeight: 700, cursor: 'pointer' }} onClick={onOpenRooms}>
            Explore
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {trendingTopics.map((item) => (
            <div
              key={item.tag}
              onClick={() => onSelectTag?.(item.tag)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                cursor: 'pointer',
                transition: 'opacity 0.12s ease',
              }}
              title={`Filter posts by ${item.tag}`}
            >
              <span style={{ fontSize: 12, color: 'var(--chatter-light-text)', fontWeight: 500 }}>
                Trending in {item.category}
              </span>
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--chatter-primary)' }}>
                {item.tag}
              </span>
              <span style={{ fontSize: 12.5, color: 'var(--chatter-light-text)' }}>
                {item.postsCount}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── 3. Who to Follow (Top Study Scholars) ── */}
      <div
        style={{
          background: 'var(--chatter-sheet)',
          borderRadius: 18,
          padding: '16px 18px',
          border: '1px solid rgba(255, 255, 255, 0.06)',
        }}
      >
        <h3 style={{ fontSize: 17, fontWeight: 800, color: '#fff', margin: '0 0 14px 0', letterSpacing: '-0.01em' }}>
          Who to Follow
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {suggestedScholars.map((scholar) => {
            const isFollowing = !!followingMap[scholar.id];
            return (
              <div
                key={scholar.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                }}
              >
                <div
                  onClick={() => onOpenUserProfile?.(scholar)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    minWidth: 0,
                    cursor: 'pointer',
                    flex: 1,
                  }}
                >
                  <img
                    src={scholar.avatar_url}
                    alt={scholar.name}
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: '50%',
                      objectFit: 'cover',
                      border: '2px solid rgba(64, 227, 120, 0.3)',
                    }}
                  />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ fontSize: 14.5, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {scholar.name}
                      </span>
                      <TwitterVerifiedBadge />
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--chatter-light-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      @{scholar.username} · {scholar.major}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onToggleFollow?.(scholar.id)}
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
                    transition: 'all 0.12s ease',
                  }}
                >
                  {isFollowing ? 'Following' : '+ Follow'}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── 4. StudyCord AI Study Partner Spotlight ── */}
      <div
        onClick={onOpenGuru}
        style={{
          background: 'linear-gradient(135deg, rgba(64, 227, 120, 0.12) 0%, rgba(20, 20, 20, 0.9) 100%)',
          borderRadius: 18,
          padding: '16px 18px',
          border: '1px solid rgba(64, 227, 120, 0.25)',
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          transition: 'all 0.15s ease',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18 }}>⚡</span>
          <span style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>AI Guru</span>
          <span style={{ fontSize: 11, background: 'var(--chatter-primary)', color: '#0E0E0E', padding: '2px 7px', borderRadius: 8, fontWeight: 800 }}>
            Active
          </span>
        </div>
        <p style={{ fontSize: 13, color: '#D4D4D4', margin: 0, lineHeight: 1.45 }}>
          Upload PDFs, ask course questions, or create automated recall quizzes in real time.
        </p>
        <span style={{ fontSize: 12.5, color: 'var(--chatter-primary)', fontWeight: 700 }}>
          Launch Tutor Session →
        </span>
      </div>

      {/* ── 5. Clean Desktop Footer ── */}
      <footer style={{ padding: '0 4px', fontSize: 12, color: 'var(--chatter-light-text)', lineHeight: 1.6 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 12px' }}>
          <a href="/terms" style={{ color: 'inherit', textDecoration: 'none' }}>Terms of Service</a>
          <a href="/privacy" style={{ color: 'inherit', textDecoration: 'none' }}>Privacy Policy</a>
          <a href="/faq" style={{ color: 'inherit', textDecoration: 'none' }}>FAQ</a>
          <a href="/technology" style={{ color: 'inherit', textDecoration: 'none' }}>Technology</a>
          <a href="/team" style={{ color: 'inherit', textDecoration: 'none' }}>Team</a>
        </div>
        <div style={{ marginTop: 6, fontSize: 11.5, opacity: 0.8 }}>
          © 2026 StudyCord · Built for scholars
        </div>
      </footer>
    </aside>
  );
}
