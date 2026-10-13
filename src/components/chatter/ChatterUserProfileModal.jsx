'use client';

import { useState, useEffect } from 'react';
import { TwitterVerifiedBadge } from './ChatterFeedView';

export default function ChatterUserProfileModal({
  targetUser,
  currentUserId,
  onClose,
  onStartDM,
  followingMap = {},
  onToggleFollow,
}) {
  const [liveUser, setLiveUser] = useState(targetUser || {});

  const isSelf = targetUser?.id === currentUserId || targetUser?.id === 'me' || targetUser?.id === 'u-me';

  // Fetch real-time profile data for targetUser so bio, avatar, and stats match their profile exactly
  useEffect(() => {
    if (!targetUser?.id) return;
    setLiveUser(targetUser);

    let active = true;
    const profileUrl = isSelf ? '/api/user/profile' : `/api/user/profile?userId=${encodeURIComponent(targetUser.id)}`;
    fetch(profileUrl)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (active && data && !data.error && data.found !== false) {
          setLiveUser((prev) => ({
            ...prev,
            ...data,
            name: (data.name && data.name !== 'Scholar') ? data.name : (prev.name || data.name),
            username: (data.username && data.username !== 'scholar') ? data.username : (prev.username || data.username),
            avatar_url: data.avatar_url || prev.avatar_url,
            banner_url: data.banner_url || prev.banner_url,
            bio: (data.bio && !data.bio.startsWith('📚 Studying & collaborating on StudyCord · Always open')) ? data.bio : (prev.bio || data.bio),
            followers_count: typeof data.followers_count === 'number' ? data.followers_count : (prev.followersCount || prev.followers_count || 0),
            following_count: typeof data.following_count === 'number' ? data.following_count : (prev.followingCount || prev.following_count || 0),
            study_hours: typeof data.study_hours === 'number' ? data.study_hours : (prev.study_hours || 12),
            day_streak: typeof data.day_streak === 'number' ? data.day_streak : (prev.day_streak || 3),
          }));
        }
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [targetUser?.id, isSelf]);

  if (!targetUser) return null;

  const isFollowing = !!followingMap[targetUser?.id];
  const displayFollowers = typeof liveUser?.followers_count === 'number'
    ? liveUser.followers_count
    : (typeof liveUser?.followersCount === 'number' ? liveUser.followersCount : 0);
  const studyHours = liveUser.study_hours ? `${liveUser.study_hours}h` : '12h';
  const dayStreak = liveUser.day_streak ? `${liveUser.day_streak}🔥` : '3🔥';

  const handleToggleFollow = () => {
    const willFollow = !isFollowing;
    setLiveUser((prev) => ({
      ...prev,
      followers_count: Math.max(0, (prev.followers_count || 0) + (willFollow ? 1 : -1)),
    }));
    onToggleFollow?.(targetUser.id);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 250,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--chatter-sheet)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: 24,
          maxWidth: 480,
          width: '100%',
          overflow: 'hidden',
          boxShadow: '0 16px 48px rgba(0,0,0,0.7)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cover banner */}
        <div
          style={{
            height: 110,
            background: liveUser.banner_url
              ? `url(${liveUser.banner_url}) center/cover no-repeat`
              : 'linear-gradient(135deg, #183321 0%, #0E0E0E 100%)',
            position: 'relative',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              position: 'absolute',
              top: 12,
              right: 12,
              background: 'rgba(0,0,0,0.5)',
              border: 'none',
              color: '#fff',
              width: 32,
              height: 32,
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

        {/* Content */}
        <div style={{ padding: '0 20px 20px', position: 'relative', marginTop: -36 }}>
          {/* Avatar + Follow Action */}
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ position: 'relative' }}>
              {liveUser.avatar_url ? (
                <img
                  src={liveUser.avatar_url}
                  alt={liveUser.name}
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: '50%',
                    objectFit: 'cover',
                    border: '3px solid var(--chatter-sheet)',
                    boxShadow: '0 0 0 2px var(--chatter-primary)',
                  }}
                />
              ) : (
                <div
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: '50%',
                    background: '#242424',
                    color: 'var(--chatter-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                    fontSize: 24,
                    border: '3px solid var(--chatter-sheet)',
                    boxShadow: '0 0 0 2px var(--chatter-primary)',
                  }}
                >
                  {liveUser.name?.[0]?.toUpperCase() || 'S'}
                </div>
              )}
            </div>

            {/* Chatter Follow Button */}
            {!isSelf && (
              <button
                type="button"
                onClick={handleToggleFollow}
                style={{
                  padding: '8px 22px',
                  borderRadius: 20,
                  background: isFollowing ? 'transparent' : 'var(--chatter-primary)',
                  border: isFollowing ? '1px solid rgba(255,255,255,0.2)' : 'none',
                  color: isFollowing ? '#fff' : '#0E0E0E',
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {isFollowing ? '✓ Following' : '+ Follow'}
              </button>
            )}
          </div>

          {/* Name & Bio */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}>
            <h3 style={{ fontSize: 20, fontWeight: 800, color: '#fff', margin: 0, letterSpacing: '-0.01em' }}>
              {liveUser.name}
            </h3>
            <TwitterVerifiedBadge />
          </div>
          <div style={{ fontSize: 14, color: 'var(--chatter-light-text)', marginBottom: 10, fontWeight: 500 }}>
            @{liveUser.username || liveUser.name?.toLowerCase().replace(/\s+/g, '_')}
          </div>

          <p style={{ fontSize: 15, color: '#D4D4D4', lineHeight: 1.55, margin: '0 0 16px 0' }}>
            {liveUser.bio || '🎓 Studying and preparing for upcoming semester exams · Sharing notes on mathematics & computer science.'}
          </p>

          {/* Stats Bar */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 10,
              marginBottom: 20,
            }}
          >
            <div style={{ background: '#141414', borderRadius: 14, padding: '12px 10px', textAlign: 'center', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
              <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--chatter-primary)' }}>{displayFollowers}</div>
              <div style={{ fontSize: 13, color: 'var(--chatter-light-text)', marginTop: 2, fontWeight: 500 }}>Followers</div>
            </div>
            <div style={{ background: '#141414', borderRadius: 14, padding: '12px 10px', textAlign: 'center', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
              <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--chatter-primary)' }}>{studyHours}</div>
              <div style={{ fontSize: 13, color: 'var(--chatter-light-text)', marginTop: 2, fontWeight: 500 }}>Study Hours</div>
            </div>
            <div style={{ background: '#141414', borderRadius: 14, padding: '12px 10px', textAlign: 'center', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
              <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--chatter-primary)' }}>{dayStreak}</div>
              <div style={{ fontSize: 13, color: 'var(--chatter-light-text)', marginTop: 2, fontWeight: 500 }}>Day Streak</div>
            </div>
          </div>

          {/* Actions: Send DM */}
          {targetUser.id !== currentUserId && (
            <button
              type="button"
              onClick={() => {
                onClose?.();
                onStartDM?.(targetUser);
              }}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: 14,
                background: 'rgba(64, 227, 120, 0.12)',
                border: '1px solid rgba(64, 227, 120, 0.3)',
                color: 'var(--chatter-primary)',
                fontWeight: 700,
                fontSize: 14,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              <span>Send Direct Message</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
